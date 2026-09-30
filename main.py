import os
import logging
from typing import Any,Dict,Optional

import stripe
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import HTMLResponse,JSONResponse
from fastapi.staticfiles import StaticFiles

from schemas import (
    UserNeedRequest,ParseNeedRequest,IncomeRequest,ExpenseItem,
    SavingsRequest,PurchaseRequest,MoneyPlanRequest,ComparisonRequest,
    FinalCheckRequest
)
from remittance_engine import RemittanceEngine

logging.basicConfig(level=logging.INFO)
logger=logging.getLogger("remesas")

APP_VERSION="4.0.0"
app=FastAPI(title="REMESAS",version=APP_VERSION,description="Herramienta de organización y preparación de remesas.")
app.mount("/static",StaticFiles(directory="static"),name="static")

engine=RemittanceEngine()

STRIPE_SECRET_KEY=os.getenv("STRIPE_SECRET_KEY","").strip()
STRIPE_PRICE_ID1=os.getenv("STRIPE_PRICE_ID1","").strip()
STRIPE_PUBLIC_KEY=os.getenv("STRIPE_PUBLIC_KEY","").strip() or os.getenv("STRIPE_PUBLISHABLE_KEY","").strip()
STRIPE_WEBHOOK_SECRET=os.getenv("STRIPE_WEBHOOK_SECRET","").strip()
ADMIN_KEY=os.getenv("ADMIN_KEY","").strip()

if STRIPE_SECRET_KEY:
    stripe.api_key=STRIPE_SECRET_KEY

def admin_authorized(request:Request)->bool:
    if not ADMIN_KEY:
        return False
    key=request.headers.get("x-admin-key","")
    return bool(key and key==ADMIN_KEY)

def safe_session_id(session_id:Optional[str])->str:
    value=str(session_id or "").strip()
    if not value or len(value)>128:
        raise HTTPException(status_code=400,detail="Invalid session_id")
    return value

@app.get("/",response_class=HTMLResponse)
async def root():
    with open("static/index.html","r",encoding="utf-8") as f:
        return f.read()

@app.get("/health")
async def health():
    return {"status":"ok","app":"REMESAS","version":APP_VERSION}

@app.get("/api/config")
async def config(language:str="es"):
    data=engine.public_config(language)
    data["app_version"]=APP_VERSION
    data["local_data_only"]=True
    data["server_persistence"]=False
    data["transient_session_processing"]=True
    data["payments"]={
        "enabled":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "public_key":STRIPE_PUBLIC_KEY or None,
        "subscription_price_id":STRIPE_PRICE_ID1 or None
    }
    data["privacy_notice"]={
        "local_money_data":True,
        "server_permanent_storage":False,
        "temporary_remittance_session":True,
        "message":(
            "Los registros locales de dinero se guardan en este dispositivo. "
            "La información necesaria para una sesión de remesa puede procesarse "
            "temporalmente en memoria del servidor y no se guarda como registro permanente."
        )
    }
    return data

@app.post("/api/session")
async def create_session(request:Request):
    try:
        body=await request.json()
    except Exception:
        body={}
    language=str(body.get("language","es")) if isinstance(body,dict) else "es"
    session=engine.create_session(language)
    return {"success":True,"session":session}

@app.get("/api/session/{session_id}")
async def get_session(session_id:str):
    session=engine.get_session(safe_session_id(session_id))
    if not session:
        raise HTTPException(status_code=404,detail="Session not found")
    return {"success":True,"session":session}

@app.delete("/api/session/{session_id}")
async def delete_session(session_id:str):
    deleted=engine.delete_session(safe_session_id(session_id))
    return {"success":True,"deleted":deleted}

@app.post("/api/need")
async def need(request:UserNeedRequest):
    data=request.model_dump(exclude_none=True)
    session_id=data.pop("session_id",None)
    if not session_id:
        raise HTTPException(status_code=400,detail="session_id is required")
    result=engine.apply_need(request)
    if not result.get("success"):
        raise HTTPException(status_code=400,detail=result.get("message","Unable to process need"))
    return result

@app.post("/api/need/parse")
async def parse_need(request:ParseNeedRequest):
    return engine.parse_need(request)

@app.post("/api/assistant")
async def assistant(request:ParseNeedRequest):
    return engine.assistant_response(request)

@app.get("/api/help")
async def help_api(language:str="es"):
    return {"success":True,"language":language,"topics":engine.help_topics(language)}

@app.get("/api/providers")
async def providers(language:str="es"):
    data=engine.public_config(language)
    return {
        "success":True,
        "providers":data.get("providers",[]),
        "provider_count":data.get("provider_count",0),
        "official_urls_only":True
    }

@app.get("/api/provider/{provider_id}")
async def provider(provider_id:str):
    option=engine.provider_public_option(provider_id)
    if not option:
        raise HTTPException(status_code=404,detail="Provider not found")
    return {"success":True,"provider":option}

@app.post("/api/compare")
async def compare(request:ComparisonRequest):
    return engine.compare(request).model_dump()

@app.post("/api/session/{session_id}/compare")
async def compare_session(session_id:str):
    result=engine.compare_session(safe_session_id(session_id))
    if not result.get("success"):
        raise HTTPException(status_code=400,detail=result.get("message","Unable to compare"))
    return result

@app.post("/api/session/{session_id}/select/{provider_id}")
async def select_provider(session_id:str,provider_id:str):
    result=engine.select_provider(safe_session_id(session_id),provider_id)
    if not result.get("success"):
        raise HTTPException(status_code=400,detail=result.get("message","Unable to select provider"))
    return result

@app.post("/api/final-check")
async def final_check(request:FinalCheckRequest):
    return engine.final_check(request).model_dump()

@app.post("/api/session/{session_id}/final-check")
async def final_check_session(session_id:str):
    result=engine.final_check_session(safe_session_id(session_id))
    if not result.get("success"):
        raise HTTPException(status_code=400,detail=result.get("message","Unable to complete final check"))
    return result

@app.post("/api/money/income")
async def money_income(request:IncomeRequest):
    amount=request.amount
    other=request.other_income or 0
    return {
        "success":True,
        "amount":round(amount,2),
        "other_income":round(other,2),
        "frequency":request.frequency,
        "total_entered":round(amount+other,2),
        "language":request.language
    }

@app.post("/api/money/expense")
async def money_expense(item:ExpenseItem):
    return {
        "success":True,
        "expense":item.model_dump(),
        "message":"Expense accepted for local calculation."
    }

@app.post("/api/money/savings")
async def money_savings(request:SavingsRequest):
    return {
        "success":True,
        "amount":round(request.amount,2),
        "savings_type":request.savings_type,
        "language":request.language
    }

@app.post("/api/money/purchase")
async def money_purchase(request:PurchaseRequest):
    return {
        "success":True,
        "purchase_amount":round(request.purchase_amount,2),
        "purchase_category":request.purchase_category,
        "language":request.language
    }

@app.post("/api/money/plan")
async def money_plan(request:MoneyPlanRequest):
    return engine.calculate_money_plan(request.model_dump())

@app.delete("/api/local-data")
async def delete_local_data():
    return {
        "success":True,
        "message":"REMESAS does not control data stored in the user's browser. Use the app's local-data delete control to remove local records from this device."
    }

@app.get("/api/subscription/status")
async def subscription_status():
    return {
        "success":True,
        "enabled":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "price_id":STRIPE_PRICE_ID1 or None
    }

@app.get("/api/stripe/public")
async def stripe_public():
    return {
        "success":True,
        "enabled":bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID1),
        "publishable_key":STRIPE_PUBLIC_KEY or None,
        "price_id":STRIPE_PRICE_ID1 or None
    }

@app.post("/api/create-checkout-session")
async def create_checkout_session(request:Request):
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID1:
        raise HTTPException(status_code=503,detail="Subscription is not configured")

    try:
        body=await request.json()
    except Exception:
        body={}

    origin=str(body.get("origin","")).strip() if isinstance(body,dict) else ""
    if not origin:
        origin=str(request.headers.get("origin","")).strip()

    if not origin.startswith(("http://","https://")):
        origin="https://remesas.onrender.com"

    success_url=f"{origin}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url=f"{origin}/?payment=cancelled"

    try:
        checkout=stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price":STRIPE_PRICE_ID1,"quantity":1}],
            success_url=success_url,
            cancel_url=cancel_url,
            allow_promotion_codes=True
        )
        return {
            "success":True,
            "checkout_url":checkout.url,
            "checkout_session_id":checkout.id
        }
    except Exception as exc:
        logger.exception("Stripe checkout creation failed")
        raise HTTPException(status_code=500,detail="Unable to create checkout session") from exc

@app.get("/api/payment/check")
async def payment_check(session_id:str):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503,detail="Payments are not configured")
    if not session_id or len(session_id)>255:
        raise HTTPException(status_code=400,detail="Invalid checkout session")

    try:
        checkout=stripe.checkout.Session.retrieve(session_id)
        subscription_id=checkout.get("subscription")
        subscription=None

        if subscription_id:
            subscription=stripe.Subscription.retrieve(subscription_id)

        return {
            "success":True,
            "checkout_session_id":checkout.get("id"),
            "payment_status":checkout.get("payment_status"),
            "status":checkout.get("status"),
            "subscription_id":subscription_id,
            "subscription_status":subscription.get("status") if subscription else None
        }
    except Exception as exc:
        logger.exception("Stripe payment check failed")
        raise HTTPException(status_code=400,detail="Unable to verify payment session") from exc

@app.post("/api/stripe/webhook")
async def stripe_webhook(request:Request):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503,detail="Stripe is not configured")

    payload=await request.body()
    signature=request.headers.get("stripe-signature","")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event=stripe.Webhook.construct_event(
                payload,signature,STRIPE_WEBHOOK_SECRET
            )
        else:
            event=stripe.Event.construct_from(
                __import__("json").loads(payload.decode("utf-8")),
                stripe.api_key
            )
    except Exception as exc:
        logger.warning("Invalid Stripe webhook: %s",exc)
        raise HTTPException(status_code=400,detail="Invalid webhook") from exc

    event_type=event.get("type","")
    logger.info("Stripe webhook received: %s",event_type)

    return {"received":True,"type":event_type}

@app.get("/api/admin/reload")
async def admin_reload(request:Request):
    if not admin_authorized(request):
        raise HTTPException(status_code=403,detail="Forbidden")
    engine.reload()
    return {
        "success":True,
        "message":"Configuration reloaded.",
        "provider_count":len(engine.providers)
    }

@app.exception_handler(Exception)
async def generic_exception_handler(request:Request,exc:Exception):
    logger.exception("Unhandled application error")
    return JSONResponse(
        status_code=500,
        content={
            "success":False,
            "message":"The application could not complete the requested operation."
        }
    )
