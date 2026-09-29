from typing import Optional
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from remittance_engine import engine
from schemas import UserNeedRequest,ParseNeedRequest,ComparisonRequest,FinalCheckRequest

APP_NAME="REMESAS"
APP_VERSION="4.0.0"
BASE_DIR=__import__("pathlib").Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"

app=FastAPI(title=APP_NAME,version=APP_VERSION,description="REMESAS | May Roga LLC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

if STATIC_DIR.exists():
    app.mount("/static",StaticFiles(directory=str(STATIC_DIR)),name="static")

class SessionCreateRequest(BaseModel):
    language:str="es"

class NeedEnvelope(UserNeedRequest):
    session_id:Optional[str]=None

class ParseEnvelope(ParseNeedRequest):
    session_id:Optional[str]=None

@app.get("/",include_in_schema=False)
def home():
    index=STATIC_DIR/"index.html"
    if not index.exists():raise HTTPException(status_code=404,detail="Frontend not found")
    return FileResponse(str(index))

@app.get("/health")
def health():
    return {"status":"ok","app":APP_NAME,"version":APP_VERSION}

@app.get("/api/health")
def api_health():
    return {"success":True,"status":"ok","app":APP_NAME,"version":APP_VERSION}

@app.get("/api/config")
def config(language:str="es"):
    try:return engine.public_config(language)
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/session")
def create_session(request:SessionCreateRequest=SessionCreateRequest()):
    try:
        session=engine.create_session(request.language)
        return {"success":True,"session":session}
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.get("/api/session/{session_id}")
def get_session(session_id:str):
    session=engine.get_session(session_id)
    if not session:raise HTTPException(status_code=404,detail="session_expired")
    return {"success":True,"session":session}

@app.delete("/api/session/{session_id}")
def delete_session(session_id:str):
    return {"success":True,"deleted":engine.clear_session(session_id)}

@app.post("/api/session/{session_id}/need")
def apply_need(session_id:str,request:UserNeedRequest):
    try:
        result=engine.apply_need(session_id,request)
        if not result:raise HTTPException(status_code=404,detail="session_expired")
        return {"success":True,"session":result}
    except KeyError as e:raise HTTPException(status_code=404,detail=str(e).strip("'"))
    except ValueError as e:raise HTTPException(status_code=400,detail=str(e))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/need")
def apply_need_compat(request:NeedEnvelope):
    sid=request.session_id
    if not sid:
        session=engine.create_session(request.language)
        sid=session["session_id"]
    payload=request.model_dump() if hasattr(request,"model_dump") else request.dict()
    payload.pop("session_id",None)
    need=UserNeedRequest(**payload)
    try:
        result=engine.apply_need(sid,need)
        return {"success":True,"session":result,"session_id":sid}
    except KeyError as e:raise HTTPException(status_code=404,detail=str(e).strip("'"))
    except ValueError as e:raise HTTPException(status_code=400,detail=str(e))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/session/{session_id}/need/parse")
def parse_need_session(session_id:str,request:ParseNeedRequest):
    if not engine.get_session(session_id):raise HTTPException(status_code=404,detail="session_expired")
    try:
        parsed=engine.parse_need(request)
        return {"success":True,"parsed":parsed}
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/need/parse")
def parse_need_compat(request:ParseEnvelope):
    try:
        parsed=engine.parse_need(request)
        return {"success":True,"parsed":parsed}
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/session/{session_id}/compare")
def compare_session(session_id:str):
    try:return engine.compare_session(session_id)
    except KeyError as e:raise HTTPException(status_code=404,detail=str(e).strip("'"))
    except ValueError as e:raise HTTPException(status_code=400,detail=str(e))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/compare")
def compare(request:ComparisonRequest):
    try:return engine.compare(request)
    except ValueError as e:raise HTTPException(status_code=400,detail=str(e))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/session/{session_id}/provider/{provider_id}")
def select_provider(session_id:str,provider_id:str):
    try:
        option=engine.select_provider(session_id,provider_id)
        return {"success":True,"provider":option}
    except KeyError as e:raise HTTPException(status_code=404,detail=str(e).strip("'"))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/session/{session_id}/final-check")
def final_check_session(session_id:str,request:Optional[FinalCheckRequest]=None):
    session=engine.get_session(session_id)
    if not session:raise HTTPException(status_code=404,detail="session_expired")
    if request is None:
        selected=session.get("selected_option") or {}
        request=FinalCheckRequest(
            language=session.get("language","es"),
            provider_id=selected.get("provider_id",""),
            amount=float(session.get("amount") or 0),
            send_currency=session.get("send_currency","USD"),
            destination_country=session.get("destination_country") or "",
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            recipient_amount=selected.get("recipient_amount"),
            fee=selected.get("fee"),
            exchange_rate=selected.get("exchange_rate")
        )
    try:return engine.final_check(request,session_id)
    except KeyError as e:raise HTTPException(status_code=404,detail=str(e).strip("'"))
    except ValueError as e:raise HTTPException(status_code=400,detail=str(e))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/final-check")
def final_check(request:FinalCheckRequest):
    try:return engine.final_check(request)
    except ValueError as e:raise HTTPException(status_code=400,detail=str(e))
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.get("/api/help")
def help_topics(language:str="es"):
    try:return {"success":True,"language":language,"topics":engine.help_topics(language)}
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/assistant")
def assistant(request:NeedEnvelope):
    try:
        need_type=request.need_type
        if not need_type and request.free_text:
            need_type=engine.classify_need(request.free_text,request.language).get("need_type","other")
        need_type=need_type or "other"
        return engine.assistant_response(need_type,request.language,request.free_text or "")
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.get("/api/providers")
def providers(language:str="es",country:Optional[str]=None):
    try:
        items=[]
        if country:
            ids=engine.candidate_provider_ids(country)
            for pid in ids:
                option=engine.provider_public_option(pid,country,language)
                if option:items.append(option)
        else:
            for p in engine.get_provider_registry():
                option=engine.provider_public_option(p.get("id",""),country or "",language)
                if option:items.append(option)
        return {"success":True,"providers":items}
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.post("/api/money-plan")
def money_plan(
    income:float=0,
    essential:float=0,
    flexible:float=0,
    savings:float=0,
    remittance:float=0
):
    try:return {"success":True,"plan":engine.calculate_money_plan(income,essential,flexible,savings,remittance)}
    except Exception as e:raise HTTPException(status_code=400,detail=str(e))

@app.get("/api/countries")
def countries(language:str="es"):
    try:
        return {"success":True,"language":language,"countries":[
            {"code":x["code"],"name":engine.localize(x["name"],language)}
            for x in engine.get_supported_countries()
        ]}
    except Exception as e:raise HTTPException(status_code=500,detail=str(e))

@app.exception_handler(404)
async def not_found(request,exc):
    if str(request.url.path).startswith("/api/"):
        return __import__("fastapi").responses.JSONResponse(status_code=404,content={"success":False,"error":"not_found"})
    return exc
