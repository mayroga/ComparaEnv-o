import os,secrets
from pathlib import Path
from typing import Optional
import stripe
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles

from remittance_engine import engine
from schemas import (
    ComparisonRequest,ComparisonResponse,
    DeleteLocalDataResponse,FinalCheckRequest,
    FinalCheckResponse,ParseNeedRequest,
    SessionResponse,UserNeedRequest
)

APP_NAME="REMESAS"
APP_VERSION="4.0.0"
BASE_DIR=Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"

app=FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Asistencia sencilla para remesas y organización personal del dinero.",
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
MAX_SESSION_ID_LENGTH=128

@app.on_event("startup")
async def startup_event():
    engine.load_brain()
    engine.load_providers()

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
        "providers_loaded":bool(engine.providers_data),
        "provider_count":len(engine.get_provider_registry()),
        "stripe_configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1)
    }

@app.get("/ping",include_in_schema=False)
async def ping():
    return {"status":"ok"}

@app.get("/api/config")
async def public_configuration(language:str="es"):
    language=normalize_language(language)
    config=engine.public_config(language)
    config["stripe"]={
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1),
        "publishable_key":STRIPE_PUBLISHABLE_KEY,
        "price":15.99,
        "currency":"USD",
        "period":"1_month"
    }
    config["privacy"]={
        "local_data_only":True,
        "server_persistence":False,
        "transient_session_processing":True,
        "never_collect":[
            "passwords",
            "CVV",
            "security_codes",
            "bank_login",
            "provider_credentials"
        ]
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
async def create_session(language:str="es"):
    language=normalize_language(language)
    session=engine.create_session(language)
    return SessionResponse(
        success=True,
        session=session,
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
async def delete_session(session_id:str,language:str="es"):
    validate_session_id(session_id)
    language=normalize_language(language)
    deleted=engine.clear_session(session_id)
    return {
        "success":deleted,
        "message":localized(
            "Sesión borrada." if deleted else "La sesión ya estaba borrada.",
            "Session cleared." if deleted else "Session was already cleared.",
            language
        )
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
            raise HTTPException(
                404,
                localized(
                    "Sesión no encontrada.",
                    "Session not found.",
                    language
                )
            )
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
    language=normalize_language(request.language)
    request.language=language
    parsed=engine.parse_need(request)
    return {
        "success":True,
        "parsed":parsed,
        "assistant":engine.assistant_response(
            parsed.get("need_type","other"),
            language,
            request.text
        )
    }

@app.post("/api/session/{session_id}/need/parse")
async def parse_need_into_session(
    session_id:str,
    request:ParseNeedRequest
):
    validate_session_id(session_id)

    if engine.get_session(session_id) is None:
        raise HTTPException(404,"Session not found.")

    request.language=normalize_language(request.language)
    parsed=engine.parse_need(request)

    values={
        "amount":parsed.get("amount"),
        "destination_country":parsed.get("destination_country"),
        "priority":parsed.get("priority"),
        "urgency":parsed.get("urgency"),
        "frequency":parsed.get("frequency"),
        "delivery_method":parsed.get("delivery_method"),
        "payment_method":parsed.get("payment_method"),
        "need_type":parsed.get("need_type","other"),
        "parsed_user_need":parsed,
        "free_text":request.text
    }

    values={k:v for k,v in values.items() if v is not None}

    updated=engine.update_session(session_id,**values)
    updated["current_step"]=engine._next_step(updated)
    engine.sessions[session_id]["current_step"]=updated["current_step"]

    return {
        "success":True,
        "parsed":parsed,
        "assistant":engine.assistant_response(
            parsed.get("need_type","other"),
            request.language,
            request.text
        ),
        "session":engine.get_session(session_id)
    }

@app.post("/api/assistant")
async def assistant(request:ParseNeedRequest):
    request.language=normalize_language(request.language)
    parsed=engine.parse_need(request)
    return {
        "success":True,
        "parsed":parsed,
        "assistant":engine.assistant_response(
            parsed.get("need_type","other"),
            request.language,
            request.text
        ),
        "help_topics":engine.help_topics(request.language)
    }

@app.get("/api/help")
async def help_topics(language:str="es"):
    language=normalize_language(language)
    return {
        "success":True,
        "language":language,
        "topics":engine.help_topics(language)
    }

@app.get("/api/help/{topic}")
async def help_topic(topic:str,language:str="es"):
    language=normalize_language(language)
    for item in engine.help_topics(language):
        if item.get("id")==topic:
            return {
                "success":True,
                "topic":item
            }
    raise HTTPException(
        404,
        localized(
            "Tema de ayuda no encontrado.",
            "Help topic not found.",
            language
        )
    )

@app.get("/api/providers")
async def providers(language:str="es"):
    language=normalize_language(language)
    config=engine.public_config(language)
    return {
        "success":True,
        "providers":config.get("providers",[])
    }

@app.get("/api/provider/{provider_id}")
async def provider(
    provider_id:str,
    language:str="es",
    country:str=""
):
    language=normalize_language(language)

    item=engine.provider_public_option(
        provider_id,
        country.upper().strip(),
        language
    )

    if not item:
        raise HTTPException(
            404,
            localized(
                "Proveedor no encontrado.",
                "Provider not found.",
                language
            )
        )

    item["requirements"]=engine.provider_requirements(
        provider_id,
        language
    )

    return {
        "success":True,
        "provider":item
    }

@app.post("/api/compare",response_model=ComparisonResponse)
async def compare(request:ComparisonRequest):
    request.language=normalize_language(request.language)
    request.destination_country=request.destination_country.upper().strip()
    return engine.compare(request)

@app.post(
    "/api/session/{session_id}/compare",
    response_model=ComparisonResponse
)
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
async def select_provider_option(
    session_id:str,
    provider_id:str
):
    validate_session_id(session_id)

    try:
        option=engine.select_provider(
            session_id,
            provider_id
        )
    except KeyError as exc:
        code=str(exc).strip("'")
        messages={
            "session_expired":(404,"Session not found."),
            "provider_not_found":(404,"Provider not found."),
            "provider_not_available":(
                404,
                "Provider not available for this destination."
            )
        }
        status,msg=messages.get(
            code,
            (404,"Provider option not found.")
        )
        raise HTTPException(status,msg)
    except ValueError as exc:
        raise HTTPException(400,str(exc))

    return {
        "success":True,
        "selected_option":option,
        "session":engine.get_session(session_id)
    }

@app.post("/api/final-check",response_model=FinalCheckResponse)
async def final_check(request:FinalCheckRequest):
    request.language=normalize_language(request.language)
    request.destination_country=request.destination_country.upper().strip()
    return engine.final_check(request)

@app.post(
    "/api/session/{session_id}/final-check",
    response_model=FinalCheckResponse
)
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
        provider_id=option.get("provider_id",""),
        amount=session.get("amount") or 0,
        send_currency=session.get("send_currency","USD"),
        destination_country=session.get("destination_country") or "",
        delivery_method=option.get("delivery_method") or session.get("delivery_method"),
        payment_method=option.get("payment_method") or session.get("payment_method"),
        recipient_amount=option.get("recipient_amount"),
        fee=option.get("fee"),
        exchange_rate=option.get("exchange_rate")
    )

    return engine.final_check(
        request,
        session_id
    )

@app.get("/api/session/{session_id}/help")
async def session_help(
    session_id:str,
    language:str="es"
):
    validate_session_id(session_id)

    if engine.get_session(session_id) is None:
        raise HTTPException(404,"Session not found.")

    language=normalize_language(language)

    return {
        "success":True,
        "language":language,
        "topics":engine.help_topics(language)
    }

@app.post("/api/session/{session_id}/reset")
async def reset_session(
    session_id:str,
    language:str="es"
):
    validate_session_id(session_id)
    language=normalize_language(language)

    return {
        "success":True,
        "cleared":engine.clear_session(session_id),
        "message":localized(
            "Sesión borrada.",
            "Session cleared.",
            language
        )
    }

@app.delete(
    "/api/local-data",
    response_model=DeleteLocalDataResponse
)
async def local_data_info(language:str="es"):
    language=normalize_language(language)

    return DeleteLocalDataResponse(
        success=True,
        message=localized(
            "Los datos personales de dinero se guardan en este dispositivo. La sesión del servidor es temporal y no se almacena en una base de datos permanente.",
            "Personal money data stays on this device. The server session is temporary and is not stored in a permanent database.",
            language
        )
    )

@app.get("/api/subscription/status")
async def subscription_status(language:str="es"):
    language=normalize_language(language)

    return {
        "configured":bool(
            STRIPE_SECRET_KEY and STRIPE_PRICE_ID1
        ),
        "price":15.99,
        "currency":"USD",
        "period":"1_month",
        "message":localized(
            "Suscripción mensual.",
            "Monthly subscription.",
            language
        )
    }

@app.get("/api/stripe/public")
async def stripe_public():
    return {
        "enabled":bool(
            STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1
        ),
        "publishable_key":STRIPE_PUBLISHABLE_KEY
    }

@app.post("/api/create-checkout-session")
async def create_checkout_session(request:Request):
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID1:
        raise HTTPException(
            503,
            "Stripe is not configured."
        )

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
            success_url=(
                f"{base_url}/?payment=success"
                f"&session_id={{CHECKOUT_SESSION_ID}}"
            ),
            cancel_url=(
                f"{base_url}/?payment=cancelled"
            ),
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
async def payment_check(
    session_id:Optional[str]=None
):
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
        sub=getattr(
            checkout,
            "subscription",
            None
        )
        status=getattr(
            sub,
            "status",
            None
        ) if sub else None

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
        raise HTTPException(
            503,
            "Stripe webhook is not configured."
        )

    payload=await request.body()

    if len(payload)>MAX_BODY_SIZE:
        raise HTTPException(
            413,
            "Webhook payload too large."
        )

    signature=request.headers.get("stripe-signature")

    if not signature:
        raise HTTPException(
            400,
            "Missing Stripe signature."
        )

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

    event_type=event.get("type","")

    return {
        "success":True,
        "received":True,
        "event_type":event_type,
        "handled":event_type in handled
    }

@app.get("/api/admin/config-status")
async def admin_config_status(request:Request):
    username=request.headers.get(
        "X-Admin-Username",
        ""
    )
    password=request.headers.get(
        "X-Admin-Password",
        ""
    )

    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(
            503,
            "Admin access is not configured."
        )

    if not secrets.compare_digest(
        username,
        ADMIN_USERNAME
    ) or not secrets.compare_digest(
        password,
        ADMIN_PASSWORD
    ):
        raise HTTPException(
            401,
            "Unauthorized."
        )

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
        ),
        "providers_loaded":len(
            engine.get_provider_registry()
        )
    }

@app.exception_handler(ValueError)
async def value_error_handler(
    request:Request,
    exc:ValueError
):
    return JSONResponse(
        status_code=400,
        content={
            "success":False,
            "error":str(exc)
        }
    )

@app.exception_handler(Exception)
async def generic_error_handler(
    request:Request,
    exc:Exception
):
    return JSONResponse(
        status_code=500,
        content={
            "success":False,
            "error":"Ocurrió un problema. Intenta nuevamente."
        }
    )

def normalize_language(language:Optional[str])->str:
    value=(language or "es").lower().strip()
    return value if value in ALLOWED_LANGUAGES else "es"

def validate_session_id(session_id:str)->None:
    if not session_id or len(session_id)>MAX_SESSION_ID_LENGTH:
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
