import json,re,uuid
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional

from schemas import (
    Language,Priority,DeliveryMethod,PaymentMethod,DataStatus,Urgency,
    UserNeedRequest,ParsedNeed,DetectedContext,MissingInformation,
    Constraint,DecisionFactor,NeedAnalysis,ProviderQuote,Compatibility,
    ProviderOption,ComparisonResult,ComparisonResponse,CostSummary,
    PreparationItem,PreparationGuide,RecipientInformation,GuideStep,
    SendGuide,FinalCheckItem,FinalCheckResponse,SessionState
)

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
PROVIDERS_FILE=DATA_DIR/"providers.json"
BRAIN_FILE=DATA_DIR/"app_brain.json"

SESSIONS:Dict[str,SessionState]={}
COMMERCIAL_TTL_HOURS=24

COUNTRY_ALIASES={
    "mexico":"MX","méxico":"MX","mx":"MX","guatemala":"GT","gt":"GT",
    "el salvador":"SV","salvador":"SV","sv":"SV","honduras":"HN","hn":"HN",
    "nicaragua":"NI","ni":"NI","costa rica":"CR","cr":"CR",
    "panama":"PA","panamá":"PA","pa":"PA",
    "dominican republic":"DO","república dominicana":"DO","republica dominicana":"DO","rd":"DO","do":"DO",
    "colombia":"CO","co":"CO","venezuela":"VE","ve":"VE",
    "ecuador":"EC","ec":"EC","peru":"PE","perú":"PE","pe":"PE",
    "bolivia":"BO","bo":"BO","paraguay":"PY","py":"PY",
    "brazil":"BR","brasil":"BR","br":"BR","chile":"CL","cl":"CL",
    "argentina":"AR","ar":"AR","uruguay":"UY","uy":"UY",
    "cuba":"CU","cu":"CU","haiti":"HT","haití":"HT","ht":"HT",
    "belize":"BZ","bz":"BZ","guyana":"GY","gy":"GY",
    "suriname":"SR","surinam":"SR","sr":"SR","jamaica":"JM","jm":"JM",
    "trinidad and tobago":"TT","trinidad y tobago":"TT","tt":"TT"
}

COUNTRY_NAMES={
    "MX":"Mexico","GT":"Guatemala","SV":"El Salvador","HN":"Honduras","NI":"Nicaragua",
    "CR":"Costa Rica","PA":"Panama","DO":"Dominican Republic","CO":"Colombia",
    "VE":"Venezuela","EC":"Ecuador","PE":"Peru","BO":"Bolivia","PY":"Paraguay",
    "BR":"Brazil","CL":"Chile","AR":"Argentina","UY":"Uruguay","CU":"Cuba",
    "HT":"Haiti","BZ":"Belize","GY":"Guyana","SR":"Suriname","JM":"Jamaica",
    "TT":"Trinidad and Tobago"
}

PROVIDER_NAMES={
    "western_union":"Western Union",
    "moneygram":"MoneyGram",
    "remitly":"Remitly",
    "xoom":"Xoom"
}

def now_iso()->str:
    return datetime.now(timezone.utc).isoformat()

def normalize_text(value:Optional[str])->str:
    if value is None:return ""
    return re.sub(r"\s+"," ",str(value).strip().lower())

def load_json(path:Path,default:Any)->Any:
    try:
        if path.exists():
            with path.open("r",encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return default

def load_providers()->Dict[str,Any]:
    data=load_json(PROVIDERS_FILE,{})
    return data if isinstance(data,dict) else {}

def load_brain()->Dict[str,Any]:
    data=load_json(BRAIN_FILE,{})
    return data if isinstance(data,dict) else {}

def provider_registry()->List[Dict[str,Any]]:
    data=load_providers()
    providers=data.get("providers",[])
    if isinstance(providers,dict):
        providers=[
            dict(v,provider_id=k) if isinstance(v,dict) else {"provider_id":k}
            for k,v in providers.items()
        ]
    return providers if isinstance(providers,list) else []

def provider_id(p:Dict[str,Any])->str:
    return str(p.get("id") or p.get("provider_id") or "").strip().lower()

def provider_name(p:Dict[str,Any])->str:
    return str(
        p.get("name") or
        p.get("legal_name") or
        PROVIDER_NAMES.get(provider_id(p),provider_id(p).replace("_"," ").title())
    )

def provider_url(p:Dict[str,Any])->Optional[str]:
    urls=p.get("official_urls")
    if isinstance(urls,dict):
        return urls.get("main") or urls.get("us_send") or next(iter(urls.values()),None)
    return p.get("official_url") or p.get("url")

def normalize_country(value:Optional[str])->Optional[str]:
    if value is None:return None
    v=normalize_text(value)
    if not v:return None
    return COUNTRY_ALIASES.get(v,v.upper() if len(v)==2 else None)

def country_name(value:Optional[str])->str:
    code=normalize_country(value)
    return COUNTRY_NAMES.get(code or "",value or "")

def money_value(value:Any)->Optional[float]:
    try:
        if value is None or value=="":return None
        if isinstance(value,str):
            value=value.replace(",","").replace("$","").strip()
        return float(value)
    except Exception:
        return None

def contains_any(text:str,words:List[str])->bool:
    return any(w in text for w in words)

def enum_value(value:Any)->Optional[str]:
    if value is None:return None
    return str(getattr(value,"value",value))

def safe_status(value:Any)->str:
    v=enum_value(value) or "unverified"
    allowed={enum_value(x) for x in DataStatus}
    return v if v in allowed else "unverified"

def model_dict(value:Any)->Dict[str,Any]:
    if value is None:return {}
    if hasattr(value,"model_dump"):
        try:return value.model_dump()
        except Exception:pass
    if hasattr(value,"dict"):
        try:return value.dict()
        except Exception:pass
    if isinstance(value,dict):return value
    return {}

def detect_amount(text:str)->Optional[float]:
    patterns=[
        r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
        r"\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:dólares|dolares|dollars|usd)\b"
    ]
    for pattern in patterns:
        m=re.search(pattern,text,re.I)
        if m:
            try:return float(m.group(1).replace(",",""))
            except Exception:pass
    return None

def detect_destination(text:str)->Optional[str]:
    for name,code in sorted(COUNTRY_ALIASES.items(),key=lambda x:-len(x[0])):
        if re.search(r"\b"+re.escape(name)+r"\b",text,re.I):
            return code
    return None

def detect_urgency(text:str)->Optional[Urgency]:
    t=normalize_text(text)
    if contains_any(t,["hoy","ahora","lo antes posible","urgent","urgente","today","right now"]):
        return Urgency.today
    if contains_any(t,["mañana","manana","pronto","soon","esta semana","this week"]):
        return Urgency.soon
    if contains_any(t,["normal","no importa cuando","sin prisa","not urgent"]):
        return Urgency.normal
    return None

def detect_priority(text:str)->Optional[Priority]:
    t=normalize_text(text)
    if contains_any(t,["reciba más","reciba mas","que le llegue más","que le llegue mas","más dinero","mas dinero","recipient gets more"]):
        return Priority.recipient_gets_more
    if contains_any(t,["lo más rápido","lo mas rapido","más rápido","mas rapido","fastest","rápido","rapido","speed"]):
        return Priority.fastest
    if contains_any(t,["ahorrar","barato","menos costo","menor costo","save money","cheapest","fee"]):
        return Priority.save
    if contains_any(t,["urgente","hoy","ahora","urgent","today"]):
        try:return Priority.urgent
        except Exception:return Priority.fastest
    if contains_any(t,["comparar","compare","no sé","no se","what is best for me"]):
        return Priority.compare_all
    return None

def detect_delivery(text:str)->Optional[DeliveryMethod]:
    t=normalize_text(text)
    if contains_any(t,["efectivo","cash pickup","recoger dinero","retiro en efectivo","agente","cash"]):
        return DeliveryMethod.cash_pickup
    if contains_any(t,["cuenta bancaria","cuenta de banco","bank account","banco"]):
        return DeliveryMethod.bank_account
    if contains_any(t,["wallet","billetera","monedero","mobile wallet"]):
        return DeliveryMethod.mobile_wallet
    if contains_any(t,["tarjeta de débito","tarjeta de debito","debit card"]):
        return DeliveryMethod.debit_card
    if contains_any(t,["entrega a domicilio","home delivery","domicilio"]):
        return DeliveryMethod.home_delivery
    return None

def detect_payment(text:str)->Optional[PaymentMethod]:
    t=normalize_text(text)
    if contains_any(t,["tarjeta de crédito","tarjeta de credito","credit card"]):
        return PaymentMethod.credit_card
    if contains_any(t,["tarjeta de débito","tarjeta de debito","debit card"]):
        return PaymentMethod.debit_card
    if contains_any(t,["cuenta bancaria","bank account","transferencia bancaria"]):
        return PaymentMethod.bank_account
    if contains_any(t,["efectivo","cash"]):
        return PaymentMethod.cash
    if contains_any(t,["wallet","billetera","digital wallet"]):
        return PaymentMethod.digital_wallet
    return None

def detect_bool(text:str,positive:List[str],negative:List[str])->Optional[bool]:
    t=normalize_text(text)
    if contains_any(t,negative):return False
    if contains_any(t,positive):return True
    return None

def detect_special_need(text:str)->Optional[str]:
    t=normalize_text(text)
    if contains_any(t,["mi mamá","mi mama","mi madre","my mom","my mother"]):
        return "family_recipient"
    if contains_any(t,["mi hijo","mi hija","my son","my daughter","niño","niña"]):
        return "child_recipient"
    if contains_any(t,["mensual","cada mes","monthly","every month"]):
        return "recurring"
    if contains_any(t,["primera vez","first time","nunca he enviado","never sent"]):
        return "first_transfer"
    if contains_any(t,["sin cuenta","no tiene cuenta","doesn't have a bank account","does not have a bank account"]):
        return "no_recipient_bank_account"
    return None

def build_context(
    amount=None,destination=None,priority=None,urgency=None,
    delivery_method=None,payment_method=None,
    recipient_has_bank_account=None,recipient_has_mobile_wallet=None,
    first_transfer=None,recurring_transfer=None,special_need=None
)->DetectedContext:
    ctx=DetectedContext(
        amount=amount,
        destination=normalize_country(destination),
        priority=priority,
        urgency=urgency,
        delivery_method=delivery_method,
        payment_method=payment_method,
        recipient_has_bank_account=recipient_has_bank_account,
        recipient_has_mobile_wallet=recipient_has_mobile_wallet,
        first_transfer=first_transfer,
        recurring_transfer=recurring_transfer,
        special_need=special_need
    )
    ctx.recipient_amount_is_priority=priority==Priority.recipient_gets_more
    ctx.speed_is_priority=priority in (Priority.fastest,Priority.urgent) or urgency==Urgency.today
    ctx.cost_is_priority=priority==Priority.save
    ctx.cash_pickup_needed=delivery_method==DeliveryMethod.cash_pickup or recipient_has_bank_account is False
    ctx.bank_account_needed=delivery_method==DeliveryMethod.bank_account
    ctx.wallet_needed=delivery_method==DeliveryMethod.mobile_wallet
    return ctx

def parse_need_text(text:str,language:Language=Language.es)->ParsedNeed:
    raw=str(text or "").strip()
    amount=detect_amount(raw)
    destination=detect_destination(raw)
    priority=detect_priority(raw)
    urgency=detect_urgency(raw)
    delivery=detect_delivery(raw)
    payment=detect_payment(raw)
    bank=detect_bool(
        raw,
        ["tiene cuenta bancaria","tiene cuenta de banco","has a bank account","bank account"],
        ["no tiene cuenta","sin cuenta bancaria","no bank account","doesn't have a bank account","does not have a bank account"]
    )
    wallet=detect_bool(
        raw,
        ["tiene wallet","tiene billetera","has a wallet","mobile wallet"],
        ["no tiene wallet","sin wallet","no wallet"]
    )
    first=detect_bool(
        raw,
        ["primera vez","primer envío","primer envio","first transfer","first time"],
        ["ya he enviado","ya envié","ya envie","already sent"]
    )
    recurring=detect_bool(
        raw,
        ["cada mes","mensual","monthly","every month","recurring"],
        ["una sola vez","one time","single transfer"]
    )
    special=detect_special_need(raw)
    ctx=build_context(
        amount,destination,priority,urgency,delivery,payment,
        bank,wallet,first,recurring,special
    )
    missing=[]
    if amount is None:
        missing.append(MissingInformation(
            field="amount",label="Cantidad",question="¿Cuánto quieres enviar?",
            reason="La cantidad puede cambiar costos, límites y opciones.",required=True
        ))
    if destination is None:
        missing.append(MissingInformation(
            field="destination",label="Destino",question="¿A qué país quieres enviar?",
            reason="Las opciones y condiciones dependen del país.",required=True
        ))
    return ParsedNeed(
        language=language,raw_text=raw,amount=amount,destination=destination,
        priority=priority,urgency=urgency,delivery_method=delivery,
        payment_method=payment,recipient_has_bank_account=bank,
        recipient_has_mobile_wallet=wallet,first_transfer=first,
        recurring_transfer=recurring,special_need=special,
        detected_context=ctx,missing_information=missing,
        confidence=round(sum(x is not None for x in [
            amount,destination,priority,urgency,delivery,payment
        ])/6,2)
    )

def analyze_need(
    amount:Optional[float],
    destination:Optional[str],
    priority:Optional[Priority],
    urgency:Optional[Urgency],
    delivery_method:Optional[DeliveryMethod],
    payment_method:Optional[PaymentMethod],
    recipient_has_bank_account:Optional[bool]=None,
    recipient_has_mobile_wallet:Optional[bool]=None,
    first_transfer:Optional[bool]=None,
    recurring_transfer:Optional[bool]=None,
    special_need:Optional[str]=None,
    free_text:Optional[str]=None
)->NeedAnalysis:
    parsed=parse_need_text(free_text,Language.es) if free_text else None
    ctx=build_context(
        amount if amount is not None else getattr(parsed,"amount",None),
        normalize_country(destination) if destination else getattr(parsed,"destination",None),
        priority or getattr(parsed,"priority",None),
        urgency or getattr(parsed,"urgency",None),
        delivery_method or getattr(parsed,"delivery_method",None),
        payment_method or getattr(parsed,"payment_method",None),
        recipient_has_bank_account if recipient_has_bank_account is not None else getattr(parsed,"recipient_has_bank_account",None),
        recipient_has_mobile_wallet if recipient_has_mobile_wallet is not None else getattr(parsed,"recipient_has_mobile_wallet",None),
        first_transfer if first_transfer is not None else getattr(parsed,"first_transfer",None),
        recurring_transfer if recurring_transfer is not None else getattr(parsed,"recurring_transfer",None),
        special_need or getattr(parsed,"special_need",None)
    )

    constraints=[]
    factors=[]
    missing=[]

    if ctx.amount is None:
        missing.append(MissingInformation(
            field="amount",label="Cantidad",question="¿Cuánto quieres enviar?",
            reason="La cantidad puede cambiar costos, límites y opciones.",required=True
        ))
    else:
        constraints.append(Constraint(
            id="amount",label="Cantidad",value=ctx.amount,
            reason="La cantidad forma parte de la cotización.",source="user"
        ))
        factors.append(DecisionFactor(
            id="amount",name="Cantidad",importance="high",
            value=ctx.amount,reason="Puede afectar límites, tarifas y resultado final."
        ))

    if not ctx.destination:
        missing.append(MissingInformation(
            field="destination",label="Destino",question="¿A qué país quieres enviar?",
            reason="Las opciones y condiciones dependen del país.",required=True
        ))
    else:
        constraints.append(Constraint(
            id="destination",label="Destino",value=ctx.destination,
            reason="Las condiciones dependen del corredor.",source="user"
        ))

    if ctx.urgency:
        constraints.append(Constraint(
            id="urgency",label="Urgencia",value=enum_value(ctx.urgency),
            reason="La velocidad de entrega puede cambiar las opciones.",source="user"
        ))
        factors.append(DecisionFactor(
            id="urgency",name="Urgencia",importance="high",
            value=enum_value(ctx.urgency),
            reason="Determina si el tiempo de entrega debe comprobarse primero."
        ))

    if ctx.delivery_method:
        constraints.append(Constraint(
            id="delivery",label="Forma de recepción",
            value=enum_value(ctx.delivery_method),
            reason="No todos los métodos están disponibles en todos los corredores.",
            source="user"
        ))

    if ctx.payment_method:
        constraints.append(Constraint(
            id="payment",label="Método de pago",
            value=enum_value(ctx.payment_method),
            reason="Los métodos de pago disponibles pueden variar por proveedor y corredor.",
            source="user"
        ))

    if ctx.recipient_has_bank_account is False:
        constraints.append(Constraint(
            id="no_bank",label="Sin cuenta bancaria",value=True,
            reason="Hace relevante comprobar recepción en efectivo u otros métodos.",
            source="user"
        ))
        factors.append(DecisionFactor(
            id="delivery",name="Forma de recepción",importance="high",
            value="cash_or_alternative",
            reason="La persona destinataria no tiene cuenta bancaria."
        ))

    if ctx.recipient_has_mobile_wallet is False:
        constraints.append(Constraint(
            id="no_wallet",label="Sin wallet",value=True,
            reason="Evita mostrar métodos que dependan de una wallet.",source="user"
        ))

    if ctx.first_transfer is True:
        factors.append(DecisionFactor(
            id="first_transfer",name="Primer envío",importance="medium",
            value=True,
            reason="Conviene comprobar requisitos de identificación y condiciones iniciales."
        ))

    if ctx.recurring_transfer is True:
        factors.append(DecisionFactor(
            id="recurring",name="Envío recurrente",importance="medium",
            value=True,
            reason="Conviene revisar costos y condiciones repetidas."
        ))

    if ctx.priority:
        factors.append(DecisionFactor(
            id="priority",name="Prioridad",importance="high",
            value=enum_value(ctx.priority),
            reason="Define qué información debe pesar en la explicación."
        ))

    main_need="comparar opciones compatibles"
    if ctx.speed_is_priority:
        main_need="recibir el dinero con la urgencia indicada"
    elif ctx.cash_pickup_needed:
        main_need="recibir el dinero sin depender de una cuenta bancaria"
    elif ctx.recipient_amount_is_priority:
        main_need="maximizar la cantidad que recibe la persona"
    elif ctx.cost_is_priority:
        main_need="controlar el costo total del envío"
    elif ctx.recurring_transfer:
        main_need="encontrar una opción adecuada para envíos recurrentes"

    summary=f"Necesitas enviar {ctx.amount:g} USD" if ctx.amount is not None else "Necesitas preparar un envío"
    if ctx.destination:
        summary+=f" a {country_name(ctx.destination)}"
    if ctx.speed_is_priority:
        summary+=", con prioridad en la rapidez"
    elif ctx.cash_pickup_needed:
        summary+=", considerando recepción sin cuenta bancaria"
    elif ctx.recipient_amount_is_priority:
        summary+=", dando importancia a lo que recibe la persona"
    elif ctx.cost_is_priority:
        summary+=", dando importancia al costo"

    return NeedAnalysis(
        summary=summary,
        main_need=main_need,
        detected_context=ctx,
        constraints=constraints,
        decision_factors=factors,
        missing_information=missing,
        compatible_delivery_methods=[
            enum_value(DeliveryMethod.cash_pickup),
            enum_value(DeliveryMethod.bank_account),
            enum_value(DeliveryMethod.debit_card),
            enum_value(DeliveryMethod.mobile_wallet),
            enum_value(DeliveryMethod.home_delivery)
        ],
        compatible_payment_methods=[
            enum_value(PaymentMethod.bank_account),
            enum_value(PaymentMethod.debit_card),
            enum_value(PaymentMethod.credit_card),
            enum_value(PaymentMethod.cash),
            enum_value(PaymentMethod.digital_wallet)
        ],
        notes=[
            "Solo se muestran costos comerciales cuando están verificados.",
            "Una opción compatible no significa que sea la mejor para todos los casos.",
            "Antes de pagar debes confirmar los datos mostrados con el proveedor."
        ]
    )

def is_verified(data:Any)->bool:
    d=model_dict(data)
    if str(d.get("status","")).lower()!="verified":
        return False
    expires=d.get("expires_at")
    if expires:
        try:
            dt=datetime.fromisoformat(str(expires).replace("Z","+00:00"))
            if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
            if dt<datetime.now(timezone.utc):return False
        except Exception:
            return False
    verified_at=d.get("verified_at")
    if verified_at:
        try:
            dt=datetime.fromisoformat(str(verified_at).replace("Z","+00:00"))
            if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc)-dt>__import__("datetime").timedelta(hours=COMMERCIAL_TTL_HOURS):
                return False
        except Exception:
            return False
    return True

def provider_supports_corridor(p:Dict[str,Any],destination:str)->bool:
    if not destination:return True
    corridors=p.get("corridors")
    if corridors is None:return True
    if isinstance(corridors,dict):
        if destination in corridors:return True
        return destination.upper() in [str(x).upper() for x in corridors.keys()]
    if not isinstance(corridors,list):return True
    return destination.upper() in [str(x).upper() for x in corridors]

def extract_commercial(p:Dict[str,Any],destination:Optional[str]=None)->Dict[str,Any]:
    data=p.get("commercial_data")
    if not isinstance(data,dict):return {}
    if destination and isinstance(data.get(destination),dict):
        return data[destination]
    return data

def build_quote(p:Dict[str,Any],request:UserNeedRequest)->Optional[ProviderQuote]:
    destination=normalize_country(request.destination)
    commercial=extract_commercial(p,destination)
    if not commercial:return None

    status=safe_status(commercial.get("status","unverified"))
    quote_data={
        "provider_id":provider_id(p),
        "provider_name":provider_name(p),
        "origin_country":"US",
        "destination_country":destination,
        "send_amount":money_value(commercial.get("send_amount") or request.amount),
        "send_currency":commercial.get("send_currency","USD"),
        "fee":money_value(commercial.get("fee")),
        "exchange_rate":money_value(commercial.get("exchange_rate")),
        "recipient_amount":money_value(commercial.get("recipient_amount")),
        "recipient_currency":commercial.get("recipient_currency"),
        "total_out_of_pocket":money_value(commercial.get("total_out_of_pocket")),
        "delivery_method":commercial.get("delivery_method"),
        "delivery_time":commercial.get("delivery_time"),
        "payment_method":commercial.get("payment_method"),
        "conditions":commercial.get("conditions",[]) if isinstance(commercial.get("conditions",[]),list) else [],
        "status":status,
        "source":commercial.get("source"),
        "verified_at":commercial.get("verified_at"),
        "expires_at":commercial.get("expires_at")
    }

    try:
        return ProviderQuote(**quote_data)
    except Exception:
        clean=quote_data.copy()
        clean["delivery_method"]=None if clean["delivery_method"] is None else enum_value(clean["delivery_method"])
        clean["payment_method"]=None if clean["payment_method"] is None else enum_value(clean["payment_method"])
        return ProviderQuote(**clean)

def compatibility_for(p:Dict[str,Any],request:UserNeedRequest)->Compatibility:
    pid=provider_id(p)
    if not pid:
        return Compatibility(status="incompatible",reason="Proveedor sin identificador válido.")

    destination=normalize_country(request.destination)
    if not provider_supports_corridor(p,destination or ""):
        return Compatibility(
            status="incompatible",
            reason="El corredor indicado no aparece como compatible en los datos disponibles."
        )

    methods=[enum_value(x) for x in (p.get("delivery_methods",[]) or [])]
    payments=[enum_value(x) for x in (p.get("payment_methods",[]) or [])]
    matched=[]
    unmet=[]
    conditions=[]

    wanted_delivery=enum_value(request.delivery_method)
    wanted_payment=enum_value(request.payment_method)

    if wanted_delivery:
        if wanted_delivery in methods:
            matched.append(f"delivery:{wanted_delivery}")
        else:
            unmet.append(f"delivery:{wanted_delivery}")

    if wanted_payment:
        if wanted_payment in payments:
            matched.append(f"payment:{wanted_payment}")
        else:
            unmet.append(f"payment:{wanted_payment}")

    if request.recipient_has_bank_account is False:
        if enum_value(DeliveryMethod.cash_pickup) in methods:
            matched.append("no_bank:cash_pickup")
        elif not wanted_delivery:
            conditions.append("Confirmar si existe una forma de recepción sin cuenta bancaria.")

    if request.recipient_has_mobile_wallet is False and wanted_delivery==enum_value(DeliveryMethod.mobile_wallet):
        unmet.append("recipient_wallet_unavailable")

    if unmet:
        return Compatibility(
            status="incompatible",
            reason="No cumple una restricción indicada.",
            matched_constraints=matched,
            unmet_constraints=unmet,
            conditions=conditions
        )

    quote=build_quote(p,request)
    if quote and is_verified(quote):
        return Compatibility(
            status="compatible",
            reason="Cumple las restricciones conocidas y tiene datos comerciales verificados.",
            matched_constraints=matched,
            conditions=conditions
        )

    return Compatibility(
        status="conditional",
        reason="Puede encajar, pero faltan datos comerciales verificados para confirmar la opción.",
        matched_constraints=matched,
        conditions=conditions
    )

def provider_option(p:Dict[str,Any],request:UserNeedRequest)->ProviderOption:
    comp=compatibility_for(p,request)
    quote=build_quote(p,request)
    confirmations=[]
    conditions=[]

    if not quote or not is_verified(quote):
        confirmations.extend([
            "Comprobar comisión actual antes de pagar.",
            "Comprobar tipo de cambio actual.",
            "Comprobar cantidad exacta que recibirá la persona.",
            "Comprobar método y tiempo de entrega."
        ])

    if request.first_transfer:
        confirmations.append("Comprobar si existen requisitos o condiciones para el primer envío.")
    if request.recurring_transfer:
        confirmations.append("Comprobar condiciones aplicables a envíos recurrentes.")
    if quote:
        qd=model_dict(quote)
        if isinstance(qd.get("conditions"),list):
            conditions.extend(qd["conditions"])

    why="Aparece porque está registrado para este corredor y puede ser compatible con tus condiciones."
    if comp.status=="conditional":
        why="Aparece porque podría encajar, pero debes verificar las condiciones comerciales antes de pagar."
    elif comp.status=="incompatible":
        why="Se muestra como referencia, pero no cumple una de las restricciones conocidas."

    return ProviderOption(
        provider_id=provider_id(p),
        name=provider_name(p),
        official_url=provider_url(p),
        enabled=p.get("enabled",True) is not False,
        compatibility=comp,
        quote=quote,
        commercial_data={
            "status":safe_status(model_dict(quote).get("status")) if quote else "unverified",
            "source":model_dict(quote).get("source") if quote else None,
            "verified_at":model_dict(quote).get("verified_at") if quote else None,
            "expires_at":model_dict(quote).get("expires_at") if quote else None
        },
        delivery_methods=[enum_value(x) for x in (p.get("delivery_methods",[]) or [])],
        payment_methods=[enum_value(x) for x in (p.get("payment_methods",[]) or [])],
        why_it_appears=why,
        what_to_confirm=confirmations,
        important_conditions=conditions
    )

def build_request_from_session(session:SessionState)->UserNeedRequest:
    return UserNeedRequest(
        language=session.language,
        amount=session.amount or 1,
        destination=session.destination or "MX",
        priority=session.priority or Priority.balanced,
        urgency=session.urgency,
        delivery_method=session.delivery_method,
        payment_method=session.payment_method,
        free_text=session.free_text,
        recipient_has_bank_account=session.recipient_has_bank_account,
        recipient_has_mobile_wallet=session.recipient_has_mobile_wallet,
        first_transfer=session.first_transfer,
        recurring_transfer=session.recurring_transfer,
        special_need=session.special_need
    )

def compare_options(request:UserNeedRequest,session_id:Optional[str]=None)->ComparisonResponse:
    destination=normalize_country(request.destination)
    results=[]

    for p in provider_registry():
        if p.get("enabled",True) is False:
            continue
        if request.destination and not provider_supports_corridor(p,destination or ""):
            continue

        o=provider_option(p,request)
        q=o.quote
        qd=model_dict(q)

        try:
            cost=CostSummary(
                amount_sent=qd.get("send_amount") if q else request.amount,
                send_currency=qd.get("send_currency","USD") if q else "USD",
                fee=qd.get("fee") if q else None,
                total_out_of_pocket=qd.get("total_out_of_pocket") if q else None,
                exchange_rate=qd.get("exchange_rate") if q else None,
                recipient_amount=qd.get("recipient_amount") if q else None,
                recipient_currency=qd.get("recipient_currency") if q else None,
                status=safe_status(qd.get("status")) if q else "unverified"
            )
        except Exception:
            cost=CostSummary(
                amount_sent=qd.get("send_amount") if q else request.amount,
                send_currency=qd.get("send_currency","USD") if q else "USD",
                fee=qd.get("fee") if q else None,
                total_out_of_pocket=qd.get("total_out_of_pocket") if q else None,
                exchange_rate=qd.get("exchange_rate") if q else None,
                recipient_amount=qd.get("recipient_amount") if q else None,
                recipient_currency=qd.get("recipient_currency") if q else None,
                status=DataStatus.unverified
            )

        results.append(ComparisonResult(
            provider_id=o.provider_id,
            provider_name=o.name,
            compatibility=o.compatibility,
            quote=q,
            cost=cost,
            delivery_method=qd.get("delivery_method") if q else None,
            payment_method=qd.get("payment_method") if q else None,
            why_it_appears=o.why_it_appears,
            what_to_confirm=o.what_to_confirm,
            important_conditions=o.important_conditions,
            official_url=o.official_url
        ))

    compatible=sum(enum_value(x.compatibility.status)=="compatible" for x in results)
    conditional=sum(enum_value(x.compatibility.status)=="conditional" for x in results)
    incompatible=sum(enum_value(x.compatibility.status)=="incompatible" for x in results)
    verified=sum(enum_value(x.cost.status)=="verified" for x in results)
    unverified=len(results)-verified

    response=ComparisonResponse(
        session_id=session_id,
        language=request.language,
        summary="Se muestran opciones compatibles o condicionadas; no se presenta un proveedor como universalmente mejor.",
        results=results,
        compatible_count=compatible,
        conditional_count=conditional,
        incompatible_count=incompatible,
        verified_count=verified,
        unverified_count=unverified,
        next_step="Revisa los datos de costo y condiciones. Antes de pagar, realiza la verificación final."
    )

    if session_id and session_id in SESSIONS:
        SESSIONS[session_id].comparison_results=results
        SESSIONS[session_id].updated_at=now_iso()

    return response

def preparation_guide(session:SessionState)->PreparationGuide:
    sender=[
        PreparationItem(
            id="amount",label="Cantidad a enviar",
            description="Ten definida la cantidad exacta.",
            required=True,category="sender"
        ),
        PreparationItem(
            id="identification",label="Identificación",
            description="El proveedor puede solicitar identificación según el método y las condiciones aplicables.",
            required=False,category="sender"
        )
    ]

    recipient=[
        PreparationItem(
            id="name",label="Nombre completo",
            description="Debe coincidir con la información requerida por el proveedor.",
            required=True,category="recipient"
        ),
        PreparationItem(
            id="phone",label="Teléfono",
            description="Tenlo disponible si el método lo solicita.",
            required=False,category="recipient"
        )
    ]

    provider=[
        PreparationItem(
            id="delivery",label="Método de recepción",
            description="Confirma efectivo, banco, wallet u otro método.",
            required=True,category="provider"
        ),
        PreparationItem(
            id="conditions",label="Condiciones",
            description="Revisa límites, requisitos, tiempos y cualquier condición mostrada.",
            required=True,category="provider"
        )
    ]

    before_payment=[
        PreparationItem(
            id="fee",label="Comisión",
            description="Confirma la comisión vigente.",
            required=True,category="verification"
        ),
        PreparationItem(
            id="rate",label="Tipo de cambio",
            description="Confirma el tipo de cambio vigente.",
            required=True,category="verification"
        ),
        PreparationItem(
            id="recipient_amount",label="Cantidad que recibe",
            description="Confirma cuánto recibirá la persona.",
            required=True,category="verification"
        ),
        PreparationItem(
            id="total",label="Costo total",
            description="Confirma cuánto pagarás en total.",
            required=True,category="verification"
        )
    ]

    return PreparationGuide(
        title="PREPARA TU ENVÍO",
        introduction="Antes de abrir el proveedor, reúne la información necesaria y comprueba los datos que cambian el costo o la entrega.",
        sender_items=sender,
        recipient_items=recipient,
        provider_items=provider,
        before_start=["Cantidad","País de destino","Forma de recepción","Método de pago"],
        before_payment=before_payment,
        important_conditions=[
            "No pagues basándote en una cifra no verificada.",
            "Comprueba los datos finales directamente con el proveedor."
        ],
        recipient_information=getattr(session,"recipient",None)
    )

def send_guide(session:SessionState)->SendGuide:
    steps=[
        GuideStep(
            id="prepare",title="Prepara la información",
            description="Ten lista la cantidad y los datos de la persona destinataria.",
            instruction="Revisa los datos antes de comenzar.",order=1
        ),
        GuideStep(
            id="provider",title="Abre el proveedor",
            description="Continúa al sitio oficial del proveedor elegido.",
            instruction="Usa únicamente el enlace oficial mostrado.",order=2
        ),
        GuideStep(
            id="recipient",title="Introduce los datos",
            description="Escribe exactamente la información solicitada.",
            instruction="Revisa nombre, país y método de recepción.",order=3
        ),
        GuideStep(
            id="delivery",title="Selecciona la recepción",
            description="Elige efectivo, banco, wallet u otro método disponible.",
            instruction="Confirma que coincide con la necesidad de la persona.",order=4
        ),
        GuideStep(
            id="review",title="Revisa antes de pagar",
            description="Comprueba comisión, tipo de cambio, total y cantidad recibida.",
            instruction="No confirmes el pago hasta verificar estos datos.",order=5
        ),
        GuideStep(
            id="confirm",title="Confirma el envío",
            description="Finaliza únicamente cuando los datos sean correctos.",
            instruction="Guarda el número de referencia si el proveedor lo proporciona.",order=6
        )
    ]

    return SendGuide(
        title="GUÍA PARA ENVIAR",
        introduction="REMESAS te prepara para el envío; el pago y la transferencia se realizan directamente con el proveedor.",
        steps=steps,
        rules=[
            "No compartas contraseñas ni códigos de seguridad.",
            "Comprueba el nombre y destino antes de pagar.",
            "Confirma el costo total y la cantidad que recibe la persona.",
            "Conserva el comprobante y número de referencia."
        ]
    )

def final_check(
    session:SessionState,
    provider_id_value:Optional[str]=None,
    recipient:Optional[RecipientInformation]=None,
    confirm_provider_data:bool=False
)->FinalCheckResponse:

    pid=provider_id_value or session.selected_provider_id
    provider=getattr(session,"selected_provider",None)

    if pid and not provider:
        for p in provider_registry():
            if provider_id(p)==str(pid).lower():
                provider=provider_option(p,build_request_from_session(session))
                break

    q=getattr(provider,"quote",None) if provider else None
    qd=model_dict(q)

    items=[
        FinalCheckItem(
            id="provider",
            label="Proveedor elegido",
            status="ok" if provider else "missing",
            value=provider.name if provider else None,
            message="Proveedor identificado." if provider else "Selecciona una opción."
        ),
        FinalCheckItem(
            id="country",
            label="País de destino",
            status="ok" if session.destination else "missing",
            value=session.destination
        ),
        FinalCheckItem(
            id="amount",
            label="Cantidad a enviar",
            status="ok" if session.amount else "missing",
            value=session.amount
        ),
        FinalCheckItem(
            id="delivery",
            label="Forma de recepción",
            status="ok" if session.delivery_method else "verify",
            value=enum_value(session.delivery_method)
        ),
        FinalCheckItem(
            id="commercial",
            label="Datos comerciales",
            status="ok" if q and is_verified(q) else "verify",
            value=qd if q else None,
            message="Datos comerciales verificados." if q and is_verified(q) else "Debes confirmar los datos actuales antes de pagar."
        )
    ]

    if recipient:
        session.recipient=recipient
        if getattr(recipient,"full_name",None):
            items.append(FinalCheckItem(
                id="recipient_name",
                label="Nombre de la persona destinataria",
                status="ok",
                value=recipient.full_name
            ))
    else:
        items.append(FinalCheckItem(
            id="recipient_name",
            label="Nombre de la persona destinataria",
            status="verify",
            message="Confirma el nombre solicitado por el proveedor."
        ))

    can_continue=bool(provider and session.amount and session.destination)
    verified=bool(q and is_verified(q))
    ready=bool(can_continue and confirm_provider_data and verified)

    return FinalCheckResponse(
        session_id=session.session_id,
        language=session.language,
        items=items,
        can_continue=can_continue,
        ready=ready,
        message="Todo lo necesario está identificado." if ready else "Revisa los elementos marcados antes de pagar.",
        provider_id=provider.provider_id if provider else pid,
        provider_name=provider.name if provider else None,
        official_url=provider.official_url if provider else None
    )

def create_session(request:UserNeedRequest)->SessionState:
    sid=str(uuid.uuid4())
    timestamp=now_iso()

    analysis=analyze_need(
        amount=request.amount,
        destination=request.destination,
        priority=request.priority,
        urgency=request.urgency,
        delivery_method=request.delivery_method,
        payment_method=request.payment_method,
        recipient_has_bank_account=request.recipient_has_bank_account,
        recipient_has_mobile_wallet=request.recipient_has_mobile_wallet,
        first_transfer=request.first_transfer,
        recurring_transfer=request.recurring_transfer,
        special_need=request.special_need,
        free_text=request.free_text
    )

    session=SessionState(
        session_id=sid,
        language=request.language,
        created_at=timestamp,
        updated_at=timestamp,
        step="analysis",
        amount=request.amount,
        destination=normalize_country(request.destination),
        priority=request.priority,
        urgency=request.urgency,
        delivery_method=request.delivery_method,
        payment_method=request.payment_method,
        free_text=request.free_text,
        recipient_has_bank_account=request.recipient_has_bank_account,
        recipient_has_mobile_wallet=request.recipient_has_mobile_wallet,
        first_transfer=request.first_transfer,
        recurring_transfer=request.recurring_transfer,
        special_need=request.special_need,
        need_analysis=analysis,
        detected_context=analysis.detected_context
    )

    SESSIONS[sid]=session
    return session

def get_session(session_id:str)->SessionState:
    session=SESSIONS.get(session_id)
    if session is None:
        raise KeyError("Session not found")
    return session

def update_session(session:SessionState)->SessionState:
    session.updated_at=now_iso()
    SESSIONS[session.session_id]=session
    return session

def select_provider(session_id:str,pid:str)->ProviderOption:
    session=get_session(session_id)
    request=build_request_from_session(session)

    target=str(pid or "").strip().lower()
    for p in provider_registry():
        if provider_id(p)==target:
            option=provider_option(p,request)
            session.selected_provider_id=option.provider_id
            session.selected_provider=option
            session.step="preparation"
            update_session(session)
            return option

    raise KeyError("Provider not found")

def update_from_parsed(session:SessionState,parsed:ParsedNeed)->SessionState:
    if parsed.amount is not None:
        session.amount=parsed.amount
    if parsed.destination:
        session.destination=normalize_country(parsed.destination)
    if parsed.priority is not None:
        session.priority=parsed.priority
    if parsed.urgency is not None:
        session.urgency=parsed.urgency
    if parsed.delivery_method is not None:
        session.delivery_method=parsed.delivery_method
    if parsed.payment_method is not None:
        session.payment_method=parsed.payment_method
    if parsed.recipient_has_bank_account is not None:
        session.recipient_has_bank_account=parsed.recipient_has_bank_account
    if parsed.recipient_has_mobile_wallet is not None:
        session.recipient_has_mobile_wallet=parsed.recipient_has_mobile_wallet
    if parsed.first_transfer is not None:
        session.first_transfer=parsed.first_transfer
    if parsed.recurring_transfer is not None:
        session.recurring_transfer=parsed.recurring_transfer
    if parsed.special_need:
        session.special_need=parsed.special_need

    session.parsed_need=parsed
    session.detected_context=parsed.detected_context
    session.free_text=parsed.raw_text

    session.need_analysis=analyze_need(
        session.amount,
        session.destination,
        session.priority,
        session.urgency,
        session.delivery_method,
        session.payment_method,
        session.recipient_has_bank_account,
        session.recipient_has_mobile_wallet,
        session.first_transfer,
        session.recurring_transfer,
        session.special_need,
        session.free_text
    )

    session.step="analysis"
    return update_session(session)

def validate_brain()->Dict[str,Any]:
    brain=load_brain()
    required=[
        "app","experience","opening","conversation_logic",
        "data_truth","comparison","validation","security","languages"
    ]
    missing=[x for x in required if x not in brain]
    warnings=[]

    providers=provider_registry()
    expected={"western_union","moneygram","remitly","xoom"}
    actual={provider_id(p) for p in providers}
    missing_providers=sorted(expected-actual)

    if missing_providers:
        warnings.append("Missing providers: "+",".join(missing_providers))

    return {
        "valid":not missing and not missing_providers,
        "version":brain.get("version"),
        "missing_sections":missing,
        "warnings":warnings
    }

def public_config()->Dict[str,Any]:
    brain=load_brain()
    data=load_providers()

    return {
        "app":brain.get("app",{}),
        "experience":brain.get("experience",{}),
        "opening":brain.get("opening",{}),
        "countries":brain.get("countries",{}),
        "delivery_methods":brain.get("delivery_methods",[]),
        "payment_methods":brain.get("payment_methods",[]),
        "languages":brain.get("languages",{"default":"es","supported":["es","en"]}),
        "providers":[
            {
                "id":provider_id(p),
                "name":provider_name(p),
                "official_url":provider_url(p),
                "delivery_methods":[enum_value(x) for x in (p.get("delivery_methods",[]) or [])],
                "payment_methods":[enum_value(x) for x in (p.get("payment_methods",[]) or [])]
            }
            for p in provider_registry()
        ],
        "data_version":data.get("version")
    }

def help_data(language:Language=Language.es)->Dict[str,Any]:
    if language==Language.en:
        return {
            "title":"How REMESAS works",
            "message":"Tell us what you need. REMESAS identifies the important constraints, prepares the information, compares compatible options and asks you to verify the final data before payment.",
            "topics":["Need","Preparation","Comparison","Cost","Verification","Provider"]
        }

    return {
        "title":"Cómo funciona REMESAS",
        "message":"Dinos qué necesitas. REMESAS identifica las condiciones importantes, prepara la información, compara opciones compatibles y te pide verificar los datos finales antes de pagar.",
        "topics":["Necesidad","Preparación","Comparación","Costo","Verificación","Proveedor"]
    }
