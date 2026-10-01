from typing import Any,Dict,List,Literal,Optional
from pydantic import BaseModel,ConfigDict

Language=Literal["es","en"]
Priority=Literal["fastest","save","recipient_gets_more","urgent","balanced","compare_all","other"]
DeliveryMethod=Literal["bank_account","cash_pickup","debit_card","mobile_wallet","home_delivery","other"]
PaymentMethod=Literal["bank_account","debit_card","credit_card","cash","digital_wallet"]
DataStatus=Literal["verified","stale","unavailable","restricted","not_applicable"]

class StrictModel(BaseModel):
    model_config=ConfigDict(extra="ignore",str_strip_whitespace=True,validate_assignment=True)

class MoneyValue(StrictModel):
    amount:float=0
    currency:str="USD"

class VerificationData(StrictModel):
    status:DataStatus="unavailable"
    source:Optional[str]=None
    verified_at:Optional[str]=None
    country:Optional[str]=None
    notes:Optional[str]=None

class ProviderCommercialData(StrictModel):
    status:DataStatus="unavailable"
    fee:Optional[float]=None
    exchange_rate:Optional[Any]=None
    recipient_amount:Optional[float]=None
    estimated_delivery:Optional[str]=None
    availability:Optional[str]=None
    source:Optional[str]=None
    verified_at:Optional[str]=None
    country:Optional[str]=None
    currency:Optional[str]="USD"

class ProviderSchema(StrictModel):
    id:str
    name:Any
    official_urls:Dict[str,str]={}
    payment_methods:List[Any]=[]
    delivery_methods:List[Any]=[]
    countries:List[str]=[]
    commercial:Dict[str,Any]={}
    commercial_data:Dict[str,Any]={}
    status:Optional[str]=None
    description:Any=None

class CountrySchema(StrictModel):
    id:str
    name:Any
    code:Optional[str]=None
    aliases:List[str]=[]
    available_providers:List[str]=[]

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
    need_type:str="remittance"

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
    original_text:str=""
    raw_text:str=""
    missing_information:List[str]=[]
    confidence:float=0

class ComparisonRequest(StrictModel):
    language:Language="es"
    amount:float=0
    send_currency:str="USD"
    destination_country:str=""
    priority:Optional[Priority]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_amount_target:Optional[float]=None
    frequency:Optional[str]=None
    special_need:Optional[str]=None
    provider_ids:List[str]=[]

class ProviderOption(StrictModel):
    provider_id:str
    provider_name:Any
    country:str
    official_site:Optional[str]=None
    continue_url:Optional[str]=None
    payment_methods:List[Any]=[]
    delivery_methods:List[Any]=[]
    commercial_status:DataStatus="unavailable"
    commercial_verified:bool=False
    description:Any=None
    relevance_reason:Optional[str]=None

class ComparisonResult(StrictModel):
    provider_id:str
    provider_name:Any
    status:DataStatus="unavailable"
    fee:Optional[float]=None
    exchange_rate:Optional[Any]=None
    recipient_amount:Optional[float]=None
    estimated_delivery:Optional[str]=None
    availability:Optional[str]=None
    source:Optional[str]=None
    verified_at:Optional[str]=None
    relevance_reason:Optional[str]=None
    continue_url:Optional[str]=None
    notes:Optional[str]=None

class ComparisonResponse(StrictModel):
    session_id:Optional[str]=None
    amount:float=0
    send_currency:str="USD"
    destination_country:str=""
    available_providers:List[ProviderOption]=[]
    results:List[ComparisonResult]=[]
    verified_count:int=0
    results_available:bool=False
    explanation:str=""
    next_step:str=""
    missing_information:List[str]=[]

class FinalCheckItem(StrictModel):
    id:str
    label:str
    ok:bool
    message:str

class FinalCheckRequest(StrictModel):
    language:Language="es"
    provider_id:str=""
    amount:float=0
    send_currency:str="USD"
    destination_country:str=""
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_information_entered:bool=False
    checks:List[Any]=[]

class FinalCheckResponse(StrictModel):
    ready_to_continue:bool=False
    message:str=""
    requirements:List[Any]=[]
    checks:List[FinalCheckItem]=[]
    important_note:str=""
    continue_url:Optional[str]=None

class SessionState(StrictModel):
    session_id:str
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
    parsed_user_need:Dict[str,Any]={}
    need_type:str="remittance"
    candidate_providers:List[str]=[]
    available_providers:List[ProviderOption]=[]
    verified_results:List[ComparisonResult]=[]
    selected_option:Optional[ProviderOption]=None
    final_check:Optional[FinalCheckResponse]=None
    current_step:str="start"
    learning_provider:Optional[str]=None
    created_at:float=0
    updated_at:float=0

class SessionResponse(StrictModel):
    session:SessionState

class DeleteLocalDataResponse(StrictModel):
    deleted:bool=True
    message:str=""

class LocalStoragePreferences(StrictModel):
    language:Language="es"
    period:str="monthly"

class BrainValidationResponse(StrictModel):
    valid:bool=True
    version:str=""
    errors:List[str]=[]
    warnings:List[str]=[]

class HealthResponse(StrictModel):
    status:str="ok"
    version:str="4.3.0"

class ParseNeedResponse(StrictModel):
    parsed:ParsedNeed

class AssistantRequest(StrictModel):
    language:Language="es"
    message:str=""
    session_id:Optional[str]=None

class AssistantResponse(StrictModel):
    message:str=""
    need_type:str="other"
    next_action:Optional[str]=None
    parsed:Optional[ParsedNeed]=None
