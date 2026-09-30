"use strict";

const APP={
 name:"REMESAS",
 version:"4.1.0",
 lang:localStorage.getItem("remesas_lang_v4")||"es",
 session:null,
 config:null,
 access:null,
 moneyKey:"remesas_money_v4",
 expensesKey:"remesas_expenses_v4",
 familyKey:"remesas_family_v4",
 prefsKey:"remesas_prefs_v4",
 accessKey:"remesas_access_v4",
 timer:null,
 adminTaps:[],
 paymentChecking:false
};

const app=document.getElementById("app");

const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const t=(es,en)=>APP.lang==="en"?en:es;
const money=v=>new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v||0));
const num=v=>Number.isFinite(Number(v))?Number(v):0;

function getJSON(k,f){
 try{
  const v=JSON.parse(localStorage.getItem(k)||"");
  return v??f;
 }catch{return f}
}

function setJSON(k,v){
 localStorage.setItem(k,JSON.stringify(v));
}

function accessToken(){
 return APP.access?.token||sessionStorage.getItem("remesas_access_token_v4")||"";
}

function saveAccess(data){
 if(!data?.token)return false;
 APP.access=data;
 sessionStorage.setItem("remesas_access_token_v4",data.token);
 return true;
}

function clearAccess(){
 APP.access=null;
 sessionStorage.removeItem("remesas_access_token_v4");
 if(APP.timer){clearInterval(APP.timer);APP.timer=null}
}

function remainingSeconds(){
 if(!APP.access?.expires_at)return 0;
 return Math.max(0,Math.floor((new Date(APP.access.expires_at).getTime()-Date.now())/1000));
}

function formatTime(sec){
 sec=Math.max(0,Math.floor(sec));
 const m=String(Math.floor(sec/60)).padStart(2,"0");
 const s=String(sec%60).padStart(2,"0");
 return `${m}:${s}`;
}

function accessActive(){
 return Boolean(accessToken())&&remainingSeconds()>0;
}

function protectedEndpoint(url){
 return /^\/api\/(session|need|compare|final-check|local-data)/.test(url);
}

async function api(url,options={}){
 const headers={"Content-Type":"application/json",...(options.headers||{})};
 const token=accessToken();
 if(token)headers["X-Remesas-Access-Token"]=token;
 const r=await fetch(url,{...options,headers});
 let d={};
 try{d=await r.json()}catch{}
 if(r.status===401||r.status===403){
  if(protectedEndpoint(url)){
   clearAccess();
   renderAccessGate();
  }
  throw new Error(d.detail||d.error||t("El servicio necesita una autorización activa.","The service needs an active authorization."));
 }
 if(!r.ok)throw new Error(d.detail||d.error||d.message||t("No se pudo completar la operación.","The operation could not be completed."));
 return d;
}

async function loadConfig(){
 APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);
 return APP.config;
}

async function checkAccess(){
 const token=accessToken();
 if(!token){APP.access=null;return null}
 try{
  const d=await api("/api/access/status");
  if(d?.active&&d?.access){
   APP.access=d.access;
   sessionStorage.setItem("remesas_access_token_v4",APP.access.token);
   startTimer();
   return APP.access;
  }
 }catch{}
 clearAccess();
 return null;
}

async function startSession(preserve=true){
 if(!accessActive())throw new Error(t("El servicio no está activo.","The service is not active."));
 if(preserve&&APP.session?.session_id){
  try{
   APP.session=(await api(`/api/session/${APP.session.session_id}`)).session;
   return APP.session;
  }catch{}
 }
 APP.session=(await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"})).session;
 return APP.session;
}

async function changeLanguage(){
 APP.lang=APP.lang==="es"?"en":"es";
 localStorage.setItem("remesas_lang_v4",APP.lang);
 try{
  await loadConfig();
  if(accessActive())renderHome();
  else renderAccessGate();
 }catch(e){showError(e.message)}
}

function topbar(title="REMESAS"){
 return `<header class="topbar"><button class="icon-button" onclick="renderHome()" aria-label="${esc(t("Volver al inicio","Back to home"))}">←</button><strong>${esc(title)}</strong><div class="top-actions"><span id="serviceClock" class="service-clock"></span><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header>`;
}

function renderShell(content,title="REMESAS"){
 app.innerHTML=topbar(title)+`<main class="page">${content}</main>`;
 scrollTo(0,0);
 updateClock();
}

function homeCard(icon,title,text,action){
 return `<button class="home-card" onclick="${action}"><span>${icon}</span><strong>${esc(title)}</strong><small>${esc(text)}</small></button>`;
}

function renderAccessGate(){
 clearInterval(APP.timer);
 APP.timer=null;
 app.innerHTML=`<header class="hero access-hero"><div class="hero-top"><strong>REMESAS</strong><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div><h1>${esc(t("Tu dinero, más claro","Your money, clearer"))}</h1><p>${esc(t("Una herramienta sencilla para organizar tu dinero, preparar remesas y revisar opciones oficiales.","A simple tool to organize your money, prepare remittances and review official options."))}</p></header><main class="home"><section class="card access-card"><div class="price-big">$10.99</div><h2>${esc(t("Servicio de una sola vez","One-time service"))}</h2><p>${esc(t("Un solo pago activa 20 minutos de servicio. No es una suscripción mensual.","One payment activates 20 minutes of service. It is not a monthly subscription."))}</p><div class="notice"><b>${esc(t("¿Qué recibes?","What do you get?"))}</b><p>${esc(t("Puedes organizar tu dinero, registrar gastos, ahorro y familia, preparar una remesa, revisar opciones y guardar tus datos en este dispositivo.","You can organize your money, record expenses, savings and family information, prepare a transfer, review options, and keep your data on this device."))}</p></div><button class="primary" onclick="startPayment()">${esc(t("Activar servicio — $10.99","Activate service — $10.99"))}</button><button class="secondary" onclick="renderAbout()">${esc(t("Ver qué hace REMESAS","See what REMESAS does"))}</button><p class="small center-text">${esc(t("Pago único. 20 minutos. No ejecutamos transferencias ni recibimos tu dinero.","One-time payment. 20 minutes. We do not execute transfers or receive your money."))}</p></section><section class="notice"><b>${esc(t("Privacidad","Privacy"))}</b><p>${esc(t("Tus registros de dinero, gastos, familia y ahorro permanecen en este dispositivo. No escribas contraseñas bancarias, CVV, códigos de seguridad ni credenciales de proveedores.","Your money, expense, family and savings records stay on this device. Do not enter bank passwords, CVVs, security codes or provider credentials."))}</p></section><footer>May Roga LLC · v${esc(APP.version)}</footer></main>`;
 updateClock();
}

async function startPayment(){
 try{
  const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang})});
  if(d.url){window.location.href=d.url;return}
  if(d.checkout_url){window.location.href=d.checkout_url;return}
  showError(t("No se pudo abrir el pago.","The payment page could not be opened."));
 }catch(e){showError(e.message)}
}

async function checkPaymentReturn(){
 const params=new URLSearchParams(location.search);
 const sessionId=params.get("session_id");
 const payment=params.get("payment");
 if(!sessionId||payment!=="success")return false;
 if(APP.paymentChecking)return false;
 APP.paymentChecking=true;
 try{
  const d=await api(`/api/payment/check?session_id=${encodeURIComponent(sessionId)}`);
  if(d?.active&&d?.access){
   saveAccess(d.access);
   history.replaceState({},document.title,location.pathname);
   startTimer();
   showServiceReady();
   return true;
  }
  if(d?.token){
   saveAccess(d);
   history.replaceState({},document.title,location.pathname);
   startTimer();
   showServiceReady();
   return true;
  }
  showError(t("El pago todavía no aparece como completado. Puedes volver a intentarlo en unos momentos.","The payment does not appear completed yet. You can try again in a moment."));
 }catch(e){showError(e.message)}
 finally{APP.paymentChecking=false}
 return false;
}

function showServiceReady(){
 app.innerHTML=`<main class="page"><section class="card center"><div class="status success">${esc(t("Servicio activado","Service activated"))}</div><h1>${esc(t("Listo para empezar","Ready to start"))}</h1><p>${esc(t("Tienes 20 minutos de servicio. La cuenta regresiva aparecerá arriba.","You have 20 minutes of service. The countdown will appear above."))}</p><button class="primary" onclick="renderHome()">${esc(t("Empezar","Start"))}</button></section></main>`;
 setTimeout(renderHome,900);
}

function startTimer(){
 clearInterval(APP.timer);
 if(!accessActive())return;
 APP.timer=setInterval(()=>{
  if(remainingSeconds()<=0){
   clearInterval(APP.timer);
   APP.timer=null;
   lockExpiredService();
   return;
  }
  updateClock();
 },1000);
 updateClock();
}

function updateClock(){
 const el=document.getElementById("serviceClock");
 if(!el)return;
 const sec=remainingSeconds();
 if(!sec){el.textContent="";return}
 el.textContent=`${t("Tiempo","Time")} ${formatTime(sec)}`;
 el.className=`service-clock ${sec<=120?"urgent":""}`;
}

function lockExpiredService(){
 clearAccess();
 APP.session=null;
 renderAccessExpired();
}

function renderAccessExpired(){
 app.innerHTML=`<main class="page"><section class="card center"><div class="status warning">${esc(t("Tiempo terminado","Time ended"))}</div><h1>${esc(t("Tu servicio terminó","Your service ended"))}</h1><p>${esc(t("El período de 20 minutos ya terminó. Puedes volver a activar el servicio cuando necesites usar REMESAS.","Your 20-minute service period has ended. You can activate REMESAS again when you need to use it."))}</p><button class="primary" onclick="renderAccessGate()">${esc(t("Activar servicio","Activate service"))}</button><button class="secondary" onclick="renderAbout()">${esc(t("Ver información","View information"))}</button></section></main>`;
}

function renderHome(){
 if(!accessActive()){renderAccessGate();return}
 const o=APP.config?.opening||{},appInfo=APP.config?.app||{};
 const purpose=t("REMESAS te ayuda a entender, organizar y preparar una remesa sin tener que conocer la parte técnica. Te pregunta lo necesario, hace cálculos y te lleva a la fuente oficial cuando hace falta.","REMESAS helps you understand, organize, and prepare a remittance without needing to know the technical details. It asks what matters, does calculations, and takes you to the official source when needed.");
 const legal=t("REMESAS es un servicio informativo de May Roga LLC. No es un banco, financiera, asesor financiero ni procesador de pagos. No recibe ni envía tu dinero y no completa la transferencia por ti.","REMESAS is an informational service from May Roga LLC. It is not a bank, financial institution, financial advisor, or payment processor. It does not receive or send your money or complete the transfer for you.");
 app.innerHTML=`<header class="hero"><div class="hero-top"><strong>REMESAS</strong><div class="hero-actions"><span id="serviceClock" class="service-clock"></span><button class="lang-button" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></div><h1>${esc(o.primary_question||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1><p>${esc(o.secondary_text||t("Entiende tu necesidad, organiza tus datos y continúa con la fuente oficial.","Understand your need, organize your information, and continue with the official source."))}</p></header><main class="home"><section class="notice"><b>${esc(t("¿Para qué sirve?","What is it for?"))}</b><p>${esc(purpose)}</p></section><section class="notice"><b>${esc(t("Importante","Important"))}</b><p>${esc(t("REMESAS no inventa tarifas, tasas, tiempos de entrega ni disponibilidad. Si un dato comercial actual no está verificado, lo verás como no verificado y podrás ir al sitio oficial.","REMESAS does not invent fees, exchange rates, delivery times, or availability. If current commercial data are not verified, they are shown as unverified and you can go to the official site."))}</p></section><div class="cycle">${["TENGO","GANO","GASTO","AHORRO","QUIERO","PUEDO","HAGO"].map(x=>`<span>${x}</span>`).join("")}</div><section class="quick-grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa opciones.","Prepare a transfer and review options."),"renderRemittance()")}${homeCard("💰",t("Mi dinero","My money"),t("Calcula lo que tienes disponible.","Calculate what you have available."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Mira referencias diarias, semanales y quincenales.","See daily, weekly and biweekly references."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos.","Record and review expenses."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda una referencia local para una remesa.","Save a local transfer reference."),"renderFamily()")}${homeCard("❓",t("No entiendo","I need help"),t("Escribe lo que necesitas y te orientamos.","Write what you need and we will guide you."),"renderHelp()")}${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Comprueba si cabe en tu cálculo.","Check whether it fits your calculation."),"renderPurchase()")}${homeCard("🏦",t("Ahorrar","Save"),t("Reserva dinero para una meta.","Reserve money for a goal."),"renderSavings()")}</section><section class="card"><h2>${esc(t("¿Qué necesitas hacer?","What do you need to do?"))}</h2><p class="small">${esc(t("Puedes escribirlo con tus propias palabras. La aplicación intentará entenderlo.","Use your own words. The app will try to understand you."))}</p><textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero enviar $200 a México...","Example: I want to send $200 to Mexico..."))}"></textarea><button class="primary" onclick="understandNeed()">${esc(t("Ayúdame","Help me"))}</button></section><section class="card"><h2>${esc(t("Tus registros","Your records"))}</h2><p class="small">${esc(t("Puedes guardar tus datos en este dispositivo, descargar un PDF claro con tus registros e importar ese mismo PDF más adelante para recuperarlos.","You can keep your records on this device, download a clear PDF with your records, and later import that same PDF to restore them."))}</p><button class="primary" onclick="exportPDF()">${esc(t("Descargar mis datos en PDF","Download my data as PDF"))}</button><label class="file-button">${esc(t("Importar un PDF de REMESAS","Import a REMESAS PDF"))}<input type="file" accept="application/pdf,.pdf" onchange="importPDF(event)" hidden></label></section><section class="card"><h2>${esc(t("Protección y privacidad","Protection and privacy"))}</h2><p class="small">${esc(t("Tus datos personales de dinero se guardan en este dispositivo. La sesión de remesa del servidor es temporal. No escribas contraseñas bancarias, CVV, códigos de seguridad ni credenciales de proveedores aquí.","Your personal money data stays on this device. The server remittance session is temporary. Do not enter bank passwords, CVVs, security codes, or provider credentials here."))}</p><button class="secondary" onclick="renderAbout()">${esc(t("Ver qué hace y qué no hace REMESAS","See what REMESAS does and does not do"))}</button><button class="secondary" onclick="deleteLocalData()">${esc(t("Borrar mis datos de este dispositivo","Delete my data from this device"))}</button></section><footer>${esc(appInfo.brand||"May Roga LLC")} · v${esc(APP.version)}</footer></main>`;
 updateClock();
}

function renderAbout(){
 const legal=t("REMESAS es una herramienta informativa y de organización. No es banco, financiera, asesor financiero ni procesador de pagos. No ejecuta remesas. Los datos comerciales actuales solo se muestran cuando existen datos verificables. Si no existen, la aplicación te dirige al proveedor oficial para confirmar los datos antes de enviar.","REMESAS is an informational and organization tool. It is not a bank, financial institution, financial advisor, or payment processor. It does not execute remittances. Current commercial data are shown only when verifiable data exist. Otherwise, the app directs you to the official provider to confirm details before sending.");
 renderShell(`<section class="card"><h1>${esc(t("REMESAS: qué hace","REMESAS: what it does"))}</h1><p>${esc(t("1. Entiende lo que necesitas. 2. Organiza monto, destino y preferencias. 3. Calcula datos que guardas en tu dispositivo. 4. Compara métodos y datos comerciales solo cuando pueden verificarse. 5. Te lleva al proveedor oficial para completar el proceso.","1. Understands what you need. 2. Organizes amount, destination, and preferences. 3. Calculates information you keep on your device. 4. Compares methods and commercial data only when they can be verified. 5. Takes you to the official provider to complete the process."))}</p><h2>${esc(t("Qué no hace","What it does not do"))}</h2><p>${esc(legal)}</p><h2>${esc(t("Tus datos","Your data"))}</h2><p>${esc(t("Los registros de Mi dinero, gastos, familia y ahorro se guardan en localStorage de este navegador. Puedes borrarlos desde el inicio. REMESAS no usa esos registros como una base de datos personal permanente del servidor.","Records from My money, expenses, family, and savings are stored in this browser's localStorage. You can delete them from the home screen. REMESAS does not use those records as a permanent personal database on the server."))}</p><h2>${esc(t("Impuestos","Taxes"))}</h2><p>${esc(t("La organización de tus ingresos y gastos puede darte datos que después puedes entregar a tu contador o preparador de impuestos. REMESAS no prepara, presenta ni calcula tus impuestos.","Organized income and expense information can give you records you may later provide to your accountant or tax preparer. REMESAS does not prepare, file, or calculate your taxes."))}</p><h2>${esc(t("Servicio","Service"))}</h2><p>${esc(t("El acceso normal se activa con un pago único de $10.99 y dura 20 minutos. El pago no convierte a REMESAS en banco ni en procesador de pagos.","Normal access is activated with a one-time $10.99 payment and lasts 20 minutes. Payment does not make REMESAS a bank or payment processor."))}</p><button class="primary" onclick="${accessActive()?"renderHome()":"renderAccessGate()"}">${esc(t("Entendido","Understood"))}</button></section>`,t("Información","Information"));
}

function countryCode(c){return String(c?.id||c?.code||"").toUpperCase()}

function countryName(code){
 const c=(APP.config?.countries||[]).find(x=>countryCode(x)===String(code||"").toUpperCase());
 return c?.name?.[APP.lang]||c?.name?.es||code||"";
}

function priorityLabel(v){
 return({
  recipient_gets_more:t("Que reciba más","Recipient gets more"),
  fastest:t("Rapidez","Speed"),
  save:t("Ahorrar","Save"),
  balanced:t("Equilibrio","Balanced"),
  urgent:t("Urgente","Urgent"),
  compare_all:t("Comparar","Compare")
 }[v]||v||"");
}

function frequencyLabel(v){
 return({
  weekly:t("Semanal","Weekly"),
  biweekly:t("Quincenal","Biweekly"),
  monthly:t("Mensual","Monthly"),
  one_time:t("Una vez","One time")
 }[v]||v||"");
}

function methodLabel(x){
 if(typeof x==="string")return x;
 return x?.label?.[APP.lang]||x?.label?.es||x?.name||x?.id||"";
}

async function understandNeed(){
 if(!accessActive()){renderAccessGate();return}
 const text=(document.getElementById("freeNeed")?.value||"").trim();
 if(!text){showError(t("Escribe primero qué necesitas.","Write what you need first."));return}
 try{
  const d=await api("/api/need/parse",{method:"POST",body:JSON.stringify({text,language:APP.lang})});
  const p=d.parsed||{};
  if(p.need_type==="remittance"||p.amount||p.destination_country)await beginParsedRemittance(p);
  else{
   renderShell(`<section class="card"><div class="status success">${esc(t("Entendido","Understood"))}</div><h1>${esc(t("Vamos paso a paso","Let's go step by step"))}</h1><p>${esc(t("Todavía no tengo suficiente información para una acción concreta. Podemos empezar por preparar una remesa o puedes elegir otra ayuda.","I do not have enough information for a concrete action yet. We can start by preparing a transfer or you can choose another help option."))}</p><button class="primary" onclick="renderRemittance()">${esc(t("Preparar una remesa","Prepare a transfer"))}</button><button class="secondary" onclick="renderHelp()">${esc(t("Ver ayuda","View help"))}</button></section>`,t("Tu necesidad","Your need"));
  }
 }catch(e){showError(e.message)}
}

async function beginParsedRemittance(p){
 try{
  await startSession(true);
  const body={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance"};
  ["amount","destination_country","priority","urgency","frequency","delivery_method","payment_method","recipient_amount_target","special_need"].forEach(k=>{if(p[k]!=null)body[k]=p[k]});
  APP.session=(await api("/api/need",{method:"POST",body:JSON.stringify(body)})).session;
  renderRemittance(p);
 }catch(e){showError(e.message)}
}

function renderRemittance(p={}){
 const s=APP.session||{},amount=s.amount??p.amount??"",country=s.destination_country||p.destination_country||"",priority=s.priority||p.priority||"";
 renderShell(`<section class="card"><h1>${esc(t("Enviar dinero","Send money"))}</h1><p class="small">${esc(t("Solo preguntamos lo que puede cambiar el siguiente paso. Si no sabes una respuesta, puedes dejarla sin elegir.","We only ask what can change the next step. If you do not know an answer, you can leave it unselected."))}</p><label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="sendAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}"><label>${esc(t("¿A qué país?","Which country?"))}</label><select id="sendCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select><label>${esc(t("¿Qué importa más?","What matters most?"))}</label><select id="sendPriority"><option value="">${esc(t("No estoy seguro","Not sure"))}</option>${["recipient_gets_more","fastest","save","balanced"].map(x=>`<option value="${x}" ${priority===x?"selected":""}>${esc(priorityLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Es urgente?","Is it urgent?"))}</label><select id="sendUrgency"><option value="">${esc(t("No estoy seguro","Not sure"))}</option><option value="true">${esc(t("Sí","Yes"))}</option><option value="false">${esc(t("No","No"))}</option></select><label>${esc(t("¿Cada cuánto envías?","How often do you send?"))}</label><select id="sendFrequency"><option value="">${esc(t("Una vez / no sé","One time / not sure"))}</option>${["one_time","weekly","biweekly","monthly"].map(x=>`<option value="${x}">${esc(frequencyLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Cómo recibe?","How does the recipient receive?"))}</label><select id="sendDelivery"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.delivery_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(methodLabel(x))}</option>`).join("")}</select><label>${esc(t("¿Cómo pagarías?","How will you pay?"))}</label><select id="sendPayment"><option value="">${esc(t("No sé todavía","Not yet sure"))}</option>${(APP.config?.payment_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(methodLabel(x))}</option>`).join("")}</select><div id="moneyWarning"></div><button class="primary" onclick="compare()">${esc(t("Revisar opciones","Review options"))}</button></section>`,t("Enviar dinero","Send money"));
 document.getElementById("sendAmount")?.addEventListener("input",updateMoneyWarning);
 updateMoneyWarning();
}

function getMoneyState(){
 return getJSON(APP.moneyKey,{income:0,incomeFreq:"monthly",monthlyIncome:0,essential:0,flexible:0,savings:0,remittance:0,available:0,availableDaily:0,availableWeekly:0,availableBiweekly:0,availableMonthly:0});
}

function expenseMonthlyTotal(){
 return getExpenses().reduce((sum,x)=>{
  const a=num(x.amount),f=x.frequency;
  if(f==="weekly")return sum+a*52/12;
  if(f==="biweekly")return sum+a*26/12;
  return sum+a;
 },0);
}

function updateMoneyWarning(){
 const box=document.getElementById("moneyWarning");
 if(!box)return;
 const a=Number(document.getElementById("sendAmount")?.value||0),m=getMoneyState(),av=Number(m.available||0),w=[];
 if(av>0&&a>av)w.push(t(`El monto supera tu disponible calculado (${money(av)}).`,`The amount exceeds your calculated available balance (${money(av)}).`));
 if(a>10000)w.push(t("Por este monto conviene revisar cuidadosamente los datos finales del proveedor.","For this amount, carefully review the provider's final details."));
 box.innerHTML=w.length?`<div class="status warning">${w.map(esc).join("<br>")}</div>`:"";
}

async function compare(){
 if(!accessActive()){renderAccessGate();return}
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
  renderComparison(r);
 }catch(e){showError(e.message)}
}

function renderLoading(){
 renderShell(`<section class="card center"><div class="loader"></div><h2>${esc(t("Revisando opciones","Reviewing options"))}</h2><p>${esc(t("Comprobamos lo que puede mostrarse. No inventaremos datos comerciales.","We check what can be shown. We will not invent commercial data."))}</p></section>`,t("Revisión","Review"));
}

function providerCard(p){
 const id=p.provider_id||p.id||"",r=(APP.session?.verified_results||[]).find(x=>x.provider_id===id),verified=Boolean(p.commercial_verified||p.commercial_status==="verified"||r?.status==="verified"),url=p.continue_url||p.official_site||p.official_urls?.send_money||p.official_urls?.site;
 const payment=(p.payment_methods||[]).map(methodLabel).filter(Boolean),delivery=(p.delivery_methods||[]).map(methodLabel).filter(Boolean);
 return `<article class="provider-card"><div class="provider-head"><h3>${esc(p.provider_name||p.name||id)}</h3><span class="status ${verified?"success":"warning"}">${esc(verified?t("Datos verificados","Verified data"):t("Revisar sitio oficial","Review official site"))}</span></div>${verified&&r?`<div class="metric-grid"><div><small>${esc(t("Tarifa","Fee"))}</small><b>${r.fee!=null?money(r.fee):"—"}</b></div><div><small>${esc(t("Tasa","Rate"))}</small><b>${esc(r.exchange_rate??"—")}</b></div><div><small>${esc(t("Recibe","Gets"))}</small><b>${r.recipient_amount!=null?money(r.recipient_amount):"—"}</b></div><div><small>${esc(t("Entrega","Delivery"))}</small><b>${esc(r.estimated_delivery??r.delivery_time??"—")}</b></div></div>`:`<p class="small">${esc(t("No mostramos tarifas, tasas, tiempos ni disponibilidad como datos actuales porque no están verificados.","We do not show fees, rates, timing, or availability as current data because they are not verified."))}</p>`}${payment.length?`<p class="small"><b>${esc(t("Cómo pagas:","How you pay:"))}</b> ${esc(payment.join(", "))}</p>`:""}${delivery.length?`<p class="small"><b>${esc(t("Cómo recibe:","How recipient receives:"))}</b> ${esc(delivery.join(", "))}</p>`:""}${p.supports_online?`<p class="small">${esc(t("Disponible en línea según el registro de esta aplicación.","Online availability is listed in this app's provider data."))}</p>`:""}${p.supports_agent?`<p class="small">${esc(t("También aparece con atención en agente.","Agent service is also listed."))}</p>`:""}${url?`<button class="primary" onclick="selectProvider('${esc(id)}')">${esc(t("Revisar proveedor","Review provider"))}</button>`:""}</article>`;
}

function renderComparison(data){
 const providers=data.available_providers||[],verified=Number(data.verified_count||0);
 renderShell(`<section class="card"><div class="status ${data.results_available?"success":"warning"}">${esc(data.results_available?t(`${verified} opción(es) con datos verificados`,`${verified} option(s) with verified data`):t("No hay datos comerciales actuales verificados","No current verified commercial data"))}</div><h1>${esc(t("Opciones para tu remesa","Options for your transfer"))}</h1><div class="summary"><b>${esc(data.destination_name||countryName(data.destination_country))}</b><span>${money(data.amount)}</span></div><p>${esc(data.explanation||"")}</p>${providers.length?`<div class="provider-list">${providers.map(providerCard).join("")}</div>`:`<div class="status warning">${esc(t("No encontramos proveedores para este destino en el catálogo actual.","No providers were found for this destination in the current catalog."))}</div>`}<div class="notice">${esc(t("La disponibilidad, la tarifa, la tasa, el tiempo, los requisitos y los datos finales se confirman directamente con el proveedor.","Availability, fee, rate, timing, requirements, and final details must be confirmed directly with the provider."))}</div><button class="secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button><button class="secondary" onclick="renderHome()">${esc(t("Volver al inicio","Back to home"))}</button></section>`,t("Opciones","Options"));
}

async function selectProvider(id){
 if(!accessActive()){renderAccessGate();return}
 try{
  const d=await api(`/api/session/${APP.session.session_id}/select/${encodeURIComponent(id)}`,{method:"POST"});
  APP.session=d.session;
  renderFinalCheck();
 }catch(e){showError(e.message)}
}

async function renderFinalCheck(){
 if(!APP.session?.selected_option){showError(t("Selecciona primero un proveedor.","Select a provider first."));return}
 try{
  const d=await api(`/api/session/${APP.session.session_id}/final-check`,{method:"POST"});
  const o=APP.session.selected_option,url=o.continue_url||o.official_site||"";
  renderShell(`<section class="card"><div class="status ${d.ready_to_continue?"success":"warning"}">${esc(d.ready_to_continue?t("Revisión básica completada","Basic review completed"):t("Revisa los datos","Review the details"))}</div><h1>${esc(o.provider_name||"")}</h1><p>${esc(d.message||"")}</p><div class="checks">${(d.checks||[]).map(c=>{const ok=Boolean(c.complete)&&c.status!=="review";return`<div class="check ${ok?"ok":"bad"}"><b>${ok?"✓":"!"}</b><span><strong>${esc(c.label)}</strong> ${esc(String(c.value??""))}</span></div>`}).join("")}</div><div class="notice">${esc(t("El destinatario, la tarifa, la tasa, el tiempo, la disponibilidad y los requisitos deben confirmarse en el sitio oficial. No introduzcas aquí contraseñas, CVV ni códigos de seguridad.","Recipient information, fee, rate, timing, availability, and requirements must be confirmed on the official site. Do not enter passwords, CVVs, or security codes here."))}</div>${(d.requirements||[]).length?`<p class="small"><b>${esc(t("Requisitos declarados:","Declared requirements:"))}</b> ${(d.requirements||[]).map(x=>esc(methodLabel(x))).join(", ")}</p>`:""}${url?`<button class="primary" onclick="openOfficial('${esc(url)}')">${esc(t("Abrir sitio oficial","Open official site"))}</button>`:""}<button class="secondary" onclick="renderComparisonFromSession()">${esc(t("Ver otros proveedores","See other providers"))}</button></section>`,t("Revisión final","Final review"));
 }catch(e){showError(e.message)}
}

function openOfficial(url){
 if(!/^https:\/\//i.test(url)){showError(t("El enlace oficial no es válido.","The official link is not valid."));return}
 window.open(url,"_blank","noopener,noreferrer");
}

function renderComparisonFromSession(){
 const data={available_providers:APP.session?.available_providers||[],results:APP.session?.verified_results||[],verified_count:(APP.session?.verified_results||[]).length,results_available:(APP.session?.verified_results||[]).length>0,amount:APP.session?.amount,destination_country:APP.session?.destination_country,destination_name:countryName(APP.session?.destination_country),explanation:t("Estas son las opciones de la sesión actual.","These are the options from the current session.")};
 renderComparison(data);
}

function renderMoney(){
 const m=getMoneyState();
 renderShell(`<section class="card"><h1>${esc(t("Mi dinero","My money"))}</h1><p class="small">${esc(t("Este cálculo es tuyo; no es un saldo bancario. Tus registros se guardan en este dispositivo.","This is your calculation; it is not a bank balance. Your records stay on this device."))}</p><label>${esc(t("Ingreso","Income"))}</label><input id="income" type="number" min="0" step=".01" value="${esc(m.income||"")}"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq"><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="monthly">${esc(t("Mensual","Monthly"))}</option></select><label>${esc(t("Gastos esenciales","Essential expenses"))}</label><input id="essential" type="number" min="0" step=".01" value="${esc(m.essential||"")}"><label>${esc(t("Gastos flexibles","Flexible expenses"))}</label><input id="flexible" type="number" min="0" step=".01" value="${esc(m.flexible||"")}"><label>${esc(t("Ahorro reservado","Reserved savings"))}</label><input id="savings" type="number" min="0" step=".01" value="${esc(m.savings||"")}"><label>${esc(t("Remesas reservadas","Reserved remittance"))}</label><input id="remittance" type="number" min="0" step=".01" value="${esc(m.remittance||"")}"><div class="notice"><b>${esc(t("Gastos registrados","Recorded expenses"))}</b><p>${money(expenseMonthlyTotal())} ${esc(t("aproximadamente por mes según las frecuencias que guardaste.","approximately per month based on the frequencies you saved."))}</p><button class="secondary" onclick="useRecordedExpenses()">${esc(t("Usar como gastos flexibles","Use as flexible expenses"))}</button></div><button class="primary" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button><div id="moneyResult"></div><p class="small">${esc(t("Estos registros pueden servirte como referencia para entregar información a tu contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.","These records can serve as a reference when giving information to your accountant or tax preparer. REMESAS does not prepare or file taxes."))}</p></section>`,t("Mi dinero","My money"));
 document.getElementById("incomeFreq").value=m.incomeFreq||"monthly";
 if(Number(m.income||0))showMoneyResult(m);
}

function frequencyFactor(f){
 return f==="weekly"?52/12:f==="biweekly"?26/12:1;
}

function calculateMoney(){
 const income=Number(document.getElementById("income")?.value||0),freq=document.getElementById("incomeFreq")?.value||"monthly",essential=Number(document.getElementById("essential")?.value||0),flexible=Number(document.getElementById("flexible")?.value||0),savings=Number(document.getElementById("savings")?.value||0),remittance=Number(document.getElementById("remittance")?.value||0);
 if([income,essential,flexible,savings,remittance].some(x=>x<0)){showError(t("Los valores no pueden ser negativos.","Values cannot be negative."));return}
 const monthlyIncome=income*frequencyFactor(freq);
 const available=monthlyIncome-essential-flexible-savings-remittance;
 const availableDaily=available/30.4375;
 const availableWeekly=available/4.333333;
 const availableBiweekly=available/(26/12);
 const d={income,incomeFreq:freq,monthlyIncome,essential,flexible,savings,remittance,available,availableDaily,availableWeekly,availableBiweekly,availableMonthly:available,recordedExpensesMonthly:expenseMonthlyTotal(),savingsPurpose:getMoneyState().savingsPurpose||"",updatedAt:new Date().toISOString()};
 setJSON(APP.moneyKey,d);
 showMoneyResult(d);
}

function useRecordedExpenses(){
 const m=getMoneyState();
 m.flexible=Number(expenseMonthlyTotal().toFixed(2));
 setJSON(APP.moneyKey,m);
 renderMoney();
}

function showMoneyResult(d){
 const a=Number(d.available||0),box=document.getElementById("moneyResult");
 if(box)box.innerHTML=`<div class="money-summary"><span>${esc(t("Ingreso mensual equivalente","Equivalent monthly income"))}</span><b>${money(d.monthlyIncome)}</b><span>${esc(t("Disponible mensual","Monthly available"))}</span><b>${money(a)}</b><span>${esc(t("Disponible semanal","Weekly available"))}</span><b>${money(d.availableWeekly??a/4.333333)}</b><span>${esc(t("Disponible quincenal","Biweekly available"))}</span><b>${money(d.availableBiweekly??a/(26/12))}</b><span>${esc(t("Disponible diario","Daily available"))}</span><b>${money(d.availableDaily??a/30.4375)}</b></div><div class="status ${a>=0?"success":"warning"}">${esc(a>=0?t("PUEDO: el cálculo queda por encima de cero.","I CAN: the calculation remains above zero."):t("PUEDO: tus compromisos superan el ingreso calculado.","I CAN: your commitments exceed calculated income."))}</div><button class="primary" onclick="renderRemittance()">${esc(t("Usar este cálculo para una remesa","Use this calculation for a transfer"))}</button>`;
}

function renderWeek(){
 const m=getMoneyState();
 if(!m.monthlyIncome){renderMoney();return}
 const monthly=num(m.availableMonthly??m.available),daily=monthly/30.4375,weekly=monthly/4.333333,biweekly=monthly/(26/12);
 renderShell(`<section class="card"><h1>${esc(t("Mi semana","My week"))}</h1><p class="small">${esc(t("Son referencias de organización, no un saldo bancario ni una orden de gasto.","These are planning references, not a bank balance or a spending order."))}</p><div class="money-summary"><span>${esc(t("Disponible diario","Daily available"))}</span><b>${money(daily)}</b><span>${esc(t("Disponible semanal","Weekly available"))}</span><b>${money(weekly)}</b><span>${esc(t("Disponible quincenal","Biweekly available"))}</span><b>${money(biweekly)}</b><span>${esc(t("Disponible mensual","Monthly available"))}</span><b>${money(monthly)}</b></div><div class="status ${monthly>=0?"success":"warning"}">${esc(monthly>=0?t("Puedes usar estas cifras como referencias para organizar tus próximos gastos y remesas.","You can use these figures as references to organize upcoming expenses and transfers."):t("Revisa tus compromisos porque el cálculo disponible es negativo.","Review your commitments because the calculated available amount is negative."))}</div><button class="primary" onclick="renderMoney()">${esc(t("Modificar cálculo","Modify calculation"))}</button></section>`,t("Mi semana","My week"));
}

function getExpenses(){return getJSON(APP.expensesKey,[])}

function renderExpenses(){
 const e=getExpenses();
 renderShell(`<section class="card"><h1>${esc(t("Mis gastos","My expenses"))}</h1><p class="small">${esc(t("Guardar aquí te ayuda a ver cuánto sale y luego usar ese dato en Mi dinero.","Saving expenses here helps you see what goes out and then use that information in My money."))}</p><label>${esc(t("Descripción","Description"))}</label><input id="expenseName" maxlength="120"><label>${esc(t("Monto","Amount"))}</label><input id="expenseAmount" type="number" min=".01" step=".01"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expenseFrequency"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option><option value="one_time">${esc(t("Una vez","One time"))}</option></select><button class="primary" onclick="addExpense()">${esc(t("Guardar gasto","Save expense"))}</button><div class="notice"><b>${esc(t("Total aproximado mensual","Approximate monthly total"))}</b><p>${money(expenseMonthlyTotal())}</p></div><div>${e.map((x,i)=>`<div class="expense-row"><span><b>${esc(x.description)}</b><small>${esc(frequencyLabel(x.frequency))}</small></span><b>${money(x.amount)}</b><button class="danger-button" onclick="removeExpense(${i})" aria-label="${esc(t("Borrar gasto","Delete expense"))}">×</button></div>`).join("")}</div><button class="secondary" onclick="useRecordedExpenses()">${esc(t("Usar total en Mi dinero","Use total in My money"))}</button><button class="secondary" onclick="renderMoney()">${esc(t("Actualizar Mi dinero","Update My money"))}</button></section>`,t("Mis gastos","My expenses"));
}

function addExpense(){
 const d=(document.getElementById("expenseName")?.value||"").trim(),a=Number(document.getElementById("expenseAmount")?.value||0),f=document.getElementById("expenseFrequency")?.value||"monthly";
 if(!d||!a||a<=0){showError(t("Completa descripción y monto válido.","Enter a description and valid amount."));return}
 const e=getExpenses();
 e.push({description:d,amount:a,frequency:f,createdAt:new Date().toISOString()});
 setJSON(APP.expensesKey,e);
 renderExpenses();
}

function removeExpense(i){
 const e=getExpenses();
 e.splice(i,1);
 setJSON(APP.expensesKey,e);
 renderExpenses();
}

function renderFamily(){
 const d=getJSON(APP.familyKey,{name:"",country:"",amount:""});
 renderShell(`<section class="card"><h1>${esc(t("Familia","Family"))}</h1><p class="small">${esc(t("Solo es una referencia local; no crea una orden de envío.","This is only a local reference; it does not create a transfer order."))}</p><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="familyName" maxlength="80" value="${esc(d.name)}"><label>${esc(t("País","Country"))}</label><select id="familyCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${(APP.config?.countries||[]).map(c=>{const id=countryCode(c);return`<option value="${id}" ${id===d.country?"selected":""}>${esc(c.name?.[APP.lang]||c.name?.es||id)}</option>`}).join("")}</select><label>${esc(t("Monto de referencia","Reference amount"))}</label><input id="familyAmount" type="number" min="0" step=".01" value="${esc(d.amount)}"><button class="primary" onclick="saveFamily()">${esc(t("Guardar en este dispositivo","Save on this device"))}</button></section>`,t("Familia","Family"));
}

function saveFamily(){
 setJSON(APP.familyKey,{name:(document.getElementById("familyName")?.value||"").trim(),country:document.getElementById("familyCountry")?.value||"",amount:Number(document.getElementById("familyAmount")?.value||0),updatedAt:new Date().toISOString()});
 renderHome();
}

function renderSavings(){
 const m=getMoneyState();
 renderShell(`<section class="card"><h1>${esc(t("Ahorrar","Save"))}</h1><p class="small">${esc(t("Reserva una cantidad y deja la referencia guardada en este dispositivo.","Reserve an amount and keep the reference on this device."))}</p><label>${esc(t("¿Cuánto quieres reservar?","How much do you want to reserve?"))}</label><input id="saveAmount" type="number" min="0" step=".01" value="${esc(m.savings||"")}"><label>${esc(t("¿Para qué?","What for?"))}</label><input id="savePurpose" maxlength="100" value="${esc(m.savingsPurpose||"")}"><button class="primary" onclick="saveSavings()">${esc(t("Guardar objetivo","Save goal"))}</button></section>`,t("Ahorrar","Save"));
}

function saveSavings(){
 const m=getMoneyState();
 m.savings=Number(document.getElementById("saveAmount")?.value||0);
 m.savingsPurpose=(document.getElementById("savePurpose")?.value||"").trim();
 m.updatedAt=new Date().toISOString();
 setJSON(APP.moneyKey,m);
 renderMoney();
}

function renderPurchase(){
 renderShell(`<section class="card"><h1>${esc(t("Planear una compra","Plan a purchase"))}</h1><p class="small">${esc(t("La aplicación compara el precio con tu disponible calculado; no decide por ti si debes comprar.","The app compares the price with your calculated available amount; it does not decide whether you should buy."))}</p><label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label><input id="purchaseName" maxlength="120"><label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label><input id="purchaseAmount" type="number" min=".01" step=".01"><button class="primary" onclick="checkPurchase()">${esc(t("Comprobar","Check"))}</button></section>`,t("Planear una compra","Plan a purchase"));
}

function checkPurchase(){
 const n=(document.getElementById("purchaseName")?.value||"").trim(),a=Number(document.getElementById("purchaseAmount")?.value||0),m=getMoneyState(),d=Number(m.available||0)-a;
 if(!n||!a||a<=0){showError(t("Completa nombre y precio.","Enter a name and valid price."));return}
 renderShell(`<section class="card"><div class="status ${d>=0?"success":"warning"}">${esc(d>=0?t("PUEDO: cabe en tu cálculo actual.","I CAN: it fits your current calculation."):t("PUEDO: supera tu disponible actual.","I CAN: it exceeds your current available amount."))}</div><h1>${esc(n)}</h1><div class="money-summary"><span>${esc(t("Precio","Price"))}</span><b>${money(a)}</b><span>${esc(t("Después de comprar","After purchase"))}</span><b>${money(d)}</b></div><button class="primary" onclick="renderMoney()">${esc(t("Revisar Mi dinero","Review My money"))}</button></section>`,t("Resultado","Result"));
}

function renderHelp(){
 const topics=APP.config?.help_topics||[];
 renderShell(`<section class="card"><h1>${esc(t("¿Qué no entiendes?","What don't you understand?"))}</h1><p class="small">${esc(t("Elige una pregunta y recibirás una respuesta práctica.","Choose a question and you will get a practical answer."))}</p>${topics.map(x=>`<button class="help-item" onclick="showHelpTopic('${esc(x.id)}')"><b>${esc(x.label||x.title||x.id)}</b></button>`).join("")}<button class="secondary" onclick="renderAbout()">${esc(t("Qué hace REMESAS","What REMESAS does"))}</button><button class="secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></section>`,t("Ayuda","Help"));
}

function showHelpTopic(id){
 const x=(APP.config?.help_topics||[]).find(a=>a.id===id);
 if(!x)return;
 renderShell(`<section class="card"><h1>${esc(x.label||x.title||x.id)}</h1><p>${esc(x.answer||"")}</p><button class="primary" onclick="renderHelp()">${esc(t("Ver más ayuda","More help"))}</button></section>`,x.label||x.title||id);
}

function showError(m){
 const old=document.querySelector(".error-box");
 if(old)old.remove();
 const b=document.createElement("div");
 b.className="error-box";
 b.innerHTML=`<b>${esc(t("Atención","Attention"))}</b><span>${esc(m)}</span><button onclick="this.parentElement.remove()">×</button>`;
 document.body.appendChild(b);
 setTimeout(()=>b.remove(),7000);
}

function deleteLocalData(){
 if(!confirm(t("¿Borrar los datos guardados en este dispositivo? Esto eliminará Mi dinero, gastos, familia, ahorro y preferencias de REMESAS.","Delete the data saved on this device? This removes My money, expenses, family, savings, and REMESAS preferences.")))return;
 [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,"remesas_lang_v4"].forEach(k=>localStorage.removeItem(k));
 if(APP.session?.session_id)api(`/api/session/${APP.session.session_id}`,{method:"DELETE"}).catch(()=>{});
 APP.session=null;
 location.reload();
}

/* PDF */

function snapshotData(){
 return {
  format:"REMESAS_RECOVERY_V1",
  app:APP.name,
  version:APP.version,
  language:APP.lang,
  exported_at:new Date().toISOString(),
  money:getMoneyState(),
  expenses:getExpenses(),
  family:getJSON(APP.familyKey,{name:"",country:"",amount:""}),
  preferences:getJSON(APP.prefsKey,{})
 };
}

function base64urlEncode(text){
 const bytes=new TextEncoder().encode(text);
 let binary="";
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

function base64urlDecode(text){
 let s=text.replace(/-/g,"+").replace(/_/g,"/");
 while(s.length%4)s+="=";
 const binary=atob(s);
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return new TextDecoder().decode(bytes);
}

function splitText(text,size=90){
 const out=[];
 for(let i=0;i<text.length;i+=size)out.push(text.slice(i,i+size));
 return out;
}

function loadScript(src){
 return new Promise((resolve,reject)=>{
  const old=document.querySelector(`script[data-remesas-lib="${src}"]`);
  if(old){old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});if(window.jspdf||window.pdfjsLib)resolve();return}
  const s=document.createElement("script");
  s.src=src;
  s.async=true;
  s.dataset.remesasLib=src;
  s.onload=resolve;
  s.onerror=()=>reject(new Error(t("No se pudo cargar el generador PDF.","The PDF library could not be loaded.")));
  document.head.appendChild(s);
 });
}

async function ensurePDFLibraries(importMode=false){
 if(!window.jspdf)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
 if(importMode&&!window.pdfjsLib){
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs").catch(async()=>{
   await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  });
 }
 if(importMode&&window.pdfjsLib){
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=window.pdfjsLib.GlobalWorkerOptions.workerSrc||"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
 }
}

async function exportPDF(){
 try{
  await ensurePDFLibraries(false);
  const {jsPDF}=window.jspdf||{};
  if(!jsPDF)throw new Error(t("El generador PDF no está disponible.","The PDF generator is unavailable."));
  const doc=new jsPDF({unit:"mm",format:"letter"});
  const data=snapshotData();
  const date=new Date(data.exported_at);
  const dateText=date.toLocaleString(APP.lang==="en"?"en-US":"es-US",{dateStyle:"full",timeStyle:"short"});
  const recovery=base64urlEncode(JSON.stringify(data));
  let y=18;
  const left=18;
  const width=174;

  doc.setFont("helvetica","bold");
  doc.setFontSize(20);
  doc.text("REMESAS",left,y);
  y+=9;
  doc.setFontSize(13);
  doc.text(t("Registro personal de dinero","Personal money record"),left,y);
  y+=8;

  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.text(dateText,left,y);
  y+=8;

  doc.setFontSize(11);
  doc.setFont("helvetica","bold");
  doc.text(t("Resumen","Summary"),left,y);
  y+=6;
  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  const m=data.money||{};
  const summary=[
   [t("Ingreso mensual equivalente","Equivalent monthly income"),money(m.monthlyIncome)],
   [t("Disponible mensual","Monthly available"),money(m.available)],
   [t("Disponible semanal","Weekly available"),money(m.availableWeekly)],
   [t("Disponible quincenal","Biweekly available"),money(m.availableBiweekly)],
   [t("Disponible diario","Daily available"),money(m.availableDaily)],
   [t("Gastos esenciales","Essential expenses"),money(m.essential)],
   [t("Gastos flexibles","Flexible expenses"),money(m.flexible)],
   [t("Ahorro reservado","Reserved savings"),money(m.savings)],
   [t("Remesa reservada","Reserved transfer"),money(m.remittance)]
  ];

  summary.forEach(row=>{
   doc.text(`${row[0]}: ${row[1]}`,left,y);
   y+=5;
  });

  y+=4;
  doc.setFont("helvetica","bold");
  doc.text(t("Gastos registrados","Recorded expenses"),left,y);
  y+=6;
  doc.setFont("helvetica","normal");

  if(!data.expenses.length){
   doc.text(t("No hay gastos registrados.","No expenses recorded."),left,y);
   y+=6;
  }else{
   data.expenses.forEach(x=>{
    if(y>270){doc.addPage();y=18}
    const line=`• ${x.description} — ${money(x.amount)} — ${frequencyLabel(x.frequency)}`;
    const lines=doc.splitTextToSize(line,width);
    doc.text(lines,left,y);
    y+=5*lines.length;
   });
  }

  y+=3;
  if(y>265){doc.addPage();y=18}
  doc.setFont("helvetica","bold");
  doc.text(t("Familia / referencia","Family / reference"),left,y);
  y+=6;
  doc.setFont("helvetica","normal");
  if(data.family?.name){
   doc.text(`${t("Nombre","Name")}: ${data.family.name}`,left,y);y+=5;
   if(data.family.country){doc.text(`${t("País","Country")}: ${countryName(data.family.country)}`,left,y);y+=5}
   if(data.family.amount)doc.text(`${t("Monto","Amount")}: ${money(data.family.amount)}`,left,y),y+=5;
  }else{
   doc.text(t("No hay referencia familiar registrada.","No family reference recorded."),left,y);y+=5;
  }

  y+=4;
  if(y>260){doc.addPage();y=18}
  doc.setFontSize(8);
  doc.setFont("helvetica","italic");
  const note=doc.splitTextToSize(t("Este documento organiza los datos registrados por el usuario. Puede servir como referencia para entregar información a un contador o preparador de impuestos. REMESAS no prepara, presenta ni calcula impuestos.","This document organizes information entered by the user. It may serve as a reference when providing information to an accountant or tax preparer. REMESAS does not prepare, file, or calculate taxes."),width);
  doc.text(note,left,y);
  y+=5*note.length+5;

  if(y>260){doc.addPage();y=18}
  doc.setFont("helvetica","normal");
  doc.setFontSize(5);
  doc.setTextColor(150);
  doc.text("REMESAS_RECOVERY_V1",left,y);
  y+=3;
  splitText(recovery,95).forEach(line=>{
   if(y>285){doc.addPage();y=18}
   doc.text(line,left,y);
   y+=2.5;
  });
  doc.setTextColor(0);

  const filename=`REMESAS_${date.toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
 }catch(e){showError(e.message)}
}

async function importPDF(event){
 const file=event?.target?.files?.[0];
 if(!file)return;
 try{
  if(file.type!=="application/pdf"&&!/\.pdf$/i.test(file.name))throw new Error(t("Selecciona un archivo PDF.","Select a PDF file."));
  await ensurePDFLibraries(true);
  if(!window.pdfjsLib)throw new Error(t("No se pudo leer el PDF.","The PDF could not be read."));
  const buffer=await file.arrayBuffer();
  const loadingTask=window.pdfjsLib.getDocument({data:buffer});
  const pdf=await loadingTask.promise;
  let text="";
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);
   const content=await page.getTextContent();
   text+=content.items.map(x=>x.str||"").join(" ")+"\n";
  }
  const match=text.match(/REMESAS_RECOVERY_V1\s*([\s\S]*?)(?:REMESAS_RECOVERY_END|$)/);
  if(!match){
   const fallback=text.match(/REMESAS_RECOVERY_V1\s+([A-Za-z0-9_-]+)/);
   if(!fallback)throw new Error(t("Este PDF no contiene un registro recuperable de REMESAS.","This PDF does not contain a recoverable REMESAS record."));
   await restoreSnapshot(JSON.parse(base64urlDecode(fallback[1])));
   return;
  }
  const payload=match[1].replace(/\s+/g,"");
  if(!payload)throw new Error(t("El PDF no contiene datos recuperables.","The PDF contains no recoverable data."));
  const data=JSON.parse(base64urlDecode(payload));
  await restoreSnapshot(data);
 }catch(e){
  showError(e.message||t("No se pudo importar el PDF.","The PDF could not be imported."));
 }finally{
  if(event?.target)event.target.value="";
 }
}

async function restoreSnapshot(data){
 if(!data||data.format!=="REMESAS_RECOVERY_V1")throw new Error(t("El archivo no pertenece al formato de recuperación de REMESAS.","The file is not a REMESAS recovery format."));
 if(data.money&&typeof data.money==="object")setJSON(APP.moneyKey,data.money);
 if(Array.isArray(data.expenses))setJSON(APP.expensesKey,data.expenses);
 if(data.family&&typeof data.family==="object")setJSON(APP.familyKey,data.family);
 if(data.preferences&&typeof data.preferences==="object")setJSON(APP.prefsKey,data.preferences);
 if(data.language==="es"||data.language==="en"){
  APP.lang=data.language;
  localStorage.setItem("remesas_lang_v4",APP.lang);
 }
 await loadConfig();
 showImported();
}

function showImported(){
 renderShell(`<section class="card center"><div class="status success">${esc(t("Datos recuperados","Data restored"))}</div><h1>${esc(t("Listo","Done"))}</h1><p>${esc(t("Tus registros del PDF fueron restaurados en este dispositivo. Puedes revisarlos en Mi dinero, Mis gastos, Familia y Ahorrar.","Your PDF records were restored on this device. You can review them in My money, My expenses, Family and Save."))}</p><button class="primary" onclick="renderHome()">${esc(t("Continuar","Continue"))}</button></section>`,t("Recuperación","Recovery"));
}

/* ADMIN OCULTO */

function registerAdminTap(e){
 if(e?.target?.closest?.("button,input,textarea,select,a,label"))return;
 const now=Date.now();
 APP.adminTaps=APP.adminTaps.filter(x=>now-x<900);
 APP.adminTaps.push(now);
 if(APP.adminTaps.length>=3){
  APP.adminTaps=[];
  renderAdminLogin();
 }
}

function renderAdminLogin(){
 const old=document.getElementById("admin-modal");
 if(old)old.remove();
 const div=document.createElement("div");
 div.id="admin-modal";
 div.className="modal";
 div.innerHTML=`<div class="modal-box"><button class="modal-close" onclick="closeAdminLogin()">×</button><h2>${esc(t("Acceso privado","Private access"))}</h2><p class="small">${esc(t("Área de administración. Escribe las credenciales configuradas por May Roga LLC.","Administration area. Enter the credentials configured by May Roga LLC."))}</p><label>${esc(t("Usuario","Username"))}</label><input id="adminUser" autocomplete="username"><label>${esc(t("Contraseña","Password"))}</label><input id="adminPass" type="password" autocomplete="current-password"><button class="primary" onclick="adminLogin()">${esc(t("Entrar","Sign in"))}</button></div>`;
 document.body.appendChild(div);
 setTimeout(()=>document.getElementById("adminUser")?.focus(),50);
}

function closeAdminLogin(){
 document.getElementById("admin-modal")?.remove();
}

async function adminLogin(){
 const username=document.getElementById("adminUser")?.value||"",password=document.getElementById("adminPass")?.value||"";
 if(!username||!password){showError(t("Escribe usuario y contraseña.","Enter username and password."));return}
 try{
  const d=await api("/api/access/admin",{method:"POST",body:JSON.stringify({username,password})});
  if(d?.access)saveAccess(d.access);
  else if(d?.token)saveAccess(d);
  else throw new Error(t("No se pudo activar el acceso.","Access could not be activated."));
  closeAdminLogin();
  startTimer();
  renderHome();
 }catch(e){showError(e.message)}
}

/* ACCESS STATUS / TIMER */

async function refreshAccess(){
 if(!accessToken())return false;
 try{
  const d=await api("/api/access/status");
  if(d?.active&&d?.access){
   APP.access=d.access;
   sessionStorage.setItem("remesas_access_token_v4",APP.access.token);
   startTimer();
   updateClock();
   return true;
  }
 }catch{}
 clearAccess();
 return false;
}

/* PUBLIC EXPORTS */

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
 renderAccessGate,
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
 startPayment,
 exportPDF,
 importPDF,
 restoreSnapshot,
 renderAdminLogin,
 closeAdminLogin,
 adminLogin,
 useRecordedExpenses
});

document.addEventListener("click",registerAdminTap,{passive:true});

document.addEventListener("DOMContentLoaded",async()=>{
 try{
  await loadConfig();
  const returned=await checkPaymentReturn();
  if(returned)return;
  const active=await checkAccess();
  if(active){
   await startSession(true).catch(()=>{});
   renderHome();
  }else{
   renderAccessGate();
  }
 }catch(e){
  app.innerHTML=`<main class="page"><section class="card"><div class="status warning">${esc(t("No se pudo cargar REMESAS.","REMESAS could not be loaded."))}</div><p>${esc(e.message)}</p><button class="primary" onclick="location.reload()">${esc(t("Reintentar","Retry"))}</button></section></main>`;
 }
});

setInterval(()=>{
 if(accessToken()&&remainingSeconds()>0)updateClock();
},1000);

setInterval(()=>{
 if(accessToken()&&remainingSeconds()>0)refreshAccess();
},60000);
