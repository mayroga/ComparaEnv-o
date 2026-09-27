import os,re
from uuid import uuid4
from typing import Any,Dict,Optional
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
import stripe
from remittance_engine import engine
from schemas import (
    BrainValidationResponse,ComparisonRequest,FinalCheckRequest,HelpResponse,
    ParseNeedRequest,SessionState,UserNeedRequest
)

APP_NAME="REMESAS | May Roga LLC"
APP_VERSION="1.1.0"
BASE_DIR=os.path.dirname(os.path.abspath(__file__))
STATIC_DIR=os.path.join(BASE_DIR,"static")

ADMIN_USERNAME=os.getenv("ADMIN_USERNAME") or os.getenv("ADMIN_USER","")
ADMIN_PASSWORD=os.getenv("ADMIN_PASSWORD") or os.getenv("ADMIN_PASS","")
GEMINI_API_KEY=os.getenv("GEMINI_API_KEY","")
STRIPE_SECRET_KEY=os.getenv("STRIPE_SECRET_KEY","")
STRIPE_PRICE_ID=os.getenv("STRIPE_PRICE_ID") or os.getenv("STRIPE_PRICE_ID1","")
STRIPE_WEBHOOK_SECRET=os.getenv("STRIPE_WEBHOOK_SECRET","")
STRIPE_SUCCESS_URL=os.getenv("STRIPE_SUCCESS_URL","")
STRIPE_CANCEL_URL=os.getenv("STRIPE_CANCEL_URL","")

if STRIPE_SECRET_KEY:stripe.api_key=STRIPE_SECRET_KEY

app=FastAPI(title=APP_NAME,version=APP_VERSION)
if os.path.isdir(STATIC_DIR):app.mount("/static",StaticFiles(directory=STATIC_DIR),name="static")

def sid_ok(value:str)->bool:return bool(re.fullmatch(r"[A-Za-z0-9_-]{8,80}",value or ""))
def new_session(language="es"):
    sid=uuid4().hex
    s=SessionState(session_id=sid,language=language if language in ("es","en") else "es")
    engine.sessions[sid]=s
    return s
def get_session(sid):
    if not sid_ok(sid) or sid not in engine.sessions:raise HTTPException(404,"Session not found")
    return engine.sessions[sid]
def localized(language,es,en):return en if language=="en" else es

@app.on_event("startup")
def startup():
    engine.load_brain()

@app.get("/")
def root():
    path=os.path.join(STATIC_DIR,"index.html")
    if os.path.isfile(path):return FileResponse(path)
    return {"app":APP_NAME,"version":APP_VERSION,"status":"ok"}

@app.get("/health")
def health():return {"status":"ok","app":APP_NAME,"version":APP_VERSION}

@app.get("/ping")
def ping():return {"ping":"pong"}

@app.get("/api/config")
def config():return engine.public_config()

@app.get("/api/brain/version")
def brain_version():
    v=engine.validate_brain()
    return BrainValidationResponse(**v)

@app.post("/api/session")
def create_session(language:str="es"):
    return {"session":new_session(language).model_dump()}

@app.get("/api/session/{session_id}")
def read_session(session_id:str):
    return {"session":get_session(session_id).model_dump()}

@app.delete("/api/session/{session_id}")
def delete_session(session_id:str):
    get_session(session_id)
    del engine.sessions[session_id]
    return {"ok":True}

@app.post("/api/session/{session_id}/reset")
def reset_session(session_id:str):
    old=get_session(session_id)
    language=old.language
    engine.sessions[session_id]=SessionState(session_id=session_id,language=language)
    return {"session":engine.sessions[session_id].model_dump()}

@app.post("/api/need")
def need(req:UserNeedRequest):
    if not req.amount or not req.destination_country:
        raise HTTPException(422,"Amount and destination_country are required")
    sid=uuid4().hex
    s=SessionState(session_id=sid,language=req.language)
    p=engine.parse_need(req.free_text or "",req.amount,req.destination_country,req.language)
    p.amount=req.amount
    p.currency=req.send_currency
    p.priority=req.priority
    p.urgency=req.urgency
    p.delivery_method=req.delivery_method or p.delivery_method
    p.payment_method=req.payment_method or p.payment_method
    p.special_need=req.special_need or p.special_need
    p.recipient_has_bank_account=req.recipient_has_bank_account if req.recipient_has_bank_account is not None else p.recipient_has_bank_account
    p.recipient_has_mobile_wallet=req.recipient_has_mobile_wallet if req.recipient_has_mobile_wallet is not None else p.recipient_has_mobile_wallet
    p.first_transfer=req.first_transfer if req.first_transfer is not None else p.first_transfer
    p.recurring_transfer=req.recurring_transfer if req.recurring_transfer is not None else p.recurring_transfer
    s=engine.apply_need(s,p)
    engine.sessions[sid]=s
    return {"session":s.model_dump(),"parsed_need":p.model_dump()}

@app.post("/api/need/parse")
def parse_need(req:ParseNeedRequest):
    p=engine.parse_need(req.text,req.current_amount,req.current_destination,req.language)
    return {"parsed_need":p.model_dump()}

@app.post("/api/session/{session_id}/need/parse")
def parse_session_need(session_id:str,req:ParseNeedRequest):
    s=get_session(session_id)
    p=engine.parse_need(req.text,req.current_amount or s.amount,req.current_destination or s.destination,req.language or s.language)
    engine.apply_need(s,p)
    return {"session":s.model_dump(),"parsed_need":p.model_dump()}

@app.post("/api/analysis")
def analysis(req:ComparisonRequest):
    result=engine.analyze_need(req)
    return {"analysis":result.model_dump()}

@app.post("/api/session/{session_id}/analysis")
def session_analysis(session_id:str):
    s=get_session(session_id)
    if not s.amount or not s.destination:raise HTTPException(422,"Amount and destination are required")
    req=ComparisonRequest(amount=s.amount,currency=s.send_currency,destination_country=s.destination,priority=s.priority,urgency=s.urgency,delivery_method=s.delivery_method,payment_method=s.payment_method,special_need=s.special_need,recipient_has_bank_account=s.recipient_has_bank_account,recipient_has_mobile_wallet=s.recipient_has_mobile_wallet,first_transfer=s.first_transfer,recurring_transfer=s.recurring_transfer)
    a=engine.analyze_need(req)
    s.need_analysis=a
    s.current_step="analysis"
    return {"session":s.model_dump(),"analysis":a.model_dump()}

@app.post("/api/compare")
def compare(req:ComparisonRequest):
    return engine.compare(req).model_dump()

@app.post("/api/session/{session_id}/compare")
def compare_session(session_id:str):
    s=get_session(session_id)
    if not s.amount or not s.destination:raise HTTPException(422,"Amount and destination are required")
    result=engine.compare_session(s)
    return {"session":s.model_dump(),"comparison":result.model_dump()}

@app.post("/api/session/{session_id}/select/{provider_id}")
def select_provider(session_id:str,provider_id:str):
    s=get_session(session_id)
    try:o=engine.select_provider(s,provider_id)
    except ValueError as e:raise HTTPException(404,str(e))
    return {"session":s.model_dump(),"selected_option":o.model_dump()}

@app.post("/api/session/{session_id}/preparation")
def preparation(session_id:str):
    s=get_session(session_id)
    s.preparation=engine.build_preparation(s)
    s.current_step="preparation"
    return {"session":s.model_dump(),"preparation":s.preparation.model_dump()}

@app.post("/api/session/{session_id}/guide")
def guide(session_id:str):
    s=get_session(session_id)
    s.send_guide=engine.build_send_guide(s)
    s.current_step="guide"
    return {"session":s.model_dump(),"guide":s.send_guide.model_dump()}

@app.post("/api/final-check")
def final_check(req:FinalCheckRequest):
    return engine.final_check(req).model_dump()

@app.post("/api/session/{session_id}/final-check")
def session_final_check(session_id:str):
    s=get_session(session_id)
    result=engine.session_final_check(s)
    return {"session":s.model_dump(),"final_check":result.model_dump()}

@app.post("/api/session/{session_id}/help")
def session_help(session_id:str):
    s=get_session(session_id)
    return engine.help(s.language).model_dump()

@app.get("/api/help")
def help(language:str="es"):
    return engine.help(language).model_dump()

@app.get("/api/local-data")
def local_data():
    b=engine.brain.get("local_storage",{})
    return {"enabled":True,"policy":b}

@app.get("/api/stripe/status")
def stripe_status():
    return {"configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID),"price_id_configured":bool(STRIPE_PRICE_ID)}

@app.get("/api/payment/public")
def payment_public():
    return {"configured":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID),"price_id":STRIPE_PRICE_ID or None}

@app.post("/api/payment/create-checkout")
def create_checkout(request:Request):
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:raise HTTPException(503,"Stripe is not configured")
    try:
        origin=str(request.headers.get("origin") or "").rstrip("/")
        success=STRIPE_SUCCESS_URL or (origin+"/?payment=success" if origin else None)
        cancel=STRIPE_CANCEL_URL or (origin+"/?payment=cancel" if origin else None)
        kwargs={"mode":"subscription","line_items":[{"price":STRIPE_PRICE_ID,"quantity":1}],"allow_promotion_codes":True}
        if success:kwargs["success_url"]=success
        if cancel:kwargs["cancel_url"]=cancel
        checkout=stripe.checkout.Session.create(**kwargs)
        return {"ok":True,"id":checkout.id,"url":checkout.url}
    except Exception as e:raise HTTPException(500,str(e))

@app.get("/api/payment/check/{session_id}")
def payment_check(session_id:str):
    if not STRIPE_SECRET_KEY:raise HTTPException(503,"Stripe is not configured")
    try:
        s=stripe.checkout.Session.retrieve(session_id)
        return {"ok":True,"id":s.id,"status":s.status,"payment_status":s.payment_status,"subscription":s.subscription}
    except Exception as e:raise HTTPException(404,str(e))

@app.post("/api/stripe/webhook")
async def stripe_webhook(request:Request):
    payload=await request.body()
    signature=request.headers.get("stripe-signature")
    if STRIPE_WEBHOOK_SECRET:
        try:event=stripe.Webhook.construct_event(payload,signature,STRIPE_WEBHOOK_SECRET)
        except Exception as e:return JSONResponse({"ok":False,"error":str(e)},status_code=400)
    else:
        try:event=__import__("json").loads(payload)
        except Exception:return JSONResponse({"ok":False,"error":"Invalid payload"},status_code=400)
    return {"received":True,"event":event.get("type") if isinstance(event,dict) else None}

@app.get("/api/admin/status")
def admin_status():
    return {"configured":bool(ADMIN_USERNAME and ADMIN_PASSWORD),"username_configured":bool(ADMIN_USERNAME),"password_configured":bool(ADMIN_PASSWORD)}

@app.exception_handler(Exception)
async def generic_exception_handler(request:Request,exc:Exception):
    return JSONResponse(status_code=500,content={"ok":False,"error":"Internal server error"})
