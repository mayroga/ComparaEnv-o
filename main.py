# main.py — REMESAS | May Roga LLC
import os,secrets
from pathlib import Path
from typing import Any,Dict,Optional
import stripe
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from remittance_engine import engine
from schemas import (
    ComparisonRequest,ComparisonResponse,DeleteLocalDataResponse,
    FinalCheckRequest,FinalCheckResponse,MoneyPlanRequest,MoneyPlanResponse,
    ParseNeedRequest,SessionResponse,UserNeedRequest
)

APP_NAME="REMESAS"
APP_VERSION="1.1.0"
BASE_DIR=Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"

app=FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Plataforma de asistencia para dinero y comparación de remesas.",
    docs_url="/docs",
    redoc_url="/redoc"
)

if STATIC_DIR.exists():
    app.mount("/static",StaticFiles(directory=str(STATIC_DIR)),name="static")

ADMIN_USERNAME=os.getenv("ADMIN_USERNAME","")
ADMIN_PASSWORD=os.getenv("ADMIN_PASSWORD","")
GEMINI_API_KEY=os.getenv("GEMINI_API_KEY","")
STRIPE_PRICE_ID1=os.getenv("STRIPE_PRICE_ID1","")
STRIPE_PUBLISHABLE_KEY=os.getenv("STRIPE_PUBLISHABLE_KEY","")
STRIPE_SECRET_KEY=os.getenv("STRIPE_SECRET_KEY","")
STRIPE_WEBHOOK_SECRET=os.getenv("STRIPE_WEBHOOK_SECRET","")

if STRIPE_SECRET_KEY:
    stripe.api_key=STRIPE_SECRET_KEY

ALLOWED_LANGUAGES={"es","en"}
MAX_BODY_SIZE=1024*1024

@app.on_event("startup")
async def startup_event():
    engine.load_brain()

@app.get("/",include_in_schema=False)
async def root():
    index=STATIC_DIR/"index.html"
    if not index.exists():
        raise HTTPException(404,"Application interface not found.")
    return FileResponse(str(index))

@app.get("/health")
async def health():
    return {
        "status":"ok",
        "app":APP_NAME,
        "version":APP_VERSION,
        "brain_loaded":bool(engine.brain),
        "brain_version":engine.brain.get("app",{}).get("version"),
        "stripe_configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1)
    }

@app.get("/ping",include_in_schema=False)
async def ping():
    return {"status":"ok"}

@app.get("/api/config")
async def public_configuration(language:str="es"):
    language=normalize_language(language)
    config=engine.public_config(language)

    brain=engine.brain or {}
    config["money_assistant"]=build_money_config(brain,language)

    config["privacy"]={
        "server_persistence":False,
        "money_data_server_storage":False,
        "local_storage_allowed":True,
        "sensitive_credentials_never_stored":True
    }

    config["stripe"]={
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1),
        "publishable_key":STRIPE_PUBLISHABLE_KEY,
        "price":15.99,
        "currency":"USD",
        "period":"1_month"
    }

    return config

@app.get("/api/brain/version")
async def brain_version():
    return {
        "app":APP_NAME,
        "version":engine.brain.get("app",{}).get("version"),
        "engine_version":APP_VERSION
    }

@app.post("/api/session",response_model=SessionResponse)
async def create_session(language:str="es")->SessionResponse:
    language=normalize_language(language)
    return SessionResponse(
        success=True,
        session=engine.create_session(language),
        message=localized("Sesión iniciada.","Session started.",language)
    )

@app.get("/api/session/{session_id}",response_model=SessionResponse)
async def get_session(session_id:str):
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:
        raise HTTPException(404,"Session not found.")
    return SessionResponse(success=True,session=session)

@app.delete("/api/session/{session_id}")
async def delete_session(session_id:str):
    validate_session_id(session_id)
    deleted=engine.clear_session(session_id)
    return {
        "success":deleted,
        "message":"Session cleared." if deleted else "Session already cleared."
    }

@app.post("/api/need",response_model=SessionResponse)
async def apply_need(request:Request):
    try:
        body=await request.json()
    except Exception:
        raise HTTPException(400,"Invalid request body.")

    if not isinstance(body,dict):
        raise HTTPException(400,"Invalid request body.")

    session_id=str(body.get("session_id") or "")
    language=normalize_language(body.get("language","es"))

    if session_id:
        validate_session_id(session_id)
        if engine.get_session(session_id) is None:
            raise HTTPException(404,"Session not found.")
    else:
        session_id=engine.create_session(language)["session_id"]

    body.pop("session_id",None)
    body["language"]=language

    try:
        user_request=UserNeedRequest(**body)
        session=engine.apply_need(session_id,user_request)
    except KeyError:
        raise HTTPException(404,"Session not found.")
    except ValueError as exc:
        raise HTTPException(400,str(exc))

    return SessionResponse(
        success=True,
        session=session
    )

@app.post("/api/need/parse")
async def parse_need(request:ParseNeedRequest):
    return {"success":True,"parsed":engine.parse_need(request)}

@app.post("/api/session/{session_id}/need/parse")
async def parse_need_into_session(session_id:str,request:ParseNeedRequest):
    validate_session_id(session_id)

    if engine.get_session(session_id) is None:
        raise HTTPException(404,"Session not found.")

    parsed=engine.parse_need(request)

    values={
        k:parsed[k]
        for k in (
            "amount",
            "destination_country",
            "priority",
            "urgency",
            "delivery_method",
            "payment_method"
        )
        if parsed.get(k) is not None
    }

    values["parsed_user_need"]=parsed

    return {
        "success":True,
        "parsed":parsed,
        "session":engine.update_session(session_id,**values)
    }

@app.post("/api/compare",response_model=ComparisonResponse)
async def compare(request:ComparisonRequest):
    return engine.compare(request)

@app.post("/api/session/{session_id}/compare",response_model=ComparisonResponse)
async def compare_session(session_id:str):
    validate_session_id(session_id)

    session=engine.get_session(session_id)

    if session is None:
        raise HTTPException(404,"Session not found.")

    if not session.get("amount"):
        raise HTTPException(422,"Amount is required.")

    if not session.get("destination_country"):
        raise HTTPException(422,"Destination country is required.")

    return engine.compare_session(session_id)

@app.post("/api/session/{session_id}/select/{provider_id}")
async def select_provider_option(session_id:str,provider_id:str):
    validate_session_id(session_id)

    try:
        option=engine.select_provider(session_id,provider_id)
    except KeyError as exc:
        code=str(exc).strip("'")
        messages={
            "session_expired":(404,"Session not found."),
            "provider_not_found":(404,"Provider not found."),
            "provider_not_available":(404,"Provider not available.")
        }
        status,msg=messages.get(
            code,
            (404,"Provider option not found.")
        )
        raise HTTPException(status,msg)

    return {
        "success":True,
        "selected_option":option,
        "session":engine.get_session(session_id)
    }

@app.post("/api/final-check",response_model=FinalCheckResponse)
async def final_check(request:FinalCheckRequest):
    return engine.final_check(request)

@app.post("/api/session/{session_id}/final-check",response_model=FinalCheckResponse)
async def session_final_check(session_id:str):
    validate_session_id(session_id)

    session=engine.get_session(session_id)

    if session is None:
        raise HTTPException(404,"Session not found.")

    option=session.get("selected_option")

    if not option:
        raise HTTPException(422,"No option selected.")

    request=FinalCheckRequest(
        language=session.get("language","es"),
        provider_id=option.get("provider_id"),
        amount=session.get("amount") or 0,
        send_currency=session.get("send_currency","USD"),
        destination_country=session.get("destination_country") or "",
        delivery_method=option.get("delivery_method") or session.get("delivery_method"),
        payment_method=session.get("payment_method"),
        recipient_amount=option.get("recipient_amount"),
        fee=option.get("fee"),
        exchange_rate=option.get("exchange_rate")
    )

    return engine.final_check(request,session_id)

@app.get("/api/session/{session_id}/help")
async def session_help(session_id:str,language:str="es"):
    validate_session_id(session_id)

    session=engine.get_session(session_id)

    if session is None:
        raise HTTPException(404,"Session not found.")

    language=normalize_language(language)

    messages={
        "opening":{
            "es":"Primero podemos revisar cuánto quieres enviar y qué necesitas.",
            "en":"First, we can review how much you want to send and what you need."
        },
        "comparison":{
            "es":"Compara las opciones disponibles según tus necesidades.",
            "en":"Compare the available options according to your needs."
        },
        "results":{
            "es":"Revisa las opciones disponibles y continúa con el proveedor que elijas.",
            "en":"Review the available options and continue with the provider you choose."
        },
        "final_check":{
            "es":"Revisa los datos antes de continuar con el proveedor.",
            "en":"Review the information before continuing with the provider."
        }
    }

    step=session.get("current_step","opening")

    return {
        "success":True,
        "message":messages.get(
            step,
            messages["opening"]
        ).get(language)
    }

@app.post("/api/session/{session_id}/reset")
async def reset_session(session_id:str):
    validate_session_id(session_id)

    return {
        "success":True,
        "cleared":engine.clear_session(session_id),
        "message":"Sesión borrada."
    }

@app.delete("/api/local-data",response_model=DeleteLocalDataResponse)
async def local_data_info():
    return DeleteLocalDataResponse(
        success=True,
        message="El borrado de datos locales se realiza en este dispositivo."
    )

# ------------------------------------------------------------------
# 💵 MI DINERO
# ------------------------------------------------------------------

@app.post("/api/money-plan",response_model=MoneyPlanResponse)
async def money_plan(request:MoneyPlanRequest):
    """
    Calcula un plan temporal usando únicamente los datos enviados
    por el dispositivo. No guarda el plan en el servidor.
    """

    available=round(float(request.available_amount),2)
    send_amount=round(float(request.send_amount or 0),2)

    days=next_pay_days(request.next_pay)

    planned_expenses=round(
        sum(
            max(0,float(item.amount))
            for item in request.expenses
        ),
        2
    )

    remaining_before_send=round(
        max(0,available-planned_expenses),
        2
    )

    remaining_after_send=round(
        remaining_before_send-send_amount,
        2
    )

    daily_available=round(
        remaining_before_send/days,
        2
    )

    daily_after_send=round(
        max(0,remaining_after_send)/days,
        2
    )

    if send_amount<=0:
        transfer_status="not_selected"
    elif send_amount>remaining_before_send:
        transfer_status="not_possible"
    elif daily_after_send<daily_available*0.25:
        transfer_status="low_remaining"
    else:
        transfer_status="possible"

    if transfer_status=="not_possible":
        warning={
            "es":"Ese envío supera el dinero que tienes disponible después de tus gastos previstos.",
            "en":"That transfer is more than the money available after your planned expenses."
        }
    elif transfer_status=="low_remaining":
        warning={
            "es":"Después de ese envío te quedaría poco margen hasta tu próximo pago.",
            "en":"That transfer would leave you with a small amount until your next payment."
        }
    else:
        warning=None

    return MoneyPlanResponse(
        success=True,
        currency="USD",
        available_amount=available,
        next_pay=request.next_pay,
        days_until_next_pay=days,
        planned_expenses=planned_expenses,
        remaining_before_send=remaining_before_send,
        daily_available=daily_available,
        send_amount=send_amount,
        remaining_after_send=remaining_after_send,
        daily_after_send=daily_after_send,
        transfer_status=transfer_status,
        warning=warning
    )

@app.post("/api/money/check-transfer",response_model=MoneyPlanResponse)
async def money_check_transfer(request:MoneyPlanRequest):
    """
    Mismo cálculo de seguridad para cuando el usuario modifica
    solamente la cantidad que desea enviar.
    No guarda información.
    """
    return await money_plan(request)

@app.get("/api/money/config")
async def money_config(language:str="es"):
    language=normalize_language(language)
    return build_money_config(engine.brain or {},language)

# ------------------------------------------------------------------
# STRIPE
# ------------------------------------------------------------------

@app.get("/api/subscription/status")
async def subscription_status():
    return {
        "configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "price":15.99,
        "currency":"USD",
        "period":"1_month"
    }

@app.get("/api/stripe/public")
async def stripe_public():
    return {
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1),
        "publishable_key":STRIPE_PUBLISHABLE_KEY
    }

@app.post("/api/create-checkout-session")
async def create_checkout_session(request:Request):
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID1:
        raise HTTPException(503,"Stripe is not configured.")

    base_url=str(request.base_url).rstrip("/")

    try:
        checkout=stripe.checkout.Session.create(
            mode="subscription",
            line_items=[
                {
                    "price":STRIPE_PRICE_ID1,
                    "quantity":1
                }
            ],
            success_url=f"{base_url}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/?payment=cancelled",
            allow_promotion_codes=True,
            billing_address_collection="auto"
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(
            502,
            "Unable to create the payment session."
        ) from exc

    return {
        "success":True,
        "checkout_url":checkout.url
    }

@app.get("/api/payment/check")
async def payment_check(session_id:Optional[str]=None):
    if not STRIPE_SECRET_KEY:
        return {
            "success":False,
            "active":False,
            "message":"Stripe not configured."
        }

    if not session_id:
        return {
            "success":False,
            "active":False,
            "message":"Payment session not provided."
        }

    try:
        checkout=stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription"]
        )

        paid=checkout.payment_status=="paid"
        sub=getattr(checkout,"subscription",None)
        status=getattr(sub,"status",None) if sub else None

        return {
            "success":True,
            "active":bool(
                paid and status in {"active","trialing"}
            ),
            "payment_status":checkout.payment_status,
            "checkout_status":checkout.status,
            "mode":checkout.mode,
            "subscription_status":status
        }

    except stripe.error.StripeError as exc:
        raise HTTPException(
            502,
            "Unable to verify payment."
        ) from exc

@app.post("/api/stripe/webhook")
async def stripe_webhook(request:Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503,"Stripe webhook is not configured.")

    payload=await request.body()

    if len(payload)>MAX_BODY_SIZE:
        raise HTTPException(413,"Webhook payload too large.")

    signature=request.headers.get("stripe-signature")

    if not signature:
        raise HTTPException(400,"Missing Stripe signature.")

    try:
        event=stripe.Webhook.construct_event(
            payload,
            signature,
            STRIPE_WEBHOOK_SECRET
        )
    except ValueError as exc:
        raise HTTPException(
            400,
            "Invalid webhook payload."
        ) from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(
            400,
            "Invalid webhook signature."
        ) from exc

    handled={
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed"
    }

    return {
        "success":True,
        "received":True,
        "event_type":event.get("type",""),
        "handled":event.get("type","") in handled
    }

# ------------------------------------------------------------------
# ADMIN
# ------------------------------------------------------------------

@app.get("/api/admin/config-status")
async def admin_config_status(request:Request):
    username=request.headers.get("X-Admin-Username","")
    password=request.headers.get("X-Admin-Password","")

    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(
            503,
            "Admin access is not configured."
        )

    if (
        not secrets.compare_digest(username,ADMIN_USERNAME)
        or not secrets.compare_digest(password,ADMIN_PASSWORD)
    ):
        raise HTTPException(401,"Unauthorized.")

    return {
        "success":True,
        "app":APP_NAME,
        "version":APP_VERSION,
        "brain_loaded":bool(engine.brain),
        "gemini_configured":bool(GEMINI_API_KEY),
        "stripe_configured":bool(
            STRIPE_SECRET_KEY and STRIPE_PRICE_ID1
        ),
        "stripe_webhook_configured":bool(
            STRIPE_WEBHOOK_SECRET
        )
    }

# ------------------------------------------------------------------
# ERRORS
# ------------------------------------------------------------------

@app.exception_handler(ValueError)
async def value_error_handler(request:Request,exc:ValueError):
    return JSONResponse(
        status_code=400,
        content={
            "success":False,
            "error":str(exc)
        }
    )

@app.exception_handler(Exception)
async def generic_error_handler(request:Request,exc:Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success":False,
            "error":"Ocurrió un problema. Intenta nuevamente."
        }
    )

# ------------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------------

def normalize_language(language:Optional[str])->str:
    value=(language or "es").lower().strip()
    return value if value in ALLOWED_LANGUAGES else "es"

def validate_session_id(session_id:str)->None:
    if not session_id or len(session_id)>128:
        raise HTTPException(400,"Invalid session.")

    allowed=set(
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789-_"
    )

    if any(c not in allowed for c in session_id):
        raise HTTPException(400,"Invalid session.")

def localized(es:str,en:str,language:str)->str:
    return en if language=="en" else es

def next_pay_days(value:str)->int:
    mapping={
        "today":1,
        "this_week":7,
        "in_2_weeks":14,
        "this_month":30
    }
    return mapping.get(value,7)

def build_money_config(brain:Dict[str,Any],language:str)->Dict[str,Any]:
    configured=brain.get("money_assistant",{})

    if not isinstance(configured,dict):
        configured={}

    def localize_value(value:Any)->Any:
        if isinstance(value,dict):
            if language in value:
                return value[language]
            return {
                k:localize_value(v)
                for k,v in value.items()
            }
        if isinstance(value,list):
            return [localize_value(v) for v in value]
        return value

    if configured:
        return localize_value(configured)

    return {
        "enabled":True,
        "currency":"USD",
        "next_pay_options":[
            {
                "id":"today",
                "label":"Hoy" if language=="es" else "Today",
                "days":1
            },
            {
                "id":"this_week",
                "label":"Esta semana" if language=="es" else "This week",
                "days":7
            },
            {
                "id":"in_2_weeks",
                "label":"En 2 semanas" if language=="es" else "In 2 weeks",
                "days":14
            },
            {
                "id":"this_month",
                "label":"Este mes" if language=="es" else "This month",
                "days":30
            }
        ],
        "expense_categories":[
            {
                "id":"home",
                "label":"Casa" if language=="es" else "Home"
            },
            {
                "id":"food",
                "label":"Comida" if language=="es" else "Food"
            },
            {
                "id":"car",
                "label":"Carro" if language=="es" else "Car"
            },
            {
                "id":"insurance",
                "label":"Seguro" if language=="es" else "Insurance"
            },
            {
                "id":"phone",
                "label":"Teléfono" if language=="es" else "Phone"
            },
            {
                "id":"debts",
                "label":"Deudas" if language=="es" else "Debts"
            },
            {
                "id":"family",
                "label":"Familia" if language=="es" else "Family"
            },
            {
                "id":"other",
                "label":"Otro" if language=="es" else "Other"
            }
        ],
        "sections":{
            "home":"INICIO" if language=="es" else "HOME",
            "week":"MI SEMANA" if language=="es" else "MY WEEK",
            "send":"ENVIAR DINERO" if language=="es" else "SEND MONEY",
            "expenses":"MIS GASTOS" if language=="es" else "MY EXPENSES",
            "family":"FAMILIA" if language=="es" else "FAMILY"
        }
    }
