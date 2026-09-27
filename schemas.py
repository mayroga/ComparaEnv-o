from enum import Enum
from typing import Any,Dict,List,Literal,Optional
from pydantic import BaseModel,Field

class Language(str,Enum):
    es="es"
    en="en"

class Priority(str,Enum):
    fastest="fastest"
    save="save"
    recipient_gets_more="recipient_gets_more"
    urgent="urgent"
    balanced="balanced"
    compare_all="compare_all"
    other="other"

class DeliveryMethod(str,Enum):
    bank_account="bank_account"
    cash_pickup="cash_pickup"
    debit_card="debit_card"
    mobile_wallet="mobile_wallet"
    home_delivery="home_delivery"
    other="other"

class PaymentMethod(str,Enum):
    bank_account="bank_account"
    debit_card="debit_card"
    credit_card="credit_card"
    cash="cash"
    digital_wallet="digital_wallet"

class DataStatus(str,Enum):
    verified="verified"
    unverified="unverified"
    unavailable="unavailable"
    expired="expired"

class Urgency(str,Enum):
    today="today"
    soon="soon"
    normal="normal"
    unknown="unknown"

class QuestionType(str,Enum):
    amount="amount"
    destination="destination"
    urgency="urgency"
    delivery_method="delivery_method"
    payment_method="payment_method"
    recipient_information="recipient_information"
    special_need="special_need"
    first_transfer="first_transfer"
    recurring_transfer="recurring_transfer"
    other="other"

class Money(BaseModel):
    amount:Optional[float]=None
    currency:Optional[str]=None

class Verification(BaseModel):
    status:DataStatus=DataStatus.unverified
    source:Optional[str]=None
    verified_at:Optional[str]=None
    expires_at:Optional[str]=None

class ProviderQuote(BaseModel):
    provider_id:str
    provider_name:Optional[str]=None
    origin_country:Optional[str]=None
    destination_country:Optional[str]=None
    send_amount:Optional[float]=None
    send_currency:Optional[str]=None
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    recipient_currency:Optional[str]=None
    total_out_of_pocket:Optional[float]=None
    delivery_method:Optional[DeliveryMethod]=None
    delivery_time:Optional[str]=None
    payment_method:Optional[PaymentMethod]=None
    conditions:List[str]=Field(default_factory=list)
    status:DataStatus=DataStatus.unverified
    source:Optional[str]=None
    verified_at:Optional[str]=None
    expires_at:Optional[str]=None

class Compatibility(BaseModel):
    status:Literal["compatible","conditional","incompatible"]="conditional"
    reason:Optional[str]=None
    matched_constraints:List[str]=Field(default_factory=list)
    unmet_constraints:List[str]=Field(default_factory=list)
    conditions:List[str]=Field(default_factory=list)

class ProviderOption(BaseModel):
    provider_id:str
    name:str
    official_url:Optional[str]=None
    enabled:bool=True
    compatibility:Compatibility=Field(default_factory=Compatibility)
    quote:Optional[ProviderQuote]=None
    commercial_data:Optional[Verification]=None
    delivery_methods:List[str]=Field(default_factory=list)
    payment_methods:List[str]=Field(default_factory=list)
    why_it_appears:Optional[str]=None
    what_to_confirm:List[str]=Field(default_factory=list)
    important_conditions:List[str]=Field(default_factory=list)

class UserNeedRequest(BaseModel):
    language:Language=Language.es
    amount:float=Field(gt=0)
    destination:str=Field(min_length=2)
    priority:Priority=Priority.balanced
    urgency:Optional[Urgency]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    free_text:Optional[str]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    special_need:Optional[str]=None

class ParseNeedRequest(BaseModel):
    language:Language=Language.es
    text:str=Field(min_length=1,max_length=5000)

class MissingInformation(BaseModel):
    field:QuestionType
    label:str
    question:str
    reason:Optional[str]=None
    required:bool=False

class DetectedContext(BaseModel):
    amount:Optional[float]=None
    destination:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[Urgency]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    special_need:Optional[str]=None
    recipient_amount_is_priority:bool=False
    speed_is_priority:bool=False
    cost_is_priority:bool=False
    cash_pickup_needed:bool=False
    bank_account_needed:bool=False
    wallet_needed:bool=False

class ParsedNeed(BaseModel):
    language:Language=Language.es
    raw_text:str
    amount:Optional[float]=None
    destination:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[Urgency]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    special_need:Optional[str]=None
    detected_context:DetectedContext=Field(default_factory=DetectedContext)
    missing_information:List[MissingInformation]=Field(default_factory=list)
    confidence:float=0.0

class Constraint(BaseModel):
    id:str
    label:str
    value:Any=None
    reason:Optional[str]=None
    source:Optional[str]=None
    affects_options:bool=True

class DecisionFactor(BaseModel):
    id:str
    name:str
    importance:Optional[str]=None
    reason:Optional[str]=None
    value:Any=None

class NeedAnalysis(BaseModel):
    summary:Optional[str]=None
    main_need:Optional[str]=None
    detected_context:DetectedContext=Field(default_factory=DetectedContext)
    constraints:List[Constraint]=Field(default_factory=list)
    decision_factors:List[DecisionFactor]=Field(default_factory=list)
    missing_information:List[MissingInformation]=Field(default_factory=list)
    compatible_delivery_methods:List[str]=Field(default_factory=list)
    compatible_payment_methods:List[str]=Field(default_factory=list)
    notes:List[str]=Field(default_factory=list)

class ComparisonRequest(BaseModel):
    language:Language=Language.es
    session_id:Optional[str]=None
    priority:Optional[Priority]=None
    provider_ids:List[str]=Field(default_factory=list)

class CostSummary(BaseModel):
    amount_sent:Optional[float]=None
    send_currency:Optional[str]=None
    fee:Optional[float]=None
    total_out_of_pocket:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    recipient_currency:Optional[str]=None
    status:DataStatus=DataStatus.unverified

class ComparisonResult(BaseModel):
    provider_id:str
    provider_name:str
    compatibility:Compatibility=Field(default_factory=Compatibility)
    quote:Optional[ProviderQuote]=None
    cost:CostSummary=Field(default_factory=CostSummary)
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    why_it_appears:Optional[str]=None
    what_to_confirm:List[str]=Field(default_factory=list)
    important_conditions:List[str]=Field(default_factory=list)
    official_url:Optional[str]=None

class ComparisonResponse(BaseModel):
    session_id:Optional[str]=None
    language:Language=Language.es
    summary:Optional[str]=None
    results:List[ComparisonResult]=Field(default_factory=list)
    compatible_count:int=0
    conditional_count:int=0
    incompatible_count:int=0
    verified_count:int=0
    unverified_count:int=0
    selected_provider_id:Optional[str]=None
    next_step:Optional[str]=None

class PreparationItem(BaseModel):
    id:str
    label:str
    description:Optional[str]=None
    required:bool=False
    category:Optional[str]=None

class RecipientInformation(BaseModel):
    full_name:Optional[str]=None
    phone:Optional[str]=None
    country:Optional[str]=None
    city:Optional[str]=None
    bank_name:Optional[str]=None
    bank_account:Optional[str]=None
    wallet:Optional[str]=None
    pickup_location:Optional[str]=None

class PreparationGuide(BaseModel):
    title:Optional[str]=None
    introduction:Optional[str]=None
    sender_items:List[Any]=Field(default_factory=list)
    recipient_items:List[Any]=Field(default_factory=list)
    provider_items:List[Any]=Field(default_factory=list)
    before_start:List[Any]=Field(default_factory=list)
    before_payment:List[Any]=Field(default_factory=list)
    important_conditions:List[Any]=Field(default_factory=list)
    recipient_information:Optional[RecipientInformation]=None

class GuideStep(BaseModel):
    id:str
    title:Optional[str]=None
    description:Optional[str]=None
    instruction:Optional[str]=None
    text:Optional[str]=None
    what_to_check:Optional[str]=None
    order:int=0

class SendGuide(BaseModel):
    title:Optional[str]=None
    introduction:Optional[str]=None
    steps:List[GuideStep]=Field(default_factory=list)
    rules:List[str]=Field(default_factory=list)

class FinalCheckItem(BaseModel):
    id:str
    label:str
    status:Literal["ok","missing","verify","not_applicable"]="verify"
    value:Any=None
    message:Optional[str]=None
    description:Optional[str]=None
    required:bool=True

class FinalCheckRequest(BaseModel):
    language:Language=Language.es
    provider_id:Optional[str]=None
    recipient:Optional[RecipientInformation]=None
    confirm_provider_data:bool=False

class FinalCheckResponse(BaseModel):
    session_id:Optional[str]=None
    language:Language=Language.es
    items:List[FinalCheckItem]=Field(default_factory=list)
    can_continue:bool=False
    ready:bool=False
    message:Optional[str]=None
    provider_id:Optional[str]=None
    provider_name:Optional[str]=None
    official_url:Optional[str]=None

class SessionState(BaseModel):
    session_id:str
    language:Language=Language.es
    created_at:str
    updated_at:str
    step:str="opening"
    amount:Optional[float]=None
    destination:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[Urgency]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    free_text:Optional[str]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    special_need:Optional[str]=None
    parsed_need:Optional[ParsedNeed]=None
    detected_context:Optional[DetectedContext]=None
    need_analysis:Optional[NeedAnalysis]=None
    comparison_results:List[ComparisonResult]=Field(default_factory=list)
    selected_provider_id:Optional[str]=None
    selected_provider:Optional[ProviderOption]=None
    preparation:Optional[PreparationGuide]=None
    send_guide:Optional[SendGuide]=None
    recipient:Optional[RecipientInformation]=None
    final_check:Optional[FinalCheckResponse]=None
    consent:bool=False

class SessionResponse(BaseModel):
    session:SessionState
    message:Optional[str]=None

class LocalData(BaseModel):
    language:Language=Language.es
    preferences:Dict[str,Any]=Field(default_factory=dict)
    consent:bool=False

class BrainValidationResponse(BaseModel):
    valid:bool
    version:Optional[str]=None
    missing_sections:List[str]=Field(default_factory=list)
    warnings:List[str]=Field(default_factory=list)

class HealthResponse(BaseModel):
    status:str="ok"
    app:str="REMESAS"
    version:Optional[str]=None

class HelpResponse(BaseModel):
    title:Optional[str]=None
    message:Optional[str]=None
    topics:List[str]=Field(default_factory=list)

class PublicConfig(BaseModel):
    app:Dict[str,Any]=Field(default_factory=dict)
    experience:Dict[str,Any]=Field(default_factory=dict)
    opening:Dict[str,Any]=Field(default_factory=dict)
    countries:Dict[str,Any]=Field(default_factory=dict)
    delivery_methods:List[Dict[str,Any]]=Field(default_factory=list)
    payment_methods:List[Dict[str,Any]]=Field(default_factory=list)
    languages:Dict[str,Any]=Field(default_factory=dict)
    providers:List[Dict[str,Any]]=Field(default_factory=list)
