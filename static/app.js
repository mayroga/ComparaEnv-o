"use strict";
const APP={config:null,sessionId:null,language:localStorage.getItem("remesas_language")||"es",amount:"",destination:localStorage.getItem("remesas_destination")||"",priority:"",delivery:"",payment:"",frequency:"",freeText:"",comparison:null,selectedProvider:null};
const TEXT={
es:{
loading:"Buscando opciones para lo que necesitas.",title:"REMESAS",subtitle:"Te ayudamos a organizar y usar tu dinero con pasos simples.",question:"¿QUÉ NECESITAS HOY?",amount:"¿Cuánto quieres enviar?",amountPlaceholder:"Ej. 500",destination:"¿A qué país quieres enviar?",destinationPlaceholder:"Selecciona un país",priority:"¿Qué es lo más importante para ti?",fastest:"MÁS RÁPIDO",save:"AHORRAR",receiveMore:"QUE RECIBA MÁS",urgent:"URGENTE",balanced:"MEJOR EQUILIBRIO",compare:"COMPARAR TODO",other:"OTRA NECESIDAD",freeText:"Cuéntame qué necesitas",freeTextPlaceholder:"Ej. Quiero mandar $500 a México rápido.",continue:"CONTINUAR",back:"ATRÁS",clear:"EMPEZAR DE NUEVO",help:"NO SÉ QUÉ HACER",options:"Opciones para ti",verified:"Información verificada",fee:"Comisión",rate:"Tasa de cambio",receive:"Recibe",delivery:"Entrega",method:"Forma de entrega",official:"IR AL PROVEEDOR",review:"REVISA ANTES DE ENVIAR",country:"País",sendAmount:"Monto a enviar",receiveAmount:"Monto que recibe",payment:"Forma de pago",check:"VERIFICAR",selected:"Opción seleccionada",finalText:"Antes de continuar, revisa que los datos coincidan con lo que quieres enviar.",yes:"CONFIRMAR",no:"VOLVER",noResults:"Todavía no hay una cotización comercial verificada.",tryAgain:"Las plataformas están disponibles para este destino, pero las tarifas y tasas actuales deben verificarse.",helpTitle:"Te ayudamos",helpText:"No necesitas saber qué plataforma usar. Dime qué necesitas y avanzamos paso a paso.",close:"CERRAR",language:"EN",available:"Plataformas disponibles para tu destino.",commercialUnavailable:"Datos comerciales no verificados",error:"No pudimos completar la consulta. Inténtalo nuevamente.",countryRequired:"Selecciona un país.",amountRequired:"Indica cuánto quieres enviar.",saved:"Guardado en este dispositivo.",nothing:"—"
},
en:{
loading:"Looking for options that fit what you need.",title:"REMITTANCES",subtitle:"We help you organize and use your money with simple steps.",question:"WHAT DO YOU NEED TODAY?",amount:"How much do you want to send?",amountPlaceholder:"Example: 500",destination:"Which country are you sending to?",destinationPlaceholder:"Select a country",priority:"What matters most to you?",fastest:"FASTEST",save:"SAVE MONEY",receiveMore:"RECIPIENT GETS MORE",urgent:"URGENT",balanced:"BEST BALANCE",compare:"COMPARE EVERYTHING",other:"OTHER NEED",freeText:"Tell me what you need",freeTextPlaceholder:"Example: I want to send $500 to Mexico fast.",continue:"CONTINUE",back:"BACK",clear:"START OVER",help:"I DON'T KNOW WHAT TO DO",options:"Options for you",verified:"Verified information",fee:"Fee",rate:"Exchange rate",receive:"Recipient gets",delivery:"Delivery",method:"Delivery method",official:"GO TO PROVIDER",review:"REVIEW BEFORE SENDING",country:"Country",sendAmount:"Amount to send",receiveAmount:"Recipient gets",payment:"Payment method",check:"VERIFY",selected:"Selected option",finalText:"Before continuing, make sure the details match what you want to send.",yes:"CONFIRM",no:"GO BACK",noResults:"There is no verified commercial quote yet.",tryAgain:"These platforms are available for this destination, but current rates and fees must be verified.",helpTitle:"We'll help you",helpText:"You do not need to know which platform to use. Tell us what you need and we will move step by step.",close:"CLOSE",language:"ES",available:"Platforms available for your destination.",commercialUnavailable:"Commercial data not verified",error:"We couldn't complete the request. Please try again.",countryRequired:"Select a country.",amountRequired:"Enter the amount.",saved:"Saved on this device.",nothing:"—"
}};
function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function money(v,currency="USD"){if(v===null||v===undefined||v==="")return t("nothing");const n=Number(v);if(!Number.isFinite(n))return esc(v);try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:currency||"USD",maximumFractionDigits:2}).format(n)}catch(e){return`${n.toFixed(2)} ${currency}`}}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});let data=null;try{data=await r.json()}catch(e){}if(!r.ok)throw new Error(data?.detail||data?.message||data?.error||t("error"));return data}
function saveLocal(){localStorage.setItem("remesas_language",APP.language);if(APP.destination)localStorage.setItem("remesas_destination",APP.destination)}
function priorityId(p){return typeof p==="string"?p:p?.id||""}
function priorityLabel(p){if(typeof p==="string"){const map={fastest:"fastest",save:"save",recipient_gets_more:"receiveMore",urgent:"urgent",balanced:"balanced",compare_all:"compare",other:"other"};return t(map[p]||p)}return p?.label||p?.name||p?.id||""}
function countryName(code){const list=APP.config?.countries||[];const x=list.find(c=>(typeof c==="string"?c:c?.id||c?.code)===code);return x?(typeof x==="string"?x:x.name||x.country||code):code||""}
function renderHeader(){return`<header class="topbar"><div class="brand"><div class="brand-mark">R</div><div><strong>${esc(t("title"))}</strong><span>May Roga LLC</span></div></div><button class="language-btn" id="languageBtn">${esc(t("language"))}</button></header>`}
function bindLanguage(render){document.getElementById("languageBtn")?.addEventListener("click",()=>{APP.language=APP.language==="es"?"en":"es";saveLocal();render()})}
function renderHome(){
const app=document.getElementById("app"),opening=APP.config?.opening||{},countries=APP.config?.countries||[],priorities=opening.priorities||[];
const fallback=["fastest","save","recipient_gets_more","urgent","balanced","compare_all"];
const ps=(priorities.length?priorities:fallback).map(p=>{const id=priorityId(p);return`<button class="priority-btn ${APP.priority===id?"active":""}" data-priority="${esc(id)}">${esc(priorityLabel(p))}</button>`}).join("");
let options=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
countries.forEach(c=>{const id=typeof c==="string"?c:c.id||c.code||"";const name=typeof c==="string"?c:c.name||c.country||id;options+=`<option value="${esc(id)}" ${APP.destination===id?"selected":""}>${esc(name)}</option>`});
app.innerHTML=`${renderHeader()}<main class="shell"><section class="hero"><div class="hero-badge">● SIMPLE · CLARO · DIRECTO</div><h1>${esc(opening.primary_question||t("question"))}</h1><p>${esc(opening.secondary_text||opening.subtitle||t("subtitle"))}</p></section><section class="main-card"><div class="field"><label>${esc(t("amount"))}</label><div class="amount-wrap"><span>$</span><input id="amountInput" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="${esc(opening.amount?.placeholder||t("amountPlaceholder"))}" value="${esc(APP.amount)}"></div></div><div class="field"><label>${esc(t("destination"))}</label><select id="destinationInput">${options}</select></div><div class="field"><label>${esc(t("priority"))}</label><div class="priority-grid">${ps}</div></div><button class="help-link" id="helpBtn">?</button><button class="primary-btn" id="continueBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="freeTextBtn">${esc(t("other"))}</button><div id="freeTextArea" class="free-text-area hidden"><label>${esc(t("freeText"))}</label><textarea id="freeTextInput" rows="3" placeholder="${esc(opening.free_text?.placeholder||t("freeTextPlaceholder"))}">${esc(APP.freeText)}</textarea><button class="primary-btn" id="freeTextContinue">${esc(t("continue"))}</button></div></section><footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer></main><div id="modal"></div>`;
document.getElementById("amountInput")?.addEventListener("input",e=>APP.amount=e.target.value);
document.getElementById("destinationInput")?.addEventListener("change",e=>{APP.destination=e.target.value;saveLocal()});
document.querySelectorAll(".priority-btn").forEach(b=>b.addEventListener("click",()=>{APP.priority=b.dataset.priority;document.querySelectorAll(".priority-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
document.getElementById("continueBtn")?.addEventListener("click",startComparison);
document.getElementById("freeTextBtn")?.addEventListener("click",()=>{document.getElementById("freeTextArea")?.classList.toggle("hidden");document.getElementById("freeTextInput")?.focus()});
document.getElementById("freeTextContinue")?.addEventListener("click",startFreeText);
document.getElementById("helpBtn")?.addEventListener("click",showHelp);
document.getElementById("clearBtn")?.addEventListener("click",restart);
bindLanguage(renderHome)
}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.language)}`)}
async function createSession(){try{const d=await api(`/api/session?language=${encodeURIComponent(APP.language)}`,{method:"POST",body:"{}"});APP.sessionId=d?.session?.session_id||d?.session_id||null;return APP.sessionId}catch(e){APP.sessionId=null;return null}}
async function ensureSession(){if(!APP.sessionId)await createSession();return APP.sessionId}
function renderLoading(){document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="loading-card"><div class="loader large"></div><h2>${esc(t("options"))}</h2><p>${esc(t("loading"))}</p></section></main>`;bindLanguage(renderLoading)}
function collectNeed(){return{session_id:APP.sessionId,language:APP.language,need_type:"remittance",amount:Number(APP.amount),send_currency:"USD",destination_country:APP.destination,priority:APP.priority||"balanced",urgency:APP.priority==="urgent",frequency:APP.frequency||null,delivery_method:APP.delivery||null,payment_method:APP.payment||null,special_need:APP.freeText||null,free_text:APP.freeText||null}}
async function startComparison(){
APP.amount=document.getElementById("amountInput")?.value||APP.amount;APP.destination=document.getElementById("destinationInput")?.value||APP.destination;
const amount=Number(APP.amount);
if(!APP.destination){document.getElementById("destinationInput")?.focus();return}
if(!amount||amount<=0){document.getElementById("amountInput")?.focus();return}
if(!APP.priority)APP.priority="balanced";saveLocal();renderLoading();
try{await ensureSession();const need=collectNeed();await api("/api/need",{method:"POST",body:JSON.stringify(need)});APP.comparison=await api("/api/session/"+encodeURIComponent(APP.sessionId)+"/compare",{method:"POST",body:"{}"});renderResults()}catch(e){renderError(e.message)}
}
async function startFreeText(){
const text=document.getElementById("freeTextInput")?.value.trim();if(!text)return;APP.freeText=text;renderLoading();
try{
await ensureSession();
const response=await api("/api/session/"+encodeURIComponent(APP.sessionId)+"/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.language})});
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
const missing=[];if(!APP.amount)missing.push(t("amount"));if(!APP.destination)missing.push(t("destination"));
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="main-card"><div class="hero-badge">● ${esc(t("helpTitle"))}</div><h1>${esc(t("question"))}</h1><p>${esc(t("helpText"))}</p><div class="missing-box">${missing.map(x=>`<div>• ${esc(x)}</div>`).join("")}</div><button class="primary-btn" id="completeBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="backBtn">${esc(t("back"))}</button></section></main>`;
document.getElementById("completeBtn")?.addEventListener("click",renderHome);document.getElementById("backBtn")?.addEventListener("click",renderHome);bindLanguage(renderNeedMissing)
}
function resultId(r){return r?.provider_id||r?.id||""}
function getResults(){
const data=APP.comparison||{},verified=Array.isArray(data.results)?data.results:[],available=Array.isArray(data.available_providers)?data.available_providers:[],merged=[],seen=new Set();
verified.forEach(r=>{const id=resultId(r);if(id&&!seen.has(id)){seen.add(id);merged.push({...r,commercial_verified:true,commercial_status:"verified"})}});
available.forEach(p=>{const id=resultId(p);if(id&&!seen.has(id)){seen.add(id);merged.push({...p,provider_id:id,provider_name:p.provider_name||p.name||id})}});
return merged
}
function resultValue(r,key){return r?.[key]!==undefined?r[key]:r?.commercial_data?.[key]!==undefined?r.commercial_data[key]:null}
function formatMethod(v){const map={cash_pickup:APP.language==="es"?"Efectivo":"Cash pickup",bank_account:APP.language==="es"?"Cuenta bancaria":"Bank account",debit_card:APP.language==="es"?"Tarjeta de débito":"Debit card",credit_card:APP.language==="es"?"Tarjeta de crédito":"Credit card",mobile_wallet:APP.language==="es"?"Billetera móvil":"Mobile wallet",home_delivery:APP.language==="es"?"Entrega a domicilio":"Home delivery"};return map[v]||v}
function renderResults(){
const data=APP.comparison||{},results=getResults(),verified=(data.results||[]).length>0;
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(verified?t("verified"):t("available"))}</div><h1>${esc(t("options"))}</h1><p>${esc(money(APP.amount)+" → "+countryName(APP.destination))}</p></div></section><section class="results-list">${results.length?results.map(renderResultCard).join(""):`<div class="empty-card"><div class="empty-icon">—</div><h2>${esc(t("noResults"))}</h2><p>${esc(t("tryAgain"))}</p></div>`}</section><footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderHome);document.getElementById("clearBtn")?.addEventListener("click",restart);
document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{const p=results.find(x=>resultId(x)===b.dataset.provider);if(p)renderFinalCheck(p)}));bindLanguage(renderResults)
}
function renderResultCard(r,i){
const id=resultId(r),name=r.provider_name||id,verified=r.commercial_verified===true||r.commercial_status==="verified";
const fee=verified?resultValue(r,"fee"):null,rate=verified?resultValue(r,"exchange_rate"):null,recipient=verified?resultValue(r,"recipient_amount"):null;
const delivery=verified?(resultValue(r,"delivery_time")??resultValue(r,"estimated_delivery")):null,method=verified?resultValue(r,"delivery_method"):null;
const currency=resultValue(r,"currency")||resultValue(r,"recipient_currency")||"USD",url=r.continue_url||r.official_site||"";
return`<article class="provider-card"><div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div><span class="verified-pill">${verified?"✓ "+esc(t("verified")):esc(t("commercialUnavailable"))}</span></div><div class="provider-main"><div class="receive-box"><span>${esc(t("receive"))}</span><strong>${recipient!==null?money(recipient,currency):t("nothing")}</strong></div><div class="details-grid"><div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee,"USD"):t("nothing")}</strong></div><div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):t("nothing")}</strong></div><div><span>${esc(t("delivery"))}</span><strong>${delivery!==null?esc(delivery):t("nothing")}</strong></div><div><span>${esc(t("method"))}</span><strong>${method?esc(formatMethod(method)):t("nothing")}</strong></div></div></div><div class="provider-foot"><small>${verified?esc(t("verified")):esc(t("commercialUnavailable"))}</small>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div><button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(verified?t("check"):t("official"))}</button></article>`
}
async function renderFinalCheck(provider){
const id=resultId(provider),verified=provider.commercial_verified===true||provider.commercial_status==="verified";
if(!verified){const url=provider.continue_url||provider.official_site;if(url)window.open(url,"_blank","noopener,noreferrer");return}
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(provider.provider_name||id)}</h1><p>${esc(t("finalText"))}</p></div></section><section class="review-card"><h2>${esc(t("review"))}</h2><div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div><div class="review-row"><span>${esc(t("sendAmount"))}</span><strong>${money(APP.amount,"USD")}</strong></div><div class="review-row"><span>${esc(t("fee"))}</span><strong>${provider.fee!=null?money(provider.fee,"USD"):t("nothing")}</strong></div><div class="review-row"><span>${esc(t("rate"))}</span><strong>${provider.exchange_rate!=null?esc(provider.exchange_rate):t("nothing")}</strong></div><div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${provider.recipient_amount!=null?money(provider.recipient_amount,provider.currency||provider.recipient_currency||"USD"):t("nothing")}</strong></div><div class="review-row"><span>${esc(t("method"))}</span><strong>${provider.delivery_method?esc(formatMethod(provider.delivery_method)):t("nothing")}</strong></div><div class="review-actions"><button class="secondary-btn" id="backResults">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div><div id="finalStatus"></div></section><footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderResults);document.getElementById("backResults")?.addEventListener("click",renderResults);document.getElementById("clearBtn")?.addEventListener("click",restart);
document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(provider,id));bindLanguage(()=>renderFinalCheck(provider))
}
async function performFinalCheck(provider,id){
const status=document.getElementById("finalStatus");if(!status)return;
status.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
try{
await ensureSession();
const result=await api("/api/session/"+encodeURIComponent(APP.sessionId)+"/final-check",{method:"POST",body:"{}"});
const ready=result?.ready_to_continue!==false,url=provider.continue_url||provider.official_site;
status.innerHTML=`<div class="${ready?"success-box":"error-box"}">${ready?`<strong>✓ ${esc(t("verified"))}</strong>`:`<strong>${esc(t("tryAgain"))}</strong>`}<p>${esc(result?.message||t("finalText"))}</p>${ready&&url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div>`
}catch(e){status.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`}
}
function showHelp(){
const modal=document.getElementById("modal");if(!modal)return;
modal.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card"><button class="modal-close" id="modalClose">×</button><div class="hero-badge">?</div><h2>${esc(t("helpTitle"))}</h2><p>${esc(t("helpText"))}</p><button class="primary-btn" id="modalStart">${esc(t("continue"))}</button></div></div>`;
document.getElementById("modalClose")?.addEventListener("click",()=>modal.innerHTML="");document.getElementById("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")modal.innerHTML=""});document.getElementById("modalStart")?.addEventListener("click",()=>{modal.innerHTML="";document.getElementById("amountInput")?.focus()})
}
function renderError(message){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="error-card"><div class="error-icon">!</div><h2>${esc(t("error"))}</h2><p>${esc(message||"")}</p><button class="primary-btn" id="retryBtn">${esc(t("back"))}</button></section></main>`;
document.getElementById("retryBtn")?.addEventListener("click",renderHome);bindLanguage(()=>renderError(message))
}
function restart(){
APP.sessionId=null;APP.amount="";APP.destination="";APP.priority="";APP.delivery="";APP.payment="";APP.frequency="";APP.freeText="";APP.comparison=null;APP.selectedProvider=null;
localStorage.removeItem("remesas_destination");createSession().finally(renderHome)
}
async function boot(){try{await loadConfig();await createSession();renderHome()}catch(e){renderError(e.message)}}
document.addEventListener("DOMContentLoaded",boot);
