const app=document.getElementById("app");let CFG=null,SESSION=null,LANG=localStorage.getItem("remesas_language")||"es";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=(v,c="USD")=>v==null||v===""?text("No verificado","Not verified"):`${Number(v).toLocaleString(LANG==="es"?"es-US":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${c||""}`;
const post=async(u,b)=>{const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});if(!r.ok)throw Error(await r.text());return r.json()};
const get=async u=>{const r=await fetch(u);if(!r.ok)throw Error(await r.text());return r.json()};
const del=async u=>{const r=await fetch(u,{method:"DELETE"});if(!r.ok)throw Error(await r.text());return r.json()};
const text=(es,en)=>LANG==="es"?es:en;
const val=(v,fb="")=>v==null||v===""?fb:v;
const fmtStatus=v=>({compatible:text("Compatible","Compatible"),conditional:text("Condicional","Conditional"),unavailable:text("No disponible","Unavailable"),restricted:text("Restringido","Restricted"),verified:text("Verificado","Verified"),unverified:text("No verificado","Not verified")}[v]||v||"");
const normalizeCountry=(v,list=[])=>{const q=String(v||"").trim().toLowerCase();if(!q)return"";const c=list.find(x=>String(x.name||x.label||"").toLowerCase()===q||String(x.code||"").toLowerCase()===q||String(x.id||"").toLowerCase()===q);return c?.name||c?.label||v};
function saveLang(){try{localStorage.setItem("remesas_language",LANG)}catch(_){}}
function saveSession(){try{if(SESSION?.session_id)localStorage.setItem("remesas_session_id",SESSION.session_id)}catch(_){}}
function clearSessionStorage(){try{localStorage.removeItem("remesas_session_id")}catch(_){}}

async function init(){
 try{
  CFG=await get("/api/config");
  const saved=localStorage.getItem("remesas_language");
  if(saved==="es"||saved==="en")LANG=saved;
  renderOpening();
 }catch(e){renderError(e)}
}
function renderError(e){
 const raw=e?.message||"";
 let msg=raw;
 try{const j=JSON.parse(raw);msg=j.detail||j.message||raw}catch(_){}
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><div class="top-actions"><button class="ghost" id="langBtn">${LANG==="es"?"EN":"ES"}</button></div></header><main class="container"><div class="card error"><h2>${text("No pudimos completar esta operación.","We couldn't complete this operation.")}</h2><p>${esc(msg)}</p><button class="primary" onclick="init()">${text("Intentar nuevamente","Try again")}</button><button class="secondary full" onclick="restart()">${text("Reiniciar","Restart")}</button></div></main>`;
 const b=$("#langBtn");if(b)b.onclick=()=>{LANG=LANG==="es"?"en":"es";saveLang();renderOpening()}
}
function renderOpening(){
 const o=CFG?.opening||{},countries=CFG?.countries?.items||CFG?.countries?.list||CFG?.countries||[];
 const priorities=o.priorities||CFG?.conversation_logic?.priority_options||[];
 const pMap={balanced:[text("Equilibrar","Balance"),"balanced"],fastest:[text("Rapidez","Speed"),"fastest"],save:[text("Pagar menos","Lower cost"),"save"],recipient_gets_more:[text("Que reciba más","Recipient gets more"),"recipient_gets_more"],compare_all:[text("Entender opciones","Understand options"),"compare_all"]};
 const choiceValues=priorities.length?priorities.map(x=>{const id=x.id||x.value||x;return{id,label:x.label||x.name||pMap[id]?.[0]||id}}):Object.keys(pMap).map(id=>({id,label:pMap[id][0]}));
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><div class="top-actions"><button class="ghost" id="langBtn">${LANG==="es"?"EN":"ES"}</button></div></header>
 <main class="container">
 <section class="hero"><p class="eyebrow">MAY ROGA LLC</p><h1>${text("Antes de mandar el dinero, entiende tu situación.","Before you send the money, understand your situation.")}</h1><p>${text("Te ayudamos a identificar lo que necesitas, qué debes preparar, qué debes verificar y qué opciones son compatibles con tu caso.","We help identify what you need, what to prepare, what to verify, and which options fit your situation.")}</p></section>
 <section class="card"><div class="section-head"><h2>${esc(o.primary_question||text("Cuéntame qué necesitas","Tell me what you need"))}</h2><p>${esc(o.secondary_text||text("Puedes escribirlo con tus propias palabras o completar los datos.","You can describe it in your own words or complete the details."))}</p></div>
 <form id="needForm">
 <div class="field"><label>${text("¿Qué quieres hacer?","What do you want to do?")}</label><textarea id="freeText" rows="4" placeholder="${text("Ej.: Quiero mandar $500 a México. Mi mamá necesita recibirlos hoy y no tiene cuenta bancaria.","Example: I want to send $500 to Mexico. My mom needs to receive it today and doesn't have a bank account.")}"></textarea></div>
 <div class="form-grid">
 <div class="field"><label>${text("Cantidad","Amount")}</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="500"></div>
 <div class="field"><label>${text("País de destino","Destination country")}</label><input id="destination" list="countryList" autocomplete="country-name" placeholder="${text("México","Mexico")}"><datalist id="countryList">${countries.map(c=>`<option value="${esc(c.name||c.label||c)}">`).join("")}</datalist></div>
 </div>
 <div class="field"><label>${text("¿Qué es lo más importante para ti?","What's most important to you?")}</label><div class="choice-grid">${choiceValues.map(x=>choice("priority",x.id,x.label)).join("")}</div></div>
 <div class="form-grid">
 <div class="field"><label>${text("¿Cuándo necesita recibirlo?","When does it need to arrive?")}</label><select id="urgency"><option value="">${text("No estoy seguro","Not sure")}</option><option value="today">${text("Hoy","Today")}</option><option value="soon">${text("Pronto","Soon")}</option><option value="normal">${text("No es urgente","Not urgent")}</option></select></div>
 <div class="field"><label>${text("¿Cómo debe recibirlo?","How should it be received?")}</label><select id="delivery"><option value="">${text("Todavía no sé","Not sure yet")}</option><option value="cash_pickup">${text("Efectivo / recoger","Cash pickup")}</option><option value="bank_account">${text("Cuenta bancaria","Bank account")}</option><option value="debit_card">${text("Tarjeta de débito","Debit card")}</option><option value="mobile_wallet">${text("Billetera móvil","Mobile wallet")}</option><option value="home_delivery">${text("Entrega a domicilio","Home delivery")}</option></select></div>
 </div>
 <div class="field"><label>${text("Si quieres, agrega algún detalle","If you want, add a detail")}</label><input id="special" placeholder="${text("Ej.: es la primera vez, será mensual, no tengo cuenta bancaria...","Example: first transfer, monthly transfer, I don't have a bank account...")}"></div>
 <button class="primary full" type="submit">${text("Analizar mi situación","Analyze my situation")}</button>
 </form></section>
 </main>`;
 const lb=$("#langBtn");if(lb)lb.onclick=()=>{LANG=LANG==="es"?"en":"es";saveLang();renderOpening()};
 $("#needForm").onsubmit=submitNeed;
 const radios=document.querySelectorAll('input[name="priority"]');if(radios.length)radios[0].checked=true;
}
function choice(name,value,label){return `<label class="choice"><input type="radio" name="${esc(name)}" value="${esc(value)}"><span>${esc(label)}</span></label>`}

async function submitNeed(e){
 e.preventDefault();
 const free=$("#freeText").value.trim(),amount=$("#amount").value,destination=$("#destination").value.trim();
 if(!free&&!amount&&!destination)return;
 setLoading(text("Entendiendo tu situación…","Understanding your situation…"));
 try{
  let parsed=free?await post("/api/need/parse",{language:LANG,text:free}):null;
  const p=parsed?.parsed||parsed||{},countries=CFG?.countries?.items||CFG?.countries?.list||CFG?.countries||[];
  const parsedDestination=normalizeCountry(p.destination,countries);
  const body={
   language:LANG,
   amount:amount?Number(amount):(p.amount||0),
   destination:destination||parsedDestination||"",
   priority:$('input[name="priority"]:checked')?.value||p.priority||"balanced",
   urgency:$("#urgency").value||p.urgency||null,
   delivery_method:$("#delivery").value||p.delivery_method||null,
   payment_method:p.payment_method||null,
   free_text:free||null,
   special_need:$("#special").value.trim()||p.special_need||null,
   recipient_has_bank_account:p.recipient_has_bank_account??null,
   recipient_has_mobile_wallet:p.recipient_has_mobile_wallet??null,
   first_transfer:p.first_transfer??null,
   recurring_transfer:p.recurring_transfer??null
  };
  if(!body.amount||Number(body.amount)<=0)throw Error(text("Falta una cantidad válida.","A valid amount is missing."));
  if(!body.destination)throw Error(text("Falta el país de destino.","Destination country is missing."));
  const r=await post("/api/need",body);SESSION=r.session||r;saveSession();await showAnalysis();
 }catch(e){renderError(e)}
}
async function showAnalysis(){
 if(!SESSION?.session_id)return renderOpening();
 setLoading(text("Preparando el análisis…","Preparing the analysis…"));
 try{
  const r=await get(`/api/session/${encodeURIComponent(SESSION.session_id)}/analysis`);SESSION=r.session||SESSION;saveSession();renderAnalysis(r);
 }catch(e){renderError(e)}
}
function setLoading(msg){
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div></header><main class="container"><div class="loading card"><div class="loader"></div><p>${esc(msg)}</p></div></main>`;
}
function renderAnalysis(r){
 const s=r.session||SESSION,a=r.analysis||s.need_analysis||{},ctx=a.detected_context||s.detected_context||{};
 const factors=(a.decision_factors||[]).map(x=>`<div class="info-item"><strong>${esc(x.name||x.id||text("Factor","Factor"))}</strong><span>${esc(x.reason||x.value||"")}</span></div>`).join("");
 const cons=(a.constraints||[]).map(x=>`<li><strong>${esc(x.label||x.id||text("Condición","Condition"))}:</strong> ${esc(x.value??x.reason??"")}</li>`).join("");
 const destination=s.destination||ctx.destination||"";
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("SEGÚN LO QUE ME DIJISTE","BASED ON WHAT YOU TOLD ME")}</p><h1>${esc(a.main_need||a.summary||text("Tu situación está lista para revisar.","Your situation is ready to review."))}</h1><p>${esc(a.summary||"")}</p></section>
 <section class="card"><h2>${text("Lo que cambia el resultado","What changes the result")}</h2><div class="info-grid">
 <div class="info-item"><strong>${text("Cantidad","Amount")}</strong><span>${money(s.amount||ctx.amount)}</span></div>
 <div class="info-item"><strong>${text("Destino","Destination")}</strong><span>${esc(destination)}</span></div>
 <div class="info-item"><strong>${text("Urgencia","Urgency")}</strong><span>${esc(s.urgency||ctx.urgency||text("No definida","Not defined"))}</span></div>
 <div class="info-item"><strong>${text("Entrega","Delivery")}</strong><span>${esc(s.delivery_method||ctx.delivery_method||text("Por determinar","To determine"))}</span></div>
 </div></section>
 ${cons?`<section class="card"><h2>${text("Restricciones detectadas","Detected constraints")}</h2><ul class="clean-list">${cons}</ul></section>`:""}
 ${factors?`<section class="card"><h2>${text("Factores importantes","Important factors")}</h2><div class="info-grid">${factors}</div></section>`:""}
 <section class="card warning"><strong>${text("Antes de pagar","Before paying")}</strong><p>${text("Las tarifas, tasas de cambio y cantidades recibidas deben estar verificadas. Si un dato no está verificado, no lo trataremos como un precio real.","Fees, exchange rates and recipient amounts must be verified. If a value is not verified, we will not present it as a real price.")}</p></section>
 <button class="primary full" onclick="compare()">${text("Ver opciones compatibles","See compatible options")}</button>
 </main>`;
}

async function compare(){
 if(!SESSION?.session_id)return restart();
 setLoading(text("Revisando opciones compatibles…","Checking compatible options…"));
 try{
  const r=await post(`/api/session/${encodeURIComponent(SESSION.session_id)}/compare`,{language:LANG,priority:SESSION.priority||"balanced"});SESSION=r.session||SESSION;saveSession();renderComparison(r);
 }catch(e){renderError(e)}
}
function renderComparison(r){
 const s=r.session||SESSION,results=r.results||s.comparison_results||[];
 const cards=results.map((x,i)=>{
  const q=x.quote||{},c=x.cost||{},status=x.compatibility?.status||x.status||"conditional",verified=q.status==="verified"||c.status==="verified";
  const recipientCurrency=c.recipient_currency||q.receive_currency||"";
  const providerId=x.provider_id||x.provider?.id||"";
  const official=x.official_url||x.provider?.official_url||"";
  const confirm=x.what_to_confirm||[];
  return `<article class="provider-card ${esc(status)}">
   <div class="provider-head"><div><h3>${esc(x.provider_name||x.name||providerId)}</h3><span class="status">${esc(fmtStatus(status))}</span></div></div>
   <p>${esc(x.why_it_appears||x.compatibility?.reason||"")}</p>
   <div class="provider-data">
    <div><span>${text("Cantidad enviada","Amount sent")}</span><strong>${money(c.amount_sent??q.send_amount,q.send_currency||"USD")}</strong></div>
    <div><span>${text("Tarifa","Fee")}</span><strong>${money(c.fee??q.fee,q.send_currency||"USD")}</strong></div>
    <div><span>${text("Total pagado","Total paid")}</span><strong>${money(c.total_out_of_pocket,q.send_currency||"USD")}</strong></div>
    <div><span>${text("Recibe","Recipient gets")}</span><strong>${money(c.recipient_amount??q.recipient_amount,recipientCurrency)}</strong></div>
    <div><span>${text("Tipo de cambio","Exchange rate")}</span><strong>${c.exchange_rate!=null?esc(c.exchange_rate):q.exchange_rate!=null?esc(q.exchange_rate):text("No verificado","Not verified")}</strong></div>
    <div><span>${text("Entrega","Delivery")}</span><strong>${esc(x.delivery_method||q.delivery_method||text("No verificado","Not verified"))}</strong></div>
    <div><span>${text("Tiempo","Delivery time")}</span><strong>${esc(x.delivery_time||q.delivery_time||text("No verificado","Not verified"))}</strong></div>
   </div>
   <p class="${verified?"success":"warning"}">${verified?text("Datos comerciales verificados.","Verified commercial data."):text("Datos comerciales no verificados. Confirma el costo directamente antes de pagar.","Commercial data is not verified. Confirm the cost directly before paying.")}</p>
   ${confirm.length?`<details><summary>${text("Qué debes confirmar","What to confirm")}</summary><ul class="clean-list">${confirm.map(v=>`<li>${esc(typeof v==="object"?(v.label||v.text||v.description||""):v)}</li>`).join("")}</ul></details>`:""}
   <button class="secondary full" onclick="selectProvider('${esc(providerId)}')">${text("Usar esta opción","Use this option")}</button>
   ${official?`<a class="provider-link" href="${esc(official)}" target="_blank" rel="noopener noreferrer">${text("Ver página oficial","View official page")}</a>`:""}
  </article>`}).join("");
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("OPCIONES COMPATIBLES","COMPATIBLE OPTIONS")}</p><h1>${text("No hay una opción universal.","There is no universal option.")}</h1><p>${text("Las opciones aparecen según lo que necesitas. Esto no es un ranking.","Options appear according to your needs. This is not a ranking.")}</p></section>
 <section class="provider-list">${cards||`<div class="card"><p>${text("No hay opciones disponibles para estas condiciones.","No options are available for these conditions.")}</p></div>`}</section>
 <button class="secondary full" onclick="showAnalysis()">${text("Volver al análisis","Back to analysis")}</button>
 </main>`;
}

async function selectProvider(id){
 if(!id)return;
 setLoading(text("Preparando la opción seleccionada…","Preparing the selected option…"));
 try{
  const r=await post(`/api/session/${encodeURIComponent(SESSION.session_id)}/select/${encodeURIComponent(id)}`,{});
  SESSION=r.session||SESSION;saveSession();await showPreparation();
 }catch(e){renderError(e)}
}
async function showPreparation(){
 if(!SESSION?.session_id)return restart();
 setLoading(text("Preparando tu guía…","Preparing your guide…"));
 try{
  const r=await get(`/api/session/${encodeURIComponent(SESSION.session_id)}/preparation`);SESSION=r.session||SESSION;saveSession();renderPreparation(r);
 }catch(e){renderError(e)}
}
function renderPreparation(r){
 const s=r.session||SESSION,p=s.preparation||r.preparation||{};
 const list=a=>(a||[]).map(x=>`<li><strong>${esc(x.label||x.title||"")}</strong>${x.description?`<span>${esc(x.description)}</span>`:""}</li>`).join("");
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("PREPARACIÓN","PREPARATION")}</p><h1>${esc(p.title||text("Prepara tu envío","Prepare your transfer"))}</h1><p>${esc(p.introduction||"")}</p></section>
 <section class="card"><h2>${text("Antes de comenzar","Before you start")}</h2><ul class="guide-list">${list(p.before_start)}</ul></section>
 <section class="card"><h2>${text("Información del destinatario","Recipient information")}</h2><ul class="guide-list">${list(p.recipient_items)}</ul></section>
 <section class="card"><h2>${text("Antes de pagar","Before paying")}</h2><ul class="guide-list">${list(p.before_payment)}</ul></section>
 <section class="card warning"><strong>${text("Importante","Important")}</strong><p>${text("No introduzcas aquí contraseñas, PIN, códigos de seguridad ni datos bancarios sensibles. REMESAS funciona como guía y preparación.","Do not enter passwords, PINs, security codes, or sensitive banking credentials here. REMESAS is a guidance and preparation layer.")}</p></section>
 <button class="primary full" onclick="showGuide()">${text("Aprender cómo hacer el envío","Learn how to send it")}</button>
 </main>`;
}
async function showGuide(){
 if(!SESSION?.session_id)return restart();
 setLoading(text("Preparando la guía…","Preparing the guide…"));
 try{
  const r=await get(`/api/session/${encodeURIComponent(SESSION.session_id)}/guide`);SESSION=r.session||SESSION;saveSession();renderGuide(r);
 }catch(e){renderError(e)}
}
function renderGuide(r){
 const s=r.session||SESSION,g=s.send_guide||r.guide||{};
 const steps=(g.steps||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map((x,i)=>`<div class="step"><b>${i+1}</b><div><h3>${esc(x.title||"")}</h3><p>${esc(x.description||x.instruction||x.text||"")}</p>${x.what_to_check?`<small>${text("Comprueba:","Check:")} ${esc(x.what_to_check)}</small>`:""}</div></div>`).join("");
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("GUÍA DE ENVÍO","SEND GUIDE")}</p><h1>${esc(g.title||text("Haz el envío paso a paso","Send it step by step"))}</h1><p>${esc(g.introduction||"")}</p></section>
 <section class="card"><div class="steps">${steps||`<p>${text("No hay pasos disponibles todavía.","No steps are available yet.")}</p>`}</div></section>
 <section class="card"><h2>${text("Reglas importantes","Important rules")}</h2><ul class="clean-list">${(g.rules||[]).map(x=>`<li>${esc(typeof x==="object"?(x.text||x.description||""):x)}</li>`).join("")}</ul></section>
 <button class="primary full" onclick="showFinalCheck()">${text("Verificar antes de continuar","Verify before continuing")}</button>
 </main>`;
}
async function showFinalCheck(){
 if(!SESSION?.session_id)return restart();
 setLoading(text("Verificando los datos…","Checking the details…"));
 try{
  const r=await post(`/api/session/${encodeURIComponent(SESSION.session_id)}/final-check`,{language:LANG,provider_id:SESSION.selected_provider_id||null,confirm_provider_data:false});
  SESSION=r.session||SESSION;saveSession();renderFinalCheck(r);
 }catch(e){renderError(e)}
}
function renderFinalCheck(r){
 const s=r.session||SESSION,f=s.final_check||r,items=f.items||[];
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("VERIFICACIÓN FINAL","FINAL CHECK")}</p><h1>${text("Comprueba estos datos antes de pagar","Check these details before paying")}</h1><p>${esc(f.message||"")}</p></section>
 <section class="card final-check">${items.map(x=>`<div class="check-item ${esc(x.status||"unknown")}"><div><strong>${esc(x.label||"")}</strong><span>${esc(x.message||x.description||"")}</span></div><b>${x.status==="ok"?"✓":x.status==="missing"?"!":"?"}</b></div>`).join("")}</section>
 <section class="card warning"><strong>${text("Último paso","Last step")}</strong><p>${text("El precio, tipo de cambio, método de entrega y cantidad que recibirá el destinatario deben coincidir con la información mostrada por el proveedor en el momento del pago.","The price, exchange rate, delivery method, and recipient amount must match the provider's information at the time of payment.")}</p></section>
 ${f.can_continue?`<button class="primary full" onclick="providerHandoff()">${text("Continuar con el proveedor","Continue to provider")}</button>`:`<button class="secondary full" onclick="showPreparation()">${text("Revisar preparación","Review preparation")}</button>`}
 </main>`;
}
async function providerHandoff(){
 if(!SESSION?.session_id)return restart();
 setLoading(text("Confirmando la opción…","Confirming the option…"));
 try{
  const r=await post(`/api/session/${encodeURIComponent(SESSION.session_id)}/final-check`,{language:LANG,provider_id:SESSION.selected_provider_id||null,confirm_provider_data:true});
  const s=r.session||SESSION,f=s.final_check||r;
  SESSION=s;saveSession();
  if(!f.can_continue){renderFinalCheck(r);return}
  const url=f.official_url||s.selected_provider?.official_url||s.selected_provider?.official_urls?.main;
  if(url)window.open(url,"_blank","noopener,noreferrer");
  else renderError(Error(text("No hay una página oficial disponible para este proveedor.","No official page is available for this provider.")));
 }catch(e){renderError(e)}
}
async function restart(){
 try{if(SESSION?.session_id)await del(`/api/session/${encodeURIComponent(SESSION.session_id)}`)}catch(_){}
 SESSION=null;clearSessionStorage();renderOpening();
}
init();
