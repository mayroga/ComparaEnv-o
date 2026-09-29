import json,os,re,secrets,urllib.request,urllib.error
from datetime import datetime,date
from pathlib import Path
from typing import Any,Dict,List,Optional

try:
 from schemas import RemittanceRequest,ComparisonRequest,FinalCheckRequest,UserNeedRequest,ParseNeedRequest
except Exception:
 RemittanceRequest=ComparisonRequest=FinalCheckRequest=UserNeedRequest=ParseNeedRequest=Any

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_PATH=DATA_DIR/"app_brain.json"
PROVIDERS_PATH=DATA_DIR/"providers.json"
GEMINI_API_KEY=os.getenv("GEMINI_API_KEY","").strip()
GEMINI_MODEL=os.getenv("GEMINI_MODEL","gemini-2.5-flash")
ENGINE_VERSION="5.0.0"

class RemittanceEngine:
 def __init__(self):
  self.brain=self._read_json(BRAIN_PATH) if BRAIN_PATH.exists() else {}
  self.providers_data=self._read_json(PROVIDERS_PATH) if PROVIDERS_PATH.exists() else {"providers":[]}
  self.providers=self.providers_data.get("providers",[])
  if not isinstance(self.providers,list):self.providers=[]
  self.provider_map={str(p.get("id","")):p for p in self.providers if isinstance(p,dict) and p.get("id")}
  self.required_providers=self.brain.get("providers",{}).get("required",["western_union","moneygram","remitly","xoom"])
  self.sessions={}
  self._ensure_required_provider_fallbacks()

 def _read_json(self,path:Path)->Dict[str,Any]:
  try:
   with path.open("r",encoding="utf-8") as f:data=json.load(f)
   if not isinstance(data,dict):raise ValueError(f"{path.name} must contain a JSON object")
   return data
  except json.JSONDecodeError as e:
   raise ValueError(f"Invalid JSON in {path.name}: {e}") from e

 def load_brain(self):
  self.brain=self._read_json(BRAIN_PATH)
  self.required_providers=self.brain.get("providers",{}).get("required",["western_union","moneygram","remitly","xoom"])
  return self.brain

 def load_providers(self):
  self.providers_data=self._read_json(PROVIDERS_PATH)
  self.providers=self.providers_data.get("providers",[])
  if not isinstance(self.providers,list):self.providers=[]
  self.provider_map={str(p.get("id","")):p for p in self.providers if isinstance(p,dict) and p.get("id")}
  self._ensure_required_provider_fallbacks()
  return self.providers

 def _ensure_required_provider_fallbacks(self):
  defaults={
   "western_union":{"id":"western_union","name":"Western Union","official_urls":{"home":"https://www.westernunion.com/us/es/home.html","send_money":"https://www.westernunion.com/us/es/web/send-money/start"}},
   "moneygram":{"id":"moneygram","name":"MoneyGram","official_urls":{"home":"https://www.moneygram.com/us/en/","send_money":"https://www.moneygram.com/us/en/send-money"}},
   "remitly":{"id":"remitly","name":"Remitly","official_urls":{"home":"https://www.remitly.com/us/es/home","send_money":"https://www.remitly.com/us/es/money-transfer"}},
   "xoom":{"id":"xoom","name":"Xoom","official_urls":{"home":"https://www.xoom.com/","send_money":"https://www.xoom.com/money-transfer"}}
  }
  for pid in self.required_providers:
   if pid not in self.provider_map and pid in defaults:self.provider_map[pid]=defaults[pid]

 def _lang(self,language:str)->str:
  return "en" if str(language or "").lower().startswith("en") else "es"

 def _text(self,value:Any,language:str,default:str="")->str:
  lang=self._lang(language)
  if isinstance(value,dict):
   v=value.get(lang)
   if v is None:v=value.get("es") or value.get("en")
   return str(v) if v is not None else default
  return str(value) if value is not None else default

 def _money(self,value:Any)->Optional[float]:
  if value is None:return None
  if isinstance(value,(int,float)):return round(float(value),2)
  s=str(value).strip().replace(",","")
  s=re.sub(r"[^\d.\-]","",s)
  if not s or s in ("-","."):return None
  try:return round(float(s),2)
  except:return None

 def _safe_money(self,value:Any)->float:
  n=self._money(value)
  return 0.0 if n is None else n

 def _provider(self,pid:str)->Dict[str,Any]:
  p=self.provider_map.get(str(pid))
  return p if isinstance(p,dict) else {"id":pid,"name":str(pid).replace("_"," ").title()}

 def provider_name(self,pid:str,language="es")->str:
  p=self._provider(pid)
  return self._text(p.get("name"),language,str(pid).replace("_"," ").title())

 def _url(self,value:Any)->Optional[str]:
  if isinstance(value,str) and value.startswith(("https://","http://")):return value
  return None

 def official_url(self,pid:str,topic:str="send_money")->str:
  p=self._provider(pid)
  urls=p.get("official_urls") or p.get("urls")
  if isinstance(urls,dict):
   order=[topic,"send_money","home","official","website","us"]
   for key in order:
    u=self._url(urls.get(key))
    if u:return u
  elif isinstance(urls,str):
   u=self._url(urls)
   if u:return u
  for key in ("official_url","website","url"):
   u=self._url(p.get(key))
   if u:return u
  defaults={
   "western_union":{"home":"https://www.westernunion.com/us/es/home.html","send_money":"https://www.westernunion.com/us/es/web/send-money/start"},
   "moneygram":{"home":"https://www.moneygram.com/us/en/","send_money":"https://www.moneygram.com/us/en/send-money"},
   "remitly":{"home":"https://www.remitly.com/us/es/home","send_money":"https://www.remitly.com/us/es/money-transfer"},
   "xoom":{"home":"https://www.xoom.com/","send_money":"https://www.xoom.com/money-transfer"}
  }
  return defaults.get(pid,{}).get(topic) or defaults.get(pid,{}).get("send_money") or defaults.get(pid,{}).get("home","")

 def _source(self,p:Dict[str,Any],topic:str="send_money")->Optional[str]:
  urls=p.get("official_urls") or p.get("urls")
  if isinstance(urls,dict):
   for key in (topic,"send_money","home"):
    u=self._url(urls.get(key))
    if u:return u
  for key in ("source_url","official_source_url","official_url","source","official_source"):
   value=p.get(key)
   if isinstance(value,str):
    u=self._url(value)
    if u:return u
   if isinstance(value,dict):
    for v in value.values():
     u=self._url(v)
     if u:return u
  return None

 def _field(self,p:Dict[str,Any],names:List[str]):
  for n in names:
   if n in p and p[n] is not None:return p[n]
  commercial=p.get("commercial_data")
  if isinstance(commercial,dict):
   for n in names:
    if n in commercial and commercial[n] is not None:return commercial[n]
  return None

 def _verified(self,p:Dict[str,Any],field:str)->bool:
  direct=self._field(p,[f"{field}_verified",f"verified_{field}"])
  if isinstance(direct,bool):return direct
  status=p.get("verification_status") or p.get("verified_status")
  if isinstance(status,str) and status.lower() in ("verified","official","current"):return True
  commercial=p.get("commercial_data")
  if isinstance(commercial,dict):
   status=commercial.get("verification_status") or commercial.get("status")
   if isinstance(status,str) and status.lower() in ("verified","official","current"):return True
  return False

 def _commercial(self,p:Dict[str,Any])->Dict[str,Any]:
  return {
   "fee":self._field(p,["fee","fee_usd","commission"]),
   "exchange_rate":self._field(p,["exchange_rate","rate","fx_rate"]),
   "recipient_amount":self._field(p,["recipient_amount","receive_amount"]),
   "delivery_time":self._field(p,["delivery_time","estimated_delivery_time","delivery_estimate"]),
   "availability":self._field(p,["availability","available"]),
   "limit":self._field(p,["limit","sending_limit"]),
   "payment_methods":self._field(p,["payment_methods","payments"]),
   "delivery_methods":self._field(p,["delivery_methods","delivery"])
  }

 def _verified_commercial(self,p:Dict[str,Any],field:str)->Any:
  value=self._commercial(p).get(field)
  return value if value is not None and self._verified(p,field) else None

 def _provider_snapshot(self,pid:str,amount:float,destination:str,language="es")->Dict[str,Any]:
  p=self._provider(pid)
  c=self._commercial(p)
  result={
   "provider_id":pid,
   "provider_name":self.provider_name(pid,language),
   "official_url":self.official_url(pid,"send_money"),
   "review_url":self.official_url(pid,"send_money"),
   "amount":amount,
   "destination_country":destination,
   "fee":None,
   "exchange_rate":None,
   "recipient_amount":None,
   "estimated_delivery":None,
   "availability":None,
   "limit":None,
   "payment_methods":c["payment_methods"],
   "delivery_methods":c["delivery_methods"],
   "verified":False,
   "status":"official_source",
   "source":self._source(p,"send_money") or self.official_url(pid,"send_money"),
   "verified_at":None,
   "important_condition":self._text(p.get("important_condition"),language,"")
  }
  verified_count=0
  for field,target in (("fee","fee"),("exchange_rate","exchange_rate"),("recipient_amount","recipient_amount"),("delivery_time","estimated_delivery"),("availability","availability"),("limit","limit")):
   if c[field] is not None and self._verified(p,field):
    result[target]=c[field]
    verified_count+=1
  result["verified"]=verified_count>0
  result["verified_fields"]=verified_count
  value=p.get("verified_at") or p.get("last_verified") or p.get("checked_at")
  if isinstance(value,str):result["verified_at"]=value
  return result

 def _priority_score(self,s:Dict[str,Any],priority:str)->Optional[float]:
  p=str(priority or "simple").lower()
  fee=self._money(s.get("fee"))
  recipient=self._money(s.get("recipient_amount"))
  if fee is None and recipient is None:return None
  score=0.0
  if p in ("cheap","cheapest","economico","económico","barato"):
   if fee is not None:score-=fee
   if recipient is not None:score+=recipient/100000
  elif p in ("fast","quick","urgent","rapido","rápido","urgente"):
   delivery=str(s.get("estimated_delivery") or "").lower()
   if any(x in delivery for x in ("instant","minute","minuto","hour","hora","same day","mismo día")):score+=100
   if recipient is not None:score+=recipient/100000
   if fee is not None:score-=fee/100
  else:
   if recipient is not None:score+=recipient/100000
   if fee is not None:score-=fee/100
  return score

 def compare_providers(self,amount:float,destination:str,priority:str="simple",language="es")->Dict[str,Any]:
  snapshots=[self._provider_snapshot(pid,amount,destination,language) for pid in self.required_providers]
  comparable=[s for s in snapshots if s.get("fee") is not None and s.get("recipient_amount") is not None and s.get("verified")]
  selected=None
  if len(comparable)>=2:
   scored=[(s,self._priority_score(s,priority)) for s in comparable]
   scored=[x for x in scored if x[1] is not None]
   if scored:selected=max(scored,key=lambda x:x[1])[0]
  return {"providers":snapshots,"selected":selected,"all_four_shown":True,"verified_count":sum(1 for s in snapshots if s.get("verified")),"comparable_count":len(comparable),"comparison_status":"comparable" if len(comparable)>=2 else "official_source_required"}

 def _validate_amount(self,amount):
  n=self._money(amount)
  return (True,n) if n is not None and n>0 else (False,None)

 def _country_name(self,code,language):
  countries=self.brain.get("countries",{}).get("country_names",{})
  return self._text(countries.get(str(code or "").upper()),language,str(code or "").upper())

 def _source_message(self,url,language):
  if self._lang(language)=="en":return "Check the current information directly here."
  return "Revisa la información actual directamente aquí."

 def _send_text(self,selected,amount,destination,language):
  lang=self._lang(language)
  country=self._country_name(destination,language)
  if selected:
   name=selected["provider_name"]
   fee=selected.get("fee")
   receive=selected.get("recipient_amount")
   if fee is not None and receive is not None:
    if lang=="en":return f"{name} matches your request with verified comparable information. Fee: ${float(fee):.2f}. Recipient amount: {receive}. Review the final result on the official site before confirming."
    return f"{name} coincide con tu solicitud con información verificada y comparable. Comisión: ${float(fee):.2f}. Recibe: {receive}. Revisa el resultado final en el sitio oficial antes de confirmar."
   if lang=="en":return f"{name} matches your request, but the current final cost still needs to be checked on the official site."
   return f"{name} coincide con tu solicitud, pero el costo final actual todavía debe comprobarse en el sitio oficial."
  if lang=="en":return f"For sending ${amount:.2f} to {country}, I will not invent the current price or delivery information. Review the official provider sites before sending."
  return f"Para enviar ${amount:.2f} a {country}, no voy a inventar el precio ni la entrega actuales. Revisa los sitios oficiales antes de enviar."

 def _sender_impact(self,available,amount,reserved,language):
  a=self._money(available)
  r=self._money(reserved) or 0
  lang=self._lang(language)
  if a is None:return {"status":"review","message":"Revisa cuánto te quedará después del envío." if lang=="es" else "Review how much you will have left after sending."}
  remaining=round(a-amount,2)
  if remaining<r:
   return {"status":"warning","remaining":remaining,"message":f"Ojo: este envío tocaría dinero reservado. Te quedarían ${remaining:.2f}." if lang=="es" else f"Careful: this transfer would use reserved money. You would have ${remaining:.2f} left."}
  if remaining<0:
   return {"status":"warning","remaining":remaining,"message":f"Ojo: te faltarían ${abs(remaining):.2f} después del envío." if lang=="es" else f"Careful: you would be ${abs(remaining):.2f} short after sending."}
  return {"status":"ok","remaining":remaining,"message":f"Después del envío te quedarían ${remaining:.2f}." if lang=="es" else f"After sending, you would have ${remaining:.2f} left."}

 def send_money(self,amount:Any,destination:str,priority:str="simple",language="es",**kwargs)->Dict[str,Any]:
  ok,n=self._validate_amount(amount)
  lang=self._lang(language)
  if not ok:return {"ok":False,"action":"CORREGIR MONTO","message":"Escribe un monto mayor que cero." if lang=="es" else "Enter an amount greater than zero.","providers":[]}
  if not destination:return {"ok":False,"action":"ELEGIR DESTINO","message":"Primero dime a qué país va el dinero." if lang=="es" else "First tell me which country the money is going to.","providers":[]}
  comparison=self.compare_providers(n,destination,priority,language)
  selected=comparison["selected"]
  impact=self._sender_impact(kwargs.get("available_money"),n,kwargs.get("reserved_money"),language)
  return {"ok":True,"action":"REVISAR Y ENVIAR","message":self._send_text(selected,n,destination,language),"selected":selected,"providers":comparison["providers"],"all_four_providers":True,"sender_impact":impact,"requires_confirmation":True,"external_transaction":False,"official_url":selected["review_url"] if selected else self.official_url(self.required_providers[0],"send_money")}

 def calculate_money(self,current_money,income=0,fixed_expenses=0,planned_expenses=0,savings=0,remittances=0,language="es"):
  current=self._safe_money(current_money);inc=self._safe_money(income);fixed=self._safe_money(fixed_expenses);planned=self._safe_money(planned_expenses);save=self._safe_money(savings);rem=self._safe_money(remittances)
  available=round(current+inc-fixed-planned-save-rem,2)
  lang=self._lang(language)
  if available>=0:msg=f"Tienes ${available:.2f} libres después de apartar lo necesario." if lang=="es" else f"You have ${available:.2f} free after setting aside what you need."
  else:msg=f"Ojo: te faltan ${abs(available):.2f} para cubrir lo comprometido." if lang=="es" else f"Careful: you are ${abs(available):.2f} short of what is committed."
  return {"ok":True,"current_money":current,"income":inc,"fixed_expenses":fixed,"planned_expenses":planned,"savings":save,"remittances":rem,"available":available,"message":msg,"status":"ok" if available>=0 else "warning"}

 def weekly_budget(self,current_money,next_income_date,fixed_expenses=0,planned_remittances=0,language="es"):
  current=self._safe_money(current_money);fixed=self._safe_money(fixed_expenses);rem=self._safe_money(planned_remittances)
  try:days=max((date.fromisoformat(str(next_income_date))-date.today()).days,1)
  except Exception:days=7
  safe=max(round(current-fixed-rem,2),0);daily=round(safe/days,2);lang=self._lang(language)
  msg=(f"Vas bien. Puedes gastar hasta ${daily:.2f} al día sin tocar lo reservado." if safe>0 else "Vamos con cuidado: primero aparta lo necesario.") if lang=="es" else (f"You can spend up to ${daily:.2f} a day without touching reserved money." if safe>0 else "Let's be careful: set aside what you need first.")
  return {"ok":True,"days_remaining":days,"safe_available":safe,"daily_limit":daily,"message":msg,"status":"ok" if safe>0 else "warning"}

 def record_expense(self,current_money,expense,language="es",category=None):
  current=self._money(current_money);amount=self._money(expense);lang=self._lang(language)
  if amount is None or amount<=0:return {"ok":False,"action":"CORREGIR GASTO","message":"Dime cuánto gastaste y lo anoto." if lang=="es" else "Tell me how much you spent and I will record it."}
  remaining=round(current-amount,2) if current is not None else None
  msg=(f"Listo, anotado. Te quedan ${remaining:.2f}." if remaining is not None else "Listo, anotado.") if lang=="es" else (f"Done. You have ${remaining:.2f} left." if remaining is not None else "Done. I recorded it.")
  return {"ok":True,"expense":amount,"category":category or "other","remaining":remaining,"message":msg,"save_local_only":True}

 def plan_purchase(self,current_money,price,reserved_money=0,reserved_purpose="",language="es"):
  current=self._safe_money(current_money);cost=self._safe_money(price);reserved=self._safe_money(reserved_money);remaining=round(current-cost,2);safe_remaining=round(current-reserved,2);lang=self._lang(language)
  if cost<=safe_remaining:
   status="safe";msg="Sí, te alcanza y no toca el dinero que apartaste." if lang=="es" else "Yes, you can afford it without touching reserved money."
  else:
   status="warning";purpose=reserved_purpose or ("tus gastos importantes" if lang=="es" else "your important expenses");msg=f"Espera. Si compras esto, tocarías dinero reservado para {purpose}." if lang=="es" else f"Wait. Buying this would use money reserved for {purpose}."
  return {"ok":True,"price":cost,"remaining_after_purchase":remaining,"protected_money":reserved,"status":status,"message":msg}

 def save_money(self,current_money,amount,purpose="emergency",language="es"):
  current=self._safe_money(current_money);value=self._safe_money(amount);safe=min(value,current);remaining=round(current-safe,2);lang=self._lang(language)
  msg=("Primero necesitamos saber cuánto tienes disponible." if lang=="es" else "First we need to know how much money you have available.") if safe<=0 else (f"Hecho. Apartaste ${safe:.2f} para {purpose}." if lang=="es" else f"Done. You set aside ${safe:.2f} for {purpose}.")
  return {"ok":safe>0,"saved":safe,"remaining":remaining,"purpose":purpose,"message":msg,"save_local_only":True}

 def family_repeat(self,person:Dict[str,Any],language="es"):
  lang=self._lang(language);amount=self._money(person.get("amount"));name=str(person.get("nickname") or person.get("name") or ("tu familiar" if lang=="es" else "your family member"))
  action=(f"Enviar lo de siempre (${amount:.2f})" if lang=="es" else f"Send the usual amount (${amount:.2f})") if amount is not None else (f"Enviar a {name}" if lang=="es" else f"Send to {name}")
  return {"ok":True,"person":name,"amount":amount,"action":action,"requires_confirmation":True,"external_transaction":False}

 def _extract_amount(self,text):
  m=re.search(r"(?<!\d)(?:\$?\s*)(\d+(?:[.,]\d{1,2})?)(?:\s*(?:usd|dolares|dólares))?",str(text).lower())
  return self._money(m.group(1)) if m else None

 def resolve_need(self,text,language="es"):
  t=str(text or "").lower().strip();amount=self._extract_amount(t);countries=self.brain.get("countries",{}).get("country_names",{});destination=None
  for code,names in countries.items():
   values=[str(code).lower()]
   if isinstance(names,dict):values.extend(str(v).lower() for v in names.values())
   if any(v and re.search(r"\b"+re.escape(v)+r"\b",t) for v in values):destination=str(code).upper();break
  priority="fast" if any(x in t for x in ("rapido","rápido","urgente","hoy","ya","fast")) else "cheap" if any(x in t for x in ("barato","economico","económico","menos costo","ahorrar","cheap")) else "simple"
  if any(x in t for x in ("mandar","enviar","remesa","transferir")):need="send_money"
  elif any(x in t for x in ("gaste","gasté","gasto","pague","pagué")):need="expenses"
  elif any(x in t for x in ("comprar","compra")):need="purchase"
  elif any(x in t for x in ("ahorrar","guardar")):need="savings"
  elif any(x in t for x in ("no entiendo","qué significa","que significa","no sé","no se")):need="help"
  elif any(x in t for x in ("gano","cobro","ingreso","salario")):need="my_money"
  else:need="my_money"
  return {"need_type":need,"amount":amount,"destination":destination,"destination_country":destination,"priority":priority,"understood":True,"next_action":need.upper(),"text":text}

 def parse_need(self,request):
  text=getattr(request,"text","") if not isinstance(request,dict) else request.get("text","")
  language=getattr(request,"language","es") if not isinstance(request,dict) else request.get("language","es")
  parsed=self.resolve_need(text,language)
  parsed["urgency"]="high" if parsed.get("priority")=="fast" else "normal"
  return parsed

 def _gemini_parse(self,text,language="es"):
  if not GEMINI_API_KEY or not str(text).strip():return None
  prompt={"contents":[{"parts":[{"text":"Interpret this user's financial/remittance request. Return ONLY JSON with keys need_type,amount,destination_country,priority,urgency,delivery_method,payment_method. Do not invent commercial facts. If unknown use null. Language: "+self._lang(language)+". User: "+str(text)}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}
  data=json.dumps(prompt).encode("utf-8")
  url=f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
  try:
   req=urllib.request.Request(url,data=data,headers={"Content-Type":"application/json"},method="POST")
   with urllib.request.urlopen(req,timeout=12) as response:raw=json.loads(response.read().decode("utf-8"))
   text_out=raw.get("candidates",[{}])[0].get("content",{}).get("parts",[{}])[0].get("text","")
   parsed=json.loads(text_out)
   return parsed if isinstance(parsed,dict) else None
  except Exception:return None

 def parse_need_with_ai(self,request):
  parsed=self.parse_need(request)
  if parsed.get("need_type")=="my_money" and not parsed.get("destination_country"):
   ai=self._gemini_parse(getattr(request,"text",""),getattr(request,"language","es"))
   if isinstance(ai,dict):
    for key in ("need_type","amount","destination_country","priority","urgency","delivery_method","payment_method"):
     if ai.get(key) is not None:parsed[key]=ai[key]
  return parsed

 def assistant_response(self,need_type,language="es",text=""):
  lang=self._lang(language)
  messages={
   "send_money":("Entendí que quieres enviar dinero. Dime el monto y el país y preparo la revisión." if lang=="es" else "I understand you want to send money. Tell me the amount and country and I will prepare the review."),
   "my_money":("Vamos a ordenar tu dinero y decirte cuánto tienes disponible." if lang=="es" else "Let's organize your money and show what you have available."),
   "my_week":("Vamos a revisar qué entra, qué sale y cuánto puedes usar cada día." if lang=="es" else "Let's review what comes in, what goes out and what you can use each day."),
   "expenses":("Dime cuánto gastaste. Yo hago la cuenta." if lang=="es" else "Tell me how much you spent. I will do the calculation."),
   "family":("Podemos preparar lo que haces normalmente con tu familia, pero tú confirmas antes de enviarlo." if lang=="es" else "We can prepare what you normally do for your family, but you confirm before sending."),
   "purchase":("Dime cuánto cuesta la compra y cuánto tienes disponible y revisamos el impacto." if lang=="es" else "Tell me the purchase price and what you have available and we will check the impact."),
   "savings":("Dime cuánto quieres guardar y para qué. Calculamos cómo queda tu dinero." if lang=="es" else "Tell me how much you want to save and why. We will calculate the impact."),
   "help":("Dime qué parte no entiendes y te la explico con palabras sencillas." if lang=="es" else "Tell me what you do not understand and I will explain it simply.")
  }
  return messages.get(need_type,messages["my_money"])[0]

 def help_topics(self,language="es"):
  topics=self.brain.get("help_center",{}).get("topics",[])
  if not isinstance(topics,list):topics=[]
  return [{"id":x.get("id"),"title":self._text(x.get("title"),language,x.get("id","")),"answer":self._text(x.get("answer"),language,""),"action":x.get("action")} for x in topics if isinstance(x,dict)]

 def help_explain(self,question,language="es",provider_id=None):
  q=str(question or "").strip().lower();lang=self._lang(language)
  if any(x in q for x in ("comision","comisión","fee","costo")):topic="fees"
  elif any(x in q for x in ("cambio","exchange","tasa")):topic="exchange_rate"
  elif any(x in q for x in ("llega","entrega","delivery","recibir")):topic="delivery"
  else:topic=None
  if topic:
   item=next((x for x in self.help_topics(language) if x.get("id")==topic),None)
   if item:
    result={"ok":True,"message":item["answer"],"action":item.get("action")}
    if provider_id:
     result["source"]=self.official_url(provider_id,{"fees":"fees","exchange_rate":"rates","delivery":"delivery"}.get(topic,"send_money"))
     result["source_message"]=self._source_message(result["source"],language)
    return result
  return {"ok":True,"message":"Dime qué palabra o cobro quieres entender y te lo explico." if lang=="es" else "Tell me which word or charge you want to understand and I will explain it.","action":"ASK_FOR_TERM"}

 def official_resolution(self,provider_id,language="es",topic="send_money"):
  url=self.official_url(provider_id,topic);lang=self._lang(language)
  return {"ok":True,"provider":self.provider_name(provider_id,language),"official_url":url,"message":("Revisa la información actual directamente en el sitio oficial." if lang=="es" else "Check the current information directly on the official site."),"action":"IR AL SITIO OFICIAL","topic":topic}

 def provider_public_option(self,provider_id,country="",language="es"):
  p=self._provider(provider_id)
  if not p:return None
  urls=p.get("official_urls") or {}
  if isinstance(urls,str):urls={"home":urls}
  result={
   "provider_id":provider_id,
   "name":self.provider_name(provider_id,language),
   "official_url":self.official_url(provider_id,"home"),
   "continue_url":self.official_url(provider_id,"send_money"),
   "review_url":self.official_url(provider_id,"send_money"),
   "country":country,
   "supports_online":p.get("supports_online"),
   "supports_agent":p.get("supports_agent"),
   "payment_methods":p.get("payment_methods"),
   "delivery_methods":p.get("delivery_methods"),
   "requirements":p.get("requirements"),
   "commercial_data":p.get("commercial_data"),
   "source_policy":"official_provider_source"
  }
  return result

 def provider_requirements(self,provider_id,language="es"):
  p=self._provider(provider_id)
  req=p.get("requirements")
  if req is None:
   return {"status":"check_official","message":"Revisa los requisitos actuales en el sitio oficial." if self._lang(language)=="es" else "Check current requirements on the official site.","official_url":self.official_url(provider_id,"requirements")}
  return {"status":"provided","requirements":req,"official_url":self.official_url(provider_id,"requirements")}

 def create_session(self,language="es"):
  sid=secrets.token_urlsafe(24).replace("-","_")
  self.sessions[sid]={"session_id":sid,"language":self._lang(language),"created_at":datetime.utcnow().isoformat(timespec="seconds")+"Z","updated_at":datetime.utcnow().isoformat(timespec="seconds")+"Z"}
  return dict(self.sessions[sid])

 def get_session(self,session_id):
  return self.sessions.get(session_id)

 def update_session(self,session_id,**values):
  session=self.sessions.get(session_id)
  if session is None:raise KeyError("session_expired")
  for k,v in values.items():
   if v is not None:session[k]=v
  session["updated_at"]=datetime.utcnow().isoformat(timespec="seconds")+"Z"
  return dict(session)

 def clear_session(self,session_id):
  return self.sessions.pop(session_id,None) is not None

 def apply_need(self,session_id,request):
  session=self.sessions.get(session_id)
  if session is None:raise KeyError("session_expired")
  data=request if isinstance(request,dict) else request.model_dump() if hasattr(request,"model_dump") else request.dict()
  text=data.get("text") or data.get("free_text") or ""
  parsed=self.resolve_need(text,data.get("language","es")) if text else {}
  merged={k:v for k,v in data.items() if v is not None}
  for k,v in parsed.items():
   if v is not None and k not in merged:merged[k]=v
  return self.update_session(session_id,**merged)

 def compare(self,request):
  data=request if isinstance(request,dict) else request.model_dump() if hasattr(request,"model_dump") else request.dict()
  language=data.get("language","es");amount=self._money(data.get("amount"));destination=data.get("destination_country") or data.get("destination")
  priority=data.get("priority") or "simple"
  if amount is None or amount<=0:raise ValueError("Amount is required.")
  if not destination:raise ValueError("Destination country is required.")
  comparison=self.compare_providers(amount,destination,priority,language)
  results=[]
  for s in comparison["providers"]:
   results.append({
    "provider_id":s["provider_id"],
    "provider_name":s["provider_name"],
    "amount_sent":amount,
    "send_currency":data.get("send_currency","USD"),
    "fee":s.get("fee"),
    "exchange_rate":s.get("exchange_rate"),
    "recipient_amount":s.get("recipient_amount"),
    "delivery_method":s.get("delivery_methods"),
    "payment_method":s.get("payment_methods"),
    "estimated_delivery":s.get("estimated_delivery"),
    "recipient_currency":data.get("recipient_currency"),
    "availability":s.get("availability"),
    "important_condition":s.get("important_condition"),
    "source":s.get("source"),
    "verified_at":s.get("verified_at"),
    "status":"verified" if s.get("verified") else "official_source",
    "continue_url":s.get("review_url")
   })
  return {"success":True,"language":language,"amount":amount,"destination_country":destination,"priority":priority,"available_providers":self.required_providers,"results":results,"selected":comparison["selected"],"recommendation":comparison["selected"],"comparison_status":comparison["comparison_status"],"official_source_required":comparison["comparison_status"]!="comparable","all_four_providers":True}

 def compare_session(self,session_id):
  session=self.sessions.get(session_id)
  if session is None:raise KeyError("session_expired")
  return self.compare(session)

 def select_provider(self,session_id,provider_id):
  session=self.sessions.get(session_id)
  if session is None:raise KeyError("session_expired")
  if provider_id not in self.required_providers:raise KeyError("provider_not_found")
  option=self.provider_public_option(provider_id,session.get("destination_country",""),session.get("language","es"))
  if not option:raise KeyError("provider_not_available")
  session["selected_provider_id"]=provider_id
  session["selected_option"]=option
  session["updated_at"]=datetime.utcnow().isoformat(timespec="seconds")+"Z"
  return option

 def final_check(self,request,session_id=None):
  data=request if isinstance(request,dict) else request.model_dump() if hasattr(request,"model_dump") else request.dict()
  language=data.get("language","es");amount=self._money(data.get("amount"));provider_id=data.get("provider_id","");destination=data.get("destination_country","")
  if amount is None or amount<=0:return {"success":False,"ok":False,"status":"invalid","message":"Revisa el monto antes de continuar." if self._lang(language)=="es" else "Review the amount before continuing."}
  if provider_id not in self.required_providers:return {"success":False,"ok":False,"status":"invalid","message":"Selecciona una remesadora válida." if self._lang(language)=="es" else "Select a valid provider."}
  option=self.provider_public_option(provider_id,destination,language)
  return {"success":True,"ok":True,"status":"ready","provider":option,"amount":amount,"destination_country":destination,"delivery_method":data.get("delivery_method"),"payment_method":data.get("payment_method"),"recipient_amount":data.get("recipient_amount"),"fee":data.get("fee"),"exchange_rate":data.get("exchange_rate"),"requires_confirmation":True,"external_transaction":False,"continue_url":option.get("continue_url"),"message":"Revisa la información y continúa en el sitio oficial. REMESAS no envía el dinero por ti." if self._lang(language)=="es" else "Review the information and continue on the official site. REMESAS does not send the money for you."}

 def public_config(self,language="es"):
  language=self._lang(language)
  countries=self.brain.get("countries",{}).get("country_names",{})
  return {
   "app":self.brain.get("app",{}),
   "language":language,
   "languages":self.brain.get("languages",{}),
   "opening":self.brain.get("opening",{}),
   "messages":self.brain.get("messages",{}),
   "countries":countries,
   "providers":[self.provider_public_option(pid,"",language) for pid in self.required_providers],
   "help_topics":self.help_topics(language),
   "privacy":self.brain.get("data_privacy",{}),
   "experience":self.brain.get("experience",{})
  }

 def health(self):
  return {"ok":True,"engine":ENGINE_VERSION,"brain_loaded":bool(self.brain),"providers_loaded":len(self.provider_map),"gemini_configured":bool(GEMINI_API_KEY),"required_providers":self.required_providers}

engine=RemittanceEngine()
