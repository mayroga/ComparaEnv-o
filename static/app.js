"use strict";
const APP={name:"REMESAS",version:"4.2.1",lang:localStorage.getItem("remesas_lang_v4")||"es",session:null,config:null,access:null,moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",prefsKey:"remesas_prefs_v4",accessKey:"remesas_access_token_v4"};
const app=document.getElementById("app");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const jsq=v=>JSON.stringify(String(v??""));
const t=(es,en)=>APP.lang==="en"?en:es;
const money=v=>new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v||0));
function getJSON(k,f){try{return JSON.parse(localStorage.getItem(k)||"")??f}catch{return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function token(){return localStorage.getItem(APP.accessKey)||""}
function authHeaders(){const h={"Content-Type":"application/json"};if(token())h.Authorization=`Bearer ${token()}`;return h}
async function api(url,options={}){
 const headers={...authHeaders(),...(options.headers||{})};
 const r=await fetch(url,{...options,headers});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok)throw new Error(d.detail||d.error||d.message||t("No se pudo completar la operación.","The operation could not be completed."));
 return d
}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);return APP.config}
async function startSession(preserve=true){
 if(preserve&&APP.session?.session_id){try{APP.session=(await api(`/api/session/${APP.session.session_id}`)).session;return APP.session}catch{}}
 APP.session=(await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"})).session;
 return APP.session
}
async function checkAccess(){
 try{
  const d=await api("/api/access/status");
  APP.access=d||{};
  if(d?.token) localStorage.setItem(APP.accessKey,d.token);
  return d
 }catch{return {active:false,unlocked:false}}
}
async function verifyAccess(){
 const tok=token();
 if(!tok)return false;
 try{
  const d=await api("/api/access/verify",{method:"POST",body:JSON.stringify({token:tok})});
  APP.access=d||{};
  if(d?.active||d?.unlocked||d?.valid)return true;
 }catch{}
 return false
}
function accessActive(){
 const a=APP.access||{};
 return Boolean(a.active||a.unlocked||a.valid||a.authorized||a.access_granted)
}
function renderShell(content,title="REMESAS"){
 app.innerHTML=`<div class="app-shell"><header class="topbar"><button class="btn secondary small" onclick="renderHome()" aria-label="${esc(t("Volver al inicio","Back to home"))}">←</button><div class="brand">${esc(title)}<small>May Roga LLC</small></div><div class="top-actions"><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header><main>${content}</main></div>`;
 scrollTo(0,0)
}
function homeCard(icon,title,text,action){
 return`<button class="card action-card" onclick="${action}"><span class="action-icon">${icon}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></button>`
}
function renderHome(){
 const o=APP.config?.opening||{},appInfo=APP.config?.app||{};
 const purpose=t("REMESAS te ayuda a entender, organizar y preparar una remesa sin tener que conocer la parte técnica. Te pregunta lo necesario, hace cálculos y te lleva a la fuente oficial cuando hace falta.","REMESAS helps you understand, organize, and prepare a remittance without needing to know the technical details. It asks what matters, does calculations, and takes you to the official source when needed.");
 const legal=t("REMESAS es un servicio informativo de May Roga LLC. No es un banco, financiera, asesor financiero ni procesador de pagos. No recibe ni envía tu dinero y no completa la transferencia por ti.","REMESAS is an informational service from May Roga LLC. It is not a bank, financial institution, financial advisor, or payment processor. It does not receive or send your money or complete the transfer for you.");
 app.innerHTML=`<div class="app-shell"><header class="hero"><div class="topbar"><div class="brand">REMESAS<small>May Roga LLC</small></div><div class="top-actions"><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></div><h1>${esc(o.primary_question||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1><p>${esc(o.secondary_text||t("Entiende tu necesidad, organiza tus datos y continúa con la fuente oficial.","Understand your need, organize your information, and continue with the official source."))}</p></header><main><section class="notice info"><b>${esc(t("¿Para qué sirve?","What is it for?"))}</b><p>${esc(purpose)}</p></section><section class="notice warning"><b>${esc(t("Importante","Important"))}</b><p>${esc(t("REMESAS no inventa tarifas, tasas, tiempos de entrega ni disponibilidad. Si un dato comercial actual no está verificado, lo verás como no verificado y podrás ir al sitio oficial.","REMESAS does not invent fees, exchange rates, delivery times, or availability. If current commercial data are not verified, they are shown as unverified and you can go to the official site."))}</p></section><section class="section"><div class="section-title"><h2>${esc(t("TENGO → GANO → GASTO → AHORRO → QUIERO → PUEDO → HAGO","HAVE → EARN → SPEND → SAVE → WANT → CAN → DO"))}</h2></div><div class="grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa opciones.","Prepare a transfer and review options."),"renderRemittance()")}${homeCard("💰",t("Mi dinero","My money"),t("Calcula lo que tienes disponible.","Calculate what you have available."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Convierte tu cálculo a una referencia semanal.","Convert your calculation to a weekly reference."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos.","Record and review expenses."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia local para una remesa.","Save a local transfer reference."),"renderFamily()")}${homeCard("❓",t("No entiendo","I need help"),t("Escribe lo que necesitas y te orientamos.","Write what you need and we will guide you."),"renderHelp()")}${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Comprueba si cabe en tu cálculo.","Check whether it fits your calculation."),"renderPurchase()")}${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para una meta.","Reserve money for a goal."),"renderSavings()")}</div></section><section class="section"><div class="grid three">${homeCard("📚",t("APRENDER","LEARN"),t("Aprende el proceso antes de hacerlo.","Learn the process before doing it."),"renderLearning()")}${homeCard("🧭",t("GUÍA RÁPIDA","QUICK GUIDE"),t("Pasos sencillos para llegar al proveedor.","Simple steps to reach the provider."),"renderQuickGuide()")}${homeCard("ℹ️",t("Qué hace REMESAS","About REMESAS"),t("Conoce los límites y la privacidad.","See limits and privacy."),"renderAbout()")}</div></section><section class="card"><h2>${esc(t("¿Qué necesitas hacer?","What do you need to do?"))}</h2><p class="legal">${esc(t("Puedes escribirlo con tus propias palabras. La aplicación intentará entenderlo.","Use your own words. The app will try to understand you."))}</p><textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero enviar $200 a México...","Example: I want to send $200 to Mexico..."))}"></textarea><div class="actions"><button class="btn" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button></div></section><section class="privacy"><div><strong>${esc(t("Protección y privacidad","Protection and privacy"))}</strong><p class="legal">${esc(t("Tus datos personales de dinero se guardan en este dispositivo. La sesión de remesa del servidor es temporal. No escribas contraseñas bancarias, CVV, códigos de seguridad ni credenciales de proveedores aquí.","Your personal money data stays on this device. The server remittance session is temporary. Do not enter bank passwords, CVVs, security codes, or provider credentials here."))}</p></div><button class="btn danger small" onclick="deleteLocalData()">${esc(t("Borrar mis datos","Delete my data"))}</button></section><footer class="footer">${esc(appInfo.brand||"May Roga LLC")} · v${esc(APP.version)}<div class="footer-links"><a href="#" onclick="renderAbout();return false">${esc(t("Información","Information"))}</a><a href="#" onclick="renderHelp();return false">${esc(t("Ayuda","Help"))}</a></div></footer></main></div>`
}
function renderAbout(){
 const legal=t("REMESAS es una herramienta informativa y de organización. No es banco, financiera, asesor financiero ni procesador de pagos. No ejecuta remesas. Los datos comerciales actuales solo se muestran cuando existen datos verificables. Si no existen, la aplicación te dirige al proveedor oficial para confirmar los datos antes de enviar.","REMESAS is an informational and organization tool. It is not a bank, financial institution, financial advisor, or payment processor. It does not execute remittances. Current commercial data are shown only when verifiable data exist. Otherwise, the app directs you to the official provider to confirm details before sending.");
 renderShell(`<section class="card"><h1>${esc(t("REMESAS: qué hace","REMESAS: what it does"))}</h1><p>${esc(t("1. Entiende lo que necesitas. 2. Organiza monto, destino y preferencias. 3. Calcula datos que guardas en tu dispositivo. 4. Compara métodos y datos comerciales solo cuando pueden verificarse. 5. Te lleva al proveedor oficial para completar el proceso.","1. Understands what you need. 2. Organizes amount, destination, and preferences. 3. Calculates information you keep on your device. 4. Compares methods and commercial data only when they can be verified. 5. Takes you to the official provider to complete the process."))}</p><h2>${esc(t("Qué no hace","What it does not do"))}</h2><p>${esc(legal)}</p><h2>${esc(t("Tus datos","Your data"))}</h2><p>${esc(t("Los registros de Mi dinero, gastos, familia y ahorro se guardan en localStorage de este navegador. Puedes borrarlos desde el inicio. REMESAS no usa esos registros como una base de datos personal permanente del servidor.","Records from My money, expenses, family, and savings are stored in this browser's localStorage. You can delete them from the home screen. REMESAS does not use those records as a permanent personal database on the server."))}</p><h2>${esc(t("Impuestos","Taxes"))}</h2><p>${esc(t("La organización de tus ingresos y gastos puede darte datos que después puedes entregar a tu contador o preparador de impuestos. REMESAS no prepara, presenta ni calcula tus impuestos.","Organized income and expense information can give you records you may later provide to your accountant or tax preparer. REMESAS does not prepare, file, or calculate your taxes."))}</p><button class="btn" onclick="renderHome()">${esc(t("Entendido","Understood"))}</button></section>`,t("Información","Information"))
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
  else renderShell(`<section class="card"><div class="notice success">${esc(t("Entendido","Understood"))}</div><h1>${esc(t("Vamos paso a paso","Let's go step by step"))}</h1><p>${esc(t("Todavía no tengo suficiente información para una acción concreta. Podemos empezar por preparar una remesa o puedes elegir otra ayuda.","I do not have enough information for a concrete action yet. We can start by preparing a transfer or you can choose another help option."))}</p><div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Preparar una remesa","Prepare a transfer"))}</button><button class="btn secondary" onclick="renderHelp()">${esc(t("Ver ayuda","View help"))}</button></div></section>`,t("Tu necesidad","Your need"))
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
 const s=APP.session||{},amount=s.amount??p.amount??"",country=s.destination_country||p.destination_country||"",priority=s.priority||p.priority||"";
 renderShell(`<section class="card form-card"><h1>${esc(t("Enviar dinero","Send money"))}</h1><p class="legal">${esc(t("Solo preguntamos lo que puede cambiar el siguiente paso. Si no sabes una respuesta, puedes dejarla sin elegir.","We only ask what can change the next step. If you do not know an answer, you can leave it unselected."))}</p><div class="field"><label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="sendAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}"></div><div class="field"><label>${esc(t("¿A qué país?","Which country?"))}</label><select id="sendCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select></div><div class="field"><label>${esc(t("¿Qué importa más?","What matters most?"))}</label><select id="sendPriority"><option value="">${esc(t("No estoy seguro","Not sure"))}</option>${["recipient_gets_more","fastest","save","balanced"].map(x=>`<option value="${x}" ${priority===x?"selected":""}>${esc(priorityLabel(x))}</option>`).join("")}</select></div><div class="form-row"><div class="field"><label>${esc(t("¿Es urgente?","Is it urgent?"))}</label><select id="sendUrgency"><option value="">${esc(t("No sé","Not sure"))}</option><option value="true">${esc(t("Sí","Yes"))}</option><option value="false">${esc(t("No","No"))}</option></select></div><div class="field"><label>${esc(t("¿Cada cuánto envías?","How often?"))}</label><select id="sendFrequency"><option value="">${esc(t("Una vez / no sé","One time / not sure"))}</option>${["one_time","weekly","biweekly","monthly"].map(x=>`<option value="${x}">${esc(frequencyLabel(x))}</option>`).join("")}</select></div></div><div class="form-row"><div class="field"><label>${esc(t("¿Cómo recibe?","How does recipient receive?"))}</label><select id="sendDelivery"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.delivery_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(methodLabel(x))}</option>`).join("")}</select></div><div class="field"><label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label><select id="sendPayment"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.payment_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(methodLabel(x))}</option>`).join("")}</select></div></div><div id="moneyWarning"></div><div class="actions"><button class="btn" onclick="compare()">${esc(t("Revisar opciones","Review options"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Cancelar","Cancel"))}</button></div></section>`,t("Enviar dinero","Send money"));
 document.getElementById("sendAmount")?.addEventListener("input",updateMoneyWarning);updateMoneyWarning()
}
function getMoneyState(){return getJSON(APP.moneyKey,{income:0,incomeFreq:"monthly",monthlyIncome:0,essential:0,flexible:0,savings:0,remittance:0,available:0})}
function updateMoneyWarning(){
 const box=document.getElementById("moneyWarning");if(!box)return;
 const a=Number(document.getElementById("sendAmount")?.value||0),m=getMoneyState(),av=Number(m.available||0),w=[];
 if(av>0&&a>av)w.push(t(`El monto supera tu disponible calculado (${money(av)}).`,`The amount exceeds your calculated available balance (${money(av)}).`));
 if(a>10000)w.push(t("Por este monto conviene revisar cuidadosamente los datos finales del proveedor.","For this amount, carefully review the provider's final details."));
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
 APP.session.available_providers=r.available_providers||[];APP.session.verified_results=r.results||[];renderComparison(r)
 }catch(e){showError(e.message)}
}
function renderLoading(){renderShell(`<section class="card loading"><div class="loader large"></div><div><strong>${esc(t("Revisando opciones","Reviewing options"))}</strong><p>${esc(t("Comprobamos lo que puede mostrarse. No inventaremos datos comerciales.","We check what can be shown. We will not invent commercial data."))}</p></div></section>`,t("Revisión","Review"))}
function providerCard(p){
 const id=p.provider_id||p.id||"",r=(APP.session?.verified_results||[]).find(x=>x.provider_id===id),verified=Boolean(p.commercial_verified||p.commercial_status==="verified"||r?.status==="verified"),url=p.continue_url||p.official_site||p.official_urls?.send_money||p.official_urls?.site;
 const payment=(p.payment_methods||[]).map(methodLabel).filter(Boolean),delivery=(p.delivery_methods||[]).map(methodLabel).filter(Boolean);
 return`<article class="provider-card"><div class="provider-head"><div><h3>${esc(p.provider_name||p.name||id)}</h3><p>${esc(verified?t("Datos comerciales verificados","Verified commercial data"):t("Datos actuales no verificados","Current data not verified"))}</p></div><span class="provider-status ${verified?"verified":""}">${esc(verified?t("Verificado","Verified"):t("Sitio oficial","Official site"))}</span></div>${verified&&r?`<div class="provider-data"><div class="metric"><span>${esc(t("Tarifa","Fee"))}</span><strong>${r.fee!=null?money(r.fee):"—"}</strong></div><div class="metric"><span>${esc(t("Tasa","Rate"))}</span><strong>${esc(r.exchange_rate??"—")}</strong></div><div class="metric"><span>${esc(t("Recibe","Gets"))}</span><strong>${r.recipient_amount!=null?money(r.recipient_amount):"—"}</strong></div><div class="metric"><span>${esc(t("Entrega","Delivery"))}</span><strong>${esc(r.estimated_delivery??r.delivery_time??"—")}</strong></div></div>`:`<div class="notice warning">${esc(t("No mostramos tarifas, tasas, tiempos ni disponibilidad como datos actuales porque no están verificados.","We do not show fees, rates, timing, or availability as current data because they are not verified."))}</div>`}${payment.length?`<p class="legal"><b>${esc(t("Cómo pagas:","How you pay:"))}</b> ${esc(payment.join(", "))}</p>`:""}${delivery.length?`<p class="legal"><b>${esc(t("Cómo recibe:","How recipient receives:"))}</b> ${esc(delivery.join(", "))}</p>`:""}${p.supports_online?`<p class="legal">${esc(t("Aparece con opción en línea en los datos de esta aplicación.","It is listed with an online option in this app's data."))}</p>`:""}${p.supports_agent?`<p class="legal">${esc(t("Aparece con atención en agente en los datos de esta aplicación.","Agent service is listed in this app's data."))}</p>`:""}${url?`<div class="actions"><button class="btn" onclick='selectProvider(${jsq(id)})'>${esc(t("Revisar proveedor","Review provider"))}</button></div>`:""}</article>`
}
function renderComparison(data){
 const providers=data.available_providers||[],verified=Number(data.verified_count||0);
 renderShell(`<section class="section"><div class="section-title"><div><h2>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h2><p>${esc(data.destination_name||countryName(data.destination_country))}</p></div><strong>${money(data.amount)}</strong></div>${providers.length?`<div class="result-list">${providers.map(providerCard).join("")}</div>`:`<div class="empty">${esc(t("No encontramos proveedores para este destino en el catálogo actual.","No providers were found for this destination in the current catalog."))}</div>`}<div class="notice ${data.results_available?"success":"warning"}">${esc(data.results_available?t(`${verified} opción(es) con datos verificados`,`${verified} option(s) with verified data`):t("No hay datos comerciales actuales verificados","No current verified commercial data"))}</div><div class="notice info">${esc(data.explanation||t("La disponibilidad, tarifa, tasa, tiempo, requisitos y datos finales se confirman directamente con el proveedor.","Availability, fee, rate, timing, requirements, and final details must be confirmed directly with the provider."))}</div><div class="actions"><button class="btn secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div></section>`,t("Opciones","Options"))
}
async function selectProvider(id){
 try{const d=await api(`/api/session/${APP.session.session_id}/select/${encodeURIComponent(id)}`,{method:"POST"});APP.session=d.session;renderFinalCheck()}catch(e){showError(e.message)}
}
async function renderFinalCheck(){
 if(!APP.session?.selected_option){showError(t("Selecciona primero un proveedor.","Select a provider first."));return}
 try{
  const d=await api(`/api/session/${APP.session.session_id}/final-check`,{method:"POST"}),o=APP.session.selected_option,url=o.continue_url||o.official_site||"";
  renderShell(`<section class="card"><div class="notice ${d.ready_to_continue?"success":"warning"}">${esc(d.ready_to_continue?t("Revisión básica completada","Basic review completed"):t("Revisa los datos","Review the details"))}</div><h1>${esc(o.provider_name||"")}</h1><p>${esc(d.message||"")}</p><div class="assistant">${(d.checks||[]).map(c=>{const ok=Boolean(c.complete)&&c.status!=="review";return`<div class="assistant-box ${ok?"":"user"}"><strong>${ok?"✓":"!"} ${esc(c.label)}</strong><span>${esc(String(c.value??""))}</span></div>`}).join("")}</div><div class="notice warning">${esc(t("El destinatario, la tarifa, la tasa, el tiempo, la disponibilidad y los requisitos deben confirmarse en el sitio oficial. No introduzcas aquí contraseñas, CVV ni códigos de seguridad.","Recipient information, fee, rate, timing, availability, and requirements must be confirmed on the official site. Do not enter passwords, CVVs, or security codes here."))}</div>${(d.requirements||[]).length?`<p class="legal"><b>${esc(t("Requisitos declarados:","Declared requirements:"))}</b> ${(d.requirements||[]).map(x=>esc(methodLabel(x))).join(", ")}</p>`:""}${url?`<div class="actions"><button class="btn" onclick='openOfficial(${jsq(url)})'>${esc(t("Abrir sitio oficial","Open official site"))}</button></div>`:""}<div class="actions"><button class="btn secondary" onclick="renderComparisonFromSession()">${esc(t("Ver otros proveedores","See other providers"))}</button></div></section>`,t("Revisión final","Final review"))
 }catch(e){showError(e.message)}
}
function openOfficial(url){if(!/^https:\/\//i.test(url)){showError(t("El enlace oficial no es válido.","The official link is not valid."));return}window.open(url,"_blank","noopener,noreferrer")}
function renderComparisonFromSession(){
 const data={available_providers:APP.session?.available_providers||[],results:APP.session?.verified_results||[],verified_count:(APP.session?.verified_results||[]).length,results_available:(APP.session?.verified_results||[]).length>0,amount:APP.session?.amount,destination_country:APP.session?.destination_country,destination_name:countryName(APP.session?.destination_country),explanation:t("Estas son las opciones de la sesión actual.","These are the options from the current session.")};
 renderComparison(data)
}
function renderMoney(){
 const m=getMoneyState();
 renderShell(`<section class="card form-card"><h1>${esc(t("Mi dinero","My money"))}</h1><p class="legal">${esc(t("Este cálculo es tuyo; no es un saldo bancario. Tus registros se guardan en este dispositivo.","This is your calculation; it is not a bank balance. Your records stay on this device."))}</p><div class="form-row"><div class="field"><label>${esc(t("Ingreso","Income"))}</label><input id="income" type="number" min="0" step=".01" value="${esc(m.income||"")}"></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq"><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="monthly">${esc(t("Mensual","Monthly"))}</option></select></div></div><div class="form-row"><div class="field"><label>${esc(t("Gastos esenciales","Essential expenses"))}</label><input id="essential" type="number" min="0" step=".01" value="${esc(m.essential||"")}"></div><div class="field"><label>${esc(t("Gastos flexibles","Flexible expenses"))}</label><input id="flexible" type="number" min="0" step=".01" value="${esc(m.flexible||"")}"></div></div><div class="form-row"><div class="field"><label>${esc(t("Ahorro reservado","Reserved savings"))}</label><input id="savings" type="number" min="0" step=".01" value="${esc(m.savings||"")}"></div><div class="field"><label>${esc(t("Remesas reservadas","Reserved remittance"))}</label><input id="remittance" type="number" min="0" step=".01" value="${esc(m.remittance||"")}"></div></div><div class="actions"><button class="btn" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button></div><div id="moneyResult"></div><p class="legal">${esc(t("Estos registros pueden servirte como referencia para entregar información a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.","These records can serve as a reference when giving information to your accountant or tax preparer. REMESAS does not prepare or file taxes."))}</p></section>`,t("Mi dinero","My money"));
 document.getElementById("incomeFreq").value=m.incomeFreq||"monthly";if(Number(m.income||0))showMoneyResult(m)
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
 box.innerHTML=`<div class="balance-grid"><div class="balance"><span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span><strong>${money(d.monthlyIncome)}</strong></div><div class="balance"><span>${esc(t("Disponible calculado","Calculated available"))}</span><strong>${money(a)}</strong></div></div><div class="notice ${a>=0?"success":"warning"}">${esc(a>=0?t("PUEDO: el cálculo queda por encima de cero.","I CAN: the calculation remains above zero."):t("PUEDO: tus compromisos superan el ingreso calculado.","I CAN: your commitments exceed calculated income."))}</div><div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Usar para una remesa","Use for a transfer"))}</button></div>`
}
function renderWeek(){
 const m=getMoneyState();if(!m.monthlyIncome){renderMoney();return}
 const q=Number(m.monthlyIncome)/4.333333,commit=(Number(m.essential)+Number(m.flexible)+Number(m.savings)+Number(m.remittance))/4.333333,a=q-commit;
 renderShell(`<section class="card"><h1>${esc(t("Mi semana","My week"))}</h1><div class="balance-grid"><div class="balance"><span>${esc(t("Ingreso semanal equivalente","Equivalent weekly income"))}</span><strong>${money(q)}</strong></div><div class="balance"><span>${esc(t("Compromisos semanales","Weekly commitments"))}</span><strong>${money(commit)}</strong></div><div class="balance ${a>=0?"positive":"negative"}"><span>${esc(t("Disponible semanal","Weekly available"))}</span><strong>${money(a)}</strong></div></div><div class="notice ${a>=0?"success":"warning"}">${esc(a>=0?t("Puedes usar esta cifra como referencia semanal.","You can use this figure as a weekly reference."):t("Revisa tus compromisos antes de aumentar gasto o remesa.","Review commitments before increasing spending or transfers."))}</div><div class="actions"><button class="btn" onclick="renderMoney()">${esc(t("Modificar cálculo","Modify calculation"))}</button></div></section>`,t("Mi semana","My week"))
}
function getExpenses(){return getJSON(APP.expensesKey,[])}
function renderExpenses(){
 const e=getExpenses();
 renderShell(`<section class="card form-card"><h1>${esc(t("Mis gastos","My expenses"))}</h1><p class="legal">${esc(t("Guardar aquí te ayuda a ver cuánto sale y luego usar ese dato en Mi dinero.","Saving expenses here helps you see what goes out and then use that information in My money."))}</p><div class="field"><label>${esc(t("Descripción","Description"))}</label><input id="expenseName" maxlength="120"></div><div class="field"><label>${esc(t("Monto","Amount"))}</label><input id="expenseAmount" type="number" min=".01" step=".01"></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expenseFrequency"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="one_time">${esc(t("Una vez","One time"))}</option></select></div><div class="actions"><button class="btn" onclick="addExpense()">${esc(t("Guardar gasto","Save expense"))}</button></div><div class="result-list">${e.map((x,i)=>`<div class="card"><div class="section-title"><div><strong>${esc(x.description)}</strong><p>${esc(frequencyLabel(x.frequency))}</p></div><strong>${money(x.amount)}</strong></div><button class="btn danger small" onclick="removeExpense(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join("")}</div><div class="actions"><button class="btn secondary" onclick="renderMoney()">${esc(t("Actualizar Mi dinero","Update My money"))}</button></div></section>`,t("Mis gastos","My expenses"))
}
function addExpense(){
 const d=(document.getElementById("expenseName")?.value||"").trim(),a=Number(document.getElementById("expenseAmount")?.value||0),f=document.getElementById("expenseFrequency")?.value||"monthly";
 if(!d||!a||a<=0){showError(t("Completa descripción y monto válido.","Enter a description and valid amount."));return}
 const e=getExpenses();e.push({description:d,amount:a,frequency:f,createdAt:new Date().toISOString()});setJSON(APP.expensesKey,e);renderExpenses()
}
function removeExpense(i){const e=getExpenses();e.splice(i,1);setJSON(APP.expensesKey,e);renderExpenses()}
function renderFamily(){
 const d=getJSON(APP.familyKey,{name:"",country:"",amount:""});
 renderShell(`<section class="card form-card"><h1>${esc(t("Familia","Family"))}</h1><p class="legal">${esc(t("Solo es una referencia local; no crea una orden de envío.","This is only a local reference; it does not create a transfer order."))}</p><div class="field"><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="familyName" maxlength="80" value="${esc(d.name)}"></div><div class="field"><label>${esc(t("País","Country"))}</label><select id="familyCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===d.country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select></div><div class="field"><label>${esc(t("Monto de referencia","Reference amount"))}</label><input id="familyAmount" type="number" min="0" step=".01" value="${esc(d.amount)}"></div><div class="actions"><button class="btn" onclick="saveFamily()">${esc(t("Guardar en este dispositivo","Save on this device"))}</button></div></section>`,t("Familia","Family"))
}
function saveFamily(){setJSON(APP.familyKey,{name:(document.getElementById("familyName")?.value||"").trim(),country:document.getElementById("familyCountry")?.value||"",amount:Number(document.getElementById("familyAmount")?.value||0)});renderHome()}
function renderSavings(){
 const m=getMoneyState();
 renderShell(`<section class="card form-card"><h1>${esc(t("Ahorrar","Save"))}</h1><p class="legal">${esc(t("Reserva una cantidad y deja la referencia guardada en este dispositivo.","Reserve an amount and keep the reference on this device."))}</p><div class="field"><label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label><input id="saveAmount" type="number" min="0" step=".01" value="${esc(m.savings||"")}"></div><div class="field"><label>${esc(t("¿Para qué?","What for?"))}</label><input id="savePurpose" maxlength="100" value="${esc(m.savingsPurpose||"")}"></div><div class="actions"><button class="btn" onclick="saveSavings()">${esc(t("Guardar objetivo","Save goal"))}</button></div></section>`,t("Ahorrar","Save"))
}
function saveSavings(){const m=getMoneyState();m.savings=Number(document.getElementById("saveAmount")?.value||0);m.savingsPurpose=(document.getElementById("savePurpose")?.value||"").trim();setJSON(APP.moneyKey,m);renderMoney()}
function renderPurchase(){
 renderShell(`<section class="card form-card"><h1>${esc(t("Planear una compra","Plan a purchase"))}</h1><p class="legal">${esc(t("La aplicación compara el precio con tu disponible calculado; no decide por ti si debes comprar.","The app compares the price with your calculated available amount; it does not decide whether you should buy."))}</p><div class="field"><label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label><input id="purchaseName" maxlength="120"></div><div class="field"><label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label><input id="purchaseAmount" type="number" min=".01" step=".01"></div><div class="actions"><button class="btn" onclick="checkPurchase()">${esc(t("Comprobar","Check"))}</button></div></section>`,t("Planear una compra","Plan a purchase"))
}
function checkPurchase(){
 const n=(document.getElementById("purchaseName")?.value||"").trim(),a=Number(document.getElementById("purchaseAmount")?.value||0),m=getMoneyState(),d=Number(m.available||0)-a;
 if(!n||!a||a<=0){showError(t("Completa nombre y precio.","Enter a name and valid price."));return}
 renderShell(`<section class="card"><div class="notice ${d>=0?"success":"warning"}">${esc(d>=0?t("PUEDO: cabe en tu cálculo actual.","I CAN: it fits your current calculation."):t("PUEDO: supera tu disponible actual.","I CAN: it exceeds your current available amount."))}</div><h1>${esc(n)}</h1><div class="balance-grid"><div class="balance"><span>${esc(t("Precio","Price"))}</span><strong>${money(a)}</strong></div><div class="balance"><span>${esc(t("Después de comprar","After purchase"))}</span><strong>${money(d)}</strong></div></div><div class="actions"><button class="btn" onclick="renderMoney()">${esc(t("Revisar Mi dinero","Review My money"))}</button></div></section>`,t("Resultado","Result"))
}
function renderHelp(){
 const topics=APP.config?.help_topics||[];
 renderShell(`<section class="card"><h1>${esc(t("¿Qué no entiendes?","What don't you understand?"))}</h1><p class="legal">${esc(t("Elige una pregunta y recibirás una respuesta práctica.","Choose a question and you will get a practical answer."))}</p><div class="result-list">${topics.map(x=>`<button class="card action-card" onclick='showHelpTopic(${jsq(x.id)})'><strong>${esc(x.title?.[APP.lang]||x.title?.es||x.title||"")}</strong></button>`).join("")}</div><div class="actions"><button class="btn secondary" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></section>`,t("Ayuda","Help"))
}
function showHelpTopic(id){
 const x=(APP.config?.help_topics||[]).find(a=>a.id===id);if(!x)return;
 const title=x.title?.[APP.lang]||x.title?.es||x.title||id,answer=x.answer?.[APP.lang]||x.answer?.es||x.answer||"";
 renderShell(`<section class="card"><h1>${esc(title)}</h1><p>${esc(answer)}</p><div class="actions"><button class="btn" onclick="renderHelp()">${esc(t("Ver más ayuda","More help"))}</button></div></section>`,title)
}
async function renderLearning(){
 try{
  const d=await api(`/api/learning?language=${encodeURIComponent(APP.lang)}`);
  const lessons=d.lessons||d.learning_lessons||d||[];
  if(!Array.isArray(lessons)){renderLearningFallback();return}
  renderShell(`<section class="card"><h1>${esc(t("APRENDE A HACER UNA REMESA","LEARN HOW TO MAKE A REMITTANCE"))}</h1><p class="legal">${esc(t("Esta es una guía educativa independiente. Explica el proceso sin copiar pantallas, textos, logotipos ni interfaces de los proveedores.","This is an independent educational guide. It explains the process without copying provider screens, text, logos, or interfaces."))}</p><div class="result-list">${lessons.map((x,i)=>`<article class="card"><h3>${i+1}. ${esc(x.title?.[APP.lang]||x.title?.es||x.title||"")}</h3><p>${esc(x.purpose?.[APP.lang]||x.purpose?.es||x.purpose||x.teaches?.[APP.lang]||x.teaches?.es||x.teaches||"")}</p></article>`).join("")}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></section>`,t("APRENDER","LEARN"))
 }catch{renderLearningFallback()}
}
function renderLearningFallback(){
 const steps=[t("Antes de comenzar","Before you start"),t("Elige el país","Choose the destination"),t("Indica el monto","Enter the amount"),t("Revisa cuánto recibe","Understand what the recipient gets"),t("Elige cómo recibe","Choose delivery"),t("Elige cómo pagar","Choose payment"),t("Introduce los datos del destinatario","Enter recipient information"),t("Revisa antes de enviar","Review before sending"),t("Completa el proceso en el proveedor","Complete with the provider")];
 renderShell(`<section class="card"><h1>${esc(t("APRENDER","LEARN"))}</h1><p class="legal">${esc(t("Guía educativa independiente de REMESAS.","Independent REMESAS educational guide."))}</p><div class="result-list">${steps.map((x,i)=>`<article class="card"><h3>${i+1}. ${esc(x)}</h3></article>`).join("")}</div><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></section>`,t("APRENDER","LEARN"))
}
async function renderQuickGuide(){
 try{
  const d=await api(`/api/quick-guide?language=${encodeURIComponent(APP.lang)}`);
  const steps=d.steps||d.guide||[];
  if(Array.isArray(steps)&&steps.length){
   renderShell(`<section class="card"><h1>${esc(t("GUÍA RÁPIDA","QUICK GUIDE"))}</h1><p class="legal">${esc(t("Pasos sencillos para preparar tu remesa y continuar con el proveedor oficial.","Simple steps to prepare your transfer and continue with the official provider."))}</p><ol class="list">${steps.map(x=>`<li>${esc(x.title?.[APP.lang]||x.title?.es||x.title||x.text?.[APP.lang]||x.text?.es||x.text||x)}</li>`).join("")}</ol><div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Preparar una remesa","Prepare a transfer"))}</button></div></section>`,t("GUÍA RÁPIDA","QUICK GUIDE"));return
  }
 }catch{}
 renderQuickGuideFallback()
}
function renderQuickGuideFallback(){
 const steps=[t("Indica cuánto quieres enviar.","Enter how much you want to send."),t("Selecciona el país.","Select the country."),t("Indica qué necesitas.","Tell us what matters."),t("Revisa solamente los datos que estén verificados.","Review only verified data."),t("Selecciona un proveedor para revisar.","Select a provider to review."),t("Confirma los datos finales en el sitio oficial.","Confirm final details on the official site.")];
 renderShell(`<section class="card"><h1>${esc(t("GUÍA RÁPIDA","QUICK GUIDE"))}</h1><ol class="list">${steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol><div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Preparar una remesa","Prepare a transfer"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></section>`,t("GUÍA RÁPIDA","QUICK GUIDE"))
}
function showError(m){
 const old=document.querySelector(".toast");if(old)old.remove();
 const b=document.createElement("div");b.className="toast";b.textContent=m||t("Ocurrió un error.","An error occurred.");document.body.appendChild(b);setTimeout(()=>b.remove(),7000)
}
function deleteLocalData(){
 if(!confirm(t("¿Borrar los datos guardados en este dispositivo? Esto eliminará Mi dinero, gastos, familia, ahorro y preferencias de REMESAS.","Delete the data saved on this device? This removes My money, expenses, family, savings, and REMESAS preferences.")))return;
 [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,"remesas_lang_v4"].forEach(k=>localStorage.removeItem(k));
 if(APP.session?.session_id)api(`/api/session/${APP.session.session_id}`,{method:"DELETE"}).catch(()=>{});
 location.reload()
}
function renderPaywall(){
 const price=APP.config?.service?.price||APP.config?.service_price||10.99;
 renderShell(`<section class="card form-card"><div class="notice info"><b>${esc(t("REMESAS","REMESAS"))}</b><p>${esc(t("Acceso al servicio completo por 20 minutos.","Full service access for 20 minutes."))}</p></div><h1>${esc(t("Comenzar","Get started"))}</h1><p>${esc(t("Pago único de $10.99. Después del pago tendrás acceso al servicio durante 20 minutos.","One-time payment of $10.99. After payment you will have access to the service for 20 minutes."))}</p><div class="notice"><strong>${money(price)}</strong><p>${esc(t("No es una suscripción.","This is not a subscription."))}</p></div><div class="actions"><button class="btn" onclick="startPayment()">${esc(t("Pagar y comenzar","Pay and start"))}</button></div><p class="legal">${esc(t("REMESAS no es banco, financiera, asesor financiero ni procesador de pagos. El pago da acceso al servicio de REMESAS; no compra ni ejecuta una remesa.","REMESAS is not a bank, financial institution, financial advisor, or payment processor. Payment gives access to REMESAS; it does not purchase or execute a remittance."))}</p></section>`,t("Acceso","Access"))
}
async function startPayment(){
 try{
  const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang})});
  const url=d.checkout_url||d.url;
  if(!url)throw new Error(t("No se recibió el enlace de pago.","No payment link was received."));
  window.location.href=url
 }catch(e){showError(e.message)}
}
async function checkStripeReturn(){
 const q=new URLSearchParams(location.search),sid=q.get("session_id");
 if(!sid)return false;
 try{
  const d=await api(`/api/payment/check?session_id=${encodeURIComponent(sid)}`);
  const tok=d.token||d.access_token||d.session_token;
  if(tok)localStorage.setItem(APP.accessKey,tok);
  if(d.active||d.unlocked||d.valid||tok){
   history.replaceState({},document.title,"/");
   APP.access=d;return true
  }
 }catch{}
 return false
}
function adminModal(){
 let modal=document.getElementById("modalRoot");
 if(!modal){modal=document.createElement("div");modal.id="modalRoot";document.body.appendChild(modal)}
 modal.innerHTML=`<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><div class="modal-head"><h2>${esc(t("Acceso administrativo","Administrator access"))}</h2><button class="close" onclick="closeModal()">×</button></div><div class="field"><label>${esc(t("Usuario","Username"))}</label><input id="adminUser" autocomplete="username"></div><div class="field"><label>${esc(t("Contraseña","Password"))}</label><input id="adminPass" type="password" autocomplete="current-password"></div><div class="actions"><button class="btn" onclick="adminLogin()">${esc(t("Entrar","Sign in"))}</button></div><div id="adminMsg"></div></div></div>`;
 setTimeout(()=>document.getElementById("adminUser")?.focus(),50)
}
function closeModal(){document.getElementById("modalRoot")?.remove()}
async function adminLogin(){
 const user=(document.getElementById("adminUser")?.value||"").trim(),pass=document.getElementById("adminPass")?.value||"",box=document.getElementById("adminMsg");
 if(!user||!pass){if(box)box.innerHTML=`<div class="notice warning">${esc(t("Escribe usuario y contraseña.","Enter username and password."))}</div>`;return}
 try{
  const d=await api("/api/login-admin",{method:"POST",body:JSON.stringify({username:user,password:pass})});
  const tok=d.token||d.access_token||d.session_token;
  if(tok)localStorage.setItem(APP.accessKey,tok);
  APP.access={...d,active:true,unlocked:true,admin:true};
  closeModal();toast(t("Acceso administrativo activado.","Administrator access activated."));
  await loadConfig();await startSession(false);renderHome()
 }catch(e){if(box)box.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`}
}
function toast(m){
 const old=document.querySelector(".toast");if(old)old.remove();
 const x=document.createElement("div");x.className="toast";x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)
}
function setupTripleTap(){
 let taps=0,last=0,timer=null;
 window.addEventListener("pointerup",e=>{
  if(e.isPrimary===false)return;
  const now=Date.now();
  if(now-last>900)taps=0;
  taps++;last=now;
  clearTimeout(timer);
  if(taps===3){taps=0;last=0;adminModal();return}
  timer=setTimeout(()=>{taps=0},900)
 },true)
}
async function changeLanguage(){
 APP.lang=APP.lang==="es"?"en":"es";
 localStorage.setItem("remesas_lang_v4",APP.lang);
 try{await loadConfig();renderHome()}catch(e){showError(e.message)}
}
async function boot(){
 setupTripleTap();
 try{
  await loadConfig();
  const paid=await checkStripeReturn();
  if(!paid)await checkAccess();
  if(!accessActive()&&!await verifyAccess()){renderPaywall();return}
  await startSession(true);
  renderHome()
 }catch(e){
  app.innerHTML=`<div class="app-shell"><section class="card"><div class="notice danger">${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}</div><p>${esc(e.message)}</p><div class="actions"><button class="btn" onclick="location.reload()">${esc(t("Reintentar","Retry"))}</button></div></section></div>`
 }
}
Object.assign(window,{renderHome,renderAbout,renderRemittance,renderMoney,renderWeek,renderExpenses,renderFamily,renderHelp,renderPurchase,renderSavings,changeLanguage,understandNeed,beginParsedRemittance,compare,selectProvider,renderFinalCheck,renderComparisonFromSession,openOfficial,calculateMoney,addExpense,removeExpense,saveFamily,saveSavings,checkPurchase,showHelpTopic,deleteLocalData,updateMoneyWarning,renderLearning,renderQuickGuide,renderQuickGuideFallback,startPayment,adminModal,closeModal,adminLogin});
document.addEventListener("DOMContentLoaded",boot);
