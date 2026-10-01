# remittance_engine.py — REMESAS | May Roga LLC | v4.3.0
import json,re,secrets,time
from pathlib import Path
from typing import Any,Dict,Optional,List

from schemas import ComparisonRequest,FinalCheckRequest,ParseNeedRequest,UserNeedRequest

ENGINE_VERSION="4.3.0"
BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_FILE=DATA_DIR/"app_brain.json"
PROVIDERS_FILE=DATA_DIR/"providers.json"

class RemittanceEngine:
    def __init__(self):
        self.brain={}
        self.providers_data={}
        self.providers=[]
        self.countries=[]
        self.sessions={}
        self.reload()

    def _load_json(self,path:Path)->Dict[str,Any]:
        if not path.exists():return {}
        try:
            with path.open("r",encoding="utf-8") as f:
                data=json.load(f)
            return data if isinstance(data,dict) else {}
        except Exception:
            return {}

    def reload(self):
        self.brain=self._load_json(BRAIN_FILE)
        self.providers_data=self._load_json(PROVIDERS_FILE)
        self.providers=self.providers_data.get("providers",[]) if isinstance(self.providers_data.get("providers",[]),list) else []
        self.countries=self.brain.get("countries",[]) if isinstance(self.brain.get("countries",[]),list) else []
        if not self.countries:self.countries=self.providers_data.get("countries",[]) or []
        return self

    def _text(self,value:Any,language="es")->str:
        if isinstance(value,dict):
            return str(value.get(language) or value.get("es") or value.get("en") or "")
        return str(value or "")

    def _provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=str(provider_id or "").strip().lower()
        for p in self.providers:
            if str(p.get("id","")).lower()==pid:return p
        return None

    def _country(self,country_id:str)->Optional[Dict[str,Any]]:
        cid=str(country_id or "").strip().upper()
        for c in self.countries:
            if str(c.get("id") or c.get("code") or "").upper()==cid:return c
            if str(c.get("code") or "").upper()==cid:return c
        return None

    def country_name(self,country_id:str,language="es")->str:
        c=self._country(country_id)
        return self._text(c.get("name"),language) if c else str(country_id or "")

    def provider_name(self,provider:Dict[str,Any],language="es")->str:
        return self._text(provider.get("name") or provider.get("title") or provider.get("id"),language)

    def _aliases(self,item:Dict[str,Any])->List[str]:
        values=[]
        for k in ("id","code"):
            if item.get(k):values.append(str(item[k]))
        a=item.get("aliases",[])
        if isinstance(a,list):values.extend(str(x) for x in a)
        elif a:values.append(str(a))
        n=item.get("name")
        if isinstance(n,dict):values.extend(str(x) for x in n.values())
        elif n:values.append(str(n))
        return values

    def _country_matches(self,provider:Dict[str,Any],country:str)->bool:
        cid=str(country or "").upper()
        allowed=provider.get("countries") or provider.get("country_codes") or []
        if not allowed:return True
        vals={str(x).upper() for x in allowed}
        c=self._country(cid)
        if c:
            vals.update(str(x).upper() for x in self._aliases(c))
        return cid in vals or any(str(x).upper()==cid for x in allowed)

    def _provider_allowed(self,provider:Dict[str,Any],country:str)->bool:
        return self._country_matches(provider,country)

    def _method_ids(self,values:Any)->List[str]:
        result=[]
        if not isinstance(values,list):return result
        for x in values:
            if isinstance(x,dict):
                value=x.get("id") or x.get("value") or x.get("code")
            else:value=x
            if value:result.append(str(value))
        return result

    def _verified_commercial(self,provider:Dict[str,Any])->Optional[Dict[str,Any]]:
        data=provider.get("commercial") or provider.get("commercial_data") or {}
        if not isinstance(data,dict):return None
        status=str(data.get("status") or provider.get("commercial_status") or "unavailable").lower()
        source=data.get("source")
        verified_at=data.get("verified_at")
        if status!="verified" or not source or not verified_at:return None
        return data

    def get_verified_provider_data(self,provider_id:str,country:Optional[str]=None,amount:Optional[float]=None,payment_method:Optional[str]=None,delivery_method:Optional[str]=None)->Optional[Dict[str,Any]]:
        provider=self._provider(provider_id)
        if not provider:return None
        if country and not self._provider_allowed(provider,country):return None
        data=self._verified_commercial(provider)
        if not data:return None
        return dict(data)

    def _official_url(self,provider:Dict[str,Any])->Optional[str]:
        urls=provider.get("official_urls") or {}
        if isinstance(urls,dict):
            for k in ("send_money","site","official","homepage"):
                value=urls.get(k)
                if isinstance(value,str) and value.startswith("https://"):return value
            for value in urls.values():
                if isinstance(value,str) and value.startswith("https://"):return value
        for k in ("continue_url","official_site","url"):
            value=provider.get(k)
            if isinstance(value,str) and value.startswith("https://"):return value
        return None

    def _public_provider(self,provider:Dict[str,Any],country:str,language="es")->Dict[str,Any]:
        verified=self.get_verified_provider_data(provider.get("id"),country)
        payment=provider.get("payment_methods",[])
        delivery=provider.get("delivery_methods",[])
        result={
            "provider_id":provider.get("id"),
            "provider_name":self.provider_name(provider,language),
            "country":country,
            "amount":None,
            "send_currency":"USD",
            "recipient_currency":provider.get("recipient_currency"),
            "fee":None,
            "exchange_rate":None,
            "recipient_amount":None,
            "estimated_delivery":None,
            "delivery_time":None,
            "delivery_method":None,
            "payment_method":None,
            "payment_methods":payment if isinstance(payment,list) else [],
            "delivery_methods":delivery if isinstance(delivery,list) else [],
            "commercial_status":"unavailable",
            "commercial_verified":False,
            "official_site":provider.get("official_site"),
            "official_urls":provider.get("official_urls") or {},
            "continue_url":self._official_url(provider),
            "relevance_reason":None,
            "status":"unavailable"
        }
        if verified:
            result.update({
                "fee":verified.get("fee"),
                "exchange_rate":verified.get("exchange_rate"),
                "recipient_amount":verified.get("recipient_amount"),
                "recipient_currency":verified.get("recipient_currency"),
                "estimated_delivery":verified.get("estimated_delivery"),
                "delivery_time":verified.get("delivery_time"),
                "commercial_status":"verified",
                "commercial_verified":True,
                "status":"verified"
            })
        return result

    def create_session(self,language="es")->Dict[str,Any]:
        now=time.time()
        sid=secrets.token_urlsafe(18)
        session={
            "session_id":sid,
            "language":language if language in ("es","en") else "es",
            "created_at":now,
            "updated_at":now,
            "current_step":"opening",
            "amount":None,
            "send_currency":"USD",
            "destination_country":None,
            "priority":None,
            "urgency":None,
            "delivery_method":None,
            "payment_method":None,
            "recipient_amount_target":None,
            "frequency":None,
            "special_need":None,
            "free_text":None,
            "need_type":None,
            "parsed_user_need":None,
            "candidate_providers":[],
            "available_providers":[],
            "verified_results":[],
            "selected_option":None,
            "final_check":None,
            "learning_provider":None,
            "recipient_information_entered":False
        }
        self.sessions[sid]=session
        return dict(session)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        session=self.sessions.get(session_id)
        return dict(session) if session else None

    def update_session(self,session_id:str,**values)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_not_found")
        s=self.sessions[session_id]
        for k,v in values.items():
            if k in s:s[k]=v
        s["updated_at"]=time.time()
        return dict(s)

    def clear_session(self,session_id:str)->bool:
        return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        if not text:return None
        matches=re.findall(r"(?:\$|USD\s*)?\d[\d,]*(?:\.\d{1,2})?",text.replace(" ",""))
        for value in matches:
            try:
                n=float(value.replace("$","").replace("USD","").replace(",",""))
                if n>0:return n
            except Exception:pass
        return None

    def _country_from_text(self,text:str)->Optional[str]:
        low=(text or "").lower()
        for c in self.countries:
            for alias in self._aliases(c):
                if alias and str(alias).lower() in low:
                    return str(c.get("id") or c.get("code") or "").upper()
        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        low=(text or "").lower()
        if any(x in low for x in ("que reciba más","reciba mas","reciba más","más dinero","mas dinero")):return "recipient_gets_more"
        if any(x in low for x in ("rápido","rapido","urgente","lo antes","today","hoy")):return "fastest"
        if any(x in low for x in ("menos","barato","ahorrar","ahorro","costo bajo","pagar menos")):return "save"
        if any(x in low for x in ("comparar","todas","opciones")):return "compare_all"
        return "balanced" if text else None

    def _delivery_from_text(self,text:str)->Optional[str]:
        low=(text or "").lower()
        if any(x in low for x in ("efectivo","cash","recoger","pickup","ventanilla")):return "cash_pickup"
        if any(x in low for x in ("cuenta","banco","bank account","depósito","deposito")):return "bank_account"
        if any(x in low for x in ("tarjeta","debit card","débito","debito")):return "debit_card"
        if any(x in low for x in ("wallet","billetera","móvil","movil")):return "mobile_wallet"
        if any(x in low for x in ("casa","domicilio","home delivery")):return "home_delivery"
        return None

    def _payment_from_text(self,text:str)->Optional[str]:
        low=(text or "").lower()
        if any(x in low for x in ("tarjeta de crédito","tarjeta credito","credit card")):return "credit_card"
        if any(x in low for x in ("tarjeta de débito","tarjeta debito","debit card")):return "debit_card"
        if any(x in low for x in ("cuenta bancaria","bank account")):return "bank_account"
        if any(x in low for x in ("efectivo","cash")):return "cash"
        if any(x in low for x in ("wallet","billetera","digital wallet")):return "digital_wallet"
        return None

    def classify_need(self,text:str,language="es")->Dict[str,Any]:
        low=(text or "").lower().strip()
        if any(x in low for x in ("seguro","seguridad","estafa","fraude","contraseña","password","código","codigo")):need="security"
        elif any(x in low for x in ("cancelar","cancelación","cancelacion","devolver","reembolso")):need="cancellation"
        elif any(x in low for x in ("comprobante","recibo","error","me equivoqué","equivoque","problema")):need="mistake_prevention"
        elif any(x in low for x in ("comisión","comision","costo","fee","tarifa")):need="fees"
        elif any(x in low for x in ("tasa","cambio","exchange")):need="exchange_rate"
        elif any(x in low for x in ("recibe","recibir","entrega","delivery","llega")):need="delivery"
        elif any(x in low for x in ("diferencia","diferencias","cuál es mejor","cual es mejor")):need="provider_difference"
        elif any(x in low for x in ("cuánto tengo","cuanto tengo","dinero disponible","me alcanza")):need="money_available"
        elif any(x in low for x in ("gasto","gastos","pagar","renta","comida")):need="expenses"
        elif any(x in low for x in ("ahorro","ahorrar","guardar")):need="savings"
        elif any(x in low for x in ("comprar","compra","carro","casa","viaje")):need="purchase"
        elif any(x in low for x in ("familia","ayudar","ayuda")):need="family"
        elif any(x in low for x in ("dato","datos","nombre del receptor","información del receptor")):need="recipient_information"
        elif any(x in low for x in ("requisito","requisitos","qué necesito","que necesito")):need="requirements"
        elif any(x in low for x in ("presupuesto","planificar","plan")):need="budget"
        elif any(x in low for x in ("enviar","mandar","remesa","remesas","dinero a","transferir")):need="remittance"
        else:need="other"
        return {"need_type":need,"language":language}

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text or ""
        classified=self.classify_need(text,request.language)
        amount=self._amount_from_text(text) or request.current_amount
        destination=self._country_from_text(text) or request.current_destination_country
        priority=self._priority_from_text(text)
        urgency=bool(re.search(r"\b(urgente|hoy|ahora|rápido|rapido|asap)\b",text.lower())) if text else None
        delivery=self._delivery_from_text(text)
        payment=self._payment_from_text(text)
        parsed={
            "need_type":classified["need_type"],
            "amount":amount,
            "send_currency":"USD",
            "destination_country":destination,
            "priority":priority,
            "urgency":urgency,
            "delivery_method":delivery,
            "payment_method":payment,
            "recipient_amount_target":None,
            "frequency":None,
            "special_need":None,
            "original_text":text,
            "raw_text":text,
            "missing_information":[],
            "confidence":0.85 if amount or destination else 0.55
        }
        if parsed["need_type"]=="remittance":
            if not amount:parsed["missing_information"].append("amount")
            if not destination:parsed["missing_information"].append("destination_country")
        return parsed

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_not_found")
        values={
            "language":request.language,
            "amount":request.amount,
            "send_currency":request.send_currency or "USD",
            "destination_country":str(request.destination_country or "").upper() or None,
            "priority":request.priority,
            "urgency":request.urgency,
            "delivery_method":request.delivery_method,
            "payment_method":request.payment_method,
            "recipient_amount_target":request.recipient_amount_target,
            "frequency":request.frequency,
            "special_need":request.special_need,
            "free_text":request.free_text,
            "need_type":request.need_type or "remittance",
            "parsed_user_need":request.parsed_user_need,
            "current_step":"comparison" if request.amount and request.destination_country else "opening"
        }
        return self.update_session(session_id,**values)

    def _relevance(self,priority:Optional[str],language="es")->str:
        texts={
            "recipient_gets_more":{"es":"Revisa cuánto recibe la persona.","en":"Review how much the recipient gets."},
            "fastest":{"es":"Revisa el tiempo de entrega.","en":"Review the delivery timing."},
            "save":{"es":"Revisa el costo total.","en":"Review the total cost."},
            "urgent":{"es":"Prioriza revisar la disponibilidad y entrega.","en":"Prioritize checking availability and delivery."},
            "balanced":{"es":"Revisa costo, tasa, recepción y entrega.","en":"Review cost, rate, receipt and delivery."},
            "compare_all":{"es":"Puedes revisar las opciones disponibles.","en":"You can review the available options."}
        }
        return texts.get(priority,texts["balanced"])[language]

    def compare(self,request:ComparisonRequest):
        country=str(request.destination_country or "").upper()
        available=[]
        verified=[]
        for provider in self.providers:
            if not self._provider_allowed(provider,country):continue
            option=self._public_provider(provider,country,request.language)
            option["amount"]=request.amount
            option["send_currency"]=request.send_currency
            option["relevance_reason"]=self._relevance(request.priority,request.language)
            available.append(option)
            data=self.get_verified_provider_data(provider.get("id"),country,request.amount,request.payment_method,request.delivery_method)
            if data:
                result=dict(option)
                result.update({
                    "fee":data.get("fee"),
                    "exchange_rate":data.get("exchange_rate"),
                    "recipient_amount":data.get("recipient_amount"),
                    "recipient_currency":data.get("recipient_currency"),
                    "estimated_delivery":data.get("estimated_delivery"),
                    "delivery_time":data.get("delivery_time"),
                    "status":"verified",
                    "commercial_status":"verified",
                    "commercial_verified":True,
                    "source":data.get("source"),
                    "verified_at":data.get("verified_at")
                })
                verified.append(result)
        explanation={
            "es":f"{len(verified)} opción(es) tiene(n) datos comerciales verificables en los datos disponibles. Los demás datos deben confirmarse directamente con el proveedor oficial.",
            "en":f"{len(verified)} option(s) have verifiable commercial data in the available data. Other details must be confirmed directly with the official provider."
        }[request.language]
        return {"success":True,"language":request.language,"amount":request.amount,"send_currency":request.send_currency,"destination_country":country,"priority":request.priority,"urgency":request.urgency,"available_providers":available,"results":verified,"verified_results":verified,"verified_count":len(verified),"results_available":bool(verified),"explanation":explanation}

    def compare_session(self,session_id:str):
        session=self.sessions.get(session_id)
        if not session:raise KeyError("session_not_found")
        request=ComparisonRequest(
            language=session.get("language","es"),
            amount=session.get("amount") or 0,
            send_currency=session.get("send_currency","USD"),
            destination_country=session.get("destination_country") or "",
            priority=session.get("priority"),
            urgency=session.get("urgency"),
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            recipient_amount_target=session.get("recipient_amount_target"),
            frequency=session.get("frequency"),
            special_need=session.get("special_need")
        )
        result=self.compare(request)
        self.update_session(session_id,candidate_providers=[x.get("provider_id") for x in result["available_providers"]],available_providers=result["available_providers"],verified_results=result["verified_results"],current_step="results")
        return result

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        session=self.sessions.get(session_id)
        if not session:raise KeyError("session_expired")
        pid=str(provider_id or "").strip()
        for option in session.get("available_providers",[]):
            if str(option.get("provider_id"))==pid:
                selected=dict(option)
                self.update_session(session_id,selected_option=selected,current_step="final_check")
                return selected
        raise KeyError("provider_not_available")

    def final_check(self,request:FinalCheckRequest,session_id:Optional[str]=None):
        lang=request.language
        items=[]
        def add(i,label,status,value=None,message=None,required=False):
            items.append({"id":i,"label":label,"status":status,"value":value,"message":message,"required":required})
        if request.amount and request.amount>0:add("amount",{"es":"Cantidad","en":"Amount"}[lang],"ready",request.amount,required=True)
        else:add("amount",{"es":"Cantidad","en":"Amount"}[lang],"missing",required=True)
        if request.destination_country:add("destination_country",{"es":"País de destino","en":"Destination country"}[lang],"ready",request.destination_country,required=True)
        else:add("destination_country",{"es":"País de destino","en":"Destination country"}[lang],"missing",required=True)
        if request.delivery_method:add("delivery_method",{"es":"Forma de entrega","en":"Delivery method"}[lang],"ready",request.delivery_method)
        else:add("delivery_method",{"es":"Forma de entrega","en":"Delivery method"}[lang],"warning",message={"es":"Confírmala con el proveedor oficial.","en":"Confirm it with the official provider."}[lang])
        if request.payment_method:add("payment_method",{"es":"Forma de pago","en":"Payment method"}[lang],"ready",request.payment_method)
        else:add("payment_method",{"es":"Forma de pago","en":"Payment method"}[lang],"warning",message={"es":"Confírmala antes de pagar.","en":"Confirm it before paying."}[lang])
        if request.recipient_information_entered:add("recipient_information",{"es":"Datos del destinatario","en":"Recipient information"}[lang],"confirmed",True,required=True)
        else:add("recipient_information",{"es":"Datos del destinatario","en":"Recipient information"}[lang],"missing",False,{"es":"Todavía no has confirmado que tienes los datos del destinatario.","en":"You have not confirmed that you have the recipient's information."},True)
        if request.fee is not None:add("fee",{"es":"Costo","en":"Cost"}[lang],"ready",request.fee)
        else:add("fee",{"es":"Costo","en":"Cost"}[lang],"unavailable",message={"es":"Confirma el costo actual en el sitio oficial.","en":"Confirm the current cost on the official site."}[lang])
        if request.exchange_rate is not None:add("exchange_rate",{"es":"Tasa","en":"Rate"}[lang],"ready",request.exchange_rate)
        else:add("exchange_rate",{"es":"Tasa","en":"Rate"}[lang],"unavailable",message={"es":"Confirma la tasa actual en el sitio oficial.","en":"Confirm the current rate on the official site."}[lang])
        required_missing=any(x["status"]=="missing" and x["required"] for x in items)
        provider=self._provider(request.provider_id or "")
        url=self._official_url(provider) if provider else None
        message={
            "es":"Revisa los elementos marcados antes de continuar." if required_missing else "La revisión básica está completa. La remesadora oficial mostrará las condiciones finales.",
            "en":"Review the marked items before continuing." if required_missing else "The basic review is complete. The official provider will show the final conditions."
        }[lang]
        important={
            "es":"REMESAS no confirma las condiciones finales del envío. Confírmalas en el sitio oficial antes de pagar.",
            "en":"REMESAS does not confirm the final transfer conditions. Confirm them on the official site before paying."
        }[lang]
        result={"success":True,"ready_to_continue":not required_missing,"language":lang,"provider_id":request.provider_id,"items":items,"requirements":[x["label"] for x in items if x["status"]=="missing"],"message":message,"important_note":important,"continue_url":url,"official_site":provider.get("official_site") if provider else None}
        if session_id in self.sessions:self.update_session(session_id,final_check=result,recipient_information_entered=request.recipient_information_entered)
        return result

    def help_topics(self,language="es"):
        data=self.brain.get("help",{}).get("topics",[])
        if not isinstance(data,list):return []
        return [{"id":x.get("id"),"title":self._text(x.get("title"),language),"answer":self._text(x.get("answer"),language)} for x in data]

    def get_learning_lessons(self,language="es"):
        learning=self.brain.get("learning",{})
        lessons=learning.get("lessons",[])
        providers=[]
        for p in self.providers:
            providers.append({"id":p.get("id"),"name":self.provider_name(p,language)})
        return {"success":True,"language":language,"lessons":[{"id":x.get("id"),"title":self._text(x.get("title"),language),"body":self._text(x.get("body"),language)} for x in lessons],"providers":providers,"notice":self._text(learning.get("notice"),language)}

    def provider_learning(self,provider_id:str,language="es"):
        provider=self._provider(provider_id)
        if not provider:raise KeyError("provider_not_found")
        lessons=provider.get("learning",{})
        return {"success":True,"language":language,"provider_id":provider_id,"provider_name":self.provider_name(provider,language),"lessons":[{"title":self._text(x.get("title"),language),"body":self._text(x.get("body"),language)} for x in lessons.get("lessons",[])],"notice":self._text(lessons.get("notice"),language)}

    def quick_guide(self,language="es",provider_id=None):
        guide=self.brain.get("quick_guide",{})
        result={"success":True,"language":language,"title":self._text(guide.get("title"),language),"steps":[self._text(x,language) for x in guide.get("steps",[])],"notice":self._text(guide.get("notice"),language)}
        if provider_id:
            p=self._provider(provider_id)
            if not p:raise KeyError("provider_not_found")
            result["provider_id"]=provider_id
            result["provider_name"]=self.provider_name(p,language)
            result["official_url"]=self._official_url(p)
        return result

    def learning_pdf_data(self,language="es",provider_id=None):
        data=self.get_learning_lessons(language)
        if provider_id:return self.provider_learning(provider_id,language)
        return data

    def assistant_response(self,need_type:str,language="es",text=""):
        messages=self.brain.get("assistant",{}).get("responses",{})
        raw=messages.get(need_type) or messages.get("other") or {}
        return {"success":True,"need_type":need_type,"language":language,"message":self._text(raw,language)}

    def public_config(self,language="es"):
        countries=[]
        for c in self.countries:
            countries.append({"id":str(c.get("id") or c.get("code") or "").upper(),"code":str(c.get("code") or c.get("id") or "").upper(),"name":c.get("name") or {"es":"","en":""},"aliases":c.get("aliases",[])})
        providers=[]
        for p in self.providers:
            providers.append({
                "id":p.get("id"),
                "name":p.get("name"),
                "official_site":p.get("official_site"),
                "official_urls":p.get("official_urls") or {},
                "payment_methods":p.get("payment_methods") or [],
                "delivery_methods":p.get("delivery_methods") or [],
                "commercial_status":"verified" if self._verified_commercial(p) else "unavailable",
                "commercial_verified":bool(self._verified_commercial(p))
            })
        methods=self.brain.get("methods",{})
        return {
            "app":self.brain.get("app",{}),
            "experience":self.brain.get("experience",{}),
            "opening":self.brain.get("opening",{}),
            "countries":countries,
            "providers":providers,
            "delivery_methods":methods.get("delivery",[]),
            "payment_methods":methods.get("payment",[]),
            "help_topics":self.help_topics(language),
            "learning":self.brain.get("learning",{}),
            "legal":self.brain.get("legal",{}),
            "security":self.brain.get("security",{}),
            "handoff":self.brain.get("handoff",{}),
            "comparison":self.brain.get("comparison",{}),
            "privacy":self.brain.get("privacy",{})
        }

engine=RemittanceEngine()
