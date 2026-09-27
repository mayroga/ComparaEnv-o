# remittance_engine.py — REMESAS | May Roga LLC
import json
import re
import uuid
from copy import deepcopy
from datetime import datetime,timezone
from pathlib import Path
from typing import Any,Dict,List,Optional

from schemas import (
    UserNeedRequest,
    ParseNeedRequest,
    ComparisonRequest,
    ComparisonResult,
    ComparisonResponse,
    FinalCheckRequest,
    FinalCheckResponse,
    SessionState,
)

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
        if not path.exists():
            raise FileNotFoundError(f"Required data file not found: {path}")
        with path.open("r",encoding="utf-8") as f:
            data=json.load(f)
        if not isinstance(data,dict):
            raise ValueError(f"Invalid JSON root in {path.name}")
        return data

    def load_brain(self)->Dict[str,Any]:
        data=self._read_json(BRAIN_PATH)
        required=[
            "app",
            "experience",
            "opening",
            "conversation_logic",
            "kernel",
            "providers",
            "countries",
            "comparison",
            "validation",
            "security",
            "languages",
        ]
        missing=[x for x in required if x not in data]
        if missing:
            raise ValueError(
                "Invalid app_brain.json. Missing sections: "
                +", ".join(missing)
            )
        return data

    def load_providers(self)->Dict[str,Any]:
        if not PROVIDERS_PATH.exists():
            return {
                "version":"fallback",
                "providers":deepcopy(self.brain.get("providers",[])),
                "corridors":{},
            }
        data=self._read_json(PROVIDERS_PATH)
        if not isinstance(data.get("providers"),list):
            data["providers"]=[]
        return data

    def now(self)->str:
        return datetime.now(timezone.utc).isoformat()

    def language_text(self,key:str,language:str="es")->str:
        messages=self.brain.get("messages",{})
        value=messages.get(key,{})
        return self.localize(value,language)

    def _message(self,key:str,language:str="es")->str:
        return self.language_text(key,language)

    def localize(self,value:Any,language:str="es")->str:
        if value is None:
            return ""
        if isinstance(value,str):
            return value
        if isinstance(value,(int,float,bool)):
            return str(value)
        if isinstance(value,dict):
            if language in value:
                return self.localize(value.get(language),language)
            if "es" in value:
                return self.localize(value.get("es"),"es")
            if "en" in value:
                return self.localize(value.get("en"),"en")
            if "label" in value:
                return self.localize(value.get("label"),language)
            if "name" in value:
                return self.localize(value.get("name"),language)
            if "id" in value:
                return str(value.get("id"))
        if isinstance(value,list):
            return ", ".join(
                self.localize(x,language) for x in value
                if self.localize(x,language)
            )
        return str(value)

    def get_country(self,country_code:str)->Optional[Dict[str,Any]]:
        code=(country_code or "").strip().upper()
        countries=self.brain.get("countries",{}).get("country_names",{})
        value=countries.get(code)
        if isinstance(value,dict):
            return value
        corridors=self.providers_data.get("corridors",{}).get(
            "destinations",{}
        )
        value=corridors.get(code)
        return value if isinstance(value,dict) else None

    def country_name(self,country_code:str,language:str="es")->str:
        value=self.get_country(country_code)
        if not value:
            return country_code or ""
        return self.localize(value,language) or value.get(
            "country",
            country_code
        )

    def get_provider_registry(self)->List[Dict[str,Any]]:
        providers=self.providers_data.get("providers",[])
        if not providers:
            providers=self.brain.get("providers",[])
        return [
            deepcopy(p) for p in providers
            if isinstance(p,dict) and p.get("enabled",True)
        ]

    def get_provider(self,provider_id:str)->Optional[Dict[str,Any]]:
        pid=(provider_id or "").strip()
        for provider in self.get_provider_registry():
            if provider.get("id")==pid:
                return provider
        return None

    def provider_url(
        self,
        provider:Dict[str,Any],
        language:str="es"
    )->Optional[str]:
        urls=provider.get("official_urls",{})
        if not isinstance(urls,dict):
            urls={}

        if language=="es":
            preferred=[
                "us_send_es",
                "us_es",
                "es",
                "main",
            ]
        else:
            preferred=[
                "us_send",
                "us_en",
                "en",
                "main",
            ]

        for key in preferred:
            value=urls.get(key)
            if isinstance(value,str) and value.startswith(("http://","https://")):
                return value

        value=provider.get("official_site")
        if isinstance(value,str) and value.startswith(("http://","https://")):
            return value

        value=urls.get("main")
        if isinstance(value,str) and value.startswith(("http://","https://")):
            return value

        return None

    def corridor_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        corridors=self.providers_data.get("corridors",{}).get(
            "destinations",{}
        )
        corridor=corridors.get(code,{})
        ids=corridor.get("providers",[])
        if isinstance(ids,list):
            return [str(x) for x in ids]

        return [
            p.get("id")
            for p in self.get_provider_registry()
            if p.get("id")
        ]

    def candidate_provider_ids(self,country:str)->List[str]:
        code=(country or "").strip().upper()
        if not code:
            return []

        supported=self.brain.get(
            "countries",{}
        ).get("initial_supported",[])

        corridor_ids=self.corridor_provider_ids(code)

        if code in supported and corridor_ids:
            return [
                pid for pid in corridor_ids
                if self.get_provider(pid)
            ]

        return []

    def get_verified_provider_data(
        self,
        provider_id:str,
        country:str,
        amount:Optional[float]=None,
        payment_method:Optional[str]=None,
        delivery_method:Optional[str]=None,
    )->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:
            return None

        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):
            return None

        status=str(commercial.get("status","")).lower()
        source=commercial.get("source")
        verified_at=commercial.get("verified_at")

        if status!="verified" or not source or not verified_at:
            return None

        result=deepcopy(commercial)
        result["provider_id"]=provider_id
        result["destination_country"]=country
        return result

    def provider_public_option(
        self,
        provider_id:str,
        country:str,
        language:str="es",
    )->Optional[Dict[str,Any]]:
        provider=self.get_provider(provider_id)
        if not provider:
            return None

        commercial=provider.get("commercial_data",{})
        if not isinstance(commercial,dict):
            commercial={}

        verified=(
            str(commercial.get("status","")).lower()=="verified"
            and bool(commercial.get("source"))
            and bool(commercial.get("verified_at"))
        )

        url=self.provider_url(provider,language)

        if verified:
            commercial_status="verified"
        else:
            commercial_status="unavailable"

        return {
            "provider_id":provider.get("id"),
            "provider_name":provider.get("name",provider.get("id","")),
            "enabled":bool(provider.get("enabled",True)),
            "country":country,
            "country_name":self.country_name(country,language),
            "commercial_status":commercial_status,
            "commercial_verified":verified,
            "fee":commercial.get("fee") if verified else None,
            "exchange_rate":commercial.get("exchange_rate") if verified else None,
            "recipient_amount":commercial.get("recipient_amount") if verified else None,
            "delivery_time":commercial.get("delivery_time") if verified else None,
            "currency":commercial.get("currency") if verified else None,
            "source":commercial.get("source") if verified else None,
            "verified_at":commercial.get("verified_at") if verified else None,
            "continue_url":url,
            "official_site":provider.get(
                "official_site",
                url
            ),
            "supports_online":provider.get("supports_online",False),
            "supports_agent":provider.get("supports_agent",False),
            "payment_methods":deepcopy(
                provider.get("payment_methods",[])
            ),
            "delivery_methods":deepcopy(
                provider.get("delivery_methods",[])
            ),
        }

    def create_session(
        self,
        language:str="es"
    )->Dict[str,Any]:
        lang=language if language in ("es","en") else "es"
        session_id=str(uuid.uuid4())

        state={
            "session_id":session_id,
            "language":lang,
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
            "parsed_user_need":None,
            "candidate_providers":[],
            "verified_results":[],
            "available_providers":[],
            "selected_option":None,
            "final_check":{},
            "current_step":"opening",
            "created_at":self.now(),
            "updated_at":self.now(),
        }

        self.sessions[session_id]=state
        return deepcopy(state)

    def get_session(self,session_id:str)->Optional[Dict[str,Any]]:
        state=self.sessions.get(session_id)
        return deepcopy(state) if state else None

    def update_session(
        self,
        session_id:str,
        **values:Any
    )->Optional[Dict[str,Any]]:
        state=self.sessions.get(session_id)
        if not state:
            return None

        for key,value in values.items():
            if value is not None:
                state[key]=value

        state["updated_at"]=self.now()
        return deepcopy(state)

    def clear_session(self,session_id:str)->bool:
        return self.sessions.pop(session_id,None) is not None

    def _amount_from_text(self,text:str)->Optional[float]:
        if not text:
            return None

        matches=re.findall(
            r"(?:\$|USD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
            text,
            flags=re.I
        )

        if not matches:
            return None

        try:
            value=matches[0].replace(",","")
            amount=float(value)
            return amount if amount>0 else None
        except (TypeError,ValueError):
            return None

    def _country_from_text(self,text:str)->Optional[str]:
        if not text:
            return None

        normalized=text.lower()

        aliases={
            "mexico":"MX",
            "méxico":"MX",
            "mexican":"MX",
            "guatemala":"GT",
            "el salvador":"SV",
            "salvador":"SV",
            "honduras":"HN",
            "nicaragua":"NI",
            "costa rica":"CR",
            "panama":"PA",
            "panamá":"PA",
            "dominican republic":"DO",
            "república dominicana":"DO",
            "dominicana":"DO",
            "colombia":"CO",
            "venezuela":"VE",
            "ecuador":"EC",
            "peru":"PE",
            "perú":"PE",
            "bolivia":"BO",
            "paraguay":"PY",
            "brazil":"BR",
            "brasil":"BR",
            "chile":"CL",
            "argentina":"AR",
            "uruguay":"UY",
            "cuba":"CU",
            "haiti":"HT",
            "haití":"HT",
        }

        for name,code in aliases.items():
            if re.search(
                r"\b"+re.escape(name)+r"\b",
                normalized
            ):
                return code

        return None

    def _priority_from_text(self,text:str)->Optional[str]:
        if not text:
            return None

        value=text.lower()

        patterns=[
            (
                "recipient_gets_more",
                [
                    "reciba más",
                    "reciba mas",
                    "receive more",
                    "máximo",
                    "maximo",
                    "more money",
                ]
            ),
            (
                "fastest",
                [
                    "rápido",
                    "rapido",
                    "fast",
                    "quick",
                    "speed",
                ]
            ),
            (
                "urgent",
                [
                    "urgente",
                    "urgent",
                    "hoy",
                    "today",
                    "ahora",
                    "now",
                ]
            ),
            (
                "save",
                [
                    "ahorrar",
                    "ahorro",
                    "save",
                    "cheap",
                    "barato",
                ]
            ),
            (
                "balanced",
                [
                    "equilibrio",
                    "balance",
                    "balanced",
                ]
            ),
            (
                "compare_all",
                [
                    "comparar",
                    "compare",
                    "opciones",
                    "options",
                ]
            ),
        ]

        for priority,terms in patterns:
            if any(term in value for term in terms):
                return priority

        return None

    def parse_need(
        self,
        request:ParseNeedRequest
    )->Dict[str,Any]:
        text=getattr(request,"text","") or getattr(
            request,
            "message",
            ""
        ) or ""

        language=getattr(request,"language","es") or "es"

        parsed={
            "amount":self._amount_from_text(text),
            "destination_country":self._country_from_text(text),
            "priority":self._priority_from_text(text),
            "urgency":None,
            "delivery_method":None,
            "payment_method":None,
            "language":language,
            "raw_text":text,
        }

        if parsed["priority"]=="urgent":
            parsed["urgency"]=True

        return parsed

    def apply_need(
        self,
        session_id:str,
        request:UserNeedRequest
    )->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:
            raise KeyError("session_expired")

        values={}

        for field in (
            "amount",
            "destination_country",
            "priority",
            "urgency",
            "delivery_method",
            "payment_method",
            "recipient_amount_target",
            "special_need",
        ):
            value=getattr(request,field,None)
            if value is not None:
                values[field]=value

        language=getattr(request,"language",None)
        if language in ("es","en"):
            values["language"]=language

        values["current_step"]="comparison"

        return self.update_session(
            session_id,
            **values
        ) or {}

    def _build_verified_result(
        self,
        provider:Dict[str,Any],
        commercial:Dict[str,Any],
        request:ComparisonRequest,
        language:str
    )->ComparisonResult:
        provider_id=provider.get("id","")
        provider_name=provider.get("name",provider_id)

        return ComparisonResult(
            provider_id=provider_id,
            provider_name=provider_name,
            amount_sent=getattr(request,"amount",None),
            fee=commercial.get("fee"),
            exchange_rate=commercial.get("exchange_rate"),
            recipient_amount=commercial.get("recipient_amount"),
            delivery_method=commercial.get("delivery_method"),
            estimated_delivery=commercial.get(
                "delivery_time"
            ),
            recipient_currency=commercial.get(
                "currency"
            ),
            important_condition=commercial.get(
                "important_condition"
            ),
            continue_url=self.provider_url(
                provider,
                language
            ),
            status="verified",
        )

    def compare_session(
        self,
        session_id:str
    )->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:
            raise KeyError("session_expired")

        request_data={
            "amount":state.get("amount"),
            "destination_country":state.get(
                "destination_country"
            ),
            "priority":state.get("priority"),
            "delivery_method":state.get(
                "delivery_method"
            ),
            "payment_method":state.get(
                "payment_method"
            ),
            "language":state.get("language","es"),
        }

        request=ComparisonRequest(**request_data)

        return self.compare(
            request,
            session_id=session_id
        )

    def compare(
        self,
        request:ComparisonRequest,
        session_id:Optional[str]=None
    )->Dict[str,Any]:
        language=getattr(request,"language","es") or "es"
        country=(
            getattr(request,"destination_country",None)
            or ""
        ).upper()

        amount=getattr(request,"amount",None)
        payment_method=getattr(
            request,
            "payment_method",
            None
        )
        delivery_method=getattr(
            request,
            "delivery_method",
            None
        )

        provider_ids=self.candidate_provider_ids(country)

        verified_results:List[ComparisonResult]=[]
        available_providers:List[Dict[str,Any]]=[]

        for provider_id in provider_ids:
            public=self.provider_public_option(
                provider_id,
                country,
                language
            )

            if public:
                available_providers.append(public)

            commercial=self.get_verified_provider_data(
                provider_id,
                country,
                amount,
                payment_method,
                delivery_method
            )

            provider=self.get_provider(provider_id)

            if commercial and provider:
                try:
                    result=self._build_verified_result(
                        provider,
                        commercial,
                        request,
                        language
                    )
                    verified_results.append(result)
                except Exception:
                    continue

        if session_id and session_id in self.sessions:
            self.sessions[session_id]["candidate_providers"]=[
                x.get("provider_id")
                for x in available_providers
            ]
            self.sessions[session_id]["verified_results"]=[
                r.model_dump()
                if hasattr(r,"model_dump")
                else dict(r)
                for r in verified_results
            ]
            self.sessions[session_id]["available_providers"]=[
                deepcopy(x)
                for x in available_providers
            ]
            self.sessions[session_id]["current_step"]="results"
            self.sessions[session_id]["updated_at"]=self.now()

        message=(
            self._message(
                "results_ready",
                language
            )
            if verified_results
            else self._message(
                "no_results",
                language
            )
        )

        return {
            "success":True,
            "message":message,
            "results":[
                r.model_dump()
                if hasattr(r,"model_dump")
                else dict(r)
                for r in verified_results
            ],
            "available_providers":available_providers,
            "provider_count":len(available_providers),
            "verified_count":len(verified_results),
            "destination_country":country,
            "destination_name":self.country_name(
                country,
                language
            ),
            "language":language,
        }

    def select_provider(
        self,
        session_id:str,
        provider_id:str
    )->Dict[str,Any]:
        state=self.sessions.get(session_id)
        if not state:
            raise KeyError("session_expired")

        provider=self.get_provider(provider_id)
        if not provider:
            raise KeyError("provider_not_found")

        country=state.get("destination_country")
        language=state.get("language","es")

        option=self.provider_public_option(
            provider_id,
            country,
            language
        )

        if not option:
            raise KeyError("provider_not_available")

        state["selected_option"]=deepcopy(option)
        state["current_step"]="final_check"
        state["updated_at"]=self.now()

        return deepcopy(option)

    def final_check(
        self,
        request:FinalCheckRequest,
        session_id:Optional[str]=None
    )->Dict[str,Any]:
        language=getattr(request,"language","es") or "es"

        destination=getattr(
            request,
            "destination_country",
            None
        )

        amount=getattr(
            request,
            "amount",
            None
        )

        currency=getattr(
            request,
            "currency",
            None
        )

        delivery_method=getattr(
            request,
            "delivery_method",
            None
        )

        checks=[
            {
                "id":"destination",
                "label":self.localize(
                    self.brain["validation"]["checks"][0]["label"],
                    language
                ),
                "value":self.country_name(
                    destination,
                    language
                ) if destination else None,
                "complete":bool(destination),
            },
            {
                "id":"amount",
                "label":self.localize(
                    self.brain["validation"]["checks"][1]["label"],
                    language
                ),
                "value":amount,
                "complete":bool(amount and float(amount)>0),
            },
            {
                "id":"currency",
                "label":self.localize(
                    self.brain["validation"]["checks"][2]["label"],
                    language
                ),
                "value":currency or "USD",
                "complete":True,
            },
            {
                "id":"delivery_method",
                "label":self.localize(
                    self.brain["validation"]["checks"][3]["label"],
                    language
                ),
                "value":delivery_method,
                "complete":bool(delivery_method),
            },
        ]

        valid=all(
            bool(x.get("complete"))
            for x in checks
            if x["id"] in (
                "destination",
                "amount",
                "currency"
            )
        )

        if session_id and session_id in self.sessions:
            self.sessions[session_id]["final_check"]={
                "checks":deepcopy(checks),
                "valid":valid,
            }
            self.sessions[session_id]["current_step"]="final_check"
            self.sessions[session_id]["updated_at"]=self.now()

        return {
            "success":True,
            "valid":valid,
            "checks":checks,
            "message":self.localize(
                self.brain["validation"]["final_message"],
                language
            ),
        }

    def public_config(self,language:str="es")->Dict[str,Any]:
        language=language if language in ("es","en") else "es"

        priorities=[]
        for item in self.brain.get(
            "opening",{}
        ).get("priorities",[]):
            if not isinstance(item,dict):
                continue

            priorities.append({
                "id":item.get("id"),
                "icon":item.get("icon",""),
                "label":self.localize(
                    item.get("label"),
                    language
                ),
            })

        countries=[]
        country_names=self.brain.get(
            "countries",{}
        ).get("country_names",{})

        for code in self.brain.get(
            "countries",{}
        ).get("initial_supported",[]):
            item=country_names.get(code,{})
            countries.append({
                "id":code,
                "name":self.localize(item,language),
                "currency":item.get("currency"),
            })

        providers=[]

        for provider in self.get_provider_registry():
            item={
                "id":provider.get("id"),
                "name":provider.get("name"),
                "enabled":provider.get("enabled",True),
                "continue_url":self.provider_url(
                    provider,
                    language
                ),
                "official_site":provider.get(
                    "official_site"
                ),
            }

            providers.append(item)

        return {
            "app":deepcopy(
                self.brain.get("app",{})
            ),
            "language":language,
            "supported_languages":self.brain.get(
                "languages",{}
            ).get(
                "supported",
                ["es","en"]
            ),
            "opening":{
                "primary_question":self.localize(
                    self.brain.get(
                        "opening",{}
                    ).get("primary_question"),
                    language
                ),
                "secondary_text":self.localize(
                    self.brain.get(
                        "opening",{}
                    ).get("secondary_text"),
                    language
                ),
                "amount":deepcopy(
                    self.brain.get(
                        "opening",{}
                    ).get("amount",{})
                ),
                "priorities":priorities,
                "free_text":deepcopy(
                    self.brain.get(
                        "opening",{}
                    ).get("free_text",{})
                ),
            },
            "countries":countries,
            "providers":providers,
            "delivery_methods":[
                {
                    "id":x.get("id"),
                    "label":self.localize(
                        x.get("label"),
                        language
                    ),
                }
                for x in self.brain.get(
                    "delivery_methods",[]
                )
                if isinstance(x,dict)
            ],
            "payment_methods":[
                {
                    "id":x.get("id"),
                    "label":self.localize(
                        x.get("label"),
                        language
                    ),
                }
                for x in self.brain.get(
                    "payment_methods",[]
                )
                if isinstance(x,dict)
            ],
            "messages":{
                key:self.localize(
                    value,
                    language
                )
                for key,value in self.brain.get(
                    "messages",{}
                ).items()
            },
            "provider_handoff":{
                "button":self.localize(
                    self.brain.get(
                        "provider_handoff",{}
                    ).get("button"),
                    language
                ),
                "external_notice":self.localize(
                    self.brain.get(
                        "provider_handoff",{}
                    ).get("external_notice"),
                    language
                ),
            },
        }


engine=RemittanceEngine()
