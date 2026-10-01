"use strict";
const APP={name:"REMESAS",version:"4.3.0",lang:localStorage.getItem("remesas_lang_v4")||"es",token:localStorage.getItem("remesas_access_token_v4")||"",session:null,config:null,moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",savingsKey:"remesas_savings_v4",purchasesKey:"remesas_purchases_v4",prefsKey:"remesas_prefs_v4",tapCount:0,tapTimer:null,expiresAt:0,countdown:null};
const $=s=>document.querySelector(s),app=$("#app");
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const val=v=>{if(v===null||v===undefined||v==="")return "";if(typeof v==="object"){if(Array.isArray(v))return v.map(val).filter(Boolean).join(", ");return Object.entries(v).map(([k,x])=>{let z=val(x);return z?`${k}: ${z}`:""}).filter(Boolean).join(" · ")}return String(v)};
const money=(v,c="USD")=>{let n=Number(v||0);try{return n.toLocaleString(APP.lang==="es"?"es-US":"en-US",{style:"currency",currency:c})}catch(e){return `${c} ${n.toFixed(2)}`}};
const now=()=>new Date(),dateTime=()=>now().toLocaleString(APP.lang==="es"?"es-US":"en-US",{dateStyle:"short",timeStyle:"short"}),day=()=>now().toLocaleDateString(APP.lang==="es"?"es-US":"en-US",{weekday:"long"});
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const load=(k,d)=>{try{let x=localStorage.getItem(k);return x===null?d:JSON.parse(x)}catch(e){return d}};
const t=(es,en)=>APP.lang==="es"?es:en;
const arr=x=>Array.isArray(x)?x:x&&typeof x==="object"?Object.values(x):[];
const headers=(json=true)=>{let h={"X-Remesas-Language":APP.lang};if(APP.token)h["X-Remesas-Access-Token"]=APP.token;if(json)h["Content-Type"]="application/json";return h};

async function api(url,opt={}){
  opt.headers={...headers(opt.body!==undefined),...(opt.headers||{})};
  let r=await fetch(url,opt),txt=await r.text(),d={};
  try{d=txt?JSON.parse(txt):{}}catch(e){d={detail:txt}}
  if(!r.ok){
    if(r.status===401||r.status===403){setToken("");APP.session=null;gate()}
    throw new Error(val(d.detail||d.message)||t("No se pudo completar la acción.","The action could not be completed."))
  }
  return d
}

function toast(msg,type=""){
  let x=document.createElement("div");
  x.className="toast "+type;
  x.textContent=val(msg)||t("Listo.","Done.");
  document.body.appendChild(x);
  setTimeout(()=>x.remove(),3500)
}

function setToken(x){
  APP.token=x||"";
  if(APP.token)localStorage.setItem("remesas_access_token_v4",APP.token);
  else localStorage.removeItem("remesas_access_token_v4")
}

function shell(body,title="REMESAS"){
  app.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand"><strong>${esc(title)}</strong><small>May Roga LLC</small></div><div class="top-actions"><button class="btn small lang-btn" id="langBtn">${APP.lang==="es"?"EN":"ES"}</button><button class="btn secondary small" id="homeBtn">⌂</button></div></header>${body}<footer class="footer"><strong>REMESAS ${APP.version}</strong><span>May Roga LLC</span><div class="footer-links"><button class="btn small secondary" data-go="help">${t("Ayuda","Help")}</button><button class="btn small secondary" data-go="privacy">${t("Privacidad","Privacy")}</button></div></footer></div>`;
  bindShell()
}

function bindShell(){
  $("#langBtn")?.addEventListener("click",async()=>{
    APP.lang=APP.lang==="es"?"en":"es";
    localStorage.setItem("remesas_lang_v4",APP.lang);
    await loadConfig();
    await boot()
  });
  $("#homeBtn")?.addEventListener("click",home);
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>route(b.dataset.go)))
}

function legalNotice(){
  return `<div class="notice">${t("REMESAS es un servicio independiente de May Roga LLC. No somos banco, financiera, asesor financiero, transmisor de dinero ni procesador de pagos. No hacemos la transferencia por ti, no controlamos las tarifas de las remesadoras y no garantizamos aprobación, disponibilidad, tipo de cambio, tiempo de entrega ni resultado. Antes de enviar dinero, confirma la información y las condiciones directamente con la remesadora oficial.","REMESAS is an independent service by May Roga LLC. We are not a bank, financial institution, financial advisor, money transmitter or payment processor. We do not execute transfers for you, do not control provider fees, and do not guarantee approval, availability, exchange rates, delivery times or results. Before sending money, confirm information and terms directly with the official remittance provider.")}</div>`
}

const OFFICIAL=[
  {id:"western_union",name:"WESTERN UNION",url:"https://www.westernunion.com/"},
  {id:"moneygram",name:"MONEYGRAM",url:"https://www.moneygram.com/"},
  {id:"remitly",name:"REMITLY",url:"https://www.remitly.com/"},
  {id:"xoom",name:"XOOM",url:"https://www.xoom.com/"}
];

function providerCatalog(){
  let raw=arr(APP.config?.providers),map={};
  raw.forEach(p=>{
    let id=String(p.id||p.provider_id||"").toLowerCase();
    if(id)map[id]=p
  });
  return OFFICIAL.map(o=>{
    let p=map[o.id]||{};
    return {...o,...p,name:o.name,url:p.official_url||p.official_site||p.official_urls?.home||o.url}
  })
}

function gate(){
  app.innerHTML=`<main class="app-shell"><section class="hero"><div class="hero-badge">REMESAS · May Roga LLC</div><h1>${t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER")}</h1><p>${t("Organiza tu dinero, prepara una remesa, aprende el proceso y revisa las opciones oficiales.","Organize your money, prepare a remittance, learn the process and review official options.")}</p><div class="hero-actions"><button class="btn" id="payBtn">${t("Entrar por $10.99 · 20 minutos","Enter for $10.99 · 20 minutes")}</button><button class="btn secondary" id="infoBtn">${t("¿Qué incluye?","What is included?")}</button></div>${legalNotice()}</section><section class="section"><div class="card"><h2>${t("¿Qué puedes resolver aquí?","What can you solve here?")}</h2><div class="grid two"><div class="card"><strong>1. TENGO → GANO → GASTO</strong><p>${t("Ordena lo que tienes, lo que entra y lo que sale.","Organize what you have, what comes in and what goes out.")}</p></div><div class="card"><strong>2. AHORRO → QUIERO → PUEDO</strong><p>${t("Calcula qué puedes guardar, qué quieres comprar y qué puedes hacer.","Calculate what you can save, what you want to buy and what you can do.")}</p></div><div class="card"><strong>3. HAGO</strong><p>${t("Llega a una acción concreta: preparar, revisar y continuar en el sitio oficial.","Reach a concrete action: prepare, review and continue on the official site.")}</p></div><div class="card"><strong>4. 4 REMESADORAS</strong><p>${t("WESTERN UNION · MONEYGRAM · REMITLY · XOOM. Cuando REMESAS no puede resolver un dato con seguridad, te lleva directamente a la fuente oficial.","WESTERN UNION · MONEYGRAM · REMITLY · XOOM. When REMESAS cannot safely resolve a fact, it sends you directly to the official source.")}</p></div></div></div></section><div id="adminModal"></div></main>`;
  $("#payBtn").onclick=pay;
  $("#infoBtn").onclick=serviceInfo;
  tripleTap()
}

function tripleTap(){
  let target=$(".hero");
  if(!target)return;
  target.addEventListener("click",()=>{
    APP.tapCount++;
    clearTimeout(APP.tapTimer);
    APP.tapTimer=setTimeout(()=>APP.tapCount=0,900);
    if(APP.tapCount>=3){APP.tapCount=0;adminModal()}
  })
}

async function serviceInfo(){
  try{
    let d=await fetch("/api/service/info",{headers:headers(false)}).then(r=>r.json());
    modal(t("Servicio","Service"),`<p>${esc(val(d.description)||t("Acceso único de $10.99 por 20 minutos.","One-time access of $10.99 for 20 minutes."))}</p><ul><li>${t("Organización y cálculos del dinero","Money organization and calculations")}</li><li>${t("Preparación de remesas","Remittance preparation")}</li><li>${t("4 REMESADORAS y sus sitios oficiales","4 REMITTANCE PROVIDERS and their official sites")}</li><li>${t("APRENDER y GUÍA RÁPIDA","LEARN and QUICK GUIDE")}</li><li>${t("PDF para guardar y recuperar información cuando el backend lo permita","PDF to save and recover information when supported by the backend")}</li><li>${t("Revisión final y siguiente acción","Final review and next action")}</li></ul>${legalNotice()}`)
  }catch(e){
    modal(t("Servicio","Service"),`<p>${t("Acceso único: $10.99 por 20 minutos.","One-time access: $10.99 for 20 minutes.")}</p>${legalNotice()}`)
  }
}

function adminModal(){
  modal(t("Acceso de administración","Administration access"),`<form id="adminForm" class="form-card"><div class="field"><label>${t("Usuario","Username")}</label><input id="adminUser" autocomplete="username" required></div><div class="field"><label>${t("Contraseña","Password")}</label><input id="adminPass" type="password" autocomplete="current-password" required></div><button class="btn">${t("Entrar","Enter")}</button></form>`);
  $("#adminForm").onsubmit=async e=>{
    e.preventDefault();
    try{
      let d=await api("/api/access/admin",{method:"POST",body:JSON.stringify({username:$("#adminUser").value,password:$("#adminPass").value})});
      setToken(d.token);
      APP.expiresAt=d.expires_at||0;
      closeModal();
      await startService()
    }catch(e){toast(e.message,"error")}
  }
}

async function pay(){
  try{
    let d=await api("/api/create-checkout-session",{method:"POST",body:"{}"});
    if(d.checkout_url)location.href=d.checkout_url;
    else throw new Error(t("No se recibió la página de pago.","Payment page was not received."))
  }catch(e){toast(e.message,"error")}
}

function modal(title,body){
  closeModal();
  let m=document.createElement("div");
  m.className="modal-backdrop";
  m.id="modal";
  m.innerHTML=`<div class="modal"><div class="modal-head"><h2>${esc(title)}</h2><button class="close" id="closeModal">×</button></div><div>${body}</div></div>`;
  document.body.appendChild(m);
  $("#closeModal").onclick=closeModal;
  m.onclick=e=>{if(e.target===m)closeModal()}
}

function closeModal(){$("#modal")?.remove()}

async function checkPayment(){
  let q=new URLSearchParams(location.search);
  if(q.get("payment")==="success"&&q.get("session_id")){
    try{
      let d=await api("/api/payment/check?session_id="+encodeURIComponent(q.get("session_id")));
      if(d.token)setToken(d.token);
      history.replaceState({},document.title,"/");
      if(APP.token){await startService();return true}
    }catch(e){
      history.replaceState({},document.title,"/");
      toast(e.message,"error")
    }
  }
  if(q.get("payment")==="cancelled"){
    history.replaceState({},document.title,"/");
    toast(t("Pago cancelado.","Payment cancelled."))
  }
  return false
}

async function verify(){
  if(!APP.token)return false;
  try{
    let d=await api("/api/access/status");
    if(d.active||d.authorized){APP.expiresAt=d.expires_at||0;return true}
  }catch(e){}
  setToken("");
  return false
}

async function startService(){
  try{
    let d=await api("/api/service/start",{method:"POST",body:JSON.stringify({})});
    APP.session=d.session||d;
    APP.expiresAt=d.expires_at||Date.now()+Number(d.seconds_remaining||1200)*1000;
    home()
  }catch(e){gate();toast(e.message,"error")}
}

async function boot(){
  if(await checkPayment())return;
  if(await verify()){await startService();return}
  gate()
}

function home(){
  if(!APP.token){gate();return}
  let s=APP.session||{},m=load(APP.moneyKey,{income:0,balance:0}),ex=load(APP.expensesKey,[]),fam=load(APP.familyKey,[]),sav=load(APP.savingsKey,[]),pur=load(APP.purchasesKey,[]);
  shell(`<section class="hero"><h1>${t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER")}</h1><p>${t("Empieza donde lo necesites. Tus registros financieros se conservan en este dispositivo.","Start where you need. Your financial records stay on this device.")}</p><div class="hero-actions"><button class="btn" data-action="send">${t("PREPARAR REMESA","PREPARE REMITTANCE")}</button><button class="btn secondary" data-action="learn">${t("APRENDER","LEARN")}</button><button class="btn secondary" data-action="compare">${t("COMPARAR","COMPARE")}</button></div></section><section class="section"><h2 class="section-title">${t("TENGO → GANO → GASTO → AHORRO → QUIERO → PUEDO → HAGO","HAVE → EARN → SPEND → SAVE → WANT → CAN → DO")}</h2><div class="grid three"><button class="action-card" data-action="money"><span class="action-icon">💵</span><strong>TENGO</strong><small>${t("Lo que tienes ahora","What you have now")}</small></button><button class="action-card" data-action="income"><span class="action-icon">➕</span><strong>GANO</strong><small>${t("Lo que entra","What comes in")}</small></button><button class="action-card" data-action="expenses"><span class="action-icon">➖</span><strong>GASTO</strong><small>${t("Lo que sale","What goes out")}</small></button><button class="action-card" data-action="savings"><span class="action-icon">🏦</span><strong>AHORRO</strong><small>${t("Lo que guardas","What you save")}</small></button><button class="action-card" data-action="purchase"><span class="action-icon">🛒</span><strong>QUIERO</strong><small>${t("Lo que planeas comprar","What you plan to buy")}</small></button><button class="action-card" data-action="week"><span class="action-icon">📅</span><strong>PUEDO</strong><small>${t("Lo que puedes hacer","What you can do")}</small></button><button class="action-card" data-action="hago"><span class="action-icon">✅</span><strong>HAGO</strong><small>${t("La siguiente acción real","The next real action")}</small></button></div></section><section class="section"><div class="balance-grid"><div class="balance"><small>${t("Disponible","Available")}</small><strong>${money(Number(m.balance||0))}</strong></div><div class="balance"><small>${t("Gastos registrados","Recorded expenses")}</small><strong>${ex.length}</strong></div><div class="balance"><small>${t("Familia","Family")}</small><strong>${fam.length}</strong></div><div class="balance"><small>${t("Ahorros","Savings")}</small><strong>${sav.length}</strong></div><div class="balance"><small>${t("Planes de compra","Purchase plans")}</small><strong>${pur.length}</strong></div></div></section><section class="section"><div class="card"><h2>${t("También puedes","You can also")}</h2><div class="hero-actions"><button class="btn secondary" data-action="guide">${t("GUÍA RÁPIDA","QUICK GUIDE")}</button><button class="btn secondary" data-action="pdf">${t("PDF DE MI DINERO","MY MONEY PDF")}</button><button class="btn secondary" data-action="learnpdf">${t("PDF APRENDER","LEARN PDF")}</button><button class="btn secondary" data-action="restorepdf">${t("RECUPERAR DESDE PDF","RESTORE FROM PDF")}</button><button class="btn secondary" data-action="help">${t("AYUDA","HELP")}</button></div></div></section><section class="section">${legalNotice()}<div class="notice">${t("Acceso temporal:","Temporary access:")} <strong id="countdown"></strong></div></section>`);
  document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>route(b.dataset.action));
  startCountdown()
}

function startCountdown(){
  clearInterval(APP.countdown);
  let f=()=>{
    let sec=Math.max(0,Math.floor((new Date(APP.expiresAt).getTime()-Date.now())/1000)),mm=Math.floor(sec/60),ss=String(sec%60).padStart(2,"0"),x=$("#countdown");
    if(x)x.textContent=`${mm}:${ss}`;
    if(sec<=0){
      clearInterval(APP.countdown);
      setToken("");
      APP.session=null;
      gate();
      toast(t("Tu acceso terminó.","Your access ended."))
    }
  };
  f();
  APP.countdown=setInterval(f,1000)
}

async function route(x){
  if(x==="send")return send();
  if(x==="learn")return learn();
  if(x==="compare")return compare();
  if(x==="money")return moneyPage();
  if(x==="income")return incomePage();
  if(x==="expenses")return expensesPage();
  if(x==="savings")return savingsPage();
  if(x==="purchase")return purchasePage();
  if(x==="week")return weekPage();
  if(x==="hago")return hago();
  if(x==="guide")return guide();
  if(x==="pdf")return moneyPDF();
  if(x==="learnpdf")return learningPDF();
  if(x==="restorepdf")return restorePDF();
  if(x==="help")return help();
  if(x==="privacy")return privacy()
}

function back(title,content){
  shell(`<section class="section"><button class="btn secondary small" id="back">← ${t("Volver","Back")}</button><div class="section-title"><h1>${esc(title)}</h1></div>${content}</section>`);
  $("#back").onclick=home
}

function countryOptions(selected=""){
  return `<option value="">${t("Selecciona el país","Select country")}</option>`+arr(APP.config?.countries).map(c=>{
    let code=c.code||c.id||"",name=c.name_es||c.name_en||c.name||c.label||code;
    return `<option value="${esc(code)}" ${String(selected).toUpperCase()===String(code).toUpperCase()?"selected":""}>${esc(name)}</option>`
  }).join("")
}

async function send(){
  let s=APP.session||{};
  back(t("PREPARAR UNA REMESA","PREPARE A REMITTANCE"),`<div class="form-card"><p>${t("Dime solo lo necesario. Yo convierto tus respuestas en una siguiente acción clara.","Tell me only what is needed. I turn your answers into a clear next action.")}</p><div class="field"><label>${t("¿Cuánto quieres enviar?","How much do you want to send?")}</label><input id="amount" type="number" min=".01" max="1000000" step=".01" value="${esc(s.amount||"")}" placeholder="200"></div><div class="field"><label>${t("¿A qué país?","Which country?")}</label><select id="country">${countryOptions(s.destination_country||"")}</select></div><div class="field"><label>${t("¿Qué necesitas?","What do you need?")}</label><select id="priority"><option value="">${t("Todavía no lo sé","I don't know yet")}</option><option value="fastest">${t("Que llegue rápido","Arrive fast")}</option><option value="save">${t("Pagar menos","Pay less")}</option><option value="recipient_gets_more">${t("Que reciba más","Recipient gets more")}</option><option value="balanced">${t("Un equilibrio","Balanced")}</option></select></div><div class="field"><label>${t("También puedes explicarlo con tus palabras","You can also explain it in your own words")}</label><textarea id="needText" rows="4" placeholder="${t("Ej. Quiero enviar $200 a México y necesito saber cuál me conviene.","Example: I want to send $200 to Mexico and need to know which option fits me.")}"></textarea></div><button class="btn" id="continueNeed">${t("CALCULAR Y ORIENTARME","CALCULATE AND GUIDE ME")}</button><div class="notice">${t("Si un dato comercial no puede resolverse con seguridad, no se inventa: recibirás el sitio oficial para confirmarlo.","If a commercial fact cannot be safely resolved, it is not invented: you will receive the official site to confirm it.")}</div></div>`);
  $("#continueNeed").onclick=submitNeed
}

async function submitNeed(){
  let amount=Number($("#amount")?.value),country=$("#country")?.value||"",text=$("#needText")?.value.trim()||"",priority=$("#priority")?.value||null;
  if(!amount||amount<.01||!country){
    toast(t("Necesito el monto y el país para calcular y orientarte.","I need the amount and country to calculate and guide you."),"error");
    return
  }
  try{
    let sid=APP.session?.session_id;
    if(!sid){
      let nd=await api("/api/need",{method:"POST",body:JSON.stringify({language:APP.lang,amount,send_currency:"USD",destination_country:country,priority,free_text:text||null})});
      APP.session=nd.session||APP.session;
      sid=APP.session?.session_id
    }
    if(text&&sid){
      let pd=await api("/api/session/"+encodeURIComponent(sid)+"/need/parse",{method:"POST",body:JSON.stringify({language:APP.lang,text,current_amount:amount,current_destination_country:country})});
      APP.session=pd.session||APP.session;
      sid=APP.session?.session_id||sid
    }
    if(!sid)throw new Error(t("No se pudo crear la sesión de preparación.","The preparation session could not be created."));
    let d=await api("/api/session/"+encodeURIComponent(sid)+"/compare",{method:"POST",body:JSON.stringify({language:APP.lang,amount,send_currency:"USD",destination_country:country,priority})});
    APP.session=d.session||APP.session;
    showComparison(d)
  }catch(e){toast(e.message,"error")}
}

function compare(){
  let s=APP.session||{};
  back(t("COMPARAR","COMPARE"),`<div class="form-card"><p>${t("Primero te doy una orientación. Luego, cuando haga falta, te llevo al sitio oficial para confirmar el dato real antes de actuar.","First I guide you. When needed, I then send you to the official site to confirm the real fact before acting.")}</p><div class="field"><label>${t("Monto","Amount")}</label><input id="cmpAmount" type="number" min=".01" max="1000000" value="${esc(s.amount||"")}"></div><div class="field"><label>${t("País","Country")}</label><select id="cmpCountry">${countryOptions(s.destination_country||"")}</select></div><div class="field"><label>${t("Prioridad","Priority")}</label><select id="cmpPriority"><option value="">${t("Equilibrio","Balanced")}</option><option value="fastest">${t("Rapidez","Speed")}</option><option value="save">${t("Menor costo","Lower cost")}</option><option value="recipient_gets_more">${t("Más para recibir","More for recipient")}</option></select></div><button class="btn" id="doCompare">${t("COMPARAR Y DARME UNA ACCIÓN","COMPARE AND GIVE ME AN ACTION")}</button></div>`);
  $("#doCompare").onclick=async()=>{
    let amount=Number($("#cmpAmount")?.value),country=$("#cmpCountry")?.value||"",priority=$("#cmpPriority")?.value||null;
    if(!amount||!country){
      toast(t("Completa monto y país. Así puedo darte un resultado útil.","Complete amount and country so I can give you a useful result."),"error");
      return
    }
    try{
      if(!APP.session?.session_id){
        let n=await api("/api/need",{method:"POST",body:JSON.stringify({language:APP.lang,amount,send_currency:"USD",destination_country:country,priority})});
        APP.session=n.session||APP.session
      }
      let d=await api("/api/session/"+encodeURIComponent(APP.session.session_id)+"/compare",{method:"POST",body:JSON.stringify({language:APP.lang,amount,send_currency:"USD",destination_country:country,priority})});
      APP.session=d.session||APP.session;
      showComparison(d)
    }catch(e){toast(e.message,"error")}
  }
}

function providerStatus(p){
  let s=String(p.status||p.commercial_status||p.commercial_data?.status||"").toLowerCase();
  return s==="verified"?"verified":"official"
}

function showComparison(d){
  let r=arr(d.results),a=arr(d.available_providers),items=r.length?r:a;
  if(!items.length)items=providerCatalog();
  let byId={};
  items.forEach(p=>{byId[String(p.provider_id||p.id||p.name||"").toLowerCase()]=p});
  let cards=providerCatalog().map(base=>{
    let p=byId[base.id]||base;
    return {...base,...p,name:base.name,url:p.official_url||p.official_site||p.official_urls?.home||base.url}
  });
  let explanation=val(d.explanation)||t("Aquí no se adivinan tarifas, tasas ni tiempos. Cuando el dato no puede confirmarse, la solución es abrir la fuente oficial.","Fees, rates and delivery times are not guessed here. When a fact cannot be confirmed, the solution is to open the official source.");
  back(t("RESULTADO · 4 REMESADORAS","RESULT · 4 REMITTANCE PROVIDERS"),`<div class="notice"><strong>${esc(explanation)}</strong></div><div class="grid two provider-grid">${cards.map(p=>providerCard(p,d)).join("")}</div><div class="card"><h2>${t("¿Qué hago ahora?","What do I do now?")}</h2><p>${esc(val(d.message)||t("Elige la remesadora que quieres revisar. Si no hay un dato seguro, abre su sitio oficial y confirma allí antes de enviar.","Choose the provider you want to review. If a fact is not certain, open its official site and confirm it before sending."))}</p></div>${legalNotice()}`);
  document.querySelectorAll("[data-provider]").forEach(b=>b.onclick=async()=>{
    let id=b.dataset.provider;
    try{
      if(!APP.session?.session_id){
        toast(t("Primero prepara la remesa para seleccionar una opción.","Prepare the remittance first to select an option."),"error");
        return
      }
      let x=await api("/api/session/"+encodeURIComponent(APP.session.session_id)+"/select/"+encodeURIComponent(id),{method:"POST",body:"{}"});
      APP.session=x.session||APP.session;
      finalCheck()
    }catch(e){toast(e.message,"error")}
  })
}

function providerCard(p,d){
  let id=p.provider_id||p.id||"",name=String(p.name||id||"REMESADORA").toUpperCase(),url=p.official_url||p.official_site||p.official_urls?.home||"",status=providerStatus(p),fee=p.fee??p.commercial_data?.fee,rate=p.exchange_rate??p.commercial_data?.exchange_rate,time=p.estimated_delivery??p.delivery_time??p.commercial_data?.delivery_time,rec=p.recipient_amount??p.commercial_data?.recipient_amount,cur=p.recipient_currency??p.commercial_data?.currency??"";
  let metrics=[];
  if(status==="verified"){
    if(fee!==null&&fee!==undefined&&fee!=="")metrics.push(`<div class="metric"><small>${t("Tarifa","Fee")}</small><strong>${esc(val(fee))}</strong></div>`);
    if(rate!==null&&rate!==undefined&&rate!=="")metrics.push(`<div class="metric"><small>${t("Tasa","Rate")}</small><strong>${esc(val(rate))}</strong></div>`);
    if(rec!==null&&rec!==undefined&&rec!=="")metrics.push(`<div class="metric"><small>${t("Recibe","Recipient gets")}</small><strong>${esc(money(rec,cur||"USD"))}</strong></div>`);
    if(time)metrics.push(`<div class="metric"><small>${t("Entrega","Delivery")}</small><strong>${esc(val(time))}</strong></div>`)
  }
  let reason=val(p.relevance_reason)||val(p.important_condition)||t("Revisa las condiciones antes de enviar.","Review conditions before sending.");
  return `<div class="provider-card"><div class="provider-head"><h2>${esc(name)}</h2><span class="provider-status ${status}">${status==="verified"?t("DATO VERIFICADO","VERIFIED DATA"):t("CONFIRMAR EN SITIO OFICIAL","CONFIRM ON OFFICIAL SITE")}</span></div>${metrics.length?`<div class="provider-data">${metrics.join("")}</div>`:`<div class="provider-data\"><p><strong>${t("No voy a inventar este dato.","I will not invent this fact.")}</strong></p><p>${t("La respuesta correcta es confirmar directamente con la remesadora oficial.","The correct answer is to confirm directly with the official provider.")}</p></div>`}<p>${esc(reason)}</p><div class="hero-actions">${APP.session?.session_id?`<button class="btn small" data-provider="${esc(id)}">${t("USAR ESTA OPCIÓN","USE THIS OPTION")}</button>`:""}${url?`<a class="btn secondary small" href="${esc(url)}" target="_blank" rel="noopener">${t("SITIO OFICIAL","OFFICIAL SITE")}</a>`:""}</div></div>`
}

async function finalCheck(){
  try{
    let d=await api("/api/session/"+encodeURIComponent(APP.session.session_id)+"/final-check",{method:"POST",body:"{}"}),raw=d.checks||[],checks=Array.isArray(raw)?raw:Object.entries(raw).map(([k,v])=>({id:k,label:k,value:v,status:v===true?"ok":v===false?"review":"review",complete:v===true}));
    let items=checks.map(c=>{
      let label=val(c.label||c.id),v=c.value;
      return `<div class="check-row"><span>${esc(label)}</span><strong>${c.complete===true||c.status==="ok"?"✓":c.status==="unavailable"?t("CONFIRMAR","CONFIRM"):esc(val(v)||t("REVISAR","REVIEW"))}</strong></div>`
    }).join("");
    let selected=APP.session?.selected_option||{},url=selected.official_url||selected.official_site||selected.official_urls?.home||"";
    back(t("REVISIÓN FINAL · HAGO","FINAL REVIEW · DO"),`<div class="card"><h2>${t("Antes de enviar dinero","Before sending money")}</h2><p>${esc(val(d.message)||t("Revisa cada punto. Si algo no puede confirmarse aquí, la acción correcta es confirmar en el sitio oficial.","Review each point. If something cannot be confirmed here, the correct action is to confirm it on the official site."))}</p><div class="list">${items||`<div class="check-row"><span>${t("Confirmación final","Final confirmation")}</span><strong>${t("Revisa el sitio oficial","Review official site")}</strong></div>`}</div><div class="notice">${esc(val(d.important_note)||t("REMESAS no ejecuta la transferencia. La decisión final y el envío ocurren con la remesadora oficial.","REMESAS does not execute the transfer. The final decision and sending occur with the official provider."))}</div><div class="hero-actions">${url?`<button class="btn" id="officialFinal">${t("IR AL SITIO OFICIAL","GO TO OFFICIAL SITE")}</button>`:""}<button class="btn secondary" id="finalHelp">${t("NECESITO AYUDA","I NEED HELP")}</button></div></div>${legalNotice()}`);
    $("#officialFinal")?.addEventListener("click",()=>window.open(url,"_blank","noopener"));
    $("#finalHelp")?.addEventListener("click",help)
  }catch(e){toast(e.message,"error")}
}

async function learn(){
  try{
    let d=await api("/api/learn"),lessons=arr(d.lessons),providers=providerCatalog();
    back(t("APRENDER","LEARN"),`<div class="notice">${esc(val(d.notice)||t("Contenido educativo original. No es entrenamiento oficial de una remesadora.","Original educational content. It is not official provider training."))}</div><div class="grid two">${lessons.map((l,i)=>`<button class="action-card" data-lesson="${i}"><span class="action-icon">📘</span><strong>${esc(val(l.title||l.name)||`Lección ${i+1}`)}</strong><small>${esc(val(l.purpose||l.description)||"")}</small></button>`).join("")}</div><section class="section"><h2>${t("4 REMESADORAS","4 REMITTANCE PROVIDERS")}</h2><div class="grid two">${providers.map(p=>`<button class="action-card" data-learnprovider="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${t("Proceso general y sitio oficial","General process and official site")}</small></button>`).join("")}</div></section>${legalNotice()}`);
    document.querySelectorAll("[data-lesson]").forEach(b=>b.onclick=()=>lesson(lessons[Number(b.dataset.lesson)]));
    document.querySelectorAll("[data-learnprovider]").forEach(b=>b.onclick=()=>providerLearn(b.dataset.learnprovider))
  }catch(e){toast(e.message,"error")}
}

function lesson(l){
  if(!l)return;
  let teach=arr(l.teaches||l.checklist||l.steps);
  back(esc(val(l.title)||t("Lección","Lesson")),`<div class="card"><h2>${esc(val(l.purpose||l.description)||t("Esto te ayuda a entender qué hacer.","This helps you understand what to do."))}</h2>${teach.map(x=>`<div class="check-row">✓ <span>${esc(val(typeof x==="string"?x:x.text||x.title||x.description)||t("Paso explicado","Explained step"))}</span></div>`).join("")}<div class="notice">${esc(val(arr(l.warnings).join(" · "))||t("Si una condición depende del proveedor, confírmala en el sitio oficial.","If a condition depends on the provider, confirm it on the official site."))}</div></div>`)
}

async function providerLearn(id){
  try{
    let d=await api("/api/learn/"+encodeURIComponent(id)),base=providerCatalog().find(p=>p.id===id)||{},url=d.official_url||d.official_site||base.url,steps=arr(d.steps||d.lessons);
    back(esc(String(d.title||base.name||id).toUpperCase()),`<div class="notice">${esc(val(d.disclaimer)||t("Información educativa. Las condiciones reales deben confirmarse con la remesadora.","Educational information. Real conditions must be confirmed with the provider."))}</div><div class="card">${steps.map((x,i)=>`<div class="check-row"><strong>${i+1}.</strong><span>${esc(val(x.title||x.step||x.description||x)||t("Paso","Step"))}</span></div>`).join("")||`<p>${t("No hay pasos adicionales. La siguiente acción es abrir el sitio oficial.","There are no additional steps. The next action is to open the official site.")}</p>`}</div>${url?`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${t("CONFIRMAR EN SITIO OFICIAL","CONFIRM ON OFFICIAL SITE")}</a>`:""}${legalNotice()}`)
  }catch(e){toast(e.message,"error")}
}

async function guide(){
  try{
    let d=await api("/api/quick-guide"),steps=arr(d.steps);
    back(t("GUÍA RÁPIDA","QUICK GUIDE"),`<div class="card">${steps.map((x,i)=>`<div class="check-row"><strong>${i+1}.</strong><span>${esc(val(typeof x==="string"?x:x.title||x.description||x)||t("Paso explicado","Explained step"))}</span></div>`).join("")}</div><div class="notice">${esc(val(d.final_action)||t("Revisa siempre la remesadora oficial antes de enviar.","Always review the official provider before sending."))}</div>${legalNotice()}`)
  }catch(e){toast(e.message,"error")}
}

async function help(){
  try{
    let d=await api("/api/help"),topics=Array.isArray(d)?d:arr(d.topics||d);
    back(t("AYUDA","HELP"),`<div class="grid two">${topics.map((x,i)=>`<button class="action-card" data-help="${esc(x.id||String(i))}"><strong>${esc(val(x.label||x.title)||t("Ayuda","Help"))}</strong><small>${esc(val(x.answer||x.description)||t("Pulsa para ver la explicación.","Tap to see the explanation."))}</small></button>`).join("")}</div>${legalNotice()}`);
    document.querySelectorAll("[data-help]").forEach(b=>b.onclick=()=>{
      let x=topics.find((z,i)=>String(z.id||i)===b.dataset.help);
      modal(val(x?.label||x?.title)||t("Ayuda","Help"),`<p>${esc(val(x?.answer||x?.description)||t("Revisa la guía y, si el dato depende de una remesadora, abre su sitio oficial.","Review the guide and, if the fact depends on a provider, open its official site."))}</p>`)
    })
  }catch(e){toast(e.message,"error")}
}

function privacy(){
  back(t("PRIVACIDAD Y SEGURIDAD","PRIVACY AND SECURITY"),`<div class="privacy"><h2>${t("Tus datos de dinero","Your money data")}</h2><p>${t("Los registros de dinero, gastos, familia, ahorros y compras se guardan localmente en este navegador.","Money, expense, family, savings and purchase records are stored locally in this browser.")}</p><p>${t("REMESAS no pide contraseñas bancarias, contraseñas de proveedores, CVV, OTP ni números completos de tarjeta.","REMESAS does not ask for bank passwords, provider passwords, CVV, OTP or full card numbers.")}</p><p>${t("No hacemos transferencias ni enviamos formularios por ti.","We do not execute transfers or submit forms for you.")}</p><button class="btn danger" id="deleteLocal">${t("BORRAR MIS DATOS","DELETE MY DATA")}</button><button class="btn secondary" id="importBtn">${t("RECUPERAR DESDE PDF","RESTORE FROM PDF")}</button><input id="pdfFile" type="file" accept=".pdf" class="hidden">${legalNotice()}</div>`);
  $("#deleteLocal").onclick=()=>{
    [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.savingsKey,APP.purchasesKey,APP.prefsKey].forEach(k=>localStorage.removeItem(k));
    toast(t("Tus datos locales fueron borrados.","Your local data was deleted."));
    home()
  };
  $("#importBtn").onclick=()=>$("#pdfFile").click();
  $("#pdfFile").onchange=e=>restorePDF(e.target.files[0])
}

function moneyPage(){
  let m=load(APP.moneyKey,{income:0,balance:0});
  back(t("TENGO · MI DINERO","HAVE · MY MONEY"),`<form id="moneyForm" class="form-card"><p>${t("Aquí ves el punto de partida para los demás cálculos.","This is the starting point for the other calculations.")}</p><div class="field"><label>${t("Dinero disponible ahora","Money available now")}</label><input id="balance" type="number" step=".01" min="0" value="${Number(m.balance||0)}"></div><div class="field"><label>${t("Ingreso acumulado","Total income")}</label><input id="income" type="number" step=".01" min="0" value="${Number(m.income||0)}"></div><button class="btn">${t("GUARDAR Y CALCULAR","SAVE AND CALCULATE")}</button></form>`);
  $("#moneyForm").onsubmit=e=>{
    e.preventDefault();
    let balance=Math.max(0,Number($("#balance").value||0)),income=Math.max(0,Number($("#income").value||0));
    save(APP.moneyKey,{balance,income,updated_at:dateTime()});
    toast(t(`Disponible registrado: ${money(balance)}.`,`Recorded available: ${money(balance)}.`));
    home()
  }
}

function incomePage(){
  let m=load(APP.moneyKey,{income:0,balance:0});
  back(t("GANO · LO QUE ENTRA","EARN · WHAT COMES IN"),`<form id="incomeForm" class="form-card"><p>${t("Registra el dinero que entra para que PUEDO pueda calcular mejor.","Record incoming money so CAN can calculate better.")}</p><div class="field"><label>${t("Ingreso acumulado","Total income")}</label><input id="income" type="number" min="0" step=".01" value="${Number(m.income||0)}"></div><button class="btn">${t("GUARDAR INGRESO","SAVE INCOME")}</button></form>`);
  $("#incomeForm").onsubmit=e=>{
    e.preventDefault();
    let income=Math.max(0,Number($("#income").value||0));
    save(APP.moneyKey,{...load(APP.moneyKey,{balance:0}),income,updated_at:dateTime()});
    toast(t(`Ingreso acumulado: ${money(income)}.`,`Total income: ${money(income)}.`));
    home()
  }
}

function expensesPage(){
  let a=load(APP.expensesKey,[]);
  back(t("GASTO · LO QUE SALE","SPEND · WHAT GOES OUT"),`<form id="expForm" class="form-card"><div class="field"><label>${t("¿En qué gastaste?","What did you spend on?")}</label><input id="desc" required></div><div class="field"><label>${t("Cantidad","Amount")}</label><input id="val" type="number" step=".01" min=".01" required></div><button class="btn">${t("REGISTRAR GASTO","RECORD EXPENSE")}</button></form><div class="list">${a.map((x,i)=>`<div class="check-row"><span>${esc(val(x.desc))}</span><strong>${money(x.amount)}</strong><button class="btn danger small" data-del="${i}">×</button></div>`).join("")||`<div class="empty">${t("Todavía no hay gastos. Registra el primero para empezar el cálculo.","No expenses yet. Record the first one to start the calculation.")}</div>`}</div>`);
  $("#expForm").onsubmit=e=>{
    e.preventDefault();
    let amount=Number($("#val").value||0),desc=$("#desc").value.trim();
    if(!desc||amount<=0)return toast(t("Necesito descripción y cantidad.","I need a description and amount."),"error");
    a.push({desc,amount,date:dateTime()});
    save(APP.expensesKey,a);
    toast(t(`Gasto registrado: ${money(amount)}.`,`Expense recorded: ${money(amount)}.`));
    expensesPage()
  };
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    a.splice(Number(b.dataset.del),1);
    save(APP.expensesKey,a);
    expensesPage()
  })
}

function savingsPage(){
  let a=load(APP.savingsKey,[]),total=a.reduce((z,x)=>z+Number(x.amount||0),0);
  back(t("AHORRO · LO QUE GUARDO","SAVE · WHAT I KEEP"),`<div class="notice">${t("Total guardado:","Total saved:")} <strong>${money(total)}</strong></div><form id="savForm" class="form-card"><div class="field"><label>${t("¿Para qué ahorras?","What are you saving for?")}</label><input id="goal" required></div><div class="field"><label>${t("Cantidad","Amount")}</label><input id="savVal" type="number" step=".01" min=".01" required></div><button class="btn">${t("GUARDAR AHORRO","SAVE SAVING")}</button></form><div class="list">${a.map(x=>`<div class="check-row"><span>${esc(val(x.goal))}</span><strong>${money(x.amount)}</strong></div>`).join("")||`<div class="empty">${t("Todavía no hay ahorros registrados.","No savings recorded yet.")}</div>`}</div>`);
  $("#savForm").onsubmit=e=>{
    e.preventDefault();
    let amount=Number($("#savVal").value||0),goal=$("#goal").value.trim();
    if(!goal||amount<=0)return toast(t("Necesito objetivo y cantidad.","I need a goal and amount."),"error");
    a.push({goal,amount,date:dateTime()});
    save(APP.savingsKey,a);
    toast(t(`Ahorro registrado: ${money(amount)}.`,`Saving recorded: ${money(amount)}.`));
    savingsPage()
  }
}

function purchasePage(){
  let a=load(APP.purchasesKey,[]);
  back(t("QUIERO · COMPRAS","WANT · PURCHASES"),`<form id="purForm" class="form-card"><div class="field"><label>${t("¿Qué quieres comprar?","What do you want to buy?")}</label><input id="item" required></div><div class="field"><label>${t("Costo estimado","Estimated cost")}</label><input id="cost" type="number" step=".01" min=".01" required></div><button class="btn">${t("GUARDAR PLAN","SAVE PLAN")}</button></form><div class="list">${a.map(x=>`<div class="check-row"><span>${esc(val(x.item))}</span><strong>${money(x.cost)}</strong></div>`).join("")||`<div class="empty">${t("No hay compras planeadas.","No planned purchases.")}</div>`}</div>`);
  $("#purForm").onsubmit=e=>{
    e.preventDefault();
    let cost=Number($("#cost").value||0),item=$("#item").value.trim();
    if(!item||cost<=0)return toast(t("Necesito producto y costo.","I need an item and cost."),"error");
    a.push({item,cost,date:dateTime()});
    save(APP.purchasesKey,a);
    toast(t(`Plan registrado: ${item} por ${money(cost)}.`,`Plan recorded: ${item} for ${money(cost)}.`));
    purchasePage()
  }
}

function weekPage(){
  let m=load(APP.moneyKey,{income:0,balance:0}),e=load(APP.expensesKey,[]),s=load(APP.savingsKey,[]),spent=e.reduce((a,x)=>a+Number(x.amount||0),0),saved=s.reduce((a,x)=>a+Number(x.amount||0),0),available=Number(m.balance||0)-spent-saved,income=Number(m.income||0),weekly=income>0?income/4:0;
  back(t("PUEDO · MI SEMANA","CAN · MY WEEK"),`<div class="balance-grid"><div class="balance"><small>${t("Disponible registrado","Recorded available")}</small><strong>${money(m.balance)}</strong></div><div class="balance"><small>${t("Gastos registrados","Recorded expenses")}</small><strong>${money(spent)}</strong></div><div class="balance"><small>${t("Ahorros registrados","Recorded savings")}</small><strong>${money(saved)}</strong></div><div class="balance"><small>${t("Después de registros","After records")}</small><strong>${money(available)}</strong></div></div><div class="card"><h2>${t("Orientación","Guidance")}</h2><p>${income>0?t(`Con ${money(income)} de ingreso acumulado, una referencia simple de 4 semanas es ${money(weekly)} por semana. Esto es una referencia matemática, no una promesa de gasto seguro.`,`With ${money(income)} in total income, a simple 4-week reference is ${money(weekly)} per week. This is a mathematical reference, not a promise of safe spending.`):t("Aún no hay ingreso acumulado suficiente para calcular una referencia semanal.","There is not enough recorded income to calculate a weekly reference yet.")}</p></div><div class="notice">${t("El cálculo usa solo los datos que tú registraste en este dispositivo.","This calculation uses only the data you recorded on this device.")}</div>`)
}

function hago(){
  let m=load(APP.moneyKey,{income:0,balance:0}),e=load(APP.expensesKey,[]),s=load(APP.savingsKey,[]),spent=e.reduce((a,x)=>a+Number(x.amount||0),0),saved=s.reduce((a,x)=>a+Number(x.amount||0),0),free=Number(m.balance||0)-spent-saved;
  back(t("HAGO · SIGUIENTE ACCIÓN","DO · NEXT ACTION"),`<div class="card"><h2>${t("Ya no necesitas otra pregunta. Necesitas una acción.","You do not need another question. You need an action.")}</h2><p>${t(`Con los datos registrados, tienes ${money(free)} después de gastos y ahorros registrados.`,`With the recorded data, you have ${money(free)} after recorded expenses and savings.`)}</p><div class="hero-actions"><button class="btn" id="goSend">${t("PREPARAR REMESA","PREPARE REMITTANCE")}</button><button class="btn secondary" id="goCompare">${t("COMPARAR 4 REMESADORAS","COMPARE 4 PROVIDERS")}</button></div></div>${legalNotice()}`);
  $("#goSend").onclick=send;
  $("#goCompare").onclick=compare
}

function pdfPayload(){
  return {format:"REMESAS_PDF",version:APP.version,created_at:new Date().toISOString(),language:APP.lang,money:load(APP.moneyKey,{income:0,balance:0}),expenses:load(APP.expensesKey,[]),family:load(APP.familyKey,[]),savings:load(APP.savingsKey,[]),purchases:load(APP.purchasesKey,[])}
}

function encodePDFData(){
  try{return btoa(unescape(encodeURIComponent(JSON.stringify(pdfPayload()))))}
  catch(e){return ""}
}

function pdfBase(title,body){
  let w=window.open("","_blank");
  if(!w){
    toast(t("El navegador bloqueó la ventana. Permite ventanas emergentes para crear el PDF.","The browser blocked the window. Allow pop-ups to create the PDF."),"error");
    return
  }
  let html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#172033}h1{margin-bottom:4px}.box{border:1px solid #ddd;border-radius:10px;padding:15px;margin:15px 0}.row{display:flex;justify-content:space-between;gap:20px;padding:7px 0;border-bottom:1px solid #eee}.notice{margin-top:25px;padding:12px;background:#f4f7fb}.footer{margin-top:35px;font-size:12px;color:#667085}</style></head><body><h1>${esc(title)}</h1><small>${esc(day())} · ${esc(dateTime())}</small>${body}<div class="notice">${t("Este PDF es un registro generado por REMESAS para ayudarte a conservar y recuperar la información. No es software de impuestos y no sustituye los documentos oficiales.","This PDF is a REMESAS record to help you keep and recover information. It is not tax software and does not replace official documents.")}</div><div class="footer">May Roga LLC · REMESAS ${APP.version}</div><div style="font-size:1px;line-height:1px;color:#fff;overflow:hidden;max-height:1px">REMESAS_DATA:${encodePDFData()}</div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  w.document.write(html);
  w.document.close()
}

function moneyPDF(){
  let m=load(APP.moneyKey,{income:0,balance:0}),e=load(APP.expensesKey,[]),s=load(APP.savingsKey,[]),p=load(APP.purchasesKey,[]);
  let body=`<div class="box"><h2>${t("Resumen","Summary")}</h2><div class="row"><span>${t("Disponible","Available")}</span><b>${money(m.balance)}</b></div><div class="row"><span>${t("Ingresos","Income")}</span><b>${money(m.income)}</b></div><div class="row"><span>${t("Gastos","Expenses")}</span><b>${money(e.reduce((a,x)=>a+Number(x.amount||0),0))}</b></div><div class="row"><span>${t("Ahorros","Savings")}</span><b>${money(s.reduce((a,x)=>a+Number(x.amount||0),0))}</b></div></div><div class="box"><h2>${t("Registros","Records")}</h2>${e.map(x=>`<div class="row"><span>${esc(val(x.desc))}</span><b>${money(x.amount)}</b></div>`).join("")}${s.map(x=>`<div class="row"><span>${esc(val(x.goal))}</span><b>${money(x.amount)}</b></div>`).join("")}${p.map(x=>`<div class="row"><span>${esc(val(x.item))}</span><b>${money(x.cost)}</b></div>`).join("")}</div>`;
  pdfBase(t("REMESAS · MIS DATOS","REMESAS · MY DATA"),body)
}

async function learningPDF(){
  try{
    let d=await api("/api/learning-pdf"),body=`<div class="box"><h2>${esc(val(d.title)||t("Guía APRENDER","LEARN Guide"))}</h2>${arr(d.steps||d.lessons).map((x,i)=>`<div class="row"><span>${i+1}. ${esc(val(x.title||x.step||x.description||x)||t("Paso","Step"))}</span></div>`).join("")}</div><div class="box"><h2>${t("Fuentes oficiales","Official sources")}</h2>${arr(d.official_urls).map(u=>`<div class="row"><span>${esc(val(u))}</span></div>`).join("")}</div>`;
    pdfBase(d.title||t("Guía APRENDER","LEARN Guide"),body)
  }catch(e){toast(e.message,"error")}
}

async function restorePDF(file){
  if(!file){
    let input=document.createElement("input");
    input.type="file";
    input.accept=".pdf";
    input.onchange=e=>restorePDF(e.target.files[0]);
    input.click();
    return
  }
  if(file.type!=="application/pdf"&&!/\.pdf$/i.test(file.name)){
    toast(t("Selecciona un archivo PDF de REMESAS.","Select a REMESAS PDF file."),"error");
    return
  }
  let endpoints=["/api/pdf/import","/api/pdf/restore","/api/import/pdf"],last=null;
  for(let url of endpoints){
    try{
      let fd=new FormData();
      fd.append("file",file,file.name);
      let r=await fetch(url,{method:"POST",headers:{"X-Remesas-Language":APP.lang,...(APP.token?{"X-Remesas-Access-Token":APP.token}:{})},body:fd});
      let txt=await r.text(),d={};
      try{d=txt?JSON.parse(txt):{}}catch(e){d={detail:txt}}
      if(r.status===404){last=new Error("404");continue}
      if(!r.ok)throw new Error(val(d.detail||d.message)||t("No se pudo recuperar el PDF.","The PDF could not be restored."));
      if(applyImportedData(d)){
        toast(t("La información del PDF fue recuperada y volvió a alimentar los cálculos.","The PDF information was restored and now feeds the calculations again."));
        home();
        return
      }
      last=new Error(t("El servidor recibió el PDF pero no devolvió datos restaurables.","The server received the PDF but did not return restorable data."))
    }catch(e){last=e}
  }
  toast(last&&last.message&&last.message!=="404"?last.message:t("Este backend todavía no expone un endpoint compatible para recuperar el PDF. No se borró ni modificó tu información local.","This backend does not yet expose a compatible PDF restore endpoint. Your local information was not deleted or changed."),"error")
}

function applyImportedData(d){
  let x=d.data||d.restored_data||d.payload||d;
  let money=x.money||x.money_data,expenses=x.expenses||x.expense_records,family=x.family||x.family_records,savings=x.savings||x.saving_records,purchases=x.purchases||x.purchase_records,found=false;
  if(money&&typeof money==="object"){save(APP.moneyKey,money);found=true}
  if(Array.isArray(expenses)){save(APP.expensesKey,expenses);found=true}
  if(Array.isArray(family)){save(APP.familyKey,family);found=true}
  if(Array.isArray(savings)){save(APP.savingsKey,savings);found=true}
  if(Array.isArray(purchases)){save(APP.purchasesKey,purchases);found=true}
  if(d.session)APP.session=d.session;
  return found
}

async function loadConfig(){
  try{
    let d=await fetch("/api/config?language="+encodeURIComponent(APP.lang),{headers:headers(false)}).then(async r=>{
      let x=await r.json();
      if(!r.ok)throw new Error(val(x.detail||x.message));
      return x
    });
    APP.config=d||{};
    return d
  }catch(e){
    APP.config={countries:[],providers:providerCatalog()};
    return APP.config
  }
}

(async()=>{
  try{
    await loadConfig();
    await boot()
  }catch(e){
    console.error(e);
    gate();
    toast(t("La aplicación tuvo un problema al iniciar. Puedes volver a intentar sin perder tus datos locales.","The application had a startup problem. You can retry without losing your local data."),"error")
  }
})();
