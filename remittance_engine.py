# remittance_engine.py — REMESAS | May Roga LLC | 4.1.0
import json,re,uuid
from copy import deepcopy
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional
from schemas import UserNeedRequest,ParseNeedRequest,ComparisonRequest,ComparisonResult,ComparisonResponse,FinalCheckRequest,FinalCheckResponse,FinalCheckItem

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
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):data["providers"]=[]
        if not isinstance(data.get("corridors"),dict):data["corridors"]={}
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
        if isinstance(value,list):return ", ".join(self.localize(x,language) for x in value if self.localize(x,language))
        return str(value)

    def message(self,key:str,language:str="es")->str:
        return self.localize(self.brain.get("messages",{}).get(key,{}),language)

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        countries=self.brain.get("countries",{})
        names=countries.get("country_names",{})
        value=names.get(code)
        if isinstance(value,dict):return value
        destination=self.providers_data.get("corridors",{}).get("destinations",{}).get(code)
        return destination if isinstance(destination,dict) else None

    def supported_countries(self)->List[str]:
        countries=self.brain.get("countries",{})
        supported=countries.get("initial_supported",[])
        if isinstance(supported,list):return [str(x).upper() for x in supported]
        return list(countries.get("country_names",{}).keys())

    def country_name(self,country_code:str,language:str="es")->str:
        code=(country_code or "").upper()
        value=self.get_country(code)
        if not value:return code
        names=value.get("name")
        if isinstance(names,dict):return self.localize(names,language) or code
        return self.localize(value,language) or code

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not isinstance(providers,list):return []
        return [deepcopy(p) for p in providers if isinstance(p,dict) and p.get("enabled",True)]

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=(provider_id or "").strip().lower()
        for p in self.get_provider_registry():
            if str(p.get("id","")).lower()==pid:return p
        return None

    def provider_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=provider.get("official_urls",{})
        if isinstance(urls,dict):
            keys=["us_send_es","us_es","send_money","site"] if language=="es" else ["us_send","us_en","send_money","site"]
            for key in keys:
                url=urls.get(key)
                if isinstance(url,str) and url.startswith("https://"):return url
        url=provider.get("official_site")
        return url if isinstance(url,str) and url.startswith("https://") else None

    def corridor_provider_ids(self,country:str)->List[str]:
        code=(country or "").upper()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        ids=corridor.get("providers",[]) if isinstance(corridor,dict) else []
        if not isinstance(ids,list):ids=[]
        valid=[]
        for pid in ids:
            if self.get_provider(str(pid)):valid.append(str(pid))
        return valid

    def candidate_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        if code not in self.supported_countries():return []
        ids=self.corridor_provider_ids(code)
        if ids:return ids
        return [str(p["id"]) for p in self.get_provider_registry() if p.get("id")]

    def provider_public_option(self,provider_id:str,country:str,language:str="es")->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:return None
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):commercial={}
        verified=str(commercial.get("status","")).lower()=="verified" and bool(commercial.get("source")) and bool(commercial.get("verified_at"))
        return {
            "provider_id":provider["id"],
            "provider_name":provider.get("name",provider["id"]),
            "enabled":bool(provider.get("enabled",True)),
            "country":country.upper(),
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
            "session_id":sid,"language":language,"amount":None,"send_currency":"USD",
            "destination_country":None,"priority":None,"urgency":None,
            "delivery_method":None,"payment_method":None,"special_need":None,
            "free_text":None,"need_type":None,"parsed_user_need":None,
            "candidate_providers":[],"available_providers":[],"verified_results":[],
            "selected_option":None,"final_check":{},"current_step":"opening",
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
        for raw in re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text or "",re.I):
            try:
                value=float(raw.replace(",",""))
                if 0<value<=1000000:return value
            except ValueError:pass
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        aliases={
            "méxico":"MX","mexico":"MX","mexican":"MX","guatemala":"GT","el salvador":"SV",
            "salvador":"SV","honduras":"HN","nicaragua":"NI","costa rica":"CR","panamá":"PA","panama":"PA",
            "colombia":"CO","venezuela":"VE","ecuador":"EC","perú":"PE","peru":"PE","bolivia":"BO",
            "paraguay":"PY","chile":"CL","argentina":"AR","brasil":"BR","brazil":"BR",
            "república dominicana":"DO","republica dominicana":"DO","dominicana":"DO",
            "cuba":"CU","uruguay":"UY","jamaica":"JM"
        }
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",value):return code
        for code in self.supported_countries():
            if re.search(r"\b"+re.escape(code.lower())+r"\b",value):return code
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        value=(text or "").lower()
        patterns={
            "recipient_gets_more":["reciba más","reciba mas","receive more","more money"],
            "fastest":["rápido","rapido","fast","quick","speed"],
            "urgent":["urgente","urgent","hoy","today","ahora","now","asap"],
            "save":["ahorrar","ahorro","save","cheap","barato","menor costo"],
            "balanced":["equilibrio","balance","balanced"],
            "compare_all":["comparar","compare","comparación","comparacion","opciones","options"]
        }
        for priority,terms in patterns.items():
            if any(x in value for x in terms):return priority
        return None

    def classify_need(self,text:str,language:str="es")->Dict[str,Any]:
        value=(text or "").strip().lower()
        categories=[
            ("remittance",["enviar dinero","mandar dinero","remesa","remesas","transferir","transferencia","send money","remittance","transfer money"]),
            ("income",["ingreso","ingresos","income","gané","gane","salario","salary","paycheck"]),
            ("expenses",["gasto","gastos","expense","expenses","en qué gasto","en que gasto"]),
            ("savings",["ahorrar","ahorro","save money","savings","guardar dinero"]),
            ("purchase",["comprar","compra","purchase","shopping","quiero comprar"]),
            ("family",["familia","familiar","family","mamá","mama","madre","padre"]),
            ("requirements",["requisito","requisitos","qué necesito","que necesito","documentos","requirements","what do i need"]),
            ("fees",["comisión","comision","tarifa","cargo","fee","fees","costo de envío","costo de envio"]),
            ("exchange_rate",["tasa de cambio","tipo de cambio","exchange rate"]),
            ("delivery",["cuándo llega","cuando llega","entrega","delivery","cuánto tarda","cuanto tarda"]),
            ("provider_difference",["diferencia entre","diferencias","cuál es la diferencia","cual es la diferencia","difference between"]),
            ("security",["seguridad","estafa","fraude","security","scam","fraud"]),
            ("cancellation",["cancelar","cancelación","cancelacion","cancel"]),
            ("recipient_information",["beneficiario","destinatario","recipient","beneficiary"])
        ]
        for topic,terms in categories:
            if any(x in value for x in terms):return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text or ""
        classification=self.classify_need(text,request.language)
        priority=self._priority_from_text(text)
        return {
            "need_type":classification["need_type"],
            "amount":self._amount_from_text(text),
            "destination_country":self._country_from_text(text),
            "priority":priority,
            "urgency":priority=="urgent" if priority else None,
            "delivery_method":None,"payment_method":None,
            "language":request.language,"raw_text":text
        }

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        values={}
        for field in ("amount","destination_country","priority","urgency","delivery_method","payment_method","special_need","free_text","need_type"):
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        values["language"]=request.language
        if request.free_text:
            parsed=self.classify_need(request.free_text,request.language)
            values["need_type"]=request.need_type or parsed["need_type"]
            values["parsed_user_need"]=parsed
        if values.get("need_type")=="remittance" or values.get("destination_country"):
            values["current_step"]="comparison"
        return self.update_session(session_id,**values) or {}

    def _verified(self,provider:Dict[str,Any])->Optional[Dict[str,Any]]:
        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):return None
        if str(commercial.get("status","")).lower()!="verified":return None
        if not commercial.get("source") or not commercial.get("verified_at"):return None
        return commercial

    def _comparison_result(self,provider:Dict[str,Any],commercial:Dict[str,Any],request:ComparisonRequest,language:str)->ComparisonResult:
        return ComparisonResult(
            provider_id=provider["id"],provider_name=provider.get("name",provider["id"]),
            amount_sent=request.amount,send_currency=request.send_currency,
            fee=commercial.get("fee"),exchange_rate=commercial.get("exchange_rate"),
            recipient_amount=commercial.get("recipient_amount"),
            recipient_currency=commercial.get("currency"),
            delivery_method=commercial.get("delivery_method"),
            payment_method=commercial.get("payment_method"),
            estimated_delivery=commercial.get("delivery_time"),
            availability=commercial.get("availability"),
            important_condition=commercial.get("important_condition"),
            requirements=commercial.get("requirements",[]) if isinstance(commercial.get("requirements",[]),list) else [],
            source=commercial.get("source"),verified_at=commercial.get("verified_at"),
            status="verified",continue_url=self.provider_url(provider,language)
        )

    def compare(self,request:ComparisonRequest)->ComparisonResponse:
        language=request.language
        country=request.destination_country.upper()
        if country not in self.supported_countries():
            return ComparisonResponse(success=False,language=language,destination_country=country,destination_name=self.country_name(country,language),amount=request.amount,send_currency=request.send_currency,message=self.message("country_not_supported",language))
        ids=self.candidate_provider_ids(country)
        available=[self.provider_public_option(pid,country,language) for pid in ids]
        available=[x for x in available if x]
        verified=[]
        for pid in ids:
            provider=self.get_provider(pid)
            if not provider:continue
            commercial=self._verified(provider)
            if commercial:
                verified.append(self._comparison_result(provider,commercial,request,language))
        results_available=bool(verified)
        return ComparisonResponse(
            success=True,language=language,destination_country=country,
            destination_name=self.country_name(country,language),amount=request.amount,
            send_currency=request.send_currency,priority=request.priority,
            results=verified,available_providers=available,
            provider_count=len(available),verified_count=len(verified),
            results_available=results_available,
            message=self.message("results_ready",language) if results_available else self.message("no_results",language),
            warning=self.message("review_official",language)
        )

    def compare_session(self,session_id:str)->ComparisonResponse:
        session=self.sessions.get(session_id)
        if not session:raise KeyError("session_expired")
        request=ComparisonRequest(
            language=session.get("language","es"),
            amount=session.get("amount"),
            send_currency=session.get("send_currency","USD"),
            destination_country=session.get("destination_country"),
            priority=session.get("priority"),
            urgency=session.get("urgency"),
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            special_need=session.get("special_need")
        )
        response=self.compare(request)
        self.update_session(
            session_id,
            candidate_providers=[x["provider_id"] for x in response.available_providers],
            available_providers=response.available_providers,
            verified_results=[x.model_dump() if hasattr(x,"model_dump") else x for x in response.results],
            current_step="results"
        )
        return response

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        session=self.sessions.get(session_id)
        if not session:raise KeyError("session_expired")
        option=None
        for item in session.get("available_providers",[]):
            if str(item.get("provider_id","")).lower()==provider_id.lower():option=deepcopy(item);break
        if option is None:raise KeyError("provider_not_available")
        self.update_session(session_id,selected_option=option,current_step="final_check")
        return option

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None)->FinalCheckResponse:
        language=request.language
        provider=self.get_provider(request.provider_id)
        if not provider:
            return FinalCheckResponse(success=False,ready_to_continue=False,language=language,provider_id=request.provider_id,message=self.message("provider_not_available",language))
        items=[]
        country_ok=request.destination_country.upper() in self.supported_countries()
        items.append(FinalCheckItem(id="destination",label=self.localize({"es":"País de destino","en":"Destination country"},language),value=self.country_name(request.destination_country,language),status="ok" if country_ok else "review",complete=country_ok))
        amount_ok=request.amount>0
        items.append(FinalCheckItem(id="amount",label=self.localize({"es":"Monto a enviar","en":"Amount to send"},language),value=f"{request.amount:.2f} {request.send_currency}",status="ok" if amount_ok else "review",complete=amount_ok))
        currency_ok=bool(request.send_currency)
        items.append(FinalCheckItem(id="currency",label=self.localize({"es":"Moneda de envío","en":"Sending currency"},language),value=request.send_currency,status="ok" if currency_ok else "review",complete=currency_ok))
        delivery=request.delivery_method
        delivery_ok=bool(delivery)
        items.append(FinalCheckItem(id="delivery_method",label=self.localize({"es":"Forma de entrega","en":"Delivery method"},language),value=delivery,status="ok" if delivery_ok else "review",complete=delivery_ok))
        ready=all(x.complete for x in items)
        note=self.message("review_official",language)
        response=FinalCheckResponse(success=True,ready_to_continue=ready,language=language,provider_id=provider["id"],checks=items,message=self.message("final_message",language) or self.brain.get("validation",{}).get("final_message",{}).get(language,""),important_note=note)
        if session_id:self.update_session(session_id,final_check=response.model_dump(),current_step="ready" if ready else "final_check")
        return response

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        topics=self.brain.get("help_center",{}).get("topics",[])
        if not isinstance(topics,list):return []
        return [{"id":x.get("id"),"title":self.localize(x.get("title"),language),"answer":self.localize(x.get("answer"),language)} for x in topics if isinstance(x,dict)]

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"
        opening=self.brain.get("opening",{})
        priorities=[]
        for item in opening.get("priorities",[]):
            priorities.append({"id":item.get("id"),"icon":item.get("icon",""),"label":self.localize(item.get("label"),language),"why":self.localize(item.get("why"),language)})
        countries=[]
        names=self.brain.get("countries",{}).get("country_names",{})
        for code in self.supported_countries():
            item=names.get(code,{})
            countries.append({"id":code,"name":self.localize(item.get("name",item),language), "currency":item.get("currency")})
        providers=[]
        for p in self.get_provider_registry():
            providers.append({"id":p["id"],"name":p.get("name",p["id"]),"enabled":p.get("enabled",True),"continue_url":self.provider_url(p,language),"official_site":p.get("official_site"),"payment_methods":deepcopy(p.get("payment_methods",[])),"delivery_methods":deepcopy(p.get("delivery_methods",[]))})
        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "supported_languages":self.brain.get("languages",{}).get("supported",["es","en"]),
            "opening":{"primary_question":self.localize(opening.get("primary_question"),language),"secondary_text":self.localize(opening.get("secondary_text"),language),"amount":deepcopy(opening.get("amount",{})),"priorities":priorities,"free_text":deepcopy(opening.get("free_text",{}))},
            "countries":countries,"providers":providers,
            "delivery_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in self.brain.get("delivery_methods",[])],
            "payment_methods":[{"id":x.get("id"),"label":self.localize(x.get("label"),language)} for x in self.brain.get("payment_methods",[])],
            "messages":{k:self.localize(v,language) for k,v in self.brain.get("messages",{}).items()},
            "help_topics":self.help_topics(language),
            "provider_handoff":{"button":self.localize(self.brain.get("provider_handoff",{}).get("button"),language),"external_notice":self.localize(self.brain.get("provider_handoff",{}).get("external_notice"),language)}
        }

engine=RemittanceEngine()
