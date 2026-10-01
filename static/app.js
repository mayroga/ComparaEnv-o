"use strict";
const APP={name:"REMESAS",version:"4.2.0",lang:localStorage.getItem("remesas_lang_v4")||"es",session:null,config:null,access:null,moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",prefsKey:"remesas_prefs_v4",timer:null,adminTaps:[],paymentChecking:false,learningCache:null};
const app=document.getElementById("app");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const t=(es,en)=>APP.lang==="en"?en:es;
const money=v=>new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v||0));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
function getJSON(k,f){try{return JSON.parse(localStorage.getItem(k)||"")??f}catch{return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function accessToken(){return sessionStorage.getItem("remesas_access_token_v4")||""}
function normalizeAccess(a){if(!a)return null;const token=a.access_token||a.token||accessToken(),until=Number(a.access_until||a.expires_at||a.expires||0);return{...a,access_token:token,access_until:until}}
function saveAccess(a){a=normalizeAccess(a);if(!a?.access_token)return;sessionStorage.setItem("remesas_access_token_v4",a.access_token);sessionStorage.setItem("remesas_access_until_v4",String(a.access_until||0));APP.access=a;startTimer()}
function clearAccess(){sessionStorage.removeItem("remesas_access_token_v4");sessionStorage.removeItem("remesas_access_until_v4");APP.access=null;if(APP.timer){clearInterval(APP.timer);APP.timer=null}}
function expiryMs(){return Number(APP.access?.access_until||sessionStorage.getItem("remesas_access_until_v4")||0)}
function remainingSeconds(){const e=expiryMs();return e?Math.max(0,Math.floor((e-Date.now())/1000)):0}
function accessActive(){const e=expiryMs();return !!accessToken()&&e>Date.now()}
function formatTime(s){s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function protectedEndpoint(u){return /^\/api\/(session|need|compare|final-check|local-data|learn|quick-guide|learning-pdf|help|assistant|chat)/.test(String(u))}
async function api(url,opt={}){
const h={"Content-Type":"application/json",...(opt.headers||{})},tok=accessToken();
if(tok)h["X-Remesas-Access-Token"]=tok;
const r=await fetch(url,{...opt,headers:h});
let d={};try{d=await r.json()}catch{}
if(!r.ok){
if((r.status===401||r.status===403)&&protectedEndpoint(url)){clearAccess();renderAccessGate()}
throw new Error(d.detail||d.error||d.message||t("No se pudo completar la operación.","The operation could not be completed."))
}
return d
}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);return APP.config}
async function checkAccess(){
try{
const d=await api("/api/access/status"),a=normalizeAccess(d.access||d);
if(a?.access_token&&a.access_until)saveAccess(a);else APP.access=a?.active?a:null;
return accessActive()
}catch{return false}
}
async function refreshAccess(){if(!accessToken())return false;return checkAccess()}
async function startSession(preserve=true){
if(!accessActive())throw new Error(t("Activa primero el servicio.","Activate the service first."));
if(preserve&&APP.session?.session_id){
try{APP.session=(await api(`/api/session/${APP.session.session_id}`)).session;return APP.session}catch{}
}
APP.session=(await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"})).session;
return APP.session
}
async function changeLanguage(){
APP.lang=APP.lang==="es"?"en":"es";
localStorage.setItem("remesas_lang_v4",APP.lang);
APP.learningCache=null;
try{await loadConfig();if(accessActive())renderHome();else renderAccessGate()}catch(e){showError(e.message)}
}
function topbar(title="REMESAS"){
const time=accessActive()?`<span class="access-clock">${formatTime(remainingSeconds())}</span>`:"";
return`<header class="topbar"><button class="icon-button" onclick="renderHome()" aria-label="${esc(t("Volver al inicio","Back to home"))}">←</button><strong>${esc(title)}</strong><span>${time}</span><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></header>`
}
function renderShell(content,title="REMESAS"){app.innerHTML=topbar(title)+`<main class="page">${content}</main>`;scrollTo(0,0);updateClock()}
function homeCard(icon,title,text,action){return`<button class="home-card" onclick="${action}"><span>${icon}</span><strong>${esc(title)}</strong><small>${esc(text)}</small></button>`}

function renderAccessGate(){
if(APP.timer){clearInterval(APP.timer);APP.timer=null}
const p=APP.config?.stripe||{},price=Number(p.price||10.99),minutes=Number(p.minutes||20);
app.innerHTML=`<main class="page access-page"><section class="card access-card"><div class="brand">REMESAS</div><h1>${esc(t("Tu dinero, más claro","Your money, clearer"))}</h1><p>${esc(t("Servicio informativo de una sola activación para organizar y preparar tu remesa.","One-time informational service to organize and prepare your remittance."))}</p><div class="price"><b>${money(price)}</b><span>${esc(t("una vez · "+minutes+" minutos","one time · "+minutes+" minutes"))}</span></div><div class="notice">${esc(t("No es banco, financiera, asesor financiero ni procesador de pagos. No recibimos ni enviamos tu dinero.","Not a bank, financial institution, financial advisor, or payment processor. We do not receive or send your money."))}</div><div class="notice">${esc(t("Privacidad: tus registros de dinero, gastos, familia y ahorro se guardan en este dispositivo. No escribas contraseñas bancarias, CVV, OTP ni credenciales de proveedores.","Privacy: your money, expense, family, and savings records stay on this device. Do not enter bank passwords, CVVs, OTPs, or provider credentials."))}</div><button class="primary" onclick="startPayment()">${esc(t("Activar servicio","Activate service"))}</button><button class="secondary" onclick="renderAbout()">${esc(t("Qué es REMESAS","What is REMESAS"))}</button><p class="small">${esc(t("El pago se procesa fuera de REMESAS. La remesa se completa directamente con el proveedor oficial.","Payment is processed outside REMESAS. The transfer is completed directly with the official provider."))}</p></section></main>`
}

async function startPayment(){
try{
const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang})});
if(!d.url)throw new Error(t("No se recibió el enlace de pago.","No payment link was received."));
location.href=d.url
}catch(e){showError(e.message)}
}

async function checkPaymentReturn(){
const q=new URLSearchParams(location.search),sid=q.get("session_id"),ok=q.get("payment")==="success"||!!sid;
if(!ok||APP.paymentChecking)return false;
APP.paymentChecking=true;
try{
const d=await api(`/api/payment/check?session_id=${encodeURIComponent(sid||"")}`),a=normalizeAccess(d.access||d);
if(a&&(d.active||d.authorized||a.active||a.authorized)){
saveAccess(a);
history.replaceState({},document.title,location.pathname);
await loadConfig();
showServiceReady();
return true
}
throw new Error(t("No se pudo confirmar el pago.","The payment could not be confirmed."))
}catch(e){showError(e.message);return false}
finally{APP.paymentChecking=false}
}

function showServiceReady(){
const m=Number(APP.config?.stripe?.minutes||20);
renderShell(`<section class="card center"><div class="status success">${esc(t("Servicio activado","Service activated"))}</div><h1>${esc(t("Ya puedes comenzar","You can start now"))}</h1><p>${esc(t(`Tienes ${m} minutos de acceso.`,`You have ${m} minutes of access.`))}</p></section>`,t("Listo","Ready"));
setTimeout(renderHome,900)
}
function startTimer(){if(APP.timer)clearInterval(APP.timer);APP.timer=setInterval(()=>{if(accessActive())updateClock();else if(accessToken())lockExpiredService()},1000);updateClock()}
function updateClock(){document.querySelectorAll(".access-clock").forEach(x=>x.textContent=formatTime(remainingSeconds()))}
function lockExpiredService(){clearAccess();APP.session=null;renderAccessExpired()}
function renderAccessExpired(){
app.innerHTML=`<main class="page"><section class="card center"><div class="status warning">${esc(t("Acceso terminado","Access ended"))}</div><h1>${esc(t("Tu sesión de servicio terminó","Your service session ended"))}</h1><p>${esc(t("Tus datos locales no se borran automáticamente.","Your local data is not deleted automatically."))}</p><button class="primary" onclick="renderAccessGate()">${esc(t("Volver a activar","Activate again"))}</button></section></main>`
}

function renderHome(){
if(!accessActive()){renderAccessGate();return}
const o=APP.config?.opening||{},appInfo=APP.config?.app||{};
const purpose=t("REMESAS te ayuda a entender, organizar y preparar una remesa sin tener que conocer la parte técnica. Te pregunta lo necesario, hace cálculos y te lleva a la fuente oficial cuando hace falta.","REMESAS helps you understand, organize, and prepare a remittance without needing to know the technical details. It asks what matters, does calculations, and takes you to the official source when needed.");
const legal=t("REMESAS es un servicio informativo de May Roga LLC. No es un banco, financiera, asesor financiero ni procesador de pagos. No recibe ni envía tu dinero y no completa la transferencia por ti.","REMESAS is an informational service from May Roga LLC. It is not a bank, financial institution, financial advisor, or payment processor. It does not receive or send your money or complete the transfer for you.");
app.innerHTML=`<header class="hero"><div class="hero-top"><strong>REMESAS</strong><span class="access-clock">${formatTime(remainingSeconds())}</span><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div><h1>${esc(o.primary_question||o.title?.[APP.lang]||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1><p>${esc(o.secondary_text||o.subtitle?.[APP.lang]||t("Entiende tu necesidad, organiza tus datos y continúa con la fuente oficial.","Understand your need, organize your information, and continue with the official source."))}</p></header><main class="home"><section class="notice"><b>${esc(t("¿Para qué sirve?","What is it for?"))}</b><p>${esc(purpose)}</p></section><section class="notice"><b>${esc(t("Importante","Important"))}</b><p>${esc(t("REMESAS no inventa tarifas, tasas, tiempos de entrega ni disponibilidad. Si un dato comercial actual no está verificado, lo verás como no verificado y podrás ir al sitio oficial.","REMESAS does not invent fees, exchange rates, delivery times, or availability. If current commercial data are not verified, they are shown as unverified and you can go to the official site."))}</p></section><div class="cycle">${["TENGO","GANO","GASTO","AHORRO","QUIERO","PUEDO","HAGO"].map(x=>`<span>${x}</span>`).join("")}</div><section class="quick-grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa opciones.","Prepare a transfer and review options."),"renderRemittance()")}${homeCard("📚",t("Aprender","Learn"),t("Aprende el proceso sin entrar al proveedor.","Learn the process without entering the provider."),"renderLearning()")}${homeCard("⚡",t("Guía rápida","Quick guide"),t("Pasos breves para revisar antes de enviar.","Short steps to review before sending."),"renderQuickGuide()")}${homeCard("💰",t("Mi dinero","My money"),t("Calcula lo que tienes disponible.","Calculate what you have available."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Convierte tu cálculo a una referencia semanal.","Convert your calculation to a weekly reference."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos.","Record and review expenses."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia local para una remesa.","Save a local transfer reference."),"renderFamily()")}${homeCard("❓",t("Ayuda","Help"),t("Encuentra una explicación práctica.","Find a practical explanation."),"renderHelp()")}${homeCard("🛒",t("Planear compra","Plan purchase"),t("Comprueba si cabe en tu cálculo.","Check whether it fits your calculation."),"renderPurchase()")}${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para una meta.","Reserve money for a goal."),"renderSavings()")}</section><section class="card"><h2>${esc(t("¿Qué necesitas hacer?","What do you need to do?"))}</h2><p class="small">${esc(t("Puedes escribirlo con tus propias palabras. La aplicación intentará entenderlo.","Use your own words. The app will try to understand you."))}</p><textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero enviar $200 a México...","Example: I want to send $200 to Mexico..."))}"></textarea><button class="primary" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button></section><section class="card"><h2>${esc(t("Tu información","Your information"))}</h2><button class="secondary" onclick="exportPDF()">${esc(t("Exportar PDF","Export PDF"))}</button><button class="secondary" onclick="importPDF()">${esc(t("Importar/restaurar PDF","Import/restore PDF"))}</button></section><section class="card"><h2>${esc(t("Protección y privacidad","Protection and privacy"))}</h2><p class="small">${esc(t("Tus datos personales de dinero se guardan en este dispositivo. La sesión de remesa del servidor es temporal. No escribas contraseñas bancarias, CVV, códigos de seguridad ni credenciales de proveedores aquí.","Your personal money data stays on this device. The server remittance session is temporary. Do not enter bank passwords, CVVs, security codes, or provider credentials here."))}</p><p class="small">${esc(legal)}</p><button class="secondary" onclick="renderAbout()">${esc(t("Ver qué hace y qué no hace REMESAS","See what REMESAS does and does not do"))}</button><button class="secondary" onclick="deleteLocalData()">${esc(t("Borrar mis datos de este dispositivo","Delete my data from this device"))}</button></section><footer>${esc(appInfo.brand||"May Roga LLC")} · v${esc(APP.version)}</footer></main>`;
updateClock()
}

function renderAbout(){
const legal=t("REMESAS es una herramienta informativa y de organización. No es banco, financiera, asesor financiero ni procesador de pagos. No ejecuta remesas. Los datos comerciales actuales solo se muestran cuando existen datos verificables. Si no existen, la aplicación te dirige al proveedor oficial para confirmar los datos antes de enviar.","REMESAS is an informational and organization tool. It is not a bank, financial institution, financial advisor, or payment processor. It does not execute remittances. Current commercial data are shown only when verifiable data exist. Otherwise, the app directs you to the official provider to confirm details before sending.");
renderShell(`<section class="card"><h1>${esc(t("REMESAS: qué hace","REMESAS: what it does"))}</h1><p>${esc(t("1. Entiende lo que necesitas. 2. Organiza monto, destino y preferencias. 3. Calcula datos que guardas en tu dispositivo. 4. Compara métodos y datos comerciales solo cuando pueden verificarse. 5. Te lleva al proveedor oficial para completar el proceso.","1. Understands what you need. 2. Organizes amount, destination, and preferences. 3. Calculates information you keep on your device. 4. Compares methods and commercial data only when they can be verified. 5. Takes you to the official provider to complete the process."))}</p><h2>${esc(t("Qué no hace","What it does not do"))}</h2><p>${esc(legal)}</p><h2>${esc(t("Tus datos","Your data"))}</h2><p>${esc(t("Los registros de Mi dinero, gastos, familia y ahorro se guardan en localStorage de este navegador. Puedes borrarlos desde el inicio. REMESAS no usa esos registros como una base de datos personal permanente del servidor.","Records from My money, expenses, family, and savings are stored in this browser's localStorage. You can delete them from the home screen. REMESAS does not use those records as a permanent personal database on the server."))}</p><h2>${esc(t("Impuestos","Taxes"))}</h2><p>${esc(t("La organización de tus ingresos y gastos puede darte datos que después puedes entregar a tu contador o preparador de impuestos. REMESAS no prepara, presenta ni calcula tus impuestos.","Organized income and expense information can give you records you may later provide to your accountant or tax preparer. REMESAS does not prepare, file, or calculate your taxes."))}</p><button class="primary" onclick="renderHome()">${esc(t("Entendido","Understood"))}</button></section>`,t("Información","Information"))
}

function countryCode(c){return String(c?.id||c?.code||"").toUpperCase()}
function countryName(code){const c=(APP.config?.countries||[]).find(x=>countryCode(x)===String(code||"").toUpperCase());return c?.name?.[APP.lang]||c?.name?.es||code||""}
function priorityLabel(v){return({recipient_gets_more:t("Que reciba más","Recipient gets more"),fastest:t("Rapidez","Speed"),save:t("Ahorrar","Save"),balanced:t("Equilibrio","Balanced"),urgent:t("Urgente","Urgent"),compare_all:t("Comparar","Compare")}[v]||v||"")}
function frequencyLabel(v){return({weekly:t("Semanal","Weekly"),biweekly:t("Quincenal","Biweekly"),monthly:t("Mensual","Monthly"),one_time:t("Una vez","One time")}[v]||v||"")}
function methodLabel(x){if(typeof x==="string")return x;return x?.label?.[APP.lang]||x?.label?.es||x?.name||x?.id||""}

async function understandNeed(){
const text=(document.getElementById("freeNeed")?.value||"").trim();
if(!text){showError(t("Escribe primero qué necesitas.","Write what you need first."));return}
try{
const d=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.lang})}),p=d.parsed||{};
if(p.need_type==="remittance"||p.amount||p.destination_country)await beginParsedRemittance(p);
else renderShell(`<section class="card"><div class="status success">${esc(t("Entendido","Understood"))}</div><h1>${esc(t("Vamos paso a paso","Let's go step by step"))}</h1><p>${esc(t("Todavía no tengo suficiente información para una acción concreta. Podemos empezar por preparar una remesa o puedes elegir otra ayuda.","I do not have enough information for a concrete action yet. We can start by preparing a transfer or you can choose another help option."))}</p><button class="primary" onclick="renderRemittance()">${esc(t("Preparar una remesa","Prepare a transfer"))}</button><button class="secondary" onclick="renderHelp()">${esc(t("Ver ayuda","View help"))}</button></section>`,t("Tu necesidad","Your need"))
}catch(e){showError(e.message)}
}

async function beginParsedRemittance(p){
try{
await startSession(true);
const body={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance"};
["amount","destination_country","priority","urgency","frequency","delivery_method","payment_method","recipient_amount_target","special_need"].forEach(k=>{if(p[k]!=null)body[k]=p[k]});
APP.session=(await api("/api/need",{method:"POST",body:JSON.stringify(body)})).session;
renderRemittance(p)
}catch(e){showError(e.message)}
}

function renderRemittance(p={}){
const s=APP.session||{},amount=s.amount??p.amount??"",country=s.destination_country||p.destination_country||"",priority=s.priority||p.priority||"",urgency=s.urgency??p.urgency??"",frequency=s.frequency||p.frequency||"",delivery=s.delivery_method||p.delivery_method||"",payment=s.payment_method||p.payment_method||"";
renderShell(`<section class="card"><h1>${esc(t("Enviar dinero","Send money"))}</h1><p class="small">${esc(t("Solo preguntamos lo que puede cambiar el siguiente paso. Si no sabes una respuesta, puedes dejarla sin elegir.","We only ask what can change the next step. If you do not know an answer, you can leave it unselected."))}</p><label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="sendAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}"><label>${esc(t("¿A qué país?","Which country?"))}</label><select id="sendCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${esc(id)}" ${id===country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select><label>${esc(t("¿Qué importa más?","What matters most?"))}</label><select id="sendPriority"><option value="">${esc(t("No estoy seguro","Not sure"))}</option>${["recipient_gets_more","fastest","save","balanced"].map(x=>`<option value="${x}" ${priority===x?"selected":""}>${esc(priorityLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Es urgente?","Is it urgent?"))}</label><select id="sendUrgency"><option value="">${esc(t("No estoy seguro","Not sure"))}</option><option value="true" ${urgency===true?"selected":""}>${esc(t("Sí","Yes"))}</option><option value="false" ${urgency===false?"selected":""}>${esc(t("No","No"))}</option></select><label>${esc(t("¿Cada cuánto envías?","How often do you send?"))}</label><select id="sendFrequency"><option value="">${esc(t("Una vez / no sé","One time / not sure"))}</option>${["one_time","weekly","biweekly","monthly"].map(x=>`<option value="${x}" ${frequency===x?"selected":""}>${esc(frequencyLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Cómo recibe?","How does the recipient receive?"))}</label><select id="sendDelivery"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.delivery_methods||[]).map(x=>`<option value="${esc(x.id)}" ${x.id===delivery?"selected":""}>${esc(methodLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label><select id="sendPayment"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.payment_methods||[]).map(x=>`<option value="${esc(x.id)}" ${x.id===payment?"selected":""}>${esc(methodLabel(x))}</option>`).join("")}</select><div id="moneyWarning"></div><button class="primary" onclick="compare()">${esc(t("Revisar opciones","Review options"))}</button></section>`,t("Enviar dinero","Send money"));
document.getElementById("sendAmount")?.addEventListener("input",updateMoneyWarning);
updateMoneyWarning()
}

function getMoneyState(){return getJSON(APP.moneyKey,{income:0,incomeFreq:"monthly",monthlyIncome:0,essential:0,flexible:0,savings:0,remittance:0,available:0})}
function updateMoneyWarning(){
const box=document.getElementById("moneyWarning");if(!box)return;
const a=num(document.getElementById("sendAmount")?.value),m=getMoneyState(),av=num(m.available),w=[];
if(av>0&&a>av)w.push(t(`El monto supera tu disponible calculado (${money(av)}).`,`The amount exceeds your calculated available balance (${money(av)}).`));
if(a>10000)w.push(t("Por este monto conviene revisar cuidadosamente los datos finales del proveedor.","For this amount, carefully review the provider's final details."));
box.innerHTML=w.length?`<div class="status warning">${w.map(esc).join("<br>")}</div>`:""
}

async function compare(){
const amount=num(document.getElementById("sendAmount")?.value),destination=document.getElementById("sendCountry")?.value||"";
if(!amount||amount<=0){showError(t("Indica un monto válido.","Enter a valid amount."));return}
if(amount>1000000){showError(t("El monto supera el límite de esta herramienta.","The amount exceeds this tool's limit."));return}
if(!destination){showError(t("Selecciona el país de destino.","Select the destination country."));return}
try{
await startSession(true);
const uv=document.getElementById("sendUrgency")?.value||"";
APP.session=(await api("/api/need",{method:"POST",body:JSON.stringify({session_id:APP.session.session_id,language:APP.lang,need_type:"remittance",amount,destination_country:destination,priority:document.getElementById("sendPriority")?.value||null,urgency:uv===""?null:uv==="true",frequency:document.getElementById("sendFrequency")?.value||null,delivery_method:document.getElementById("sendDelivery")?.value||null,payment_method:document.getElementById("sendPayment")?.value||null})})).session;
renderLoading();
const r=await api(`/api/session/${APP.session.session_id}/compare`,{method:"POST"});
APP.session.available_providers=r.available_providers||[];
APP.session.verified_results=r.results||[];
renderComparison(r)
}catch(e){showError(e.message)}
}

function renderLoading(){renderShell(`<section class="card center"><div class="loader"></div><h2>${esc(t("Revisando opciones","Reviewing options"))}</h2><p>${esc(t("Comprobamos lo que puede mostrarse. No inventaremos datos comerciales.","We check what can be shown. We will not invent commercial data."))}</p></section>`,t("Revisión","Review"))}

function providerCard(p){
const id=p.provider_id||p.id||"",r=(APP.session?.verified_results||[]).find(x=>x.provider_id===id),verified=Boolean(p.commercial_verified||p.commercial_status==="verified"||r?.status==="verified"),url=p.continue_url||p.official_site||p.official_urls?.send_money||p.official_urls?.site;
const payment=(p.payment_methods||[]).map(methodLabel).filter(Boolean),delivery=(p.delivery_methods||[]).map(methodLabel).filter(Boolean);
return`<article class="provider-card"><div class="provider-head"><h3>${esc(p.provider_name||p.name||id)}</h3><span class="status ${verified?"success":"warning"}">${esc(verified?t("Datos verificados","Verified data"):t("Revisar sitio oficial","Review official site"))}</span></div>${verified&&r?`<div class="metric-grid"><div><small>${esc(t("Tarifa","Fee"))}</small><b>${r.fee!=null?money(r.fee):"—"}</b></div><div><small>${esc(t("Tasa","Rate"))}</small><b>${esc(r.exchange_rate??"—")}</b></div><div><small>${esc(t("Recibe","Gets"))}</small><b>${r.recipient_amount!=null?money(r.recipient_amount):"—"}</b></div><div><small>${esc(t("Entrega","Delivery"))}</small><b>${esc(r.estimated_delivery??r.delivery_time??"—")}</b></div></div>`:`<p class="small">${esc(t("No mostramos tarifas, tasas, tiempos ni disponibilidad como datos actuales porque no están verificados.","We do not show fees, rates, timing, or availability as current data because they are not verified."))}</p>`}${payment.length?`<p class="small"><b>${esc(t("Cómo pagas:","How you pay:"))}</b> ${esc(payment.join(", "))}</p>`:""}${delivery.length?`<p class="small"><b>${esc(t("Cómo recibe:","How recipient receives:"))}</b> ${esc(delivery.join(", "))}</p>`:""}${p.supports_online?`<p class="small">${esc(t("Disponible en línea según el registro de esta aplicación.","Online availability is listed in this app's provider data."))}</p>`:""}${p.supports_agent?`<p class="small">${esc(t("También aparece con atención en agente.","Agent service is also listed."))}</p>`:""}${url?`<button class="primary" onclick="selectProvider(${JSON.stringify(id)})">${esc(t("Revisar proveedor","Review provider"))}</button>`:""}</article>`
}

function renderComparison(data){
const providers=data.available_providers||[],verified=num(data.verified_count??(data.results||[]).length);
renderShell(`<section class="card"><div class="status ${data.results_available?"success":"warning"}">${esc(data.results_available?t(`${verified} opción(es) con datos verificados`,`${verified} option(s) with verified data`):t("No hay datos comerciales actuales verificados","No current verified commercial data"))}</div><h1>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h1><div class="summary"><b>${esc(data.destination_name||countryName(data.destination_country))}</b><span>${money(data.amount)}</span></div><p>${esc(data.explanation||"")}</p>${providers.length?`<div class="provider-list">${providers.map(providerCard).join("")}</div>`:`<div class="status warning">${esc(t("No encontramos proveedores para este destino en el catálogo actual.","No providers were found for this destination in the current catalog."))}</div>`}<div class="notice">${esc(t("La disponibilidad, la tarifa, la tasa, el tiempo, los requisitos y los datos finales se confirman directamente con el proveedor.","Availability, fee, rate, timing, requirements, and final details must be confirmed directly with the provider."))}</div><button class="secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button><button class="secondary" onclick="renderHome()">${esc(t("Volver al inicio","Back to home"))}</button></section>`,t("Opciones","Options"))
}

async function selectProvider(id){
try{
const d=await api(`/api/session/${APP.session.session_id}/select/${encodeURIComponent(id)}`,{method:"POST"});
APP.session=d.session;renderFinalCheck()
}catch(e){showError(e.message)}
}

async function renderFinalCheck(){
if(!APP.session?.selected_option){showError(t("Selecciona primero un proveedor.","Select a provider first."));return}
try{
const d=await api(`/api/session/${APP.session.session_id}/final-check`,{method:"POST"}),o=APP.session.selected_option,url=o.continue_url||o.official_site||o.official_urls?.send_money||o.official_urls?.site||"";
renderShell(`<section class="card"><div class="status ${d.ready_to_continue?"success":"warning"}">${esc(d.ready_to_continue?t("Revisión básica completada","Basic review completed"):t("Revisa los datos","Review the details"))}</div><h1>${esc(o.provider_name||o.name||"")}</h1><p>${esc(d.message||"")}</p><div class="checks">${(d.checks||[]).map(c=>{const ok=Boolean(c.complete)&&c.status!=="review";return`<div class="check ${ok?"ok":"bad"}"><b>${ok?"✓":"!"}</b><span><strong>${esc(c.label)}</strong> ${esc(String(c.value??""))}</span></div>`}).join("")}</div><div class="notice">${esc(t("El destinatario, la tarifa, la tasa, el tiempo, la disponibilidad y los requisitos deben confirmarse en el sitio oficial. No introduzcas aquí contraseñas, CVV ni códigos de seguridad.","Recipient information, fee, rate, timing, availability, and requirements must be confirmed on the official site. Do not enter passwords, CVVs, or security codes here."))}</div>${(d.requirements||[]).length?`<p class="small"><b>${esc(t("Requisitos declarados:","Declared requirements:"))}</b> ${(d.requirements||[]).map(x=>esc(methodLabel(x))).join(", ")}</p>`:""}${url?`<button class="primary" onclick="openOfficial(${JSON.stringify(url)})">${esc(t("Abrir sitio oficial","Open official site"))}</button>`:""}<button class="secondary" onclick="renderComparisonFromSession()">${esc(t("Ver otros proveedores","See other providers"))}</button></section>`,t("Revisión final","Final review"))
}catch(e){showError(e.message)}
}

function openOfficial(url){
if(!/^https:\/\//i.test(String(url||""))){showError(t("El enlace oficial no es válido.","The official link is not valid."));return}
window.open(url,"_blank","noopener,noreferrer")
}
function renderComparisonFromSession(){
const data={available_providers:APP.session?.available_providers||[],results:APP.session?.verified_results||[],verified_count:(APP.session?.verified_results||[]).length,results_available:(APP.session?.verified_results||[]).length>0,amount:APP.session?.amount,destination_country:APP.session?.destination_country,destination_name:countryName(APP.session?.destination_country),explanation:t("Estas son las opciones de la sesión actual.","These are the options from the current session.")};
renderComparison(data)
}

function renderMoney(){
const m=getMoneyState();
renderShell(`<section class="card"><h1>${esc(t("Mi dinero","My money"))}</h1><p class="small">${esc(t("Este cálculo es tuyo; no es un saldo bancario. Tus registros se guardan en este dispositivo.","This is your calculation; it is not a bank balance. Your records stay on this device."))}</p><label>${esc(t("Ingreso","Income"))}</label><input id="income" type="number" min="0" step=".01" value="${esc(m.income||"")}"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq"><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="monthly">${esc(t("Mensual","Monthly"))}</option></select><label>${esc(t("Gastos esenciales","Essential expenses"))}</label><input id="essential" type="number" min="0" step=".01" value="${esc(m.essential||"")}"><label>${esc(t("Gastos flexibles","Flexible expenses"))}</label><input id="flexible" type="number" min="0" step=".01" value="${esc(m.flexible||"")}"><label>${esc(t("Ahorro reservado","Reserved savings"))}</label><input id="savings" type="number" min="0" step=".01" value="${esc(m.savings||"")}"><label>${esc(t("Remesas reservadas","Reserved remittance"))}</label><input id="remittance" type="number" min="0" step=".01" value="${esc(m.remittance||"")}"><button class="primary" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button><div id="moneyResult"></div><p class="small">${esc(t("Estos registros pueden servirte como referencia para entregar información a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.","These records can serve as a reference when giving information to your accountant or tax preparer. REMESAS does not prepare or file taxes."))}</p></section>`,t("Mi dinero","My money"));
document.getElementById("incomeFreq").value=m.incomeFreq||"monthly";
if(num(m.income))showMoneyResult(m)
}
function frequencyFactor(f){return f==="weekly"?52/12:f==="biweekly"?26/12:1}
function calculateMoney(){
const income=num(document.getElementById("income")?.value),freq=document.getElementById("incomeFreq")?.value||"monthly",essential=num(document.getElementById("essential")?.value),flexible=num(document.getElementById("flexible")?.value),savings=num(document.getElementById("savings")?.value),remittance=num(document.getElementById("remittance")?.value);
if([income,essential,flexible,savings,remittance].some(x=>x<0)){showError(t("Los valores no pueden ser negativos.","Values cannot be negative."));return}
const monthlyIncome=income*frequencyFactor(freq),available=monthlyIncome-essential-flexible-savings-remittance,d={income,incomeFreq:freq,monthlyIncome,essential,flexible,savings,remittance,available,updatedAt:new Date().toISOString()};
setJSON(APP.moneyKey,d);showMoneyResult(d)
}
function showMoneyResult(d){
const a=num(d.available),box=document.getElementById("moneyResult");
if(box)box.innerHTML=`<div class="money-summary"><span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span><b>${money(d.monthlyIncome)}</b><span>${esc(t("Disponible calculado","Calculated available"))}</span><b>${money(a)}</b></div><div class="status ${a>=0?"success":"warning"}">${esc(a>=0?t("PUEDO: el cálculo queda por encima de cero.","I CAN: the calculation remains above zero."):t("PUEDO: tus compromisos superan el ingreso calculado.","I CAN: your commitments exceed calculated income."))}</div><button class="primary" onclick="renderRemittance()">${esc(t("Usar este cálculo para una remesa","Use this calculation for a transfer"))}</button>`
}
function renderWeek(){
const m=getMoneyState();if(!m.monthlyIncome){renderMoney();return}
const q=num(m.monthlyIncome)/4.333333,commit=(num(m.essential)+num(m.flexible)+num(m.savings)+num(m.remittance))/4.333333,a=q-commit;
renderShell(`<section class="card"><h1>${esc(t("Mi semana","My week"))}</h1><div class="money-summary"><span>${esc(t("Ingreso semanal equivalente","Equivalent weekly income"))}</span><b>${money(q)}</b><span>${esc(t("Compromisos semanales","Weekly commitments"))}</span><b>${money(commit)}</b><span>${esc(t("Disponible semanal","Weekly available"))}</span><b>${money(a)}</b></div><div class="status ${a>=0?"success":"warning"}">${esc(a>=0?t("Puedes usar esta cifra como referencia semanal.","You can use this figure as a weekly reference."):t("Revisa tus compromisos antes de aumentar gasto o remesa.","Review commitments before increasing spending or transfers."))}</div><button class="primary" onclick="renderMoney()">${esc(t("Modificar cálculo","Modify calculation"))}</button></section>`,t("Mi semana","My week"))
}

function getExpenses(){return getJSON(APP.expensesKey,[])}
function renderExpenses(){
const e=getExpenses();
renderShell(`<section class="card"><h1>${esc(t("Mis gastos","My expenses"))}</h1><p class="small">${esc(t("Guardar aquí te ayuda a ver cuánto sale y luego usar ese dato en Mi dinero.","Saving expenses here helps you see what goes out and then use that information in My money."))}</p><label>${esc(t("Descripción","Description"))}</label><input id="expenseName" maxlength="120"><label>${esc(t("Monto","Amount"))}</label><input id="expenseAmount" type="number" min=".01" step=".01"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expenseFrequency"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="one_time">${esc(t("Una vez","One time"))}</select><button class="primary" onclick="addExpense()">${esc(t("Guardar gasto","Save expense"))}</button><div>${e.map((x,i)=>`<div class="expense-row"><span><b>${esc(x.description)}</b><small>${esc(frequencyLabel(x.frequency))}</small></span><b>${money(x.amount)}</b><button class="danger-button" onclick="removeExpense(${i})" aria-label="${esc(t("Borrar gasto","Delete expense"))}">×</button></div>`).join("")}</div><button class="secondary" onclick="renderMoney()">${esc(t("Actualizar Mi dinero","Update My money"))}</button></section>`,t("Mis gastos","My expenses"))
}
function addExpense(){
const d=(document.getElementById("expenseName")?.value||"").trim(),a=num(document.getElementById("expenseAmount")?.value),f=document.getElementById("expenseFrequency")?.value||"monthly";
if(!d||!a||a<=0){showError(t("Completa descripción y monto válido.","Enter a description and valid amount."));return}
const e=getExpenses();e.push({description:d,amount:a,frequency:f,createdAt:new Date().toISOString()});setJSON(APP.expensesKey,e);renderExpenses()
}
function removeExpense(i){const e=getExpenses();e.splice(i,1);setJSON(APP.expensesKey,e);renderExpenses()}

function renderFamily(){
const d=getJSON(APP.familyKey,{name:"",country:"",amount:""});
renderShell(`<section class="card"><h1>${esc(t("Familia","Family"))}</h1><p class="small">${esc(t("Solo es una referencia local; no crea una orden de envío.","This is only a local reference; it does not create a transfer order."))}</p><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="familyName" maxlength="80" value="${esc(d.name)}"><label>${esc(t("País","Country"))}</label><select id="familyCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${esc(id)}" ${id===d.country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select><label>${esc(t("Monto de referencia","Reference amount"))}</label><input id="familyAmount" type="number" min="0" step=".01" value="${esc(d.amount)}"><button class="primary" onclick="saveFamily()">${esc(t("Guardar en este dispositivo","Save on this device"))}</button></section>`,t("Familia","Family"))
}
function saveFamily(){setJSON(APP.familyKey,{name:(document.getElementById("familyName")?.value||"").trim(),country:document.getElementById("familyCountry")?.value||"",amount:num(document.getElementById("familyAmount")?.value)});renderHome()}

function renderSavings(){
const m=getMoneyState();
renderShell(`<section class="card"><h1>${esc(t("Ahorrar","Save"))}</h1><p class="small">${esc(t("Reserva una cantidad y deja la referencia guardada en este dispositivo.","Reserve an amount and keep the reference on this device."))}</p><label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label><input id="saveAmount" type="number" min="0" step=".01" value="${esc(m.savings||"")}"><label>${esc(t("¿Para qué?","What for?"))}</label><input id="savePurpose" maxlength="100" value="${esc(m.savingsPurpose||"")}"><button class="primary" onclick="saveSavings()">${esc(t("Guardar objetivo","Save goal"))}</button></section>`,t("Ahorrar","Save"))
}
function saveSavings(){
const m=getMoneyState();
m.savings=num(document.getElementById("saveAmount")?.value);
m.savingsPurpose=(document.getElementById("savePurpose")?.value||"").trim();
setJSON(APP.moneyKey,m);renderMoney()
}

function renderPurchase(){
renderShell(`<section class="card"><h1>${esc(t("Planear una compra","Plan a purchase"))}</h1><p class="small">${esc(t("La aplicación compara el precio con tu disponible calculado; no decide por ti si debes comprar.","The app compares the price with your calculated available amount; it does not decide whether you should buy."))}</p><label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label><input id="purchaseName" maxlength="120"><label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label><input id="purchaseAmount" type="number" min=".01" step=".01"><button class="primary" onclick="checkPurchase()">${esc(t("Comprobar","Check"))}</button></section>`,t("Planear una compra","Plan a purchase"))
}
function checkPurchase(){
const n=(document.getElementById("purchaseName")?.value||"").trim(),a=num(document.getElementById("purchaseAmount")?.value),m=getMoneyState(),d=num(m.available)-a;
if(!n||!a||a<=0){showError(t("Completa nombre y precio.","Enter a name and valid price."));return}
renderShell(`<section class="card"><div class="status ${d>=0?"success":"warning"}">${esc(d>=0?t("PUEDO: cabe en tu cálculo actual.","I CAN: it fits your current calculation."):t("PUEDO: supera tu disponible actual.","I CAN: it exceeds your current available amount."))}</div><h1>${esc(n)}</h1><div class="money-summary"><span>${esc(t("Precio","Price"))}</span><b>${money(a)}</b><span>${esc(t("Después de comprar","After purchase"))}</span><b>${money(d)}</b></div><button class="primary" onclick="renderMoney()">${esc(t("Revisar Mi dinero","Review My money"))}</button></section>`,t("Resultado","Result"))
}

function renderHelp(){
const topics=APP.config?.help_topics||APP.config?.help_center?.topics||[];
renderShell(`<section class="card"><h1>${esc(t("¿Qué no entiendes?","What don't you understand?"))}</h1><p class="small">${esc(t("Elige una pregunta y recibirás una respuesta práctica.","Choose a question and you will get a practical answer."))}</p>${topics.map(x=>`<button class="help-item" onclick="showHelpTopic(${JSON.stringify(x.id)})"><b>${esc(x.title?.[APP.lang]||x.title?.es||x.title||x.id)}</b></button>`).join("")}<button class="secondary" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button></section>`,t("Ayuda","Help"))
}
function showHelpTopic(id){
const x=(APP.config?.help_topics||APP.config?.help_center?.topics||[]).find(a=>a.id===id);
if(!x)return;
renderShell(`<section class="card"><h1>${esc(x.title?.[APP.lang]||x.title?.es||x.title||id)}</h1><p>${esc(x.answer?.[APP.lang]||x.answer?.es||x.answer||"")}</p><button class="primary" onclick="renderHelp()">${esc(t("Ver más ayuda","More help"))}</button></section>`,x.title?.[APP.lang]||x.title?.es||x.title||id)
}

function learningProviders(){return APP.config?.providers||[{id:"western_union",name:"Western Union"},{id:"moneygram",name:"MoneyGram"},{id:"remitly",name:"Remitly"},{id:"xoom",name:"Xoom"}]}
async function loadLearning(id=""){
const u=id?`/api/learn/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.lang)}`:`/api/learn?language=${encodeURIComponent(APP.lang)}`;
return api(u)
}
function renderLearning(){
const ps=learningProviders();
renderShell(`<section class="card"><h1>${esc(t("Aprender","Learn"))}</h1><p>${esc(t("Contenido educativo original para entender el proceso. No es entrenamiento oficial del proveedor.","Original educational content to understand the process. It is not official provider training."))}</p>${ps.map(p=>{const id=p.id||p.provider_id;return`<button class="help-item" onclick="renderProviderLearning(${JSON.stringify(id)})"><b>${esc(p.name||p.provider_name||id)}</b><small>${esc(t("Ver pasos y fuente oficial","View steps and official source"))}</small></button>`}).join("")}<button class="secondary" onclick="downloadLearningPDF()">${esc(t("Crear PDF educativo","Create learning PDF"))}</button></section>`,t("Aprender","Learn"))
}
async function renderProviderLearning(id){
try{
const d=await loadLearning(id),title=d.title?.[APP.lang]||d.title?.es||d.provider_name||id,steps=d.steps||d.lessons||[];
renderShell(`<section class="card"><h1>${esc(title)}</h1><p>${esc(d.intro?.[APP.lang]||d.intro?.es||d.description||t("Revisa estos pasos antes de continuar.","Review these steps before continuing."))}</p><ol>${steps.map(s=>`<li><b>${esc(s.title?.[APP.lang]||s.title?.es||s.title||"")}</b><p>${esc(s.text?.[APP.lang]||s.text?.es||s.text||s.description||"")}</p></li>`).join("")}</ol>${d.official_url||d.official_site?`<button class="primary" onclick="openOfficial(${JSON.stringify(d.official_url||d.official_site)})">${esc(t("Fuente oficial","Official source"))}</button>`:""}<button class="secondary" onclick="downloadLearningPDF(${JSON.stringify(id)})">${esc(t("Crear PDF educativo","Create learning PDF"))}</button><button class="secondary" onclick="renderLearning()">${esc(t("Volver a aprender","Back to learning"))}</button></section>`,title)
}catch(e){showError(e.message)}
}
async function renderQuickGuide(id=""){
try{
const u=id?`/api/quick-guide/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.lang)}`:`/api/quick-guide?language=${encodeURIComponent(APP.lang)}`;
const d=await api(u),steps=d.steps||d.items||[];
renderShell(`<section class="card"><h1>${esc(d.title?.[APP.lang]||d.title?.es||t("Guía rápida","Quick guide"))}</h1><ol>${steps.map(s=>`<li>${esc(s.text?.[APP.lang]||s.text?.es||s.text||s.title||s)}</li>`).join("")}</ol>${d.official_url?`<button class="primary" onclick="openOfficial(${JSON.stringify(d.official_url)})">${esc(t("Fuente oficial","Official source"))}</button>`:""}<button class="secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></section>`,t("Guía rápida","Quick guide"))
}catch(e){showError(e.message)}
}

function showError(m){
const old=document.querySelector(".error-box");if(old)old.remove();
const b=document.createElement("div");
b.className="error-box";
b.innerHTML=`<b>${esc(t("Atención","Attention"))}</b><span>${esc(m)}</span><button onclick="this.parentElement.remove()">×</button>`;
document.body.appendChild(b);
setTimeout(()=>b.remove(),7000)
}

function loadScript(src){
return new Promise((resolve,reject)=>{
const s=document.createElement("script");
s.src=src;
s.onload=resolve;
s.onerror=()=>reject(new Error(t("No se pudo cargar una herramienta PDF.","A PDF tool could not be loaded.")));
document.head.appendChild(s)
})
}
async function ensurePDF(){
if(!window.jspdf?.jsPDF)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
if(!window.pdfjsLib)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
if(window.pdfjsLib&&!window.pdfjsLib.GlobalWorkerOptions)throw new Error("PDF.js no está disponible.");
if(window.pdfjsLib)window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
}

function snapshotData(){
return{format:"REMESAS_RECOVERY_V1",version:1,language:APP.lang,money:getMoneyState(),expenses:getExpenses(),family:getJSON(APP.familyKey,{}),prefs:getJSON(APP.prefsKey,{}),created_at:new Date().toISOString()}
}
function b64urlEncode(v){
const bytes=new TextEncoder().encode(JSON.stringify(v));let s="";
for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")
}
function b64urlDecode(s){
s=s.replace(/-/g,"+").replace(/_/g,"/");
while(s.length%4)s+="=";
const bin=atob(s),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
return JSON.parse(new TextDecoder().decode(bytes))
}

async function exportPDF(){
try{
await ensurePDF();
const {jsPDF}=window.jspdf,d=snapshotData(),pdf=new jsPDF(),W=pdf.internal.pageSize.getWidth(),payload=b64urlEncode(d);
let y=18;
const line=(txt,size=11,gap=7)=>{
if(y>275){pdf.addPage();y=18}
pdf.setFontSize(size);
pdf.text(String(txt),14,y,{maxWidth:W-28});
y+=gap
};
line("REMESAS",20,10);
line(t("Resumen local y recuperación","Local summary and recovery"),13,10);
line(new Date().toLocaleString(),9,8);
line(t("Datos guardados en este dispositivo. REMESAS no prepara ni presenta impuestos.","Data saved on this device. REMESAS does not prepare or file taxes."),9,10);
line(t(`Ingreso mensual equivalente: ${money(d.money.monthlyIncome)}`,`Equivalent monthly income: ${money(d.money.monthlyIncome)}`));
line(t(`Disponible calculado: ${money(d.money.available)}`,`Calculated available: ${money(d.money.available)}`));
line(t(`Ahorro reservado: ${money(d.money.savings)}`,`Reserved savings: ${money(d.money.savings)}`));
line(t(`Remesa reservada: ${money(d.money.remittance)}`,`Reserved remittance: ${money(d.money.remittance)}`),11,10);
line(t("Gastos","Expenses"),14,8);
if(d.expenses.length)d.expenses.forEach(x=>line(`${x.description} · ${money(x.amount)} · ${frequencyLabel(x.frequency)}`,9,6));
else line(t("Sin gastos registrados.","No recorded expenses."),9,7);
line(t("Familia / referencia","Family / reference"),14,8);
if(d.family?.name)line(`${d.family.name}${d.family.country?` · ${countryName(d.family.country)}`:""}${d.family.amount?` · ${money(d.family.amount)}`:""}`,9,7);
else line(t("Sin referencia familiar registrada.","No family reference recorded."),9,7);
line(t("Recuperación","Recovery"),14,8);
line("REMESAS_RECOVERY_V1",8,5);
for(let i=0;i<payload.length;i+=90)line(payload.slice(i,i+90),6,4);
line("REMESAS_RECOVERY_END",8,6);
line(t("Conserve este PDF en un lugar seguro. El bloque de recuperación permite importar los datos en REMESAS.","Keep this PDF in a safe place. The recovery block allows the data to be imported into REMESAS."),8,6);
pdf.save("REMESAS_Recovery.pdf")
}catch(e){showError(e.message)}
}

async function importPDF(){
const input=document.createElement("input");
input.type="file";
input.accept="application/pdf,.pdf";
input.onchange=async()=>{
const f=input.files?.[0];if(!f)return;
try{
await ensurePDF();
const buf=await f.arrayBuffer(),pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
let text="";
for(let i=1;i<=pdf.numPages;i++){
const page=await pdf.getPage(i),c=await page.getTextContent();
text+=c.items.map(x=>x.str).join(" ")+"\\n"
}
const a=text.indexOf("REMESAS_RECOVERY_V1"),b=text.indexOf("REMESAS_RECOVERY_END",a);
if(a<0||b<0)throw new Error(t("Este PDF no contiene datos de recuperación de REMESAS.","This PDF does not contain REMESAS recovery data."));
const payload=text.slice(a+"REMESAS_RECOVERY_V1".length,b).replace(/\s+/g,"");
restoreSnapshot(b64urlDecode(payload))
}catch(e){showError(e.message)}
};
input.click()
}

function restoreSnapshot(d){
if(!d||d.format!=="REMESAS_RECOVERY_V1")throw new Error(t("Formato de recuperación no válido.","Invalid recovery format."));
if(d.money)setJSON(APP.moneyKey,d.money);
if(Array.isArray(d.expenses))setJSON(APP.expensesKey,d.expenses);
if(d.family)setJSON(APP.familyKey,d.family);
if(d.prefs)setJSON(APP.prefsKey,d.prefs);
if(d.language&&["es","en"].includes(d.language)){
APP.lang=d.language;
localStorage.setItem("remesas_lang_v4",d.language)
}
loadConfig().then(()=>renderHome()).catch(()=>renderHome());
alert(t("Datos restaurados en este dispositivo.","Data restored on this device."))
}

async function downloadLearningPDF(id=""){
try{
await ensurePDF();
const d=id?await loadLearning(id):await api(`/api/learn?language=${encodeURIComponent(APP.lang)}`);
const {jsPDF}=window.jspdf,pdf=new jsPDF();
const title=d.title?.[APP.lang]||d.title?.es||d.provider_name||t("Guía REMESAS","REMESAS guide");
let y=18;
const line=(x,size=11,gap=7)=>{
if(y>275){pdf.addPage();y=18}
pdf.setFontSize(size);
pdf.text(String(x),14,y,{maxWidth:182});
y+=gap
};
line("REMESAS",20,10);
line(title,15,10);
line(t("Contenido educativo original; no es material oficial del proveedor.","Original educational content; not official provider material."),9,9);
(d.steps||d.lessons||[]).forEach((s,i)=>{
line(`${i+1}. ${s.title?.[APP.lang]||s.title?.es||s.title||""}`,12,7);
line(s.text?.[APP.lang]||s.text?.es||s.text||s.description||"",10,9)
});
pdf.save(`REMESAS_Guia_${String(id||"general").replace(/[^a-z0-9_-]/gi,"_")}.pdf`)
}catch(e){showError(e.message)}
}

function registerAdminTap(e){
if(e.target.closest("button,input,textarea,select,a"))return;
const now=Date.now();
APP.adminTaps=APP.adminTaps.filter(x=>now-x<900);
APP.adminTaps.push(now);
if(APP.adminTaps.length>=3){APP.adminTaps=[];renderAdminLogin()}
}
function renderAdminLogin(){
renderShell(`<section class="card"><h1>Admin</h1><label>Usuario</label><input id="adminUser" autocomplete="username"><label>Contraseña</label><input id="adminPass" type="password" autocomplete="current-password"><button class="primary" onclick="adminLogin()">Entrar</button><button class="secondary" onclick="renderHome()">${esc(t("Cerrar","Close"))}</button></section>`,"Admin")
}
function closeAdminLogin(){renderHome()}
async function adminLogin(){
try{
const d=await api("/api/access/admin",{method:"POST",body:JSON.stringify({username:document.getElementById("adminUser")?.value||"",password:document.getElementById("adminPass")?.value||""})}),a=normalizeAccess(d.access||d);
if(!a?.access_token)throw new Error(t("Acceso administrativo no válido.","Invalid admin access."));
saveAccess(a);renderHome()
}catch(e){showError(e.message)}
}

function deleteLocalData(){
if(!confirm(t("¿Borrar los datos guardados en este dispositivo? Esto eliminará Mi dinero, gastos, familia, ahorro y preferencias de REMESAS. El acceso pagado se conserva.","Delete the data saved on this device? This removes My money, expenses, family, savings, and REMESAS preferences. Paid access is kept.")))return;
[APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,"remesas_lang_v4"].forEach(k=>localStorage.removeItem(k));
if(APP.session?.session_id)api(`/api/session/${APP.session.session_id}`,{method:"DELETE"}).catch(()=>{});
APP.session=null;
location.reload()
}

Object.assign(window,{
renderHome,renderAbout,renderAccessGate,renderRemittance,renderMoney,renderWeek,renderExpenses,renderFamily,renderHelp,renderPurchase,renderSavings,renderLearning,renderProviderLearning,renderQuickGuide,changeLanguage,understandNeed,beginParsedRemittance,compare,selectProvider,renderFinalCheck,renderComparisonFromSession,openOfficial,calculateMoney,addExpense,removeExpense,saveFamily,saveSavings,checkPurchase,showHelpTopic,deleteLocalData,updateMoneyWarning,startPayment,exportPDF,importPDF,downloadLearningPDF,adminLogin,closeAdminLogin
});

document.addEventListener("click",registerAdminTap);

document.addEventListener("DOMContentLoaded",async()=>{
try{
await loadConfig();
if(await checkPaymentReturn())return;
if(await checkAccess()){
await startSession(true);
renderHome()
}else{
renderAccessGate()
}
}catch(e){
app.innerHTML=`<main class="page"><section class="card"><div class="status warning">${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}</div><p>${esc(e.message)}</p><button class="primary" onclick="location.reload()">${esc(t("Reintentar","Retry"))}</button></section></main>`
}
});

setInterval(()=>{
if(accessToken()&&remainingSeconds()>0)updateClock();
else if(accessToken())lockExpiredService()
},1000);

setInterval(()=>{
if(accessToken())refreshAccess()
},60000);
