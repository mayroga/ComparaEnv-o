from typing import Any,Dict,List,Literal,Optional
from pydantic import BaseModel,ConfigDict,Field,field_validator

Language=Literal["es","en"]
Priority=Literal["fastest","save","recipient_gets_more","urgent","balanced","compare_all","other"]
DeliveryMethod=Literal["bank_account","cash_pickup","debit_card","mobile_wallet","home_delivery","other"]
PaymentMethod=Literal["bank_account","debit_card","credit_card","cash","digital_wallet"]
DataStatus=Literal["verified","stale","unavailable","restricted","not_applicable"]
Urgency=Literal["now","today","soon","normal","flexible","unknown"]
QuestionType=Literal["required","useful","optional"]

class StrictModel(BaseModel):
    model_config=ConfigDict(extra="ignore",str_strip_whitespace=True,validate_assignment=True)

class Money(StrictModel):
    amount:float=Field(ge=0)
    currency:str=Field(min_length=3,max_length=10)

class Verification(StrictModel):
    status:DataStatus
    source:Optional[str]=None
    verified_at:Optional[str]=None
    expires_at:Optional[str]=None
    note:Optional[str]=None

class ProviderQuote(StrictModel):
    provider_id:str
    provider_name:str
    origin_country:str="US"
    destination_country:str
    send_amount:float=Field(gt=0)
    send_currency:str
    recipient_currency:Optional[str]=None
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    delivery_method:Optional[DeliveryMethod]=None
    delivery_time:Optional[str]=None
    payment_method:Optional[PaymentMethod]=None
    verification:Verification
    important_conditions:List[str]=Field(default_factory=list)
    official_url:Optional[str]=None

class ProviderOption(StrictModel):
    provider_id:str
    provider_name:str
    enabled:bool=True
    available:bool=False
    official_url:Optional[str]=None
    delivery_methods:List[DeliveryMethod]=Field(default_factory=list)
    payment_methods:List[PaymentMethod]=Field(default_factory=list)
    commercial_data_status:DataStatus="unavailable"
    quote:Optional[ProviderQuote]=None
    compatibility:Literal["compatible","conditional","not_compatible","unknown"]="unknown"
    compatibility_reasons:List[str]=Field(default_factory=list)
    important_conditions:List[str]=Field(default_factory=list)

class UserNeedRequest(StrictModel):
    language:Language="es"
    amount:Optional[float]=Field(default=None,gt=0)
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Priority="balanced"
    urgency:Urgency="unknown"
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=None
    free_text:Optional[str]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None

class ParseNeedRequest(StrictModel):
    text:str=Field(min_length=1,max_length=5000)
    language:Language="es"
    current_amount:Optional[float]=Field(default=None,gt=0)
    current_destination:Optional[str]=None

class MissingInformation(StrictModel):
    field:str
    label:str
    reason:str
    question_type:QuestionType="required"
    affects_options:bool=True

class DetectedContext(StrictModel):
    amount:Optional[float]=None
    currency:Optional[str]=None
    destination_country:Optional[str]=None
    priority:Priority="balanced"
    urgency:Urgency="unknown"
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    special_need:Optional[str]=None

class ParsedNeed(StrictModel):
    amount:Optional[float]=None
    currency:str="USD"
    destination_country:Optional[str]=None
    priority:Priority="balanced"
    urgency:Urgency="unknown"
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    original_text:Optional[str]=None
    detected_context:DetectedContext=Field(default_factory=DetectedContext)
    missing_information:List[MissingInformation]=Field(default_factory=list)
    confidence:float=Field(default=0.0,ge=0,le=1)

class Constraint(StrictModel):
    type:str
    value:Optional[str]=None
    description:str
    effect:str
    verified:bool=False

class DecisionFactor(StrictModel):
    factor:str
    value:Optional[str]=None
    importance:Literal["high","medium","low"]="medium"
    explanation:str

class NeedAnalysis(StrictModel):
    principal_need:str
    context_summary:str
    constraints:List[Constraint]=Field(default_factory=list)
    decision_factors:List[DecisionFactor]=Field(default_factory=list)
    missing_information:List[MissingInformation]=Field(default_factory=list)
    compatible_delivery_methods:List[DeliveryMethod]=Field(default_factory=list)
    compatible_payment_methods:List[PaymentMethod]=Field(default_factory=list)
    analysis_notes:List[str]=Field(default_factory=list)

class ComparisonRequest(StrictModel):
    amount:float=Field(gt=0)
    currency:str="USD"
    destination_country:str
    priority:Priority="balanced"
    urgency:Urgency="unknown"
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=None
    provider_ids:Optional[List[str]]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None

class CostSummary(StrictModel):
    amount_sent:float
    send_currency:str
    fee:Optional[float]=None
    total_out_of_pocket:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    recipient_currency:Optional[str]=None
    status:DataStatus="unavailable"
    explanation:Optional[str]=None

class Compatibility(StrictModel):
    status:Literal["compatible","conditional","not_compatible","unknown"]="unknown"
    reasons:List[str]=Field(default_factory=list)
    conditions_to_confirm:List[str]=Field(default_factory=list)

class ComparisonResult(StrictModel):
    provider_id:str
    provider_name:str
    compatibility:Compatibility=Field(default_factory=Compatibility)
    cost:CostSummary
    delivery_method:Optional[DeliveryMethod]=None
    estimated_delivery:Optional[str]=None
    payment_method:Optional[PaymentMethod]=None
    important_conditions:List[str]=Field(default_factory=list)
    verification:Verification
    official_url:Optional[str]=None
    why_it_appears:List[str]=Field(default_factory=list)
    what_to_confirm:List[str]=Field(default_factory=list)

class ComparisonResponse(StrictModel):
    language:Language="es"
    analysis:Optional[NeedAnalysis]=None
    results:List[ComparisonResult]=Field(default_factory=list)
    available_providers:List[ProviderOption]=Field(default_factory=list)
    verified_results:List[ComparisonResult]=Field(default_factory=list)
    unavailable_information:List[str]=Field(default_factory=list)
    explanation:List[str]=Field(default_factory=list)
    next_step:str="final_check"

class PreparationItem(StrictModel):
    id:str
    title:str
    description:str
    required:bool=True
    depends_on:Optional[str]=None

class RecipientInformation(StrictModel):
    full_name:Optional[str]=None
    phone:Optional[str]=None
    country:Optional[str]=None
    city:Optional[str]=None
    bank_name:Optional[str]=None
    bank_account:Optional[str]=None
    wallet:Optional[str]=None
    pickup_location:Optional[str]=None
    note:Optional[str]=None

class PreparationGuide(StrictModel):
    title:str
    introduction:str
    sender_items:List[PreparationItem]=Field(default_factory=list)
    recipient_items:List[PreparationItem]=Field(default_factory=list)
    provider_items:List[PreparationItem]=Field(default_factory=list)
    before_start:List[str]=Field(default_factory=list)
    before_payment:List[str]=Field(default_factory=list)
    important_conditions:List[str]=Field(default_factory=list)

class GuideStep(StrictModel):
    number:int=Field(ge=1)
    title:str
    instruction:str
    what_to_enter:Optional[str]=None
    what_to_select:Optional[str]=None
    what_to_check:Optional[str]=None
    note:Optional[str]=None

class SendGuide(StrictModel):
    title:str
    provider_name:Optional[str]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    steps:List[GuideStep]=Field(default_factory=list)
    documents_or_information:List[str]=Field(default_factory=list)
    recipient_information:List[str]=Field(default_factory=list)
    warnings:List[str]=Field(default_factory=list)

class FinalCheckItem(StrictModel):
    key:str
    label:str
    value:Optional[Any]=None
    required:bool=True
    verified:bool=False
    status:Literal["ok","missing","verify","not_applicable"]="verify"
    explanation:Optional[str]=None

class FinalCheckRequest(StrictModel):
    amount:float=Field(gt=0)
    currency:str="USD"
    destination_country:str
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    provider_id:Optional[str]=None
    recipient_information:Optional[RecipientInformation]=None
    confirmed_items:List[str]=Field(default_factory=list)

class FinalCheckResponse(StrictModel):
    ready_to_continue:bool=False
    items:List[FinalCheckItem]=Field(default_factory=list)
    missing_items:List[str]=Field(default_factory=list)
    items_to_verify:List[str]=Field(default_factory=list)
    warnings:List[str]=Field(default_factory=list)
    provider_name:Optional[str]=None
    official_url:Optional[str]=None
    message:str=""
    next_step:str="review"

class SessionState(StrictModel):
    session_id:str
    language:Language="es"
    current_step:str="opening"
    amount:Optional[float]=None
    send_currency:str="USD"
    destination:Optional[str]=None
    priority:Priority="balanced"
    urgency:Urgency="unknown"
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=None
    recipient_has_bank_account:Optional[bool]=None
    recipient_has_mobile_wallet:Optional[bool]=None
    first_transfer:Optional[bool]=None
    recurring_transfer:Optional[bool]=None
    parsed_user_need:Optional[ParsedNeed]=None
    detected_context:Optional[DetectedContext]=None
    need_analysis:Optional[NeedAnalysis]=None
    candidate_providers:List[ProviderOption]=Field(default_factory=list)
    available_providers:List[ProviderOption]=Field(default_factory=list)
    verified_results:List[ComparisonResult]=Field(default_factory=list)
    comparison_results:List[ComparisonResult]=Field(default_factory=list)
    preparation:Optional[PreparationGuide]=None
    send_guide:Optional[SendGuide]=None
    selected_option:Optional[ProviderOption]=None
    final_check:Optional[FinalCheckResponse]=None

class SessionResponse(StrictModel):
    session:SessionState

class LocalData(StrictModel):
    language:Language="es"
    preferences:Dict[str,Any]=Field(default_factory=dict)
    consent:bool=False

class BrainValidationResponse(StrictModel):
    valid:bool
    version:str
    missing_sections:List[str]=Field(default_factory=list)
    errors:List[str]=Field(default_factory=list)

class HealthResponse(StrictModel):
    status:str="ok"
    app:str="REMESAS"
    version:str="1.0.0"

class HelpResponse(StrictModel):
    title:str
    message:str
    topics:List[str]=Field(default_factory=list)

class PublicConfig(StrictModel):
    app:Dict[str,Any]=Field(default_factory=dict)
    opening:Dict[str,Any]=Field(default_factory=dict)
    priorities:List[Dict[str,Any]]=Field(default_factory=list)
    countries:List[Dict[str,Any]]=Field(default_factory=list)
    providers:List[Dict[str,Any]]=Field(default_factory=list)
    delivery_methods:List[Dict[str,Any]]=Field(default_factory=list)
    payment_methods:List[Dict[str,Any]]=Field(default_factory=list)
    messages:Dict[str,Any]=Field(default_factory=dict)
    provider_handoff:Dict[str,Any]=Field(default_factory=dict)
    preparation:Dict[str,Any]=Field(default_factory=dict)
    guide:Dict[str,Any]=Field(default_factory=dict)
