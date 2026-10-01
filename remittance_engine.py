import json,re,time,uuid
from pathlib import Path
from typing import Any,Dict,List,Optional
from schemas import *

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_FILE=DATA_DIR/"app_brain.json"
PROVIDERS_FILE=DATA_DIR/"providers.json"

def _read(path,default):
    try:
        with path.open("r",encoding="utf-8") as f:return json.load(f)
    except Exception:return default

def _text(v,lang="es"):
    if isinstance(v,dict):
        return str(v.get(lang) or v.get("es") or v.get("en") or next(iter(v.values()),""))
    return str(v or "")

def _num(v):
    try:return float(v or 0)
    except Exception:return 0.0

def _money(v):
    return round(max(0,_num(v)),2)

def _token():
    return uuid.uuid4().hex

class RemittanceEngine:
    def __init__(self):
        self.brain={}
        self.providers_data={}
        self.providers=[]
        self.countries=[]
        self.sessions={}
        self.reload()

    def reload(self):
        self.brain=_read(BRAIN_FILE,{})
        raw=_read(PROVIDERS_FILE,{})
        self.providers_data=raw if isinstance(raw,dict) else {}
        self.providers=self.providers_data.get("providers",[]) if isinstance(self.providers_data,dict) else []
        self.countries=self.brain.get("countries") or self.providers_data.get("countries") or []
        if not isinstance(self.providers,list):self.providers=[]
        if not isinstance(self.countries,list):self.countries=[]
        return self

    def _app(self):
        return self.brain.get("app",{}) if isinstance(self.brain,dict) else {}

    def _opening(self):
        return self.brain.get("opening",{}) if isinstance(self.brain,dict) else {}

    def _country(self,country):
        q=str(country or "").strip().upper()
        for c in self.countries:
            if not isinstance(c,dict):continue
            vals=[c.get("id"),c.get("code"),*(c.get("aliases") or [])]
            if any(str(x or "").strip().upper()==q for x in vals):return c
        return None

    def _country_name(self,country,lang="es"):
        c=self._country(country)
        return _text(c.get("name") if c else country,lang)

    def _provider(self,pid):
        q=str(pid or "").strip().lower()
        for p in self.providers:
            if isinstance(p,dict) and str(p.get("id","")).lower()==q:return p
        return None

    def _provider_name(self,p,lang="es"):
        return _text(p.get("name") if isinstance(p,dict) else p,lang)

    def _official_url(self,p,kind="send_money"):
        if not isinstance(p,dict):return None
        urls=p.get("official_urls") or {}
        if isinstance(urls,dict):
            return urls.get(kind) or urls.get("site") or urls.get("send_money")
        return p.get("official_site")

    def _provider_status(self,p):
        c=p.get("commercial") or p.get("commercial_data") or {}
        if not isinstance(c,dict):return "unavailable"
        s=str(c.get("status") or p.get("commercial_status") or "unavailable").lower()
        return s if s in ("verified","stale","restricted","not_applicable","unavailable") else "unavailable"

    def _commercial(self,p,country=None,amount=None):
        c=p.get("commercial") or p.get("commercial_data") or {}
        if not isinstance(c,dict):return None
        status=str(c.get("status") or "unavailable").lower()
        source=c.get("source") or c.get("official_source")
        verified=c.get("verified_at")
        if status!="verified" or not source or not verified:return None
        cc=str(c.get("country") or "").upper()
        if cc and country and cc!=str(country).upper():return None
        return c

    def _label_method(self,x,lang="es"):
        if isinstance(x,dict):
            return _text(x.get("name") or x.get("label") or x.get("id"),lang)
        m={
            "bank_account":("Cuenta bancaria","Bank account"),
            "cash_pickup":("Efectivo","Cash pickup"),
            "debit_card":("Tarjeta débito","Debit card"),
            "mobile_wallet":("Billetera móvil","Mobile wallet"),
            "home_delivery":("Entrega a domicilio","Home delivery"),
            "credit_card":("Tarjeta crédito","Credit card"),
            "cash":("Efectivo","Cash"),
            "digital_wallet":("Billetera digital","Digital wallet")
        }
        a=m.get(str(x),(str(x),str(x)))
        return a[1] if lang=="en" else a[0]

    def _relevance_reason(self,p,country,lang="es"):
        supported=[str(x).upper() for x in (p.get("countries") or [])]
        if not supported or str(country or "").upper() in supported:
            return "Disponible para este destino" if lang=="es" else "Available for this destination"
        return "Revisa disponibilidad para este destino" if lang=="es" else "Check availability for this destination"

    def _provider_option(self,p,country,lang="es"):
        pid=str(p.get("id",""))
        status=self._provider_status(p)
        url=self._official_url(p)
        pays=[self._label_method(x,lang) for x in (p.get("payment_methods") or [])]
        dels=[self._label_method(x,lang) for x in (p.get("delivery_methods") or [])]
        return ProviderOption(
            provider_id=pid,
            provider_name=self._provider_name(p,lang),
            country=str(country or "").upper(),
            official_site=url,
            continue_url=url,
            payment_methods=pays,
            delivery_methods=dels,
            commercial_status=status,
            commercial_verified=status=="verified",
            description=_text(p.get("description"),lang),
            relevance_reason=self._relevance_reason(p,country,lang)
        )

    def _candidate_ids(self,country):
        c=self._country(country)
        ids=[]
        if c and isinstance(c,dict):
            ids=[str(x) for x in (c.get("available_providers") or [])]
        if ids:
            return [
                str(p.get("id"))
                for p in self.providers
                if isinstance(p,dict) and str(p.get("id")) in ids
            ]
        out=[]
        for p in self.providers:
            if not isinstance(p,dict):continue
            supported=[str(x).upper() for x in (p.get("countries") or [])]
            if not supported or str(country or "").upper() in supported:
                out.append(str(p.get("id")))
        return out or [
            str(p.get("id"))
            for p in self.providers
            if isinstance(p,dict) and p.get("id")
        ]

    def public_config(self,language="es"):
        lang=language if language in ("es","en") else "es"
        countries=[]
        for c in self.countries:
            if isinstance(c,dict):
                x=dict(c)
                x["name"]=_text(c.get("name"),lang)
                countries.append(x)
        providers=[]
        for p in self.providers:
            if isinstance(p,dict):
                x=dict(p)
                x["name"]=self._provider_name(p,lang)
                x["description"]=_text(p.get("description"),lang)
                providers.append(x)
        return {
            "app":self._app(),
            "opening":self._opening(),
            "countries":countries,
            "providers":providers,
            "delivery_methods":self.brain.get("delivery_methods",self._app().get("delivery_methods",[])),
            "payment_methods":self.brain.get("payment_methods",self._app().get("payment_methods",[])),
            "help_topics":self.help_topics(lang),
            "learning":self.get_learning_lessons(lang),
            "legal":self.brain.get("legal",{}),
            "security":self.brain.get("security",{}),
            "handoff":self.brain.get("handoff",{}),
            "experience":self.brain.get("experience",{}),
            "conversation_logic":self.brain.get("conversation_logic",{})
        }

    def create_session(self,language="es",**kwargs):
        sid=_token()
        now=time.time()
        allowed={
            k:v for k,v in kwargs.items()
            if k in SessionState.model_fields and k not in ("session_id","created_at","updated_at")
        }
        s=SessionState(
            session_id=sid,
            language=language if language in ("es","en") else "es",
            created_at=now,
            updated_at=now,
            **allowed
        )
        s.candidate_providers=self._candidate_ids(s.destination_country)
        if s.destination_country:
            s.available_providers=[
                self._provider_option(self._provider(x),s.destination_country,s.language)
                for x in s.candidate_providers if self._provider(x)
            ]
        self.sessions[sid]=s
        return s

    def get_session(self,session_id):
        return self.sessions.get(session_id)

    def clear_session(self,session_id):
        self.sessions.pop(session_id,None)
        return True

    def update_session(self,session_id,**kwargs):
        s=self.get_session(session_id)
        if not s:raise ValueError("Session not found")
        for k,v in kwargs.items():
            if k in SessionState.model_fields and k not in ("session_id","created_at"):
                setattr(s,k,v)
        if s.destination_country:
            s.candidate_providers=self._candidate_ids(s.destination_country)
            s.available_providers=[
                self._provider_option(self._provider(x),s.destination_country,s.language)
                for x in s.candidate_providers if self._provider(x)
            ]
        s.updated_at=time.time()
        return s

    def _amount_from_text(self,text):
        m=re.search(
            r"(?<!\d)(?:\$\s*)?(\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?!\d)",
            str(text or "")
        )
        if not m:return None
        z=m.group(1).replace(" ","")
        if "," in z and "." in z:
            z=z.replace(".","").replace(",",".") if z.rfind(",")>z.rfind(".") else z.replace(",","")
        elif "," in z:
            a=z.split(",")
            z=".".join(a) if len(a[-1])<=2 else "".join(a)
        try:return float(z)
        except:return None

    def _country_from_text(self,text):
        low=str(text or "").lower()
        for c in self.countries:
            if not isinstance(c,dict):continue
            vals=[c.get("id"),c.get("code"),c.get("name"),*(c.get("aliases") or [])]
            for v in vals:
                if isinstance(v,dict):
                    vals.extend(v.values())
                    continue
                if v and str(v).lower() in low:
                    return str(c.get("id") or c.get("code")).upper()
        return None

    def _priority_from_text(self,text):
        q=str(text or "").lower()
        if any(x in q for x in ("rápido","rapido","urgente","quick","fast")):return "fastest"
        if any(x in q for x in ("más dinero","mas dinero","reciba más","reciba mas","more")):return "recipient_gets_more"
        if any(x in q for x in ("barato","menos","ahorrar","save","cheap")):return "save"
        if any(x in q for x in ("todo","equilibr","balance")):return "balanced"
        return None

    def classify_need(self,text):
        q=str(text or "").lower()
        ordered=[
            ("security",("contraseña","password","codigo","código","estafa","fraude","seguro")),
            ("fees",("comisión","comision","fee","costo","cuesta")),
            ("exchange_rate",("tasa","tipo de cambio","exchange rate")),
            ("delivery",("entrega","recibir","pickup","cash pickup","banco")),
            ("recipient_information",("datos del receptor","datos de quien recibe","recipient")),
            ("cancellation",("cancelar","cancelación","cancel")),
            ("mistake_prevention",("equivo","error","miedo","nervioso","confund")),
            ("savings",("ahorrar","ahorro","guardar dinero")),
            ("purchase",("comprar","compra","zapatos","ropa","carro","casa","viaje")),
            ("family",("familia","mamá","mama","papá","papa","ayudar")),
            ("expenses",("gasto","gasté","gaste","pagar","renta","comida")),
            ("budget",("presupuesto","cuánto puedo gastar","cuanto puedo gastar")),
            ("money_available",("cuánto tengo","cuanto tengo","disponible")),
            ("remittance",("enviar dinero","mandar dinero","remesa","remesas","send money")),
            ("requirements",("necesito","requisito","documento"))
        ]
        for k,words in ordered:
            if any(w in q for w in words):return k
        return "other"

    def parse_need(self,language="es",text="",current_amount=None,current_destination_country=None):
        q=str(text or "").strip()
        need=self.classify_need(q)
        amount=current_amount if current_amount is not None else self._amount_from_text(q)
        dest=current_destination_country or self._country_from_text(q)
        priority=self._priority_from_text(q)
        urgency=bool(re.search(r"\burgent|urgente|hoy|today\b",q,re.I)) if q else None
        missing=[]
        if need=="remittance":
            if not amount:missing.append("amount")
            if not dest:missing.append("destination_country")
        return ParsedNeed(
            need_type=need,
            amount=amount,
            destination_country=dest,
            priority=priority,
            urgency=urgency,
            original_text=q,
            raw_text=q,
            missing_information=missing,
            confidence=.95 if need!="other" else .45
        )

    def apply_need(self,session_id,need):
        s=self.get_session(session_id)
        if not s:raise ValueError("Session not found")
        d=need.model_dump() if hasattr(need,"model_dump") else dict(need)
        keys=(
            "amount","send_currency","destination_country","priority","urgency",
            "delivery_method","payment_method","recipient_amount_target",
            "frequency","special_need","free_text","need_type"
        )
        for k in keys:
            if k in d and d[k] is not None:setattr(s,k,d[k])
        s.parsed_user_need=d
        s.updated_at=time.time()
        if s.destination_country:
            s.candidate_providers=self._candidate_ids(s.destination_country)
            s.available_providers=[
                self._provider_option(self._provider(x),s.destination_country,s.language)
                for x in s.candidate_providers if self._provider(x)
            ]
        return s

    def compare(self,request):
        r=request if isinstance(request,ComparisonRequest) else ComparisonRequest(**request)
        ids=r.provider_ids or self._candidate_ids(r.destination_country)
        opts=[]
        results=[]
        for pid in ids:
            p=self._provider(pid)
            if not p:continue
            opts.append(self._provider_option(p,r.destination_country,r.language))
            c=self._commercial(p,r.destination_country,r.amount)
            if c:
                results.append(
                    ComparisonResult(
                        provider_id=str(pid),
                        provider_name=self._provider_name(p,r.language),
                        status="verified",
                        fee=c.get("fee"),
                        exchange_rate=c.get("exchange_rate"),
                        recipient_amount=c.get("recipient_amount"),
                        estimated_delivery=c.get("estimated_delivery"),
                        availability=c.get("availability"),
                        source=c.get("source"),
                        verified_at=c.get("verified_at"),
                        relevance_reason=self._relevance_reason(p,r.destination_country,r.language),
                        continue_url=self._official_url(p)
                    )
                )
        if results:
            exp=(
                f"{len(results)} opción(es) tiene(n) datos actuales confirmados."
                if r.language=="es"
                else f"{len(results)} option(s) have current confirmed data."
            )
        else:
            exp=(
                "Las cuatro opciones se muestran para que puedas revisarlas. "
                "El costo, la tasa, el tiempo y la disponibilidad pueden cambiar; "
                "confirma esos datos en la página oficial antes de enviar."
                if r.language=="es"
                else
                "The four options are shown so you can review them. "
                "Cost, rate, timing, and availability can change; "
                "confirm those details on the official page before sending."
            )
        return ComparisonResponse(
            amount=r.amount,
            send_currency=r.send_currency,
            destination_country=r.destination_country,
            available_providers=opts,
            results=results,
            verified_count=len(results),
            results_available=bool(results),
            explanation=exp,
            next_step=(
                "Revisa la opción que te interese y después confirma los datos finales en el sitio oficial."
                if r.language=="es"
                else
                "Review the option you want and then confirm the final details on the official site."
            )
        )

    def compare_session(self,session_id):
        s=self.get_session(session_id)
        if not s:raise ValueError("Session not found")
        r=self.compare(
            ComparisonRequest(
                language=s.language,
                amount=_num(s.amount),
                send_currency=s.send_currency,
                destination_country=str(s.destination_country or ""),
                priority=s.priority,
                urgency=s.urgency,
                delivery_method=s.delivery_method,
                payment_method=s.payment_method,
                recipient_amount_target=s.recipient_amount_target,
                frequency=s.frequency,
                special_need=s.special_need,
                provider_ids=s.candidate_providers
            )
        )
        s.available_providers=r.available_providers
        s.verified_results=r.results
        s.current_step="comparison"
        s.updated_at=time.time()
        return r

    def select_provider(self,session_id,provider_id):
        s=self.get_session(session_id)
        if not s:raise ValueError("Session not found")
        pid=str(provider_id)
        p=self._provider(pid)
        if not p or pid not in s.candidate_providers:
            raise ValueError("Provider not available for this session")
        s.selected_option=self._provider_option(p,s.destination_country,s.language)
        s.current_step="selected"
        s.updated_at=time.time()
        return s

    def final_check(self,session_id,request):
        s=self.get_session(session_id)
        if not s:raise ValueError("Session not found")
        r=request if isinstance(request,FinalCheckRequest) else FinalCheckRequest(**request)
        pid=r.provider_id or (s.selected_option.provider_id if s.selected_option else "")
        p=self._provider(pid)
        if not p:raise ValueError("Provider not found")
        checks=[]
        req=[]

        def add(i,label,ok,msg,required=False):
            checks.append(FinalCheckItem(id=i,label=label,ok=ok,message=msg))
            if required and not ok:req.append(msg)

        add(
            "amount",
            "Cantidad",
            r.amount>0,
            "Revisa la cantidad antes de continuar.",
            True
        )
        add(
            "country",
            "País",
            bool(r.destination_country),
            "Revisa el país de destino.",
            True
        )
        add(
            "recipient",
            "Datos de quien recibe",
            bool(r.recipient_information_entered),
            "Todavía necesitas tener los datos que pida la remesadora oficial.",
            True
        )

        if r.delivery_method:
            add("delivery","Forma de entrega",True,"Forma de entrega seleccionada.")
        else:
            add(
                "delivery",
                "Forma de entrega",
                False,
                "La remesadora puede pedirte que elijas cómo recibirá la persona."
            )

        if r.payment_method:
            add("payment","Forma de pago",True,"Forma de pago seleccionada.")
        else:
            add(
                "payment",
                "Forma de pago",
                False,
                "La remesadora puede pedirte que elijas cómo pagarás."
            )

        c=self._commercial(p,r.destination_country,r.amount)
        if c:
            add(
                "commercial",
                "Datos actuales",
                True,
                "Hay datos comerciales confirmados para esta consulta."
            )
        else:
            add(
                "commercial",
                "Datos actuales",
                False,
                "Confirma costo, tasa, tiempo y disponibilidad directamente con la remesadora."
            )

        ready=all(x.ok for x in checks if x.id in ("amount","country","recipient"))
        url=self._official_url(p)

        msg=(
            "Ya tienes lo necesario para entrar a la página oficial. "
            "Allí verás las condiciones finales antes de confirmar."
            if ready
            else
            "Todavía falta revisar una cosa importante. "
            "No pasa nada: puedes completarla antes de continuar."
        )

        note=(
            "REMESAS no recibe ni envía el dinero. "
            "El envío se hace directamente con la remesadora oficial."
        )

        out=FinalCheckResponse(
            ready_to_continue=ready,
            message=msg,
            requirements=req,
            checks=checks,
            important_note=note,
            continue_url=url
        )
        s.final_check=out
        s.current_step="final_check"
        s.updated_at=time.time()
        return out

    def help_topics(self,language="es"):
        src=self.brain.get("help_topics") or self.brain.get("help",{}).get("topics") or []
        if isinstance(src,dict):
            src=[
                {"id":k,**(v if isinstance(v,dict) else {"title":v})}
                for k,v in src.items()
            ]
        out=[]
        for x in src:
            if not isinstance(x,dict):continue
            out.append({
                "id":x.get("id","help"),
                "title":_text(x.get("title"),language),
                "answer":_text(x.get("answer") or x.get("text"),language)
            })
        if out:return out
        return [
            {
                "id":"money",
                "title":"¿Qué significa un número?" if language=="es" else "What does a number mean?",
                "answer":"Te diremos qué representa y para qué sirve. Si no lo necesitas, no tienes que mirarlo." if language=="es" else "We will tell you what it means and why it matters. If you do not need it, you do not have to look at it."
            },
            {
                "id":"remittance",
                "title":"¿Cómo envío dinero?" if language=="es" else "How do I send money?",
                "answer":"Primero ponemos claro cuánto y a qué país. Después revisas las opciones y confirmas todo con la remesadora oficial." if language=="es" else "First we make clear how much and where. Then you review the options and confirm everything with the official provider."
            },
            {
                "id":"simple",
                "title":"No entiendo una cifra" if language=="es" else "I do not understand a number",
                "answer":"No tienes que saber cuentas. La aplicación debe explicarte la cifra con palabras sencillas y decirte qué cambió." if language=="es" else "You do not need to know accounting. The app should explain the number in simple words and tell you what changed."
            }
        ]

    def get_learning_lessons(self,language="es"):
        src=self.brain.get("learning") or self.brain.get("lessons") or []
        if isinstance(src,dict):src=list(src.values())
        if src:return src
        return [
            {
                "id":"before_you_start",
                "title":"Antes de empezar" if language=="es" else "Before you start",
                "text":"Ten claro cuánto quieres enviar y a quién. Nunca compartas contraseñas ni códigos de seguridad." if language=="es" else "Know how much you want to send and to whom. Never share passwords or security codes."
            },
            {
                "id":"review",
                "title":"Revisar antes de enviar" if language=="es" else "Review before sending",
                "text":"Mira nombre, cantidad, costo, tasa, cantidad recibida y condiciones en la página oficial." if language=="es" else "Review the name, amount, cost, rate, recipient amount, and conditions on the official site."
            }
        ]

    def provider_learning(self,provider_id,language="es"):
        p=self._provider(provider_id)
        if not p:return {"provider_id":provider_id,"lessons":[]}
        return {
            "provider_id":provider_id,
            "provider_name":self._provider_name(p,language),
            "lessons":p.get("learning") or []
        }

    def quick_guide(self,language="es"):
        return [
            {"step":1,"text":"Elige el país." if language=="es" else "Choose the country."},
            {"step":2,"text":"Escribe cuánto quieres enviar." if language=="es" else "Enter how much you want to send."},
            {"step":3,"text":"Mira las opciones." if language=="es" else "Review the options."},
            {"step":4,"text":"Confirma costo, tasa, cantidad recibida y tiempo en la página oficial." if language=="es" else "Confirm cost, rate, recipient amount, and timing on the official site."},
            {"step":5,"text":"Tú decides si continúas." if language=="es" else "You decide whether to continue."}
        ]

    def learning_pdf_data(self,language="es"):
        return {
            "title":"Guía REMESAS" if language=="es" else "REMESAS Guide",
            "lessons":self.get_learning_lessons(language),
            "note":"Consulta las condiciones actuales con la remesadora oficial." if language=="es" else "Check current conditions with the official provider."
        }

    def financial_snapshot(self,data,language="es"):
        d=data if isinstance(data,dict) else {}
        m=d.get("money") or {}
        expenses=d.get("expenses") or []
        savings=d.get("savings") or []
        family=d.get("family") or []

        have=_num(m.get("have"))
        income=_num(m.get("incomeTotal") or m.get("monthlyIncome"))
        remittance=_num(m.get("remittance"))

        expense_month=sum(
            _num(x.get("monthlyAmount",x.get("amount")))
            for x in expenses if isinstance(x,dict)
        )

        save=sum(
            _num(x.get("amount"))
            for x in savings if isinstance(x,dict)
        )

        family_month=sum(
            _num(x.get("amount"))
            for x in family if isinstance(x,dict)
        )

        available=have+income-expense_month-save-remittance
        gap=max(0,-available)
        usable=max(0,available)

        daily=usable/30.4375
        weekly=usable/4.333333
        biweekly=usable/2.166667
        monthly=usable

        missing=[]
        if income<=0:missing.append("income")
        if not expenses:missing.append("expenses")
        if not d.get("profile"):missing.append("profile")

        return {
            "have":_money(have),
            "monthly_income":_money(income),
            "monthly_expenses":_money(expense_month),
            "monthly_savings":_money(save),
            "monthly_family_support":_money(family_month),
            "remittance":_money(remittance),
            "available":_money(usable),
            "has_gap":gap>0,
            "gap":_money(gap),
            "reference_spend":{
                "today":_money(daily),
                "week":_money(weekly),
                "biweekly":_money(biweekly),
                "month":_money(monthly)
            },
            "missing":missing,
            "language":language,
            "message":(
                "Con los datos que diste, esta es una referencia de lo que queda para usar. No es una orden."
                if language=="es"
                else
                "With the information you gave, this is a reference for what remains to use. It is not an order."
            )
        }

    def action_suggestion(self,data,language="es"):
        snap=self.financial_snapshot(data,language)

        if "income" in snap["missing"]:
            return {
                "action":"income",
                "title":"Primero dime qué dinero entra" if language=="es" else "First tell me what money comes in",
                "reason":"Sin saber lo que entra, la referencia puede quedar incompleta." if language=="es" else "Without knowing what comes in, the reference may be incomplete."
            }

        if "expenses" in snap["missing"]:
            return {
                "action":"expenses",
                "title":"Cuéntame en qué se va el dinero" if language=="es" else "Tell me where the money goes",
                "reason":"Así podemos mostrarte una referencia más cercana a tu vida." if language=="es" else "That lets us make the reference closer to your real life."
            }

        if snap["has_gap"]:
            return {
                "action":"review",
                "title":"Miremos juntos qué está pasando" if language=="es" else "Let us look at what is happening",
                "reason":"Tus datos no muestran dinero libre ahora. No te voy a poner un número negativo." if language=="es" else "Your data does not show free money right now. I will not put a negative number on the screen."
            }

        return {
            "action":"spend_reference",
            "title":"Ya puedo enseñarte una referencia sencilla" if language=="es" else "I can now show you a simple reference",
            "reason":"Usa tus propios datos y puedes cambiar cualquier dato cuando quieras." if language=="es" else "It uses your own information and you can change any item whenever you want."
        }

    def classify_financial_need(self,text):
        return self.classify_need(text)

    def get_financial_snapshot(self,data,language="es"):
        return self.financial_snapshot(data,language)

    def classify_need_response(self,text,language="es"):
        return self.parse_need(language,text)

    def assistant_response(self,language="es",message="",session_id=None):
        p=self.parse_need(language,message)
        a=self.action_suggestion(
            {"money":{},"expenses":[]},
            language
        )
        if language=="es":
            msg="Cuéntame qué quieres hacer y lo vamos poniendo en palabras sencillas."
        else:
            msg="Tell me what you want to do and we will put it into simple words."
        return AssistantResponse(
            message=msg,
            need_type=p.need_type,
            next_action=a.get("action"),
            parsed=p
        )

engine=RemittanceEngine()
