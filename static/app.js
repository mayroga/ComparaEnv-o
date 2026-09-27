const APP={config:null,sessionId:null,language:localStorage.getItem("remesas_language")||"es",need:{},comparison:null,selectedProvider:null};

const TEXT={
es:{
loading:"Estoy buscando opciones para lo que necesitas.",
noResults:"No pudimos confirmar tarifas o cotizaciones actuales, pero estas son las plataformas disponibles para tu destino.",
results:"Estas son las opciones que pudimos encontrar para ti.",
available:"Plataformas disponibles para tu destino.",
verify:"Los datos comerciales requieren verificación.",
open:"ABRIR PLATAFORMA",
select:"VER ESTA OPCIÓN",
continue:"CONTINUAR CON EL PROVEEDOR",
external:"Vas a continuar directamente con el proveedor.",
restart:"EMPEZAR DE NUEVO",
session:"Tu sesión terminó. Podemos comenzar de nuevo.",
amount:"¿Cuánto quieres enviar?",
destination:"¿A qué país quieres enviar?",
priority:"¿Qué es lo más importante para ti?",
freeText:"También puedes escribir lo que necesitas...",
compare:"COMPARAR",
back:"VOLVER",
details:"VER DETALLES",
notAvailable:"No disponible",
verified:"Verificado",
commercialUnavailable:"Cotización actual no disponible",
countryRequired:"Selecciona un país.",
amountRequired:"Indica cuánto quieres enviar.",
connection:"No pudimos completar la consulta. Inténtalo nuevamente."
},
en:{
loading:"I'm looking for options that fit what you need.",
noResults:"We could not confirm current rates or quotes, but these are the platforms available for your destination.",
results:"These are the options we found for you.",
available:"Platforms available for your destination.",
verify:"Commercial data requires verification.",
open:"OPEN PLATFORM",
select:"VIEW THIS OPTION",
continue:"CONTINUE WITH PROVIDER",
external:"You are about to continue directly with the provider.",
restart:"START OVER",
session:"Your session ended. We can start again.",
amount:"How much do you want to send?",
destination:"Which country are you sending to?",
priority:"What matters most to you?",
freeText:"You can also write what you need...",
compare:"COMPARE",
back:"BACK",
details:"VIEW DETAILS",
notAvailable:"Not available",
verified:"Verified",
commercialUnavailable:"Current quote unavailable",
countryRequired:"Select a country.",
amountRequired:"Enter the amount.",
connection:"We could not complete the request. Please try again."
}
};

function t(key){return TEXT[APP.language]?.[key]??TEXT.es[key]??key}

function esc(value){
return String(value??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))
}

function localizedValue(value,language=APP.language){
if(value==null)return"";
if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return String(value);
if(Array.isArray(value))return value.map(v=>localizedValue(v,language)).filter(Boolean).join(", ");
if(typeof value==="object"){
if(value[language]!=null)return localizedValue(value[language],language);
if(value.es!=null)return localizedValue(value.es,"es");
if(value.en!=null)return localizedValue(value.en,"en");
if(value.label!=null)return localizedValue(value.label,language);
if(value.name!=null)return localizedValue(value.name,language);
if(value.id!=null)return String(value.id);
}
return""
}

async function api(url,options={}){
const response=await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
let data=null;
try{data=await response.json()}catch(e){}
if(!response.ok){
const message=data?.detail||data?.message||data?.error||t("connection");
throw new Error(message)
}
return data
}

function setLanguage(language){
APP.language=language==="en"?"en":"es";
localStorage.setItem("remesas_language",APP.language);
if(APP.config)renderHome()
}

async function createSession(){
try{
const data=await api("/api/session",{method:"POST",body:JSON.stringify({language:APP.language})});
APP.sessionId=data?.session_id||data?.id||data?.session?.session_id||data?.session?.id||null;
if(data?.session)APP.need={...APP.need,...data.session};
return APP.sessionId
}catch(e){
APP.sessionId=null;
return null
}
}

async function loadConfig(){
const data=await api(`/api/config?language=${encodeURIComponent(APP.language)}`);
APP.config=data?.config||data;
return APP.config
}

function priorityId(item){return typeof item==="string"?item:item?.id||""}

function priorityLabel(item){
if(typeof item==="string")return localizedValue(item);
return localizedValue(item?.label??item?.name??item?.id)
}

function countryName(item){
if(typeof item==="string"){
const found=(APP.config?.countries||[]).find(x=>x.id===item);
return found?.name||item
}
return localizedValue(item?.name??item?.label??item?.id)
}

function renderLanguageButton(){
const button=document.getElementById("language-toggle");
if(button)button.textContent=APP.language==="es"?"EN":"ES"
}

function renderHome(){
const app=document.getElementById("app")||document.getElementById("root");
if(!app)return;

const opening=APP.config?.opening||{};
const priorities=Array.isArray(opening.priorities)?opening.priorities:[];
const countries=Array.isArray(APP.config?.countries)?APP.config.countries:[];

app.innerHTML=`
<div class="card validation-card">
<div class="topbar">
<span>● SIMPLE · CLARO · DIRECTO</span>
<button id="language-toggle" type="button">${APP.language==="es"?"EN":"ES"}</button>
</div>
<h1>${esc(localizedValue(opening.primary_question)||"¿QUÉ NECESITAS HOY?")}</h1>
<p class="small">${esc(localizedValue(opening.secondary_text))}</p>

<div class="field">
<label>${esc(t("amount"))}</label>
<div class="amount-wrap">
<span>$</span>
<input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${esc(localizedValue(opening.amount?.placeholder))}">
</div>
</div>

<div class="field">
<label>${esc(t("destination"))}</label>
<select id="destination">
<option value="">${esc(t("destination"))}</option>
${countries.map(c=>`<option value="${esc(c.id)}">${esc(countryName(c))}${c.currency?" · "+esc(c.currency):""}</option>`).join("")}
</select>
</div>

<div class="field">
<label>${esc(t("priority"))}</label>
<div id="priority-grid" class="priority-grid">
${priorities.map(p=>{
const id=priorityId(p);
return`<button type="button" class="priority-btn" data-priority="${esc(id)}">
<span>${esc(p?.icon||"")}</span>
<strong>${esc(priorityLabel(p))}</strong>
</button>`
}).join("")}
</div>
</div>

<div class="field">
<textarea id="free-text" rows="3" placeholder="${esc(localizedValue(opening.free_text?.placeholder))}"></textarea>
</div>

<button id="continue-btn" class="primary-btn" type="button">${esc(t("compare"))}</button>
<button id="restart-btn" class="secondary-btn" type="button">${esc(t("restart"))}</button>
</div>`;

renderLanguageButton();

document.getElementById("language-toggle")?.addEventListener("click",()=>setLanguage(APP.language==="es"?"en":"es"));

document.querySelectorAll(".priority-btn").forEach(button=>{
button.addEventListener("click",()=>{
document.querySelectorAll(".priority-btn").forEach(x=>x.classList.remove("selected"));
button.classList.add("selected");
APP.need.priority=button.dataset.priority
})
});

document.getElementById("continue-btn")?.addEventListener("click",startComparison);
document.getElementById("restart-btn")?.addEventListener("click",restart)
}

function showLoading(){
const app=document.getElementById("app")||document.getElementById("root");
if(!app)return;
app.innerHTML=`
<div class="card validation-card">
<h2>${esc(t("loading"))}</h2>
<div class="loader"></div>
</div>`
}

function collectNeed(){
const amountEl=document.getElementById("amount");
const destinationEl=document.getElementById("destination");
const freeTextEl=document.getElementById("free-text");

const amountValue=amountEl?.value?.trim()||"";
const destination=destinationEl?.value||"";
const freeText=freeTextEl?.value?.trim()||"";

APP.need={
...APP.need,
amount:amountValue?Number(amountValue):null,
destination_country:destination||null,
language:APP.language,
send_currency:"USD",
special_need:freeText||null
};

return APP.need
}

async function ensureSession(){
if(APP.sessionId)return true;
return!!(await createSession())
}

async function startComparison(){
const need=collectNeed();

if(!need.destination_country){
alert(t("countryRequired"));
return
}

if(!need.amount||need.amount<=0){
alert(t("amountRequired"));
return
}

showLoading();

try{
await ensureSession();

let needResponse;

try{
needResponse=await api("/api/need",{
method:"POST",
body:JSON.stringify(need)
})
}catch(e){
if(!APP.sessionId)throw e;
needResponse=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/need/parse`,{
method:"POST",
body:JSON.stringify({
text:need.special_need||"",
language:APP.language
})
})
}

const sessionFromNeed=needResponse?.session||needResponse?.data?.session;
if(sessionFromNeed?.session_id)APP.sessionId=sessionFromNeed.session_id;
if(needResponse?.session_id)APP.sessionId=needResponse.session_id;

if(!APP.sessionId)await ensureSession();

let result;

try{
result=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/compare`,{method:"POST"})
}catch(e){
result=await api("/api/compare",{
method:"POST",
body:JSON.stringify(need)
})
}

APP.comparison=result?.comparison||result;
renderResults(APP.comparison)
}catch(error){
renderError(error?.message||t("connection"))
}
}

async function startFreeText(){
const text=document.getElementById("free-text")?.value?.trim();
if(!text)return;

showLoading();

try{
await ensureSession();

const parsedResponse=await api("/api/need/parse",{
method:"POST",
body:JSON.stringify({text,language:APP.language})
});

const parsed=parsedResponse?.parsed||parsedResponse?.data||parsedResponse;

APP.need={
...APP.need,
amount:parsed?.amount??APP.need.amount,
destination_country:parsed?.destination_country??APP.need.destination_country,
priority:parsed?.priority??APP.need.priority,
urgency:parsed?.urgency??APP.need.urgency,
delivery_method:parsed?.delivery_method??APP.need.delivery_method,
payment_method:parsed?.payment_method??APP.need.payment_method,
special_need:text,
language:APP.language
};

renderHome();

if(APP.need.destination_country&&APP.need.amount)await startComparison()
}catch(error){
renderError(error?.message||t("connection"))
}
}

function providerDisplayStatus(provider){
if(provider?.commercial_verified||provider?.commercial_status==="verified")
return`<span class="status verified">${esc(t("verified"))}</span>`;
return`<span class="status unavailable">${esc(t("commercialUnavailable"))}</span>`
}

function providerUrl(provider){
return provider?.continue_url||provider?.official_site||"#"
}

function renderProviderCard(provider,index){
const verified=!!provider?.commercial_verified||provider?.commercial_status==="verified";

const fee=verified&&provider.fee!=null?provider.fee:null;
const rate=verified&&provider.exchange_rate!=null?provider.exchange_rate:null;
const recipient=verified&&provider.recipient_amount!=null?provider.recipient_amount:null;
const delivery=verified&&(provider.delivery_time!=null||provider.estimated_delivery!=null)
?(provider.delivery_time??provider.estimated_delivery):null;

return`
<div class="provider-card" data-provider="${esc(provider.provider_id||"")}">
<div class="provider-head">
<div>
<span class="provider-number">${index+1}</span>
<strong>${esc(provider.provider_name||provider.provider_id||"")}</strong>
</div>
${providerDisplayStatus(provider)}
</div>

${verified?`
<div class="provider-data">
<div><small>CARGO</small><strong>${esc(fee??t("notAvailable"))}</strong></div>
<div><small>TASA</small><strong>${esc(rate??t("notAvailable"))}</strong></div>
<div><small>RECIBE</small><strong>${esc(recipient??t("notAvailable"))}</strong></div>
<div><small>ENTREGA</small><strong>${esc(delivery??t("notAvailable"))}</strong></div>
</div>
`:
`<div class="provider-message">${esc(t("verify"))}</div>`}

<div class="provider-actions">
<button type="button" class="provider-select" data-provider="${esc(provider.provider_id||"")}">
${esc(verified?t("select"):t("open"))}
</button>
</div>
</div>`
}

function renderResults(data){
const app=document.getElementById("app")||document.getElementById("root");
if(!app)return;

const results=Array.isArray(data?.results)?data.results:[];
const providers=Array.isArray(data?.available_providers)?data.available_providers:
Array.isArray(data?.providers)?data.providers:[];

const merged=[];
const seen=new Set();

results.forEach(r=>{
const id=r?.provider_id;
if(!id||seen.has(id))return;
seen.add(id);
merged.push({
...r,
provider_name:r.provider_name||id,
commercial_verified:true,
commercial_status:"verified",
continue_url:r.continue_url
})
});

providers.forEach(p=>{
const id=p?.provider_id||p?.id;
if(!id||seen.has(id))return;
seen.add(id);
merged.push({
...p,
provider_id:id,
provider_name:p.provider_name||p.name||id
})
});

const hasProviders=merged.length>0;
const hasVerified=results.length>0;

let heading;

if(hasVerified){
heading=data?.message&&data.message!==t("noResults")?data.message:t("results")
}else if(hasProviders){
heading=t("available")
}else{
heading=data?.message||t("noResults")
}

app.innerHTML=`
<div class="card validation-card">
<button id="back-home" class="back-btn" type="button">← ${esc(t("back"))}</button>
<h2>${esc(heading)}</h2>

${hasProviders&&!hasVerified?`
<p class="small">${esc(t("noResults"))}</p>`:""}

<div class="search-summary">
<div><small>${esc(t("amount"))}</small><strong>$${esc(APP.need.amount??"")}</strong></div>
<div><small>${esc(t("destination"))}</small><strong>${esc(countryName(APP.need.destination_country))}</strong></div>
<div><small>${esc(t("priority"))}</small><strong>${esc(priorityLabel(APP.need.priority||"compare_all"))}</strong></div>
</div>

<div class="provider-list">
${hasProviders?merged.map(renderProviderCard).join(""):`
<div class="provider-message">${esc(t("noResults"))}</div>`}
</div>

<button id="restart-btn" class="secondary-btn" type="button">${esc(t("restart"))}</button>
</div>`;

document.getElementById("back-home")?.addEventListener("click",renderHome);
document.getElementById("restart-btn")?.addEventListener("click",restart);

document.querySelectorAll(".provider-select").forEach(button=>{
button.addEventListener("click",()=>selectProvider(button.dataset.provider,merged))
})
}

async function selectProvider(providerId,providers){
const provider=providers.find(p=>(p.provider_id||p.id)===providerId);
if(!provider)return;

APP.selectedProvider=provider;

const verified=!!provider.commercial_verified||provider.commercial_status==="verified";

try{
if(APP.sessionId){
try{
await api(`/api/session/${encodeURIComponent(APP.sessionId)}/select/${encodeURIComponent(providerId)}`,{method:"POST"})
}catch(e){}
}

if(!verified){
openProvider(provider);
return
}

await performFinalCheck(provider)
}catch(error){
renderError(error?.message||t("connection"))
}
}

async function performFinalCheck(provider){
const request={
amount:APP.need.amount,
destination_country:APP.need.destination_country,
currency:provider?.currency||APP.need.send_currency||"USD",
delivery_method:provider?.delivery_method||APP.need.delivery_method||null,
language:APP.language
};

let check;

try{
check=await api("/api/final-check",{
method:"POST",
body:JSON.stringify(request)
})
}catch(e){
if(APP.sessionId){
check=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/final-check`,{method:"POST"})
}else throw e
}

renderFinalCheck(provider,check)
}

function renderFinalCheck(provider,check){
const app=document.getElementById("app")||document.getElementById("root");
if(!app)return;

const checks=Array.isArray(check?.checks)?check.checks:[];

app.innerHTML=`
<div class="card validation-card">
<button id="back-results" class="back-btn" type="button">← ${esc(t("back"))}</button>
<h2>${esc(provider.provider_name||provider.provider_id||"")}</h2>
<p class="small">${esc(t("external"))}</p>

<div class="final-check">
${checks.map(item=>`
<div class="check-row">
<span>${item.complete?"✓":"○"}</span>
<div>
<strong>${esc(localizedValue(item.label))}</strong>
<small>${esc(localizedValue(item.value)||t("notAvailable"))}</small>
</div>
</div>`).join("")}
</div>

<div class="provider-summary">
${provider.fee!=null?`<p><strong>Cargo:</strong> ${esc(provider.fee)}</p>`:""}
${provider.exchange_rate!=null?`<p><strong>Tasa:</strong> ${esc(provider.exchange_rate)}</p>`:""}
${provider.recipient_amount!=null?`<p><strong>Recibe:</strong> ${esc(provider.recipient_amount)}</p>`:""}
${(provider.estimated_delivery??provider.delivery_time)!=null?`<p><strong>Entrega:</strong> ${esc(provider.estimated_delivery??provider.delivery_time)}</p>`:""}
</div>

<button id="provider-continue" class="primary-btn" type="button">${esc(t("continue"))}</button>
<button id="restart-btn" class="secondary-btn" type="button">${esc(t("restart"))}</button>
</div>`;

document.getElementById("back-results")?.addEventListener("click",()=>renderResults(APP.comparison));
document.getElementById("restart-btn")?.addEventListener("click",restart);
document.getElementById("provider-continue")?.addEventListener("click",()=>openProvider(provider))
}

function openProvider(provider){
const url=providerUrl(provider);
if(!url||url==="#"){
alert(t("connection"));
return
}
window.open(url,"_blank","noopener,noreferrer")
}

function renderError(message){
const app=document.getElementById("app")||document.getElementById("root");
if(!app)return;

app.innerHTML=`
<div class="card validation-card">
<h2>${esc(message||t("connection"))}</h2>
<button id="retry-btn" class="primary-btn" type="button">${esc(t("back"))}</button>
<button id="restart-btn" class="secondary-btn" type="button">${esc(t("restart"))}</button>
</div>`;

document.getElementById("retry-btn")?.addEventListener("click",renderHome);
document.getElementById("restart-btn")?.addEventListener("click",restart)
}

function restart(){
APP.sessionId=null;
APP.need={};
APP.comparison=null;
APP.selectedProvider=null;
createSession().finally(renderHome)
}

async function boot(){
try{
await loadConfig();
await createSession();
renderHome()
}catch(error){
renderError(error?.message||t("connection"))
}
}

document.addEventListener("DOMContentLoaded",boot);
