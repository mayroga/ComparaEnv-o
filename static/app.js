"use strict";

const APP={
name:"REMESAS",
version:"4.2.0",
lang:localStorage.getItem("remesas_lang_v4")||"es",
session:null,
config:null,
accessToken:sessionStorage.getItem("remesas_access_token_v4")||"",
accessUntil:Number(sessionStorage.getItem("remesas_access_until_v4")||0),
adminMode:sessionStorage.getItem("remesas_admin_v4")==="1",
moneyKey:"remesas_money_v4",
expensesKey:"remesas_expenses_v4",
familyKey:"remesas_family_v4",
prefsKey:"remesas_prefs_v4",
tripleTaps:0,
lastTap:0,
tapTimer:null
};

const app=document.getElementById("app");

function esc(value){
return String(value??"")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");
}

function t(es,en){
return APP.lang==="en"?en:es;
}

function money(value){
const n=Number(value||0);
return new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
}

function getJSON(key,fallback){
try{
const raw=localStorage.getItem(key);
if(!raw)return fallback;
const value=JSON.parse(raw);
return value??fallback;
}catch{
return fallback;
}
}

function setJSON(key,value){
try{
localStorage.setItem(key,JSON.stringify(value));
return true;
}catch{
showError(t("No se pudo guardar en este dispositivo.","Could not save on this device."));
return false;
}
}

function accessIsActive(){
if(!APP.accessToken)return false;
if(APP.accessUntil&&Date.now()>=APP.accessUntil){
clearAccess();
return false;
}
return true;
}

function saveAccess(token,until,admin=false){
APP.accessToken=String(token||"");
APP.accessUntil=Number(until||0);
APP.adminMode=Boolean(admin);
if(APP.accessToken)sessionStorage.setItem("remesas_access_token_v4",APP.accessToken);
else sessionStorage.removeItem("remesas_access_token_v4");
if(APP.accessUntil)sessionStorage.setItem("remesas_access_until_v4",String(APP.accessUntil));
else sessionStorage.removeItem("remesas_access_until_v4");
if(APP.adminMode)sessionStorage.setItem("remesas_admin_v4","1");
else sessionStorage.removeItem("remesas_admin_v4");
}

function clearAccess(){
APP.accessToken="";
APP.accessUntil=0;
APP.adminMode=false;
APP.session=null;
sessionStorage.removeItem("remesas_access_token_v4");
sessionStorage.removeItem("remesas_access_until_v4");
sessionStorage.removeItem("remesas_admin_v4");
}

function accessHeaders(){
return APP.accessToken?{Authorization:`Bearer ${APP.accessToken}`}:{};
}

async function api(url,options={}){
if(accessIsActive()&&!options.skipAccess){
options={
...options,
headers:{
...(options.body?{"Content-Type":"application/json"}:{}),
...accessHeaders(),
...(options.headers||{})
}
};
}else{
options={
...options,
headers:{
...(options.body?{"Content-Type":"application/json"}:{}),
...(options.headers||{})
}
};
}

let response;

try{
response=await fetch(url,options);
}catch{
throw new Error(t("No se pudo conectar con REMESAS.","Could not connect to REMESAS."));
}

let data={};

try{
data=await response.json();
}catch{
data={};
}

if(response.status===401){
clearAccess();
showAccessGate();
throw new Error(t("El acceso terminó. Vuelve a entrar para continuar.","Access expired. Enter again to continue."));
}

if(!response.ok){
const message=data.detail||data.error||data.message||t("No se pudo completar la operación.","The operation could not be completed.");
throw new Error(typeof message==="string"?message:t("Ocurrió un error.","An error occurred."));
}

return data;
}

async function accessStatus(){
if(!APP.accessToken)return false;
if(!APP.accessUntil)APP.accessUntil=Date.now()+20*60*1000;
if(Date.now()>=APP.accessUntil){
clearAccess();
return false;
}

const endpoints=["/api/access/status","/api/access-check"];

for(const endpoint of endpoints){
try{
const data=await fetch(endpoint,{headers:accessHeaders()});
if(data.ok){
const json=await data.json().catch(()=>({}));
const active=json?.active!==false&&json?.access!=="denied";
if(active){
const until=Number(json?.access_until||json?.expires_at||0);
if(until)APP.accessUntil=until>1e12?until:until*1000;
return true;
}
}
}catch{}
}

return true;
}

function setupTripleTap(){
window.addEventListener("pointerup",e=>{
if(!e.isPrimary)return;
if(accessIsActive())return;

const now=Date.now();

if(now-APP.lastTap>900)APP.tripleTaps=0;

APP.tripleTaps++;
APP.lastTap=now;

clearTimeout(APP.tapTimer);

if(APP.tripleTaps===3){
APP.tripleTaps=0;
if(!accessIsActive())showAdminLogin();
return;
}

APP.tapTimer=setTimeout(()=>{
APP.tripleTaps=0;
},900);
},true);
}

async function ensureAccess(){
if(await accessStatus())return true;
showAccessGate();
return false;
}

function accessGateHTML(){
const stripe=APP.config?.stripe||{};
const price=Number(stripe.price??10.99);
const currency=stripe.currency||"USD";

return`
<section class="card form-card">

<div class="notice info">
<strong>${esc(t("Acceso a REMESAS","REMESAS access"))}</strong>
<p>${esc(t(
"Elige el acceso de pago o entra con el acceso administrativo gratuito.",
"Choose paid access or enter with free administrator access."
))}</p>
</div>

<h1>${esc(t("REMESAS","REMESAS"))}</h1>

<p>${esc(t(
"El acceso de cliente es un pago único. Después del pago tienes 20 minutos para usar el servicio.",
"Client access is a one-time payment. After payment you have 20 minutes to use the service."
))}</p>

<div class="balance-grid">

<div class="balance">
<span>${esc(t("Precio","Price"))}</span>
<strong>${esc(currency)} ${price.toFixed(2)}</strong>
</div>

<div class="balance">
<span>${esc(t("Acceso","Access"))}</span>
<strong>${esc(t("20 minutos","20 minutes"))}</strong>
</div>

</div>

<div class="actions">

<button class="btn"
type="button"
onclick="createCheckout()">
💳 ${esc(t("Pagar con Stripe","Pay with Stripe"))}
</button>

</div>

<div class="notice">
<strong>${esc(t("Acceso administrador","Administrator access"))}</strong>
<p>${esc(t(
"Para entrar gratis como administrador, toca tres veces rápidamente cualquier parte de esta pantalla.",
"To enter free as administrator, tap anywhere on this screen three times quickly."
))}</p>
</div>

<p class="legal">${esc(t(
"El administrador no necesita un botón visible. El triple toque solo abre el acceso cuando no existe una sesión activa.",
"The administrator does not need a visible button. Triple tap only opens access when no active session exists."
))}</p>

<p class="legal">${esc(legalShort())}</p>

</section>`;
}

function showAccessGate(){
if(!app)return;
renderShell(accessGateHTML(),t("Acceso","Access"));
}

function showAdminLogin(){
if(accessIsActive())return;

const old=document.getElementById("access-modal");
if(old)old.remove();

const modal=document.createElement("div");
modal.id="access-modal";
modal.className="modal-backdrop";

modal.innerHTML=`
<div class="modal">

<div class="modal-head">
<h2>${esc(t("Acceso administrativo","Administrator access"))}</h2>
<button class="close" type="button" onclick="closeAdminLogin()">×</button>
</div>

<p>${esc(t(
"Este acceso es gratuito y solo sirve para entrar al servicio. El acceso dura 20 minutos.",
"This access is free and only serves to enter the service. Access lasts 20 minutes."
))}</p>

<div class="field">
<label>${esc(t("Usuario","Username"))}</label>
<input id="adminUser" autocomplete="username">
</div>

<div class="field">
<label>${esc(t("Contraseña","Password"))}</label>
<input id="adminPass" type="password" autocomplete="current-password">
</div>

<div id="adminError"></div>

<div class="actions">

<button class="btn"
type="button"
onclick="loginAdmin()">
${esc(t("Entrar","Enter"))}
</button>

<button class="btn secondary"
type="button"
onclick="closeAdminLogin()">
${esc(t("Cancelar","Cancel"))}
</button>

</div>

</div>`;

document.body.appendChild(modal);
setTimeout(()=>document.getElementById("adminUser")?.focus(),50);
}

function closeAdminLogin(){
document.getElementById("access-modal")?.remove();
}

async function loginAdmin(){
const username=(document.getElementById("adminUser")?.value||"").trim();
const password=document.getElementById("adminPass")?.value||"";
const errorBox=document.getElementById("adminError");

if(!username||!password){
if(errorBox)errorBox.innerHTML=`<div class="notice danger">${esc(t("Introduce usuario y contraseña.","Enter username and password."))}</div>`;
return;
}

const payload=JSON.stringify({username,password});
const endpoints=["/api/access/admin","/api/login-admin","/api/admin/login","/api/login"];

let data=null;

for(const endpoint of endpoints){
try{
const response=await fetch(endpoint,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:payload
});

const json=await response.json().catch(()=>({}));

if(response.ok){
data=json;
break;
}

if(response.status!==404&&response.status!==405&&response.status!==422){
if(errorBox)errorBox.innerHTML=`<div class="notice danger">${esc(json.detail||json.error||t("Credenciales inválidas.","Invalid credentials."))}</div>`;
return;
}
}catch{}
}

if(!data){
if(errorBox)errorBox.innerHTML=`<div class="notice danger">${esc(t("No se pudo comprobar el acceso.","The access could not be verified."))}</div>`;
return;
}

const token=data.token||data.access_token||data.session_token;

if(!token){
if(errorBox)errorBox.innerHTML=`<div class="notice danger">${esc(t("El servidor no entregó un acceso válido.","The server did not return valid access."))}</div>`;
return;
}

const until=Number(data.access_until||data.expires_at||0);
const expires=until?until>1e12?until:until*1000:Date.now()+20*60*1000;

saveAccess(token,expires,true);
closeAdminLogin();

await enterAfterAccess();
}

async function enterAfterAccess(){
if(!accessIsActive()){
showAccessGate();
return;
}

try{
await loadConfig();
await startSession(true);
renderHome();
}catch(error){
showError(error.message);
}
}

function topbar(title="REMESAS"){
return`
<header class="topbar">
<button class="btn secondary small" type="button" onclick="renderHome()" aria-label="${esc(t("Volver","Back"))}">←</button>
<div class="brand">${esc(title)}<small>May Roga LLC</small></div>
<div class="top-actions">
<button class="lang-btn" type="button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button>
</div>
</header>`;
}

function renderShell(content,title="REMESAS"){
app.innerHTML=`<div class="app-shell">${topbar(title)}<main>${content}</main></div>`;
window.scrollTo({top:0,behavior:"smooth"});
}

function legalShort(){
return t(
"REMESAS es una herramienta independiente de información y organización. No es un banco, proveedor de transferencias ni procesador de pagos.",
"REMESAS is an independent information and organization tool. It is not a bank, money transfer provider, or payment processor."
);
}

function privacyNotice(){
return t(
"Los datos que guardas para organizar tu dinero permanecen en este dispositivo. Los datos necesarios para preparar una sesión de remesa se procesan temporalmente para que la aplicación funcione.",
"Data you save to organize your money stays on this device. Data needed to prepare a remittance session is processed temporarily so the application can function."
);
}

function commercialNotice(){
return t(
"Las tarifas, tasas, tiempos, disponibilidad, requisitos y condiciones pueden cambiar. Confírmalos directamente con el proveedor antes de enviar dinero.",
"Fees, rates, delivery times, availability, requirements, and conditions can change. Confirm them directly with the provider before sending money."
);
}

function renderHome(){
if(!accessIsActive()){
showAccessGate();
return;
}

const opening=APP.config?.opening||{};
const appInfo=APP.config?.app||{};

const title=opening.title?.[APP.lang]||opening.primary_question||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER");
const subtitle=opening.subtitle?.[APP.lang]||opening.secondary_text||t("Entiende tu necesidad, organiza tus datos y continúa con la fuente oficial.","Understand your need, organize your information, and continue with the official source.");
const notice=opening.notice?.[APP.lang]||t("REMESAS no inventa datos comerciales.","REMESAS does not invent commercial data.");

app.innerHTML=`
<div class="app-shell">

<header class="topbar">
<div class="brand">REMESAS<small>${esc(appInfo.brand||"May Roga LLC")}</small></div>
<div class="top-actions">
<button class="lang-btn" type="button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button>
</div>
</header>

<section class="hero">

<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>

<div class="hero-actions">

<button class="btn" type="button" onclick="renderRemittance()">💸 ${esc(t("Enviar dinero","Send money"))}</button>
<button class="btn secondary" type="button" onclick="renderMoney()">💰 ${esc(t("Mi dinero","My money"))}</button>

</div>
</section>

<section class="section">

<div class="notice info">
<strong>${esc(t("Importante","Important"))}</strong>
<p>${esc(notice)}</p>
</div>

</section>

<section class="section">

<div class="section-title">
<div>
<h2>${esc(t("¿Qué necesitas hacer?","What do you need to do?"))}</h2>
<p>${esc(t("Elige una acción o escribe lo que necesitas.","Choose an action or write what you need."))}</p>
</div>
</div>

<div class="grid">

${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa opciones.","Prepare a transfer and review options."),"renderRemittance()")}

${homeCard("📚",t("APRENDER","LEARN"),t("Aprende paso a paso qué te puede pedir una aplicación de remesas.","Learn what a remittance app may ask you for, step by step."),"renderLearning()")}

${homeCard("💰",t("Mi dinero","My money"),t("Calcula cuánto tienes disponible.","Calculate how much you have available."),"renderMoney()")}

${homeCard("📅",t("Mi semana","My week"),t("Mira una referencia semanal.","See a weekly reference."),"renderWeek()")}

${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos.","Record and review your expenses."),"renderExpenses()")}

${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia para una remesa.","Save a reference for a transfer."),"renderFamily()")}

${homeCard("❓",t("No entiendo","I need help"),t("Escribe qué necesitas.","Write what you need."),"renderHelp()")}

${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Comprueba si una compra cabe.","Check whether a purchase fits."),"renderPurchase()")}

${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para un objetivo.","Reserve money for a goal."),"renderSavings()")}

</div>
</section>

<section class="section">

<div class="card form-card">

<h2>${esc(t("También puedes escribirlo","You can also write it"))}</h2>
<p>${esc(t("Explícalo con tus propias palabras.","Explain it in your own words."))}</p>

<div class="field">
<textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero enviar $200 a México...","Example: I want to send $200 to Mexico..."))}"></textarea>
</div>

<div class="actions">
<button class="btn" type="button" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button>
</div>

</div>
</section>

<section class="section">

<div class="privacy">

<div>
<strong>${esc(t("Privacidad","Privacy"))}</strong>
<p class="legal">${esc(privacyNotice())}</p>
</div>

<button class="btn secondary small" type="button" onclick="renderPrivacy()">${esc(t("Ver detalles","View details"))}</button>

</div>
</section>

<section class="section">

<div class="card">

<h3>${esc(t("Información del servicio","Service information"))}</h3>
<p class="legal">${esc(legalShort())}</p>
<p class="legal">${esc(commercialNotice())}</p>

<div class="actions">

<button class="btn secondary" type="button" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button>

<button class="btn danger" type="button" onclick="deleteLocalData()">${esc(t("Borrar mis datos","Delete my data"))}</button>

</div>

</div>
</section>

<footer class="footer">
${esc(appInfo.brand||"May Roga LLC")} · REMESAS · v${esc(APP.version)}
<div class="footer-links">
<span>${esc(t("Servicio independiente","Independent service"))}</span>
</div>
</footer>

</div>`;
}

function homeCard(icon,title,text,action){
return`<button class="card action-card" type="button" onclick="${action}"><div><span class="action-icon">${icon}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div></button>`;
}

async function loadConfig(){
const data=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`,{skipAccess:true});
APP.config=data||{};
if(APP.config.stripe&&!APP.config.stripe.price)APP.config.stripe.price=10.99;
return APP.config;
}

async function startSession(preserve=true){
if(!accessIsActive())throw new Error(t("Acceso requerido.","Access required."));

if(preserve&&APP.session?.session_id){
try{
const data=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}`);
if(data?.session){
APP.session=data.session;
return APP.session;
}
}catch{}
}

const data=await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"});
APP.session=data?.session||null;
return APP.session;
}

async function changeLanguage(){
APP.lang=APP.lang==="es"?"en":"es";
localStorage.setItem("remesas_lang_v4",APP.lang);

try{
await loadConfig();
if(accessIsActive()&&APP.session?.session_id){
try{
const data=await api("/api/need",{method:"POST",body:JSON.stringify({session_id:APP.session.session_id,language:APP.lang})});
if(data?.session)APP.session=data.session;
}catch{}
}
if(accessIsActive())renderHome();
else showAccessGate();
}catch(error){
showError(error.message);
}
}

function countryCode(country){
return String(country?.code||country?.id||"").toUpperCase();
}

function countryName(code){
const item=(APP.config?.countries||[]).find(x=>countryCode(x)===String(code||"").toUpperCase());
return item?.name?.[APP.lang]||item?.name?.es||item?.name_en||item?.name_es||code||"";
}

function priorityLabel(value){
return{
recipient_gets_more:t("Que reciba más","Recipient gets more"),
fastest:t("Rapidez","Speed"),
urgent:t("Urgente","Urgent"),
save:t("Ahorrar","Save"),
balanced:t("Equilibrio","Balanced"),
compare_all:t("Comparar","Compare")
}[value]||value||"";
}

function frequencyLabel(value){
return{
weekly:t("Semanal","Weekly"),
biweekly:t("Quincenal","Biweekly"),
monthly:t("Mensual","Monthly"),
one_time:t("Una vez","One time")
}[value]||value||"";
}

function methodLabel(value){
if(typeof value==="string"){
return{
cash_pickup:t("Recogida en efectivo","Cash pickup"),
bank_account:t("Cuenta bancaria","Bank account"),
debit_card:t("Tarjeta de débito","Debit card"),
credit_card:t("Tarjeta de crédito","Credit card"),
mobile_wallet:t("Billetera móvil","Mobile wallet"),
home_delivery:t("Entrega a domicilio","Home delivery"),
cash:t("Efectivo","Cash"),
bank_transfer:t("Transferencia bancaria","Bank transfer"),
digital_wallet:t("Billetera digital","Digital wallet"),
other:t("Otro","Other")
}[value]||value;
}
return value?.label?.[APP.lang]||value?.label?.es||value?.name||value?.id||"";
}

function safeInlineString(value){
return JSON.stringify(String(value||""))
.replace(/\\/g,"\\\\")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;");
}

async function understandNeed(){
if(!await ensureAccess())return;

const text=(document.getElementById("freeNeed")?.value||"").trim();

if(!text){
showError(t("Escribe primero qué necesitas.","Write what you need first."));
return;
}

try{
const data=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.lang})});
const parsed=data?.parsed||{};

if(parsed.need_type==="remittance"||parsed.amount||parsed.destination_country){
await beginParsedRemittance(parsed);
return;
}

renderShell(`
<section class="card">
<div class="notice success">${esc(t("Entendido","Understood"))}</div>
<h1>${esc(t("Vamos paso a paso.","Let's go step by step."))}</h1>
<p>${esc(t("Todavía no tengo suficiente información para una acción concreta.","I do not have enough information for a concrete action yet."))}</p>
<div class="actions">
<button class="btn" type="button" onclick="renderRemittance()">${esc(t("Preparar una remesa","Prepare a transfer"))}</button>
<button class="btn secondary" type="button" onclick="renderHelp()">${esc(t("Ver ayuda","View help"))}</button>
</div>
</section>`,t("Tu necesidad","Your need"));
}catch(error){
showError(error.message);
}
}

async function beginParsedRemittance(parsed){
if(!await ensureAccess())return;

try{
await startSession(true);

const body={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance"};

["amount","destination_country","priority","urgency","frequency","delivery_method","payment_method","recipient_amount_target","special_need"].forEach(key=>{
if(parsed[key]!==undefined&&parsed[key]!==null)body[key]=parsed[key];
});

const data=await api("/api/need",{method:"POST",body:JSON.stringify(body)});
if(data?.session)APP.session=data.session;
renderRemittance(parsed);
}catch(error){
showError(error.message);
}
}

function renderRemittance(parsed={}){
if(!accessIsActive()){showAccessGate();return;}

const session=APP.session||{};
const amount=session.amount??parsed.amount??"";
const country=session.destination_country||parsed.destination_country||"";
const priority=session.priority||parsed.priority||"";
const urgency=session.urgency??parsed.urgency??null;
const frequency=session.frequency||parsed.frequency||"";
const delivery=session.delivery_method||parsed.delivery_method||"";
const payment=session.payment_method||parsed.payment_method||"";

const deliveryMethods=Array.isArray(APP.config?.delivery_methods)?APP.config.delivery_methods:[];
const paymentMethods=Array.isArray(APP.config?.payment_methods)?APP.config.payment_methods:[];

renderShell(`
<section class="card form-card">

<h1>${esc(t("Enviar dinero","Send money"))}</h1>

<p class="legal">${esc(t(
"Solo preguntamos lo que puede cambiar el siguiente paso. Si no sabes una respuesta, puedes dejarla sin elegir.",
"We only ask what can change the next step. If you do not know an answer, you can leave it unselected."
))}</p>

<div class="field">
<label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label>
<input id="sendAmount" type="number" min="0.01" max="1000000" step="0.01" value="${esc(amount)}">
</div>

<div class="field">
<label>${esc(t("¿A qué país?","Which country?"))}</label>
<select id="sendCountry">
<option value="">${esc(t("Selecciona","Select"))}</option>
${(APP.config?.countries||[]).map(c=>{
const id=countryCode(c);
return`<option value="${esc(id)}" ${id===country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||c.name_en||id)}</option>`;
}).join("")}
</select>
</div>

<div class="field">
<label>${esc(t("¿Qué importa más?","What matters most?"))}</label>
<select id="sendPriority">
<option value="">${esc(t("No estoy seguro","Not sure"))}</option>
${["recipient_gets_more","fastest","save","balanced"].map(x=>`<option value="${x}" ${priority===x?"selected":""}>${esc(priorityLabel(x))}</option>`).join("")}
</select>
</div>

<div class="field">
<label>${esc(t("¿Es urgente?","Is it urgent?"))}</label>
<select id="sendUrgency">
<option value="">${esc(t("No estoy seguro","Not sure"))}</option>
<option value="true" ${urgency===true?"selected":""}>${esc(t("Sí","Yes"))}</option>
<option value="false" ${urgency===false?"selected":""}>${esc(t("No","No"))}</option>
</select>
</div>

<div class="field">
<label>${esc(t("¿Cada cuánto envías?","How often do you send?"))}</label>
<select id="sendFrequency">
<option value="">${esc(t("Una vez / no sé","One time / not sure"))}</option>
${["one_time","weekly","biweekly","monthly"].map(x=>`<option value="${x}" ${frequency===x?"selected":""}>${esc(frequencyLabel(x))}</option>`).join("")}
</select>
</div>

<div class="field">
<label>${esc(t("¿Cómo recibe?","How does the recipient receive?"))}</label>
<select id="sendDelivery">
<option value="">${esc(t("No sé todavía","Not sure yet"))}</option>
${deliveryMethods.map(x=>`<option value="${esc(x.id)}" ${delivery===x.id?"selected":""}>${esc(methodLabel(x))}</option>`).join("")}
</select>
<small>${esc(t("Ejemplo: efectivo, cuenta bancaria o billetera, según lo disponible.","Example: cash pickup, bank account, or wallet, depending on availability."))}</small>
</div>

<div class="field">
<label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label>
<select id="sendPayment">
<option value="">${esc(t("No sé todavía","Not sure yet"))}</option>
${paymentMethods.map(x=>`<option value="${esc(x.id)}" ${payment===x.id?"selected":""}>${esc(methodLabel(x))}</option>`).join("")}
</select>
<small>${esc(t("Esta respuesta forma parte de tu necesidad y puede cambiar las opciones mostradas.","This answer is part of your need and may change the options shown."))}</small>
</div>

<div id="moneyWarning"></div>

<div class="actions">
<button class="btn" type="button" onclick="compare()">${esc(t("Revisar opciones","Review options"))}</button>
<button class="btn secondary" type="button" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div>

<p class="legal">${esc(commercialNotice())}</p>

</section>`,t("Enviar dinero","Send money"));

document.getElementById("sendAmount")?.addEventListener("input",updateMoneyWarning);
updateMoneyWarning();
}

function getMoneyState(){
return getJSON(APP.moneyKey,{income:0,incomeFreq:"monthly",monthlyIncome:0,essential:0,flexible:0,savings:0,remittance:0,available:0});
}

function updateMoneyWarning(){
const box=document.getElementById("moneyWarning");
if(!box)return;

const amount=Number(document.getElementById("sendAmount")?.value||0);
const available=Number(getMoneyState().available||0);
const warnings=[];

if(available>0&&amount>available)warnings.push(t(`El monto supera tu disponible calculado (${money(available)}).`,`The amount exceeds your calculated available balance (${money(available)}).`));
if(amount>10000)warnings.push(t("Por este monto conviene revisar cuidadosamente los datos finales del proveedor.","For this amount, carefully review the provider's final transaction details."));

box.innerHTML=warnings.length?`<div class="notice warning">${warnings.map(esc).join("<br>")}</div>`:"";
}

async function compare(){
if(!await ensureAccess())return;

const amount=Number(document.getElementById("sendAmount")?.value||0);
const destination=document.getElementById("sendCountry")?.value||"";

if(!amount||amount<=0){showError(t("Indica un monto válido.","Enter a valid amount."));return;}
if(amount>1000000){showError(t("El monto supera el límite permitido.","The amount exceeds the allowed limit."));return;}
if(!destination){showError(t("Selecciona el país de destino.","Select the destination country."));return;}

const priority=document.getElementById("sendPriority")?.value||null;
const urgencyValue=document.getElementById("sendUrgency")?.value||"";
const urgency=urgencyValue===""?null:urgencyValue==="true";
const frequency=document.getElementById("sendFrequency")?.value||null;
const delivery=document.getElementById("sendDelivery")?.value||null;
const payment=document.getElementById("sendPayment")?.value||null;

try{
await startSession(true);

const need={
session_id:APP.session.session_id,
language:APP.lang,
need_type:"remittance",
amount,
send_currency:"USD",
destination_country:destination,
priority,
urgency,
frequency,
delivery_method:delivery,
payment_method:payment
};

const needData=await api("/api/need",{method:"POST",body:JSON.stringify(need)});
if(needData?.session)APP.session=needData.session;

renderLoading();

const result=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/compare`,{method:"POST"});

APP.session.available_providers=result.available_providers||[];
APP.session.verified_results=result.results||[];
APP.session.comparison=result;

renderComparison(result);
}catch(error){
showError(error.message);
}
}

function renderLoading(){
renderShell(`
<section class="card">
<div class="loading"><div class="spinner"></div><span>${esc(t("Revisando opciones...","Reviewing options..."))}</span></div>
<p class="legal">${esc(t("Comprobamos qué datos pueden mostrarse sin inventar información comercial.","We check what data can be shown without inventing commercial information."))}</p>
</section>`,t("Revisión","Review"));
}

function providerStatus(provider,result){
const verified=provider.commercial_data_status==="verified"||provider.commercial_verified===true||provider.commercial_status==="verified"||result?.status==="verified";
return verified?t("Datos comerciales verificados","Verified commercial data"):t("Datos comerciales no verificados","Commercial data not verified");
}

function providerMethodsLabel(provider,type){
const values=Array.isArray(provider?.[type])?provider[type]:[];
const labels=values.map(methodLabel).filter(Boolean);
return labels.length?labels.join(", "):t("No especificados","Not specified");
}

function providerCard(provider){
const id=provider.provider_id||provider.id||"";
const result=(APP.session?.verified_results||[]).find(x=>x.provider_id===id);

const verified=provider.commercial_data_status==="verified"||provider.commercial_verified===true||provider.commercial_status==="verified"||result?.status==="verified";

const url=provider.continue_url||provider.official_site||provider.official_urls?.send_money||provider.official_urls?.site||"";

return`
<article class="provider-card">

<div class="provider-head">
<div>
<h3>${esc(provider.provider_name||provider.name||id)}</h3>
<p>${esc(providerStatus(provider,result))}</p>
</div>
<span class="provider-status ${verified?"verified":""}">${verified?"✓ ":""}${esc(verified?t("Verificado","Verified"):t("Confirmar","Confirm"))}</span>
</div>

${verified&&result?`
<div class="provider-data">
<div class="metric"><span>${esc(t("Tarifa","Fee"))}</span><strong>${result.fee!=null?money(result.fee):"—"}</strong></div>
<div class="metric"><span>${esc(t("Tasa","Rate"))}</span><strong>${esc(result.exchange_rate??"—")}</strong></div>
<div class="metric"><span>${esc(t("Recibe","Recipient gets"))}</span><strong>${result.recipient_amount!=null?money(result.recipient_amount):"—"}</strong></div>
<div class="metric"><span>${esc(t("Entrega","Delivery"))}</span><strong>${esc(result.estimated_delivery||result.delivery_time||"—")}</strong></div>
</div>`
:`<div class="notice warning">${esc(t("No mostramos tarifas, tasas, tiempos ni disponibilidad como datos actuales porque no están verificados.","We do not show fees, rates, timing, or availability as current data because they are not verified."))}</div>`}

<div class="notice">

<strong>${esc(t("Tu selección","Your selection"))}</strong>

<p>${esc(t("Cómo recibe:","Recipient receives:"))} <strong>${esc(APP.session?.delivery_method?methodLabel(APP.session.delivery_method):t("No sé todavía","Not selected"))}</strong></p>

<p>${esc(t("Cómo pagarías:","How you pay:"))} <strong>${esc(APP.session?.payment_method?methodLabel(APP.session.payment_method):t("No sé todavía","Not selected"))}</strong></p>

</div>

<p class="legal"><strong>${esc(t("Métodos de recepción declarados:","Declared receiving methods:"))}</strong> ${esc(providerMethodsLabel(provider,"delivery_methods"))}</p>

<p class="legal"><strong>${esc(t("Métodos de pago declarados:","Declared payment methods:"))}</strong> ${esc(providerMethodsLabel(provider,"payment_methods"))}</p>

${provider.supports_online===true?`<p class="legal">${esc(t("El registro indica opción en línea.","The registry indicates an online option."))}</p>`:""}

${provider.supports_agent===true?`<p class="legal">${esc(t("El registro indica atención en agente.","The registry indicates agent service."))}</p>`:""}

${url?`<button class="btn" type="button" onclick="selectProvider(${safeInlineString(id)})">${esc(t("Revisar proveedor","Review provider"))}</button>`:""}

</article>`;
}

function renderComparison(data){
const providers=data.available_providers||[];
const results=data.results||[];
const verifiedCount=Number(data.verified_count??results.length||0);

renderShell(`
<section class="section">

<div class="section-title">
<div>
<h2>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h2>
<p>${esc(data.explanation||t("Revisa las opciones y confirma los datos actuales directamente con cada proveedor.","Review the options and confirm current details directly with each provider."))}</p>
</div>
</div>

<div class="notice ${data.results_available?"success":"warning"}">
<strong>${esc(data.results_available?t(`${verifiedCount} opción(es) con datos comerciales verificados`,`${verifiedCount} option(s) with verified commercial data`):t("No hay datos comerciales actuales verificados","No current verified commercial data"))}</strong>
</div>

<div class="card">

<div class="balance-grid">

<div class="balance">
<span>${esc(t("Monto","Amount"))}</span>
<strong>${money(data.amount)}</strong>
</div>

<div class="balance">
<span>${esc(t("Destino","Destination"))}</span>
<strong>${esc(data.destination_name||countryName(data.destination_country))}</strong>
</div>

<div class="balance">
<span>${esc(t("Cómo recibe","Receiving method"))}</span>
<strong>${esc(APP.session?.delivery_method?methodLabel(APP.session.delivery_method):t("No sé todavía","Not selected"))}</strong>
</div>

</div>

<div class="notice info" style="margin-top:12px">
<strong>${esc(t("Cómo pagarías","How you pay"))}</strong>
<p>${esc(APP.session?.payment_method?methodLabel(APP.session.payment_method):t("No sé todavía","Not selected"))}</p>
</div>

</div>

<div class="result-list">
${providers.length?providers.map(providerCard).join(""):`<div class="empty">${esc(t("No encontramos proveedores para este destino en el catálogo actual.","No providers were found for this destination in the current catalog."))}</div>`}
</div>

${data.precautions?.length?`
<div class="notice warning">
<strong>${esc(t("Antes de continuar","Before continuing"))}</strong>
<ul class="list">${data.precautions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
</div>`:""}

<div class="notice">${esc(commercialNotice())}</div>

<div class="actions">
<button class="btn secondary" type="button" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button>
<button class="btn secondary" type="button" onclick="renderHome()">${esc(t("Volver al inicio","Back to home"))}</button>
</div>

</section>`,t("Opciones","Options"));
}

async function selectProvider(providerId){
if(!await ensureAccess())return;
if(!providerId){showError(t("Proveedor no válido.","Invalid provider."));return;}

try{
if(!APP.session?.session_id)await startSession(false);

const data=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(providerId)}`,{method:"POST"});
if(data?.session)APP.session=data.session;
await renderFinalCheck();
}catch(error){
showError(error.message);
}
}

async function renderFinalCheck(){
if(!APP.session?.selected_option){
showError(t("Selecciona primero un proveedor.","Select a provider first."));
return;
}

try{
const data=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,{method:"POST"});
renderFinalResult(data);
}catch(error){
showError(error.message);
}
}

function renderFinalResult(data){
const option=APP.session?.selected_option||{};
const url=option.continue_url||option.official_urls?.send_money||option.official_urls?.site||option.official_site||"";

renderShell(`
<section class="card">

<div class="notice ${data.ready_to_continue?"success":"warning"}">
<strong>${esc(data.ready_to_continue?t("Revisión completada","Review completed"):t("Revisa los datos","Review the details"))}</strong>
</div>

<h1>${esc(option.provider_name||"")}</h1>
<p>${esc(data.message||"")}</p>

<div class="result-list">

${(data.checks||[]).map(check=>`
<div class="notice ${check.ok?"success":"warning"}">
<strong>${check.ok?"✓":"!"} ${esc(check.label||"")}</strong>
<p>${esc(check.message||check.value||"")}</p>
</div>`).join("")}

</div>

${data.requirements?.length?`
<div class="notice">
<strong>${esc(t("Requisitos","Requirements"))}</strong>
<ul class="list">${data.requirements.map(x=>`<li>${esc(methodLabel(x))}</li>`).join("")}</ul>
</div>`:""}

<div class="notice">
<strong>${esc(t("Tus datos de remesa","Your remittance details"))}</strong>
<p>${esc(t("Monto:","Amount:"))} ${esc(money(APP.session?.amount))}</p>
<p>${esc(t("Destino:","Destination:"))} ${esc(countryName(APP.session?.destination_country))}</p>
<p>${esc(t("Cómo recibe:","Receiving method:"))} ${esc(APP.session?.delivery_method?methodLabel(APP.session.delivery_method):t("No indicado","Not specified"))}</p>
<p>${esc(t("Cómo pagarías:","Payment method:"))} ${esc(APP.session?.payment_method?methodLabel(APP.session.payment_method):t("No indicado","Not specified"))}</p>
</div>

<div class="notice warning">
<strong>${esc(t("Antes de enviar","Before sending"))}</strong>
<p>${esc(commercialNotice())}</p>
<p>${esc(t("REMESAS no completa la transferencia. La operación se realiza directamente con el proveedor.","REMESAS does not complete the transfer. The transaction is performed directly with the provider."))}</p>
</div>

${url?`<button class="btn" type="button" onclick="openOfficial(${safeInlineString(url)})">${esc(t("Abrir sitio oficial","Open official site"))}</button>`:""}

<button class="btn secondary" type="button" onclick="renderComparisonFromSession()">${esc(t("Ver otros proveedores","See other providers"))}</button>

</section>`,t("Revisión final","Final review"));
}

function openOfficial(url){
const value=String(url||"");
if(!/^https:\/\//i.test(value)){
showError(t("El enlace oficial no es válido.","The official link is not valid."));
return;
}
window.open(value,"_blank","noopener,noreferrer");
}

function renderComparisonFromSession(){
const results=APP.session?.verified_results||[];

renderComparison({
available_providers:APP.session?.available_providers||[],
results,
verified_count:results.length,
results_available:results.length>0,
amount:APP.session?.amount,
destination_country:APP.session?.destination_country,
destination_name:countryName(APP.session?.destination_country),
explanation:t("Estas son las opciones de la sesión actual.","These are the options from the current session."),
precautions:[]
});
}

function renderMoney(){
const m=getMoneyState();

renderShell(`
<section class="card form-card">

<h1>${esc(t("Mi dinero","My money"))}</h1>
<p class="legal">${esc(t("Este es un cálculo con los datos que introduces. No es un saldo bancario.","This is a calculation based on the information you enter. It is not a bank balance."))}</p>

<div class="field">
<label>${esc(t("Ingreso","Income"))}</label>
<input id="income" type="number" min="0" step="0.01" value="${esc(m.income||"")}">
</div>

<div class="field">
<label>${esc(t("Frecuencia del ingreso","Income frequency"))}</label>
<select id="incomeFreq">
<option value="weekly">${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option>
<option value="monthly">${esc(t("Mensual","Monthly"))}</option>
</select>
</div>

<div class="field">
<label>${esc(t("Gastos esenciales","Essential expenses"))}</label>
<input id="essential" type="number" min="0" step="0.01" value="${esc(m.essential||"")}">
</div>

<div class="field">
<label>${esc(t("Gastos flexibles","Flexible expenses"))}</label>
<input id="flexible" type="number" min="0" step="0.01" value="${esc(m.flexible||"")}">
</div>

<div class="field">
<label>${esc(t("Ahorro reservado","Reserved savings"))}</label>
<input id="savings" type="number" min="0" step="0.01" value="${esc(m.savings||"")}">
</div>

<div class="field">
<label>${esc(t("Remesas reservadas","Reserved remittance"))}</label>
<input id="remittance" type="number" min="0" step="0.01" value="${esc(m.remittance||"")}">
</div>

<div class="actions">
<button class="btn" type="button" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button>
<button class="btn secondary" type="button" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div>

<div id="moneyResult"></div>

<p class="legal">${esc(t("Estos registros pueden servir como referencia para entregarlos a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.","These records can serve as a reference for your accountant or tax preparer. REMESAS does not prepare or file taxes."))}</p>

</section>`,t("Mi dinero","My money"));

document.getElementById("incomeFreq").value=m.incomeFreq||"monthly";
if(Number(m.income||0))showMoneyResult(m);
}

function frequencyFactor(freq){
if(freq==="weekly")return 52/12;
if(freq==="biweekly")return 26/12;
return 1;
}

function calculateMoney(){
const income=Math.max(0,Number(document.getElementById("income")?.value||0));
const incomeFreq=document.getElementById("incomeFreq")?.value||"monthly";
const essential=Math.max(0,Number(document.getElementById("essential")?.value||0));
const flexible=Math.max(0,Number(document.getElementById("flexible")?.value||0));
const savings=Math.max(0,Number(document.getElementById("savings")?.value||0));
const remittance=Math.max(0,Number(document.getElementById("remittance")?.value||0));
const values=[income,essential,flexible,savings,remittance];

if(values.some(x=>!Number.isFinite(x))){
showError(t("Revisa los valores introducidos.","Check the values entered."));
return;
}

if(values.some(x=>x>1000000)){
showError(t("Uno de los valores supera el máximo permitido.","One of the values exceeds the allowed maximum."));
return;
}

const monthlyIncome=income*frequencyFactor(incomeFreq);
const available=monthlyIncome-essential-flexible-savings-remittance;

const data={income,incomeFreq,monthlyIncome,essential,flexible,savings,remittance,available,reserved:0,updatedAt:new Date().toISOString()};

setJSON(APP.moneyKey,data);
showMoneyResult(data);
}

function showMoneyResult(data){
const box=document.getElementById("moneyResult");
if(!box)return;

const available=Number(data.available||0);

box.innerHTML=`
<div class="balance-grid">

<div class="balance">
<span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span>
<strong>${money(data.monthlyIncome)}</strong>
</div>

<div class="balance ${available>=0?"positive":"negative"}">
<span>${esc(t("Disponible calculado","Calculated available"))}</span>
<strong>${money(available)}</strong>
</div>

</div>

<div class="notice ${available>=0?"success":"warning"}">
${esc(available>=0?t("Tu cálculo queda por encima de cero.","Your calculation remains above zero."):t("Tus compromisos superan el ingreso calculado.","Your commitments exceed the calculated income."))}
</div>

<div class="actions">
<button class="btn" type="button" onclick="renderRemittance()">${esc(t("Usar para una remesa","Use for a transfer"))}</button>
</div>`;
}

function renderWeek(){
const m=getMoneyState();

if(!Number(m.monthlyIncome||0)){
renderMoney();
return;
}

const weeklyIncome=Number(m.monthlyIncome)/4.333333;
const weeklyCommitments=(Number(m.essential||0)+Number(m.flexible||0)+Number(m.savings||0)+Number(m.remittance||0))/4.333333;
const weeklyAvailable=weeklyIncome-weeklyCommitments;

renderShell(`
<section class="card">

<h1>${esc(t("Mi semana","My week"))}</h1>

<div class="balance-grid">

<div class="balance">
<span>${esc(t("Ingreso semanal equivalente","Equivalent weekly income"))}</span>
<strong>${money(weeklyIncome)}</strong>
</div>

<div class="balance">
<span>${esc(t("Compromisos semanales","Weekly commitments"))}</span>
<strong>${money(weeklyCommitments)}</strong>
</div>

<div class="balance ${weeklyAvailable>=0?"positive":"negative"}">
<span>${esc(t("Disponible semanal","Weekly available"))}</span>
<strong>${money(weeklyAvailable)}</strong>
</div>

</div>

<div class="notice ${weeklyAvailable>=0?"success":"warning"}">
${esc(weeklyAvailable>=0?t("Esta cifra sirve como referencia semanal.","This figure can serve as a weekly reference."):t("Revisa tus compromisos antes de aumentar el gasto o la remesa.","Review your commitments before increasing spending or transfers."))}
</div>

<button class="btn" type="button" onclick="renderMoney()">${esc(t("Modificar mi cálculo","Modify my calculation"))}</button>

</section>`,t("Mi semana","My week"));
}

function getExpenses(){
return getJSON(APP.expensesKey,[]);
}

function saveExpenses(list){
return setJSON(APP.expensesKey,list);
}

function renderExpenses(){
const expenses=getExpenses();

renderShell(`
<section class="card">

<h1>${esc(t("Mis gastos","My expenses"))}</h1>
<p class="legal">${esc(t("Los gastos se guardan localmente en este dispositivo.","Expenses are stored locally on this device."))}</p>

<div class="field">
<label>${esc(t("Descripción","Description"))}</label>
<input id="expenseName" maxlength="120">
</div>

<div class="field">
<label>${esc(t("Monto","Amount"))}</label>
<input id="expenseAmount" type="number" min="0.01" max="1000000" step="0.01">
</div>

<div class="field">
<label>${esc(t("Frecuencia","Frequency"))}</label>
<select id="expenseFrequency">
<option value="monthly">${esc(t("Mensual","Monthly"))}</option>
<option value="weekly">${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option>
<option value="one_time">${esc(t("Una vez","One time"))}</option>
</select>
</div>

<button class="btn" type="button" onclick="addExpense()">${esc(t("Guardar gasto","Save expense"))}</button>

<section class="section">
${expenses.length?expenses.map(expenseRow).join(""):`<div class="empty">${esc(t("Todavía no tienes gastos registrados.","You have no expenses recorded yet."))}</div>`}
</section>

<button class="btn secondary" type="button" onclick="renderMoney()">${esc(t("Actualizar Mi dinero","Update My money"))}</button>

</section>`,t("Mis gastos","My expenses"));
}

function expenseRow(item,index){
return`
<div class="card" style="margin-bottom:10px">
<div class="section-title">
<div><strong>${esc(item.description)}</strong><p>${esc(frequencyLabel(item.frequency||"monthly"))}</p></div>
<strong>${money(item.amount)}</strong>
</div>
<button class="btn danger small" type="button" onclick="removeExpense(${Number(index)})">${esc(t("Borrar","Delete"))}</button>
</div>`;
}

function addExpense(){
const description=(document.getElementById("expenseName")?.value||"").trim();
const amount=Number(document.getElementById("expenseAmount")?.value||0);
const frequency=document.getElementById("expenseFrequency")?.value||"monthly";

if(!description){showError(t("Escribe una descripción.","Enter a description."));return;}
if(!amount||amount<=0||amount>1000000){showError(t("Indica un monto válido.","Enter a valid amount."));return;}

const expenses=getExpenses();
expenses.push({description,amount,frequency,createdAt:new Date().toISOString()});

if(saveExpenses(expenses))renderExpenses();
}

function removeExpense(index){
const expenses=getExpenses();
if(index<0||index>=expenses.length)return;
expenses.splice(index,1);
saveExpenses(expenses);
renderExpenses();
}

function renderFamily(){
const data=getJSON(APP.familyKey,{name:"",country:"",amount:""});

renderShell(`
<section class="card">

<h1>${esc(t("Familia","Family"))}</h1>
<p class="legal">${esc(t("Esta información es solo una referencia local para preparar una remesa. No crea una orden de envío.","This information is only a local reference for preparing a transfer. It does not create a transfer order."))}</p>

<div class="field">
<label>${esc(t("Nombre o apodo","Name or nickname"))}</label>
<input id="familyName" maxlength="80" value="${esc(data.name)}">
</div>

<div class="field">
<label>${esc(t("País","Country"))}</label>
<select id="familyCountry">
<option value="">${esc(t("Selecciona","Select"))}</option>
${(APP.config?.countries||[]).map(c=>{
const id=countryCode(c);
return`<option value="${esc(id)}" ${id===data.country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||c.name_en||id)}</option>`;
}).join("")}
</select>
</div>

<div class="field">
<label>${esc(t("Monto de referencia","Reference amount"))}</label>
<input id="familyAmount" type="number" min="0" max="1000000" step="0.01" value="${esc(data.amount)}">
</div>

<button class="btn" type="button" onclick="saveFamily()">${esc(t("Guardar en este dispositivo","Save on this device"))}</button>

</section>`,t("Familia","Family"));
}

function saveFamily(){
const name=(document.getElementById("familyName")?.value||"").trim();
const country=document.getElementById("familyCountry")?.value||"";
const amount=Math.max(0,Number(document.getElementById("familyAmount")?.value||0));

if(amount>1000000){
showError(t("El monto supera el máximo permitido.","The amount exceeds the allowed maximum."));
return;
}

setJSON(APP.familyKey,{name,country,amount,updatedAt:new Date().toISOString()});
renderHome();
}

function renderSavings(){
const m=getMoneyState();

renderShell(`
<section class="card">

<h1>${esc(t("Ahorrar","Save"))}</h1>

<div class="field">
<label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label>
<input id="saveAmount" type="number" min="0" max="1000000" step="0.01" value="${esc(m.savings||"")}">
</div>

<div class="field">
<label>${esc(t("¿Para qué?","What for?"))}</label>
<input id="savePurpose" maxlength="100" value="${esc(m.savingsPurpose||"")}" placeholder="${esc(t("Ejemplo: emergencia","Example: emergency"))}">
</div>

<button class="btn" type="button" onclick="saveSavings()">${esc(t("Guardar objetivo","Save goal"))}</button>

</section>`,t("Ahorrar","Save"));
}

function saveSavings(){
const amount=Math.max(0,Number(document.getElementById("saveAmount")?.value||0));
const purpose=(document.getElementById("savePurpose")?.value||"").trim();

if(amount>1000000){
showError(t("El monto supera el máximo permitido.","The amount exceeds the allowed maximum."));
return;
}

const m=getMoneyState();
m.savings=amount;
m.savingsPurpose=purpose;

setJSON(APP.moneyKey,m);
renderMoney();
}

function renderPurchase(){
renderShell(`
<section class="card">

<h1>${esc(t("Planear una compra","Plan a purchase"))}</h1>

<p class="legal">${esc(t("La aplicación compara el precio con tu disponible calculado. No decide por ti si debes comprar.","The app compares the price with your calculated available amount. It does not decide whether you should buy."))}</p>

<div class="field">
<label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label>
<input id="purchaseName" maxlength="120">
</div>

<div class="field">
<label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label>
<input id="purchaseAmount" type="number" min="0.01" max="1000000" step="0.01">
</div>

<button class="btn" type="button" onclick="checkPurchase()">${esc(t("Comprobar","Check"))}</button>

</section>`,t("Planear una compra","Plan a purchase"));
}

function checkPurchase(){
const name=(document.getElementById("purchaseName")?.value||"").trim();
const amount=Number(document.getElementById("purchaseAmount")?.value||0);

if(!name){
showError(t("Indica qué quieres comprar.","Tell us what you want to buy."));
return;
}

if(!amount||amount<=0||amount>1000000){
showError(t("Indica un precio válido.","Enter a valid price."));
return;
}

const available=Number(getMoneyState().available||0);
const difference=available-amount;

renderShell(`
<section class="card">

<div class="notice ${difference>=0?"success":"warning"}">
<strong>${esc(difference>=0?t("El precio cabe en tu cálculo actual.","The price fits your current calculation."):t("El precio supera tu disponible actual.","The price exceeds your current available amount."))}</strong>
</div>

<h1>${esc(name)}</h1>

<div class="balance-grid">
<div class="balance"><span>${esc(t("Precio","Price"))}</span><strong>${money(amount)}</strong></div>
<div class="balance ${difference>=0?"positive":"negative"}"><span>${esc(t("Después de comprar","After purchase"))}</span><strong>${money(difference)}</strong></div>
</div>

<button class="btn" type="button" onclick="renderMoney()">${esc(t("Revisar Mi dinero","Review My money"))}</button>

</section>`,t("Resultado","Result"));
}

function renderHelp(){
const topics=Array.isArray(APP.config?.help_topics)?APP.config.help_topics:[];

renderShell(`
<section class="card">

<h1>${esc(t("¿Qué no entiendes?","What don't you understand?"))}</h1>
<p>${esc(t("Elige una pregunta y recibirás una respuesta práctica.","Choose a question and get a practical answer."))}</p>

<div class="result-list">

${topics.length?topics.map(topic=>`
<button class="btn secondary" type="button" onclick="showHelpTopic(${safeInlineString(topic.id)})">
${esc(topic.title?.[APP.lang]||topic.title?.es||topic.title||"")}
</button>`).join(""):`<div class="empty">${esc(t("No hay temas de ayuda disponibles.","No help topics are available."))}</div>`}

</div>

<div class="actions">
<button class="btn secondary" type="button" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button>
<button class="btn secondary" type="button" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div>

</section>`,t("Ayuda","Help"));
}

function showHelpTopic(id){
const topic=(APP.config?.help_topics||[]).find(x=>x.id===id);

if(!topic){
showError(t("Tema no encontrado.","Topic not found."));
return;
}

const title=topic.title?.[APP.lang]||topic.title?.es||topic.title||"";
const answer=topic.answer?.[APP.lang]||topic.answer?.es||topic.answer||"";

renderShell(`
<section class="card">

<h1>${esc(title)}</h1>
<p>${esc(answer)}</p>

<button class="btn" type="button" onclick="renderHelp()">${esc(t("Ver más ayuda","More help"))}</button>

</section>`,title);
}

function renderPrivacy(){
renderShell(`
<section class="card">

<h1>${esc(t("Privacidad y datos","Privacy and data"))}</h1>

<h2>${esc(t("Datos locales","Local data"))}</h2>
<p>${esc(t("Los datos de Mi dinero, Mis gastos, Familia, ahorro y preferencias se guardan en el almacenamiento local de este dispositivo.","Data from My money, My expenses, Family, savings, and preferences is stored in this device's local storage."))}</p>

<h2>${esc(t("Sesión de remesa","Remittance session"))}</h2>
<p>${esc(t("Para preparar una remesa, algunos datos introducidos por ti pueden procesarse temporalmente en el servidor. La aplicación no necesita tus contraseñas bancarias ni credenciales del proveedor.","To prepare a remittance, some information you enter may be processed temporarily on the server. The application does not need your banking passwords or provider credentials."))}</p>

<h2>${esc(t("Información que NO debes introducir aquí","Information you should NOT enter here"))}</h2>

<ul class="list">
<li>${esc(t("Contraseñas bancarias","Bank passwords"))}</li>
<li>${esc(t("PIN o códigos de seguridad","PINs or security codes"))}</li>
<li>${esc(t("CVV o códigos de tarjeta","CVVs or card security codes"))}</li>
<li>${esc(t("Códigos OTP o códigos enviados por SMS","OTP codes or SMS verification codes"))}</li>
<li>${esc(t("Credenciales de proveedores","Provider credentials"))}</li>
</ul>

<h2>${esc(t("Borrado","Deletion"))}</h2>
<p>${esc(t("Puedes borrar los datos guardados localmente desde este dispositivo.","You can delete data stored locally on this device."))}</p>

<div class="actions">
<button class="btn danger" type="button" onclick="deleteLocalData()">${esc(t("Borrar mis datos","Delete my data"))}</button>
<button class="btn secondary" type="button" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div>

</section>`,t("Privacidad","Privacy"));
}

function renderAbout(){
renderShell(`
<section class="card">

<h1>${esc(t("Qué hace REMESAS","What REMESAS does"))}</h1>

<p>${esc(t(
"REMESAS ayuda a entender, organizar y preparar una remesa. Hace cálculos con los datos que introduces, organiza tus preferencias y te lleva a la fuente oficial cuando hace falta.",
"REMESAS helps you understand, organize, and prepare a remittance. It calculates using the information you enter, organizes your preferences, and takes you to the official source when needed."
))}</p>

<h2>${esc(t("Qué no hace","What it does not do"))}</h2>

<p>${esc(t(
"No recibe ni guarda permanentemente tu dinero. No ejecuta transferencias. No es un banco, financiera, asesor financiero, procesador de pagos ni proveedor de remesas.",
"It does not receive or permanently hold your money. It does not execute transfers. It is not a bank, financial institution, financial advisor, payment processor, or remittance provider."
))}</p>

<h2>${esc(t("Impuestos","Taxes"))}</h2>

<p>${esc(t(
"Tus registros de ingresos y gastos pueden servir como referencia para entregarlos a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.",
"Your income and expense records may serve as a reference to give to your accountant or tax preparer. REMESAS does not prepare or file taxes."
))}</p>

<button class="btn" type="button" onclick="renderHome()">${esc(t("Volver","Back"))}</button>

</section>`,t("Información","Information"));
}

const LEARNING=[
{
title:["Antes de empezar","Before you start"],
es:"Antes de iniciar una remesa, normalmente necesitas saber cuánto quieres enviar, a qué país va el dinero y cómo quieres que lo reciba la persona.",
en:"Before starting a remittance, you generally need to know how much you want to send, which country the money is going to, and how the recipient should receive it."
},
{
title:["Datos del remitente","Sender information"],
es:"Dependiendo del proveedor, país, monto y método, pueden pedir nombre legal, fecha de nacimiento, dirección, teléfono, correo electrónico y datos de identificación.",
en:"Depending on the provider, country, amount, and method, they may ask for legal name, date of birth, address, phone number, email, and identification information."
},
{
title:["Datos del destinatario","Recipient information"],
es:"Pueden pedir el nombre completo exactamente como aparece en su identificación, teléfono, país y ciudad, y datos de la cuenta o billetera cuando el dinero llega electrónicamente.",
en:"They may ask for the recipient's full name exactly as shown on identification, phone number, country and city, and account or wallet information when money is delivered electronically."
},
{
title:["Cuenta bancaria","Bank account"],
es:"Si el dinero va a una cuenta, pueden pedir banco, número de cuenta y otros datos bancarios necesarios para esa ruta. Los datos exactos dependen del país y proveedor.",
en:"If money goes to a bank account, they may ask for the bank, account number, and other banking details needed for that route. Exact requirements depend on the country and provider."
},
{
title:["Recogida en efectivo","Cash pickup"],
es:"Si la persona recoge efectivo, pueden pedir datos del destinatario y después exigir identificación al recoger. El nombre debe coincidir con los requisitos del proveedor.",
en:"If the recipient collects cash, the provider may ask for recipient details and identification at pickup. The name must meet the provider's requirements."
},
{
title:["Billetera móvil","Mobile wallet"],
es:"Cuando se utiliza una billetera, pueden pedir el número o identificador de la cuenta y otros datos relacionados con esa billetera.",
en:"When using a wallet, they may ask for the account number or identifier and other information related to that wallet."
},
{
title:["Motivo o información adicional","Purpose or additional information"],
es:"En determinadas operaciones pueden pedir el motivo de la transferencia, relación con el destinatario, origen de los fondos u otra información para cumplir sus procesos de verificación.",
en:"For some transactions, they may ask for the purpose of the transfer, relationship to the recipient, source of funds, or other information for verification."
},
{
title:["Pago de la remesa","Paying for the transfer"],
es:"El proveedor puede ofrecer diferentes formas de pago según la ruta. Antes de confirmar, revisa qué método estás usando y qué importe final aparece.",
en:"The provider may offer different payment methods depending on the route. Before confirming, review which method you are using and the final amount shown."
},
{
title:["Revisión final","Final review"],
es:"Antes de enviar, revisa nombre del destinatario, país, monto, moneda, método de entrega y datos de pago. Un error en un dato puede afectar la operación.",
en:"Before sending, review the recipient name, country, amount, currency, delivery method, and payment details. An error in a detail can affect the transaction."
},
{
title:["Lo que nunca debes entregar a REMESAS","What you should never give REMESAS"],
es:"REMESAS no necesita contraseñas bancarias, CVV, PIN, códigos OTP, códigos enviados por SMS ni credenciales de proveedores. Esos datos deben introducirse únicamente en el sitio oficial cuando el proveedor los solicite.",
en:"REMESAS does not need bank passwords, CVVs, PINs, OTP codes, SMS codes, or provider credentials. Those details should only be entered on the provider's official site when requested."
}
];

function renderLearning(){
const providers=Array.isArray(APP.config?.providers)?APP.config.providers:[];
const registry=providers.length?providers:[
{id:"western_union",name:"Western Union",official_site:"https://www.westernunion.com/us/en/home.html"},
{id:"moneygram",name:"MoneyGram",official_site:"https://www.moneygram.com/us/en"},
{id:"remitly",name:"Remitly",official_site:"https://www.remitly.com/us/en"},
{id:"xoom",name:"Xoom",official_site:"https://www.xoom.com/"}
];

renderShell(`
<section class="section">

<div class="section-title">
<div>
<h2>${esc(t("APRENDER: cómo funciona una remesa","LEARN: how a remittance works"))}</h2>
<p>${esc(t("Una guía sencilla antes de entrar al sitio del proveedor.","A simple guide before entering the provider's site."))}</p>
</div>
</div>

<div class="notice info">
<strong>${esc(t("Importante","Important"))}</strong>
<p>${esc(t(
"Los requisitos cambian según proveedor, país, monto, método y circunstancias. Esta guía explica qué puedes encontrarte; no sustituye las instrucciones actuales del proveedor.",
"Requirements vary by provider, country, amount, method, and circumstances. This guide explains what you may encounter; it does not replace the provider's current instructions."
))}</p>
</div>

<div class="result-list">

${LEARNING.map((item,i)=>`
<article class="provider-card">

<div class="provider-head">
<div>
<h3>${i+1}. ${esc(item.title[APP.lang==="en"?1:0])}</h3>
</div>
<span class="provider-status">${i+1}/10</span>
</div>

<p>${esc(APP.lang==="en"?item.en:item.es)}</p>

</article>`).join("")}

</div>

<section class="section">

<div class="card">

<h2>${esc(t("¿Qué información puede pedir una aplicación?","What information can a remittance app ask for?"))}</h2>

<ul class="list">
<li>${esc(t("Información del remitente: identidad y datos de contacto.","Sender information: identity and contact details."))}</li>
<li>${esc(t("Información del destinatario: nombre y datos necesarios para recibir.","Recipient information: name and details needed to receive."))}</li>
<li>${esc(t("Datos bancarios o de billetera cuando la entrega es electrónica.","Bank or wallet information when delivery is electronic."))}</li>
<li>${esc(t("Información adicional para determinadas operaciones o verificaciones.","Additional information for certain transactions or verification."))}</li>
<li>${esc(t("Método de pago y método de recepción.","Payment method and receiving method."))}</li>
</ul>

<div class="notice warning">
<strong>${esc(t("No confundas información requerida con información secreta","Do not confuse required information with secret information"))}</strong>
<p>${esc(t(
"Que un proveedor pueda pedir identificación o datos del destinatario no significa que debas entregar contraseñas, OTP, CVV o PIN a REMESAS.",
"The fact that a provider may request identification or recipient information does not mean you should give passwords, OTPs, CVVs, or PINs to REMESAS."
))}</p>
</div>

</div>

</section>

<section class="section">

<div class="card">

<h2>${esc(t("Aprender sobre cada proveedor","Learn about each provider"))}</h2>

<p class="legal">${esc(t(
"REMESAS explica el proceso con contenido propio. Para requisitos actuales, utiliza siempre el sitio oficial.",
"REMESAS explains the process using original content. For current requirements, always use the official site."
))}</p>

<div class="result-list">

${registry.map(provider=>`
<div class="provider-card">

<div class="provider-head">
<div>
<h3>${esc(provider.name||provider.provider_name||provider.id)}</h3>
<p>${esc(t("Guía independiente","Independent guide"))}</p>
</div>
</div>

<p>${esc(t(
"Aprende el recorrido general: destino → monto → recepción → pago → destinatario → revisión → confirmación.",
"Learn the general path: destination → amount → receiving method → payment → recipient → review → confirmation."
))}</p>

${provider.official_site?`<button class="btn" type="button" onclick="openOfficial(${safeInlineString(provider.official_site)})">${esc(t("Ir al sitio oficial","Go to official site"))}</button>`:""}

</div>`).join("")}

</div>

</div>

</section>

<div class="actions">
<button class="btn" type="button" onclick="renderRemittance()">${esc(t("Ahora preparar una remesa","Prepare a transfer now"))}</button>
<button class="btn secondary" type="button" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div>

<p class="legal">${esc(t(
"Contenido educativo original de REMESAS. No reproduce capturas, logotipos, interfaces ni textos de capacitación de los proveedores.",
"Original educational content from REMESAS. It does not reproduce provider screenshots, logos, interfaces, or training text."
))}</p>

</section>`,t("APRENDER","LEARN"));
}

function renderSubscription(){
if(!accessIsActive()){
showAccessGate();
return;
}

renderHome();
}

async function createCheckout(){
try{
const data=await api("/api/create-checkout-session",{
method:"POST",
skipAccess:true,
body:JSON.stringify({language:APP.lang,price_type:"1"})
});

const url=data?.url||data?.checkout_url||"";

if(url){
window.location.href=url;
return;
}

showError(t("No se recibió un enlace de pago válido.","No valid checkout link was returned."));
}catch(error){
showError(error.message);
}
}

function clearPaymentQuery(){
try{
window.history.replaceState({},document.title,window.location.pathname);
}catch{}
}

async function checkPayment(checkoutId){
renderShell(`
<section class="card">
<div class="loading"><div class="spinner"></div><span>${esc(t("Comprobando pago...","Checking payment..."))}</span></div>
<h1>${esc(t("Un momento","One moment"))}</h1>
</section>`,t("Pago","Payment"));

const endpoints=[
`/api/payment/check?session_id=${encodeURIComponent(checkoutId)}`,
`/api/payment-success?session_id=${encodeURIComponent(checkoutId)}`
];

let data=null;
let lastError=null;

for(const endpoint of endpoints){
try{
const response=await fetch(endpoint);
const json=await response.json().catch(()=>({}));

if(response.ok){
data=json;
break;
}

lastError=new Error(json.detail||json.error||t("No se pudo verificar el pago.","Payment could not be verified."));
}catch(error){
lastError=error;
}
}

if(!data){
renderShell(`
<section class="card">
<div class="notice warning"><strong>${esc(t("No se pudo verificar","Could not verify"))}</strong></div>
<p>${esc(lastError?.message||t("No se pudo verificar el pago.","The payment could not be verified."))}</p>
<button class="btn" type="button" onclick="clearPaymentQuery();renderHome()">${esc(t("Volver","Back"))}</button>
</section>`,t("Pago","Payment"));
return;
}

const active=Boolean(data.active||data.authorized||data.access==="granted"||data.status==="success"||data.status==="active");

if(active){
const token=data.token||data.access_token||data.session_token;
const untilRaw=Number(data.access_until||data.expires_at||0);
const until=untilRaw?untilRaw>1e12?untilRaw:untilRaw*1000:Date.now()+20*60*1000;

if(token)saveAccess(token,until,false);

clearPaymentQuery();

try{
await loadConfig();
await startSession(false);
renderHome();
return;
}catch(error){
showError(error.message);
}
}

renderShell(`
<section class="card">

<div class="notice warning">
<strong>${esc(t("Pago pendiente o no activo","Payment pending or not active"))}</strong>
</div>

<h1>${esc(t("Revisa el estado del pago","Check payment status"))}</h1>

<p>${esc(t(
"El servidor todavía no confirmó un acceso activo.",
"The server has not confirmed active access yet."
))}</p>

<button class="btn" type="button" onclick="clearPaymentQuery();renderHome()">${esc(t("Continuar","Continue"))}</button>

</section>`,t("Pago","Payment"));
}

function renderPaymentResult(){
const params=new URLSearchParams(window.location.search);
const payment=params.get("payment");
const success=params.get("success");
const checkoutId=params.get("session_id");

if((payment==="success"||success==="true")&&checkoutId){
checkPayment(checkoutId);
return true;
}

if(payment==="cancel"||payment==="cancelled"){
renderShell(`
<section class="card">

<div class="notice warning">
<strong>${esc(t("Pago cancelado","Payment canceled"))}</strong>
</div>

<h1>${esc(t("No se realizó el pago","No payment was completed"))}</h1>

<p>${esc(t("Puedes volver a REMESAS cuando quieras.","You can return to REMESAS whenever you want."))}</p>

<button class="btn" type="button" onclick="clearPaymentQuery();showAccessGate()">${esc(t("Volver","Return"))}</button>

</section>`,t("Pago","Payment"));

return true;
}

return false;
}

function showError(message){
const existing=document.querySelector(".toast");
if(existing)existing.remove();

const box=document.createElement("div");
box.className="toast";
box.setAttribute("role","alert");
box.innerHTML=esc(message||t("Ocurrió un error.","An error occurred."));
document.body.appendChild(box);

setTimeout(()=>{
if(box.parentElement)box.remove();
},7000);
}

async function deleteLocalData(){
const confirmed=window.confirm(t("¿Borrar los datos guardados en este dispositivo?","Delete the data saved on this device?"));
if(!confirmed)return;

[APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,"remesas_lang_v4"].forEach(key=>localStorage.removeItem(key));

if(APP.session?.session_id){
try{
await api(`/api/session/${encodeURIComponent(APP.session.session_id)}`,{method:"DELETE"});
}catch{}
}

APP.session=null;
APP.config=null;
location.reload();
}

Object.assign(window,{
renderHome,
renderAbout,
renderRemittance,
renderMoney,
renderWeek,
renderExpenses,
renderFamily,
renderHelp,
renderPurchase,
renderSavings,
renderPrivacy,
renderSubscription,
renderLearning,
changeLanguage,
understandNeed,
beginParsedRemittance,
compare,
selectProvider,
renderFinalCheck,
renderComparisonFromSession,
openOfficial,
calculateMoney,
addExpense,
removeExpense,
saveFamily,
saveSavings,
checkPurchase,
showHelpTopic,
deleteLocalData,
updateMoneyWarning,
createCheckout,
checkPayment,
clearPaymentQuery,
showAdminLogin,
closeAdminLogin,
loginAdmin,
showAccessGate
});

async function boot(){
if(!app)return;

setupTripleTap();

app.innerHTML=`
<div class="app-shell">
<section class="card">
<div class="loading">
<div class="spinner"></div>
<span>${esc(t("Cargando REMESAS...","Loading REMESAS..."))}</span>
</div>
</section>
</div>`;

try{

await loadConfig();

if(renderPaymentResult())return;

if(await accessStatus()){
await startSession(true);
renderHome();
return;
}

showAccessGate();

}catch(error){

app.innerHTML=`
<div class="app-shell">
<section class="card">

<div class="notice danger">
<strong>${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}</strong>
<p>${esc(error?.message||t("Revisa tu conexión y vuelve a intentarlo.","Check your connection and try again."))}</p>
</div>

<div class="actions">
<button class="btn" type="button" onclick="location.reload()">${esc(t("Reintentar","Retry"))}</button>
<button class="btn secondary" type="button" onclick="showAccessGate()">${esc(t("Ver acceso","View access"))}</button>
</div>

</section>
</div>`;
}
}

if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",boot,{once:true});
}else{
boot();
}
