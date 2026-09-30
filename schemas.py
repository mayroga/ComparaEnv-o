from typing import Any,Dict,List,Optional
from pydantic import BaseModel,Field,ConfigDict,field_validator

MAX_AMOUNT=1000000.0
MAX_TEXT=2000

class UserNeedRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    session_id:Optional[str]=None
    language:str="es"
    need_type:Optional[str]=None
    amount:Optional[float]=Field(None,gt=0,le=MAX_AMOUNT)
    destination_country:Optional[str]=None
    destination_region:Optional[str]=None
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    frequency:Optional[str]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    recipient_amount_target:Optional[float]=Field(None,gt=0,le=MAX_AMOUNT)
    special_need:Optional[str]=Field(None,max_length=500)
    free_text:Optional[str]=Field(None,max_length=MAX_TEXT)

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

    @field_validator("session_id")
    @classmethod
    def clean_session_id(cls,v):
        return v.strip() if v else v

    @field_validator("destination_country")
    @classmethod
    def clean_country(cls,v):
        return v.upper().strip() if v else v

class ParseNeedRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    text:str=Field("",max_length=MAX_TEXT)
    language:str="es"

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

class IncomeRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    amount:float=Field(...,gt=0,le=MAX_AMOUNT)
    frequency:str=Field(...,min_length=3,max_length=20)
    other_income:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

class ExpenseItem(BaseModel):
    model_config=ConfigDict(extra="ignore")
    description:str=Field(...,min_length=1,max_length=120)
    amount:float=Field(...,gt=0,le=MAX_AMOUNT)
    category:Optional[str]=Field(None,max_length=60)
    frequency:Optional[str]=Field("monthly",min_length=3,max_length=20)

class SavingsRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    amount:float=Field(...,ge=0,le=MAX_AMOUNT)
    savings_type:Optional[str]=Field("general",max_length=60)

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

class PurchaseRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    purchase_amount:float=Field(...,gt=0,le=MAX_AMOUNT)
    purchase_category:Optional[str]=Field(None,max_length=60)

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

class MoneyPlanRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    income_amount:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)
    income_frequency:Optional[str]=Field(None,max_length=20)
    other_income:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)
    essential_expenses:List[ExpenseItem]=Field(default_factory=list)
    flexible_expenses:List[ExpenseItem]=Field(default_factory=list)
    remittance_amount:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)
    remittance_frequency:Optional[str]=Field(None,max_length=20)
    savings_amount:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)
    period:Optional[str]=Field("monthly",max_length=20)

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

class ComparisonRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    amount:float=Field(...,gt=0,le=MAX_AMOUNT)
    destination_country:str=Field(...,min_length=2,max_length=3)
    priority:Optional[str]=Field(None,max_length=40)
    urgency:Optional[bool]=None
    frequency:Optional[str]=Field(None,max_length=30)
    delivery_method:Optional[str]=Field(None,max_length=60)
    payment_method:Optional[str]=Field(None,max_length=60)
    language:str="es"
    send_currency:str=Field("USD",min_length=3,max_length=3)
    recipient_amount_target:Optional[float]=Field(None,gt=0,le=MAX_AMOUNT)
    special_need:Optional[str]=Field(None,max_length=500)

    @field_validator("destination_country")
    @classmethod
    def clean_country(cls,v):
        return v.upper().strip()

    @field_validator("send_currency")
    @classmethod
    def clean_currency(cls,v):
        return (v or "USD").upper().strip()

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

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
    requirements:List[str]=Field(default_factory=list)
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
    urgency:Optional[bool]=None
    frequency:Optional[str]=None
    language:str="es"
    explanation:Optional[str]=None
    differences:List[Dict[str,Any]]=Field(default_factory=list)
    precautions:List[str]=Field(default_factory=list)

class FinalCheckRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:str="es"
    provider_id:str=Field(...,min_length=2,max_length=100)
    amount:float=Field(...,gt=0,le=MAX_AMOUNT)
    send_currency:str=Field("USD",min_length=3,max_length=3)
    destination_country:str=Field(...,min_length=2,max_length=3)
    delivery_method:Optional[str]=Field(None,max_length=60)
    payment_method:Optional[str]=Field(None,max_length=60)
    recipient_amount:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)
    fee:Optional[float]=Field(None,ge=0,le=MAX_AMOUNT)
    exchange_rate:Optional[float]=Field(None,gt=0)

    @field_validator("destination_country")
    @classmethod
    def clean_country(cls,v):
        return v.upper().strip()

    @field_validator("send_currency")
    @classmethod
    def clean_currency(cls,v):
        return (v or "USD").upper().strip()

    @field_validator("language")
    @classmethod
    def clean_language(cls,v):
        return (v or "es").lower().strip()

class FinalCheckResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    ready_to_continue:bool=False
    language:str="es"
    provider_id:Optional[str]=None
    checks:List[Dict[str,Any]]=Field(default_factory=list)
    message:Optional[str]=None
    precautions:List[str]=Field(default_factory=list)
    requirements:List[str]=Field(default_factory=list)

class SessionResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    session:Optional[Dict[str,Any]]=None
    message:Optional[str]=None

class DeleteLocalDataResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:str=""
