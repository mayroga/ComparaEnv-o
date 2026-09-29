"use strict";

const APP={
 config:null,sessionId:null,language:localStorage.getItem("remesas_language")||"es",
 amount:"",destination:localStorage.getItem("remesas_destination")||"",priority:"",
 delivery:"",freeText:"",comparison:null,selectedProvider:null,
 money:JSON.parse(localStorage.getItem("remesas_money")||"null")||{available:"",nextPay:"",reserve:""},
 expenses:JSON.parse(localStorage.getItem("remesas_expenses")||"[]"),
 family:JSON.parse(localStorage.getItem("remesas_family")||"[]")
};

const TEXT={
 es:{
 title:"REMESAS",subtitle:"Te ayudamos a entender tu envío de dinero de forma sencilla.",
 question:"¿QUÉ NECESITAS HOY?",amount:"¿Cuánto quieres enviar?",amountPlaceholder:"Ej. 500",
 destination:"¿A qué país quieres enviar?",destinationPlaceholder:"Selecciona un país",
 priority:"¿Qué es lo más importante para ti?",fastest:"LO NECESITO RÁPIDO",save:"QUIERO AHORRAR",
 receiveMore:"QUIERO QUE RECIBA MÁS",urgent:"ES URGENTE",balanced:"MEJOR EQUILIBRIO",
 compare:"QUIERO COMPARAR",other:"OTRA NECESIDAD",freeText:"Cuéntame qué necesitas",
 freeTextPlaceholder:"Ej. Quiero mandar $500 a México y que llegue hoy.",continue:"CONTINUAR",
 back:"ATRÁS",clear:"EMPEZAR DE NUEVO",help:"NO SÉ QUÉ HACER",options:"Opciones para ti",
 verified:"Información verificada",fee:"Cargo",rate:"Tipo de cambio",receive:"Recibe",
 delivery:"Entrega",method:"Forma de entrega",official:"CONTINUAR CON EL PROVEEDOR",
 review:"REVISA ANTES DE ENVIAR",country:"País",sendAmount:"Monto a enviar",
 receiveAmount:"Cantidad que recibe",payment:"Forma de pago",check:"VERIFICAR",
 selected:"Opción seleccionada",finalText:"Revisa estos datos antes de continuar.",
 yes:"CONFIRMAR",no:"VOLVER",noResults:"No pudimos confirmar una cotización actual.",
 tryAgain:"Estas opciones existen para este destino, pero el precio actual debe ser confirmado.",
 close:"CERRAR",language:"EN",available:"Opciones disponibles para tu destino.",
 commercialUnavailable:"Cotización actual no disponible",error:"No pudimos completar la consulta.",
 countryRequired:"Selecciona un país.",amountRequired:"Indica cuánto quieres enviar.",
 myMoney:"💵 MI DINERO",myWeek:"💰 MI SEMANA",myExpenses:"📊 MIS GASTOS",family:"👨‍👩‍👧 FAMILIA",
 moneyIntro:"Mira cuánto puedes conservar hasta tu próximo pago.",
 availableMoney:"¿Cuánto dinero tienes disponible?",nextPay:"¿Cuándo recibes tu próximo pago?",
 today:"Hoy",thisWeek:"Esta semana",twoWeeks:"En 2 semanas",thisMonth:"Este mes",
 reserve:"¿Cuánto necesitas reservar para tus gastos?",calculate:"VER MI DINERO",
 available:"DINERO DISPONIBLE",reserved:"RESERVADO PARA GASTOS",
 remaining:"DISPONIBLE HASTA TU PRÓXIMO PAGO",daily:"APROXIMADAMENTE POR DÍA",
 sendable:"PODRÍAS ENVIAR",transferCheck:"¿Cuánto quieres enviar?",afterTransfer:"DESPUÉS DEL ENVÍO",
 expenseQuestion:"¿En qué gastaste?",expenseAmount:"¿Cuánto?",addExpense:"AGREGAR GASTO",
 noExpenses:"Todavía no has agregado gastos.",familyLabel:"¿A quién envías?",
 familyCountry:"¿A qué país?",addFamily:"AGREGAR FAMILIA",noFamily:"Todavía no has agregado familiares.",
 sendMoney:"💸 ENVIAR DINERO",saveData:"Los datos de esta sección permanecen en este dispositivo.",
 deleteData:"BORRAR MIS DATOS DEL DISPOSITIVO",home:"INICIO",next:"SIGUIENTE",cancel:"CANCELAR",
 safe:"Todavía tendrías dinero disponible.",low:"El envío dejaría poco dinero disponible hasta tu próximo pago.",
 insufficient:"Ese envío supera el dinero disponible después de reservar tus gastos.",
 noNeed:"No necesitas completar todo. Solo responde lo que quieras usar."
 },
 en:{
 title:"REMITTANCES",subtitle:"We help you understand your money transfer in a simple way.",
 question:"WHAT DO YOU NEED TODAY?",amount:"How much do you want to send?",amountPlaceholder:"Example: 500",
 destination:"Which country are you sending to?",destinationPlaceholder:"Select a country",
 priority:"What matters most to you?",fastest:"I NEED IT FAST",save:"I WANT TO SAVE",
 receiveMore:"I WANT THEM TO RECEIVE MORE",urgent:"IT'S URGENT",balanced:"BEST BALANCE",
 compare:"I WANT TO COMPARE",other:"OTHER NEED",freeText:"Tell me what you need",
 freeTextPlaceholder:"Example: I want to send $500 to Mexico and have it arrive today.",continue:"CONTINUE",
 back:"BACK",clear:"START OVER",help:"I DON'T KNOW WHAT TO DO",options:"Options for you",
 verified:"Verified information",fee:"Fee",rate:"Exchange rate",receive:"Recipient gets",
 delivery:"Delivery",method:"Delivery method",official:"CONTINUE WITH PROVIDER",
 review:"REVIEW BEFORE SENDING",country:"Country",sendAmount:"Amount to send",
 receiveAmount:"Recipient gets",payment:"Payment method",check:"VERIFY",
 selected:"Selected option",finalText:"Review these details before continuing.",
 yes:"CONFIRM",no:"GO BACK",noResults:"We could not confirm a current quote.",
 tryAgain:"These options are available for this destination, but the current price must be confirmed.",
 close:"CLOSE",language:"ES",available:"Options available for your destination.",
 commercialUnavailable:"Current quote unavailable",error:"We couldn't complete the request.",
 countryRequired:"Select a country.",amountRequired:"Enter the amount.",
 myMoney:"💵 MY MONEY",myWeek:"💰 MY WEEK",myExpenses:"📊 MY EXPENSES",family:"👨‍👩‍👧 FAMILY",
 moneyIntro:"See how much you can keep until your next payday.",
 availableMoney:"How much money do you have available?",nextPay:"When is your next payday?",
 today:"Today",thisWeek:"This week",twoWeeks:"In 2 weeks",thisMonth:"This month",
 reserve:"How much do you need to reserve for expenses?",calculate:"SEE MY MONEY",
 available:"AVAILABLE MONEY",reserved:"RESERVED FOR EXPENSES",
 remaining:"AVAILABLE UNTIL YOUR NEXT PAYDAY",daily:"APPROXIMATELY PER DAY",
 sendable:"YOU COULD SEND",transferCheck:"How much do you want to send?",afterTransfer:"AFTER THE TRANSFER",
 expenseQuestion:"What did you spend on?",expenseAmount:"How much?",addExpense:"ADD EXPENSE",
 noExpenses:"You have not added expenses yet.",familyLabel:"Who do you send money to?",
 familyCountry:"Which country?",addFamily:"ADD FAMILY",noFamily:"You have not added family members yet.",
 sendMoney:"💸 SEND MONEY",saveData:"This section stays on this device.",
 deleteData:"DELETE MY DATA FROM THIS DEVICE",home:"HOME",next:"NEXT",cancel:"CANCEL",
 safe:"You would still have money available.",low:"The transfer would leave little money until your next payday.",
 insufficient:"That transfer is more than the money available after reserving your expenses.",
 noNeed:"You do not need to complete everything. Just use what you need."
 }
};

function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}

function esc(v){
 return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")
}

function money(v,currency="USD"){
 if(v===null||v===undefined||v==="")return"—";
 const n=Number(v);
 if(!Number.isFinite(n))return esc(v);
 try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:currency||"USD",maximumFractionDigits:2}).format(n)}
 catch(e){return`${n.toFixed(2)} ${currency}`}
}

function numberValue(v){
 const n=Number(String(v??"").replace(/,/g,""));
 return Number.isFinite(n)?n:0
}

async function api(url,options={}){
 const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
 let data=null;
 try{data=await r.json()}catch(e){}
 if(!r.ok)throw new Error(data?.detail||data?.message||data?.error||t("error"));
 return data
}

function saveLocal(){
 localStorage.setItem("remesas_language",APP.language);
 if(APP.destination)localStorage.setItem("remesas_destination",APP.destination);
 localStorage.setItem("remesas_money",JSON.stringify(APP.money));
 localStorage.setItem("remesas_expenses",JSON.stringify(APP.expenses));
 localStorage.setItem("remesas_family",JSON.stringify(APP.family));
}

function priorityId(p){return typeof p==="string"?p:p?.id||""}

function priorityLabel(p){
 if(typeof p==="string"){
  const map={fastest:"fastest",save:"save",recipient_gets_more:"receiveMore",urgent:"urgent",balanced:"balanced",compare_all:"compare",other:"other"};
  return t(map[p]||p)
 }
 return p?.label||p?.name||p?.id||""
}

function countryName(code){
 const list=APP.config?.countries||[];
 const found=list.find(c=>(typeof c==="string"?c:(c.id||c.code))===code);
 return found?(typeof found==="string"?found:(found.name||found.country||code)):code||""
}

function renderHeader(){
 return`<header class="topbar"><div class="brand"><div class="brand-mark">R</div><div><strong>${esc(t("title"))}</strong><span>May Roga LLC</span></div></div><button class="language-btn" id="languageBtn">${esc(t("language"))}</button></header>`
}

function renderHome(){
 const app=document.getElementById("app");
 const opening=APP.config?.opening||{};
 const countries=APP.config?.countries||[];
 const priorities=opening.priorities||[];
 const priorityButtons=(priorities.length?priorities:["fastest","save","recipient_gets_more","urgent","balanced","compare_all"]).map(p=>{
  const id=priorityId(p);
  return`<button class="priority-btn ${APP.priority===id?"active":""}" data-priority="${esc(id)}">${esc(priorityLabel(p))}</button>`
 }).join("");

 let options=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
 countries.forEach(c=>{
  const id=typeof c==="string"?c:(c.id||c.code||"");
  const name=typeof c==="string"?c:(c.name||c.country||id);
  options+=`<option value="${esc(id)}" ${APP.destination===id?"selected":""}>${esc(name)}</option>`
 });

 app.innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="hero">
   <div class="hero-badge">● SIMPLE · CLARO · DIRECTO</div>
   <h1>${esc(opening.primary_question||t("question"))}</h1>
   <p>${esc(opening.secondary_text||t("subtitle"))}</p>
  </section>
  <section class="quick-menu">
   <button class="quick-card" id="moneyBtn">${esc(t("myMoney"))}</button>
   <button class="quick-card" id="weekBtn">${esc(t("myWeek"))}</button>
   <button class="quick-card" id="expensesBtn">${esc(t("myExpenses"))}</button>
   <button class="quick-card" id="familyBtn">${esc(t("family"))}</button>
  </section>
  <section class="main-card">
   <div class="field">
    <label>${esc(t("amount"))}</label>
    <div class="amount-wrap"><span>$</span><input id="amountInput" inputmode="decimal" type="number" min="1" step="0.01" placeholder="${esc(opening.amount?.placeholder||t("amountPlaceholder"))}" value="${esc(APP.amount)}"></div>
   </div>
   <div class="field">
    <label>${esc(t("destination"))}</label>
    <select id="destinationInput">${options}</select>
   </div>
   <div class="field">
    <label>${esc(t("priority"))}</label>
    <div class="priority-grid">${priorityButtons}</div>
   </div>
   <button class="help-link" id="helpBtn">?</button>
   <button class="primary-btn" id="continueBtn">${esc(t("continue"))}</button>
   <button class="secondary-btn" id="freeTextBtn">${esc(t("other"))}</button>
   <div id="freeTextArea" class="free-text-area hidden">
    <label>${esc(t("freeText"))}</label>
    <textarea id="freeTextInput" rows="3" placeholder="${esc(opening.free_text?.placeholder||t("freeTextPlaceholder"))}">${esc(APP.freeText)}</textarea>
    <button class="primary-btn" id="freeTextContinue">${esc(t("continue"))}</button>
   </div>
  </section>
  <footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer>
 </main><div id="modal"></div>`;

 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage);
 document.getElementById("amountInput")?.addEventListener("input",e=>APP.amount=e.target.value);
 document.getElementById("destinationInput")?.addEventListener("change",e=>{APP.destination=e.target.value;saveLocal()});
 document.querySelectorAll(".priority-btn").forEach(b=>b.addEventListener("click",()=>{
  APP.priority=b.dataset.priority;
  document.querySelectorAll(".priority-btn").forEach(x=>x.classList.remove("active"));
  b.classList.add("active")
 }));
 document.getElementById("continueBtn")?.addEventListener("click",startComparison);
 document.getElementById("freeTextBtn")?.addEventListener("click",()=>{
  document.getElementById("freeTextArea")?.classList.toggle("hidden");
  document.getElementById("freeTextInput")?.focus()
 });
 document.getElementById("freeTextContinue")?.addEventListener("click",startFreeText);
 document.getElementById("helpBtn")?.addEventListener("click",showHelp);
 document.getElementById("clearBtn")?.addEventListener("click",restart);
 document.getElementById("moneyBtn")?.addEventListener("click",renderMoney);
 document.getElementById("weekBtn")?.addEventListener("click",renderWeek);
 document.getElementById("expensesBtn")?.addEventListener("click",renderExpenses);
 document.getElementById("familyBtn")?.addEventListener("click",renderFamily);
}

function toggleLanguage(){
 APP.language=APP.language==="es"?"en":"es";
 saveLocal();
 loadConfig().then(renderHome).catch(renderHome)
}

async function createSession(){
 try{
  const data=await api(`/api/session?language=${encodeURIComponent(APP.language)}`,{method:"POST",body:"{}"});
  APP.sessionId=data?.session?.session_id||data?.session_id||null;
  return APP.sessionId
 }catch(e){APP.sessionId=null;return null}
}

async function ensureSession(){
 if(!APP.sessionId)await createSession();
 return APP.sessionId
}

async function loadConfig(){
 APP.config=await api(`/api/config?language=${encodeURIComponent(APP.language)}`)
}

function renderLoading(){
 document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="loading-card"><div class="loader large"></div><h2>${esc(t("options"))}</h2><p>${esc(t("loading")||"")}</p></section></main>`;
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function collectNeed(){
 return{
  session_id:APP.sessionId,language:APP.language,amount:Number(APP.amount),send_currency:"USD",
  destination_country:APP.destination,priority:APP.priority||"balanced",
  delivery_method:APP.delivery||null,special_need:APP.freeText||null
 }
}

async function startComparison(){
 APP.amount=document.getElementById("amountInput")?.value||APP.amount;
 APP.destination=document.getElementById("destinationInput")?.value||APP.destination;
 const amount=Number(APP.amount);
 if(!APP.destination){document.getElementById("destinationInput")?.focus();return}
 if(!amount||amount<=0){document.getElementById("amountInput")?.focus();return}
 if(!APP.priority)APP.priority="balanced";
 renderLoading();
 try{
  await ensureSession();
  const need=collectNeed();
  await api("/api/need",{method:"POST",body:JSON.stringify(need)});
  APP.comparison=await api("/api/compare",{method:"POST",body:JSON.stringify(need)});
  renderResults()
 }catch(e){renderError(e.message)}
}

async function startFreeText(){
 const text=document.getElementById("freeTextInput")?.value.trim();
 if(!text)return;
 APP.freeText=text;
 renderLoading();
 try{
  await ensureSession();
  const response=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.language})});
  const parsed=response?.parsed||{};
  if(parsed.amount)APP.amount=parsed.amount;
  if(parsed.destination_country)APP.destination=parsed.destination_country;
  if(parsed.priority)APP.priority=parsed.priority;
  if(parsed.delivery_method)APP.delivery=parsed.delivery_method;
  if(!APP.amount||!APP.destination){renderNeedMissing();return}
  await startComparison()
 }catch(e){renderError(e.message)}
}

function renderNeedMissing(){
 const missing=[];
 if(!APP.amount)missing.push(t("amount"));
 if(!APP.destination)missing.push(t("destination"));
 document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="main-card"><div class="hero-badge">●</div><h1>${esc(t("help"))}</h1><p>${esc(t("noNeed"))}</p><div class="missing-box">${missing.map(x=>`<div>• ${esc(x)}</div>`).join("")}</div><button class="primary-btn" id="completeBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="backBtn">${esc(t("back"))}</button></section></main>`;
 document.getElementById("completeBtn")?.addEventListener("click",renderHome);
 document.getElementById("backBtn")?.addEventListener("click",renderHome);
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function resultId(r){return r?.provider_id||r?.id||""}

function getResults(){
 const data=APP.comparison||{};
 const verified=Array.isArray(data.results)?data.results:[];
 const available=Array.isArray(data.available_providers)?data.available_providers:[];
 const merged=[],seen=new Set();
 verified.forEach(r=>{
  const id=resultId(r);
  if(id&&!seen.has(id)){seen.add(id);merged.push({...r,commercial_verified:true,commercial_status:"verified"})}
 });
 available.forEach(p=>{
  const id=resultId(p);
  if(id&&!seen.has(id)){seen.add(id);merged.push({...p,provider_id:id,provider_name:p.provider_name||p.name||id})}
 });
 return merged
}

function resultValue(r,key){
 if(r?.[key]!==undefined)return r[key];
 if(r?.commercial_data?.[key]!==undefined)return r.commercial_data[key];
 return null
}

function renderResults(){
 const data=APP.comparison||{};
 const results=getResults();
 const verified=(data.results||[]).length>0;

 document.getElementById("app").innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="results-head">
   <button class="back-btn" id="backBtn">← ${esc(t("back"))}</button>
   <div><div class="hero-badge">● ${esc(verified?t("verified"):t("available"))}</div>
   <h1>${esc(t("options"))}</h1><p>${esc(money(Number(APP.amount))+" → "+countryName(APP.destination))}</p></div>
  </section>
  <section class="results-list">
   ${results.length?results.map(renderResultCard).join(""):`<div class="empty-card"><h2>${esc(t("noResults"))}</h2><p>${esc(t("tryAgain"))}</p></div>`}
  </section>
  <footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer>
 </main>`;

 document.getElementById("backBtn")?.addEventListener("click",renderHome);
 document.getElementById("clearBtn")?.addEventListener("click",restart);
 document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{
  const p=results.find(x=>resultId(x)===b.dataset.provider);
  if(p)renderFinalCheck(p)
 }));
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function renderResultCard(r,i){
 const id=resultId(r);
 const name=r.provider_name||id;
 const verified=r.commercial_verified===true||r.commercial_status==="verified";
 const fee=verified?resultValue(r,"fee"):null;
 const rate=verified?resultValue(r,"exchange_rate"):null;
 const recipient=verified?resultValue(r,"recipient_amount"):null;
 const delivery=verified?(resultValue(r,"delivery_time")??resultValue(r,"estimated_delivery")):null;
 const method=verified?resultValue(r,"delivery_method"):null;
 const currency=resultValue(r,"currency")||resultValue(r,"recipient_currency")||"USD";
 const url=r.continue_url||r.official_site||"";

 return`<article class="provider-card">
  <div class="provider-top">
   <div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div>
   <span class="verified-pill">${verified?"✓ "+esc(t("verified")):esc(t("commercialUnavailable"))}</span>
  </div>
  <div class="provider-main">
   <div class="receive-box"><span>${esc(t("receive"))}</span><strong>${recipient!==null?money(recipient,currency):"—"}</strong></div>
   <div class="details-grid">
    <div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee):"—"}</strong></div>
    <div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):"—"}</strong></div>
    <div><span>${esc(t("delivery"))}</span><strong>${delivery!==null?esc(delivery):"—"}</strong></div>
    <div><span>${esc(t("method"))}</span><strong>${method?esc(formatMethod(method)):"—"}</strong></div>
   </div>
  </div>
  <div class="provider-foot"><small>${verified?esc(t("verified")):esc(t("commercialUnavailable"))}</small></div>
  <button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(verified?t("check"):t("official"))}</button>
 </article>`
}

function formatMethod(v){
 const map={
  cash_pickup:APP.language==="es"?"Retiro en efectivo":"Cash pickup",
  bank_account:APP.language==="es"?"Cuenta bancaria":"Bank account",
  debit_card:APP.language==="es"?"Tarjeta de débito":"Debit card",
  mobile_wallet:APP.language==="es"?"Billetera móvil":"Mobile wallet",
  home_delivery:APP.language==="es"?"Entrega a domicilio":"Home delivery"
 };
 return map[v]||v
}

async function renderFinalCheck(provider){
 const id=resultId(provider);
 const verified=provider.commercial_verified===true||provider.commercial_status==="verified";
 if(!verified){
  const url=provider.continue_url||provider.official_site;
  if(url)window.open(url,"_blank","noopener,noreferrer");
  return
 }

 document.getElementById("app").innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button>
   <div><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(provider.provider_name||id)}</h1><p>${esc(t("finalText"))}</p></div>
  </section>
  <section class="review-card">
   <h2>${esc(t("review"))}</h2>
   <div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div>
   <div class="review-row"><span>${esc(t("sendAmount"))}</span><strong>${money(Number(APP.amount))}</strong></div>
   <div class="review-row"><span>${esc(t("fee"))}</span><strong>${provider.fee!=null?money(provider.fee):"—"}</strong></div>
   <div class="review-row"><span>${esc(t("rate"))}</span><strong>${provider.exchange_rate!=null?esc(provider.exchange_rate):"—"}</strong></div>
   <div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${provider.recipient_amount!=null?money(provider.recipient_amount,provider.currency||"USD"):"—"}</strong></div>
   <div class="review-row"><span>${esc(t("method"))}</span><strong>${provider.delivery_method?esc(formatMethod(provider.delivery_method)):"—"}</strong></div>
   <div class="review-actions"><button class="secondary-btn" id="backResults">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div>
   <div id="finalStatus"></div>
  </section>
 </main>`;

 document.getElementById("backBtn")?.addEventListener("click",renderResults);
 document.getElementById("backResults")?.addEventListener("click",renderResults);
 document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(provider,id));
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

async function performFinalCheck(provider,id){
 const status=document.getElementById("finalStatus");
 if(!status)return;
 status.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
 try{
  await ensureSession();
  const result=await api("/api/final-check",{method:"POST",body:JSON.stringify({
   language:APP.language,provider_id:id,amount:Number(APP.amount),send_currency:"USD",
   destination_country:APP.destination,delivery_method:provider.delivery_method||null,
   payment_method:null,recipient_amount:provider.recipient_amount??null,
   fee:provider.fee??null,exchange_rate:provider.exchange_rate??null
  })});
  const ready=result?.ready_to_continue!==false;
  const url=provider.continue_url||provider.official_site;
  status.innerHTML=`<div class="${ready?"success-box":"error-box"}">
   <strong>${ready?"✓ "+esc(t("verified")):esc(t("error"))}</strong>
   <p>${esc(result?.message||t("finalText"))}</p>
   ${ready&&url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}
  </div>`
 }catch(e){status.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`}
}

function showHelp(){
 const modal=document.getElementById("modal");
 if(!modal)return;
 modal.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card"><button class="modal-close" id="modalClose">×</button><div class="hero-badge">?</div><h2>${esc(t("help"))}</h2><p>${esc(t("noNeed"))}</p><p>${esc(t("subtitle"))}</p><button class="primary-btn" id="modalStart">${esc(t("continue"))}</button></div></div>`;
 document.getElementById("modalClose")?.addEventListener("click",()=>modal.innerHTML="");
 document.getElementById("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")modal.innerHTML=""});
 document.getElementById("modalStart")?.addEventListener("click",()=>{modal.innerHTML="";document.getElementById("amountInput")?.focus()})
}

function renderMoney(){
 const m=APP.money;
 document.getElementById("app").innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="results-head"><button class="back-btn" id="backHome">← ${esc(t("home"))}</button>
   <div><div class="hero-badge">${esc(t("myMoney"))}</div><h1>${esc(t("myMoney"))}</h1><p>${esc(t("moneyIntro"))}</p></div>
  </section>
  <section class="main-card">
   <div class="field"><label>${esc(t("availableMoney"))}</label><div class="amount-wrap"><span>$</span><input id="moneyAvailable" type="number" min="0" step="0.01" value="${esc(m.available)}"></div></div>
   <div class="field"><label>${esc(t("nextPay"))}</label>
    <div class="priority-grid">
     ${["today","thisWeek","twoWeeks","thisMonth"].map(x=>`<button class="priority-btn ${m.nextPay===x?"active":""}" data-pay="${x}">${esc(t(x))}</button>`).join("")}
    </div>
   </div>
   <div class="field"><label>${esc(t("reserve"))}</label><div class="amount-wrap"><span>$</span><input id="moneyReserve" type="number" min="0" step="0.01" value="${esc(m.reserve)}"></div></div>
   <button class="primary-btn" id="calculateMoney">${esc(t("calculate"))}</button>
   <p class="small-note">${esc(t("saveData"))}</p>
  </section>
  <div id="moneyResult"></div>
 </main>`;

 document.getElementById("backHome")?.addEventListener("click",renderHome);
 document.querySelectorAll("[data-pay]").forEach(b=>b.addEventListener("click",()=>{
  m.nextPay=b.dataset.pay;
  document.querySelectorAll("[data-pay]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active")
 }));
 document.getElementById("calculateMoney")?.addEventListener("click",calculateMoney);
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function daysForPay(v){
 return v==="today"?1:v==="thisWeek"?7:v==="twoWeeks"?14:v==="thisMonth"?30:1
}

function calculateMoney(){
 const available=Math.max(0,numberValue(document.getElementById("moneyAvailable")?.value));
 const reserve=Math.min(available,Math.max(0,numberValue(document.getElementById("moneyReserve")?.value)));
 const next=APP.money.nextPay||"thisWeek";
 const days=daysForPay(next);
 const remaining=Math.max(0,available-reserve);
 const daily=remaining/days;
 APP.money={available,nextPay:next,reserve};
 saveLocal();

 document.getElementById("moneyResult").innerHTML=`<section class="money-result">
  <div class="money-grid">
   <div><span>${esc(t("available"))}</span><strong>${money(available)}</strong></div>
   <div><span>${esc(t("reserved"))}</span><strong>${money(reserve)}</strong></div>
   <div><span>${esc(t("remaining"))}</span><strong>${money(remaining)}</strong></div>
   <div><span>${esc(t("daily"))}</span><strong>${money(daily)}</strong></div>
  </div>
  <div class="transfer-box">
   <label>${esc(t("transferCheck"))}</label>
   <div class="amount-wrap"><span>$</span><input id="transferCheck" type="number" min="0" step="0.01"></div>
   <button class="secondary-btn" id="checkTransfer">${esc(t("check"))}</button>
   <div id="transferResult"></div>
  </div>
 </section>`;

 document.getElementById("checkTransfer")?.addEventListener("click",()=>{
  const transfer=Math.max(0,numberValue(document.getElementById("transferCheck")?.value));
  const after=Math.max(0,remaining-transfer);
  let message=transfer>remaining?t("insufficient"):after/days<remaining/days*0.2?t("low"):t("safe");
  document.getElementById("transferResult").innerHTML=`<div class="${transfer>remaining?"error-box":"success-box"}"><strong>${esc(t("afterTransfer"))}: ${money(after)}</strong><p>${esc(message)}</p></div>`
 })
}

function renderWeek(){
 const available=numberValue(APP.money.available);
 const reserved=numberValue(APP.money.reserve);
 const expenses=APP.expenses.reduce((a,x)=>a+numberValue(x.amount),0);
 const familyCount=APP.family.length;

 document.getElementById("app").innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="results-head"><button class="back-btn" id="backHome">← ${esc(t("home"))}</button>
   <div><div class="hero-badge">${esc(t("myWeek"))}</div><h1>${esc(t("myWeek"))}</h1></div>
  </section>
  <section class="money-result">
   <div class="money-grid">
    <div><span>${esc(t("available"))}</span><strong>${money(available)}</strong></div>
    <div><span>${esc(t("reserved"))}</span><strong>${money(reserved)}</strong></div>
    <div><span>${esc(t("myExpenses"))}</span><strong>${money(expenses)}</strong></div>
    <div><span>${esc(t("family"))}</span><strong>${familyCount}</strong></div>
   </div>
   <p class="small-note">${esc(t("saveData"))}</p>
  </section>
 </main>`;
 document.getElementById("backHome")?.addEventListener("click",renderHome);
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function renderExpenses(){
 const list=APP.expenses;
 document.getElementById("app").innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="results-head"><button class="back-btn" id="backHome">← ${esc(t("home"))}</button>
   <div><div class="hero-badge">${esc(t("myExpenses"))}</div><h1>${esc(t("myExpenses"))}</h1></div>
  </section>
  <section class="main-card">
   <div class="field"><label>${esc(t("expenseQuestion"))}</label><input id="expenseDescription" type="text"></div>
   <div class="field"><label>${esc(t("expenseAmount"))}</label><div class="amount-wrap"><span>$</span><input id="expenseAmount" type="number" min="0" step="0.01"></div></div>
   <button class="primary-btn" id="addExpense">${esc(t("addExpense"))}</button>
   <p class="small-note">${esc(t("saveData"))}</p>
  </section>
  <section class="expense-list">
   ${list.length?list.map((x,i)=>`<div class="expense-row"><span>${esc(x.description)}</span><strong>${money(x.amount)}</strong><button data-delete-expense="${i}">×</button></div>`).join(""):`<div class="empty-card">${esc(t("noExpenses"))}</div>`}
   ${list.length?`<div class="total-row"><span>TOTAL</span><strong>${money(list.reduce((a,x)=>a+numberValue(x.amount),0))}</strong></div>`:""}
  </section>
 </main>`;

 document.getElementById("backHome")?.addEventListener("click",renderHome);
 document.getElementById("addExpense")?.addEventListener("click",()=>{
  const description=document.getElementById("expenseDescription")?.value.trim();
  const amount=numberValue(document.getElementById("expenseAmount")?.value);
  if(!description||amount<=0)return;
  APP.expenses.push({description,amount,date:new Date().toISOString().slice(0,10)});
  saveLocal();renderExpenses()
 });
 document.querySelectorAll("[data-delete-expense]").forEach(b=>b.addEventListener("click",()=>{
  APP.expenses.splice(Number(b.dataset.deleteExpense),1);saveLocal();renderExpenses()
 }));
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function renderFamily(){
 const countries=APP.config?.countries||[];
 let options=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
 countries.forEach(c=>{
  const id=typeof c==="string"?c:(c.id||c.code||"");
  const name=typeof c==="string"?c:(c.name||c.country||id);
  options+=`<option value="${esc(id)}">${esc(name)}</option>`
 });

 document.getElementById("app").innerHTML=`${renderHeader()}
 <main class="shell">
  <section class="results-head"><button class="back-btn" id="backHome">← ${esc(t("home"))}</button>
   <div><div class="hero-badge">${esc(t("family"))}</div><h1>${esc(t("family"))}</h1></div>
  </section>
  <section class="main-card">
   <div class="field"><label>${esc(t("familyLabel"))}</label><input id="familyLabel" type="text" placeholder="${esc(t("familyLabel"))}"></div>
   <div class="field"><label>${esc(t("familyCountry"))}</label><select id="familyCountry">${options}</select></div>
   <button class="primary-btn" id="addFamily">${esc(t("addFamily"))}</button>
   <p class="small-note">${esc(t("saveData"))}</p>
  </section>
  <section class="family-list">
   ${APP.family.length?APP.family.map((x,i)=>`<div class="family-row"><div><strong>${esc(x.label)}</strong><small>${esc(countryName(x.destination_country)||x.destination_country)}</small></div><button data-delete-family="${i}">×</button></div>`).join(""):`<div class="empty-card">${esc(t("noFamily"))}</div>`}
  </section>
 </main>`;

 document.getElementById("backHome")?.addEventListener("click",renderHome);
 document.getElementById("addFamily")?.addEventListener("click",()=>{
  const label=document.getElementById("familyLabel")?.value.trim();
  const country=document.getElementById("familyCountry")?.value;
  if(!label||!country)return;
  APP.family.push({label,destination_country:country});
  saveLocal();renderFamily()
 });
 document.querySelectorAll("[data-delete-family]").forEach(b=>b.addEventListener("click",()=>{
  APP.family.splice(Number(b.dataset.deleteFamily),1);saveLocal();renderFamily()
 }));
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function renderError(message){
 document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="error-card"><div class="error-icon">!</div><h2>${esc(t("error"))}</h2><p>${esc(message||"")}</p><button class="primary-btn" id="retryBtn">${esc(t("back"))}</button></section></main>`;
 document.getElementById("retryBtn")?.addEventListener("click",renderHome);
 document.getElementById("languageBtn")?.addEventListener("click",toggleLanguage)
}

function restart(){
 APP.sessionId=null;
 APP.amount="";
 APP.destination="";
 APP.priority="";
 APP.delivery="";
 APP.freeText="";
 APP.comparison=null;
 APP.selectedProvider=null;
 localStorage.removeItem("remesas_destination");
 createSession().finally(renderHome)
}

async function boot(){
 try{
  await loadConfig();
  await createSession();
  renderHome()
 }catch(e){renderError(e.message)}
}

document.addEventListener("DOMContentLoaded",boot);
