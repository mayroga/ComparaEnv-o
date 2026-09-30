import json,re,uuid
from copy import deepcopy
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional

from schemas import (
    ComparisonRequest,ComparisonResponse,ComparisonResult,
    FinalCheckRequest,FinalCheckResponse,ParseNeedRequest,
    UserNeedRequest
)

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_PATH=DATA_DIR/"app_brain.json"
PROVIDERS_PATH=DATA_DIR/"providers.json"

class RemittanceEngine:
    def __init__(self):
        self.brain={}
        self.providers_data={}
        self.sessions={}

    def _read_json(self,path:Path)->Dict[str,Any]:
        if not path.exists():
            raise FileNotFoundError(f"Required data file not found: {path}")
        try:
            with path.open("r",encoding="utf-8") as f:
                data=json.load(f)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in {path.name}: {exc}") from exc
        if not isinstance(data,dict):
            raise ValueError(f"{path.name} must contain a JSON object.")
        return data

    def load_brain(self):
        data=self._read_json(BRAIN_PATH)
        required=[
            "app","experience","opening","conversation_logic",
            "kernel","providers","countries","comparison",
            "validation","security","languages"
        ]
        missing=[x for x in required if x not in data]
        if missing:
            raise ValueError(f"app_brain.json missing sections: {', '.join(missing)}")
        self.brain=data
        return data

    def load_providers(self):
        try:
            data=self._read_json(PROVIDERS_PATH)
        except FileNotFoundError:
            fallback=deepcopy(self.brain.get("providers",{}))
            data={
                "version":self.brain.get("app",{}).get("version","4.0.0"),
                "schema_version":"4.0",
                "providers":fallback.get("providers",[]),
                "corridors":fallback.get("corridors",{})
            }
        providers=data.get("providers",[])
        if not isinstance(providers,list):
            raise ValueError("providers.json providers must be a list.")
        corridors=data.get("corridors",{})
        if not isinstance(corridors,dict):
            data["corridors"]={}
        self.providers_data=data
        return data

    def now(self)->str:
        return datetime.now(timezone.utc).isoformat()

    def language(self,language:str)->str:
        return language if language in {"es","en"} else "es"

    def text(self,value:Any,language:str)->str:
        if isinstance(value,dict):
            return str(value.get(language,value.get("es",value.get("en",""))))
        return str(value or "")

    def countries(self)->List[Dict[str,Any]]:
        return self.brain.get("countries",{}).get("supported",[])

    def get_country(self,code:str)->Optional[Dict[str,Any]]:
        code=(code or "").upper().strip()
        for item in self.countries():
            if item.get("code")==code:
                return item
        return None

    def country_supported(self,code:str)->bool:
        return self.get_country(code) is not None

    def country_name(self,code:str,language:str="es")->str:
        item=self.get_country(code)
        if not item:
            return code
        return self.text(item.get("name",{}),language)

    def country_aliases(self)->Dict[str,str]:
        aliases={}
        for item in self.countries():
            code=item.get("code","")
            names=[
                code,
                self.text(item.get("name",{}),"es"),
                self.text(item.get("name",{}),"en")
            ]
            names+=item.get("aliases",[])
            for name in names:
                if name:
                    aliases[str(name).lower().strip()]=code
        return aliases

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=[]
        seen=set()
        for item in self.providers_data.get("providers",[]):
            if not isinstance(item,dict):
                continue
            pid=str(item.get("id","")).strip()
            if not pid or pid in seen or not item.get("enabled",True):
                continue
            seen.add(pid)
            providers.append(item)
        return providers

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        for item in self.get_provider_registry():
            if item.get("id")==provider_id:
                return item
        return None

    def provider_urls(self,provider:Dict[str,Any],language:str="es")->Dict[str,str]:
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):
            return {}
        return {k:v for k,v in urls.items() if isinstance(v,str) and v.startswith("https://")}

    def provider_continue_url(self,provider:Dict[str,Any],language:str="es")->Optional[str]:
        urls=self.provider_urls(provider,language)
        return urls.get("send_money") or urls.get("site")

    def corridor_provider_ids(self,country:str)->List[str]:
        country=(country or "").upper().strip()
        root=self.providers_data.get("corridors",{})
        destination=root.get("destinations",{}).get(country,{})
        ids=destination.get("providers",[])
        if isinstance(ids,list):
            return [str(x) for x in ids]
        return []

    def candidate_provider_ids(self,country:str)->List[str]:
        ids=self.corridor_provider_ids(country)
        if ids:
            registry={x.get("id") for x in self.get_provider_registry()}
            return [x for x in ids if x in registry]
        return [x.get("id") for x in self.get_provider_registry()]

    def get_verified_provider_data(
        self,
        provider_id:str,
        country:str="",
        amount:Optional[float]=None,
        delivery_method:Optional[str]=None,
        payment_method:Optional[str]=None
    )->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:
            return None
        commercial=provider.get("commercial_data")
        if not isinstance(commercial,dict):
            return None
        if str(commercial.get("status","")).lower() not in {"verified","available","current"}:
            return None
        if not commercial.get("source") or not commercial.get("verified_at"):
            return None
        return commercial

    def provider_public_option(
        self,
        provider_id:str,
        country:str="",
        language:str="es"
    )->Optional[Dict[str,Any]]:
        language=self.language(language)
        provider=self.get_provider(provider_id)
        if not provider:
            return None

        verified=self.get_verified_provider_data(provider_id,country)
        result={
            "provider_id":provider.get("id"),
            "provider_name":provider.get("name"),
            "enabled":bool(provider.get("enabled",True)),
            "official_urls":self.provider_urls(provider,language),
            "continue_url":self.provider_continue_url(provider,language),
            "payment_methods":provider.get("payment_methods",[]),
            "delivery_methods":provider.get("delivery_methods",[]),
            "methods_status":provider.get("methods_status","declared_not_commercially_verified"),
            "commercial_data_status":"verified" if verified else "unavailable"
        }

        if verified:
            for key in [
                "fee","exchange_rate","recipient_amount",
                "estimated_delivery","availability",
                "recipient_currency","important_condition",
                "source","verified_at"
            ]:
                if key in verified:
                    result[key]=verified.get(key)

        return result

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self.get_provider(provider_id)
        if not provider:
            return []
        req=provider.get("requirements",[])
        if not isinstance(req,list):
            return []
        return [
            self.text(x,language) if isinstance(x,dict) else str(x)
            for x in req
        ]

    def _brain_options(self,key:str)->List[Dict[str,Any]]:
        value=self.brain.get(key,[])
        return value if isinstance(value,list) else []

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=self.language(language)
        sid=uuid.uuid4().hex
        now=self.now()
        session={
            "session_id":sid,
            "language":language,
            "need_type":None,
            "amount":None,
            "send_currency":"USD",
            "destination_country":None,
            "destination_region":None,
            "priority":None,
            "urgency":None,
            "frequency":None,
            "delivery_method":None,
            "payment_method":None,
            "special_need":None,
            "recipient_amount_target":None,
            "free_text":None,
            "parsed_user_need":None,
            "candidate_providers":[],
            "available_providers":[],
            "verified_results":[],
            "selected_option":None,
            "final_check":None,
            "current_step":"amount",
            "created_at":now,
            "updated_at":now
        }
        self.sessions[sid]=session
        return deepcopy(session)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        session=self.sessions.get(session_id)
        return deepcopy(session) if session else None

    def update_session(self,session_id:str,**values)->Dict[str,Any]:
        if session_id not in self.sessions:
            raise KeyError("session_expired")
        session=self.sessions[session_id]
        allowed={
            "language","need_type","amount","send_currency",
            "destination_country","destination_region","priority",
            "urgency","frequency","delivery_method","payment_method",
            "special_need","recipient_amount_target","free_text",
            "parsed_user_need","candidate_providers","available_providers",
            "verified_results","selected_option","final_check","current_step"
        }
        for key,value in values.items():
            if key in allowed and value is not None:
                session[key]=value
        session["updated_at"]=self.now()
        return deepcopy(session)

    def clear_session(self,session_id:str)->bool:
        return self.sessions.pop(session_id,None) is not None

    def parse_amount(self,text:str)->Optional[float]:
        if not text:
            return None
        patterns=[
            r"\$\s*([\d,]+(?:\.\d+)?)",
            r"([\d,]+(?:\.\d+)?)\s*(?:usd|d[oó]lares?|dollars?)"
        ]
        for pattern in patterns:
            match=re.search(pattern,text,re.I)
            if match:
                try:
                    value=float(match.group(1).replace(",",""))
                    if 0<value<=1000000:
                        return value
                except ValueError:
                    pass
        return None

    def parse_country(self,text:str)->Optional[str]:
        if not text:
            return None
        low=text.lower()
        aliases=self.country_aliases()
        for alias,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if re.search(r"(?<!\w)"+re.escape(alias)+r"(?!\w)",low):
                return code
        return None

    def parse_priority(self,text:str)->Optional[str]:
        low=(text or "").lower()
        if any(x in low for x in ["reciba más","reciba mas","más dinero","mas dinero","mayor cantidad"]):
            return "recipient_gets_more"
        if any(x in low for x in ["rápido","rapido","fast","quick"]):
            return "fastest"
        if any(x in low for x in ["urgente","urgent","hoy","today"]):
            return "urgent"
        if any(x in low for x in ["ahorrar","barato","menos costo","menos comisión","menos comision"]):
            return "save"
        if any(x in low for x in ["comparar","compare","todo"]):
            return "compare_all"
        if any(x in low for x in ["equilibr","balanced"]):
            return "balanced"
        return None

    def parse_frequency(self,text:str)->Optional[str]:
        low=(text or "").lower()
        if any(x in low for x in ["cada semana","semanal","weekly"]):
            return "weekly"
        if any(x in low for x in ["cada dos semanas","quincenal","biweekly"]):
            return "biweekly"
        if any(x in low for x in ["cada mes","mensual","monthly"]):
            return "monthly"
        if any(x in low for x in ["una vez","una sola vez","one time","once"]):
            return "one_time"
        return None

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=request.text.strip()
        low=text.lower()
        amount=self.parse_amount(text)
        country=self.parse_country(text)
        priority=self.parse_priority(text)
        frequency=self.parse_frequency(text)
        urgency=bool(
            any(x in low for x in [
                "urgente","urgent","hoy","today","ahora","asap"
            ])
        ) or priority=="urgent"

        delivery=None
        if any(x in low for x in ["efectivo","cash","recoger","pickup"]):
            delivery="cash_pickup"
        elif any(x in low for x in ["banco","cuenta bancaria","bank account"]):
            delivery="bank_account"
        elif any(x in low for x in ["billetera","wallet"]):
            delivery="mobile_wallet"

        payment=None
        if any(x in low for x in ["tarjeta de débito","tarjeta de debito","debit card"]):
            payment="debit_card"
        elif any(x in low for x in ["tarjeta de crédito","tarjeta de credito","credit card"]):
            payment="credit_card"
        elif any(x in low for x in ["cuenta bancaria","bank account"]):
            payment="bank_account"
        elif any(x in low for x in ["efectivo","cash"]):
            payment="cash"

        need_type="other"
        remittance_words=[
            "enviar","mandar","remesa","remesas","transferir",
            "transferencia","send money","send","money transfer"
        ]
        if any(x in low for x in remittance_words):
            need_type="remittance"
        elif any(x in low for x in ["ingreso","salario","income","paycheck"]):
            need_type="money_available"
        elif any(x in low for x in ["gasto","gastos","expense","expenses"]):
            need_type="expenses"
        elif any(x in low for x in ["ahorrar","ahorro","save","savings"]):
            need_type="savings"
        elif any(x in low for x in ["comprar","compra","purchase","buy"]):
            need_type="purchase"
        elif any(x in low for x in ["familia","family","madre","padre","hijo"]):
            need_type="family"
        elif any(x in low for x in ["tarifa","comisión","comision","fee"]):
            need_type="fees"
        elif any(x in low for x in ["tasa","exchange rate","cambio"]):
            need_type="exchange_rate"
        elif any(x in low for x in ["llega","entrega","delivery"]):
            need_type="delivery"
        elif any(x in low for x in ["diferencia","difference"]):
            need_type="provider_difference"
        elif any(x in low for x in ["requisito","documento","requirement"]):
            need_type="requirements"
        elif any(x in low for x in ["seguro","seguridad","security"]):
            need_type="security"

        return {
            "need_type":need_type,
            "amount":amount,
            "destination_country":country,
            "priority":priority,
            "urgency":urgency if urgency else None,
            "frequency":frequency,
            "delivery_method":delivery,
            "payment_method":payment,
            "language":self.language(request.language),
            "raw_text":text
        }

    def _next_step(self,session:Dict[str,Any])->str:
        if session.get("need_type") not in {None,"remittance"}:
            return "home_action"
        if not session.get("amount"):
            return "amount"
        if not session.get("destination_country"):
            return "destination"
        return "compare"

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:
            raise KeyError("session_expired")

        values=request.model_dump(exclude_none=True)
        values["language"]=self.language(values.get("language","es"))
        if values.get("destination_country"):
            values["destination_country"]=values["destination_country"].upper().strip()
            if not self.country_supported(values["destination_country"]):
                raise ValueError("Destination country is not supported.")

        session=self.update_session(session_id,**values)
        session["current_step"]=self._next_step(session)
        self.sessions[session_id]["current_step"]=session["current_step"]
        self.sessions[session_id]["updated_at"]=self.now()
        return deepcopy(self.sessions[session_id])

    def _build_verified_result(
        self,
        provider:Dict[str,Any],
        commercial:Dict[str,Any],
        request:ComparisonRequest
    )->ComparisonResult:
        return ComparisonResult(
            provider_id=provider["id"],
            provider_name=provider["name"],
            amount_sent=request.amount,
            send_currency=request.send_currency,
            fee=commercial.get("fee"),
            exchange_rate=commercial.get("exchange_rate"),
            recipient_amount=commercial.get("recipient_amount"),
            delivery_method=request.delivery_method,
            payment_method=request.payment_method,
            estimated_delivery=commercial.get("estimated_delivery"),
            recipient_currency=commercial.get("recipient_currency"),
            availability=commercial.get("availability"),
            important_condition=commercial.get("important_condition"),
            requirements=self.provider_requirements(provider["id"],request.language),
            source=commercial.get("source"),
            verified_at=commercial.get("verified_at"),
            status="verified",
            continue_url=self.provider_continue_url(provider,request.language)
        )

    def _differences(
        self,
        providers:List[Dict[str,Any]],
        language:str
    )->List[Dict[str,Any]]:
        result=[]
        for provider in providers:
            result.append({
                "provider_id":provider.get("provider_id"),
                "provider_name":provider.get("provider_name"),
                "delivery_methods":provider.get("delivery_methods",[]),
                "payment_methods":provider.get("payment_methods",[]),
                "methods_status":provider.get("methods_status"),
                "commercial_data_status":provider.get("commercial_data_status"),
                "official_url":provider.get("continue_url")
            })
        return result

    def comparison_explanation(
        self,
        verified_count:int,
        provider_count:int,
        language:str
    )->str:
        if verified_count:
            if language=="en":
                return f"{verified_count} provider option(s) contain current verified commercial data. Other available options can still be reviewed on their official sites."
            return f"{verified_count} opción(es) tienen datos comerciales actuales verificados. Las demás opciones pueden revisarse en sus sitios oficiales."
        if language=="en":
            return f"{provider_count} provider option(s) are available for review, but current fees, exchange rates, delivery times, and availability are not verified here."
        return f"Hay {provider_count} opción(es) de proveedores para revisar, pero aquí no están verificadas las tarifas, tasas de cambio, tiempos de entrega ni disponibilidad actuales."

    def _precautions(self,language:str)->List[str]:
        if language=="en":
            return [
                "Confirm the recipient's information before sending.",
                "Confirm the final fee and exchange rate on the provider's official site.",
                "Do not enter passwords, CVVs, security codes, or bank credentials into REMESAS."
            ]
        return [
            "Confirma los datos del destinatario antes de enviar.",
            "Confirma la tarifa y la tasa final en el sitio oficial del proveedor.",
            "No introduzcas contraseñas, CVV, códigos de seguridad ni credenciales bancarias en REMESAS."
        ]

    def compare(self,request:ComparisonRequest)->ComparisonResponse:
        language=self.language(request.language)
        country=request.destination_country.upper().strip()

        if not self.country_supported(country):
            raise ValueError("Destination country is not supported.")

        candidate_ids=self.candidate_provider_ids(country)
        available=[]
        verified=[]
        public_options=[]

        for pid in candidate_ids:
            public=self.provider_public_option(pid,country,language)
            if not public:
                continue
            public_options.append(public)

            commercial=self.get_verified_provider_data(
                pid,
                country,
                request.amount,
                request.delivery_method,
                request.payment_method
            )

            provider=self.get_provider(pid)
            if provider and commercial:
                verified.append(
                    self._build_verified_result(provider,commercial,request)
                )

        response=ComparisonResponse(
            success=True,
            message=(
                self.brain.get("messages",{}).get(
                    "results_ready" if verified else "no_results",{}
                ).get(language)
            ),
            results=verified,
            available_providers=public_options,
            provider_count=len(public_options),
            verified_count=len(verified),
            results_available=bool(verified),
            destination_country=country,
            destination_name=self.country_name(country,language),
            amount=request.amount,
            send_currency=request.send_currency,
            priority=request.priority,
            urgency=request.urgency,
            frequency=request.frequency,
            language=language,
            explanation=self.comparison_explanation(
                len(verified),len(public_options),language
            ),
            differences=self._differences(public_options,language),
            precautions=self._precautions(language)
        )
        return response

    def compare_session(self,session_id:str)->ComparisonResponse:
        session=self.sessions.get(session_id)
        if not session:
            raise KeyError("session_expired")

        request=ComparisonRequest(
            amount=session.get("amount"),
            destination_country=session.get("destination_country"),
            priority=session.get("priority"),
            urgency=session.get("urgency"),
            frequency=session.get("frequency"),
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            language=session.get("language","es"),
            send_currency=session.get("send_currency","USD"),
            recipient_amount_target=session.get("recipient_amount_target"),
            special_need=session.get("special_need")
        )

        response=self.compare(request)

        self.sessions[session_id]["candidate_providers"]=[
            x.get("provider_id") for x in response.available_providers
        ]
        self.sessions[session_id]["available_providers"]=[
            x.model_dump() if hasattr(x,"model_dump") else x
            for x in response.available_providers
        ]
        self.sessions[session_id]["verified_results"]=[
            x.model_dump() for x in response.results
        ]
        self.sessions[session_id]["current_step"]="select_provider"
        self.sessions[session_id]["updated_at"]=self.now()

        return response

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        if session_id not in self.sessions:
            raise KeyError("session_expired")

        session=self.sessions[session_id]
        candidates=self.candidate_provider_ids(
            session.get("destination_country","")
        )

        if provider_id not in candidates:
            raise KeyError("provider_not_available")

        option=self.provider_public_option(
            provider_id,
            session.get("destination_country",""),
            session.get("language","es")
        )

        if not option:
            raise KeyError("provider_not_found")

        option["requirements"]=self.provider_requirements(
            provider_id,
            session.get("language","es")
        )

        session["selected_option"]=option
        session["current_step"]="final_check"
        session["updated_at"]=self.now()
        return deepcopy(option)

    def final_check(
        self,
        request:FinalCheckRequest,
        session_id:Optional[str]=None
    )->FinalCheckResponse:
        language=self.language(request.language)
        checks=[]

        country_ok=self.country_supported(request.destination_country)
        checks.append({
            "id":"destination",
            "label":"Destino" if language=="es" else "Destination",
            "ok":country_ok,
            "message":(
                "Destino reconocido."
                if country_ok and language=="es"
                else "Destination recognized."
                if country_ok
                else "Destino no reconocido."
                if language=="es"
                else "Destination not recognized."
            )
        })

        amount_ok=0<request.amount<=1000000
        checks.append({
            "id":"amount",
            "label":"Monto" if language=="es" else "Amount",
            "ok":amount_ok,
            "message":(
                "Monto válido."
                if amount_ok and language=="es"
                else "Valid amount."
                if amount_ok
                else "Monto no válido."
                if language=="es"
                else "Invalid amount."
            )
        })

        currency_ok=request.send_currency=="USD"
        checks.append({
            "id":"currency",
            "label":"Moneda" if language=="es" else "Currency",
            "ok":currency_ok,
            "message":(
                "USD seleccionado."
                if currency_ok and language=="es"
                else "USD selected."
                if currency_ok
                else "Moneda no soportada."
                if language=="es"
                else "Unsupported currency."
            )
        })

        provider=self.get_provider(request.provider_id)
        provider_ok=bool(provider)
        checks.append({
            "id":"provider",
            "label":"Proveedor" if language=="es" else "Provider",
            "ok":provider_ok,
            "message":(
                "Proveedor reconocido."
                if provider_ok and language=="es"
                else "Provider recognized."
                if provider_ok
                else "Proveedor no reconocido."
                if language=="es"
                else "Provider not recognized."
            )
        })

        requirements=self.provider_requirements(
            request.provider_id,
            language
        )

        if language=="en":
            message="Review the final transaction details on the provider's official site before confirming."
        else:
            message="Revisa los datos finales de la transacción en el sitio oficial del proveedor antes de confirmar."

        precautions=self._precautions(language)

        ready=all(x["ok"] for x in checks)

        response=FinalCheckResponse(
            success=True,
            ready_to_continue=ready,
            language=language,
            provider_id=request.provider_id,
            checks=checks,
            message=message,
            precautions=precautions,
            requirements=requirements
        )

        if session_id and session_id in self.sessions:
            self.sessions[session_id]["final_check"]=response.model_dump()
            self.sessions[session_id]["current_step"]="official_site" if ready else "final_check"
            self.sessions[session_id]["updated_at"]=self.now()

        return response

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        language=self.language(language)
        topics=self.brain.get("help_center",{}).get("topics",[])
        result=[]
        for topic in topics:
            result.append({
                "id":topic.get("id"),
                "title":self.text(topic.get("title",{}),language),
                "answer":self.text(topic.get("answer",{}),language)
            })
        return result

    def assistant_response(self,need_type:str,language:str,text:str="")->str:
        language=self.language(language)
        responses={
            "remittance":{
                "es":"Puedo ayudarte a organizar el envío. Necesito primero el monto y el país de destino.",
                "en":"I can help organize the transfer. I first need the amount and destination country."
            },
            "money_available":{
                "es":"Puedes usar Mi dinero para calcular cuánto tienes disponible.",
                "en":"You can use My money to calculate how much you have available."
            },
            "expenses":{
                "es":"Puedes registrar tus gastos y mantenerlos en este dispositivo.",
                "en":"You can record your expenses and keep them on this device."
            },
            "savings":{
                "es":"Puedes indicar cuánto quieres reservar y para qué.",
                "en":"You can enter how much you want to reserve and what it is for."
            },
            "purchase":{
                "es":"Puedes calcular si una compra cabe dentro de tu dinero disponible.",
                "en":"You can calculate whether a purchase fits within your available money."
            },
            "fees":{
                "es":"Las tarifas deben confirmarse con el proveedor porque pueden cambiar.",
                "en":"Fees should be confirmed with the provider because they can change."
            },
            "exchange_rate":{
                "es":"La tasa de cambio puede cambiar. Confirma la tasa final con el proveedor.",
                "en":"Exchange rates can change. Confirm the final rate with the provider."
            },
            "delivery":{
                "es":"El tiempo de entrega depende del proveedor, destino y método.",
                "en":"Delivery timing depends on the provider, destination, and method."
            },
            "provider_difference":{
                "es":"Puedo mostrar las diferencias declaradas y separar los datos verificados de los que debes confirmar.",
                "en":"I can show declared differences and separate verified data from details you must confirm."
            },
            "security":{
                "es":"No introduzcas contraseñas, CVV, códigos de seguridad ni credenciales bancarias.",
                "en":"Do not enter passwords, CVVs, security codes, or bank credentials."
            }
        }
        return responses.get(
            need_type,
            {
                "es":"Puedo ayudarte a aclarar la necesidad y llevarte al siguiente paso.",
                "en":"I can help clarify the need and take you to the next step."
            }
        )[language]

    def calculate_money_plan(
        self,
        income:float,
        essential:float=0,
        flexible:float=0,
        savings:float=0,
        remittance:float=0
    )->Dict[str,float]:
        available=income-essential-flexible-savings-remittance
        return {
            "income":round(income,2),
            "essential_expenses":round(essential,2),
            "flexible_expenses":round(flexible,2),
            "savings":round(savings,2),
            "remittance":round(remittance,2),
            "available":round(available,2)
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=self.language(language)
        providers=[]

        for provider in self.get_provider_registry():
            option=self.provider_public_option(
                provider["id"],
                "",
                language
            )
            if option:
                providers.append(option)

        return {
            "app":self.brain.get("app",{}),
            "language":language,
            "opening":self.brain.get("opening",{}),
            "conversation_logic":self.brain.get("conversation_logic",{}),
            "remittance_flow":self.brain.get("remittance_flow",{}),
            "countries":self.countries(),
            "providers":providers,
            "delivery_methods":self.brain.get("delivery_methods",[]),
            "payment_methods":self.brain.get("payment_methods",[]),
            "messages":self.brain.get("messages",{}),
            "help_topics":self.help_topics(language),
            "provider_comparison":self.brain.get("provider_comparison",{}),
            "provider_handoff":self.brain.get("provider_handoff",{}),
            "money_planner":self.brain.get("money_planner",{}),
            "security":self.brain.get("security",{}),
            "privacy":self.brain.get("data_privacy",{})
        }

engine=RemittanceEngine()
