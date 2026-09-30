"use strict";
const APP={name:"REMESAS",version:"4.2.1",lang:localStorage.getItem("remesas_lang_v4")||"es",session:null,config:null,access:null,accessChecked:false,moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",prefsKey:"remesas_prefs_v4",accessKey:"remesas_access_v421"};
const app=document.getElementById("app");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const t=(es,en)=>APP.lang==="en"?en:es;
const money=v=>new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v||0));
function getJSON(k,f){try{const x=JSON.parse(localStorage.getItem(k)||"");return x??f}catch{return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function delJSON(k){localStorage.removeItem(k)}
async function api(url,options={}){
const headers={"Content-Type":"application/json",...(options.headers||{})};
if(APP.access?.token)headers.Authorization=`Bearer ${APP.access.token}`;
const r=await fetch(url,{...options,headers});
let d={};try{d=await r.json()}catch{}
if(!r.ok)throw new Error(d.detail||d.error||d.message||t("No se pudo completar la operación.","The operation could not be completed."));
return d
}
function loadStoredAccess(){
try{
const x=getJSON(APP.accessKey,null);
if(!x||!x.token||!x.expires_at)return null;
if(Number(x.expires_at)<=Date.now()){delJSON(APP.accessKey);return null}
return x
}catch{return null}
}
function storeAccess(data,type){
if(!data?.token)return false;
const minutes=Number(data.expires_in_minutes||data.duration_minutes||20);
const expires=Number(data.expires_at)||Date.now()+minutes*60000;
APP.access={token:data.token,type:type||data.access_type||"paid",expires_at:expires};
setJSON(APP.accessKey,APP.access);
return true
}
function clearAccess(){
APP.access=null;
delJSON(APP.accessKey)
}
function accessActive(){return Boolean(APP.access?.token&&Number(APP.access.expires_at)>Date.now())}
async function verifyStoredAccess(){
const s=loadStoredAccess();
if(!s){APP.access=null;return false}
APP.access=s;
try{
const d=await api("/api/access/verify",{method:"POST",body:JSON.stringify({token:s.token})});
if(d.access===true||d.granted===true||d.status==="success")return true
}catch{}
clearAccess();
return false
}
async function loadConfig(){
APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);
return APP.config
}
async function startSession(preserve=true){
if(preserve&&APP.session?.session_id){
try{APP.session=(await api(`/api/session/${APP.session.session_id}`)).session;return APP.session}catch{}
}
APP.session=(await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"})).session;
return APP.session
}
async function changeLanguage(){
APP.lang=APP.lang==="es"?"en":"es";
localStorage.setItem("remesas_lang_v4",APP.lang);
try{await loadConfig();renderHome()}catch(e){showError(e.message)}
}
function topbar(title="REMESAS"){
return`<header class="topbar"><button class="btn secondary small" onclick="renderHome()" aria-label="${esc(t("Volver al inicio","Back to home"))}">←</button><strong class="brand">${esc(title)}</strong><div class="top-actions"><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header>`
}
function renderShell(content,title="REMESAS"){
app.innerHTML=`<div class="app-shell">${topbar(title)}<main>${content}</main></div>`;
scrollTo(0,0)
}
function homeCard(icon,title,text,action){
return`<button class="card action-card" onclick="${action}"><span class="action-icon">${icon}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></button>`
}
function renderHome(){
const o=APP.config?.opening||{},appInfo=APP.config?.app||{};
const purpose=t("REMESAS te ayuda a entender, organizar y preparar una remesa. Pregunta lo necesario, calcula lo que puedas y te lleva a la fuente oficial cuando el dato debe confirmarse.","REMESAS helps you understand, organize and prepare a remittance. It asks what matters, calculates what it can, and takes you to the official source when a detail must be confirmed.");
const legal=t("REMESAS es un servicio informativo de May Roga LLC. No es banco, financiera, asesor financiero ni procesador de pagos. No recibe ni envía tu dinero y no completa la transferencia.","REMESAS is an informational service from May Roga LLC. It is not a bank, financial institution, financial advisor or payment processor. It does not receive or send your money or complete the transfer.");
app.innerHTML=`<div class="app-shell"><header class="hero"><div class="topbar"><div><div class="brand">REMESAS<small>May Roga LLC</small></div></div><div class="top-actions"><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></div><h1>${esc(o.primary_question||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1><p>${esc(o.secondary_text||t("Entiende tu necesidad, organiza tus datos y continúa con la fuente oficial.","Understand your need, organize your information, and continue with the official source."))}</p></header><section class="section"><div class="notice info"><b>${esc(t("¿Para qué sirve?","What is it for?"))}</b><p>${esc(purpose)}</p></div></section><section class="section"><div class="notice warning"><b>${esc(t("Importante","Important"))}</b><p>${esc(t("REMESAS no inventa tarifas, tasas, tiempos de entrega ni disponibilidad. Cuando un dato comercial actual no está verificado, se indica y se consulta la fuente oficial.","REMESAS does not invent fees, rates, delivery times or availability. When current commercial data is not verified, this is stated and the official source is used."))}</p></div></section><section class="section"><div class="section-title"><h2>${esc(t("¿Qué necesitas?","What do you need?"))}</h2></div><div class="grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa paso a paso.","Prepare a remittance step by step."),"renderRemittance()")}${homeCard("📚",t("APRENDER","LEARN"),t("Aprende qué te van a pedir y qué debes revisar.","Learn what you may be asked for and what to review."),"renderLearn()")}${homeCard("🔎",t("Comparar","Compare"),t("Revisa opciones sin inventar datos comerciales.","Review options without inventing commercial data."),"renderRemittance()")}${homeCard("💰",t("Mi dinero","My money"),t("Calcula ingreso, gastos y disponible.","Calculate income, expenses and available money."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Mira tu referencia semanal.","See your weekly reference."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra lo que sale de tu dinero.","Record what leaves your money."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia local.","Save a local reference."),"renderFamily()")}${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para una meta.","Reserve money for a goal."),"renderSavings()")}${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Comprueba si cabe en tu cálculo.","Check whether it fits your calculation."),"renderPurchase()")}${homeCard("❓",t("No entiendo","I need help"),t("Pregunta y recibe una respuesta práctica.","Ask and get a practical answer."),"renderHelp()")}</div></section><section class="section"><div class="card"><h2>${esc(t("Escribe lo que necesitas","Write what you need"))}</h2><p>${esc(t("Puedes escribirlo con tus propias palabras.","Use your own words."))}</p><textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero enviar $200 a México y no sé cómo hacerlo.","Example: I want to send $200 to Mexico and do not know how."))}"></textarea><div class="actions"><button class="btn" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button></div></div></section><section class="section"><div class="privacy"><div><b>${esc(t("Privacidad","Privacy"))}</b><div class="legal">${esc(t("Tus registros de dinero se guardan en este dispositivo. No introduzcas contraseñas, CVV, códigos de seguridad ni credenciales de proveedores.","Your money records stay on this device. Do not enter passwords, CVVs, security codes or provider credentials."))}</div></div><button class="btn danger small" onclick="deleteLocalData()">${esc(t("Borrar datos","Delete data"))}</button></div></section><footer class="footer">${esc(appInfo.brand||"May Roga LLC")} · REMESAS v${esc(APP.version)}<div class="footer-links"><button class="btn secondary small" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button></div><p class="legal">${esc(legal)}</p></footer></div>`
}
function renderAbout(){
renderShell(`<section class="card"><h1>${esc(t("REMESAS: qué hace","REMESAS: what it does"))}</h1><p>${esc(t("REMESAS entiende una necesidad, organiza información, calcula referencias, muestra datos comerciales solo cuando están verificados y dirige al usuario al proveedor oficial para completar una remesa.","REMESAS identifies a need, organizes information, calculates references, shows commercial data only when verified and directs the user to the official provider to complete a remittance."))}</p><h2>${esc(t("Qué no hace","What it does not do"))}</h2><p>${esc(t("No es banco, financiera, asesor financiero, procesador de pagos ni agente de un proveedor. No recibe fondos, no guarda credenciales y no ejecuta transferencias.","It is not a bank, financial institution, financial advisor, payment processor or provider agent. It does not receive funds, store credentials or execute transfers."))}</p><h2>${esc(t("Tus registros","Your records"))}</h2><p>${esc(t("Mi dinero, gastos, familia y ahorro se guardan localmente en este navegador.","My money, expenses, family and savings are stored locally in this browser."))}</p><h2>${esc(t("Impuestos","Taxes"))}</h2><p>${esc(t("Los registros organizados pueden servir como información para entregar a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.","Organized records can be information you provide to your accountant or tax preparer. REMESAS does not prepare or file taxes."))}</p><button class="btn" onclick="renderHome()">${esc(t("Volver","Back"))}</button></section>`,t("Información","Information"))
}
function countryCode(c){return String(c?.id||c?.code||"").toUpperCase()}
function countryName(code){const c=(APP.config?.countries||[]).find(x=>countryCode(x)===String(code||"").toUpperCase());return c?.name?.[APP.lang]||c?.name?.es||code||""}
function priorityLabel(v){return({recipient_gets_more:t("Que reciba más","Recipient gets more"),fastest:t("Rapidez","Speed"),save:t("Ahorrar","Save"),balanced:t("Equilibrio","Balanced")}[v]||v||"")}
function frequencyLabel(v){return({weekly:t("Semanal","Weekly"),biweekly:t("Quincenal","Biweekly"),monthly:t("Mensual","Monthly"),one_time:t("Una vez","One time")}[v]||v||"")}
function methodLabel(x){if(typeof x==="string"){const map={bank_account:t("Cuenta bancaria","Bank account"),debit_card:t("Tarjeta de débito","Debit card"),credit_card:t("Tarjeta de crédito","Credit card"),cash:t("Efectivo","Cash"),cash_pickup:t("Retiro en efectivo","Cash pickup"),mobile_wallet:t("Billetera móvil","Mobile wallet"),bank_deposit:t("Depósito bancario","Bank deposit")};return map[x]||x}return x?.label?.[APP.lang]||x?.label?.es||x?.name||x?.id||""}
function configMethods(type){
const list=APP.config?.[type]||[];
return Array.isArray(list)?list:[]
}
async function understandNeed(){
const text=(document.getElementById("freeNeed")?.value||"").trim();
if(!text){showError(t("Escribe primero qué necesitas.","Write what you need first."));return}
try{
const d=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.lang})});
const p=d.parsed||{};
if(p.need_type==="remittance"||p.amount||p.destination_country)await beginParsedRemittance(p);
else renderShell(`<section class="card"><div class="notice success">${esc(t("Entendido.","Understood."))}</div><h1>${esc(t("Vamos paso a paso","Let's go step by step"))}</h1><p>${esc(d.message||t("Podemos empezar por preparar una remesa o revisar otra parte de tu dinero.","We can start by preparing a remittance or reviewing another part of your money."))}</p><div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Preparar remesa","Prepare remittance"))}</button><button class="btn secondary" onclick="renderHelp()">${esc(t("Ver ayuda","View help"))}</button></div></section>`,t("Tu necesidad","Your need"))
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
const s=APP.session||{},amount=s.amount??p.amount??"",country=s.destination_country||p.destination_country||"",priority=s.priority||p.priority||"",delivery=s.delivery_method||p.delivery_method||"",payment=s.payment_method||p.payment_method||"";
const deliveries=configMethods("delivery_methods"),payments=configMethods("payment_methods");
renderShell(`<section class="card form-card"><div class="section-title"><div><h2>${esc(t("Enviar dinero","Send money"))}</h2><p>${esc(t("Primero reunimos los datos que realmente cambian el proceso.","First we collect the information that actually changes the process."))}</p></div></div><div class="notice info">${esc(t("Si no sabes todavía cómo recibirá la persona o cómo pagarás, puedes dejarlo como “No sé todavía”. La aplicación te lo explicará después.","If you do not yet know how the recipient will receive it or how you will pay, you can leave it as “Not yet sure”. The app will explain it later."))}</div><div class="field"><label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="sendAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}"></div><div class="field"><label>${esc(t("¿A qué país?","Which country?"))}</label><select id="sendCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select></div><div class="field"><label>${esc(t("¿Qué importa más?","What matters most?"))}</label><select id="sendPriority"><option value="">${esc(t("No estoy seguro","Not sure")}</option>${["recipient_gets_more","fastest","save","balanced"].map(x=>`<option value="${x}" ${priority===x?"selected":""}>${esc(priorityLabel(x))}</option>`).join("")}</select></div><div class="field"><label>${esc(t("¿Es urgente?","Is it urgent?"))}</label><select id="sendUrgency"><option value="">${esc(t("No estoy seguro","Not sure"))}</option><option value="true">${esc(t("Sí","Yes"))}</option><option value="false">${esc(t("No","No"))}</option></select></div><div class="field"><label>${esc(t("¿Cada cuánto envías?","How often do you send?"))}</label><select id="sendFrequency"><option value="">${esc(t("Una vez / no sé","One time / not sure"))}</option>${["one_time","weekly","biweekly","monthly"].map(x=>`<option value="${x}">${esc(frequencyLabel(x))}</option>`).join("")}</select></div><div class="field"><label>${esc(t("¿Cómo recibe?","How does the recipient receive?"))}</label><select id="sendDelivery"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${deliveries.map(x=>`<option value="${esc(x.id)}" ${x.id===delivery?"selected":""}>${esc(methodLabel(x))}</option>`).join("")}</select><small>${esc(t("Si no lo sabes, no significa que esté mal. Podemos ayudarte a entender las formas habituales y luego confirmar con el proveedor.","If you do not know, that is okay. We can help you understand common methods and then confirm with the provider."))}</small></div><div class="field"><label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label><select id="sendPayment"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${payments.map(x=>`<option value="${esc(x.id)}" ${x.id===payment?"selected":""}>${esc(methodLabel(x))}</option>`).join("")}</select><small>${esc(t("La forma de pago puede cambiar las opciones disponibles y los requisitos.","The payment method can change available options and requirements."))}</small></div><div id="moneyWarning"></div><div class="actions"><button class="btn" onclick="compare()">${esc(t("Revisar opciones","Review options"))}</button><button class="btn secondary" onclick="renderLearn()">${esc(t("Antes quiero aprender","I want to learn first"))}</button></div></section>`,t("Enviar dinero","Send money"));
document.getElementById("sendAmount")?.addEventListener("input",updateMoneyWarning);
updateMoneyWarning()
}
function getMoneyState(){return getJSON(APP.moneyKey,{income:0,incomeFreq:"monthly",monthlyIncome:0,essential:0,flexible:0,savings:0,remittance:0,available:0})}
function updateMoneyWarning(){
const box=document.getElementById("moneyWarning");if(!box)return;
const a=Number(document.getElementById("sendAmount")?.value||0),m=getMoneyState(),av=Number(m.available||0),w=[];
if(av>0&&a>av)w.push(t(`El monto supera tu disponible calculado (${money(av)}).`,`The amount exceeds your calculated available amount (${money(av)}).`));
if(a>10000)w.push(t("Revisa cuidadosamente los datos finales antes de continuar.","Carefully review the final details before continuing."));
box.innerHTML=w.length?`<div class="notice warning">${w.map(esc).join("<br>")}</div>`:""
}
async function compare(){
const amount=Number(document.getElementById("sendAmount")?.value||0),destination=document.getElementById("sendCountry")?.value||"";
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
function renderLoading(){renderShell(`<section class="card loading"><div class="spinner"></div><div><b>${esc(t("Revisando opciones","Reviewing options"))}</b><div>${esc(t("No inventaremos datos comerciales.","We will not invent commercial data."))}</div></div></section>`,t("Revisión","Review"))}
function providerCard(p){
const id=p.provider_id||p.id||"",r=(APP.session?.verified_results||[]).find(x=>x.provider_id===id),verified=Boolean(p.commercial_verified||p.commercial_status==="verified"||r?.status==="verified"),url=p.continue_url||p.official_site||p.official_urls?.send_money;
const payment=(p.payment_methods||[]).map(methodLabel).filter(Boolean),delivery=(p.delivery_methods||[]).map(methodLabel).filter(Boolean);
return`<article class="provider-card"><div class="provider-head"><div><h3>${esc(p.provider_name||p.name||id)}</h3><p>${esc(verified?t("Datos comerciales verificados","Verified commercial data"):t("Datos comerciales actuales no verificados","Current commercial data not verified"))}</p></div><span class="provider-status ${verified?"verified":""}">${esc(verified?t("Verificado","Verified"):t("Fuente oficial","Official source"))}</span></div>${verified&&r?`<div class="provider-data"><div class="metric"><span>${esc(t("Tarifa","Fee"))}</span><strong>${r.fee!=null?money(r.fee):"—"}</strong></div><div class="metric"><span>${esc(t("Tasa","Rate"))}</span><strong>${esc(r.exchange_rate??"—")}</strong></div><div class="metric"><span>${esc(t("Recibe","Gets"))}</span><strong>${r.recipient_amount!=null?money(r.recipient_amount):"—"}</strong></div></div>`:`<div class="notice warning">${esc(t("No mostramos tarifa, tasa, tiempo ni disponibilidad como datos actuales porque no están verificados.","We do not show fee, rate, timing or availability as current data because they are not verified."))}</div>`}${payment.length?`<p class="small"><b>${esc(t("Formas de pago declaradas:","Declared payment methods:"))}</b> ${esc(payment.join(", "))}</p>`:`<p class="small">${esc(t("La forma de pago debe confirmarse con el proveedor.","The payment method must be confirmed with the provider."))}</p>`}${delivery.length?`<p class="small"><b>${esc(t("Formas de entrega declaradas:","Declared delivery methods:"))}</b> ${esc(delivery.join(", "))}</p>`:`<p class="small">${esc(t("La forma de entrega debe confirmarse con el proveedor.","The delivery method must be confirmed with the provider."))}</p>`}${url?`<div class="actions"><button class="btn" onclick="selectProvider('${esc(id)}')">${esc(t("Revisar proveedor","Review provider"))}</button></div>`:""}</article>`
}
function renderComparison(data){
const providers=data.available_providers||[],verified=Number(data.verified_count||0);
renderShell(`<section class="section"><div class="section-title"><div><h2>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h2><p>${esc(data.explanation||"")}</p></div></div>${providers.length?`<div class="result-list">${providers.map(providerCard).join("")}</div>`:`<div class="empty">${esc(t("No encontramos proveedores para este destino en el catálogo actual.","No providers were found for this destination in the current catalog."))}</div>`}<div class="notice warning">${esc(data.results_available?t(`${verified} opción(es) tienen datos comerciales verificados.`,`${verified} option(s) have verified commercial data.`):t("No hay datos comerciales actuales verificados. Eso no impide aprender ni ir a la fuente oficial.","There are no current verified commercial data. You can still learn and go to the official source."))}</div><div class="actions"><button class="btn secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button><button class="btn secondary" onclick="renderLearn()">${esc(t("APRENDER","LEARN"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div></section>`,t("Comparar","Compare"))
}
async function selectProvider(id){
try{
const d=await api(`/api/session/${APP.session.session_id}/select/${encodeURIComponent(id)}`,{method:"POST"});
APP.session=d.session;
renderFinalCheck()
}catch(e){showError(e.message)}
}
async function renderFinalCheck(){
if(!APP.session?.selected_option){showError(t("Selecciona primero un proveedor.","Select a provider first."));return}
try{
const d=await api(`/api/session/${APP.session.session_id}/final-check`,{method:"POST"}),o=APP.session.selected_option,url=o.continue_url||o.official_site||"";
renderShell(`<section class="card"><div class="notice ${d.ready_to_continue?"success":"warning"}"><b>${esc(d.ready_to_continue?t("Revisión básica completada","Basic review completed"):t("Revisa los datos","Review the details"))}</b></div><h2>${esc(o.provider_name||"")}</h2><p>${esc(d.message||"")}</p><div class="result-list">${(d.checks||[]).map(c=>{const ok=Boolean(c.complete)&&c.status!=="review";return`<div class="notice ${ok?"success":"warning"}"><b>${ok?"✓":"!"} ${esc(c.label||"")}</b><div>${esc(String(c.value??""))}</div></div>`}).join("")}</div><div class="notice warning">${esc(t("Antes de confirmar, revisa nombre del destinatario, método de entrega, forma de pago, tarifa, tasa, tiempo y requisitos directamente con el proveedor.","Before confirming, review recipient name, delivery method, payment method, fee, rate, timing and requirements directly with the provider."))}</div>${(d.requirements||[]).length?`<p><b>${esc(t("Requisitos declarados:","Declared requirements:"))}</b> ${(d.requirements||[]).map(x=>esc(methodLabel(x))).join(", ")}</p>`:""}${url?`<div class="actions"><button class="btn" onclick="openOfficial('${esc(url)}')">${esc(t("Abrir sitio oficial","Open official site"))}</button></div>`:""}<button class="btn secondary" onclick="renderComparisonFromSession()">${esc(t("Ver otros proveedores","See other providers"))}</button></section>`,t("Revisión final","Final review"))
}catch(e){showError(e.message)}
}
function openOfficial(url){if(!/^https:\/\//i.test(url)){showError(t("El enlace oficial no es válido.","The official link is not valid."));return}window.open(url,"_blank","noopener,noreferrer")}
function renderComparisonFromSession(){
const data={available_providers:APP.session?.available_providers||[],results:APP.session?.verified_results||[],verified_count:(APP.session?.verified_results||[]).length,results_available:(APP.session?.verified_results||[]).length>0,amount:APP.session?.amount,destination_country:APP.session?.destination_country,destination_name:countryName(APP.session?.destination_country),explanation:t("Estas son las opciones de la sesión actual.","These are the options from the current session.")};
renderComparison(data)
}
async function getLearningData(){
try{
const d=await api(`/api/learning?language=${encodeURIComponent(APP.lang)}`);
return d
}catch{
return null
}
}
async function renderLearn(){
const d=await getLearningData();
const providers=APP.config?.providers||[];
const lessons=d?.lessons||d?.learning_lessons||[];
const specific=d?.provider_learning||{};
const lessonList=Array.isArray(lessons)?lessons:[];
renderShell(`<section class="section"><div class="hero"><h1>${esc(t("APRENDE A HACER UNA REMESA","LEARN HOW TO SEND A REMITTANCE"))}</h1><p>${esc(t("Aquí no comparamos precios. Te enseñamos qué pasos existen, qué información suele pedir un proveedor y qué cosas debes revisar antes de continuar.","This section does not compare prices. It teaches the process, information providers commonly request and what to review before continuing."))}</p></div><div class="card"><h2>${esc(t("Lo que debes entender antes de empezar","What you should understand before starting"))}</h2><div class="result-list"><div class="notice info"><b>${esc(t("1. Destino","1. Destination"))}</b><p>${esc(t("Debes saber a qué país irá el dinero. El país puede cambiar las opciones, requisitos y formas de entrega.","You need to know the destination country. The country can change options, requirements and delivery methods."))}</p></div><div class="notice info"><b>${esc(t("2. Monto","2. Amount"))}</b><p>${esc(t("Debes conocer aproximadamente cuánto quieres enviar y entender que el monto que paga quien envía y el monto que recibe la otra persona pueden ser diferentes.","Know approximately how much you want to send and understand that the sender's amount and recipient's amount can differ."))}</p></div><div class="notice info"><b>${esc(t("3. Cómo recibirá","3. How the recipient receives"))}</b><p>${esc(t("Puede existir más de una forma. La disponibilidad real depende del proveedor, país, método y momento.","There may be more than one method. Actual availability depends on provider, country, method and time."))}</p></div><div class="notice info"><b>${esc(t("4. Cómo pagarás","4. How you will pay"))}</b><p>${esc(t("La forma de pago puede cambiar los requisitos y las opciones disponibles.","The payment method can change requirements and available options."))}</p></div><div class="notice warning"><b>${esc(t("5. Datos del destinatario","5. Recipient information"))}</b><p>${esc(t("Antes de entrar al proveedor debes estar preparado para proporcionar la información que el método elegido requiera. Los datos deben coincidir exactamente con los documentos cuando el proveedor los exija.","Before entering the provider, be prepared to provide the information required by the chosen method. Information must match documents when the provider requires this."))}</p></div><div class="notice warning"><b>${esc(t("6. Seguridad","6. Security"))}</b><p>${esc(t("REMESAS nunca debe recibir tu contraseña, CVV, PIN, código OTP, número completo de tarjeta ni credenciales del proveedor.","REMESAS should never receive your password, CVV, PIN, OTP code, full card number or provider credentials."))}</p></div></div></div><section class="card"><h2>${esc(t("Pasos de la remesa","Remittance steps"))}</h2>${lessonList.length?lessonList.map((x,i)=>`<div class="notice"><b>${i+1}. ${esc(x.title?.[APP.lang]||x.title?.es||x.name?.[APP.lang]||x.name||x.id||"Paso")}</b><p>${esc(x.purpose?.[APP.lang]||x.purpose?.es||x.teaches?.[APP.lang]||x.teaches?.es||"")}</p>${x.warning?`<small>${esc(x.warning?.[APP.lang]||x.warning?.es||x.warning)}</small>`:""}</div>`).join(""):`<div class="notice">1. ${esc(t("Elegir destino.","Choose destination."))}<br>2. ${esc(t("Indicar monto.","Enter amount."))}<br>3. ${esc(t("Elegir cómo recibe.","Choose how the recipient receives."))}<br>4. ${esc(t("Elegir cómo pagar.","Choose how to pay."))}<br>5. ${esc(t("Preparar los datos solicitados.","Prepare the requested information."))}<br>6. ${esc(t("Revisar todo.","Review everything."))}<br>7. ${esc(t("Continuar con el proveedor oficial.","Continue with the official provider."))}</div>`}</section><section class="card"><h2>${esc(t("Aprender por proveedor","Learn by provider"))}</h2><div class="grid">${providers.map(p=>`<button class="card action-card" onclick="renderProviderLesson('${esc(p.id)}')"><span class="action-icon">📖</span><h3>${esc(p.name||p.id)}</h3><p>${esc(t("Ver el proceso educativo paso a paso.","See the educational process step by step."))}</p></button>`).join("")}</div></section><div class="actions"><button class="btn secondary" onclick="renderRemittance()">${esc(t("Preparar mi remesa","Prepare my remittance"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div></section>`,t("APRENDER","LEARN"))
}
async function renderProviderLesson(id){
const d=await getLearningData(),p=(APP.config?.providers||[]).find(x=>x.id===id),raw=d?.provider_learning?.[id]||d?.providers?.[id]||{};
const steps=Array.isArray(raw.steps)?raw.steps:Array.isArray(raw.lessons)?raw.lessons:[];
const url=p?.continue_url||p?.official_site;
renderShell(`<section class="card"><div class="section-title"><div><h2>${esc(t("Aprender con ","Learn with ")+(p?.name||id))}</h2><p>${esc(t("Guía educativa independiente. No es capacitación oficial del proveedor.","Independent educational guide. It is not official provider training."))}</p></div></div><div class="notice warning">${esc(t("Los nombres y requisitos concretos pueden cambiar. Confirma los datos actuales en el sitio oficial antes de completar una operación.","Specific names and requirements can change. Confirm current information on the official site before completing a transaction."))}</div><div class="result-list">${steps.length?steps.map((s,i)=>`<div class="notice"><b>${i+1}. ${esc(s.title?.[APP.lang]||s.title?.es||s.name?.[APP.lang]||s.name||"Paso")}</b><p>${esc(s.teaches?.[APP.lang]||s.teaches?.es||s.purpose?.[APP.lang]||s.purpose?.es||s.description?.[APP.lang]||s.description?.es||"")}</p>${s.warning?`<small>${esc(s.warning?.[APP.lang]||s.warning?.es||s.warning)}</small>`:""}</div>`).join(""):`<div class="notice">${esc(t("1. Inicia el proceso. 2. Selecciona el país. 3. Indica el monto. 4. Revisa cómo recibirá el destinatario. 5. Revisa cómo pagarás. 6. Prepara los datos que el proveedor solicite. 7. Revisa antes de confirmar. 8. Continúa en el sitio oficial.","1. Start the process. 2. Select the country. 3. Enter the amount. 4. Review how the recipient receives. 5. Review how you will pay. 6. Prepare the information the provider requests. 7. Review before confirming. 8. Continue on the official site."))}</div>`}</div>${url?`<div class="actions"><button class="btn" onclick="openOfficial('${esc(url)}')">${esc(t("Ir al sitio oficial","Go to official site"))}</button></div>`:""}<button class="btn secondary" onclick="renderLearn()">${esc(t("Volver a APRENDER","Back to LEARN"))}</button></section>`,p?.name||id)
}
function renderMoney(){
const m=getMoneyState();
renderShell(`<section class="card form-card"><h2>${esc(t("Mi dinero","My money"))}</h2><p class="legal">${esc(t("Este cálculo es tuyo; no es un saldo bancario. Los registros se guardan en este dispositivo.","This is your calculation; it is not a bank balance. Records stay on this device."))}</p><div class="field"><label>${esc(t("Ingreso","Income"))}</label><input id="income" type="number" min="0" step=".01" value="${esc(m.income||"")}"></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq"><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="monthly">${esc(t("Mensual","Monthly"))}</option></select></div><div class="field"><label>${esc(t("Gastos esenciales","Essential expenses"))}</label><input id="essential" type="number" min="0" step=".01" value="${esc(m.essential||"")}"></div><div class="field"><label>${esc(t("Gastos flexibles","Flexible expenses"))}</label><input id="flexible" type="number" min="0" step=".01" value="${esc(m.flexible||"")}"></div><div class="field"><label>${esc(t("Ahorro reservado","Reserved savings"))}</label><input id="savings" type="number" min="0" step=".01" value="${esc(m.savings||"")}"></div><div class="field"><label>${esc(t("Remesas reservadas","Reserved remittance"))}</label><input id="remittance" type="number" min="0" step=".01" value="${esc(m.remittance||"")}"></div><div class="actions"><button class="btn" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button></div><div id="moneyResult"></div><p class="legal">${esc(t("Estos registros pueden servirte como referencia para entregar información a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.","These records may serve as reference information for your accountant or tax preparer. REMESAS does not prepare or file taxes."))}</p></section>`,t("Mi dinero","My money"));
document.getElementById("incomeFreq").value=m.incomeFreq||"monthly";
if(Number(m.income||0))showMoneyResult(m)
}
function frequencyFactor(f){return f==="weekly"?52/12:f==="biweekly"?26/12:1}
function calculateMoney(){
const income=Number(document.getElementById("income")?.value||0),freq=document.getElementById("incomeFreq")?.value||"monthly",essential=Number(document.getElementById("essential")?.value||0),flexible=Number(document.getElementById("flexible")?.value||0),savings=Number(document.getElementById("savings")?.value||0),remittance=Number(document.getElementById("remittance")?.value||0);
if([income,essential,flexible,savings,remittance].some(x=>x<0)){showError(t("Los valores no pueden ser negativos.","Values cannot be negative."));return}
const monthlyIncome=income*frequencyFactor(freq),available=monthlyIncome-essential-flexible-savings-remittance,d={income,incomeFreq:freq,monthlyIncome,essential,flexible,savings,remittance,available,updatedAt:new Date().toISOString()};
setJSON(APP.moneyKey,d);showMoneyResult(d)
}
function showMoneyResult(d){
const a=Number(d.available||0),box=document.getElementById("moneyResult");if(!box)return;
box.innerHTML=`<div class="balance-grid"><div class="balance"><span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span><strong>${money(d.monthlyIncome)}</strong></div><div class="balance ${a>=0?"positive":"negative"}"><span>${esc(t("Disponible calculado","Calculated available"))}</span><strong>${money(a)}</strong></div><div class="balance"><span>${esc(t("Remesa reservada","Reserved remittance"))}</span><strong>${money(d.remittance)}</strong></div></div><div class="notice ${a>=0?"success":"warning"}">${esc(a>=0?t("PUEDO: el cálculo está por encima de cero.","I CAN: the calculation is above zero."):t("PUEDO: los compromisos superan el ingreso calculado.","I CAN: commitments exceed calculated income."))}</div><div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Usar para una remesa","Use for a remittance"))}</button></div>`
}
function renderWeek(){
const m=getMoneyState();if(!m.monthlyIncome){renderMoney();return}
const q=Number(m.monthlyIncome)/4.333333,commit=(Number(m.essential)+Number(m.flexible)+Number(m.savings)+Number(m.remittance))/4.333333,a=q-commit;
renderShell(`<section class="card"><h2>${esc(t("Mi semana","My week"))}</h2><div class="balance-grid"><div class="balance"><span>${esc(t("Ingreso semanal equivalente","Equivalent weekly income"))}</span><strong>${money(q)}</strong></div><div class="balance"><span>${esc(t("Compromisos semanales","Weekly commitments"))}</span><strong>${money(commit)}</strong></div><div class="balance ${a>=0?"positive":"negative"}"><span>${esc(t("Disponible semanal","Weekly available"))}</span><strong>${money(a)}</strong></div></div><div class="notice ${a>=0?"success":"warning"}">${esc(a>=0?t("Puedes usar esta cifra como referencia semanal.","You can use this as a weekly reference."):t("Revisa tus compromisos antes de aumentar gasto o remesa.","Review commitments before increasing spending or transfers."))}</div><button class="btn secondary" onclick="renderMoney()">${esc(t("Modificar cálculo","Modify calculation"))}</button></section>`,t("Mi semana","My week"))
}
function getExpenses(){return getJSON(APP.expensesKey,[])}
function renderExpenses(){
const e=getExpenses();
renderShell(`<section class="card"><h2>${esc(t("Mis gastos","My expenses"))}</h2><p class="legal">${esc(t("Registrar tus gastos te ayuda a saber cuánto sale y luego usar ese dato en Mi dinero.","Recording expenses helps you know what goes out and then use that data in My money."))}</p><div class="form-row"><div class="field"><label>${esc(t("Descripción","Description"))}</label><input id="expenseName" maxlength="120"></div><div class="field"><label>${esc(t("Monto","Amount"))}</label><input id="expenseAmount" type="number" min=".01" step=".01"></div></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expenseFrequency"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="one_time">${esc(t("Una vez","One time"))}</option></select></div><button class="btn" onclick="addExpense()">${esc(t("Guardar gasto","Save expense"))}</button><div class="section">${e.length?e.map((x,i)=>`<div class="privacy"><span><b>${esc(x.description)}</b><small>${esc(frequencyLabel(x.frequency))}</small></span><span><b>${money(x.amount)}</b><button class="btn danger small" onclick="removeExpense(${i})">×</button></span></div>`).join(""):`<div class="empty">${esc(t("Todavía no hay gastos registrados.","There are no recorded expenses yet."))}</div>`}</div><button class="btn secondary" onclick="renderMoney()">${esc(t("Actualizar Mi dinero","Update My money"))}</button></section>`,t("Mis gastos","My expenses"))
}
function addExpense(){
const d=(document.getElementById("expenseName")?.value||"").trim(),a=Number(document.getElementById("expenseAmount")?.value||0),f=document.getElementById("expenseFrequency")?.value||"monthly";
if(!d||!a||a<=0){showError(t("Completa descripción y monto válido.","Enter a description and valid amount."));return}
const e=getExpenses();e.push({description:d,amount:a,frequency:f,createdAt:new Date().toISOString()});setJSON(APP.expensesKey,e);renderExpenses()
}
function removeExpense(i){const e=getExpenses();e.splice(i,1);setJSON(APP.expensesKey,e);renderExpenses()}
function renderFamily(){
const d=getJSON(APP.familyKey,{name:"",country:"",amount:""});
renderShell(`<section class="card"><h2>${esc(t("Familia","Family"))}</h2><p class="legal">${esc(t("Solo es una referencia local; no crea una orden de envío.","This is only a local reference; it does not create a transfer order."))}</p><div class="field"><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="familyName" maxlength="80" value="${esc(d.name)}"></div><div class="field"><label>${esc(t("País","Country"))}</label><select id="familyCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===d.country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select></div><div class="field"><label>${esc(t("Monto de referencia","Reference amount"))}</label><input id="familyAmount" type="number" min="0" step=".01" value="${esc(d.amount)}"></div><button class="btn" onclick="saveFamily()">${esc(t("Guardar en este dispositivo","Save on this device"))}</button></section>`,t("Familia","Family"))
}
function saveFamily(){setJSON(APP.familyKey,{name:(document.getElementById("familyName")?.value||"").trim(),country:document.getElementById("familyCountry")?.value||"",amount:Number(document.getElementById("familyAmount")?.value||0)});renderHome()}
function renderSavings(){
const m=getMoneyState();
renderShell(`<section class="card"><h2>${esc(t("Ahorrar","Save"))}</h2><p class="legal">${esc(t("Reserva una cantidad y deja la referencia guardada en este dispositivo.","Reserve an amount and keep the reference on this device."))}</p><div class="field"><label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label><input id="saveAmount" type="number" min="0" step=".01" value="${esc(m.savings||"")}"></div><div class="field"><label>${esc(t("¿Para qué?","What for?"))}</label><input id="savePurpose" maxlength="100" value="${esc(m.savingsPurpose||"")}"></div><button class="btn" onclick="saveSavings()">${esc(t("Guardar objetivo","Save goal"))}</button></section>`,t("Ahorrar","Save"))
}
function saveSavings(){const m=getMoneyState();m.savings=Number(document.getElementById("saveAmount")?.value||0);m.savingsPurpose=(document.getElementById("savePurpose")?.value||"").trim();setJSON(APP.moneyKey,m);renderMoney()}
function renderPurchase(){
renderShell(`<section class="card"><h2>${esc(t("Planear una compra","Plan a purchase"))}</h2><p class="legal">${esc(t("Compara el precio con tu disponible calculado. La aplicación no decide por ti.","Compare the price with your calculated available amount. The app does not decide for you."))}</p><div class="field"><label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label><input id="purchaseName" maxlength="120"></div><div class="field"><label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label><input id="purchaseAmount" type="number" min=".01" step=".01"></div><button class="btn" onclick="checkPurchase()">${esc(t("Comprobar","Check"))}</button></section>`,t("Planear una compra","Plan a purchase"))
}
function checkPurchase(){
const n=(document.getElementById("purchaseName")?.value||"").trim(),a=Number(document.getElementById("purchaseAmount")?.value||0),m=getMoneyState(),d=Number(m.available||0)-a;
if(!n||!a||a<=0){showError(t("Completa nombre y precio.","Enter a name and valid price."));return}
renderShell(`<section class="card"><div class="notice ${d>=0?"success":"warning"}">${esc(d>=0?t("PUEDO: cabe en tu cálculo actual.","I CAN: it fits your current calculation."):t("PUEDO: supera tu disponible actual.","I CAN: it exceeds your current available amount."))}</div><h2>${esc(n)}</h2><div class="balance-grid"><div class="balance"><span>${esc(t("Precio","Price"))}</span><strong>${money(a)}</strong></div><div class="balance ${d>=0?"positive":"negative"}"><span>${esc(t("Después de comprar","After purchase"))}</span><strong>${money(d)}</strong></div></div><button class="btn secondary" onclick="renderMoney()">${esc(t("Revisar Mi dinero","Review My money"))}</button></section>`,t("Resultado","Result"))
}
function renderHelp(){
const topics=APP.config?.help_topics||[];
renderShell(`<section class="card"><h2>${esc(t("¿Qué no entiendes?","What don't you understand?"))}</h2><p>${esc(t("Elige una pregunta y recibirás una respuesta práctica.","Choose a question and receive a practical answer."))}</p>${topics.map(x=>`<button class="btn secondary" style="width:100%;margin-bottom:8px;text-align:left" onclick="showHelpTopic('${esc(x.id)}')"><b>${esc(x.title)}</b></button>`).join("")}<button class="btn secondary" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button></section>`,t("Ayuda","Help"))
}
function showHelpTopic(id){
const x=(APP.config?.help_topics||[]).find(a=>a.id===id);if(!x)return;
renderShell(`<section class="card"><h2>${esc(x.title)}</h2><p>${esc(x.answer)}</p><button class="btn" onclick="renderHelp()">${esc(t("Ver más ayuda","More help"))}</button></section>`,x.title)
}
function showError(m){
document.querySelectorAll(".toast").forEach(x=>x.remove());
const b=document.createElement("div");b.className="toast";b.textContent=t("Atención: ","Attention: ")+(m||t("Ocurrió un error.","An error occurred."));
document.body.appendChild(b);setTimeout(()=>b.remove(),7000)
}
function deleteLocalData(){
if(!confirm(t("¿Borrar los datos guardados en este dispositivo? Se eliminarán Mi dinero, gastos, familia, ahorro y preferencias.","Delete the data saved on this device? This removes My money, expenses, family, savings and preferences.")))return;
[APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,"remesas_lang_v4"].forEach(k=>localStorage.removeItem(k));
if(APP.session?.session_id)api(`/api/session/${APP.session.session_id}/reset`,{method:"POST"}).catch(()=>{});
location.reload()
}
function showPaywall(){
const stripe=APP.config?.stripe||{},price=stripe.price||10.99;
app.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand">REMESAS<small>May Roga LLC</small></div><div class="top-actions"><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header><section class="hero"><h1>${esc(t("REMESAS","REMESAS"))}</h1><p>${esc(t("Acceso a la aplicación para preparar, organizar y aprender sobre remesas.","Access the application to prepare, organize and learn about remittances."))}</p><div class="hero-actions"><button class="btn" onclick="startStripePayment()">${esc(t(`Entrar con pago único · ${money(price)}` ,`Enter with one-time payment · ${money(price)}`))}</button></div></section><section class="section"><div class="card"><h2>${esc(t("También existe una entrada administrativa gratuita","There is also a free administrative entry"))}</h2><p class="legal">${esc(t("El acceso administrativo no se muestra como botón. Se activa solamente con el gesto secreto de tres toques rápidos en la pantalla.","Administrative access is not shown as a button. It activates only with the secret gesture of three quick taps on the screen."))}</p></div></section><section class="section"><div class="notice info">${esc(t("El pago se procesa mediante Stripe. REMESAS no recibe ni guarda los datos de tu tarjeta.","Payment is processed through Stripe. REMESAS does not receive or store your card details."))}</div></section></div>`
}
function adminModal(){
if(accessActive())return;
let m=document.getElementById("adminAccessModal");
if(m)m.remove();
m=document.createElement("div");
m.id="adminAccessModal";
m.className="modal-backdrop";
m.innerHTML=`<div class="modal"><div class="modal-head"><h2>${esc(t("Acceso administrativo","Administrative access"))}</h2><button class="close" onclick="closeAdminModal()">×</button></div><p class="legal">${esc(t("Esta es la única forma gratuita de entrar. No es necesaria para los clientes que pagan mediante Stripe.","This is the only free way to enter. It is not needed for customers who pay through Stripe."))}</p><div class="field"><label>${esc(t("Usuario","Username"))}</label><input id="adminUsername" autocomplete="username"></div><div class="field"><label>${esc(t("Contraseña","Password"))}</label><input id="adminPassword" type="password" autocomplete="current-password"></div><div id="adminError"></div><div class="actions"><button class="btn" onclick="loginAdmin()">${esc(t("Entrar","Login"))}</button><button class="btn secondary" onclick="closeAdminModal()">${esc(t("Cerrar","Close"))}</button></div></div>`;
document.body.appendChild(m);
setTimeout(()=>document.getElementById("adminUsername")?.focus(),50)
}
function closeAdminModal(){document.getElementById("adminAccessModal")?.remove()}
async function loginAdmin(){
const u=(document.getElementById("adminUsername")?.value||"").trim(),p=document.getElementById("adminPassword")?.value||"",box=document.getElementById("adminError");
if(!u||!p){if(box)box.innerHTML=`<div class="notice warning">${esc(t("Escribe usuario y contraseña.","Enter username and password."))}</div>`;return}
try{
const d=await api("/api/login-admin",{method:"POST",body:JSON.stringify({username:u,password:p})});
if(!storeAccess(d,"admin"))throw new Error(t("El servidor no devolvió un acceso válido.","The server did not return valid access."));
closeAdminModal();
await enterApplication()
}catch(e){if(box)box.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
}
async function startStripePayment(){
try{
const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({price_type:"1"})});
if(!d.url)throw new Error(t("Stripe no devolvió un enlace de pago.","Stripe did not return a payment link."));
window.location.href=d.url
}catch(e){showError(e.message)}
}
async function checkStripeReturn(){
const q=new URLSearchParams(location.search),sid=q.get("session_id")||q.get("checkout_session_id");
if(!sid)return false;
try{
const d=await api(`/api/payment/check?session_id=${encodeURIComponent(sid)}`);
if(!storeAccess(d,"paid"))throw new Error(t("El pago no pudo convertirse en acceso.","The payment could not be converted into access."));
history.replaceState({},document.title,location.pathname);
return true
}catch(e){showError(e.message);return false}
}
function setupTripleTap(){
let taps=0,last=0,timer=null;
window.addEventListener("pointerup",e=>{
if(!e.isPrimary||accessActive())return;
const now=Date.now();
if(now-last>900)taps=0;
taps++;last=now;
clearTimeout(timer);
if(taps===3){taps=0;adminModal();return}
timer=setTimeout(()=>{taps=0},900)
},true)
}
async function enterApplication(){
try{
if(!APP.config)await loadConfig();
await startSession(true);
renderHome()
}catch(e){
app.innerHTML=`<div class="app-shell"><section class="card"><div class="notice danger">${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}</div><p>${esc(e.message)}</p><button class="btn" onclick="boot()">${esc(t("Reintentar","Retry"))}</button></section></div>`
}
}
async function boot(){
try{
await loadConfig();
const paid=await checkStripeReturn();
if(paid){await enterApplication();return}
const valid=await verifyStoredAccess();
if(valid){await enterApplication();return}
showPaywall()
}catch(e){
app.innerHTML=`<div class="app-shell"><section class="card"><div class="notice danger">${esc(t("No se pudo iniciar la aplicación.","The application could not start."))}</div><p>${esc(e.message)}</p><button class="btn" onclick="boot()">${esc(t("Reintentar","Retry"))}</button></section></div>`
}
}
Object.assign(window,{renderHome,renderAbout,renderRemittance,renderMoney,renderWeek,renderExpenses,renderFamily,renderHelp,renderPurchase,renderSavings,renderLearn,renderProviderLesson,changeLanguage,understandNeed,beginParsedRemittance,compare,selectProvider,renderFinalCheck,renderComparisonFromSession,openOfficial,calculateMoney,addExpense,removeExpense,saveFamily,saveSavings,checkPurchase,showHelpTopic,deleteLocalData,updateMoneyWarning,adminModal,closeAdminModal,loginAdmin,startStripePayment,boot});
setupTripleTap();
document.addEventListener("DOMContentLoaded",boot);
