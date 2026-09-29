from typing import Any,Dict,List,Optional
from pydantic import BaseModel,Field,ConfigDict,field_validator

class BaseRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")

    @field_validator("language",mode="before",check_fields=False)
    @classmethod
    def valid_language(cls,v):
        v=str(v or "es").lower().strip()
        return v if v in ("es","en") else "es"

class UserNeedRequest(BaseRequest):
    language:str="es"
    need_type:Optional[str]=None
    amount:Optional[float]=Field(None,ge=0)
    destination_country:Optional[str]=None
    destination_region:Optional[str]=None
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    frequency:Optional[str]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    recipient_amount_target:Optional[float]=Field(None,ge=0)
    special_need:Optional[str]=None
    free_text:Optional[str]=None

    @field_validator("destination_country",mode="before")
    @classmethod
    def clean_country(cls,v):
        if v is None:return None
        return str(v).strip().upper() or None

class ParseNeedRequest(BaseRequest):
    text:str=""
    language:str="es"

class IncomeRequest(BaseRequest):
    language:str="es"
    amount:float=Field(...,gt=0)
    frequency:str=Field(...,min_length=2,max_length=30)
    other_income:Optional[float]=Field(None,ge=0)
    description:Optional[str]=Field(None,max_length=120)

class ExpenseItem(BaseRequest):
    description:str=Field(...,min_length=1,max_length=120)
    amount:float=Field(...,gt=0)
    category:Optional[str]=Field(None,max_length=60)
    frequency:Optional[str]="monthly"
    essential:bool=False

class ExpenseRequest(BaseRequest):
    language:str="es"
    expenses:List[ExpenseItem]=Field(default_factory=list)

class SavingsRequest(BaseRequest):
    language:str="es"
    amount:float=Field(...,ge=0)
    savings_type:Optional[str]="general"
    goal:Optional[str]=Field(None,max_length=120)
    frequency:Optional[str]="monthly"

class GoalRequest(BaseRequest):
    language:str="es"
    name:str=Field(...,min_length=1,max_length=120)
    target_amount:float=Field(...,gt=0)
    current_amount:float=Field(0,ge=0)
    contribution:Optional[float]=Field(None,ge=0)
    frequency:Optional[str]="monthly"
    goal_type:Optional[str]="general"

class RetirementRequest(BaseRequest):
    language:str="es"
    current_amount:float=Field(0,ge=0)
    contribution:float=Field(0,ge=0)
    frequency:Optional[str]="monthly"
    target_amount:Optional[float]=Field(None,ge=0)

class PurchaseRequest(BaseRequest):
    language:str="es"
    purchase_amount:float=Field(...,gt=0)
    purchase_category:Optional[str]=Field(None,max_length=80)
    purchase_name:Optional[str]=Field(None,max_length=120)
    available_amount:Optional[float]=Field(None,ge=0)

class MoneyPlanRequest(BaseRequest):
    language:str="es"
    income_amount:Optional[float]=Field(None,ge=0)
    income_frequency:Optional[str]=None
    other_income:Optional[float]=Field(None,ge=0)
    essential_expenses:List[ExpenseItem]=Field(default_factory=list)
    flexible_expenses:List[ExpenseItem]=Field(default_factory=list)
    remittance_amount:Optional[float]=Field(None,ge=0)
    remittance_frequency:Optional[str]=None
    savings_amount:Optional[float]=Field(None,ge=0)
    savings_frequency:Optional[str]=None
    period:Optional[str]="monthly"

class MoneyAvailableRequest(BaseRequest):
    language:str="es"
    current_money:float=Field(...,ge=0)
    essential_expenses:float=Field(0,ge=0)
    planned_purchases:float=Field(0,ge=0)
    savings:float=Field(0,ge=0)
    remittances:float=Field(0,ge=0)
    period:Optional[str]="monthly"

class SpendingRequest(BaseRequest):
    language:str="es"
    amount:float=Field(...,gt=0)
    description:Optional[str]=Field(None,max_length=120)
    frequency:Optional[str]="daily"
    category:Optional[str]=Field(None,max_length=60)

class PocketMoneyRequest(BaseRequest):
    language:str="es"
    amount:float=Field(...,ge=0)
    frequency:Optional[str]="weekly"
    purpose:Optional[str]=Field(None,max_length=120)

class FamilyMoneyRequest(BaseRequest):
    language:str="es"
    amount:float=Field(...,ge=0)
    frequency:Optional[str]="monthly"
    purpose:Optional[str]=Field(None,max_length=120)
    family_member:Optional[str]=Field(None,max_length=80)

class PatrimonyRequest(BaseRequest):
    language:str="es"
    total_assets:float=Field(0,ge=0)
    total_obligations:float=Field(0,ge=0)

class ComparisonRequest(BaseRequest):
    amount:float=Field(...,gt=0)
    destination_country:str=Field(...,min_length=2,max_length=3)
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    language:str="es"
    send_currency:str="USD"
    recipient_amount_target:Optional[float]=Field(None,ge=0)
    special_need:Optional[str]=None

    @field_validator("destination_country",mode="before")
    @classmethod
    def normalize_country(cls,v):
        return str(v or "").strip().upper()

    @field_validator("send_currency",mode="before")
    @classmethod
    def normalize_currency(cls,v):
        return str(v or "USD").strip().upper()

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
    language:str="es"
    explanation:Optional[str]=None
    differences:List[Dict[str,Any]]=Field(default_factory=list)
    precautions:List[str]=Field(default_factory=list)

class FinalCheckRequest(BaseRequest):
    language:str="es"
    provider_id:str
    amount:float=Field(...,gt=0)
    send_currency:str="USD"
    destination_country:str=Field(...,min_length=2,max_length=3)
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    recipient_amount:Optional[float]=Field(None,ge=0)
    fee:Optional[float]=Field(None,ge=0)
    exchange_rate:Optional[float]=Field(None,ge=0)

    @field_validator("destination_country",mode="before")
    @classmethod
    def normalize_final_country(cls,v):
        return str(v or "").strip().upper()

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

class ProviderSelectionRequest(BaseRequest):
    language:str="es"
    provider_id:str=Field(...,min_length=1)

class AssistantRequest(BaseRequest):
    language:str="es"
    need_type:Optional[str]=None
    text:Optional[str]=None
    free_text:Optional[str]=None

class SessionCreateRequest(BaseRequest):
    language:str="es"

class SessionResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    session:Optional[Dict[str,Any]]=None
    message:Optional[str]=None

class DeleteLocalDataResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:str=""

class MoneyPlanResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    plan:Dict[str,Any]=Field(default_factory=dict)

class GenericSuccessResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:Optional[str]=None
    data:Dict[str,Any]=Field(default_factory=dict)
