import json,re,uuid
from copy import deepcopy
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional
from schemas import UserNeedRequest,ParseNeedRequest,ComparisonRequest,ComparisonResult,FinalCheckRequest,MoneyPlanRequest,MoneyRecord,RecordDecisionRequest,FinancialSnapshotRequest,SnapshotImportRequest,EvolutionRequest,PurchasePlanRequest

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

    def localize(self,value:Any,language:str="es")->str:
        if value is None:return ""
        if isinstance(value,(str,int,float,bool)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            fallback="es" if language!="es" else "en"
            if fallback in value:return self.localize(value[fallback],fallback)
            for k in ("label","name","title","text","answer"):
                if k in value:return self.localize(value[k],language)
            if "id" in value:return str(value["id"])
        if isinstance(value,list):return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        messages=self.brain.get("messages",{})
        value=messages.get(key,{}) if isinstance(messages,dict) else {}
        return self.localize(value,language)

    def _message(self,key:str,language:str="es")->str:return self.language_text(key,language)

    def get_supported_countries(self)->List[Dict[str,Any]]:
        supported=self.brain.get("countries",{}).get("supported",[])
        result=[]
        if isinstance(supported,list):
            for item in supported:
                if isinstance(item,dict):
                    code=str(item.get("code","")).upper().strip()
                    if code:result.append({"code":code,"name":deepcopy(item.get("name",{"es":code,"en":code}))})
                elif isinstance(item,str):
                    code=item.upper().strip()
                    if code:result.append({"code":code,"name":{"es":code,"en":code}})
        return result

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        if not code:return None
        for item in self.get_supported_countries():
            if str(item.get("code","")).upper()==code:return item
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        if isinstance(destinations,dict) and isinstance(destinations.get(code),dict):return destinations[code]
        return None

    def country_name(self,country_code:str,language:str="es")->str:
        value=self.get_country(country_code)
        if not value:return (country_code or "").upper()
        return self.localize(value.get("name",value),language) or (country_code or "").upper()

    def country_supported(self,country_code:str)->bool:
        code=(country_code or "").strip().upper()
        return any(str(x.get("code","")).upper()==code for x in self.get_supported_countries())

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not isinstance(providers,list) or not providers:providers=self.brain.get("providers",[])
        result=[];seen=set()
        for provider in providers:
            if not isinstance(provider,dict):continue
            pid=str(provider.get("id","")).strip().lower()
            if not pid or pid in seen or not bool(provider.get("enabled",True)):continue
            seen.add(pid);result.append(deepcopy(provider))
        return result

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=(provider_id or "").strip().lower()
        for provider in self.get_provider_registry():
            if str(provider.get("id","")).lower()==pid:return provider
        return None

    def provider_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if isinstance(urls,dict):
            keys=["us_send_es","us_es","es","home","main"] if language=="es" else ["us_send","us_en","en","home","main"]
            for key in keys:
                value=urls.get(key)
                if isinstance(value,str) and value.startswith(("http://","https://")):return value
        for key in ("official_url","official_site"):
            value=provider.get(key)
            if isinstance(value,str) and value.startswith(("http://","https://")):return value
        return None

    def corridor_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        if isinstance(corridor,dict):
            ids=corridor.get("providers",[])
            if isinstance(ids,list) and ids:
                valid=[str(pid) for pid in ids if self.get_provider(str(pid))]
                if valid:return valid
        return [str(p.get("id")) for p in self.get_provider_registry() if p.get("id")]

    def candidate_provider_ids(self,country:str)->List[str]:
        return self.corridor_provider_ids(country) if self.country_supported(country) else []

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):return None
        if str(commercial.get("status","")).lower()!="verified" or not commercial.get("source") or not commercial.get("verified_at"):return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id;result["destination_country"]=(country or "").upper()
        return result

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):commercial={}
        verified=str(commercial.get("status","")).lower()=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))
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
        data=self.brain.get(key,[]);result=[]
        if isinstance(data,list):
            for item in data:
                if isinstance(item,dict):
                    ident=item.get("id") or item.get("code")
                    if ident:result.append({"id":ident,"label":self.localize(item.get("label") or item.get("name") or ident,language)})
        elif isinstance(data,dict):
            for ident,value in data.items():result.append({"id":ident,"label":self.localize(value,language) or str(ident)})
        return result

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es";sid=str(uuid.uuid4());now=self.now()
        state={"session_id":sid,"language":language,"need_type":None,"amount":None,"send_currency":"USD","destination_country":None,"priority":None,"urgency":None,"frequency":None,"delivery_method":None,"payment_method":None,"special_need":None,"free_text":None,"parsed_user_need":None,"candidate_providers":[],"available_providers":[],"verified_results":[],"selected_option":None,"final_check":{},"current_step":"opening","created_at":now,"updated_at":now}
        self.sessions[sid]=state;return deepcopy(state)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:return deepcopy(self.sessions.get(session_id))

    def update_session(self,session_id:str,**values:Any)->Optional[Dict[str,Any]]:
        state=self.sessions.get(session_id)
        if not state:return None
        for key,value in values.items():
            if value is not None:state[key]=value
        state["updated_at"]=self.now();return deepcopy(state)

    def clear_session(self,session_id:str)->bool:return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        for raw in re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text or "",re.I):
            try:
                value=float(raw.replace(",",""))
                if value>0:return value
            except ValueError:pass
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=(text or "").lower()
        aliases={"méxico":"MX","mexico":"MX","mexican":"MX","mexicana":"MX","guatemala":"GT","el salvador":"SV","salvador":"SV","honduras":"HN","nicaragua":"NI","costa rica":"CR","panamá":"PA","panama":"PA","república dominicana":"DO","republica dominicana":"DO","dominicana":"DO","colombia":"CO","venezuela":"VE","ecuador":"EC","perú":"PE","peru":"PE","bolivia":"BO","paraguay":"PY","brasil":"BR","brazil":"BR","chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU","haití":"HT","haiti":"HT"}
        for item in self.get_supported_countries():
            name=item.get("name",{})
            names=[name.get("es",""),name.get("en","")] if isinstance(name,dict) else [str(name)]
            for n in names:
                if n and re.search(r"\b"+re.escape(str(n).lower())+r"\b",normalized):return str(item.get("code")).upper()
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",normalized):return code
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        patterns=[("recipient_gets_more",["reciba más","reciba mas","receive more","más dinero","mas dinero","more money"]),("fastest",["rápido","rapido","fast","quick","speed","lo antes posible"]),("urgent",["urgente","urgent","hoy","today","ahora","now","asap"]),("save",["ahorrar","ahorro","save","cheap","barato","menos costo","menor costo"]),("balanced",["equilibrio","balance","balanced"]),("compare_all",["comparar","compare","comparación","comparacion","opciones","options"])]
        for priority,terms in patterns:
            if any(term in value for term in terms):return priority
        return None

    def _frequency_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        if any(x in value for x in ["cada semana","semanal","weekly"]):return "weekly"
        if any(x in value for x in ["cada dos semanas","quincenal","biweekly"]):return "biweekly"
        if any(x in value for x in ["cada mes","mensual","monthly"]):return "monthly"
        if any(x in value for x in ["una vez","puntual","ocasional","one time","once"]):return "one_time"
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
            ("personal_information",["información personal","informacion personal","datos personales","identificación","identificacion","personal information"]),
            ("fees",["comisión","comision","tarifa","cargo","fee","fees","costo de envío","costo de envio"]),
            ("exchange_rate",["tasa de cambio","tipo de cambio","exchange rate","cambio"]),
            ("delivery",["cuándo llega","cuando llega","entrega","delivery","tiempo","cuánto tarda","cuanto tarda"]),
            ("provider_difference",["diferencia entre","diferencias","cuál es la diferencia","cual es la diferencia","difference between"]),
            ("mistake_prevention",["me equivoqué","me equivoque","error","equivoqué","equivoque","mistake","wrong information"]),
            ("cancellation",["cancelar","cancelación","cancelacion","cancel","canceled"]),
            ("recipient_information",["beneficiario","destinatario","recipient","beneficiary","datos del que recibe"]),
            ("security",["seguro","seguridad","estafa","fraude","security","scam","fraud"])
        ]
        for topic,terms in categories:
            if any(term in value for term in terms):return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text or "";language=request.language if request.language in ("es","en") else "es";classification=self.classify_need(text,language);priority=self._priority_from_text(text)
        return {"need_type":classification["need_type"],"amount":self._amount_from_text(text),"destination_country":self._country_from_text(text),"priority":priority,"urgency":True if priority=="urgent" else None,"frequency":self._frequency_from_text(text),"delivery_method":None,"payment_method":None,"language":language,"raw_text":text}

    def _next_step(self,state:Dict[str,Any])->str:
        if not state.get("need_type"):return "need"
        if state.get("need_type")!="remittance":return "assistant"
        if not state.get("amount"):return "amount"
        if not state.get("destination_country"):return "destination"
        if state.get("frequency") is None:return "frequency"
        if state.get("urgency") is None:return "urgency"
        if not state.get("priority"):return "priority"
        return "comparison"

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        values={}
        fields=("amount","destination_country","priority","urgency","frequency","delivery_method","payment_method","special_need","free_text","need_type")
        for field in fields:
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        if request.language in ("es","en"):values["language"]=request.language
        if request.free_text and not request.need_type:values["need_type"]=self.classify_need(request.free_text,request.language).get("need_type","other")
        current=deepcopy(self.sessions[session_id]);current.update(values);current["current_step"]=self._next_step(current)
        updated=self.update_session(session_id,**values)
        if updated:
            updated["current_step"]=current["current_step"];self.sessions[session_id]["current_step"]=current["current_step"]
        return updated or {}

    def _build_verified_result(self,provider:Dict[str,Any],commercial:Dict[str,Any],request:ComparisonRequest,language:str)->ComparisonResult:
        return ComparisonResult(provider_id=provider.get("id",""),provider_name=provider.get("name",provider.get("id","")),amount_sent=request.amount,send_currency=request.send_currency,fee=commercial.get("fee"),exchange_rate=commercial.get("exchange_rate"),recipient_amount=commercial.get("recipient_amount"),delivery_method=commercial.get("delivery_method"),payment_method=commercial.get("payment_method"),estimated_delivery=commercial.get("delivery_time"),recipient_currency=commercial.get("currency"),availability=True,important_condition=commercial.get("important_condition"),requirements=deepcopy(commercial.get("requirements",[])) if isinstance(commercial.get("requirements",[]),list) else [],source=commercial.get("source"),verified_at=commercial.get("verified_at"),status="verified",continue_url=self.provider_url(provider,language))

    def _differences(self,available:List[Dict[str,Any]],language:str)->List[Dict[str,Any]]:
        differences=[]
        dimensions=[("payment_methods","payment_method","Métodos de pago","Payment methods"),("delivery_methods","delivery_method","Formas de entrega","Delivery methods"),("supports_online","online","Disponible en línea","Available online"),("supports_agent","agent","Atención en agente","Agent service")]
        for key,dim,es,en in dimensions:
            values=[]
            for p in available:
                value=p.get(key)
                if value:values.append({"provider_id":p.get("provider_id"),"provider_name":p.get("provider_name"),"value":value})
            if values:differences.append({"id":dim,"label":en if language=="en" else es,"values":values})
        return differences

    def compare_session(self,session_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        if not state.get("amount"):raise ValueError("Amount is required.")
        if not state.get("destination_country"):raise ValueError("Destination country is required.")
        request=ComparisonRequest(amount=state.get("amount"),destination_country=state.get("destination_country"),priority=state.get("priority"),urgency=state.get("urgency"),delivery_method=state.get("delivery_method"),payment_method=state.get("payment_method"),language=state.get("language","es"),send_currency=state.get("send_currency","USD"),recipient_amount_target=None,special_need=state.get("special_need"))
        return self.compare(request,session_id)

    def compare(self,request:ComparisonRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es";country=(request.destination_country or "").strip().upper()
        if request.amount<=0:raise ValueError("Amount must be greater than zero.")
        if not country:raise ValueError("Destination country is required.")
        if not self.country_supported(country):raise ValueError("Destination country is not supported.")
        provider_ids=request.provider_ids or self.candidate_provider_ids(country);available=[];verified_results=[]
        for pid in provider_ids:
            public=self.provider_public_option(pid,country,language)
            if public:available.append(public)
            commercial=self.get_verified_provider_data(pid,country,request.amount,request.payment_method,request.delivery_method);provider=self.get_provider(pid)
            if commercial and provider:verified_results.append(self._build_verified_result(provider,commercial,request,language))
        verified_ids={x.provider_id for x in verified_results}
        for item in available:
            ok=item.get("provider_id") in verified_ids;item["commercial_status"]="verified" if ok else "unavailable";item["commercial_verified"]=ok
        differences=self._differences(available,language)
        if session_id in self.sessions:
            state=self.sessions[session_id];state["candidate_providers"]=[x["provider_id"] for x in available];state["available_providers"]=deepcopy(available);state["verified_results"]=[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results];state["current_step"]="results";state["updated_at"]=self.now()
        message=self._message("results_ready",language) if verified_results else self._message("no_results",language)
        if not message:message="Opciones verificadas disponibles." if verified_results and language=="es" else "Verified options are available." if verified_results else ("Los datos comerciales actuales no están verificados. Puedes consultar los sitios oficiales de los proveedores." if language=="es" else "Current commercial data is not verified. You can consult the providers' official sites.")
        return {"success":True,"message":message,"results":[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified_results],"available_providers":available,"provider_count":len(available),"verified_count":len(verified_results),"results_available":bool(verified_results),"destination_country":country,"destination_name":self.country_name(country,language),"amount":request.amount,"send_currency":request.send_currency,"priority":request.priority,"urgency":request.urgency,"language":language,"explanation":self.comparison_explanation(language,bool(verified_results)),"differences":differences,"precautions":self._precautions(language)}

    def comparison_explanation(self,language:str="es",verified:bool=False)->str:
        return ("Los datos mostrados como verificados tienen una fuente y fecha de verificación. Revísalos antes de continuar." if language=="es" else "Data marked as verified has a source and verification date. Review it before continuing.") if verified else ("No se muestran tarifas, tasas, tiempos ni cantidades como hechos actuales cuando no están verificadas." if language=="es" else "Fees, rates, delivery times and recipient amounts are not presented as current facts when they are not verified.")

    def _precautions(self,language:str="es")->List[str]:
        if language=="en":return ["Fees and exchange rates can change before you complete a transfer.","Review recipient information before confirming.","Never share passwords, CVV, login credentials or security codes with this app.","The transfer is completed on the provider's official website."]
        return ["Las comisiones y tasas de cambio pueden cambiar antes de completar el envío.","Revisa los datos del destinatario antes de confirmar.","Nunca compartas con esta aplicación contraseñas, CVV, claves de acceso ni códigos de seguridad.","El envío se completa en el sitio oficial del proveedor."]

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_found")
        state["selected_option"]=deepcopy(option);state["current_step"]="final_check";state["updated_at"]=self.now();return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es";country=self.country_name(request.destination_country,language);amount=float(request.amount or 0);currency=request.send_currency or "USD"
        labels={"destination":{"es":"País de destino","en":"Destination country"},"amount":{"es":"Cantidad a enviar","en":"Amount to send"},"currency":{"es":"Moneda del envío","en":"Sending currency"},"delivery_method":{"es":"Forma de entrega","en":"Delivery method"},"recipient_information":{"es":"Datos del destinatario","en":"Recipient information"},"fee":{"es":"Comisión","en":"Fee"},"exchange_rate":{"es":"Tasa de cambio","en":"Exchange rate"},"recipient_amount":{"es":"Cantidad que recibiría","en":"Recipient amount"}}
        checks=[
            {"id":"destination","label":labels["destination"][language],"value":country,"complete":bool(request.destination_country) and self.country_supported(request.destination_country),"status":"ok" if request.destination_country and self.country_supported(request.destination_country) else "review"},
            {"id":"amount","label":labels["amount"][language],"value":f"{amount:.2f} {currency}","complete":amount>0,"status":"ok" if amount>0 else "review"},
            {"id":"currency","label":labels["currency"][language],"value":currency,"complete":bool(currency),"status":"ok" if currency else "review"},
            {"id":"delivery_method","label":labels["delivery_method"][language],"value":request.delivery_method or ("Not selected" if language=="en" else "No seleccionada"),"complete":bool(request.delivery_method),"status":"ok" if request.delivery_method else "review"},
            {"id":"recipient_information","label":labels["recipient_information"][language],"value":"Revisar en el proveedor" if language=="es" else "Review on provider site","complete":True,"status":"review"},
            {"id":"fee","label":labels["fee"][language],"value":request.fee if request.fee is not None else ("No verificada" if language=="es" else "Not verified"),"complete":request.fee is not None,"status":"ok" if request.fee is not None else "review"},
            {"id":"exchange_rate","label":labels["exchange_rate"][language],"value":request.exchange_rate if request.exchange_rate is not None else ("No verificada" if language=="es" else "Not verified"),"complete":request.exchange_rate is not None,"status":"ok" if request.exchange_rate is not None else "review"},
            {"id":"recipient_amount","label":labels["recipient_amount"][language],"value":request.recipient_amount if request.recipient_amount is not None else ("No verificada" if language=="es" else "Not verified"),"complete":request.recipient_amount is not None,"status":"ok" if request.recipient_amount is not None else "review"}
        ]
        valid=all(x["complete"] for x in checks if x["id"] in {"destination","amount","currency"})
        if session_id in self.sessions:self.sessions[session_id].update({"final_check":{"checks":deepcopy(checks),"valid":valid},"current_step":"final_check","updated_at":self.now()})
        return {"success":True,"ready_to_continue":valid,"language":language,"provider_id":request.provider_id,"checks":checks,"message":self._final_message(language,valid),"precautions":self._precautions(language),"requirements":self.provider_requirements(request.provider_id,language)}

    def _final_message(self,language:str,valid:bool)->str:
        if language=="en":return "The basic information is ready. Review the provider's final terms before continuing." if valid else "Review the missing information before continuing."
        return "La información básica está lista. Revisa las condiciones finales del proveedor antes de continuar." if valid else "Revisa la información que falta antes de continuar."

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:return []
        requirements=provider.get("requirements",[])
        if not isinstance(requirements,list):return []
        return [x if isinstance(x,str) else self.localize(x,language) for x in requirements if x]

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        defaults=[
            ("exchange_rate","¿Qué es la tasa de cambio?","What is an exchange rate?","Es la relación entre la moneda que envías y la moneda que recibe la otra persona.","It is the relationship between the currency you send and the currency the other person receives."),
            ("fee","¿Qué es una comisión?","What is a fee?","Es un cargo que puede aplicar el proveedor por el servicio.","It is a charge the provider may apply for the service."),
            ("recipient_amount","¿Por qué recibe menos?","Why does the recipient receive less?","La comisión y la tasa de cambio pueden afectar la cantidad final.","The fee and exchange rate can affect the final amount."),
            ("identification","¿Por qué me piden identificación?","Why am I asked for identification?","El proveedor puede solicitar información para verificar identidad y cumplir sus propios requisitos.","The provider may request information to verify identity and meet its own requirements."),
            ("mistake","¿Qué hago si me equivoqué?","What if I made a mistake?","No confirmes todavía. Revisa los datos y consulta al proveedor antes de completar el envío.","Do not confirm yet. Review the information and contact the provider before completing the transfer."),
            ("security","¿Qué información no debo compartir aquí?","What information should I not share here?","No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","Do not enter passwords, CVV numbers, security codes or login credentials.")
        ]
        guidance=self.brain.get("help_center",{});ids=guidance.get("topics",[]) if isinstance(guidance,dict) else [];result=[]
        if isinstance(ids,list) and ids:
            for topic in ids:
                if isinstance(topic,dict):result.append({"id":topic.get("id"),"label":self.localize(topic.get("label"),language),"answer":self.localize(topic.get("answer"),language)})
                else:
                    for x in defaults:
                        if x[0]==topic:result.append({"id":x[0],"label":x[1] if language=="es" else x[2],"answer":x[3] if language=="es" else x[4]});break
        return result or [{"id":x[0],"label":x[1] if language=="es" else x[2],"answer":x[3] if language=="es" else x[4]} for x in defaults]

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        lang=language if language in ("es","en") else "es"
        responses={
            "remittance":{"es":"Para ayudarte con una remesa necesito la cantidad y el país de destino. Después revisaremos rapidez y lo que más te importa antes de comparar.","en":"To help with a remittance, I need the amount and destination country. Then we will review speed and what matters most before comparing."},
            "money_available":{"es":"Vamos a calcular cuánto tienes disponible después de lo que registraste. El resultado se puede ver por día, semana, quincena y mes.","en":"We will calculate what you have available after what you recorded. The result can be viewed daily, weekly, biweekly and monthly."},
            "budget":{"es":"Vamos a ordenar tus ingresos, gastos, ahorro y remesas para mostrarte qué dinero queda disponible.","en":"We will organize your income, expenses, savings and transfers to show what money remains available."},
            "expenses":{"es":"Cada gasto se clasifica antes de afectar tu cálculo. Así evitamos mezclar un gasto nuevo con uno que ya registraste.","en":"Each expense is classified before affecting your calculation. This prevents a new expense from being blindly added to one already recorded."},
            "savings":{"es":"Registrar ahorro reduce el dinero disponible y aumenta lo que estás separando para el futuro.","en":"Recording savings reduces available money and increases what you are setting aside for the future."},
            "purchase":{"es":"Antes de considerar una compra, calcularemos cómo quedaría tu dinero después de pagarla.","en":"Before considering a purchase, we calculate what your money would look like after paying for it."},
            "family":{"es":"Puedes organizar personas frecuentes localmente sin guardar contraseñas ni credenciales.","en":"You can organize frequent people locally without storing passwords or credentials."},
            "requirements":{"es":"Los requisitos pueden cambiar. Te mostramos lo que sabemos y, cuando falta información verificable, te dirigimos al proveedor.","en":"Requirements can change. We show what we know and, when verified information is unavailable, direct you to the provider."},
            "fees":{"es":"No inventamos una comisión. Si no está verificada, puedes abrir el sitio oficial para comprobarla.","en":"We do not invent a fee. If it is not verified, you can open the official site to check it."},
            "exchange_rate":{"es":"No inventamos una tasa de cambio. Si no está verificada, te llevamos al sitio oficial para verla.","en":"We do not invent an exchange rate. If it is not verified, we take you to the official site to check it."},
            "delivery":{"es":"El tiempo depende del proveedor y método. Si no tenemos un dato verificado, te dirigimos al sitio oficial.","en":"Timing depends on the provider and method. If we do not have verified information, we direct you to the official site."},
            "security":{"es":"Nunca introduzcas aquí contraseñas, CVV, códigos de seguridad ni credenciales.","en":"Never enter passwords, CVV numbers, security codes or credentials here."},
            "other":{"es":"Primero vamos a entender qué necesitas y después te daremos una acción concreta.","en":"First we will understand what you need and then give you a concrete action."}
        }
        item=responses.get(need_type,responses["other"])
        return {"success":True,"need_type":need_type,"message":item[lang],"language":lang,"remittance_required":need_type=="remittance","next_step":"amount" if need_type=="remittance" else "assistant"}

    # ---------------- DINERO ----------------

    def _clean_amount(self,value:Any)->float:
        try:return round(max(float(value or 0),0),2)
        except:return 0.0

    def _period_factor(self,frequency:str)->float:
        return {"daily":1,"weekly":7,"biweekly":14,"monthly":30,"one_time":1}.get(str(frequency),1)

    def _monthly_amount(self,amount:float,frequency:str)->float:
        a=self._clean_amount(amount)
        if frequency=="daily":return a*30
        if frequency=="weekly":return a*4.345
        if frequency=="biweekly":return a*2.0
        if frequency=="monthly":return a
        return a

    def calculate_money_plan(self,income:float=0,essential:float=0,flexible:float=0,savings:float=0,remittance:float=0,purchase:float=0,other:float=0,frequency:str="monthly")->Dict[str,Any]:
        income=self._clean_amount(income);essential=self._clean_amount(essential);flexible=self._clean_amount(flexible);savings=self._clean_amount(savings);remittance=self._clean_amount(remittance);purchase=self._clean_amount(purchase);other=self._clean_amount(other)
        factor=self._period_factor(frequency)
        available=income-essential-flexible-savings-remittance-purchase-other
        monthly_income=self._monthly_amount(income,frequency)
        monthly_out=self._monthly_amount(essential+flexible+savings+remittance+purchase+other,frequency)
        monthly_available=monthly_income-monthly_out
        daily=max(monthly_available/30,0)
        weekly=max(monthly_available/4.345,0)
        biweekly=max(monthly_available/2,0)
        return {"income":income,"essential":essential,"flexible":flexible,"savings":savings,"remittance":remittance,"purchase":purchase,"other":other,"available":round(available,2),"daily_available":round(daily,2),"weekly_available":round(weekly,2),"biweekly_available":round(biweekly,2),"monthly_available":round(monthly_available,2),"negative_warning":available<0,"savings_rate":round((savings/monthly_income*100),2) if monthly_income else 0,"currency":"USD","frequency":frequency,"informational":True}

    def calculate_plan_request(self,request:MoneyPlanRequest)->Dict[str,Any]:
        return self.calculate_money_plan(request.income,request.essential,request.flexible,request.savings,request.remittance,request.purchase,request.other,request.frequency)

    def normalize_record(self,record:MoneyRecord)->MoneyRecord:
        data=record.model_dump() if hasattr(record,"model_dump") else record.dict()
        data["amount"]=self._clean_amount(data.get("amount"))
        data["id"]=data.get("id") or str(uuid.uuid4())
        data["description"]=(data.get("description") or "").strip()
        data["source"]=data.get("source") or "user"
        data["date"]=data.get("date") or self.now()
        return MoneyRecord(**data)

    def record_fingerprint(self,record:MoneyRecord)->str:
        r=self.normalize_record(record)
        return "|".join([str(r.type),f"{r.amount:.2f}",str(r.description).strip().lower(),str(r.date or "")[:10],str(r.frequency)])

    def records_are_same(self,a:MoneyRecord,b:MoneyRecord)->bool:
        if str(a.id)==str(b.id) and a.id:return True
        if a.type!=b.type or round(a.amount,2)!=round(b.amount,2):return False
        ad=(a.description or "").strip().lower();bd=(b.description or "").strip().lower()
        if ad and bd and ad==bd and str(a.date or "")[:10]==str(b.date or "")[:10]:return True
        return False

    def decide_record(self,request:RecordDecisionRequest)->Dict[str,Any]:
        record=self.normalize_record(request.record);existing=request.existing_records or []
        for old in existing:
            oldn=self.normalize_record(old)
            if self.records_are_same(record,oldn):
                return {"success":True,"action":"ignore","reason":"duplicate","message":"Este dato ya estaba registrado. No se sumó otra vez.","normalized_record":record,"duplicate_of":oldn.id,"affected_total":0}
        if record.amount<=0:return {"success":True,"action":"review","reason":"invalid_amount","message":"La cantidad debe ser mayor que cero.","normalized_record":record}
        return {"success":True,"action":"add","reason":"new_record","message":"Dato nuevo identificado. Puede incorporarse al cálculo.","normalized_record":record,"affected_total":record.amount}

    def summarize_records(self,records:List[MoneyRecord],income:float=0,period:str="monthly")->Dict[str,Any]:
        totals={"essential":0.0,"flexible":0.0,"other_expense":0.0,"savings":0.0,"remittance":0.0,"purchase":0.0,"family":0.0,"income":self._clean_amount(income)}
        for item in records or []:
            r=self.normalize_record(item)
            if r.type in totals:totals[r.type]+=r.amount
            elif r.type=="family":totals["family"]+=r.amount
        available=totals["income"]-sum(totals[k] for k in ("essential","flexible","other_expense","savings","remittance","purchase","family"))
        base=self.calculate_money_plan(totals["income"],totals["essential"],totals["flexible"],totals["savings"],totals["remittance"],totals["purchase"],totals["other_expense"]+totals["family"],period)
        return {"income":round(totals["income"],2),"essential":round(totals["essential"],2),"flexible":round(totals["flexible"],2),"other_expense":round(totals["other_expense"],2),"savings":round(totals["savings"],2),"remittance":round(totals["remittance"],2),"purchase":round(totals["purchase"],2),"family":round(totals["family"],2),"available":round(available,2),"daily_available":base["daily_available"],"weekly_available":base["weekly_available"],"biweekly_available":base["biweekly_available"],"monthly_available":base["monthly_available"],"negative_warning":available<0,"savings_rate":base["savings_rate"],"period":period,"currency":"USD"}

    def financial_action(self,summary:Dict[str,Any],language:str="es")->Dict[str,str]:
        if summary.get("negative_warning"):
            return {"title":"Hay que ajustar","message":"Tus gastos y compromisos superan el ingreso registrado. Revisa primero lo que puede reducirse o posponerse.","action":"Revisar gastos"}
        available=summary.get("available",0)
        if available<=0:return {"title":"Todo está comprometido","message":"El dinero registrado ya tiene un destino. Antes de agregar otra obligación, revisa tus gastos y ahorro.","action":"Revisar mi dinero"}
        if summary.get("savings",0)<=0:
            return {"title":"Tienes margen","message":"Tienes dinero disponible y todavía no registraste ahorro. Puedes revisar cuánto separar para el futuro.","action":"Planear ahorro"}
        return {"title":"Vas teniendo control","message":"Hay dinero disponible y ya registraste ahorro. Puedes revisar tu límite diario para gastar sin perder el control.","action":"Ver disponible diario"}

    def financial_snapshot(self,request:FinancialSnapshotRequest)->Dict[str,Any]:
        records=[self.normalize_record(x) for x in request.records]
        summary=self.summarize_records(records,request.income,request.period)
        action=self.financial_action(summary,request.language)
        return {"version":"1.0","created_at":request.created_at or self.now(),"language":request.language,"period":request.period,"summary":summary,"records":[x.model_dump() for x in records],"action_message":action["message"],"next_action":action["action"],"informational":True,"source":"local_device"}

    def import_snapshot(self,request:SnapshotImportRequest)->Dict[str,Any]:
        raw=request.snapshot or {};raw_records=raw.get("records",[]) if isinstance(raw,dict) else []
        added=[];ignored=[];review=[]
        existing=[self.normalize_record(x) for x in request.existing_records]
        for raw_record in raw_records:
            try:
                record=MoneyRecord(**raw_record);decision=self.decide_record(RecordDecisionRequest(record=record,existing_records=existing,language=request.language))
                if decision["action"]=="add":
                    normalized=decision["normalized_record"];added.append(normalized);existing.append(normalized)
                elif decision["action"]=="ignore":ignored.append(record)
                else:review.append(record)
            except Exception:
                continue
        income=self._clean_amount(raw.get("summary",{}).get("income",0)) if isinstance(raw.get("summary"),dict) else 0
        summary=self.summarize_records(existing,income,raw.get("period","monthly"))
        message=f"Se añadieron {len(added)} datos. {len(ignored)} ya estaban registrados y no se duplicaron."
        return {"success":True,"added":added,"ignored":ignored,"review":review,"summary":summary,"message":message}

    def compare_evolution(self,request:EvolutionRequest)->Dict[str,Any]:
        current=self.summarize_records(request.current_records,request.income,request.period);previous=self.summarize_records(request.previous_records,request.income,request.period)
        keys=["income","essential","flexible","other_expense","savings","remittance","purchase","family","available","daily_available","weekly_available","biweekly_available","monthly_available"]
        changes={k:round(current.get(k,0)-previous.get(k,0),2) for k in keys};direction={}
        for k,v in changes.items():
            direction[k]="up" if v>0 else "down" if v<0 else "same"
        if changes["available"]>0:
            message="Tu dinero disponible mejoró respecto al registro anterior."
            action="Mantener lo que está funcionando."
        elif changes["available"]<0:
            message="Tu dinero disponible bajó respecto al registro anterior."
            action="Revisar gastos, remesas o compras antes de asumir nuevas obligaciones."
        else:
            message="Tu disponibilidad se mantiene igual."
            action="Continuar registrando para ver la evolución."
        return {"success":True,"current":current,"previous":previous,"changes":changes,"direction":direction,"message":message,"action":action,"confidence":"informational"}

    def purchase_effect(self,request:PurchasePlanRequest)->Dict[str,Any]:
        before=self.calculate_money_plan(request.income,request.essential,request.flexible,request.savings,request.remittance,0,0,request.period)
        after=self.calculate_money_plan(request.income,request.essential,request.flexible,request.savings,request.remittance,request.amount,0,request.period)
        affordable=after["available"]>=0
        if affordable:
            message="La compra cabe dentro del dinero registrado, pero reducirá tu disponible."
            action="Si decides comprar, registra la compra para que el cálculo quede actualizado."
            recommendation="Puedes comprar según los datos registrados."
        else:
            message="La compra supera el dinero disponible registrado."
            action="Reduce, pospone o busca otra forma de financiarla antes de pagar."
            recommendation="No la trates como gasto disponible todavía."
        return {"success":True,"purchase_amount":request.amount,"available_before":before["available"],"available_after":after["available"],"affordable":affordable,"message":message,"action":action,"recommendation":recommendation}

    def provider_handoff(self,provider_id:str,country:str,language:str="es")->Dict[str,Any]:
        provider=self.get_provider(provider_id)
        if not provider:return {"success":False,"message":"Proveedor no encontrado." if language=="es" else "Provider not found.","continue_url":None}
        url=self.provider_url(provider,language)
        return {"success":bool(url),"provider_id":provider_id,"provider_name":provider.get("name",provider_id),"continue_url":url,"message":("La información comercial actual no está verificada. Puedes continuar al sitio oficial para comprobarla." if language=="es" else "Current commercial information is not verified. You can continue to the official site to check it.")}

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es";opening=self.brain.get("opening",{});opening_lang=opening.get(language,{}) if isinstance(opening,dict) else {}
        countries=[{"id":x.get("code"),"code":x.get("code"),"name":self.localize(x.get("name"),language) or x.get("code"),"currency":self.brain.get("countries",{}).get("default_currency","USD")} for x in self.get_supported_countries()]
        providers=[{"id":p.get("id"),"name":p.get("name"),"enabled":p.get("enabled",True),"continue_url":self.provider_url(p,language),"official_site":p.get("official_site") or p.get("official_url") or self.provider_url(p,language),"payment_methods":deepcopy(p.get("payment_methods",[])),"delivery_methods":deepcopy(p.get("delivery_methods",[]))} for p in self.get_provider_registry()]
        messages={k:self.localize(v,language) for k,v in self.brain.get("messages",{}).items()} if isinstance(self.brain.get("messages",{}),dict) else {}
        return {"app":deepcopy(self.brain.get("app",{})),"language":language,"supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),"opening":opening_lang,"conversation_logic":deepcopy(self.brain.get("conversation_logic",{})),"remittance_flow":deepcopy(self.brain.get("remittance_flow",{})),"countries":countries,"providers":providers,"delivery_methods":self._brain_options("delivery_methods",language),"payment_methods":self._brain_options("payment_methods",language),"messages":messages,"help_topics":self.help_topics(language),"provider_comparison":deepcopy(self.brain.get("provider_comparison",{})),"provider_handoff":deepcopy(self.brain.get("provider_handoff",{})),"money_planner":deepcopy(self.brain.get("money_planner",{})),"security":deepcopy(self.brain.get("security",{})),"privacy":deepcopy(self.brain.get("data_privacy",{}))}

engine=RemittanceEngine()
