"use strict";

const APP={
name:"REMESAS",
version:"4.0.0",
lang:localStorage.getItem("remesas_lang_v4")||"es",
session:null,
config:null,
moneyKey:"remesas_money_v4",
expensesKey:"remesas_expenses_v4",
familyKey:"remesas_family_v4",
prefsKey:"remesas_prefs_v4"
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

function money(value){
const n=Number(value||0);
return new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{
style:"currency",
currency:"USD",
maximumFractionDigits:2
}).format(n);
}

function t(es,en){
return APP.lang==="en"?en:es;
}

function getJSON(key,fallback){
try{
const value=JSON.parse(localStorage.getItem(key)||"");
return value??fallback;
}catch{
return fallback;
}
}

function setJSON(key,value){
localStorage.setItem(key,JSON.stringify(value));
}

async function api(url,options={}){
const opts={
...options,
headers:{
"Content-Type":"application/json",
...(options.headers||{})
}
};
const response=await fetch(url,opts);
let data=null;
try{
data=await response.json();
}catch{
data={};
}
if(!response.ok){
throw new Error(
data.error||
data.detail||
t("No se pudo completar la operación.","The operation could not be completed.")
);
}
return data;
}

async function loadConfig(){
const data=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);
APP.config=data;
return data;
}

async function startSession(preserve=true){
if(preserve&&APP.session?.session_id){
try{
const data=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}`);
APP.session=data.session;
return APP.session;
}catch{}
}
const data=await api(
`/api/session?language=${encodeURIComponent(APP.lang)}`,
{method:"POST"}
);
APP.session=data.session;
return APP.session;
}

async function changeLanguage(){
APP.lang=APP.lang==="es"?"en":"es";
localStorage.setItem("remesas_lang_v4",APP.lang);
try{
if(APP.session?.session_id){
await api("/api/need",{
method:"POST",
body:JSON.stringify({
session_id:APP.session.session_id,
language:APP.lang
})
});
}else{
await startSession(false);
}
await loadConfig();
renderHome();
}catch(error){
showError(error.message);
}
}

function topbar(title=t("REMESAS","REMESAS")){
return `
<header class="topbar">
<button class="icon-button" type="button" onclick="renderHome()" aria-label="${esc(t("Volver","Back"))}">←</button>
<strong>${esc(title)}</strong>
<button class="lang-button" type="button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button>
</header>`;
}

function renderShell(content,title="REMESAS"){
app.innerHTML=`${topbar(title)}<main class="page">${content}</main>`;
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
const opening=APP.config?.opening||{};
const title=opening.title?.[APP.lang]||
t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER");
const subtitle=opening.subtitle?.[APP.lang]||
t(
"Entiende tu necesidad y encuentra el siguiente paso.",
"Understand your need and find the next step."
);
const notice=opening.notice?.[APP.lang]||
t(
"REMESAS no inventa datos comerciales.",
"REMESAS does not invent commercial data."
);

app.innerHTML=`
<header class="hero">
<div class="hero-top">
<span class="brand">REMESAS</span>
<button class="lang-button" type="button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button>
</div>
<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>
</header>

<main class="home">

<div class="notice">
<strong>${esc(t("Importante","Important"))}</strong>
<p>${esc(notice)}</p>
</div>

<section class="quick-grid">
${homeCard("💸",t("Enviar dinero","Send money"),t("Organiza una remesa y revisa proveedores.","Organize a transfer and review providers."),"renderRemittance()")}
${homeCard("💰",t("Mi dinero","My money"),t("Calcula cuánto puedes usar.","Calculate how much you can use."),"renderMoney()")}
${homeCard("📅",t("Mi semana","My week"),t("Mira tu dinero disponible por semana.","See your money available per week."),"renderWeek()")}
${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos.","Record and review your expenses."),"renderExpenses()")}
${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia para una remesa.","Save a reference for a transfer."),"renderFamily()")}
${homeCard("❓",t("No entiendo","I need help"),t("Escribe qué necesitas y te orientamos.","Write what you need and we will guide you."),"renderHelp()")}
${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Comprueba si una compra cabe en tu dinero.","Check whether a purchase fits your money."),"renderPurchase()")}
${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para un objetivo.","Reserve money for a goal."),"renderSavings()")}
</section>

<section class="card need-card">
<h2>${esc(t("¿Qué necesitas hacer?","What do you need to do?"))}</h2>
<textarea id="freeNeed" maxlength="2000" placeholder="${esc(t(
"Ejemplo: quiero enviar $200 a México...",
"Example: I want to send $200 to Mexico..."
))}"></textarea>
<button class="primary" type="button" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button>
</section>

<section class="privacy">
<strong>${esc(t("Privacidad","Privacy"))}</strong>
<span>${esc(privacyNotice())}</span>
</section>

<section class="card">
<h2>${esc(t("Información del servicio","Service information"))}</h2>
<p class="small">${esc(legalShort())}</p>
<p class="small">${esc(commercialNotice())}</p>
<button class="secondary" type="button" onclick="renderPrivacy()">${esc(t("Privacidad y datos","Privacy and data"))}</button>
</section>

<footer>
${esc(t("REMESAS · May Roga LLC","REMESAS · May Roga LLC"))}
</footer>

</main>`;
}

function homeCard(icon,title,text,action){
return `
<button class="home-card" type="button" onclick="${action}">
<span class="card-icon">${icon}</span>
<strong>${esc(title)}</strong>
<small>${esc(text)}</small>
</button>`;
}

async function understandNeed(){
const input=document.getElementById("freeNeed");
const text=(input?.value||"").trim();
if(!text){
showError(t("Escribe primero qué necesitas.","Write what you need first."));
return;
}
try{
const data=await api("/api/assistant",{
method:"POST",
body:JSON.stringify({text,language:APP.lang})
});
renderAssistant(data);
}catch(error){
showError(error.message);
}
}

function renderAssistant(data){
const parsed=data.parsed||{};
const isRemittance=parsed.need_type==="remittance";
const action=isRemittance
?`beginParsedRemittance(${safeInlineJSON(parsed)})`
:actionForNeed(parsed.need_type);

renderShell(`
<section class="card">
<div class="status success">${esc(t("Entendido","Understood"))}</div>
<h1>${esc(data.assistant||t("Vamos paso a paso.","Let's go step by step."))}</h1>

<div class="review-grid">
${parsed.amount?`
<div>
<small>${esc(t("Monto","Amount"))}</small>
<strong>${money(parsed.amount)}</strong>
</div>`:""}

${parsed.destination_country?`
<div>
<small>${esc(t("Destino","Destination"))}</small>
<strong>${esc(countryName(parsed.destination_country))}</strong>
</div>`:""}

${parsed.priority?`
<div>
<small>${esc(t("Prioridad","Priority"))}</small>
<strong>${esc(priorityLabel(parsed.priority))}</strong>
</div>`:""}

${parsed.frequency?`
<div>
<small>${esc(t("Frecuencia","Frequency"))}</small>
<strong>${esc(frequencyLabel(parsed.frequency))}</strong>
</div>`:""}
</div>

<button class="primary" type="button" onclick="${action}">
${esc(isRemittance?t("Continuar con la remesa","Continue with transfer"):t("Continuar","Continue"))}
</button>

<button class="secondary" type="button" onclick="renderHome()">
${esc(t("Volver","Back"))}
</button>
</section>`,
t("Tu necesidad","Your need"));
}

function safeInlineJSON(value){
return JSON.stringify(value)
.replace(/\\/g,"\\\\")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;");
}

function actionForNeed(type){
const map={
money_available:"renderMoney()",
expenses:"renderExpenses()",
savings:"renderSavings()",
purchase:"renderPurchase()",
family:"renderFamily()",
fees:"renderHelp()",
exchange_rate:"renderHelp()",
delivery:"renderHelp()",
provider_difference:"renderRemittance()",
security:"renderHelp()"
};
return map[type]||"renderHome()";
}

async function beginParsedRemittance(parsed){
try{
await startSession(true);
const body={
session_id:APP.session.session_id,
language:APP.lang,
need_type:"remittance"
};
[
"amount",
"destination_country",
"priority",
"urgency",
"frequency",
"delivery_method",
"payment_method",
"recipient_amount_target"
].forEach(key=>{
if(parsed[key]!=null)body[key]=parsed[key];
});
const data=await api("/api/need",{
method:"POST",
body:JSON.stringify(body)
});
APP.session=data.session;
renderRemittance(parsed);
}catch(error){
showError(error.message);
}
}

function countryName(code){
const list=APP.config?.countries||[];
const item=list.find(x=>x.code===String(code||"").toUpperCase());
return item?.name?.[APP.lang]||item?.name?.es||code||"";
}

function priorityLabel(value){
const map={
recipient_gets_more:t("Más para el destinatario","More for recipient"),
fastest:t("Rapidez","Speed"),
urgent:t("Urgente","Urgent"),
save:t("Ahorrar","Save"),
balanced:t("Equilibrio","Balanced"),
compare_all:t("Comparar","Compare")
};
return map[value]||value||"";
}

function frequencyLabel(value){
const map={
weekly:t("Semanal","Weekly"),
biweekly:t("Quincenal","Biweekly"),
monthly:t("Mensual","Monthly"),
one_time:t("Una vez","One time")
};
return map[value]||value||"";
}

function renderRemittance(parsed={}){
const session=APP.session||{};
const amount=session.amount??parsed.amount??"";
const country=session.destination_country||parsed.destination_country||"";
const priority=session.priority||parsed.priority||"";
const frequency=session.frequency||parsed.frequency||"";

renderShell(`
<section class="card">
<h1>${esc(t("Enviar dinero","Send money"))}</h1>
<p class="small">${esc(t(
"Te preguntamos solo lo que puede cambiar el siguiente paso.",
"We only ask what can change the next step."
))}</p>

<label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label>
<input id="sendAmount" type="number" min="0.01" max="1000000" step="0.01" value="${esc(amount)}" oninput="updateMoneyWarning()">

<label>${esc(t("¿A qué país?","Which country?"))}</label>
<select id="sendCountry">
<option value="">${esc(t("Selecciona","Select"))}</option>
${(APP.config?.countries||[]).map(c=>`
<option value="${esc(c.code)}" ${c.code===country?"selected":""}>
${esc(c.name?.[APP.lang]||c.name?.es||c.code)}
</option>`).join("")}
</select>

<label>${esc(t("¿Qué importa más?","What matters most?"))}</label>
<select id="sendPriority">
<option value="">${esc(t("No estoy seguro","Not sure"))}</option>
<option value="recipient_gets_more" ${priority==="recipient_gets_more"?"selected":""}>${esc(t("Que reciba más","Recipient gets more"))}</option>
<option value="fastest" ${priority==="fastest"?"selected":""}>${esc(t("Rapidez","Speed"))}</option>
<option value="save" ${priority==="save"?"selected":""}>${esc(t("Ahorrar","Save"))}</option>
<option value="balanced" ${priority==="balanced"?"selected":""}>${esc(t("Equilibrio","Balanced"))}</option>
</select>

<label>${esc(t("¿Es urgente?","Is it urgent?"))}</label>
<select id="sendUrgency">
<option value="">${esc(t("No estoy seguro","Not sure"))}</option>
<option value="true" ${session.urgency===true||parsed.urgency===true?"selected":""}>${esc(t("Sí","Yes"))}</option>
<option value="false" ${session.urgency===false||parsed.urgency===false?"selected":""}>${esc(t("No","No"))}</option>
</select>

<label>${esc(t("¿Cada cuánto envías?","How often do you send?"))}</label>
<select id="sendFrequency">
<option value="">${esc(t("Una sola vez / no sé","One time / not sure"))}</option>
<option value="one_time" ${frequency==="one_time"?"selected":""}>${esc(t("Una vez","One time"))}</option>
<option value="weekly" ${frequency==="weekly"?"selected":""}>${esc(t("Cada semana","Weekly"))}</option>
<option value="biweekly" ${frequency==="biweekly"?"selected":""}>${esc(t("Cada dos semanas","Every two weeks"))}</option>
<option value="monthly" ${frequency==="monthly"?"selected":""}>${esc(t("Cada mes","Every month"))}</option>
</select>

<label>${esc(t("¿Cómo recibe?","How does the recipient receive?"))}</label>
<select id="sendDelivery">
<option value="">${esc(t("No sé todavía","Not sure yet"))}</option>
${(APP.config?.delivery_methods||[]).map(x=>`
<option value="${esc(x.id)}" ${session.delivery_method===x.id||parsed.delivery_method===x.id?"selected":""}>
${esc(x.label?.[APP.lang]||x.label?.es||x.id)}
</option>`).join("")}
</select>

<label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label>
<select id="sendPayment">
<option value="">${esc(t("No sé todavía","Not sure yet"))}</option>
${(APP.config?.payment_methods||[]).map(x=>`
<option value="${esc(x.id)}" ${session.payment_method===x.id||parsed.payment_method===x.id?"selected":""}>
${esc(x.label?.[APP.lang]||x.label?.es||x.id)}
</option>`).join("")}
</select>

<div id="moneyWarning"></div>

<button class="primary" type="button" onclick="compare()">
${esc(t("Revisar opciones","Review options"))}
</button>

<p class="small">${esc(commercialNotice())}</p>
</section>`,
t("Enviar dinero","Send money"));

updateMoneyWarning();
}

function getMoneyState(){
return getJSON(APP.moneyKey,{
income:0,
incomeFreq:"monthly",
essential:0,
flexible:0,
savings:0,
remittance:0,
available:0,
reserved:0
});
}

function updateMoneyWarning(){
const box=document.getElementById("moneyWarning");
const input=document.getElementById("sendAmount");
if(!box||!input)return;

const amount=Number(input.value||0);
const m=getMoneyState();
const available=Number(m.available||0);
const warnings=[];

if(available>0&&amount>available){
warnings.push(
t(
`El monto supera tu disponible calculado (${money(available)}).`,
`The amount is above your calculated available balance (${money(available)}).`
)
);
}

if(amount>10000){
warnings.push(
t(
"Por este monto conviene revisar cuidadosamente los datos finales del proveedor.",
"For this amount, carefully review the provider's final transaction details."
)
);
}

box.innerHTML=warnings.length
?`<div class="status warning">${warnings.map(esc).join("<br>")}</div>`
:"";
}

async function compare(){
const amount=Number(document.getElementById("sendAmount")?.value||0);
const destination=document.getElementById("sendCountry")?.value||"";

if(!amount||amount<=0){
showError(t("Indica un monto válido.","Enter a valid amount."));
return;
}

if(amount>1000000){
showError(t("El monto supera el máximo permitido.","The amount exceeds the allowed maximum."));
return;
}

if(!destination){
showError(t("Selecciona el país de destino.","Select the destination country."));
return;
}

const priority=document.getElementById("sendPriority")?.value||null;
const urgencyValue=document.getElementById("sendUrgency")?.value||"";
const urgency=urgencyValue===""?null:urgencyValue==="true";
const frequency=document.getElementById("sendFrequency")?.value||null;
const delivery=document.getElementById("sendDelivery")?.value||null;
const payment=document.getElementById("sendPayment")?.value||null;

try{
await startSession(true);

const data=await api("/api/need",{
method:"POST",
body:JSON.stringify({
session_id:APP.session.session_id,
language:APP.lang,
need_type:"remittance",
amount,
destination_country:destination,
priority,
urgency,
frequency,
delivery_method:delivery,
payment_method:payment
})
});

APP.session=data.session;

const result=await api(
`/api/session/${encodeURIComponent(APP.session.session_id)}/compare`,
{method:"POST"}
);

renderComparison(result);
}catch(error){
showError(error.message);
}
}

function providerStatus(provider){
return provider.commercial_data_status==="verified"
?t("Datos comerciales verificados","Verified commercial data")
:t("Datos comerciales no verificados","Commercial data not verified");
}

function providerMethodsLabel(provider){
const methods=(provider.delivery_methods||[]).map(x=>methodLabel(x));
return methods.length?methods.join(", "):t("No especificados","Not specified");
}

function methodLabel(value){
const map={
cash_pickup:t("recogida en efectivo","cash pickup"),
bank_account:t("cuenta bancaria","bank account"),
debit_card:t("tarjeta de débito","debit card"),
credit_card:t("tarjeta de crédito","credit card"),
mobile_wallet:t("billetera móvil","mobile wallet"),
home_delivery:t("entrega a domicilio","home delivery"),
cash:t("efectivo","cash"),
apple_pay:"Apple Pay",
other:t("otro","other")
};
return map[value]||value;
}

function renderComparison(data){
const providers=data.available_providers||[];
const results=data.results||[];

renderShell(`
<section class="card">

<div class="status ${data.results_available?"success":"warning"}">
${esc(
data.results_available
?t(`${data.verified_count} opción(es) con datos comerciales verificados`,`${data.verified_count} option(s) with verified commercial data`)
:t("No hay datos comerciales actuales verificados","No current verified commercial data")
)}
</div>

<h1>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h1>

<div class="summary">
<strong>${esc(countryName(data.destination_country))}</strong>
<span>${money(data.amount)}</span>
</div>

<p>${esc(data.explanation||t(
"Revisa las opciones y confirma los datos actuales directamente con cada proveedor.",
"Review the options and confirm current details directly with each provider."
))}</p>

<div class="provider-list">
${providers.map(providerCard).join("")}
</div>

${data.precautions?.length?`
<div class="notice">
<strong>${esc(t("Antes de continuar","Before continuing"))}</strong>
<ul>${data.precautions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
</div>`:""}

<div class="notice">
<strong>${esc(t("Importante","Important"))}</strong>
<p>${esc(commercialNotice())}</p>
</div>

<button class="secondary" type="button" onclick="renderRemittance()">
${esc(t("Cambiar datos","Change details"))}
</button>

</section>`,
t("Opciones","Options"));
}

function providerCard(provider){
const verified=provider.commercial_data_status==="verified";
const result=(APP.session?.verified_results||[]).find(
x=>x.provider_id===provider.provider_id
);

return `
<article class="provider-card">

<div class="provider-head">
<div>
<h3>${esc(provider.provider_name||provider.name||"")}</h3>
<span class="status ${verified?"success":"warning"}">
${esc(providerStatus(provider))}
</span>
</div>
</div>

${verified&&result?`
<div class="metric-grid">

<div>
<small>${esc(t("Tarifa","Fee"))}</small>
<strong>${result.fee!=null?money(result.fee):"—"}</strong>
</div>

<div>
<small>${esc(t("Tasa","Rate"))}</small>
<strong>${esc(result.exchange_rate??"—")}</strong>
</div>

<div>
<small>${esc(t("Recibe","Gets"))}</small>
<strong>${result.recipient_amount!=null?money(result.recipient_amount):"—"}</strong>
</div>

<div>
<small>${esc(t("Entrega","Delivery"))}</small>
<strong>${esc(result.estimated_delivery??"—")}</strong>
</div>

</div>`:`
<p class="small">
${esc(t(
"No mostramos tarifas, tasas, tiempos ni disponibilidad como datos actuales porque no están verificados.",
"We do not show fees, rates, timing, or availability as current data because they are not verified."
))}
</p>`}

<div class="small">
<strong>${esc(t("Métodos declarados:","Declared methods:"))}</strong>
${esc(providerMethodsLabel(provider))}
</div>

<p class="small">
${esc(t(
"Los métodos pueden variar según país y transacción. Confirma la disponibilidad en el sitio oficial.",
"Methods may vary by country and transaction. Confirm availability on the official site."
))}
</p>

<button class="primary" type="button" onclick="selectProvider('${esc(provider.provider_id)}')">
${esc(t("Revisar proveedor","Review provider"))}
</button>

</article>`;
}

async function selectProvider(providerId){
try{
if(!APP.session?.session_id){
await startSession(false);
}
const data=await api(
`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(providerId)}`,
{method:"POST"}
);
APP.session=data.session;
renderFinalCheck();
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
const data=await api(
`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,
{method:"POST"}
);
renderFinalResult(data);
}catch(error){
showError(error.message);
}
}

function renderFinalResult(data){
const option=APP.session?.selected_option||{};
const url=option.continue_url||
option.official_urls?.send_money||
option.official_urls?.site||
"";

renderShell(`
<section class="card">

<div class="status ${data.ready_to_continue?"success":"warning"}">
${esc(
data.ready_to_continue
?t("Revisión completada","Review completed")
:t("Revisa los datos","Review the details")
)}
</div>

<h1>${esc(option.provider_name||"")}</h1>

<p>${esc(data.message||"")}</p>

<div class="checks">
${(data.checks||[]).map(check=>`
<div class="check ${check.ok?"ok":"bad"}">
<strong>${check.ok?"✓":"!"}</strong>
<span>
<b>${esc(check.label)}</b>
${esc(check.message)}
</span>
</div>`).join("")}
</div>

${data.requirements?.length?`
<div class="notice">
<strong>${esc(t("Requisitos","Requirements"))}</strong>
<ul>
${data.requirements.map(x=>`<li>${esc(x)}</li>`).join("")}
</ul>
</div>`:""}

<div class="notice">
<strong>${esc(t("Antes de enviar","Before sending"))}</strong>
<p>${esc(commercialNotice())}</p>
<p>${esc(t(
"REMESAS no completa la transferencia. La operación se realiza directamente con el proveedor.",
"REMESAS does not complete the transfer. The transaction is performed directly with the provider."
))}</p>
</div>

${url?`
<button class="primary" type="button" onclick="openOfficial(${safeInlineString(url)})">
${esc(t("Abrir sitio oficial","Open official site"))}
</button>`:""}

<button class="secondary" type="button" onclick="renderComparisonFromSession()">
${esc(t("Ver otros proveedores","See other providers"))}
</button>

</section>`,
t("Revisión final","Final review"));
}

function safeInlineString(value){
return JSON.stringify(String(value||""))
.replace(/\\/g,"\\\\")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;");
}

function openOfficial(url){
if(!/^https:\/\//i.test(String(url||""))){
showError(t("El enlace oficial no es válido.","The official link is not valid."));
return;
}
window.open(url,"_blank","noopener,noreferrer");
}

function renderComparisonFromSession(){
const providers=APP.session?.available_providers||[];
renderComparison({
results:APP.session?.verified_results||[],
available_providers:providers,
provider_count:providers.length,
verified_count:(APP.session?.verified_results||[]).length,
results_available:(APP.session?.verified_results||[]).length>0,
amount:APP.session?.amount,
destination_country:APP.session?.destination_country,
explanation:t(
"Estas son las opciones de la sesión actual.",
"These are the options from the current session."
),
precautions:[]
});
}

function renderMoney(){
const m=getMoneyState();

renderShell(`
<section class="card">

<h1>${esc(t("Mi dinero","My money"))}</h1>

<p class="small">
${esc(t(
"Estos datos se guardan localmente en este dispositivo.",
"These data are stored locally on this device."
))}
</p>

<label>${esc(t("Ingreso","Income"))}</label>
<input id="income" type="number" min="0" step="0.01" value="${esc(m.income||"")}">

<label>${esc(t("Frecuencia del ingreso","Income frequency"))}</label>
<select id="incomeFreq">
<option value="weekly" ${m.incomeFreq==="weekly"?"selected":""}>${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly" ${m.incomeFreq==="biweekly"?"selected":""}>${esc(t("Quincenal","Biweekly"))}</option>
<option value="monthly" ${m.incomeFreq==="monthly"?"selected":""}>${esc(t("Mensual","Monthly"))}</option>
</select>

<label>${esc(t("Gastos esenciales","Essential expenses"))}</label>
<input id="essential" type="number" min="0" step="0.01" value="${esc(m.essential||"")}">

<label>${esc(t("Gastos flexibles","Flexible expenses"))}</label>
<input id="flexible" type="number" min="0" step="0.01" value="${esc(m.flexible||"")}">

<label>${esc(t("Ahorro reservado","Reserved savings"))}</label>
<input id="savings" type="number" min="0" step="0.01" value="${esc(m.savings||"")}">

<label>${esc(t("Remesas reservadas","Reserved remittance"))}</label>
<input id="remittance" type="number" min="0" step="0.01" value="${esc(m.remittance||"")}">

<button class="primary" type="button" onclick="calculateMoney()">
${esc(t("Calcular","Calculate"))}
</button>

<div id="moneyResult"></div>

</section>`,
t("Mi dinero","My money"));

if(Number(m.income||0)>0)showMoneyResult(m);
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

if(income>1000000||essential>1000000||flexible>1000000||savings>1000000||remittance>1000000){
showError(t("Uno de los valores supera el máximo permitido.","One of the values exceeds the allowed maximum."));
return;
}

const monthlyIncome=income*frequencyFactor(incomeFreq);
const available=monthlyIncome-essential-flexible-savings-remittance;

const data={
income,
incomeFreq,
monthlyIncome,
essential,
flexible,
savings,
remittance,
available,
reserved:0,
updatedAt:new Date().toISOString()
};

setJSON(APP.moneyKey,data);
showMoneyResult(data);
}

function showMoneyResult(data){
const box=document.getElementById("moneyResult");
if(!box)return;

const available=Number(data.available||0);

box.innerHTML=`
<div class="money-summary">
<span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span>
<strong>${money(data.monthlyIncome)}</strong>

<span>${esc(t("Disponible calculado","Calculated available"))}</span>
<strong>${money(available)}</strong>
</div>

<div class="status ${available>=0?"success":"warning"}">
${esc(
available>=0
?t("Tu cálculo queda por encima de cero.","Your calculation remains above zero.")
:t("Tus compromisos superan el ingreso calculado.","Your commitments exceed the calculated income.")
)}
</div>

<p class="small">
${esc(t(
"Este cálculo organiza los datos que introduces. No constituye asesoramiento financiero.",
"This calculation organizes the data you enter. It is not financial advice."
))}
</p>`;
}

function renderWeek(){
const m=getMoneyState();

if(!Number(m.income||0)){
renderMoney();
return;
}

const weeklyIncome=Number(m.monthlyIncome||0)/4.333333;
const weeklyEssential=Number(m.essential||0)/4.333333;
const weeklyFlexible=Number(m.flexible||0)/4.333333;
const weeklySavings=Number(m.savings||0)/4.333333;
const weeklyRemittance=Number(m.remittance||0)/4.333333;
const weeklyAvailable=
weeklyIncome-
weeklyEssential-
weeklyFlexible-
weeklySavings-
weeklyRemittance;

renderShell(`
<section class="card">
<h1>${esc(t("Mi semana","My week"))}</h1>

<div class="money-summary">
<span>${esc(t("Ingreso semanal equivalente","Equivalent weekly income"))}</span>
<strong>${money(weeklyIncome)}</strong>

<span>${esc(t("Compromisos semanales","Weekly commitments"))}</span>
<strong>${money(weeklyEssential+weeklyFlexible+weeklySavings+weeklyRemittance)}</strong>

<span>${esc(t("Disponible semanal","Weekly available"))}</span>
<strong>${money(weeklyAvailable)}</strong>
</div>

<div class="status ${weeklyAvailable>=0?"success":"warning"}">
${esc(
weeklyAvailable>=0
?t("Este cálculo usa períodos comparables.","This calculation uses comparable periods.")
:t("Revisa tus compromisos antes de aumentar el gasto o la remesa.","Review your commitments before increasing spending or the transfer.")
)}
</div>

<button class="primary" type="button" onclick="renderMoney()">
${esc(t("Modificar mi cálculo","Modify my calculation"))}
</button>

</section>`,
t("Mi semana","My week"));
}

function getExpenses(){
return getJSON(APP.expensesKey,[]);
}

function saveExpenses(list){
setJSON(APP.expensesKey,list);
}

function renderExpenses(){
const expenses=getExpenses();

renderShell(`
<section class="card">

<h1>${esc(t("Mis gastos","My expenses"))}</h1>

<p class="small">
${esc(t(
"Los gastos se guardan localmente en este dispositivo.",
"Expenses are stored locally on this device."
))}
</p>

<label>${esc(t("Descripción","Description"))}</label>
<input id="expenseName" maxlength="120">

<label>${esc(t("Monto","Amount"))}</label>
<input id="expenseAmount" type="number" min="0.01" max="1000000" step="0.01">

<label>${esc(t("Frecuencia","Frequency"))}</label>
<select id="expenseFrequency">
<option value="monthly">${esc(t("Mensual","Monthly"))}</option>
<option value="weekly">${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option>
<option value="one_time">${esc(t("Una vez","One time"))}</option>
</select>

<button class="primary" type="button" onclick="addExpense()">
${esc(t("Guardar gasto","Save expense"))}
</button>

<div id="expenseList">
${expenses.map(expenseRow).join("")}
</div>

<button class="secondary" type="button" onclick="renderMoney()">
${esc(t("Actualizar Mi dinero","Update My money"))}
</button>

</section>`,
t("Mis gastos","My expenses"));
}

function expenseRow(item,index){
return `
<div class="expense-row">
<div>
<strong>${esc(item.description)}</strong>
<small>${esc(frequencyLabel(item.frequency||"monthly"))}</small>
</div>
<strong>${money(item.amount)}</strong>
<button type="button" class="danger-button" onclick="removeExpense(${Number(index)})">×</button>
</div>`;
}

function addExpense(){
const description=(document.getElementById("expenseName")?.value||"").trim();
const amount=Number(document.getElementById("expenseAmount")?.value||0);
const frequency=document.getElementById("expenseFrequency")?.value||"monthly";

if(!description){
showError(t("Escribe una descripción.","Enter a description."));
return;
}

if(!amount||amount<=0||amount>1000000){
showError(t("Indica un monto válido.","Enter a valid amount."));
return;
}

const expenses=getExpenses();

expenses.push({
description,
amount,
frequency,
createdAt:new Date().toISOString()
});

saveExpenses(expenses);
renderExpenses();
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

<p class="small">
${esc(t(
"Esta información es solo una referencia local para preparar una remesa.",
"This information is only a local reference for preparing a transfer."
))}
</p>

<label>${esc(t("Nombre o apodo","Name or nickname"))}</label>
<input id="familyName" maxlength="80" value="${esc(data.name)}">

<label>${esc(t("País","Country"))}</label>
<select id="familyCountry">
<option value="">${esc(t("Selecciona","Select"))}</option>
${(APP.config?.countries||[]).map(c=>`
<option value="${esc(c.code)}" ${c.code===data.country?"selected":""}>
${esc(c.name?.[APP.lang]||c.name?.es||c.code)}
</option>`).join("")}
</select>

<label>${esc(t("Monto de referencia","Reference amount"))}</label>
<input id="familyAmount" type="number" min="0" max="1000000" step="0.01" value="${esc(data.amount)}">

<button class="primary" type="button" onclick="saveFamily()">
${esc(t("Guardar en este dispositivo","Save on this device"))}
</button>

</section>`,
t("Familia","Family"));
}

function saveFamily(){
const name=(document.getElementById("familyName")?.value||"").trim();
const country=document.getElementById("familyCountry")?.value||"";
const amount=Math.max(0,Number(document.getElementById("familyAmount")?.value||0));

if(amount>1000000){
showError(t("El monto supera el máximo permitido.","The amount exceeds the allowed maximum."));
return;
}

const data={name,country,amount};

setJSON(APP.familyKey,data);

renderShell(`
<section class="card">
<div class="status success">${esc(t("Guardado","Saved"))}</div>
<h1>${esc(data.name||t("Referencia familiar","Family reference"))}</h1>
<p>${esc(data.country?countryName(data.country):t("Sin país seleccionado","No country selected"))}</p>
<strong>${data.amount?money(data.amount):"—"}</strong>

<button class="primary" type="button" onclick="renderFamily()">
${esc(t("Editar","Edit"))}
</button>
</section>`,
t("Familia","Family"));
}

function renderSavings(){
const m=getMoneyState();
const current=Number(m.savings||0);
const purpose=m.savingsPurpose||"";

renderShell(`
<section class="card">

<h1>${esc(t("Ahorrar","Save"))}</h1>

<label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label>
<input id="saveAmount" type="number" min="0" max="1000000" step="0.01" value="${esc(current||"")}">

<label>${esc(t("¿Para qué?","What for?"))}</label>
<input id="savePurpose" maxlength="100" value="${esc(purpose)}" placeholder="${esc(t("Ejemplo: emergencia","Example: emergency"))}">

<button class="primary" type="button" onclick="saveSavings()">
${esc(t("Guardar objetivo","Save goal"))}
</button>

</section>`,
t("Ahorrar","Save"));
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

renderShell(`
<section class="card">
<div class="status success">${esc(t("Objetivo guardado","Goal saved"))}</div>
<h1>${money(amount)}</h1>
<p>${esc(purpose||t("Ahorro general","General savings"))}</p>

<button class="primary" type="button" onclick="renderMoney()">
${esc(t("Ver Mi dinero","View My money"))}
</button>
</section>`,
t("Ahorrar","Save"));
}

function renderPurchase(){
renderShell(`
<section class="card">

<h1>${esc(t("Planear una compra","Plan a purchase"))}</h1>

<label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label>
<input id="purchaseName" maxlength="120" placeholder="${esc(t("Ejemplo: teléfono","Example: phone"))}">

<label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label>
<input id="purchaseAmount" type="number" min="0.01" max="1000000" step="0.01">

<button class="primary" type="button" onclick="checkPurchase()">
${esc(t("Comprobar","Check"))}
</button>

</section>`,
t("Planear una compra","Plan a purchase"));
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

const m=getMoneyState();
const available=Number(m.available||0);
const difference=available-amount;

renderShell(`
<section class="card">

<div class="status ${difference>=0?"success":"warning"}">
${esc(
difference>=0
?t("Cabe en tu cálculo actual","Fits your current calculation")
:t("Supera tu disponible actual","Exceeds your current available amount")
)}
</div>

<h1>${esc(name)}</h1>

<div class="money-summary">
<span>${esc(t("Precio","Price"))}</span>
<strong>${money(amount)}</strong>

<span>${esc(t("Disponible","Available"))}</span>
<strong>${money(available)}</strong>

<span>${esc(t("Después de comprar","After purchase"))}</span>
<strong>${money(difference)}</strong>
</div>

<p class="small">
${esc(t(
"Este resultado es un cálculo basado en los datos que introdujiste.",
"This result is a calculation based on the data you entered."
))}
</p>

<button class="primary" type="button" onclick="renderMoney()">
${esc(t("Revisar mi dinero","Review my money"))}
</button>

</section>`,
t("Resultado","Result"));
}

function renderHelp(){
const topics=APP.config?.help_topics||[];

renderShell(`
<section class="card">

<h1>${esc(t("¿Qué no entiendes?","What don't you understand?"))}</h1>

<div class="help-list">
${topics.map(topic=>`
<button class="help-item" type="button" onclick="showHelpTopic(${safeInlineString(topic.id)})">
<strong>${esc(topic.title?.[APP.lang]||topic.title?.es||topic.title||"")}</strong>
</button>`).join("")}
</div>

<button class="secondary" type="button" onclick="renderHome()">
${esc(t("Volver","Back"))}
</button>

</section>`,
t("Ayuda","Help"));
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

<button class="primary" type="button" onclick="renderHelp()">
${esc(t("Ver más ayuda","More help"))}
</button>

</section>`,
title);
}

function renderPrivacy(){
renderShell(`
<section class="card">

<h1>${esc(t("Privacidad y datos","Privacy and data"))}</h1>

<h2>${esc(t("Datos locales","Local data"))}</h2>
<p>${esc(t(
"Los datos de Mi dinero, Mis gastos, Familia, ahorro y preferencias se guardan en el almacenamiento local de este dispositivo.",
"Data from My money, My expenses, Family, savings, and preferences is stored in this device's local storage."
))}</p>

<h2>${esc(t("Sesión de remesa","Remittance session"))}</h2>
<p>${esc(t(
"Para preparar una remesa, algunos datos introducidos por ti pueden procesarse temporalmente en el servidor. La aplicación no necesita tus contraseñas bancarias ni credenciales del proveedor.",
"To prepare a remittance, some information you enter may be processed temporarily on the server. The application does not need your banking passwords or provider credentials."
))}</p>

<h2>${esc(t("No introduzcas","Do not enter"))}</h2>
<ul>
<li>${esc(t("Contraseñas bancarias","Bank passwords"))}</li>
<li>${esc(t("PIN o códigos de seguridad","PINs or security codes"))}</li>
<li>${esc(t("CVV o códigos de tarjeta","CVV or card security codes"))}</li>
<li>${esc(t("Credenciales de proveedores","Provider credentials"))}</li>
</ul>

<h2>${esc(t("Borrado","Deletion"))}</h2>
<p>${esc(t(
"Puedes borrar los datos guardados localmente desde este dispositivo.",
"You can delete data stored locally on this device."
))}</p>

<button class="primary" type="button" onclick="deleteLocalData()">
${esc(t("Borrar mis datos de este dispositivo","Delete my data from this device"))}
</button>

<button class="secondary" type="button" onclick="renderHome()">
${esc(t("Volver","Back"))}
</button>

</section>`,
t("Privacidad","Privacy"));
}

function showError(message){
const existing=document.querySelector(".error-box");
if(existing)existing.remove();

const box=document.createElement("div");
box.className="error-box";
box.setAttribute("role","alert");

box.innerHTML=`
<strong>${esc(t("Atención","Attention"))}</strong>
<span>${esc(message)}</span>
<button type="button" onclick="this.parentElement.remove()">×</button>`;

document.body.appendChild(box);

setTimeout(()=>{
if(box.parentElement)box.remove();
},7000);
}

async function deleteLocalData(){
const confirmed=window.confirm(
t(
"¿Borrar los datos guardados en este dispositivo?",
"Delete the data saved on this device?"
)
);

if(!confirmed)return;

[
APP.moneyKey,
APP.expensesKey,
APP.familyKey,
APP.prefsKey,
"remesas_lang_v4"
].forEach(key=>localStorage.removeItem(key));

if(APP.session?.session_id){
try{
await api(
`/api/session/${encodeURIComponent(APP.session.session_id)}?language=${encodeURIComponent(APP.lang)}`,
{method:"DELETE"}
);
}catch{}
}

APP.session=null;
APP.config=null;
location.reload();
}

function renderSubscription(){
const price=APP.config?.subscription?.price??15.99;
const currency=APP.config?.subscription?.currency||"USD";
const period=APP.config?.subscription?.period||"1_month";

renderShell(`
<section class="card">

<h1>${esc(t("REMESAS PRO","REMESAS PRO"))}</h1>

<div class="money-summary">
<span>${esc(t("Precio","Price"))}</span>
<strong>${esc(currency)} ${Number(price).toFixed(2)}</strong>

<span>${esc(t("Periodo","Period"))}</span>
<strong>${esc(period==="1_month"?t("Mensual","Monthly"):period)}</strong>
</div>

<p>
${esc(t(
"Suscripción para utilizar las funciones de REMESAS. La transferencia de dinero se realiza directamente con el proveedor que el usuario elija.",
"Subscription for using REMESAS features. The money transfer is performed directly with the provider chosen by the user."
))}
</p>

<div class="notice">
<strong>${esc(t("Renovación","Renewal"))}</strong>
<p>${esc(t(
"La suscripción puede renovarse automáticamente según las condiciones mostradas durante el pago.",
"The subscription may renew automatically according to the terms shown during checkout."
))}</p>
</div>

<button class="primary" type="button" onclick="createCheckout()">
${esc(t("Continuar al pago","Continue to checkout"))}
</button>

<button class="secondary" type="button" onclick="renderHome()">
${esc(t("Volver","Back"))}
</button>

</section>`,
t("Suscripción","Subscription"));
}

async function createCheckout(){
try{
const data=await api("/api/create-checkout-session",{
method:"POST",
body:JSON.stringify({
language:APP.lang
})
});

if(data.url){
window.location.href=data.url;
return;
}

if(data.checkout_url){
window.location.href=data.checkout_url;
return;
}

showError(t(
"No se recibió un enlace de pago válido.",
"No valid checkout link was returned."
));
}catch(error){
showError(error.message);
}
}

function renderPaymentResult(){
const params=new URLSearchParams(window.location.search);
const payment=params.get("payment");
const checkoutId=params.get("session_id");

if(payment==="success"&&checkoutId){
checkPayment(checkoutId);
return true;
}

if(payment==="cancel"){
renderShell(`
<section class="card">
<div class="status warning">${esc(t("Pago cancelado","Payment canceled"))}</div>
<h1>${esc(t("No se realizó el pago","No payment was completed"))}</h1>
<p>${esc(t("Puedes volver a REMESAS cuando quieras.","You can return to REMESAS whenever you want."))}</p>
<button class="primary" type="button" onclick="clearPaymentQuery();renderHome()">
${esc(t("Continuar","Continue"))}
</button>
</section>`,
t("Pago","Payment"));
return true;
}

return false;
}

function clearPaymentQuery(){
try{
window.history.replaceState({},document.title,window.location.pathname);
}catch{}
}

async function checkPayment(checkoutId){
renderShell(`
<section class="card">
<div class="status">${esc(t("Comprobando pago...","Checking payment..."))}</div>
<h1>${esc(t("Un momento","One moment"))}</h1>
<p>${esc(t("Estamos verificando el estado de la sesión de pago.","We are checking the payment session status."))}</p>
</section>`,
t("Pago","Payment"));

try{
const data=await api(
`/api/payment/check?session_id=${encodeURIComponent(checkoutId)}`
);

const active=Boolean(
data.active||
data.status==="active"||
data.subscription_status==="active"||
data.subscription_status==="trialing"
);

renderShell(`
<section class="card">

<div class="status ${active?"success":"warning"}">
${esc(
active
?t("Pago confirmado","Payment confirmed")
:t("Pago pendiente o no activo","Payment pending or not active")
)}
</div>

<h1>${esc(
active
?t("REMESAS está listo","REMESAS is ready")
:t("Revisa el estado del pago","Check payment status")
)}</h1>

<p>${esc(
active
?t("La suscripción aparece activa según la información recibida.","The subscription appears active according to the information received.")
:t("Si acabas de pagar, puede ser necesario esperar unos momentos y volver a comprobarlo.","If you just paid, you may need to wait a moment and check again.")
)}</p>

<button class="primary" type="button" onclick="clearPaymentQuery();renderHome()">
${esc(t("Entrar a REMESAS","Enter REMESAS"))}
</button>

</section>`,
t("Estado del pago","Payment status"));

}catch(error){
renderShell(`
<section class="card">

<div class="status warning">${esc(t("No se pudo verificar","Could not verify"))}</div>

<h1>${esc(t("Estado del pago","Payment status"))}</h1>

<p>${esc(error.message)}</p>

<button class="primary" type="button" onclick="clearPaymentQuery();renderHome()">
${esc(t("Continuar","Continue"))}
</button>

</section>`,
t("Pago","Payment"));
}
}

window.renderHome=renderHome;
window.renderRemittance=renderRemittance;
window.renderMoney=renderMoney;
window.renderWeek=renderWeek;
window.renderExpenses=renderExpenses;
window.renderFamily=renderFamily;
window.renderHelp=renderHelp;
window.renderPurchase=renderPurchase;
window.renderSavings=renderSavings;
window.renderPrivacy=renderPrivacy;
window.renderSubscription=renderSubscription;
window.changeLanguage=changeLanguage;
window.understandNeed=understandNeed;
window.beginParsedRemittance=beginParsedRemittance;
window.compare=compare;
window.selectProvider=selectProvider;
window.renderFinalCheck=renderFinalCheck;
window.renderComparisonFromSession=renderComparisonFromSession;
window.openOfficial=openOfficial;
window.calculateMoney=calculateMoney;
window.addExpense=addExpense;
window.removeExpense=removeExpense;
window.saveFamily=saveFamily;
window.saveSavings=saveSavings;
window.checkPurchase=checkPurchase;
window.showHelpTopic=showHelpTopic;
window.deleteLocalData=deleteLocalData;
window.updateMoneyWarning=updateMoneyWarning;
window.createCheckout=createCheckout;
window.checkPayment=checkPayment;
window.clearPaymentQuery=clearPaymentQuery;

document.addEventListener("DOMContentLoaded",async()=>{
try{
await loadConfig();
await startSession(true);

if(renderPaymentResult())return;

renderHome();
}catch(error){
app.innerHTML=`
<main class="page">
<section class="card">
<div class="status warning">
${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}
</div>
<p>${esc(error.message)}</p>
<button class="primary" type="button" onclick="location.reload()">
${esc(t("Reintentar","Retry"))}
</button>
</section>
</main>`;
}
});

