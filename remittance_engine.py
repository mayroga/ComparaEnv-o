# remittance_engine.py — REMESAS | May Roga LLC
import json,re,uuid
from copy import deepcopy
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional
from schemas import UserNeedRequest,ParseNeedRequest,ComparisonRequest,ComparisonResult,FinalCheckRequest

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_PATH=DATA_DIR/"app_brain.json"
PROVIDERS_PATH=DATA_DIR/"providers.json"

class RemittanceEngine:
    def __init__(self):
        self.brain={}
        self.providers_data={}
        self.sessions={}
        self.load_brain()
        self.load_providers()

    def _read_json(self,path:Path)->Dict[str,Any]:
        if not path.exists():raise FileNotFoundError(f"Required data file not found: {path}")
        with path.open("r",encoding="utf-8") as f:data=json.load(f)
        if not isinstance(data,dict):raise ValueError(f"Invalid JSON root in {path.name}")
        return data

    def load_brain(self)->Dict[str,Any]:
        data=self._read_json(BRAIN_PATH)
        required=self.brain.get("brain_loading",{}).get("required_sections",[]) if isinstance(self.brain,dict) else []
        if not required:
            required=["app","product_promise","experience","money_assistant","weekly_money","expenses","family","opening","conversation_logic","kernel","money_kernel","providers","countries","comparison","validation","security","languages"]
        missing=[x for x in required if x not in data]
        if missing:raise ValueError("Invalid app_brain.json. Missing sections: "+", ".join(missing))
        if not isinstance(data.get("providers"),list) or len(data.get("providers",[]))!=4:raise ValueError("app_brain.json must contain exactly four remittance providers.")
        self.brain=data
        return data

    def load_providers(self)->Dict[str,Any]:
        if not PROVIDERS_PATH.exists():
            self.providers_data={"version":"brain_fallback","providers":deepcopy(self.brain.get("providers",[])),"corridors":{"destinations":{}}}
            return self.providers_data
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):data["providers"]=[]
        if len(data["providers"])!=4:
            brain_providers=deepcopy(self.brain.get("providers",[]))
            data["providers"]=brain_providers
        if not isinstance(data.get("corridors"),dict):data["corridors"]={}
        self.providers_data=data
        return data

    def now(self)->str:return datetime.now(timezone.utc).isoformat()

    def localize(self,value:Any,language:str="es")->str:
        if value is None:return ""
        if isinstance(value,(str,int,float,bool)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            if "es" in value:return self.localize(value["es"],"es")
            if "en" in value:return self.localize(value["en"],"en")
            if "label" in value:return self.localize(value["label"],language)
            if "name" in value:return self.localize(value["name"],language)
            if "id" in value:return str(value["id"])
        if isinstance(value,list):return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        return self.localize(self.brain.get("messages",{}).get(key,{}),language)

    def _message(self,key:str,language:str="es")->str:return self.language_text(key,language)

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        value=self.brain.get("countries",{}).get("country_names",{}).get(code)
        if isinstance(value,dict):return value
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        value=destinations.get(code) if isinstance(destinations,dict) else None
        return value if isinstance(value,dict) else None

    def country_name(self,country_code:str,language:str="es")->str:
        value=self.get_country(country_code)
        if not value:return country_code or ""
        return self.localize(value,language) or value.get("country",country_code)

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers") or self.brain.get("providers",[])
        result=[]
        for provider in providers:
            if isinstance(provider,dict) and provider.get("enabled",True):result.append(deepcopy(provider))
        return result

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        for provider in self.get_provider_registry():
            if provider.get("id")==provider_id:return provider
        return None

    def provider_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):urls={}
        preferred=["us_send_es","us_es","es","main"] if language=="es" else ["us_send","us_en","en","main"]
        for key in preferred:
            value=urls.get(key)
            if isinstance(value,str) and value.startswith(("http://","https://")):return value
        value=provider.get("official_site")
        return value if isinstance(value,str) and value.startswith(("http://","https://")) else None

    def corridor_provider_ids(self,country:str)->List[str]:
        code=(country or "").upper()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        ids=corridor.get("providers",[]) if isinstance(corridor,dict) else []
        if isinstance(ids,list) and ids:return [str(x) for x in ids]
        return [p.get("id") for p in self.get_provider_registry() if p.get("id")]

    def candidate_provider_ids(self,country:str)->List[str]:
        code=(country or "").upper()
        supported=self.brain.get("countries",{}).get("initial_supported",[])
        if code not in supported:return []
        return [pid for pid in self.corridor_provider_ids(code) if self.get_provider(pid)]

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):return None
        if str(commercial.get("status","")).lower()!="verified":return None
        if not commercial.get("source") or not commercial.get("verified_at"):return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=country
        return result

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):commercial={}
        verified=str(commercial.get("status","")).lower()=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))
        return {
            "provider_id":provider.get("id"),
            "provider_name":provider.get("name",provider.get("id","")),
            "enabled":bool(provider.get("enabled",True)),
            "country":country,
            "country_name":self.country_name(country,language),
            "commercial_status":"verified" if verified else "unavailable",
            "commercial_verified":verified,
            "fee":commercial.get("fee") if verified else None,
            "exchange_rate":commercial.get("exchange_rate") if verified else None,
            "recipient_amount":commercial.get("recipient_amount") if verified else None,
            "delivery_time":commercial.get("delivery_time") if verified else None,
            "delivery_method":commercial.get("delivery_method") if verified else None,
            "payment_method":commercial.get("payment_method") if verified else None,
            "currency":commercial.get("currency") if verified else None,
            "important_condition":commercial.get("important_condition") if verified else None,
            "source":commercial.get("source") if verified else None,
            "verified_at":commercial.get("verified_at") if verified else None,
            "continue_url":self.provider_url(provider,language),
            "official_site":provider.get("official_site") or self.provider_url(provider,language),
            "supports_online":provider.get("supports_online",True),
            "supports_agent":provider.get("supports_agent",False),
            "payment_methods":deepcopy(provider.get("payment_methods",[])),
            "delivery_methods":deepcopy(provider.get("delivery_methods",[]))
        }

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        sid=str(uuid.uuid4())
        state={
            "session_id":sid,
            "language":language,
            "amount":None,
            "send_currency":"USD",
            "destination_country":None,
            "destination_region":None,
            "priority":None,
            "urgency":None,
            "delivery_method":None,
            "payment_method":None,
            "recipient_amount_target":None,
            "special_need":None,
            "parsed_user_need":None,
            "candidate_providers":[],
            "available_providers":[],
            "verified_results":[],
            "selected_option":None,
            "final_check":{},
            "current_step":"opening",
            "created_at":self.now(),
            "updated_at":self.now()
        }
        self.sessions[sid]=state
        return deepcopy(state)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        return deepcopy(self.sessions.get(session_id)) if session_id in self.sessions else None

    def update_session(self,session_id:str,**values:Any)->Optional[Dict[str,Any]]:
        state=self.sessions.get(session_id)
        if not state:return None
        for key,value in values.items():
            if value is not None:state[key]=value
        state["updated_at"]=self.now()
        return deepcopy(state)

    def clear_session(self,session_id:str)->bool:return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        matches=re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text or "",re.I)
        if not matches:return None
        try:
            value=float(matches[0].replace(",",""))
            return value if value>0 else None
        except ValueError:return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=(text or "").lower()
        aliases={
            "méxico":"MX","mexico":"MX","mexican":"MX","guatemala":"GT","el salvador":"SV","salvador":"SV",
            "honduras":"HN","nicaragua":"NI","costa rica":"CR","panamá":"PA","panama":"PA",
            "república dominicana":"DO","dominican republic":"DO","dominicana":"DO","colombia":"CO",
            "venezuela":"VE","ecuador":"EC","perú":"PE","peru":"PE","bolivia":"BO","paraguay":"PY",
            "brasil":"BR","brazil":"BR","chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU","haití":"HT","haiti":"HT"
        }
        for name,code in aliases.items():
            if re.search(r"\b"+re.escape(name)+r"\b",normalized):return code
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        patterns=[
            ("recipient_gets_more",["reciba más","reciba mas","receive more","máximo","maximo","more money"]),
            ("fastest",["rápido","rapido","fast","quick","speed"]),
            ("urgent",["urgente","urgent","hoy","today","ahora","now"]),
            ("save",["ahorrar","ahorro","save","cheap","barato"]),
            ("balanced",["equilibrio","balance","balanced"]),
            ("compare_all",["comparar","compare","opciones","options"])
        ]
        for priority,terms in patterns:
            if any(term in value for term in terms):return priority
        return None

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text or ""
        priority=self._priority_from_text(text)
        return {
            "amount":self._amount_from_text(text),
            "destination_country":self._country_from_text(text),
            "priority":priority,
            "urgency":True if priority=="urgent" else None,
            "delivery_method":None,
            "payment_method":None,
            "language":request.language,
            "raw_text":text
        }

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        values={}
        for field in ("amount","destination_country","destination_region","priority","urgency","delivery_method","payment_method","recipient_amount_target","special_need","free_text"):
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        if request.language in ("es","en"):values["language"]=request.language
        values["current_step"]="comparison"
        return self.update_session(session_id,**values) or {}

    def _build_verified_result(self,provider:Dict[str,Any],commercial:Dict[str,Any],request:ComparisonRequest,language:str)->ComparisonResult:
        return ComparisonResult(
            provider_id=provider.get("id",""),
            provider_name=provider.get("name",provider.get("id","")),
            amount_sent=request.amount,
            send_currency=request.send_currency,
            fee=commercial.get("fee"),
            exchange_rate=commercial.get("exchange_rate"),
            recipient_amount=commercial.get("recipient_amount"),
            delivery_method=commercial.get("delivery_method"),
            payment_method=commercial.get("payment_method"),
            estimated_delivery=commercial.get("delivery_time"),
            recipient_currency=commercial.get("currency"),
            availability=True,
            important_condition=commercial.get("important_condition"),
            source=commercial.get("source"),
            verified_at=commercial.get("verified_at"),
            status="verified",
            continue_url=self.provider_url(provider,language)
        )

    def compare_session(self,session_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        request=ComparisonRequest(
            amount=state.get("amount"),
            destination_country=state.get("destination_country"),
            priority=state.get("priority"),
            urgency=state.get("urgency"),
            delivery_method=state.get("delivery_method"),
            payment_method=state.get("payment_method"),
            language=state.get("language","es"),
            send_currency=state.get("send_currency","USD")
        )
        return self.compare(request,session_id)

    def compare(self,request:ComparisonRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=(request.destination_country or "").upper()
        if not country:raise ValueError("Destination country is required.")
        if not request.amount or request.amount<=0:raise ValueError("Amount is required.")

        provider_ids=self.candidate_provider_ids(country)
        available=[]
        verified_results=[]

        for pid in provider_ids:
            public=self.provider_public_option(pid,country,language)
            if public:available.append(public)
            commercial=self.get_verified_provider_data(pid,country,request.amount,request.payment_method,request.delivery_method)
            provider=self.get_provider(pid)
            if commercial and provider:
                try:verified_results.append(self._build_verified_result(provider,commercial,request,language))
                except Exception:pass

        if session_id and session_id in self.sessions:
            state=self.sessions[session_id]
            state["candidate_providers"]=[x["provider_id"] for x in available]
            state["available_providers"]=deepcopy(available)
            state["verified_results"]=[x.model_dump() for x in verified_results]
            state["current_step"]="results"
            state["updated_at"]=self.now()

        return {
            "success":True,
            "message":self._message("results_ready" if verified_results else "no_results",language),
            "results":[x.model_dump() for x in verified_results],
            "available_providers":available,
            "provider_count":len(available),
            "verified_count":len(verified_results),
            "results_available":bool(verified_results),
            "destination_country":country,
            "destination_name":self.country_name(country,language),
            "amount":request.amount,
            "send_currency":request.send_currency,
            "priority":request.priority,
            "language":language
        }

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        provider=self.get_provider(provider_id)
        if not provider:raise KeyError("provider_not_found")
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_available")
        state["selected_option"]=deepcopy(option)
        state["current_step"]="final_check"
        state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        destination=request.destination_country or ""
        amount=request.amount or 0
        delivery=request.delivery_method
        checks=[
            {"id":"destination","label":self.localize(self.brain["validation"]["checks"][0]["label"],language),"value":self.country_name(destination,language),"complete":bool(destination),"status":"ok" if destination else "review"},
            {"id":"amount","label":self.localize(self.brain["validation"]["checks"][1]["label"],language),"value":str(amount),"complete":bool(amount>0),"status":"ok" if amount>0 else "review"},
            {"id":"currency","label":self.localize(self.brain["validation"]["checks"][2]["label"],language),"value":request.send_currency,"complete":True,"status":"ok"},
            {"id":"delivery_method","label":self.localize(self.brain["validation"]["checks"][3]["label"],language),"value":delivery or "","complete":bool(delivery),"status":"ok" if delivery else "review"}
        ]
        valid=all(x["complete"] for x in checks)
        if session_id and session_id in self.sessions:
            self.sessions[session_id]["final_check"]={"checks":deepcopy(checks),"valid":valid}
            self.sessions[session_id]["current_step"]="final_check"
            self.sessions[session_id]["updated_at"]=self.now()
        return {
            "success":True,
            "ready_to_continue":valid,
            "language":language,
            "provider_id":request.provider_id,
            "checks":checks,
            "message":self.localize(self.brain["validation"]["final_message"],language)
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        priorities=[]
        for item in self.brain.get("opening",{}).get("priorities",[]):
            if isinstance(item,dict):
                priorities.append({"id":item.get("id"),"icon":item.get("icon",""),"label":self.localize(item.get("label"),language)})

        countries=[]
        names=self.brain.get("countries",{}).get("country_names",{})
        for code in self.brain.get("countries",{}).get("initial_supported",[]):
            item=names.get(code,{})
            countries.append({"id":code,"name":self.localize(item,language),"currency":item.get("currency")})

        providers=[]
        for provider in self.get_provider_registry():
            providers.append({
                "id":provider.get("id"),
                "name":provider.get("name"),
                "enabled":provider.get("enabled",True),
                "continue_url":self.provider_url(provider,language),
                "official_site":provider.get("official_site")
            })

        return {
            "app":{
                "id":self.brain.get("app",{}).get("id"),
                "name":self.brain.get("app",{}).get("name","REMESAS"),
                "version":self.brain.get("app",{}).get("version"),
                "default_language":self.brain.get("app",{}).get("default_language","es"),
                "supported_languages":self.brain.get("app",{}).get("supported_languages",["es","en"])
            },
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{
                "primary_question":self.localize(self.brain.get("opening",{}).get("primary_question"),language),
                "secondary_text":self.localize(self.brain.get("opening",{}).get("secondary_text"),language),
                "amount":{
                    "required":self.brain.get("opening",{}).get("amount",{}).get("required",False),
                    "placeholder":self.localize(self.brain.get("opening",{}).get("amount",{}).get("placeholder"),language)
                },
                "priorities":priorities,
                "free_text":{
                    "enabled":self.brain.get("opening",{}).get("free_text",{}).get("enabled",True),
                    "placeholder":self.localize(self.brain.get("opening",{}).get("free_text",{}).get("placeholder"),language)
                }
            },
            "countries":countries,
            "providers":providers,
            "delivery_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in self.brain.get("delivery_methods",[]) if isinstance(x,dict)],
            "payment_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in self.brain.get("payment_methods",[]) if isinstance(x,dict)],
            "messages":{k:self.localize(v,language) for k,v in self.brain.get("messages",{}).items()},
            "provider_handoff":{
                "button":self.localize(self.brain.get("provider_handoff",{}).get("button"),language),
                "external_notice":self.localize(self.brain.get("provider_handoff",{}).get("external_notice"),language)
            },
            "money_assistant":{
                "enabled":self.brain.get("money_assistant",{}).get("enabled",True),
                "title":self.localize(self.brain.get("money_assistant",{}).get("title"),language),
                "description":self.localize(self.brain.get("money_assistant",{}).get("description"),language)
            },
            "weekly_money":{
                "enabled":self.brain.get("weekly_money",{}).get("enabled",True),
                "title":self.localize(self.brain.get("weekly_money",{}).get("title"),language)
            },
            "expenses":{
                "enabled":self.brain.get("expenses",{}).get("enabled",True),
                "title":self.localize(self.brain.get("expenses",{}).get("title"),language)
            },
            "family":{
                "enabled":self.brain.get("family",{}).get("enabled",True),
                "title":self.localize(self.brain.get("family",{}).get("title"),language)
            }
        }

engine=RemittanceEngine()
