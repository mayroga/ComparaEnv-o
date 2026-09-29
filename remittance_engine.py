import json, os, re, secrets, urllib.request, urllib.error
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from schemas import RemittanceRequest, ComparisonRequest, FinalCheckRequest, UserNeedRequest, ParseNeedRequest
except Exception:
    RemittanceRequest = ComparisonRequest = FinalCheckRequest = UserNeedRequest = ParseNeedRequest = Any

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
BRAIN_PATH = DATA_DIR / "app_brain.json"
PROVIDERS_PATH = DATA_DIR / "providers.json"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ENGINE_VERSION = "5.0.0"

class RemittanceEngine:
    def __init__(self):
        self.brain = self._read_json(BRAIN_PATH) if BRAIN_PATH.exists() else {}
        self.providers_data = self._read_json(PROVIDERS_PATH) if PROVIDERS_PATH.exists() else {"providers":[]}
        self.providers = self.providers_data.get("providers", [])
        if not isinstance(self.providers, list): self.providers = []
        self.provider_map = {str(p.get("id","")): p for p in self.providers if isinstance(p, dict) and p.get("id")}
        self.required_providers = self.brain.get("providers", {}).get("required", ["western_union", "moneygram", "remitly", "xoom"])
        self.sessions = {}
        self._ensure_required_provider_fallbacks()

    def _read_json(self, path: Path) -> Dict[str, Any]:
        try:
            with path.open("r", encoding="utf-8") as f: data = json.load(f)
            if not isinstance(data, dict): raise ValueError(f"{path.name} must contain a JSON object")
            return data
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {path.name}: {e}") from e

    def load_brain(self):
        self.brain = self._read_json(BRAIN_PATH)
        self.required_providers = self.brain.get("providers", {}).get("required", ["western_union", "moneygram", "remitly", "xoom"])
        return self.brain

    def load_providers(self):
        self.providers_data = self._read_json(PROVIDERS_PATH)
        self.providers = self.providers_data.get("providers", [])
        if not isinstance(self.providers, list): self.providers = []
        self.provider_map = {str(p.get("id","")): p for p in self.providers if isinstance(p, dict) and p.get("id")}
        self._ensure_required_provider_fallbacks()
        return self.providers

    def _ensure_required_provider_fallbacks(self):
        defaults = {
            "western_union": {"id": "western_union", "name": "Western Union", "official_urls": {"home": "https://www.westernunion.com/us/es/home.html", "send_money": "https://www.westernunion.com/us/es/web/send-money/start"}},
            "moneygram": {"id": "moneygram", "name": "MoneyGram", "official_urls": {"home": "https://www.moneygram.com/us/en/", "send_money": "https://www.moneygram.com/us/en/send-money"}},
            "remitly": {"id": "remitly", "name": "Remitly", "official_urls": {"home": "https://www.remitly.com/us/es/home", "send_money": "https://www.remitly.com/us/es/money-transfer"}},
            "xoom": {"id": "xoom", "name": "Xoom", "official_urls": {"home": "https://www.xoom.com/", "send_money": "https://www.xoom.com/money-transfer"}}
        }
        for pid in self.required_providers:
            if pid not in self.provider_map and pid in defaults: self.provider_map[pid] = defaults[pid]

    def _lang(self, language: str) -> str:
        return "en" if str(language or "").lower().startswith("en") else "es"

    def _text(self, value: Any, language: str, default: str = "") -> str:
        lang = self._lang(language)
        if isinstance(value, dict):
            v = value.get(lang)
            if v is None: v = value.get("es") or value.get("en")
            return str(v) if v is not None else default
        return str(value) if value is not None else default

    def _money(self, value: Any) -> Optional[float]:
        if value is None: return None
        if isinstance(value, (int, float)): return round(float(value), 2)
        s = str(value).strip().replace(",", "")
        s = re.sub(r"[^\d.\-]", "", s)
        if not s or s in ("-", "."): return None
        try: return round(float(s), 2)
        except: return None

    def _safe_money(self, value: Any) -> float:
        n = self._money(value)
        return 0.0 if n is None else n

    def _provider(self, pid: str) -> Dict[str, Any]:
        p = self.provider_map.get(str(pid))
        return p if isinstance(p, dict) else {"id": pid, "name": str(pid).replace("_", " ").title()}

    def provider_name(self, pid: str, language="es") -> str:
        p = self._provider(pid)
        return self._text(p.get("name"), language, str(pid).replace("_", " ").title())

    def _url(self, value: Any) -> Optional[str]:
        if isinstance(value, str) and value.startswith(("https://", "http://")): return value
        return None

    def official_url(self, pid: str, topic: str = "send_money") -> str:
        p = self._provider(pid)
        urls = p.get("official_urls") or p.get("urls")
        if isinstance(urls, dict):
            order = [topic, "send_money", "home", "official", "website", "us"]
            for key in order:
                u = self._url(urls.get(key))
                if u: return u
        elif isinstance(urls, str):
            u = self._url(urls)
            if u: return u
        for key in ("official_url", "website", "url"):
            u = self._url(p.get(key))
            if u: return u
        defaults = {
            "western_union": {"home": "https://www.westernunion.com/us/es/home.html", "send_money": "https://www.westernunion.com/us/es/web/send-money/start"},
            "moneygram": {"home": "https://www.moneygram.com/us/en/", "send_money": "https://www.moneygram.com/us/en/send-money"},
            "remitly": {"home": "https://www.remitly.com/us/es/home", "send_money": "https://www.remitly.com/us/es/money-transfer"},
            "xoom": {"home": "https://www.xoom.com/", "send_money": "https://www.xoom.com/money-transfer"}
        }
        return defaults.get(pid, {}).get(topic) or defaults.get(pid, {}).get("send_money") or defaults.get(pid, {}).get("home", "")

    def _source(self, p: Dict[str, Any], topic: str = "send_money") -> Optional[str]:
        urls = p.get("official_urls") or p.get("urls")
        if isinstance(urls, dict):
            for key in (topic, "send_money", "home"):
                u = self._url(urls.get(key))
                if u: return u
        for key in ("source_url", "official_source_url", "official_url", "source", "official_source"):
            value = p.get(key)
            if isinstance(value, str):
                u = self._url(value)
                if u: return u
            elif isinstance(value, dict):
                for v in value.values():
                    u = self._url(v)
                    if u: return u
        return None

    def _field(self, p: Dict[str, Any], names: List[str]):
        for n in names:
            if n in p and p[n] is not None: return p[n]
        commercial = p.get("commercial_data")
        if isinstance(commercial, dict):
            for n in names:
                if n in commercial and commercial[n] is not None: return commercial[n]
        return None

    def _verified(self, p: Dict[str, Any], field: str) -> bool:
        direct = self._field(p, [f"{field}_verified", f"verified_{field}"])
        if isinstance(direct, bool): return direct
        status = p.get("verification_status") or p.get("verified_status")
        if isinstance(status, str) and status.lower() in ("verified", "official", "current"): return True
        commercial = p.get("commercial_data")
        if isinstance(commercial, dict):
            status = commercial.get("verification_status") or commercial.get("status")
            if isinstance(status, str) and status.lower() in ("verified", "official", "current"): return True
        return False

    def _commercial(self, p: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "fee": self._field(p, ["fee", "fee_usd", "commission"]),
            "exchange_rate": self._field(p, ["exchange_rate", "rate", "fx_rate"]),
            "recipient_amount": self._field(p, ["recipient_amount", "receive_amount"]),
            "delivery_time": self._field(p, ["delivery_time", "estimated_delivery_time", "delivery_estimate"]),
            "availability": self._field(p, ["availability", "available"]),
            "limit": self._field(p, ["limit", "sending_limit"]),
            "payment_methods": self._field(p, ["payment_methods", "payments"]),
            "delivery_methods": self._field(p, ["delivery_methods", "delivery"])
        }

    def _provider_snapshot(self, pid: str, amount: float, destination: str, language="es") -> Dict[str, Any]:
        p = self._provider(pid)
        c = self._commercial(p)
        result = {
            "provider_id": pid,
            "provider_name": self.provider_name(pid, language),
            "official_url": self.official_url(pid, "send_money"),
            "review_url": self.official_url(pid, "send_money"),
            "amount": amount,
            "destination_country": destination,
            "fee": None,
            "exchange_rate": None,
            "recipient_amount": None,
            "estimated_delivery": None,
            "availability": None,
            "limit": None,
            "payment_methods": c["payment_methods"],
            "delivery_methods": c["delivery_methods"],
            "verified": False,
            "status": "official_source",
            "source": self._source(p, "send_money") or self.official_url(pid, "send_money"),
            "verified_at": None,
            "important_condition": self._text(p.get("important_condition"), language, "")
        }
        verified_count = 0
        for field, target in (("fee", "fee"), ("exchange_rate", "exchange_rate"), ("recipient_amount", "recipient_amount"), ("delivery_time", "estimated_delivery"), ("availability", "availability"), ("limit", "limit")):
            if c[field] is not None and self._verified(p, field):
                result[target] = c[field]
                verified_count += 1
        result["verified"] = verified_count > 0
        result["verified_fields"] = verified_count
        value = p.get("verified_at") or p.get("last_verified") or p.get("checked_at")
        if isinstance(value, str): result["verified_at"] = value
        return result

    def _priority_score(self, s: Dict[str, Any], priority: str) -> Optional[float]:
        p = str(priority or "simple").lower()
        fee = self._money(s.get("fee"))
        recipient = self._money(s.get("recipient_amount"))
        if fee is None and recipient is None: return None
        score = 0.0
        if p in ("cheap", "cheapest", "economico", "económico", "barato"):
            if fee is not None: score -= fee
            if recipient is not None: score += recipient / 100000
        elif p in ("fast", "quick", "urgent", "rapido", "rápido", "urgente"):
            delivery = str(s.get("estimated_delivery") or "").lower()
            if any(x in delivery for x in ("instant", "minute", "minuto", "hour", "hora", "same day", "mismo día")): score += 100
            if recipient is not None: score += recipient / 100000
            if fee is not None: score -= fee / 100
        else:
            if recipient is not None: score += recipient / 100000
            if fee is not None: score -= fee / 100
        return score

    def compare_providers(self, amount: float, destination: str, priority: str = "simple", language="es") -> Dict[str, Any]:
        snapshots = [self._provider_snapshot(pid, amount, destination, language) for pid in self.required_providers]
        comparable = [s for s in snapshots if s.get("fee") is not None and s.get("recipient_amount") is not None and s.get("verified")]
        selected = None
        if len(comparable) >= 2:
            scored = [(s, self._priority_score(s, priority)) for s in comparable]
            scored = [x for x in scored if x[1] is not None]
            if scored: selected = max(scored, key=lambda x: x[1])[0]
        return {"providers": snapshots, "selected": selected, "all_four_shown": True, "verified_count": sum(1 for s in snapshots if s.get("verified")), "comparable_count": len(comparable), "comparison_status": "comparable" if len(comparable) >= 2 else "official_source_required"}

    def _validate_amount(self, amount):
        n = self._money(amount)
        return (True, n) if n is not None and n > 0 else (False, None)

    def _country_name(self, code, language):
        countries = self.brain.get("countries", {}).get("country_names", {})
        return self._text(countries.get(str(code or "").upper()), language, str(code or "").upper())

    def _source_message(self, url, language):
        if self._lang(language) == "en": return "Check the current information directly here."
        return "Revisa la información actual directamente aquí."

    def _send_text(self, selected, amount, destination, language):
        lang = self._lang(language)
        country = self._country_name(destination, language)
        if selected:
            name = selected["provider_name"]
            fee = selected.get("fee")
            receive = selected.get("recipient_amount")
            if fee is not None and receive is not None:
                if lang == "en": return f"{name} matches your request. Fee: ${float(fee):.2f}. Recipient amount: {receive}. Review the final result on the official site before confirming."
                return f"{name} coincide con tu solicitud. Comisión: ${float(fee):.2f}. Recibe: {receive}. Revisa el resultado final en el sitio oficial antes de confirmar."
            if lang == "en": return f"{name} matches your request, but the final cost needs to be verified on the official site."
            return f"{name} coincide con tu solicitud, pero el costo final debe comprobarse en el sitio oficial."
        if lang == "en": return f"For sending ${amount:.2f} to {country}, please review official provider sites before sending."
        return f"Para enviar ${amount:.2f} a {country}, revisa los sitios oficiales antes de enviar."

    def _sender_impact(self, available, amount, reserved, language):
        a = self._money(available)
        r = self._money(reserved) or 0
        lang = self._lang(language)
        if a is None: return {"status": "review", "message": "Revisa cuánto te quedará después del envío." if lang == "es" else "Review how much you will have left after sending."}
        remaining = round(a - amount, 2)
        if remaining < r:
            return {"status": "warning", "remaining": remaining, "message": f"Ojo: este envío tocaría dinero reservado. Te quedarían \({remaining:.2f}." if lang == "es" else f"Careful: this transfer would use reserved money. You would have\){remaining:.2f} left."}
        if remaining < 0:
            return {"status": "warning", "remaining": remaining, "message": f"Ojo: te faltarían \({abs(remaining):.2f} después del envío." if lang == "es" else f"Careful: you would be\){abs(remaining):.2f} short after sending."}
        return {"status": "ok", "remaining": remaining, "message": f"Después del envío te quedarían \({remaining:.2f}." if lang == "es" else f"After sending, you would have\){remaining:.2f} left."}

    def send_money(self, amount: Any, destination: str, priority: str = "simple", language = "es", **kwargs) -> Dict[str, Any]:
        ok, n = self._validate_amount(amount)
        lang = self._lang(language)
        if not ok: return {"ok": False, "action": "CORREGIR MONTO", "message": "Escribe un monto mayor que cero." if lang == "es" else "Enter an amount greater than zero.", "providers": []}
        if not destination: return {"ok": False, "action": "ELEGIR DESTINO", "message": "Primero dime a qué país va el dinero." if lang == "es" else "First tell me which country the money is going to.", "providers": []}
        comparison = self.compare_providers(n, destination, priority, language)
        selected = comparison["selected"]
        impact = self._sender_impact(kwargs.get("available_money"), n, kwargs.get("reserved_money"), language)
        return {"ok": True, "action": "REVISAR Y ENVIAR", "message": self._send_text(selected, n, destination, language), "selected": selected, "providers": comparison["providers"], "all_four_providers": True, "sender_impact": impact, "requires_confirmation": True, "external_transaction": False, "official_url": selected["review_url"] if selected else self.official_url(self.required_providers[0], "send_money")}

    def calculate_money(self, current_money, income=0, fixed_expenses=0, planned_expenses=0, savings=0, remittances=0, language="es"):
        current = self._safe_money(current_money); inc = self._safe_money(income); fixed = self._safe_money(fixed_expenses); planned = self._safe_money(planned_expenses); save = self._safe_money(savings); rem = self._safe_money(remittances)
        available = round(current + inc - fixed - planned - save - rem, 2)
        lang = self._lang(language)
        if available >= 0: msg = f"Tienes \({available:.2f} libres después de apartar lo necesario." if lang == "es" else f"You have\){available:.2f} free after setting aside what you need."
        else: msg = f"Ojo: te faltan \({abs(available):.2f} para cubrir lo comprometido." if lang == "es" else f"Careful: you are\){abs(available):.2f} short of what is committed."
        return {"ok": True, "current_money": current, "income": inc, "fixed_expenses": fixed, "planned_expenses": planned, "savings": save, "remittances": rem, "available": available, "message": msg, "status": "ok" if available >= 0 else "warning"}

    def weekly_budget(self, current_money, next_income_date, fixed_expenses=0, planned_remittances=0, language="es"):
        current = self._safe_money(current_money); fixed = self._safe_money(fixed_expenses); rem = self._safe_money(planned_remittances)
        try: days = max((date.fromisoformat(str(next_income_date)) - date.today()).days, 1)
        except Exception: days = 7
        safe = max(round(current - fixed - rem, 2), 0); daily = round(safe / days, 2); lang = self._lang(language)
        msg = (f"Vas bien. Puedes gastar hasta \({daily:.2f} al día sin tocar lo reservado." if safe > 0 else "Vamos con cuidado: primero aparta lo necesario.") if lang == "es" else (f"You can spend up to\){daily:.2f} a day without touching reserved money." if safe > 0 else "Let's be careful: set aside what you need first.")
        return {"ok": True, "days_remaining": days, "safe_available": safe, "daily_limit": daily, "message": msg, "status": "ok" if safe > 0 else "warning"}

    def record_expense(self, current_money, expense, language="es", category=None):
        current = self._money(current_money); amount = self._money(expense); lang = self._lang(language)
        if amount is None or amount <= 0: return {"ok": False, "action": "CORREGIR GASTO", "message": "Dime cuánto gastaste y lo anoto." if lang == "es" else "Tell me how much you spent and I will record it."}
        remaining = round(current - amount, 2) if current is not None else None
        msg = (f"Listo, anotado. Te quedan \({remaining:.2f}." if remaining is not None else "Listo, anotado.") if lang == "es" else (f"Done. You have\){remaining:.2f} left." if remaining is not None else "Done. I recorded it.")
        return {"ok": True, "expense": amount, "category": category or "other", "remaining": remaining, "message": msg, "save_local_only": True}

    def plan_purchase(self, current_money, price, reserved_money=0, reserved_purpose="", language="es"):
        current = self._safe_money(current_money); cost = self._safe_money(price); reserved = self._safe_money(reserved_money); remaining = round(current - cost, 2); safe_remaining = round(current - reserved, 2); lang = self._lang(language)
        if cost <= safe_remaining:
            status = "safe"; msg = "Sí, te alcanza y no toca el dinero que apartaste." if lang == "es" else "Yes, you can afford it without touching reserved money."
        else:
            status = "warning"; purpose = reserved_purpose or ("tus gastos importantes" if lang == "es" else "your important expenses"); msg = f"Espera. Si compras esto, tocarías dinero reservado para {purpose}." if lang == "es" else f"Wait. Buying this would use money reserved for {purpose}."
        return {"ok": True, "price": cost, "remaining_after_purchase": remaining, "protected_money": reserved, "status": status, "message": msg}

    def save_money(self, current_money, amount, purpose="emergency", language="es"):
        current = self._safe_money(current_money); value = self._safe_money(amount); safe = min(value, current); remaining = round(current - safe, 2); lang = self._lang(language)
        msg = ("Primero necesitamos saber cuánto tienes disponible." if lang == "es" else "First we need to know how much money you have available.") if safe <= 0 else (f"Hecho. Apartaste \({safe:.2f} para {purpose}." if lang == "es" else f"Done. You set aside\){safe:.2f} for {purpose}.")
        return {"ok": safe > 0, "saved": safe, "remaining": remaining, "purpose": purpose, "message": msg, "save_local_only": True}

    def family_repeat(self, person: Dict[str, Any], language="es"):
        lang = self._lang(language); amount = self._money(person.get("amount")); name = str(person.get("nickname") or person.get("name") or ("tu familiar" if lang == "es" else "your family member"))
        action = (f"Enviar lo de siempre (\({amount:.2f})" if lang == "es" else f"Send the usual amount (\){amount:.2f})") if amount is not None else (f"Enviar a {name}" if lang == "es" else f"Send to {name}")
        return {"ok": True, "person": name, "amount": amount, "action": action, "requires_confirmation": True, "external_transaction": False}

    def _extract_amount(self, text):
        m = re.search(r"(? str: return value.upper()

class VerificationData(StrictModel):
    source: Optional[str] = None
    verified_at: Optional[str] = None
    status: DataStatus = "unavailable"

class ProviderCommercialData(StrictModel):
    fee: Optional[float] = Field(default=None, ge=0)
    exchange_rate: Optional[float] = Field(default=None, gt=0)
    delivery_time: Optional[str] = None
    recipient_amount: Optional[float] = Field(default=None, ge=0)
    source: Optional[str] = None
    verified_at: Optional[str] = None
    status: DataStatus = "unavailable"

class ProviderSchema(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    enabled: bool = True
    category: str = "remittance_provider"
    official_site: Optional[str] = None
    supports_online: bool = True
    supports_agent: bool = False
    supports_multiple_delivery_methods: bool = True
    coverage_must_be_verified_by_corridor: bool = True
    commercial_data: ProviderCommercialData = Field(default_factory=ProviderCommercialData)

class CountrySchema(StrictModel):
    code: str = Field(min_length=2, max_length=3)
    name_es: str
    name_en: str
    currency: str = Field(min_length=3, max_length=3)
    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str: return value.upper()
    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str: return value.upper()

class UserNeedRequest(StrictModel):
    language: Language = "es"
    amount: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    send_currency: str = Field(default="USD", min_length=3, max_length=3)
    destination_country: Optional[str] = Field(default=None, min_length=2, max_length=3)
    priority: Optional[Priority] = None
    urgency: Optional[str] = Field(default=None, max_length=100)
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    special_need: Optional[str] = Field(default=None, max_length=1000)
    free_text: Optional[str] = Field(default=None, max_length=2000)
    @field_validator("send_currency")
    @classmethod
    def normalize_send_currency(cls, value: str) -> str: return value.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_destination(cls, value: Optional[str]) -> Optional[str]: return value.upper() if value else None

class ParseNeedRequest(StrictModel):
    language: Language = "es"
    text: str = Field(min_length=1, max_length=2000)
    current_amount: Optional[float] = Field(default=None, ge=0)
    current_destination_country: Optional[str] = Field(default=None, min_length=2, max_length=3)
    @field_validator("current_destination_country")
    @classmethod
    def normalize_current_country(cls, value: Optional[str]) -> Optional[str]: return value.upper() if value else None

class ParsedNeed(StrictModel):
    amount: Optional[float] = Field(default=None, ge=0)
    send_currency: str = "USD"
    destination_country: Optional[str] = None
    priority: Optional[Priority] = None
    urgency: Optional[str] = None
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    special_need: Optional[str] = None
    original_text: Optional[str] = None
    missing_information: List[str] = Field(default_factory=list)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str: return value.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: Optional[str]) -> Optional[str]: return value.upper() if value else None

class ComparisonRequest(StrictModel):
    language: Language = "es"
    amount: float = Field(gt=0, le=1_000_000)
    send_currency: str = Field(default="USD", min_length=3, max_length=3)
    destination_country: str = Field(min_length=2, max_length=3)
    priority: Optional[Priority] = None
    urgency: Optional[str] = Field(default=None, max_length=100)
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    special_need: Optional[str] = Field(default=None, max_length=1000)
    provider_ids: List[str] = Field(default_factory=list, max_length=50)
    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str: return value.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: str) -> str: return value.upper()

class ProviderOption(StrictModel):
    provider_id: str
    provider_name: str
    amount_sent: Optional[float] = Field(default=None, ge=0)
    send_currency: Optional[str] = None
    fee: Optional[float] = Field(default=None, ge=0)
    exchange_rate: Optional[float] = Field(default=None, gt=0)
    recipient_amount: Optional[float] = Field(default=None, ge=0)
    recipient_currency: Optional[str] = None
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    estimated_delivery: Optional[str] = None
    availability: Optional[bool] = None
    important_condition: Optional[str] = None
    source: Optional[str] = None
    verified_at: Optional[str] = None
    status: DataStatus = "unavailable"
    official_url: Optional[str] = None
    continue_url: Optional[str] = None
    help_urls: Dict[str, str] = Field(default_factory=dict)
    official_urls: Dict[str, str] = Field(default_factory=dict)
    @field_validator("send_currency", "recipient_currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]: return value.upper() if value else None

class ComparisonResult(StrictModel):
    provider_id: str
    provider_name: str
    amount_sent: Optional[float] = None
    send_currency: str = "USD"
    fee: Optional[float] = None
    exchange_rate: Optional[float] = None
    recipient_amount: Optional[float] = None
    recipient_currency: Optional[str] = None
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    estimated_delivery: Optional[str] = None
    availability: Optional[bool] = None
    important_condition: Optional[str] = None
    source: Optional[str] = None
    verified_at: Optional[str] = None
    status: DataStatus = "unavailable"
    relevance_reason: Optional[str] = None
    continue_url: Optional[str] = None
    official_url: Optional[str] = None
    help_urls: Dict[str, str] = Field(default_factory=dict)
    official_urls: Dict[str, str] = Field(default_factory=dict)
    @field_validator("send_currency", "recipient_currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]: return value.upper() if value else None

class ComparisonResponse(StrictModel):
    success: bool = True
    language: Language = "es"
    destination_country: Optional[str] = None
    destination_name: Optional[str] = None
    amount: Optional[float] = None
    send_currency: str = "USD"
    priority: Optional[Priority] = None
    results: List[ComparisonResult] = Field(default_factory=list)
    available_providers: List[Dict[str, Any]] = Field(default_factory=list)
    provider_count: int = 0
    verified_count: int = 0
    results_available: bool = False
    message: Optional[str] = None
    explanation: Optional[str] = None
    differences: List[Dict[str, Any]] = Field(default_factory=list)
    precautions: List[str] = Field(default_factory=list)
    data_timestamp: Optional[str] = None
    warning: Optional[str] = None
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: Optional[str]) -> Optional[str]: return value.upper() if value else None

class FinalCheckItem(StrictModel):
    id: str
    label: str
    value: Optional[str] = None
    status: Literal["ok", "review", "unavailable", "not_required"] = "review"
    complete: bool = False

class FinalCheckRequest(StrictModel):
    language: Language = "es"
    provider_id: str
    amount: float = Field(gt=0, le=1_000_000)
    send_currency: str = Field(default="USD", min_length=3, max_length=3)
    destination_country: str = Field(min_length=2, max_length=3)
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    recipient_amount: Optional[float] = Field(default=None, ge=0)
    fee: Optional[float] = Field(default=None, ge=0)
    exchange_rate: Optional[float] = Field(default=None, gt=0)
    recipient_information_entered: bool = False
    checks: Dict[str, Any] = Field(default_factory=dict)
    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str: return value.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: str) -> str: return value.upper()

class FinalCheckResponse(StrictModel):
    success: bool = True
    ready_to_continue: bool = False
    language: Language = "es"
    provider_id: Optional[str] = None
    checks: List[FinalCheckItem] = Field(default_factory=list)
    message: Optional[str] = None
    important_note: Optional[str] = None
    precautions: List[str] = Field(default_factory=list)
    help_topic: Optional[str] = None
    topic: Optional[str] = None

class SessionState(StrictModel):
    session_id: str
    language: Language = "es"
    current_step: str = "opening"
    amount: Optional[float] = None
    send_currency: str = "USD"
    destination_country: Optional[str] = None
    priority: Optional[Priority] = None
    urgency: Optional[str] = None
    delivery_method: Optional[DeliveryMethod] = None
    payment_method: Optional[PaymentMethod] = None
    special_need: Optional[str] = None
    free_text: Optional[str] = None
    parsed_user_need: Optional[Any] = None
    candidate_providers: List[str] = Field(default_factory=list)
    available_providers: List[Dict[str, Any]] = Field(default_factory=list)
    verified_results: List[ComparisonResult] = Field(default_factory=list)
    selected_option: Optional[Any] = None
    final_check: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class SessionResponse(StrictModel):
    success: bool = True
    session: SessionState
    message: Optional[str] = None

class LocalStoragePreferences(StrictModel):
    language: Language = "es"
    app_version: Optional[str] = None
    brain_version: Optional[str] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)

class DeleteLocalDataResponse(StrictModel):
    success: bool = True
    message: str

class BrainValidationResponse(StrictModel):
    valid: bool
    version: Optional[str] = None
    schema_version: Optional[str] = None
    required_sections_present: bool = False
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

class HealthResponse(StrictModel):
    status: str = "ok"
    app: str = "REMESAS"
    version: str = "3.0.0"
    brain_loaded: bool = False
    brain_version: Optional[str] = None
