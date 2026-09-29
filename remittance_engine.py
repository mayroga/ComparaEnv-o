import json,re,uuid,unicodedata
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
            for key in ("label","name","title","text","id"):
                if key in value:return self.localize(value[key],language)
        if isinstance(value,list):return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:return self.localize(self.brain.get("messages",{}).get(key,{}),language)
    def _message(self,key:str,language:str="es")->str:return self.language_text(key,language)

    def get_supported_countries(self)->List[Dict[str,Any]]:
        countries=self.brain.get("countries",{})
        supported=countries.get("supported")
        if not isinstance(supported,list):supported=countries.get("initial_supported",[])
        names=countries.get("country_names",{})
        result=[]
        for item in supported or []:
            if isinstance(item,dict):
                code=str(item.get("code") or item.get("id") or "").upper().strip()
                if code:result.append({"code":code,"name":deepcopy(item.get("name") or names.get(code,{ "es":code,"en":code }))})
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

    def provider_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if isinstance(urls,dict):
            keys=["us_send_es","us_es","es","home","main"] if language=="es" else ["us_send","us_en","en","home","main"]
            for key in keys:
                value=urls.get(key)
                if isinstance(value,str) and value.startswith(("http://","https://")):return value
        for key in ("official_site","official_url"):
            value=provider.get(key)
            if isinstance(value,str) and value.startswith(("http://","https://")):return value
        return None

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

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        verified=self.commercial_verified(commercial)
        return {
            "provider_id":provider.get("id"),
            "provider_name":provider.get("name",provider.get("id","")),
            "enabled":bool(provider.get("enabled",True)),
            "country":str(country or "").upper(),
            "country_name":self.country_name(country,language),
            "commercial_status":"verified" if verified else "unavailable",
            "commercial_verified":verified,
            "fee":commercial.get("fee") if verified else None,
            "exchange_rate":commercial.get("exchange_rate") if verified else None,
            "recipient_amount":commercial.get("recipient_amount") if verified else None,
            "delivery_time":commercial.get("delivery_time") if verified else None,
            "currency":commercial.get("currency") if verified else None,
            "delivery_method":commercial.get("delivery_method") if verified else None,
            "payment_method":commercial.get("payment_method") if verified else None,
            "important_condition":commercial.get("important_condition") if verified else None,
            "source":commercial.get("source") if verified else None,
            "verified_at":commercial.get("verified_at") if verified else None,
            "continue_url":self.provider_url(provider,language),
            "official_site":provider.get("official_site") or self.provider_url(provider,language),
            "supports_online":provider.get("supports_online",True),
            "supports_agent":provider.get("supports_agent",False),
            "payment_methods":deepcopy(provider.get("payment_methods",[])),
            "delivery_methods":deepcopy(provider.get("delivery_methods",[])),
            "requirements":deepcopy(provider.get("requirements",[]))
        }

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

    def clear_session(self,session_id:str)->bool:return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        value=str(text or "")
        matches=re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",value,re.I)
        for raw in matches:
            try:
                n=float(raw.replace(",",""))
                if n>0:return n
            except ValueError:pass
        words={
            "cien":100,"doscientos":200,"trescientos":300,"cuatrocientos":400,"quinientos":500,
            "seiscientos":600,"setecientos":700,"ochocientos":800,"novecientos":900,
            "mil":1000
        }
        normalized=self.normalize_text(value)
        for word,n in words.items():
            if re.search(r"\b"+word+r"\b",normalized):return float(n)
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=self.normalize_text(text)
        aliases={
            "mexico":"MX","mexican":"MX","mexicana":"MX","guatemala":"GT","el salvador":"SV","salvador":"SV",
            "honduras":"HN","nicaragua":"NI","costa rica":"CR","panama":"PA","republica dominicana":"DO","dominicana":"DO",
            "colombia":"CO","venezuela":"VE","ecuador":"EC","peru":"PE","bolivia":"BO","paraguay":"PY","brasil":"BR",
            "brazil":"BR","chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU","haiti":"HT"
        }
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
        patterns=[
            ("recipient_gets_more",["reciba mas","recibir mas","receive more","mas dinero","more money"]),
            ("fastest",["rapido","fast","quick","speed","lo antes posible"]),
            ("urgent",["urgente","urgent","hoy","today","ahora","now","asap"]),
            ("save",["ahorrar","ahorro","save","cheap","barato","menos costo","menor costo"]),
            ("balanced",["equilibrio","balance","balanced"]),
            ("compare_all",["comparar","compare","comparacion","opciones","options"])
        ]
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
        return {
            "need_type":classification["need_type"],
            "amount":self._amount_from_text(text),
            "destination_country":self._country_from_text(text),
            "priority":priority,
            "urgency":True if priority=="urgent" else None,
            "frequency":self._frequency_from_text(text),
            "delivery_method":None,
            "payment_method":None,
            "language":language,
            "raw_text":text
        }

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
            provider_id=provider.get("id",""),provider_name=provider.get("name",provider.get("id","")),
            amount_sent=request.amount,send_currency=request.send_currency,fee=commercial.get("fee"),
            exchange_rate=commercial.get("exchange_rate"),recipient_amount=commercial.get("recipient_amount"),
            delivery_method=commercial.get("delivery_method"),payment_method=commercial.get("payment_method"),
            estimated_delivery=commercial.get("delivery_time"),recipient_currency=commercial.get("currency"),
            availability=True,important_condition=commercial.get("important_condition"),
            requirements=deepcopy(commercial.get("requirements",[])) if isinstance(commercial.get("requirements",[]),list) else [],
            source=commercial.get("source"),verified_at=commercial.get("verified_at"),status="verified",
            continue_url=self.provider_url(provider,language)
        )

    def _differences(self,available:List[Dict[str,Any]],language:str)->List[Dict[str,Any]]:
        dimensions=[
            ("payment_methods","Métodos de pago","Payment methods"),
            ("delivery_methods","Formas de entrega","Delivery methods"),
            ("supports_online","Disponible en línea","Available online"),
            ("supports_agent","Atención en agente","Agent service")
        ]
        differences=[]
        for key,es,en in dimensions:
            values=[]
            for p in available:
                value=p.get(key)
                if value is not None and value!=[]:
                    values.append({"provider_id":p.get("provider_id"),"provider_name":p.get("provider_name"),"value":value})
            if values:differences.append({"id":key,"label":en if language=="en" else es,"values":values})
        return differences

    def compare_session(self,session_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        if not state.get("amount"):raise ValueError("Amount is required.")
        if not state.get("destination_country"):raise ValueError("Destination country is required.")
        request=ComparisonRequest(
            amount=state["amount"],destination_country=state["destination_country"],priority=state.get("priority"),
            urgency=state.get("urgency"),delivery_method=state.get("delivery_method"),
            payment_method=state.get("payment_method"),language=state.get("language","es"),
            send_currency=state.get("send_currency","USD"),recipient_amount_target=None,special_need=state.get("special_need")
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
        differences=self._differences(available,language)
        if session_id in self.sessions:
            state=self.sessions[session_id]
            state["candidate_providers"]=[x["provider_id"] for x in available]
            state["available_providers"]=deepcopy(available)
            state["verified_results"]=[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results]
            state["current_step"]="results";state["updated_at"]=self.now()
        verified=bool(verified_results)
        message=self._message("results_ready",language) if verified else self._message("no_results",language)
        if not message:
            message="Opciones verificadas disponibles." if verified else "Estas plataformas están disponibles, pero los datos comerciales actuales no están verificados."
        return {
            "success":True,"message":message,
            "results":[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results],
            "available_providers":available,"provider_count":len(available),"verified_count":len(verified_results),
            "results_available":verified,"destination_country":country,"destination_name":self.country_name(country,language),
            "amount":request.amount,"send_currency":request.send_currency,"priority":request.priority,
            "urgency":request.urgency,"language":language,
            "explanation":self.comparison_explanation(language,verified),"differences":differences,
            "precautions":self._precautions(language)
        }

    def comparison_explanation(self,language:str="es",verified:bool=False)->str:
        if verified:return "Los datos marcados como verificados tienen fuente y fecha de verificación. Revísalos antes de continuar." if language=="es" else "Data marked as verified has a source and verification date. Review it before continuing."
        return "No se muestran tarifas, tasas, tiempos ni cantidades como datos actuales cuando no están verificadas." if language=="es" else "Fees, rates, delivery times and recipient amounts are not shown as current facts when they are not verified."

    def _precautions(self,language:str="es")->List[str]:
        if language=="en":
            return ["Fees and exchange rates can change before you complete a transfer.","Review recipient information before confirming.","Never share passwords, CVV, login credentials or security codes with this app.","The transfer is completed on the provider's official website."]
        return ["Las comisiones y tasas de cambio pueden cambiar antes de completar el envío.","Revisa los datos del destinatario antes de confirmar.","Nunca compartas con esta aplicación contraseñas, CVV, claves de acceso ni códigos de seguridad.","El envío se completa en el sitio oficial del proveedor."]

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        if provider_id not in self.candidate_provider_ids(country):raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_found")
        state["selected_option"]=deepcopy(option);state["current_step"]="final_check";state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=self.country_name(request.destination_country,language)
        labels={
            "destination":{"es":"País de destino","en":"Destination country"},
            "amount":{"es":"Cantidad a enviar","en":"Amount to send"},
            "currency":{"es":"Moneda del envío","en":"Sending currency"},
            "delivery_method":{"es":"Forma de entrega","en":"Delivery method"},
            "recipient_information":{"es":"Datos del destinatario","en":"Recipient information"},
            "fee":{"es":"Comisión","en":"Fee"},
            "exchange_rate":{"es":"Tasa de cambio","en":"Exchange rate"},
            "recipient_amount":{"es":"Cantidad que recibiría","en":"Recipient amount"}
        }
        checks=[
            {"id":"destination","label":labels["destination"][language],"value":country,"complete":bool(request.destination_country) and self.country_supported(request.destination_country),"status":"ok" if request.destination_country and self.country_supported(request.destination_country) else "review"},
            {"id":"amount","label":labels["amount"][language],"value":f"{request.amount:.2f} {request.send_currency}","complete":request.amount>0,"status":"ok" if request.amount>0 else "review"},
            {"id":"currency","label":labels["currency"][language],"value":request.send_currency,"complete":bool(request.send_currency),"status":"ok" if request.send_currency else "review"},
            {"id":"delivery_method","label":labels["delivery_method"][language],"value":request.delivery_method or ("Not selected" if language=="en" else "No seleccionada"),"complete":bool(request.delivery_method),"status":"ok" if request.delivery_method else "review"},
            {"id":"recipient_information","label":labels["recipient_information"][language],"value":"Review on provider site" if language=="en" else "Revisar en el proveedor","complete":True,"status":"review"},
            {"id":"fee","label":labels["fee"][language],"value":request.fee if request.fee is not None else ("Not verified" if language=="en" else "No verificada"),"complete":request.fee is not None,"status":"ok" if request.fee is not None else "review"},
            {"id":"exchange_rate","label":labels["exchange_rate"][language],"value":request.exchange_rate if request.exchange_rate is not None else ("Not verified" if language=="en" else "No verificada"),"complete":request.exchange_rate is not None,"status":"ok" if request.exchange_rate is not None else "review"},
            {"id":"recipient_amount","label":labels["recipient_amount"][language],"value":request.recipient_amount if request.recipient_amount is not None else ("Not verified" if language=="en" else "No verificada"),"complete":request.recipient_amount is not None,"status":"ok" if request.recipient_amount is not None else "review"}
        ]
        valid=all(x["complete"] for x in checks if x["id"] in {"destination","amount","currency","delivery_method"})
        if session_id in self.sessions:
            self.sessions[session_id]["final_check"]={"checks":deepcopy(checks),"valid":valid}
            self.sessions[session_id]["current_step"]="final_check";self.sessions[session_id]["updated_at"]=self.now()
        return {"success":True,"ready_to_continue":valid,"language":language,"provider_id":request.provider_id,"checks":checks,"message":self._final_message(language,valid),"precautions":self._precautions(language),"requirements":self.provider_requirements(request.provider_id,language)}

    def _final_message(self,language:str,valid:bool)->str:
        if language=="en":return "The basic information is ready. Review the provider's final terms before continuing." if valid else "Review the missing information before continuing."
        return "La información básica está lista. Revisa las condiciones finales del proveedor antes de continuar." if valid else "Revisa la información que falta antes de continuar."

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:return []
        requirements=provider.get("requirements",[])
        result=[]
        if isinstance(requirements,list):
            for item in requirements:
                text=item if isinstance(item,str) else self.localize(item,language)
                if text:result.append(text)
        return result

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        guidance=self.brain.get("help_center",{})
        topics=guidance.get("topics",[]) if isinstance(guidance,dict) else []
        if not topics:
            topics=[
                {"id":"exchange_rate","label":{"es":"¿Qué es la tasa de cambio?","en":"What is an exchange rate?"},"answer":{"es":"Es la relación entre la moneda que envías y la moneda que recibe la otra persona.","en":"It is the relationship between the currency you send and the currency the other person receives."}},
                {"id":"fee","label":{"es":"¿Qué es una comisión?","en":"What is a fee?"},"answer":{"es":"Es un cargo que puede aplicar el proveedor por el servicio.","en":"It is a charge the provider may apply for the service."}},
                {"id":"recipient_amount","label":{"es":"¿Por qué recibe menos?","en":"Why does the recipient receive less?"},"answer":{"es":"La comisión y la tasa de cambio pueden afectar la cantidad final.","en":"The fee and exchange rate can affect the final amount."}},
                {"id":"mistake","label":{"es":"¿Qué hago si me equivoqué?","en":"What if I made a mistake?"},"answer":{"es":"No confirmes todavía. Revisa los datos y consulta al proveedor antes de completar el envío.","en":"Do not confirm yet. Review the information and contact the provider before completing the transfer."}},
                {"id":"security","label":{"es":"¿Qué información no debo compartir aquí?","en":"What information should I not share here?"},"answer":{"es":"No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"Do not enter passwords, CVV numbers, security codes or login credentials."}}
            ]
        return [{"id":x.get("id"),"label":self.localize(x.get("label"),language),"answer":self.localize(x.get("answer"),language)} for x in topics if isinstance(x,dict)]

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        lang=language if language in ("es","en") else "es"
        responses={
            "remittance":{"es":"Para comparar un envío necesito la cantidad y el país de destino. Después revisamos las opciones disponibles.","en":"To compare a transfer, I need the amount and destination country. Then we review the available options."},
            "money_available":{"es":"Podemos calcular cuánto dinero tienes disponible después de tus gastos, ahorro y envíos.","en":"We can calculate how much money you have left after expenses, savings and transfers."},
            "budget":{"es":"Podemos organizar tus ingresos, gastos, ahorro, compras y remesas para saber qué te queda.","en":"We can organize your income, expenses, savings, purchases and transfers to see what remains."},
            "expenses":{"es":"Podemos registrar tus gastos y detectar los pequeños gastos que se acumulan.","en":"We can record your expenses and identify small spending that adds up."},
            "savings":{"es":"Podemos calcular cuánto puedes guardar y para qué quieres guardarlo.","en":"We can calculate how much you can save and what you want to save for."},
            "purchase":{"es":"Podemos revisar una compra antes de hacerla y ver cómo afecta tu dinero disponible.","en":"We can review a purchase before you make it and see how it affects your available money."},
            "family":{"es":"Puedes organizar dinero para tu familia sin que esta aplicación haga el envío ni guarde tus credenciales.","en":"You can organize money for family without this app making the transfer or storing your credentials."},
            "requirements":{"es":"Los requisitos pueden cambiar según proveedor, país, cantidad y método. Revisa siempre al proveedor.","en":"Requirements can change by provider, country, amount and method. Always review the provider's requirements."},
            "personal_information":{"es":"No necesitamos contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"We do not need passwords, CVV numbers, security codes or login credentials."},
            "fees":{"es":"La comisión es un cargo que puede aplicar el proveedor. Revisa el cargo final.","en":"A fee is a charge the provider may apply. Review the final charge."},
            "exchange_rate":{"es":"La tasa de cambio relaciona la moneda que envías con la moneda que recibe la otra persona.","en":"The exchange rate relates the currency you send to the currency the recipient receives."},
            "delivery":{"es":"El tiempo depende del proveedor, país, método y condiciones del envío.","en":"Timing depends on the provider, country, method and transfer conditions."},
            "provider_difference":{"es":"Podemos comparar comisión, tasa, cantidad recibida, velocidad, entrega, pago y requisitos cuando los datos estén verificados.","en":"We can compare fees, rates, recipient amount, speed, delivery, payment and requirements when data is verified."},
            "mistake_prevention":{"es":"Si detectas un error, no confirmes. Corrige los datos antes de continuar.","en":"If you find an error, do not confirm. Correct the information before continuing."},
            "cancellation":{"es":"La cancelación depende del proveedor y del estado del envío.","en":"Cancellation depends on the provider and transfer status."},
            "recipient_information":{"es":"Revisa los datos del destinatario antes de confirmar.","en":"Review recipient information before confirming."},
            "security":{"es":"Nunca escribas aquí contraseñas, CVV, códigos de seguridad ni credenciales.","en":"Never enter passwords, CVV numbers, security codes or credentials here."},
            "other":{"es":"Dime qué necesitas. Podemos trabajar con envíos, gastos, ahorro, compras, familia o dinero disponible.","en":"Tell me what you need. We can work with transfers, expenses, savings, purchases, family or available money."}
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
            countries.append({"id":item["code"],"code":item["code"],"name":self.localize(item["name"],language) or item["code"],"currency":"USD"})
        providers=[]
        for p in self.get_provider_registry():
            providers.append({
                "id":p.get("id"),"name":p.get("name"),"enabled":bool(p.get("enabled",True)),
                "continue_url":self.provider_url(p,language),"official_site":p.get("official_site") or self.provider_url(p,language),
                "payment_methods":deepcopy(p.get("payment_methods",[])),"delivery_methods":deepcopy(p.get("delivery_methods",[]))
            })
        delivery=[]
        payment=[]
        for key,target in (("delivery_methods",delivery),("payment_methods",payment)):
            raw=self.brain.get(key,[])
            if isinstance(raw,list):
                for x in raw:
                    if isinstance(x,dict):target.append({"id":x.get("id"),"label":self.localize(x.get("label") or x.get("name") or x.get("id"),language)})
        messages={}
        for k,v in self.brain.get("messages",{}).items():messages[k]=self.localize(v,language)
        return {
            "app":deepcopy(self.brain.get("app",{})),"language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{
                "title":self.localize(opening.get("title") or {"es":"REMESAS","en":"REMITTANCES"},language),
                "subtitle":self.localize(opening.get("subtitle"),language),
                "welcome":self.localize(opening.get("welcome"),language),
                "primary_question":self.localize(opening.get("primary_question"),language) or ("¿QUÉ NECESITAS HOY?" if language=="es" else "WHAT DO YOU NEED TODAY?"),
                "secondary_text":self.localize(opening.get("secondary_text"),language) or self.localize(opening.get("subtitle"),language),
                "amount":deepcopy(opening.get("amount",{})),
                "priorities":priorities,
                "free_text":deepcopy(opening.get("free_text",{})),
                "start":self.localize(opening.get("start"),language) or ("COMENZAR" if language=="es" else "START"),
                "language":"EN" if language=="es" else "ES"
            },
            "conversation_logic":deepcopy(self.brain.get("conversation_logic",{})),
            "remittance_flow":deepcopy(self.brain.get("remittance_flow",{})),
            "countries":countries,"providers":providers,"delivery_methods":delivery,"payment_methods":payment,
            "messages":messages,"help_topics":self.help_topics(language),
            "provider_comparison":deepcopy(self.brain.get("provider_comparison",self.brain.get("comparison",{}))),
            "provider_handoff":deepcopy(self.brain.get("provider_handoff",{})),
            "money_planner":deepcopy(self.brain.get("money_planner",{})),
            "money_box":deepcopy(self.brain.get("money_box",{})),
            "security":deepcopy(self.brain.get("security",{})),
            "privacy":deepcopy(self.brain.get("data_privacy",{}))
        }

engine=RemittanceEngine()
