from typing import Any,Dict,List,Optional,Literal
from pydantic import BaseModel,Field,ConfigDict

Lang=Literal["es","en"]
Frequency=Literal["daily","weekly","biweekly","monthly","one_time"]
RecordType=Literal["income","essential","flexible","other_expense","savings","remittance","purchase","family","adjustment"]
ActionType=Literal["add","subtract","replace","ignore","review"]
Period=Literal["daily","weekly","biweekly","monthly"]

class UserNeedRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    language:Lang="es"
    need_type:Optional[str]=None
    amount:Optional[float]=Field(default=None,ge=0)
    destination_country:Optional[str]=None
    destination_region:Optional[str]=None
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    frequency:Optional[str]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    recipient_amount_target:Optional[float]=Field(default=None,ge=0)
    special_need:Optional[str]=None
    free_text:Optional[str]=None

class ParseNeedRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    text:str=""
    language:Lang="es"

class ComparisonRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    amount:float=Field(gt=0)
    destination_country:str
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    language:Lang="es"
    send_currency:str="USD"
    recipient_amount_target:Optional[float]=Field(default=None,ge=0)
    special_need:Optional[str]=None
    provider_ids:Optional[List[str]]=None

class ComparisonResult(BaseModel):
    model_config=ConfigDict(extra="ignore")
    provider_id:str
    provider_name:str
    amount_sent:float
    send_currency:str="USD"
    fee:Optional[Any]=None
    exchange_rate:Optional[Any]=None
    recipient_amount:Optional[Any]=None
    delivery_method:Optional[Any]=None
    payment_method:Optional[Any]=None
    estimated_delivery:Optional[Any]=None
    recipient_currency:Optional[Any]=None
    availability:bool=False
    important_condition:Optional[Any]=None
    requirements:List[Any]=Field(default_factory=list)
    source:Optional[str]=None
    verified_at:Optional[str]=None
    status:str="unavailable"
    continue_url:Optional[str]=None

class FinalCheckRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    provider_id:Optional[str]=None
    destination_country:str
    amount:float=Field(gt=0)
    send_currency:str="USD"
    delivery_method:Optional[str]=None
    recipient_information:Optional[bool]=None
    fee:Optional[Any]=None
    exchange_rate:Optional[Any]=None
    recipient_amount:Optional[Any]=None
    language:Lang="es"

class SessionState(BaseModel):
    model_config=ConfigDict(extra="ignore")
    session_id:str
    language:Lang="es"
    need_type:Optional[str]=None
    amount:Optional[float]=None
    send_currency:str="USD"
    destination_country:Optional[str]=None
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    frequency:Optional[str]=None
    delivery_method:Optional[str]=None
    payment_method:Optional[str]=None
    special_need:Optional[str]=None
    free_text:Optional[str]=None
    parsed_user_need:Optional[Dict[str,Any]]=None
    candidate_providers:List[str]=Field(default_factory=list)
    available_providers:List[Dict[str,Any]]=Field(default_factory=list)
    verified_results:List[Dict[str,Any]]=Field(default_factory=list)
    selected_option:Optional[Dict[str,Any]]=None
    final_check:Dict[str,Any]=Field(default_factory=dict)
    current_step:str="opening"
    created_at:str=""
    updated_at:str=""

class SessionResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    session:Optional[SessionState]=None
    message:str=""
    next_step:Optional[str]=None

class ComparisonResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:str=""
    results:List[ComparisonResult]=Field(default_factory=list)
    available_providers:List[Dict[str,Any]]=Field(default_factory=list)
    provider_count:int=0
    verified_count:int=0
    results_available:bool=False
    destination_country:str=""
    destination_name:str=""
    amount:float=0
    send_currency:str="USD"
    priority:Optional[str]=None
    urgency:Optional[bool]=None
    language:Lang="es"
    explanation:str=""
    differences:List[Dict[str,Any]]=Field(default_factory=list)
    precautions:List[str]=Field(default_factory=list)

class FinalCheckResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    ready_to_continue:bool=False
    language:Lang="es"
    provider_id:Optional[str]=None
    checks:List[Dict[str,Any]]=Field(default_factory=list)
    message:str=""
    precautions:List[str]=Field(default_factory=list)
    requirements:List[str]=Field(default_factory=list)

class DeleteLocalDataResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    message:str=""
    deleted:bool=True

class MoneyPlanRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    income:float=Field(default=0,ge=0)
    essential:float=Field(default=0,ge=0)
    flexible:float=Field(default=0,ge=0)
    savings:float=Field(default=0,ge=0)
    remittance:float=Field(default=0,ge=0)
    purchase:float=Field(default=0,ge=0)
    other:float=Field(default=0,ge=0)
    frequency:Frequency="monthly"
    language:Lang="es"

class MoneyRecord(BaseModel):
    model_config=ConfigDict(extra="ignore")
    id:Optional[str]=None
    type:RecordType
    amount:float=Field(gt=0)
    description:Optional[str]=""
    frequency:Frequency="one_time"
    date:Optional[str]=None
    source:Optional[str]="user"
    category:Optional[str]=None
    period:Optional[Period]=None

class RecordDecisionRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    record:MoneyRecord
    existing_records:List[MoneyRecord]=Field(default_factory=list)
    language:Lang="es"

class RecordDecision(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    action:ActionType="review"
    reason:str=""
    message:str=""
    normalized_record:Optional[MoneyRecord]=None
    duplicate_of:Optional[str]=None
    affected_total:Optional[float]=None

class FinancialSnapshotRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    records:List[MoneyRecord]=Field(default_factory=list)
    income:float=Field(default=0,ge=0)
    period:Period="monthly"
    language:Lang="es"
    created_at:Optional[str]=None
    source:str="local_device"

class FinancialSummary(BaseModel):
    model_config=ConfigDict(extra="ignore")
    income:float=0
    essential:float=0
    flexible:float=0
    other_expense:float=0
    savings:float=0
    remittance:float=0
    purchase:float=0
    family:float=0
    available:float=0
    daily_available:float=0
    weekly_available:float=0
    biweekly_available:float=0
    monthly_available:float=0
    negative_warning:bool=False
    savings_rate:float=0
    period:Period="monthly"
    currency:str="USD"

class FinancialSnapshot(BaseModel):
    model_config=ConfigDict(extra="ignore")
    version:str="1.0"
    created_at:str=""
    language:Lang="es"
    period:Period="monthly"
    summary:FinancialSummary
    records:List[MoneyRecord]=Field(default_factory=list)
    action_message:str=""
    next_action:str=""
    informational:bool=True

class SnapshotImportRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    snapshot:Dict[str,Any]
    existing_records:List[MoneyRecord]=Field(default_factory=list)
    language:Lang="es"

class SnapshotImportResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    added:List[MoneyRecord]=Field(default_factory=list)
    ignored:List[MoneyRecord]=Field(default_factory=list)
    review:List[MoneyRecord]=Field(default_factory=list)
    summary:Optional[FinancialSummary]=None
    message:str=""

class EvolutionRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    current_records:List[MoneyRecord]=Field(default_factory=list)
    previous_records:List[MoneyRecord]=Field(default_factory=list)
    income:float=Field(default=0,ge=0)
    period:Period="monthly"
    language:Lang="es"

class EvolutionResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    current:Optional[FinancialSummary]=None
    previous:Optional[FinancialSummary]=None
    changes:Dict[str,float]=Field(default_factory=dict)
    direction:Dict[str,str]=Field(default_factory=dict)
    message:str=""
    action:str=""
    confidence:str="informational"

class FamilyPerson(BaseModel):
    model_config=ConfigDict(extra="ignore")
    id:Optional[str]=None
    name:str
    relationship:Optional[str]=""
    country:Optional[str]=None
    note:Optional[str]=""

class PurchasePlanRequest(BaseModel):
    model_config=ConfigDict(extra="ignore")
    amount:float=Field(gt=0)
    income:float=Field(default=0,ge=0)
    essential:float=Field(default=0,ge=0)
    flexible:float=Field(default=0,ge=0)
    savings:float=Field(default=0,ge=0)
    remittance:float=Field(default=0,ge=0)
    period:Period="monthly"
    language:Lang="es"

class PurchasePlanResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    purchase_amount:float=0
    available_before:float=0
    available_after:float=0
    affordable:bool=False
    message:str=""
    action:str=""
    recommendation:str=""

class ActionResponse(BaseModel):
    model_config=ConfigDict(extra="ignore")
    success:bool=True
    action:str=""
    title:str=""
    message:str=""
    data:Dict[str,Any]=Field(default_factory=dict)
    next_step:Optional[str]=None
    continue_url:Optional[str]=None
