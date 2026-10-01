"use strict";
const APP={name:"REMESAS",version:"4.2.0",lang:localStorage.getItem("remesas_lang_v4")||localStorage.getItem("remesas_lang")||"es",session:null,config:null,comparison:null,pendingParsed:null,accessToken:sessionStorage.getItem("remesas_access_token_v4")||"",accessUntil:Number(sessionStorage.getItem("remesas_access_until_v4")||0),adminMode:sessionStorage.getItem("remesas_admin_v4")==="1",intro:Number(localStorage.getItem("remesas_intro_v4")||0),keys:{money:"remesas_money_v4",expenses:"remesas_expenses_v4",family:"remesas_family_v4",prefs:"remesas_prefs_v4",lang:"remesas_lang_v4",savings:"remesas_savings_v4"}};

const COUNTRY_REGISTRY=[
{code:"MX",name:{es:"México",en:"Mexico"}},{code:"GT",name:{es:"Guatemala",en:"Guatemala"}},{code:"SV",name:{es:"El Salvador",en:"El Salvador"}},{code:"HN",name:{es:"Honduras",en:"Honduras"}},{code:"NI",name:{es:"Nicaragua",en:"Nicaragua"}},{code:"CR",name:{es:"Costa Rica",en:"Costa Rica"}},{code:"PA",name:{es:"Panamá",en:"Panama"}},{code:"CO",name:{es:"Colombia",en:"Colombia"}},{code:"VE",name:{es:"Venezuela",en:"Venezuela"}},{code:"EC",name:{es:"Ecuador",en:"Ecuador"}},{code:"PE",name:{es:"Perú",en:"Peru"}},{code:"BO",name:{es:"Bolivia",en:"Bolivia"}},{code:"PY",name:{es:"Paraguay",en:"Paraguay"}},{code:"CL",name:{es:"Chile",en:"Chile"}},{code:"AR",name:{es:"Argentina",en:"Argentina"}},{code:"BR",name:{es:"Brasil",en:"Brazil"}},{code:"DO",name:{es:"República Dominicana",en:"Dominican Republic"}},{code:"CU",name:{es:"Cuba",en:"Cuba"}}
];

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const t=(es,en)=>APP.lang==="en"?en:es;
const money=(v,c="USD")=>{const n=Number(v);if(!Number.isFinite(n))return"—";try{return new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:String(c||"USD").toUpperCase(),maximumFractionDigits:2}).format(n)}catch{return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n)}};
const getJSON=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const setJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const toast=m=>{const o=document.querySelector(".toast");if(o)o.remove();const e=document.createElement("div");e.className="toast";e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)};
const loading=(m=t("Cargando...","Loading..."))=>`<div class="loading"><span class="spinner"></span><span>${esc(m)}</span></div>`;
const errorBox=m=>`<div class="error">${esc(m)}</div>`;

function accessValid(){return APP.adminMode||Boolean(APP.accessToken&&APP.accessUntil>Date.now())}
function accessSeconds(){return Math.max(0,Math.floor((APP.accessUntil-Date.now())/1000))}
function normalizeAccess(d){
 if(!d)return false;
 if(d.token)APP.accessToken=d.token;
 if(d.expires_at)APP.accessUntil=Number(d.expires_at)<1e12?Number(d.expires_at)*1000:Number(d.expires_at);
 else if(d.seconds)APP.accessUntil=Date.now()+Number(d.seconds)*1000;
 sessionStorage.setItem("remesas_access_token_v4",APP.accessToken||"");
 sessionStorage.setItem("remesas_access_until_v4",String(APP.accessUntil||0));
 if(d.admin){APP.adminMode=true;sessionStorage.setItem("remesas_admin_v4","1")}
 return accessValid();
}
function accessHeaders(){
 const h={"Content-Type":"application/json"};
 if(APP.accessToken)h["X-Remesas-Access-Token"]=APP.accessToken;
 return h;
}
async function api(url,options={}){
 const headers={...accessHeaders(),...(options.headers||{})};
 const r=await fetch(url,{...options,headers});
 let data=null;try{data=await r.json()}catch{}
 if(!r.ok){
  if(r.status===401&&!APP.adminMode&&accessValid()===false){clearAccess();renderAccess("expired");throw new Error(t("Tu acceso ha terminado.","Your access has expired."))}
  throw new Error(data?.detail||data?.message||t("No se pudo completar la operación.","The operation could not be completed."));
 }
 return data;
}
function clearAccess(){
 APP.accessToken="";APP.accessUntil=0;APP.adminMode=false;
 sessionStorage.removeItem("remesas_access_token_v4");sessionStorage.removeItem("remesas_access_until_v4");sessionStorage.removeItem("remesas_admin_v4");
}
async function checkAccess(){
 if(APP.adminMode)return true;
 if(accessValid())return true;
 try{
  const r=await fetch("/api/access/status",{headers:accessHeaders()});
  const d=await r.json().catch(()=>null);
  if(r.ok&&normalizeAccess(d))return true;
 }catch{}
 return false;
}

function getCountries(){
 const source=APP.config?.countries;let list=[];
 if(Array.isArray(source))list=source;else if(Array.isArray(source?.supported))list=source.supported;else if(Array.isArray(APP.config?.supported_countries))list=APP.config.supported_countries;
 if(!list.length)list=COUNTRY_REGISTRY;
 const normalized=list.map(c=>{
  if(typeof c==="string")return{code:c.toUpperCase(),name:{es:c,en:c}};
  const code=String(c?.code||c?.country_code||"").toUpperCase(),raw=c?.name??c?.country_name??code;
  const name=typeof raw==="object"?{es:raw.es||raw.en||code,en:raw.en||raw.es||code}:{es:String(raw||code),en:String(raw||code)};
  return{code,name};
 }).filter(c=>c.code);
 const seen=new Set();return normalized.filter(c=>{if(seen.has(c.code))return false;seen.add(c.code);return true});
}
function getHelpTopics(){
 const h=APP.config?.help_topics;if(Array.isArray(h))return h;if(Array.isArray(h?.topics))return h.topics;return[];
}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);return APP.config}
async function startSession(){
 const d=await api("/api/session",{method:"POST",body:JSON.stringify({language:APP.lang})});
 APP.session=d.session||null;return APP.session;
}

function shell(content){
 const cfg=APP.config||{},appName=cfg.app?.name||APP.name;
 return `<div class="app-shell"><header class="topbar"><button class="brand" style="border:0;background:transparent;padding:0;text-align:left" onclick="renderHome()">${esc(appName)}<small>${esc(cfg.app?.brand||"May Roga LLC")}</small></button><div class="top-actions"><span id="accessClock" class="access-clock"></span><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header>${content}<footer class="footer"><div><strong>REMESAS</strong> · ${esc(cfg.app?.brand||"May Roga LLC")}</div><div class="legal">${esc(t("REMESAS es una herramienta de organización y preparación. No es un banco, financiera, asesor financiero ni procesador de pagos. No recibe ni transmite fondos de remesas. No prepara ni presenta impuestos.","REMESAS is an organization and preparation tool. It is not a bank, financial institution, financial advisor, or payment processor. It does not receive or transmit remittance funds. It does not prepare or file taxes."))}</div><div class="footer-links"><button class="btn secondary small" onclick="renderHelp()">${esc(t("Ayuda","Help"))}</button><button class="btn secondary small" onclick="renderPDFModule()">${esc(t("PDF / Mis datos","PDF / My data"))}</button><button class="btn secondary small" onclick="deleteLocalData()">${esc(t("Borrar datos locales","Delete local data"))}</button></div></footer></div>`;
}
function render(content){
 const a=$("app");if(a)a.innerHTML=shell(content);window.scrollTo({top:0,behavior:"smooth"});updateAccessClock();
}
function updateAccessClock(){
 const e=$("accessClock");if(!e)return;
 if(APP.adminMode){e.textContent=t("ADMIN","ADMIN");return}
 const s=accessSeconds();
 e.textContent=s>0?`${t("Acceso","Access")}: ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`:"";
}
setInterval(()=>{
 updateAccessClock();
 if(!APP.adminMode&&APP.accessToken&&APP.accessUntil&&APP.accessUntil<=Date.now()){
  clearAccess();if($("app")&&!document.querySelector(".access-screen"))renderAccess("expired");
 }
},1000);

function introWindow(){
 if(APP.intro>=3)return false;
 if(APP.intro===0){
  renderIntro(0,t("Bienvenido a REMESAS","Welcome to REMESAS"),t("Organiza tu dinero, prepara una remesa y revisa opciones oficiales desde un solo lugar.","Organize your money, prepare a remittance and review official options from one place."),t("REMESAS no mueve tu dinero. Te ayuda a entender y preparar lo que necesitas.","REMESAS does not move your money. It helps you understand and prepare what you need."));
 }else if(APP.intro===1){
  renderIntro(1,t("¿Cómo funciona?","How does it work?"),t("Primero identificas tu necesidad. Después organizas tus datos, revisas las opciones disponibles y finalmente decides si deseas continuar directamente con el proveedor oficial.","First identify your need. Then organize your information, review available options, and finally decide whether to continue directly with the official provider."),t("Las tarifas, tasas, tiempos y disponibilidad pueden cambiar. REMESAS no inventa esos datos.","Fees, rates, delivery times and availability can change. REMESAS does not invent those data."));
 }else{
  renderIntro(2,t("Tu información y tus decisiones","Your information and your decisions"),t("Tus registros personales de dinero permanecen en este dispositivo. Las sesiones necesarias para prestar el servicio pueden procesarse temporalmente en el servidor.","Your personal money records remain on this device. Information needed to provide the service may be processed temporarily on the server."),t("Nunca introduzcas contraseñas bancarias, CVV, PIN ni credenciales de terceros en REMESAS.","Never enter bank passwords, CVVs, PINs or third-party credentials into REMESAS."));
 }
 return true;
}
function renderIntro(n,title,text,note){
 render(`<section class="section access-screen"><div class="card form-card" style="max-width:720px;margin:50px auto"><div class="section-title"><div><span class="eyebrow">${esc(t(`Paso ${n+1} de 3`,`Step ${n+1} of 3`))}</span><h1>${esc(title)}</h1><p>${esc(text)}</p></div></div><div class="notice info">${esc(note)}</div><div class="actions"><button class="btn" onclick="nextIntro()">${esc(n===2?t("Continuar","Continue"):t("Siguiente","Next"))}</button>${n>0?`<button class="btn secondary" onclick="prevIntro()">${esc(t("Atrás","Back"))}</button>`:""}</div></div></section>`);
}
function nextIntro(){APP.intro=Math.min(3,APP.intro+1);localStorage.setItem("remesas_intro_v4",String(APP.intro));if(APP.intro<3){introWindow();return}renderAccess()}
function prevIntro(){APP.intro=Math.max(0,APP.intro-1);localStorage.setItem("remesas_intro_v4",String(APP.intro));introWindow()}

function renderAccess(reason=""){
 const expired=reason==="expired";
 render(`<section class="section access-screen"><div class="card form-card" style="max-width:650px;margin:35px auto"><div class="section-title"><div><h1>${esc(t("Acceso a REMESAS","REMESAS access"))}</h1><p>${esc(expired?t("Tu acceso de 20 minutos terminó. Para continuar necesitas iniciar un nuevo acceso.","Your 20-minute access has ended. To continue, start a new access.")):t("El servicio se activa mediante un acceso de 20 minutos.","The service is activated through a 20-minute access."))}</p></div></div><div class="notice warning"><strong>${esc(t("$10.99 · acceso único","$10.99 · one-time access"))}</strong><br>${esc(t("Un pago activa 20 minutos de uso. No es una suscripción.","One payment activates 20 minutes of use. It is not a subscription."))}</div><div class="legal" style="margin-top:12px">${esc(t("El pago se procesa mediante Stripe. REMESAS no recibe ni almacena los datos completos de tu tarjeta.","Payment is processed through Stripe. REMESAS does not receive or store your full card details."))}</div><div class="actions"><button class="btn" onclick="startPayment()">${esc(t("Pagar $10.99 y entrar","Pay $10.99 and enter"))}</button><button class="btn secondary" onclick="renderAccessInfo()">${esc(t("¿Cómo funciona el acceso?","How does access work?"))}</button></div><div id="paymentResult"></div></div></section>`);
}
function renderAccessInfo(){
 render(`<section class="section access-screen"><div class="card form-card" style="max-width:700px;margin:35px auto"><div class="section-title"><h2>${esc(t("Acceso y protección","Access and protection"))}</h2></div><div class="notice info">${esc(t("El pago no compra una transferencia. Compra el acceso temporal a la herramienta REMESAS.","The payment does not purchase a transfer. It purchases temporary access to the REMESAS tool."))}</div><ul class="list"><li>${esc(t("20 minutos de uso después de la activación.","20 minutes of use after activation."))}</li><li>${esc(t("Pago único; no suscripción.","One-time payment; no subscription."))}</li><li>${esc(t("Stripe procesa el pago.","Stripe processes the payment."))}</li><li>${esc(t("REMESAS no recibe ni transmite dinero.","REMESAS does not receive or transmit money."))}</li><li>${esc(t("Las condiciones finales se confirman siempre con el proveedor oficial.","Final conditions must always be confirmed with the official provider."))}</li></ul><div class="actions"><button class="btn" onclick="renderAccess()">${esc(t("Volver al acceso","Back to access"))}</button></div></div></section>`);
}
async function startPayment(){
 const b=document.querySelector(".access-screen .btn");if(b)b.disabled=true;
 try{
  const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang,price:10.99,mode:"one_time"})});
  if(d.url){location.href=d.url;return}
  if(d.checkout_url){location.href=d.checkout_url;return}
  if(d.session_id&&window.Stripe){location.href=d.session_id;return}
  throw new Error(t("Stripe no devolvió una dirección de pago.","Stripe did not return a payment address."));
 }catch(e){toast(e.message);if(b)b.disabled=false}
}
async function paymentCheck(){
 try{
  const d=await api("/api/payment/check",{method:"POST",body:JSON.stringify({language:APP.lang})});
  if(normalizeAccess(d)){await enterApp();return true}
 }catch{}
 return false;
}
async function enterApp(){
 if(!accessValid()&&!await checkAccess()){renderAccess("expired");return}
 try{await loadConfig();if(!APP.session)await startSession();renderHome()}catch(e){
  const a=$("app");if(a)a.innerHTML=`<div class="app-shell"><section class="section"><div class="card">${errorBox(e.message)}<div class="actions"><button class="btn" onclick="location.reload()">${esc(t("Intentar nuevamente","Try again"))}</button></div></div></section></div>`;
 }
}

function adminTap(){
 APP.adminTaps=(APP.adminTaps||0)+1;clearTimeout(APP.adminTapTimer);APP.adminTapTimer=setTimeout(()=>APP.adminTaps=0,1800);
 if(APP.adminTaps>=3){APP.adminTaps=0;renderAdminLogin()}
}
document.addEventListener("click",e=>{
 if(e.target.closest(".brand"))adminTap();
});

function renderAdminLogin(){
 render(`<section class="section access-screen"><div class="card form-card" style="max-width:480px;margin:50px auto"><div class="section-title"><h2>${esc(t("Acceso administrativo","Administrator access"))}</h2></div><div class="field"><label for="adminUser">${esc(t("Usuario","Username"))}</label><input id="adminUser" autocomplete="username"></div><div class="field"><label for="adminPass">${esc(t("Contraseña","Password"))}</label><input id="adminPass" type="password" autocomplete="current-password"></div><div class="actions"><button class="btn" onclick="adminLogin()">${esc(t("Entrar","Sign in"))}</button><button class="btn secondary" onclick="renderAccess()">${esc(t("Volver","Back"))}</button></div><div class="legal" style="margin-top:12px">${esc(t("Las credenciales se validan en el servidor y no forman parte del código público.","Credentials are validated on the server and are not part of the public code."))}</div></div></section>`);
}
async function adminLogin(){
 const u=$("adminUser")?.value.trim(),p=$("adminPass")?.value;
 if(!u||!p)return toast(t("Introduce usuario y contraseña.","Enter username and password."));
 try{
  const d=await fetch("/api/access/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p,language:APP.lang})});
  const x=await d.json().catch(()=>null);
  if(!d.ok)throw new Error(x?.detail||t("Acceso administrativo rechazado.","Administrator access denied."));
  normalizeAccess({...x,admin:true});await enterApp();
 }catch(e){toast(e.message)}
}

function renderHome(){
 const moneyData=getJSON(APP.keys.money,{}),expenses=getJSON(APP.keys.expenses,[]),available=calculateLocalAvailable();
 render(`<section class="hero"><h1>${esc(t("TENGO → GANO → GASTO → AHORRO → QUIERO → PUEDO → HAGO","HAVE → EARN → SPEND → SAVE → WANT → CAN → DO"))}</h1><p>${esc(t("Organiza tu dinero, prepara una remesa y revisa opciones sin complicarte.","Organize your money, prepare a remittance and review options without unnecessary complexity."))}</p><div class="hero-actions"><button class="btn" onclick="renderRemittance()">${esc(t("Preparar remesa","Prepare remittance"))}</button><button class="btn secondary" onclick="renderMoney()">${esc(t("Ver mi dinero","View my money"))}</button></div></section><section class="section"><div class="section-title"><div><h2>${esc(t("¿Qué necesitas ahora?","What do you need now?"))}</h2><p>${esc(t("Cada opción produce una reacción funcional.","Each option produces a functional result."))}</p></div></div><div class="grid">${actionCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa proveedores.","Prepare a remittance and review providers."),"renderRemittance()")}${actionCard("💰",t("Mi dinero","My money"),t("Calcula lo que tienes disponible.","Calculate what you have available."),"renderMoney()")}${actionCard("📅",t("Mi semana","My week"),t("Convierte tus ingresos a una referencia semanal.","Convert income to a weekly reference."),"renderWeek()")}${actionCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos en este dispositivo.","Record and review expenses on this device."),"renderExpenses()")}${actionCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda referencias locales para preparar remesas.","Save local references for preparing remittances."),"renderFamily()")}${actionCard("🛒",t("Quiero comprar","I want to buy"),t("Comprueba cómo una compra cambia tu cálculo.","See how a purchase changes your calculation."),"renderPurchase()")}${actionCard("🏦",t("Ahorro","Savings"),t("Registra una cantidad para un objetivo.","Record an amount for a goal."),"renderSavings()")}${actionCard("📄",t("Mis datos / PDF","My data / PDF"),t("Crea o recupera un respaldo de tus registros locales.","Create or recover a backup of your local records."),"renderPDFModule()")}${actionCard("❓",t("Ayuda","Help"),t("Describe tu necesidad y recibe orientación.","Describe your need and get guidance."),"renderHelp()")}</div></section><section class="section"><div class="section-title"><h2>${esc(t("Resumen local","Local summary"))}</h2></div><div class="balance-grid"><div class="balance"><span>${esc(t("Ingresos registrados","Recorded income"))}</span><strong>${money(moneyData.income||0)}</strong></div><div class="balance"><span>${esc(t("Gastos registrados","Recorded expenses"))}</span><strong>${money(expenses.reduce((a,x)=>a+Number(x.amount||0)*frequencyFactor(x.frequency||"monthly"),0))}</strong></div><div class="balance ${available>=0?"positive":"negative"}"><span>${esc(t("Disponible calculado","Calculated available"))}</span><strong>${money(available)}</strong></div></div></section><section class="section"><div class="privacy"><div><strong>${esc(t("Protección y límites","Protection and limits"))}</strong><div class="legal">${esc(t("REMESAS organiza información y dirige al usuario a fuentes oficiales. No recibe fondos, no ejecuta transferencias, no garantiza condiciones comerciales y no prepara impuestos.","REMESAS organizes information and directs users to official sources. It does not receive funds, execute transfers, guarantee commercial conditions, or prepare taxes."))}</div></div><button class="btn danger small" onclick="deleteLocalData()">${esc(t("Borrar","Delete"))}</button></div></section>`);
}
function actionCard(icon,title,desc,action){return `<button class="card action-card" onclick="${action}" style="border:1px solid var(--border);text-align:left;color:inherit"><div class="action-icon">${icon}</div><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div></button>`}

function renderRemittance(parsed=null){
 const s=APP.session||{},countries=getCountries(),currentCountry=String(s.destination_country||parsed?.destination_country||"").toUpperCase();
 const destinations=countries.map(c=>{const code=String(c.code||"").toUpperCase(),raw=c.name,name=typeof raw==="object"?(raw[APP.lang]||raw.es||raw.en||code):raw;return `<option value="${esc(code)}" ${currentCountry===code?"selected":""}>${esc(name||code)}</option>`}).join("");
 const amount=s.amount??parsed?.amount??"",priority=s.priority||parsed?.priority||"",urgency=s.urgency??parsed?.urgency??false,frequency=s.frequency||parsed?.frequency||"one_time",delivery=s.delivery_method||parsed?.delivery_method||"",payment=s.payment_method||parsed?.payment_method||"";
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Preparar una remesa","Prepare a remittance"))}</h2><p>${esc(t("Solo pedimos lo necesario para revisar opciones.","We only ask for what is needed to review options."))}</p></div></div><div class="card form-card"><div class="notice info">${esc(t("REMESAS no mueve tu dinero. Antes de enviar una transacción, revisa las condiciones actuales directamente con el proveedor oficial.","REMESAS does not move your money. Before sending a transaction, review current conditions directly with the official provider."))}</div><div class="form-row"><div class="field"><label for="remAmount">${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="remAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}" placeholder="100"></div><div class="field"><label for="remCountry">${esc(t("¿A qué país?","Which country?"))}</label><select id="remCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${destinations}</select></div></div><div class="field"><label>${esc(t("¿Qué te importa más?","What matters most?"))}</label><div class="choice-grid">${choice("priority","save",t("Ahorrar / menor costo","Save / lower cost"),priority)}${choice("priority","fastest",t("Rapidez","Speed"),priority)}${choice("priority","recipient_gets_more",t("Más para quien recibe","More for recipient"),priority)}${choice("priority","balanced",t("Equilibrio","Balance"),priority)}</div></div><div class="check-row"><input id="remUrgency" type="checkbox" ${urgency?"checked":""}><label for="remUrgency">${esc(t("Es urgente o necesitas hacerlo hoy","It is urgent or you need it today"))}</label></div><div class="form-row"><div class="field"><label for="remFrequency">${esc(t("Frecuencia","Frequency"))}</label><select id="remFrequency"><option value="one_time" ${frequency==="one_time"?"selected":""}>${esc(t("Una vez","One time"))}</option><option value="weekly" ${frequency==="weekly"?"selected":""}>${esc(t("Semanal","Weekly"))}</option><option value="biweekly" ${frequency==="biweekly"?"selected":""}>${esc(t("Quincenal","Biweekly"))}</option><option value="monthly" ${frequency==="monthly"?"selected":""}>${esc(t("Mensual","Monthly"))}</option></select></div><div class="field"><label for="remDelivery">${esc(t("Cómo recibe","How recipient receives"))}</label><select id="remDelivery"><option value="">${esc(t("Selecciona","Select"))}</option><option value="cash_pickup" ${delivery==="cash_pickup"?"selected":""}>${esc(t("Efectivo / recoger","Cash pickup"))}</option><option value="bank_account" ${delivery==="bank_account"?"selected":""}>${esc(t("Cuenta bancaria","Bank account"))}</option><option value="debit_card" ${delivery==="debit_card"?"selected":""}>${esc(t("Tarjeta de débito","Debit card"))}</option><option value="mobile_wallet" ${delivery==="mobile_wallet"?"selected":""}>${esc(t("Billetera móvil","Mobile wallet"))}</option><option value="home_delivery" ${delivery==="home_delivery"?"selected":""}>${esc(t("Entrega a domicilio","Home delivery"))}</option></select></div></div><div class="field"><label for="remPayment">${esc(t("Cómo pagas","How you pay"))}</label><select id="remPayment"><option value="">${esc(t("Selecciona","Select"))}</option><option value="bank_account" ${payment==="bank_account"?"selected":""}>${esc(t("Cuenta bancaria","Bank account"))}</option><option value="debit_card" ${payment==="debit_card"?"selected":""}>${esc(t("Tarjeta de débito","Debit card"))}</option><option value="credit_card" ${payment==="credit_card"?"selected":""}>${esc(t("Tarjeta de crédito","Credit card"))}</option><option value="cash" ${payment==="cash"?"selected":""}>${esc(t("Efectivo","Cash"))}</option><option value="other" ${payment==="other"?"selected":""}>${esc(t("Otro","Other"))}</option></select></div><div class="actions"><button class="btn" onclick="compareRemittance()">${esc(t("Revisar opciones","Review options"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
function choice(name,value,label,current){const id=`${name}_${value}`;return `<div class="choice"><input id="${esc(id)}" name="${esc(name)}" type="radio" value="${esc(value)}" ${current===value?"checked":""}><label for="${esc(id)}">${esc(label)}</label></div>`}

async function compareRemittance(){
 const amount=Number($("remAmount")?.value||0),country=String($("remCountry")?.value||"").toUpperCase();
 if(!Number.isFinite(amount)||amount<=0||amount>1000000)return toast(t("Introduce un monto válido.","Enter a valid amount."));
 if(!country)return toast(t("Selecciona el país.","Select the country."));
 if(!APP.session)await startSession();
 const priority=document.querySelector('input[name="priority"]:checked')?.value||null;
 const payload={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance",amount,destination_country:country,priority,urgency:Boolean($("remUrgency")?.checked),frequency:$("remFrequency")?.value||null,delivery_method:$("remDelivery")?.value||null,payment_method:$("remPayment")?.value||null};
 try{render(loading(t("Preparando la revisión...","Preparing the review...")));const need=await api("/api/need",{method:"POST",body:JSON.stringify(payload)});APP.session=need.session||APP.session;const result=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/compare`,{method:"POST"});APP.comparison=result;renderComparison(result)}catch(e){render(`<section class="section">${errorBox(e.message)}<div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Intentar de nuevo","Try again"))}</button></div></section>`)}
}
function renderComparison(data){
 const options=data.available_providers||[],results=data.results||[],verified=new Map(results.map(x=>[x.provider_id,x]));
 APP.comparison=data;
 const cards=options.length?options.map(p=>providerCard(p,verified.get(p.provider_id))).join(""):`<div class="empty">${esc(t("No hay proveedores candidatos en el catálogo actual para este destino.","There are no candidate providers in the current catalog for this destination."))}</div>`;
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Opciones para tu remesa","Options for your remittance"))}</h2><p>${esc(data.destination_name||data.destination_country||"")}</p></div></div>${data.explanation?`<div class="notice info">${esc(data.explanation)}</div>`:""}${!data.results_available?`<div class="notice warning" style="margin-top:12px">${esc(t("No hay tarifas, tasas, tiempos o disponibilidad actuales verificadas por REMESAS. Por eso no se presenta ningún proveedor como más barato, más rápido o mejor.","REMESAS has no currently verified fees, rates, delivery times, or availability. Therefore no provider is presented as cheaper, faster, or better."))}</div>`:""}<div class="result-list" style="margin-top:14px">${cards}</div>${data.precautions?.length?`<div class="card" style="margin-top:14px"><h3>${esc(t("Antes de continuar","Before continuing"))}</h3><ul class="list">${data.precautions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}<div class="actions"><button class="btn secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div></section>`);
}
function providerCard(p,result){
 const verified=Boolean(result),commercial=[];
 if(verified){
  if(result.fee!=null)commercial.push(`<div class="metric"><span>${esc(t("Tarifa verificada","Verified fee"))}</span><strong>${money(result.fee)}</strong></div>`);
  if(result.exchange_rate!=null)commercial.push(`<div class="metric"><span>${esc(t("Tasa verificada","Verified rate"))}</span><strong>${esc(result.exchange_rate)}</strong></div>`);
  if(result.recipient_amount!=null)commercial.push(`<div class="metric"><span>${esc(t("Recibe","Recipient gets"))}</span><strong>${money(result.recipient_amount,result.recipient_currency||"USD")}</strong></div>`);
  if(result.estimated_delivery!=null)commercial.push(`<div class="metric"><span>${esc(t("Entrega","Delivery"))}</span><strong>${esc(result.estimated_delivery)}</strong></div>`);
  if(result.availability!=null)commercial.push(`<div class="metric"><span>${esc(t("Disponibilidad","Availability"))}</span><strong>${result.availability?esc(t("Disponible","Available")):esc(t("No disponible","Unavailable"))}</strong></div>`);
 }
 const methods=p.delivery_methods?.length?p.delivery_methods.map(x=>esc(typeof x==="object"?(x.name||x.id||JSON.stringify(x)):x)).join(", "):t("No especificados","Not specified");
 const id=JSON.stringify(String(p.provider_id||"")),official=p.continue_url?`<button class="btn secondary" onclick="openOfficial(${JSON.stringify(String(p.continue_url))})">${esc(t("Sitio oficial","Official site"))}</button>`:"";
 return `<article class="provider-card"><div class="provider-head"><div><h3>${esc(p.provider_name||"")}</h3><p>${esc(t("Proveedor del catálogo oficial","Official catalog provider"))}</p></div><span class="provider-status ${verified?"verified":""}">${verified?esc(t("Datos verificados","Verified data")):esc(t("Revisar sitio oficial","Review official site"))}</span></div>${commercial.length?`<div class="provider-data">${commercial.join("")}</div>`:`<div class="notice warning" style="margin-top:13px">${esc(t("No hay datos comerciales actuales verificados para mostrar aquí.","There is no currently verified commercial data to display here."))}</div>`}<div class="notice" style="margin-top:12px"><strong>${esc(t("Métodos declarados","Declared methods"))}:</strong> ${methods}<br><small>${esc(t("Estos métodos requieren confirmación en el sitio oficial y no representan disponibilidad actual.","These methods require confirmation on the official site and do not represent current availability."))}</small></div><div class="actions"><button class="btn" onclick="selectProvider(${id})">${esc(t("Revisar esta opción","Review this option"))}</button>${official}</div></article>`;
}
async function selectProvider(providerId){
 if(!APP.session?.session_id)return toast(t("La sesión no está disponible.","The session is unavailable."));
 try{const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(providerId)}`,{method:"POST"});APP.session=d.session||APP.session;renderSelectedProvider(d.selected_option||APP.session.selected_option)}catch(e){toast(e.message)}
}
function renderSelectedProvider(option){
 render(`<section class="section"><div class="card form-card"><div class="section-title"><div><h2>${esc(t("Has elegido revisar esta opción","You chose to review this option"))}</h2><p>${esc(option?.provider_name||"")}</p></div></div><div class="notice warning">${esc(t("Elegir una opción aquí no inicia una transferencia. REMESAS no procesa el dinero.","Selecting an option here does not start a transfer. REMESAS does not process the money."))}</div><div class="actions"><button class="btn" onclick="finalCheck()">${esc(t("Hacer revisión final","Run final check"))}</button>${option?.continue_url?`<button class="btn secondary" onclick="openOfficial(${JSON.stringify(String(option.continue_url))})">${esc(t("Abrir sitio oficial","Open official site"))}</button>`:""}<button class="btn secondary" onclick="renderComparison(APP.comparison||{})">${esc(t("Volver a opciones","Back to options"))}</button></div></div></section>`);
}
async function finalCheck(){
 if(!APP.session?.session_id)return toast(t("La sesión no está disponible.","The session is unavailable."));
 render(loading(t("Revisando datos básicos...","Checking basic details...")));
 try{const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,{method:"POST"});APP.session.final_check=d;renderFinalResult(d,APP.session.selected_option)}catch(e){render(`<section class="section">${errorBox(e.message)}<div class="actions"><button class="btn" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div></section>`)}
}
function renderFinalResult(data,option){
 const checks=(data.checks||[]).map(c=>`<div class="notice ${c.ok?"success":"danger"}" style="margin-bottom:8px"><strong>${esc(c.label)}</strong><br>${esc(c.message)}</div>`).join("");
 render(`<section class="section"><div class="card form-card"><div class="section-title"><div><h2>${esc(t("Revisión final","Final review"))}</h2><p>${esc(option?.provider_name||"")}</p></div></div>${checks}<div class="notice info">${esc(data.message||"")}</div><div class="card" style="margin-top:14px;box-shadow:none"><strong>${esc(t("Recuerda antes de enviar","Before submitting"))}</strong><ul class="list"><li>${esc(t("Confirma la tarifa final y la tasa de cambio en el sitio oficial.","Confirm the final fee and exchange rate on the official site."))}</li><li>${esc(t("Confirma disponibilidad y tiempo de entrega actuales.","Confirm current availability and delivery timing."))}</li><li>${esc(t("Revisa cuidadosamente los datos del destinatario.","Carefully review recipient information."))}</li><li>${esc(t("Nunca introduzcas contraseñas, CVV o credenciales bancarias en REMESAS.","Never enter passwords, CVV or bank credentials into REMESAS."))}</li></ul></div><div class="actions">${option?.continue_url?`<button class="btn" onclick="openOfficial(${JSON.stringify(String(option.continue_url))})">${esc(t("Continuar al sitio oficial","Continue to official site"))}</button>`:""}<button class="btn secondary" onclick="renderHome()">${esc(t("Terminar","Finish"))}</button></div></div></section>`);
}
function openOfficial(url){if(!url||!/^https:\/\//i.test(String(url)))return toast(t("Enlace oficial no disponible.","Official link unavailable."));window.open(String(url),"_blank","noopener,noreferrer")}

async function changeLanguage(){
 APP.lang=APP.lang==="es"?"en":"es";localStorage.setItem(APP.keys.lang,APP.lang);localStorage.setItem("remesas_lang",APP.lang);
 try{await loadConfig()}catch{}
 if(APP.session?.session_id)try{const d=await api("/api/need",{method:"POST",body:JSON.stringify({session_id:APP.session.session_id,language:APP.lang})});APP.session=d.session||APP.session}catch{}
 renderHome();
}

function renderMoney(){
 const d=getJSON(APP.keys.money,{});
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Mi dinero","My money"))}</h2><p>${esc(t("Calcula una referencia con tus propios datos.","Calculate a reference using your own data."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Ingreso principal","Main income"))}</label><input id="income" type="number" min="0" max="1000000" step=".01" value="${esc(d.income??"")}"></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq"><option value="monthly" ${d.frequency==="monthly"?"selected":""}>${esc(t("Mensual","Monthly"))}</option><option value="weekly" ${d.frequency==="weekly"?"selected":""}>${esc(t("Semanal","Weekly"))}</option><option value="biweekly" ${d.frequency==="biweekly"?"selected":""}>${esc(t("Quincenal","Biweekly"))}</option></select></div></div><div class="form-row"><div class="field"><label>${esc(t("Otros ingresos mensuales","Other monthly income"))}</label><input id="otherIncome" type="number" min="0" max="1000000" step=".01" value="${esc(d.otherIncome??"")}"></div><div class="field"><label>${esc(t("Remesa mensual","Monthly remittance"))}</label><input id="moneyRemittance" type="number" min="0" max="1000000" step=".01" value="${esc(d.remittance??"")}"></div></div><div class="form-row"><div class="field"><label>${esc(t("Gastos esenciales mensuales","Monthly essential expenses"))}</label><input id="essential" type="number" min="0" max="1000000" step=".01" value="${esc(d.essential??"")}"></div><div class="field"><label>${esc(t("Gastos flexibles mensuales","Monthly flexible expenses"))}</label><input id="flexible" type="number" min="0" max="1000000" step=".01" value="${esc(d.flexible??"")}"></div></div><div class="field"><label>${esc(t("Ahorro mensual","Monthly savings"))}</label><input id="moneySavings" type="number" min="0" max="1000000" step=".01" value="${esc(d.savings??"")}"></div><div class="actions"><button class="btn" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div><div id="moneyResult"></div></div></section>`);
}
function frequencyFactor(f){if(f==="weekly")return 52/12;if(f==="biweekly")return 26/12;return 1}
function calculateMoney(){
 const d={income:Number($("income")?.value||0),frequency:$("incomeFreq")?.value||"monthly",otherIncome:Number($("otherIncome")?.value||0),remittance:Number($("moneyRemittance")?.value||0),essential:Number($("essential")?.value||0),flexible:Number($("flexible")?.value||0),savings:Number($("moneySavings")?.value||0)};
 setJSON(APP.keys.money,d);const monthly=d.income*frequencyFactor(d.frequency)+d.otherIncome,available=monthly-d.essential-d.flexible-d.remittance-d.savings;
 $("moneyResult").innerHTML=`<div class="balance-grid" style="margin-top:15px"><div class="balance"><span>${esc(t("Ingreso mensual estimado","Estimated monthly income"))}</span><strong>${money(monthly)}</strong></div><div class="balance ${available>=0?"positive":"negative"}"><span>${esc(t("Disponible","Available"))}</span><strong>${money(available)}</strong></div></div><div class="notice ${available>=0?"success":"warning"}" style="margin-top:12px">${esc(available>=0?t("Según los datos introducidos, el cálculo queda positivo. Esto es una referencia, no asesoría financiera.","Based on the entered data, the calculation is positive. This is a reference, not financial advice."):t("Según los datos introducidos, el cálculo queda negativo. Revisa los montos antes de decidir una remesa o compra.","Based on the entered data, the calculation is negative. Review the amounts before deciding on a remittance or purchase."))}</div>`;
}
function calculateLocalAvailable(){
 const d=getJSON(APP.keys.money,{}),income=Number(d.income||0)*frequencyFactor(d.frequency||"monthly")+Number(d.otherIncome||0),expenses=getJSON(APP.keys.expenses,[]),total=expenses.reduce((a,x)=>a+Number(x.amount||0)*frequencyFactor(x.frequency||"monthly"),0);
 return income-total-Number(d.remittance||0)-Number(d.savings||0);
}
function renderWeek(){
 const d=getJSON(APP.keys.money,{}),monthly=Number(d.income||0)*frequencyFactor(d.frequency||"monthly")+Number(d.otherIncome||0),weekly=monthly*12/52;
 render(`<section class="section"><div class="card form-card"><div class="section-title"><h2>${esc(t("Mi semana","My week"))}</h2></div><div class="balance-grid"><div class="balance"><span>${esc(t("Ingreso mensual estimado","Estimated monthly income"))}</span><strong>${money(monthly)}</strong></div><div class="balance positive"><span>${esc(t("Referencia semanal","Weekly reference"))}</span><strong>${money(weekly)}</strong></div></div><div class="notice info" style="margin-top:14px">${esc(t("Es una conversión matemática para ayudarte a organizarte; no es una recomendación financiera.","This is a mathematical conversion to help you organize; it is not financial advice."))}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
function renderExpenses(){
 const ex=getJSON(APP.keys.expenses,[]),list=ex.length?ex.map((x,i)=>`<div class="notice" style="margin-bottom:8px"><strong>${esc(x.description)}</strong> · ${money(x.amount)}<br><small>${esc(x.category||"")} · ${esc(x.frequency||"monthly")}</small><button class="btn danger small" style="float:right" onclick="deleteExpense(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<div class="empty">${esc(t("Todavía no hay gastos registrados.","No expenses have been recorded yet."))}</div>`;
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Mis gastos","My expenses"))}</h2><p>${esc(t("Los registros permanecen en este dispositivo.","Records remain on this device."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Descripción","Description"))}</label><input id="expDesc" maxlength="120"></div><div class="field"><label>${esc(t("Monto","Amount"))}</label><input id="expAmount" type="number" min=".01" max="1000000" step=".01"></div></div><div class="form-row"><div class="field"><label>${esc(t("Categoría","Category"))}</label><input id="expCat" maxlength="60"></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expFreq"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option></select></div></div><button class="btn" onclick="addExpense()">${esc(t("Guardar gasto local","Save local expense"))}</button><div style="margin-top:15px">${list}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
function addExpense(){
 const description=$("expDesc")?.value.trim(),amount=Number($("expAmount")?.value||0);
 if(!description||!Number.isFinite(amount)||amount<=0||amount>1000000)return toast(t("Introduce descripción y monto válidos.","Enter a valid description and amount."));
 const a=getJSON(APP.keys.expenses,[]);a.push({description,amount,category:$("expCat")?.value.trim()||"",frequency:$("expFreq")?.value||"monthly",created_at:new Date().toISOString()});setJSON(APP.keys.expenses,a);renderExpenses();
}
function deleteExpense(i){const a=getJSON(APP.keys.expenses,[]);if(i<0||i>=a.length)return;a.splice(i,1);setJSON(APP.keys.expenses,a);renderExpenses()}

function renderFamily(){
 const f=getJSON(APP.keys.family,[]),list=f.length?f.map((x,i)=>`<div class="notice" style="margin-bottom:8px"><strong>${esc(x.name)}</strong> · ${esc(x.country||"")} · ${money(x.amount||0)}<button class="btn danger small" style="float:right" onclick="deleteFamily(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<div class="empty">${esc(t("No hay referencias familiares guardadas.","No family references saved."))}</div>`;
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Familia","Family"))}</h2><p>${esc(t("Referencias guardadas solo en este dispositivo.","References saved only on this device."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="famName" maxlength="80"></div><div class="field"><label>${esc(t("País","Country"))}</label><input id="famCountry" maxlength="60"></div></div><div class="field"><label>${esc(t("Monto habitual","Usual amount"))}</label><input id="famAmount" type="number" min="0" max="1000000" step=".01"></div><button class="btn" onclick="addFamily()">${esc(t("Guardar referencia","Save reference"))}</button><div style="margin-top:15px">${list}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
function addFamily(){
 const name=$("famName")?.value.trim(),country=$("famCountry")?.value.trim(),amount=Number($("famAmount")?.value||0);
 if(!name)return toast(t("Introduce un nombre o apodo.","Enter a name or nickname."));
 if(!Number.isFinite(amount)||amount<0||amount>1000000)return toast(t("Monto inválido.","Invalid amount."));
 const a=getJSON(APP.keys.family,[]);a.push({name,country,amount,created_at:new Date().toISOString()});setJSON(APP.keys.family,a);renderFamily();
}
function deleteFamily(i){const a=getJSON(APP.keys.family,[]);if(i<0||i>=a.length)return;a.splice(i,1);setJSON(APP.keys.family,a);renderFamily()}

function renderSavings(){
 const a=getJSON(APP.keys.savings,[]),list=a.length?a.map((x,i)=>`<div class="notice" style="margin-bottom:8px"><strong>${money(x.amount)}</strong> · ${esc(x.type||"general")}<button class="btn danger small" style="float:right" onclick="deleteSavings(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<div class="empty">${esc(t("No hay registros de ahorro.","No savings records."))}</div>`;
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Ahorro","Savings"))}</h2><p>${esc(t("Registra una cantidad y su objetivo localmente.","Record an amount and its goal locally."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Cantidad","Amount"))}</label><input id="savAmount" type="number" min=".01" max="1000000" step=".01"></div><div class="field"><label>${esc(t("Objetivo","Goal"))}</label><input id="savType" maxlength="60" placeholder="${esc(t("Ej. emergencia","E.g. emergency"))}"></div></div><button class="btn" onclick="addSavings()">${esc(t("Guardar ahorro","Save savings"))}</button><div style="margin-top:15px">${list}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
function addSavings(){
 const amount=Number($("savAmount")?.value||0);if(!Number.isFinite(amount)||amount<=0||amount>1000000)return toast(t("Cantidad inválida.","Invalid amount."));
 const a=getJSON(APP.keys.savings,[]);a.push({amount,type:$("savType")?.value.trim()||"general",created_at:new Date().toISOString()});setJSON(APP.keys.savings,a);renderSavings();
}
function deleteSavings(i){const a=getJSON(APP.keys.savings,[]);if(i<0||i>=a.length)return;a.splice(i,1);setJSON(APP.keys.savings,a);renderSavings()}

function renderPurchase(){
 const available=calculateLocalAvailable();
 render(`<section class="section"><div class="card form-card"><div class="section-title"><div><h2>${esc(t("Quiero comprar","I want to buy"))}</h2><p>${esc(t("Comprueba el efecto matemático de una compra sobre tu cálculo local.","Check the mathematical effect of a purchase on your local calculation."))}</p></div></div><div class="notice info">${esc(t("Disponible calculado actualmente:","Currently calculated available:"))} <strong>${money(available)}</strong></div><div class="form-row" style="margin-top:14px"><div class="field"><label>${esc(t("Precio","Price"))}</label><input id="purchaseAmount" type="number" min=".01" max="1000000" step=".01"></div><div class="field"><label>${esc(t("Categoría","Category"))}</label><input id="purchaseCat" maxlength="60"></div></div><button class="btn" onclick="calculatePurchase()">${esc(t("Comprobar","Check"))}</button><div id="purchaseResult"></div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
function calculatePurchase(){
 const amount=Number($("purchaseAmount")?.value||0);if(!Number.isFinite(amount)||amount<=0||amount>1000000)return toast(t("Introduce un precio válido.","Enter a valid price."));
 const after=calculateLocalAvailable()-amount;$("purchaseResult").innerHTML=`<div class="balance ${after>=0?"positive":"negative"}" style="margin-top:14px"><span>${esc(t("Disponible después de la compra","Available after purchase"))}</span><strong>${money(after)}</strong></div><div class="notice ${after>=0?"success":"warning"}" style="margin-top:10px">${esc(after>=0?t("El cálculo sigue siendo positivo con los datos introducidos.","The calculation remains positive with the entered data."):t("El cálculo queda negativo con los datos introducidos; revisa tus números antes de tomar una decisión.","The calculation becomes negative with the entered data; review your numbers before making a decision."))}</div>`;
}

function renderHelp(){
 const topics=getHelpTopics(),topicList=topics.length?topics.map(x=>`<button class="card action-card" style="width:100%;margin-bottom:9px;min-height:auto;text-align:left" onclick="showHelpTopic(${JSON.stringify(String(x.id))})"><h3>${esc(x.title)}</h3><p>${esc(t("Ver explicación","View explanation"))}</p></button>`).join(""):`<div class="empty">${esc(t("No hay temas de ayuda configurados.","No help topics are configured."))}</div>`;
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Ayuda","Help"))}</h2><p>${esc(t("También puedes escribir tu situación con tus propias palabras.","You can also describe your situation in your own words."))}</p></div></div><div class="card form-card"><div class="assistant"><textarea id="assistantText" maxlength="2000" placeholder="${esc(t("Ej.: quiero enviar $200 a México esta semana...","E.g.: I want to send $200 to Mexico this week..."))}"></textarea><button class="btn" onclick="askAssistant()">${esc(t("Ayúdame","Help me"))}</button><div id="assistantResult"></div></div><div style="margin-top:18px">${topicList}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}
async function askAssistant(){
 const text=$("assistantText")?.value.trim();if(!text)return toast(t("Escribe lo que necesitas.","Describe what you need."));
 $("assistantResult").innerHTML=loading(t("Revisando tu mensaje...","Reviewing your message..."));
 try{const d=await api("/api/assistant",{method:"POST",body:JSON.stringify({text,language:APP.lang})});APP.pendingParsed=d.parsed||{};const canRemit=d.parsed?.need_type==="remittance";$("assistantResult").innerHTML=`<div class="assistant-box" style="margin-top:12px"><strong>${esc(t("Respuesta","Response"))}</strong><div>${esc(d.assistant||"")}</div>${canRemit?`<div class="actions"><button class="btn" onclick="beginParsedRemittance()">${esc(t("Preparar esta remesa","Prepare this remittance"))}</button></div>`:""}</div>`}catch(e){$("assistantResult").innerHTML=errorBox(e.message)}
}
function beginParsedRemittance(){const p=APP.pendingParsed||{};if(!APP.session)startSession().then(()=>renderRemittance(p)).catch(()=>renderRemittance(p));else renderRemittance(p)}
function showHelpTopic(id){
 const topic=getHelpTopics().find(x=>String(x.id)===String(id));if(!topic)return;
 const m=document.createElement("div");m.className="modal-backdrop";m.innerHTML=`<div class="modal"><div class="modal-head"><h2>${esc(topic.title)}</h2><button class="close" onclick="this.closest('.modal-backdrop').remove()">×</button></div><div class="notice info" style="margin-top:15px">${esc(topic.answer)}</div><div class="actions"><button class="btn" onclick="this.closest('.modal-backdrop').remove()">${esc(t("Cerrar","Close"))}</button></div></div>`;document.body.appendChild(m);
}

function snapshotData(){
 return {version:APP.version,created_at:new Date().toISOString(),money:getJSON(APP.keys.money,{}),expenses:getJSON(APP.keys.expenses,[]),family:getJSON(APP.keys.family,[]),savings:getJSON(APP.keys.savings,[]),prefs:getJSON(APP.keys.prefs,{}),lang:APP.lang};
}
function loadScript(src){
 return new Promise((resolve,reject)=>{
  const old=document.querySelector(`script[data-remesas="${src}"]`);if(old)return resolve();
  const s=document.createElement("script");s.src=src;s.async=true;s.dataset.remesas=src;s.onload=resolve;s.onerror=()=>reject(new Error(t("No se pudo cargar el módulo PDF.","Could not load the PDF module.")));document.head.appendChild(s);
 });
}
async function ensurePDF(){
 if(window.jspdf?.jsPDF&&window.pdfjsLib)return true;
 await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
 await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
 if(window.pdfjsLib)window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
 return Boolean(window.jspdf?.jsPDF&&window.pdfjsLib);
}
function b64urlEncode(s){const bytes=new TextEncoder().encode(s);let bin="";bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function b64urlDecode(s){const bin=atob(String(s).replace(/-/g,"+").replace(/_/g,"/")+"===".slice((String(s).length+3)%4));return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function renderPDFModule(){
 render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Mis datos / PDF","My data / PDF"))}</h2><p>${esc(t("Módulo independiente para respaldar o recuperar tus registros locales.","Independent module for backing up or recovering your local records."))}</p></div></div><div class="card form-card"><div class="notice info">${esc(t("El PDF se genera desde los datos guardados en este dispositivo. Puede servir como respaldo o para compartir tus propios registros con un contador. REMESAS no prepara ni presenta impuestos.","The PDF is generated from data stored on this device. It can serve as a backup or to share your own records with an accountant. REMESAS does not prepare or file taxes."))}</div><div class="actions"><button class="btn" onclick="exportPDF()">${esc(t("Crear PDF de mis datos","Create PDF of my data"))}</button><button class="btn secondary" onclick="importPDF()">${esc(t("Importar PDF de recuperación","Import recovery PDF"))}</button><button class="btn secondary" onclick="downloadLearningPDF()">${esc(t("Guía PDF","PDF guide"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div><div class="legal" style="margin-top:15px">${esc(t("El PDF de recuperación contiene información local sin cifrar. Protégelo como protegerías cualquier documento personal.","The recovery PDF contains unencrypted local information. Protect it like any personal document."))}</div></div></section>`);
}
async function exportPDF(){
 try{
  toast(t("Preparando PDF...","Preparing PDF..."));await ensurePDF();
  const {jsPDF}=window.jspdf,doc=new jsPDF(),d=snapshotData(),payload=b64urlEncode(JSON.stringify(d)),expenses=d.expenses||[],family=d.family||[],savings=d.savings||[];
  let y=18;
  const line=(txt,size=10,space=6)=>{doc.setFontSize(size);const lines=doc.splitTextToSize(String(txt),180);if(y+lines.length*space>280){doc.addPage();y=18}doc.text(lines,15,y);y+=lines.length*space};
  doc.setFontSize(18);doc.text("REMESAS",15,y);y+=9;line(t("Respaldo de datos locales","Local data backup"),13,7);line(`${t("Fecha","Date")}: ${new Date().toLocaleString()}`,9,5);y+=3;
  const md=d.money||{};line(`${t("Ingreso","Income")}: ${money(md.income||0)} · ${t("Frecuencia","Frequency")}: ${md.frequency||"monthly"}`,10);line(`${t("Otros ingresos","Other income")}: ${money(md.otherIncome||0)}`,10);line(`${t("Remesa mensual","Monthly remittance")}: ${money(md.remittance||0)}`,10);line(`${t("Gastos esenciales","Essential expenses")}: ${money(md.essential||0)}`,10);line(`${t("Gastos flexibles","Flexible expenses")}: ${money(md.flexible||0)}`,10);line(`${t("Ahorro","Savings")}: ${money(md.savings||0)}`,10);line(`${t("Disponible calculado","Calculated available")}: ${money(calculateLocalAvailable())}`,10);y+=4;
  line(t("GASTOS","EXPENSES"),13,7);if(expenses.length)expenses.forEach(x=>line(`• ${x.description} | ${money(x.amount)} | ${x.category||""} | ${x.frequency||"monthly"}`,9,5));else line(t("Sin gastos registrados.","No expenses recorded."),9,5);y+=4;
  line(t("FAMILIA","FAMILY"),13,7);if(family.length)family.forEach(x=>line(`• ${x.name} | ${x.country||""} | ${money(x.amount||0)}`,9,5));else line(t("Sin referencias familiares.","No family references."),9,5);y+=4;
  line(t("AHORRO REGISTRADO","RECORDED SAVINGS"),13,7);if(savings.length)savings.forEach(x=>line(`• ${money(x.amount)} | ${x.type||"general"}`,9,5));else line(t("Sin registros de ahorro.","No savings records."),9,5);
  line(t("Este documento organiza datos proporcionados por el usuario. REMESAS no es banco, financiera, asesor financiero, procesador de pagos, remesadora ni preparador de impuestos.","This document organizes user-provided data. REMESAS is not a bank, financial institution, financial advisor, payment processor, remittance provider, or tax preparer."),8,5);
  line(`REMESAS_RECOVERY_V1${payload}REMESAS_RECOVERY_END`,3,3);
  doc.save("REMESAS_Recovery.pdf");toast(t("PDF creado.","PDF created."));
 }catch(e){toast(e.message||t("No se pudo crear el PDF.","Could not create the PDF."))}
}
function restoreSnapshot(d){
 if(!d||typeof d!=="object")throw new Error(t("Respaldo inválido.","Invalid backup."));
 if(d.money)setJSON(APP.keys.money,d.money);if(Array.isArray(d.expenses))setJSON(APP.keys.expenses,d.expenses);if(Array.isArray(d.family))setJSON(APP.keys.family,d.family);if(Array.isArray(d.savings))setJSON(APP.keys.savings,d.savings);if(d.prefs)setJSON(APP.keys.prefs,d.prefs);
 if(d.lang==="es"||d.lang==="en"){APP.lang=d.lang;localStorage.setItem(APP.keys.lang,d.lang);localStorage.setItem("remesas_lang",d.lang)}
 APP.comparison=null;APP.pendingParsed=null;renderHome();toast(t("Datos recuperados en este dispositivo.","Data restored on this device."));
}
async function importPDF(){
 const input=document.createElement("input");input.type="file";input.accept="application/pdf";
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;
  try{
   await ensurePDF();const buf=await file.arrayBuffer(),pdf=await window.pdfjsLib.getDocument({data:buf}).promise;let text="";
   for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),c=await page.getTextContent();text+=c.items.map(x=>x.str).join("")+"\n"}
   const a=text.indexOf("REMESAS_RECOVERY_V1"),b=text.indexOf("REMESAS_RECOVERY_END");
   if(a<0||b<a)throw new Error(t("Este PDF no contiene un respaldo válido de REMESAS.","This PDF does not contain a valid REMESAS backup."));
   const payload=text.slice(a+"REMESAS_RECOVERY_V1".length,b),data=JSON.parse(b64urlDecode(payload));restoreSnapshot(data);
  }catch(e){toast(e.message||t("No se pudo importar el PDF.","Could not import the PDF."))}
 };
 input.click();
}
async function downloadLearningPDF(){
 try{
  await ensurePDF();const {jsPDF}=window.jspdf,doc=new jsPDF(),lines=[
   "REMESAS","GUÍA RÁPIDA","",
   t("1. Organiza tus ingresos, gastos y ahorro.","1. Organize income, expenses and savings."),
   t("2. Define cuánto quieres enviar y a qué país.","2. Define how much you want to send and the destination country."),
   t("3. Revisa las opciones disponibles.","3. Review available options."),
   t("4. Confirma las condiciones directamente con el proveedor oficial.","4. Confirm conditions directly with the official provider."),
   t("5. REMESAS no recibe ni transmite fondos.","5. REMESAS does not receive or transmit funds."),
   t("6. Nunca introduzcas contraseñas, CVV, PIN o credenciales bancarias.","6. Never enter passwords, CVV, PINs or bank credentials."),
   t("7. Las tarifas, tasas, tiempos y disponibilidad pueden cambiar.","7. Fees, rates, delivery times and availability can change."),
   t("8. El PDF de datos organiza tus propios registros y no prepara impuestos.","8. The data PDF organizes your own records and does not prepare taxes.")
  ];
  let y=18;doc.setFontSize(18);doc.text("REMESAS",15,y);y+=10;doc.setFontSize(12);for(const x of lines.slice(1)){const ls=doc.splitTextToSize(x,178);if(y+ls.length*7>280){doc.addPage();y=18}doc.text(ls,15,y);y+=ls.length*7+3}doc.save("REMESAS_Guia_Rapida.pdf");toast(t("Guía PDF creada.","PDF guide created."));
 }catch(e){toast(e.message||t("No se pudo crear la guía.","Could not create the guide."))}
}

async function deleteLocalData(){
 const ok=confirm(t("Esto borrará los registros locales de REMESAS de este dispositivo. ¿Continuar?","This will delete REMESAS local records from this device. Continue?"));if(!ok)return;
 Object.values(APP.keys).forEach(k=>localStorage.removeItem(k));localStorage.removeItem("remesas_lang");APP.session=null;APP.comparison=null;APP.pendingParsed=null;
 if(APP.accessToken&&!APP.adminMode)try{await api("/api/service/start",{method:"DELETE"})}catch{}
 toast(t("Datos locales borrados.","Local data deleted."));setTimeout(()=>location.reload(),500);
}

async function boot(){
 try{
  const paid=await checkAccess();
  if(!paid){if(introWindow())return;renderAccess();return}
  await paymentCheck();if(!accessValid()&&!APP.adminMode){if(introWindow())return;renderAccess();return}
  await enterApp();
 }catch(e){
  if(!accessValid()&&!APP.adminMode){renderAccess();return}
  const a=$("app");if(a)a.innerHTML=`<div class="app-shell"><section class="section"><div class="card">${errorBox(t("No se pudo cargar REMESAS. Revisa el servidor y los archivos JSON.","REMESAS could not be loaded. Check the server and JSON files."))}<div class="legal" style="margin-top:10px">${esc(e.message)}</div><div class="actions"><button class="btn" onclick="location.reload()">${esc(t("Intentar nuevamente","Try again"))}</button></div></div></section></div>`;
 }
}

window.renderHome=renderHome;
window.renderRemittance=renderRemittance;
window.compareRemittance=compareRemittance;
window.renderComparison=renderComparison;
window.selectProvider=selectProvider;
window.finalCheck=finalCheck;
window.openOfficial=openOfficial;
window.changeLanguage=changeLanguage;
window.renderMoney=renderMoney;
window.calculateMoney=calculateMoney;
window.renderWeek=renderWeek;
window.renderExpenses=renderExpenses;
window.addExpense=addExpense;
window.deleteExpense=deleteExpense;
window.renderFamily=renderFamily;
window.addFamily=addFamily;
window.deleteFamily=deleteFamily;
window.renderSavings=renderSavings;
window.addSavings=addSavings;
window.deleteSavings=deleteSavings;
window.renderPurchase=renderPurchase;
window.calculatePurchase=calculatePurchase;
window.renderHelp=renderHelp;
window.askAssistant=askAssistant;
window.beginParsedRemittance=beginParsedRemittance;
window.showHelpTopic=showHelpTopic;
window.deleteLocalData=deleteLocalData;
window.renderPDFModule=renderPDFModule;
window.exportPDF=exportPDF;
window.importPDF=importPDF;
window.downloadLearningPDF=downloadLearningPDF;
window.startPayment=startPayment;
window.paymentCheck=paymentCheck;
window.renderAccess=renderAccess;
window.renderAdminLogin=renderAdminLogin;
window.adminLogin=adminLogin;
window.nextIntro=nextIntro;
window.prevIntro=prevIntro;

document.addEventListener("DOMContentLoaded",boot);
