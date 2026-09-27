import json,re
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional
from schemas import (
    ComparisonRequest,ComparisonResponse,ComparisonResult,Compatibility,CostSummary,
    DetectedContext,FinalCheckRequest,FinalCheckResponse,FinalCheckItem,HelpResponse,
    MissingInformation,NeedAnalysis,ParsedNeed,PreparationGuide,PreparationItem,
    ProviderOption,ProviderQuote,SendGuide,GuideStep,SessionState,UserNeedRequest,
    Verification
)

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_FILE=DATA_DIR/"app_brain.json"
PROVIDERS_FILE=DATA_DIR/"providers.json"

class RemittanceEngine:
    def __init__(self):
        self.brain={}
        self.providers_data={}
        self.sessions={}
        self.load_brain()

    def _now(self):
        return datetime.now(timezone.utc).isoformat()

    def _read_json(self,path):
        try:
            with open(path,"r",encoding="utf-8") as f:return json.load(f)
        except Exception:return {}

    def load_brain(self):
        self.brain=self._read_json(BRAIN_FILE)
        self.providers_data=self._read_json(PROVIDERS_FILE)
        return self.brain

    def validate_brain(self):
        required=["app","experience","opening","conversation_logic","kernel","providers","countries","comparison","validation","security","languages"]
        missing=[x for x in required if x not in self.brain]
        return {"valid":not missing,"version":str(self.brain.get("app",{}).get("version","unknown")),"missing_sections":missing,"errors":[]}

    def _country_codes(self):
        countries=self.brain.get("countries",{})
        if isinstance(countries,dict):
            items=countries.get("initial_supported",countries.get("supported",[]))
            if isinstance(items,list):
                out=[]
                for x in items:
                    if isinstance(x,str):out.append(x.upper())
                    elif isinstance(x,dict) and x.get("code"):out.append(str(x["code"]).upper())
                return out
        return []

    def _country_aliases(self):
        return {
            "mexico":"MX","méxico":"MX","mex":"MX","mx":"MX",
            "guatemala":"GT","gt":"GT",
            "el salvador":"SV","salvador":"SV","sv":"SV",
            "honduras":"HN","hn":"HN",
            "nicaragua":"NI","ni":"NI",
            "costa rica":"CR","cr":"CR",
            "panama":"PA","panamá":"PA","pa":"PA",
            "dominican republic":"DO","república dominicana":"DO","republica dominicana":"DO","rd":"DO","do":"DO",
            "colombia":"CO","co":"CO",
            "venezuela":"VE","ve":"VE",
            "ecuador":"EC","ec":"EC",
            "peru":"PE","perú":"PE","pe":"PE",
            "bolivia":"BO","bo":"BO",
            "paraguay":"PY","py":"PY",
            "brazil":"BR","brasil":"BR","br":"BR",
            "chile":"CL","cl":"CL",
            "argentina":"AR","ar":"AR",
            "uruguay":"UY","uy":"UY",
            "cuba":"CU","cu":"CU",
            "haiti":"HT","haití":"HT","ht":"HT",
            "belize":"BZ","bz":"BZ",
            "guyana":"GY","gy":"GY",
            "suriname":"SR","sr":"SR",
            "jamaica":"JM","jm":"JM",
            "trinidad":"TT","trinidad and tobago":"TT","trinidad y tobago":"TT","tt":"TT"
        }

    def _country_from_text(self,text):
        t=(text or "").lower()
        aliases=self._country_aliases()
        for name,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"(?<!\w)"+re.escape(name)+r"(?!\w)",t):return code
        return None

    def _amount_from_text(self,text):
        if not text:return None
        m=re.search(r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",text.lower())
        if not m:m=re.search(r"(?<!\w)([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:usd|dólares|dolares|dollars)?",text.lower())
        if not m:return None
        try:
            v=float(m.group(1).replace(",",""))
            return v if v>0 else None
        except Exception:return None

    def _priority_from_text(self,text):
        t=(text or "").lower()
        if any(x in t for x in ["que reciba más","reciba mas","recibir más","recibir mas","más dinero","mas dinero","mejor tasa","mayor cantidad"]):return "recipient_gets_more"
        if any(x in t for x in ["lo más rápido","lo mas rapido","más rápido","mas rapido","rápido","rapido","en minutos","instantáneo","instantaneo"]):return "fastest"
        if any(x in t for x in ["hoy","ahora","urgente","urgencia","necesito ya"]):return "urgent"
        if any(x in t for x in ["ahorrar","barato","menos comisión","menos comision","pagar menos","economizar"]):return "save"
        if any(x in t for x in ["comparar","compare","todas las opciones","no sé cuál","no se cual"]):return "compare_all"
        return "balanced"

    def _urgency_from_text(self,text):
        t=(text or "").lower()
        if any(x in t for x in ["ahora","ya mismo","inmediatamente"]):return "now"
        if any(x in t for x in ["hoy","today"]):return "today"
        if any(x in t for x in ["mañana","manana","tomorrow","pronto"]):return "soon"
        if any(x in t for x in ["cuando pueda","sin prisa","no importa cuándo","no importa cuando"]):return "flexible"
        if any(x in t for x in ["normal"]):return "normal"
        return "unknown"

    def _delivery_from_text(self,text):
        t=(text or "").lower()
        if any(x in t for x in ["efectivo","cash","recoger","retirar","agente","sucursal"]):return "cash_pickup"
        if any(x in t for x in ["cuenta bancaria","cuenta de banco","banco","bank account","depósito bancario","deposito bancario"]):return "bank_account"
        if any(x in t for x in ["tarjeta","debit card","débito","debito"]):return "debit_card"
        if any(x in t for x in ["wallet","billetera","monedero móvil","monedero movil"]):return "mobile_wallet"
        if any(x in t for x in ["entrega a domicilio","domicilio","home delivery","casa"]):return "home_delivery"
        return None

    def _payment_from_text(self,text):
        t=(text or "").lower()
        if any(x in t for x in ["efectivo","cash"]):return "cash"
        if any(x in t for x in ["tarjeta de débito","tarjeta de debito","debit card"]):return "debit_card"
        if any(x in t for x in ["tarjeta de crédito","tarjeta de credito","credit card"]):return "credit_card"
        if any(x in t for x in ["cuenta bancaria","desde mi banco","bank account"]):return "bank_account"
        if any(x in t for x in ["paypal","apple pay","google pay","wallet"]):return "digital_wallet"
        return None

    def _bool_from_text(self,text,positive,negative):
        t=(text or "").lower()
        if any(x in t for x in positive):return True
        if any(x in t for x in negative):return False
        return None

    def _recipient_bank_from_text(self,text):
        return self._bool_from_text(text,
            ["tiene cuenta bancaria","sí tiene banco","si tiene banco","tiene banco","cuenta bancaria"],
            ["no tiene cuenta bancaria","no tiene banco","sin cuenta bancaria","no usa banco"])

    def _recipient_wallet_from_text(self,text):
        return self._bool_from_text(text,
            ["tiene wallet","tiene billetera","usa wallet","usa billetera"],
            ["no tiene wallet","no tiene billetera","sin wallet"])

    def _first_transfer_from_text(self,text):
        return self._bool_from_text(text,
            ["es mi primer envío","es mi primer envio","primera vez","first transfer","nunca he enviado"],
            ["ya he enviado","ya lo he usado","envío recurrente","envio recurrente"])

    def _recurring_from_text(self,text):
        return self._bool_from_text(text,
            ["cada mes","mensual","todos los meses","recurrente","regularmente","every month"],
            ["una sola vez","solo esta vez","por única vez","por unica vez"])

    def _missing(self,parsed):
        out=[]
        if not parsed.amount:out.append(MissingInformation(field="amount",label="Cantidad a enviar",reason="Cambia la cotización y las condiciones comerciales.",question_type="required",affects_options=True))
        if not parsed.destination_country:out.append(MissingInformation(field="destination_country",label="País de destino",reason="Determina qué proveedores y métodos están disponibles.",question_type="required",affects_options=True))
        if not parsed.delivery_method and parsed.recipient_has_bank_account is None and parsed.recipient_has_mobile_wallet is None:
            out.append(MissingInformation(field="delivery_method",label="Cómo recibirá el dinero",reason="Efectivo, banco y wallet pueden cambiar las opciones disponibles.",question_type="useful",affects_options=True))
        return out

    def parse_need(self,text,current_amount=None,current_destination=None,language="es"):
        amount=current_amount or self._amount_from_text(text)
        destination=current_destination or self._country_from_text(text)
        delivery=self._delivery_from_text(text)
        payment=self._payment_from_text(text)
        bank=self._recipient_bank_from_text(text)
        wallet=self._recipient_wallet_from_text(text)
        first=self._first_transfer_from_text(text)
        recurring=self._recurring_from_text(text)
        priority=self._priority_from_text(text)
        urgency=self._urgency_from_text(text)
        special=None
        t=(text or "").strip()
        if any(x in t.lower() for x in ["mi mamá","mi mama","mi madre","mi papá","mi papa","mi padre","mi hijo","mi hija"]):special=t
        if delivery=="cash_pickup" and bank is None:bank=False
        if delivery=="mobile_wallet" and wallet is None:wallet=True
        context=DetectedContext(amount=amount,currency="USD",destination_country=destination,priority=priority,urgency=urgency,delivery_method=delivery,payment_method=payment,recipient_has_bank_account=bank,recipient_has_mobile_wallet=wallet,first_transfer=first,recurring_transfer=recurring,special_need=special)
        missing=self._missing(ParsedNeed(amount=amount,currency="USD",destination_country=destination,priority=priority,urgency=urgency,delivery_method=delivery,payment_method=payment,special_need=special,recipient_has_bank_account=bank,recipient_has_mobile_wallet=wallet,first_transfer=first,recurring_transfer=recurring))
        detected=sum(x is not None for x in [amount,destination,delivery,payment,bank,wallet,first,recurring])
        confidence=min(1.0,0.25+detected*.09+(0.2 if amount else 0)+(0.2 if destination else 0))
        return ParsedNeed(amount=amount,currency="USD",destination_country=destination,priority=priority,urgency=urgency,delivery_method=delivery,payment_method=payment,special_need=special,recipient_has_bank_account=bank,recipient_has_mobile_wallet=wallet,first_transfer=first,recurring_transfer=recurring,original_text=text,detected_context=context,missing_information=missing,confidence=confidence)

    def apply_need(self,session,need):
        if isinstance(need,ParsedNeed):
            p=need
        elif isinstance(need,dict):
            p=ParsedNeed(**need)
        else:p=ParsedNeed()
        session.amount=p.amount
        session.send_currency=p.currency
        session.destination=p.destination_country
        session.priority=p.priority
        session.urgency=p.urgency
        session.delivery_method=p.delivery_method
        session.payment_method=p.payment_method
        session.special_need=p.special_need
        session.recipient_has_bank_account=p.recipient_has_bank_account
        session.recipient_has_mobile_wallet=p.recipient_has_mobile_wallet
        session.first_transfer=p.first_transfer
        session.recurring_transfer=p.recurring_transfer
        session.parsed_user_need=p
        session.detected_context=p.detected_context
        session.current_step="analysis"
        return session

    def _provider_registry(self):
        p=self.providers_data.get("providers",[])
        if isinstance(p,dict):return list(p.values())
        return p if isinstance(p,list) else []

    def _provider_by_id(self,pid):
        for p in self._provider_registry():
            if str(p.get("id",p.get("provider_id",""))).lower()==str(pid).lower():return p
        return None

    def _corridor(self,destination):
        corridors=self.providers_data.get("corridors",{})
        if isinstance(corridors,dict):
            c=corridors.get(destination)
            if isinstance(c,dict):return c
        if isinstance(corridors,list):
            for c in corridors:
                if isinstance(c,dict) and str(c.get("destination_country",c.get("country",""))).upper()==destination:return c
        return None

    def _provider_ids_for_corridor(self,destination):
        c=self._corridor(destination)
        if not c:return [str(p.get("id",p.get("provider_id",""))) for p in self._provider_registry() if p.get("enabled",True)]
        ids=c.get("providers",[])
        result=[]
        for x in ids:
            if isinstance(x,str):result.append(x)
            elif isinstance(x,dict):
                pid=x.get("provider_id",x.get("id"))
                if pid:result.append(pid)
        return result

    def get_verified_provider_data(self,provider_id,destination=None):
        p=self._provider_by_id(provider_id)
        if not p:return None
        cd=p.get("commercial_data",{})
        if str(cd.get("status","")).lower()!="verified":return None
        if not cd.get("source") or not cd.get("verified_at"):return None
        if destination and cd.get("destination_country") and str(cd.get("destination_country")).upper()!=str(destination).upper():return None
        return cd

    def _delivery_list(self,p):
        vals=p.get("delivery_methods",p.get("delivery",[]))
        return [str(x) for x in vals] if isinstance(vals,list) else []

    def _payment_list(self,p):
        vals=p.get("payment_methods",p.get("payment",[]))
        return [str(x) for x in vals] if isinstance(vals,list) else []

    def _compatibility(self,p,req):
        pid=str(p.get("id",p.get("provider_id","")))
        reasons=[]
        conditions=[]
        delivery=req.delivery_method
        payment=req.payment_method
        deliveries=self._delivery_list(p)
        payments=self._payment_list(p)
        if delivery and delivery not in deliveries:
            return Compatibility(status="not_compatible",reasons=[f"El proveedor no declara el método de entrega solicitado: {delivery}."],conditions_to_confirm=[])
        if payment and payment not in payments:
            return Compatibility(status="not_compatible",reasons=[f"El proveedor no declara el método de pago solicitado: {payment}."],conditions_to_confirm=[])
        if req.recipient_has_bank_account is False and delivery=="bank_account":
            return Compatibility(status="not_compatible",reasons=["El receptor indicó que no tiene cuenta bancaria."],conditions_to_confirm=[])
        if req.recipient_has_mobile_wallet is False and delivery=="mobile_wallet":
            return Compatibility(status="not_compatible",reasons=["El receptor indicó que no tiene wallet móvil."],conditions_to_confirm=[])
        if req.urgency in ("now","today") and delivery=="cash_pickup":conditions.append("Confirma que el punto de retiro esté disponible y que el tiempo indicado corresponda a tu corredor.")
        if req.amount>=5000:conditions.append("Confirma límites, identificación y requisitos aplicables a este importe antes de pagar.")
        if req.first_transfer is True:conditions.append("Como primer envío, confirma los requisitos de registro e identificación del proveedor.")
        if req.recurring_transfer is True:conditions.append("Si será recurrente, comprueba tarifas, promociones y condiciones para envíos posteriores.")
        if req.destination_country=="CU":conditions.append("Para Cuba, confirma específicamente disponibilidad, método, moneda, tarifa y requisitos del corredor.")
        if not deliveries:conditions.append("Confirma el método de entrega directamente con el proveedor.")
        if not payments:conditions.append("Confirma el método de pago directamente con el proveedor.")
        reasons.append("El proveedor aparece en el corredor solicitado.")
        if conditions:return Compatibility(status="conditional",reasons=reasons,conditions_to_confirm=conditions)
        return Compatibility(status="compatible",reasons=reasons,conditions_to_confirm=[])

    def provider_public_option(self,p):
        pid=str(p.get("id",p.get("provider_id","")))
        return ProviderOption(
            provider_id=pid,
            provider_name=p.get("name",p.get("provider_name",pid)),
            enabled=p.get("enabled",p.get("status","verified")!="disabled"),
            available=True,
            official_url=p.get("official_url") or p.get("urls",{}).get("main") if isinstance(p.get("urls",{}),dict) else p.get("official_url"),
            delivery_methods=self._delivery_list(p),
            payment_methods=self._payment_list(p),
            commercial_data_status="unavailable"
        )

    def _quote(self,p,req):
        cd=self.get_verified_provider_data(str(p.get("id",p.get("provider_id",""))),req.destination_country)
        if not cd:return None
        fee=cd.get("fee")
        rate=cd.get("exchange_rate")
        recipient=cd.get("recipient_amount")
        total=req.amount+fee if isinstance(fee,(int,float)) else None
        status="verified"
        verification=Verification(status=status,source=cd.get("source"),verified_at=cd.get("verified_at"),expires_at=cd.get("expires_at"))
        return ProviderQuote(
            provider_id=str(p.get("id",p.get("provider_id",""))),
            provider_name=p.get("name",p.get("provider_name","")),
            origin_country="US",
            destination_country=req.destination_country,
            send_amount=req.amount,
            send_currency=req.currency,
            recipient_currency=cd.get("recipient_currency"),
            fee=fee,
            exchange_rate=rate,
            recipient_amount=recipient,
            delivery_method=cd.get("delivery_method"),
            delivery_time=cd.get("delivery_time"),
            payment_method=cd.get("payment_method"),
            verification=verification,
            important_conditions=cd.get("important_conditions",[]) if isinstance(cd.get("important_conditions",[]),list) else [],
            official_url=p.get("official_url")
        )

    def analyze_need(self,req):
        constraints=[]
        factors=[]
        if req.amount:
            factors.append({"factor":"amount","value":str(req.amount),"importance":"high","explanation":"El importe puede cambiar tarifas, límites y condiciones."})
        if req.destination_country:
            factors.append({"factor":"destination","value":req.destination_country,"importance":"high","explanation":"El corredor determina las opciones disponibles."})
        if req.urgency in ("now","today","soon"):
            constraints.append(Constraint(type="urgency",value=req.urgency,description="Necesidad de recibir el dinero con rapidez.",effect="La velocidad y disponibilidad pasan a ser factores importantes.",verified=False))
            factors.append({"factor":"delivery_speed","value":req.urgency,"importance":"high","explanation":"Una entrega rápida puede limitar métodos u opciones."})
        if req.delivery_method:
            constraints.append(Constraint(type="delivery_method",value=req.delivery_method,description="Método de recepción solicitado.",effect="Solo deben considerarse opciones compatibles o claramente condicionadas.",verified=True))
        if req.recipient_has_bank_account is False:
            constraints.append(Constraint(type="recipient_bank",value="false",description="El receptor no tiene cuenta bancaria.",effect="Las opciones que requieren depósito bancario dejan de ser adecuadas.",verified=True))
        if req.recipient_has_mobile_wallet is False:
            constraints.append(Constraint(type="recipient_wallet",value="false",description="El receptor no tiene wallet móvil.",effect="Las opciones que requieren wallet dejan de ser adecuadas.",verified=True))
        if req.priority=="recipient_gets_more":
            factors.append({"factor":"recipient_amount","value":"priority","importance":"high","explanation":"La cantidad que recibe el destinatario es un factor principal."})
        elif req.priority=="save":
            factors.append({"factor":"total_cost","value":"priority","importance":"high","explanation":"El costo total es un factor principal."})
        elif req.priority in ("fastest","urgent"):
            factors.append({"factor":"delivery_speed","value":"priority","importance":"high","explanation":"La rapidez es un factor principal."})
        else:factors.append({"factor":"balanced","value":"priority","importance":"medium","explanation":"Se deben revisar conjuntamente costo, cantidad recibida, velocidad y método."})
        compatible_delivery=[]
        for x in ["bank_account","cash_pickup","debit_card","mobile_wallet","home_delivery"]:
            if req.recipient_has_bank_account is False and x=="bank_account":continue
            if req.recipient_has_mobile_wallet is False and x=="mobile_wallet":continue
            compatible_delivery.append(x)
        notes=[]
        if req.amount and req.destination_country:notes.append("El análisis usa el importe y corredor proporcionados.")
        notes.append("Los valores comerciales actuales solo se muestran cuando cuentan con verificación válida.")
        return NeedAnalysis(
            principal_need=self._principal_need(req),
            context_summary=self._context_summary(req),
            constraints=constraints,
            decision_factors=[DecisionFactor(**x) for x in factors],
            missing_information=self._missing(ParsedNeed(amount=req.amount,currency=req.currency,destination_country=req.destination_country,priority=req.priority,urgency=req.urgency,delivery_method=req.delivery_method,payment_method=req.payment_method,recipient_has_bank_account=req.recipient_has_bank_account,recipient_has_mobile_wallet=req.recipient_has_mobile_wallet,first_transfer=req.first_transfer,recurring_transfer=req.recurring_transfer)),
            compatible_delivery_methods=compatible_delivery,
            compatible_payment_methods=["bank_account","debit_card","credit_card","cash","digital_wallet"],
            analysis_notes=notes
        )

    def _principal_need(self,req):
        if req.urgency in ("now","today") or req.priority in ("urgent","fastest"):return "Recibir el dinero con rapidez"
        if req.priority=="recipient_gets_more":return "Maximizar la cantidad que recibe el destinatario"
        if req.priority=="save":return "Controlar el costo total del envío"
        if req.delivery_method=="cash_pickup":return "Permitir que el destinatario retire el dinero en efectivo"
        if req.delivery_method=="bank_account":return "Depositar el dinero en una cuenta bancaria"
        return "Encontrar una opción compatible con la situación indicada"

    def _context_summary(self,req):
        parts=[]
        if req.amount:parts.append(f"{req.amount:g} {req.currency}")
        if req.destination_country:parts.append(f"hacia {req.destination_country}")
        if req.urgency!="unknown":parts.append(f"urgencia {req.urgency}")
        if req.delivery_method:parts.append(f"recepción {req.delivery_method}")
        if req.recipient_has_bank_account is False:parts.append("receptor sin cuenta bancaria")
        return ", ".join(parts) if parts else "Información inicial incompleta"

    def compare(self,req):
        if isinstance(req,dict):req=ComparisonRequest(**req)
        analysis=self.analyze_need(req)
        ids=req.provider_ids or self._provider_ids_for_corridor(req.destination_country)
        results=[]
        available=[]
        verified=[]
        for pid in ids:
            p=self._provider_by_id(pid)
            if not p:continue
            comp=self._compatibility(p,req)
            option=self.provider_public_option(p)
            option.compatibility=comp.status
            option.compatibility_reasons=comp.reasons
            option.important_conditions=comp.conditions_to_confirm
            available.append(option)
            quote=self._quote(p,req)
            if quote:
                cost=CostSummary(amount_sent=req.amount,send_currency=req.currency,fee=quote.fee,total_out_of_pocket=req.amount+quote.fee if quote.fee is not None else None,exchange_rate=quote.exchange_rate,recipient_amount=quote.recipient_amount,recipient_currency=quote.recipient_currency,status="verified",explanation="Valores comerciales tomados de datos verificados del proveedor.")
                verification=quote.verification
                result=ComparisonResult(
                    provider_id=option.provider_id,provider_name=option.provider_name,
                    compatibility=comp,cost=cost,delivery_method=quote.delivery_method,estimated_delivery=quote.delivery_time,
                    payment_method=quote.payment_method,important_conditions=list(dict.fromkeys(quote.important_conditions+comp.conditions_to_confirm)),
                    verification=verification,official_url=option.official_url,
                    why_it_appears=comp.reasons,what_to_confirm=comp.conditions_to_confirm
                )
                results.append(result)
                if comp.status!="not_compatible":verified.append(result)
            else:
                verification=Verification(status="unavailable",source=None,verified_at=None,note="No existe una cotización comercial verificada actual para este corredor e importe.")
                cost=CostSummary(amount_sent=req.amount,send_currency=req.currency,status="unavailable",explanation="Tarifa, tasa y cantidad recibida no están verificadas actualmente.")
                results.append(ComparisonResult(
                    provider_id=option.provider_id,provider_name=option.provider_name,compatibility=comp,cost=cost,
                    delivery_method=req.delivery_method,estimated_delivery=None,payment_method=req.payment_method,
                    important_conditions=list(dict.fromkeys(comp.conditions_to_confirm+["Confirma tarifa, tasa, cantidad recibida y tiempo directamente con el proveedor antes de pagar."])),
                    verification=verification,official_url=option.official_url,why_it_appears=comp.reasons,
                    what_to_confirm=list(dict.fromkeys(comp.conditions_to_confirm+["Cotización actual del proveedor."]))
                ))
        explanation=[
            "Las opciones se muestran según el corredor y las condiciones conocidas.",
            "Una opción compatible no significa que sus valores comerciales estén actualmente verificados.",
            "No se rellenan tarifas, tasas, cantidades recibidas ni tiempos que no estén verificados."
        ]
        unavailable=[f"{r.provider_name}: datos comerciales actuales no verificados." for r in results if r.cost.status!="verified"]
        return ComparisonResponse(language="es",analysis=analysis,results=results,available_providers=available,verified_results=verified,unavailable_information=unavailable,explanation=explanation,next_step="preparation")

    def compare_session(self,session):
        req=ComparisonRequest(
            amount=session.amount or 0,currency=session.send_currency,destination_country=session.destination or "",
            priority=session.priority,urgency=session.urgency,delivery_method=session.delivery_method,payment_method=session.payment_method,
            special_need=session.special_need,recipient_has_bank_account=session.recipient_has_bank_account,
            recipient_has_mobile_wallet=session.recipient_has_mobile_wallet,first_transfer=session.first_transfer,recurring_transfer=session.recurring_transfer
        )
        result=self.compare(req)
        session.need_analysis=result.analysis
        session.available_providers=result.available_providers
        session.candidate_providers=result.available_providers
        session.comparison_results=result.results
        session.verified_results=result.verified_results
        session.current_step="comparison"
        session.preparation=self.build_preparation(session)
        session.send_guide=self.build_send_guide(session)
        return result

    def select_provider(self,session,provider_id):
        p=self._provider_by_id(provider_id)
        if not p:raise ValueError("Proveedor no encontrado")
        option=self.provider_public_option(p)
        for x in session.available_providers:
            if x.provider_id==provider_id:option=x;break
        session.selected_option=option
        session.current_step="preparation"
        session.preparation=self.build_preparation(session)
        session.send_guide=self.build_send_guide(session)
        return option

    def build_preparation(self,session):
        lang=session.language
        sender=[
            PreparationItem("amount","Cantidad a enviar","Ten clara la cantidad que quieres enviar y la moneda.",True),
            PreparationItem("payment","Método de pago","Comprueba qué método usarás para pagar el envío.",True),
            PreparationItem("identity","Identificación","El proveedor puede solicitar identificación o información adicional según el envío.",True)
        ]
        recipient=[
            PreparationItem("name","Nombre del receptor","Ten el nombre exactamente como pueda requerirlo el proveedor.",True),
            PreparationItem("phone","Teléfono","Ten disponible el número del receptor si el proveedor lo solicita.",False),
            PreparationItem("location","Ubicación","Para retiro en efectivo, confirma ciudad o ubicación necesaria para seleccionar el punto adecuado.",False)
        ]
        if session.delivery_method=="bank_account":
            recipient.extend([
                PreparationItem("bank","Datos bancarios","Ten los datos bancarios requeridos por el proveedor y el banco receptor.",True)
            ])
        if session.delivery_method=="mobile_wallet":
            recipient.extend([
                PreparationItem("wallet","Wallet","Ten el número o identificador requerido por la wallet.",True)
            ])
        provider=[PreparationItem("requirements","Requisitos del proveedor","Comprueba los requisitos específicos antes de confirmar y pagar.",True)]
        before_start=["Usa datos reales y revisa cuidadosamente el nombre y los datos del receptor.","No compartas contraseñas, códigos de seguridad ni credenciales con esta aplicación."]
        before_payment=["Comprueba país, cantidad, método de recepción y método de pago.","Comprueba la tarifa y el tipo de cambio que muestra el proveedor en ese momento.","Comprueba cuánto pagarás en total y cuánto recibirá el destinatario.","Si algún dato no aparece verificado aquí, confírmalo directamente con el proveedor."]
        conditions=[]
        if session.amount and session.amount>=5000:conditions.append("Para importes altos pueden existir límites o requisitos adicionales.")
        if session.first_transfer:conditions.append("En un primer envío pueden solicitarse pasos adicionales de registro o verificación.")
        if session.recurring_transfer:conditions.append("Para envíos recurrentes, las condiciones de futuras operaciones pueden cambiar.")
        if session.destination=="CU":conditions.append("Cuba requiere verificación específica del corredor antes de continuar.")
        return PreparationGuide(title="Antes de empezar",introduction="Prepara únicamente la información necesaria para completar el envío con el proveedor.",sender_items=sender,recipient_items=recipient,provider_items=provider,before_start=before_start,before_payment=before_payment,important_conditions=conditions)

    def build_send_guide(self,session):
        p=session.selected_option.provider_name if session.selected_option else None
        delivery=session.delivery_method
        payment=session.payment_method
        steps=[
            GuideStep(1,"Selecciona el destino","Selecciona el país correcto al que enviarás el dinero.",what_to_select=session.destination,what_to_check="País de destino"),
            GuideStep(2,"Indica la cantidad","Escribe la cantidad que deseas enviar y comprueba la moneda.",what_to_enter=f"{session.amount:g} {session.send_currency}" if session.amount else None,what_to_check="Cantidad y moneda"),
            GuideStep(3,"Selecciona cómo recibe","Elige efectivo, cuenta bancaria, tarjeta, wallet u otro método disponible para el receptor.",what_to_select=delivery,what_to_check="Que el método sea el que realmente puede usar el receptor"),
            GuideStep(4,"Selecciona cómo pagas","Elige el método de pago disponible para ti.",what_to_select=payment,what_to_check="Que el método de pago sea correcto"),
            GuideStep(5,"Introduce los datos del receptor","Escribe los datos solicitados por el proveedor exactamente como corresponda.",what_to_enter="Datos reales del receptor",what_to_check="Nombre, teléfono y datos de recepción"),
            GuideStep(6,"Revisa el costo","Antes de pagar, revisa la tarifa, tipo de cambio, total que pagarás y cantidad que recibirá el receptor.",what_to_check="Costo y cantidad recibida"),
            GuideStep(7,"Confirma solo después de revisar","Si todo coincide con lo que necesitas, continúa con el proveedor.",what_to_check="Destino, receptor, método y cantidades")
        ]
        docs=["El proveedor puede solicitar identificación u otra información según la operación.","No introduzcas en esta aplicación contraseñas, PIN, códigos de seguridad ni credenciales."]
        recipient=["Nombre del receptor","Teléfono si lo solicita el proveedor"]
        if delivery=="bank_account":recipient.append("Datos bancarios requeridos por el proveedor")
        if delivery=="mobile_wallet":recipient.append("Identificador o número de la wallet")
        if delivery=="cash_pickup":recipient.append("Información necesaria para retiro y ubicación del receptor")
        warnings=["Las pantallas y campos exactos pertenecen al proveedor y pueden cambiar.","Esta guía explica el proceso; no ejecuta ni garantiza el envío."]
        return SendGuide(title="Guía para realizar el envío",provider_name=p,delivery_method=delivery,payment_method=payment,steps=steps,documents_or_information=docs,recipient_information=recipient,warnings=warnings)

    def final_check(self,req):
        if isinstance(req,dict):req=FinalCheckRequest(**req)
        items=[]
        missing=[]
        verify=[]
        def add(key,label,value,required=True,status="verify",verified=False,explanation=None):
            items.append(FinalCheckItem(key=key,label=label,value=value,required=required,status=status,verified=verified,explanation=explanation))
            if status=="missing" and required:missing.append(label)
            if status=="verify" and required:verify.append(label)
        add("destination","País de destino",req.destination_country,bool(req.destination_country),"ok" if req.destination_country else "missing",bool(req.destination_country))
        add("amount","Cantidad",req.amount,bool(req.amount),"ok" if req.amount else "missing",bool(req.amount))
        add("currency","Moneda",req.currency,bool(req.currency),"ok" if req.currency else "missing",bool(req.currency))
        add("delivery_method","Método de recepción",req.delivery_method,False,"ok" if req.delivery_method else "verify",bool(req.delivery_method))
        add("payment_method","Método de pago",req.payment_method,False,"ok" if req.payment_method else "verify",bool(req.payment_method))
        ri=req.recipient_information
        if ri:
            add("recipient_name","Nombre del receptor",ri.full_name,True,"ok" if ri.full_name else "missing",bool(ri.full_name))
            if req.delivery_method=="bank_account":add("bank_account","Datos bancarios",ri.bank_account,True,"ok" if ri.bank_account else "missing",bool(ri.bank_account))
            if req.delivery_method=="mobile_wallet":add("wallet","Wallet",ri.wallet,True,"ok" if ri.wallet else "missing",bool(ri.wallet))
            if req.delivery_method=="cash_pickup":add("pickup_location","Ubicación de retiro",ri.pickup_location,False,"verify",False)
        else:
            add("recipient_information","Información del receptor",None,True,"missing",False,"Ten preparados los datos que el proveedor solicite.")
        if req.provider_id:
            p=self._provider_by_id(req.provider_id)
            name=p.get("name",req.provider_id) if p else req.provider_id
            cd=self.get_verified_provider_data(req.provider_id,req.destination_country)
            if cd:
                add("fee","Tarifa",cd.get("fee"),True,"ok",True,"Dato comercial verificado.")
                add("exchange_rate","Tipo de cambio",cd.get("exchange_rate"),True,"ok",True,"Dato comercial verificado.")
                add("recipient_amount","Cantidad recibida",cd.get("recipient_amount"),True,"ok",True,"Dato comercial verificado.")
            else:
                add("commercial_quote","Cotización actual",None,True,"verify",False,"Confirma tarifa, tasa, cantidad recibida y tiempo directamente con el proveedor.")
                verify.extend(["Tarifa actual","Tipo de cambio actual","Cantidad que recibe el destinatario"])
        else:name=None
        ready=not missing and not verify
        message="Puedes continuar con la revisión final." if ready else "Hay información que debes completar o verificar antes de pagar."
        return FinalCheckResponse(ready_to_continue=ready,items=items,missing_items=missing,items_to_verify=list(dict.fromkeys(verify)),warnings=["La información comercial puede cambiar antes del pago.","Confirma los valores que aparezcan como no verificados."],provider_name=name,official_url=p.get("official_url") if req.provider_id and p else None,message=message,next_step="continue" if ready else "review")

    def session_final_check(self,session):
        req=FinalCheckRequest(amount=session.amount or 0,currency=session.send_currency,destination_country=session.destination or "",delivery_method=session.delivery_method,payment_method=session.payment_method,provider_id=session.selected_option.provider_id if session.selected_option else None)
        result=self.final_check(req)
        session.final_check=result
        session.current_step="final_check"
        return result

    def public_config(self):
        b=self.brain
        opening=b.get("opening",{})
        comparison=b.get("comparison",{})
        return {
            "app":b.get("app",{}),
            "opening":opening,
            "priorities":opening.get("priorities",[]),
            "countries":b.get("countries",{}).get("initial_supported",b.get("countries",{}).get("supported",[])) if isinstance(b.get("countries",{}),dict) else [],
            "providers":[self.provider_public_option(p).model_dump(exclude_none=True) for p in self._provider_registry()],
            "delivery_methods":b.get("delivery_methods",[]),
            "payment_methods":b.get("payment_methods",[]),
            "messages":b.get("messages",{}),
            "provider_handoff":b.get("provider_handoff",{}),
            "preparation":b.get("preparation",{}),
            "guide":b.get("guide",{}),
            "comparison":comparison
        }

    def help(self,language="es"):
        if language=="en":
            return HelpResponse(title="How REMESAS helps",message="REMESAS helps you understand your situation, prepare the information you need, compare compatible options and verify the important details before continuing with the provider.",topics=["Your need","What you need to prepare","Costs and exchange rates","Recipient information","Final verification","Provider handoff"])
        return HelpResponse(title="Cómo te ayuda REMESAS",message="REMESAS te ayuda a entender tu situación, preparar la información necesaria, comparar opciones compatibles y verificar los datos importantes antes de continuar con el proveedor.",topics=["Tu necesidad","Qué debes preparar","Costos y tasas","Datos del receptor","Verificación final","Continuar con el proveedor"])

engine=RemittanceEngine()
