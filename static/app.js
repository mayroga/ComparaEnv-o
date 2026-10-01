"use strict";
const APP={name:"REMESAS",version:"4.2.1",lang:localStorage.getItem("remesas_lang_v4")||"es",session:null,sessionId:null,config:null,accessToken:sessionStorage.getItem("remesas_access_token_v4")||"",accessUntil:Number(sessionStorage.getItem("remesas_access_until_v4")||0),adminMode:sessionStorage.getItem("remesas_admin_v4")==="1",moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",prefsKey:"remesas_prefs_v4",tripleTaps:0,lastTap:0,tapTimer:null};
const app=document.getElementById("app");

function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function t(es,en){return APP.lang==="en"?en:es}
function money(v){const n=Number(v||0);return new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD"}).format(n)}
function getJSON(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function accessIsActive(){return !!APP.accessToken&&APP.accessUntil>Date.now()}
function saveAccess(token,until,admin=false){APP.accessToken=token||("access-"+Date.now());APP.accessUntil=Number(until||Date.now()+1200000);APP.adminMode=!!admin;sessionStorage.setItem("remesas_access_token_v4",APP.accessToken);sessionStorage.setItem("remesas_access_until_v4",String(APP.accessUntil));sessionStorage.setItem("remesas_admin_v4",admin?"1":"0")}
function clearAccess(){APP.accessToken="";APP.accessUntil=0;APP.adminMode=false;APP.session=null;APP.sessionId=null;sessionStorage.removeItem("remesas_access_token_v4");sessionStorage.removeItem("remesas_access_until_v4");sessionStorage.removeItem("remesas_admin_v4")}
function accessHeaders(){return APP.accessToken?{"Authorization":"Bearer "+APP.accessToken,"X-Remesas-Access-Token":APP.accessToken,"X-Access-Token":APP.accessToken}:{}}

async function api(url,options={}){
 const skip=!!options.skipAccess,o={...options,headers:{...(options.headers||{}),...accessHeaders()}};
 delete o.skipAccess;
 if(skip){delete o.headers.Authorization;delete o.headers["X-Remesas-Access-Token"];delete o.headers["X-Access-Token"]}
 else if(!accessIsActive())throw new Error(t("Acceso requerido.","Access required."));
 const r=await fetch(url,o);let d=null;
 try{d=await r.json()}catch{}
 if(!r.ok){if(r.status===401&&!skip)clearAccess();const e=new Error(d?.detail||d?.message||t("No se pudo completar la operación.","The operation could not be completed."));e.status=r.status;e.data=d;throw e}
 return d
}

async function accessStatus(){
 if(!APP.accessToken)return false;
 try{
  const r=await fetch("/api/access/status",{headers:accessHeaders()});
  if(!r.ok){clearAccess();return false}
  const d=await r.json();
  if(d?.active===false){clearAccess();return false}
  const raw=d?.access_until??d?.expires_at;
  if(raw){APP.accessUntil=Number(raw)>1e12?Number(raw):Number(raw)*1000;sessionStorage.setItem("remesas_access_until_v4",String(APP.accessUntil))}
  if(d?.subject==="admin")APP.adminMode=true;
 }catch{}
 return accessIsActive()
}

function setupTripleTap(){
 document.addEventListener("pointerup",e=>{
  if(e.button!==0||accessIsActive())return;
  const now=Date.now();
  if(now-APP.lastTap>900)APP.tripleTaps=0;
  APP.lastTap=now;APP.tripleTaps++;
  clearTimeout(APP.tapTimer);
  APP.tapTimer=setTimeout(()=>APP.tripleTaps=0,1000);
  if(APP.tripleTaps>=3){APP.tripleTaps=0;showAdminLogin()}
 },true)
}

async function ensureAccess(){
 if(await accessStatus())return true;
 showAccessGate();return false
}

function legalShort(){return `<small class="legal">${t("REMESAS es una herramienta independiente de organización y comparación. No es banco, financiera, asesor financiero, procesador de pagos ni proveedor de remesas.","REMESAS is an independent organization and comparison tool. It is not a bank, financial institution, financial advisor, payment processor, or remittance provider.")}</small>`}
function privacyNotice(){return `<details><summary>🔒 ${t("Privacidad","Privacy")}</summary><p>${t("La información personal que introduces para organizar tus datos se mantiene en tu dispositivo mediante almacenamiento local, salvo las solicitudes necesarias para prestar funciones del servicio.","Personal information you enter to organize your data is kept on your device through local storage, except for requests necessary to provide service functions.")}</p></details>`}
function commercialNotice(){return `<div class="notice">ℹ️ ${t("Las tarifas, tipos de cambio, tiempos y disponibilidad comerciales solo se muestran cuando existen datos verificables. REMESAS no inventa esos datos.","Fees, exchange rates, delivery times and commercial availability are shown only when verified data exists. REMESAS does not invent them.")}</div>`}

function accessGateHTML(){
 const price=Number(APP.config?.stripe?.price||10.99).toFixed(2),currency=APP.config?.stripe?.currency||"USD";
 return `<section class="panel access-gate"><div class="hero-icon">💸</div><h1>REMESAS</h1><h2>${t("Organiza tu dinero. Prepara tu remesa.","Organize your money. Prepare your remittance.")}</h2><p>${t("REMESAS te ayuda a entender cuánto puedes enviar, organizar tus datos, aprender el proceso y revisar opciones oficiales sin recibir ni mover tu dinero.","REMESAS helps you understand what you can send, organize your data, learn the process and review official options without receiving or moving your money.")}</p><div class="access-box"><strong>${esc(currency)} $${esc(price)}</strong><span>${t("Pago único · acceso durante 20 minutos","One-time payment · 20 minutes of access")}</span><button class="primary" onclick="createCheckout()">${t("Pagar y entrar","Pay and enter")}</button></div><div class="admin-hint"><b>${t("Acceso administrador","Administrator access")}</b><p>${t("Tres toques rápidos en cualquier parte de esta pantalla abren el acceso de administrador.","Three quick taps anywhere on this screen open administrator access.")}</p></div>${legalShort()}</section>`
}
function showAccessGate(){if(!app)return;app.innerHTML=accessGateHTML()}
function showAdminLogin(){
 if(accessIsActive())return;
 document.getElementById("admin-modal")?.remove();
 const d=document.createElement("div");d.id="admin-modal";d.className="modal";
 d.innerHTML=`<div class="modal-box"><button class="close" onclick="closeAdminLogin()">×</button><h2>🔐 ${t("Administrador","Administrator")}</h2><input id="admin-user" autocomplete="username" placeholder="${t("Usuario","Username")}"><input id="admin-pass" type="password" autocomplete="current-password" placeholder="${t("Contraseña","Password")}"><button class="primary" onclick="loginAdmin()">${t("Entrar","Login")}</button><button class="secondary" onclick="closeAdminLogin()">${t("Cancelar","Cancel")}</button><div id="admin-msg"></div></div>`;
 document.body.appendChild(d);setTimeout(()=>document.getElementById("admin-user")?.focus(),50)
}
function closeAdminLogin(){document.getElementById("admin-modal")?.remove()}

async function loginAdmin(){
 const user=document.getElementById("admin-user")?.value.trim(),pass=document.getElementById("admin-pass")?.value||"",msg=document.getElementById("admin-msg");
 if(!user||!pass){if(msg)msg.textContent=t("Introduce usuario y contraseña.","Enter username and password.");return}
 if(msg)msg.textContent=t("Verificando...","Verifying...");
 let data=null,lastError=null;
 for(const url of ["/api/access/admin","/api/login-admin","/api/admin/login"]){
  try{
   const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:user,password:pass})});
   let d=null;try{d=await r.json()}catch{}
   if(r.ok&&(d?.token||d?.access_token||d?.session_token||d?.authorized||d?.success)){data=d;break}
   lastError=d?.detail||d?.message||t("Credenciales no válidas.","Invalid credentials.")
  }catch(e){lastError=e.message}
 }
 if(!data){if(msg)msg.textContent=lastError||t("No fue posible iniciar sesión.","Could not log in.");return}
 const token=data.token||data.access_token||data.session_token||"admin-"+Date.now(),raw=data.expires_at??data.access_until,until=raw?(Number(raw)>1e12?Number(raw):Number(raw)*1000):Date.now()+1200000;
 saveAccess(token,until,true);closeAdminLogin();await enterAfterAccess()
}

async function enterAfterAccess(){await loadConfig();await startSession(true);renderHome()}

function topbar(){return `<header class="topbar"><button onclick="renderHome()">💸 REMESAS</button><div><button onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button><button onclick="showAccessGate()">🔐</button></div></header>`}
function renderShell(title,body){app.innerHTML=topbar()+`<main><div class="page-head"><button class="back" onclick="renderHome()">←</button><h1>${esc(title)}</h1></div>${body}</main>`}

async function renderHome(){
 if(!(await ensureAccess()))return;
 app.innerHTML=topbar()+`<main><section class="welcome"><h1>${t("¿Qué necesitas resolver hoy?","What do you need to solve today?")}</h1><p>${t("Elige una opción. REMESAS te lleva al siguiente paso.","Choose an option. REMESAS takes you to the next step.")}</p></section><div class="grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa opciones.","Prepare a remittance and review options."),"renderRemittance()")}${homeCard("📚",t("APRENDER","LEARN"),t("Entiende el proceso antes de hacerlo.","Understand the process before doing it."),"renderLearning()")}${homeCard("💰",t("Mi dinero","My money"),t("Calcula cuánto tienes disponible.","Calculate how much you have available."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Mira ingresos, gastos y capacidad disponible.","See income, expenses and available capacity."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Registra tus gastos para tenerlos organizados.","Record expenses to keep them organized."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Organiza cuánto necesita cada persona.","Organize how much each person needs."),"renderFamily()")}${homeCard("❓",t("No entiendo","I don't understand"),t("Escribe lo que necesitas y te llevo al siguiente paso.","Write what you need and I'll take you to the next step."),"renderHelp()")}${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Comprueba si una compra cabe en tu dinero.","Check whether a purchase fits your money."),"renderPurchase()")}${homeCard("🏦",t("Ahorrar","Save"),t("Calcula una meta de ahorro.","Calculate a savings goal."),"renderSavings()")}</div><section class="panel"><label>${t("¿Qué necesitas?","What do you need?")}</label><textarea id="freeNeed" placeholder="${t("Ej.: necesito enviar $300 a México esta semana","Example: I need to send $300 to Mexico this week")}"></textarea><button class="primary" onclick="understandNeed()">${t("Ayúdame","Help me")}</button></section>${privacyNotice()}<details><summary>ℹ️ ${t("Acerca de REMESAS","About REMESAS")}</summary><p>${t("Creada por May Roga LLC como herramienta independiente para ayudar a organizar dinero, preparar remesas y comprender el proceso.","Created by May Roga LLC as an independent tool to help organize money, prepare remittances and understand the process.")}</p></details><button class="danger" onclick="deleteLocalData()">${t("Eliminar mis datos locales","Delete my local data")}</button>${legalShort()}</main>`
}
function homeCard(icon,title,text,action){return `<button class="home-card" onclick="${action}"><span>${icon}</span><b>${esc(title)}</b><small>${esc(text)}</small></button>`}

async function loadConfig(){
 try{const r=await fetch(`/api/config?language=${encodeURIComponent(APP.lang)}`);if(!r.ok)throw 0;APP.config=await r.json()}
 catch{APP.config={stripe:{price:10.99,currency:"USD"},countries:[],delivery_methods:[],payment_methods:[],providers:[]}}
}

async function startSession(preserve=true){
 if(!accessIsActive())return null;
 if(preserve&&APP.sessionId&&APP.session)return APP.session;
 try{
  const d=await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language:APP.lang})});
  const s=d?.session||d;
  APP.session=s;APP.sessionId=s?.session_id||s?.id||d?.session_id||null;
  return s
 }catch(e){APP.session=null;APP.sessionId=null;return null}
}

async function changeLanguage(){
 APP.lang=APP.lang==="es"?"en":"es";localStorage.setItem("remesas_lang_v4",APP.lang);await loadConfig();if(accessIsActive())await startSession(false);renderHome()
}

function countryCode(v){if(!v)return"";if(typeof v==="string")return v.toLowerCase().replace(/[^a-z]/g,"").slice(0,3);return v.code||v.id||""}
function countryName(v){if(typeof v==="string")return v;return v?.name||v?.label||v?.country||v?.code||""}
function priorityLabel(v){return({cost:t("Costo","Cost"),speed:t("Rapidez","Speed"),balance:t("Equilibrio","Balance"),convenience:t("Facilidad","Convenience")}[v]||v||"")}
function frequencyLabel(v){return({once:t("Una vez","Once"),weekly:t("Semanal","Weekly"),monthly:t("Mensual","Monthly"),other:t("Otra frecuencia","Other frequency")}[v]||v||"")}
function methodLabel(v){return({bank:t("Cuenta bancaria","Bank account"),cash:t("Recogida en efectivo","Cash pickup"),wallet:t("Billetera móvil","Mobile wallet")}[v]||v||"")}
function safeInlineString(v){return JSON.stringify(String(v??"")).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/</g,"\\u003c").replace(/>/g,"\\u003e")}

async function understandNeed(){
 const el=document.getElementById("freeNeed"),text=el?.value.trim();
 if(!text){showError(t("Escribe primero lo que necesitas.","Write what you need first."));return}
 if(!(await ensureAccess()))return;
 try{
  const data=await api("/api/need/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,language:APP.lang})});
  if(data?.intent==="remittance"||data?.is_remittance||data?.amount||data?.destination||data?.country)return beginParsedRemittance(data);
  renderShell(t("Siguiente paso","Next step"),`<section class="panel"><h2>${t("Entendí tu necesidad","I understood your need")}</h2><p>${esc(data?.message||data?.next_step||t("Necesitamos algunos datos más.","We need a few more details."))}</p><button class="primary" onclick="renderRemittance()">${t("Continuar","Continue")}</button></section>`)
 }catch{renderRemittance({raw_need:text})}
}
async function beginParsedRemittance(parsed){if(!(await ensureAccess()))return;await startSession(true);renderRemittance(parsed||{})}

function renderRemittance(parsed={}){
 if(!accessIsActive()){showAccessGate();return}
 const countries=APP.config?.countries||[],deliveries=APP.config?.delivery_methods||[],payments=APP.config?.payment_methods||[];
 renderShell(t("Enviar dinero","Send money"),`<section class="panel"><p>${t("Solo preguntamos lo necesario para comparar opciones.","We only ask what is needed to compare options.")}</p><label>${t("¿Cuánto quieres enviar?","How much do you want to send?")}</label><input id="remAmount" type="number" min="0" step="0.01" value="${esc(parsed.amount??"")}" oninput="updateMoneyWarning()"><label>${t("¿A qué país?","Which country?")}</label><select id="remCountry"><option value="">${t("Selecciona","Select")}</option>${countries.map(c=>{const code=countryCode(c),name=countryName(c),sel=String(parsed.destination||parsed.country||"").toLowerCase()===String(code).toLowerCase()?"selected":"";return `<option value="${esc(code)}" ${sel}>${esc(name)}</option>`}).join("")}</select><label>${t("¿Qué importa más?","What matters most?")}</label><select id="remPriority"><option value="balance">${t("Equilibrio","Balance")}</option><option value="cost">${t("Costo","Cost")}</option><option value="speed">${t("Rapidez","Speed")}</option><option value="convenience">${t("Facilidad","Convenience")}</option></select><label>${t("¿Cuándo necesitas que llegue?","When do you need it delivered?")}</label><select id="remUrgency"><option value="today">${t("Lo antes posible","As soon as possible")}</option><option value="days">${t("En unos días","Within a few days")}</option><option value="flexible">${t("Puedo esperar","I can wait")}</option></select><label>${t("¿Con qué frecuencia?","How often?")}</label><select id="remFrequency"><option value="once">${t("Una vez","Once")}</option><option value="weekly">${t("Semanal","Weekly")}</option><option value="monthly">${t("Mensual","Monthly")}</option><option value="other">${t("Otra","Other")}</option></select><label>${t("¿Cómo recibirá el dinero?","How will the recipient receive it?")}</label><select id="remDelivery"><option value="">${t("Selecciona","Select")}</option>${deliveries.map(v=>{const x=typeof v==="string"?{id:v,name:v}:v,id=x.id||x.code||x.value,name=x.name||x.label||id;return `<option value="${esc(id)}">${esc(name)}</option>`}).join("")}</select><label>${t("¿Cómo pagarás la remesa?","How will you pay for the remittance?")}</label><select id="remPayment"><option value="">${t("Selecciona","Select")}</option>${payments.map(v=>{const x=typeof v==="string"?{id:v,name:v}:v,id=x.id||x.code||x.value,name=x.name||x.label||id;return `<option value="${esc(id)}">${esc(name)}</option>`}).join("")}</select><div id="moneyWarning"></div><button class="primary" onclick="compare()">${t("Comparar opciones","Compare options")}</button></section>${commercialNotice()}${legalShort()}`)
}

function getMoneyState(){const d=getJSON(APP.moneyKey,{income:0,available:0,period:"weekly"});return{income:Number(d.income||0),available:Number(d.available??d.income??0),period:d.period||"weekly"}}

function updateMoneyWarning(){
 const el=document.getElementById("moneyWarning");if(!el)return;
 const amount=Number(document.getElementById("remAmount")?.value||0),m=getMoneyState();
 el.innerHTML=amount>m.available?`<div class="warning">⚠️ ${t("La cantidad supera el dinero disponible que tienes registrado.","The amount exceeds the available money you have recorded.")}</div>`:amount>10000?`<div class="warning">⚠️ ${t("Verifica cuidadosamente los requisitos y límites aplicables antes de continuar.","Carefully verify applicable requirements and limits before continuing.")}</div>`:""
}

async function compare(){
 const amount=Number(document.getElementById("remAmount")?.value||0),country=document.getElementById("remCountry")?.value||"",priority=document.getElementById("remPriority")?.value||"balance",urgency=document.getElementById("remUrgency")?.value||"today",frequency=document.getElementById("remFrequency")?.value||"once",delivery=document.getElementById("remDelivery")?.value||"",payment=document.getElementById("remPayment")?.value||"";
 if(!amount||amount<=0){showError(t("Introduce una cantidad válida.","Enter a valid amount."));return}
 if(!country){showError(t("Selecciona el país de destino.","Select the destination country."));return}
 if(!(await ensureAccess()))return;
 renderLoading();
 try{
  if(!APP.sessionId)await startSession(true);
  if(!APP.sessionId)throw new Error(t("No se pudo iniciar la sesión.","The session could not be started."));
  const need={amount,country,destination:country,priority,urgency,frequency,delivery_method:delivery,payment_method:payment};
  await api("/api/need",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(need)});
  let data;
  try{data=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/compare`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(need)})}
  catch{data=await api("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(need)})}
  APP.session={...APP.session,...data,need,available_providers:data?.available_providers||data?.providers||APP.config?.providers||[],verified_results:data?.verified_results||data?.results||[],comparison:data?.comparison||data};
  renderComparison(APP.session)
 }catch(e){showError(e.message||t("No se pudo comparar.","Could not compare."))}
}

function renderLoading(){renderShell(t("Comparando","Comparing"),`<section class="panel loading"><div>⏳</div><h2>${t("Estamos verificando las opciones...","We are verifying the options...")}</h2><p>${t("Los datos comerciales no se inventan.","Commercial data is not invented.")}</p></section>`)}

function providerStatus(p,r){if(r?.verified===true||r?.status==="verified"||p?.verified===true)return"verified";return"unverified"}
function providerMethodsLabel(p,type){const m=p?.[type]||p?.methods?.[type]||[];return Array.isArray(m)?m.map(x=>typeof x==="string"?x:x?.name||x?.id).filter(Boolean).join(", "):String(m||"")}

function providerCard(provider){
 const id=provider?.id||provider?.code||"",result=(APP.session?.verified_results||[]).find(x=>(x?.provider_id||x?.provider||x?.id)===id)||{},status=providerStatus(provider,result),name=provider?.name||id,url=provider?.official_site||provider?.official_url||provider?.url||result?.official_url||"",fee=result?.fee??result?.fees,rate=result?.exchange_rate??result?.rate,recipient=result?.recipient_amount??result?.receive_amount,delivery=result?.delivery_time??result?.delivery,sendMethods=providerMethodsLabel(provider,"send_methods"),receiveMethods=providerMethodsLabel(provider,"receive_methods");
 return `<article class="provider-card"><div class="provider-head"><h3>${esc(name)}</h3><span class="${status}">${status==="verified"?t("Verificado","Verified"):t("Datos comerciales no verificados","Commercial data not verified")}</span></div>${status==="verified"?`<div class="provider-data">${fee!=null?`<div><small>${t("Tarifa","Fee")}</small><b>${esc(fee)}</b></div>`:""}${rate!=null?`<div><small>${t("Tipo de cambio","Exchange rate")}</small><b>${esc(rate)}</b></div>`:""}${recipient!=null?`<div><small>${t("Recibe","Recipient gets")}</small><b>${esc(recipient)}</b></div>`:""}${delivery!=null?`<div><small>${t("Entrega","Delivery")}</small><b>${esc(delivery)}</b></div>`:""}</div>`:`<p>${t("No mostramos tarifas, tipos de cambio, tiempos ni disponibilidad actuales porque no están verificados.","We do not show current fees, exchange rates, delivery times or availability because they are not verified.")}</p>`}${sendMethods?`<p><b>${t("Envío:","Send:")}</b> ${esc(sendMethods)}</p>`:""}${receiveMethods?`<p><b>${t("Recepción:","Receive:")}</b> ${esc(receiveMethods)}</p>`:""}${url&&String(url).startsWith("https://")?`<button class="primary" onclick='selectProvider(${safeInlineString(id)})'>${t("Continuar con esta opción","Continue with this option")}</button>`:""}</article>`
}

function renderComparison(data){
 const results=data?.verified_results||data?.results||[],providers=data?.available_providers||data?.providers||APP.config?.providers||[],verifiedCount=Number(data?.verified_count??results.length);
 renderShell(t("Opciones","Options"),`<section class="panel"><h2>${t("Encontramos opciones para revisar","We found options to review")}</h2><p>${t("Datos comerciales verificados disponibles:","Verified commercial data available:")} <b>${verifiedCount}</b></p></section><div class="providers">${providers.map(p=>providerCard(p)).join("")}</div>${commercialNotice()}<button class="secondary" onclick="renderComparisonFromSession()">${t("Volver a revisar","Review again")}</button>${legalShort()}`)
}

async function selectProvider(providerId){
 try{
  if(!APP.sessionId)throw new Error(t("La sesión no está disponible.","The session is unavailable."));
  renderLoading();
  let data;
  try{data=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/select/${encodeURIComponent(providerId)}`,{method:"POST",headers:{"Content-Type":"application/json"}})}
  catch{data=await api("/api/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:APP.sessionId,provider_id:providerId})})}
  APP.session={...APP.session,...data,selected_provider:data?.provider||data?.selected_provider||providerId};renderFinalCheck()
 }catch(e){showError(e.message||t("No se pudo seleccionar la opción.","Could not select the option."))}
}

function renderFinalCheck(){
 const p=APP.session?.selected_provider||APP.session?.provider||"",need=APP.session?.need||{};
 renderShell(t("Revisión final","Final review"),`<section class="panel"><h2>🔎 ${t("Antes de salir","Before you leave")}</h2><p>${t("Revisa tus datos antes de ir al sitio oficial.","Review your details before going to the official site.")}</p><div class="summary"><p><b>${t("Proveedor","Provider")}:</b> ${esc(typeof p==="string"?p:p?.name||p?.id||"")}</p><p><b>${t("Cantidad","Amount")}:</b> ${money(need.amount)}</p><p><b>${t("Destino","Destination")}:</b> ${esc(countryName(need.country||need.destination))}</p><p><b>${t("Prioridad","Priority")}:</b> ${esc(priorityLabel(need.priority))}</p><p><b>${t("Recepción","Delivery")}:</b> ${esc(methodLabel(need.delivery_method))}</p></div><button class="primary" onclick="renderFinalResult(APP.session)">${t("Confirmar revisión","Confirm review")}</button></section>`)
}

function renderFinalResult(data){
 const checks=data?.checks||data?.requirements||[],need=data?.need||APP.session?.need||{},provider=data?.selected_provider||data?.provider||{},url=provider?.official_site||provider?.official_url||data?.official_url||"";
 renderShell(t("Resultado","Result"),`<section class="panel"><h2>✅ ${t("Listo para continuar","Ready to continue")}</h2><div class="summary"><p><b>${t("Cantidad","Amount")}:</b> ${money(need.amount)}</p><p><b>${t("Destino","Destination")}:</b> ${esc(countryName(need.country||need.destination))}</p><p><b>${t("Proveedor","Provider")}:</b> ${esc(typeof provider==="string"?provider:provider?.name||provider?.id||"")}</p></div>${Array.isArray(checks)&&checks.length?`<h3>${t("Revisa estos puntos","Review these items")}</h3><ul>${checks.map(x=>`<li>${esc(typeof x==="string"?x:x?.label||x?.text||x?.name||"")}</li>`).join("")}</ul>`:""}<div class="warning">⚠️ ${t("REMESAS no recibe tu dinero ni completa el pago. Verifica toda la información directamente en el sitio oficial.","REMESAS does not receive your money or complete the payment. Verify all information directly on the official site.")}</div>${url&&String(url).startsWith("https://")?`<button class="primary" onclick='openOfficial(${safeInlineString(url)})'>${t("Abrir sitio oficial","Open official site")}</button>`:""}<button class="secondary" onclick="renderComparisonFromSession()">${t("Ver otras opciones","View other options")}</button></section>${legalShort()}`)
}

function openOfficial(url){if(typeof url!=="string"||!url.startsWith("https://"))return;window.open(url,"_blank","noopener,noreferrer")}
function renderComparisonFromSession(){if(!APP.session){renderRemittance();return}renderComparison(APP.session)}

function renderMoney(){
 const m=getMoneyState();
 renderShell(t("Mi dinero","My money"),`<section class="panel"><p>${t("Registra una cantidad aproximada para saber cuánto tienes disponible.","Record an approximate amount to see how much you have available.")}</p><label>${t("Ingresos del período","Income for the period")}</label><input id="moneyIncome" type="number" min="0" step="0.01" value="${m.income}"><label>${t("Dinero disponible","Available money")}</label><input id="moneyAvailable" type="number" min="0" step="0.01" value="${m.available}"><label>${t("Período","Period")}</label><select id="moneyPeriod"><option value="weekly">${t("Semanal","Weekly")}</option><option value="monthly">${t("Mensual","Monthly")}</option></select><button class="primary" onclick="calculateMoney()">${t("Calcular","Calculate")}</button></section>`)
}
function frequencyFactor(f){return f==="monthly"?12:f==="weekly"?52:f==="daily"?365:1}
function calculateMoney(){const income=Number(document.getElementById("moneyIncome")?.value||0),available=Number(document.getElementById("moneyAvailable")?.value||0),period=document.getElementById("moneyPeriod")?.value||"weekly";setJSON(APP.moneyKey,{income,available,period});showMoneyResult({income,available,period})}
function showMoneyResult(d){renderShell(t("Mi dinero","My money"),`<section class="panel result"><h2>💰 ${t("Tu resumen","Your summary")}</h2><div class="big-number">${money(d.available)}</div><p>${t("Dinero disponible registrado.","Recorded available money.")}</p><p>${t("Ingresos del período:","Period income:")} <b>${money(d.income)}</b></p><button class="primary" onclick="renderRemittance()">${t("Usar para una remesa","Use for a remittance")}</button><button class="secondary" onclick="renderExpenses()">${t("Revisar gastos","Review expenses")}</button></section>`)}

function renderWeek(){
 const m=getMoneyState(),expenses=getExpenses(),total=expenses.reduce((a,x)=>a+Number(x.amount||0),0),available=Math.max(0,m.available-total);
 renderShell(t("Mi semana","My week"),`<section class="panel"><h2>📅 ${t("Resumen","Summary")}</h2><div class="summary"><p>${t("Ingresos:","Income:")} <b>${money(m.income)}</b></p><p>${t("Gastos registrados:","Recorded expenses:")} <b>${money(total)}</b></p><p>${t("Disponible estimado:","Estimated available:")} <b>${money(available)}</b></p></div><button class="primary" onclick="renderExpenses()">${t("Organizar gastos","Organize expenses")}</button><button class="secondary" onclick="renderRemittance()">${t("Planear remesa","Plan remittance")}</button></section>`)
}
function getExpenses(){return getJSON(APP.expensesKey,[])}
function saveExpenses(v){setJSON(APP.expensesKey,v)}
function renderExpenses(){const items=getExpenses();renderShell(t("Mis gastos","My expenses"),`<section class="panel"><div id="expenseRows">${items.map(expenseRow).join("")}</div><button class="secondary" onclick="addExpense()">${t("+ Añadir gasto","+ Add expense")}</button><button class="primary" onclick="renderWeek()">${t("Ver mi semana","View my week")}</button></section>`)}
function expenseRow(item,i){return `<div class="expense-row"><input id="expense-name-${i}" value="${esc(item.name||"")}" placeholder="${t("Gasto","Expense")}"><input id="expense-amount-${i}" type="number" min="0" step="0.01" value="${Number(item.amount||0)}" placeholder="0.00"><button onclick="removeExpense(${i})">×</button></div>`}
function addExpense(){const x=getExpenses();x.push({name:"",amount:0});saveExpenses(x);renderExpenses()}
function removeExpense(i){const x=getExpenses(),u=x.filter((_,n)=>n!==i);for(let n=0;n<u.length;n++){const a=document.getElementById(`expense-name-${n}`),b=document.getElementById(`expense-amount-${n}`);if(a)u[n].name=a.value;if(b)u[n].amount=Number(b.value||0)}saveExpenses(u);renderExpenses()}

function renderFamily(){
 const f=getJSON(APP.familyKey,[]);
 renderShell(t("Familia","Family"),`<section class="panel"><p>${t("Organiza necesidades familiares sin enviar estos datos a REMESAS.","Organize family needs without sending this information to REMESAS.")}</p><div id="familyRows">${f.map((x,i)=>`<div class="family-row"><input id="family-name-${i}" value="${esc(x.name||"")}" placeholder="${t("Nombre","Name")}"><input id="family-amount-${i}" type="number" min="0" step="0.01" value="${Number(x.amount||0)}" placeholder="${t("Cantidad","Amount")}"></div>`).join("")}</div><button class="secondary" onclick="saveFamily()">${t("Guardar familia","Save family")}</button><button class="primary" onclick="renderRemittance()">${t("Planear remesa","Plan remittance")}</button></section>`)
}
function saveFamily(){const f=getJSON(APP.familyKey,[]);for(let i=0;i<f.length;i++){f[i].name=document.getElementById(`family-name-${i}`)?.value||"";f[i].amount=Number(document.getElementById(`family-amount-${i}`)?.value||0)}if(!f.length)f.push({name:"",amount:0});setJSON(APP.familyKey,f);renderFamily()}

function renderSavings(){
 const p=getJSON(APP.prefsKey,{}),goal=Number(p.savings_goal||0),current=Number(p.savings_current||0),period=Number(p.savings_period||0);
 renderShell(t("Ahorrar","Save"),`<section class="panel"><label>${t("Meta","Goal")}</label><input id="saveGoal" type="number" min="0" step="0.01" value="${goal}"><label>${t("Ya tengo","I have")}</label><input id="saveCurrent" type="number" min="0" step="0.01" value="${current}"><label>${t("Períodos disponibles","Available periods")}</label><input id="savePeriod" type="number" min="1" step="1" value="${period||1}"><button class="primary" onclick="saveSavings()">${t("Calcular ahorro","Calculate savings")}</button></section>`)
}
function saveSavings(){const goal=Number(document.getElementById("saveGoal")?.value||0),current=Number(document.getElementById("saveCurrent")?.value||0),period=Math.max(1,Number(document.getElementById("savePeriod")?.value||1)),needed=Math.max(0,goal-current),per=needed/period;setJSON(APP.prefsKey,{...getJSON(APP.prefsKey,{}),savings_goal:goal,savings_current:current,savings_period:period});renderShell(t("Ahorrar","Save"),`<section class="panel result"><h2>🏦 ${t("Tu meta","Your goal")}</h2><div class="big-number">${money(per)}</div><p>${t("Necesitarías guardar aproximadamente por período.","You would need to save approximately per period.")}</p><p>${t("Faltan:","Remaining:")} <b>${money(needed)}</b></p><button class="primary" onclick="renderHome()">${t("Volver","Back")}</button></section>`)}

function renderPurchase(){renderShell(t("Planear una compra","Plan a purchase"),`<section class="panel"><label>${t("¿Cuánto cuesta?","How much does it cost?")}</label><input id="purchaseAmount" type="number" min="0" step="0.01"><label>${t("¿Cuánto tienes disponible?","How much do you have available?")}</label><input id="purchaseAvailable" type="number" min="0" step="0.01"><button class="primary" onclick="checkPurchase()">${t("Comprobar","Check")}</button></section>`)}
function checkPurchase(){const cost=Number(document.getElementById("purchaseAmount")?.value||0),available=Number(document.getElementById("purchaseAvailable")?.value||0),difference=available-cost;renderShell(t("Planear una compra","Plan a purchase"),`<section class="panel result"><h2>${difference>=0?"✅":"⚠️"} ${difference>=0?t("Resultado","Result"):t("Falta dinero","Money needed")}</h2><p>${difference>=0?t("Después de la compra quedarían:","After the purchase you would have:"):t("Te faltarían:","You would be short:")} <b>${money(Math.abs(difference))}</b></p><button class="primary" onclick="renderHome()">${t("Volver","Back")}</button></section>`)}

function renderHelp(){renderShell(t("No entiendo","I don't understand"),`<section class="panel"><h2>${t("Elige qué quieres entender","Choose what you want to understand")}</h2><button class="topic" onclick="showHelpTopic('fee')">💵 ${t("Tarifa","Fee")}</button><button class="topic" onclick="showHelpTopic('rate')">💱 ${t("Tipo de cambio","Exchange rate")}</button><button class="topic" onclick="showHelpTopic('delivery')">⏱️ ${t("Tiempo de entrega","Delivery time")}</button><button class="topic" onclick="showHelpTopic('requirements')">📄 ${t("Qué pueden pedirte","What they may ask for")}</button><button class="topic" onclick="showHelpTopic('privacy')">🔒 ${t("Privacidad","Privacy")}</button></section>`)}
function showHelpTopic(id){
 const data={fee:[t("Tarifa","Fee"),t("La tarifa es el cargo que un proveedor puede cobrar por realizar una transferencia. Debe verificarse directamente antes de pagar.","A fee is a charge a provider may apply for a transfer. Verify it directly before paying.")],rate:[t("Tipo de cambio","Exchange rate"),t("Es la relación entre las monedas. Puede cambiar y debe verificarse en el momento de la operación.","It is the relationship between currencies. It can change and should be verified when you make the transaction.")],delivery:[t("Tiempo de entrega","Delivery time"),t("El tiempo depende del proveedor, método, país y operación. REMESAS no inventa tiempos actuales.","Delivery time depends on the provider, method, country and transaction. REMESAS does not invent current times.")],requirements:[t("Qué pueden pedirte","What they may ask for"),t("Un proveedor puede solicitar identidad, datos del remitente, datos del destinatario, método de recepción y datos relacionados con el pago.","A provider may request identity, sender details, recipient details, receiving method and payment-related information.")],privacy:[t("Privacidad","Privacy"),t("Nunca entregues a REMESAS contraseñas, códigos de autenticación ni información que no sea necesaria para organizar tu consulta.","Never give REMESAS passwords, authentication codes or information that is not necessary to organize your inquiry.")]}[id]||[t("Ayuda","Help"),t("Revisa la información directamente con el proveedor.","Check the information directly with the provider.")];
 renderShell(data[0],`<section class="panel"><h2>${esc(data[0])}</h2><p>${esc(data[1])}</p><button class="primary" onclick="renderHelp()">${t("Volver","Back")}</button></section>`)
}

function renderPrivacy(){renderShell(t("Privacidad","Privacy"),`<section class="panel"><h2>🔒 ${t("Tus datos","Your data")}</h2><p>${t("REMESAS utiliza almacenamiento local para las funciones de organización personal. Los datos que guardes localmente permanecen en tu dispositivo hasta que los elimines o borres los datos del navegador.","REMESAS uses local storage for personal organization features. Data you save locally remains on your device until you remove it or clear browser data.")}</p><p>${t("No introduzcas contraseñas, códigos de autenticación ni información bancaria sensible en campos que no la soliciten.","Do not enter passwords, authentication codes or sensitive banking information into fields that do not request them.")}</p></section>`)}
function renderAbout(){renderShell(t("Acerca de REMESAS","About REMESAS"),`<section class="panel"><h2>REMESAS ${APP.version}</h2><p>${t("Herramienta de May Roga LLC para ayudar a organizar dinero, preparar consultas de remesas y revisar información verificable.","Tool by May Roga LLC to help organize money, prepare remittance inquiries and review verifiable information.")}</p>${commercialNotice()}${legalShort()}</section>`)}

const LEARNING=[["start",t("Antes de empezar","Before you start"),t("Ten preparado el monto, país de destino y método de recepción. El proveedor puede pedir información adicional.","Have the amount, destination country and receiving method ready. The provider may request additional information.")],["sender",t("Datos del remitente","Sender information"),t("El proveedor puede solicitar nombre, identificación, dirección u otros datos necesarios para verificar la operación.","The provider may request your name, identification, address or other information needed to verify the transaction.")],["recipient",t("Datos del destinatario","Recipient information"),t("Pueden solicitar nombre legal, país, teléfono u otros datos del destinatario según el método de entrega.","They may request the recipient's legal name, country, phone number or other details depending on delivery method.")],["bank",t("Cuenta bancaria","Bank account"),t("Para depósito bancario pueden pedir datos de la cuenta o información equivalente. Verifica siempre los datos antes de enviar.","For bank deposits they may request account details or equivalent information. Always verify details before sending.")],["cash",t("Recogida en efectivo","Cash pickup"),t("Pueden pedir nombre correcto del destinatario, ubicación de recogida e identificación al retirar.","They may request the recipient's correct name, pickup location and identification when collecting.")],["wallet",t("Billetera móvil","Mobile wallet"),t("Puede ser necesario indicar el número o identificador asociado a la billetera compatible.","You may need to provide the number or identifier associated with the supported wallet.")],["reason",t("Motivo o información adicional","Purpose or additional information"),t("Algunas operaciones pueden requerir información adicional sobre el propósito o relación de la transferencia.","Some transactions may require additional information about the purpose or relationship of the transfer.")],["payment",t("Pago de la remesa","Paying the remittance"),t("El pago se realiza con el proveedor elegido. REMESAS no recibe ni procesa tu dinero.","Payment is made with the selected provider. REMESAS does not receive or process your money.")],["review",t("Revisión final","Final review"),t("Antes de confirmar, revisa destinatario, cantidad, moneda, tarifa, tipo de cambio y método de entrega cuando estén disponibles y verificados.","Before confirming, review recipient, amount, currency, fee, exchange rate and delivery method when available and verified.")],["never",t("Lo que nunca debes entregar a REMESAS","What you should never give REMESAS"),t("No introduzcas contraseñas, códigos 2FA, PIN, frases semilla ni claves privadas.","Do not enter passwords, 2FA codes, PINs, seed phrases or private keys.")]];

function renderLearning(){
 const providers=APP.config?.providers?.length?APP.config.providers:[{id:"western_union",name:"Western Union",official_site:"https://www.westernunion.com/us/en/home.html"},{id:"moneygram",name:"MoneyGram",official_site:"https://www.moneygram.com/us/en"},{id:"remitly",name:"Remitly",official_site:"https://www.remitly.com/us/en"},{id:"xoom",name:"Xoom",official_site:"https://www.xoom.com/"}];
 renderShell(t("APRENDER","LEARN"),`<section class="panel"><h2>${t("Qué puede pedir un proveedor","What a provider may request")}</h2>${LEARNING.map(x=>`<details class="lesson"><summary>${esc(x[1])}</summary><p>${esc(x[2])}</p></details>`).join("")}</section><section class="panel"><h2>${t("Fuentes oficiales","Official sources")}</h2>${providers.map(p=>{const u=p.official_site||p.official_url||p.url;return `<div class="source-row"><b>${esc(p.name||p.id)}</b>${u&&String(u).startsWith("https://")?`<button onclick='openOfficial(${safeInlineString(u)})'>${t("Sitio oficial","Official site")}</button>`:""}</div>`}).join("")}</section>${legalShort()}`)
}

function renderSubscription(){if(!accessIsActive()){showAccessGate();return}renderHome()}

async function createCheckout(){
 try{
  const d=await api("/api/create-checkout-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language:APP.lang,price_type:"1"}),skipAccess:true});
  if(d?.url){location.href=d.url;return}
  throw new Error(t("No se pudo crear el pago.","Could not create payment."))
 }catch(e){showError(e.message||t("No se pudo iniciar el pago.","Could not start payment."))}
}

function clearPaymentQuery(){
 const u=new URL(location.href);
 ["payment","success","session_id","checkout_session_id"].forEach(k=>u.searchParams.delete(k));
 history.replaceState({},document.title,u.pathname+(u.search?"?"+u.searchParams.toString():"")+u.hash)
}

async function checkPayment(checkoutId){
 if(!checkoutId)return false;
 for(const url of [`/api/payment/check?session_id=${encodeURIComponent(checkoutId)}`,`/api/payment-success?session_id=${encodeURIComponent(checkoutId)}`]){
  try{
   const r=await fetch(url);if(!r.ok)continue;
   const d=await r.json(),status=String(d?.status||"").toLowerCase();
   if(d?.active||d?.authorized||d?.granted||d?.success||["active","authorized","paid","success","complete","completed"].includes(status)){
    const raw=d.expires_at??d.access_until,until=raw?(Number(raw)>1e12?Number(raw):Number(raw)*1000):Date.now()+1200000;
    const token=d.token||d.access_token||d.session_token;
    if(token)saveAccess(token,until,false);
    else saveAccess("paid-"+Date.now(),until,false);
    return true
   }
  }catch{}
 }
 return false
}

async function renderPaymentResult(){
 const q=new URLSearchParams(location.search),payment=q.get("payment"),success=q.get("success"),sid=q.get("session_id")||q.get("checkout_session_id");
 if(payment==="cancel"||payment==="cancelled"){clearPaymentQuery();showAccessGate();showError(t("El pago fue cancelado.","Payment was cancelled."));return true}
 if(payment==="success"||success==="true"||sid){
  if(sid&&await checkPayment(sid)){clearPaymentQuery();await loadConfig();await startSession(false);renderHome();return true}
  if(payment==="success"||success==="true"){clearPaymentQuery();showAccessGate();showError(t("El pago fue recibido, pero todavía no se pudo confirmar el acceso.","Payment was received, but access could not yet be confirmed."));return true}
 }
 return false
}

function showError(message){
 const old=document.querySelector(".toast");if(old)old.remove();
 const d=document.createElement("div");d.className="toast";d.textContent=message||t("Ocurrió un error.","An error occurred.");document.body.appendChild(d);setTimeout(()=>d.remove(),5000)
}

async function deleteLocalData(){
 if(!confirm(t("¿Eliminar todos los datos guardados localmente en este navegador?","Delete all data stored locally in this browser?")))return;
 try{if(APP.sessionId&&accessIsActive())await api(`/api/session/${encodeURIComponent(APP.sessionId)}`,{method:"DELETE"})}catch{}
 [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey].forEach(k=>localStorage.removeItem(k));
 APP.session=null;APP.sessionId=null;renderHome()
}

Object.assign(window,{renderHome,renderAbout,renderRemittance,renderMoney,renderWeek,renderExpenses,renderFamily,renderHelp,renderPurchase,renderSavings,renderPrivacy,renderSubscription,renderLearning,changeLanguage,understandNeed,beginParsedRemittance,compare,selectProvider,renderFinalCheck,renderComparisonFromSession,openOfficial,calculateMoney,addExpense,removeExpense,saveFamily,saveSavings,checkPurchase,showHelpTopic,deleteLocalData,updateMoneyWarning,createCheckout,checkPayment,clearPaymentQuery,showAdminLogin,closeAdminLogin,loginAdmin,showAccessGate});

async function boot(){
 if(!app)return;
 setupTripleTap();
 app.innerHTML=`<main class="loading"><div>⏳</div><p>${t("Cargando REMESAS...","Loading REMESAS...")}</p></main>`;
 try{
  await loadConfig();
  if(await renderPaymentResult())return;
  if(await accessStatus()){await startSession(true);renderHome()}
  else showAccessGate()
 }catch(e){
  app.innerHTML=`<main class="panel"><h2>⚠️ ${t("No se pudo iniciar REMESAS","REMESAS could not start")}</h2><p>${esc(e.message||"")}</p><button class="primary" onclick="location.reload()">${t("Reintentar","Retry")}</button><button class="secondary" onclick="showAccessGate()">${t("Acceso","Access")}</button></main>`
 }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
