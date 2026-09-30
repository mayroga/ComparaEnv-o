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

MAX_AMOUNT=1000000.0
MAX_SESSION_ID=128
MAX_TEXT=2000

class RemittanceEngine:
    def __init__(self):
        self.sessions:Dict[str,Dict[str,Any]]={}
        self.brain:Dict[str,Any]={}
        self.providers_data:Dict[str,Any]={}
        self.providers:Dict[str,Dict[str,Any]]={}
        self.load()

    def _read_json(self,path:Path)->Dict[str,Any]:
        with path.open("r",encoding="utf-8") as f:
            data=json.load(f)
        if not isinstance(data,dict):
            raise ValueError(f"Invalid JSON object: {path.name}")
        return data

    def load(self)->None:
        self.brain=self._read_json(BRAIN_PATH)
        self.providers_data=self._read_json(PROVIDERS_PATH)
        self.providers={}
        for provider in self.providers_data.get("providers",[]):
            if not isinstance(provider,dict):
                continue
            provider_id=str(provider.get("id","")).strip()
            if provider_id:
                self.providers[provider_id]=provider

    def reload(self)->None:
        self.load()

    def _now(self)->str:
        return datetime.now(timezone.utc).isoformat()

    def _new_session_id(self)->str:
        return uuid.uuid4().hex

    def _valid_session_id(self,session_id:Optional[str])->bool:
        if not session_id or len(session_id)>MAX_SESSION_ID:
            return False
        return bool(re.fullmatch(r"[A-Za-z0-9_-]+",session_id))

    def _language(self,value:Optional[str])->str:
        value=(value or "es").lower().strip()
        languages=self.brain.get("languages",{})
        supported=languages.get("supported") if isinstance(languages,dict) else None
        if isinstance(supported,list):
            allowed={str(x).lower() for x in supported}
            if value in allowed:
                return value
        return value if value in {"es","en"} else "es"

    def _text(self,value:Any)->str:
        if value is None:
            return ""
        return str(value).strip()[:MAX_TEXT]

    def _country_aliases(self)->Dict[str,str]:
        aliases={}
        countries=self.brain.get("countries",[])
        if isinstance(countries,list):
            for country in countries:
                if not isinstance(country,dict):
                    continue
                code=str(country.get("code","")).upper().strip()
                if not code:
                    continue
                aliases[code]=code
                names=country.get("aliases",[])
                if isinstance(names,list):
                    for name in names:
                        aliases[str(name).lower().strip()]=code
                name=country.get("name")
                if isinstance(name,dict):
                    for value in name.values():
                        aliases[str(value).lower().strip()]=code
                elif name:
                    aliases[str(name).lower().strip()]=code
        return aliases

    def parse_country(self,text:Optional[str])->Optional[str]:
        value=self._text(text)
        if not value:
            return None
        upper=value.upper()
        aliases=self._country_aliases()
        if upper in aliases:
            return aliases[upper]
        low=value.lower()
        if low in aliases:
            return aliases[low]
        for alias,code in sorted(aliases.items(),key=lambda x:-len(x[0])):
            if len(alias)>=3 and re.search(rf"\b{re.escape(alias)}\b",low):
                return code
        return None

    def _country_name(self,code:Optional[str],language:str="es")->str:
        if not code:
            return ""
        countries=self.brain.get("countries",[])
        if isinstance(countries,list):
            for country in countries:
                if str(country.get("code","")).upper()==str(code).upper():
                    name=country.get("name")
                    if isinstance(name,dict):
                        return str(name.get(language) or name.get("es") or name.get("en") or code)
                    if name:
                        return str(name)
        return str(code)

    def _message(self,key:str,language:str="es",fallback:Optional[str]=None)->str:
        language=self._language(language)
        messages=self.brain.get("messages",{})
        value=messages.get(key) if isinstance(messages,dict) else None
        if isinstance(value,dict):
            return str(value.get(language) or value.get("es") or value.get("en") or fallback or key)
        if isinstance(value,str):
            return value
        return fallback or key

    def _parse_amount(self,text:str)->Optional[float]:
        if not text:
            return None
        patterns=[
            r"(?:US\$|\$|USD)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
            r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|d[oó]lares?)"
        ]
        for pattern in patterns:
            match=re.search(pattern,text,re.I)
            if match:
                try:
                    amount=float(match.group(1).replace(",",""))
                    if 0<amount<=MAX_AMOUNT:
                        return amount
                except ValueError:
                    pass
        return None

    def _parse_priority(self,text:str)->Optional[str]:
        value=text.lower()
        if any(x in value for x in ["reciba más","recibir más","más dinero","more money","recipient gets more"]):
            return "recipient_gets_more"
        if any(x in value for x in ["rápido","rapida","rápida","urgente","hoy","fast","quick","speed"]):
            return "fastest"
        if any(x in value for x in ["ahorrar","barato","menos costo","save","cheaper","cost"]):
            return "save"
        if any(x in value for x in ["comparar","todas","opciones","compare","all options"]):
            return "compare_all"
        if any(x in value for x in ["equilibrio","balance","balanced"]):
            return "balanced"
        return None

    def _parse_frequency(self,text:str)->Optional[str]:
        value=text.lower()
        if any(x in value for x in ["cada semana","semanal","weekly"]):
            return "weekly"
        if any(x in value for x in ["cada dos semanas","cada 2 semanas","quincenal","biweekly"]):
            return "biweekly"
        if any(x in value for x in ["cada mes","mensual","monthly"]):
            return "monthly"
        if any(x in value for x in ["una vez","solo una","one time","once"]):
            return "one_time"
        return None

    def _parse_need_type(self,text:str)->str:
        value=text.lower()
        if any(x in value for x in ["enviar dinero","mandar dinero","remesa","remesas","transferir dinero","send money","remittance","transfer money"]):
            return "remittance"
        if any(x in value for x in ["cuánto tengo","cuanto tengo","disponible","dinero disponible","how much can i use","available money"]):
            return "money_available"
        if any(x in value for x in ["gasto","gastos","expense","expenses"]):
            return "expenses"
        if any(x in value for x in ["ahorrar","ahorro","savings","save money"]):
            return "savings"
        if any(x in value for x in ["comprar","compra","purchase","buy"]):
            return "purchase"
        if any(x in value for x in ["familia","family","familiar"]):
            return "family"
        if any(x in value for x in ["tarifa","comisión","comision","fee","fees"]):
            return "fees"
        if any(x in value for x in ["tasa","tipo de cambio","exchange rate","rate"]):
            return "exchange_rate"
        if any(x in value for x in ["cuánto tarda","cuanto tarda","tiempo","entrega","delivery","how long"]):
            return "delivery"
        if any(x in value for x in ["diferencia entre","diferencia","provider difference","difference"]):
            return "provider_difference"
        if any(x in value for x in ["seguro","seguridad","security","safe"]):
            return "security"
        return "general"

    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=self._text(request.text)
        language=self._language(request.language)
        parsed={
            "need_type":self._parse_need_type(text),
            "amount":self._parse_amount(text),
            "destination_country":self.parse_country(text),
            "priority":self._parse_priority(text),
            "urgency":bool(re.search(r"\b(urgente|hoy|urgent|today)\b",text,re.I)) if text else None,
            "frequency":self._parse_frequency(text),
            "delivery_method":None,
            "payment_method":None,
            "recipient_amount_target":None,
            "language":language
        }
        return {
            "success":True,
            "parsed":parsed,
            "raw_text":text,
            "assistant":self._assistant_text(parsed,language)
        }

    def _assistant_text(self,parsed:Dict[str,Any],language:str)->str:
        language=self._language(language)
        need=parsed.get("need_type")
        if need=="remittance":
            if parsed.get("amount") and parsed.get("destination_country"):
                country=self._country_name(parsed["destination_country"],language)
                if language=="en":
                    return f"You want to send {parsed['amount']:.2f} USD to {country}. We can review the available provider catalog."
                return f"Quieres enviar ${parsed['amount']:.2f} a {country}. Podemos revisar el catálogo de proveedores disponible."
            if language=="en":
                return "I understand that you want to organize a money transfer. We will ask only for the information needed for the next step."
            return "Entiendo que quieres organizar una remesa. Solo pediremos la información necesaria para el siguiente paso."
        if need=="money_available":
            return "Podemos calcular tu dinero disponible con los datos que introduzcas."
        if need=="expenses":
            return "Podemos registrar y revisar tus gastos en este dispositivo."
        if need=="savings":
            return "Podemos calcular una cantidad que quieras reservar para un objetivo."
        if need=="purchase":
            return "Podemos comprobar cómo queda tu cálculo después de una compra."
        if need=="family":
            return "Puedes guardar una referencia familiar local para preparar una remesa."
        if language=="en":
            return "Tell me what you need and I will guide you to the relevant section."
        return "Dime qué necesitas y te llevaré a la sección correspondiente."

    def create_session(self,language:str="es")->Dict[str,Any]:
        language=self._language(language)
        session_id=self._new_session_id()
        session={
            "session_id":session_id,
            "language":language,
            "created_at":self._now(),
            "updated_at":self._now(),
            "need_type":None,
            "amount":None,
            "destination_country":None,
            "destination_region":None,
            "priority":None,
            "urgency":None,
            "frequency":None,
            "delivery_method":None,
            "payment_method":None,
            "recipient_amount_target":None,
            "special_need":None,
            "free_text":None,
            "parsed_need":None,
            "candidate_providers":[],
            "available_providers":[],
            "verified_results":[],
            "selected_option":None,
            "final_check":None
        }
        self.sessions[session_id]=session
        return deepcopy(session)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        if not self._valid_session_id(session_id):
            return None
        session=self.sessions.get(session_id)
        return deepcopy(session) if session else None

    def delete_session(self,session_id:str)->bool:
        if not self._valid_session_id(session_id):
            return False
        return self.sessions.pop(session_id,None) is not None

    def update_session(self,session_id:str,values:Dict[str,Any])->Optional[Dict[str,Any]]:
        if not self._valid_session_id(session_id):
            return None
        session=self.sessions.get(session_id)
        if not session:
            return None
        allowed={
            "language","need_type","amount","destination_country",
            "destination_region","priority","urgency","frequency",
            "delivery_method","payment_method","recipient_amount_target",
            "special_need","free_text","parsed_need"
        }
        for key,value in values.items():
            if key in allowed:
                session[key]=value
        session["updated_at"]=self._now()
        return deepcopy(session)

    def apply_need(self,request:UserNeedRequest)->Dict[str,Any]:
        session_id=getattr(request,"session_id",None)
        if not session_id:
            return {"success":False,"message":"session_id is required"}
        session=self.sessions.get(session_id)
        if not session:
            return {"success":False,"message":"Session not found"}

        language=self._language(request.language)
        values=request.model_dump(exclude_none=True)
        values["language"]=language

        country=values.get("destination_country")
        if country:
            country=self.parse_country(country) or str(country).upper().strip()
            values["destination_country"]=country

        if values.get("amount") is not None and not 0<values["amount"]<=MAX_AMOUNT:
            return {"success":False,"message":"Invalid amount"}

        if values.get("need_type")=="remittance" and country:
            if not self.is_supported_country(country):
                return {
                    "success":False,
                    "message":self._unsupported_country_message(country,language)
                }

        updated=self.update_session(session_id,values)
        if not updated:
            return {"success":False,"message":"Session not found"}

        next_step=self._next_step(updated)
        return {
            "success":True,
            "session":updated,
            "next_step":next_step
        }

    def _next_step(self,session:Dict[str,Any])->str:
        if session.get("need_type")!="remittance":
            return "home_action"
        if not session.get("amount"):
            return "amount"
        if not session.get("destination_country"):
            return "destination"
        return "compare"

    def _unsupported_country_message(self,country:str,language:str)->str:
        if language=="en":
            return f"{country} is not available in the current REMESAS country catalog."
        return f"{country} no está disponible en el catálogo actual de países de REMESAS."

    def is_supported_country(self,country:str)->bool:
        code=str(country or "").upper().strip()
        if not code:
            return False
        aliases=self._country_aliases()
        if code in aliases:
            return True
        countries=self.brain.get("countries",[])
        if isinstance(countries,list):
            return any(str(x.get("code","")).upper()==code for x in countries if isinstance(x,dict))
        return False

    def _provider_url(self,provider:Dict[str,Any],key:str)->Optional[str]:
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):
            return None
        value=urls.get(key)
        if not isinstance(value,str):
            return None
        value=value.strip()
        if not re.match(r"^https://",value,re.I):
            return None
        return value

    def provider_urls(self,provider:Dict[str,Any])->Dict[str,str]:
        urls={}
        for key in ("site","send_money"):
            value=self._provider_url(provider,key)
            if value:
                urls[key]=value
        return urls

    def provider_continue_url(self,provider:Dict[str,Any])->Optional[str]:
        return self._provider_url(provider,"send_money") or self._provider_url(provider,"site")

    def _corridor_data(self,country:str)->Dict[str,Any]:
        corridors=self.providers_data.get("corridors",{})
        destinations=corridors.get("destinations",{}) if isinstance(corridors,dict) else {}
        data=destinations.get(str(country).upper(),{})
        return data if isinstance(data,dict) else {}

    def corridor_provider_ids(self,country:str)->List[str]:
        data=self._corridor_data(country)
        providers=data.get("providers",[])
        if not isinstance(providers,list):
            providers=data.get("provider_ids",[])
        if not isinstance(providers,list):
            return []
        return [str(x).strip() for x in providers if str(x).strip() in self.providers]

    def candidate_provider_ids(self,country:Optional[str]=None)->List[str]:
        if country:
            ids=self.corridor_provider_ids(country)
            if ids:
                return ids
        return [
            provider_id
            for provider_id,provider in self.providers.items()
            if provider.get("enabled",True) is True
        ]

    def get_verified_provider_data(self,provider:Dict[str,Any])->Optional[Dict[str,Any]]:
        commercial=provider.get("commercial_data")
        if not isinstance(commercial,dict):
            return None

        status=str(commercial.get("status","")).lower().strip()
        if status not in {"verified","available","current","verified_current"}:
            return None

        source=commercial.get("source")
        verified_at=commercial.get("verified_at")
        if not source or not verified_at:
            return None

        values=deepcopy(commercial)
        values["status"]=status
        return values

    def provider_public_option(self,provider_id:str)->Optional[Dict[str,Any]]:
        provider=self.providers.get(provider_id)
        if not provider:
            return None

        commercial=provider.get("commercial_data")
        if not isinstance(commercial,dict):
            commercial={}

        verified=self.get_verified_provider_data(provider)
        option={
            "provider_id":provider_id,
            "provider_name":provider.get("name",provider_id),
            "enabled":bool(provider.get("enabled",True)),
            "official_urls":self.provider_urls(provider),
            "continue_url":self.provider_continue_url(provider),
            "payment_methods":deepcopy(provider.get("payment_methods",[])),
            "delivery_methods":deepcopy(provider.get("delivery_methods",[])),
            "methods_status":provider.get("methods_status","declared_not_commercially_verified"),
            "commercial_data_status":commercial.get("status","unavailable"),
            "commercial_data_verified":bool(verified)
        }

        if verified:
            for key in (
                "fee","exchange_rate","recipient_amount",
                "estimated_delivery","availability",
                "recipient_currency","important_condition",
                "source","verified_at"
            ):
                if key in verified:
                    option[key]=deepcopy(verified[key])
        return option

    def compare(self,request:ComparisonRequest)->ComparisonResponse:
        country=str(request.destination_country).upper().strip()
        language=self._language(request.language)

        if not self.is_supported_country(country):
            return ComparisonResponse(
                success=False,
                message=self._unsupported_country_message(country,language),
                destination_country=country,
                amount=request.amount,
                send_currency=request.send_currency,
                language=language
            )

        provider_ids=self.candidate_provider_ids(country)
        options=[]
        results=[]

        for provider_id in provider_ids:
            option=self.provider_public_option(provider_id)
            if not option:
                continue
            options.append(option)
            verified=self.get_verified_provider_data(self.providers[provider_id])
            if verified:
                result=ComparisonResult(
                    provider_id=provider_id,
                    provider_name=str(self.providers[provider_id].get("name",provider_id)),
                    amount_sent=request.amount,
                    send_currency=request.send_currency,
                    fee=verified.get("fee"),
                    exchange_rate=verified.get("exchange_rate"),
                    recipient_amount=verified.get("recipient_amount"),
                    delivery_method=request.delivery_method,
                    payment_method=request.payment_method,
                    estimated_delivery=verified.get("estimated_delivery"),
                    recipient_currency=verified.get("recipient_currency"),
                    availability=verified.get("availability"),
                    important_condition=verified.get("important_condition"),
                    requirements=verified.get("requirements",[]) if isinstance(verified.get("requirements",[]),list) else [],
                    source=verified.get("source"),
                    verified_at=verified.get("verified_at"),
                    status="verified",
                    continue_url=self.provider_continue_url(self.providers[provider_id])
                )
                results.append(result)

        explanation=self._comparison_explanation(
            language=language,
            country=country,
            count=len(options),
            verified_count=len(results)
        )

        return ComparisonResponse(
            success=True,
            message=None,
            results=results,
            available_providers=options,
            provider_count=len(options),
            verified_count=len(results),
            results_available=bool(results),
            destination_country=country,
            destination_name=self._country_name(country,language),
            amount=request.amount,
            send_currency=request.send_currency,
            priority=request.priority,
            urgency=request.urgency,
            frequency=request.frequency,
            language=language,
            explanation=explanation,
            differences=self._provider_differences(options,language),
            precautions=self._precautions(language)
        )

    def _comparison_explanation(self,language:str,country:str,count:int,verified_count:int)->str:
        name=self._country_name(country,language)
        if verified_count:
            if language=="en":
                return f"We found {verified_count} provider option(s) with commercial information marked as verified. Other catalog options may require checking the official site."
            return f"Encontramos {verified_count} opción(es) de proveedor con información comercial marcada como verificada. Las demás opciones del catálogo requieren revisar el sitio oficial."
        if language=="en":
            return f"The current catalog contains {count} provider option(s) for {name}, but there is no current commercial information verified by REMESAS. Review the official provider site before starting a transaction."
        return f"El catálogo actual contiene {count} opción(es) de proveedor para {name}, pero REMESAS no tiene información comercial actual verificada. Revisa el sitio oficial antes de iniciar una transacción."

    def _provider_differences(self,options:List[Dict[str,Any]],language:str)->List[Dict[str,Any]]:
        differences=[]
        for option in options:
            differences.append({
                "provider_id":option.get("provider_id"),
                "provider_name":option.get("provider_name"),
                "payment_methods":deepcopy(option.get("payment_methods",[])),
                "delivery_methods":deepcopy(option.get("delivery_methods",[])),
                "commercial_data_status":option.get("commercial_data_status"),
                "methods_status":option.get("methods_status")
            })
        return differences

    def _precautions(self,language:str)->List[str]:
        if language=="en":
            return [
                "Confirm the final fee and exchange rate on the official provider site.",
                "Confirm current availability for the destination and selected delivery method.",
                "Confirm the recipient's name and other transaction details before submitting.",
                "Do not enter passwords, CVV/security codes, bank-login credentials, or provider credentials into REMESAS."
            ]
        return [
            "Confirma la tarifa y la tasa final directamente en el sitio oficial del proveedor.",
            "Confirma la disponibilidad actual para el destino y el método de entrega seleccionado.",
            "Confirma el nombre del destinatario y los demás datos antes de enviar la transacción.",
            "No introduzcas contraseñas, CVV/códigos de seguridad, credenciales bancarias ni credenciales del proveedor en REMESAS."
        ]

    def compare_session(self,session_id:str)->Dict[str,Any]:
        session=self.sessions.get(session_id)
        if not session:
            return {"success":False,"message":"Session not found"}

        if session.get("need_type")!="remittance":
            return {"success":False,"message":"Session is not a remittance session"}

        amount=session.get("amount")
        country=session.get("destination_country")
        if not amount:
            return {"success":False,"message":"Amount is required"}
        if not country:
            return {"success":False,"message":"Destination country is required"}

        request=ComparisonRequest(
            amount=amount,
            destination_country=country,
            priority=session.get("priority"),
            urgency=session.get("urgency"),
            frequency=session.get("frequency"),
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            language=session.get("language","es"),
            send_currency="USD",
            recipient_amount_target=session.get("recipient_amount_target"),
            special_need=session.get("special_need")
        )
        response=self.compare(request)

        session["candidate_providers"]=[
            x.get("provider_id") for x in response.available_providers
        ]
        session["available_providers"]=deepcopy(response.available_providers)
        session["verified_results"]=[
            x.model_dump() for x in response.results
        ]
        session["selected_option"]=None
        session["final_check"]=None
        session["updated_at"]=self._now()

        return response.model_dump()

    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        session=self.sessions.get(session_id)
        if not session:
            return {"success":False,"message":"Session not found"}

        provider_id=str(provider_id or "").strip()
        if provider_id not in self.providers:
            return {"success":False,"message":"Provider not found"}

        candidate_ids=session.get("candidate_providers",[])
        if provider_id not in candidate_ids:
            return {
                "success":False,
                "message":"Provider is not available in the current catalog for this session."
            }

        option=self.provider_public_option(provider_id)
        if not option:
            return {"success":False,"message":"Provider information unavailable"}

        session["selected_option"]=deepcopy(option)
        session["final_check"]=None
        session["updated_at"]=self._now()

        return {
            "success":True,
            "session":deepcopy(session),
            "selected_option":deepcopy(option)
        }

    def final_check(self,request:FinalCheckRequest)->FinalCheckResponse:
        language=self._language(request.language)
        provider_id=str(request.provider_id).strip()
        provider=self.providers.get(provider_id)

        if not provider:
            return FinalCheckResponse(
                success=False,
                ready_to_continue=False,
                language=language,
                provider_id=provider_id,
                message="Provider not found."
            )

        checks=[]

        checks.append({
            "id":"provider",
            "label":"Proveedor" if language=="es" else "Provider",
            "ok":True,
            "message":"El proveedor pertenece al catálogo actual." if language=="es" else "The provider belongs to the current catalog."
        })

        country_ok=self.is_supported_country(request.destination_country)
        checks.append({
            "id":"destination",
            "label":"Destino" if language=="es" else "Destination",
            "ok":country_ok,
            "message":(
                "El país está en el catálogo actual."
                if country_ok and language=="es"
                else "The country is in the current catalog."
                if country_ok
                else "El país no está en el catálogo actual."
                if language=="es"
                else "The country is not in the current catalog."
            )
        })

        amount_ok=0<request.amount<=MAX_AMOUNT
        checks.append({
            "id":"amount",
            "label":"Monto" if language=="es" else "Amount",
            "ok":amount_ok,
            "message":(
                "El monto está dentro del límite de la aplicación."
                if amount_ok and language=="es"
                else "The amount is within the application limit."
                if amount_ok
                else "El monto no es válido."
                if language=="es"
                else "The amount is not valid."
            )
        })

        currency_ok=request.send_currency.upper()=="USD"
        checks.append({
            "id":"currency",
            "label":"Moneda de envío" if language=="es" else "Sending currency",
            "ok":currency_ok,
            "message":(
                "La aplicación está configurada para enviar desde USD."
                if currency_ok and language=="es"
                else "The application is configured for sending from USD."
                if currency_ok
                else "La moneda de envío indicada no coincide con USD."
                if language=="es"
                else "The indicated sending currency does not match USD."
            )
        })

        url=self.provider_continue_url(provider)
        url_ok=bool(url)
        checks.append({
            "id":"official_url",
            "label":"Sitio oficial" if language=="es" else "Official site",
            "ok":url_ok,
            "message":(
                "Existe un enlace HTTPS del proveedor."
                if url_ok and language=="es"
                else "An HTTPS provider link is available."
                if url_ok
                else "No hay un enlace HTTPS válido configurado."
                if language=="es"
                else "No valid HTTPS provider link is configured."
            )
        })

        candidate=self.candidate_provider_ids(request.destination_country)
        corridor_ok=provider_id in candidate
        checks.append({
            "id":"corridor",
            "label":"Catálogo del destino" if language=="es" else "Destination catalog",
            "ok":corridor_ok,
            "message":(
                "El proveedor aparece como candidato en el catálogo del destino; esto no confirma disponibilidad para una transacción."
                if corridor_ok and language=="es"
                else "The provider appears as a candidate in the destination catalog; this does not confirm transaction availability."
                if corridor_ok
                else "El proveedor no aparece como candidato para este destino."
                if language=="es"
                else "The provider is not listed as a candidate for this destination."
            )
        })

        ready=all(bool(check["ok"]) for check in checks)

        if language=="en":
            message=(
                "The basic review is complete. REMESAS does not execute the transfer. "
                "Before continuing, confirm the final fee, exchange rate, delivery time, "
                "availability, requirements, and recipient information directly with the provider."
            )
        else:
            message=(
                "La revisión básica está completa. REMESAS no ejecuta la remesa. "
                "Antes de continuar, confirma directamente con el proveedor la tarifa final, "
                "tasa de cambio, tiempo de entrega, disponibilidad, requisitos y datos del destinatario."
            )

        response=FinalCheckResponse(
            success=True,
            ready_to_continue=ready,
            language=language,
            provider_id=provider_id,
            checks=checks,
            message=message,
            precautions=self._precautions(language),
            requirements=[]
        )
        return response

    def final_check_session(self,session_id:str)->Dict[str,Any]:
        session=self.sessions.get(session_id)
        if not session:
            return {"success":False,"message":"Session not found"}

        option=session.get("selected_option")
        if not option:
            return {"success":False,"message":"No provider selected"}

        request=FinalCheckRequest(
            language=session.get("language","es"),
            provider_id=option.get("provider_id"),
            amount=float(session.get("amount") or 0),
            send_currency="USD",
            destination_country=session.get("destination_country") or "",
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            recipient_amount=None
        )
        response=self.final_check(request)
        session["final_check"]=response.model_dump()
        session["updated_at"]=self._now()
        return response.model_dump()

    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        topics=self.brain.get("help_topics",[])
        language=self._language(language)
        if not isinstance(topics,list):
            return []
        output=[]
        for topic in topics:
            if not isinstance(topic,dict):
                continue
            title=topic.get("title","")
            answer=topic.get("answer","")
            if isinstance(title,dict):
                title=title.get(language) or title.get("es") or title.get("en") or ""
            if isinstance(answer,dict):
                answer=answer.get(language) or answer.get("es") or answer.get("en") or ""
            output.append({
                "id":topic.get("id"),
                "title":str(title),
                "answer":str(answer)
            })
        return output

    def assistant_response(self,request:ParseNeedRequest)->Dict[str,Any]:
        parsed=self.parse_need(request)
        return {
            "success":True,
            "assistant":parsed.get("assistant",""),
            "parsed":parsed.get("parsed",{}),
            "language":self._language(request.language)
        }

    def calculate_money_plan(self,data:Dict[str,Any])->Dict[str,Any]:
        def factor(freq:Optional[str])->float:
            freq=(freq or "monthly").lower()
            if freq=="weekly":
                return 52/12
            if freq=="biweekly":
                return 26/12
            return 1.0

        income=float(data.get("income_amount") or 0)
        income_frequency=data.get("income_frequency") or "monthly"
        other_income=float(data.get("other_income") or 0)

        monthly_income=income*factor(income_frequency)
        monthly_other=other_income*factor(income_frequency)

        def normalize_expenses(items:Any)->float:
            total=0.0
            if not isinstance(items,list):
                return total
            for item in items:
                if not isinstance(item,dict):
                    continue
                amount=float(item.get("amount") or 0)
                freq=item.get("frequency") or "monthly"
                total+=amount*factor(freq)
            return total

        essential=normalize_expenses(data.get("essential_expenses",[]))
        flexible=normalize_expenses(data.get("flexible_expenses",[]))
        remittance=float(data.get("remittance_amount") or 0)
        savings=float(data.get("savings_amount") or 0)

        available=(
            monthly_income+
            monthly_other-
            essential-
            flexible-
            remittance-
            savings
        )

        return {
            "success":True,
            "monthly_income":round(monthly_income,2),
            "monthly_other_income":round(monthly_other,2),
            "essential_expenses":round(essential,2),
            "flexible_expenses":round(flexible,2),
            "remittance":round(remittance,2),
            "savings":round(savings,2),
            "available":round(available,2),
            "balanced":available>=0,
            "calculated_at":self._now()
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=self._language(language)

        app_config=deepcopy(self.brain.get("app",{}))
        experience=deepcopy(self.brain.get("experience",{}))
        opening=deepcopy(self.brain.get("opening",{}))
        kernel=deepcopy(self.brain.get("kernel",{}))
        comparison=deepcopy(self.brain.get("comparison",{}))
        validation=deepcopy(self.brain.get("validation",{}))
        security=deepcopy(self.brain.get("security",{}))
        privacy=deepcopy(self.brain.get("privacy",{}))

        countries=[]
        brain_countries=self.brain.get("countries",[])
        if isinstance(brain_countries,list):
            for country in brain_countries:
                if not isinstance(country,dict):
                    continue
                countries.append(deepcopy(country))

        payment_methods=self.brain.get("payment_methods",[])
        delivery_methods=self.brain.get("delivery_methods",[])

        if not isinstance(payment_methods,list):
            payment_methods=[]
        if not isinstance(delivery_methods,list):
            delivery_methods=[]

        return {
            "success":True,
            "app":app_config,
            "experience":experience,
            "opening":opening,
            "kernel":kernel,
            "comparison":comparison,
            "validation":validation,
            "security":security,
            "privacy":privacy,
            "countries":countries,
            "providers":[self.provider_public_option(pid) for pid in self.providers],
            "provider_count":len(self.providers),
            "payment_methods":deepcopy(payment_methods),
            "delivery_methods":deepcopy(delivery_methods),
            "help_topics":self.help_topics(language),
            "languages":deepcopy(self.brain.get("languages",{})),
            "language":language,
            "flow":deepcopy(self.brain.get("flow",self.brain.get("conversation_logic",{}))),
            "money_planner":deepcopy(self.brain.get("money_planner",{})),
            "messages":deepcopy(self.brain.get("messages",{}))
        }
