import json,re,uuid,unicodedata,os
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
        try:
            with path.open("r",encoding="utf-8") as f:data=json.load(f)
        except json.JSONDecodeError as e:raise ValueError(f"Invalid JSON in {path.name}: {e}")
        if not isinstance(data,dict):raise ValueError(f"Invalid JSON root in {path.name}")
        return data

    def load_brain(self)->Dict[str,Any]:
        data=self._read_json(BRAIN_PATH)
        required=["app","experience","opening","conversation_logic","kernel","providers","countries","comparison","validation","security","languages"]
        missing=[x for x in required if x not in data]
        if missing:raise ValueError("Invalid app_brain.json. Missing sections: "+", ".join(missing))
        return data

    def load_providers(self)->Dict[str,Any]:
        if not PROVIDERS_PATH.exists():
            return {"version":"fallback","providers":deepcopy(self.brain.get("providers",[])),"corridors":{"origin":"US","destinations":{}}}
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):data["providers"]=[]
        if not isinstance(data.get("corridors"),dict):data["corridors"]={"origin":"US","destinations":{}}
        if not isinstance(data["corridors"].get("destinations"),dict):data["corridors"]["destinations"]={}
        return data

    def now(self)->str:return datetime.now(timezone.utc).isoformat()

    def normalize_text(self,text:str)->str:
        value=str(text or "").strip().lower()
        value=unicodedata.normalize("NFD",value)
        return "".join(c for c in value if unicodedata.category(c)!="Mn")

    def localize(self,value:Any,language:str="es")->str:
        if value is None:return ""
        if isinstance(value,(str,int,float,bool)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            fallback="en" if language=="es" else "es"
            if fallback in value:return self.localize(value[fallback],fallback)
            for key in ("label","name","title","text","description","id"):
                if key in value:return self.localize(value[key],language)
        if isinstance(value,list):return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        return self.localize(self.brain.get("messages",{}).get(key,{}),language)

    def _message(self,key:str,language:str="es")->str:
        return self.language_text(key,language)

    def get_supported_countries(self)->List[Dict[str,Any]]:
        countries=self.brain.get("countries",{})
        supported=countries.get("supported")
        if not isinstance(supported,list):supported=countries.get("initial_supported",[])
        names=countries.get("country_names",{})
        result=[]
        for item in supported or []:
            if isinstance(item,dict):
                code=str(item.get("code") or item.get("id") or "").upper().strip()
                if code:result.append({"code":code,"name":deepcopy(item.get("name") or names.get(code,{"es":code,"en":code}))})
            else:
                code=str(item).upper().strip()
                if code:result.append({"code":code,"name":deepcopy(names.get(code,{"es":code,"en":code}))})
        if not result and isinstance(names,dict):
            for code,value in names.items():
                if isinstance(value,dict):result.append({"code":str(code).upper(),"name":deepcopy(value)})
        return result

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=str(country_code or "").strip().upper()
        if not code:return None
        for item in self.get_supported_countries():
            if item["code"]==code:return item
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        value=destinations.get(code) if isinstance(destinations,dict) else None
        return value if isinstance(value,dict) else None

    def country_name(self,country_code:str,language:str="es")->str:
        code=str(country_code or "").strip().upper()
        item=self.get_country(code)
        if not item:return code
        return self.localize(item.get("name",item),language) or code

    def country_supported(self,country_code:str)->bool:
        code=str(country_code or "").strip().upper()
        return any(x["code"]==code for x in self.get_supported_countries())

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not isinstance(providers,list) or not providers:providers=self.brain.get("providers",[])
        result=[];seen=set()
        for p in providers:
            if not isinstance(p,dict):continue
            pid=str(p.get("id","")).strip().lower()
            if not pid or pid in seen or not bool(p.get("enabled",True)):continue
            seen.add(pid);result.append(deepcopy(p))
        return result

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=str(provider_id or "").strip().lower()
        for p in self.get_provider_registry():
            if str(p.get("id","")).lower()==pid:return p
        return None

    def provider_url(self,provider:Dict[str,Any],language:str="es",topic:Optional[str]=None)->Optional[str]:
        urls=provider.get("official_urls",{})
        if isinstance(urls,dict):
            topic_keys={
                "fee":["fees","fee","pricing","cost"],
                "rate":["exchange_rate","exchange","rates","rate"],
                "delivery":["delivery","delivery_time","receiving","receive"],
                "requirements":["requirements","help","support"],
                "recipient":["recipient","receive","cash_pickup","delivery"],
                "mistake":["mistake","help","support"],
                "cancel":["cancel","cancellation","help","support"],
                "security":["security","help","support"],
                "general":["help","support","home","main"]
            }
            if topic:
                for key in topic_keys.get(topic,topic_keys["general"]):
                    value=urls.get(key)
                    if isinstance(value,str) and value.startswith(("http://","https://")):return value
            keys=["us_send_es","us_es","es","home","main"] if language=="es" else ["us_send","us_en","en","home","main"]
            for key in keys:
                value=urls.get(key)
                if isinstance(value,str) and value.startswith(("http://","https://")):return value
        for key in ("official_site","official_url"):
            value=provider.get(key)
            if isinstance(value,str) and value.startswith(("http://","https://")):return value
        return None

    def provider_help_url(self,provider_id:str,language:str="es",topic:Optional[str]=None)->Optional[str]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        return self.provider_url(provider,language,topic)

    def corridor_provider_ids(self,country:str)->List[str]:
        code=str(country or "").strip().upper()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        ids=corridor.get("providers",[]) if isinstance(corridor,dict) else []
        valid=[]
        if isinstance(ids,list):
            for pid in ids:
                if self.get_provider(str(pid)):valid.append(str(pid))
        if valid:return valid
        return [str(p.get("id")) for p in self.get_provider_registry() if p.get("id")]

    def candidate_provider_ids(self,country:str)->List[str]:
        code=str(country or "").strip().upper()
        if not self.country_supported(code):return []
        return self.corridor_provider_ids(code)

    def commercial_verified(self,commercial:Any)->bool:
        if not isinstance(commercial,dict):return False
        return str(commercial.get("status","")).lower()=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not self.commercial_verified(commercial):return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=str(country or "").upper()
        return result

    def human_payment(self,value:Any,language:str="es")->str:
        mapping={
            "bank_account":{"es":"Cuenta bancaria","en":"Bank account"},
            "debit_card":{"es":"Tarjeta de débito","en":"Debit card"},
            "credit_card":{"es":"Tarjeta de crédito","en":"Credit card"},
            "cash":{"es":"Efectivo","en":"Cash"}
        }
        if isinstance(value,list):
            return ", ".join(self.human_payment(x,language) for x in value)
        key=str(value or "").strip().lower()
        return mapping.get(key,{"es":str(value or ""),"en":str(value or "")}).get(language,str(value or ""))

    def human_delivery(self,value:Any,language:str="es")->str:
        mapping={
            "bank_account":{"es":"Cuenta bancaria","en":"Bank account"},
            "cash_pickup":{"es":"Recibir en efectivo","en":"Receive in cash"},
            "mobile_wallet":{"es":"Billetera digital","en":"Digital wallet"},
            "home_delivery":{"es":"Entrega a domicilio","en":"Home delivery"}
        }
        if isinstance(value,list):
            return ", ".join(self.human_delivery(x,language) for x in value)
        key=str(value or "").strip().lower()
        return mapping.get(key,{"es":str(value or ""),"en":str(value or "")}).get(language,str(value or ""))

    def human_provider_option(self,provider:Dict[str,Any],country:str,language:str="es")->Dict[str,Any]:
        pid=provider.get("id","")
        return {
            "provider_id":pid,
            "provider_name":provider.get("name",pid),
            "country":str(country or "").upper(),
            "country_name":self.country_name(country,language),
            "online":bool(provider.get("supports_online",True)),
            "agent":bool(provider.get("supports_agent",False)),
            "payment_options":[self.human_payment(x,language) for x in provider.get("payment_methods",[]) if x],
            "delivery_options":[self.human_delivery(x,language) for x in provider.get("delivery_methods",[]) if x],
            "requirements":[self.localize(x,language) for x in provider.get("requirements",[]) if self.localize(x,language)],
            "official_url":self.provider_url(provider,language),
            "help_url":self.provider_help_url(pid,language,"general")
        }

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        verified=self.commercial_verified(commercial)
        result=self.human_provider_option(provider,country,language)
        result.update({
            "enabled":bool(provider.get("enabled",True)),
            "commercial_status":"verified" if verified else "unavailable",
            "commercial_verified":verified,
            "fee":commercial.get("fee") if verified else None,
            "exchange_rate":commercial.get("exchange_rate") if verified else None,
            "recipient_amount":commercial.get("recipient_amount") if verified else None,
            "delivery_time":commercial.get("delivery_time") if verified else None,
            "currency":commercial.get("currency") if verified else None,
            "delivery_method":self.human_delivery(commercial.get("delivery_method"),language) if verified else None,
            "payment_method":self.human_payment(commercial.get("payment_method"),language) if verified else None,
            "important_condition":commercial.get("important_condition") if verified else None,
            "source":commercial.get("source") if verified else None,
            "verified_at":commercial.get("verified_at") if verified else None,
            "continue_url":self.provider_url(provider,language),
            "official_site":provider.get("official_site") or self.provider_url(provider,language)
        })
        return result

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        sid=str(uuid.uuid4())
        state={
            "session_id":sid,"language":language,"need_type":None,"amount":None,"send_currency":"USD",
            "destination_country":None,"destination_region":None,"priority":None,"urgency":None,
            "frequency":None,"delivery_method":None,"payment_method":None,"special_need":None,
            "free_text":None,"parsed_user_need":None,"candidate_providers":[],"available_providers":[],
            "verified_results":[],"selected_option":None,"final_check":{},"current_step":"opening",
            "created_at":self.now(),"updated_at":self.now()
        }
        self.sessions[sid]=state
        return deepcopy(state)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        return deepcopy(self.sessions.get(session_id))

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
        value=str(text or "")
        matches=re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",value,re.I)
        for raw in matches:
            try:
                n=float(raw.replace(",",""))
                if n>0:return n
            except ValueError:pass
        words={"cien":100,"cien dolares":100,"doscientos":200,"trescientos":300,"cuatrocientos":400,"quinientos":500,"seiscientos":600,"setecientos":700,"ochocientos":800,"novecientos":900,"mil":1000}
        normalized=self.normalize_text(value)
        for word,n in words.items():
            if re.search(r"\b"+re.escape(word)+r"\b",normalized):return float(n)
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=self.normalize_text(text)
        aliases={"mexico":"MX","mexican":"MX","mexicana":"MX","guatemala":"GT","el salvador":"SV","salvador":"SV","honduras":"HN","nicaragua":"NI","costa rica":"CR","panama":"PA","republica dominicana":"DO","dominicana":"DO","colombia":"CO","venezuela":"VE","ecuador":"EC","peru":"PE","bolivia":"BO","paraguay":"PY","brasil":"BR","brazil":"BR","chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU","haiti":"HT"}
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",normalized):return code
        for item in self.get_supported_countries():
            code=item["code"].lower()
            if re.search(r"\b"+re.escape(code)+r"\b",normalized):return code.upper()
            name=self.normalize_text(self.localize(item.get("name"),"es"))
            if name and re.search(r"\b"+re.escape(name)+r"\b",normalized):return code.upper()
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=self.normalize_text(text)
        patterns=[("recipient_gets_more",["reciba mas","recibir mas","receive more","mas dinero","more money"]),("fastest",["rapido","rapida","fast","quick","speed","lo antes posible"]),("urgent",["urgente","urgent","hoy","today","ahora","now","asap"]),("save",["ahorrar","ahorro","save","cheap","barato","menos costo","menor costo"]),("balanced",["equilibrio","balance","balanced"]),("compare_all",["comparar","compare","comparacion","opciones","options"])]
        for p,terms in patterns:
            if any(x in value for x in terms):return p
        return None

    def _frequency_from_text(self,text:str)->Optional[str]:
        value=self.normalize_text(text)
        if any(x in value for x in ["cada semana","semanal","weekly"]):return "weekly"
        if any(x in value for x in ["cada dos semanas","cada 2 semanas","quincenal","biweekly"]):return "biweekly"
        if any(x in value for x in ["cada mes","mensual","monthly"]):return "monthly"
        if any(x in value for x in ["una vez","puntual","ocasional","one time","once"]):return "one_time"
        return None

    def classify_need(self,text:str,language:str="es")->Dict[str,Any]:
        value=self.normalize_text(text)
        categories=[
            ("remittance",["enviar dinero","mandar dinero","enviar","mandar","remesa","remesas","transferir","transferencia","send money","remittance","transfer money"]),
            ("money_available",["cuanto puedo gastar","dinero disponible","money available","how much can i spend","me quedan"]),
            ("budget",["presupuesto","organizar mi dinero","organizar dinero","budget","plan my money","planificar mi dinero"]),
            ("expenses",["gastos","gasto","expense","expenses","en que gasto","small spending","cosas pequenas"]),
            ("savings",["ahorrar","ahorro","save money","savings","guardar dinero","guardar"]),
            ("purchase",["comprar","compra","purchase","shopping","quiero comprar"]),
            ("family",["familia","familiar","family","para mi mama","para mi madre","para mi padre"]),
            ("requirements",["requisito","requisitos","que necesito","documentos","requirements","what do i need"]),
            ("personal_information",["informacion personal","datos personales","identificacion","personal information"]),
            ("fees",["comision","tarifa","cargo","fee","fees","costo de envio"]),
            ("exchange_rate",["tasa de cambio","tipo de cambio","exchange rate","cambio"]),
            ("delivery",["cuando llega","entrega","delivery","cuanto tarda","tiempo"]),
            ("provider_difference",["diferencia entre","diferencias","cual es la diferencia","difference between"]),
            ("mistake_prevention",["me equivoque","error","mistake","wrong information"]),
            ("cancellation",["cancelar","cancelacion","cancel","canceled"]),
            ("recipient_information",["beneficiario","destinatario","recipient","beneficiary"]),
            ("security",["seguro","seguridad","estafa","fraude","security","scam","fraud"])
        ]
        for topic,terms in categories:
            if any(term in value for term in terms):return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        text=request.text or ""
        classification=self.classify_need(text,language)
        priority=self._priority_from_text(text)
        return {"need_type":classification["need_type"],"amount":self._amount_from_text(text),"destination_country":self._country_from_text(text),"priority":priority,"urgency":True if priority=="urgent" else None,"frequency":self._frequency_from_text(text),"delivery_method":None,"payment_method":None,"language":language,"raw_text":text}

    def _next_step(self,state:Dict[str,Any])->str:
        if not state.get("need_type"):return "need"
        if state.get("need_type")!="remittance":return "assistant"
        if not state.get("amount"):return "amount"
        if not state.get("destination_country"):return "destination"
        return "comparison"

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        values={}
        for field in ("amount","destination_country","destination_region","priority","urgency","frequency","delivery_method","payment_method","special_need","free_text","need_type"):
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        if request.language in ("es","en"):values["language"]=request.language
        if request.free_text:
            parsed=self.parse_need(ParseNeedRequest(text=request.free_text,language=request.language))
            values["parsed_user_need"]=parsed
            for key in ("amount","destination_country","priority","urgency","frequency","delivery_method","payment_method"):
                if values.get(key) is None and parsed.get(key) is not None:values[key]=parsed[key]
            if values.get("need_type") is None:values["need_type"]=parsed.get("need_type")
        current=deepcopy(self.sessions[session_id]);current.update(values);values["current_step"]=self._next_step(current)
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
            delivery_method=self.human_delivery(commercial.get("delivery_method"),language),
            payment_method=self.human_payment(commercial.get("payment_method"),language),
            estimated_delivery=commercial.get("delivery_time"),
            recipient_currency=commercial.get("currency"),
            availability=True,
            important_condition=commercial.get("important_condition"),
            requirements=deepcopy(commercial.get("requirements",[])) if isinstance(commercial.get("requirements",[]),list) else [],
            source=commercial.get("source"),
            verified_at=commercial.get("verified_at"),
            status="verified",
            continue_url=self.provider_url(provider,language)
        )

    def _simple_difference_text(self,available:List[Dict[str,Any]],language:str)->List[Dict[str,Any]]:
        result=[]
        if not available:return result
        online=[x["provider_name"] for x in available if x.get("online")]
        agent=[x["provider_name"] for x in available if x.get("agent")]
        if online:
            result.append({"title":"Puedes hacerlo por internet" if language=="es" else "You can do it online","text":"Todas estas opciones permiten comenzar el envío por internet." if language=="es" else "These options let you start the transfer online.","providers":online})
        if agent:
            result.append({"title":"También puedes buscar ayuda en persona" if language=="es" else "You can also get help in person","text":"Estas opciones indican que tienen atención mediante agentes u oficinas." if language=="es" else "These options indicate that they offer service through agents or offices.","providers":agent})
        payment_groups={}
        for p in available:
            values=tuple(p.get("payment_options",[]))
            payment_groups.setdefault(values,[]).append(p["provider_name"])
        if len(payment_groups)>1:
            for values,names in payment_groups.items():
                if values:
                    result.append({"title":"Cómo puedes pagar" if language=="es" else "How you can pay","text":("Puedes pagar de estas formas: "+", ".join(values)+".") if language=="es" else ("You can pay in these ways: "+", ".join(values)+"."),"providers":names})
        delivery_groups={}
        for p in available:
            values=tuple(p.get("delivery_options",[]))
            delivery_groups.setdefault(values,[]).append(p["provider_name"])
        if len(delivery_groups)>1:
            for values,names in delivery_groups.items():
                if values:
                    result.append({"title":"Cómo puede recibirlo la persona" if language=="es" else "How the person can receive it","text":("Puede recibirlo de estas formas: "+", ".join(values)+".") if language=="es" else ("The person can receive it in these ways: "+", ".join(values)+"."),"providers":names})
        return result

    def compare_session(self,session_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        if not state.get("amount"):raise ValueError("Amount is required.")
        if not state.get("destination_country"):raise ValueError("Destination country is required.")
        request=ComparisonRequest(
            amount=state["amount"],
            destination_country=state["destination_country"],
            priority=state.get("priority"),
            urgency=state.get("urgency"),
            delivery_method=state.get("delivery_method"),
            payment_method=state.get("payment_method"),
            language=state.get("language","es"),
            send_currency=state.get("send_currency","USD"),
            recipient_amount_target=None,
            special_need=state.get("special_need")
        )
        return self.compare(request,session_id)

    def compare(self,request:ComparisonRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=str(request.destination_country or "").strip().upper()
        if request.amount<=0:raise ValueError("Amount must be greater than zero.")
        if not country:raise ValueError("Destination country is required.")
        if not self.country_supported(country):raise ValueError("Destination country is not supported.")
        provider_ids=self.candidate_provider_ids(country)
        available=[];verified_results=[]
        for pid in provider_ids:
            public=self.provider_public_option(pid,country,language)
            if public:available.append(public)
            commercial=self.get_verified_provider_data(pid,country,request.amount,request.payment_method,request.delivery_method)
            provider=self.get_provider(pid)
            if commercial and provider:verified_results.append(self._build_verified_result(provider,commercial,request,language))
        verified_ids={x.provider_id for x in verified_results}
        for item in available:
            item["commercial_status"]="verified" if item.get("provider_id") in verified_ids else "unavailable"
            item["commercial_verified"]=item.get("provider_id") in verified_ids
        simple_differences=self._simple_difference_text(available,language)
        if session_id in self.sessions:
            state=self.sessions[session_id]
            state["candidate_providers"]=[x["provider_id"] for x in available]
            state["available_providers"]=deepcopy(available)
            state["verified_results"]=[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results]
            state["current_step"]="results";state["updated_at"]=self.now()
        verified=bool(verified_results)
        if verified:
            message="Encontramos información comprobada para revisar." if language=="es" else "We found verified information to review."
        else:
            message="Las opciones están disponibles, pero no tenemos sus precios o condiciones actuales comprobados. No vamos a inventarlos." if language=="es" else "The options are available, but we do not have verified current prices or terms. We will not guess them."
        return {
            "success":True,
            "message":message,
            "results":[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results],
            "available_providers":available,
            "provider_count":len(available),
            "verified_count":len(verified_results),
            "results_available":verified,
            "destination_country":country,
            "destination_name":self.country_name(country,language),
            "amount":request.amount,
            "send_currency":request.send_currency,
            "priority":request.priority,
            "urgency":request.urgency,
            "language":language,
            "explanation":self.comparison_explanation(language,verified),
            "differences":simple_differences,
            "precautions":self._precautions(language)
        }

    def comparison_explanation(self,language:str="es",verified:bool=False)->str:
        if verified:
            return "Te mostramos solamente lo que podemos respaldar con una fuente y una fecha de comprobación." if language=="es" else "We show only information we can support with a source and verification date."
        return "No mostramos precios, tasas, tiempos ni cantidades como si fueran actuales cuando no podemos comprobarlos." if language=="es" else "We do not present prices, rates, delivery times or amounts as current when we cannot verify them."

    def _precautions(self,language:str="es")->List[str]:
        if language=="en":
            return ["Check the recipient's information before confirming.","Never share passwords, CVV, login information or security codes with this app.","The transfer is completed on the provider's official website."]
        return ["Revisa los datos de la persona que recibirá el dinero antes de confirmar.","Nunca compartas aquí contraseñas, CVV, claves de acceso ni códigos de seguridad.","El envío se completa en la página oficial de la remesadora."]

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        if provider_id not in self.candidate_provider_ids(country):raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_found")
        state["selected_option"]=deepcopy(option)
        state["delivery_method"]=option.get("delivery_method") or state.get("delivery_method")
        state["payment_method"]=option.get("payment_method") or state.get("payment_method")
        state["current_step"]="final_check"
        state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=self.country_name(request.destination_country,language)
        labels={
            "destination":{"es":"País de destino","en":"Destination country"},
            "amount":{"es":"Cantidad a enviar","en":"Amount to send"},
            "currency":{"es":"Moneda","en":"Currency"},
            "delivery_method":{"es":"Cómo recibirá el dinero","en":"How the money will be received"},
            "fee":{"es":"Comisión","en":"Fee"},
            "exchange_rate":{"es":"Tasa de cambio","en":"Exchange rate"},
            "recipient_amount":{"es":"Cantidad que recibiría","en":"Recipient gets"}
        }
        checks=[
            {"id":"destination","label":labels["destination"][language],"value":country,"complete":bool(request.destination_country) and self.country_supported(request.destination_country),"status":"ok" if request.destination_country and self.country_supported(request.destination_country) else "review"},
            {"id":"amount","label":labels["amount"][language],"value":f"{request.amount:.2f} {request.send_currency}","complete":request.amount>0,"status":"ok" if request.amount>0 else "review"},
            {"id":"currency","label":labels["currency"][language],"value":request.send_currency,"complete":bool(request.send_currency),"status":"ok" if request.send_currency else "review"},
            {"id":"delivery_method","label":labels["delivery_method"][language],"value":request.delivery_method or ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok"},
            {"id":"fee","label":labels["fee"][language],"value":request.fee if request.fee is not None else ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok" if request.fee is not None else "review"},
            {"id":"exchange_rate","label":labels["exchange_rate"][language],"value":request.exchange_rate if request.exchange_rate is not None else ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok" if request.exchange_rate is not None else "review"},
            {"id":"recipient_amount","label":labels["recipient_amount"][language],"value":request.recipient_amount if request.recipient_amount is not None else ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok" if request.recipient_amount is not None else "review"}
        ]
        valid=all(x["complete"] for x in checks if x["id"] in {"destination","amount","currency"})
        if session_id in self.sessions:
            self.sessions[session_id]["final_check"]={"checks":deepcopy(checks),"valid":valid}
            self.sessions[session_id]["current_step"]="final_check"
            self.sessions[session_id]["updated_at"]=self.now()
        return {
            "success":True,
            "ready_to_continue":valid,
            "language":language,
            "provider_id":request.provider_id,
            "checks":checks,
            "message":self._final_message(language,valid),
            "precautions":self._precautions(language),
            "requirements":self.provider_requirements(request.provider_id,language)
        }

    def _final_message(self,language:str,valid:bool)->str:
        if language=="en":
            return "Everything we need is ready. The provider will show the final amount and conditions before you send." if valid else "Please review the information before continuing."
        return "Todo lo necesario está listo. La remesadora te mostrará la cantidad y las condiciones finales antes de enviar." if valid else "Revisa la información antes de continuar."

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:return []
        requirements=provider.get("requirements",[])
        result=[]
        if isinstance(requirements,list):
            for item in requirements:
                text=self.localize(item,language)
                if text:result.append(text)
        return result

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        guidance=self.brain.get("help_center",{})
        topics=guidance.get("topics",[]) if isinstance(guidance,dict) else []
        if not topics:
            topics=[
                {"id":"exchange_rate","label":{"es":"¿Qué es la tasa de cambio?","en":"What is an exchange rate?"},"answer":{"es":"Es la relación entre el dinero que envías y el dinero que recibe la otra persona.","en":"It is the relationship between the money you send and the money the other person receives."}},
                {"id":"fee","label":{"es":"¿Qué es una comisión?","en":"What is a fee?"},"answer":{"es":"Es un cargo que puede cobrar la remesadora por hacer el envío.","en":"It is a charge the provider may apply for the transfer."}},
                {"id":"recipient_amount","label":{"es":"¿Por qué puede recibir menos?","en":"Why might the person receive less?"},"answer":{"es":"La comisión y la tasa de cambio pueden cambiar la cantidad final.","en":"The fee and exchange rate can affect the final amount."}},
                {"id":"mistake","label":{"es":"¿Qué hago si me equivoqué?","en":"What if I made a mistake?"},"answer":{"es":"No confirmes. Revisa los datos antes de enviar. Si necesitas ayuda específica, podemos llevarte a la información oficial de la remesadora.","en":"Do not confirm. Review the information before sending. If you need specific help, we can take you to the provider's official information."}},
                {"id":"security","label":{"es":"¿Qué información no debo poner aquí?","en":"What should I not enter here?"},"answer":{"es":"No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"Do not enter passwords, CVV numbers, security codes or login credentials."}}
            ]
        return [{"id":x.get("id"),"label":self.localize(x.get("label"),language),"answer":self.localize(x.get("answer"),language)} for x in topics if isinstance(x,dict)]

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        lang=language if language in ("es","en") else "es"
        responses={
            "remittance":{"es":"Te ayudo a preparar un envío de dinero. Dime cuánto quieres enviar y a qué país.","en":"I can help you prepare a money transfer. Tell me how much you want to send and which country."},
            "money_available":{"es":"Podemos calcular cuánto dinero tienes disponible después de tus gastos, ahorro y envíos.","en":"We can calculate how much money you have available after expenses, savings and transfers."},
            "budget":{"es":"Podemos ordenar tu dinero para que sepas cuánto tienes, cuánto gastas y cuánto puedes guardar.","en":"We can organize your money so you know what you have, what you spend and what you can save."},
            "expenses":{"es":"Podemos revisar tus gastos y encontrar los pequeños gastos que se van acumulando.","en":"We can review your spending and find small expenses that add up."},
            "savings":{"es":"Podemos calcular cuánto puedes guardar y para qué quieres guardarlo.","en":"We can calculate how much you can save and what you want to save for."},
            "purchase":{"es":"Podemos revisar una compra antes de hacerla para saber cómo afecta tu dinero.","en":"We can review a purchase before you make it to see how it affects your money."},
            "family":{"es":"Podemos ayudarte a organizar el dinero que quieres dedicar a tu familia.","en":"We can help you organize the money you want to set aside for family."},
            "requirements":{"es":"Si no tengo el requisito comprobado, no lo invento. Te llevo a la información oficial de la remesadora.","en":"If I cannot verify a requirement, I will not guess. I will take you to the provider's official information."},
            "personal_information":{"es":"No necesitamos contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"We do not need passwords, CVV numbers, security codes or login credentials."},
            "fees":{"es":"Podemos explicarte qué es una comisión. Si necesitas el cargo actual y no está comprobado, te llevamos a la información oficial.","en":"We can explain what a fee means. If you need the current charge and it is not verified, we take you to the official information."},
            "exchange_rate":{"es":"La tasa de cambio indica cuánto dinero recibe la otra persona en su moneda. Si no tenemos la tasa actual comprobada, no la inventamos.","en":"The exchange rate shows how much the other person receives in their currency. If we cannot verify the current rate, we will not guess."},
            "delivery":{"es":"Podemos explicar las formas de recibir el dinero. Si necesitas el tiempo exacto y no está comprobado, te llevamos a la información oficial.","en":"We can explain the ways money can be received. If you need the exact delivery time and it is not verified, we take you to the official information."},
            "provider_difference":{"es":"Te explicamos las diferencias que realmente pueden ayudarte a elegir. No necesitas conocer palabras técnicas.","en":"We explain the differences that can actually help you choose. You do not need to know technical words."},
            "mistake_prevention":{"es":"Si detectas un error, no confirmes el envío. Corrige los datos primero.","en":"If you find a mistake, do not confirm the transfer. Correct the information first."},
            "cancellation":{"es":"La cancelación depende de la remesadora y del estado del envío. Si necesitas hacerlo, te llevamos a la información oficial correspondiente.","en":"Cancellation depends on the provider and transfer status. If you need to do it, we can take you to the appropriate official information."},
            "recipient_information":{"es":"Revisa el nombre y los datos de la persona que recibirá el dinero antes de confirmar.","en":"Review the recipient's name and information before confirming."},
            "security":{"es":"Nunca escribas aquí contraseñas, CVV, códigos de seguridad ni credenciales.","en":"Never enter passwords, CVV numbers, security codes or credentials here."},
            "other":{"es":"No tienes que saber cómo hacerlo. Cuéntame con tus propias palabras qué necesitas y te ayudo.","en":"You do not need to know how to do it. Tell me in your own words what you need and I will help."}
        }
        msg=responses.get(need_type,responses["other"])[lang]
        return {"success":True,"need_type":need_type,"message":msg,"language":lang,"remittance_required":need_type=="remittance","next_step":"amount" if need_type=="remittance" else "assistant"}

    def calculate_money_plan(self,income:float=0,essential:float=0,flexible:float=0,savings:float=0,remittance:float=0)->Dict[str,Any]:
        values={"income":max(float(income or 0),0),"essential":max(float(essential or 0),0),"flexible":max(float(flexible or 0),0),"savings":max(float(savings or 0),0),"remittance":max(float(remittance or 0),0)}
        available=round(values["income"]-values["essential"]-values["flexible"]-values["savings"]-values["remittance"],2)
        return {**values,"available":available,"negative_warning":available<0,"currency":"USD","informational":True}

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        opening=self.brain.get("opening",{})
        priorities=[]
        raw=opening.get("priorities",[])
        if isinstance(raw,list):
            for item in raw:
                if isinstance(item,dict):
                    priorities.append({"id":item.get("id"),"icon":item.get("icon",""),"label":self.localize(item.get("label"),language),"why":self.localize(item.get("why"),language)})
                elif isinstance(item,str):priorities.append({"id":item,"icon":"","label":item,"why":""})
        countries=[]
        for item in self.get_supported_countries():
            countries.append({"id":item["code"],"code":item["code"],"name":self.localize(item["name"],language) or item["code"]})
        providers=[]
        for p in self.get_provider_registry():
            providers.append(self.human_provider_option(p,"",language))
        messages={}
        for k,v in self.brain.get("messages",{}).items():messages[k]=self.localize(v,language)
        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "purpose":{
                "es":"Te ayudamos a entender, preparar y organizar tus envíos de dinero sin palabras complicadas.",
                "en":"We help you understand, prepare and organize your money transfers without complicated words."
            },
            "opening":{
                "title":self.localize(opening.get("title") or {"es":"REMESAS","en":"REMITTANCES"},language),
                "subtitle":self.localize(opening.get("subtitle"),language) or ("Te ayudamos a entender y preparar tus envíos de dinero." if language=="es" else "We help you understand and prepare your money transfers."),
                "welcome":self.localize(opening.get("welcome"),language),
                "primary_question":self.localize(opening.get("primary_question"),language) or ("¿QUÉ NECESITAS HOY?" if language=="es" else "WHAT DO YOU NEED TODAY?"),
                "secondary_text":self.localize(opening.get("secondary_text"),language) or ("No necesitas saber de bancos ni de tecnología. Nosotros te ayudamos paso a paso." if language=="es" else "You do not need to know banking or technology. We help you step by step."),
                "amount":deepcopy(opening.get("amount",{})),
                "priorities":priorities,
                "free_text":deepcopy(opening.get("free_text",{})),
                "start":self.localize(opening.get("start"),language) or ("COMENZAR" if language=="es" else "START"),
                "language":"EN" if language=="es" else "ES"
            },
            "conversation_logic":deepcopy(self.brain.get("conversation_logic",{})),
            "remittance_flow":deepcopy(self.brain.get("remittance_flow",{})),
            "countries":countries,
            "providers":providers,
            "messages":messages,
            "help_topics":self.help_topics(language),
            "provider_comparison":deepcopy(self.brain.get("provider_comparison",self.brain.get("comparison",{}))),
            "provider_handoff":deepcopy(self.brain.get("provider_handoff",{})),
            "money_planner":deepcopy(self.brain.get("money_planner",{})),
            "money_box":deepcopy(self.brain.get("money_box",{})),
            "security":deepcopy(self.brain.get("security",{})),
            "privacy":deepcopy(self.brain.get("data_privacy",{}))
        }

engine=RemittanceEngine()
