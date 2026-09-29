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
        self.brain=self._read_json(BRAIN_PATH)
        self.providers_data=self._read_json(PROVIDERS_PATH) if PROVIDERS_PATH.exists() else {"providers":[],"corridors":{"origin":"US","destinations":{}}}
        self.sessions={}

    def _read_json(self,path):
        if not path.exists():raise FileNotFoundError(f"Required data file not found: {path}")
        try:
            with path.open("r",encoding="utf-8") as f:return json.load(f)
        except json.JSONDecodeError as e:raise ValueError(f"Invalid JSON in {path.name}: {e}")

    def now(self):return datetime.now(timezone.utc).isoformat()

    def normalize_text(self,text):
        value=str(text or "").strip().lower()
        value=unicodedata.normalize("NFD",value)
        return "".join(c for c in value if unicodedata.category(c)!="Mn")

    def localize(self,value,language="es"):
        if value is None:return ""
        if isinstance(value,(str,int,float,bool)):return str(value)
        if isinstance(value,dict):
            if language in value:return self.localize(value[language],language)
            fallback="en" if language=="es" else "es"
            if fallback in value:return self.localize(value[fallback],fallback)
            for k in ("label","name","title","text","description","id"):
                if k in value:return self.localize(value[k],language)
        if isinstance(value,list):return ", ".join(self.localize(x,language) for x in value if self.localize(x,language))
        return str(value)

    def _message(self,key,language="es"):
        return self.localize(self.brain.get("messages",{}).get(key,{}),language)

    def get_supported_countries(self):
        countries=self.brain.get("countries",{})
        raw=countries.get("supported") or countries.get("initial_supported") or []
        names=countries.get("country_names",{})
        result=[]
        for item in raw:
            if isinstance(item,dict):
                code=str(item.get("code") or item.get("id") or "").upper()
                if code:result.append({"code":code,"name":item.get("name") or names.get(code,code)})
            else:
                code=str(item).upper()
                if code:result.append({"code":code,"name":names.get(code,code)})
        if not result and isinstance(names,dict):
            for code,name in names.items():result.append({"code":str(code).upper(),"name":name})
        return result

    def country_supported(self,code):
        code=str(code or "").upper().strip()
        return any(x["code"]==code for x in self.get_supported_countries())

    def country_name(self,code,language="es"):
        code=str(code or "").upper().strip()
        for x in self.get_supported_countries():
            if x["code"]==code:return self.localize(x["name"],language)
        return code

    def get_provider_registry(self):
        providers=self.providers_data.get("providers",[])
        result=[]
        seen=set()
        for p in providers:
            if not isinstance(p,dict):continue
            pid=str(p.get("id","")).strip().lower()
            if not pid or pid in seen or not p.get("enabled",True):continue
            seen.add(pid);result.append(deepcopy(p))
        return result

    def get_provider(self,provider_id):
        pid=str(provider_id or "").lower().strip()
        for p in self.get_provider_registry():
            if str(p.get("id","")).lower()==pid:return p
        return None

    def provider_url(self,provider,language="es",topic=None):
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):urls={}
        topic_keys={
            "fee":["fees","fee","pricing","cost"],
            "rate":["exchange_rate","exchange","rates","rate"],
            "delivery":["delivery","delivery_time","receiving","receive"],
            "requirements":["requirements","help","support"],
            "recipient":["recipient","receive","cash_pickup","delivery"],
            "mistake":["mistake","help","support"],
            "cancel":["cancel","cancellation","help","support"],
            "security":["security","help","support"],
            "limits":["limits","help","support"],
            "general":["send","us_send_es","home","main"]
        }
        if topic:
            for key in topic_keys.get(topic,topic_keys["general"]):
                url=urls.get(key)
                if isinstance(url,str) and url.startswith(("http://","https://")):return url
        keys=["us_send_es","send","home","main"] if language=="es" else ["us_send","send","home","main"]
        for key in keys:
            url=urls.get(key)
            if isinstance(url,str) and url.startswith(("http://","https://")):return url
        for key in ("official_site","official_url"):
            url=provider.get(key)
            if isinstance(url,str) and url.startswith(("http://","https://")):return url
        return None

    def provider_help_urls(self,provider,language="es"):
        return {topic:self.provider_url(provider,language,topic) for topic in ("general","fee","rate","delivery","requirements","recipient","mistake","cancel","security","limits")}

    def corridor_provider_ids(self,country):
        code=str(country or "").upper().strip()
        destinations=self.providers_data.get("corridors",{}).get("destinations",{})
        corridor=destinations.get(code,{}) if isinstance(destinations,dict) else {}
        ids=corridor.get("providers",[]) if isinstance(corridor,dict) else []
        valid=[str(x) for x in ids if self.get_provider(str(x))]
        if valid:return valid
        return [p["id"] for p in self.get_provider_registry()]

    def commercial_verified(self,data):
        return isinstance(data,dict) and str(data.get("status","")).lower()=="verified" and bool(data.get("source")) and bool(data.get("verified_at"))

    def human_payment(self,value,language="es"):
        m={"bank_account":{"es":"Cuenta bancaria","en":"Bank account"},"debit_card":{"es":"Tarjeta de débito","en":"Debit card"},"credit_card":{"es":"Tarjeta de crédito","en":"Credit card"},"cash":{"es":"Efectivo","en":"Cash"},"paypal":{"es":"PayPal","en":"PayPal"}}
        if isinstance(value,list):return ", ".join(self.human_payment(x,language) for x in value)
        return m.get(str(value or "").lower(),{"es":str(value or ""),"en":str(value or "")}).get(language,str(value or ""))

    def human_delivery(self,value,language="es"):
        m={"bank_account":{"es":"Cuenta bancaria","en":"Bank account"},"cash_pickup":{"es":"Recibir en efectivo","en":"Receive in cash"},"mobile_wallet":{"es":"Billetera digital","en":"Digital wallet"},"home_delivery":{"es":"Entrega a domicilio","en":"Home delivery"},"debit_card":{"es":"Tarjeta de débito","en":"Debit card"}}
        if isinstance(value,list):return ", ".join(self.human_delivery(x,language) for x in value)
        return m.get(str(value or "").lower(),{"es":str(value or ""),"en":str(value or "")}).get(language,str(value or ""))

    def human_provider_option(self,provider,country="",language="es"):
        pid=provider.get("id","")
        return {
            "provider_id":pid,
            "provider_name":provider.get("name",pid),
            "country":str(country or "").upper(),
            "country_name":self.country_name(country,language) if country else "",
            "online":bool(provider.get("supports_online",True)),
            "agent":bool(provider.get("supports_agent",False)),
            "payment_options":[self.human_payment(x,language) for x in provider.get("payment_methods",[])],
            "delivery_options":[self.human_delivery(x,language) for x in provider.get("delivery_methods",[])],
            "requirements":[self.localize(x,language) for x in provider.get("requirements",[])],
            "official_url":self.provider_url(provider,language,"general"),
            "help_url":self.provider_url(provider,language,"general"),
            "help_urls":self.provider_help_urls(provider,language)
        }

    def provider_public_option(self,provider_id,country="",language="es"):
        p=self.get_provider(provider_id)
        if not p:return None
        c=p.get("commercial_data",{})
        verified=self.commercial_verified(c)
        result=self.human_provider_option(p,country,language)
        result.update({
            "enabled":bool(p.get("enabled",True)),
            "commercial_status":"verified" if verified else "unavailable",
            "commercial_verified":verified,
            "fee":c.get("fee") if verified else None,
            "exchange_rate":c.get("exchange_rate") if verified else None,
            "recipient_amount":c.get("recipient_amount") if verified else None,
            "delivery_time":c.get("delivery_time") if verified else None,
            "currency":c.get("currency") if verified else None,
            "delivery_method":self.human_delivery(c.get("delivery_method"),language) if verified else None,
            "payment_method":self.human_payment(c.get("payment_method"),language) if verified else None,
            "important_condition":c.get("important_condition") if verified else None,
            "source":c.get("source") if verified else None,
            "verified_at":c.get("verified_at") if verified else None,
            "continue_url":self.provider_url(p,language,"general"),
            "official_site":p.get("official_site") or self.provider_url(p,language,"general")
        })
        return result

    def create_session(self,language="es"):
        language=language if language in ("es","en") else "es"
        sid=str(uuid.uuid4())
        state={"session_id":sid,"language":language,"need_type":None,"amount":None,"send_currency":"USD","destination_country":None,"destination_region":None,"priority":None,"urgency":None,"frequency":None,"delivery_method":None,"payment_method":None,"special_need":None,"free_text":None,"parsed_user_need":None,"candidate_providers":[],"available_providers":[],"verified_results":[],"selected_option":None,"final_check":{},"current_step":"opening","created_at":self.now(),"updated_at":self.now()}
        self.sessions[sid]=state
        return deepcopy(state)

    def get_session(self,sid):return deepcopy(self.sessions.get(sid))

    def update_session(self,sid,**values):
        if sid not in self.sessions:return None
        state=self.sessions[sid]
        for k,v in values.items():
            if v is not None:state[k]=v
        state["updated_at"]=self.now()
        return deepcopy(state)

    def clear_session(self,sid):return self.sessions.pop(sid,None) is not None

    def _amount_from_text(self,text):
        matches=re.findall(r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",str(text or ""),re.I)
        for raw in matches:
            try:
                n=float(raw.replace(",",""))
                if n>0:return n
            except:pass
        words={"cien":100,"doscientos":200,"trescientos":300,"cuatrocientos":400,"quinientos":500,"seiscientos":600,"setecientos":700,"ochocientos":800,"novecientos":900,"mil":1000}
        value=self.normalize_text(text)
        for word,n in words.items():
            if re.search(r"\b"+word+r"\b",value):return float(n)
        return None

    def _country_from_text(self,text):
        value=self.normalize_text(text)
        aliases={"mexico":"MX","mexican":"MX","guatemala":"GT","el salvador":"SV","salvador":"SV","honduras":"HN","nicaragua":"NI","costa rica":"CR","panama":"PA","republica dominicana":"DO","dominicana":"DO","colombia":"CO","venezuela":"VE","ecuador":"EC","peru":"PE","bolivia":"BO","paraguay":"PY","brasil":"BR","brazil":"BR","chile":"CL","argentina":"AR","uruguay":"UY","cuba":"CU","haiti":"HT"}
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"\b"+re.escape(name)+r"\b",value):return code
        for item in self.get_supported_countries():
            code=item["code"].lower()
            name=self.normalize_text(self.localize(item["name"],"es"))
            if re.search(r"\b"+re.escape(code)+r"\b",value) or (name and re.search(r"\b"+re.escape(name)+r"\b",value)):return code.upper()
        return None

    def _priority_from_text(self,text):
        value=self.normalize_text(text)
        for p,terms in [("recipient_gets_more",["reciba mas","recibir mas","receive more","mas dinero","more money"]),("fastest",["rapido","rapida","fast","quick","speed"]),("urgent",["urgente","urgent","hoy","today","ahora","now","asap"]),("save",["ahorrar","ahorro","save","cheap","barato","menos costo"]),("balanced",["equilibrio","balance","balanced"]),("compare_all",["comparar","compare","opciones","options"])]:
            if any(x in value for x in terms):return p
        return None

    def _frequency_from_text(self,text):
        value=self.normalize_text(text)
        if any(x in value for x in ["cada semana","semanal","weekly"]):return "weekly"
        if any(x in value for x in ["cada dos semanas","cada 2 semanas","quincenal","biweekly"]):return "biweekly"
        if any(x in value for x in ["cada mes","mensual","monthly"]):return "monthly"
        if any(x in value for x in ["una vez","puntual","ocasional","one time","once"]):return "one_time"
        return None

    def classify_need(self,text,language="es"):
        value=self.normalize_text(text)
        categories=[
            ("remittance",["enviar dinero","mandar dinero","enviar","mandar","remesa","remesas","transferir","transferencia","send money","remittance","transfer money"]),
            ("family",["familia","familiar","family","mama","madre","padre","hijo","hija"]),
            ("savings",["ahorrar","ahorro","guardar dinero","guardar","save money","savings"]),
            ("expenses",["gasto","gastos","expense","expenses","en que gasto","cosas pequenas","small spending"]),
            ("purchase",["comprar","compra","purchase","shopping","quiero comprar"]),
            ("money_available",["cuanto puedo gastar","dinero disponible","money available","how much can i spend","me quedan"]),
            ("budget",["presupuesto","organizar mi dinero","organizar dinero","budget","plan my money"]),
            ("requirements",["requisito","requisitos","que necesito","documentos","requirements","what do i need"]),
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
            if any(x in value for x in terms):return {"need_type":topic,"language":language,"text":text}
        return {"need_type":"other","language":language,"text":text}

    def parse_need(self,request):
        language=request.language if request.language in ("es","en") else "es"
        text=request.text or ""
        c=self.classify_need(text,language)
        priority=self._priority_from_text(text)
        return {"need_type":c["need_type"],"amount":self._amount_from_text(text),"destination_country":self._country_from_text(text),"priority":priority,"urgency":priority=="urgent" if priority else None,"frequency":self._frequency_from_text(text),"delivery_method":None,"payment_method":None,"language":language,"raw_text":text}

    def _next_step(self,state):
        if not state.get("need_type"):return "need"
        if state["need_type"]!="remittance":return "assistant"
        if not state.get("amount"):return "amount"
        if not state.get("destination_country"):return "destination"
        return "comparison"

    def apply_need(self,sid,request):
        if sid not in self.sessions:raise KeyError("session_expired")
        values={}
        for field in ("amount","destination_country","destination_region","priority","urgency","frequency","delivery_method","payment_method","special_need","free_text","need_type"):
            value=getattr(request,field,None)
            if value is not None:values[field]=value
        if request.language in ("es","en"):values["language"]=request.language
        if request.free_text:
            parsed=self.parse_need(ParseNeedRequest(text=request.free_text,language=request.language))
            values["parsed_user_need"]=parsed
            for key in ("amount","destination_country","priority","urgency","frequency"):
                if values.get(key) is None and parsed.get(key) is not None:values[key]=parsed[key]
            if values.get("need_type") is None:values["need_type"]=parsed.get("need_type")
        current=deepcopy(self.sessions[sid]);current.update(values);values["current_step"]=self._next_step(current)
        return self.update_session(sid,**values)

    def _build_verified_result(self,provider,commercial,request,language):
        return ComparisonResult(provider_id=provider.get("id",""),provider_name=provider.get("name",provider.get("id","")),amount_sent=request.amount,send_currency=request.send_currency,fee=commercial.get("fee"),exchange_rate=commercial.get("exchange_rate"),recipient_amount=commercial.get("recipient_amount"),delivery_method=self.human_delivery(commercial.get("delivery_method"),language),payment_method=self.human_payment(commercial.get("payment_method"),language),estimated_delivery=commercial.get("delivery_time"),recipient_currency=commercial.get("currency"),availability=True,important_condition=commercial.get("important_condition"),requirements=commercial.get("requirements",[]) if isinstance(commercial.get("requirements",[]),list) else [],source=commercial.get("source"),verified_at=commercial.get("verified_at"),status="verified",continue_url=self.provider_url(provider,language,"general"))

    def compare_session(self,sid):
        state=self.sessions.get(sid)
        if not state:raise KeyError("session_expired")
        if not state.get("amount"):raise ValueError("Amount is required.")
        if not state.get("destination_country"):raise ValueError("Destination country is required.")
        request=ComparisonRequest(amount=state["amount"],destination_country=state["destination_country"],priority=state.get("priority"),urgency=state.get("urgency"),delivery_method=state.get("delivery_method"),payment_method=state.get("payment_method"),language=state.get("language","es"),send_currency="USD",special_need=state.get("special_need"))
        return self.compare(request,sid)

    def compare(self,request,session_id=None):
        language=request.language if request.language in ("es","en") else "es"
        country=str(request.destination_country).upper().strip()
        if request.amount<=0:raise ValueError("Amount must be greater than zero.")
        if not self.country_supported(country):raise ValueError("Destination country is not supported.")
        available=[];verified=[]
        for pid in self.corridor_provider_ids(country):
            public=self.provider_public_option(pid,country,language)
            if public:available.append(public)
            p=self.get_provider(pid)
            c=p.get("commercial_data",{}) if p else {}
            if p and self.commercial_verified(c):verified.append(self._build_verified_result(p,c,request,language))
        verified_ids={x.provider_id for x in verified}
        for x in available:
            x["commercial_verified"]=x["provider_id"] in verified_ids
            x["commercial_status"]="verified" if x["provider_id"] in verified_ids else "unavailable"
        if session_id in self.sessions:
            s=self.sessions[session_id]
            s["candidate_providers"]=[x["provider_id"] for x in available]
            s["available_providers"]=deepcopy(available)
            s["verified_results"]=[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified]
            s["current_step"]="results"
            s["updated_at"]=self.now()
        if verified:
            message="Encontramos información comprobada para revisar." if language=="es" else "We found verified information to review."
        else:
            message="Tenemos estas opciones para revisar. Los precios, tasas y tiempos actuales se mostrarán en la página oficial si no podemos comprobarlos aquí." if language=="es" else "We have these options to review. Current prices, rates and delivery times will be shown on the official site if we cannot verify them here."
        return {"success":True,"message":message,"results":[x.model_dump() if hasattr(x,"model_dump") else x.dict() for x in verified],"available_providers":available,"provider_count":len(available),"verified_count":len(verified),"results_available":bool(verified),"destination_country":country,"destination_name":self.country_name(country,language),"amount":request.amount,"send_currency":request.send_currency,"priority":request.priority,"urgency":request.urgency,"language":language,"explanation":self.comparison_explanation(language,bool(verified)),"differences":self._simple_difference_text(available,language),"precautions":self._precautions(language)}

    def comparison_explanation(self,language="es",verified=False):
        if verified:return "Te mostramos solamente información que podemos respaldar con una fuente y una fecha de comprobación." if language=="es" else "We show only information we can support with a source and verification date."
        return "No vamos a inventar precios, tasas, tiempos ni cantidades. Cuando un dato no está comprobado, te indicamos dónde verlo directamente." if language=="es" else "We will not guess prices, rates, delivery times or amounts. When information is not verified, we show you where to check it directly."

    def _simple_difference_text(self,providers,language="es"):
        result=[]
        online=[p["provider_name"] for p in providers if p.get("online")]
        agent=[p["provider_name"] for p in providers if p.get("agent")]
        if online:result.append({"title":"Puedes hacerlo por internet" if language=="es" else "You can do it online","text":"Estas opciones permiten comenzar el envío por internet." if language=="es" else "These options let you start the transfer online.","providers":online})
        if agent:result.append({"title":"También hay ayuda en persona" if language=="es" else "You can also get help in person","text":"Estas opciones indican que tienen agentes u oficinas." if language=="es" else "These options indicate that they have agents or offices.","providers":agent})
        return result

    def _precautions(self,language="es"):
        if language=="en":return ["Check the recipient's information before confirming.","Never enter passwords, CVV, security codes or login credentials here.","The transfer is completed on the provider's official website."]
        return ["Revisa los datos de la persona que recibirá el dinero antes de confirmar.","Nunca escribas aquí contraseñas, CVV, códigos de seguridad ni claves de acceso.","El envío se completa en la página oficial de la remesadora."]

    def select_provider(self,sid,provider_id):
        state=self.sessions.get(sid)
        if not state:raise KeyError("session_expired")
        country=state.get("destination_country")
        if not country or provider_id not in self.corridor_provider_ids(country):raise KeyError("provider_not_available")
        option=self.provider_public_option(provider_id,country,state.get("language","es"))
        if not option:raise KeyError("provider_not_found")
        state["selected_option"]=deepcopy(option);state["current_step"]="final_check";state["updated_at"]=self.now()
        return option

    def final_check(self,request,sid=None):
        language=request.language if request.language in ("es","en") else "es"
        checks=[
            {"id":"destination","label":"País de destino" if language=="es" else "Destination country","value":self.country_name(request.destination_country,language),"complete":self.country_supported(request.destination_country),"status":"ok" if self.country_supported(request.destination_country) else "review"},
            {"id":"amount","label":"Cantidad a enviar" if language=="es" else "Amount to send","value":f"{request.amount:.2f} {request.send_currency}","complete":request.amount>0,"status":"ok" if request.amount>0 else "review"},
            {"id":"currency","label":"Moneda" if language=="es" else "Currency","value":request.send_currency,"complete":bool(request.send_currency),"status":"ok"},
            {"id":"delivery_method","label":"Cómo recibirá el dinero" if language=="es" else "How the money is received","value":request.delivery_method or ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok"},
            {"id":"fee","label":"Comisión" if language=="es" else "Fee","value":request.fee if request.fee is not None else ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok"},
            {"id":"exchange_rate","label":"Tasa de cambio" if language=="es" else "Exchange rate","value":request.exchange_rate if request.exchange_rate is not None else ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok"},
            {"id":"recipient_amount","label":"Cantidad que recibiría" if language=="es" else "Recipient gets","value":request.recipient_amount if request.recipient_amount is not None else ("La remesadora lo mostrará" if language=="es" else "The provider will show it"),"complete":True,"status":"ok"}]
        valid=all(x["complete"] for x in checks[:3])
        if sid in self.sessions:self.sessions[sid]["final_check"]={"checks":deepcopy(checks),"valid":valid}
        return {"success":True,"ready_to_continue":valid,"language":language,"provider_id":request.provider_id,"checks":checks,"message":"Todo está listo. La remesadora te mostrará las condiciones finales antes de enviar." if language=="es" else "Everything is ready. The provider will show the final conditions before you send.","precautions":self._precautions(language),"requirements":self.provider_requirements(request.provider_id,language)}

    def provider_requirements(self,pid,language="es"):
        p=self.get_provider(pid)
        return [self.localize(x,language) for x in p.get("requirements",[])] if p else []

    def help_topics(self,language="es"):
        topics=[
            ("exchange_rate","¿Qué es la tasa de cambio?","Es la relación entre el dinero que envías y el dinero que recibe la otra persona.","What is an exchange rate?","It is the relationship between the money you send and the money the other person receives."),
            ("fee","¿Qué es una comisión?","Es un cargo que puede cobrar la remesadora por hacer el envío.","What is a fee?","It is a charge the provider may apply."),
            ("mistake","¿Qué hago si me equivoqué?","No confirmes el envío. Revisa y corrige los datos primero.","What if I made a mistake?","Do not confirm the transfer. Review and correct the information first."),
            ("security","¿Qué información no debo poner aquí?","No escribas contraseñas, CVV, códigos de seguridad ni claves de acceso.","What should I not enter here?","Do not enter passwords, CVV numbers, security codes or login credentials.")]
        return [{"id":i,"label":es if language=="es" else en,"answer":a_es if language=="es" else a_en} for i,es,a_es,en,a_en in topics]

    def assistant_response(self,need_type,language="es",text=""):
        responses={
            "remittance":{"es":"Te ayudo a preparar un envío de dinero. Dime cuánto quieres enviar y a qué país.","en":"I can help you prepare a money transfer. Tell me how much you want to send and which country."},
            "family":{"es":"Podemos organizar el dinero que quieres dedicar a tu familia. Dime cuánto quieres apartar y cada cuánto.","en":"We can organize the money you want to set aside for family. Tell me how much and how often."},
            "savings":{"es":"Podemos calcular cuánto puedes guardar y para qué quieres guardarlo.","en":"We can calculate how much you can save and what you want to save for."},
            "expenses":{"es":"Podemos revisar tus gastos y encontrar los pequeños gastos que se van acumulando.","en":"We can review your spending and find small expenses that add up."},
            "purchase":{"es":"Podemos revisar una compra antes de hacerla para saber cómo afecta tu dinero.","en":"We can review a purchase before you make it to see how it affects your money."},
            "money_available":{"es":"Podemos calcular cuánto dinero tienes disponible después de tus gastos, ahorros y envíos.","en":"We can calculate how much money you have available after expenses, savings and transfers."},
            "budget":{"es":"Podemos ordenar tu dinero para que sepas cuánto tienes, cuánto gastas y cuánto puedes guardar.","en":"We can organize your money so you know what you have, spend and save."},
            "requirements":{"es":"Si no puedo comprobar un requisito, no lo invento. Te llevo a la información oficial.","en":"If I cannot verify a requirement, I will not guess. I will take you to official information."},
            "fees":{"es":"Puedo explicarte qué es una comisión. Si necesitas el costo actual, te llevo a la información oficial cuando no esté comprobado aquí.","en":"I can explain what a fee means. If you need the current cost, I take you to official information when it is not verified here."},
            "exchange_rate":{"es":"La tasa de cambio indica cuánto dinero recibe la otra persona en su moneda. Si no puedo comprobar la tasa actual, no la invento.","en":"The exchange rate shows how much the other person receives in their currency. If I cannot verify the current rate, I will not guess."},
            "delivery":{"es":"Puedo explicarte cómo puede recibir el dinero. Para un tiempo exacto no comprobado, te llevo a la fuente oficial.","en":"I can explain how the money can be received. For an exact unverified time, I take you to the official source."},
            "provider_difference":{"es":"Te explico las diferencias que realmente pueden ayudarte. No necesitas conocer palabras técnicas.","en":"I explain the differences that can actually help you. You do not need technical words."},
            "mistake_prevention":{"es":"Si detectas un error, no confirmes. Corrige los datos primero.","en":"If you find a mistake, do not confirm. Correct the information first."},
            "cancellation":{"es":"La cancelación depende de la remesadora y del estado del envío. Puedo llevarte a la ayuda oficial.","en":"Cancellation depends on the provider and transfer status. I can take you to official help."},
            "recipient_information":{"es":"Revisa el nombre y los datos de la persona que recibirá el dinero antes de confirmar.","en":"Review the recipient's name and information before confirming."},
            "security":{"es":"Nunca escribas aquí contraseñas, CVV, códigos de seguridad ni credenciales.","en":"Never enter passwords, CVV numbers, security codes or credentials."},
            "other":{"es":"No tienes que saber cómo hacerlo. Cuéntame con tus propias palabras qué necesitas y te ayudo.","en":"You do not need to know how to do it. Tell me in your own words what you need and I will help."}}
        return {"success":True,"need_type":need_type,"message":responses.get(need_type,responses["other"])[language],"language":language,"remittance_required":need_type=="remittance","next_step":"amount" if need_type=="remittance" else "assistant"}

    def calculate_money_plan(self,income=0,essential=0,flexible=0,savings=0,remittance=0):
        values={k:max(float(v or 0),0) for k,v in {"income":income,"essential":essential,"flexible":flexible,"savings":savings,"remittance":remittance}.items()}
        available=round(values["income"]-values["essential"]-values["flexible"]-values["savings"]-values["remittance"],2)
        return {**values,"available":available,"negative_warning":available<0,"currency":"USD","informational":True}

    def public_config(self,language="es"):
        language=language if language in ("es","en") else "es"
        opening=self.brain.get("opening",{})
        raw=opening.get("priorities",[])
        priorities=[]
        for x in raw:
            if isinstance(x,dict):priorities.append({"id":x.get("id"),"icon":x.get("icon",""),"label":self.localize(x.get("label"),language),"why":self.localize(x.get("why"),language)})
        countries=[{"id":x["code"],"code":x["code"],"name":self.localize(x["name"],language)} for x in self.get_supported_countries()]
        providers=[self.human_provider_option(p,"",language) for p in self.get_provider_registry()]
        menu=[
            {"id":"remittance","icon":"💸","label":{"es":"REMESAS","en":"REMITTANCES"},"text":{"es":"Enviar dinero a otra persona","en":"Send money to another person"}},
            {"id":"family","icon":"❤️","label":{"es":"FAMILIA","en":"FAMILY"},"text":{"es":"Organizar dinero para tu familia","en":"Organize money for your family"}},
            {"id":"savings","icon":"🐷","label":{"es":"AHORRO","en":"SAVINGS"},"text":{"es":"Guardar dinero para algo importante","en":"Save money for something important"}},
            {"id":"expenses","icon":"🧾","label":{"es":"GASTOS","en":"EXPENSES"},"text":{"es":"Entender dónde se va tu dinero","en":"Understand where your money goes"}},
            {"id":"purchase","icon":"🛒","label":{"es":"COMPRAS","en":"PURCHASES"},"text":{"es":"Ver si puedes comprar algo","en":"See if you can afford something"}},
            {"id":"money_available","icon":"💰","label":{"es":"MI DINERO","en":"MY MONEY"},"text":{"es":"Saber cuánto tienes disponible","en":"Know how much money you have available"}},
            {"id":"budget","icon":"📅","label":{"es":"PRESUPUESTO","en":"BUDGET"},"text":{"es":"Ordenar tu dinero","en":"Organize your money"}},
            {"id":"other","icon":"❓","label":{"es":"OTRA COSA","en":"SOMETHING ELSE"},"text":{"es":"Cuéntanos qué necesitas","en":"Tell us what you need"}}]
        return {"app":deepcopy(self.brain.get("app",{})),"language":language,"supported_languages":["es","en"],"purpose":{"es":"REMESAS te ayuda a entender, organizar y preparar tu dinero sin palabras complicadas.","en":"REMESAS helps you understand, organize and prepare your money without complicated words."},"opening":{"title":self.localize(opening.get("title") or {"es":"REMESAS","en":"REMITTANCES"},language),"subtitle":self.localize(opening.get("subtitle"),language) or ("Aquí puedes organizar tu dinero y resolver lo que necesitas." if language=="es" else "Here you can organize your money and solve what you need."),"welcome":self.localize(opening.get("welcome"),language),"primary_question":self.localize(opening.get("primary_question"),language) or ("¿QUÉ NECESITAS HOY?" if language=="es" else "WHAT DO YOU NEED TODAY?"),"secondary_text":self.localize(opening.get("secondary_text"),language) or ("No tienes que saber de bancos ni de tecnología. Dinos qué necesitas." if language=="es" else "You do not need to know banking or technology. Tell us what you need."),"amount":deepcopy(opening.get("amount",{})),"priorities":priorities,"free_text":deepcopy(opening.get("free_text",{})),"start":self.localize(opening.get("start"),language) or ("COMENZAR" if language=="es" else "START"),"language":"EN" if language=="es" else "ES"},"menu":menu,"countries":countries,"providers":providers,"help_topics":self.help_topics(language),"provider_handoff":deepcopy(self.brain.get("provider_handoff",{})),"money_planner":deepcopy(self.brain.get("money_planner",{})),"money_box":deepcopy(self.brain.get("money_box",{})),"security":deepcopy(self.brain.get("security",{})),"privacy":deepcopy(self.brain.get("data_privacy",{}))}

engine=RemittanceEngine()
