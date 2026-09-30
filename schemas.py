# schemas.py — REMESAS | May Roga LLC | 4.1.0
from typing import Any,Dict,List,Literal,Optional
from pydantic import BaseModel,ConfigDict,Field,field_validator

Language=Literal["es","en"]
Priority=Literal["fastest","save","recipient_gets_more","urgent","balanced","compare_all","other"]
DeliveryMethod=Literal["bank_account","cash_pickup","debit_card","mobile_wallet","home_delivery","other"]
PaymentMethod=Literal["bank_account","debit_card","credit_card","cash","digital_wallet","other"]
DataStatus=Literal["verified","stale","unavailable","restricted","not_applicable"]

class StrictModel(BaseModel):
    model_config=ConfigDict(extra="ignore",str_strip_whitespace=True,validate_assignment=True)

class UserNeedRequest(StrictModel):
    session_id:Optional[str]=None
    language:Language="es"
    amount:Optional[float]=Field(default=None,ge=0,le=1000000)
    send_currency:str=Field(default="USD",min_length=3,max_length=3)
    destination_country:Optional[str]=Field(default=None,min_length=2,max_length=3)
    priority:Optional[Priority]=None
    urgency:Optional[str]=Field(default=None,max_length=100)
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=Field(default=None,max_length=1000)
    free_text:Optional[str]=Field(default=None,max_length=2000)
    need_type:Optional[str]=Field(default=None,max_length=100)
    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls,v:str)->str:return v.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls,v:Optional[str])->Optional[str]:return v.upper() if v else None

class ParseNeedRequest(StrictModel):
    language:Language="es"
    text:str=Field(min_length=1,max_length=2000)

class ComparisonRequest(StrictModel):
    language:Language="es"
    amount:float=Field(gt=0,le=1000000)
    send_currency:str=Field(default="USD",min_length=3,max_length=3)
    destination_country:str=Field(min_length=2,max_length=3)
    priority:Optional[Priority]=None
    urgency:Optional[str]=Field(default=None,max_length=100)
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=Field(default=None,max_length=1000)
    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls,v:str)->str:return v.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls,v:str)->str:return v.upper()

class ComparisonResult(StrictModel):
    provider_id:str
    provider_name:str
    amount_sent:Optional[float]=None
    send_currency:str="USD"
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    recipient_currency:Optional[str]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    estimated_delivery:Optional[str]=None
    availability:Optional[bool]=None
    important_condition:Optional[str]=None
    requirements:List[Any]=Field(default_factory=list)
    source:Optional[str]=None
    verified_at:Optional[str]=None
    status:DataStatus="unavailable"
    relevance_reason:Optional[str]=None
    continue_url:Optional[str]=None
    @field_validator("send_currency","recipient_currency")
    @classmethod
    def normalize_currency(cls,v:Optional[str])->Optional[str]:return v.upper() if v else None

class ComparisonResponse(StrictModel):
    success:bool=True
    language:Language="es"
    destination_country:Optional[str]=None
    destination_name:Optional[str]=None
    amount:Optional[float]=None
    send_currency:str="USD"
    priority:Optional[Priority]=None
    results:List[ComparisonResult]=Field(default_factory=list)
    available_providers:List[Dict[str,Any]]=Field(default_factory=list)
    provider_count:int=0
    verified_count:int=0
    results_available:bool=False
    message:Optional[str]=None
    data_timestamp:Optional[str]=None
    warning:Optional[str]=None
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls,v:Optional[str])->Optional[str]:return v.upper() if v else None

class FinalCheckItem(StrictModel):
    id:str
    label:str
    value:Optional[str]=None
    status:Literal["ok","review","unavailable","not_required"]="review"
    complete:bool=False

class FinalCheckRequest(StrictModel):
    language:Language="es"
    provider_id:str
    amount:float=Field(gt=0,le=1000000)
    send_currency:str=Field(default="USD",min_length=3,max_length=3)
    destination_country:str=Field(min_length=2,max_length=3)
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    recipient_amount:Optional[float]=Field(default=None,ge=0)
    fee:Optional[float]=Field(default=None,ge=0)
    exchange_rate:Optional[float]=Field(default=None,gt=0)
    recipient_information_entered:bool=False
    checks:Dict[str,Any]=Field(default_factory=dict)
    @field_validator("send_currency")
    @classmethod
    def normalize_currency(cls,v:str)->str:return v.upper()
    @field_validator("destination_country")
    @classmethod
    def normalize_country(cls,v:str)->str:return v.upper()

class FinalCheckResponse(StrictModel):
    success:bool=True
    ready_to_continue:bool=False
    language:Language="es"
    provider_id:Optional[str]=None
    checks:List[FinalCheckItem]=Field(default_factory=list)
    message:Optional[str]=None
    important_note:Optional[str]=None

class SessionState(StrictModel):
    session_id:str
    language:Language="es"
    current_step:str="opening"
    amount:Optional[float]=None
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Optional[Priority]=None
    urgency:Optional[str]=None
    delivery_method:Optional[DeliveryMethod]=None
    payment_method:Optional[PaymentMethod]=None
    special_need:Optional[str]=None
    free_text:Optional[str]=None
    need_type:Optional[str]=None
    parsed_user_need:Optional[Any]=None
    candidate_providers:List[str]=Field(default_factory=list)
    available_providers:List[Dict[str,Any]]=Field(default_factory=list)
    verified_results:List[ComparisonResult]=Field(default_factory=list)
    selected_option:Optional[Dict[str,Any]]=None
    final_check:Dict[str,Any]=Field(default_factory=dict)
    created_at:Optional[str]=None
    updated_at:Optional[str]=None

class SessionResponse(StrictModel):
    success:bool=True
    session:SessionState
    message:Optional[str]=None

class DeleteLocalDataResponse(StrictModel):
    success:bool=True
    message:str

class HealthResponse(StrictModel):
    status:str="ok"
    app:str="REMESAS"
    version:str="4.1.0"
    brain_loaded:bool=False
    brain_version:Optional[str]=None
