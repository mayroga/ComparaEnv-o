"use strict";

const APP={name:"REMESAS",version:"4.2.0",lang:localStorage.getItem("remesas_lang_v4")||"es",session:null,config:null,access:null,moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",prefsKey:"remesas_prefs_v4",timer:null,adminTaps:[],paymentChecking:false,learningCache:null};
const app=document.getElementById("app");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const t=(es,en)=>APP.lang==="en"?en:es;
const money=v=>new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v||0));
const num=v=>Number.isFinite(Number(v))?Number(v):0;

function getJSON(k,f){try{const v=JSON.parse(localStorage.getItem(k)||"");return v??f}catch{return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function accessToken(){return APP.access?.token||sessionStorage.getItem("remesas_access_token_v4")||""}
function normalizeAccess(d){
 if(!d)return null;
 if(d.token)return d;
 if(d.access&&typeof d.access==="object"&&d.access.token)return d.access;
 return null
}
function saveAccess(d){
 const a=normalizeAccess(d);
 if(!a?.token)return false;
 APP.access=a;
 sessionStorage.setItem("remesas_access_token_v4",a.token);
 return true
}
function clearAccess(){APP.access=null;sessionStorage.removeItem("remesas_access_token_v4");clearInterval(APP.timer);APP.timer=null}
function expiryMs(v){
 if(typeof v==="number")return v<100000000000?v*1000:v;
 const n=Number(v);
 if(Number.isFinite(n))return n<100000000000?n*1000:n;
 const d=Date.parse(v);
 return Number.isFinite(d)?d:0
}
function remainingSeconds(){
 const e=expiryMs(APP.access?.expires_at);
 return e?Math.max(0,Math.floor((e-Date.now())/1000)):0
}
function accessActive(){return Boolean(accessToken())&&remainingSeconds()>0}
function formatTime(s){s=Math.max(0,Math.floor(s));return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function protectedEndpoint(u){return/^\/api\/(session|need|compare|final-check|local-data|learn|quick-guide|learning-pdf|help|assistant|chat)/.test(u)}

async function api(url,opt={}){
 const h={"Content-Type":"application/json",...(opt.headers||{})},token=accessToken();
 if(token)h["X-Remesas-Access-Token"]=token;
 const r=await fetch(url,{...opt,headers:h});
 let d={};try{d=await r.json()}catch{}
 if((r.status===401||r.status===403)&&protectedEndpoint(url)){clearAccess();renderAccessGate()}
 if(!r.ok)throw new Error(d.detail||d.error||d.message||t("No se pudo completar la operación.","The operation could not be completed."));
 return d
}

async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);return APP.config}

async function checkAccess(){
 const token=accessToken();
 if(!token){APP.access=null;return null}
 try{
  const d=await api("/api/access/status");
  if(d?.active&&token){
   APP.access={token,expires_at:d.expires_at,seconds_remaining:d.seconds_remaining,subject:d.subject};
   startTimer();return APP.access
  }
 }catch{}
 clearAccess();return null
}

async function refreshAccess(){
 if(!accessToken())return false;
 try{
  const d=await api("/api/access/status");
  if(d?.active){
   APP.access={token:accessToken(),expires_at:d.expires_at,seconds_remaining:d.seconds_remaining,subject:d.subject};
   updateClock();return true
  }
 }catch{}
 clearAccess();return false
}

async function startSession(preserve=true){
 if(!accessActive())throw new Error(t("El servicio no está activo.","The service is not active."));
 if(preserve&&APP.session?.session_id){
  try{APP.session=(await api(`/api/session/${encodeURIComponent(APP.session.session_id)}`)).session;return APP.session}catch{}
 }
 APP.session=(await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"})).session;
 return APP.session
}

async function changeLanguage(){
 APP.lang=APP.lang==="es"?"en":"es";
 localStorage.setItem("remesas_lang_v4",APP.lang);
 APP.learningCache=null;
 try{await loadConfig();accessActive()?renderHome():renderAccessGate()}catch(e){showError(e.message)}
}

function topbar(title="REMESAS"){
 return`<header class="topbar"><button class="icon-button" onclick="renderHome()">←</button><strong>${esc(title)}</strong><div class="top-actions"><span id="serviceClock" class="service-clock"></span><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header>`
}
function renderShell(c,title="REMESAS"){app.innerHTML=topbar(title)+`<main class="page">${c}</main>`;scrollTo(0,0);updateClock()}
function homeCard(i,title,text,a){return`<button class="home-card" onclick="${a}"><span>${i}</span><strong>${esc(title)}</strong><small>${esc(text)}</small></button>`}

function renderAccessGate(){
 clearInterval(APP.timer);APP.timer=null;
 app.innerHTML=`<header class="hero access-hero"><div class="hero-top"><strong>REMESAS</strong><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div><h1>${esc(t("Tu dinero, más claro","Your money, clearer"))}</h1><p>${esc(t("Una herramienta sencilla para organizar tu dinero, preparar remesas y revisar opciones oficiales.","A simple tool to organize your money, prepare remittances and review official options."))}</p></header><main class="home"><section class="card access-card"><div class="price-big">$10.99</div><h2>${esc(t("Servicio de una sola vez","One-time service"))}</h2><p>${esc(t("Un solo pago activa 20 minutos de servicio. No es una suscripción mensual.","One payment activates 20 minutes of service. It is not a monthly subscription."))}</p><div class="notice"><b>${esc(t("¿Qué recibes?","What do you get?"))}</b><p>${esc(t("Organización del dinero, gastos, ahorro y familia; preparación de remesas; comparación de información verificada; APRENDER; GUÍA RÁPIDA y revisión antes de continuar.","Money, expense, savings and family organization; remittance preparation; comparison of verified information; LEARN; QUICK GUIDE and review before continuing."))}</p></div><button class="primary" onclick="startPayment()">${esc(t("Activar servicio — $10.99","Activate service — $10.99"))}</button><button class="secondary" onclick="renderAbout()">${esc(t("Ver qué hace REMESAS","See what REMESAS does"))}</button><p class="small center-text">${esc(t("Pago único. 20 minutos. No ejecutamos transferencias ni recibimos tu dinero.","One-time payment. 20 minutes. We do not execute transfers or receive your money."))}</p></section><section class="notice"><b>${esc(t("Privacidad","Privacy"))}</b><p>${esc(t("Tus registros de dinero, gastos, familia y ahorro permanecen en este dispositivo. No escribas contraseñas bancarias, CVV, códigos de seguridad ni credenciales de proveedores.","Your money, expense, family and savings records stay on this device. Do not enter bank passwords, CVVs, security codes or provider credentials."))}</p></section><footer>May Roga LLC · v${APP.version}</footer></main>`
}

async function startPayment(){
 try{
  const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang})});
  const u=d.checkout_url||d.url;
  if(u){location.href=u;return}
  showError(t("No se pudo abrir el pago.","The payment page could not be opened."))
 }catch(e){showError(e.message)}
}

async function checkPaymentReturn(){
 const q=new URLSearchParams(location.search),sid=q.get("session_id");
 if(!sid||q.get("payment")!=="success"||APP.paymentChecking)return false;
 APP.paymentChecking=true;
 try{
  const d=await api(`/api/payment/check?session_id=${encodeURIComponent(sid)}`);
  const a=normalizeAccess(d);
  if(d?.active&&a||d?.authorized&&a){
   saveAccess(a);history.replaceState({},document.title,location.pathname);startTimer();showServiceReady();return true
  }
  showError(t("El pago todavía no aparece como completado.","The payment does not appear completed yet."))
 }catch(e){showError(e.message)}
 finally{APP.paymentChecking=false}
 return false
}

function showServiceReady(){
 app.innerHTML=`<main class="page"><section class="card center"><div class="status success">${esc(t("Servicio activado","Service activated"))}</div><h1>${esc(t("Listo para empezar","Ready to start"))}</h1><p>${esc(t("Tienes 20 minutos de servicio.","You have 20 minutes of service."))}</p><button class="primary" onclick="renderHome()">${esc(t("Empezar","Start"))}</button></section></main>`;
 setTimeout(renderHome,900)
}

function startTimer(){
 clearInterval(APP.timer);
 if(!accessActive())return;
 APP.timer=setInterval(()=>{if(remainingSeconds()<=0)lockExpiredService();else updateClock()},1000);
 updateClock()
}
function updateClock(){
 const e=document.getElementById("serviceClock");if(!e)return;
 const s=remainingSeconds();e.textContent=s?`${t("Tiempo","Time")} ${formatTime(s)}`:"";e.className=`service-clock ${s<=120?"urgent":""}`
}
function lockExpiredService(){clearAccess();APP.session=null;renderAccessExpired()}
function renderAccessExpired(){
 app.innerHTML=`<main class="page"><section class="card center"><div class="status warning">${esc(t("Tiempo terminado","Time ended"))}</div><h1>${esc(t("Tu servicio terminó","Your service ended"))}</h1><p>${esc(t("El período de 20 minutos ya terminó.","Your 20-minute service period has ended."))}</p><button class="primary" onclick="renderAccessGate()">${esc(t("Activar servicio","Activate service"))}</button></section></main>`
}

function renderHome(){
 if(!accessActive()){renderAccessGate();return}
 const o=APP.config?.opening||{};
 app.innerHTML=`<header class="hero"><div class="hero-top"><strong>REMESAS</strong><div class="hero-actions"><span id="serviceClock" class="service-clock"></span><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></div><h1>${esc(o.primary_question||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1><p>${esc(o.secondary_text||t("Entiende tu necesidad, organiza tus datos y continúa con la fuente oficial.","Understand your need, organize your information, and continue with the official source."))}</p></header><main class="home"><section class="notice"><b>${esc(t("¿Para qué sirve?","What is it for?"))}</b><p>${esc(t("REMESAS te ayuda a entender, organizar y preparar una remesa. También registra dinero, gastos, ahorro y referencias familiares en este dispositivo.","REMESAS helps you understand, organize, and prepare a remittance. It also records money, expenses, savings, and family references on this device."))}</p></section><section class="notice"><b>${esc(t("Importante","Important"))}</b><p>${esc(t("No inventamos tarifas, tasas, tiempos, disponibilidad, límites ni promociones. Cuando un dato actual no está verificado, te dirigimos a la fuente oficial.","We do not invent fees, rates, timing, availability, limits, or promotions. When current data are not verified, we direct you to the official source."))}</p></section><div class="cycle">${["TENGO","GANO","GASTO","AHORRO","QUIERO","PUEDO","HAGO"].map(x=>`<span>${x}</span>`).join("")}</div><section class="quick-grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa.","Prepare a transfer."),"renderRemittance()")}${homeCard("📘",t("APRENDER","LEARN"),t("Aprende el proceso paso a paso.","Learn the process step by step."),"renderLearning()")}${homeCard("🧭",t("GUÍA RÁPIDA","QUICK GUIDE"),t("Acompañamiento hasta el sitio oficial.","Guidance to the official site."),"renderQuickGuide()")}${homeCard("💰",t("Mi dinero","My money"),t("Calcula lo que tienes disponible.","Calculate what you have available."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Diario, semanal, quincenal y mensual.","Daily, weekly, biweekly and monthly."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa gastos.","Record and review expenses."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia local.","Save a local reference."),"renderFamily()")}${homeCard("❓",t("Ayuda","Help"),t("Encuentra una respuesta práctica.","Find a practical answer."),"renderHelp()")}${homeCard("🛒",t("Planear compra","Plan purchase"),t("Comprueba si cabe en tu cálculo.","Check whether it fits."),"renderPurchase()")}${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para una meta.","Reserve money for a goal."),"renderSavings()")}</section><section class="card"><h2>${esc(t("¿Qué necesitas hacer?","What do you need to do?"))}</h2><p class="small">${esc(t("Escríbelo con tus propias palabras.","Use your own words."))}</p><textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero enviar $200 a México...","Example: I want to send $200 to Mexico..."))}"></textarea><button class="primary" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button></section><section class="card"><h2>${esc(t("Tus registros","Your records"))}</h2><p class="small">${esc(t("Tus datos permanecen en este dispositivo. Puedes descargarlos en PDF e importarlos después.","Your data stays on this device. You can download it as PDF and import it later."))}</p><button class="primary" onclick="exportPDF()">${esc(t("Descargar mis datos en PDF","Download my data as PDF"))}</button><label class="file-button">${esc(t("Importar PDF de REMESAS","Import REMESAS PDF"))}<input type="file" accept="application/pdf,.pdf" onchange="importPDF(event)" hidden></label></section><section class="card"><h2>${esc(t("Protección y privacidad","Protection and privacy"))}</h2><p class="small">${esc(t("No introduzcas contraseñas bancarias, CVV, códigos de seguridad, OTP ni credenciales de proveedores.","Do not enter bank passwords, CVVs, security codes, OTPs, or provider credentials."))}</p><p class="small">${esc(t("REMESAS no es banco, financiera, asesor financiero ni procesador de pagos. No recibe ni envía tu dinero.","REMESAS is not a bank, financial institution, financial advisor, or payment processor. It does not receive or send your money."))}</p><button class="secondary" onclick="renderAbout()">${esc(t("Ver información completa","View full information"))}</button><button class="secondary" onclick="deleteLocalData()">${esc(t("Borrar mis datos","Delete my data"))}</button></section><footer>May Roga LLC · v${APP.version}</footer></main>`;
 updateClock()
}

function renderAbout(){
 renderShell(`<section class="card"><h1>${esc(t("Qué hace REMESAS","What REMESAS does"))}</h1><p>${esc(t("REMESAS ayuda a entender, organizar y preparar remesas, registrar dinero y gastos, aprender el proceso y revisar información disponible.","REMESAS helps users understand, organize, and prepare remittances, record money and expenses, learn the process, and review available information."))}</p><h2>${esc(t("Qué no hace","What it does not do"))}</h2><p>${esc(t("No es banco, financiera, asesor financiero, procesador de pagos, agente de proveedores, preparador de impuestos ni asesor legal. No recibe fondos, no inicia transferencias y no garantiza tarifas, tasas, tiempos o disponibilidad.","It is not a bank, financial institution, financial advisor, payment processor, provider agent, tax preparer, or legal advisor. It does not receive funds, initiate transfers, or guarantee fees, rates, timing, or availability."))}</p><h2>${esc(t("APRENDER","LEARN"))}</h2><p>${esc(t("El contenido educativo es original de REMESAS. No reproduce pantallas, logotipos, gráficos, textos, videos ni interfaces de los proveedores. No es capacitación oficial.","Educational content is original to REMESAS. It does not reproduce provider screens, logos, graphics, text, videos, or interfaces. It is not official training."))}</p><h2>${esc(t("Tus registros","Your records"))}</h2><p>${esc(t("Mi dinero, gastos, familia y ahorro se guardan localmente. El PDF puede servir como registro para compartir con un contador; REMESAS no prepara impuestos.","My money, expenses, family, and savings are stored locally. The PDF can serve as a record to share with an accountant; REMESAS does not prepare taxes."))}</p><p class="small">${esc(t("La información comercial cambia. Confirma siempre las condiciones actuales en el sitio oficial. Se recomienda revisión legal independiente para el uso comercial.","Commercial information changes. Always confirm current terms on the official site. Independent legal review is recommended for commercial use."))}</p><button class="primary" onclick="${accessActive()?"renderHome()":"renderAccessGate()"}">${esc(t("Volver","Back"))}</button></section>`,t("Información","Information"))
}

function countryCode(c){return String(c?.id||c?.code||"").toUpperCase()}
function countryName(code){const c=(APP.config?.countries||[]).find(x=>countryCode(x)===String(code||"").toUpperCase());return c?.name?.[APP.lang]||c?.name?.es||code||""}
function priorityLabel(v){return({recipient_gets_more:t("Que reciba más","Recipient gets more"),fastest:t("Rapidez","Speed"),save:t("Ahorrar","Save"),balanced:t("Equilibrio","Balanced")}[v]||v||"")}
function frequencyLabel(v){return({weekly:t("Semanal","Weekly"),biweekly:t("Quincenal","Biweekly"),monthly:t("Mensual","Monthly"),one_time:t("Una vez","One time")}[v]||v||"")}
function methodLabel(x){return typeof x==="string"?x:x?.label?.[APP.lang]||x?.label?.es||x?.name||x?.id||""}

async function understandNeed(){
 const text=(document.getElementById("freeNeed")?.value||"").trim();
 if(!text){showError(t("Escribe primero qué necesitas.","Write what you need first."));return}
 try{
  const d=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.lang})}),p=d.parsed||{};
  if(p.need_type==="remittance"||p.amount||p.destination_country){await beginParsedRemittance(p);return}
  renderShell(`<section class="card"><h1>${esc(t("Vamos paso a paso","Let's go step by step"))}</h1><p>${esc(t("Podemos empezar preparando una remesa, aprendiendo el proceso o viendo ayuda.","We can start by preparing a transfer, learning the process, or viewing help."))}</p><button class="primary" onclick="renderRemittance()">${esc(t("Preparar remesa","Prepare transfer"))}</button><button class="secondary" onclick="renderLearning()">${esc(t("APRENDER","LEARN"))}</button><button class="secondary" onclick="renderHelp()">${esc(t("Ayuda","Help"))}</button></section>`,t("Tu necesidad","Your need"))
 }catch(e){showError(e.message)}
}

async function beginParsedRemittance(p){
 try{
  await startSession(true);
  const b={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance"};
  ["amount","destination_country","priority","urgency","delivery_method","payment_method"].forEach(k=>{if(p[k]!=null)b[k]=p[k]});
  APP.session=(await api("/api/need",{method:"POST",body:JSON.stringify(b)})).session;
  renderRemittance(p)
 }catch(e){showError(e.message)}
}

function renderRemittance(p={}){
 const s=APP.session||{},amount=s.amount??p.amount??"",country=s.destination_country||p.destination_country||"",priority=s.priority||p.priority||"";
 renderShell(`<section class="card"><h1>${esc(t("Enviar dinero","Send money"))}</h1><p class="small">${esc(t("Solo preguntamos lo necesario para el siguiente paso.","We only ask what is needed for the next step."))}</p><label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="sendAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}"><label>${esc(t("¿A qué país?","Which country?"))}</label><select id="sendCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select><label>${esc(t("¿Qué importa más?","What matters most?"))}</label><select id="sendPriority"><option value="">${esc(t("No estoy seguro","Not sure"))}</option>${["recipient_gets_more","fastest","save","balanced"].map(x=>`<option value="${x}" ${priority===x?"selected":""}>${esc(priorityLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Es urgente?","Is it urgent?"))}</label><select id="sendUrgency"><option value="">${esc(t("No sé","Not sure"))}</option><option value="true">${esc(t("Sí","Yes"))}</option><option value="false">${esc(t("No","No"))}</option></select><label>${esc(t("¿Cada cuánto envías?","How often do you send?"))}</label><select id="sendFrequency"><option value="">${esc(t("Una vez / no sé","One time / not sure"))}</option>${["weekly","biweekly","monthly"].map(x=>`<option value="${x}">${esc(frequencyLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Cómo recibe?","How does the recipient receive?"))}</label><select id="sendDelivery"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.delivery_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(methodLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label><select id="sendPayment"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.payment_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(methodLabel(x))}</option>`).join("")}</select><div id="moneyWarning"></div><button class="primary" onclick="compare()">${esc(t("Revisar opciones","Review options"))}</button><button class="secondary" onclick="renderLearning()">${esc(t("Primero quiero aprender","I want to learn first"))}</button></section>`,t("Enviar dinero","Send money"));
 document.getElementById("sendAmount")?.addEventListener("input",updateMoneyWarning);updateMoneyWarning()
}

function getMoneyState(){return getJSON(APP.moneyKey,{income:0,incomeFreq:"monthly",monthlyIncome:0,essential:0,flexible:0,savings:0,remittance:0,available:0,availableDaily:0,availableWeekly:0,availableBiweekly:0,availableMonthly:0,savingsPurpose:""})}
function getExpenses(){return getJSON(APP.expensesKey,[])}
function expenseMonthlyTotal(){
 return getExpenses().reduce((s,x)=>{
  const a=num(x.amount);
  if(x.frequency==="weekly")return s+a*52/12;
  if(x.frequency==="biweekly")return s+a*26/12;
  if(x.frequency==="one_time"){
   const d=x.createdAt?new Date(x.createdAt):null,n=new Date();
   if(d&&!Number.isNaN(d.getTime())&&(d.getMonth()!==n.getMonth()||d.getFullYear()!==n.getFullYear()))return s
  }
  return s+a
 },0)
}
function updateMoneyWarning(){
 const b=document.getElementById("moneyWarning");if(!b)return;
 const a=Number(document.getElementById("sendAmount")?.value||0),v=Number(getMoneyState().available||0);
 b.innerHTML=v>0&&a>v?`<div class="status warning">${esc(t(`El monto supera tu disponible calculado (${money(v)}).`,`The amount exceeds your calculated balance (${money(v)}).`))}</div>`:""
}

async function compare(){
 const amount=Number(document.getElementById("sendAmount")?.value||0),destination=document.getElementById("sendCountry")?.value||"";
 if(!amount||amount<=0){showError(t("Indica un monto válido.","Enter a valid amount."));return}
 if(!destination){showError(t("Selecciona el país de destino.","Select the destination country."));return}
 try{
  await startSession(true);
  const u=document.getElementById("sendUrgency")?.value;
  APP.session=(await api("/api/need",{method:"POST",body:JSON.stringify({session_id:APP.session.session_id,language:APP.lang,need_type:"remittance",amount,destination_country:destination,priority:document.getElementById("sendPriority")?.value||null,urgency:u===""?null:u==="true",delivery_method:document.getElementById("sendDelivery")?.value||null,payment_method:document.getElementById("sendPayment")?.value||null})})).session;
  renderLoading();
  const r=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/compare`,{method:"POST"});
  APP.session.available_providers=r.available_providers||[];APP.session.verified_results=r.results||[];renderComparison(r)
 }catch(e){showError(e.message)}
}
function renderLoading(){renderShell(`<section class="card center"><div class="loader"></div><h2>${esc(t("Revisando opciones","Reviewing options"))}</h2><p>${esc(t("No inventaremos datos comerciales.","We will not invent commercial data."))}</p></section>`,t("Revisión","Review"))}

function providerCard(p){
 const id=p.provider_id||p.id||"",r=(APP.session?.verified_results||[]).find(x=>x.provider_id===id),verified=Boolean(p.commercial_verified||p.commercial_status==="verified"||r?.status==="verified"),url=p.continue_url||p.official_site||p.official_urls?.send_money||p.official_urls?.home;
 return`<article class="provider-card"><div class="provider-head"><h3>${esc(p.provider_name||p.name||id)}</h3><span class="status ${verified?"success":"warning"}">${esc(verified?t("Datos verificados","Verified data"):t("Revisar sitio oficial","Review official site"))}</span></div>${verified&&r?`<div class="metric-grid"><div><small>${esc(t("Tarifa","Fee"))}</small><b>${r.fee!=null?money(r.fee):"—"}</b></div><div><small>${esc(t("Tasa","Rate"))}</small><b>${esc(r.exchange_rate??"—")}</b></div><div><small>${esc(t("Recibe","Gets"))}</small><b>${r.recipient_amount!=null?money(r.recipient_amount):"—"}</b></div><div><small>${esc(t("Entrega","Delivery"))}</small><b>${esc(r.estimated_delivery??r.delivery_time??"—")}</b></div></div>`:`<p class="small">${esc(t("No mostramos tarifas, tasas, tiempos ni disponibilidad como actuales porque no están verificadas.","We do not show fees, rates, timing, or availability as current because they are not verified."))}</p>`}${p.supports_online?`<p class="small">${esc(t("En línea según el registro de la aplicación.","Online according to the app registry."))}</p>`:""}${url?`<button class="primary" onclick="selectProvider('${esc(id)}')">${esc(t("Revisar proveedor","Review provider"))}</button>`:""}</article>`
}

function renderComparison(d){
 const p=d.available_providers||[];
 renderShell(`<section class="card"><div class="status ${d.results_available?"success":"warning"}">${esc(d.results_available?t(`${d.verified_count||0} opción(es) con datos verificados`,`${d.verified_count||0} option(s) with verified data`):t("No hay datos comerciales actuales verificados","No current verified commercial data"))}</div><h1>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h1><div class="summary"><b>${esc(d.destination_name||countryName(d.destination_country))}</b><span>${money(d.amount)}</span></div><p>${esc(d.explanation||"")}</p>${p.length?`<div class="provider-list">${p.map(providerCard).join("")}</div>`:`<div class="status warning">${esc(t("No encontramos opciones en el catálogo actual.","No options were found in the current catalog."))}</div>`}<div class="notice">${esc(t("Confirma tarifa, tasa, tiempo, disponibilidad y requisitos directamente con el proveedor.","Confirm fee, rate, timing, availability, and requirements directly with the provider."))}</div><button class="primary" onclick="renderLearning()">${esc(t("APRENDER","LEARN"))}</button><button class="secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button></section>`,t("Opciones","Options"))
}

async function selectProvider(id){
 try{
  const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(id)}`,{method:"POST"});
  APP.session=d.session;renderFinalCheck()
 }catch(e){showError(e.message)}
}

async function renderFinalCheck(){
 try{
  const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,{method:"POST"}),o=APP.session?.selected_option||{},url=o.continue_url||o.official_site||o.official_urls?.send_money||"";
  renderShell(`<section class="card"><div class="status ${d.ready_to_continue?"success":"warning"}">${esc(d.ready_to_continue?t("Revisión básica completada","Basic review completed"):t("Revisa los datos","Review the details"))}</div><h1>${esc(o.provider_name||"")}</h1><p>${esc(d.message||"")}</p><div class="checks">${(d.checks||[]).map(c=>`<div class="check ${c.complete?"ok":"bad"}"><b>${c.complete?"✓":"!"}</b><span><strong>${esc(c.label)}</strong> ${esc(c.value??"")}</span></div>`).join("")}</div><div class="notice">${esc(t("REMESAS no recopila contraseñas, CVV, OTP ni credenciales del proveedor. Confirma los datos finales en el sitio oficial.","REMESAS does not collect passwords, CVVs, OTPs, or provider credentials. Confirm final details on the official site."))}</div>${url?`<button class="primary" onclick="openOfficial('${esc(url)}')">${esc(t("Abrir sitio oficial","Open official site"))}</button>`:""}<button class="secondary" onclick="renderQuickGuide('${esc(o.provider_id||"")}')">${esc(t("Ver guía rápida","View quick guide"))}</button><button class="secondary" onclick="renderComparisonFromSession()">${esc(t("Ver otras opciones","See other options"))}</button></section>`,t("Revisión final","Final review"))
 }catch(e){showError(e.message)}
}

function renderComparisonFromSession(){
 renderComparison({available_providers:APP.session?.available_providers||[],verified_count:(APP.session?.verified_results||[]).length,results_available:Boolean((APP.session?.verified_results||[]).length),amount:APP.session?.amount,destination_country:APP.session?.destination_country,results:APP.session?.verified_results||[]})
}
function openOfficial(u){if(!/^https:\/\//i.test(u)){showError(t("El enlace oficial no es válido.","The official link is not valid."));return}window.open(u,"_blank","noopener,noreferrer")}

/* APRENDER */

function learningProviders(){
 const p=APP.config?.providers||APP.config?.provider_registry;
 return Array.isArray(p)&&p.length?p:[{id:"western_union",name:"Western Union"},{id:"moneygram",name:"MoneyGram"},{id:"remitly",name:"Remitly"},{id:"xoom",name:"Xoom"}]
}
function providerId(p){return p?.provider_id||p?.id||""}
function providerName(p){return p?.provider_name||p?.name||providerId(p)}

async function loadLearning(){
 if(APP.learningCache)return APP.learningCache;
 APP.learningCache=await api(`/api/learn?language=${encodeURIComponent(APP.lang)}`);
 return APP.learningCache
}

async function renderLearning(){
 try{
  const d=await loadLearning(),lessons=d.lessons||d.learning_lessons||[],ps=d.providers||learningProviders();
  renderShell(`<section class="card"><div class="status success">${esc(t("APRENDER","LEARN"))}</div><h1>${esc(d.title||t("Aprende a hacer una remesa","Learn how to make a remittance"))}</h1><p>${esc(d.description||d.intro||t("Aprende el proceso antes de entrar al sitio oficial.","Learn the process before entering the official site."))}</p><div class="notice">${esc(d.notice||t("Contenido original de REMESAS. No es capacitación oficial.","Original REMESAS content. It is not official training."))}</div>${lessons.length?`<h2>${esc(t("Proceso general","General process"))}</h2><div class="provider-list">${lessons.map((x,i)=>`<article class="provider-card"><h3>${i+1}. ${esc(x.title||x.name||t("Paso","Step"))}</h3><p>${esc(x.teaches||x.purpose||x.description||x.text||"")}</p>${x.warning?`<p class="small"><b>${esc(t("Importante:","Important:"))}</b> ${esc(x.warning)}</p>`:""}</article>`).join("")}</div>`:""}<h2>${esc(t("Aprender por proveedor","Learn by provider"))}</h2><div class="provider-list">${ps.map(p=>`<article class="provider-card"><h3>${esc(providerName(p))}</h3><p>${esc(t("Explicación independiente y original de REMESAS.","Independent original REMESAS explanation."))}</p><button class="primary" onclick="renderProviderLearning('${esc(providerId(p))}')">${esc(t("Aprender","Learn"))}</button></article>`).join("")}</div><button class="secondary" onclick="downloadLearningPDF()">${esc(t("Descargar guía educativa PDF","Download educational PDF"))}</button><button class="secondary" onclick="renderQuickGuide()">${esc(t("GUÍA RÁPIDA","QUICK GUIDE"))}</button></section>`,t("APRENDER","LEARN"))
 }catch(e){showError(e.message)}
}

async function renderProviderLearning(id){
 if(!id){renderLearning();return}
 try{
  const d=await api(`/api/learn/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.lang)}`),steps=d.steps||d.lessons||d.learning_steps||[],url=d.official_site||d.official_url||d.official_urls?.send_money||"";
  renderShell(`<section class="card"><div class="status success">${esc(t("Guía educativa","Educational guide"))}</div><h1>${esc(d.title||providerName({id}))}</h1><p>${esc(d.description||"")}</p><div class="notice">${esc(d.disclaimer||t("Guía independiente de REMESAS. No es capacitación oficial.","Independent REMESAS guide. It is not official training."))}</div><div class="learning-steps">${steps.map((x,i)=>`<article class="card learning-step"><div class="status">${i+1}</div><h2>${esc(x.title||x.name||t("Paso","Step"))}</h2><p>${esc(x.teaches||x.description||x.purpose||x.text||"")}</p>${x.warning?`<div class="notice">${esc(x.warning)}</div>`:""}</article>`).join("")}</div>${url?`<button class="primary" onclick="openOfficial('${esc(url)}')">${esc(t("Ir al sitio oficial","Go to official site"))}</button>`:""}<button class="secondary" onclick="downloadLearningPDF('${esc(id)}')">${esc(t("Descargar esta guía PDF","Download this guide PDF"))}</button><button class="secondary" onclick="renderQuickGuide('${esc(id)}')">${esc(t("GUÍA RÁPIDA","QUICK GUIDE"))}</button><button class="secondary" onclick="renderLearning()">${esc(t("Volver a APRENDER","Back to LEARN"))}</button></section>`,d.title||t("APRENDER","LEARN"))
 }catch(e){showError(e.message)}
}

async function renderQuickGuide(id=null){
 try{
  const u=id?`/api/quick-guide/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.lang)}`:`/api/quick-guide?language=${encodeURIComponent(APP.lang)}`;
  const d=await api(u),steps=d.steps||d.lessons||d.guide||[],ps=d.providers||learningProviders(),official=d.official_site||d.official_url||"";
  renderShell(`<section class="card"><div class="status success">${esc(t("GUÍA RÁPIDA","QUICK GUIDE"))}</div><h1>${esc(d.title||t("Hazlo paso a paso","Do it step by step"))}</h1><p>${esc(d.description||t("Acompañamiento sencillo hasta el sitio oficial.","Simple guidance to the official site."))}</p>${!id?`<h2>${esc(t("Elige proveedor","Choose provider"))}</h2><div class="provider-list">${ps.map(p=>`<article class="provider-card"><h3>${esc(providerName(p))}</h3><button class="primary" onclick="renderQuickGuide('${esc(providerId(p))}')">${esc(t("Usar guía","Use guide"))}</button></article>`).join("")}</div>`:""}${steps.length?`<div class="learning-steps">${steps.map((x,i)=>`<article class="card learning-step"><div class="status">${i+1}</div><h2>${esc(x.title||x.name||t("Paso","Step"))}</h2><p>${esc(x.action||x.teaches||x.description||x.text||"")}</p>${x.warning?`<div class="notice">${esc(x.warning)}</div>`:""}</article>`).join("")}</div>`:""}${official?`<button class="primary" onclick="openOfficial('${esc(official)}')">${esc(t("Continuar al sitio oficial","Continue to official site"))}</button>`:""}<button class="secondary" onclick="renderLearning()">${esc(t("Volver a APRENDER","Back to LEARN"))}</button></section>`,t("GUÍA RÁPIDA","QUICK GUIDE"))
 }catch(e){showError(e.message)}
}

async function downloadLearningPDF(id=null){
 try{
  const u=id?`/api/learning-pdf/${encodeURIComponent(id)}?language=${encodeURIComponent(APP.lang)}`:`/api/learning-pdf?language=${encodeURIComponent(APP.lang)}`,d=await api(u);
  await ensurePDF(false);
  const js=window.jspdf?.jsPDF;if(!js)throw new Error(t("No se pudo crear el PDF.","The PDF could not be created."));
  const doc=new js({unit:"mm",format:"letter"}),left=18,w=174;let y=18;
  const add=(txt,size=9,bold=false)=>{
   doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);
   doc.splitTextToSize(String(txt||""),w).forEach(line=>{if(y>275){doc.addPage();y=18}doc.text(line,left,y);y+=4})
  };
  add("REMESAS",20,true);y+=2;add(d.title||t("Guía educativa","Educational guide"),14,true);add(d.provider_name||"");add(new Date().toLocaleString(APP.lang==="en"?"en-US":"es-US",{dateStyle:"full",timeStyle:"short"}),8);y+=3;add(d.notice||d.disclaimer||t("Guía independiente de REMESAS.","Independent REMESAS guide."),8);
  (d.steps||d.lessons||[]).forEach((x,i)=>{y+=3;add(`${i+1}. ${x.title||x.name||t("Paso","Step")}`,11,true);add(x.teaches||x.description||x.purpose||x.text||"");if(x.warning)add(`${t("Importante:","Important:")} ${x.warning}`,8)});
  if(d.official_url||d.official_site){y+=3;add(t("Confirma la información actual en:","Confirm current information at:"),8,true);add(d.official_url||d.official_site,8)}
  doc.save(`REMESAS_GUIA${id?"_"+id:""}_${new Date().toISOString().slice(0,10)}.pdf`)
 }catch(e){showError(e.message)}
}

/* DINERO */

function renderMoney(){
 const m=getMoneyState();
 renderShell(`<section class="card"><h1>${esc(t("Mi dinero","My money"))}</h1><p class="small">${esc(t("Es un cálculo de organización, no un saldo bancario.","This is an organization calculation, not a bank balance."))}</p><label>${esc(t("Ingreso","Income"))}</label><input id="income" type="number" min="0" step=".01" value="${esc(m.income||"")}"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq"><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="monthly">${esc(t("Mensual","Monthly"))}</option></select><label>${esc(t("Gastos esenciales","Essential expenses"))}</label><input id="essential" type="number" min="0" step=".01" value="${esc(m.essential||"")}"><label>${esc(t("Gastos flexibles","Flexible expenses"))}</label><input id="flexible" type="number" min="0" step=".01" value="${esc(m.flexible||"")}"><label>${esc(t("Ahorro reservado","Reserved savings"))}</label><input id="savings" type="number" min="0" step=".01" value="${esc(m.savings||"")}"><label>${esc(t("Remesas reservadas","Reserved transfer"))}</label><input id="remittance" type="number" min="0" step=".01" value="${esc(m.remittance||"")}"><div class="notice"><b>${esc(t("Gastos registrados","Recorded expenses"))}</b><p>${money(expenseMonthlyTotal())} ${esc(t("aproximadamente por mes.","approximately per month."))}</p><button class="secondary" onclick="useRecordedExpenses()">${esc(t("Usar como gastos flexibles","Use as flexible expenses"))}</button></div><button class="primary" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button><div id="moneyResult"></div><p class="small">${esc(t("Puedes entregar estos registros a tu contador o preparador de impuestos. REMESAS no prepara impuestos.","You can provide these records to your accountant or tax preparer. REMESAS does not prepare taxes."))}</p></section>`,t("Mi dinero","My money"));
 document.getElementById("incomeFreq").value=m.incomeFreq||"monthly";if(m.monthlyIncome)showMoneyResult(m)
}

function calculateMoney(){
 const income=Number(document.getElementById("income")?.value||0),f=document.getElementById("incomeFreq")?.value||"monthly",essential=Number(document.getElementById("essential")?.value||0),flexible=Number(document.getElementById("flexible")?.value||0),savings=Number(document.getElementById("savings")?.value||0),remittance=Number(document.getElementById("remittance")?.value||0);
 if([income,essential,flexible,savings,remittance].some(x=>x<0)){showError(t("Los valores no pueden ser negativos.","Values cannot be negative."));return}
 const factor=f==="weekly"?52/12:f==="biweekly"?26/12:1,monthlyIncome=income*factor,available=monthlyIncome-essential-flexible-savings-remittance,d={...getMoneyState(),income,incomeFreq:f,monthlyIncome,essential,flexible,savings,remittance,available,availableDaily:available/30.4375,availableWeekly:available/4.333333,availableBiweekly:available/(26/12),availableMonthly:available,recordedExpensesMonthly:expenseMonthlyTotal(),updatedAt:new Date().toISOString()};
 setJSON(APP.moneyKey,d);showMoneyResult(d)
}
function useRecordedExpenses(){const m=getMoneyState();m.flexible=Number(expenseMonthlyTotal().toFixed(2));setJSON(APP.moneyKey,m);renderMoney()}
function showMoneyResult(d){
 const b=document.getElementById("moneyResult");if(!b)return;
 const a=Number(d.available||0);
 b.innerHTML=`<div class="money-summary"><span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span><b>${money(d.monthlyIncome)}</b><span>${esc(t("Disponible mensual","Monthly available"))}</span><b>${money(a)}</b><span>${esc(t("Semanal","Weekly"))}</span><b>${money(d.availableWeekly)}</b><span>${esc(t("Quincenal","Biweekly"))}</span><b>${money(d.availableBiweekly)}</b><span>${esc(t("Diario","Daily"))}</span><b>${money(d.availableDaily)}</b></div><div class="status ${a>=0?"success":"warning"}">${esc(a>=0?t("PUEDO: el cálculo queda por encima de cero.","I CAN: the calculation remains above zero."):t("PUEDO: los compromisos superan el ingreso calculado.","I CAN: commitments exceed calculated income."))}</div><button class="primary" onclick="renderRemittance()">${esc(t("Usar para una remesa","Use for a transfer"))}</button>`
}

function renderWeek(){
 const m=getMoneyState();
 if(!m.monthlyIncome){renderMoney();return}
 const a=Number(m.availableMonthly??m.available||0);
 renderShell(`<section class="card"><h1>${esc(t("Mi semana","My week"))}</h1><p class="small">${esc(t("Referencias para organizarte.","Planning references."))}</p><div class="money-summary"><span>${esc(t("Diario","Daily"))}</span><b>${money(a/30.4375)}</b><span>${esc(t("Semanal","Weekly"))}</span><b>${money(a/4.333333)}</b><span>${esc(t("Quincenal","Biweekly"))}</span><b>${money(a/(26/12))}</b><span>${esc(t("Mensual","Monthly"))}</span><b>${money(a)}</b></div><button class="primary" onclick="renderMoney()">${esc(t("Modificar cálculo","Modify calculation"))}</button></section>`,t("Mi semana","My week"))
}

function renderExpenses(){
 const e=getExpenses();
 renderShell(`<section class="card"><h1>${esc(t("Mis gastos","My expenses"))}</h1><label>${esc(t("Descripción","Description"))}</label><input id="expenseName" maxlength="120"><label>${esc(t("Monto","Amount"))}</label><input id="expenseAmount" type="number" min=".01" step=".01"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expenseFrequency"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="one_time">${esc(t("Una vez","One time"))}</option></select><button class="primary" onclick="addExpense()">${esc(t("Guardar gasto","Save expense"))}</button><div class="notice"><b>${esc(t("Total mensual aproximado","Approximate monthly total"))}</b><p>${money(expenseMonthlyTotal())}</p></div>${e.map((x,i)=>`<div class="expense-row"><span><b>${esc(x.description)}</b><small>${esc(frequencyLabel(x.frequency))}</small></span><b>${money(x.amount)}</b><button class="danger-button" onclick="removeExpense(${i})">×</button></div>`).join("")}<button class="secondary" onclick="useRecordedExpenses()">${esc(t("Usar total en Mi dinero","Use total in My money"))}</button></section>`,t("Mis gastos","My expenses"))
}
function addExpense(){
 const d=(document.getElementById("expenseName")?.value||"").trim(),a=Number(document.getElementById("expenseAmount")?.value||0),f=document.getElementById("expenseFrequency")?.value||"monthly";
 if(!d||!a||a<=0){showError(t("Completa descripción y monto.","Enter description and amount."));return}
 const e=getExpenses();e.push({description:d,amount:a,frequency:f,createdAt:new Date().toISOString()});setJSON(APP.expensesKey,e);renderExpenses()
}
function removeExpense(i){const e=getExpenses();e.splice(i,1);setJSON(APP.expensesKey,e);renderExpenses()}

function renderFamily(){
 const d=getJSON(APP.familyKey,{name:"",country:"",amount:""});
 renderShell(`<section class="card"><h1>${esc(t("Familia","Family"))}</h1><p class="small">${esc(t("Es una referencia local; no crea una orden de envío.","This is a local reference; it does not create a transfer order."))}</p><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="familyName" maxlength="80" value="${esc(d.name)}"><label>${esc(t("País","Country"))}</label><select id="familyCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===d.country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select><label>${esc(t("Monto de referencia","Reference amount"))}</label><input id="familyAmount" type="number" min="0" step=".01" value="${esc(d.amount)}"><button class="primary" onclick="saveFamily()">${esc(t("Guardar","Save"))}</button></section>`,t("Familia","Family"))
}
function saveFamily(){setJSON(APP.familyKey,{name:(document.getElementById("familyName")?.value||"").trim(),country:document.getElementById("familyCountry")?.value||"",amount:Number(document.getElementById("familyAmount")?.value||0),updatedAt:new Date().toISOString()});renderHome()}

function renderSavings(){
 const m=getMoneyState();
 renderShell(`<section class="card"><h1>${esc(t("Ahorrar","Save"))}</h1><label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label><input id="saveAmount" type="number" min="0" step=".01" value="${esc(m.savings||"")}"><label>${esc(t("¿Para qué?","What for?"))}</label><input id="savePurpose" maxlength="100" value="${esc(m.savingsPurpose||"")}"><button class="primary" onclick="saveSavings()">${esc(t("Guardar objetivo","Save goal"))}</button></section>`,t("Ahorrar","Save"))
}
function saveSavings(){const m=getMoneyState();m.savings=Number(document.getElementById("saveAmount")?.value||0);m.savingsPurpose=(document.getElementById("savePurpose")?.value||"").trim();setJSON(APP.moneyKey,m);renderMoney()}

function renderPurchase(){
 renderShell(`<section class="card"><h1>${esc(t("Planear una compra","Plan a purchase"))}</h1><p class="small">${esc(t("Compara el precio con tu disponible calculado. No decide por ti.","Compare the price with your calculated amount. It does not decide for you."))}</p><label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label><input id="purchaseName" maxlength="120"><label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label><input id="purchaseAmount" type="number" min=".01" step=".01"><button class="primary" onclick="checkPurchase()">${esc(t("Comprobar","Check"))}</button></section>`,t("Planear una compra","Plan a purchase"))
}
function checkPurchase(){
 const n=(document.getElementById("purchaseName")?.value||"").trim(),a=Number(document.getElementById("purchaseAmount")?.value||0),d=Number(getMoneyState().available||0)-a;
 if(!n||!a){showError(t("Completa nombre y precio.","Enter name and price."));return}
 renderShell(`<section class="card"><div class="status ${d>=0?"success":"warning"}">${esc(d>=0?t("Cabe en tu cálculo actual.","It fits your current calculation."):t("Supera tu disponible actual.","It exceeds your current available amount."))}</div><h1>${esc(n)}</h1><div class="money-summary"><span>${esc(t("Precio","Price"))}</span><b>${money(a)}</b><span>${esc(t("Después","After"))}</span><b>${money(d)}</b></div><button class="primary" onclick="renderMoney()">${esc(t("Revisar Mi dinero","Review My money"))}</button></section>`,t("Resultado","Result"))
}

function renderHelp(){
 const topics=APP.config?.help_topics||[];
 renderShell(`<section class="card"><h1>${esc(t("Ayuda","Help"))}</h1><p>${esc(t("Elige una pregunta.","Choose a question."))}</p>${topics.map(x=>`<button class="help-item" onclick="showHelpTopic('${esc(x.id)}')"><b>${esc(x.label||x.title||x.id)}</b></button>`).join("")}<button class="primary" onclick="renderLearning()">${esc(t("APRENDER","LEARN"))}</button></section>`,t("Ayuda","Help"))
}
function showHelpTopic(id){
 const x=(APP.config?.help_topics||[]).find(a=>a.id===id);if(!x)return;
 renderShell(`<section class="card"><h1>${esc(x.label||x.title||id)}</h1><p>${esc(x.answer||"")}</p><button class="primary" onclick="renderHelp()">${esc(t("Volver a ayuda","Back to help"))}</button></section>`,x.label||x.title||id)
}
function showError(m){
 const old=document.querySelector(".error-box");if(old)old.remove();
 const b=document.createElement("div");b.className="error-box";b.innerHTML=`<b>${esc(t("Atención","Attention"))}</b><span>${esc(m)}</span><button onclick="this.parentElement.remove()">×</button>`;document.body.appendChild(b);setTimeout(()=>b.remove(),7000)
}
function deleteLocalData(){
 if(!confirm(t("¿Borrar los datos de este dispositivo?","Delete the data on this device?")))return;
 [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,"remesas_lang_v4"].forEach(k=>localStorage.removeItem(k));
 if(APP.session?.session_id)api(`/api/session/${encodeURIComponent(APP.session.session_id)}`,{method:"DELETE"}).catch(()=>{});
 APP.session=null;location.reload()
}

/* PDF DATOS */

function snapshotData(){return{format:"REMESAS_RECOVERY_V1",app:APP.name,version:APP.version,language:APP.lang,exported_at:new Date().toISOString(),money:getMoneyState(),expenses:getExpenses(),family:getJSON(APP.familyKey,{name:"",country:"",amount:""}),preferences:getJSON(APP.prefsKey,{})}}
function base64urlEncode(s){const b=new TextEncoder().encode(s);let x="";for(let i=0;i<b.length;i+=32768)x+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(x).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function base64urlDecode(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)))}
function loadScript(src){
 return new Promise((resolve,reject)=>{
  const old=document.querySelector(`script[data-remesas-lib="${src}"]`);
  if(old){if(src.includes("jspdf")&&window.jspdf||src.includes("pdf.min.js")&&window.pdfjsLib){resolve();return}old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});return}
  const s=document.createElement("script");s.src=src;s.async=true;s.dataset.remesasLib=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)
 })
}
async function ensurePDF(importMode=false){
 if(!window.jspdf)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
 if(importMode&&!window.pdfjsLib)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
 if(importMode&&window.pdfjsLib)window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
}

async function exportPDF(){
 try{
  await ensurePDF(false);
  const js=window.jspdf?.jsPDF;if(!js)throw new Error(t("No se pudo crear el PDF.","The PDF could not be created."));
  const d=snapshotData(),doc=new js({unit:"mm",format:"letter"}),left=18,w=174;let y=18;
  const add=(x,size=9,bold=false)=>{
   doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);
   doc.splitTextToSize(String(x||""),w).forEach(l=>{if(y>275){doc.addPage();y=18}doc.text(l,left,y);y+=4})
  };
  add("REMESAS",20,true);add(t("Registro personal de dinero","Personal money record"),13,true);add(new Date(d.exported_at).toLocaleString(APP.lang==="en"?"en-US":"es-US",{dateStyle:"full",timeStyle:"short"}),8);
  y+=3;add(t("RESUMEN","SUMMARY"),11,true);
  const m=d.money||{};
  [[t("Ingreso mensual equivalente","Equivalent monthly income"),m.monthlyIncome],[t("Disponible mensual","Monthly available"),m.available],[t("Disponible semanal","Weekly available"),m.availableWeekly],[t("Disponible quincenal","Biweekly available"),m.availableBiweekly],[t("Disponible diario","Daily available"),m.availableDaily],[t("Gastos esenciales","Essential expenses"),m.essential],[t("Gastos flexibles","Flexible expenses"),m.flexible],[t("Ahorro","Savings"),m.savings],[t("Remesa reservada","Reserved transfer"),m.remittance]].forEach(x=>add(`${x[0]}: ${money(x[1])}`));
  y+=3;add(t("GASTOS REGISTRADOS","RECORDED EXPENSES"),11,true);
  if(!d.expenses.length)add(t("No hay gastos registrados.","No expenses recorded."));
  d.expenses.forEach(x=>add(`• ${x.description} — ${money(x.amount)} — ${frequencyLabel(x.frequency)}`));
  y+=3;add(t("FAMILIA / REFERENCIA","FAMILY / REFERENCE"),11,true);
  if(d.family?.name){add(`${t("Nombre","Name")}: ${d.family.name}`);if(d.family.country)add(`${t("País","Country")}: ${countryName(d.family.country)}`);if(d.family.amount)add(`${t("Monto","Amount")}: ${money(d.family.amount)}`)}else add(t("No hay referencia registrada.","No reference recorded."));
  y+=3;add(t("Este documento organiza los datos registrados por el usuario. Puede servir como referencia para un contador o preparador de impuestos. REMESAS no prepara impuestos.","This document organizes information entered by the user. It may serve as a reference for an accountant or tax preparer. REMESAS does not prepare taxes."),8);
  y+=5;doc.setFontSize(5);doc.setFont("helvetica","normal");doc.text("REMESAS_RECOVERY_V1",left,y);y+=3;
  const rec=base64urlEncode(JSON.stringify(d));
  for(let i=0;i<rec.length;i+=95){if(y>285){doc.addPage();y=18}doc.text(rec.slice(i,i+95),left,y);y+=2.5}
  if(y>285){doc.addPage();y=18}doc.text("REMESAS_RECOVERY_END",left,y);
  doc.save(`REMESAS_${new Date().toISOString().slice(0,10)}.pdf`)
 }catch(e){showError(e.message)}
}

async function importPDF(ev){
 const f=ev?.target?.files?.[0];if(!f)return;
 try{
  await ensurePDF(true);if(!window.pdfjsLib)throw new Error(t("No se pudo leer el PDF.","The PDF could not be read."));
  const pdf=await window.pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;let text="";
  for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();text+=c.items.map(x=>x.str||"").join(" ")+"\n"}
  const m=text.match(/REMESAS_RECOVERY_V1\s*([\s\S]*?)\s*REMESAS_RECOVERY_END/);
  if(!m)throw new Error(t("Este PDF no contiene datos recuperables de REMESAS.","This PDF does not contain recoverable REMESAS data."));
  await restoreSnapshot(JSON.parse(base64urlDecode(m[1].replace(/\s+/g,""))))
 }catch(e){showError(e.message)}finally{if(ev?.target)ev.target.value=""}
}
async function restoreSnapshot(d){
 if(d?.format!=="REMESAS_RECOVERY_V1")throw new Error(t("Formato de recuperación inválido.","Invalid recovery format."));
 if(d.money)setJSON(APP.moneyKey,d.money);
 if(Array.isArray(d.expenses))setJSON(APP.expensesKey,d.expenses);
 if(d.family)setJSON(APP.familyKey,d.family);
 if(d.preferences)setJSON(APP.prefsKey,d.preferences);
 if(d.language==="es"||d.language==="en"){APP.lang=d.language;localStorage.setItem("remesas_lang_v4",APP.lang)}
 await loadConfig();renderShell(`<section class="card center"><div class="status success">${esc(t("Datos recuperados","Data restored"))}</div><h1>${esc(t("Listo","Done"))}</h1><p>${esc(t("Tus registros fueron restaurados en este dispositivo.","Your records were restored on this device."))}</p><button class="primary" onclick="renderHome()">${esc(t("Continuar","Continue"))}</button></section>`,t("Recuperación","Recovery"))
}

/* ADMIN */

function registerAdminTap(e){
 if(e?.target?.closest?.("button,input,textarea,select,a,label"))return;
 const n=Date.now();APP.adminTaps=APP.adminTaps.filter(x=>n-x<900);APP.adminTaps.push(n);
 if(APP.adminTaps.length>=3){APP.adminTaps=[];renderAdminLogin()}
}
function renderAdminLogin(){
 document.getElementById("admin-modal")?.remove();
 const d=document.createElement("div");d.id="admin-modal";d.className="modal";
 d.innerHTML=`<div class="modal-box"><button class="modal-close" onclick="closeAdminLogin()">×</button><h2>${esc(t("Acceso privado","Private access"))}</h2><label>${esc(t("Usuario","Username"))}</label><input id="adminUser" autocomplete="username"><label>${esc(t("Contraseña","Password"))}</label><input id="adminPass" type="password" autocomplete="current-password"><button class="primary" onclick="adminLogin()">${esc(t("Entrar","Sign in"))}</button></div>`;
 document.body.appendChild(d)
}
function closeAdminLogin(){document.getElementById("admin-modal")?.remove()}
async function adminLogin(){
 const username=document.getElementById("adminUser")?.value||"",password=document.getElementById("adminPass")?.value||"";
 if(!username||!password){showError(t("Escribe usuario y contraseña.","Enter username and password."));return}
 try{
  const d=await api("/api/access/admin",{method:"POST",body:JSON.stringify({username,password})}),a=normalizeAccess(d);
  if(!a)throw new Error(t("No se pudo activar el acceso.","Access could not be activated."));
  saveAccess(a);closeAdminLogin();startTimer();renderHome()
 }catch(e){showError(e.message)}
}

/* INICIO */

Object.assign(window,{renderHome,renderAbout,renderRemittance,renderMoney,renderWeek,renderExpenses,renderFamily,renderHelp,renderPurchase,renderSavings,renderAccessGate,renderLearning,renderProviderLearning,renderQuickGuide,downloadLearningPDF,changeLanguage,understandNeed,beginParsedRemittance,compare,selectProvider,renderFinalCheck,renderComparisonFromSession,openOfficial,calculateMoney,addExpense,removeExpense,saveFamily,saveSavings,checkPurchase,showHelpTopic,deleteLocalData,updateMoneyWarning,startPayment,exportPDF,importPDF,restoreSnapshot,renderAdminLogin,closeAdminLogin,adminLogin,useRecordedExpenses,refreshAccess});

document.addEventListener("click",registerAdminTap,{passive:true});

document.addEventListener("DOMContentLoaded",async()=>{
 try{
  await loadConfig();
  if(await checkPaymentReturn())return;
  if(await checkAccess()){await startSession(true).catch(()=>{});renderHome()}else renderAccessGate()
 }catch(e){
  app.innerHTML=`<main class="page"><section class="card"><div class="status warning">${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}</div><p>${esc(e.message)}</p><button class="primary" onclick="location.reload()">${esc(t("Reintentar","Retry"))}</button></section></main>`
 }
});

setInterval(()=>{if(accessToken()&&remainingSeconds()>0)updateClock();else if(accessToken())lockExpiredService()},1000);
setInterval(()=>{if(accessToken()&&remainingSeconds()>0)refreshAccess()},60000);
