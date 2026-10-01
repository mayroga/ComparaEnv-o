# main.py — REMESAS | May Roga LLC | v4.3.0
import os,secrets,time,json
from pathlib import Path
from typing import Any,Dict,Optional
import stripe
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from remittance_engine import engine
from schemas import ComparisonRequest,ComparisonResponse,DeleteLocalDataResponse,FinalCheckRequest,FinalCheckResponse,ParseNeedRequest,SessionResponse,UserNeedRequest,AssistantRequest,AssistantResponse

APP_NAME="REMESAS"
APP_VERSION="4.3.0"
SERVICE_PRICE=10.99
SERVICE_CURRENCY="usd"
SERVICE_MINUTES=20
ACCESS_SECONDS=SERVICE_MINUTES*60
BASE_DIR=Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"
DATA_DIR=BASE_DIR/"data"
stripe.api_key=os.getenv("STRIPE_SECRET_KEY","")
STRIPE_PRICE_ID=os.getenv("STRIPE_PRICE_ID","")
STRIPE_WEBHOOK_SECRET=os.getenv("STRIPE_WEBHOOK_SECRET","")
ADMIN_USER=os.getenv("ADMIN_USER","")
ADMIN_PASSWORD=os.getenv("ADMIN_PASSWORD","")
ADMIN_TOKEN=os.getenv("ADMIN_TOKEN","")
TOKENS:Dict[str,Dict[str,Any]]={}
ADMIN_SESSIONS:Dict[str,float]={}
app=FastAPI(title=APP_NAME,version=APP_VERSION)
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])
if STATIC_DIR.exists():
    app.mount("/static",StaticFiles(directory=str(STATIC_DIR)),name="static")

def now()->float:return time.time()
def clean_token(v:Any)->str:return str(v or "").strip()
def token_from_payload(d:Any)->Optional[str]:
    if not isinstance(d,dict):return None
    for k in ("access_token","token","session_token"):
        if clean_token(d.get(k)):return clean_token(d[k])
    access=d.get("access")
    if isinstance(access,dict):
        for k in ("access_token","token"):
            if clean_token(access.get(k)):return clean_token(access[k])
    return None
def grant_access(token:Optional[str]=None,seconds:int=ACCESS_SECONDS)->str:
    t=clean_token(token) or secrets.token_urlsafe(32)
    TOKENS[t]={"created_at":now(),"expires_at":now()+seconds,"seconds":seconds}
    return t
def access_info(token:Optional[str])->Dict[str,Any]:
    t=clean_token(token)
    item=TOKENS.get(t)
    if not item:return {"active":False,"remaining_seconds":0,"seconds_remaining":0}
    remaining=max(0,int(item["expires_at"]-now()))
    if remaining<=0:
        TOKENS.pop(t,None)
        return {"active":False,"remaining_seconds":0,"seconds_remaining":0}
    return {"active":True,"remaining_seconds":remaining,"seconds_remaining":remaining,"expires_at":item["expires_at"]}
def require_access(request:Request)->str:
    token=clean_token(request.headers.get("x-access-token") or request.query_params.get("access_token"))
    info=access_info(token)
    if info["active"]:return token
    raise HTTPException(status_code=402,detail={"code":"ACCESS_REQUIRED","message":"El acceso al servicio no está activo.","price":SERVICE_PRICE,"currency":SERVICE_CURRENCY,"minutes":SERVICE_MINUTES})
def require_admin(request:Request)->str:
    token=clean_token(request.headers.get("x-admin-token") or request.query_params.get("admin_token"))
    if token and token in ADMIN_SESSIONS and ADMIN_SESSIONS[token]>now():
        return token
    raise HTTPException(status_code=403,detail="Admin access required")
def public_error(exc:Exception)->JSONResponse:
    return JSONResponse(status_code=500,content={"error":"server_error","message":"No pudimos completar esta acción. Intenta nuevamente."})

@app.get("/",include_in_schema=False)
def root():
    p=STATIC_DIR/"index.html"
    if not p.exists():raise HTTPException(status_code=404,detail="Frontend not found")
    return FileResponse(str(p))

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status":"ok","app":APP_NAME,"version":APP_VERSION}

@app.get("/api/config")
def config():
    try:return engine.public_config()
    except Exception as e:return public_error(e)

@app.get("/api/brain/version")
def brain_version():
    try:
        cfg=engine.public_config()
        brain=cfg.get("brain",{}) if isinstance(cfg,dict) else {}
        return {"version":brain.get("version",APP_VERSION),"schema_version":brain.get("schema_version","4.3")}
    except Exception:return {"version":APP_VERSION,"schema_version":"4.3"}

@app.get("/api/service/info")
def service_info():
    return {"name":APP_NAME,"version":APP_VERSION,"price":SERVICE_PRICE,"currency":SERVICE_CURRENCY,"minutes":SERVICE_MINUTES,"access_seconds":ACCESS_SECONDS,"payment_required_for":"remittance comparison","data_storage":"client-side"}

@app.get("/api/access/status")
def access_status(request:Request):
    token=clean_token(request.headers.get("x-access-token") or request.query_params.get("access_token"))
    info=access_info(token)
    info.update({"price":SERVICE_PRICE,"currency":SERVICE_CURRENCY,"minutes":SERVICE_MINUTES})
    return info

@app.post("/api/access/verify")
async def access_verify(request:Request):
    body={}
    try:body=await request.json()
    except Exception:body={}
    token=token_from_payload(body)
    if token and access_info(token)["active"]:
        return {"verified":True,"access_token":token,**access_info(token)}
    payment_id=clean_token(body.get("payment_id") or body.get("session_id") or body.get("checkout_session_id"))
    if payment_id and stripe.api_key:
        try:
            cs=stripe.checkout.Session.retrieve(payment_id)
            paid=cs.get("payment_status")=="paid"
            if paid:
                token=grant_access()
                return {"verified":True,"access_token":token,**access_info(token)}
        except Exception:
            pass
    return {"verified":False,"price":SERVICE_PRICE,"currency":SERVICE_CURRENCY,"minutes":SERVICE_MINUTES}

@app.post("/api/access/admin")
async def access_admin(request:Request):
    body={}
    try:body=await request.json()
    except Exception:body={}
    user=str(body.get("username") or "").strip()
    password=str(body.get("password") or "")
    if not ADMIN_USER or not ADMIN_PASSWORD or user!=ADMIN_USER or password!=ADMIN_PASSWORD:
        raise HTTPException(status_code=401,detail="Invalid admin credentials")
    token=ADMIN_TOKEN or secrets.token_urlsafe(32)
    ADMIN_SESSIONS[token]=now()+86400
    return {"verified":True,"admin":True,"access_token":token,"token":token}

@app.post("/api/service/start")
async def service_start(request:Request):
    token=clean_token(request.headers.get("x-access-token"))
    info=access_info(token)
    if not info["active"]:token=grant_access()
    return {"started":True,"access_token":token,**access_info(token)}

@app.post("/api/session",response_model=SessionResponse)
async def create_session(body:UserNeedRequest):
    try:return {"session":engine.create_session(body)}
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}",response_model=SessionResponse)
def get_session(session_id:str):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        return {"session":s}
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}",response_model=SessionResponse)
async def update_session(session_id:str,body:UserNeedRequest):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        s=engine.update_session(session_id,body.model_dump(exclude_none=True))
        return {"session":s}
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/need")
async def need(body:UserNeedRequest):
    try:
        return engine.apply_need(body)
    except Exception as e:return public_error(e)

@app.post("/api/need/parse")
async def parse_need(body:ParseNeedRequest):
    try:return engine.parse_need(body)
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}/need/parse")
async def session_parse_need(session_id:str,body:ParseNeedRequest):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        parsed=engine.parse_need(body)
        pdata=parsed.parsed.model_dump() if hasattr(parsed,"parsed") else parsed
        engine.apply_need(session_id,pdata)
        return {"session":engine.get_session(session_id),"parsed":pdata}
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/compare",response_model=ComparisonResponse)
async def compare(request:Request,body:ComparisonRequest):
    require_access(request)
    try:return engine.compare(body)
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}/compare",response_model=ComparisonResponse)
async def session_compare(request:Request,session_id:str):
    require_access(request)
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        return engine.compare_session(session_id)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}/select/{provider_id}")
async def select_provider(request:Request,session_id:str,provider_id:str):
    require_access(request)
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        return engine.select_provider(session_id,provider_id)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/final-check",response_model=FinalCheckResponse)
async def final_check(request:Request,body:FinalCheckRequest):
    require_access(request)
    try:return engine.final_check(body)
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}/final-check",response_model=FinalCheckResponse)
async def session_final_check(request:Request,session_id:str,body:FinalCheckRequest):
    require_access(request)
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        if not body.provider_id and s.selected_option:
            body.provider_id=s.selected_option.provider_id
        if not body.amount and s.amount is not None:body.amount=s.amount
        if not body.send_currency:body.send_currency=s.send_currency
        if not body.destination_country and s.destination_country:body.destination_country=s.destination_country
        if body.delivery_method is None:body.delivery_method=s.delivery_method
        if body.payment_method is None:body.payment_method=s.payment_method
        result=engine.final_check(body)
        try:engine.update_session(session_id,{"final_check":result,"current_step":"final-check"})
        except Exception:pass
        return result
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}/help")
def session_help(session_id:str,language:str="es"):
    try:return engine.help_topics(language)
    except Exception as e:return public_error(e)

@app.get("/api/help")
def help_topics(language:str="es"):
    try:return engine.help_topics(language)
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}/reset")
def reset_session(session_id:str):
    try:
        engine.clear_session(session_id)
        return {"cleared":True,"session_id":session_id}
    except Exception as e:return public_error(e)

@app.delete("/api/session/{session_id}")
def delete_session(session_id:str):
    try:
        engine.clear_session(session_id)
        return {"deleted":True,"session_id":session_id}
    except Exception as e:return public_error(e)

@app.get("/api/local-data")
def local_data():
    return {"server_storage":False,"message":"Los datos personales de la aplicación están diseñados para permanecer en el dispositivo del usuario."}

@app.post("/api/local-data/delete",response_model=DeleteLocalDataResponse)
def local_data_delete():
    return {"deleted":True,"message":"El servidor no mantiene un perfil personal de tus datos locales."}

@app.get("/api/learn")
def learn(language:str="es"):
    try:return engine.get_learning_lessons(language)
    except Exception as e:return public_error(e)

@app.get("/api/learn/providers")
def learn_providers(language:str="es"):
    try:return engine.get_learning_lessons(language)
    except Exception as e:return public_error(e)

@app.get("/api/learn/{provider_id}")
def learn_provider(provider_id:str,language:str="es"):
    try:return engine.provider_learning(provider_id,language)
    except Exception as e:return public_error(e)

@app.get("/api/quick-guide")
@app.get("/api/guide")
def quick_guide(language:str="es"):
    try:return engine.quick_guide(language)
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}/quick-guide")
def session_quick_guide(session_id:str,language:str="es"):
    try:
        if not engine.get_session(session_id):raise HTTPException(status_code=404,detail="Session not found")
        return engine.quick_guide(language)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.get("/api/learning-pdf")
def learning_pdf(language:str="es"):
    try:return engine.learning_pdf_data(language)
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}/learning-pdf")
def session_learning_pdf(session_id:str,language:str="es"):
    try:
        if not engine.get_session(session_id):raise HTTPException(status_code=404,detail="Session not found")
        return engine.learning_pdf_data(language)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}/financial-snapshot")
def financial_snapshot(session_id:str,language:str="es"):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        return engine.get_financial_snapshot(session_id,language)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}/action")
def session_action(session_id:str,language:str="es"):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        snapshot=engine.get_financial_snapshot(session_id,language)
        return engine.action_suggestion(snapshot,language)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/assistant",response_model=AssistantResponse)
async def assistant(body:AssistantRequest):
    try:return engine.assistant_response(body)
    except Exception as e:return public_error(e)

@app.post("/api/chat",response_model=AssistantResponse)
async def chat(body:AssistantRequest):
    try:return engine.assistant_response(body)
    except Exception as e:return public_error(e)

@app.post("/api/session/{session_id}/assistant",response_model=AssistantResponse)
async def session_assistant(session_id:str,body:AssistantRequest):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        body.session_id=session_id
        return engine.assistant_response(body)
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.get("/api/session/{session_id}/pdf-data")
def session_pdf_data(session_id:str,language:str="es"):
    try:
        s=engine.get_session(session_id)
        if not s:raise HTTPException(status_code=404,detail="Session not found")
        snapshot=engine.get_financial_snapshot(session_id,language)
        action=engine.action_suggestion(snapshot,language)
        return {"session":s.model_dump(),"financial_snapshot":snapshot,"action":action,"app":APP_NAME,"version":APP_VERSION}
    except HTTPException:raise
    except Exception as e:return public_error(e)

@app.post("/api/stripe/create-checkout")
@app.post("/api/create-checkout-session")
async def create_checkout(request:Request):
    if not stripe.api_key:
        raise HTTPException(status_code=503,detail="Stripe is not configured")
    body={}
    try:body=await request.json()
    except Exception:body={}
    origin=str(body.get("origin") or request.headers.get("origin") or "").rstrip("/")
    if not origin:
        origin=f"{request.url.scheme}://{request.url.netloc}"
    kwargs={"mode":"payment","payment_method_types":["card"],"line_items":[{"price_data":{"currency":SERVICE_CURRENCY,"product_data":{"name":"REMESAS — Acceso de servicio"},"unit_amount":int(round(SERVICE_PRICE*100))},"quantity":1}],"success_url":origin+"/?payment=success&session_id={CHECKOUT_SESSION_ID}","cancel_url":origin+"/?payment=cancelled","metadata":{"app":APP_NAME,"service_minutes":str(SERVICE_MINUTES)}}
    if STRIPE_PRICE_ID:
        kwargs["line_items"]=[{"price":STRIPE_PRICE_ID,"quantity":1}]
    try:
        cs=stripe.checkout.Session.create(**kwargs)
        return {"id":cs.id,"session_id":cs.id,"url":cs.url,"price":SERVICE_PRICE,"currency":SERVICE_CURRENCY,"minutes":SERVICE_MINUTES}
    except Exception as e:
        raise HTTPException(status_code=502,detail="No se pudo iniciar el pago")

@app.post("/api/stripe/webhook")
async def stripe_webhook(request:Request):
    payload=await request.body()
    signature=request.headers.get("stripe-signature","")
    event=None
    if STRIPE_WEBHOOK_SECRET:
        try:event=stripe.Webhook.construct_event(payload,signature,STRIPE_WEBHOOK_SECRET)
        except Exception:raise HTTPException(status_code=400,detail="Invalid webhook")
    else:
        try:event=json.loads(payload.decode("utf-8"))
        except Exception:raise HTTPException(status_code=400,detail="Invalid webhook")
    event_type=event.get("type","") if isinstance(event,dict) else ""
    if event_type in ("checkout.session.completed","checkout.session.async_payment_succeeded"):
        obj=((event.get("data") or {}).get("object") or {})
        if obj.get("payment_status")=="paid" or event_type=="checkout.session.async_payment_succeeded":
            token=grant_access()
            return {"received":True,"access_token":token}
    return {"received":True}

@app.post("/api/webhook/stripe")
async def stripe_webhook_alias(request:Request):
    return await stripe_webhook(request)

@app.get("/api/admin/config")
def admin_config(request:Request):
    require_admin(request)
    return {"app":APP_NAME,"version":APP_VERSION,"service_price":SERVICE_PRICE,"service_minutes":SERVICE_MINUTES,"stripe_configured":bool(stripe.api_key),"price_id_configured":bool(STRIPE_PRICE_ID),"webhook_configured":bool(STRIPE_WEBHOOK_SECRET),"providers":len(engine.providers)}

@app.post("/api/admin/reload")
def admin_reload(request:Request):
    require_admin(request)
    try:
        engine.reload()
        return {"reloaded":True,"version":APP_VERSION}
    except Exception as e:return public_error(e)

@app.on_event("startup")
def startup():
    try:engine.reload()
    except Exception:pass
