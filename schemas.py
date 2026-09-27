# schemas.py — REMESAS | May Roga LLC
# Modelos de datos para la plataforma de comparación y asistencia de remesas.
# No contiene reglas comerciales, tarifas ni decisiones de proveedor.
# Esas reglas viven en data/app_brain.json y en el motor de remesas.

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


Language = Literal["es", "en"]
Priority = Literal[
    "fastest",
    "save",
    "recipient_gets_more",
    "urgent",
    "balanced",
    "compare_all",
    "other",
]
DeliveryMethod = Literal[
    "bank_account",
    "cash_pickup",
    "debit_card",
    "mobile_wallet",
    "home_delivery",
    "other",
]
PaymentMethod = Literal[
    "bank_account",
    "debit_card",
    "credit_card",
    "cash",
    "digital_wallet",
]
DataStatus = Literal[
    "verified",
    "stale",
    "unavailable",
    "restricted",
    "not_applicable",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class MoneyValue(StrictModel):
    amount: float = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


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
    commercial_data: ProviderCommercialData = Field(
        default_factory=ProviderCommercialData
    )


class CountrySchema(StrictModel):
    code: str = Field(min_length=2, max_length=3)
    name_es: str
    name_en: str
    currency: str = Field(min_length=3, max_length=3)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.upper()

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class UserNeedRequest(StrictModel):
    language: Language = "es"

    amount: Optional[float] = Field(
        default=None,
        ge=0,
        le=1_000_000,
    )

    send_currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
    )

    destination_country: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=3,
    )

    priority: Optional[Priority] = None

    urgency: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    delivery_method: Optional[DeliveryMethod] = None

    payment_method: Optional[PaymentMethod] = None

    special_need: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    free_text: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    @field_validator("send_currency")
    @classmethod
    def normalize_send_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("destination_country")
    @classmethod
    def normalize_destination(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.upper()


class ParseNeedRequest(StrictModel):
    language: Language = "es"

    text: str = Field(
        min_length=1,
        max_length=2000,
    )

    current_amount: Optional[float] = Field(
        default=None,
        ge=0,
    )

    current_destination_country: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=3,
    )


class ParsedNeed(StrictModel):
    amount: Optional[float] = Field(
        default=None,
        ge=0,
    )

    send_currency: str = "USD"

    destination_country: Optional[str] = None

    priority: Optional[Priority] = None

    urgency: Optional[str] = None

    delivery_method: Optional[DeliveryMethod] = None

    payment_method: Optional[PaymentMethod] = None

    special_need: Optional[str] = None

    original_text: Optional[str] = None

    missing_information: List[str] = Field(
        default_factory=list
    )

    confidence: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
    )

    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.upper()


class ComparisonRequest(StrictModel):
    language: Language = "es"

    amount: float = Field(
        gt=0,
        le=1_000_000,
    )

    send_currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
    )

    destination_country: str = Field(
        min_length=2,
        max_length=3,
    )

    priority: Optional[Priority] = None

    urgency: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    delivery_method: Optional[DeliveryMethod] = None

    payment_method: Optional[PaymentMethod] = None

    special_need: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    provider_ids: List[str] = Field(
        default_factory=list,
        max_length=50,
    )

    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: str) -> str:
        return value.upper()


class ProviderOption(StrictModel):
    provider_id: str
    provider_name: str

    amount_sent: Optional[float] = Field(
        default=None,
        ge=0,
    )

    send_currency: Optional[str] = None

    fee: Optional[float] = Field(
        default=None,
        ge=0,
    )

    exchange_rate: Optional[float] = Field(
        default=None,
        gt=0,
    )

    recipient_amount: Optional[float] = Field(
        default=None,
        ge=0,
    )

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

    @field_validator("send_currency", "recipient_currency")
    @classmethod
    def normalize_currency(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None
        return value.upper()


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

    @field_validator("send_currency", "recipient_currency")
    @classmethod
    def normalize_currency(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None
        return value.upper()


class ComparisonResponse(StrictModel):
    success: bool = True

    language: Language = "es"

    destination_country: Optional[str] = None

    amount: Optional[float] = None

    send_currency: str = "USD"

    priority: Optional[Priority] = None

    results: List[ComparisonResult] = Field(
        default_factory=list
    )

    results_available: bool = False

    message: Optional[str] = None

    data_timestamp: Optional[str] = None

    warning: Optional[str] = None

    @field_validator("destination_country")
    @classmethod
    def normalize_country(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None
        return value.upper()


class FinalCheckItem(StrictModel):
    id: str
    label: str
    value: Optional[str] = None
    status: Literal[
        "ok",
        "review",
        "unavailable",
        "not_required",
    ] = "review"


class FinalCheckRequest(StrictModel):
    language: Language = "es"

    provider_id: str

    amount: float = Field(
        gt=0,
        le=1_000_000,
    )

    send_currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
    )

    destination_country: str = Field(
        min_length=2,
        max_length=3,
    )

    delivery_method: Optional[DeliveryMethod] = None

    payment_method: Optional[PaymentMethod] = None

    recipient_amount: Optional[float] = Field(
        default=None,
        ge=0,
    )

    fee: Optional[float] = Field(
        default=None,
        ge=0,
    )

    exchange_rate: Optional[float] = Field(
        default=None,
        gt=0,
    )

    recipient_information_entered: bool = False

    checks: Dict[str, Any] = Field(
        default_factory=dict
    )

    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls, value: str) -> str:
        return value.upper()


class FinalCheckResponse(StrictModel):
    success: bool = True

    ready_to_continue: bool = False

    language: Language = "es"

    provider_id: Optional[str] = None

    checks: List[FinalCheckItem] = Field(
        default_factory=list
    )

    message: Optional[str] = None

    important_note: Optional[str] = None


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

    parsed_user_need: Optional[str] = None

    candidate_providers: List[str] = Field(
        default_factory=list
    )

    verified_results: List[ComparisonResult] = Field(
        default_factory=list
    )

    selected_option: Optional[ComparisonResult] = None

    final_check: Dict[str, Any] = Field(
        default_factory=dict
    )


class SessionResponse(StrictModel):
    success: bool = True

    session: SessionState

    message: Optional[str] = None


class LocalStoragePreferences(StrictModel):
    language: Language = "es"

    app_version: Optional[str] = None

    brain_version: Optional[str] = None

    preferences: Dict[str, Any] = Field(
        default_factory=dict
    )


class DeleteLocalDataResponse(StrictModel):
    success: bool = True

    message: str


class BrainValidationResponse(StrictModel):
    valid: bool

    version: Optional[str] = None

    schema_version: Optional[str] = None

    required_sections_present: bool = False

    errors: List[str] = Field(
        default_factory=list
    )

    warnings: List[str] = Field(
        default_factory=list
    )


class HealthResponse(StrictModel):
    status: str = "ok"

    app: str = "REMESAS"

    version: str = "1.0.0"

    brain_loaded: bool = False

    brain_version: Optional[str] = None
