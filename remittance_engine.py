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
        try:
            with path.open("r",encoding="utf-8") as f:data=json.load(f)
        except json.JSONDecodeError as exc:raise ValueError(f"Invalid JSON in {path.name}: {exc}") from exc
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
            return {"version":"fallback","providers":deepcopy(self.brain.get("providers",[])),"corridors":{}}
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):data["providers"]=[]
        return data

    def now(self)->str:return datetime.now(timezone.utc).isoformat()

    def localize(self,value:Any,language:str="es")->str:
        if value is None:return ""
        if isinstance(value,(str,int,float,bool)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            if "es" in value:return self.localize(value["es"],"es")
            if "en" in value:return self.localize(value["en"],"en")
            for key in ("label","name","title","text","value"):
                if key in value:return self.localize(value[key],language)
            if "id" in value:return str(value["id"])
        if isinstance(value,list):
            return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        return self.localize(self.brain.get("messages",{}).get(key,{}),language)

    def _message(self,key:str,language:str="es")->str:
        return self.language_text(key,language)

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        value=self.brain.get("countries",{}).get("country_names",{}).get(code)
        if isinstance(value,dict):return value
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        value=destinations.get(code) if isinstance(destinations,dict) else None
        return value if isinstance(value,dict) else None

    def country_name(self,country_code:str,language:str="es")->str:
        code=(country_code or "").strip().upper()
        value=self.get_country(code)
        if not value:return code
        name=self.localize(value,language)
        return name or code

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not isinstance(providers,list) or not providers:
            providers=self.brain.get("providers",[])
        return [deepcopy(p) for p in providers if isinstance(p,dict) and p.get("enabled",True)]

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=(provider_id or "").strip().lower()
        for provider in self.get_provider_registry():
            if str(provider.get("id","")).lower()==pid:return provider
        return None

    def _url(self,value:Any)->Optional[str]:
        return value if isinstance(value,str) and value.startswith(("http://","https://")) else None

    def provider_urls(self,provider:Dict[str,Any])->Dict[str,str]:
        urls=provider.get("official_urls",{})
        return {str(k):v for k,v in urls.items() if self._url(v)} if isinstance(urls,dict) else {}

    def provider_url(self,provider:Dict[str,Any],language:str="es",topic:str="send")->Optional[str]:
        urls=self.provider_urls(provider)
        if topic in urls:return urls[topic]
        aliases={
            "send":["us_send_es","us_send","send","us_es","es","main"],
            "fees":["fees","fee"],
            "help":["help","support"],
            "security":["security","fraud"],
            "requirements":["requirements","limits"],
            "limits":["limits","requirements"],
            "home":["home","main"]
        }
        keys=aliases.get(topic,aliases["send"])
        if language=="en":
            keys=[x.replace("_es","").replace("us_send_es","us_send") for x in keys]+keys
        for key in keys:
            if key in urls:return urls[key]
        return self._url(provider.get("official_site"))

    def corridor_provider_ids(self,country:str)->List[str]:
        code=(country or "").upper()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        ids=corridor.get("providers",[]) if isinstance(corridor,dict) else []
        if isinstance(ids,list) and ids:
            return [str(pid) for pid in ids if self.get_provider(str(pid))]
        return [str(p.get("id")) for p in self.get_provider_registry() if p.get("id")]

    def candidate_provider_ids(self,country:str)->List[str]:
        code=(country or "").upper()
        supported=self.brain.get("countries",{}).get("initial_supported",[])
        if supported and code not in [str(x).upper() for x in supported]:return []
        ids=self.corridor_provider_ids(code)
        if not ids:ids=[str(p.get("id")) for p in self.get_provider_registry() if p.get("id")]
        return ids

    def _commercial_verified(self,commercial:Any)->bool:
        if not isinstance(commercial,dict):return False
        status=str(commercial.get("status","")).lower()
        return status=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not self._commercial_verified(commercial):return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=(country or "").upper()
        return result

    def _human_payment(self,value:Any,language:str)->str:
        mapping={
            "bank_account":{"es":"Cuenta bancaria","en":"Bank account"},
            "debit_card":{"es":"Tarjeta de débito","en":"Debit card"},
            "credit_card":{"es":"Tarjeta de crédito","en":"Credit card"},
            "cash":{"es":"Efectivo","en":"Cash"},
            "digital_wallet":{"es":"Billetera digital","en":"Digital wallet"}
        }
        return mapping.get(str(value),{}).get(language,self.localize(value,language))

    def _human_delivery(self,value:Any,language:str)->str:
        mapping={
            "bank_account":{"es":"Cuenta bancaria","en":"Bank account"},
            "cash_pickup":{"es":"Recibir en efectivo","en":"Cash pickup"},
            "mobile_wallet":{"es":"Billetera digital","en":"Digital wallet"},
            "home_delivery":{"es":"Entrega a domicilio","en":"Home delivery"}
        }
        return mapping.get(str(value),{}).get(language,self.localize(value,language))

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        verified=self._commercial_verified(commercial)
        urls=self.provider_urls(provider)
        send_url=self.provider_url(provider,language,"send")
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
            "estimated_delivery":commercial.get("delivery_time") if verified else None,
            "recipient_currency":commercial.get("currency") if verified else None,
            "currency":commercial.get("currency") if verified else None,
            "delivery_method":commercial.get("delivery_method") if verified else None,
            "payment_method":commercial.get("payment_method") if verified else None,
            "important_condition":commercial.get("important_condition") if verified else None,
            "source":commercial.get("source") if verified else None,
            "verified_at":commercial.get("verified_at") if verified else None,
            "continue_url":send_url,
            "official_site":self._url(provider.get("official_site")) or send_url,
            "official_urls":urls,
            "help_urls":{
                "send":send_url,
                "fees":self.provider_url(provider,language,"fees"),
                "help":self.provider_url(provider,language,"help"),
                "security":self.provider_url(provider,language,"security"),
                "requirements":self.provider_url(provider,language,"requirements"),
                "limits":self.provider_url(provider,language,"limits")
            },
            "supports_online":bool(provider.get("supports_online",True)),
            "supports_agent":bool(provider.get("supports_agent",False)),
            "payment_methods":[{"id":x.get("id"),"label":self._human_payment(x.get("id"),language)} if isinstance(x,dict) else {"id":str(x),"label":self._human_payment(x,language)} for x in provider.get("payment_methods",[])],
            "delivery_methods":[{"id":x.get("id"),"label":self._human_delivery(x.get("id"),language)} if isinstance(x,dict) else {"id":str(x),"label":self._human_delivery(x,language)} for x in provider.get("delivery_methods",[])],
            "requirements":self.provider_requirements(provider_id,language)
        }

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        sid=str(uuid.uuid4())
        state={
            "session_id":sid,"language":language,"amount":None,"send_currency":"USD",
            "destination_country":None,"priority":None,"urgency":None,
            "delivery_method":None,"payment_method":None,"special_need":None,
            "free_text":None,"parsed_user_need":None,"need_type":None,
            "candidate_providers":[],"available_providers":[],"verified_results":[],
            "selected_option":None,"final_check":{},"current_step":"opening",
            "created_at":self.now(),"updated_at":self.now()
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
        for raw in re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text or "",re.I):
            try:
                value=float(raw.replace(",",""))
                if value>0:return value
            except ValueError:pass
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        aliases={
            "méxico":"MX","mexico":"MX","mexican":"MX","mexicana":"MX",
            "guatemala":"GT","el salvador":"SV","salvador":"SV","honduras":"HN",
            "nicaragua":"NI","costa rica":"CR","panamá":"PA","panama":"PA",
            "república dominicana":"DO","republica dominicana":"DO","dominicana":"DO",
            "colombia":"CO","venezuela":"VE","ecuador":"EC","perú":"PE","peru":"PE",
            "bolivia":"BO","paraguay":"PY","brasil":"BR","brazil":"BR","chile":"CL",
            "argentina":"AR","uruguay":"UY","cuba":"CU","haití":"HT","haiti":"HT"
        }
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",value):return code
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        patterns=[
            ("recipient_gets_more",["reciba más","reciba mas","receive more","más dinero","mas dinero","more money"]),
            ("fastest",["rápido","rapido","rápidamente","rapidamente","fast","quick","speed"]),
            ("urgent",["urgente","urgent","hoy","today","ahora","now","asap"]),
            ("save",["ahorrar","ahorro","save","cheap","barato","menos costo","menor costo"]),
            ("balanced",["equilibrio","balance","balanced"]),
            ("compare_all",["comparar","compare","comparación","comparacion","opciones","options"])
        ]
        for priority,terms in patterns:
            if any(term in value for term in terms):return priority
        return None

    def classify_need(self,text:str,language:str="es")->Dict[str,Any]:
        value=(text or "").lower()
        categories=[
            ("remittance",["enviar dinero","mandar dinero","manda dinero","remesa","remesas","transferir","transferencia","send money","remittance","transfer money"]),
            ("money_available",["cuánto puedo gastar","cuanto puedo gastar","dinero disponible","money available","how much can i spend"]),
            ("budget",["presupuesto","organizar mi dinero","organizar dinero","budget","plan my money","planificar mi dinero"]),
            ("expenses",["gastos","gasto","expense","expenses","en qué gasto","en que gasto"]),
            ("savings",["ahorrar","ahorro","save money","savings","guardar dinero"]),
            ("purchase",["comprar","compra","purchase","shopping","quiero comprar"]),
            ("family",["familia","familiar","family","mamá","mama","madre","padre"]),
            ("requirements",["requisito","requisitos","qué necesito","que necesito","documentos","requirements","what do i need"]),
            ("personal_information",["información personal","informacion personal","datos personales","identificación","identificacion","personal information"]),
            ("fees",["comisión","comision","tarifa","cargo","fee","fees","costo de envío","costo de envio"]),
            ("exchange_rate",["tasa de cambio","tipo de cambio","exchange rate","cambio"]),
            ("delivery",["cuándo llega","cuando llega","entrega","delivery","cuánto tarda","cuanto tarda"]),
            ("provider_difference",["diferencia entre","diferencias","cuál es la diferencia","cual es la diferencia","difference between"]),
            ("mistake_prevention",["me equivoqué","me equivoque","error","mistake","wrong information"]),
            ("cancellation",["cancelar","cancelación","cancelacion","cancel","canceled"]),
            ("recipient_information",["beneficiario","destinatario","recipient","beneficiary","datos del que recibe"]),
            ("security",["seguro","seguridad","estafa","fraude","security","scam","fraud"])
        ]
        for topic,terms in categories:
            if any(term in value for term in terms):return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text or ""
        classification=self.classify_need(text,request.language)
        priority=self._priority_from_text(text)
        amount=self._amount_from_text(text)
        country=self._country_from_text(text)
        return {
            "need_type":classification["need_type"],
            "amount":amount,
            "destination_country":country,
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
        if request.language in ("es","en"):values["language"]=request.language
        values["need_type"]=getattr(request,"need_type",None) or self.classify_need(request.free_text or "",request.language).get("need_type","remittance")
        values["current_step"]="comparison" if values["need_type"]=="remittance" else "assistant"
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
            continue_url=self.provider_url(provider,language,"send"),
            official_url=self._url(provider.get("official_site")) or self.provider_url(provider,language,"send")
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
            for provider in available:
                value=provider.get(key)
                if value:
                    values.append({"provider_id":provider.get("provider_id"),"provider_name":provider.get("provider_name"),"value":value})
            if values:differences.append({"id":dim,"label":en if language=="en" else es,"values":values})
        return differences

    def compare_session(self,session_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        if not state.get("amount") or not state.get("destination_country"):raise ValueError("Amount and destination country are required.")
        request=ComparisonRequest(
            amount=state.get("amount"),
            destination_country=state.get("destination_country"),
            priority=state.get("priority"),
            urgency=state.get("urgency"),
            delivery_method=state.get("delivery_method"),
            payment_method=state.get("payment_method"),
            language=state.get("language","es"),
            send_currency=state.get("send_currency","USD"),
            special_need=state.get("special_need")
        )
        return self.compare(request,session_id)

    def compare(self,request:ComparisonRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=(request.destination_country or "").upper()
        if request.amount<=0:raise ValueError("Amount must be greater than zero.")
        if not country:raise ValueError("Destination country is required.")
        provider_ids=list(request.provider_ids) if getattr(request,"provider_ids",[]) else self.candidate_provider_ids(country)
        available=[]
        verified_results=[]
        for pid in provider_ids:
            provider=self.get_provider(pid)
            if not provider:continue
            public=self.provider_public_option(pid,country,language)
            if public:available.append(public)
            commercial=self.get_verified_provider_data(pid,country,request.amount,request.payment_method,request.delivery_method)
            if commercial:verified_results.append(self._build_verified_result(provider,commercial,request,language))
        verified_ids={x.provider_id for x in verified_results}
        for item in available:
            item["commercial_status"]="verified" if item.get("provider_id") in verified_ids else "unavailable"
            item["commercial_verified"]=item.get("provider_id") in verified_ids
        if session_id in self.sessions:
            state=self.sessions[session_id]
            state["candidate_providers"]=[x["provider_id"] for x in available]
            state["available_providers"]=deepcopy(available)
            state["verified_results"]=[x.model_dump() for x in verified_results]
            state["current_step"]="results"
            state["updated_at"]=self.now()
        if verified_results:
            message=self._message("results_ready",language) or ("Hay datos comerciales verificados para revisar." if language=="es" else "Verified commercial data is available to review.")
        else:
            message=self._message("no_results",language) or ("Los datos comerciales actuales no están verificados. Puedes revisar cada proveedor desde su sitio oficial." if language=="es" else "Current commercial data is not verified. You can review each provider on its official site.")
        return {
            "success":True,
            "message":message,
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
            "language":language,
            "explanation":self.comparison_explanation(language,bool(verified_results)),
            "differences":self._differences(available,language),
            "precautions":self._precautions(language)
        }

    def comparison_explanation(self,language:str="es",verified:bool=False)->str:
        if verified:return "Los datos mostrados como verificados tienen una fuente y fecha de verificación. Revísalos antes de continuar." if language=="es" else "Data marked as verified has a source and verification date. Review it before continuing."
        return "No mostramos tarifas, tasas, tiempos ni cantidades como actuales cuando no están verificadas." if language=="es" else "We do not show fees, rates, delivery times or recipient amounts as current when they are not verified."

    def _precautions(self,language:str="es")->List[str]:
        if language=="en":
            return ["Fees and exchange rates can change before you complete a transfer.","Review recipient information before confirming.","Never share passwords, CVV, login credentials or security codes with this app.","The transfer is completed on the provider's official website."]
        return ["Las comisiones y tasas de cambio pueden cambiar antes de completar el envío.","Revisa los datos del destinatario antes de confirmar.","Nunca compartas con esta aplicación contraseñas, CVV, claves de acceso ni códigos de seguridad.","El envío se completa en el sitio oficial del proveedor."]

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        provider=self.get_provider(provider_id)
        if not provider:raise KeyError("provider_not_found")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_available")
        state["selected_option"]=deepcopy(option)
        state["current_step"]="final_check"
        state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=self.country_name(request.destination_country,language)
        checks=[
            {"id":"destination","label":"País de destino" if language=="es" else "Destination country","value":country,"complete":bool(request.destination_country),"status":"ok" if request.destination_country else "review"},
            {"id":"amount","label":"Cantidad a enviar" if language=="es" else "Amount to send","value":f"{request.amount:.2f} {request.send_currency}","complete":request.amount>0,"status":"ok" if request.amount>0 else "review"},
            {"id":"currency","label":"Moneda del envío" if language=="es" else "Sending currency","value":request.send_currency,"complete":bool(request.send_currency),"status":"ok" if request.send_currency else "review"},
            {"id":"delivery_method","label":"Forma de entrega" if language=="es" else "Delivery method","value":self._human_delivery(request.delivery_method,language) if request.delivery_method else ("Revisar en el proveedor" if language=="es" else "Review on provider site"),"complete":bool(request.delivery_method),"status":"ok" if request.delivery_method else "review"},
            {"id":"recipient_information","label":"Datos del destinatario" if language=="es" else "Recipient information","value":"Revisar en el proveedor" if language=="es" else "Review on provider site","complete":True,"status":"review"},
            {"id":"fee","label":"Comisión" if language=="es" else "Fee",""value":request.fee if request.fee is not None else ("No verificada" if language=="es" else "Not verified")","complete":request.fee is not None,"status":"ok" if request.fee is not None else "review"},
            {"id":"exchange_rate","label":"Tasa de cambio" if language=="es" else "Exchange rate","value=request.exchange_rate if request.exchange_rate is not None else ('No verificada' if language=='es' else 'Not verified')","complete":request.exchange_rate is not None,"status":"ok" if request.exchange_rate is not None else "review"},
            {"id":"recipient_amount","label":"Cantidad que recibiría" if language=="es" else "Recipient amount","value":request.recipient_amount if request.recipient_amount is not None else ('No verificada' if language=='es' else 'Not verified'),"complete":request.recipient_amount is not None,"status":"ok" if request.recipient_amount is not None else "review"}
        ]
        required={"destination","amount","currency"}
        valid=all(x["complete"] for x in checks if x["id"] in required)
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
            return "The basic information is ready. Review the provider's final terms before continuing." if valid else "Review the information that still needs attention before continuing."
        return "La información básica está lista. Revisa las condiciones finales del proveedor antes de continuar." if valid else "Revisa la información que todavía necesita atención antes de continuar."

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:return []
        requirements=provider.get("requirements",[])
        if not isinstance(requirements,list):return []
        result=[]
        for item in requirements:
            if isinstance(item,str):result.append(item)
            elif isinstance(item,dict):
                value=self.localize(item,language)
                if value:result.append(value)
        return result

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        guidance=self.brain.get("provider_guidance",{})
        topics=guidance.get("help_topics",[]) if isinstance(guidance,dict) else []
        if not topics:
            topics=[
                {"id":"exchange_rate","label":{"es":"¿Qué es la tasa de cambio?","en":"What is an exchange rate?"},"answer":{"es":"Es la relación entre la moneda que envías y la moneda que recibe la otra persona.","en":"It is the relationship between the currency you send and the currency the other person receives."}},
                {"id":"fees","label":{"es":"¿Qué es una comisión?","en":"What is a fee?"},"answer":{"es":"Es un cargo que puede aplicar el proveedor por el servicio.","en":"It is a charge the provider may apply for the service."}},
                {"id":"recipient_amount","label":{"es":"¿Por qué recibe menos?","en":"Why does the recipient receive less?"},"answer":{"es":"La comisión y la tasa de cambio pueden afectar la cantidad final.","en":"The fee and exchange rate can affect the final amount."}},
                {"id":"identification","label":{"es":"¿Por qué me piden identificación?","en":"Why am I asked for identification?"},"answer":{"es":"El proveedor puede solicitar información para verificar identidad y cumplir sus propios requisitos.","en":"The provider may request information to verify identity and meet its own requirements."}},
                {"id":"mistake","label":{"es":"¿Qué hago si me equivoqué?","en":"What if I made a mistake?"},"answer":{"es":"No confirmes todavía. Revisa los datos y consulta al proveedor antes de completar el envío.","en":"Do not confirm yet. Review the information and contact the provider before completing the transfer."}},
                {"id":"security","label":{"es":"¿Qué información no debo compartir aquí?","en":"What information should I not share here?"},"answer":{"es":"No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"Do not enter passwords, CVV numbers, security codes or login credentials."}}
            ]
        return [{"id":x.get("id"),"label":self.localize(x.get("label"),language),"answer":self.localize(x.get("answer"),language)} for x in topics if isinstance(x,dict)]

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        lang=language if language in ("es","en") else "es"
        responses={
            "remittance":{"es":"Para ayudarte a comparar un envío necesito principalmente la cantidad y el país de destino. Después podemos revisar las opciones disponibles.","en":"To compare a transfer, I mainly need the amount and destination country. Then we can review the available options."},
            "money_available":{"es":"Esta sección sirve para organizar el dinero que tienes y calcular cuánto queda después de tus gastos, ahorros y envíos que tú registres.","en":"This section helps organize the money you have and calculate what remains after the expenses, savings and transfers you enter."},
            "budget":{"es":"Aquí puedes organizar ingresos, gastos, remesas y ahorro para ver qué queda disponible.","en":"Here you can organize income, expenses, transfers and savings to see what remains available."},
            "expenses":{"es":"Anota tus gastos para entender en qué se va tu dinero antes de enviar, comprar o ahorrar.","en":"Record your expenses to understand where your money goes before sending, buying or saving."},
            "savings":{"es":"Puedes registrar una cantidad de ahorro y ver cómo cambia el dinero disponible.","en":"You can record a savings amount and see how it changes the money available."},
            "purchase":{"es":"Puedes registrar una compra y revisar cómo afectaría el dinero que te queda.","en":"You can record a purchase and review how it would affect the money you have left."},
            "family":{"es":"Puedes guardar localmente las personas y destinos que usas con frecuencia.","en":"You can store frequent people and destinations locally."},
            "requirements":{"es":"Los requisitos pueden cambiar según el proveedor, país, cantidad y método. La aplicación te ayuda a entender qué puede pedirte el proveedor.","en":"Requirements can vary by provider, country, amount and method. The app helps you understand what the provider may request."},
            "personal_information":{"es":"Esta aplicación no necesita tus contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"This app does not need your passwords, CVV numbers, security codes or login credentials."},
            "fees":{"es":"La comisión es un cargo que puede aplicar el proveedor. Revisa el cargo final antes de confirmar.","en":"A fee is a charge the provider may apply. Review the final charge before confirming."},
            "exchange_rate":{"es":"La tasa de cambio determina cuánto vale la moneda enviada en la moneda que recibe el destinatario.","en":"The exchange rate determines how much the sent currency is worth in the recipient's currency."},
            "delivery":{"es":"El tiempo de entrega puede depender del proveedor, país, método y condiciones del envío.","en":"Delivery time can depend on the provider, country, method and transfer conditions."},
            "provider_difference":{"es":"Las diferencias pueden estar en comisión, tasa de cambio, cantidad recibida, velocidad, entrega, pago y requisitos.","en":"Differences can include fees, exchange rate, recipient amount, speed, delivery, payment and requirements."},
            "mistake_prevention":{"es":"Si detectas un error, no confirmes el envío. Revisa los datos y consulta al proveedor.","en":"If you find an error, do not confirm the transfer. Review the information and contact the provider."},
            "cancellation":{"es":"Las reglas de cancelación dependen del proveedor y del estado del envío.","en":"Cancellation rules depend on the provider and transfer status."},
            "recipient_information":{"es":"Los datos del destinatario deben coincidir con los requisitos del método elegido.","en":"Recipient information must match the requirements of the selected method."},
            "security":{"es":"Nunca introduzcas aquí contraseñas, CVV, códigos de seguridad, claves bancarias ni credenciales del proveedor.","en":"Never enter passwords, CVV numbers, security codes, bank credentials or provider login information here."},
            "other":{"es":"Cuéntame qué necesitas. Primero identificaremos qué tipo de ayuda necesitas.","en":"Tell me what you need. We will first identify what kind of help you need."}
        }
        item=responses.get(need_type,responses["other"])
        return {"success":True,"need_type":need_type,"message":item[lang],"language":lang,"remittance_required":need_type=="remittance"}

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        opening=self.brain.get("opening",{})
        countries=[]
        names=self.brain.get("countries",{}).get("country_names",{})
        supported=self.brain.get("countries",{}).get("initial_supported",[])
        for code in supported:
            item=names.get(code,{})
            countries.append({"id":code,"name":self.localize(item,language) or str(code),"currency":item.get("currency") if isinstance(item,dict) else None})
        providers=[]
        for provider in self.get_provider_registry():
            providers.append({
                "id":provider.get("id"),
                "name":provider.get("name"),
                "enabled":provider.get("enabled",True),
                "continue_url":self.provider_url(provider,language,"send"),
                "official_site":self._url(provider.get("official_site")),
                "payment_methods":[{"id":x.get("id"),"label":self._human_payment(x.get("id"),language)} if isinstance(x,dict) else {"id":str(x),"label":self._human_payment(x,language)} for x in provider.get("payment_methods",[])],
                "delivery_methods":[{"id":x.get("id"),"label":self._human_delivery(x.get("id"),language)} if isinstance(x,dict) else {"id":str(x),"label":self._human_delivery(x,language)} for x in provider.get("delivery_methods",[])]
            })
        delivery=self.brain.get("delivery_methods",[])
        payment=self.brain.get("payment_methods",[])
        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{
                "primary_question":self.localize(opening.get("primary_question"),language),
                "secondary_text":self.localize(opening.get("secondary_text"),language),
                "amount":deepcopy(opening.get("amount",{})),
                "priorities":deepcopy(opening.get("priorities",[])),
                "free_text":deepcopy(opening.get("free_text",{}))
            },
            "countries":countries,
            "providers":providers,
            "delivery_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in delivery if isinstance(x,dict)],
            "payment_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in payment if isinstance(x,dict)],
            "messages":{k:self.localize(v,language) for k,v in self.brain.get("messages",{}).items()},
            "help_topics":self.help_topics(language),
            "provider_handoff":{
                "button":self.localize(self.brain.get("provider_handoff",{}).get("button"),language),
                "external_notice":self.localize(self.brain.get("provider_handoff",{}).get("external_notice"),language)
            }
        }

engine=RemittanceEngine()
