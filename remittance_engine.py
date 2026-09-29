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
        self.brain=self.load_brain()
        self.providers_data=self.load_providers()
        self.sessions:Dict[str,Dict[str,Any]]={}

    def _read_json(self,path:Path)->Dict[str,Any]:
        if not path.exists():raise FileNotFoundError(f"Required data file not found: {path}")
        with path.open("r",encoding="utf-8") as f:data=json.load(f)
        if not isinstance(data,dict):raise ValueError(f"Invalid JSON root in {path.name}")
        return data

    def load_brain(self)->Dict[str,Any]:
        data=self._read_json(BRAIN_PATH)
        required=["app","experience","opening","conversation_logic","kernel","providers","countries","comparison","validation","security","languages"]
        missing=[x for x in required if x not in data]
        if missing:raise ValueError("Invalid app_brain.json. Missing sections: "+", ".join(missing))
        self.brain=data
        return data

    def load_providers(self)->Dict[str,Any]:
        if not PROVIDERS_PATH.exists():
            return {"version":"fallback","providers":deepcopy(self.brain.get("providers",[])),"corridors":{}}
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):data["providers"]=[]
        if not isinstance(data.get("corridors"),dict):data["corridors"]={}
        return data

    def now(self)->str:return datetime.now(timezone.utc).isoformat()

    def _dump(self,value:Any)->Any:
        if hasattr(value,"model_dump"):return value.model_dump()
        if hasattr(value,"dict"):return value.dict()
        if isinstance(value,dict):return {k:self._dump(v) for k,v in value.items()}
        if isinstance(value,list):return [self._dump(v) for v in value]
        return value

    def localize(self,value:Any,language:str="es")->str:
        language=language if language in ("es","en") else "es"
        if value is None:return ""
        if isinstance(value,(str,int,float,bool)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            if "es" in value:return self.localize(value["es"],"es")
            if "en" in value:return self.localize(value["en"],"en")
            for key in ("label","name","title","description","text"):
                if key in value:return self.localize(value[key],language)
            if "id" in value:return str(value["id"])
        if isinstance(value,list):
            return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        return self.localize(self.brain.get("messages",{}).get(key,{}),language)

    def _message(self,key:str,language:str="es")->str:
        value=self.language_text(key,language)
        if value:return value
        defaults={
            "results_ready":{"es":"Encontramos opciones verificadas para comparar.","en":"We found verified options to compare."},
            "no_results":{"es":"No pudimos confirmar cotizaciones actuales ahora. Puedes revisar las opciones oficiales disponibles.","en":"We could not confirm current quotes right now. You can review the available official options."}
        }
        return defaults.get(key,{}).get(language,"")

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        countries=self.brain.get("countries",{})
        names=countries.get("country_names",{}) if isinstance(countries,dict) else {}
        value=names.get(code) if isinstance(names,dict) else None
        if isinstance(value,dict):return value
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        value=destinations.get(code) if isinstance(destinations,dict) else None
        return value if isinstance(value,dict) else None

    def country_name(self,country_code:str,language:str="es")->str:
        code=(country_code or "").strip().upper()
        value=self.get_country(code)
        if not value:return code
        return self.localize(value,language) or str(value.get("country",code))

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers") or self.brain.get("providers",[])
        return [deepcopy(p) for p in providers if isinstance(p,dict) and p.get("enabled",True)]

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        provider_id=str(provider_id or "").strip()
        for provider in self.get_provider_registry():
            if str(provider.get("id",""))==provider_id:return provider
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
        code=(country or "").strip().upper()
        corridors=self.providers_data.get("corridors",{})
        destinations=corridors.get("destinations",{}) if isinstance(corridors,dict) else {}
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        ids=corridor.get("providers",[]) if isinstance(corridor,dict) else []
        if isinstance(ids,list):
            return [str(x) for x in ids if x]
        return [str(p["id"]) for p in self.get_provider_registry() if p.get("id")]

    def candidate_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        countries=self.brain.get("countries",{})
        supported=countries.get("initial_supported",[]) if isinstance(countries,dict) else []
        supported={str(x).upper() for x in supported}
        if code not in supported:return []
        ids=self.corridor_provider_ids(code)
        if not ids:
            ids=[str(p["id"]) for p in self.get_provider_registry() if p.get("id")]
        return [pid for pid in ids if self.get_provider(pid)]

    def _commercial_verified(self,commercial:Any)->bool:
        if not isinstance(commercial,dict):return False
        return str(commercial.get("status","")).lower()=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not self._commercial_verified(commercial):return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=(country or "").upper()
        return result

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        country=(country or "").upper()
        commercial=provider.get("commercial_data",{})
        verified=self._commercial_verified(commercial)
        url=self.provider_url(provider,language)
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
            "currency":commercial.get("currency") if verified else None,
            "source":commercial.get("source") if verified else None,
            "verified_at":commercial.get("verified_at") if verified else None,
            "continue_url":url,
            "official_site":provider.get("official_site") or url,
            "supports_online":provider.get("supports_online",True),
            "supports_agent":provider.get("supports_agent",False),
            "payment_methods":deepcopy(provider.get("payment_methods",[])),
            "delivery_methods":deepcopy(provider.get("delivery_methods",[]))
        }

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        sid=str(uuid.uuid4())
        now=self.now()
        state={
            "session_id":sid,
            "language":language,
            "amount":None,
            "send_currency":"USD",
            "destination_country":None,
            "priority":None,
            "urgency":None,
            "delivery_method":None,
            "payment_method":None,
            "special_need":None,
            "free_text":None,
            "parsed_user_need":None,
            "candidate_providers":[],
            "available_providers":[],
            "verified_results":[],
            "selected_option":None,
            "final_check":{},
            "current_step":"opening",
            "created_at":now,
            "updated_at":now
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

    def clear_session(self,session_id:str)->bool:
        return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        matches=re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text or "",re.I)
        for raw in matches:
            try:
                value=float(raw.replace(",",""))
                if value>0:return value
            except (TypeError,ValueError):
                continue
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=(text or "").lower()
        aliases=[
            ("trinidad and tobago","TT"),("dominican republic","DO"),("república dominicana","DO"),
            ("el salvador","SV"),("costa rica","CR"),("guyana","GY"),("suriname","SR"),
            ("mexico","MX"),("méxico","MX"),("mexican","MX"),("guatemala","GT"),
            ("salvador","SV"),("honduras","HN"),("nicaragua","NI"),("panama","PA"),("panamá","PA"),
            ("dominicana","DO"),("colombia","CO"),("venezuela","VE"),("ecuador","EC"),
            ("peru","PE"),("perú","PE"),("bolivia","BO"),("paraguay","PY"),("brazil","BR"),
            ("brasil","BR"),("chile","CL"),("argentina","AR"),("uruguay","UY"),("cuba","CU"),
            ("haiti","HT"),("haití","HT"),("belize","BZ"),("jamaica","JM")
        ]
        for name,code in aliases:
            if re.search(r"(?<![a-záéíóúñ])"+re.escape(name)+r"(?![a-záéíóúñ])",normalized):return code
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        patterns=[
            ("recipient_gets_more",["reciba más","reciba mas","receive more","máximo","maximo","more money"]),
            ("fastest",["más rápido","mas rapido","rápido","rapido","fastest","fast","quick","speed"]),
            ("urgent",["urgente","urgent","hoy","today","ahora","now"]),
            ("save",["ahorrar","ahorro","save","cheap","barato","fee"]),
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
            "language":request.language if request.language in ("es","en") else "es",
            "raw_text":text
        }

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        values={}
        for field in ("amount","destination_country","priority","urgency","delivery_method","payment_method","special_need","free_text"):
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        if getattr(request,"send_currency",None):values["send_currency"]=request.send_currency
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
        if not state.get("amount"):raise ValueError("Amount is required.")
        if not state.get("destination_country"):raise ValueError("Destination country is required.")
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
        country=(request.destination_country or "").strip().upper()
        if not country:raise ValueError("Destination country is required.")
        if not request.amount or request.amount<=0:raise ValueError("Amount is required.")
        provider_ids=self.candidate_provider_ids(country)
        verified_results=[]
        available=[]
        for pid in provider_ids:
            public=self.provider_public_option(pid,country,language)
            if public:available.append(public)
            commercial=self.get_verified_provider_data(pid,country,request.amount,request.payment_method,request.delivery_method)
            provider=self.get_provider(pid)
            if commercial and provider:
                try:verified_results.append(self._build_verified_result(provider,commercial,request,language))
                except Exception:continue
        if session_id and session_id in self.sessions:
            state=self.sessions[session_id]
            state["candidate_providers"]=[x["provider_id"] for x in available]
            state["available_providers"]=deepcopy(available)
            state["verified_results"]=[self._dump(x) for x in verified_results]
            state["current_step"]="results"
            state["updated_at"]=self.now()
        return {
            "success":True,
            "message":self._message("results_ready" if verified_results else "no_results",language),
            "results":[self._dump(x) for x in verified_results],
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
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        if str(provider_id) not in self.candidate_provider_ids(country):raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_available")
        state["selected_option"]=deepcopy(option)
        state["current_step"]="final_check"
        state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        destination=(request.destination_country or "").strip().upper()
        amount=request.amount
        delivery=request.delivery_method
        validation=self.brain.get("validation",{})
        raw_checks=validation.get("checks",[]) if isinstance(validation,dict) else []
        labels=[]
        for item in raw_checks[:4]:
            if isinstance(item,dict):labels.append(self.localize(item.get("label"),language))
        defaults={
            "es":["País de destino","Cantidad a enviar","Moneda de envío","Método de entrega"],
            "en":["Destination country","Amount to send","Sending currency","Delivery method"]
        }[language]
        while len(labels)<4:labels.append(defaults[len(labels)])
        checks=[
            {"id":"destination","label":labels[0],"value":self.country_name(destination,language),"complete":bool(destination),"status":"ok" if destination else "review"},
            {"id":"amount","label":labels[1],"value":str(amount),"complete":bool(amount and amount>0),"status":"ok" if amount and amount>0 else "review"},
            {"id":"currency","label":labels[2],"value":request.send_currency,"complete":bool(request.send_currency),"status":"ok" if request.send_currency else "review"},
            {"id":"delivery_method","label":labels[3],"value":delivery or "","complete":bool(delivery),"status":"ok" if delivery else "review"}
        ]
        valid=all(x["complete"] for x in checks)
        final_message=self.localize(validation.get("final_message",{}),language) if isinstance(validation,dict) else ""
        if not final_message:
            final_message={"es":"Revisa estos datos antes de continuar con el proveedor.","en":"Review these details before continuing with the provider."}[language]
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
            "message":final_message
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        opening=self.brain.get("opening",{})
        countries_data=self.brain.get("countries",{})
        names=countries_data.get("country_names",{}) if isinstance(countries_data,dict) else {}
        priorities=[]
        for item in opening.get("priorities",[]) if isinstance(opening,dict) else []:
            if isinstance(item,dict):
                priorities.append({"id":item.get("id"),"icon":item.get("icon",""),"label":self.localize(item.get("label"),language)})
        countries=[]
        supported=countries_data.get("initial_supported",[]) if isinstance(countries_data,dict) else []
        for code in supported:
            code=str(code).upper()
            item=names.get(code,{}) if isinstance(names,dict) else {}
            countries.append({"id":code,"name":self.localize(item,language) or code,"currency":item.get("currency") if isinstance(item,dict) else None})
        providers=[]
        for provider in self.get_provider_registry():
            providers.append({
                "id":provider.get("id"),
                "name":provider.get("name",provider.get("id")),
                "enabled":provider.get("enabled",True),
                "continue_url":self.provider_url(provider,language),
                "official_site":provider.get("official_site")
            })
        delivery_source=self.brain.get("delivery_methods",[])
        payment_source=self.brain.get("payment_methods",[])
        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{
                "primary_question":self.localize(opening.get("primary_question"),language),
                "secondary_text":self.localize(opening.get("secondary_text"),language),
                "amount":deepcopy(opening.get("amount",{})),
                "priorities":priorities,
                "free_text":deepcopy(opening.get("free_text",{}))
            },
            "countries":countries,
            "providers":providers,
            "delivery_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in delivery_source if isinstance(x,dict)],
            "payment_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in payment_source if isinstance(x,dict)],
            "messages":{k:self.localize(v,language) for k,v in self.brain.get("messages",{}).items()},
            "provider_handoff":{
                "button":self.localize(self.brain.get("provider_handoff",{}).get("button"),language),
                "external_notice":self.localize(self.brain.get("provider_handoff",{}).get("external_notice"),language)
            }
        }

engine=RemittanceEngine()
