# remittance_engine.py — REMESAS | May Roga LLC
# Motor interno de comparación y asistencia.
# No guarda datos personales en servidor.
# No inventa tarifas, tasas, tiempos ni disponibilidad.
# La experiencia y reglas principales viven en data/app_brain.json.

import json
import re
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from schemas import (
    ComparisonRequest,
    ComparisonResponse,
    ComparisonResult,
    FinalCheckRequest,
    FinalCheckResponse,
    FinalCheckItem,
    ParsedNeed,
    ProviderOption,
    SessionState,
    UserNeedRequest,
)


BASE_DIR = Path(__file__).resolve().parent
BRAIN_PATH = BASE_DIR / "data" / "app_brain.json"


class RemittanceEngine:
    def __init__(self, brain_path: Optional[Path] = None):
        self.brain_path = brain_path or BRAIN_PATH
        self.brain: Dict[str, Any] = {}
        self.sessions: Dict[str, SessionState] = {}
        self.load_brain()

    # ------------------------------------------------------------------
    # BRAIN
    # ------------------------------------------------------------------

    def load_brain(self) -> Dict[str, Any]:
        if not self.brain_path.exists():
            raise FileNotFoundError(
                f"Brain file not found: {self.brain_path}"
            )

        with self.brain_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        self._validate_brain(data)
        self.brain = data
        return self.brain

    def reload_brain(self) -> Dict[str, Any]:
        return self.load_brain()

    def _validate_brain(self, brain: Dict[str, Any]) -> None:
        required = [
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

        missing = [
            section
            for section in required
            if section not in brain
        ]

        if missing:
            raise ValueError(
                "Missing required brain sections: "
                + ", ".join(missing)
            )

        if brain.get("data_truth", {}).get(
            "core_rule"
        ) != "never_invent_data":
            raise ValueError(
                "Brain must enforce the no-invention rule."
            )

    # ------------------------------------------------------------------
    # GENERAL
    # ------------------------------------------------------------------

    @staticmethod
    def now_iso() -> str:
        return datetime.now(
            timezone.utc
        ).isoformat()

    @staticmethod
    def clean_text(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        value = re.sub(
            r"\s+",
            " ",
            value.strip(),
        )

        return value or None

    @staticmethod
    def normalize_country(
        country: Optional[str],
    ) -> Optional[str]:
        if not country:
            return None
        return country.strip().upper()

    @staticmethod
    def normalize_currency(
        currency: Optional[str],
    ) -> str:
        if not currency:
            return "USD"
        return currency.strip().upper()

def language_text(
        self,
        key: str,
        language: str = "es",
    ) -> str:
        messages = self.brain.get(
            "messages",
            {},
        )

        value = messages.get(
            key,
            {},
        )

        if isinstance(value, dict):
            return value.get(
                language,
                value.get("es", ""),
            )

        return ""

    def _message(
        self,
        key: str,
        language: str = "es",
    ) -> str:
        messages = {
            "no_results": {
                "es": "No encontramos opciones con datos comerciales verificados en este momento.",
                "en": "We could not find options with verified commercial data at this time.",
            },
            "results_ready": {
                "es": "Estas son las opciones que pudimos verificar.",
                "en": "These are the options we were able to verify.",
            },
        }

        return messages.get(
            key,
            {},
        ).get(
            language,
            messages.get(key, {}).get("es", ""),
        )

    # ------------------------------------------------------------------
    # COUNTRIES
    # ------------------------------------------------------------------

    def get_country(
        self,
        country_code: str,
    ) -> Optional[Dict[str, Any]]:
        code = self.normalize_country(
            country_code
        )

        countries = self.brain.get(
            "countries",
            {},
        ).get(
            "country_names",
            {},
        )

        data = countries.get(code)

        if not data:
            return None

        return {
            "code": code,
            **data,
        }

    def country_supported(
        self,
        country_code: str,
    ) -> bool:
        code = self.normalize_country(
            country_code
        )

        supported = self.brain.get(
            "countries",
            {},
        ).get(
            "initial_supported",
            [],
        )

        return code in supported

    # ------------------------------------------------------------------
    # PROVIDERS
    # ------------------------------------------------------------------

    def get_providers(
        self,
        enabled_only: bool = True,
    ) -> List[Dict[str, Any]]:
        providers = self.brain.get(
            "providers",
            []
        )

        if enabled_only:
            return [
                provider
                for provider in providers
                if provider.get(
                    "enabled",
                    False,
                )
            ]

        return providers

    def get_provider(
        self,
        provider_id: str,
    ) -> Optional[Dict[str, Any]]:
        for provider in self.get_providers(
            enabled_only=False
        ):
            if provider.get("id") == provider_id:
                return provider

        return None

    # ------------------------------------------------------------------
    # SESSION / TEMPORARY KERNEL
    # ------------------------------------------------------------------

    def create_session(
        self,
        language: str = "es",
    ) -> SessionState:
        session_id = uuid.uuid4().hex

        session = SessionState(
            session_id=session_id,
            language=(
                "en"
                if language == "en"
                else "es"
            ),
            current_step="opening",
        )

        self.sessions[session_id] = session

        return deepcopy(session)

    def get_session(
        self,
        session_id: str,
    ) -> Optional[SessionState]:
        session = self.sessions.get(
            session_id
        )

        if session is None:
            return None

        return deepcopy(session)

    def update_session(
        self,
        session_id: str,
        **updates: Any,
    ) -> SessionState:
        if session_id not in self.sessions:
            raise ValueError(
                "Session not found."
            )

        session = self.sessions[
            session_id
        ]

        data = session.model_dump()

        for key, value in updates.items():
            if key in data:
                data[key] = value

        updated = SessionState.model_validate(
            data
        )

        self.sessions[
            session_id
        ] = updated

        return deepcopy(updated)

    def clear_session(
        self,
        session_id: str,
    ) -> bool:
        return (
            self.sessions.pop(
                session_id,
                None,
            )
            is not None
        )

    def clear_all_sessions(self) -> None:
        self.sessions.clear()

    # ------------------------------------------------------------------
    # NEED INTERPRETATION
    # ------------------------------------------------------------------

    def parse_need(
        self,
        text: str,
        current_amount: Optional[float] = None,
        current_destination_country: Optional[str] = None,
        language: str = "es",
    ) -> ParsedNeed:
        original = self.clean_text(text) or ""

        amount = current_amount
        destination = self.normalize_country(
            current_destination_country
        )

        priority: Optional[str] = None
        urgency: Optional[str] = None
        delivery_method: Optional[str] = None

        lowered = original.lower()

        # --------------------------------------------------------------
        # AMOUNT
        # --------------------------------------------------------------

        if amount is None:
            amount = self._extract_amount(
                lowered
            )

        # --------------------------------------------------------------
        # COUNTRY
        # --------------------------------------------------------------

        if destination is None:
            destination = self._extract_country(
                lowered
            )

        # --------------------------------------------------------------
        # PRIORITY
        # --------------------------------------------------------------

        priority = self._extract_priority(
            lowered
        )

        # --------------------------------------------------------------
        # URGENCY
        # --------------------------------------------------------------

        urgency = self._extract_urgency(
            lowered
        )

        # --------------------------------------------------------------
        # DELIVERY METHOD
        # --------------------------------------------------------------

        delivery_method = (
            self._extract_delivery_method(
                lowered
            )
        )

        missing = []

        if amount is None:
            missing.append("amount")

        if destination is None:
            missing.append("destination_country")

        confidence = self._calculate_parse_confidence(
            amount=amount,
            destination=destination,
            priority=priority,
            urgency=urgency,
        )

        return ParsedNeed(
            amount=amount,
            send_currency="USD",
            destination_country=destination,
            priority=priority,
            urgency=urgency,
            delivery_method=delivery_method,
            special_need=(
                original
                if original
                else None
            ),
            original_text=(
                original
                if original
                else None
            ),
            missing_information=missing,
            confidence=confidence,
        )

    def _extract_amount(
        self,
        text: str,
    ) -> Optional[float]:
        patterns = [
            r"\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
            r"\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:usd|dólares|dolares|dollars)\b",
            r"\b(?:mandar|enviar|send|transfer)\s+(?:de\s+)?\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
        ]

        for pattern in patterns:
            match = re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            )

            if not match:
                continue

            raw = (
                match.group(1)
                .replace(",", "")
                .strip()
            )

            try:
                value = float(raw)

                if value > 0:
                    return value

            except ValueError:
                continue

        return None

    def _extract_country(
        self,
        text: str,
    ) -> Optional[str]:
        country_names = self.brain.get(
            "countries",
            {},
        ).get(
            "country_names",
            {},
        )

        aliases = {
            "mexico": "MX",
            "méxico": "MX",
            "mexicano": "MX",
            "mexicana": "MX",
            "argentina": "AR",
            "bolivia": "BO",
            "brasil": "BR",
            "brazil": "BR",
            "chile": "CL",
            "colombia": "CO",
            "colombian": "CO",
            "costa rica": "CR",
            "cuba": "CU",
            "dominicana": "DO",
            "república dominicana": "DO",
            "republica dominicana": "DO",
            "dominican republic": "DO",
            "ecuador": "EC",
            "el salvador": "SV",
            "guatemala": "GT",
            "honduras": "HN",
            "haití": "HT",
            "haiti": "HT",
            "nicaragua": "NI",
            "panamá": "PA",
            "panama": "PA",
            "paraguay": "PY",
            "perú": "PE",
            "peru": "PE",
            "uruguay": "UY",
            "venezuela": "VE",
        }

        for alias, code in aliases.items():
            if re.search(
                rf"\b{re.escape(alias)}\b",
                text,
                flags=re.IGNORECASE,
            ):
                return code

        for code, data in country_names.items():
            names = [
                data.get("es", ""),
                data.get("en", ""),
            ]

            for name in names:
                if name and re.search(
                    rf"\b{re.escape(name.lower())}\b",
                    text,
                    flags=re.IGNORECASE,
                ):
                    return code

        return None

    def _extract_priority(
        self,
        text: str,
    ) -> Optional[str]:
        mappings = {
            "fastest": [
                "rápido",
                "rapido",
                "rápida",
                "rapida",
                "fast",
                "quick",
            ],
            "save": [
                "ahorrar",
                "ahorro",
                "barato",
                "menos costo",
                "menos comisión",
                "menos comision",
                "save",
                "cheapest",
                "cheap",
            ],
            "recipient_gets_more": [
                "reciba más",
                "reciba mas",
                "recibir más",
                "recibir mas",
                "que reciba más",
                "que reciba mas",
                "más dinero",
                "mas dinero",
                "receive more",
            ],
            "urgent": [
                "urgente",
                "urgency",
                "urgent",
                "ahora",
                "ya",
                "hoy",
                "right now",
                "asap",
            ],
            "balanced": [
                "equilibrio",
                "balance",
                "mejor opción",
                "good balance",
            ],
            "compare_all": [
                "comparar",
                "compare",
                "comparación",
                "comparacion",
                "todas",
                "todo",
                "all options",
            ],
        }

        for priority, words in mappings.items():
            if any(
                word in text
                for word in words
            ):
                return priority

        return None

    def _extract_urgency(
        self,
        text: str,
    ) -> Optional[str]:
        if any(
            phrase in text
            for phrase in [
                "ahora mismo",
                "right now",
                "inmediatamente",
                "immediately",
                "ya",
            ]
        ):
            return "immediate"

        if any(
            phrase in text
            for phrase in [
                "hoy",
                "today",
            ]
        ):
            return "today"

        if any(
            phrase in text
            for phrase in [
                "mañana",
                "manana",
                "tomorrow",
            ]
        ):
            return "tomorrow"

        if any(
            phrase in text
            for phrase in [
                "esta semana",
                "this week",
            ]
        ):
            return "this_week"

        return None

    def _extract_delivery_method(
        self,
        text: str,
    ) -> Optional[str]:
        mappings = {
            "cash_pickup": [
                "efectivo",
                "cash",
                "recoger",
                "retiro",
                "pickup",
            ],
            "bank_account": [
                "cuenta bancaria",
                "cuenta de banco",
                "bank account",
                "banco",
            ],
            "debit_card": [
                "tarjeta de débito",
                "tarjeta de debito",
                "debit card",
            ],
            "mobile_wallet": [
                "billetera",
                "wallet",
                "monedero",
            ],
            "home_delivery": [
                "a domicilio",
                "delivery",
                "home delivery",
            ],
        }

        for method, words in mappings.items():
            if any(
                word in text
                for word in words
            ):
                return method

        return None

    @staticmethod
    def _calculate_parse_confidence(
        amount: Optional[float],
        destination: Optional[str],
        priority: Optional[str],
        urgency: Optional[str],
    ) -> float:
        score = 0.0

        if amount is not None:
            score += 0.35

        if destination is not None:
            score += 0.35

        if priority is not None:
            score += 0.15

        if urgency is not None:
            score += 0.15

        return round(
            min(score, 1.0),
            2,
        )

    # ------------------------------------------------------------------
    # WHAT INFORMATION IS ACTUALLY NEEDED?
    # ------------------------------------------------------------------

    def required_information(
        self,
        request: UserNeedRequest,
    ) -> List[str]:
        missing: List[str] = []

        if request.amount is None:
            missing.append("amount")

        if not request.destination_country:
            missing.append(
                "destination_country"
            )

        # No asking unnecessary questions here.
        # Delivery/payment are requested only when
        # the available options genuinely depend on them.

        return missing

    def can_compare(
        self,
        request: UserNeedRequest,
    ) -> bool:
        return len(
            self.required_information(
                request
            )
        ) == 0

    # ------------------------------------------------------------------
    # PROVIDER FILTERING
    # ------------------------------------------------------------------

    def candidate_provider_ids(
        self,
        destination_country: str,
    ) -> List[str]:
        if not self.country_supported(
            destination_country
        ):
            return []

        candidates = []

        for provider in self.get_providers():
            if not provider.get(
                "enabled",
                False,
            ):
                continue

            if provider.get(
                "coverage_must_be_verified_by_corridor",
                True,
            ):
                candidates.append(
                    provider["id"]
                )
            else:
                candidates.append(
                    provider["id"]
                )

        return candidates

    # ------------------------------------------------------------------
    # COMMERCIAL DATA
    # ------------------------------------------------------------------

    def get_verified_provider_data(
        self,
        provider: Dict[str, Any],
        destination_country: str,
    ) -> Optional[Dict[str, Any]]:
        """
        The initial brain intentionally contains no live fees/rates.

        This method accepts data only if a future provider-specific
        data layer has supplied it and marked it verified.

        No estimate is created here.
        """

        commercial = provider.get(
            "commercial_data",
            {},
        )

        if commercial.get(
            "status"
        ) != "verified":
            return None

        if not commercial.get(
            "source"
        ):
            return None

        if not commercial.get(
            "verified_at"
        ):
            return None

        return deepcopy(
            commercial
        )

    # ------------------------------------------------------------------
    # COMPARISON
    # ------------------------------------------------------------------

    def compare(
        self,
        request: ComparisonRequest,
    ) -> ComparisonResponse:
        destination = self.normalize_country(
            request.destination_country
        )

        if not self.country_supported(
            destination
        ):
            return ComparisonResponse(
                success=False,
                language=request.language,
                destination_country=destination,
                amount=request.amount,
                send_currency=request.send_currency,
                priority=request.priority,
                results=[],
                results_available=False,
                message=self._message(
                    "no_results",
                    request.language,
                ),
            )

        provider_ids = (
            request.provider_ids
            or self.candidate_provider_ids(
                destination
            )
        )

        results: List[
            ComparisonResult
        ] = []

        for provider_id in provider_ids:
            provider = self.get_provider(
                provider_id
            )

            if not provider:
                continue

            if not provider.get(
                "enabled",
                False,
            ):
                continue

            data = (
                self.get_verified_provider_data(
                    provider,
                    destination,
                )
            )

            # NEVER manufacture a commercial result.
            if not data:
                continue

            result = self._build_result(
                provider=provider,
                data=data,
                request=request,
            )

            if result:
                results.append(result)

        results = self._sort_results(
            results,
            request.priority,
        )

        if not results:
            return ComparisonResponse(
                success=True,
                language=request.language,
                destination_country=destination,
                amount=request.amount,
                send_currency=request.send_currency,
                priority=request.priority,
                results=[],
                results_available=False,
                message=self._message(
                    "no_results",
                    request.language,
                ),
                warning=(
                    "No verified commercial "
                    "data is currently available."
                ),
            )

        return ComparisonResponse(
            success=True,
            language=request.language,
            destination_country=destination,
            amount=request.amount,
            send_currency=request.send_currency,
            priority=request.priority,
            results=results,
            results_available=True,
            message=self._message(
                "results_ready",
                request.language,
            ),
            data_timestamp=self.now_iso(),
        )

    def _build_result(
        self,
        provider: Dict[str, Any],
        data: Dict[str, Any],
        request: ComparisonRequest,
    ) -> Optional[ComparisonResult]:
        if data.get("status") != "verified":
            return None

        amount_sent = request.amount

        recipient_amount = data.get(
            "recipient_amount"
        )

        fee = data.get("fee")
        exchange_rate = data.get(
            "exchange_rate"
        )

        return ComparisonResult(
            provider_id=provider["id"],
            provider_name=provider["name"],
            amount_sent=amount_sent,
            send_currency=request.send_currency,
            fee=fee,
            exchange_rate=exchange_rate,
            recipient_amount=recipient_amount,
            recipient_currency=(
                self._country_currency(
                    request.destination_country
                )
            ),
            delivery_method=(
                request.delivery_method
            ),
            payment_method=(
                request.payment_method
            ),
            estimated_delivery=data.get(
                "delivery_time"
            ),
            availability=True,
            important_condition=None,
            source=data.get("source"),
            verified_at=data.get(
                "verified_at"
            ),
            status="verified",
            relevance_reason=self._relevance_reason(
                request.priority,
                request.language,
            ),
            continue_url=provider.get(
                "official_site"
            ),
        )

    def _sort_results(
        self,
        results: List[ComparisonResult],
        priority: Optional[str],
    ) -> List[ComparisonResult]:
        """
        Sorting only happens among verified results.

        This is NOT a global 'best provider' ranking.
        It merely orders verified options according
        to the user's selected need.
        """

        if not results:
            return results

        priority = priority or "balanced"

        def value(
            item: ComparisonResult,
            key: str,
        ) -> float:
            raw = getattr(
                item,
                key,
                None,
            )

            if raw is None:
                return -1.0

            try:
                return float(raw)
            except (
                TypeError,
                ValueError,
            ):
                return -1.0

        if priority in (
            "recipient_gets_more",
        ):
            return sorted(
                results,
                key=lambda x: value(
                    x,
                    "recipient_amount",
                ),
                reverse=True,
            )

        if priority == "save":
            return sorted(
                results,
                key=lambda x: (
                    value(x, "fee")
                    if x.fee is not None
                    else float("inf")
                ),
            )

        # For speed we can only sort by a verified
        # numeric delivery field if one exists.
        # Text such as "today" is never guessed.
        if priority in (
            "fastest",
            "urgent",
        ):
            return sorted(
                results,
                key=lambda x: (
                    self._delivery_rank(
                        x.estimated_delivery
                    )
                ),
            )

        return results

    @staticmethod
    def _delivery_rank(
        value: Optional[str],
    ) -> int:
        if not value:
            return 999999

        text = value.lower()

        if (
            "instant" in text
            or "immediate" in text
            or "instantáneo" in text
            or "instantanea" in text
            or "instantánea" in text
        ):
            return 0

        if (
            "minutes" in text
            or "minutos" in text
        ):
            return 1

        if (
            "hour" in text
            or "hora" in text
        ):
            return 2

        if (
            "today" in text
            or "hoy" in text
        ):
            return 3

        if (
            "day" in text
            or "día" in text
            or "dia" in text
        ):
            return 4

        return 999999

    def _country_currency(
        self,
        country_code: str,
    ) -> Optional[str]:
        country = self.get_country(
            country_code
        )

        if not country:
            return None

        return country.get(
            "currency"
        )

    def _relevance_reason(
        self,
        priority: Optional[str],
        language: str,
    ) -> Optional[str]:
        reasons = {
            "fastest": {
                "es": "Prioriza rapidez",
                "en": "Prioritizes speed",
            },
            "urgent": {
                "es": "Pensada para urgencia",
                "en": "Focused on urgency",
            },
            "save": {
                "es": "Prioriza costo",
                "en": "Prioritizes cost",
            },
            "recipient_gets_more": {
                "es": "Prioriza lo que recibe",
                "en": "Prioritizes recipient amount",
            },
            "balanced": {
                "es": "Equilibra varios factores",
                "en": "Balances several factors",
            },
            "compare_all": {
                "es": "Comparación general",
                "en": "General comparison",
            },
        }

        if not priority:
            return None

        return reasons.get(
            priority,
            {},
        ).get(
            language,
            reasons.get(
                priority,
                {},
            ).get("es"),
        )

    # ------------------------------------------------------------------
    # FINAL CHECK
    # ------------------------------------------------------------------

    def final_check(
        self,
        request: FinalCheckRequest,
    ) -> FinalCheckResponse:
        checks: List[
            FinalCheckItem
        ] = []

        checks.append(
            self._check(
                "destination",
                request.destination_country,
                request.language,
            )
        )

        checks.append(
            self._check(
                "amount",
                request.amount,
                request.language,
            )
        )

        checks.append(
            self._check(
                "currency",
                request.send_currency,
                request.language,
            )
        )

        checks.append(
            self._check(
                "delivery_method",
                request.delivery_method,
                request.language,
            )
        )

        checks.append(
            self._check(
                "recipient_information",
                request.recipient_information_entered,
                request.language,
            )
        )

        checks.append(
            self._check(
                "fee",
                request.fee,
                request.language,
            )
        )

        checks.append(
            self._check(
                "exchange_rate",
                request.exchange_rate,
                request.language,
            )
        )

        checks.append(
            self._check(
                "recipient_amount",
                request.recipient_amount,
                request.language,
            )
        )

        blocking = [
            item
            for item in checks
            if item.status in (
                "review",
                "unavailable",
            )
        ]

        ready = len(blocking) == 0

        language = request.language

        if ready:
            message = {
                "es": (
                    "Todo está listo para revisar "
                    "antes de continuar."
                ),
                "en": (
                    "Everything is ready for review "
                    "before continuing."
                ),
            }.get(language)
        else:
            message = {
                "es": (
                    "Revisa los datos marcados antes "
                    "de continuar."
                ),
                "en": (
                    "Review the marked details before "
                    "continuing."
                ),
            }.get(language)

        return FinalCheckResponse(
            success=True,
            ready_to_continue=ready,
            language=language,
            provider_id=request.provider_id,
            checks=checks,
            message=message,
        )

    def _check(
        self,
        check_id: str,
        value: Any,
        language: str,
    ) -> FinalCheckItem:
        labels = {
            "destination": {
                "es": "País de destino",
                "en": "Destination country",
            },
            "amount": {
                "es": "Cantidad",
                "en": "Amount",
            },
            "currency": {
                "es": "Moneda",
                "en": "Currency",
            },
            "delivery_method": {
                "es": "Forma de entrega",
                "en": "Delivery method",
            },
            "recipient_information": {
                "es": "Datos del destinatario",
                "en": "Recipient information",
            },
            "fee": {
                "es": "Cargo",
                "en": "Fee",
            },
            "exchange_rate": {
                "es": "Tasa de cambio",
                "en": "Exchange rate",
            },
            "recipient_amount": {
                "es": "Cantidad que recibe",
                "en": "Recipient amount",
            },
        }

        label = labels.get(
            check_id,
            {},
        ).get(
            language,
            check_id,
        )

        if value is None or value == "":
            return FinalCheckItem(
                id=check_id,
                label=label,
                value=None,
                status="unavailable",
            )

        if value is False:
            return FinalCheckItem(
                id=check_id,
                label=label,
                value="false",
                status="review",
            )

        if isinstance(value, bool):
            return FinalCheckItem(
                id=check_id,
                label=label,
                value="true",
                status="ok",
            )

        return FinalCheckItem(
            id=check_id,
            label=label,
            value=str(value),
            status="ok",
        )

    # ------------------------------------------------------------------
    # USER REQUEST -> SESSION
    # ------------------------------------------------------------------

    def apply_user_need(
        self,
        session_id: str,
        request: UserNeedRequest,
    ) -> SessionState:
        if session_id not in self.sessions:
            raise ValueError(
                "Session not found."
            )

        data = request.model_dump(
            exclude_none=True
        )

        updates: Dict[str, Any] = {}

        for field in [
            "amount",
            "send_currency",
            "destination_country",
            "priority",
            "urgency",
            "delivery_method",
            "payment_method",
            "special_need",
        ]:
            if field in data:
                updates[field] = data[field]

        if request.free_text:
            updates[
                "parsed_user_need"
            ] = request.free_text

        missing = self.required_information(
            request
        )

        if missing:
            updates[
                "current_step"
            ] = "collect_missing_information"
        else:
            updates[
                "current_step"
            ] = "comparison"

            updates[
                "candidate_providers"
            ] = self.candidate_provider_ids(
                request.destination_country
            )

        return self.update_session(
            session_id,
            **updates,
        )

    # ------------------------------------------------------------------
    # FREE TEXT -> SESSION
    # ------------------------------------------------------------------

    def apply_free_text(
        self,
        session_id: str,
        text: str,
        language: str = "es",
    ) -> Tuple[
        SessionState,
        ParsedNeed,
    ]:
        session = self.get_session(
            session_id
        )

        if not session:
            raise ValueError(
                "Session not found."
            )

        parsed = self.parse_need(
            text=text,
            current_amount=session.amount,
            current_destination_country=(
                session.destination_country
            ),
            language=language,
        )

        updates: Dict[str, Any] = {
            "language": (
                "en"
                if language == "en"
                else "es"
            ),
            "parsed_user_need": text,
            "amount": parsed.amount,
            "send_currency": (
                parsed.send_currency
            ),
            "destination_country": (
                parsed.destination_country
            ),
            "priority": parsed.priority,
            "urgency": parsed.urgency,
            "delivery_method": (
                parsed.delivery_method
            ),
        }

        if parsed.missing_information:
            updates[
                "current_step"
            ] = "collect_missing_information"
        else:
            updates[
                "current_step"
            ] = "comparison"

            updates[
                "candidate_providers"
            ] = self.candidate_provider_ids(
                parsed.destination_country
            )

        updated = self.update_session(
            session_id,
            **updates,
        )

        return updated, parsed

    # ------------------------------------------------------------------
    # OPTION SELECTION
    # ------------------------------------------------------------------

    def select_option(
        self,
        session_id: str,
        option: ComparisonResult,
    ) -> SessionState:
        session = self.get_session(
            session_id
        )

        if not session:
            raise ValueError(
                "Session not found."
            )

        if option.status != "verified":
            raise ValueError(
                "Only verified options can be selected."
            )

        provider = self.get_provider(
            option.provider_id
        )

        if not provider:
            raise ValueError(
                "Provider not found."
            )

        updated = self.update_session(
            session_id,
            selected_option=option,
            current_step="final_check",
        )

        return updated

    # ------------------------------------------------------------------
    # HELP / CURRENT STEP
    # ------------------------------------------------------------------

    def help_current_step(
        self,
        session_id: str,
        language: Optional[str] = None,
    ) -> str:
        session = self.get_session(
            session_id
        )

        if not session:
            return {
                "es": (
                    "Podemos comenzar de nuevo."
                ),
                "en": (
                    "We can start again."
                ),
            }.get(
                language or "es"
            )

        lang = language or session.language

        messages = {
            "opening": {
                "es": (
                    "Dime cuánto quieres enviar "
                    "y qué es lo más importante "
                    "para ti."
                ),
                "en": (
                    "Tell me how much you want to "
                    "send and what matters most "
                    "to you."
                ),
            },
            "collect_missing_information": {
                "es": (
                    "Solo necesito el dato que falta "
                    "para buscar opciones."
                ),
                "en": (
                    "I only need the missing information "
                    "to look for options."
                ),
            },
            "comparison": {
                "es": (
                    "Aquí puedes comparar las opciones "
                    "que pudimos verificar."
                ),
                "en": (
                    "Here you can compare the options "
                    "we were able to verify."
                ),
            },
            "final_check": {
                "es": (
                    "Estamos revisando los datos "
                    "antes de que continúes."
                ),
                "en": (
                    "We are reviewing the details "
                    "before you continue."
                ),
            },
        }

        return messages.get(
            session.current_step,
            messages["opening"],
        ).get(
            lang,
            messages["opening"]["es"],
        )

    # ------------------------------------------------------------------
    # BRAIN INFORMATION FOR FRONTEND
    # ------------------------------------------------------------------

    def client_configuration(
        self,
        language: str = "es",
    ) -> Dict[str, Any]:
        """
        Returns ONLY the configuration the frontend
        is allowed to know.

        Internal rules, raw kernel, security settings
        and internal processing are deliberately excluded.
        """

        opening = self.brain.get(
            "opening",
            {}
        )

        priorities = opening.get(
            "priorities",
            []
        )

        countries = self.brain.get(
            "countries",
            {}
        ).get(
            "country_names",
            {}
        )

        public_countries = []

        for code, data in countries.items():
            public_countries.append(
                {
                    "code": code,
                    "name": data.get(
                        language,
                        data.get("es"),
                    ),
                    "currency": data.get(
                        "currency"
                    ),
                }
            )

        providers = []

        for provider in self.get_providers():
            providers.append(
                {
                    "id": provider.get(
                        "id"
                    ),
                    "name": provider.get(
                        "name"
                    ),
                }
            )

        return {
            "app": {
                "name": self.brain.get(
                    "app",
                    {}
                ).get(
                    "name",
                    "REMESAS",
                ),
                "version": self.brain.get(
                    "app",
                    {}
                ).get(
                    "version"
                ),
                "language": language,
            },
            "opening": {
                "primary_question": (
                    opening.get(
                        "primary_question",
                        {},
                    ).get(
                        language,
                        opening.get(
                            "primary_question",
                            {},
                        ).get("es"),
                    )
                ),
                "secondary_text": (
                    opening.get(
                        "secondary_text",
                        {},
                    ).get(
                        language,
                        opening.get(
                            "secondary_text",
                            {},
                        ).get("es"),
                    )
                ),
                "amount": opening.get(
                    "amount",
                    {},
                ),
                "priorities": priorities,
                "free_text": opening.get(
                    "free_text",
                    {},
                ),
            },
            "countries": public_countries,
            "providers": providers,
            "delivery_methods": self._public_localized_list(
                "delivery_methods",
                language,
            ),
            "payment_methods": self._public_localized_list(
                "payment_methods",
                language,
            ),
            "ui": {
                "design": self.brain.get(
                    "ui",
                    {},
                ).get(
                    "design",
                    {},
                ),
                "navigation": self.brain.get(
                    "ui",
                    {},
                ).get(
                    "navigation",
                    {},
                ),
                "help": self.brain.get(
                    "ui",
                    {},
                ).get(
                    "help",
                    {},
                ),
            },
        }

    def _public_localized_list(
        self,
        section: str,
        language: str,
    ) -> List[Dict[str, Any]]:
        items = self.brain.get(
            section,
            []
        )

        result = []

        for item in items:
            result.append(
                {
                    "id": item.get(
                        "id"
                    ),
                    "label": item.get(
                        "label",
                        {},
                    ).get(
                        language,
                        item.get(
                            "label",
                            {},
                        ).get("es"),
                    ),
                }
            )

        return result

    # ------------------------------------------------------------------
    # SAFE PUBLIC BRAIN VERSION
    # ------------------------------------------------------------------

    def brain_info(self) -> Dict[str, Any]:
        app = self.brain.get(
            "app",
            {}
        )

        return {
            "version": app.get(
                "version"
            ),
            "schema_version": app.get(
                "schema_version"
            ),
            "name": app.get(
                "name"
            ),
            "language": app.get(
                "default_language",
                "es",
            ),
        }

    # ------------------------------------------------------------------
    # SAFE RESET
    # ------------------------------------------------------------------

    def reset_user_session(
        self,
        session_id: str,
    ) -> bool:
        return self.clear_session(
            session_id
        )


# ----------------------------------------------------------------------
# SINGLE ENGINE INSTANCE
# ----------------------------------------------------------------------

engine = RemittanceEngine()


# ----------------------------------------------------------------------
# SIMPLE MODULE-LEVEL FUNCTIONS
# ----------------------------------------------------------------------
# These make main.py cleaner and avoid exposing the internal class
# unnecessarily.

def create_session(
    language: str = "es",
) -> SessionState:
    return engine.create_session(
        language
    )


def get_session(
    session_id: str,
) -> Optional[SessionState]:
    return engine.get_session(
        session_id
    )


def parse_need(
    text: str,
    current_amount: Optional[float] = None,
    current_destination_country: Optional[str] = None,
    language: str = "es",
) -> ParsedNeed:
    return engine.parse_need(
        text=text,
        current_amount=current_amount,
        current_destination_country=(
            current_destination_country
        ),
        language=language,
    )


def compare(
    request: ComparisonRequest,
) -> ComparisonResponse:
    return engine.compare(
        request
    )


def final_check(
    request: FinalCheckRequest,
) -> FinalCheckResponse:
    return engine.final_check(
        request
    )


def client_configuration(
    language: str = "es",
) -> Dict[str, Any]:
    return engine.client_configuration(
        language
    )


def brain_info() -> Dict[str, Any]:
    return engine.brain_info()
