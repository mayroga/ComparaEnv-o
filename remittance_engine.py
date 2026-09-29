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
        if not path.exists():
            raise FileNotFoundError(f"Required data file not found: {path}")
        with path.open("r",encoding="utf-8") as f:
            data=json.load(f)
        if not isinstance(data,dict):
            raise ValueError(f"Invalid JSON root in {path.name}")
        return data

    def load_brain(self)->Dict[str,Any]:
        data=self._read_json(BRAIN_PATH)
        required=["app","experience","opening","conversation_logic","kernel","providers","countries","comparison","validation","security","languages"]
        missing=[x for x in required if x not in data]
        if missing:
            raise ValueError("Invalid app_brain.json. Missing sections: "+", ".join(missing))
        return data

    def load_providers(self)->Dict[str,Any]:
        if not PROVIDERS_PATH.exists():
            return {
                "version":"fallback",
                "providers":deepcopy(self.brain.get("providers",[])),
                "corridors":{"origin":"US","destinations":{}}
            }
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):
            data["providers"]=[]
        if not isinstance(data.get("corridors"),dict):
            data["corridors"]={"origin":"US","destinations":{}}
        if not isinstance(data["corridors"].get("destinations"),dict):
            data["corridors"]["destinations"]={}
        return data

    def now(self)->str:
        return datetime.now(timezone.utc).isoformat()

    def localize(self,value:Any,language:str="es")->str:
        if value is None:
            return ""
        if isinstance(value,(str,int,float,bool)):
            return str(value)
        if isinstance(value,dict):
            if language in value:
                return self.localize(value[language],language)
            fallback="es" if language!="es" else "en"
            if fallback in value:
                return self.localize(value[fallback],fallback)
            if "label" in value:
                return self.localize(value["label"],language)
            if "name" in value:
                return self.localize(value["name"],language)
            if "id" in value:
                return str(value["id"])
        if isinstance(value,list):
            return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        messages=self.brain.get("messages",{})
        value=messages.get(key,{}) if isinstance(messages,dict) else {}
        return self.localize(value,language)

    def _message(self,key:str,language:str="es")->str:
        return self.language_text(key,language)

    def get_supported_countries(self)->List[Dict[str,Any]]:
        countries=self.brain.get("countries",{})
        supported=countries.get("supported",[])
        result=[]
        if isinstance(supported,list):
            for item in supported:
                if isinstance(item,dict):
                    code=str(item.get("code","")).upper().strip()
                    if code:
                        result.append({
                            "code":code,
                            "name":deepcopy(item.get("name",{"es":code,"en":code}))
                        })
                elif isinstance(item,str):
                    code=item.upper().strip()
                    if code:
                        result.append({"code":code,"name":{"es":code,"en":code}})
        return result

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        if not code:
            return None
        for item in self.get_supported_countries():
            if str(item.get("code","")).upper()==code:
                return item
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        if isinstance(destinations,dict):
            value=destinations.get(code)
            if isinstance(value,dict):
                return value
        return None

    def country_name(self,country_code:str,language:str="es")->str:
        code=(country_code or "").strip().upper()
        value=self.get_country(code)
        if not value:
            return code
        if "name" in value:
            name=self.localize(value.get("name"),language)
        else:
            name=self.localize(value,language)
        return name or code

    def country_supported(self,country_code:str)->bool:
        code=(country_code or "").strip().upper()
        return any(str(x.get("code","")).upper()==code for x in self.get_supported_countries())

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not isinstance(providers,list) or not providers:
            providers=self.brain.get("providers",[])
        result=[]
        seen=set()
        for provider in providers:
            if not isinstance(provider,dict):
                continue
            pid=str(provider.get("id","")).strip().lower()
            if not pid or pid in seen:
                continue
            if not bool(provider.get("enabled",True)):
                continue
            seen.add(pid)
            result.append(deepcopy(provider))
        return result

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=(provider_id or "").strip().lower()
        for provider in self.get_provider_registry():
            if str(provider.get("id","")).lower()==pid:
                return provider
        return None

    def provider_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if isinstance(urls,dict):
            preferred=["us_send_es","us_es","es","home","main"] if language=="es" else ["us_send","us_en","en","home","main"]
            for key in preferred:
                value=urls.get(key)
                if isinstance(value,str) and value.startswith(("http://","https://")):
                    return value
        for key in ("official_url","official_site"):
            value=provider.get(key)
            if isinstance(value,str):
                if value.startswith("http://") or value.startswith("https://"):
                    return value
        return None

    def corridor_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        if not isinstance(destinations,dict):
            destinations={}
        corridor=destinations.get(code,{})
        if isinstance(corridor,dict):
            ids=corridor.get("providers",[])
            if isinstance(ids,list) and ids:
                valid=[]
                for pid in ids:
                    if self.get_provider(str(pid)):
                        valid.append(str(pid))
                if valid:
                    return valid
        return [str(p.get("id")) for p in self.get_provider_registry() if p.get("id")]

    def candidate_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        if not self.country_supported(code):
            return []
        return self.corridor_provider_ids(code)

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:
            return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):
            return None
        status=str(commercial.get("status","")).lower()
        if status!="verified" or not commercial.get("source") or not commercial.get("verified_at"):
            return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=(country or "").upper()
        return result

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:
            return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):
            commercial={}
        verified=(
            str(commercial.get("status","")).lower()=="verified"
            and bool(commercial.get("source"))
            and bool(commercial.get("verified_at"))
        )
        url=self.provider_url(provider,language)
        return {
            "provider_id":provider.get("id"),
            "provider_name":provider.get("name",provider.get("id","")),
            "enabled":bool(provider.get("enabled",True)),
            "country":(country or "").upper(),
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
            "continue_url":url,
            "official_site":provider.get("official_site") or provider.get("official_url") or url,
            "supports_online":provider.get("supports_online",True),
            "supports_agent":provider.get("supports_agent",False),
            "payment_methods":deepcopy(provider.get("payment_methods",[])),
            "delivery_methods":deepcopy(provider.get("delivery_methods",[])),
            "requirements":deepcopy(provider.get("requirements",[]))
        }

    def _brain_options(self,key:str,language:str="es")->List[Dict[str,Any]]:
        data=self.brain.get(key,[])
        result=[]
        if isinstance(data,list):
            for item in data:
                if isinstance(item,dict):
                    ident=item.get("id") or item.get("code")
                    if ident:
                        result.append({
                            "id":ident,
                            "label":self.localize(item.get("label") or item.get("name") or ident,language)
                        })
        elif isinstance(data,dict):
            for ident,value in data.items():
                result.append({
                    "id":ident,
                    "label":self.localize(value,language) or str(ident)
                })
        return result

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        sid=str(uuid.uuid4())
        state={
            "session_id":sid,
            "language":language,
            "need_type":None,
            "amount":None,
            "send_currency":"USD",
            "destination_country":None,
            "priority":None,
            "urgency":None,
            "frequency":None,
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
            "created_at":self.now(),
            "updated_at":self.now()
        }
        self.sessions[sid]=state
        return deepcopy(state)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        return deepcopy(self.sessions.get(session_id)) if session_id in self.sessions else None

    def update_session(self,session_id:str,**values:Any)->Optional[Dict[str,Any]]:
        state=self.sessions.get(session_id)
        if not state:
            return None
        for key,value in values.items():
            if value is not None:
                state[key]=value
        state["updated_at"]=self.now()
        return deepcopy(state)

    def clear_session(self,session_id:str)->bool:
        return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        matches=re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text or "",re.I)
        for raw in matches:
            try:
                value=float(raw.replace(",",""))
                if value>0:
                    return value
            except ValueError:
                continue
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=(text or "").lower()
        aliases={
            "méxico":"MX","mexico":"MX","mexican":"MX","mexicana":"MX",
            "guatemala":"GT","el salvador":"SV","salvador":"SV",
            "honduras":"HN","nicaragua":"NI","costa rica":"CR",
            "panamá":"PA","panama":"PA","república dominicana":"DO",
            "republica dominicana":"DO","dominicana":"DO","colombia":"CO",
            "venezuela":"VE","ecuador":"EC","perú":"PE","peru":"PE",
            "bolivia":"BO","paraguay":"PY","brasil":"BR","brazil":"BR",
            "chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU",
            "haití":"HT","haiti":"HT"
        }
        for item in self.get_supported_countries():
            code=str(item.get("code","")).lower()
            name=item.get("name",{})
            names=[]
            if isinstance(name,dict):
                names.extend([name.get("es",""),name.get("en","")])
            else:
                names.append(str(name))
            for n in names:
                if n and re.search(r"\b"+re.escape(str(n).lower())+r"\b",normalized):
                    return code.upper()
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",normalized):
                return code
        for item in self.get_supported_countries():
            code=str(item.get("code","")).lower()
            if code and re.search(r"\b"+re.escape(code)+r"\b",normalized):
                return code.upper()
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        patterns=[
            ("recipient_gets_more",["reciba más","reciba mas","receive more","más dinero","mas dinero","more money"]),
            ("fastest",["rápido","rapido","fast","quick","speed","lo antes posible"]),
            ("urgent",["urgente","urgent","hoy","today","ahora","now","asap"]),
            ("save",["ahorrar","ahorro","save","cheap","barato","menos costo","menor costo"]),
            ("balanced",["equilibrio","balance","balanced"]),
            ("compare_all",["comparar","compare","comparación","comparacion","opciones","options"])
        ]
        for priority,terms in patterns:
            if any(term in value for term in terms):
                return priority
        return None

    def _frequency_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        if any(x in value for x in ["cada semana","semanal","weekly"]):
            return "weekly"
        if any(x in value for x in ["cada dos semanas","quincenal","biweekly"]):
            return "biweekly"
        if any(x in value for x in ["cada mes","mensual","monthly"]):
            return "monthly"
        if any(x in value for x in ["una vez","puntual","ocasional","one time","once"]):
            return "one_time"
        return None

    def classify_need(self,text:str,language:str="es")->Dict[str,Any]:
        value=(text or "").strip().lower()
        categories=[
            ("remittance",["enviar dinero","mandar dinero","enviar","mandar","remesa","remesas","transferir","transferencia","send money","remittance","transfer money"]),
            ("money_available",["cuánto puedo gastar","cuanto puedo gastar","dinero disponible","money available","how much can i spend"]),
            ("budget",["presupuesto","organizar mi dinero","organizar dinero","budget","plan my money","planificar mi dinero"]),
            ("expenses",["gastos","gasto","expense","expenses","en qué gasto","en que gasto"]),
            ("savings",["ahorrar","ahorro","save money","savings","guardar dinero"]),
            ("purchase",["comprar","compra","purchase","shopping","quiero comprar"]),
            ("family",["familia","familiar","family","para mi mamá","para mi mama","para mi madre","para mi padre"]),
            ("requirements",["requisito","requisitos","qué necesito","que necesito","documentos","requirements","what do i need"]),
            ("personal_information",["información personal","informacion personal","datos personales","identificación","identificacion","id","personal information"]),
            ("fees",["comisión","comision","tarifa","cargo","fee","fees","costo de envío","costo de envio"]),
            ("exchange_rate",["tasa de cambio","tipo de cambio","exchange rate","cambio"]),
            ("delivery",["cuándo llega","cuando llega","entrega","delivery","tiempo","cuánto tarda","cuanto tarda"]),
            ("provider_difference",["diferencia entre","diferencias","cuál es la diferencia","cual es la diferencia","which is different","difference between"]),
            ("mistake_prevention",["me equivoqué","me equivoque","error","equivoqué","equivoque","mistake","wrong information"]),
            ("cancellation",["cancelar","cancelación","cancelacion","cancel","canceled"]),
            ("recipient_information",["beneficiario","destinatario","recipient","beneficiary","datos del que recibe"]),
            ("security",["seguro","seguridad","estafa","fraude","security","scam","fraud"])
        ]
        for topic,terms in categories:
            if any(term in value for term in terms):
                return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text or ""
        language=request.language if request.language in ("es","en") else "es"
        classification=self.classify_need(text,language)
        priority=self._priority_from_text(text)
        amount=self._amount_from_text(text)
        country=self._country_from_text(text)
        frequency=self._frequency_from_text(text)
        return {
            "need_type":classification["need_type"],
            "amount":amount,
            "destination_country":country,
            "priority":priority,
            "urgency":True if priority=="urgent" else None,
            "frequency":frequency,
            "delivery_method":None,
            "payment_method":None,
            "language":language,
            "raw_text":text
        }

    def _next_step(self,state:Dict[str,Any])->str:
        if not state.get("need_type"):
            return "need"
        if state.get("need_type")!="remittance":
            return "assistant"
        if not state.get("amount"):
            return "amount"
        if not state.get("destination_country"):
            return "destination"
        if state.get("frequency") is None:
            return "frequency"
        if state.get("urgency") is None:
            return "urgency"
        if not state.get("priority"):
            return "priority"
        return "comparison"

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:
            raise KeyError("session_expired")
        values={}
        fields=("amount","destination_country","priority","urgency","frequency","delivery_method","payment_method","special_need","free_text","need_type")
        for field in fields:
            value=getattr(request,field,None)
            if value is not None:
                values[field]=value
        if request.language in ("es","en"):
            values["language"]=request.language
        if request.free_text and not request.need_type:
            values["need_type"]=self.classify_need(request.free_text,request.language).get("need_type","other")
        current=deepcopy(self.sessions[session_id])
        current.update(values)
        current["current_step"]=self._next_step(current)
        updated=self.update_session(session_id,**values)
        if updated:
            updated["current_step"]=current["current_step"]
            self.sessions[session_id]["current_step"]=current["current_step"]
        return updated or {}

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
            requirements=deepcopy(commercial.get("requirements",[])) if isinstance(commercial.get("requirements",[]),list) else [],
            source=commercial.get("source"),
            verified_at=commercial.get("verified_at"),
            status="verified",
            continue_url=self.provider_url(provider,language)
        )

    def _differences(self,available:List[Dict[str,Any]],language:str)->List[Dict[str,Any]]:
        differences=[]
        dimensions=[
            ("payment_methods","payment_method","Métodos de pago","Payment methods"),
            ("delivery_methods","delivery_method","Formas de entrega","Delivery methods"),
            ("supports_online","online","Disponible en línea","Available online"),
            ("supports_agent","agent","Atención en agente","Agent service")
        ]
        for key,dim,es,en in dimensions:
            values=[]
            for p in available:
                value=p.get(key)
                if value:
                    values.append({
                        "provider_id":p.get("provider_id"),
                        "provider_name":p.get("provider_name"),
                        "value":value
                    })
            if values:
                differences.append({
                    "id":dim,
                    "label":en if language=="en" else es,
                    "values":values
                })
        return differences

    def compare_session(self,session_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:
            raise KeyError("session_expired")
        if not state.get("amount"):
            raise ValueError("Amount is required.")
        if not state.get("destination_country"):
            raise ValueError("Destination country is required.")
        request=ComparisonRequest(
            amount=state.get("amount"),
            destination_country=state.get("destination_country"),
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
        country=(request.destination_country or "").strip().upper()
        if request.amount<=0:
            raise ValueError("Amount must be greater than zero.")
        if not country:
            raise ValueError("Destination country is required.")
        if not self.country_supported(country):
            raise ValueError("Destination country is not supported.")

        provider_ids=self.candidate_provider_ids(country)
        available=[]
        verified_results=[]

        for pid in provider_ids:
            public=self.provider_public_option(pid,country,language)
            if public:
                available.append(public)
            commercial=self.get_verified_provider_data(
                pid,country,request.amount,
                request.payment_method,
                request.delivery_method
            )
            provider=self.get_provider(pid)
            if commercial and provider:
                verified_results.append(
                    self._build_verified_result(provider,commercial,request,language)
                )

        verified_ids={x.provider_id for x in verified_results}
        for item in available:
            is_verified=item.get("provider_id") in verified_ids
            item["commercial_status"]="verified" if is_verified else "unavailable"
            item["commercial_verified"]=is_verified

        differences=self._differences(available,language)

        if session_id in self.sessions:
            state=self.sessions[session_id]
            state["candidate_providers"]=[x["provider_id"] for x in available]
            state["available_providers"]=deepcopy(available)
            state["verified_results"]=[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results]
            state["current_step"]="results"
            state["updated_at"]=self.now()

        if verified_results:
            message=self._message("results_ready",language)
            if not message:
                message="Opciones verificadas disponibles." if language=="es" else "Verified options are available."
        else:
            message=self._message("no_results",language)
            if not message:
                message="Los datos comerciales actuales no están verificados. Puedes consultar los sitios oficiales de los cuatro proveedores." if language=="es" else "Current commercial data is not verified. You can consult the official sites of the four providers."

        precautions=self._precautions(language)

        return {
            "success":True,
            "message":message,
            "results":[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results],
            "available_providers":available,
            "provider_count":len(available),
            "verified_count":len(verified_results),
            "results_available":bool(verified_results),
            "destination_country":country,
            "destination_name":self.country_name(country,language),
            "amount":request.amount,
            "send_currency":request.send_currency,
            "priority":request.priority,
            "urgency":request.urgency,
            "language":language,
            "explanation":self.comparison_explanation(language,bool(verified_results)),
            "differences":differences,
            "precautions":precautions
        }

    def comparison_explanation(self,language:str="es",verified:bool=False)->str:
        if verified:
            return "Los datos mostrados como verificados tienen una fuente y fecha de verificación. Revísalos antes de continuar." if language=="es" else "Data marked as verified has a source and verification date. Review it before continuing."
        return "No se muestran tarifas, tasas, tiempos ni cantidades como hechos actuales cuando no están verificadas." if language=="es" else "Fees, rates, delivery times and recipient amounts are not presented as current facts when they are not verified."

    def _precautions(self,language:str="es")->List[str]:
        if language=="en":
            return [
                "Fees and exchange rates can change before you complete a transfer.",
                "Review recipient information before confirming.",
                "Never share passwords, CVV, login credentials or security codes with this app.",
                "The transfer is completed on the provider's official website."
            ]
        return [
            "Las comisiones y tasas de cambio pueden cambiar antes de completar el envío.",
            "Revisa los datos del destinatario antes de confirmar.",
            "Nunca compartas con esta aplicación contraseñas, CVV, claves de acceso ni códigos de seguridad.",
            "El envío se completa en el sitio oficial del proveedor."
        ]

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:
            raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country:
            raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:
            raise KeyError("provider_not_found")
        state["selected_option"]=deepcopy(option)
        state["current_step"]="final_check"
        state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        checks=[]
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

        amount=float(request.amount or 0)
        currency=request.send_currency or "USD"

        checks.append({
            "id":"destination",
            "label":labels["destination"][language],
            "value":country,
            "complete":bool(request.destination_country) and self.country_supported(request.destination_country),
            "status":"ok" if request.destination_country and self.country_supported(request.destination_country) else "review"
        })
        checks.append({
            "id":"amount",
            "label":labels["amount"][language],
            "value":f"{amount:.2f} {currency}",
            "complete":amount>0,
            "status":"ok" if amount>0 else "review"
        })
        checks.append({
            "id":"currency",
            "label":labels["currency"][language],
            "value":currency,
            "complete":bool(currency),
            "status":"ok" if currency else "review"
        })
        checks.append({
            "id":"delivery_method",
            "label":labels["delivery_method"][language],
            "value":request.delivery_method or ("Not selected" if language=="en" else "No seleccionada"),
            "complete":bool(request.delivery_method),
            "status":"ok" if request.delivery_method else "review"
        })
        checks.append({
            "id":"recipient_information",
            "label":labels["recipient_information"][language],
            "value":"Revisar en el proveedor" if language=="es" else "Review on provider site",
            "complete":True,
            "status":"review"
        })
        checks.append({
            "id":"fee",
            "label":labels["fee"][language],
            "value":request.fee if request.fee is not None else ("No verificada" if language=="es" else "Not verified"),
            "complete":request.fee is not None,
            "status":"ok" if request.fee is not None else "review"
        })
        checks.append({
            "id":"exchange_rate",
            "label":labels["exchange_rate"][language],
            "value":request.exchange_rate if request.exchange_rate is not None else ("No verificada" if language=="es" else "Not verified"),
            "complete":request.exchange_rate is not None,
            "status":"ok" if request.exchange_rate is not None else "review"
        })
        checks.append({
            "id":"recipient_amount",
            "label":labels["recipient_amount"][language],
            "value":request.recipient_amount if request.recipient_amount is not None else ("No verificada" if language=="es" else "Not verified"),
            "complete":request.recipient_amount is not None,
            "status":"ok" if request.recipient_amount is not None else "review"
        })

        required_ids={"destination","amount","currency"}
        valid=all(x["complete"] for x in checks if x["id"] in required_ids)

        if session_id in self.sessions:
            self.sessions[session_id]["final_check"]={
                "checks":deepcopy(checks),
                "valid":valid
            }
            self.sessions[session_id]["current_step"]="final_check"
            self.sessions[session_id]["updated_at"]=self.now()

        message=self._final_message(language,valid)

        return {
            "success":True,
            "ready_to_continue":valid,
            "language":language,
            "provider_id":request.provider_id,
            "checks":checks,
            "message":message,
            "precautions":self._precautions(language),
            "requirements":self.provider_requirements(request.provider_id,language)
        }

    def _final_message(self,language:str,valid:bool)->str:
        if language=="en":
            return "The basic information is ready. Review the provider's final terms before continuing." if valid else "Review the missing information before continuing."
        return "La información básica está lista. Revisa las condiciones finales del proveedor antes de continuar." if valid else "Revisa la información que falta antes de continuar."

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:
            return []
        requirements=provider.get("requirements",[])
        if not isinstance(requirements,list):
            return []
        result=[]
        for item in requirements:
            if isinstance(item,str):
                result.append(item)
            elif isinstance(item,dict):
                text=self.localize(item,language)
                if text:
                    result.append(text)
        return result

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        guidance=self.brain.get("help_center",{})
        topic_ids=guidance.get("topics",[]) if isinstance(guidance,dict) else []
        defaults=[
            ("exchange_rate","¿Qué es la tasa de cambio?","What is an exchange rate?","Es la relación entre la moneda que envías y la moneda que recibe la otra persona.","It is the relationship between the currency you send and the currency the other person receives."),
            ("fee","¿Qué es una comisión?","What is a fee?","Es un cargo que puede aplicar el proveedor por el servicio.","It is a charge the provider may apply for the service."),
            ("recipient_amount","¿Por qué recibe menos?","Why does the recipient receive less?","La comisión y la tasa de cambio pueden afectar la cantidad final.","The fee and exchange rate can affect the final amount."),
            ("identification","¿Por qué me piden identificación?","Why am I asked for identification?","El proveedor puede solicitar información para verificar identidad y cumplir sus propios requisitos.","The provider may request information to verify identity and meet its own requirements."),
            ("mistake","¿Qué hago si me equivoqué?","What if I made a mistake?","No confirmes todavía. Revisa los datos y consulta al proveedor antes de completar el envío.","Do not confirm yet. Review the information and contact the provider before completing the transfer."),
            ("security","¿Qué información no debo compartir aquí?","What information should I not share here?","No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","Do not enter passwords, CVV numbers, security codes or login credentials.")
        ]
        result=[]
        if isinstance(topic_ids,list) and topic_ids:
            for topic in topic_ids:
                if isinstance(topic,dict):
                    result.append({
                        "id":topic.get("id"),
                        "label":self.localize(topic.get("label"),language),
                        "answer":self.localize(topic.get("answer"),language)
                    })
                elif isinstance(topic,str):
                    for item in defaults:
                        if item[0]==topic:
                            result.append({
                                "id":item[0],
                                "label":item[1] if language=="es" else item[2],
                                "answer":item[3] if language=="es" else item[4]
                            })
                            break
        if not result:
            for item in defaults:
                result.append({
                    "id":item[0],
                    "label":item[1] if language=="es" else item[2],
                    "answer":item[3] if language=="es" else item[4]
                })
        return result

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        lang=language if language in ("es","en") else "es"
        responses={
            "remittance":{
                "es":"Para ayudarte con una remesa necesito la cantidad y el país de destino. Después revisaremos frecuencia, rapidez y lo que más te importa antes de comparar.",
                "en":"To help with a remittance, I need the amount and destination country. Then we will review frequency, speed and what matters most before comparing."
            },
            "money_available":{
                "es":"Esta sección sirve para organizar el dinero que tienes y calcular cuánto queda después de tus gastos, ahorros y envíos que tú registres.",
                "en":"This section helps organize the money you have and calculate what remains after the expenses, savings and transfers you enter."
            },
            "budget":{
                "es":"Aquí puedes organizar ingresos, necesidades, gastos, remesas y ahorro para ver qué queda disponible en cada período.",
                "en":"Here you can organize income, needs, expenses, transfers and savings to see what remains in each period."
            },
            "expenses":{
                "es":"Anota tus gastos para entender en qué se va tu dinero y qué necesitas cubrir antes de enviar, comprar o ahorrar.",
                "en":"Record your expenses to understand where your money goes and what needs to be covered before sending, buying or saving."
            },
            "savings":{
                "es":"Puedes registrar una cantidad de ahorro y ver cómo cambia el dinero disponible.",
                "en":"You can record a savings amount and see how it changes the money available."
            },
            "purchase":{
                "es":"Puedes registrar una compra y revisar cómo afectaría el dinero que te queda.",
                "en":"You can record a purchase and review how it would affect the money you have left."
            },
            "family":{
                "es":"Puedes organizar cantidades destinadas a familiares sin enviar ni guardar esas cantidades en el servidor.",
                "en":"You can organize amounts intended for family without sending or storing those amounts on the server."
            },
            "requirements":{
                "es":"Los requisitos pueden cambiar según el proveedor, país, cantidad y método. La aplicación te ayuda a entender qué puede pedirte el proveedor.",
                "en":"Requirements can vary by provider, country, amount and method. The app helps you understand what the provider may request."
            },
            "personal_information":{
                "es":"Esta aplicación no necesita tus contraseñas, CVV, códigos de seguridad ni claves de acceso. Los datos personales que el proveedor necesite se introducen en el sitio del proveedor.",
                "en":"This app does not need your passwords, CVV numbers, security codes or login credentials. Personal information required by the provider is entered on the provider's site."
            },
            "fees":{
                "es":"La comisión es un cargo que puede aplicar el proveedor. Debes revisar el cargo final antes de confirmar.",
                "en":"A fee is a charge the provider may apply. Review the final charge before confirming."
            },
            "exchange_rate":{
                "es":"La tasa de cambio determina cuánto vale la moneda enviada en la moneda que recibe el destinatario.",
                "en":"The exchange rate determines how much the sent currency is worth in the recipient's currency."
            },
            "delivery":{
                "es":"El tiempo de entrega puede depender del proveedor, país, método y condiciones del envío.",
                "en":"Delivery time can depend on the provider, country, method and transfer conditions."
            },
            "provider_difference":{
                "es":"Las diferencias pueden estar en comisión, tasa de cambio, cantidad recibida, velocidad, forma de entrega, forma de pago y requisitos. Solo mostramos datos comerciales actuales cuando están verificados.",
                "en":"Differences can include fees, exchange rate, recipient amount, speed, delivery method, payment method and requirements. Commercial data is shown as current only when verified."
            },
            "mistake_prevention":{
                "es":"Si detectas un error, no confirmes el envío. Revisa los datos y consulta al proveedor antes de continuar.",
                "en":"If you find an error, do not confirm the transfer. Review the information and contact the provider before continuing."
            },
            "cancellation":{
                "es":"Las reglas de cancelación dependen del proveedor y del estado del envío. Consulta al proveedor antes de asumir que puede cancelarse.",
                "en":"Cancellation rules depend on the provider and transfer status. Check with the provider before assuming a transfer can be cancelled."
            },
            "recipient_information":{
                "es":"Los datos del destinatario deben coincidir con los requisitos del método de entrega elegido. Revísalos antes de confirmar.",
                "en":"Recipient information must match the requirements of the selected delivery method. Review it before confirming."
            },
            "security":{
                "es":"Nunca introduzcas aquí contraseñas, CVV, códigos de seguridad, claves bancarias ni credenciales del proveedor.",
                "en":"Never enter passwords, CVV numbers, security codes, bank credentials or provider login information here."
            },
            "other":{
                "es":"Cuéntame qué necesitas. Primero identificaremos si se trata de un envío, gastos, ahorro, compra, familia, requisitos u otra pregunta sobre tu dinero.",
                "en":"Tell me what you need. We will first identify whether it is a transfer, expenses, savings, purchase, family, requirements or another money question."
            }
        }
        item=responses.get(need_type,responses["other"])
        return {
            "success":True,
            "need_type":need_type,
            "message":item[lang],
            "language":lang,
            "remittance_required":need_type=="remittance",
            "next_step":"amount" if need_type=="remittance" else "assistant"
        }

    def calculate_money_plan(self,income:float=0,essential:float=0,flexible:float=0,savings:float=0,remittance:float=0)->Dict[str,Any]:
        values={
            "income":max(float(income or 0),0),
            "essential":max(float(essential or 0),0),
            "flexible":max(float(flexible or 0),0),
            "savings":max(float(savings or 0),0),
            "remittance":max(float(remittance or 0),0)
        }
        available=values["income"]-values["essential"]-values["flexible"]-values["savings"]-values["remittance"]
        return {
            **values,
            "available":round(available,2),
            "negative_warning":available<0,
            "currency":"USD",
            "informational":True
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        opening=self.brain.get("opening",{})
        opening_lang=opening.get(language,{}) if isinstance(opening,dict) else {}
        if not isinstance(opening_lang,dict):
            opening_lang={}

        countries=[]
        for item in self.get_supported_countries():
            code=item.get("code")
            countries.append({
                "id":code,
                "code":code,
                "name":self.localize(item.get("name"),language) or code,
                "currency":self.brain.get("countries",{}).get("default_currency","USD")
            })

        providers=[]
        for provider in self.get_provider_registry():
            providers.append({
                "id":provider.get("id"),
                "name":provider.get("name"),
                "enabled":provider.get("enabled",True),
                "continue_url":self.provider_url(provider,language),
                "official_site":provider.get("official_site") or provider.get("official_url") or self.provider_url(provider,language),
                "payment_methods":deepcopy(provider.get("payment_methods",[])),
                "delivery_methods":deepcopy(provider.get("delivery_methods",[]))
            })

        delivery=self._brain_options("delivery_methods",language)
        payment=self._brain_options("payment_methods",language)

        messages={}
        raw_messages=self.brain.get("messages",{})
        if isinstance(raw_messages,dict):
            for key,value in raw_messages.items():
                messages[key]=self.localize(value,language)

        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{
                "title":opening_lang.get("title","REMESAS" if language=="es" else "REMITTANCES"),
                "subtitle":opening_lang.get("subtitle",""),
                "welcome":opening_lang.get("welcome",""),
                "start":opening_lang.get("start","Comenzar" if language=="es" else "Start"),
                "language":opening_lang.get("language","English" if language=="es" else "Español")
            },
            "conversation_logic":deepcopy(self.brain.get("conversation_logic",{})),
            "remittance_flow":deepcopy(self.brain.get("remittance_flow",{})),
            "countries":countries,
            "providers":providers,
            "delivery_methods":delivery,
            "payment_methods":payment,
            "messages":messages,
            "help_topics":self.help_topics(language),
            "provider_comparison":deepcopy(self.brain.get("provider_comparison",{})),
            "provider_handoff":deepcopy(self.brain.get("provider_handoff",{})),
            "money_planner":deepcopy(self.brain.get("money_planner",{})),
            "security":deepcopy(self.brain.get("security",{})),
            "privacy":deepcopy(self.brain.get("data_privacy",{}))
        }

engine=RemittanceEngine()
