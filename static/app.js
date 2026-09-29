"use strict";

const APP={config:null,sessionId:null,language:localStorage.getItem("remesas_language")||"es",amount:"",destination:localStorage.getItem("remesas_destination")||"",priority:"",delivery:"",payment:"",frequency:"",freeText:"",comparison:null,selectedProvider:null};

const TEXT={
es:{
loading:"Estoy revisando las opciones para ti.",
title:"REMESAS",
subtitle:"Te ayudamos a entender y preparar tus envíos de dinero sin palabras complicadas.",
question:"¿QUÉ NECESITAS HOY?",
purpose:"¿Para qué sirve REMESAS?",
purposeText:"REMESAS te ayuda a entender, preparar y revisar un envío de dinero. Si sabemos la respuesta, te la explicamos. Si no podemos comprobarla, no la inventamos: te llevamos a la información oficial correcta.",
amount:"¿Cuánto quieres enviar?",
amountPlaceholder:"Ejemplo: 200",
destination:"¿A qué país quieres enviar?",
destinationPlaceholder:"Elige un país",
priority:"¿Qué es más importante para ti?",
fastest:"QUE LLEGUE RÁPIDO",
save:"GASTAR MENOS",
receiveMore:"QUE RECIBA MÁS",
urgent:"LO NECESITO PRONTO",
balanced:"UN POCO DE TODO",
compare:"QUIERO VER LAS OPCIONES",
other:"NO SÉ / OTRA COSA",
freeText:"Cuéntame con tus palabras",
freeTextPlaceholder:"Ejemplo: Quiero mandar 200 dólares a México rápido.",
continue:"CONTINUAR",
back:"ATRÁS",
clear:"BORRAR TODO Y EMPEZAR DE NUEVO",
help:"NO SÉ QUÉ HACER",
options:"Vamos a ayudarte",
verified:"Información comprobada",
available:"Opciones para tu caso",
fee:"Costo del envío",
rate:"Cambio de moneda",
receive:"La otra persona recibe",
delivery:"Cómo puede recibirlo",
method:"Cómo puedes pagar",
official:"VER INFORMACIÓN OFICIAL",
review:"ANTES DE CONTINUAR",
country:"País",
sendAmount:"Tú envías",
receiveAmount:"La otra persona recibe",
payment:"Forma de pago",
check:"REVISAR ESTA OPCIÓN",
selected:"Esta opción",
finalText:"Primero revisamos lo que entendimos. Después la remesadora te mostrará las condiciones finales antes de enviar.",
yes:"CONTINUAR CON ESTA OPCIÓN",
no:"VOLVER A LAS OPCIONES",
noResults:"No tengo una cotización comprobada ahora mismo.",
tryAgain:"No voy a inventar un precio, una tasa ni un tiempo. Puedes consultar directamente la información oficial de la remesadora.",
helpTitle:"No pasa nada. Te ayudamos.",
helpText:"No tienes que saber qué remesadora usar ni conocer palabras difíciles. Cuéntame qué quieres hacer y vamos paso a paso.",
close:"CERRAR",
language:"EN",
commercialUnavailable:"Este dato no está comprobado ahora",
error:"No pudimos completar esto.",
countryRequired:"Elige un país.",
amountRequired:"Dime cuánto quieres enviar.",
saved:"Se usa solo en este dispositivo.",
nothing:"No disponible",
meaning:"¿Qué significa?",
online:"Puedes hacerlo por internet",
agent:"Puedes recibir ayuda en persona",
paymentWays:"Puedes pagar de estas formas",
receiveWays:"La persona puede recibirlo de estas formas",
officialHelp:"VER LA AYUDA OFICIAL",
start:"COMENZAR",
why:"REMESAS hace el trabajo difícil por ti.",
clearTitle:"¿Borrar todo?",
clearText:"Vamos a borrar lo que esta aplicación tiene guardado en este dispositivo y comenzaremos desde cero.",
clearYes:"SÍ, BORRAR TODO",
clearNo:"NO, VOLVER",
cleared:"Listo. Empezamos de cero.",
noGuess:"No queremos darte una respuesta equivocada.",
goOfficial:"IR A LA INFORMACIÓN OFICIAL",
whatWeDo:"Aquí no tienes que investigar.",
whatWeDoText:"Dinos qué quieres hacer. Nosotros te explicamos lo importante y te decimos cuál es el siguiente paso.",
verifiedDate:"Comprobado el",
source:"Fuente oficial",
notVerified:"No comprobado ahora",
reviewHelp:"REMESAS no puede comprobar este dato ahora. Te llevamos directamente a la información oficial.",
sendOfficial:"Puedes continuar el envío en la página oficial.",
specificHelp:"Información oficial sobre"
},
en:{
loading:"I am checking the options for you.",
title:"REMITTANCES",
subtitle:"We help you understand and prepare your money transfers without complicated words.",
question:"WHAT DO YOU NEED TODAY?",
purpose:"What is REMESAS for?",
purposeText:"REMESAS helps you understand, prepare and review a money transfer. If we know the answer, we explain it. If we cannot verify it, we do not guess: we take you to the correct official information.",
amount:"How much do you want to send?",
amountPlaceholder:"Example: 200",
destination:"Which country are you sending to?",
destinationPlaceholder:"Choose a country",
priority:"What matters most to you?",
fastest:"GET THERE FAST",
save:"SPEND LESS",
receiveMore:"RECIPIENT GETS MORE",
urgent:"I NEED IT SOON",
balanced:"A LITTLE OF EVERYTHING",
compare:"SHOW ME THE OPTIONS",
other:"I DON'T KNOW / SOMETHING ELSE",
freeText:"Tell me in your own words",
freeTextPlaceholder:"Example: I want to send 200 dollars to Mexico fast.",
continue:"CONTINUE",
back:"BACK",
clear:"DELETE EVERYTHING AND START OVER",
help:"I DON'T KNOW WHAT TO DO",
options:"Let's help you",
verified:"Verified information",
available:"Options for your situation",
fee:"Transfer cost",
rate:"Currency exchange",
receive:"The other person receives",
delivery:"How the money can be received",
method:"How you can pay",
official:"VIEW OFFICIAL INFORMATION",
review:"BEFORE CONTINUING",
country:"Country",
sendAmount:"You send",
receiveAmount:"The other person receives",
payment:"Payment method",
check:"REVIEW THIS OPTION",
selected:"This option",
finalText:"First we review what we understood. Then the provider will show you the final conditions before you send.",
yes:"CONTINUE WITH THIS OPTION",
no:"BACK TO OPTIONS",
noResults:"I do not have a verified quote right now.",
tryAgain:"I will not guess a price, rate or delivery time. You can go directly to the provider's official information.",
helpTitle:"That's okay. We'll help.",
helpText:"You do not need to know which provider to use or know difficult words. Tell me what you want to do and we will go step by step.",
close:"CLOSE",
language:"ES",
commercialUnavailable:"This information is not verified right now",
error:"We could not complete this.",
countryRequired:"Choose a country.",
amountRequired:"Tell me how much you want to send.",
saved:"Used only on this device.",
nothing:"Not available",
meaning:"What does this mean?",
online:"You can do this online",
agent:"You can get help in person",
paymentWays:"You can pay in these ways",
receiveWays:"The person can receive it in these ways",
officialHelp:"VIEW OFFICIAL HELP",
start:"START",
why:"REMESAS does the difficult work for you.",
clearTitle:"Delete everything?",
clearText:"We will delete what this app has saved on this device and start from zero.",
clearYes:"YES, DELETE EVERYTHING",
clearNo:"NO, GO BACK",
cleared:"Done. We are starting from zero.",
noGuess:"We do not want to give you a wrong answer.",
goOfficial:"GO TO OFFICIAL INFORMATION",
whatWeDo:"You do not have to investigate here.",
whatWeDoText:"Tell us what you want to do. We explain what matters and tell you the next step.",
verifiedDate:"Checked on",
source:"Official source",
notVerified:"Not verified now",
reviewHelp:"REMESAS cannot verify this information right now. We will take you directly to the official information.",
sendOfficial:"You can continue the transfer on the official website.",
specificHelp:"Official information about"
}};

function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function money(v,currency="USD"){
if(v===null||v===undefined||v==="")return t("nothing");
const n=Number(v);
if(!Number.isFinite(n))return esc(v);
try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:currency||"USD",maximumFractionDigits:2}).format(n)}
catch(e){return`${n.toFixed(2)} ${currency}`}
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
if(APP.destination)localStorage.setItem("remesas_destination",APP.destination)
}
function priorityId(p){return typeof p==="string"?p:p?.id||""}
function priorityLabel(p){
if(typeof p==="string"){
const map={fastest:"fastest",save:"save",recipient_gets_more:"receiveMore",urgent:"urgent",balanced:"balanced",compare_all:"compare"};
return t(map[p]||p)
}
return p?.label||p?.name||p?.id||""
}
function countryName(code){
const list=APP.config?.countries||[];
const x=list.find(c=>(typeof c==="string"?c:c?.id||c?.code)===code);
return x?(typeof x==="string"?x:x.name||x.country||code):code||""
}
function renderHeader(){
return`<header class="topbar"><div class="brand"><div class="brand-mark">R</div><div><strong>${esc(t("title"))}</strong><span>May Roga LLC</span></div></div><button class="language-btn" id="languageBtn">${esc(t("language"))}</button></header>`
}
function bindLanguage(render){
document.getElementById("languageBtn")?.addEventListener("click",async()=>{
APP.language=APP.language==="es"?"en":"es";
saveLocal();
try{await loadConfig()}catch(e){}
render()
})
}
function renderHome(){
const app=document.getElementById("app"),opening=APP.config?.opening||{},countries=APP.config?.countries||[],priorities=opening.priorities||[];
const fallback=["fastest","save","recipient_gets_more","urgent","balanced","compare_all"];
const ps=(priorities.length?priorities:fallback).map(p=>{
const id=priorityId(p);
return`<button class="priority-btn ${APP.priority===id?"active":""}" data-priority="${esc(id)}">${esc(priorityLabel(p))}</button>`
}).join("");
let options=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
countries.forEach(c=>{
const id=typeof c==="string"?c:c.id||c.code||"";
const name=typeof c==="string"?c:c.name||c.country||id;
options+=`<option value="${esc(id)}" ${APP.destination===id?"selected":""}>${esc(name)}</option>`
});
app.innerHTML=`${renderHeader()}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("title"))}</div><h1>${esc(opening.primary_question||t("question"))}</h1><p>${esc(opening.secondary_text||t("subtitle"))}</p></section><section class="main-card"><div class="success-box"><strong>${esc(t("whatWeDo"))}</strong><p>${esc(t("whatWeDoText"))}</p></div><div class="field"><label>${esc(t("amount"))}</label><div class="amount-wrap"><span>$</span><input id="amountInput" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="${esc(opening.amount?.placeholder||t("amountPlaceholder"))}" value="${esc(APP.amount)}"></div></div><div class="field"><label>${esc(t("destination"))}</label><select id="destinationInput">${options}</select></div><div class="field"><label>${esc(t("priority"))}</label><div class="priority-grid">${ps}</div></div><button class="help-link" id="helpBtn">?</button><button class="primary-btn" id="continueBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="freeTextBtn">${esc(t("other"))}</button><div id="freeTextArea" class="free-text-area hidden"><label>${esc(t("freeText"))}</label><textarea id="freeTextInput" rows="3" placeholder="${esc(opening.free_text?.placeholder||t("freeTextPlaceholder"))}">${esc(APP.freeText)}</textarea><button class="primary-btn" id="freeTextContinue">${esc(t("continue"))}</button></div></section><section class="main-card" style="margin-top:16px"><h2>${esc(t("purpose"))}</h2><p>${esc(t("purposeText"))}</p></section><footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer></main><div id="modal"></div>`;
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
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
bindLanguage(renderHome)
}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.language)}`)}
async function createSession(){
try{
const d=await api(`/api/session`,{method:"POST",body:JSON.stringify({language:APP.language})});
APP.sessionId=d?.session?.session_id||d?.session_id||null;
return APP.sessionId
}catch(e){APP.sessionId=null;return null}
}
async function ensureSession(){
if(!APP.sessionId)await createSession();
return APP.sessionId
}
function renderLoading(){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="loading-card"><div class="loader large"></div><h2>${esc(t("options"))}</h2><p>${esc(t("loading"))}</p></section></main>`;
bindLanguage(renderLoading)
}
function collectNeed(){
return{language:APP.language,need_type:"remittance",amount:Number(APP.amount),send_currency:"USD",destination_country:APP.destination,priority:APP.priority||"balanced",urgency:APP.priority==="urgent",frequency:APP.frequency||null,delivery_method:APP.delivery||null,payment_method:APP.payment||null,special_need:APP.freeText||null,free_text:APP.freeText||null}
}
function validateBasic(){
const amount=Number(APP.amount);
if(!amount||amount<=0){showInlineMessage(t("amountRequired"));document.getElementById("amountInput")?.focus();return false}
if(!APP.destination){showInlineMessage(t("countryRequired"));document.getElementById("destinationInput")?.focus();return false}
return true
}
function showInlineMessage(message){
const old=document.getElementById("inlineMessage");
if(old)old.remove();
const card=document.querySelector(".main-card");
if(card){
const div=document.createElement("div");
div.id="inlineMessage";
div.className="error-box";
div.textContent=message;
card.prepend(div)
}
}
async function startComparison(){
APP.amount=document.getElementById("amountInput")?.value||APP.amount;
APP.destination=document.getElementById("destinationInput")?.value||APP.destination;
if(!validateBasic())return;
if(!APP.priority)APP.priority="balanced";
saveLocal();
renderLoading();
try{
await ensureSession();
await api(`/api/session/${encodeURIComponent(APP.sessionId)}/need`,{method:"POST",body:JSON.stringify(collectNeed())});
APP.comparison=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/compare`,{method:"POST",body:"{}"});
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
const response=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/need/parse`,{method:"POST",body:JSON.stringify({text,language:APP.language})});
const parsed=response?.parsed||{};
if(parsed.amount)APP.amount=parsed.amount;
if(parsed.destination_country)APP.destination=parsed.destination_country;
if(parsed.priority)APP.priority=parsed.priority;
if(parsed.urgency)APP.priority="urgent";
if(parsed.frequency)APP.frequency=parsed.frequency;
if(!APP.amount||!APP.destination){renderNeedMissing();return}
await startComparison()
}catch(e){renderError(e.message)}
}
function renderNeedMissing(){
const missing=[];
if(!APP.amount)missing.push(t("amount"));
if(!APP.destination)missing.push(t("destination"));
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="main-card"><div class="hero-badge">● ${esc(t("helpTitle"))}</div><h1>${esc(t("question"))}</h1><p>${esc(t("helpText"))}</p><div class="missing-box">${missing.map(x=>`<div>• ${esc(x)}</div>`).join("")}</div><button class="primary-btn" id="completeBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="backBtn">${esc(t("back"))}</button></section></main>`;
document.getElementById("completeBtn")?.addEventListener("click",renderHome);
document.getElementById("backBtn")?.addEventListener("click",renderHome);
bindLanguage(renderNeedMissing)
}
function resultId(r){return r?.provider_id||r?.id||""}
function getResults(){
const data=APP.comparison||{},verified=Array.isArray(data.results)?data.results:[],available=Array.isArray(data.available_providers)?data.available_providers:[],merged=[],seen=new Set();
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
const data=APP.comparison||{},results=getResults(),verified=(data.results||[]).length>0;
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(verified?t("verified"):t("available"))}</div><h1>${esc(t("options"))}</h1><p>${esc(money(APP.amount)+" → "+countryName(APP.destination))}</p></div></section><div class="success-box"><strong>${esc(data.message||t("whatWeDo"))}</strong><p>${esc(data.explanation||t("whatWeDoText"))}</p></div><section class="results-list">${results.length?results.map(renderResultCard).join(""):`<div class="empty-card"><div class="empty-icon">?</div><h2>${esc(t("noResults"))}</h2><p>${esc(t("tryAgain"))}</p></div>`}</section>${renderSimpleDifferences(data.differences||[])}<footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderHome);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{
const p=results.find(x=>resultId(x)===b.dataset.provider);
if(p)renderFinalCheck(p)
}));
bindLanguage(renderResults)
}
function renderSimpleDifferences(items){
if(!Array.isArray(items)||!items.length)return"";
return`<section class="main-card" style="margin-top:18px"><h2>${esc(t("options"))}</h2>${items.map(x=>`<div class="review-row"><div><strong>${esc(x.title||"")}</strong><p>${esc(x.text||"")}</p></div></div>`).join("")}</section>`
}
function renderResultCard(r,i){
const id=resultId(r),name=r.provider_name||id,verified=r.commercial_verified===true||r.commercial_status==="verified";
const fee=verified?resultValue(r,"fee"):null;
const rate=verified?resultValue(r,"exchange_rate"):null;
const recipient=verified?resultValue(r,"recipient_amount"):null;
const delivery=verified?(resultValue(r,"delivery_time")??resultValue(r,"estimated_delivery")):null;
const method=verified?resultValue(r,"delivery_method"):null;
const currency=resultValue(r,"currency")||resultValue(r,"recipient_currency")||"USD";
const payment=verified?resultValue(r,"payment_method"):null;
const receiveOptions=Array.isArray(r.delivery_options)?r.delivery_options:[];
const paymentOptions=Array.isArray(r.payment_options)?r.payment_options:[];
const urls=r.help_urls||{};
return`<article class="provider-card"><div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div><span class="verified-pill">${verified?"✓ "+esc(t("verified")):esc(t("notVerified"))}</span></div><div class="provider-main"><div class="receive-box"><span>${esc(t("receive"))}</span><strong>${recipient!==null?money(recipient,currency):t("nothing")}</strong></div><div class="details-grid"><div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee,"USD"):t("commercialUnavailable")}</strong></div><div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):t("commercialUnavailable")}</strong></div><div><span>${esc(t("delivery"))}</span><strong>${delivery!==null?esc(delivery):t("commercialUnavailable")}</strong></div><div><span>${esc(t("method"))}</span><strong>${method?esc(method):t("commercialUnavailable")}</strong></div></div>${payment?`<div class="success-box"><strong>${esc(t("method"))}</strong><p>${esc(payment)}</p></div>`:""}${receiveOptions.length?`<div class="success-box"><strong>${esc(t("receiveWays"))}</strong><p>${receiveOptions.map(esc).join(" · ")}</p></div>`:""}${paymentOptions.length?`<div class="success-box"><strong>${esc(t("paymentWays"))}</strong><p>${paymentOptions.map(esc).join(" · ")}</p></div>`:""}</div><div class="provider-foot"><small>${verified?esc(t("verified")):esc(t("reviewHelp"))}</small>${urls.general?`<a href="${esc(urls.general)}" target="_blank" rel="noopener noreferrer">${esc(t("officialHelp"))}</a>`:""}</div><button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(t("check"))}</button></article>`
}
function reviewTopic(provider){
const data=APP.comparison||{};
if(!provider)return"general";
if(provider.commercial_verified===true||provider.commercial_status==="verified")return"send";
const need=String(data.need_type||"").toLowerCase();
if(need==="fees"||need==="fee")return"fee";
if(need==="exchange_rate"||need==="rate")return"rate";
if(need==="delivery")return"delivery";
if(need==="requirements")return"requirements";
if(need==="recipient_information")return"recipient";
if(need==="mistake_prevention")return"mistake";
if(need==="cancellation")return"cancel";
if(need==="security")return"security";
return"general"
}
function renderFinalCheck(provider){
const id=resultId(provider);
const verified=provider.commercial_verified===true||provider.commercial_status==="verified";
if(!verified){
renderProviderHelp(provider,reviewTopic(provider));
return
}
const delivery=provider.delivery_method||provider.delivery_options?.[0]||"";
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(provider.provider_name||id)}</h1><p>${esc(t("finalText"))}</p></div></section><section class="review-card"><h2>${esc(t("review"))}</h2><div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div><div class="review-row"><span>${esc(t("sendAmount"))}</span><strong>${money(APP.amount,"USD")}</strong></div><div class="review-row"><span>${esc(t("fee"))}</span><strong>${provider.fee!=null?money(provider.fee,"USD"):t("commercialUnavailable")}</strong></div><div class="review-row"><span>${esc(t("rate"))}</span><strong>${provider.exchange_rate!=null?esc(provider.exchange_rate):t("commercialUnavailable")}</strong></div><div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${provider.recipient_amount!=null?money(provider.recipient_amount,provider.currency||provider.recipient_currency||"USD"):t("commercialUnavailable")}</strong></div><div class="review-row"><span>${esc(t("delivery"))}</span><strong>${esc(delivery||t("commercialUnavailable"))}</strong></div><div class="review-actions"><button class="secondary-btn" id="backResults">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div><div id="finalStatus"></div></section><footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderResults);
document.getElementById("backResults")?.addEventListener("click",renderResults);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(provider,id));
bindLanguage(()=>renderFinalCheck(provider))
}
async function performFinalCheck(provider,id){
const status=document.getElementById("finalStatus");
if(!status)return;
status.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
try{
await ensureSession();
const result=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/final-check`,{method:"POST",body:JSON.stringify({
language:APP.language,
provider_id:id,
amount:Number(APP.amount),
send_currency:"USD",
destination_country:APP.destination,
delivery_method:provider.delivery_method||provider.delivery_options?.[0]||null,
payment_method:provider.payment_method||provider.payment_options?.[0]||null,
recipient_amount:provider.recipient_amount??null,
fee:provider.fee??null,
exchange_rate:provider.exchange_rate??null
})});
const ready=result?.ready_to_continue!==false;
const url=provider.continue_url||provider.send_url||provider.official_site;
status.innerHTML=`<div class="${ready?"success-box":"error-box"}"><strong>${ready?"✓ ":""}${esc(ready?t("verified"):t("tryAgain"))}</strong><p>${esc(result?.message||t("finalText"))}</p>${ready&&url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("goOfficial"))}</a>`:""}</div>`
}catch(e){status.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`}
}
function topicTitle(topic){
const map={
fee:APP.language==="es"?"el costo del envío":"the transfer cost",
rate:APP.language==="es"?"la tasa de cambio":"the exchange rate",
delivery:APP.language==="es"?"la entrega":"delivery",
requirements:APP.language==="es"?"los requisitos":"requirements",
recipient:APP.language==="es"?"cómo recibe el dinero":"how the money is received",
mistake:APP.language==="es"?"qué hacer ante un error":"what to do after a mistake",
cancel:APP.language==="es"?"la cancelación":"cancellation",
security:APP.language==="es"?"la seguridad":"security",
send:APP.language==="es"?"cómo enviar el dinero":"how to send money",
general:APP.language==="es"?"la información oficial":"official information"
};
return map[topic]||map.general
}
function renderProviderHelp(provider,topic="general"){
const urls=provider?.help_urls||{};
const url=urls[topic]||urls.general||provider?.help_url||provider?.official_site||provider?.continue_url;
const name=provider?.provider_name||"";
const text=APP.language==="es"
?`No tenemos ${topicTitle(topic)} comprobado en este momento. No vamos a adivinar. Te llevamos directamente a la información oficial de ${name}.`
:`We cannot verify ${topicTitle(topic)} right now. We will not guess. We will take you directly to ${name}'s official information.`;
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="review-card"><div class="hero-badge">● ${esc(t("helpTitle"))}</div><h1>${esc(name)}</h1><p>${esc(text)}</p><div class="missing-box">${esc(t("noGuess"))}</div>${url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("goOfficial"))}</a>`:""}<button class="secondary-btn" id="backResults">${esc(t("back"))}</button><footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></section></main>`;
document.getElementById("backResults")?.addEventListener("click",renderResults);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
bindLanguage(()=>renderProviderHelp(provider,topic))
}
function showHelp(){
const modal=document.getElementById("modal");
if(!modal)return;
modal.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card"><button class="modal-close" id="modalClose">×</button><div class="hero-badge">?</div><h2>${esc(t("helpTitle"))}</h2><p>${esc(t("helpText"))}</p><button class="primary-btn" id="modalStart">${esc(t("continue"))}</button></div></div>`;
document.getElementById("modalClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")modal.innerHTML=""});
document.getElementById("modalStart")?.addEventListener("click",()=>{modal.innerHTML="";document.getElementById("amountInput")?.focus()})
}
function renderError(message){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="error-card"><div class="error-icon">!</div><h2>${esc(t("error"))}</h2><p>${esc(message||"")}</p><button class="primary-btn" id="retryBtn">${esc(t("back"))}</button><button class="secondary-btn" id="clearBtn">${esc(t("clear"))}</button></section></main>`;
document.getElementById("retryBtn")?.addEventListener("click",renderHome);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
bindLanguage(()=>renderError(message))
}
function confirmClear(){
const modal=document.getElementById("modal")||document.createElement("div");
if(!modal.id){modal.id="modal";document.body.appendChild(modal)}
modal.innerHTML=`<div class="modal-backdrop" id="clearBackdrop"><div class="modal-card"><button class="modal-close" id="clearClose">×</button><div class="hero-badge">●</div><h2>${esc(t("clearTitle"))}</h2><p>${esc(t("clearText"))}</p><button class="primary-btn" id="clearYes">${esc(t("clearYes"))}</button><button class="secondary-btn" id="clearNo">${esc(t("clearNo"))}</button></div></div>`;
document.getElementById("clearClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("clearNo")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("clearBackdrop")?.addEventListener("click",e=>{if(e.target.id==="clearBackdrop")modal.innerHTML=""});
document.getElementById("clearYes")?.addEventListener("click",clearEverything)
}
async function clearEverything(){
try{if(APP.sessionId)await fetch(`/api/session/${encodeURIComponent(APP.sessionId)}`,{method:"DELETE"})}catch(e){}
const keepLanguage=APP.language;
localStorage.clear();
APP.config=null;
APP.sessionId=null;
APP.amount="";
APP.destination="";
APP.priority="";
APP.delivery="";
APP.payment="";
APP.frequency="";
APP.freeText="";
APP.comparison=null;
APP.selectedProvider=null;
APP.language=keepLanguage;
localStorage.setItem("remesas_language",APP.language);
const modal=document.getElementById("modal");
if(modal)modal.innerHTML="";
await createSession();
try{await loadConfig()}catch(e){}
renderHome();
showTemporaryMessage(t("cleared"))
}
function showTemporaryMessage(message){
const div=document.createElement("div");
div.className="success-box";
div.style.position="fixed";
div.style.left="50%";
div.style.bottom="24px";
div.style.transform="translateX(-50%)";
div.style.zIndex="200";
div.style.width="min(90%,500px)";
div.style.boxShadow="0 10px 30px rgba(0,0,0,.15)";
div.textContent=message;
document.body.appendChild(div);
setTimeout(()=>div.remove(),2200)
}
async function restart(){await clearEverything()}
async function boot(){
try{
await loadConfig();
await createSession();
renderHome()
}catch(e){renderError(e.message)}
}
document.addEventListener("DOMContentLoaded",boot);
