# main.py — REMESAS | May Roga LLC
# FastAPI + Remittance Engine + Stripe
# Plataforma de comparación y asistencia para remesas.
# No ejecuta transferencias ni guarda datos sensibles.

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
    FinalCheckRequest,FinalCheckResponse,ParseNeedRequest,
    SessionResponse,UserNeedRequest
)

APP_NAME="REMESAS"
APP_VERSION="1.0.0"
BASE_DIR=Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"
DATA_DIR=BASE_DIR/"data"

app=FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Plataforma de comparación y asistencia para remesas.",
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
    index_file=STATIC_DIR/"index.html"
    if not index_file.exists():
        raise HTTPException(404,"Application interface not found.")
    return FileResponse(str(index_file))

@app.get("/health")
async def health()->Dict[str,Any]:
    brain=engine.brain
    return {
        "status":"ok",
        "app":APP_NAME,
        "version":APP_VERSION,
        "brain_loaded":bool(brain),
        "brain_version":brain.get("app",{}).get("version"),
        "stripe_configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1)
    }

@app.get("/ping",include_in_schema=False)
async def ping()->Dict[str,str]:
    return {"status":"ok"}

@app.get("/api/config")
async def public_configuration(language:str="es")->Dict[str,Any]:
    language=normalize_language(language)
    config=engine.public_config(language)
    config=dict(config)
    config["stripe"]={
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1),
        "publishable_key":STRIPE_PUBLISHABLE_KEY,
        "price":15.99,
        "currency":"USD",
        "period":"1_month"
    }
    return config

@app.get("/api/brain/version")
async def brain_version()->Dict[str,Any]:
    brain=engine.brain
    return {
        "app":APP_NAME,
        "version":brain.get("app",{}).get("version"),
        "engine_version":APP_VERSION
    }

@app.post("/api/session",response_model=SessionResponse)
async def create_session(language:str="es")->SessionResponse:
    language=normalize_language(language)
    session=engine.create_session(language)
    return SessionResponse(
        success=True,
        session=session,
        message=localized(
            "Sesión iniciada.",
            "Session started.",
            language
        )
    )

@app.get("/api/session/{session_id}",response_model=SessionResponse)
async def get_session(session_id:str)->SessionResponse:
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:
        raise HTTPException(404,"Session not found.")
    return SessionResponse(success=True,session=session)

@app.delete("/api/session/{session_id}")
async def delete_session(session_id:str)->Dict[str,Any]:
    validate_session_id(session_id)
    deleted=engine.clear_session(session_id)
    return {
        "success":deleted,
        "message":"Session cleared." if deleted else "Session already cleared."
    }

@app.post("/api/need",response_model=SessionResponse)
async def apply_need(request:Request)->SessionResponse:
    try:
        body=await request.json()
    except Exception:
        raise HTTPException(400,"Invalid request body.")

    if not isinstance(body,dict):
        raise HTTPException(400,"Invalid request body.")

    session_id=body.get("session_id")
    language=normalize_language(body.get("language","es"))

    if session_id:
        validate_session_id(str(session_id))
        if engine.get_session(str(session_id)) is None:
            raise HTTPException(404,"Session not found.")
    else:
        session=engine.create_session(language)
        session_id=session["session_id"]

    body["language"]=language
    body.pop("session_id",None)

    try:
        user_request=UserNeedRequest(**body)
        session=engine.apply_need(str(session_id),user_request)
    except KeyError:
        raise HTTPException(404,"Session not found.")
    except ValueError as exc:
        raise HTTPException(400,str(exc))

    return SessionResponse(success=True,session=session)

@app.post("/api/need/parse")
async def parse_need(request:ParseNeedRequest)->Dict[str,Any]:
    parsed=engine.parse_need(request)
    return {"success":True,"parsed":parsed}

@app.post("/api/session/{session_id}/need/parse")
async def parse_need_into_session(
    session_id:str,
    request:ParseNeedRequest
)->Dict[str,Any]:
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:
        raise HTTPException(404,"Session not found.")

    parsed=engine.parse_need(request)

    values={}
    for key in (
        "amount","destination_country","priority","urgency",
        "delivery_method","payment_method"
    ):
        value=parsed.get(key)
        if value is not None:
            values[key]=value

    values["parsed_user_need"]=parsed
    updated=engine.update_session(session_id,**values)

    return {
        "success":True,
        "parsed":parsed,
        "session":updated
    }

@app.post("/api/compare",response_model=ComparisonResponse)
async def compare(request:ComparisonRequest)->ComparisonResponse:
    if not request.destination_country:
        raise HTTPException(422,"Destination country is required.")
    if request.amount is None or request.amount<=0:
        raise HTTPException(422,"Amount must be greater than zero.")
    return engine.compare(request)

@app.post("/api/session/{session_id}/compare",response_model=ComparisonResponse)
async def compare_session(session_id:str)->ComparisonResponse:
    validate_session_id(session_id)
    session=engine.get_session(session_id)

    if session is None:
        raise HTTPException(404,"Session not found.")
    if session.get("amount") is None:
        raise HTTPException(422,"Amount is required.")
    if not session.get("destination_country"):
        raise HTTPException(422,"Destination country is required.")

    result=engine.compare_session(session_id)
    return result

@app.post("/api/session/{session_id}/select/{provider_id}")
async def select_provider_option(
    session_id:str,
    provider_id:str
)->Dict[str,Any]:
    validate_session_id(session_id)

    try:
        option=engine.select_provider(session_id,provider_id)
    except KeyError as exc:
        code=str(exc).strip("'")
        if code=="session_expired":
            raise HTTPException(404,"Session not found.")
        if code=="provider_not_found":
            raise HTTPException(404,"Provider not found.")
        if code=="provider_not_available":
            raise HTTPException(404,"Provider not available.")
        raise HTTPException(404,"Provider option not found.")

    return {
        "success":True,
        "selected_option":option,
        "session":engine.get_session(session_id)
    }

@app.post("/api/final-check",response_model=FinalCheckResponse)
async def final_check(request:FinalCheckRequest)->FinalCheckResponse:
    return engine.final_check(request)

@app.post("/api/session/{session_id}/final-check",response_model=FinalCheckResponse)
async def session_final_check(session_id:str)->FinalCheckResponse:
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
        amount=option.get("recipient_amount") and session.get("amount") or session.get("amount") or 0,
        send_currency=session.get("send_currency","USD"),
        destination_country=session.get("destination_country") or "",
        delivery_method=option.get("delivery_method") or session.get("delivery_method"),
        payment_method=session.get("payment_method"),
        recipient_amount=option.get("recipient_amount"),
        fee=option.get("fee"),
        exchange_rate=option.get("exchange_rate"),
        recipient_information_entered=False
    )

    result=engine.final_check(request,session_id=session_id)
    return FinalCheckResponse(**result)

@app.get("/api/session/{session_id}/help")
async def session_help(
    session_id:str,
    language:str="es"
)->Dict[str,Any]:
    validate_session_id(session_id)
    session=engine.get_session(session_id)

    if session is None:
        raise HTTPException(404,"Session not found.")

    language=normalize_language(language)
    step=session.get("current_step","opening")

    messages={
        "opening":{
            "es":"Indica cuánto quieres enviar, a qué país y qué es más importante para ti.",
            "en":"Enter how much you want to send, the destination country, and what matters most to you."
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

    message=messages.get(step,messages["opening"])
    return {
        "success":True,
        "message":message.get(language,message["es"])
    }

@app.post("/api/session/{session_id}/reset")
async def reset_session(session_id:str)->Dict[str,Any]:
    validate_session_id(session_id)
    deleted=engine.clear_session(session_id)
    return {
        "success":True,
        "cleared":deleted,
        "message":"Sesión borrada." if deleted else "La sesión ya estaba limpia."
    }

@app.delete("/api/local-data",response_model=DeleteLocalDataResponse)
async def local_data_info()->DeleteLocalDataResponse:
    return DeleteLocalDataResponse(
        success=True,
        message="El borrado de datos locales se realiza en este dispositivo."
    )

@app.get("/api/subscription/status")
async def subscription_status()->Dict[str,Any]:
    return {
        "configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "price":15.99,
        "currency":"USD",
        "period":"1_month"
    }

@app.get("/api/stripe/public")
async def stripe_public()->Dict[str,Any]:
    return {
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1),
        "publishable_key":STRIPE_PUBLISHABLE_KEY
    }

@app.post("/api/create-checkout-session")
async def create_checkout_session(request:Request)->Dict[str,Any]:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503,"Stripe is not configured.")
    if not STRIPE_PRICE_ID1:
        raise HTTPException(503,"Stripe Price ID is not configured.")

    base_url=str(request.base_url).rstrip("/")

    try:
        checkout=stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price":STRIPE_PRICE_ID1,"quantity":1}],
            success_url=f"{base_url}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/?payment=cancelled",
            allow_promotion_codes=True,
            billing_address_collection="auto"
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(502,"Unable to create the payment session.") from exc

    return {"success":True,"checkout_url":checkout.url}

@app.get("/api/payment/check")
async def payment_check(session_id:Optional[str]=None)->Dict[str,Any]:
    if not STRIPE_SECRET_KEY:
        return {"success":False,"active":False,"message":"Stripe not configured."}
    if not session_id:
        return {"success":False,"active":False,"message":"Payment session not provided."}

    try:
        checkout=stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription"]
        )
        paid=checkout.payment_status=="paid"
        subscription_active=False

        if checkout.mode=="subscription" and checkout.subscription:
            status=getattr(checkout.subscription,"status",None)
            subscription_active=status in {"active","trialing"}

        return {
            "success":True,
            "active":bool(paid and subscription_active),
            "payment_status":checkout.payment_status,
            "checkout_status":checkout.status,
            "mode":checkout.mode,
            "subscription_status":getattr(
                checkout.subscription,"status",None
            ) if checkout.subscription else None
        }
    except stripe.error.StripeError as exc:
        raise HTTPException(502,"Unable to verify payment.") from exc

@app.post("/api/stripe/webhook")
async def stripe_webhook(request:Request)->Dict[str,Any]:
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
            payload,signature,STRIPE_WEBHOOK_SECRET
        )
    except ValueError as exc:
        raise HTTPException(400,"Invalid webhook payload.") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(400,"Invalid webhook signature.") from exc

    event_type=event.get("type","")
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
        "event_type":event_type,
        "handled":event_type in handled
    }

@app.get("/api/admin/config-status")
async def admin_config_status(request:Request)->Dict[str,Any]:
    username=request.headers.get("X-Admin-Username","")
    password=request.headers.get("X-Admin-Password","")

    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(503,"Admin access is not configured.")

    if not secrets.compare_digest(username,ADMIN_USERNAME) or not secrets.compare_digest(password,ADMIN_PASSWORD):
        raise HTTPException(401,"Unauthorized.")

    return {
        "success":True,
        "app":APP_NAME,
        "version":APP_VERSION,
        "brain_loaded":bool(engine.brain),
        "gemini_configured":bool(GEMINI_API_KEY),
        "stripe_configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "stripe_webhook_configured":bool(STRIPE_WEBHOOK_SECRET)
    }

@app.exception_handler(ValueError)
async def value_error_handler(request:Request,exc:ValueError)->JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"success":False,"error":str(exc)}
    )

@app.exception_handler(Exception)
async def generic_error_handler(request:Request,exc:Exception)->JSONResponse:
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
    if not session_id or len(session_id)>128:
        raise HTTPException(400,"Invalid session.")

    allowed=set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
    if any(char not in allowed for char in session_id):
        raise HTTPException(400,"Invalid session.")

def localized(es:str,en:str,language:str)->str:
    return en if language=="en" else es
