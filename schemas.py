# schemas.py — REMESAS | May Roga LLC
from typing import Any,Dict,List,Optional
from pydantic import BaseModel,Field,ConfigDict

class UserNeedRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    amount:Optional[float]=None
    destination_country:Optional[str]=None
    destination_region:Optional[str]=None
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    recipient_amount_target:Optional[float]=None
    special_need:Optional[str]=None
    free_text:Optional[str]=None

class ParseNeedRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    text:str=""
    language:str="es"

class ComparisonRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    amount:float=Field(...,gt=0)
    destination_country:str=Field(...,min_length=2,max_length=3)
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    language:str="es"
    send_currency:str="USD"
    recipient_amount_target:Optional[float]=None
    special_need:Optional[str]=None

class ComparisonResult(BaseModel):
    model_config=ConfigDict(extra="ignore")
    provider_id:str
    provider_name:str
    amount_sent:float
    send_currency:str="USD"
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None
    recipient_amount:Optional[float]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    estimated_delivery:Optional[Any]=None
    recipient_currency:Optional[str]=None
    availability:Optional[bool]=None
    important_condition:Optional[str]=None
    source:Optional[str]=None
    verified_at:Optional[str]=None
    status:str="unavailable"
    continue_url:Optional[str]=None

class ComparisonResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:Optional[str]=None
    results:List[ComparisonResult]=Field(default_factory=list)
    available_providers:List[Dict[str,Any]]=Field(default_factory=list)
    provider_count:int=0
    verified_count:int=0
    results_available:bool=False
    destination_country:Optional[str]=None
    destination_name:Optional[str]=None
    amount:Optional[float]=None
    send_currency:str="USD"
    priority:Optional[str]=None
    language:str="es"

class FinalCheckRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    provider_id:str
    amount:float=Field(...,gt=0)
    send_currency:str="USD"
    destination_country:str=Field(...,min_length=2,max_length=3)
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    recipient_amount:Optional[float]=None
    fee:Optional[float]=None
    exchange_rate:Optional[float]=None

class FinalCheckResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    ready_to_continue:bool=False
    language:str="es"
    provider_id:Optional[str]=None
    checks:List[Dict[str,Any]]=Field(default_factory=list)
    message:Optional[str]=None

class SessionResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    session:Optional[Dict[str,Any]]=None
    message:Optional[str]=None

class DeleteLocalDataResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:str=""
