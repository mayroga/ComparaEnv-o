"use strict";

const APP={config:null,sessionId:null,language:localStorage.getItem("remesas_language")||"es",amount:"",destination:"",priority:"",delivery:"",payment:"",frequency:"",freeText:"",comparison:null,selectedProvider:null,needType:null};

const TEXT={
es:{
title:"REMESAS",subtitle:"Aquí puedes organizar tu dinero y resolver lo que necesitas.",question:"¿QUÉ NECESITAS HOY?",simple:"No tienes que saber de bancos ni de tecnología. Dinos qué necesitas y te ayudamos paso a paso.",start:"COMENZAR",continue:"CONTINUAR",back:"ATRÁS",clear:"BORRAR TODO Y EMPEZAR DE NUEVO",language:"EN",help:"NO SÉ QUÉ HACER",other:"OTRA COSA",amount:"¿Cuánto quieres enviar?",amountPlaceholder:"Ejemplo: 200",destination:"¿A qué país quieres enviar?",destinationPlaceholder:"Elige un país",priority:"¿Qué es más importante para ti?",fastest:"QUE LLEGUE RÁPIDO",save:"GASTAR MENOS",receiveMore:"QUE RECIBA MÁS",urgent:"LO NECESITO PRONTO",balanced:"UN POCO DE TODO",compare:"QUIERO VER LAS OPCIONES",freeText:"Cuéntame con tus palabras",freeTextPlaceholder:"Ejemplo: quiero mandar 200 dólares a México rápido.",options:"Vamos a ayudarte",loading:"Estoy revisando las opciones para ti.",verified:"Información comprobada",available:"Opciones para revisar",fee:"Costo del envío",rate:"Cambio de moneda",receive:"La otra persona recibe",delivery:"Cómo puede recibirlo",method:"Cómo puedes pagar",check:"REVISAR ESTA OPCIÓN",official:"VER INFORMACIÓN OFICIAL",officialHelp:"VER LA AYUDA OFICIAL",review:"ANTES DE CONTINUAR",country:"País",sendAmount:"Tú envías",receiveAmount:"La otra persona recibe",selected:"Esta opción",finalText:"Primero revisamos lo que entendimos. Después la remesadora te mostrará las condiciones finales antes de enviar.",yes:"CONTINUAR CON ESTA OPCIÓN",no:"VOLVER A LAS OPCIONES",nothing:"No disponible",commercialUnavailable:"Este dato no está comprobado ahora",noResults:"No tengo una cotización comprobada ahora mismo.",tryAgain:"No voy a inventar un precio, una tasa ni un tiempo.",goOfficial:"IR A LA INFORMACIÓN OFICIAL",error:"No pudimos completar esto.",countryRequired:"Elige un país.",amountRequired:"Dime cuánto quieres enviar.",clearTitle:"¿Borrar todo?",clearText:"Vamos a borrar lo que esta aplicación tiene guardado en este dispositivo y comenzaremos desde cero.",clearYes:"SÍ, BORRAR TODO",clearNo:"NO, VOLVER",cleared:"Listo. Empezamos de cero.",helpTitle:"No pasa nada. Te ayudamos.",helpText:"No tienes que saber qué opción usar. Cuéntame qué quieres hacer y vamos paso a paso.",whatWeDo:"Aquí no tienes que investigar.",whatWeDoText:"Dinos qué quieres hacer. Nosotros explicamos lo importante y te decimos el siguiente paso.",paymentWays:"Puedes pagar de estas formas",receiveWays:"La persona puede recibirlo de estas formas.",noGuess:"No queremos darte una respuesta equivocada."},
en:{
title:"REMITTANCES",subtitle:"Here you can organize your money and solve what you need.",question:"WHAT DO YOU NEED TODAY?",simple:"You do not need to know banking or technology. Tell us what you need and we will help step by step.",start:"START",continue:"CONTINUE",back:"BACK",clear:"DELETE EVERYTHING AND START OVER",language:"ES",help:"I DON'T KNOW WHAT TO DO",other:"SOMETHING ELSE",amount:"How much do you want to send?",amountPlaceholder:"Example: 200",destination:"Which country are you sending to?",destinationPlaceholder:"Choose a country",priority:"What matters most to you?",fastest:"GET THERE FAST",save:"SPEND LESS",receiveMore:"RECIPIENT GETS MORE",urgent:"I NEED IT SOON",balanced:"A LITTLE OF EVERYTHING",compare:"SHOW ME THE OPTIONS",freeText:"Tell me in your own words",freeTextPlaceholder:"Example: I want to send 200 dollars to Mexico fast.",options:"Let's help you",loading:"I am checking the options for you.",verified:"Verified information",available:"Options to review",fee:"Transfer cost",rate:"Currency exchange",receive:"The other person receives",delivery:"How the money can be received",method:"How you can pay",check:"REVIEW THIS OPTION",official:"VIEW OFFICIAL INFORMATION",officialHelp:"VIEW OFFICIAL HELP",review:"BEFORE CONTINUING",country:"Country",sendAmount:"You send",receiveAmount:"The other person receives",selected:"This option",finalText:"First we review what we understood. Then the provider will show the final conditions before you send.",yes:"CONTINUE WITH THIS OPTION",no:"BACK TO OPTIONS",nothing:"Not available",commercialUnavailable:"This information is not verified right now",noResults:"I do not have a verified quote right now.",tryAgain:"I will not guess a price, rate or delivery time.",goOfficial:"GO TO OFFICIAL INFORMATION",error:"We could not complete this.",countryRequired:"Choose a country.",amountRequired:"Tell me how much you want to send.",clearTitle:"Delete everything?",clearText:"We will delete what this app saved on this device and start from zero.",clearYes:"YES, DELETE EVERYTHING",clearNo:"NO, GO BACK",cleared:"Done. We are starting from zero.",helpTitle:"That's okay. We'll help.",helpText:"You do not need to know which option to use. Tell me what you want to do and we will go step by step.",whatWeDo:"You do not have to investigate here.",whatWeDoText:"Tell us what you want to do. We explain what matters and tell you the next step.",paymentWays:"You can pay in these ways",receiveWays:"The person can receive it in these ways.",noGuess:"We do not want to give you a wrong answer."}};

function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function money(v,c="USD"){if(v===null||v===undefined||v==="")return t("nothing");const n=Number(v);if(!Number.isFinite(n))return esc(v);try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:c||"USD",maximumFractionDigits:2}).format(n)}catch(e){return`${n.toFixed(2)} ${c}`}}
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}});let d=null;try{d=await r.json()}catch(e){}if(!r.ok)throw new Error(d?.detail||d?.message||t("error"));return d}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.language)}`)}
async function createSession(){try{const d=await api("/api/session",{method:"POST",body:JSON.stringify({language:APP.language})});APP.sessionId=d?.session?.session_id||null;return APP.sessionId}catch(e){APP.sessionId=null;return null}}
async function ensureSession(){if(!APP.sessionId)await createSession();return APP.sessionId}
function save(){localStorage.setItem("remesas_language",APP.language)}
function renderHeader(){return`<header class="topbar"><div class="brand"><div class="brand-mark">R</div><div><strong>${esc(t("title"))}</strong><span>May Roga LLC</span></div></div><button class="language-btn" id="languageBtn">${esc(t("language"))}</button></header>`}
function bindLanguage(fn){document.getElementById("languageBtn")?.addEventListener("click",async()=>{APP.language=APP.language==="es"?"en":"es";save();try{await loadConfig()}catch(e){}fn()})}
function menuItems(){return APP.config?.menu||[
{id:"remittance",icon:"💸",label:t("title"),text:"Enviar dinero"},
{id:"family",icon:"❤️",label:"FAMILIA",text:"Organizar dinero para tu familia"},
{id:"savings",icon:"🐷",label:"AHORRO",text:"Guardar dinero"},
{id:"expenses",icon:"🧾",label:"GASTOS",text:"Entender tus gastos"},
{id:"purchase",icon:"🛒",label:"COMPRAS",text:"Revisar una compra"},
{id:"money_available",icon:"💰",label:"MI DINERO",text:"Saber cuánto tienes"},
{id:"budget",icon:"📅",label:"PRESUPUESTO",text:"Ordenar tu dinero"},
{id:"other",icon:"❓",label:t("other"),text:"Cuéntanos qué necesitas"}]}
function renderHome(){
const items=menuItems();
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="hero"><div class="hero-badge">● ${esc(t("title"))}</div><h1>${esc(t("question"))}</h1><p>${esc(t("simple"))}</p></section><section class="main-card"><div class="menu-grid">${items.map(x=>`<button class="menu-card" data-need="${esc(x.id)}"><span class="menu-icon">${esc(x.icon||"●")}</span><strong>${esc(typeof x.label==="object"?(x.label[APP.language]||x.label.es):x.label)}</strong><small>${esc(typeof x.text==="object"?(x.text[APP.language]||x.text.es):x.text)}</small></button>`).join("")}</div><button class="secondary-btn" id="helpBtn">${esc(t("help"))}</button></section><section class="main-card info-card"><h2>${esc(t("whatWeDo"))}</h2><p>${esc(t("whatWeDoText"))}</p></section><footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer></main><div id="modal"></div>`;
document.querySelectorAll("[data-need]").forEach(b=>b.addEventListener("click",()=>chooseNeed(b.dataset.need)));
document.getElementById("helpBtn")?.addEventListener("click",showHelp);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
bindLanguage(renderHome)
}
function chooseNeed(type){
APP.needType=type;
if(type==="remittance"){renderRemittanceStart();return}
if(type==="other"){renderFreeQuestion();return}
renderSimpleNeed(type)
}
function renderRemittanceStart(){
const countries=APP.config?.countries||[];
let opts=`<option value="">${esc(t("destinationPlaceholder"))}</option>`;
countries.forEach(c=>{const id=c.id||c.code||"";opts+=`<option value="${esc(id)}">${esc(c.name||id)}</option>`});
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● 💸</div><h1>${esc(t("title"))}</h1><p>${esc(t("simple"))}</p></div></section><section class="main-card"><div class="field"><label>${esc(t("amount"))}</label><div class="amount-wrap"><span>$</span><input id="amountInput" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${esc(t("amountPlaceholder"))}"></div></div><div class="field"><label>${esc(t("destination"))}</label><select id="destinationInput">${opts}</select></div><div class="field"><label>${esc(t("priority"))}</label><div class="priority-grid">${[
["fastest",t("fastest")],["save",t("save")],["recipient_gets_more",t("receiveMore")],["urgent",t("urgent")],["balanced",t("balanced")],["compare_all",t("compare")]
].map(x=>`<button class="priority-btn" data-priority="${x[0]}">${esc(x[1])}</button>`).join("")}</div></div><button class="primary-btn" id="continueBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="freeTextBtn">${esc(t("other"))}</button><div id="freeTextArea" class="free-text-area hidden"><label>${esc(t("freeText"))}</label><textarea id="freeTextInput" rows="3" placeholder="${esc(t("freeTextPlaceholder"))}"></textarea><button class="primary-btn" id="freeTextContinue">${esc(t("continue"))}</button></div></section><footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderHome);
document.querySelectorAll("[data-priority]").forEach(b=>b.addEventListener("click",()=>{APP.priority=b.dataset.priority;document.querySelectorAll("[data-priority]").forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
document.getElementById("continueBtn")?.addEventListener("click",startComparison);
document.getElementById("freeTextBtn")?.addEventListener("click",()=>{document.getElementById("freeTextArea").classList.toggle("hidden");document.getElementById("freeTextInput")?.focus()});
document.getElementById("freeTextContinue")?.addEventListener("click",startFreeText);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
bindLanguage(renderRemittanceStart)
}
function renderSimpleNeed(type){
const d=APP.config?.menu?.find(x=>x.id===type)||{};
const label=typeof d.label==="object"?(d.label[APP.language]||d.label.es):d.label||type;
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="review-card"><div class="hero-badge">${esc(d.icon||"●")} ${esc(label)}</div><h1>${esc(label)}</h1><p id="needMessage">${esc(t("loading"))}</p><textarea id="needInput" rows="3" placeholder="${esc(t("freeTextPlaceholder"))}"></textarea><button class="primary-btn" id="needSend">${esc(t("continue"))}</button><button class="secondary-btn" id="needBack">${esc(t("back"))}</button></section><footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
api("/api/assistant",{method:"POST",body:JSON.stringify({language:APP.language,need_type:type})}).then(r=>{document.getElementById("needMessage").textContent=r.message||""}).catch(()=>{document.getElementById("needMessage").textContent=t("whatWeDoText")});
document.getElementById("needSend")?.addEventListener("click",async()=>{const text=document.getElementById("needInput").value.trim();if(!text){document.getElementById("needInput").focus();return}try{const r=await api("/api/assistant",{method:"POST",body:JSON.stringify({language:APP.language,need_type:type,free_text:text,text})});document.getElementById("needMessage").textContent=r.message||t("whatWeDoText")}catch(e){document.getElementById("needMessage").textContent=e.message}});
document.getElementById("needBack")?.addEventListener("click",renderHome);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
bindLanguage(()=>renderSimpleNeed(type))
}
function renderFreeQuestion(){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="review-card"><div class="hero-badge">❓</div><h1>${esc(t("helpTitle"))}</h1><p>${esc(t("helpText"))}</p><textarea id="freeQuestion" rows="5" placeholder="${esc(t("freeTextPlaceholder"))}"></textarea><button class="primary-btn" id="freeQuestionBtn">${esc(t("continue"))}</button><button class="secondary-btn" id="backBtn">${esc(t("back"))}</button></section></main>`;
document.getElementById("freeQuestionBtn")?.addEventListener("click",async()=>{const text=document.getElementById("freeQuestion").value.trim();if(!text)return;try{const r=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.language})});const p=r.parsed||{};if(p.need_type==="remittance"){APP.amount=p.amount||"";APP.destination=p.destination_country||"";APP.priority=p.priority||"";APP.freeText=text;if(APP.amount&&APP.destination)startComparison();else renderRemittanceStart();}else{renderSimpleNeed(p.need_type||"other")}}catch(e){renderError(e.message)}});
document.getElementById("backBtn")?.addEventListener("click",renderHome);
bindLanguage(renderFreeQuestion)
}
function validateBasic(){const a=Number(APP.amount);if(!a||a<=0){alert(t("amountRequired"));return false}if(!APP.destination){alert(t("countryRequired"));return false}return true}
function collectNeed(){return{language:APP.language,need_type:"remittance",amount:Number(APP.amount),send_currency:"USD",destination_country:APP.destination,priority:APP.priority||"balanced",urgency:APP.priority==="urgent",frequency:APP.frequency||null,delivery_method:APP.delivery||null,payment_method:APP.payment||null,special_need:APP.freeText||null,free_text:APP.freeText||null}}
async function startComparison(){
APP.amount=document.getElementById("amountInput")?.value||APP.amount;
APP.destination=document.getElementById("destinationInput")?.value||APP.destination;
if(!validateBasic())return;
renderLoading();
try{await ensureSession();await api(`/api/session/${encodeURIComponent(APP.sessionId)}/need`,{method:"POST",body:JSON.stringify(collectNeed())});APP.comparison=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/compare`,{method:"POST",body:"{}"});renderResults()}catch(e){renderError(e.message)}
}
async function startFreeText(){
APP.freeText=document.getElementById("freeTextInput")?.value.trim()||"";
if(!APP.freeText)return;
renderLoading();
try{await ensureSession();const r=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/need/parse`,{method:"POST",body:JSON.stringify({text:APP.freeText,language:APP.language})});const p=r.parsed||{};APP.amount=p.amount||"";APP.destination=p.destination_country||"";APP.priority=p.priority||"";if(p.urgency)APP.priority="urgent";if(!APP.amount||!APP.destination){renderRemittanceStart();return}await startComparison()}catch(e){renderError(e.message)}
}
function renderLoading(){document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="loading-card"><div class="loader large"></div><h2>${esc(t("options"))}</h2><p>${esc(t("loading"))}</p></section></main>`;bindLanguage(renderLoading)}
function resultId(r){return r?.provider_id||r?.id||""}
function countryName(code){return(APP.config?.countries||[]).find(x=>(x.id||x.code)===code)?.name||code}
function resultValue(r,k){return r?.[k]!==undefined?r[k]:null}
function renderResults(){
const d=APP.comparison||{},results=[...(d.results||[])],seen=new Set(results.map(x=>resultId(x)));(d.available_providers||[]).forEach(x=>{if(!seen.has(resultId(x))){results.push(x);seen.add(resultId(x))}});
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(d.verified_count?t("verified"):t("available"))}</div><h1>${esc(t("options"))}</h1><p>${esc(money(APP.amount))} → ${esc(countryName(APP.destination))}</p></div></section><div class="success-box"><strong>${esc(d.message||t("whatWeDo"))}</strong><p>${esc(d.explanation||"")}</p></div><section class="results-list">${results.map(renderResultCard).join("")}</section>${(d.differences||[]).length?`<section class="main-card" style="margin-top:18px"><h2>${esc(t("options"))}</h2>${d.differences.map(x=>`<div class="review-row"><div><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></div></div>`).join("")}</section>`:""}<footer class="footer"><button id="clearBtn">${esc(t("clear"))}</button></footer></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderRemittanceStart);
document.getElementById("clearBtn")?.addEventListener("click",confirmClear);
document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{const p=results.find(x=>resultId(x)===b.dataset.provider);if(p)renderFinalCheck(p)}));
bindLanguage(renderResults)
}
function renderResultCard(r,i){
const id=resultId(r),name=r.provider_name||id,verified=r.commercial_verified===true||r.commercial_status==="verified",fee=verified?resultValue(r,"fee"):null,rate=verified?resultValue(r,"exchange_rate"):null,recipient=verified?resultValue(r,"recipient_amount"):null,delivery=verified?(r.delivery_time??r.estimated_delivery):null,method=verified?r.delivery_method:null,url=r.continue_url||r.official_site||"";
return`<article class="provider-card"><div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div><span class="verified-pill">${verified?"✓ "+esc(t("verified")):esc(t("commercialUnavailable"))}</span></div><div class="provider-main"><div class="receive-box"><span>${esc(t("receive"))}</span><strong>${recipient!==null?money(recipient,r.currency||r.recipient_currency||"USD"):t("nothing")}</strong></div><div class="details-grid"><div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee):t("commercialUnavailable")}</strong></div><div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):t("commercialUnavailable")}</strong></div><div><span>${esc(t("delivery"))}</span><strong>${delivery!==null?esc(delivery):t("commercialUnavailable")}</strong></div><div><span>${esc(t("method"))}</span><strong>${method?esc(method):t("commercialUnavailable")}</strong></div></div>${r.payment_options?.length?`<div class="success-box"><strong>${esc(t("paymentWays"))}</strong><p>${r.payment_options.map(esc).join(" · ")}</p></div>`:""}${r.delivery_options?.length?`<div class="success-box"><strong>${esc(t("receiveWays"))}</strong><p>${r.delivery_options.map(esc).join(" · ")}</p></div>`:""}</div><div class="provider-foot">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("officialHelp"))}</a>`:""}</div><button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(t("check"))}</button></article>`
}
function renderFinalCheck(p){
const id=resultId(p),verified=p.commercial_verified===true||p.commercial_status==="verified";
if(!verified){renderProviderHelp(p,"general");return}
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(p.provider_name||id)}</h1><p>${esc(t("finalText"))}</p></div></section><section class="review-card"><h2>${esc(t("review"))}</h2><div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div><div class="review-row"><span>${esc(t("sendAmount"))}</span><strong>${money(APP.amount)}</strong></div><div class="review-row"><span>${esc(t("fee"))}</span><strong>${p.fee!=null?money(p.fee):t("commercialUnavailable")}</strong></div><div class="review-row"><span>${esc(t("rate"))}</span><strong>${p.exchange_rate!=null?esc(p.exchange_rate):t("commercialUnavailable")}</strong></div><div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${p.recipient_amount!=null?money(p.recipient_amount,p.currency||"USD"):t("commercialUnavailable")}</strong></div><div class="review-row"><span>${esc(t("delivery"))}</span><strong>${esc(p.delivery_method||t("commercialUnavailable"))}</strong></div><div class="review-actions"><button class="secondary-btn" id="backResults">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div><div id="finalStatus"></div></section></main>`;
document.getElementById("backBtn")?.addEventListener("click",renderResults);
document.getElementById("backResults")?.addEventListener("click",renderResults);
document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(p,id));
bindLanguage(()=>renderFinalCheck(p))
}
async function performFinalCheck(p,id){
const status=document.getElementById("finalStatus");status.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
try{await ensureSession();const r=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/final-check`,{method:"POST",body:JSON.stringify({language:APP.language,provider_id:id,amount:Number(APP.amount),send_currency:"USD",destination_country:APP.destination,delivery_method:p.delivery_method||null,payment_method:p.payment_method||null,recipient_amount:p.recipient_amount??null,fee:p.fee??null,exchange_rate:p.exchange_rate??null})});const url=p.continue_url||p.official_site;status.innerHTML=`<div class="success-box"><strong>✓ ${esc(t("verified"))}</strong><p>${esc(r.message||t("finalText"))}</p>${url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("goOfficial"))}</a>`:""}</div>`}catch(e){status.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`}
}
function renderProviderHelp(p,topic){
const urls=p.help_urls||{},url=urls[topic]||urls.general||p.help_url||p.official_site||p.continue_url;
const name=p.provider_name||"";
const messages={general:{es:"No vamos a adivinar. Aquí puedes ver la información oficial de esta remesadora.",en:"We will not guess. You can see this provider's official information here."},fee:{es:"No tenemos el costo actual comprobado. Puedes verlo directamente con la remesadora.",en:"We do not have the current verified cost. You can see it directly with the provider."},rate:{es:"No tenemos la tasa actual comprobada. Puedes verla directamente con la remesadora.",en:"We do not have the current verified rate. You can see it directly with the provider."},delivery:{es:"No tenemos el tiempo actual comprobado. Puedes consultar la entrega directamente con la remesadora.",en:"We do not have the current verified delivery time. You can check delivery directly with the provider."}};
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="review-card"><div class="hero-badge">● ${esc(t("helpTitle"))}</div><h1>${esc(name)}</h1><p>${esc(messages[topic]?.[APP.language]||messages.general[APP.language])}</p><div class="missing-box">${esc(t("noGuess"))}</div>${url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("goOfficial"))}</a>`:""}<button class="secondary-btn" id="backResults">${esc(t("back"))}</button></section></main>`;
document.getElementById("backResults")?.addEventListener("click",renderResults);
bindLanguage(()=>renderProviderHelp(p,topic))
}
function showHelp(){
const modal=document.getElementById("modal");if(!modal)return;
modal.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card"><button class="modal-close" id="modalClose">×</button><div class="hero-badge">?</div><h2>${esc(t("helpTitle"))}</h2><p>${esc(t("helpText"))}</p><button class="primary-btn" id="modalStart">${esc(t("start"))}</button></div></div>`;
document.getElementById("modalClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")modal.innerHTML=""});
document.getElementById("modalStart")?.addEventListener("click",()=>{modal.innerHTML="";renderFreeQuestion()})
}
function renderError(msg){document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="error-card"><div class="error-icon">!</div><h2>${esc(t("error"))}</h2><p>${esc(msg||"")}</p><button class="primary-btn" id="retryBtn">${esc(t("back"))}</button><button class="secondary-btn" id="clearBtn">${esc(t("clear"))}</button></section></main>`;document.getElementById("retryBtn")?.addEventListener("click",renderHome);document.getElementById("clearBtn")?.addEventListener("click",confirmClear);bindLanguage(()=>renderError(msg))}
function confirmClear(){
let modal=document.getElementById("modal");if(!modal){modal=document.createElement("div");modal.id="modal";document.body.appendChild(modal)}
modal.innerHTML=`<div class="modal-backdrop" id="clearBackdrop"><div class="modal-card"><button class="modal-close" id="clearClose">×</button><div class="hero-badge">●</div><h2>${esc(t("clearTitle"))}</h2><p>${esc(t("clearText"))}</p><button class="primary-btn" id="clearYes">${esc(t("clearYes"))}</button><button class="secondary-btn" id="clearNo">${esc(t("clearNo"))}</button></div></div>`;
document.getElementById("clearClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("clearNo")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("clearBackdrop")?.addEventListener("click",e=>{if(e.target.id==="clearBackdrop")modal.innerHTML=""});
document.getElementById("clearYes")?.addEventListener("click",clearEverything)
}
async function clearEverything(){
try{if(APP.sessionId)await fetch(`/api/session/${encodeURIComponent(APP.sessionId)}`,{method:"DELETE"})}catch(e){}
const lang=APP.language;
localStorage.clear();
APP.config=null;APP.sessionId=null;APP.amount="";APP.destination="";APP.priority="";APP.delivery="";APP.payment="";APP.frequency="";APP.freeText="";APP.comparison=null;APP.selectedProvider=null;APP.needType=null;APP.language=lang;
localStorage.setItem("remesas_language",lang);
try{await loadConfig();await createSession()}catch(e){}
renderHome();
showTemporary(t("cleared"))
}
function showTemporary(msg){const d=document.createElement("div");d.className="success-box";d.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:200;width:min(90%,500px);box-shadow:0 10px 30px rgba(0,0,0,.15)";d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
async function boot(){try{await loadConfig();await createSession();renderHome()}catch(e){renderError(e.message)}}
document.addEventListener("DOMContentLoaded",boot);
