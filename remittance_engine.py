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
        self.providers_data=self.load_providers()

    def _read_json(self,path:Path)->Dict[str,Any]:
        if not path.exists():raise FileNotFoundError(f"Required data file not found: {path}")
        try:
            with path.open("r",encoding="utf-8") as f:data=json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {path.name}: {e}") from e
        if not isinstance(data,dict):raise ValueError(f"Invalid JSON root in {path.name}")
        return data

    def load_brain(self)->Dict[str,Any]:
        self.brain=self._read_json(BRAIN_PATH)
        required=["app","countries","providers","comparison","validation","security","languages"]
        missing=[x for x in required if x not in self.brain]
        if missing:raise ValueError("Invalid app_brain.json. Missing sections: "+", ".join(missing))
        return deepcopy(self.brain)

    def load_providers(self)->Dict[str,Any]:
        if not PROVIDERS_PATH.exists():
            return {"version":"fallback","providers":[],"country_policy":{}}
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):data["providers"]=[]
        return data

    def now(self)->str:
        return datetime.now(timezone.utc).isoformat()

    def localize(self,value:Any,language:str="es")->str:
        if value is None:return ""
        if isinstance(value,bool):return "Sí" if value else "No"
        if isinstance(value,(str,int,float)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            if "es" in value:return self.localize(value["es"],"es")
            if "en" in value:return self.localize(value["en"],"en")
            for key in ("label","name","title","text"):
                if key in value:return self.localize(value[key],language)
            return ""
        if isinstance(value,list):
            return ", ".join(x for x in (self.localize(v,language) for v in value) if x)
        return str(value)

    def language_text(self,key:str,language:str="es")->str:
        messages=self.brain.get("messages",{})
        return self.localize(messages.get(key,{}),language)

    def _message(self,key:str,language:str="es")->str:
        return self.language_text(key,language)

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        countries=self.brain.get("countries",{})
        names=countries.get("country_names",{})
        value=names.get(code)
        if isinstance(value,dict):return value
        return None

    def country_name(self,country_code:str,language:str="es")->str:
        code=(country_code or "").strip().upper()
        value=self.get_country(code)
        if not value:return code
        name=self.localize(value,language)
        return name or code

    def supported_country(self,country:str)->bool:
        code=(country or "").strip().upper()
        supported=self.brain.get("countries",{}).get("initial_supported",[])
        return code in [str(x).upper() for x in supported]

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not isinstance(providers,list):providers=[]
        result=[]
        for provider in providers:
            if isinstance(provider,dict) and provider.get("id"):
                if provider.get("enabled",True):result.append(deepcopy(provider))
        return result

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=(provider_id or "").strip().lower()
        for provider in self.get_provider_registry():
            if str(provider.get("id","")).lower()==pid:return provider
        return None

    def provider_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):urls={}
        if language=="es":
            keys=["send_money_es","us_send_es","send_money","home"]
        else:
            keys=["send_money_en","us_send","send_money","home"]
        for key in keys:
            url=urls.get(key)
            if isinstance(url,str) and url.startswith(("https://","http://")):return url
        url=provider.get("official_site")
        if isinstance(url,str) and url.startswith(("https://","http://")):return url
        return None

    def provider_help_url(self,provider:Dict[str,Any],topic:str,language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):urls={}
        topic_keys={
            "fees":["fees","fee","cost"],
            "help":["help"],
            "limits":["limits","send_limits"],
            "security":["security"],
            "send_money":["send_money_es","send_money","home"]
        }
        keys=topic_keys.get(topic,["help","send_money","home"])
        if language=="en":
            keys=[x for x in keys]+["send_money_en","us_send"]
        for key in keys:
            url=urls.get(key)
            if isinstance(url,str) and url.startswith(("https://","http://")):return url
        return self.provider_url(provider,language)

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):commercial={}
        verified=str(commercial.get("status","")).lower()=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))
        url=self.provider_url(provider,language)
        return {
            "provider_id":provider.get("id"),
            "provider_name":provider.get("name",provider.get("id")),
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
            "official_site":provider.get("official_site") or url,
            "payment_methods":deepcopy(provider.get("payment_methods",[])),
            "delivery_methods":deepcopy(provider.get("delivery_methods",[])),
            "supports_online":provider.get("supports_online",True),
            "supports_agent":provider.get("supports_agent",False)
        }

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:return []
        requirements=provider.get("requirements",[])
        if not isinstance(requirements,list):return []
        result=[]
        for item in requirements:
            text=self.localize(item,language)
            if text:result.append(text)
        return result

    def candidate_provider_ids(self,country:str)->List[str]:
        if not self.supported_country(country):return []
        return [str(p.get("id")) for p in self.get_provider_registry() if p.get("id")]

    def get_verified_provider_data(self,provider_id:str,country:str,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):return None
        if str(commercial.get("status","")).lower()!="verified":return None
        if not commercial.get("source") or not commercial.get("verified_at"):return None
        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=(country or "").upper()
        return result

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        sid=uuid.uuid4().hex
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
            "need_type":None,
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
        state=self.sessions.get(session_id)
        return deepcopy(state) if state else None

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
            except ValueError:
                pass
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        normalized=(text or "").lower()
        aliases={
            "méxico":"MX","mexico":"MX","mexican":"MX",
            "guatemala":"GT","el salvador":"SV","salvador":"SV",
            "honduras":"HN","nicaragua":"NI","costa rica":"CR",
            "panamá":"PA","panama":"PA","república dominicana":"DO",
            "republica dominicana":"DO","dominicana":"DO","colombia":"CO",
            "venezuela":"VE","ecuador":"EC","perú":"PE","peru":"PE",
            "bolivia":"BO","paraguay":"PY","brasil":"BR","brazil":"BR",
            "chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU",
            "haití":"HT","haiti":"HT"
        }
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",normalized):return code
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        groups=[
            ("fastest",["rápido","rapido","fast","quick","urgente","urgent","hoy","today","ahora","now","asap"]),
            ("save",["barato","barata","económico","economico","ahorrar","ahorro","cheap","save","menos costo"]),
            ("simple",["fácil","facil","sencillo","simple","easy"]),
            ("recipient_gets_more",["reciba más","reciba mas","más dinero","mas dinero","receive more"]),
            ("compare_all",["comparar","compare","comparación","comparacion","opciones","options"])
        ]
        for priority,terms in groups:
            if any(term in value for term in terms):return priority
        return None

    def classify_need(self,text:str,language:str="es")->Dict[str,Any]:
        value=(text or "").strip().lower()
        categories=[
            ("remittance",["enviar dinero","mandar dinero","envíar dinero","enviar","mandar","remesa","remesas","transferir","transferencia","send money","remittance","transfer money"]),
            ("money_available",["dinero disponible","cuánto puedo gastar","cuanto puedo gastar","money available","how much can i spend"]),
            ("budget",["presupuesto","organizar mi dinero","organizar dinero","budget","plan my money"]),
            ("expenses",["gastos","gasto","expense","expenses","en qué gasto","en que gasto"]),
            ("savings",["ahorrar","ahorro","save money","savings","guardar dinero"]),
            ("purchase",["comprar","compra","purchase","shopping","quiero comprar"]),
            ("family",["familia","familiar","family","mamá","mama","madre","padre"]),
            ("requirements",["requisito","requisitos","qué necesito","que necesito","documentos","requirements","what do i need"]),
            ("personal_information",["información personal","informacion personal","datos personales","identificación","identificacion","personal information"]),
            ("fees",["comisión","comision","tarifa","cargo","fee","fees","costo de envío","costo de envio"]),
            ("exchange_rate",["tasa de cambio","tipo de cambio","exchange rate"]),
            ("delivery",["cuándo llega","cuando llega","entrega","delivery","cuánto tarda","cuanto tarda"]),
            ("provider_difference",["diferencia entre","diferencias","cuál es la diferencia","cual es la diferencia","difference between"]),
            ("mistake_prevention",["me equivoqué","me equivoque","error","mistake","wrong information"]),
            ("cancellation",["cancelar","cancelación","cancelacion","cancel","canceled"]),
            ("recipient_information",["beneficiario","destinatario","recipient","beneficiary"]),
            ("security",["seguridad","estafa","fraude","security","scam","fraud"])
        ]
        for topic,terms in categories:
            if any(term in value for term in terms):
                return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        text=request.text or ""
        classification=self.classify_need(text,language)
        priority=self._priority_from_text(text)
        amount=self._amount_from_text(text)
        country=self._country_from_text(text)
        return {
            "need_type":classification["need_type"],
            "amount":amount,
            "destination_country":country,
            "priority":priority,
            "urgency":True if priority=="fastest" else None,
            "delivery_method":None,
            "payment_method":None,
            "language":language,
            "raw_text":text
        }

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        values={}
        fields=("amount","destination_country","priority","urgency","delivery_method","payment_method","special_need","free_text","need_type")
        for field in fields:
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        language=getattr(request,"language","es")
        if language in ("es","en"):values["language"]=language
        free_text=getattr(request,"free_text",None)
        need_type=getattr(request,"need_type",None)
        if free_text and not need_type:
            values["need_type"]=self.classify_need(free_text,language).get("need_type","other")
        if values.get("need_type")=="remittance" or values.get("amount") is not None or values.get("destination_country") is not None:
            values["current_step"]="comparison"
        else:
            values["current_step"]="assistant"
        return self.update_session(session_id,**values) or {}

    def _build_verified_result(self,provider:Dict[str,Any],commercial:Dict[str,Any],request:ComparisonRequest,language:str)->ComparisonResult:
        return ComparisonResult(
            provider_id=str(provider.get("id","")),
            provider_name=str(provider.get("name",provider.get("id",""))),
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

    def _public_available_option(self,provider:Dict[str,Any],request:ComparisonRequest,language:str)->Dict[str,Any]:
        option=self.provider_public_option(provider.get("id",""),request.destination_country,language) or {}
        return option

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
                    values.append({
                        "provider_name":provider.get("provider_name",""),
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
        if not state:raise KeyError("session_expired")
        if not state.get("amount") or not state.get("destination_country"):
            raise ValueError("Amount and destination country are required.")
        kwargs={
            "amount":state.get("amount"),
            "destination_country":state.get("destination_country"),
            "priority":state.get("priority"),
            "urgency":state.get("urgency"),
            "delivery_method":state.get("delivery_method"),
            "payment_method":state.get("payment_method"),
            "language":state.get("language","es"),
            "send_currency":state.get("send_currency","USD"),
            "special_need":state.get("special_need"),
            "provider_ids":[str(x) for x in state.get("candidate_providers",[]) if x]
        }
        request=ComparisonRequest(**kwargs)
        return self.compare(request,session_id)

    def compare(self,request:ComparisonRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        country=(request.destination_country or "").upper()
        if not self.supported_country(country):
            raise ValueError("Destination country is not currently supported.")
        if request.amount<=0:
            raise ValueError("Amount must be greater than zero.")
        ids=[str(x) for x in getattr(request,"provider_ids",[]) if x]
        if not ids:ids=self.candidate_provider_ids(country)
        registry={str(p.get("id")):p for p in self.get_provider_registry()}
        available=[]
        verified_results=[]
        for pid in ids:
            provider=registry.get(pid)
            if not provider:continue
            option=self._public_available_option(provider,request,language)
            if not option:continue
            available.append(option)
            commercial=self.get_verified_provider_data(
                pid,country,
                request.amount,
                getattr(request,"payment_method",None),
                getattr(request,"delivery_method",None)
            )
            if commercial:
                verified_results.append(self._build_verified_result(provider,commercial,request,language))
        if not available:
            for provider in self.get_provider_registry():
                option=self._public_available_option(provider,request,language)
                if option:available.append(option)
        if session_id and session_id in self.sessions:
            self.sessions[session_id]["candidate_providers"]=[x.get("provider_id") for x in available if x.get("provider_id")]
            self.sessions[session_id]["available_providers"]=deepcopy(available)
            self.sessions[session_id]["verified_results"]=deepcopy([x.model_dump() if hasattr(x,"model_dump") else x for x in verified_results])
            self.sessions[session_id]["current_step"]="results"
            self.sessions[session_id]["updated_at"]=self.now()
        return {
            "success":True,
            "language":language,
            "destination_country":country,
            "destination_name":self.country_name(country,language),
            "amount":request.amount,
            "send_currency":request.send_currency,
            "priority":request.priority,
            "results":[x.model_dump() if hasattr(x,"model_dump") else x for x in verified_results],
            "available_providers":available,
            "provider_count":len(available),
            "verified_count":len(verified_results),
            "results_available":bool(verified_results),
            "message":self.comparison_explanation(language,bool(verified_results)),
            "data_timestamp":self.now(),
            "warning":self.comparison_warning(language) if not verified_results else None
        }

    def comparison_explanation(self,language:str="es",verified:bool=False)->str:
        if verified:
            return "Los datos mostrados como verificados tienen una fuente y fecha de verificación. Revísalos antes de continuar." if language=="es" else "Data marked as verified has a source and verification date. Review it before continuing."
        return "Las tarifas, tasas, tiempos y cantidades recibidas no están verificadas en este momento. Puedes revisar cada proveedor directamente." if language=="es" else "Fees, rates, delivery times and recipient amounts are not verified at this time. You can review each provider directly."

    def comparison_warning(self,language:str="es")->str:
        return "No tenemos datos comerciales actuales verificados. Los cuatro proveedores siguen disponibles para que puedas revisar sus condiciones oficiales." if language=="es" else "We do not have current verified commercial data. All four providers remain available so you can review their official terms."

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
        if not state:raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country:raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_found")
        state["selected_option"]=deepcopy(option)
        state["current_step"]="final_check"
        state["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->Dict[str,Any]:
        language=request.language if request.language in ("es","en") else "es"
        amount=float(request.amount or 0)
        country=self.country_name(request.destination_country,language)
        delivery=request.delivery_method
        checks=[
            {
                "id":"destination",
                "label":"País de destino" if language=="es" else "Destination country",
                "value":country,
                "complete":bool(request.destination_country),
                "status":"ok" if request.destination_country else "review"
            },
            {
                "id":"amount",
                "label":"Cantidad a enviar" if language=="es" else "Amount to send",
                "value":f"{amount:.2f} {request.send_currency}",
                "complete":amount>0,
                "status":"ok" if amount>0 else "review"
            },
            {
                "id":"currency",
                "label":"Moneda del envío" if language=="es" else "Sending currency",
                "value":request.send_currency,
                "complete":bool(request.send_currency),
                "status":"ok" if request.send_currency else "review"
            },
            {
                "id":"delivery_method",
                "label":"Forma de entrega" if language=="es" else "Delivery method",
                "value":self.human_delivery_method(delivery,language) if delivery else ("No seleccionada" if language=="es" else "Not selected"),
                "complete":bool(delivery),
                "status":"ok" if delivery else "review"
            },
            {
                "id":"recipient_information",
                "label":"Datos del destinatario" if language=="es" else "Recipient information",
                "value":"Revisar en el proveedor" if language=="es" else "Review on provider site",
                "complete":True,
                "status":"review"
            },
            {
                "id":"fee",
                "label":"Comisión" if language=="es" else "Fee",
                "value":request.fee if request.fee is not None else ("No verificada" if language=="es" else "Not verified"),
                "complete":request.fee is not None,
                "status":"ok" if request.fee is not None else "review"
            },
            {
                "id":"exchange_rate",
                "label":"Tasa de cambio" if language=="es" else "Exchange rate",
                "value":request.exchange_rate if request.exchange_rate is not None else ("No verificada" if language=="es" else "Not verified"),
                "complete":request.exchange_rate is not None,
                "status":"ok" if request.exchange_rate is not None else "review"
            },
            {
                "id":"recipient_amount",
                "label":"Cantidad que recibiría" if language=="es" else "Recipient amount",
                "value":request.recipient_amount if request.recipient_amount is not None else ("La mostrará el proveedor" if language=="es" else "Shown by provider"),
                "complete":request.recipient_amount is not None,
                "status":"ok" if request.recipient_amount is not None else "review"
            }
        ]
        valid=bool(request.provider_id and request.destination_country and amount>0 and request.send_currency)
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
            "message":self._final_message(language,valid),
            "precautions":self._precautions(language),
            "requirements":self.provider_requirements(request.provider_id,language)
        }

    def _final_message(self,language:str,valid:bool)->str:
        if language=="en":
            return "The basic information is ready. Review the provider's final terms before continuing." if valid else "Review the missing information before continuing."
        return "La información básica está lista. Revisa las condiciones finales del proveedor antes de continuar." if valid else "Revisa la información que falta antes de continuar."

    def human_payment_method(self,value:Any,language:str="es")->str:
        labels={
            "bank_account":{"es":"Cuenta bancaria","en":"Bank account"},
            "debit_card":{"es":"Tarjeta de débito","en":"Debit card"},
            "credit_card":{"es":"Tarjeta de crédito","en":"Credit card"},
            "cash":{"es":"Efectivo","en":"Cash"},
            "paypal":{"es":"PayPal","en":"PayPal"}
        }
        return labels.get(str(value),{}).get(language,str(value))

    def human_delivery_method(self,value:Any,language:str="es")->str:
        labels={
            "bank_account":{"es":"Cuenta bancaria","en":"Bank account"},
            "cash_pickup":{"es":"Cobro en efectivo","en":"Cash pickup"},
            "mobile_wallet":{"es":"Billetera digital","en":"Digital wallet"},
            "debit_card":{"es":"Tarjeta de débito","en":"Debit card"},
            "home_delivery":{"es":"Entrega a domicilio","en":"Home delivery"}
        }
        return labels.get(str(value),{}).get(language,str(value))

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        topics=[
            {
                "id":"exchange_rate",
                "label":{"es":"¿Qué es la tasa de cambio?","en":"What is an exchange rate?"},
                "answer":{"es":"Es la relación entre la moneda que envías y la moneda que recibe la otra persona.","en":"It is the relationship between the currency you send and the currency the other person receives."}
            },
            {
                "id":"fee",
                "label":{"es":"¿Qué es una comisión?","en":"What is a fee?"},
                "answer":{"es":"Es un cargo que puede aplicar el proveedor por el servicio.","en":"It is a charge the provider may apply for the service."}
            },
            {
                "id":"recipient_amount",
                "label":{"es":"¿Por qué puede recibir menos?","en":"Why might the recipient receive less?"},
                "answer":{"es":"La comisión y la tasa de cambio pueden afectar la cantidad final.","en":"The fee and exchange rate can affect the final amount."}
            },
            {
                "id":"identification",
                "label":{"es":"¿Por qué me piden identificación?","en":"Why am I asked for identification?"},
                "answer":{"es":"El proveedor puede solicitar información para verificar identidad y cumplir sus propios requisitos.","en":"The provider may request information to verify identity and meet its own requirements."}
            },
            {
                "id":"mistake",
                "label":{"es":"¿Qué hago si me equivoqué?","en":"What if I made a mistake?"},
                "answer":{"es":"No confirmes todavía. Revisa los datos y consulta al proveedor antes de completar el envío.","en":"Do not confirm yet. Review the information and contact the provider before completing the transfer."}
            },
            {
                "id":"security",
                "label":{"es":"¿Qué información no debo compartir aquí?","en":"What information should I not share here?"},
                "answer":{"es":"No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","en":"Do not enter passwords, CVV numbers, security codes or login credentials."}
            }
        ]
        return [{"id":x["id"],"label":self.localize(x["label"],language),"answer":self.localize(x["answer"],language)} for x in topics]

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        responses={
            "remittance":{
                "es":"Para ayudarte a comparar un envío necesito principalmente la cantidad y el país de destino. Después podemos revisar las opciones disponibles.",
                "en":"To compare a transfer, I mainly need the amount and destination country. Then we can review the available options."
            },
            "money_available":{
                "es":"Esta sección sirve para organizar el dinero que tienes y calcular cuánto queda después de tus gastos, ahorros y envíos que tú registres.",
                "en":"This section helps organize the money you have and calculate what remains after the expenses, savings and transfers you enter."
            },
            "budget":{
                "es":"Aquí puedes organizar ingresos, necesidades, gastos, remesas y ahorro para ver qué queda disponible.",
                "en":"Here you can organize income, needs, expenses, transfers and savings to see what remains."
            },
            "expenses":{
                "es":"Anota tus gastos para entender en qué se va tu dinero.",
                "en":"Record your expenses to understand where your money goes."
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
                "es":"Puedes organizar localmente el dinero que quieres reservar o enviar para tu familia.",
                "en":"You can organize locally the money you want to reserve or send for your family."
            },
            "requirements":{
                "es":"Los requisitos pueden cambiar según el proveedor, país, cantidad y método. Revisa la información actual del proveedor.",
                "en":"Requirements can vary by provider, country, amount and method. Check the provider's current information."
            },
            "fees":{
                "es":"La comisión es un cargo que puede aplicar el proveedor. Revisa el cargo final antes de confirmar.",
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
            "security":{
                "es":"Nunca introduzcas aquí contraseñas, CVV, códigos de seguridad ni claves bancarias.",
                "en":"Never enter passwords, CVV numbers, security codes or bank credentials here."
            },
            "other":{
                "es":"Cuéntame qué necesitas y te ayudaré a ordenar los pasos.",
                "en":"Tell me what you need and I will help organize the steps."
            }
        }
        message=responses.get(need_type,responses["other"])[language]
        return {
            "success":True,
            "need_type":need_type,
            "message":message,
            "language":language,
            "remittance_required":need_type=="remittance"
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        countries=[]
        names=self.brain.get("countries",{}).get("country_names",{})
        supported=self.brain.get("countries",{}).get("initial_supported",[])
        for code in supported:
            item=names.get(code,{})
            countries.append({
                "id":code,
                "name":self.localize(item,language) or str(code),
                "currency":item.get("currency") if isinstance(item,dict) else None
            })
        providers=[]
        for provider in self.get_provider_registry():
            providers.append({
                "id":provider.get("id"),
                "name":provider.get("name"),
                "enabled":provider.get("enabled",True),
                "continue_url":self.provider_url(provider,language),
                "official_site":provider.get("official_site"),
                "payment_methods":deepcopy(provider.get("payment_methods",[])),
                "delivery_methods":deepcopy(provider.get("delivery_methods",[]))
            })
        opening=self.brain.get("opening",{})
        priorities=[]
        for item in opening.get("priorities",[]):
            if isinstance(item,dict):
                priorities.append({
                    "id":item.get("id"),
                    "icon":item.get("icon",""),
                    "label":self.localize(item.get("label"),language),
                    "why":self.localize(item.get("why"),language)
                })
        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{
                "primary_question":self.localize(opening.get("primary_question"),language) or ("¿Qué necesitas resolver hoy?" if language=="es" else "What do you need to solve today?"),
                "secondary_text":self.localize(opening.get("secondary_text"),language),
                "amount":deepcopy(opening.get("amount",{})),
                "priorities":priorities,
                "free_text":deepcopy(opening.get("free_text",{}))
            },
            "countries":countries,
            "providers":providers,
            "messages":{k:self.localize(v,language) for k,v in self.brain.get("messages",{}).items()},
            "help_topics":self.help_topics(language),
            "provider_handoff":{
                "button":"Revisar esta opción" if language=="es" else "Review this option",
                "external_notice":"Vas al sitio oficial del proveedor para revisar y completar el envío." if language=="es" else "You will go to the provider's official site to review and complete the transfer."
            }
        }

engine=RemittanceEngine()
