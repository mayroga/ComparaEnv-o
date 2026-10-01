"use strict";

const APP={
 version:"4.2.1",
 config:null,
 sessionId:null,
 language:localStorage.getItem("remesas_language")||"es",
 amount:"",
 destination:localStorage.getItem("remesas_destination")||"",
 priority:"",
 delivery:"",
 paymentMethod:"",
 freeText:"",
 comparison:null,
 selectedProvider:null,
 access:null,
 accessToken:localStorage.getItem("remesas_access_token")||"",
 accessExpires:Number(localStorage.getItem("remesas_access_expires")||0),
 paymentChecking:false,
 adminTaps:[],
 moneyKey:"remesas_money_v4",
 expensesKey:"remesas_expenses_v4",
 familyKey:"remesas_family_v4",
 prefsKey:"remesas_prefs_v4"
};

const TEXT={
es:{
loading:"Preparando REMESAS.",
title:"REMESAS",
subtitle:"Una forma sencilla de organizar tu dinero y preparar una remesa.",
serviceTitle:"SERVICIO REMESAS",
servicePrice:"$10.99",
serviceTime:"20 minutos",
serviceText:"Un solo pago. Acceso al servicio durante 20 minutos.",
pay:"PAGAR $10.99",
checkingPayment:"Verificando tu pago...",
paymentError:"No pudimos confirmar el pago. Inténtalo nuevamente.",
paymentCancelled:"El pago fue cancelado.",
accessExpired:"Tu acceso terminó. Puedes volver a entrar realizando un nuevo pago.",
admin:"Acceso administrativo",
username:"Usuario",
password:"Contraseña",
login:"ENTRAR",
cancel:"CANCELAR",
invalidLogin:"Usuario o contraseña incorrectos.",
adminConfigured:"Acceso administrativo",
question:"¿QUÉ NECESITAS HOY?",
amount:"¿Cuánto quieres enviar?",
amountPlaceholder:"Ej. 500",
destination:"¿A qué país quieres enviar?",
destinationPlaceholder:"Selecciona un país",
priority:"¿Qué es lo más importante para ti?",
fastest:"MÁS RÁPIDO",
save:"AHORRAR",
receiveMore:"QUE RECIBA MÁS",
urgent:"URGENTE",
balanced:"MEJOR EQUILIBRIO",
compare:"COMPARAR TODO",
other:"OTRA NECESIDAD",
freeText:"Cuéntame qué necesitas",
freeTextPlaceholder:"Ej. Quiero mandar $500 a México y necesito que llegue hoy.",
continue:"CONTINUAR",
back:"ATRÁS",
clear:"EMPEZAR DE NUEVO",
help:"NO SÉ QUÉ HACER",
options:"Opciones para ti",
verified:"Información verificada",
fee:"Tarifa",
rate:"Tipo de cambio",
receive:"Recibe",
delivery:"Entrega",
method:"Forma de entrega",
official:"IR AL PROVEEDOR",
review:"REVISA ANTES DE CONTINUAR",
country:"País",
sendAmount:"Monto a enviar",
receiveAmount:"Monto que recibe",
payment:"Forma de pago",
check:"VERIFICAR",
selected:"Opción seleccionada",
finalText:"Antes de continuar, revisa que los datos coincidan con lo que quieres enviar.",
yes:"CONFIRMAR",
no:"VOLVER",
noResults:"No encontramos una cotización comercial verificada todavía.",
tryAgain:"Las opciones están disponibles, pero los datos comerciales actuales requieren verificación.",
helpTitle:"Te ayudamos a decidir",
helpText:"No necesitas saber qué plataforma usar. Dime qué es lo más importante para ti.",
close:"CERRAR",
language:"EN",
available:"Plataformas disponibles para tu destino.",
commercialUnavailable:"Cotización actual no disponible",
error:"No pudimos completar la consulta.",
countryRequired:"Selecciona un país.",
amountRequired:"Indica cuánto quieres enviar.",
learn:"APRENDER",
guide:"GUÍA RÁPIDA",
money:"MI DINERO",
learnTitle:"APRENDE A HACER UNA REMESA",
guideTitle:"GUÍA RÁPIDA",
moneyTitle:"MI DINERO",
learnText:"Aprende el proceso con explicaciones originales de REMESAS.",
guideText:"Sigue los pasos y termina en la página oficial del proveedor.",
moneyText:"Organiza tus entradas, gastos, ahorro y dinero disponible.",
officialNotice:"REMESAS es un servicio independiente. No es banco, financiera, procesador de pagos, asesor financiero ni representante oficial de ningún proveedor."
},
en:{
loading:"Preparing REMITTANCES.",
title:"REMITTANCES",
subtitle:"A simple way to organize your money and prepare a remittance.",
serviceTitle:"REMITTANCES SERVICE",
servicePrice:"$10.99",
serviceTime:"20 minutes",
serviceText:"One payment. Service access for 20 minutes.",
pay:"PAY $10.99",
checkingPayment:"Checking your payment...",
paymentError:"We could not confirm the payment. Please try again.",
paymentCancelled:"Payment was cancelled.",
accessExpired:"Your access ended. You can enter again with a new payment.",
admin:"Administrative access",
username:"Username",
password:"Password",
login:"ENTER",
cancel:"CANCEL",
invalidLogin:"Incorrect username or password.",
adminConfigured:"Administrative access",
question:"WHAT DO YOU NEED TODAY?",
amount:"How much do you want to send?",
amountPlaceholder:"Example: 500",
destination:"Which country are you sending to?",
destinationPlaceholder:"Select a country",
priority:"What matters most to you?",
fastest:"FASTEST",
save:"SAVE MONEY",
receiveMore:"RECIPIENT GETS MORE",
urgent:"URGENT",
balanced:"BEST BALANCE",
compare:"COMPARE EVERYTHING",
other:"OTHER NEED",
freeText:"Tell me what you need",
freeTextPlaceholder:"Example: I want to send $500 to Mexico and need it there today.",
continue:"CONTINUE",
back:"BACK",
clear:"START OVER",
help:"I DON'T KNOW WHAT TO DO",
options:"Options for you",
verified:"Verified information",
fee:"Fee",
rate:"Exchange rate",
receive:"Recipient gets",
delivery:"Delivery",
method:"Delivery method",
official:"GO TO PROVIDER",
review:"REVIEW BEFORE CONTINUING",
country:"Country",
sendAmount:"Amount to send",
receiveAmount:"Recipient gets",
payment:"Payment method",
check:"VERIFY",
selected:"Selected option",
finalText:"Before continuing, make sure the details match what you want to send.",
yes:"CONFIRM",
no:"GO BACK",
noResults:"We could not find a verified commercial quote yet.",
tryAgain:"The options are available, but current commercial data requires verification.",
helpTitle:"We'll help you decide",
helpText:"You don't need to know which platform to use. Tell us what matters most.",
close:"CLOSE",
language:"ES",
available:"Platforms available for your destination.",
commercialUnavailable:"Current quote unavailable",
error:"We couldn't complete the request.",
countryRequired:"Select a country.",
amountRequired:"Enter the amount.",
learn:"LEARN",
guide:"QUICK GUIDE",
money:"MY MONEY",
learnTitle:"LEARN HOW TO SEND A REMITTANCE",
guideTitle:"QUICK GUIDE",
moneyTitle:"MY MONEY",
learnText:"Learn the process with original REMITTANCES explanations.",
guideText:"Follow the steps and finish at the provider's official website.",
moneyText:"Organize income, expenses, savings and available money.",
officialNotice:"REMITTANCES is an independent service. It is not a bank, financial institution, payment processor, financial advisor or official representative of any provider."
}
};

function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}

function esc(v){
return String(v==null?"":v)
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;")
}

function money(v,currency="USD"){
if(v===null||v===undefined||v==="")return"—";
const n=Number(v);
if(!Number.isFinite(n))return esc(v);
try{
return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:currency||"USD",maximumFractionDigits:2}).format(n)
}catch(e){
return`${n.toFixed(2)} ${currency}`
}
}

function saveLocal(){
localStorage.setItem("remesas_language",APP.language);
if(APP.destination)localStorage.setItem("remesas_destination",APP.destination);
}

function accessValid(){
return!!APP.accessToken&&APP.accessExpires>Date.now();
}

function clearAccess(){
APP.accessToken="";
APP.accessExpires=0;
APP.access=null;
localStorage.removeItem("remesas_access_token");
localStorage.removeItem("remesas_access_expires");
}

function setAccess(data){
if(!data)return false;
const token=data.token||data.access?.token;
const expires=Number(data.expires_at||data.access?.expires_at||0);
if(!token||!expires)return false;
APP.accessToken=token;
APP.accessExpires=expires>100000000000?expires:expires*1000;
APP.access={
token:APP.accessToken,
expires_at:APP.accessExpires,
seconds_remaining:Math.max(0,Math.floor((APP.accessExpires-Date.now())/1000)),
active:true,
subject:data.subject||data.access?.subject||"user"
};
localStorage.setItem("remesas_access_token",APP.accessToken);
localStorage.setItem("remesas_access_expires",String(APP.accessExpires));
return true
}

async function api(url,options={}){
const headers={"Accept":"application/json",...(options.headers||{})};
if(options.body!==undefined&&!headers["Content-Type"])headers["Content-Type"]="application/json";
if(APP.accessToken)headers["X-Remesas-Access-Token"]=APP.accessToken;
const response=await fetch(url,{...options,headers});
let data=null;
try{data=await response.json()}catch(e){}
if(response.status===401){
clearAccess();
if(!options.skipAccessRedirect)renderPaywall(t("accessExpired"));
throw new Error(data?.detail||data?.message||"401")
}
if(!response.ok)throw new Error(data?.detail||data?.message||data?.error||t("error"));
return data
}

async function publicApi(url,options={}){
const headers={"Accept":"application/json",...(options.headers||{})};
if(options.body!==undefined&&!headers["Content-Type"])headers["Content-Type"]="application/json";
const response=await fetch(url,{...options,headers});
let data=null;
try{data=await response.json()}catch(e){}
if(!response.ok)throw new Error(data?.detail||data?.message||data?.error||t("error"));
return data
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

function bindLanguage(fn){
document.getElementById("languageBtn")?.addEventListener("click",()=>{
APP.language=APP.language==="es"?"en":"es";
saveLocal();
fn()
})
}

function renderPaywall(message=""){
const configured=!!APP.config?.stripe?.enabled;
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell centered">
<section class="main-card paywall-card">
<div class="hero-badge">● ${esc(t("serviceTitle"))}</div>
<h1>${esc(t("serviceTitle"))}</h1>
<div class="pay-price">${esc(t("servicePrice"))}</div>
<h2>${esc(t("serviceTime"))}</h2>
<p>${esc(t("serviceText"))}</p>
<div class="paywall-includes">
<div>✓ ${esc(t("money"))}</div>
<div>✓ ${esc(t("question"))}</div>
<div>✓ ${esc(t("learn"))}</div>
<div>✓ ${esc(t("guide"))}</div>
<div>✓ ${esc(t("compare"))}</div>
</div>
${message?`<div class="error-box">${esc(message)}</div>`:""}
${configured?
`<button class="primary-btn" id="payBtn">${esc(t("pay"))}</button>`:
`<div class="error-box">${esc(APP.language==="es"?"El pago no está configurado en este momento.":"Payment is not configured at this time.")}</div>`}
<p class="small-note">${esc(t("officialNotice"))}</p>
</section>
</main>
<div id="modal"></div>`;
document.getElementById("payBtn")?.addEventListener("click",startPayment);
bindLanguage(()=>renderPaywall(message))
}

async function startPayment(){
const btn=document.getElementById("payBtn");
if(btn){btn.disabled=true;btn.textContent=t("loading")}
try{
const data=await publicApi("/api/create-checkout-session",{method:"POST",body:"{}"});
if(!data?.checkout_url)throw new Error(t("paymentError"));
window.location.href=data.checkout_url
}catch(e){
renderPaywall(e.message)
}
}

async function checkPaymentReturn(){
const params=new URLSearchParams(window.location.search);
const payment=params.get("payment");
const sessionId=params.get("session_id");
if(payment==="cancelled"){
history.replaceState({},document.title,window.location.pathname);
renderPaywall(t("paymentCancelled"));
return false
}
if(payment!=="success"||!sessionId)return false;
renderLoading(t("checkingPayment"));
try{
const data=await publicApi(`/api/payment/check?session_id=${encodeURIComponent(sessionId)}`);
history.replaceState({},document.title,window.location.pathname);
if(data?.authorized&&data?.token){
setAccess(data);
await afterAccess();
return true
}
renderPaywall(t("paymentError"));
return true
}catch(e){
history.replaceState({},document.title,window.location.pathname);
renderPaywall(e.message||t("paymentError"));
return true
}
}

async function checkAccess(){
if(!accessValid())return false;
try{
const data=await api("/api/access/status",{skipAccessRedirect:true});
if(data?.active){
APP.access={...data,token:APP.accessToken};
if(data.expires_at){
APP.accessExpires=Number(data.expires_at)>100000000000?Number(data.expires_at):Number(data.expires_at)*1000;
localStorage.setItem("remesas_access_expires",String(APP.accessExpires))
}
return true
}
}catch(e){}
clearAccess();
return false
}

async function afterAccess(){
if(!APP.config)await loadConfig();
await createSession();
renderHome()
}

async function createSession(){
try{
const data=await publicApi(`/api/session?language=${encodeURIComponent(APP.language)}`,{method:"POST",body:"{}"});
APP.sessionId=data?.session?.session_id||data?.session_id||null;
return APP.sessionId
}catch(e){
APP.sessionId=null;
return null
}
}

async function ensureSession(){
if(!APP.sessionId)await createSession();
return APP.sessionId
}

async function loadConfig(){
APP.config=await publicApi(`/api/config?language=${encodeURIComponent(APP.language)}`)
}

function renderLoading(text=t("loading")){
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell centered">
<section class="loading-card">
<div class="loader large"></div>
<h2>${esc(text)}</h2>
</section>
</main>`;
bindLanguage(()=>renderLoading(text))
}

function renderHome(){
if(!accessValid()){
renderPaywall();
return
}
const opening=APP.config?.opening||{};
const countries=APP.config?.countries||[];
const priorities=opening.priorities||[];
const buttons=(priorities.length?priorities:["fastest","save","recipient_gets_more","urgent","balanced","compare_all"]).map(p=>{
const id=priorityId(p);
return`<button class="priority-btn ${APP.priority===id?"active":""}" data-priority="${esc(id)}">${esc(priorityLabel(p))}</button>`
}).join("");
let options=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
countries.forEach(c=>{
const id=typeof c==="string"?c:(c.id||c.code||"");
const name=typeof c==="string"?c:(c.name||c.country||id);
options+=`<option value="${esc(id)}" ${APP.destination===id?"selected":""}>${esc(name)}</option>`
});
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="hero">
<div class="hero-badge">● SIMPLE · CLARO · DIRECTO</div>
<h1>${esc(opening.primary_question||t("question"))}</h1>
<p>${esc(opening.secondary_text||t("subtitle"))}</p>
</section>
<section class="main-card">
<div class="field"><label>${esc(t("amount"))}</label><div class="amount-wrap"><span>$</span><input id="amountInput" inputmode="decimal" type="number" min="1" step="0.01" placeholder="${esc(opening.amount?.placeholder||t("amountPlaceholder"))}" value="${esc(APP.amount)}"></div></div>
<div class="field"><label>${esc(t("destination"))}</label><select id="destinationInput">${options}</select></div>
<div class="field"><label>${esc(t("priority"))}</label><div class="priority-grid">${buttons}</div></div>
<button class="help-link" id="helpBtn">?</button>
<button class="primary-btn" id="continueBtn">${esc(t("continue"))}</button>
<button class="secondary-btn" id="freeTextBtn">${esc(t("other"))}</button>
<div id="freeTextArea" class="free-text-area hidden">
<label>${esc(t("freeText"))}</label>
<textarea id="freeTextInput" rows="3" placeholder="${esc(opening.free_text?.placeholder||t("freeTextPlaceholder"))}">${esc(APP.freeText)}</textarea>
<button class="primary-btn" id="freeTextContinue">${esc(t("continue"))}</button>
</div>
</section>
<section class="main-card quick-actions">
<button class="secondary-btn" id="learnBtn">${esc(t("learn"))}</button>
<button class="secondary-btn" id="guideBtn">${esc(t("guide"))}</button>
<button class="secondary-btn" id="moneyBtn">${esc(t("money"))}</button>
</section>
<footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer>
</main><div id="modal"></div>`;
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
document.getElementById("learnBtn")?.addEventListener("click",renderLearning);
document.getElementById("guideBtn")?.addEventListener("click",renderQuickGuide);
document.getElementById("moneyBtn")?.addEventListener("click",renderMoney);
bindLanguage(renderHome)
}

function collectNeed(){
return{
session_id:APP.sessionId,
language:APP.language,
amount:Number(APP.amount),
send_currency:"USD",
destination_country:APP.destination,
priority:APP.priority||"balanced",
delivery_method:APP.delivery||null,
payment_method:APP.paymentMethod||null,
special_need:APP.freeText||null
}
}

async function startComparison(){
if(!accessValid()){renderPaywall();return}
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
const input=document.getElementById("freeTextInput");
const text=input?.value.trim();
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
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell"><section class="main-card">
<div class="hero-badge">● ${esc(t("helpTitle"))}</div>
<h1>${esc(t("question"))}</h1>
<p>${esc(t("helpText"))}</p>
<div class="missing-box">${missing.map(x=>`<div>• ${esc(x)}</div>`).join("")}</div>
<button class="primary-btn" id="completeBtn">${esc(t("continue"))}</button>
<button class="secondary-btn" id="backBtn">${esc(t("back"))}</button>
</section></main>`;
document.getElementById("completeBtn")?.addEventListener("click",renderHome);
document.getElementById("backBtn")?.addEventListener("click",renderHome);
bindLanguage(renderNeedMissing)
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

function formatMethod(v){
const map={
cash_pickup:APP.language==="es"?"Efectivo":"Cash pickup",
bank_account:APP.language==="es"?"Cuenta bancaria":"Bank account",
debit_card:APP.language==="es"?"Tarjeta de débito":"Debit card",
mobile_wallet:APP.language==="es"?"Billetera móvil":"Mobile wallet",
home_delivery:APP.language==="es"?"Entrega a domicilio":"Home delivery"
};
return map[v]||v
}

function renderResults(){
const data=APP.comparison||{};
const results=getResults();
const verified=(data.results||[]).length>0;
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="results-head">
<button class="back-btn" id="backBtn">← ${esc(t("back"))}</button>
<div><div class="hero-badge">● ${esc(verified?t("verified"):t("available"))}</div><h1>${esc(t("options"))}</h1><p>${esc(formatSummary())}</p></div>
</section>
<section class="results-list">
${results.length?results.map(renderResultCard).join(""):`<div class="empty-card"><div class="empty-icon">—</div><h2>${esc(t("noResults"))}</h2><p>${esc(t("tryAgain"))}</p></div>`}
</section>
<footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer>
</main>`;
document.getElementById("backBtn")?.addEventListener("click",renderHome);
document.getElementById("clearBtn")?.addEventListener("click",restart);
document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{
const p=results.find(x=>resultId(x)===b.dataset.provider);
if(p)renderFinalCheck(p)
}));
bindLanguage(renderResults)
}

function formatSummary(){
return`${money(Number(APP.amount),"USD")} → ${countryName(APP.destination)}`
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
const currency=resultValue(r,"currency")||resultValue(r,"recipient_currency")||"";
const url=r.continue_url||r.official_site||"";
return`
<article class="provider-card">
<div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div><span class="verified-pill">${verified?"✓ "+esc(t("verified")):esc(t("commercialUnavailable"))}</span></div>
<div class="provider-main">
<div class="receive-box"><span>${esc(t("receive"))}</span><strong>${recipient!==null?money(recipient,currency):"—"}</strong></div>
<div class="details-grid">
<div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee,"USD"):"—"}</strong></div>
<div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):"—"}</strong></div>
<div><span>${esc(t("delivery"))}</span><strong>${delivery!==null?esc(delivery):"—"}</strong></div>
<div><span>${esc(t("method"))}</span><strong>${method?esc(formatMethod(method)):"—"}</strong></div>
</div></div>
<div class="provider-foot"><small>${verified?esc(t("verified")):esc(t("commercialUnavailable"))}</small>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div>
<button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(verified?t("check"):t("official"))}</button>
</article>`
}

async function renderFinalCheck(provider){
const id=resultId(provider);
const verified=provider.commercial_verified===true||provider.commercial_status==="verified";
if(!verified){
const url=provider.continue_url||provider.official_site;
if(url)window.open(url,"_blank","noopener,noreferrer");
return
}
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(provider.provider_name||id)}</h1><p>${esc(t("finalText"))}</p></div></section>
<section class="review-card">
<h2>${esc(t("review"))}</h2>
<div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div>
<div class="review-row"><span>${esc(t("sendAmount"))}</span><strong>${money(Number(APP.amount),"USD")}</strong></div>
<div class="review-row"><span>${esc(t("fee"))}</span><strong>${provider.fee!=null?money(provider.fee,"USD"):"—"}</strong></div>
<div class="review-row"><span>${esc(t("rate"))}</span><strong>${provider.exchange_rate!=null?esc(provider.exchange_rate):"—"}</strong></div>
<div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${provider.recipient_amount!=null?money(provider.recipient_amount,provider.currency||"USD"):"—"}</strong></div>
<div class="review-row"><span>${esc(t("method"))}</span><strong>${provider.delivery_method?esc(formatMethod(provider.delivery_method)):"—"}</strong></div>
<div class="review-actions"><button class="secondary-btn" id="backResults">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div>
<div id="finalStatus"></div>
</section></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderResults);
document.getElementById("backResults")?.addEventListener("click",renderResults);
document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(provider,id));
bindLanguage(()=>renderFinalCheck(provider))
}

async function performFinalCheck(provider,id){
const status=document.getElementById("finalStatus");
if(!status)return;
status.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
try{
const result=await api("/api/final-check",{method:"POST",body:JSON.stringify({
language:APP.language,
provider_id:id,
amount:Number(APP.amount),
send_currency:"USD",
destination_country:APP.destination,
delivery_method:provider.delivery_method||null,
payment_method:APP.paymentMethod||null,
recipient_information_entered:false,
recipient_amount:provider.recipient_amount??null,
fee:provider.fee??null,
exchange_rate:provider.exchange_rate??null
})});
const ready=result?.ready_to_continue!==false;
const url=provider.continue_url||provider.official_site;
status.innerHTML=`<div class="${ready?"success-box":"error-box"}"><strong>${ready?"✓ ":""}${esc(result?.message||t("finalText"))}</strong>${ready&&url?`<p><a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a></p>`:""}</div>`
}catch(e){
status.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`
}
}

async function renderLearning(){
renderLoading(t("loading"));
try{
const data=await api(`/api/learn?language=${encodeURIComponent(APP.language)}`);
const providers=data?.providers||[];
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="hero"><div class="hero-badge">● ${esc(t("learn"))}</div><h1>${esc(t("learnTitle"))}</h1><p>${esc(t("learnText"))}</p></section>
<section class="results-list">
${providers.map((p,i)=>`<article class="provider-card"><div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(p.name||p.provider_name||p.id)}</h2></div></div><p>${esc(p.description||p.title||t("learnText"))}</p><button class="primary-btn learn-provider" data-provider="${esc(p.id||p.provider_id||"")}">${esc(t("learn"))}</button></article>`).join("")}
</section>
<footer class="footer"><button id="backBtn">${esc(t("back"))}</button></footer>
</main>`;
document.querySelectorAll(".learn-provider").forEach(b=>b.addEventListener("click",()=>renderProviderLearning(b.dataset.provider)));
document.getElementById("backBtn")?.addEventListener("click",renderHome);
bindLanguage(renderLearning)
}catch(e){renderError(e.message)}
}

async function renderProviderLearning(id){
renderLoading(t("loading"));
try{
const data=await api(`/api/learn/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.language)}`);
const steps=data?.steps||data?.lessons||[];
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="hero"><div class="hero-badge">● ${esc(t("learn"))}</div><h1>${esc(data?.title||data?.provider_name||id)}</h1><p>${esc(data?.notice||t("learnText"))}</p></section>
<section class="results-list">
${steps.map((s,i)=>`<article class="main-card"><div class="hero-badge">${i+1}</div><h2>${esc(s.title||s.name||"")}</h2><p>${esc(s.teaches||s.description||s.text||"")}</p>${s.warning?`<div class="error-box">${esc(s.warning)}</div>`:""}</article>`).join("")}
</section>
<footer class="footer"><button id="backBtn">${esc(t("back"))}</button></footer>
</main>`;
document.getElementById("backBtn")?.addEventListener("click",renderLearning);
bindLanguage(()=>renderProviderLearning(id))
}catch(e){renderError(e.message)}
}

async function renderQuickGuide(){
renderLoading(t("loading"));
try{
const data=await api(`/api/quick-guide?language=${encodeURIComponent(APP.language)}`);
const providers=data?.providers||[];
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="hero"><div class="hero-badge">● ${esc(t("guide"))}</div><h1>${esc(t("guideTitle"))}</h1><p>${esc(t("guideText"))}</p></section>
<section class="results-list">
${providers.map((p,i)=>`<article class="provider-card"><div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(p.name||p.provider_name||p.id)}</h2></div></div><p>${esc(p.description||p.title||t("guideText"))}</p><button class="primary-btn guide-provider" data-provider="${esc(p.id||p.provider_id||"")}">${esc(t("guide"))}</button></article>`).join("")}
</section>
<footer class="footer"><button id="backBtn">${esc(t("back"))}</button></footer>
</main>`;
document.querySelectorAll(".guide-provider").forEach(b=>b.addEventListener("click",()=>renderProviderGuide(b.dataset.provider)));
document.getElementById("backBtn")?.addEventListener("click",renderHome);
bindLanguage(renderQuickGuide)
}catch(e){renderError(e.message)}
}

async function renderProviderGuide(id){
renderLoading(t("loading"));
try{
const data=await api(`/api/quick-guide/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.language)}`);
const steps=data?.steps||data?.guide||data?.lessons||[];
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="hero"><div class="hero-badge">● ${esc(t("guide"))}</div><h1>${esc(data?.title||data?.provider_name||id)}</h1><p>${esc(data?.notice||t("guideText"))}</p></section>
<section class="results-list">
${steps.map((s,i)=>`<article class="main-card"><div class="hero-badge">${i+1}</div><h2>${esc(s.title||s.name||"")}</h2><p>${esc(s.action||s.description||s.text||s.teaches||"")}</p></article>`).join("")}
</section>
<footer class="footer"><button id="backBtn">${esc(t("back"))}</button></footer>
</main>`;
document.getElementById("backBtn")?.addEventListener("click",renderQuickGuide);
bindLanguage(()=>renderProviderGuide(id))
}catch(e){renderError(e.message)}
}

function readMoney(){
try{return JSON.parse(localStorage.getItem(APP.moneyKey)||"{}")}catch(e){return{}}
}

function writeMoney(data){
localStorage.setItem(APP.moneyKey,JSON.stringify(data))
}

function renderMoney(){
const data=readMoney();
const income=Number(data.income||0);
const expenses=Number(data.expenses||0);
const savings=Number(data.savings||0);
const available=income-expenses-savings;
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell">
<section class="hero"><div class="hero-badge">● ${esc(t("money"))}</div><h1>${esc(t("moneyTitle"))}</h1><p>${esc(t("moneyText"))}</p></section>
<section class="main-card">
<div class="field"><label>GANO / ${APP.language==="es"?"INGRESOS":"INCOME"}</label><input id="incomeInput" type="number" min="0" step="0.01" value="${esc(income||"")}"></div>
<div class="field"><label>GASTO / ${APP.language==="es"?"GASTOS":"EXPENSES"}</label><input id="expenseInput" type="number" min="0" step="0.01" value="${esc(expenses||"")}"></div>
<div class="field"><label>AHORRO / ${APP.language==="es"?"AHORRO":"SAVINGS"}</label><input id="savingInput" type="number" min="0" step="0.01" value="${esc(savings||"")}"></div>
<button class="primary-btn" id="saveMoneyBtn">${esc(t("continue"))}</button>
</section>
<section class="review-card">
<div class="review-row"><span>INGRESOS</span><strong>${money(income)}</strong></div>
<div class="review-row"><span>GASTOS</span><strong>${money(expenses)}</strong></div>
<div class="review-row"><span>AHORRO</span><strong>${money(savings)}</strong></div>
<div class="review-row highlight"><span>${APP.language==="es"?"DISPONIBLE":"AVAILABLE"}</span><strong>${money(available)}</strong></div>
</section>
<footer class="footer"><button id="backBtn">${esc(t("back"))}</button></footer>
</main>`;
document.getElementById("saveMoneyBtn")?.addEventListener("click",()=>{
writeMoney({
income:Number(document.getElementById("incomeInput")?.value||0),
expenses:Number(document.getElementById("expenseInput")?.value||0),
savings:Number(document.getElementById("savingInput")?.value||0),
updated_at:new Date().toISOString()
});
renderMoney()
});
document.getElementById("backBtn")?.addEventListener("click",renderHome);
bindLanguage(renderMoney)
}

function showHelp(){
const modal=document.getElementById("modal");
if(!modal)return;
modal.innerHTML=`
<div class="modal-backdrop" id="modalBackdrop">
<div class="modal-card">
<button class="modal-close" id="modalClose">×</button>
<div class="hero-badge">?</div>
<h2>${esc(t("helpTitle"))}</h2>
<p>${esc(t("helpText"))}</p>
<button class="primary-btn" id="modalStart">${esc(t("continue"))}</button>
</div></div>`;
document.getElementById("modalClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")modal.innerHTML=""});
document.getElementById("modalStart")?.addEventListener("click",()=>{modal.innerHTML="";document.getElementById("amountInput")?.focus()})
}

function renderError(message){
document.getElementById("app").innerHTML=`
${renderHeader()}
<main class="shell centered">
<section class="error-card">
<div class="error-icon">!</div>
<h2>${esc(t("error"))}</h2>
<p>${esc(message||"")}</p>
<button class="primary-btn" id="retryBtn">${esc(t("back"))}</button>
</section></main>`;
document.getElementById("retryBtn")?.addEventListener("click",()=>{
if(accessValid())renderHome();else renderPaywall()
});
bindLanguage(()=>renderError(message))
}

function adminModal(){
const modal=document.getElementById("modal")||document.body.appendChild(Object.assign(document.createElement("div"),{id:"modal"}));
modal.innerHTML=`
<div class="modal-backdrop" id="adminBackdrop">
<div class="modal-card admin-card">
<button class="modal-close" id="adminClose">×</button>
<div class="hero-badge">● ${esc(t("admin"))}</div>
<h2>${esc(t("adminConfigured"))}</h2>
<div class="field"><label>${esc(t("username"))}</label><input id="adminUsername" autocomplete="username"></div>
<div class="field"><label>${esc(t("password"))}</label><input id="adminPassword" type="password" autocomplete="current-password"></div>
<div id="adminStatus"></div>
<button class="primary-btn" id="adminLoginBtn">${esc(t("login"))}</button>
<button class="secondary-btn" id="adminCancelBtn">${esc(t("cancel"))}</button>
</div></div>`;
document.getElementById("adminClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("adminCancelBtn")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("adminBackdrop")?.addEventListener("click",e=>{if(e.target.id==="adminBackdrop")modal.innerHTML=""});
document.getElementById("adminLoginBtn")?.addEventListener("click",adminLogin);
document.getElementById("adminPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")adminLogin()});
document.getElementById("adminUsername")?.focus()
}

async function adminLogin(){
const username=document.getElementById("adminUsername")?.value||"";
const password=document.getElementById("adminPassword")?.value||"";
const status=document.getElementById("adminStatus");
const btn=document.getElementById("adminLoginBtn");
if(!username||!password){
if(status)status.innerHTML=`<div class="error-box">${esc(t("invalidLogin"))}</div>`;
return
}
if(btn){btn.disabled=true;btn.textContent=t("loading")}
try{
const data=await publicApi("/api/access/admin",{method:"POST",body:JSON.stringify({username,password})});
if(!setAccess(data))throw new Error(t("invalidLogin"));
document.getElementById("modal").innerHTML="";
await afterAccess()
}catch(e){
if(status)status.innerHTML=`<div class="error-box">${esc(e.message||t("invalidLogin"))}</div>`;
if(btn){btn.disabled=false;btn.textContent=t("login")}
}
}

function registerAdminTap(){
const now=Date.now();
APP.adminTaps=APP.adminTaps.filter(x=>now-x<1400);
APP.adminTaps.push(now);
if(APP.adminTaps.length>=3){
APP.adminTaps=[];
adminModal()
}
}

function setupTripleTap(){
let lastTouch=0;
document.addEventListener("touchend",e=>{
const now=Date.now();
if(now-lastTouch<500||lastTouch===0){registerAdminTap()}
lastTouch=now
},{passive:true});
document.addEventListener("dblclick",registerAdminTap)
}

function restart(){
APP.sessionId=null;
APP.amount="";
APP.destination="";
APP.priority="";
APP.delivery="";
APP.paymentMethod="";
APP.freeText="";
APP.comparison=null;
APP.selectedProvider=null;
localStorage.removeItem("remesas_destination");
createSession().finally(()=>{
if(accessValid())renderHome();else renderPaywall()
})
}

async function boot(){
setupTripleTap();
try{
await loadConfig();
const paymentHandled=await checkPaymentReturn();
if(paymentHandled)return;
const active=await checkAccess();
if(active){
await afterAccess();
return
}
renderPaywall()
}catch(e){
renderPaywall(e.message||t("error"))
}
}

document.addEventListener("DOMContentLoaded",boot);
