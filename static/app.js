"use strict";

const APP={
 name:"REMESAS",version:"4.2.0",
 lang:localStorage.getItem("remesas_lang_v42")||"es",
 token:localStorage.getItem("remesas_access_token_v42")||"",
 session:null,config:null,
 moneyKey:"remesas_money_v4",
 expensesKey:"remesas_expenses_v4",
 familyKey:"remesas_family_v4",
 savingsKey:"remesas_savings_v4",
 purchaseKey:"remesas_purchase_v4",
 prefsKey:"remesas_prefs_v4",
 tapCount:0,tapTimer:null,
 serviceTimer:null,
 lastView:"home"
};

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=document.getElementById("app");

const T={
 es:{
  home:"INICIO",send:"ENVIAR DINERO",learn:"APRENDER",compare:"COMPARAR",guide:"GUÍA RÁPIDA",
  money:"MI DINERO",help:"AYUDA",back:"Volver",close:"Cerrar",save:"Guardar",cancel:"Cancelar",
  continue:"Continuar",next:"Siguiente",open:"Abrir",official:"Sitio oficial",language:"EN",
  access:"ENTRAR A REMESAS",price:"$10.99",minutes:"20 minutos",oneTime:"Pago único",
  paid:"PAGAR Y ENTRAR",admin:"Acceso de prueba",username:"Usuario",password:"Contraseña",
  login:"Entrar",hidden:"",title:"TU DINERO, MÁS CLARO",
  subtitle:"Organiza tu dinero, prepara una remesa y entiende tus opciones sin complicarte.",
  independent:"REMESAS es un servicio independiente de May Roga LLC. No hace el envío por ti.",
  amount:"¿Cuánto quieres enviar?",country:"¿A qué país?",priority:"¿Qué es importante para ti?",
  delivery:"¿Cómo recibirá el dinero?",payment:"¿Cómo quieres pagar?",special:"¿Hay algo especial que debamos saber?",
  text:"También puedes explicarlo con tus propias palabras.",
  analyze:"Entender mi necesidad",results:"Opciones",select:"Elegir",selected:"Elegido",
  final:"REVISIÓN FINAL",recipient:"Ya revisé los datos del destinatario",
  verified:"Verificado",unavailable:"No verificado",notVerified:"Dato actual no verificado",
  noCommercial:"Los datos comerciales actuales no están verificados. Puedes revisar directamente los sitios oficiales.",
  precautions:"Antes de continuar",learnTitle:"APRENDE A HACER UNA REMESA",
  guideTitle:"GUÍA RÁPIDA",learnPdf:"Guardar guía educativa",moneyPdf:"Guardar mis datos",
  importPdf:"Restaurar desde PDF",delete:"Borrar mis datos locales",confirmDelete:"¿Borrar todos los datos guardados en este dispositivo?",
  income:"Tengo / Entró",expense:"Gasto",saving:"Ahorro",family:"Familia",purchase:"Compra",
  week:"Esta semana",available:"Disponible",totalIn:"Total entró",totalOut:"Total salió",remaining:"Queda",
  add:"Agregar",remove:"Eliminar",description:"Descripción",value:"Cantidad",date:"Fecha",
  recipient:"Destinatario",destination:"Destino",calc:"Calcular",empty:"Todavía no hay registros.",
  support:"Ayuda",privacy:"Privacidad",security:"Seguridad",legal:"Aviso legal",
  what:"¿Qué necesitas?",ask:"Escribe lo que necesitas y REMESAS te ayudará a encontrar el siguiente paso.",
  sessionExpired:"Tu acceso terminó. Tus datos locales no se borraron.",
  error:"No pudimos completar esa acción. Intenta nuevamente.",
  officialNotice:"La información final y actual debe confirmarse en el sitio oficial del proveedor.",
  provider:"Proveedor",fee:"Comisión",rate:"Tasa de cambio",receive:"Recibiría",deliveryTime:"Entrega",
  methods:"Métodos",requirements:"Requisitos",differences:"Diferencias",review:"Revisar",
  ready:"La información básica está lista.",notReady:"Falta información para continuar.",
  launch:"Continuar al proveedor",learnProvider:"Aprender este proceso",
  quickAction:"Abrir guía rápida",download:"Descargar",print:"Imprimir / guardar PDF",
  yes:"Sí",no:"No",ok:"OK",today:"Hoy",noData:"Sin datos",
  moneyIntro:"Aquí puedes ver qué dinero tienes, qué entró, qué salió, qué ahorraste y qué puedes hacer.",
  privacyText:"Los registros de dinero se guardan localmente en este dispositivo. REMESAS no necesita contraseñas, CVV, códigos de seguridad ni credenciales.",
  taxText:"El resumen puede ayudarte a entregar información organizada a un contador o preparador de impuestos. REMESAS no prepara ni presenta impuestos.",
  supportText:"REMESAS no es banco, financiera, transmisor de dinero, procesador de pagos, asesor financiero ni agente de los proveedores.",
  learnNotice:"Contenido educativo original de REMESAS. No reproduce pantallas, textos, imágenes, logotipos ni capacitación oficial.",
  moneyFlow:"TENGO → GANO → GASTO → AHORRO → QUIERO → PUEDO → HAGO"
 },
 en:{
  home:"HOME",send:"SEND MONEY",learn:"LEARN",compare:"COMPARE",guide:"QUICK GUIDE",
  money:"MY MONEY",help:"HELP",back:"Back",close:"Close",save:"Save",cancel:"Cancel",
  continue:"Continue",next:"Next",open:"Open",official:"Official site",language:"ES",
  access:"ENTER REMESAS",price:"$10.99",minutes:"20 minutes",oneTime:"One-time payment",
  paid:"PAY AND ENTER",admin:"Test access",username:"Username",password:"Password",
  login:"Log in",hidden:"",title:"YOUR MONEY, CLEARER",
  subtitle:"Organize your money, prepare a remittance and understand your options without the confusion.",
  independent:"REMESAS is an independent service by May Roga LLC. It does not make the transfer for you.",
  amount:"How much do you want to send?",country:"Which country?",priority:"What matters to you?",
  delivery:"How will the money be received?",payment:"How do you want to pay?",special:"Anything special we should know?",
  text:"You can also explain it in your own words.",
  analyze:"Understand my need",results:"Options",select:"Choose",selected:"Chosen",
  final:"FINAL REVIEW",recipient:"I reviewed the recipient information",
  verified:"Verified",unavailable:"Not verified",notVerified:"Current data not verified",
  noCommercial:"Current commercial data is not verified. You can review the official provider sites directly.",
  precautions:"Before continuing",learnTitle:"LEARN HOW TO SEND A REMITTANCE",
  guideTitle:"QUICK GUIDE",learnPdf:"Save educational guide",moneyPdf:"Save my data",
  importPdf:"Restore from PDF",delete:"Delete local data",confirmDelete:"Delete all data stored on this device?",
  income:"Have / Came in",expense:"Expense",saving:"Savings",family:"Family",purchase:"Purchase",
  week:"This week",available:"Available",totalIn:"Total in",totalOut:"Total out",remaining:"Remaining",
  add:"Add",remove:"Remove",description:"Description",value:"Amount",date:"Date",
  recipient:"Recipient",destination:"Destination",calc:"Calculate",empty:"There are no records yet.",
  support:"Help",privacy:"Privacy",security:"Security",legal:"Legal notice",
  what:"What do you need?",ask:"Write what you need and REMESAS will help find the next step.",
  sessionExpired:"Your access ended. Your local data was not deleted.",
  error:"We could not complete that action. Try again.",
  officialNotice:"Final and current information must be confirmed on the provider's official site.",
  provider:"Provider",fee:"Fee",rate:"Exchange rate",receive:"Recipient receives",deliveryTime:"Delivery",
  methods:"Methods",requirements:"Requirements",differences:"Differences",review:"Review",
  ready:"The basic information is ready.",notReady:"Information is missing before continuing.",
  launch:"Continue to provider",learnProvider:"Learn this process",
  quickAction:"Open quick guide",download:"Download",print:"Print / save PDF",
  yes:"Yes",no:"No",ok:"OK",today:"Today",noData:"No data",
  moneyIntro:"See what money you have, what came in, what went out, what you saved and what you can do.",
  privacyText:"Money records are stored locally on this device. REMESAS does not need passwords, CVV numbers, security codes or credentials.",
  taxText:"The organized summary can help you give information to an accountant or tax preparer. REMESAS does not prepare or file taxes.",
  supportText:"REMESAS is not a bank, financial institution, money transmitter, payment processor, financial adviser or provider agent.",
  learnNotice:"Original REMESAS educational content. It does not reproduce provider screens, text, images, logos or official training.",
  moneyFlow:"HAVE → EARN → SPEND → SAVE → WANT → CAN → DO"
 }
};

const tr=k=>(T[APP.lang]||T.es)[k]||k;
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=n=>Number(n||0).toLocaleString(APP.lang==="es"?"en-US":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const nowISO=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString(APP.lang==="es"?"es-US":"en-US");
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const read=(k,d=[])=>{try{const x=JSON.parse(localStorage.getItem(k));return x??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const cfgCountry=c=>APP.config?.countries?.find(x=>x.id===c);
const countryName=c=>cfgCountry(c)?.name||c||"";
const apiHeaders=(json=false)=>{const h={"Accept":"application/json","X-Remesas-Language":APP.lang};if(APP.token)h["X-Remesas-Access-Token"]=APP.token;if(json)h["Content-Type"]="application/json";return h};

async function api(url,opt={}){
 const o={...opt,headers:{...apiHeaders(!!opt.body),...(opt.headers||{})}};
 let r;
 try{r=await fetch(url,o)}catch(e){throw Error(tr("error"))}
 let d={};try{d=await r.json()}catch{}
 if(r.status===401||r.status===403){
  if(APP.token){APP.token="";localStorage.removeItem("remesas_access_token_v42");APP.session=null;renderGate(tr("sessionExpired"))}
  throw Error(d.detail||tr("sessionExpired"))
 }
 if(!r.ok)throw Error(d.detail||d.message||tr("error"));
 return d;
}

async function loadConfig(){
 try{const d=await fetch("/api/config?language="+encodeURIComponent(APP.lang)).then(r=>r.json());APP.config=d;return d}
 catch(e){APP.config=APP.config||{providers:[],countries:[],delivery_methods:[],payment_methods:[]};return APP.config}
}

function toast(msg){
 let x=document.querySelector(".toast");if(!x){x=document.createElement("div");x.className="toast";document.body.appendChild(x)}
 x.textContent=msg;x.classList.add("show");clearTimeout(x._t);x._t=setTimeout(()=>x.classList.remove("show"),3200);
}

function setView(v){APP.lastView=v;window.scrollTo({top:0,behavior:"smooth"})}

function btn(text,action,cls=""){
 return `<button class="btn ${cls}" data-action="${esc(action)}">${esc(text)}</button>`;
}

function card(title,body,cls=""){
 return `<div class="card ${cls}"><h3>${esc(title)}</h3>${body}</div>`;
}

function gateShell(body){
 return `<div class="app-shell"><header class="topbar"><div class="brand"><strong>REMESAS</strong><span>May Roga LLC</span></div><div class="top-actions"><button class="btn small lang-btn" data-action="lang">${tr("language")}</button></div></header><main>${body}</main><footer class="footer">${esc(tr("independent"))}</footer></div>`;
}

function renderGate(message=""){
 app.innerHTML=gateShell(`
 <section class="hero">
  <div class="hero-content">
   <div class="action-icon">💸</div>
   <h1>${esc(tr("title"))}</h1>
   <p>${esc(tr("subtitle"))}</p>
   <div class="notice info"><strong>${esc(tr("access"))}</strong><br>${esc(tr("price"))} · ${esc(tr("minutes"))} · ${esc(tr("oneTime"))}</div>
   ${message?`<div class="notice warning">${esc(message)}</div>`:""}
   <div class="hero-actions">${btn(tr("paid"),"pay","primary")}</div>
   <div class="notice">${esc(tr("independent"))}</div>
  </div>
 </section>`);
 installTripleTap();
}

function installTripleTap(){
 const target=$(".hero")||app;
 target.onclick=()=>{
  APP.tapCount++;
  clearTimeout(APP.tapTimer);
  APP.tapTimer=setTimeout(()=>APP.tapCount=0,900);
  if(APP.tapCount>=3){APP.tapCount=0;adminModal()}
 };
}

function adminModal(){
 const old=document.querySelector(".modal-backdrop");if(old)old.remove();
 const d=document.createElement("div");d.className="modal-backdrop";
 d.innerHTML=`<div class="modal">
  <div class="modal-head"><strong>${esc(tr("admin"))}</strong><button class="close" data-action="close-modal">×</button></div>
  <form id="adminForm">
   <div class="field"><label>${esc(tr("username"))}</label><input id="adminUser" autocomplete="username" required></div>
   <div class="field"><label>${esc(tr("password"))}</label><input id="adminPass" type="password" autocomplete="current-password" required></div>
   <div id="adminMsg"></div>
   <button class="btn primary" type="submit">${esc(tr("login"))}</button>
  </form>
 </div>`;
 document.body.appendChild(d);
 $("#adminForm").onsubmit=async e=>{
  e.preventDefault();const m=$("#adminMsg");m.innerHTML=`<div class="loading">${esc(tr("continue"))}...</div>`;
  try{
   const x=await fetch("/api/access/admin",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({username:$("#adminUser").value,password:$("#adminPass").value})}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.detail||tr("error"));return j});
   if(!x.token)throw Error(tr("error"));
   APP.token=x.token;localStorage.setItem("remesas_access_token_v42",APP.token);
   d.remove();await startService()
  }catch(err){m.innerHTML=`<div class="notice error">${esc(err.message)}</div>`}
 };
}

async function pay(){
 try{
  const x=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang})});
  if(x.checkout_url)location.href=x.checkout_url;else throw Error(tr("error"))
 }catch(e){toast(e.message)}
}

async function checkReturnedPayment(){
 const p=new URLSearchParams(location.search);
 if(p.get("payment")==="success"&&p.get("session_id")){
  app.innerHTML=gateShell(`<section class="hero"><div class="hero-content"><div class="spinner"></div><h2>${esc(tr("continue"))}...</h2></div></section>`);
  try{
   const x=await fetch("/api/payment/check?session_id="+encodeURIComponent(p.get("session_id"))).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.detail||tr("error"));return j});
   if(x.token){APP.token=x.token;localStorage.setItem("remesas_access_token_v42",APP.token);history.replaceState({},document.title,location.pathname);await startService();return true}
   throw Error(tr("error"))
  }catch(e){history.replaceState({},document.title,location.pathname);renderGate(e.message);return true}
 }
 if(p.get("payment")==="cancelled"){history.replaceState({},document.title,location.pathname);renderGate(APP.lang==="es"?"El pago fue cancelado. Puedes volver a intentarlo.":"Payment was cancelled. You can try again.");return true}
 return false
}

async function startService(){
 try{
  const x=await api("/api/service/start",{method:"POST"});
  APP.session=x.session||null;
  if(!APP.session&&x.session_id){
   const s=await api("/api/session/"+encodeURIComponent(x.session_id),{method:"GET"});
   APP.session=s.session||s;
  }
  if(!APP.session)throw Error(tr("error"));
  startAccessTimer(Number(x.seconds_remaining||1200));
  renderApp("home");
 }catch(e){APP.token="";localStorage.removeItem("remesas_access_token_v42");renderGate(e.message)}
}

function startAccessTimer(sec){
 clearInterval(APP.serviceTimer);
 let n=Number(sec)||1200;
 APP.serviceTimer=setInterval(()=>{
  n--;
  if(n<=0){clearInterval(APP.serviceTimer);APP.token="";localStorage.removeItem("remesas_access_token_v42");APP.session=null;renderGate(tr("sessionExpired"))}
 },1000);
}

function topbar(){
 return `<header class="topbar">
 <div class="brand"><strong>REMESAS</strong><span>May Roga LLC</span></div>
 <div class="top-actions">
  <button class="btn small lang-btn" data-action="lang">${tr("language")}</button>
  <button class="btn small secondary" data-action="help">${esc(tr("help"))}</button>
 </div>
 </header>`;
}

function renderApp(view="home",data=null){
 let body="";
 if(view==="home")body=homeView();
 else if(view==="send")body=sendView();
 else if(view==="compare")body=compareView(data||APP.session);
 else if(view==="final")body=finalView(data||APP.session);
 else if(view==="learn")body=learnView(data);
 else if(view==="providerLearn")body=providerLearnView(data);
 else if(view==="guide")body=guideView(data);
 else if(view==="money")body=moneyView();
 else if(view==="help")body=helpView();
 else body=homeView();
 app.innerHTML=`<div class="app-shell">${topbar()}<main>${body}</main><footer class="footer"><div class="footer-links"><button class="btn small secondary" data-action="privacy">${esc(tr("privacy"))}</button><button class="btn small secondary" data-action="security">${esc(tr("security"))}</button><button class="btn small secondary" data-action="legal">${esc(tr("legal"))}</button></div><p>${esc(tr("independent"))}</p></footer></div>`;
 bindActions();
}

function homeView(){
 const bal=moneySummary();
 return `
 <section class="hero">
  <div class="hero-content">
   <h1>${esc(tr("title"))}</h1>
   <p>${esc(tr("subtitle"))}</p>
   <div class="notice info"><strong>${esc(tr("moneyFlow"))}</strong></div>
   <div class="hero-actions">
    ${btn("💸 "+tr("send"),"send","primary")}
    ${btn("📚 "+tr("learn"),"learn","secondary")}
    ${btn("🔎 "+tr("compare"),"compare","secondary")}
    ${btn("💰 "+tr("money"),"money","secondary")}
   </div>
  </div>
 </section>
 <section class="section"><div class="section-title"><h2>${esc(tr("what"))}</h2><p>${esc(tr("ask"))}</p></div>
  <div class="form-card">
   <div class="field"><textarea id="homeText" rows="3" placeholder="${esc(tr("ask"))}"></textarea></div>
   ${btn(tr("analyze"),"assistant","primary")}
  </div>
 </section>
 <section class="section"><div class="grid">
  ${actionCard("💵",tr("money"),tr("moneyIntro"),"money")}
  ${actionCard("📤",tr("send"),"Prepara una remesa paso a paso.","send")}
  ${actionCard("📖",tr("learn"),tr("learnNotice"),"learn")}
  ${actionCard("🧭",tr("guide"),"Sigue el proceso sin entregar tus credenciales a esta aplicación.","guide")}
 </div></section>
 <section class="section"><div class="balance-grid">
  <div class="balance"><small>${esc(tr("totalIn"))}</small><strong>$${money(bal.in)}</strong></div>
  <div class="balance"><small>${esc(tr("totalOut"))}</small><strong>$${money(bal.out)}</strong></div>
  <div class="balance"><small>${esc(tr("available"))}</small><strong>$${money(bal.remaining)}</strong></div>
 </div></section>`;
}

function actionCard(icon,title,text,action){
 return `<button class="action-card" data-action="${esc(action)}"><span class="action-icon">${icon}</span><strong>${esc(title)}</strong><span>${esc(text)}</span></button>`;
}

function sendView(){
 const s=APP.session||{};
 const c=s.destination_country||"";
 return `
 <section class="section"><div class="section-title"><button class="btn small secondary" data-action="home">← ${esc(tr("back"))}</button><h1>${esc(tr("send"))}</h1><p>${esc(tr("ask"))}</p></div>
 <div class="form-card">
  <div class="form-row two">
   <div class="field"><label>${esc(tr("amount"))}</label><input id="sendAmount" type="number" min=".01" max="1000000" step=".01" value="${s.amount??""}" placeholder="100"></div>
   <div class="field"><label>USD</label><input value="USD" disabled></div>
  </div>
  <div class="field"><label>${esc(tr("country"))}</label><select id="sendCountry"><option value="">—</option>${(APP.config?.countries||[]).map(x=>`<option value="${esc(x.id)}" ${x.id===c?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div>
  <div class="field"><label>${esc(tr("priority"))}</label><div class="choice-grid">${(APP.config?.opening?.priorities||[]).map(x=>`<label class="choice"><input type="radio" name="priority" value="${esc(x.id)}" ${s.priority===x.id?"checked":""}><span><b>${esc(x.label)}</b><small>${esc(x.why||"")}</small></span></label>`).join("")}</div></div>
  <div class="field"><label>${esc(tr("delivery"))}</label><div class="choice-grid">${(APP.config?.delivery_methods||[]).map(x=>`<label class="choice"><input type="radio" name="delivery" value="${esc(x.id)}" ${s.delivery_method===x.id?"checked":""}><span>${esc(x.label)}</span></label>`).join("")}</div></div>
  <div class="field"><label>${esc(tr("payment"))}</label><div class="choice-grid">${(APP.config?.payment_methods||[]).map(x=>`<label class="choice"><input type="radio" name="payment" value="${esc(x.id)}" ${s.payment_method===x.id?"checked":""}><span>${esc(x.label)}</span></label>`).join("")}</div></div>
  <div class="field"><label>${esc(tr("special"))}</label><textarea id="sendSpecial" rows="2">${esc(s.special_need||"")}</textarea></div>
  <div class="field"><label>${esc(tr("text"))}</label><textarea id="sendText" rows="3" placeholder="${APP.lang==="es"?"Ejemplo: Quiero enviar $200 a México y necesito comparar las opciones.":"Example: I want to send $200 to Mexico and compare the options."}"></textarea></div>
  <div class="hero-actions">${btn(tr("continue"),"submit-send","primary")} ${btn(tr("compare"),"compare","secondary")}</div>
 </div></section>`;
}

async function submitSend(){
 const amount=Number($("#sendAmount")?.value||0),country=$("#sendCountry")?.value||"";
 const priority=$('input[name="priority"]:checked')?.value||null;
 const delivery_method=$('input[name="delivery"]:checked')?.value||null;
 const payment_method=$('input[name="payment"]:checked')?.value||null;
 const special_need=$("#sendSpecial")?.value.trim()||null;
 const free_text=$("#sendText")?.value.trim()||null;
 if(!(amount>0&&amount<=1000000)||!country){toast(APP.lang==="es"?"Indica cantidad y país de destino.":"Enter amount and destination country.");return}
 try{
  const x=await api("/api/need",{method:"POST",body:JSON.stringify({language:APP.lang,amount,send_currency:"USD",destination_country:country,priority,delivery_method,payment_method,special_need,free_text,need_type:"remittance"})});
  APP.session=x.session||APP.session;
  await doCompare();
 }catch(e){toast(e.message)}
}

async function parseFreeText(text){
 if(!text)return null;
 try{
  const x=await api("/api/session/"+APP.session.session_id+"/need/parse",{method:"POST",body:JSON.stringify({language:APP.lang,text})});
  APP.session=x.session||APP.session;return x
 }catch(e){return null}
}

async function doCompare(){
 if(!APP.session?.amount||!APP.session?.destination_country){toast(APP.lang==="es"?"Faltan cantidad y país.":"Amount and destination are required.");return}
 try{
  const x=await api("/api/session/"+APP.session.session_id+"/compare",{method:"POST",body:JSON.stringify({})});
  APP.session={...APP.session,available_providers:x.available_providers||[],verified_results:x.results||[],candidate_providers:(x.available_providers||[]).map(p=>p.provider_id),current_step:"results"};
  renderApp("compare",x)
 }catch(e){toast(e.message)}
}

function compareView(x){
 x=x||{};const providers=x.available_providers||APP.session?.available_providers||[];
 const results=x.results||APP.session?.verified_results||[];
 return `
 <section class="section"><div class="section-title"><button class="btn small secondary" data-action="send">← ${esc(tr("back"))}</button><h1>${esc(tr("compare"))}</h1><p>${esc(x.explanation||tr("noCommercial"))}</p></div>
 <div class="notice ${results.length?"success":"warning"}">${esc(x.message||tr("noCommercial"))}</div>
 <div class="result-list">${providers.map(p=>{
  const verified=!!p.commercial_verified;
  const r=results.find(z=>z.provider_id===p.provider_id)||p;
  return `<div class="provider-card">
   <div class="provider-head"><div><h3>${esc(p.provider_name)}</h3><span class="provider-status ${verified?"verified":""}">${verified?esc(tr("verified")):esc(tr("unavailable"))}</span></div>
   ${btn(tr("select"),"select:"+p.provider_id,"primary")}</div>
   <div class="provider-data">
    <div class="metric"><small>${esc(tr("fee"))}</small><strong>${verified&&r.fee!=null?esc(r.fee):"—"}</strong></div>
    <div class="metric"><small>${esc(tr("rate"))}</small><strong>${verified&&r.exchange_rate!=null?esc(r.exchange_rate):"—"}</strong></div>
    <div class="metric"><small>${esc(tr("receive"))}</small><strong>${verified&&r.recipient_amount!=null?esc(r.recipient_amount+" "+(r.recipient_currency||"")):"—"}</strong></div>
    <div class="metric"><small>${esc(tr("deliveryTime"))}</small><strong>${verified&&r.estimated_delivery?esc(r.estimated_delivery):"—"}</strong></div>
   </div>
   <p>${verified&&r.important_condition?esc(r.important_condition):esc(tr("notVerified"))}</p>
   <div>${btn(tr("learnProvider"),"provider-learn:"+p.provider_id,"small secondary")} ${btn(tr("quickAction"),"guide:"+p.provider_id,"small secondary")}</div>
  </div>`
 }).join("")||`<div class="empty">${esc(tr("empty"))}</div>`}</div>
 ${x.differences?.length?`<div class="section">${card(tr("differences"),differenceHtml(x.differences))}</div>`:""}
 ${precautionsHtml(x.precautions||[])}</section>`;
}

function differenceHtml(ds){
 return `<div class="list">${ds.map(d=>`<div><strong>${esc(d.label)}</strong>${(d.values||[]).map(v=>`<p>${esc(v.provider_name)}: ${esc(Array.isArray(v.value)?v.value.join(", "):v.value)}</p>`).join("")}</div>`).join("")}</div>`;
}

function precautionsHtml(xs){
 return xs?.length?`<div class="notice warning"><h3>${esc(tr("precautions"))}</h3><ul>${xs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:"";
}

async function selectProvider(pid){
 try{
  const x=await api("/api/session/"+APP.session.session_id+"/select/"+encodeURIComponent(pid),{method:"POST"});
  APP.session.selected_option=x.selected_option||x;
  renderApp("final",x);
  await finalCheck(false);
 }catch(e){toast(e.message)}
}

async function finalCheck(recipient){
 const s=APP.session,o=s?.selected_option||{};
 if(!s)return;
 try{
  const x=await api("/api/session/"+s.session_id+"/final-check",{method:"POST",body:JSON.stringify({
   language:APP.lang,provider_id:o.provider_id||"",amount:Number(s.amount||0),send_currency:s.send_currency||"USD",
   destination_country:s.destination_country||"",delivery_method:s.delivery_method||null,payment_method:s.payment_method||null,
   recipient_amount:o.recipient_amount??null,fee:o.fee??null,exchange_rate:o.exchange_rate??null,
   recipient_information_entered:!!recipient
  })});
  APP.final=x;renderApp("final",x)
 }catch(e){toast(e.message)}
}

function finalView(x){
 const s=APP.session||{},o=s.selected_option||{},checks=x?.checks||s.final_check?.checks||[];
 return `<section class="section"><div class="section-title"><button class="btn small secondary" data-action="compare">← ${esc(tr("back"))}</button><h1>${esc(tr("final"))}</h1><p>${esc(x?.message||tr("officialNotice"))}</p></div>
 ${card(o.provider_name||tr("provider"),`
  <div class="provider-data">
   <div class="metric"><small>${esc(tr("amount"))}</small><strong>$${money(s.amount)}</strong></div>
   <div class="metric"><small>${esc(tr("country"))}</small><strong>${esc(countryName(s.destination_country))}</strong></div>
   <div class="metric"><small>${esc(tr("fee"))}</small><strong>${o.fee!=null?esc(o.fee):"—"}</strong></div>
   <div class="metric"><small>${esc(tr("receive"))}</small><strong>${o.recipient_amount!=null?esc(o.recipient_amount+" "+(o.recipient_currency||"")):"—"}</strong></div>
  </div>`)}
 <div class="form-card"><h3>${esc(tr("review"))}</h3><div class="list">${checks.map(c=>`<div><strong>${esc(c.label)}</strong><span>${esc(c.value||"—")} ${c.complete?"✓":"⚠"}</span></div>`).join("")}</div>
  <label class="check-row"><input id="recipientReviewed" type="checkbox" ${checks.find(c=>c.id==="recipient_information")?.complete?"checked":""}><span>${esc(tr("recipient"))}: ${esc(tr("recipient"))} — ${esc(tr("recipient"))}</span></label>
  <div class="hero-actions">${btn(tr("review"),"final-refresh","secondary")} ${btn(tr("launch"),"launch","primary")}</div>
 </div>
 ${precautionsHtml(x?.precautions||[])}
 ${x?.requirements?.length?card(tr("requirements"),`<ul>${x.requirements.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>`):""}
 </section>`;
}

async function refreshFinal(){await finalCheck($("#recipientReviewed")?.checked||false)}

function launchProvider(){
 const url=APP.session?.selected_option?.continue_url||APP.session?.selected_option?.official_site;
 if(!url||!/^https?:\/\//i.test(url)){toast(tr("error"));return}
 window.open(url,"_blank","noopener,noreferrer");
}

function learnView(data){
 const d=data||{};
 return `<section class="section"><div class="section-title"><button class="btn small secondary" data-action="home">← ${esc(tr("back"))}</button><h1>${esc(d.overview?.title||tr("learnTitle"))}</h1><p>${esc(d.overview?.purpose||tr("learnNotice"))}</p></div>
 <div class="notice info">${esc(d.notice||tr("learnNotice"))}</div>
 <div class="grid">${(d.steps||[]).map((s,i)=>`<button class="action-card" data-action="lesson:${i}"><span class="action-icon">${i+1}</span><strong>${esc(s.title)}</strong><span>${esc(s.purpose||"")}</span>${s.warning?`<small>⚠ ${esc(s.warning)}</small>`:""}</button>`).join("")}</div>
 <section class="section"><h2>${esc(tr("provider"))}</h2><div class="grid">${(d.providers||APP.config?.providers||[]).map(p=>actionCard("🏦",p.name,tr("learnProvider"),"provider-learn:"+p.id)).join("")}</div></section>
 <div class="hero-actions">${btn(tr("learnPdf"),"learning-pdf","secondary")} ${btn(tr("guide"),"guide","primary")}</div>
 </section>`;
}

function lessonModal(i){
 api("/api/learn").then(d=>{
  const s=(d.steps||[])[i];if(!s)return;
  modal(`${s.title}`,`<p>${esc(s.purpose||"")}</p>${s.warning?`<div class="notice warning">${esc(s.warning)}</div>`:""}<button class="btn primary" data-action="close-modal">${esc(tr("ok"))}</button>`)
 }).catch(e=>toast(e.message))
}

async function providerLearn(pid){
 try{const d=await api("/api/learn/"+encodeURIComponent(pid));renderApp("providerLearn",d)}catch(e){toast(e.message)}
}

function providerLearnView(d){
 return `<section class="section"><div class="section-title"><button class="btn small secondary" data-action="learn">← ${esc(tr("back"))}</button><h1>${esc(d.title||"")}</h1><p>${esc(d.disclaimer||"")}</p></div>
 <div class="notice info">${esc(d.current_information_notice||tr("officialNotice"))}</div>
 <div class="grid">${(d.steps||[]).map((s,i)=>card((i+1)+". "+(s.title||""),`<p>${esc(s.teaches||"")}</p>${s.warning?`<div class="notice warning">${esc(s.warning)}</div>`:""}`)).join("")}</div>
 <div class="hero-actions">${d.official_url?btn(tr("official"),"open-url:"+d.official_url,"primary"):""} ${btn(tr("learnPdf"),"provider-learning-pdf:"+d.provider_id,"secondary")} ${btn(tr("guide"),"guide:"+d.provider_id,"secondary")}</div>
 <div class="notice">${esc(tr("learnNotice"))}</div></section>`;
}

async function guide(pid=null){
 try{const d=await api("/api/quick-guide"+(pid?"/"+encodeURIComponent(pid):""));renderApp("guide",d)}catch(e){toast(e.message)}
}

function guideView(d){
 return `<section class="section"><div class="section-title"><button class="btn small secondary" data-action="home">← ${esc(tr("back"))}</button><h1>${esc(d?.title||tr("guideTitle"))}</h1><p>${esc(d?.purpose||"")}</p></div>
 <div class="grid">${(d?.steps||[]).map((s,i)=>card((i+1)+". "+(s.title||""),`<p>${esc(s.purpose||s.teaches||"")}</p>${s.warning?`<div class="notice warning">${esc(s.warning)}</div>`:""}`)).join("")}</div>
 ${(d?.limits||[]).length?`<div class="notice warning"><ul>${d.limits.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
 <div class="hero-actions">${d?.official_url?btn(tr("official"),"open-url:"+d.official_url,"primary"):""} ${btn(tr("learn"),"learn","secondary")}</div></section>`;
}

function moneySummary(){
 const income=read(APP.moneyKey,[]),expenses=read(APP.expensesKey,[]),savings=read(APP.savingsKey,[]),purchases=read(APP.purchaseKey,[]);
 const sum=a=>a.reduce((n,x)=>n+Number(x.amount||0),0);
 const i=sum(income),o=sum(expenses)+sum(savings)+sum(purchases);
 return {in:i,out:o,remaining:i-o};
}

function moneyView(){
 const b=moneySummary(),income=read(APP.moneyKey,[]),expenses=read(APP.expensesKey,[]),savings=read(APP.savingsKey,[]),purchases=read(APP.purchaseKey,[]),family=read(APP.familyKey,[]);
 return `<section class="section"><div class="section-title"><button class="btn small secondary" data-action="home">← ${esc(tr("back"))}</button><h1>${esc(tr("money"))}</h1><p>${esc(tr("moneyIntro"))}</p></div>
 <div class="balance-grid"><div class="balance"><small>${esc(tr("totalIn"))}</small><strong>$${money(b.in)}</strong></div><div class="balance"><small>${esc(tr("totalOut"))}</small><strong>$${money(b.out)}</strong></div><div class="balance"><small>${esc(tr("remaining"))}</small><strong>$${money(b.remaining)}</strong></div></div>
 <div class="grid">
  ${moneyEditor("💵",tr("income"),APP.moneyKey,income)}
  ${moneyEditor("🧾",tr("expense"),APP.expensesKey,expenses)}
  ${moneyEditor("🏦",tr("saving"),APP.savingsKey,savings)}
  ${moneyEditor("🛒",tr("purchase"),APP.purchaseKey,purchases)}
  ${familyEditor(family)}
 </div>
 <div class="hero-actions">${btn(tr("moneyPdf"),"money-pdf","primary")} ${btn(tr("importPdf"),"import-pdf","secondary")} ${btn(tr("delete"),"delete-local","danger")}</div>
 <div class="notice info">${esc(tr("taxText"))}</div><div class="notice">${esc(tr("privacyText"))}</div>
 </section>`;
}

function moneyEditor(icon,title,key,arr){
 return `<div class="card"><h3>${icon} ${esc(title)}</h3><div class="field"><input id="mDesc_${key}" placeholder="${esc(tr("description"))}"></div><div class="field"><input id="mVal_${key}" type="number" min="0" step=".01" placeholder="${esc(tr("value"))}"></div>${btn(tr("add"),"add-money:"+key,"primary")}<div class="list">${arr.slice(-5).reverse().map(x=>`<div><span>${esc(x.description||title)}</span><strong>$${money(x.amount)}</strong></div>`).join("")||`<div class="empty">${esc(tr("empty"))}</div>`}</div></div>`;
}

function familyEditor(arr){
 return `<div class="card"><h3>👨‍👩‍👧 ${esc(tr("family"))}</h3><div class="field"><input id="familyName" placeholder="${esc(tr("recipient"))}"></div><div class="field"><input id="familyCountry" placeholder="${esc(tr("country"))}"></div>${btn(tr("add"),"add-family","primary")}<div class="list">${arr.map(x=>`<div><span>${esc(x.name)}${x.country?" · "+esc(x.country):""}</span><button class="btn small danger" data-action="remove-family:${x.id}">×</button></div>`).join("")||`<div class="empty">${esc(tr("empty"))}</div>`}</div></div>`;
}

function addMoney(key){
 const d=$(`#mDesc_${key}`)?.value.trim()||tr("value"),v=Number($(`#mVal_${key}`)?.value||0);
 if(!(v>=0))return;
 const a=read(key,[]);a.push({id:id(),description:d,amount:v,date:nowISO()});write(key,a);renderApp("money");toast(tr("save"));
}

function addFamily(){
 const name=$("#familyName")?.value.trim(),country=$("#familyCountry")?.value.trim();
 if(!name){toast(tr("error"));return}
 const a=read(APP.familyKey,[]);a.push({id:id(),name,country,date:nowISO()});write(APP.familyKey,a);renderApp("money")
}

function removeFamily(x){write(APP.familyKey,read(APP.familyKey,[]).filter(a=>a.id!==x));renderApp("money")}

async function assistant(){
 const text=$("#homeText")?.value.trim();if(!text)return;
 try{
  const x=await api("/api/assistant",{method:"POST",body:JSON.stringify({language:APP.lang,text})});
  if(x.need_type==="remittance"){
   if(!APP.session){await startSessionOnly()}
   await parseFreeText(text);
   const s=APP.session||{};
   if(s.amount&&s.destination_country){await doCompare()}
   else{renderApp("send");$("#sendText").value=text}
  }else{
   modal(tr("what"),`<p>${esc(x.message||"")}</p>${btn(tr("money"),"money","primary")} ${btn(tr("send"),"send","secondary")}`)
  }
 }catch(e){toast(e.message)}
}

async function startSessionOnly(){
 const x=await api("/api/service/start",{method:"POST"});APP.session=x.session||APP.session;startAccessTimer(x.seconds_remaining||1200)
}

function helpView(){
 return `<section class="section"><div class="section-title"><button class="btn small secondary" data-action="home">← ${esc(tr("back"))}</button><h1>${esc(tr("help"))}</h1><p>${esc(tr("ask"))}</p></div><div id="helpList" class="grid"><div class="loading">${esc(tr("continue"))}...</div></div></section>`;
}

async function loadHelp(){
 try{const x=await api("/api/help");$("#helpList").innerHTML=(x||[]).map(h=>`<div class="card"><h3>${esc(h.label)}</h3><p>${esc(h.answer)}</p></div>`).join("")}catch(e){toast(e.message)}
}

function modal(title,body){
 document.querySelector(".modal-backdrop")?.remove();
 const d=document.createElement("div");d.className="modal-backdrop";
 d.innerHTML=`<div class="modal"><div class="modal-head"><strong>${esc(title)}</strong><button class="close" data-action="close-modal">×</button></div><div>${body}</div></div>`;
 document.body.appendChild(d);bindActions(d);
}

function simpleInfo(title,text){modal(title,`<p>${esc(text)}</p>${btn(tr("ok"),"close-modal","primary")}`)}

async function learningPdf(pid=null){
 try{
  const d=await api(pid?"/api/learn/"+encodeURIComponent(pid)+"/pdf":"/api/learning-pdf");
  createPrintablePDF(d.steps||[],d.title||tr("learnTitle"),d.notice||"",d.official_url||"");
 }catch(e){toast(e.message)}
}

function pdfText(v){return String(v??"").replace(/[\r\n]+/g," ").replace(/[^\x20-\x7E]/g," ").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}

function makePDF(lines,title,meta){
 const all=[title,...meta,...lines].map(pdfText),chunks=[];
 let cur=[];
 for(const l of all){if((cur.join(" ").length+l.length)>88){chunks.push(cur);cur=[]}cur.push(l)}
 if(cur.length)chunks.push(cur);
 const pages=[];
 chunks.forEach(c=>{let ys=770,stream="BT /F1 11 Tf 50 "+ys+" Td ";c.forEach((l,i)=>{if(i)stream+="0 -16 Td ";stream+="("+l+") Tj "});stream+="ET";pages.push(stream)});
 const objs=[];
 const add=s=>{objs.push(s);return objs.length};
 const catalog=add("<< /Type /Catalog /Pages 2 0 R >>");
 const pagesObj=add("");
 const font=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
 const pageRefs=[];
 pages.forEach(stream=>{const content=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);pageRefs.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`))});
 objs[pagesObj-1]=`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(x=>x+" 0 R").join(" ")}] >>`;
 let pdf="%PDF-1.4\n",offs=[0];
 objs.forEach((o,i)=>{offs[i]=pdf.length;pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const start=pdf.length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=0;i<objs.length;i++)pdf+=String(offs[i]).padStart(10,"0")+" 00000 n \n";pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF`;
 return new Blob([pdf],{type:"application/pdf"});
}

function createPrintablePDF(steps,title,notice,url){
 const lines=[];
 lines.push("REMESAS / May Roga LLC");lines.push("Generated: "+new Date().toLocaleString());
 if(notice)lines.push(notice);
 steps.forEach((s,i)=>{lines.push(`${i+1}. ${s.title||""}`);lines.push(s.purpose||s.teaches||"");if(s.warning)lines.push("Warning: "+s.warning)});
 if(url)lines.push("Official site: "+url);
 const blob=makePDF(lines,title,[tr("learnNotice"),today()]);
 downloadBlob(blob,"REMESAS-guia.pdf");
}

function moneyPDF(){
 const b=moneySummary(),lines=[
  "REMESAS / May Roga LLC","Generated: "+new Date().toLocaleString(),
  "SUMMARY","Total in: $"+money(b.in),"Total out: $"+money(b.out),"Remaining: $"+money(b.remaining),""
 ];
 [["INCOME",APP.moneyKey],["EXPENSES",APP.expensesKey],["SAVINGS",APP.savingsKey],["PURCHASES",APP.purchaseKey]].forEach(([n,k])=>{
  lines.push(n);read(k,[]).forEach(x=>lines.push(`${x.date||""} | ${x.description||""} | $${money(x.amount)}`));lines.push("")
 });
 lines.push("This document contains local records entered by the user.");
 lines.push("It may help organize information for an accountant or tax preparer.");
 lines.push("REMESAS is not tax software and does not prepare or file taxes.");
 lines.push("Independent service by May Roga LLC.");
 const blob=makePDF(lines,"REMESAS - "+tr("money"),[today(),tr("taxText")]);
 downloadBlob(blob,"REMESAS-datos.pdf");
}

function downloadBlob(blob,name){
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)
}

function importPDF(){
 const input=document.createElement("input");input.type="file";input.accept=".pdf,application/pdf";input.onchange=async()=>{
  const f=input.files?.[0];if(!f)return;
  const buf=await f.arrayBuffer(),txt=new TextDecoder("latin1").decode(buf);
  const m=txt.match(/REMESAS_BACKUP_V42=([A-Za-z0-9+/=]+)/);
  if(!m){toast(APP.lang==="es"?"Este PDF no contiene una copia restaurable de REMESAS.":"This PDF does not contain a restorable REMESAS backup.");return}
  try{
   const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1]),c=>c.charCodeAt(0))));
   if(data.money)write(APP.moneyKey,data.money);if(data.expenses)write(APP.expensesKey,data.expenses);if(data.savings)write(APP.savingsKey,data.savings);if(data.purchases)write(APP.purchaseKey,data.purchases);if(data.family)write(APP.familyKey,data.family);
   toast(APP.lang==="es"?"Datos restaurados.":"Data restored.");renderApp("money")
  }catch{toast(tr("error"))}
 };input.click()
}

function deleteLocal(){
 if(!confirm(tr("confirmDelete")))return;
 [APP.moneyKey,APP.expensesKey,APP.savingsKey,APP.purchaseKey,APP.familyKey].forEach(k=>localStorage.removeItem(k));
 toast(APP.lang==="es"?"Datos locales borrados.":"Local data deleted.");renderApp("money")
}

function bindActions(root=document){
 $$(".btn,[data-action]",root).forEach(b=>{
  if(b._bound)return;b._bound=true;
  b.addEventListener("click",async e=>{
   const a=b.dataset.action;if(!a)return;
   if(a==="pay")return pay();
   if(a==="lang")return toggleLang();
   if(a==="home")return renderApp("home");
   if(a==="send")return renderApp("send");
   if(a==="compare")return doCompare();
   if(a==="submit-send")return submitSend();
   if(a==="learn")return loadLearn();
   if(a==="guide")return guide();
   if(a==="money")return renderApp("money");
   if(a==="help"){renderApp("help");return loadHelp()}
   if(a==="assistant")return assistant();
   if(a==="final-refresh")return refreshFinal();
   if(a==="launch")return launchProvider();
   if(a==="learning-pdf")return learningPdf();
   if(a==="money-pdf")return moneyPDF();
   if(a==="import-pdf")return importPDF();
   if(a==="delete-local")return deleteLocal();
   if(a==="add-family")return addFamily();
   if(a.startsWith("add-money:"))return addMoney(a.slice(10));
   if(a.startsWith("remove-family:"))return removeFamily(a.slice(14));
   if(a.startsWith("select:"))return selectProvider(a.slice(7));
   if(a.startsWith("provider-learn:"))return providerLearn(a.slice(15));
   if(a.startsWith("provider-learning-pdf:"))return learningPdf(a.slice(22));
   if(a.startsWith("guide:"))return guide(a.slice(6));
   if(a.startsWith("lesson:"))return lessonModal(Number(a.slice(7)));
   if(a.startsWith("open-url:")){const u=a.slice(9);if(/^https?:\/\//i.test(u))window.open(u,"_blank","noopener,noreferrer");return}
   if(a==="close-modal"){document.querySelector(".modal-backdrop")?.remove();return}
   if(a==="privacy")return simpleInfo(tr("privacy"),tr("privacyText"));
   if(a==="security")return simpleInfo(tr("security"),"Never enter passwords, CVV numbers, security codes, bank credentials or provider login information here.");
   if(a==="legal")return simpleInfo(tr("legal"),tr("supportText"));
  })
 }
}

async function loadLearn(){
 try{const d=await api("/api/learn");renderApp("learn",d)}catch(e){toast(e.message)}
}

function toggleLang(){
 APP.lang=APP.lang==="es"?"en":"es";localStorage.setItem("remesas_lang_v42",APP.lang);
 loadConfig().then(()=>APP.token?renderApp(APP.lastView||"home"):renderGate())
}

document.addEventListener("change",e=>{
 if(e.target?.id==="sendCountry")return;
});

async function boot(){
 const returned=await checkReturnedPayment();if(returned)return;
 await loadConfig();
 if(APP.token){
  try{
   const s=await api("/api/access/status");
   if(s.active){await startService();return}
  }catch{}
  APP.token="";localStorage.removeItem("remesas_access_token_v42")
 }
 renderGate();
}

boot();
