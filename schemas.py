# schemas.py — REMESAS | May Roga LLC | v4.3.0
from typing import Any,Dict,List,Literal,Optional
from pydantic import BaseModel,ConfigDict,Field,AliasChoices,field_validator

Language=Literal["es","en"]
Priority=Literal["fastest","save","recipient_gets_more","urgent","balanced","compare_all","other"]
DeliveryMethod=Literal["bank_account","cash_pickup","debit_card","mobile_wallet","home_delivery","other"]
PaymentMethod=Literal["bank_account","debit_card","credit_card","cash","digital_wallet"]
DataStatus=Literal["verified","stale","unavailable","restricted","not_applicable"]

class StrictModel(BaseModel):
    model_config=ConfigDict(extra="ignore",str_strip_whitespace=True,validate_assignment=True,populate_by_name=True)

class MoneyValue(StrictModel):
    amount:Optional[float]=None
    currency:str="USD"

class VerificationData(StrictModel):
    status:DataStatus="unavailable"
    source:Optional[str]=None
    verified_at:Optional[str]=None
    expires_at:Optional[str]=None
    notes:Optional[str]=None

class ProviderCommercialData(StrictModel):
    status:DataStatus="unavailable"
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    recipient_currency:Optional[str]=None
    estimated_delivery:Optional[str]=None
    delivery_time:Optional[str]=None
    source:Optional[str]=None
    verified_at:Optional[str]=None
    currency:str="USD"
    notes:Optional[str]=None

class ProviderSchema(StrictModel):
    id:str
    name:Any
    aliases:List[str]=Field(default_factory=list)
    countries:List[str]=Field(default_factory=list)
    payment_methods:List[Any]=Field(default_factory=list)
    delivery_methods:List[Any]=Field(default_factory=list)
    official_site:Optional[str]=None
    official_urls:Dict[str,Any]=Field(default_factory=dict)
    commercial:Optional[ProviderCommercialData]=None
    commercial_data:Optional[ProviderCommercialData]=None
    verification:Optional[VerificationData]=None
    commercial_status:Optional[DataStatus]=None
    commercial_verified:bool=False

class CountrySchema(StrictModel):
    id:str
    code:Optional[str]=None
    name:Any
    aliases:List[str]=Field(default_factory=list)
    currency:Optional[str]=None
    providers:List[str]=Field(default_factory=list)

class UserNeedRequest(StrictModel):
    language:Language="es"
    amount:Optional[float]=None
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_amount_target:Optional[float]=None
    frequency:Optional[str]=None
    special_need:Optional[str]=None
    free_text:Optional[str]=None
    need_type:Optional[str]=None
    parsed_user_need:Optional[Dict[str,Any]]=None

    @field_validator("amount","recipient_amount_target")
    @classmethod
    def positive_numbers(cls,v):
        if v is not None and v<0: raise ValueError("Amount cannot be negative.")
        return v

class ParseNeedRequest(StrictModel):
    language:Language="es"
    text:str=""
    current_amount:Optional[float]=None
    current_destination_country:Optional[str]=None

class ParsedNeed(StrictModel):
    need_type:str="other"
    amount:Optional[float]=None
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_amount_target:Optional[float]=None
    frequency:Optional[str]=None
    special_need:Optional[str]=None
    original_text:Optional[str]=None
    raw_text:Optional[str]=None
    missing_information:List[str]=Field(default_factory=list)
    confidence:Optional[float]=None

class ComparisonRequest(StrictModel):
    language:Language="es"
    amount:float
    send_currency:str="USD"
    destination_country:str
    priority:Optional[Priority]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_amount_target:Optional[float]=None
    frequency:Optional[str]=None
    special_need:Optional[str]=None
    provider_ids:List[str]=Field(default_factory=list)

    @field_validator("amount")
    @classmethod
    def valid_amount(cls,v):
        if v<=0: raise ValueError("Amount must be greater than zero.")
        return v

class ProviderOption(StrictModel):
    provider_id:str
    provider_name:Any
    country:str
    amount:float
    send_currency:str="USD"
    recipient_currency:Optional[str]=None
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    estimated_delivery:Optional[str]=None
    delivery_time:Optional[str]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    payment_methods:List[Any]=Field(default_factory=list)
    delivery_methods:List[Any]=Field(default_factory=list)
    commercial_status:DataStatus="unavailable"
    commercial_verified:bool=False
    official_site:Optional[str]=None
    official_urls:Dict[str,Any]=Field(default_factory=dict)
    continue_url:Optional[str]=None
    relevance_reason:Optional[str]=None
    status:Optional[str]=None
    notes:Optional[str]=None

class ComparisonResult(StrictModel):
    provider_id:str
    provider_name:Any
    status:DataStatus="unavailable"
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    recipient_currency:Optional[str]=None
    estimated_delivery:Optional[str]=None
    delivery_time:Optional[str]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    source:Optional[str]=None
    verified_at:Optional[str]=None
    continue_url:Optional[str]=None
    official_site:Optional[str]=None
    official_urls:Dict[str,Any]=Field(default_factory=dict)
    commercial_verified:bool=False
    commercial_status:DataStatus="unavailable"
    relevance_reason:Optional[str]=None
    explanation:Optional[str]=None
    notes:Optional[str]=None

class ComparisonResponse(StrictModel):
    success:bool=True
    language:Language="es"
    amount:Optional[float]=None
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[bool]=None
    available_providers:List[ProviderOption]=Field(default_factory=list)
    results:List[ComparisonResult]=Field(default_factory=list)
    verified_results:List[ComparisonResult]=Field(default_factory=list)
    verified_count:int=0
    results_available:bool=False
    explanation:Optional[str]=None
    message:Optional[str]=None

class FinalCheckItem(StrictModel):
    id:str
    label:Any
    status:Literal["ready","missing","warning","confirmed","unavailable"]="warning"
    value:Optional[Any]=None
    message:Optional[Any]=None
    required:bool=False

class FinalCheckRequest(StrictModel):
    language:Language="es"
    provider_id:Optional[str]=None
    amount:float=0
    send_currency:str=Field(default="USD",validation_alias=AliasChoices("send_currency","currency"))
    destination_country:str=Field(default="",validation_alias=AliasChoices("destination_country","destination"))
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_information_entered:bool=False
    recipient_amount:Optional[float]=None
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    checks:List[FinalCheckItem]=Field(default_factory=list)

    @field_validator("amount")
    @classmethod
    def final_amount(cls,v):
        if v<0: raise ValueError("Amount cannot be negative.")
        return v

class FinalCheckResponse(StrictModel):
    success:bool=True
    ready_to_continue:bool=False
    language:Language="es"
    provider_id:Optional[str]=None
    items:List[FinalCheckItem]=Field(default_factory=list)
    requirements:List[Any]=Field(default_factory=list)
    message:Optional[str]=None
    important_note:Optional[str]=None
    continue_url:Optional[str]=None
    official_site:Optional[str]=None

class SessionState(StrictModel):
    session_id:str
    language:Language="es"
    created_at:float
    updated_at:float
    current_step:str="opening"
    amount:Optional[float]=None
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_amount_target:Optional[float]=None
    frequency:Optional[str]=None
    special_need:Optional[str]=None
    free_text:Optional[str]=None
    need_type:Optional[str]=None
    parsed_user_need:Optional[Dict[str,Any]]=None
    candidate_providers:List[str]=Field(default_factory=list)
    available_providers:List[ProviderOption]=Field(default_factory=list)
    verified_results:List[ComparisonResult]=Field(default_factory=list)
    selected_option:Optional[ProviderOption]=None
    final_check:Optional[FinalCheckResponse]=None
    learning_provider:Optional[str]=None
    recipient_information_entered:bool=False

class SessionResponse(StrictModel):
    success:bool=True
    session:SessionState
    message:Optional[str]=None

class LocalStoragePreferences(StrictModel):
    language:Language="es"
    currency:str="USD"
    theme:Optional[str]=None

class DeleteLocalDataResponse(StrictModel):
    success:bool=True
    message:str

class BrainValidationResponse(StrictModel):
    success:bool=True
    valid:bool=True
    errors:List[str]=Field(default_factory=list)
    warnings:List[str]=Field(default_factory=list)
    version:Optional[str]=None

class HealthResponse(StrictModel):
    status:str="ok"
    app:str="REMESAS"
    version:str="4.3.0"
    engine_version:str="4.3.0"
    brain_loaded:bool=False
    brain_version:Optional[str]=None
    stripe_configured:bool=False
    service_price:float=10.99
    service_currency:str="USD"
    service_minutes:int=20
