import json,os,re
from datetime import datetime,date
from pathlib import Path
from typing import Any,Dict,List,Optional

try:
 from schemas import RemittanceRequest
except Exception:
 RemittanceRequest=Any

BASE_DIR=Path(__file__).resolve().parent
DATA_DIR=BASE_DIR/"data"
BRAIN_PATH=DATA_DIR/"app_brain.json"
PROVIDERS_PATH=DATA_DIR/"providers.json"
GEMINI_API_KEY=os.getenv("GEMINI_API_KEY","")
GEMINI_MODEL=os.getenv("GEMINI_MODEL","gemini-2.5-flash")

class RemittanceEngine:
 def __init__(self):
  self.brain=self._read_json(BRAIN_PATH) if BRAIN_PATH.exists() else {}
  self.providers_data=self._read_json(PROVIDERS_PATH) if PROVIDERS_PATH.exists() else {"providers":[]}
  self.providers=self.providers_data.get("providers",[])
  if not isinstance(self.providers,list): self.providers=[]
  self.provider_map={str(p.get("id","")):p for p in self.providers if isinstance(p,dict)}
  self.required_providers=self.brain.get("providers",{}).get("required",["western_union","moneygram","remitly","xoom"])
  self._ensure_required_provider_fallbacks()

 def _read_json(self,path:Path)->Dict[str,Any]:
  try:
   with path.open("r",encoding="utf-8") as f:
    data=json.load(f)
   if not isinstance(data,dict): raise ValueError(f"{path.name} must contain a JSON object")
   return data
  except json.JSONDecodeError as e:
   raise ValueError(f"Invalid JSON in {path.name}: {e}") from e

 def _ensure_required_provider_fallbacks(self):
  defaults={
   "western_union":{"id":"western_union","name":"Western Union","official_url":"https://www.westernunion.com/us/en/home.html"},
   "moneygram":{"id":"moneygram","name":"MoneyGram","official_url":"https://www.moneygram.com/mgo/us/en/"},
   "remitly":{"id":"remitly","name":"Remitly","official_url":"https://www.remitly.com/us/en"},
   "xoom":{"id":"xoom","name":"Xoom","official_url":"https://www.xoom.com/"}
  }
  for pid in self.required_providers:
   if pid not in self.provider_map and pid in defaults:
    self.provider_map[pid]=defaults[pid]

 def load_brain(self):
  self.brain=self._read_json(BRAIN_PATH)
  return self.brain

 def load_providers(self):
  self.providers_data=self._read_json(PROVIDERS_PATH)
  self.providers=self.providers_data.get("providers",[])
  if not isinstance(self.providers,list): self.providers=[]
  self.provider_map={str(p.get("id","")):p for p in self.providers if isinstance(p,dict)}
  self._ensure_required_provider_fallbacks()
  return self.providers

 def _lang(self,language:str)->str:
  return "en" if str(language).lower().startswith("en") else "es"

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
  p=self.provider_map.get(pid)
  if isinstance(p,dict):return p
  return {"id":pid,"name":pid.replace("_"," ").title()}

 def provider_name(self,pid:str,language="es")->str:
  p=self._provider(pid)
  return self._text(p.get("name"),language,pid.replace("_"," ").title())

 def official_url(self,pid:str)->str:
  p=self._provider(pid)
  urls=p.get("official_urls") or p.get("official_url") or p.get("urls") or {}
  if isinstance(urls,str) and urls.startswith(("http://","https://")):return urls
  if isinstance(urls,dict):
   for key in ("send_money","home","official","website","us"):
    v=urls.get(key)
    if isinstance(v,str) and v.startswith(("http://","https://")):return v
  for key in ("official_url","website","url"):
   v=p.get(key)
   if isinstance(v,str) and v.startswith(("http://","https://")):return v
  defaults={
   "western_union":"https://www.westernunion.com/us/en/home.html",
   "moneygram":"https://www.moneygram.com/mgo/us/en/",
   "remitly":"https://www.remitly.com/us/en",
   "xoom":"https://www.xoom.com/"
  }
  return defaults.get(pid,"https://www.google.com/")

 def _field(self,p:Dict[str,Any],names:List[str]):
  for n in names:
   if n in p and p[n] is not None:return p[n]
  commercial=p.get("commercial_data")
  if isinstance(commercial,dict):
   for n in names:
    if n in commercial and commercial[n] is not None:return commercial[n]
  return None

 def _verified(self,p:Dict[str,Any],field:str)->bool:
  v=self._field(p,[f"{field}_verified",f"verified_{field}"])
  if isinstance(v,bool):return v
  status=p.get("verification_status") or p.get("verified_status")
  if isinstance(status,str) and status.lower() in ("verified","official","current"):return True
  source=p.get("source") or p.get("official_source")
  return bool(source)

 def _source(self,p:Dict[str,Any])->Optional[str]:
  candidates=[p.get("source_url"),p.get("official_source_url"),p.get("official_url")]
  source=p.get("source") or p.get("official_source")
  if isinstance(source,str):candidates.append(source)
  if isinstance(source,dict):candidates.extend(source.values())
  for x in candidates:
   if isinstance(x,str) and x.startswith(("https://","http://")):return x
  return None

 def _commercial(self,p:Dict[str,Any])->Dict[str,Any]:
  return {
   "fee":self._field(p,["fee","fee_usd","commission"]),
   "exchange_rate":self._field(p,["exchange_rate","rate","fx_rate"]),
   "recipient_amount":self._field(p,["recipient_amount","receive_amount"]),
   "delivery_time":self._field(p,["delivery_time","estimated_delivery_time"]),
   "availability":self._field(p,["availability","available"]),
   "limit":self._field(p,["limit","sending_limit"]),
   "payment_methods":self._field(p,["payment_methods","payments"]),
   "delivery_methods":self._field(p,["delivery_methods","delivery"])
  }

 def _number_or_none(self,v):
  return self._money(v)

 def _provider_snapshot(self,pid:str,amount:float,destination:str,language="es")->Dict[str,Any]:
  p=self._provider(pid)
  c=self._commercial(p)
  source=self._source(p) or self.official_url(pid)
  result={"id":pid,"name":self.provider_name(pid,language),"official_url":source,"verified":False,"fee":None,"exchange_rate":None,"recipient_amount":None,"delivery_time":None,"availability":None,"limit":None,"payment_methods":c["payment_methods"],"delivery_methods":c["delivery_methods"],"action":"official_source"}
  for k in ("fee","exchange_rate","recipient_amount","delivery_time","availability","limit"):
   if c[k] is not None and self._verified(p,k):
    result[k]=c[k]
    if k in ("fee","exchange_rate","recipient_amount"): result["verified"]=True
  result["checked_at"]=datetime.utcnow().isoformat(timespec="seconds")+"Z"
  result["destination"]=destination
  result["amount"]=amount
  return result

 def _priority_score(self,s:Dict[str,Any],priority:str)->float:
  p=str(priority or "").lower()
  fee=self._number_or_none(s.get("fee"))
  recipient=self._number_or_none(s.get("recipient_amount"))
  delivery=str(s.get("delivery_time") or "").lower()
  score=0
  if p in ("cheap","cheapest","economico","económico","barato"):
   if fee is not None:score+=max(0,100-fee*10)
   if recipient is not None:score+=recipient
  elif p in ("fast","quick","urgent","rapido","rápido","urgente"):
   if any(x in delivery for x in ("instant","minute","hora","hour","minuto")):score+=100
   if fee is not None:score+=max(0,50-fee*5)
  else:
   if recipient is not None:score+=recipient
   if fee is not None:score+=max(0,50-fee*5)
  return score

 def compare_providers(self,amount:float,destination:str,priority:str="simple",language="es")->Dict[str,Any]:
  snapshots=[self._provider_snapshot(pid,amount,destination,language) for pid in self.required_providers]
  verified=[s for s in snapshots if s.get("verified")]
  selected=None
  if verified:
   selected=max(verified,key=lambda x:self._priority_score(x,priority))
  return {"providers":snapshots,"selected":selected,"all_four_shown":True,"verified_count":len(verified)}

 def _validate_amount(self,amount):
  n=self._money(amount)
  if n is None or n<=0:return False,None
  return True,n

 def _country_name(self,code,language):
  countries=self.brain.get("countries",{}).get("country_names",{})
  return self._text(countries.get(str(code).upper()),language,str(code).upper())

 def _source_message(self,url,language):
  if self._lang(language)=="en":
   return f"Check the current information directly here: {url}"
  return f"Revisa la información actual directamente aquí: {url}"

 def _send_text(self,selected,amount,destination,language):
  lang=self._lang(language)
  if selected:
   name=selected["name"]
   fee=selected.get("fee")
   receive=selected.get("recipient_amount")
   if fee is not None and receive is not None:
    if lang=="en":return f"{name} is the option that matches your priority with the verified information available. Fee: ${float(fee):.2f}. Recipient amount: {receive}. Review the final result on the official site before confirming."
    return f"{name} es la opción que coincide con tu prioridad con la información verificada disponible. Comisión: ${float(fee):.2f}. Recibe: {receive}. Revisa el resultado final en el sitio oficial antes de confirmar."
   if lang=="en":return f"{name} matches your request with the verified information available. Review the current cost and final amount on the official site before confirming."
   return f"{name} coincide con lo que pediste con la información verificada disponible. Revisa el costo actual y el monto final en el sitio oficial antes de confirmar."
  if lang=="en":return "I will not invent the current price. Choose the official provider site below to check the exact result before sending."
  return "No voy a inventarte el precio actual. Usa el sitio oficial de cada opción para revisar el resultado exacto antes de enviar."

 def send_money(self,amount:Any,destination:str,priority:str="simple",language="es",**kwargs)->Dict[str,Any]:
  ok,n=self._validate_amount(amount)
  if not ok:
   return {"ok":False,"action":"CORREGIR MONTO","message":{"es":"Escribe un monto mayor que cero.","en":"Enter an amount greater than zero."}[self._lang(language)],"providers":[]}
  if not destination:
   return {"ok":False,"action":"ELEGIR DESTINO","message":{"es":"Primero dime a qué país va el dinero.","en":"First tell me which country the money is going to."}[self._lang(language)],"providers":[]}
  comparison=self.compare_providers(n,destination,priority,language)
  selected=comparison["selected"]
  impact=self._sender_impact(kwargs.get("available_money"),n,kwargs.get("reserved_money"),language)
  return {"ok":True,"action":"REVISAR Y ENVIAR","message":self._send_text(selected,n,destination,language),"selected":selected,"providers":comparison["providers"],"all_four_providers":True,"sender_impact":impact,"requires_confirmation":True,"external_transaction":False,"official_url":selected["official_url"] if selected else self.official_url(self.required_providers[0])}

 def _sender_impact(self,available,amount,reserved,language):
  a=self._money(available)
  r=self._money(reserved) or 0
  if a is None:return {"status":"review","message":{"es":"Revisa cuánto te quedará después del envío.","en":"Review how much you will have left after sending."}[self._lang(language)]}
  remaining=round(a-amount,2)
  protected=round(r,2)
  if remaining<protected:
   return {"status":"warning","remaining":remaining,"message":{"es":f"Ojo: este envío tocaría dinero que tienes reservado. Te quedarían ${remaining:.2f}.","en":f"Careful: this transfer would use reserved money. You would have ${remaining:.2f} left."}[self._lang(language)]}
  return {"status":"ok","remaining":remaining,"message":{"es":f"Después del envío te quedarían ${remaining:.2f}.","en":f"After sending, you would have ${remaining:.2f} left."}[self._lang(language)]}

 def calculate_money(self,current_money,income=0,fixed_expenses=0,planned_expenses=0,savings=0,remittances=0,language="es"):
  current=self._safe_money(current_money)
  inc=self._safe_money(income)
  fixed=self._safe_money(fixed_expenses)
  planned=self._safe_money(planned_expenses)
  save=self._safe_money(savings)
  rem=self._safe_money(remittances)
  available=round(current+inc-fixed-planned-save-rem,2)
  lang=self._lang(language)
  msg=(f"Tienes ${available:.2f} libres después de apartar lo necesario." if available>=0 else f"Ojo: te faltan ${abs(available):.2f} para cubrir lo que ya está comprometido.") if lang=="es" else (f"You have ${available:.2f} free after setting aside what you need." if available>=0 else f"Careful: you are ${abs(available):.2f} short of what is already committed.")
  return {"ok":True,"current_money":current,"income":inc,"fixed_expenses":fixed,"planned_expenses":planned,"savings":save,"remittances":rem,"available":available,"message":msg,"status":"ok" if available>=0 else "warning"}

 def weekly_budget(self,current_money,next_income_date,fixed_expenses=0,planned_remittances=0,language="es"):
  current=self._safe_money(current_money)
  fixed=self._safe_money(fixed_expenses)
  rem=self._safe_money(planned_remittances)
  try:
   d=date.fromisoformat(str(next_income_date))
   days=max((d-date.today()).days,1)
  except Exception:
   days=7
  safe=max(round(current-fixed-rem,2),0)
  daily=round(safe/days,2)
  lang=self._lang(language)
  msg=(f"Vas bien. Puedes gastar hasta ${daily:.2f} al día sin tocar lo reservado." if safe>0 else "Vamos con cuidado: primero aparta lo necesario.") if lang=="es" else (f"You are on track. You can spend up to ${daily:.2f} a day without touching what is reserved." if safe>0 else "Let's be careful: set aside what you need first.")
  return {"ok":True,"days_remaining":days,"safe_available":safe,"daily_limit":daily,"message":msg,"status":"ok" if safe>0 else "warning"}

 def record_expense(self,current_money,expense,language="es",category=None):
  current=self._money(current_money)
  amount=self._money(expense)
  if amount is None or amount<=0:
   return {"ok":False,"action":"CORREGIR GASTO","message":{"es":"Dime cuánto gastaste y lo anoto.","en":"Tell me how much you spent and I will record it."}[self._lang(language)]}
  remaining=round((current or 0)-amount,2) if current is not None else None
  msg=(f"Listo, anotado. Te quedan ${remaining:.2f}." if remaining is not None else "Listo, anotado.") if self._lang(language)=="es" else (f"Done. You have ${remaining:.2f} left." if remaining is not None else "Done. I recorded it.")
  return {"ok":True,"expense":amount,"category":category or "other","remaining":remaining,"message":msg,"save_local_only":True}

 def plan_purchase(self,current_money,price,reserved_money=0,reserved_purpose="",language="es"):
  current=self._safe_money(current_money)
  cost=self._safe_money(price)
  reserved=self._safe_money(reserved_money)
  remaining=round(current-cost,2)
  safe_remaining=round(current-reserved,2)
  lang=self._lang(language)
  if cost<=safe_remaining:
   msg=("Sí, te alcanza y no toca el dinero que apartaste." if lang=="es" else "Yes, you can afford it without touching the money you set aside.")
   status="safe"
  else:
   purpose=reserved_purpose or ("tus gastos importantes" if lang=="es" else "your important expenses")
   msg=(f"Espera. Si compras esto, tocarías dinero reservado para {purpose}." if lang=="es" else f"Wait. Buying this would use money reserved for {purpose}.")
   status="warning"
  return {"ok":True,"price":cost,"remaining_after_purchase":remaining,"protected_money":reserved,"status":status,"message":msg}

 def save_money(self,current_money,amount,purpose="emergency",language="es"):
  current=self._safe_money(current_money)
  value=self._safe_money(amount)
  safe=min(value,current)
  remaining=round(current-safe,2)
  lang=self._lang(language)
  if safe<=0:
   msg="Primero necesitamos saber cuánto tienes disponible." if lang=="es" else "First we need to know how much money you have available."
  else:
   msg=(f"Hecho. Apartaste ${safe:.2f} para {purpose}." if lang=="es" else f"Done. You set aside ${safe:.2f} for {purpose}.")
  return {"ok":safe>0,"saved":safe,"remaining":remaining,"purpose":purpose,"message":msg,"save_local_only":True}

 def family_repeat(self,person:Dict[str,Any],language="es"):
  amount=self._money(person.get("amount"))
  name=str(person.get("nickname") or person.get("name") or ("tu familiar" if self._lang(language)=="es" else "your family member"))
  if amount is None:
   action={"es":f"Enviar a {name}","en":f"Send to {name}"}[self._lang(language)]
  else:
   action={"es":f"Enviar lo de siempre (${amount:.2f})","en":f"Send the usual amount (${amount:.2f})"}[self._lang(language)]
  return {"ok":True,"person":name,"amount":amount,"action":action,"requires_confirmation":True,"external_transaction":False}

 def help_explain(self,question,language="es",provider_id=None):
  q=str(question or "").strip()
  lang=self._lang(language)
  low=q.lower()
  explanations={
   "fee":("Es la cantidad que cobra el servicio por hacer el envío." if lang=="es" else "It is the amount the service charges for making the transfer."),
   "exchange":("Es cuánto vale tu dólar en la moneda que recibe tu familiar." if lang=="es" else "It is how much your dollar is worth in the currency your family member receives."),
   "delivery":("Es la forma y el tiempo en que el dinero puede llegar al destinatario." if lang=="es" else "It is how and when the money may reach the recipient.")
  }
  key="exchange" if any(x in low for x in ("cambio","exchange","tasa")) else "fee" if any(x in low for x in ("comision","comisión","fee","costo")) else "delivery" if any(x in low for x in ("llega","entrega","delivery","recibir")) else None
  if key:
   result={"ok":True,"message":explanations[key],"source":self.official_url(provider_id) if provider_id else None}
   if result["source"]:result["source_message"]=self._source_message(result["source"],language)
   return result
  return {"ok":True,"message":{"es":"En palabras sencillas: dime qué palabra o cobro quieres entender y te lo explico.","en":"In simple words: tell me which word or charge you want to understand and I will explain it."}[lang],"action":"ASK_FOR_TERM"}

 def resolve_need(self,text,language="es"):
  t=str(text or "").lower()
  amount=None
  m=re.search(r"(?<!\d)(\d+(?:[.,]\d{1,2})?)(?:\s*(?:usd|dolares|dólares|\$))?",t)
  if m:amount=self._money(m.group(1))
  countries=self.brain.get("countries",{}).get("country_names",{})
  destination=None
  for code,names in countries.items():
   values=[code.lower()]
   if isinstance(names,dict):values.extend(str(v).lower() for v in names.values())
   if any(v in t for v in values):
    destination=code;break
  priority="fast" if any(x in t for x in ("rapido","rápido","urgente","hoy","ya")) else "cheap" if any(x in t for x in ("barato","economico","económico","menos costo","ahorrar")) else "simple"
  need="send_money" if any(x in t for x in ("mandar","enviar","remesa","remesa","familia")) and destination else "expenses" if any(x in t for x in ("gaste","gasté","gasto","compré","compre")) else "purchase" if any(x in t for x in ("comprar","compra")) else "savings" if any(x in t for x in ("ahorrar","guardar")) else "help" if any(x in t for x in ("no entiendo","que significa","qué significa")) else "my_money"
  return {"need_type":need,"amount":amount,"destination":destination,"priority":priority,"understood":True,"next_action":need.upper()}

 def official_resolution(self,provider_id,language="es"):
  url=self.official_url(provider_id)
  return {"ok":True,"provider":self.provider_name(provider_id,language),"official_url":url,"message":self._source_message(url,language),"action":"IR AL SITIO OFICIAL"}

 def health(self):
  return {"ok":True,"engine":"5.0.0","brain_loaded":bool(self.brain),"providers_loaded":len(self.provider_map),"gemini_configured":bool(GEMINI_API_KEY),"required_providers":self.required_providers}

engine=RemittanceEngine()
