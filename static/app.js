# main.py — REMESAS | May Roga LLC | v4.2.1
import os,secrets,time
from pathlib import Path
from typing import Any,Dict,Optional
import stripe
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from remittance_engine import engine
from schemas import ComparisonRequest,ComparisonResponse,DeleteLocalDataResponse,FinalCheckRequest,FinalCheckResponse,ParseNeedRequest,SessionResponse,UserNeedRequest

APP_NAME="REMESAS"
APP_VERSION="4.2.1"
SERVICE_PRICE=10.99
SERVICE_CURRENCY="USD"
SERVICE_MINUTES=20
ACCESS_SECONDS=SERVICE_MINUTES*60
BASE_DIR=Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"

app=FastAPI(title=APP_NAME,version=APP_VERSION,description="Servicio independiente para organizar dinero, preparar remesas, aprender el proceso y revisar información de proveedores oficiales.",docs_url="/docs",redoc_url="/redoc")
if STATIC_DIR.exists():app.mount("/static",StaticFiles(directory=str(STATIC_DIR)),name="static")

ADMIN_USERNAME=os.getenv("ADMIN_USERNAME","")
ADMIN_PASSWORD=os.getenv("ADMIN_PASSWORD","")
GEMINI_API_KEY=os.getenv("GEMINI_API_KEY","")
STRIPE_PRICE_ID1=os.getenv("STRIPE_PRICE_ID1","")
STRIPE_PUBLISHABLE_KEY=os.getenv("STRIPE_PUBLISHABLE_KEY","")
STRIPE_SECRET_KEY=os.getenv("STRIPE_SECRET_KEY","")
STRIPE_WEBHOOK_SECRET=os.getenv("STRIPE_WEBHOOK_SECRET","")
if STRIPE_SECRET_KEY:stripe.api_key=STRIPE_SECRET_KEY

ALLOWED_LANGUAGES={"es","en"}
MAX_BODY_SIZE=1024*1024
ACCESS_TOKENS:Dict[str,Dict[str,Any]]={}
PAYMENT_ACCESS:Dict[str,float]={}
REDEEMED_PAYMENTS=set()

def normalize_language(language:Optional[str])->str:
    value=(language or "es").lower().strip()
    return value if value in ALLOWED_LANGUAGES else "es"

def localized(es:str,en:str,language:str)->str:
    return en if normalize_language(language)=="en" else es

def validate_session_id(session_id:str)->None:
    if not session_id or len(session_id)>128:raise HTTPException(400,"Invalid session.")
    allowed=set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
    if any(c not in allowed for c in session_id):raise HTTPException(400,"Invalid session.")

def cleanup_access()->None:
    now=time.time()
    expired=[token for token,data in ACCESS_TOKENS.items() if float(data.get("expires_at",0))<=now]
    for token in expired:ACCESS_TOKENS.pop(token,None)
    expired_payments=[sid for sid,expires in PAYMENT_ACCESS.items() if float(expires)<=now]
    for sid in expired_payments:PAYMENT_ACCESS.pop(sid,None)

def create_access(subject:str,seconds:int=ACCESS_SECONDS)->Dict[str,Any]:
    cleanup_access()
    token=secrets.token_urlsafe(32)
    expires_at=time.time()+seconds
    ACCESS_TOKENS[token]={"subject":subject,"expires_at":expires_at,"created_at":time.time()}
    return {"token":token,"expires_at":expires_at,"seconds":seconds}

def access_from_request(request:Request)->Dict[str,Any]:
    cleanup_access()
    token=request.headers.get("X-Remesas-Access-Token","").strip()
    if not token:
        auth=request.headers.get("Authorization","")
        if auth.startswith("Bearer "):token=auth[7:].strip()
    data=ACCESS_TOKENS.get(token)
    if not data or float(data.get("expires_at",0))<=time.time():
        ACCESS_TOKENS.pop(token,None)
        raise HTTPException(401,"Access required or expired.")
    return {"token":token,**data}

def require_access(request:Request)->Dict[str,Any]:
    return access_from_request(request)

def public_access(request:Request)->Dict[str,Any]:
    cleanup_access()
    token=request.headers.get("X-Remesas-Access-Token","").strip()
    if not token:
        auth=request.headers.get("Authorization","")
        if auth.startswith("Bearer "):token=auth[7:].strip()
    data=ACCESS_TOKENS.get(token)
    if not data or float(data.get("expires_at",0))<=time.time():
        return {"active":False,"seconds_remaining":0}
    remaining=max(0,int(float(data["expires_at"])-time.time()))
    return {"active":True,"seconds_remaining":remaining,"expires_at":data["expires_at"],"subject":data.get("subject")}

async def json_body(request:Request)->Dict[str,Any]:
    try:body=await request.json()
    except Exception:raise HTTPException(400,"Invalid request body.")
    if not isinstance(body,dict):raise HTTPException(400,"Invalid request body.")
    return body

@app.on_event("startup")
async def startup_event():
    engine.reload()

@app.get("/",include_in_schema=False)
async def root():
    index=STATIC_DIR/"index.html"
    if not index.exists():raise HTTPException(404,"Application interface not found.")
    return FileResponse(str(index))

@app.get("/health")
async def health():
    return {
        "status":"ok",
        "app":APP_NAME,
        "version":APP_VERSION,
        "engine_version":getattr(__import__("remittance_engine"),"ENGINE_VERSION",APP_VERSION),
        "brain_loaded":bool(engine.brain),
        "brain_version":engine.brain.get("app",{}).get("version"),
        "stripe_configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "service_price":SERVICE_PRICE,
        "service_currency":SERVICE_CURRENCY,
        "service_minutes":SERVICE_MINUTES
    }

@app.get("/ping",include_in_schema=False)
async def ping():return {"status":"ok"}

@app.get("/api/config")
async def public_configuration(language:str="es"):
    language=normalize_language(language)
    config=engine.public_config(language)
    config["stripe"]={
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1 and STRIPE_SECRET_KEY),
        "publishable_key":STRIPE_PUBLISHABLE_KEY,
        "price":SERVICE_PRICE,
        "currency":SERVICE_CURRENCY,
        "payment_mode":"payment",
        "period":"one_time",
        "service_minutes":SERVICE_MINUTES
    }
    config["service"]={
        "name":APP_NAME,
        "price":SERVICE_PRICE,
        "currency":SERVICE_CURRENCY,
        "minutes":SERVICE_MINUTES,
        "payment_type":"one_time",
        "subscription":False
    }
    return config

@app.get("/api/brain/version")
async def brain_version():
    return {
        "app":APP_NAME,
        "version":engine.brain.get("app",{}).get("version",APP_VERSION),
        "engine_version":APP_VERSION
    }

# ============================================================
# ACCESO DEL SERVICIO
# ============================================================

@app.get("/api/service/info")
async def service_info(language:str="es"):
    language=normalize_language(language)
    return {
        "success":True,
        "app":APP_NAME,
        "price":SERVICE_PRICE,
        "currency":SERVICE_CURRENCY,
        "minutes":SERVICE_MINUTES,
        "payment_type":"one_time",
        "subscription":False,
        "title":localized("Servicio REMESAS","REMESAS Service",language),
        "message":localized("Un solo pago. Acceso al servicio durante 20 minutos.","One payment. Access to the service for 20 minutes.",language),
        "includes":{
            "es":[
                "Organización del dinero",
                "Preparación de remesas",
                "Comparación de información verificada",
                "APRENDER",
                "GUÍA RÁPIDA",
                "Revisión antes de continuar"
            ],
            "en":[
                "Money organization",
                "Remittance preparation",
                "Comparison of verified information",
                "LEARN",
                "QUICK GUIDE",
                "Review before continuing"
            ]
        }[language]
    }

@app.get("/api/access/status")
async def access_status(request:Request):
    return {"success":True,**public_access(request)}

@app.get("/api/access/verify")
async def access_verify(request:Request):
    data=require_access(request)
    remaining=max(0,int(float(data["expires_at"])-time.time()))
    return {
        "success":True,
        "authorized":True,
        "active":remaining>0,
        "seconds_remaining":remaining,
        "expires_at":data["expires_at"],
        "subject":data.get("subject")
    }

@app.post("/api/access/verify")
async def access_verify_post(request:Request):
    return await access_verify(request)

@app.post("/api/access/admin")
async def admin_access(request:Request):
    body=await json_body(request)
    username=str(body.get("username") or "")
    password=str(body.get("password") or "")
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(503,"Admin access is not configured.")
    if not secrets.compare_digest(username,ADMIN_USERNAME) or not secrets.compare_digest(password,ADMIN_PASSWORD):
        raise HTTPException(401,"Invalid credentials.")
    access=create_access("admin",ACCESS_SECONDS)
    return {
        "success":True,
        "authorized":True,
        "role":"admin",
        "access":True,
        **access
    }

@app.post("/api/login-admin")
async def login_admin_compat(request:Request):
    return await admin_access(request)

@app.post("/api/admin/login")
async def admin_login_compat(request:Request):
    return await admin_access(request)

@app.post("/api/admin/logout")
async def admin_logout(request:Request):
    token=request.headers.get("X-Remesas-Access-Token","").strip()
    if token:ACCESS_TOKENS.pop(token,None)
    return {"success":True,"logged_out":True}

@app.post("/api/service/start")
async def service_start(request:Request):
    access=require_access(request)
    language=normalize_language(request.headers.get("X-Remesas-Language","es"))
    session=engine.create_session(language)
    remaining=max(0,int(float(access["expires_at"])-time.time()))
    return {
        "success":True,
        "authorized":True,
        "active":remaining>0,
        "session_id":session["session_id"],
        "session":session,
        "seconds_remaining":remaining,
        "message":localized("Servicio iniciado.","Service started.",language)
    }

# ============================================================
# SESIONES Y NECESIDADES
# ============================================================

@app.post("/api/session",response_model=SessionResponse)
async def create_session(request:Request,language:str="es"):
    language=normalize_language(language)
    return SessionResponse(
        success=True,
        session=engine.create_session(language),
        message=localized("Sesión iniciada.","Session started.",language)
    )

@app.get("/api/session/{session_id}",response_model=SessionResponse)
async def get_session(session_id:str,request:Request):
    require_access(request)
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:raise HTTPException(404,"Session not found.")
    return SessionResponse(success=True,session=session)

@app.delete("/api/session/{session_id}")
async def delete_session(session_id:str,request:Request):
    require_access(request)
    validate_session_id(session_id)
    deleted=engine.clear_session(session_id)
    return {"success":deleted,"message":"Session cleared." if deleted else "Session already cleared."}

@app.post("/api/need",response_model=SessionResponse)
async def apply_need(request:Request):
    require_access(request)
    body=await json_body(request)
    session_id=str(body.get("session_id") or "")
    language=normalize_language(body.get("language","es"))
    if session_id:
        validate_session_id(session_id)
        if engine.get_session(session_id) is None:raise HTTPException(404,"Session not found.")
    else:
        session_id=engine.create_session(language)["session_id"]
    body.pop("session_id",None)
    body["language"]=language
    try:
        user_request=UserNeedRequest(**body)
        session=engine.apply_need(session_id,user_request)
    except KeyError:raise HTTPException(404,"Session not found.")
    except ValueError as exc:raise HTTPException(400,str(exc))
    return SessionResponse(success=True,session=session)

@app.post("/api/need/parse")
async def parse_need(request:Request):
    require_access(request)
    body=await json_body(request)
    parsed_request=ParseNeedRequest(**body)
    return {"success":True,"parsed":engine.parse_need(parsed_request)}

@app.post("/api/session/{session_id}/need/parse")
async def parse_need_into_session(session_id:str,request:Request):
    require_access(request)
    validate_session_id(session_id)
    if engine.get_session(session_id) is None:raise HTTPException(404,"Session not found.")
    body=await json_body(request)
    parsed_request=ParseNeedRequest(**body)
    parsed=engine.parse_need(parsed_request)
    values={k:parsed[k] for k in ("amount","destination_country","priority","urgency","delivery_method","payment_method") if parsed.get(k) is not None}
    values["parsed_user_need"]=parsed
    session=engine.update_session(session_id,**values)
    return {"success":True,"parsed":parsed,"session":session}

# ============================================================
# COMPARAR
# ============================================================

@app.post("/api/compare",response_model=ComparisonResponse)
async def compare(request:Request):
    require_access(request)
    body=await json_body(request)
    comparison=ComparisonRequest(**body)
    return engine.compare(comparison)

@app.post("/api/session/{session_id}/compare",response_model=ComparisonResponse)
async def compare_session(session_id:str,request:Request):
    require_access(request)
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:raise HTTPException(404,"Session not found.")
    if not session.get("amount"):raise HTTPException(422,"Amount is required.")
    if not session.get("destination_country"):raise HTTPException(422,"Destination country is required.")
    return engine.compare_session(session_id)

@app.post("/api/session/{session_id}/select/{provider_id}")
async def select_provider_option(session_id:str,provider_id:str,request:Request):
    require_access(request)
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
        status,msg=messages.get(code,(404,"Provider option not found."))
        raise HTTPException(status,msg)
    return {"success":True,"selected_option":option,"session":engine.get_session(session_id)}

# ============================================================
# REVISIÓN FINAL
# ============================================================

@app.post("/api/final-check",response_model=FinalCheckResponse)
async def final_check(request:Request):
    require_access(request)
    body=await json_body(request)
    final_request=FinalCheckRequest(**body)
    return engine.final_check(final_request)

@app.post("/api/session/{session_id}/final-check",response_model=FinalCheckResponse)
async def session_final_check(session_id:str,request:Request):
    require_access(request)
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:raise HTTPException(404,"Session not found.")
    option=session.get("selected_option")
    if not option:raise HTTPException(422,"No option selected.")
    final_request=FinalCheckRequest(
        language=session.get("language","es"),
        provider_id=option.get("provider_id"),
        amount=session.get("amount") or 0,
        send_currency=session.get("send_currency","USD"),
        destination_country=session.get("destination_country") or "",
        delivery_method=option.get("delivery_method") or session.get("delivery_method"),
        payment_method=session.get("payment_method"),
        recipient_information_entered=bool(session.get("recipient_information_entered",False)),
        recipient_amount=option.get("recipient_amount"),
        fee=option.get("fee"),
        exchange_rate=option.get("exchange_rate")
    )
    return engine.final_check(final_request,session_id)

# ============================================================
# AYUDA
# ============================================================

@app.get("/api/session/{session_id}/help")
async def session_help(session_id:str,request:Request,language:str="es"):
    require_access(request)
    validate_session_id(session_id)
    session=engine.get_session(session_id)
    if session is None:raise HTTPException(404,"Session not found.")
    language=normalize_language(language)
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
        },
        "assistant":{
            "es":"Dime qué necesitas y la aplicación te llevará a la acción correspondiente.",
            "en":"Tell me what you need and the app will take you to the appropriate action."
        }
    }
    step=session.get("current_step","opening")
    return {"success":True,"message":messages.get(step,messages["opening"]).get(language)}

@app.get("/api/help")
async def general_help(request:Request,language:str="es"):
    require_access(request)
    return {"success":True,"language":normalize_language(language),"topics":engine.help_topics(normalize_language(language))}

@app.post("/api/session/{session_id}/reset")
async def reset_session(session_id:str,request:Request):
    require_access(request)
    validate_session_id(session_id)
    return {"success":True,"cleared":engine.clear_session(session_id),"message":"Sesión borrada."}

@app.delete("/api/local-data",response_model=DeleteLocalDataResponse)
async def local_data_info(request:Request):
    require_access(request)
    return DeleteLocalDataResponse(
        success=True,
        message="El borrado de los datos personales y financieros se realiza localmente en este dispositivo."
    )

# ============================================================
# APRENDER
# ============================================================

@app.get("/api/learn")
async def learn(request:Request,language:str="es"):
    require_access(request)
    language=normalize_language(language)
    return engine.get_learning_lessons(language)

@app.get("/api/learn/providers")
async def learn_providers(request:Request,language:str="es"):
    require_access(request)
    language=normalize_language(language)
    data=engine.get_learning_lessons(language)
    return {
        "success":True,
        "language":language,
        "providers":data.get("providers",[]),
        "notice":data.get("notice")
    }

@app.get("/api/learn/{provider_id}")
async def learn_provider(provider_id:str,request:Request,language:str="es"):
    require_access(request)
    language=normalize_language(language)
    try:return engine.provider_learning(provider_id,language)
    except KeyError:raise HTTPException(404,"Provider not found.")

@app.get("/api/quick-guide")
async def quick_guide(request:Request,language:str="es",provider_id:Optional[str]=None):
    require_access(request)
    language=normalize_language(language)
    try:return engine.quick_guide(language,provider_id)
    except KeyError:raise HTTPException(404,"Provider not found.")

@app.get("/api/quick-guide/{provider_id}")
async def quick_guide_provider(provider_id:str,request:Request,language:str="es"):
    require_access(request)
    language=normalize_language(language)
    try:return engine.quick_guide(language,provider_id)
    except KeyError:raise HTTPException(404,"Provider not found.")

@app.get("/api/learning-pdf")
async def learning_pdf(request:Request,language:str="es",provider_id:Optional[str]=None):
    require_access(request)
    language=normalize_language(language)
    try:return engine.learning_pdf_data(language,provider_id)
    except KeyError:raise HTTPException(404,"Provider not found.")

@app.get("/api/learn/{provider_id}/pdf")
async def learning_provider_pdf(provider_id:str,request:Request,language:str="es"):
    require_access(request)
    language=normalize_language(language)
    try:return engine.learning_pdf_data(language,provider_id)
    except KeyError:raise HTTPException(404,"Provider not found.")

# ============================================================
# ASISTENTE
# ============================================================

@app.post("/api/assistant")
async def assistant(request:Request):
    require_access(request)
    body=await json_body(request)
    language=normalize_language(body.get("language","es"))
    text=str(body.get("text") or "")
    need_type=str(body.get("need_type") or engine.classify_need(text,language).get("need_type","other"))
    return engine.assistant_response(need_type,language,text)

@app.post("/api/chat")
async def chat_compat(request:Request):
    require_access(request)
    body=await json_body(request)
    language=normalize_language(body.get("language",body.get("lang","es")))
    text=str(body.get("text") or "")
    messages=body.get("messages",[])
    if not text and isinstance(messages,list) and messages:
        last=messages[-1]
        if isinstance(last,dict):text=str(last.get("content") or "")
    parsed=engine.parse_need(ParseNeedRequest(text=text,language=language))
    response=engine.assistant_response(parsed.get("need_type","other"),language,text)
    return {
        "success":True,
        "reply":response.get("message"),
        "provider":"remesas-engine",
        "need_type":parsed.get("need_type"),
        "parsed":parsed
    }

# ============================================================
# STRIPE — PAGO ÚNICO $10.99 / 20 MINUTOS
# ============================================================

@app.get("/api/subscription/status")
async def subscription_status():
    return {
        "configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "price":SERVICE_PRICE,
        "currency":SERVICE_CURRENCY,
        "period":"one_time",
        "payment_mode":"payment",
        "subscription":False,
        "minutes":SERVICE_MINUTES
    }

@app.get("/api/stripe/public")
async def stripe_public():
    return {
        "enabled":bool(STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_ID1 and STRIPE_SECRET_KEY),
        "publishable_key":STRIPE_PUBLISHABLE_KEY,
        "price":SERVICE_PRICE,
        "currency":SERVICE_CURRENCY,
        "mode":"payment",
        "minutes":SERVICE_MINUTES
    }

@app.post("/api/create-checkout-session")
async def create_checkout_session(request:Request):
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID1:
        raise HTTPException(503,"Stripe is not configured.")
    base_url=str(request.base_url).rstrip("/")
    try:
        checkout=stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price":STRIPE_PRICE_ID1,"quantity":1}],
            success_url=f"{base_url}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/?payment=cancelled",
            allow_promotion_codes=True,
            billing_address_collection="auto",
            metadata={
                "app":APP_NAME,
                "service_type":"one_time",
                "service_minutes":str(SERVICE_MINUTES)
            }
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(502,"Unable to create the payment session.") from exc
    return {"success":True,"checkout_url":checkout.url,"session_id":checkout.id}

@app.get("/api/payment/check")
async def payment_check(session_id:Optional[str]=None):
    if not STRIPE_SECRET_KEY:
        return {"success":False,"active":False,"message":"Stripe not configured."}
    if not session_id:
        return {"success":False,"active":False,"message":"Payment session not provided."}
    try:
        checkout=stripe.checkout.Session.retrieve(session_id,expand=["line_items"])
        paid=checkout.payment_status=="paid"
        correct_mode=getattr(checkout,"mode",None)=="payment"
        allowed_prices=set(x for x in [STRIPE_PRICE_ID1] if x)
        paid_prices=set()
        for item in getattr(checkout.line_items,"data",[]) or []:
            price=getattr(item,"price",None)
            price_id=getattr(price,"id",None) if price else None
            if price_id:paid_prices.add(price_id)
        valid_price=bool(paid_prices.intersection(allowed_prices))
        if not paid or not correct_mode or not valid_price:
            return {
                "success":True,
                "active":False,
                "paid":paid,
                "payment_status":getattr(checkout,"payment_status",None),
                "checkout_status":getattr(checkout,"status",None),
                "mode":getattr(checkout,"mode",None),
                "valid_price":valid_price
            }
        now=time.time()
        if session_id in PAYMENT_ACCESS and PAYMENT_ACCESS[session_id]>now:
            expires_at=PAYMENT_ACCESS[session_id]
            remaining=max(0,int(expires_at-now))
            return {
                "success":True,
                "paid":True,
                "active":True,
                "authorized":True,
                "seconds_remaining":remaining,
                "expires_at":expires_at,
                "session_id":session_id
            }
        if session_id in REDEEMED_PAYMENTS:
            return {
                "success":True,
                "paid":True,
                "active":False,
                "authorized":False,
                "message":"This payment access has already been used or expired."
            }
        access=create_access(f"stripe:{session_id}",ACCESS_SECONDS)
        PAYMENT_ACCESS[session_id]=access["expires_at"]
        REDEEMED_PAYMENTS.add(session_id)
        return {
            "success":True,
            "paid":True,
            "active":True,
            "authorized":True,
            "token":access["token"],
            "seconds_remaining":ACCESS_SECONDS,
            "expires_at":access["expires_at"],
            "session_id":session_id,
            "payment_status":checkout.payment_status,
            "mode":checkout.mode
        }
    except stripe.error.StripeError as exc:
        raise HTTPException(502,"Unable to verify payment.") from exc

@app.post("/api/stripe/webhook")
async def stripe_webhook(request:Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503,"Stripe webhook is not configured.")
    payload=await request.body()
    if len(payload)>MAX_BODY_SIZE:raise HTTPException(413,"Webhook payload too large.")
    signature=request.headers.get("stripe-signature")
    if not signature:raise HTTPException(400,"Missing Stripe signature.")
    try:
        event=stripe.Webhook.construct_event(payload,signature,STRIPE_WEBHOOK_SECRET)
    except ValueError as exc:
        raise HTTPException(400,"Invalid webhook payload.") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(400,"Invalid webhook signature.") from exc
    event_type=event.get("type","")
    handled={
        "checkout.session.completed",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "charge.refunded"
    }
    if event_type=="charge.refunded":
        try:
            obj=event.get("data",{}).get("object",{})
            payment_intent=obj.get("payment_intent")
            if payment_intent:
                expired=[sid for sid in list(PAYMENT_ACCESS) if PAYMENT_ACCESS.get(sid,0)>time.time()]
                for sid in expired:
                    try:
                        checkout=stripe.checkout.Session.retrieve(sid)
                        if getattr(checkout,"payment_intent",None)==payment_intent:
                            PAYMENT_ACCESS.pop(sid,None)
                            REDEEMED_PAYMENTS.add(sid)
                    except Exception:
                        pass
        except Exception:
            pass
    return {
        "success":True,
        "received":True,
        "event_type":event_type,
        "handled":event_type in handled
    }

@app.post("/api/payment-success")
async def payment_success_compat(session_id:str):
    result=await payment_check(session_id)
    if result.get("authorized") and result.get("token"):
        return {
            "status":"success",
            "access":"granted",
            "token":result["token"],
            "expires_at":result.get("expires_at"),
            "seconds_remaining":result.get("seconds_remaining")
        }
    return result

# ============================================================
# ADMINISTRACIÓN
# ============================================================

@app.get("/api/admin/config-status")
async def admin_config_status(request:Request):
    access=require_access(request)
    if access.get("subject")!="admin":
        raise HTTPException(403,"Admin access required.")
    return {
        "success":True,
        "app":APP_NAME,
        "version":APP_VERSION,
        "brain_loaded":bool(engine.brain),
        "brain_version":engine.brain.get("app",{}).get("version"),
        "gemini_configured":bool(GEMINI_API_KEY),
        "stripe_configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "stripe_publishable_configured":bool(STRIPE_PUBLISHABLE_KEY),
        "stripe_webhook_configured":bool(STRIPE_WEBHOOK_SECRET),
        "service_price":SERVICE_PRICE,
        "service_minutes":SERVICE_MINUTES
    }

# ============================================================
# ERRORES
# ============================================================

@app.exception_handler(ValueError)
async def value_error_handler(request:Request,exc:ValueError):
    return JSONResponse(status_code=400,content={"success":False,"error":str(exc)})

@app.exception_handler(Exception)
async def generic_error_handler(request:Request,exc:Exception):
    if isinstance(exc,HTTPException):raise exc
    return JSONResponse(status_code=500,content={"success":False,"error":"Ocurrió un problema. Intenta nuevamente."})
