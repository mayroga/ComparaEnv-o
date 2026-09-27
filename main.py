from datetime import datetime,timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI,HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from schemas import (
UserNeedRequest,ParseNeedRequest,ComparisonRequest,
FinalCheckRequest,Language
)
from remittance_engine import (
create_session,get_session,update_from_parsed,parse_need_text,
compare_options,select_provider,preparation_guide,send_guide,
final_check,public_config,validate_brain,help_data,provider_registry
)

APP_NAME="REMESAS | May Roga LLC"
APP_VERSION="1.0.0"
BASE_DIR=Path(__file__).resolve().parent
STATIC_DIR=BASE_DIR/"static"

app=FastAPI(title=APP_NAME,version=APP_VERSION)

if STATIC_DIR.exists():
app.mount("/static",StaticFiles(directory=str(STATIC_DIR)),name="static")

def update_session_timestamp(session):
session.updated_at=datetime.now(timezone.utc).isoformat()
return session

def provider_official_url(provider):
url=provider.get("official_url") or provider.get("url")
if url:
return url
urls=provider.get("official_urls") or {}
if isinstance(urls,dict):
for key in ("us_send","us_en","us_es","main","us","home"):
value=urls.get(key)
if value:
return value
for value in urls.values():
if isinstance(value,str) and value.startswith(("http://","https://")):
return value
return None

@app.get("/")
def home():
index=STATIC_DIR/"index.html"
if index.exists():
return FileResponse(index)
return {"app":APP_NAME,"version":APP_VERSION}

@app.get("/health")
def health():
return {"status":"ok","app":APP_NAME,"version":APP_VERSION}

@app.get("/api/health")
def api_health():
return health()

@app.get("/api")
def api_info():
return {
"app":APP_NAME,
"version":APP_VERSION,
"status":"ok",
"modules":{
"need_analysis":True,
"comparison":True,
"preparation":True,
"send_guide":True,
"final_check":True
}
}

@app.get("/api/config")
def config():
return public_config()

@app.get("/api/providers")
def providers():
return {
"providers":[
{
"id":str(p.get("id") or p.get("provider_id") or ""),
"name":str(p.get("name") or ""),
"official_url":provider_official_url(p),
"delivery_methods":p.get("delivery_methods",[]),
"payment_methods":p.get("payment_methods",[]),
"enabled":p.get("enabled",True)
}
for p in provider_registry()
]
}

@app.post("/api/need/parse")
def parse_need(request:ParseNeedRequest):
return parse_need_text(request.text,request.language)

@app.post("/api/need")
def create_need(request:UserNeedRequest):
session=create_session(request)
return {
"session":session,
"message":(
"Necesidad identificada. Ahora podemos revisar qué factores "
"cambian la decisión y qué información falta."
if request.language==Language.es else
"Need identified. We can now review which factors change the "
"decision and what information is missing."
)
}

@app.get("/api/session/{session_id}")
def session(session_id:str):
try:
return {"session":get_session(session_id)}
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

@app.post("/api/session/{session_id}/parse")
def session_parse(session_id:str,request:ParseNeedRequest):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")
parsed=parse_need_text(request.text,request.language)
update_from_parsed(current_session,parsed)
return {"session":current_session,"parsed":parsed}

@app.get("/api/session/{session_id}/analysis")
def session_analysis(session_id:str):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")
if not current_session.need_analysis:
raise HTTPException(status_code=409,detail="Need analysis is not available")
return current_session.need_analysis

@app.post("/api/session/{session_id}/compare")
def session_compare(
session_id:str,
request:Optional=None
):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

```
amount=current_session.amount
destination=current_session.destination

if not amount:
    raise HTTPException(status_code=422,detail="Amount is required before comparison")
if not destination:
    raise HTTPException(status_code=422,detail="Destination is required before comparison")

priority=(
    request.priority
    if request and request.priority is not None
    else current_session.priority
)

req=UserNeedRequest(
    language=current_session.language,
    amount=amount,
    destination=destination,
    priority=priority,
    urgency=current_session.urgency,
    delivery_method=current_session.delivery_method,
    payment_method=current_session.payment_method,
    free_text=current_session.free_text,
    recipient_has_bank_account=current_session.recipient_has_bank_account,
    recipient_has_mobile_wallet=current_session.recipient_has_mobile_wallet,
    first_transfer=current_session.first_transfer,
    recurring_transfer=current_session.recurring_transfer,
    special_need=current_session.special_need
)

result=compare_options(req,session_id)
current_session.step="comparison"

if current_session.free_text:
    parsed=parse_need_text(
        current_session.free_text,
        current_session.language
    )
    update_from_parsed(current_session,parsed)
    current_session.step="comparison"
else:
    update_session_timestamp(current_session)

return result
```

@app.post("/api/session/{session_id}/select/{provider_id}")
def session_select_provider(session_id:str,provider_id:str):
try:
option=select_provider(session_id,provider_id)
except KeyError as exc:
raise HTTPException(status_code=404,detail=str(exc))
return {
"session":get_session(session_id),
"provider":option,
"message":"Opción seleccionada. Ahora prepara la información antes de continuar."
}

@app.get("/api/session/{session_id}/preparation")
def session_preparation(session_id:str):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

```
guide=preparation_guide(current_session)
current_session.preparation=guide
current_session.step="preparation"
update_session_timestamp(current_session)
return guide
```

@app.get("/api/session/{session_id}/guide")
def session_guide(session_id:str):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

```
guide=send_guide(current_session)
current_session.send_guide=guide
current_session.step="guide"
update_session_timestamp(current_session)
return guide
```

@app.post("/api/session/{session_id}/final-check")
def session_final_check(session_id:str,request:FinalCheckRequest):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

```
result=final_check(
    current_session,
    request.provider_id,
    request.recipient,
    request.confirm_provider_data
)
current_session.final_check=result
current_session.step="final_check"
update_session_timestamp(current_session)
return result
```

@app.get("/api/session/{session_id}/provider")
def session_provider(session_id:str):
try:
current_session=get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

```
if not current_session.selected_provider:
    raise HTTPException(status_code=404,detail="No provider selected")

return current_session.selected_provider
```

@app.delete("/api/session/{session_id}")
def delete_session(session_id:str):
try:
get_session(session_id)
except KeyError:
raise HTTPException(status_code=404,detail="Session not found")

```
from remittance_engine import SESSIONS
SESSIONS.pop(session_id,None)
return {"ok":True,"message":"Session deleted"}
```

@app.get("/api/help")
def help_endpoint(language:Language=Language.es):
return help_data(language)

@app.get("/api/brain/validate")
def brain_validate():
return validate_brain()

@app.get("/api/sources")
def sources():
return {
"policy":"Commercial information is shown only when verified.",
"providers":[
{
"id":str(p.get("id") or p.get("provider_id") or ""),
"name":str(p.get("name") or ""),
"official_url":provider_official_url(p)
}
for p in provider_registry()
]
}

@app.get("/api/disclaimer")
def disclaimer():
return {
"title":"Información importante",
"text":(
"REMESAS es una herramienta de preparación, comparación y "
"verificación. No realiza ni procesa la transferencia de dinero. "
"El envío y el pago se realizan directamente con el proveedor."
)
}
