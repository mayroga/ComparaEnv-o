"use strict";

const APP={
name:"REMESAS",version:"4.2.0",config:null,sessionId:null,session:null,
language:localStorage.getItem("remesas_language")||"es",
amount:"",destination:localStorage.getItem("remesas_destination")||"",
priority:"",delivery:"",payment:"",freeText:"",comparison:null,selectedProvider:null,
accessToken:localStorage.getItem("remesas_access_token")||"",
accessExpires:localStorage.getItem("remesas_access_expires")||"",
accessRole:localStorage.getItem("remesas_access_role")||"",
moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",
savingsKey:"remesas_savings_v4",prefsKey:"remesas_prefs_v4"
};

const TEXT={
es:{
loading:"Buscando opciones para lo que necesitas.",title:"REMESAS",
subtitle:"Organiza tu dinero, prepara una remesa y revisa opciones oficiales.",
question:"¿QUÉ NECESITAS HOY?",amount:"¿Cuánto quieres enviar?",
amountPlaceholder:"Ej. 500",destination:"¿A qué país quieres enviar?",
destinationPlaceholder:"Selecciona un país",priority:"¿Qué es lo más importante para ti?",
fastest:"MÁS RÁPIDO",save:"AHORRAR",receiveMore:"QUE RECIBA MÁS",urgent:"URGENTE",
balanced:"MEJOR EQUILIBRIO",compare:"COMPARAR TODO",other:"OTRA NECESIDAD",
freeText:"Cuéntame qué necesitas",freeTextPlaceholder:"Ej. Quiero mandar $500 a México y necesito que llegue hoy.",
continue:"CONTINUAR",back:"ATRÁS",clear:"EMPEZAR DE NUEVO",help:"NO SÉ QUÉ HACER",
options:"Opciones para ti",verified:"Información verificada",available:"Opciones disponibles",
fee:"Tarifa",rate:"Tipo de cambio",receive:"Recibe",delivery:"Entrega",method:"Forma de entrega",
official:"IR AL SITIO OFICIAL",review:"REVISA ANTES DE CONTINUAR",country:"País",
sendAmount:"Monto a enviar",receiveAmount:"Monto que recibe",payment:"Forma de pago",
check:"VERIFICAR",selected:"Opción seleccionada",finalText:"Revisa los datos antes de continuar.",
yes:"CONFIRMAR",no:"VOLVER",noResults:"No encontramos una cotización comercial verificada todavía.",
tryAgain:"La plataforma puede estar disponible, pero sus tarifas y tasas actuales requieren verificación.",
helpTitle:"TE AYUDAMOS",helpText:"No necesitas saber qué plataforma usar. Dime qué necesitas y te ayudamos a organizar el siguiente paso.",
close:"CERRAR",language:"EN",commercialUnavailable:"Cotización actual no disponible",
error:"No pudimos completar la consulta. Inténtalo nuevamente.",countryRequired:"Selecciona un país.",
amountRequired:"Indica cuánto quieres enviar.",accessTitle:"ACCESO A REMESAS",
accessText:"Para usar el servicio necesitas activar el acceso.",
pay:"ACTIVAR POR $10.99",admin:"",adminTitle:"Acceso administrativo",
username:"Username",password:"Password",signIn:"Entrar",adminError:"Usuario o contraseña incorrectos.",
accessActive:"Acceso activo",minutes:"minutos",expired:"El acceso terminó.",home:"INICIO",
myMoney:"MI DINERO",send:"ENVIAR REMESA",learn:"APRENDER",compare:"COMPARAR",
guide:"GUÍA RÁPIDA",family:"FAMILIA",expenses:"GASTOS",savings:"AHORRO",purchase:"COMPRA",
helpMenu:"AYUDA",deleteData:"BORRAR DATOS",exportData:"GUARDAR PDF",logout:"SALIR",
moneyTitle:"MI DINERO",moneyText:"Registra lo que tienes y mira cómo cambia después de tus movimientos.",
income:"Dinero que tengo",expense:"Gasto",saving:"Ahorro",transfer:"Remesa",
purchase:"Compra",add:"AGREGAR",total:"Disponible",description:"Descripción",value:"Cantidad",
saveData:"GUARDAR",cancel:"CANCELAR",saved:"Guardado en este dispositivo.",
learningTitle:"APRENDER",learningText:"Aprende cómo preparar una remesa sin copiar la pantalla de ningún proveedor.",
quickTitle:"GUÍA RÁPIDA",quickText:"Pasos sencillos desde preparar tu dinero hasta revisar el sitio oficial.",
familyTitle:"FAMILIA",familyText:"Guarda localmente los datos que usas con frecuencia.",
name:"Nombre",country:"País",addPerson:"AGREGAR PERSONA",
expensesTitle:"GASTOS",savingsTitle:"AHORRO",purchaseTitle:"COMPRA",
deleteConfirm:"¿Quieres borrar los datos guardados en este dispositivo?",
yesDelete:"SÍ, BORRAR",noDelete:"NO",noData:"No hay datos guardados todavía.",
pdfTitle:"REMESAS — RESUMEN",pdfText:"Este documento contiene los datos registrados localmente en este dispositivo.",
support:"APOYO",open:"ABRIR",next:"SIGUIENTE",finish:"TERMINAR"
},
en:{
loading:"Looking for options that fit what you need.",title:"REMITTANCES",
subtitle:"Organize your money, prepare a transfer and review official options.",
question:"WHAT DO YOU NEED TODAY?",amount:"How much do you want to send?",
amountPlaceholder:"Example: 500",destination:"Which country are you sending to?",
destinationPlaceholder:"Select a country",priority:"What matters most to you?",
fastest:"FASTEST",save:"SAVE MONEY",receiveMore:"RECIPIENT GETS MORE",urgent:"URGENT",
balanced:"BEST BALANCE",compare:"COMPARE EVERYTHING",other:"OTHER NEED",
freeText:"Tell me what you need",freeTextPlaceholder:"Example: I want to send $500 to Mexico and need it there today.",
continue:"CONTINUE",back:"BACK",clear:"START OVER",help:"I DON'T KNOW WHAT TO DO",
options:"Options for you",verified:"Verified information",available:"Available options",
fee:"Fee",rate:"Exchange rate",receive:"Recipient gets",delivery:"Delivery",method:"Delivery method",
official:"GO TO OFFICIAL SITE",review:"REVIEW BEFORE CONTINUING",country:"Country",
sendAmount:"Amount to send",receiveAmount:"Recipient gets",payment:"Payment method",
check:"VERIFY",selected:"Selected option",finalText:"Review the details before continuing.",
yes:"CONFIRM",no:"GO BACK",noResults:"We could not find a verified commercial quote yet.",
tryAgain:"The platform may be available, but current fees and rates require verification.",
helpTitle:"WE'LL HELP",helpText:"You do not need to know which platform to use. Tell us what you need and we will help with the next step.",
close:"CLOSE",language:"ES",commercialUnavailable:"Current quote unavailable",
error:"We could not complete the request. Please try again.",countryRequired:"Select a country.",
amountRequired:"Enter the amount.",accessTitle:"REMESAS ACCESS",
accessText:"You need to activate access to use the service.",
pay:"ACTIVATE FOR $10.99",admin:"",adminTitle:"Administrator access",
username:"Username",password:"Password",signIn:"Sign in",adminError:"Incorrect username or password.",
accessActive:"Access active",minutes:"minutes",expired:"Access expired.",home:"HOME",
myMoney:"MY MONEY",send:"SEND MONEY",learn:"LEARN",compare:"COMPARE",
guide:"QUICK GUIDE",family:"FAMILY",expenses:"EXPENSES",savings:"SAVINGS",purchase:"PURCHASE",
helpMenu:"HELP",deleteData:"DELETE DATA",exportData:"SAVE PDF",logout:"LOG OUT",
moneyTitle:"MY MONEY",moneyText:"Record what you have and see how it changes after your movements.",
income:"Money I have",expense:"Expense",saving:"Savings",transfer:"Transfer",
purchase:"Purchase",add:"ADD",total:"Available",description:"Description",value:"Amount",
saveData:"SAVE",cancel:"CANCEL",saved:"Saved on this device.",
learningTitle:"LEARN",learningText:"Learn how to prepare a transfer without copying any provider interface.",
quickTitle:"QUICK GUIDE",quickText:"Simple steps from preparing your money to checking the official site.",
familyTitle:"FAMILY",familyText:"Store frequently used information locally.",
name:"Name",country:"Country",addPerson:"ADD PERSON",
expensesTitle:"EXPENSES",savingsTitle:"SAVINGS",purchaseTitle:"PURCHASE",
deleteConfirm:"Do you want to delete the data saved on this device?",
yesDelete:"YES, DELETE",noDelete:"NO",noData:"There is no saved data yet.",
pdfTitle:"REMITTANCES — SUMMARY",pdfText:"This document contains information recorded locally on this device.",
support:"SUPPORT",open:"OPEN",next:"NEXT",finish:"FINISH"
}
};

function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function money(v,c="USD"){
if(v===null||v===undefined||v==="")return"—";
const n=Number(v);if(!Number.isFinite(n))return esc(v);
try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:c||"USD",maximumFractionDigits:2}).format(n)}
catch(e){return`${n.toFixed(2)} ${c}`}
}
function priorityId(p){return typeof p==="string"?p:p?.id||""}
function priorityLabel(p){
if(typeof p==="string"){
const m={fastest:"fastest",save:"save",recipient_gets_more:"receiveMore",urgent:"urgent",balanced:"balanced",compare_all:"compare",other:"other"};
return t(m[p]||p)
}
return p?.label||p?.name||p?.id||""
}
function countryName(code){
const list=APP.config?.countries||[];
const x=list.find(c=>(typeof c==="string"?c:c.id||c.code)===code);
return x?(typeof x==="string"?x:x.name||x.country||code):code||""
}
function saveLocal(){
localStorage.setItem("remesas_language",APP.language);
if(APP.destination)localStorage.setItem("remesas_destination",APP.destination);
else localStorage.removeItem("remesas_destination")
}
function accessValid(){
if(!APP.accessToken)return false;
if(!APP.accessExpires)return true;
return Date.parse(APP.accessExpires)>Date.now()
}
function accessHeaders(){
return APP.accessToken?{"X-Remesas-Access-Token":APP.accessToken,"Authorization":`Bearer ${APP.accessToken}`}:{}
}
async function api(url,options={}){
const headers={"Content-Type":"application/json",...accessHeaders(),...(options.headers||{})};
const r=await fetch(url,{...options,headers});
let data=null;try{data=await r.json()}catch(e){}
if(r.status===401||r.status===403){
APP.accessToken="";APP.accessExpires="";APP.accessRole="";
localStorage.removeItem("remesas_access_token");localStorage.removeItem("remesas_access_expires");localStorage.removeItem("remesas_access_role");
if(!url.includes("/access/")&&!url.includes("/payment/"))renderAccessGate();
throw new Error(data?.detail||data?.message||"Access required")
}
if(!r.ok)throw new Error(data?.detail||data?.message||data?.error||t("error"));
return data
}

async function accessStatus(){
try{
const d=await api("/api/access/status");
if(d?.active&&d?.token){
APP.accessToken=d.token;APP.accessExpires=d.expires_at||"";
localStorage.setItem("remesas_access_token",APP.accessToken);
localStorage.setItem("remesas_access_expires",APP.accessExpires||"")
}
if(d?.active)return d;
}catch(e){}
return{active:accessValid(),expires_at:APP.accessExpires}
}

function renderHeader(showBack=false){
return`<header class="topbar"><div class="brand" id="brandHome"><div class="brand-mark">R</div><div><strong>${esc(t("title"))}</strong><span>May Roga LLC</span></div></div><div class="top-actions">${showBack?`<button class="secondary-btn" id="headerBack">←</button>`:""}<button class="language-btn" id="languageBtn">${esc(t("language"))}</button></div></header>`
}
function bindLanguage(fn){
document.getElementById("languageBtn")?.addEventListener("click",async()=>{APP.language=APP.language==="es"?"en":"es";saveLocal();if(fn)await fn();else renderAccessGate()});
document.getElementById("brandHome")?.addEventListener("click",()=>{if(accessValid())renderHomeShell()})
}

function renderAccessGate(){
const app=document.getElementById("app");
app.innerHTML=`${renderHeader()}<main class="shell centered"><section class="main-card access-card"><div class="hero-badge">● REMESAS</div><h1>${esc(t("accessTitle"))}</h1><p>${esc(t("accessText"))}</p><div class="access-price">$10.99</div><p><strong>20 ${esc(t("minutes"))}</strong></p><button class="primary-btn" id="payBtn">${esc(t("pay"))}</button><div id="accessMessage"></div></section><footer class="footer"><span>© May Roga LLC</span></footer></main>`;
document.getElementById("payBtn")?.addEventListener("click",startCheckout);
bindLanguage(renderAccessGate)
}

async function startCheckout(){
const b=document.getElementById("payBtn"),m=document.getElementById("accessMessage");
if(b)b.disabled=true;
if(m)m.innerHTML=`<p>${esc(t("loading"))}</p>`;
try{
const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.language,skipAccess:true})});
const url=d?.checkout_url||d?.url||d?.session_url;
if(!url)throw new Error(t("error"));
window.location.href=url
}catch(e){
if(m)m.innerHTML=`<div class="error-box">${esc(e.message)}</div>`;
if(b)b.disabled=false
}
}

function adminModal(){
let old=document.getElementById("adminModal");
if(old){old.remove();return}
const x=document.createElement("div");x.id="adminModal";x.className="modal";
x.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><button class="modal-close" id="adminClose">×</button><div class="hero-badge">●</div><h2>${esc(t("adminTitle"))}</h2><label>${esc(t("username"))}</label><input id="adminUser" autocomplete="username"><label>${esc(t("password"))}</label><input id="adminPass" type="password" autocomplete="current-password"><div id="adminError"></div><button class="primary-btn" id="adminSignIn">${esc(t("signIn"))}</button></div></div>`;
document.body.appendChild(x);
document.getElementById("adminClose")?.addEventListener("click",()=>x.remove());
document.getElementById("adminSignIn")?.addEventListener("click",adminLogin);
setTimeout(()=>document.getElementById("adminUser")?.focus(),60)
}

async function adminLogin(){
const u=document.getElementById("adminUser")?.value.trim(),p=document.getElementById("adminPass")?.value||"",e=document.getElementById("adminError"),b=document.getElementById("adminSignIn");
if(!u||!p){if(e)e.innerHTML=`<div class="error-box">${esc(t("adminError"))}</div>`;return}
if(b)b.disabled=true;
try{
const d=await api("/api/access/admin",{method:"POST",skipAccess:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})});
if(!d?.success||d.authorized===false)throw new Error(t("adminError"));
APP.accessToken=d.token||"";APP.accessExpires=d.expires_at||"";APP.accessRole=d.role||"admin";
localStorage.setItem("remesas_access_token",APP.accessToken);
localStorage.setItem("remesas_access_expires",APP.accessExpires||"");
localStorage.setItem("remesas_access_role",APP.accessRole);
document.getElementById("adminModal")?.remove();
await loadConfig();
await createSession();
renderHomeShell()
}catch(err){
if(e)e.innerHTML=`<div class="error-box">${esc(err.message||t("adminError"))}</div>`;
if(b)b.disabled=false
}
}

function installTripleTap(){
let taps=0,last=0;
const tap=()=>{
const now=Date.now();
if(now-last>700)taps=0;
last=now;taps++;
if(taps===3){taps=0;adminModal()}
};
document.addEventListener("pointerup",tap,{passive:true})
}

async function paymentReturnCheck(){
const qs=new URLSearchParams(location.search);
const sid=qs.get("session_id");
if(!sid)return false;
try{
const d=await api(`/api/payment/check?session_id=${encodeURIComponent(sid)}`);
if(d?.access||d?.active||d?.success){
APP.accessToken=d.token||d.access_token||"";
APP.accessExpires=d.expires_at||d.access_until||"";
if(APP.accessToken)localStorage.setItem("remesas_access_token",APP.accessToken);
if(APP.accessExpires)localStorage.setItem("remesas_access_expires",APP.accessExpires);
history.replaceState({},document.title,location.pathname);
return true
}
}catch(e){}
history.replaceState({},document.title,location.pathname);
return false
}

async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.language)}`)}
async function createSession(){
try{
const d=await api(`/api/session?language=${encodeURIComponent(APP.language)}`,{method:"POST",body:"{}"});
APP.session=d?.session||d;APP.sessionId=APP.session?.session_id||d?.session_id||null;
return APP.sessionId
}catch(e){APP.session=null;APP.sessionId=null;return null}
}
async function ensureSession(){if(!APP.sessionId)await createSession();return APP.sessionId}

function renderHomeShell(){
if(!accessValid()){renderAccessGate();return}
const app=document.getElementById("app");
app.innerHTML=`${renderHeader()}<main class="shell"><section class="hero"><div class="hero-badge">● SIMPLE · CLARO · DIRECTO</div><h1>${esc(t("question"))}</h1><p>${esc(t("subtitle"))}</p></section><section class="menu-grid">
<button class="menu-card" data-action="send"><strong>💸</strong><span>${esc(t("send"))}</span></button>
<button class="menu-card" data-action="money"><strong>💰</strong><span>${esc(t("myMoney"))}</span></button>
<button class="menu-card" data-action="learn"><strong>📘</strong><span>${esc(t("learn"))}</span></button>
<button class="menu-card" data-action="compare"><strong>🔎</strong><span>${esc(t("compare"))}</span></button>
<button class="menu-card" data-action="guide"><strong>🧭</strong><span>${esc(t("guide"))}</span></button>
<button class="menu-card" data-action="family"><strong>👨‍👩‍👧</strong><span>${esc(t("family"))}</span></button>
<button class="menu-card" data-action="expenses"><strong>🧾</strong><span>${esc(t("expenses"))}</span></button>
<button class="menu-card" data-action="savings"><strong>🏦</strong><span>${esc(t("savings"))}</span></button>
<button class="menu-card" data-action="purchase"><strong>🛒</strong><span>${esc(t("purchase"))}</span></button>
<button class="menu-card" data-action="help"><strong>❓</strong><span>${esc(t("helpMenu"))}</span></button>
<button class="menu-card" data-action="pdf"><strong>📄</strong><span>${esc(t("exportData"))}</span></button>
<button class="menu-card" data-action="delete"><strong>🗑️</strong><span>${esc(t("deleteData"))}</span></button>
</section><div class="access-status">${esc(t("accessActive"))}${APP.accessExpires?` · ${timeLeft(APP.accessExpires)}`:""}</div><footer class="footer"><button id="logoutBtn">${esc(t("logout"))}</button></footer></main>`;
document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>homeAction(b.dataset.action)));
document.getElementById("logoutBtn")?.addEventListener("click",logout);
bindLanguage(renderHomeShell)
}

function timeLeft(expires){
const s=Math.max(0,Math.floor((Date.parse(expires)-Date.now())/1000));
if(!Number.isFinite(s)||!expires)return"";
return`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`
}

async function homeAction(a){
if(a==="send"||a==="compare"){renderSendForm();return}
if(a==="money"){renderMoney();return}
if(a==="learn"){renderLearning();return}
if(a==="guide"){renderQuickGuide();return}
if(a==="family"){renderFamily();return}
if(a==="expenses"){renderLedger("expenses");return}
if(a==="savings"){renderLedger("savings");return}
if(a==="purchase"){renderLedger("purchase");return}
if(a==="help"){showHelpFull();return}
if(a==="pdf"){exportPDF();return}
if(a==="delete"){deleteLocal();return}
}

function renderSendForm(){
const countries=APP.config?.countries||[],opening=APP.config?.opening||{},priorities=opening.priorities||[];
let options=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
countries.forEach(c=>{const id=typeof c==="string"?c:c.id||c.code||"",n=typeof c==="string"?c:c.name||c.country||id;options+=`<option value="${esc(id)}" ${APP.destination===id?"selected":""}>${esc(n)}</option>`});
const ps=(priorities.length?priorities:["fastest","save","recipient_gets_more","urgent","balanced","compare_all"]).map(p=>{const id=priorityId(p);return`<button class="priority-btn ${APP.priority===id?"active":""}" data-priority="${esc(id)}">${esc(priorityLabel(p))}</button>`}).join("");
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("send"))}</div><h1>${esc(t("question"))}</h1><p>${esc(t("subtitle"))}</p></section><section class="main-card"><div class="field"><label>${esc(t("amount"))}</label><div class="amount-wrap"><span>$</span><input id="amountInput" inputmode="decimal" type="number" min="1" step=".01" placeholder="${esc(t("amountPlaceholder"))}" value="${esc(APP.amount)}"></div></div><div class="field"><label>${esc(t("destination"))}</label><select id="destinationInput">${options}</select></div><div class="field"><label>${esc(t("priority"))}</label><div class="priority-grid">${ps}</div></div><div class="field"><label>${esc(t("freeText"))}</label><textarea id="freeTextInput" rows="3" placeholder="${esc(t("freeTextPlaceholder"))}">${esc(APP.freeText)}</textarea></div><button class="primary-btn" id="continueBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="helpBtn">${esc(t("help"))}</button></section></main>`;
document.getElementById("headerBack")?.addEventListener("click",renderHomeShell);
document.getElementById("amountInput")?.addEventListener("input",e=>APP.amount=e.target.value);
document.getElementById("destinationInput")?.addEventListener("change",e=>{APP.destination=e.target.value;saveLocal()});
document.querySelectorAll(".priority-btn").forEach(b=>b.addEventListener("click",()=>{APP.priority=b.dataset.priority;document.querySelectorAll(".priority-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
document.getElementById("freeTextInput")?.addEventListener("input",e=>APP.freeText=e.target.value);
document.getElementById("continueBtn")?.addEventListener("click",startComparison);
document.getElementById("helpBtn")?.addEventListener("click",showHelpFull);
bindLanguage(renderSendForm)
}

function collectNeed(){
return{session_id:APP.sessionId,language:APP.language,amount:Number(APP.amount),send_currency:"USD",destination_country:APP.destination,priority:APP.priority||"balanced",delivery_method:APP.delivery||null,payment_method:APP.payment||null,special_need:APP.freeText||null}
}

function renderLoading(){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="loading-card"><div class="loader large"></div><h2>${esc(t("options"))}</h2><p>${esc(t("loading"))}</p></section></main>`
}

async function startComparison(){
APP.amount=document.getElementById("amountInput")?.value||APP.amount;
APP.destination=document.getElementById("destinationInput")?.value||APP.destination;
APP.freeText=document.getElementById("freeTextInput")?.value||APP.freeText;
const n=Number(APP.amount);
if(!APP.destination){alert(t("countryRequired"));return}
if(!n||n<=0){alert(t("amountRequired"));return}
if(!APP.priority)APP.priority="balanced";
saveLocal();renderLoading();
try{
await ensureSession();
const need=collectNeed();
await api("/api/need",{method:"POST",body:JSON.stringify(need)});
APP.comparison=await api("/api/compare",{method:"POST",body:JSON.stringify(need)});
renderResults()
}catch(e){renderError(e.message)}
}

function getResults(){
const d=APP.comparison||{},out=[],seen=new Set();
(Array.isArray(d.results)?d.results:[]).forEach(r=>{const id=r?.provider_id||r?.id;if(id&&!seen.has(id)){seen.add(id);out.push({...r,commercial_verified:true,commercial_status:"verified"})}});
(Array.isArray(d.available_providers)?d.available_providers:[]).forEach(p=>{const id=p?.provider_id||p?.id;if(id&&!seen.has(id)){seen.add(id);out.push({...p,provider_id:id,provider_name:p.provider_name||p.name||id})}});
return out
}
function resultValue(r,k){return r?.[k]!==undefined?r[k]:r?.commercial_data?.[k]!==undefined?r.commercial_data[k]:null}

function renderResults(){
const d=APP.comparison||{},rs=getResults(),verified=(d.results||[]).length>0;
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(verified?t("verified"):t("available"))}</div><h1>${esc(t("options"))}</h1><p>${esc(formatSummary())}</p></div></section><section class="results-list">${rs.length?rs.map(renderResultCard).join(""):`<div class="empty-card"><h2>${esc(t("noResults"))}</h2><p>${esc(t("tryAgain"))}</p></div>`}</section></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderSendForm);
document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{const p=rs.find(x=>(x.provider_id||x.id)===b.dataset.provider);if(p)renderFinalCheck(p)}));
bindLanguage(renderResults)
}
function formatSummary(){return`${money(Number(APP.amount))} → ${esc(countryName(APP.destination))}`}

function renderResultCard(r,i){
const id=r.provider_id||r.id||"",name=r.provider_name||r.name||id,ver=r.commercial_verified===true||r.commercial_status==="verified";
const fee=ver?resultValue(r,"fee"):null,rate=ver?resultValue(r,"exchange_rate"):null,rec=ver?resultValue(r,"recipient_amount"):null;
const del=ver?(resultValue(r,"delivery_time")??resultValue(r,"estimated_delivery")):null,method=ver?resultValue(r,"delivery_method"):null;
const cur=resultValue(r,"currency")||resultValue(r,"recipient_currency")||"USD",url=r.continue_url||r.official_site||"";
return`<article class="provider-card"><div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div><span class="verified-pill">${ver?"✓ "+esc(t("verified")):esc(t("commercialUnavailable"))}</span></div><div class="provider-main"><div class="receive-box"><span>${esc(t("receive"))}</span><strong>${rec!==null?money(rec,cur):"—"}</strong></div><div class="details-grid"><div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee):"—"}</strong></div><div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):"—"}</strong></div><div><span>${esc(t("delivery"))}</span><strong>${del!==null?esc(del):"—"}</strong></div><div><span>${esc(t("method"))}</span><strong>${method?esc(formatMethod(method)):"—"}</strong></div></div></div><div class="provider-foot"><small>${ver?esc(t("verified")):esc(t("commercialUnavailable"))}</small>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div><button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(ver?t("check"):t("official"))}</button></article>`
}
function formatMethod(v){
const m={cash_pickup:APP.language==="es"?"Efectivo":"Cash pickup",bank_account:APP.language==="es"?"Cuenta bancaria":"Bank account",debit_card:APP.language==="es"?"Tarjeta de débito":"Debit card",mobile_wallet:APP.language==="es"?"Billetera móvil":"Mobile wallet",home_delivery:APP.language==="es"?"Entrega a domicilio":"Home delivery"};
return m[v]||v
}

async function renderFinalCheck(p){
const id=p.provider_id||p.id||"",ver=p.commercial_verified===true||p.commercial_status==="verified";
if(!ver){const u=p.continue_url||p.official_site;if(u)window.open(u,"_blank","noopener,noreferrer");return}
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="review-card"><button class="back-btn" id="backResults">← ${esc(t("back"))}</button><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(p.provider_name||p.name||id)}</h1><p>${esc(t("finalText"))}</p><div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div><div class="review-row"><span>${esc(t("sendAmount"))}</span><strong>${money(APP.amount)}</strong></div><div class="review-row"><span>${esc(t("fee"))}</span><strong>${p.fee!=null?money(p.fee):"—"}</strong></div><div class="review-row"><span>${esc(t("rate"))}</span><strong>${p.exchange_rate!=null?esc(p.exchange_rate):"—"}</strong></div><div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${p.recipient_amount!=null?money(p.recipient_amount,p.currency||p.recipient_currency||"USD"):"—"}</strong></div><div class="review-row"><span>${esc(t("method"))}</span><strong>${p.delivery_method?esc(formatMethod(p.delivery_method)):"—"}</strong></div><div class="review-actions"><button class="secondary-btn" id="backBtn">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div><div id="finalStatus"></div></section></main>`;
document.getElementById("backResults")?.addEventListener("click",renderResults);
document.getElementById("backBtn")?.addEventListener("click",renderResults);
document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(p,id));
bindLanguage(()=>renderFinalCheck(p))
}

async function performFinalCheck(p,id){
const s=document.getElementById("finalStatus");if(!s)return;
s.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
try{
const d=await api("/api/final-check",{method:"POST",body:JSON.stringify({language:APP.language,provider_id:id,amount:Number(APP.amount),send_currency:"USD",destination_country:APP.destination,delivery_method:p.delivery_method||null,payment_method:p.payment_method||null,recipient_amount:p.recipient_amount??null,fee:p.fee??null,exchange_rate:p.exchange_rate??null,recipient_information_entered:false})});
const ready=d?.ready_to_continue!==false,u=p.continue_url||p.official_site;
s.innerHTML=`<div class="${ready?"success-box":"error-box"}"><strong>${ready?"✓ "+esc(t("verified")):esc(t("tryAgain"))}</strong><p>${esc(d?.message||t("finalText"))}</p>${ready&&u?`<a class="primary-btn link-btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div>`
}catch(e){s.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`}
}

function showHelpFull(){
const topics=APP.config?.help||APP.config?.help_topics||[];
let body=topics.length?topics.map(x=>`<details><summary>${esc(x.label||x.title||x.id||"")}</summary><p>${esc(x.answer||x.text||"")}</p></details>`).join(""):`<p>${esc(t("helpText"))}</p>`;
const m=document.createElement("div");m.className="modal";m.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><button class="modal-close" id="closeHelp">×</button><div class="hero-badge">?</div><h2>${esc(t("helpTitle"))}</h2>${body}<button class="primary-btn" id="closeHelp2">${esc(t("close"))}</button></div></div>`;document.body.appendChild(m);
const close=()=>m.remove();document.getElementById("closeHelp")?.addEventListener("click",close);document.getElementById("closeHelp2")?.addEventListener("click",close)
}

function loadArray(key){try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}}
function saveArray(key,x){localStorage.setItem(key,JSON.stringify(x))}
function localMoney(){
const m=loadArray(APP.moneyKey),e=loadArray(APP.expensesKey),s=loadArray(APP.savingsKey),p=loadArray(APP.prefsKey);
const income=m.reduce((a,x)=>a+Number(x.amount||0),0),expenses=e.reduce((a,x)=>a+Number(x.amount||0),0),savings=s.reduce((a,x)=>a+Number(x.amount||0),0);
return{income,expenses,savings,available:income-expenses-savings}
}

function renderMoney(){
const x=localMoney();
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("moneyTitle"))}</div><h1>${esc(t("moneyTitle"))}</h1><p>${esc(t("moneyText"))}</p></section><section class="summary-grid"><div><span>${esc(t("income"))}</span><strong>${money(x.income)}</strong></div><div><span>${esc(t("expenses"))}</span><strong>${money(x.expenses)}</strong></div><div><span>${esc(t("savings"))}</span><strong>${money(x.savings)}</strong></div><div><span>${esc(t("total"))}</span><strong>${money(x.available)}</strong></div></section><section class="main-card"><button class="menu-card" id="addMoney">${esc(t("income"))}</button><button class="menu-card" id="addExpense">${esc(t("expense"))}</button><button class="menu-card" id="addSaving">${esc(t("saving"))}</button><button class="menu-card" id="addTransfer">${esc(t("transfer"))}</button><button class="menu-card" id="addPurchase">${esc(t("purchase"))}</button></section></main>`;
document.getElementById("headerBack")?.addEventListener("click",renderHomeShell);
document.getElementById("addMoney")?.addEventListener("click",()=>openLedgerForm("money"));
document.getElementById("addExpense")?.addEventListener("click",()=>openLedgerForm("expenses"));
document.getElementById("addSaving")?.addEventListener("click",()=>openLedgerForm("savings"));
document.getElementById("addTransfer")?.addEventListener("click",()=>openLedgerForm("transfer"));
document.getElementById("addPurchase")?.addEventListener("click",()=>openLedgerForm("purchase"));
bindLanguage(renderMoney)
}

function openLedgerForm(type){
const labels={money:t("income"),expenses:t("expense"),savings:t("saving"),transfer:t("transfer"),purchase:t("purchase")};
const key=type==="money"?APP.moneyKey:type==="expenses"?APP.expensesKey:type==="savings"?APP.savingsKey:type==="purchase"?APP.expensesKey:APP.expensesKey;
const m=document.createElement("div");m.className="modal";m.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><button class="modal-close" id="closeLedger">×</button><h2>${esc(labels[type]||type)}</h2><label>${esc(t("description"))}</label><input id="ledgerDesc"><label>${esc(t("value"))}</label><input id="ledgerValue" type="number" min="0" step=".01"><button class="primary-btn" id="saveLedger">${esc(t("saveData"))}</button></div></div>`;document.body.appendChild(m);
document.getElementById("closeLedger")?.addEventListener("click",()=>m.remove());
document.getElementById("saveLedger")?.addEventListener("click",()=>{
const v=Number(document.getElementById("ledgerValue")?.value||0);if(!v)return;
const a=loadArray(key);a.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:new Date().toISOString(),description:document.getElementById("ledgerDesc")?.value||labels[type],amount:v,type});saveArray(key,a);m.remove();renderMoney()
})
}

function renderLedger(type){
const key=type==="expenses"?APP.expensesKey:type==="savings"?APP.savingsKey:APP.expensesKey;
const arr=loadArray(key),title=type==="expenses"?t("expensesTitle"):type==="savings"?t("savingsTitle"):t("purchaseTitle");
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(title)}</div><h1>${esc(title)}</h1><p>${esc(t("moneyText"))}</p></section><section class="main-card"><button class="primary-btn" id="addLedger">${esc(t("add"))}</button><div class="ledger-list">${arr.length?arr.slice().reverse().map(x=>`<div class="ledger-row"><span>${esc(x.description)}</span><strong>${money(x.amount)}</strong><small>${new Date(x.date).toLocaleDateString(APP.language==="es"?"es-US":"en-US")}</small></div>`).join(""):`<p>${esc(t("noData"))}</p>`}</div></section></main>`;
document.getElementById("headerBack")?.addEventListener("click",renderHomeShell);
document.getElementById("addLedger")?.addEventListener("click",()=>openLedgerForm(type));
bindLanguage(()=>renderLedger(type))
}

function renderFamily(){
const arr=loadArray(APP.familyKey);
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("familyTitle"))}</div><h1>${esc(t("familyTitle"))}</h1><p>${esc(t("familyText"))}</p></section><section class="main-card"><button class="primary-btn" id="addPerson">${esc(t("addPerson"))}</button><div class="ledger-list">${arr.length?arr.map(x=>`<div class="ledger-row"><span>${esc(x.name)}</span><strong>${esc(countryName(x.country)||x.country)}</strong></div>`).join(""):`<p>${esc(t("noData"))}</p>`}</div></section></main>`;
document.getElementById("headerBack")?.addEventListener("click",renderHomeShell);
document.getElementById("addPerson")?.addEventListener("click",addFamily);
bindLanguage(renderFamily)
}
function addFamily(){
const m=document.createElement("div");m.className="modal";m.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><button class="modal-close" id="cf">×</button><h2>${esc(t("addPerson"))}</h2><label>${esc(t("name"))}</label><input id="fn"><label>${esc(t("country"))}</label><input id="fc"><button class="primary-btn" id="sf">${esc(t("saveData"))}</button></div></div>`;document.body.appendChild(m);
document.getElementById("cf")?.addEventListener("click",()=>m.remove());
document.getElementById("sf")?.addEventListener("click",()=>{const n=document.getElementById("fn")?.value.trim(),c=document.getElementById("fc")?.value.trim().toUpperCase();if(!n||!c)return;const a=loadArray(APP.familyKey);a.push({name:n,country:c,date:new Date().toISOString()});saveArray(APP.familyKey,a);m.remove();renderFamily()})
}

function learningData(){
return APP.config?.learning||APP.config?.lessons||[
{id:"1",title:{es:"Prepara el dinero",en:"Prepare the money"},text:{es:"Define cuánto puedes enviar sin comprometer primero tus gastos y necesidades.",en:"Decide how much you can send without ignoring your expenses and needs."}},
{id:"2",title:{es:"Conoce el destino",en:"Know the destination"},text:{es:"El país de destino puede cambiar las opciones disponibles y los requisitos.",en:"The destination country can affect available options and requirements."}},
{id:"3",title:{es:"Revisa el costo",en:"Review the cost"},text:{es:"Compara comisión, tipo de cambio y cantidad que recibe la persona cuando esos datos estén verificados.",en:"Compare fee, exchange rate and recipient amount when those values are verified."}},
{id:"4",title:{es:"Revisa los datos",en:"Review the details"},text:{es:"Antes de confirmar, revisa cantidad, destinatario, método y datos solicitados.",en:"Before confirming, review amount, recipient, method and requested information."}},
{id:"5",title:{es:"Continúa en el sitio oficial",en:"Continue on the official site"},text:{es:"La remesa se realiza fuera de REMESAS, directamente con el proveedor.",en:"The transfer is completed outside REMESAS, directly with the provider."}}
]
}
function loc(v){if(v&&typeof v==="object")return v[APP.language]||v.es||v.en||"";return v||""}

function renderLearning(){
const a=learningData();
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("learningTitle"))}</div><h1>${esc(t("learningTitle"))}</h1><p>${esc(t("learningText"))}</p></section><section class="results-list">${a.map((x,i)=>`<article class="provider-card"><span class="provider-number">${i+1}</span><h2>${esc(loc(x.title)||x.name||"")}</h2><p>${esc(loc(x.text)||x.answer||"")}</p></article>`).join("")}</section><button class="primary-btn" id="learnPdf">${esc(t("exportData"))}</button></main>`;
document.getElementById("headerBack")?.addEventListener("click",renderHomeShell);
document.getElementById("learnPdf")?.addEventListener("click",exportLearningPDF);
bindLanguage(renderLearning)
}

function renderQuickGuide(){
const providers=APP.config?.providers||[],items=[
{es:"1. Decide cuánto puedes enviar.",en:"1. Decide how much you can send."},
{es:"2. Selecciona el país de destino.",en:"2. Select the destination country."},
{es:"3. Revisa qué necesitas.",en:"3. Review what you need."},
{es:"4. Compara solo información comercial verificada.",en:"4. Compare only verified commercial information."},
{es:"5. Revisa todos los datos antes de continuar.",en:"5. Review all details before continuing."},
{es:"6. Completa el envío en el sitio oficial del proveedor.",en:"6. Complete the transfer on the provider's official site."}
];
document.getElementById("app").innerHTML=`${renderHeader(true)}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("quickTitle"))}</div><h1>${esc(t("quickTitle"))}</h1><p>${esc(t("quickText"))}</p></section><section class="results-list">${items.map(x=>`<article class="provider-card"><p>${esc(loc(x))}</p></article>`).join("")}</section><section class="results-list">${providers.map(p=>`<article class="provider-card"><h2>${esc(p.name||p.id)}</h2><a class="primary-btn link-btn" href="${esc(p.official_site||p.continue_url||"")}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a></article>`).join("")}</section></main>`;
document.getElementById("headerBack")?.addEventListener("click",renderHomeShell);
bindLanguage(renderQuickGuide)
}

function pdfHTML(title,body){
return`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:35px;color:#111;line-height:1.5}h1{font-size:24px}h2{margin-top:25px;border-bottom:1px solid #ccc;padding-bottom:6px}.row{padding:8px 0;border-bottom:1px solid #eee}.date{color:#555;font-size:12px}</style></head><body><h1>${esc(title)}</h1><div class="date">${new Date().toLocaleString(APP.language==="es"?"es-US":"en-US")}</div>${body}</body></html>`
}
function exportPDF(){
const m=localMoney(),moneyArr=loadArray(APP.moneyKey),expenses=loadArray(APP.expensesKey),savings=loadArray(APP.savingsKey),family=loadArray(APP.familyKey);
const rows=a=>a.map(x=>`<div class="row"><strong>${esc(x.description||x.name||"")}</strong> — ${money(x.amount||0)} <small>${esc(x.country||"")}</small></div>`).join("");
const body=`<p>${esc(t("pdfText"))}</p><h2>${esc(t("total"))}: ${money(m.available)}</h2><h2>${esc(t("income"))}</h2>${rows(moneyArr)||"<p>—</p>"}<h2>${esc(t("expenses"))}</h2>${rows(expenses)||"<p>—</p>"}<h2>${esc(t("savings"))}</h2>${rows(savings)||"<p>—</p>"}<h2>${esc(t("family"))}</h2>${rows(family)||"<p>—</p>"}`;
printHTML(pdfHTML(t("pdfTitle"),body))
}
function exportLearningPDF(){
const a=learningData(),body=`<p>${esc(t("learningText"))}</p>`+a.map(x=>`<h2>${esc(loc(x.title)||x.name||"")}</h2><p>${esc(loc(x.text)||x.answer||"")}</p>`).join("");
printHTML(pdfHTML(t("learningTitle"),body))
}
function printHTML(html){
const w=window.open("","_blank","noopener,noreferrer");if(!w){alert("Permite ventanas emergentes para guardar el PDF.");return}
w.document.open();w.document.write(html);w.document.close();setTimeout(()=>w.print(),500)
}

function deleteLocal(){
const m=document.createElement("div");m.className="modal";m.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>${esc(t("deleteData"))}</h2><p>${esc(t("deleteConfirm"))}</p><button class="primary-btn" id="yd">${esc(t("yesDelete"))}</button><button class="secondary-btn" id="nd">${esc(t("noDelete"))}</button></div></div>`;document.body.appendChild(m);
document.getElementById("nd")?.addEventListener("click",()=>m.remove());
document.getElementById("yd")?.addEventListener("click",()=>{
[APP.moneyKey,APP.expensesKey,APP.familyKey,APP.savingsKey,APP.prefsKey,"remesas_destination"].forEach(k=>localStorage.removeItem(k));
m.remove();renderHomeShell()
})
}

function renderError(message){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="error-card"><div class="error-icon">!</div><h2>${esc(t("error"))}</h2><p>${esc(message||"")}</p><button class="primary-btn" id="retry">${esc(t("back"))}</button></section></main>`;
document.getElementById("retry")?.addEventListener("click",()=>accessValid()?renderHomeShell():renderAccessGate());
bindLanguage(()=>renderError(message))
}

function logout(){
APP.accessToken="";APP.accessExpires="";APP.accessRole="";APP.sessionId=null;APP.session=null;
localStorage.removeItem("remesas_access_token");localStorage.removeItem("remesas_access_expires");localStorage.removeItem("remesas_access_role");
renderAccessGate()
}

async function boot(){
installTripleTap();
try{
const returned=await paymentReturnCheck();
if(!returned){
const st=await accessStatus();
if(!st.active){renderAccessGate();return}
}
if(!accessValid()){renderAccessGate();return}
await loadConfig();await createSession();renderHomeShell()
}catch(e){renderError(e.message)}
}

document.addEventListener("DOMContentLoaded",boot);
