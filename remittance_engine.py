# remittance_engine.py — REMESAS | May Roga LLC
import json,re,secrets
from copy import deepcopy
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional

from schemas import ComparisonRequest,FinalCheckRequest,ParseNeedRequest,UserNeedRequest

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_FILE=DATA_DIR/"app_brain.json"
PROVIDERS_FILE=DATA_DIR/"providers.json"

SUPPORTED_PROVIDERS=("western_union","moneygram","remitly","xoom")

class RemittanceEngine:
    def __init__(self):
        self.brain={}
        self.providers_data={}
        self.sessions={}
        self.brain_loaded=False
        self.providers_loaded=False

    # ---------------------------------------------------------
    # JSON
    # ---------------------------------------------------------
    def _read_json(self,path:Path)->Dict[str,Any]:
        if not path.exists():
            raise FileNotFoundError(f"Required data file not found: {path.name}")
        try:
            with path.open("r",encoding="utf-8") as f:
                data=json.load(f)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"{path.name} contains invalid JSON at line {exc.lineno}, column {exc.colno}."
            ) from exc
        if not isinstance(data,dict):
            raise RuntimeError(f"{path.name} must contain a JSON object.")
        return data

    def load_brain(self)->Dict[str,Any]:
        self.brain=self._read_json(BRAIN_FILE)
        self.brain_loaded=True
        return self.brain

    def load_providers(self)->Dict[str,Any]:
        self.providers_data=self._read_json(PROVIDERS_FILE)
        self.providers_loaded=True
        return self.providers_data

    def _ensure_loaded(self):
        if not self.brain_loaded:self.load_brain()
        if not self.providers_loaded:self.load_providers()

    # ---------------------------------------------------------
    # HELPERS
    # ---------------------------------------------------------
    def _now(self)->str:
        return datetime.now(timezone.utc).isoformat()

    def _language(self,language:Optional[str])->str:
        return "en" if str(language or "es").lower().strip()=="en" else "es"

    def _localized(self,value:Any,language:str,default:str="")->str:
        if isinstance(value,str):return value
        if isinstance(value,dict):
            return str(value.get(language) or value.get("es") or value.get("en") or default)
        return default

    def _name(self,obj:Dict[str,Any],language:str)->str:
        return self._localized(obj.get("name"),language,str(obj.get("id") or ""))

    def _label(self,obj:Dict[str,Any],language:str)->str:
        return self._localized(obj.get("label"),language,str(obj.get("id") or ""))

    def _provider_records(self)->List[Dict[str,Any]]:
        self._ensure_loaded()
        raw=self.providers_data

        candidates=[]
        if isinstance(raw.get("providers"),list):
            candidates=raw["providers"]
        elif isinstance(raw.get("providers"),dict):
            for pid,item in raw["providers"].items():
                if isinstance(item,dict):
                    x=deepcopy(item)
                    x.setdefault("id",pid)
                    candidates.append(x)

        if not candidates:
            for pid in SUPPORTED_PROVIDERS:
                item=raw.get(pid)
                if isinstance(item,dict):
                    x=deepcopy(item)
                    x.setdefault("id",pid)
                    candidates.append(x)

        result=[]
        seen=set()
        for item in candidates:
            if not isinstance(item,dict):continue
            pid=str(item.get("id") or item.get("provider_id") or "").strip()
            if not pid or pid in seen:continue
            seen.add(pid)
            x=deepcopy(item)
            x["id"]=pid
            result.append(x)

        return result

    def _provider_by_id(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=str(provider_id or "").strip().lower()
        for item in self._provider_records():
            if str(item.get("id","")).lower()==pid:return item
        return None

    def _brain_providers(self)->List[Dict[str,Any]]:
        self._ensure_loaded()
        p=self.brain.get("providers",[])
        if isinstance(p,list):return p
        if isinstance(p,dict):
            out=[]
            for pid,item in p.items():
                if isinstance(item,dict):
                    x=deepcopy(item)
                    x.setdefault("id",pid)
                    out.append(x)
            return out
        return []

    def _brain_provider(self,provider_id:str)->Dict[str,Any]:
        pid=str(provider_id or "").strip().lower()
        for item in self._brain_providers():
            if str(item.get("id") or item.get("provider_id") or "").lower()==pid:
                return item
        return {}

    def _country_records(self)->List[Dict[str,Any]]:
        self._ensure_loaded()
        countries=self.brain.get("countries",{})

        initial=countries.get("initial_supported",[])
        names=countries.get("country_names",{})

        result=[]
        if isinstance(initial,list):
            for code in initial:
                code=str(code).upper()
                name=names.get(code) if isinstance(names,dict) else None
                if isinstance(name,dict):
                    name=name.get("es") or name.get("en") or code
                result.append({"id":code,"name":str(name or code)})
        elif isinstance(initial,dict):
            for code,item in initial.items():
                name=self._localized(item,"es",str(code)) if isinstance(item,(dict,str)) else str(code)
                result.append({"id":str(code).upper(),"name":name})

        if not result and isinstance(names,dict):
            for code,name in names.items():
                result.append({
                    "id":str(code).upper(),
                    "name":self._localized(name,"es",str(code))
                })

        return result

    def _country_name(self,code:str,language:str="es")->str:
        code=str(code or "").upper()
        for item in self._country_records():
            if str(item.get("id")).upper()==code:
                return item.get("name",code)
        return code

    def _country_supported(self,provider:Dict[str,Any],country:str)->bool:
        code=str(country or "").upper()
        if not code:return False

        corridors=provider.get("corridors")
        if isinstance(corridors,dict):
            destinations=corridors.get("destinations")
            if isinstance(destinations,list):
                vals=[]
                for x in destinations:
                    if isinstance(x,str):vals.append(x.upper())
                    elif isinstance(x,dict):
                        vals.append(str(x.get("id") or x.get("country") or "").upper())
                if vals:return code in vals

            if code in corridors:return True

        if isinstance(corridors,list):
            vals=[]
            for x in corridors:
                if isinstance(x,str):vals.append(x.upper())
                elif isinstance(x,dict):
                    vals.append(str(x.get("id") or x.get("country") or "").upper())
            if vals:return code in vals

        supported=provider.get("supported_countries")
        if isinstance(supported,list):
            vals=[str(x).upper() for x in supported]
            return code in vals

        return False

    def _official_url(self,provider:Dict[str,Any])->str:
        for key in ("official_site","official_url","continue_url","url","website"):
            value=provider.get(key)
            if isinstance(value,str) and value.startswith(("http://","https://")):
                return value

        urls=self.providers_data.get("official_urls",{})
        if isinstance(urls,dict):
            value=urls.get(provider.get("id"))
            if isinstance(value,str) and value.startswith(("http://","https://")):
                return value

        return ""

    def _commercial(self,provider:Dict[str,Any],country:str)->Dict[str,Any]:
        """
        Commercial information is accepted only when explicitly marked
        as verified/current by the data source.
        """
        commercial=provider.get("commercial_data")

        if commercial is None:
            commercial=self.providers_data.get("commercial_data",{})
            if isinstance(commercial,dict):
                commercial=commercial.get(provider.get("id"),{})

        if not isinstance(commercial,dict):
            return {}

        country_code=str(country or "").upper()

        if country_code in commercial and isinstance(commercial[country_code],dict):
            return commercial[country_code]

        corridors=commercial.get("corridors")
        if isinstance(corridors,dict):
            item=corridors.get(country_code)
            if isinstance(item,dict):return item

        return commercial

    def _is_verified(self,data:Dict[str,Any])->bool:
        if not isinstance(data,dict):return False

        if data.get("verified") is True:return True
        if data.get("is_verified") is True:return True

        status=str(data.get("status") or "").lower().strip()
        if status in {"verified","current","live"}:return True

        return False

    def _verification_date(self,data:Dict[str,Any])->Optional[str]:
        for key in ("verified_at","last_verified","updated_at","effective_at"):
            value=data.get(key)
            if value is not None:return str(value)
        return None

    def _first(self,d:Dict[str,Any],*keys):
        for key in keys:
            if key in d and d[key] is not None:return d[key]
        return None

    def _as_float(self,value):
        try:
            if value is None or value=="":return None
            return float(value)
        except (TypeError,ValueError):
            return None

    # ---------------------------------------------------------
    # PUBLIC CONFIG
    # ---------------------------------------------------------
    def public_config(self,language:str="es")->Dict[str,Any]:
        self._ensure_loaded()
        language=self._language(language)

        providers=[]
        for p in self._provider_records():
            pid=str(p.get("id",""))
            brain=self._brain_provider(pid)
            providers.append({
                "provider_id":pid,
                "provider_name":self._localized(
                    p.get("name") or brain.get("name"),
                    language,
                    pid
                ),
                "description":self._localized(
                    p.get("description") or brain.get("description"),
                    language,
                    ""
                ),
                "continue_url":self._official_url(p),
                "supported":True
            })

        countries=[]
        names=self.brain.get("countries",{}).get("country_names",{})
        for item in self._country_records():
            code=item["id"]
            value=names.get(code) if isinstance(names,dict) else None
            countries.append({
                "id":code,
                "name":self._localized(value,language,item["name"])
            })

        delivery=self.brain.get("delivery_methods",[])
        payment=self.brain.get("payment_methods",[])

        return {
            "app":deepcopy(self.brain.get("app",{})),
            "language":language,
            "providers":providers,
            "countries":countries,
            "delivery_methods":self._localized_list(delivery,language),
            "payment_methods":self._localized_list(payment,language),
            "official_urls":deepcopy(self.brain.get("official_urls",{})),
            "privacy":deepcopy(self.brain.get("privacy",{}))
        }

    def _localized_list(self,items,language)->List[Dict[str,Any]]:
        if not isinstance(items,list):return []
        out=[]
        for item in items:
            if isinstance(item,str):
                out.append({"id":item,"label":item})
            elif isinstance(item,dict):
                x=deepcopy(item)
                if "label" in x:x["label"]=self._localized(x["label"],language,str(x.get("id","")))
                if "name" in x:x["name"]=self._localized(x["name"],language,str(x.get("id","")))
                out.append(x)
        return out

    # ---------------------------------------------------------
    # SESSIONS
    # ---------------------------------------------------------
    def create_session(self,language:str="es")->Dict[str,Any]:
        language=self._language(language)
        sid=secrets.token_urlsafe(24).replace("-","_")
        session={
            "session_id":sid,
            "created_at":self._now(),
            "updated_at":self._now(),
            "language":language,
            "need_type":None,
            "amount":None,
            "send_currency":"USD",
            "destination_country":None,
            "destination_region":None,
            "priority":None,
            "urgency":None,
            "delivery_method":None,
            "payment_method":None,
            "recipient_amount_target":None,
            "special_need":None,
            "free_text":None,
            "selected_option":None,
            "parsed_user_need":None
        }
        self.sessions[sid]=session
        return deepcopy(session)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        session=self.sessions.get(session_id)
        return deepcopy(session) if session else None

    def update_session(self,session_id:str,**values)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")
        session=self.sessions[session_id]
        for key,value in values.items():
            if key in session or key in {
                "parsed_user_need","free_text","need_type","amount",
                "destination_country","destination_region","priority",
                "urgency","delivery_method","payment_method",
                "recipient_amount_target","special_need"
            }:
                session[key]=value
        session["updated_at"]=self._now()
        return deepcopy(session)

    def clear_session(self,session_id:str)->bool:
        return self.sessions.pop(session_id,None) is not None

    def apply_need(self,session_id:str,request:UserNeedRequest)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")

        values=request.model_dump(exclude_none=True)
        values.pop("language",None)
        self.sessions[session_id].update(values)
        self.sessions[session_id]["language"]=self._language(request.language)
        self.sessions[session_id]["updated_at"]=self._now()
        return deepcopy(self.sessions[session_id])

    # ---------------------------------------------------------
    # PROVIDERS
    # ---------------------------------------------------------
    def provider_public_option(self,provider_id:str,country:str="",language:str="es")->Optional[Dict[str,Any]]:
        self._ensure_loaded()
        language=self._language(language)
        provider=self._provider_by_id(provider_id)
        if not provider:return None

        pid=provider["id"]
        brain=self._brain_provider(pid)

        return {
            "provider_id":pid,
            "provider_name":self._localized(
                provider.get("name") or brain.get("name"),
                language,
                pid
            ),
            "description":self._localized(
                provider.get("description") or brain.get("description"),
                language,
                ""
            ),
            "country":str(country or "").upper() or None,
            "available_for_country":self._country_supported(provider,country) if country else None,
            "continue_url":self._official_url(provider),
            "official_site":self._official_url(provider)
        }

    def provider_requirements(self,provider_id:str,language:str="es")->List[str]:
        provider=self._provider_by_id(provider_id)
        if not provider:return []

        req=provider.get("requirements")
        if req is None:
            req=self._brain_provider(provider_id).get("requirements",[])

        if isinstance(req,dict):
            req=req.get(language) or req.get("es") or req.get("en") or []

        if not isinstance(req,list):return [str(req)]

        result=[]
        for x in req:
            if isinstance(x,str):result.append(x)
            elif isinstance(x,dict):
                result.append(self._localized(x.get("label") or x.get("name"),language,""))
        return [x for x in result if x]

    # ---------------------------------------------------------
    # NEED PARSER
    # ---------------------------------------------------------
    def parse_need(self,request:ParseNeedRequest)->Dict[str,Any]:
        text=(request.text or "").strip()
        lower=text.lower()

        need_type="other"

        remittance_terms=[
            "remesa","remesas","enviar dinero","mandar dinero",
            "send money","transfer money","money transfer",
            "familia","familiar","recipient","recibir dinero"
        ]
        fee_terms=["comisión","comisiones","fee","fees","costo","cost","charge","charges"]
        rate_terms=["tasa","cambio","exchange rate","tipo de cambio"]
        req_terms=["requisito","requisitos","identificación","identificacion","id","requirements","document"]
        security_terms=["seguro","seguridad","fraude","estafa","scam","security","password","contraseña"]
        cancel_terms=["cancelar","cancelación","cancelacion","cancel","refund","reembolso"]
        recipient_terms=["recibe","recibir","recipient","gets","cuánto recibe","cuanto recibe"]

        if any(x in lower for x in remittance_terms):
            need_type="remittance"
        elif any(x in lower for x in fee_terms):
            need_type="fees"
        elif any(x in lower for x in rate_terms):
            need_type="exchange_rate"
        elif any(x in lower for x in req_terms):
            need_type="requirements"
        elif any(x in lower for x in security_terms):
            need_type="security"
        elif any(x in lower for x in cancel_terms):
            need_type="cancellation"
        elif any(x in lower for x in recipient_terms):
            need_type="recipient_information"

        amount=self._extract_amount(text)
        country=self._extract_country(text)

        priority=None
        if any(x in lower for x in ["rápido","rapido","urgente","hoy","fast","urgent","today"]):
            priority="fastest"
        elif any(x in lower for x in ["barato","económico","economico","ahorrar","cost","cheap"]):
            priority="save"
        elif any(x in lower for x in ["recibe más","recibe mas","more","recipient gets"]):
            priority="recipient_gets_more"

        return {
            "need_type":need_type,
            "amount":amount,
            "destination_country":country,
            "priority":priority,
            "urgency":bool(priority=="fastest"),
            "delivery_method":None,
            "payment_method":None,
            "special_need":None,
            "raw_text":text
        }

    def _extract_amount(self,text:str)->Optional[float]:
        patterns=[
            r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
            r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:usd|dólares|dolares|dollars)"
        ]
        for pattern in patterns:
            match=re.search(pattern,text.lower())
            if match:
                try:return float(match.group(1).replace(",",""))
                except ValueError:pass
        return None

    def _extract_country(self,text:str)->Optional[str]:
        lower=text.lower()

        countries=self._country_records()
        names=self.brain.get("countries",{}).get("country_names",{})

        for item in countries:
            code=str(item.get("id","")).upper()
            if re.search(r"\b"+re.escape(code.lower())+r"\b",lower):
                return code

            raw=names.get(code) if isinstance(names,dict) else None
            variants=[]
            if isinstance(raw,str):variants=[raw]
            elif isinstance(raw,dict):
                variants=list(raw.values())

            for name in variants:
                if name and str(name).lower() in lower:
                    return code

        aliases={
            "mexico":"MX","méxico":"MX",
            "cuba":"CU",
            "dominican republic":"DO","república dominicana":"DO",
            "colombia":"CO",
            "guatemala":"GT",
            "honduras":"HN",
            "el salvador":"SV",
            "nicaragua":"NI",
            "venezuela":"VE",
            "ecuador":"EC",
            "peru":"PE","perú":"PE",
            "brazil":"BR","brasil":"BR",
            "haiti":"HT",
            "jamaica":"JM"
        }

        for name,code in aliases.items():
            if name in lower:return code

        return None

    def assistant_response(self,need_type:str,language:str="es",text:str="")->Dict[str,Any]:
        language=self._language(language)
        messages={
            "remittance":{
                "es":"Parece que necesitas enviar dinero. Podemos comparar las opciones disponibles sin asumir una tarifa o tasa que no esté verificada.",
                "en":"It looks like you need to send money. We can compare the available options without assuming an unverified fee or exchange rate."
            },
            "fees":{
                "es":"La comisión es solo una parte del costo. También importa la tasa de cambio y cuánto termina recibiendo la otra persona.",
                "en":"The fee is only one part of the cost. The exchange rate and what the other person actually receives also matter."
            },
            "exchange_rate":{
                "es":"La tasa de cambio puede cambiar el resultado aunque la comisión parezca baja. Conviene revisar cuánto recibe realmente el destinatario.",
                "en":"The exchange rate can change the result even when the fee looks low. It is useful to review what the recipient actually receives."
            },
            "requirements":{
                "es":"Los requisitos dependen del proveedor, país, método y operación. Revisa siempre los requisitos finales en el sitio oficial.",
                "en":"Requirements depend on the provider, country, method and transaction. Always review the final requirements on the official site."
            },
            "security":{
                "es":"Nunca escribas aquí contraseñas, CVV, códigos de seguridad ni credenciales de una remesadora.",
                "en":"Never enter passwords, CVV numbers, security codes or remittance-provider credentials here."
            },
            "cancellation":{
                "es":"Una cancelación o devolución depende del estado de la operación y de las condiciones del proveedor. Revisa la operación directamente con el proveedor.",
                "en":"A cancellation or refund depends on the transaction status and the provider's terms. Review the transaction directly with the provider."
            },
            "recipient_information":{
                "es":"Para comparar una remesa, además de lo que tú envías, importa cuánto termina recibiendo la otra persona.",
                "en":"For a remittance comparison, what the other person ultimately receives matters in addition to what you send."
            },
            "other":{
                "es":"Puedo ayudarte a identificar qué necesitas antes de mostrarte opciones. Puedes escribirlo con tus propias palabras.",
                "en":"I can help identify what you need before showing options. You can describe it in your own words."
            }
        }

        return {
            "need_type":need_type,
            "message":messages.get(need_type,messages["other"])[language],
            "text":text
        }

    # ---------------------------------------------------------
    # HELP
    # ---------------------------------------------------------
    def help_topics(self,language:str="es")->List[Dict[str,Any]]:
        language=self._language(language)

        brain_help=self.brain.get("help",{})
        if isinstance(brain_help,dict):
            topics=brain_help.get("topics")
            if isinstance(topics,list):
                return self._localized_list(topics,language)

        topics=[
            {
                "id":"fees",
                "label":{"es":"Comisiones","en":"Fees"},
                "answer":{
                    "es":"La comisión es el cargo que puede aplicar un proveedor. No siempre representa el costo total: también debes revisar la tasa de cambio y cuánto recibe el destinatario.",
                    "en":"A fee is a charge a provider may apply. It does not always represent the total cost: you should also review the exchange rate and how much the recipient receives."
                }
            },
            {
                "id":"exchange_rate",
                "label":{"es":"Tasa de cambio","en":"Exchange rate"},
                "answer":{
                    "es":"La tasa indica cuánto dinero de la moneda de envío se convierte a la moneda de destino. Puede cambiar y debe comprobarse en el proveedor.",
                    "en":"The exchange rate indicates how the sending currency is converted into the destination currency. It can change and should be checked with the provider."
                }
            },
            {
                "id":"identification",
                "label":{"es":"Identificación y requisitos","en":"Identification and requirements"},
                "answer":{
                    "es":"Los documentos y requisitos dependen del proveedor, país, método y operación. Esta aplicación no sustituye las instrucciones oficiales.",
                    "en":"Documents and requirements depend on the provider, country, method and transaction. This application does not replace official instructions."
                }
            },
            {
                "id":"security",
                "label":{"es":"Seguridad","en":"Security"},
                "answer":{
                    "es":"No escribas contraseñas, CVV, códigos de seguridad ni credenciales en esta aplicación. Usa el sitio oficial del proveedor para esos datos.",
                    "en":"Do not enter passwords, CVV numbers, security codes or credentials in this application. Use the provider's official site for those details."
                }
            },
            {
                "id":"mistake",
                "label":{"es":"Evitar errores","en":"Avoid mistakes"},
                "answer":{
                    "es":"Antes de confirmar, revisa país, cantidad, moneda, nombre del destinatario, método de entrega y forma de pago.",
                    "en":"Before confirming, review the country, amount, currency, recipient name, delivery method and payment method."
                }
            },
            {
                "id":"cancellation",
                "label":{"es":"Cancelación","en":"Cancellation"},
                "answer":{
                    "es":"Las reglas de cancelación dependen del proveedor y del estado de la operación. Comprueba las condiciones oficiales antes de actuar.",
                    "en":"Cancellation rules depend on the provider and transaction status. Check the official terms before acting."
                }
            },
            {
                "id":"recipient_amount",
                "label":{"es":"Cuánto recibe la otra persona","en":"How much the recipient gets"},
                "answer":{
                    "es":"Para comparar una remesa correctamente, no mires solamente la comisión. Revisa cuánto recibe finalmente la otra persona.",
                    "en":"To compare a remittance correctly, do not look only at the fee. Review how much the other person ultimately receives."
                }
            }
        ]

        return self._localized_list(topics,language)

    # ---------------------------------------------------------
    # COMPARISON
    # ---------------------------------------------------------
    def compare(self,request:ComparisonRequest)->Dict[str,Any]:
        self._ensure_loaded()
        language=self._language(request.language)
        country=str(request.destination_country or "").upper()
        amount=float(request.amount)

        records=self._provider_records()
        available=[]
        results=[]
        verified_results=[]

        for provider in records:
            pid=str(provider.get("id",""))
            if pid not in SUPPORTED_PROVIDERS:
                continue

            brain=self._brain_provider(pid)
            provider_name=self._localized(
                provider.get("name") or brain.get("name"),
                language,
                pid
            )

            supported=self._country_supported(provider,country)
            url=self._official_url(provider)

            if not supported:
                continue

            available.append({
                "provider_id":pid,
                "provider_name":provider_name,
                "continue_url":url,
                "supported":True
            })

            commercial=self._commercial(provider,country)
            verified=self._is_verified(commercial)

            result={
                "provider_id":pid,
                "provider_name":provider_name,
                "amount_sent":amount,
                "send_currency":request.send_currency or "USD",
                "fee":None,
                "exchange_rate":None,
                "recipient_amount":None,
                "delivery_method":request.delivery_method,
                "payment_method":request.payment_method,
                "estimated_delivery":None,
                "recipient_currency":None,
                "availability":True,
                "important_condition":None,
                "requirements":self.provider_requirements(pid,language),
                "source":commercial.get("source") if isinstance(commercial,dict) else None,
                "verified_at":self._verification_date(commercial),
                "status":"verified" if verified else "unverified",
                "continue_url":url
            }

            if verified:
                result["fee"]=self._as_float(
                    self._first(commercial,"fee","fee_amount","commission")
                )
                result["exchange_rate"]=self._as_float(
                    self._first(commercial,"exchange_rate","rate")
                )
                result["recipient_amount"]=self._as_float(
                    self._first(commercial,"recipient_amount","recipient_gets")
                )
                result["estimated_delivery"]=self._first(
                    commercial,"estimated_delivery","delivery_time","delivery"
                )
                result["recipient_currency"]=self._first(
                    commercial,"recipient_currency","receive_currency"
                )
                result["delivery_method"]=self._first(
                    commercial,"delivery_method","delivery_method_id"
                ) or result["delivery_method"]
                result["payment_method"]=self._first(
                    commercial,"payment_method","payment_method_id"
                ) or result["payment_method"]
                result["important_condition"]=self._localized(
                    commercial.get("important_condition"),
                    language,
                    ""
                )
                verified_results.append(result)

            results.append(result)

        explanation=self._comparison_explanation(
            language,
            amount,
            country,
            len(available),
            len(verified_results)
        )

        differences=self._differences(verified_results,language)
        precautions=self._precautions(language,request)

        return {
            "success":True,
            "message":None,
            "results":results,
            "available_providers":available,
            "provider_count":len(available),
            "verified_count":len(verified_results),
            "results_available":bool(verified_results),
            "destination_country":country,
            "destination_name":self._country_name(country,language),
            "amount":amount,
            "send_currency":request.send_currency or "USD",
            "priority":request.priority,
            "language":language,
            "explanation":explanation,
            "differences":differences,
            "precautions":precautions
        }

    def compare_session(self,session_id:str)->Dict[str,Any]:
        session=self.sessions.get(session_id)
        if not session:raise KeyError("session_expired")

        request=ComparisonRequest(
            amount=float(session.get("amount") or 0),
            destination_country=str(session.get("destination_country") or ""),
            priority=session.get("priority"),
            urgency=session.get("urgency"),
            delivery_method=session.get("delivery_method"),
            payment_method=session.get("payment_method"),
            language=session.get("language","es"),
            send_currency=session.get("send_currency","USD"),
            recipient_amount_target=session.get("recipient_amount_target"),
            special_need=session.get("special_need")
        )

        return self.compare(request)

    def _comparison_explanation(
        self,
        language:str,
        amount:float,
        country:str,
        provider_count:int,
        verified_count:int
    )->str:
        if language=="en":
            if not provider_count:
                return f"We could not identify a supported provider for {country} in the current data."
            if not verified_count:
                return (
                    f"We identified {provider_count} available provider option(s) for "
                    f"{country}, but current commercial prices are not verified. "
                    "We therefore do not invent fees, exchange rates, delivery times or recipient amounts."
                )
            return (
                f"We identified {provider_count} provider option(s) for {country}. "
                f"{verified_count} currently have commercial data marked as verified in the data source."
            )

        if not provider_count:
            return f"No encontramos un proveedor compatible con {country} en los datos actuales."

        if not verified_count:
            return (
                f"Encontramos {provider_count} opción(es) disponibles para {country}, "
                "pero los datos comerciales actuales no están verificados. "
                "Por eso no inventamos comisiones, tasas, tiempos de entrega ni cantidades recibidas."
            )

        return (
            f"Encontramos {provider_count} opción(es) para {country}. "
            f"{verified_count} tienen datos comerciales marcados como verificados en la fuente de datos."
        )

    def _differences(self,results:List[Dict[str,Any]],language:str)->List[Dict[str,Any]]:
        if len(results)<2:return []

        fields=[
            ("fee","Comisión","Fee"),
            ("exchange_rate","Tasa de cambio","Exchange rate"),
            ("recipient_amount","Cantidad recibida","Recipient amount"),
            ("estimated_delivery","Entrega estimada","Estimated delivery")
        ]

        output=[]
        for field,es,en in fields:
            values=[]
            for r in results:
                value=r.get(field)
                if value is not None:
                    values.append({
                        "provider_id":r["provider_id"],
                        "provider_name":r["provider_name"],
                        "value":value
                    })
            if len(values)>=2:
                output.append({
                    "id":field,
                    "label":en if language=="en" else es,
                    "values":values
                })

        return output

    def _precautions(self,language:str,request:ComparisonRequest)->List[str]:
        if language=="en":
            return [
                "Provider prices, exchange rates and delivery estimates can change.",
                "Confirm the final amount, fee, exchange rate and recipient amount on the official provider site.",
                "Do not enter passwords, CVV numbers or security codes in this application."
            ]

        return [
            "Las comisiones, tasas y tiempos de entrega pueden cambiar.",
            "Confirma la cantidad final, comisión, tasa de cambio y cantidad recibida en el sitio oficial del proveedor.",
            "No escribas contraseñas, CVV ni códigos de seguridad en esta aplicación."
        ]

    # ---------------------------------------------------------
    # SELECTION
    # ---------------------------------------------------------
    def select_provider(self,session_id:str,provider_id:str)->Dict[str,Any]:
        if session_id not in self.sessions:raise KeyError("session_expired")

        session=self.sessions[session_id]
        country=str(session.get("destination_country") or "").upper()

        provider=self._provider_by_id(provider_id)
        if not provider:raise KeyError("provider_not_found")
        if country and not self._country_supported(provider,country):
            raise KeyError("provider_not_available")

        language=session.get("language","es")
        brain=self._brain_provider(provider_id)
        name=self._localized(
            provider.get("name") or brain.get("name"),
            language,
            provider_id
        )

        commercial=self._commercial(provider,country)
        verified=self._is_verified(commercial)

        option={
            "provider_id":provider_id,
            "provider_name":name,
            "continue_url":self._official_url(provider),
            "delivery_method":session.get("delivery_method"),
            "payment_method":session.get("payment_method"),
            "fee":None,
            "exchange_rate":None,
            "recipient_amount":None,
            "recipient_currency":None,
            "estimated_delivery":None,
            "verified":verified,
            "status":"verified" if verified else "unverified"
        }

        if verified:
            option["fee"]=self._as_float(
                self._first(commercial,"fee","fee_amount","commission")
            )
            option["exchange_rate"]=self._as_float(
                self._first(commercial,"exchange_rate","rate")
            )
            option["recipient_amount"]=self._as_float(
                self._first(commercial,"recipient_amount","recipient_gets")
            )
            option["recipient_currency"]=self._first(
                commercial,"recipient_currency","receive_currency"
            )
            option["estimated_delivery"]=self._first(
                commercial,"estimated_delivery","delivery_time","delivery"
            )
            option["delivery_method"]=self._first(
                commercial,"delivery_method","delivery_method_id"
            ) or option["delivery_method"]
            option["payment_method"]=self._first(
                commercial,"payment_method","payment_method_id"
            ) or option["payment_method"]

        session["selected_option"]=option
        session["updated_at"]=self._now()

        return deepcopy(option)

    # ---------------------------------------------------------
    # FINAL CHECK
    # ---------------------------------------------------------
    def final_check(
        self,
       request:FinalCheckRequest,
       session_id:Optional[str]=None
    )->Dict[str,Any]:
        language=self._language(request.language)
        provider=self._provider_by_id(request.provider_id)

        checks=[]
        precautions=[]

        if not provider:
            return {
                "success":False,
                "ready_to_continue":False,
                "language":language,
                "provider_id":request.provider_id,
                "checks":[{
                    "id":"provider",
                    "ok":False,
                    "message":"Proveedor no encontrado." if language=="es" else "Provider not found."
                }],
                "message":"No se pudo comprobar el proveedor." if language=="es" else "The provider could not be checked.",
                "precautions":[],
                "requirements":[]
            }

        country=str(request.destination_country or "").upper()
        supported=self._country_supported(provider,country)

        checks.append({
            "id":"provider",
            "ok":True,
            "message":(
                "Proveedor identificado."
                if language=="es"
                else "Provider identified."
            )
        })

        checks.append({
            "id":"destination",
            "ok":supported,
            "message":(
                "El proveedor aparece disponible para este destino."
                if supported and language=="es"
                else "The provider appears available for this destination."
                if supported
                else "No se pudo confirmar la disponibilidad para este destino."
                if language=="es"
                else "Availability for this destination could not be confirmed."
            )
        })

        commercial=self._commercial(provider,country)
        verified=self._is_verified(commercial)

        if verified:
            checks.append({
                "id":"commercial_data",
                "ok":True,
                "message":(
                    "Los datos comerciales usados están marcados como verificados."
                    if language=="es"
                    else "The commercial data used is marked as verified."
                )
            })
        else:
            checks.append({
                "id":"commercial_data",
                "ok":False,
                "message":(
                    "Los datos comerciales actuales no están verificados."
                    if language=="es"
                    else "Current commercial data is not verified."
                )
            })
            precautions.append(
                "Confirma comisión, tasa, cantidad recibida y tiempo de entrega directamente en el sitio oficial."
                if language=="es"
                else "Confirm the fee, exchange rate, recipient amount and delivery time directly on the official site."
            )

        if request.amount<=0:
            checks.append({
                "id":"amount",
                "ok":False,
                "message":"La cantidad debe ser mayor que cero." if language=="es" else "The amount must be greater than zero."
            })
        else:
            checks.append({
                "id":"amount",
                "ok":True,
                "message":"Cantidad válida." if language=="es" else "Valid amount."
            })

        if request.delivery_method:
            checks.append({
                "id":"delivery",
                "ok":True,
                "message":"Método de entrega indicado." if language=="es" else "Delivery method provided."
            })

        if request.payment_method:
            checks.append({
                "id":"payment",
                "ok":True,
                "message":"Método de pago indicado." if language=="es" else "Payment method provided."
            })

        requirements=self.provider_requirements(request.provider_id,language)

        precautions.extend([
            "No introduzcas contraseñas, CVV ni códigos de seguridad aquí."
            if language=="es"
            else "Do not enter passwords, CVV numbers or security codes here.",
            "Las condiciones finales pertenecen al proveedor."
            if language=="es"
            else "Final terms belong to the provider."
        ])

        ready=bool(provider and supported and request.amount>0)

        if language=="es":
            message=(
                "La información básica está lista para que revises el sitio oficial del proveedor."
                if ready
                else "Falta revisar información antes de continuar."
            )
        else:
            message=(
                "The basic information is ready for you to review on the provider's official site."
                if ready
                else "Some information needs to be reviewed before continuing."
            )

        return {
            "success":True,
            "ready_to_continue":ready,
            "language":language,
            "provider_id":request.provider_id,
            "checks":checks,
            "message":message,
            "precautions":precautions,
            "requirements":requirements
        }


engine=RemittanceEngine()
