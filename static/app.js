const app=document.getElementById("app");let CFG=null,SESSION=null,LANG="es";

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=(v,c="USD")=>v==null?"No verificado":`${Number(v).toLocaleString(LANG==="es"?"es-US":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`;
const post=async(u,b)=>{const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});if(!r.ok)throw Error(await r.text());return r.json()};
const get=async u=>{const r=await fetch(u);if(!r.ok)throw Error(await r.text());return r.json()};
const del=async u=>{const r=await fetch(u,{method:"DELETE"});if(!r.ok)throw Error(await r.text());return r.json()};
const text=(es,en)=>LANG==="es"?es:en;

async function init(){
 try{
  CFG=await get("/api/config");
  renderOpening();
 }catch(e){renderError(e)}
}
function renderError(e){
 app.innerHTML=`<div class="container"><div class="card error"><h2>${text("No pudimos completar esta operación.","We couldn't complete this operation.")}</h2><p>${esc(e.message||"")}</p><button class="primary" onclick="init()">${text("Intentar nuevamente","Try again")}</button></div></div>`;
}
function renderOpening(){
 const o=CFG?.opening||{},countries=CFG?.countries?.items||CFG?.countries?.list||[];
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><div class="top-actions"><button class="ghost" id="langBtn">${LANG==="es"?"EN":"ES"}</button></div></header>
 <main class="container">
 <section class="hero"><p class="eyebrow">MAY ROGA LLC</p><h1>${text("Antes de mandar el dinero, entiende tu situación.","Before you send money, understand your situation.")}</h1><p>${text("Te ayudamos a identificar lo que necesitas, qué debes preparar, qué debes verificar y qué opciones son compatibles con tu caso.","We help identify what you need, what to prepare, what to verify, and which options fit your situation.")}</p></section>
 <section class="card"><div class="section-head"><h2>${text("Cuéntame qué necesitas","Tell me what you need")}</h2><p>${text("Puedes escribirlo con tus propias palabras o completar los datos.","You can describe it in your own words or complete the details.")}</p></div>
 <form id="needForm">
 <div class="field"><label>${text("¿Qué quieres hacer?","What do you want to do?")}</label><textarea id="freeText" rows="4" placeholder="${text("Ej.: Quiero mandar $500 a México. Mi mamá necesita recibirlos hoy y no tiene cuenta bancaria.","Example: I want to send $500 to Mexico. My mom needs to receive it today and doesn't have a bank account.")}"></textarea></div>
 <div class="form-grid">
 <div class="field"><label>${text("Cantidad","Amount")}</label><input id="amount" type="number" min="0.01" step="0.01" placeholder="500"></div>
 <div class="field"><label>${text("País de destino","Destination country")}</label><input id="destination" list="countryList" placeholder="${text("México","Mexico")}"><datalist id="countryList">${countries.map(c=>`<option value="${esc(c.name||c.label||c)}">`).join("")}</datalist></div>
 </div>
 <div class="field"><label>${text("¿Qué es lo más importante para ti?","What's most important to you?")}</label><div class="choice-grid">
 ${choice("priority","balanced",text("Equilibrar","Balance"))}
 ${choice("priority","fastest",text("Rapidez","Speed"))}
 ${choice("priority","save",text("Pagar menos","Lower cost"))}
 ${choice("priority","recipient_gets_more",text("Que reciba más","Recipient gets more"))}
 ${choice("priority","compare_all",text("Entender opciones","Understand options"))}
 </div></div>
 <div class="form-grid">
 <div class="field"><label>${text("¿Cuándo necesita recibirlo?","When does it need to arrive?")}</label><select id="urgency"><option value="">${text("No estoy seguro","Not sure")}</option><option value="today">${text("Hoy","Today")}</option><option value="soon">${text("Pronto","Soon")}</option><option value="normal">${text("No es urgente","Not urgent")}</option></select></div>
 <div class="field"><label>${text("¿Cómo debe recibirlo?","How should it be received?")}</label><select id="delivery"><option value="">${text("Todavía no sé","Not sure yet")}</option><option value="cash_pickup">${text("Efectivo / recoger","Cash pickup")}</option><option value="bank_account">${text("Cuenta bancaria","Bank account")}</option><option value="mobile_wallet">${text("Billetera móvil","Mobile wallet")}</option></select></div>
 </div>
 <div class="field"><label>${text("Si quieres, agrega algún detalle","If you want, add a detail")}</label><input id="special" placeholder="${text("Ej.: es la primera vez, será mensual, no tengo cuenta bancaria...","Example: first transfer, monthly transfer, I don't have a bank account...")}"></div>
 <button class="primary full" type="submit">${text("Analizar mi situación","Analyze my situation")}</button>
 </form></section>
 </main>`;
 $("#langBtn").onclick=()=>{LANG=LANG==="es"?"en":"es";renderOpening()};
 $("#needForm").onsubmit=submitNeed;
}
function choice(name,value,label){return `<label class="choice"><input type="radio" name="${name}" value="${value}"><span>${label}</span></label>`}

async function submitNeed(e){
 e.preventDefault();
 const free=$("#freeText").value.trim(),amount=$("#amount").value,destination=$("#destination").value.trim();
 if(!free&&!amount&&!destination)return;
 setLoading(text("Entendiendo tu situación…","Understanding your situation…"));
 try{
  let parsed=free?await post("/api/need/parse",{language:LANG,text:free}):null;
  const p=parsed?.parsed||parsed||{};
  const body={
   language:LANG,
   amount:amount?Number(amount):(p.amount||0),
   destination:destination||p.destination||"",
   priority:$('input[name="priority"]:checked')?.value||p.priority||"balanced",
   urgency:$("#urgency").value||p.urgency||null,
   delivery_method:$("#delivery").value||p.delivery_method||null,
   free_text:free||null,
   special_need:$("#special").value.trim()||p.special_need||null,
   recipient_has_bank_account:p.recipient_has_bank_account??null,
   recipient_has_mobile_wallet:p.recipient_has_mobile_wallet??null,
   first_transfer:p.first_transfer??null,
   recurring_transfer:p.recurring_transfer??null
  };
  if(!body.amount||!body.destination)throw Error(text("Falta la cantidad o el país de destino.","Amount or destination is missing."));
  const r=await post("/api/need",body);SESSION=r.session||r;
  await showAnalysis();
 }catch(e){renderError(e)}
}

async function showAnalysis(){
 setLoading(text("Preparando el análisis…","Preparing the analysis…"));
 try{
  const r=await get(`/api/session/${SESSION.session_id}/analysis`);SESSION=r.session||SESSION;
  renderAnalysis(r);
 }catch(e){renderError(e)}
}
function setLoading(msg){
 app.innerHTML=`<div class="container"><div class="loading card"><div class="loader"></div><p>${esc(msg)}</p></div></div>`;
}
function renderAnalysis(r){
 const s=r.session||SESSION,a=s.need_analysis||r.analysis||{},ctx=a.detected_context||s.detected_context||{};
 const factors=(a.decision_factors||[]).map(x=>`<div class="info-item"><strong>${esc(x.name||x.id)}</strong><span>${esc(x.reason||x.value||"")}</span></div>`).join("");
 const cons=(a.constraints||[]).map(x=>`<li><strong>${esc(x.label||x.id)}:</strong> ${esc(x.value??x.reason??"")}</li>`).join("");
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("SEGÚN LO QUE ME DIJISTE","BASED ON WHAT YOU TOLD ME")}</p><h1>${esc(a.main_need||a.summary||text("Tu situación está lista para revisar.","Your situation is ready to review."))}</h1><p>${esc(a.summary||"")}</p></section>
 <section class="card"><h2>${text("Lo que cambia el resultado","What changes the result")}</h2><div class="info-grid">
 <div class="info-item"><strong>${text("Cantidad","Amount")}</strong><span>${money(s.amount)}</span></div>
 <div class="info-item"><strong>${text("Destino","Destination")}</strong><span>${esc(s.destination)}</span></div>
 <div class="info-item"><strong>${text("Urgencia","Urgency")}</strong><span>${esc(s.urgency||text("No definida","Not defined"))}</span></div>
 <div class="info-item"><strong>${text("Entrega","Delivery")}</strong><span>${esc(s.delivery_method||text("Por determinar","To determine"))}</span></div>
 </div></section>
 ${cons?`<section class="card"><h2>${text("Restricciones detectadas","Detected constraints")}</h2><ul class="clean-list">${cons}</ul></section>`:""}
 ${factors?`<section class="card"><h2>${text("Factores importantes","Important factors")}</h2><div class="info-grid">${factors}</div></section>`:""}
 <section class="card warning"><strong>${text("Antes de pagar","Before paying")}</strong><p>${text("Las tarifas, tasas de cambio y cantidades recibidas deben estar verificadas. Si un dato no está verificado, no lo trataremos como un precio real.","Fees, exchange rates and recipient amounts must be verified. If a value is not verified, we will not present it as a real price.")}</p></section>
 <button class="primary full" onclick="compare()">${text("Ver opciones compatibles","See compatible options")}</button>
 </main>`;
}

async function compare(){
 setLoading(text("Revisando opciones compatibles…","Checking compatible options…"));
 try{
  const r=await post(`/api/session/${SESSION.session_id}/compare`,{language:LANG,priority:SESSION.priority||"balanced"});
  SESSION=r.session||SESSION;renderComparison(r);
 }catch(e){renderError(e)}
}
function renderComparison(r){
 const s=r.session||SESSION,results=r.results||s.comparison_results||[];
 const cards=results.map((x,i)=>{
  const q=x.quote,c=x.cost||{},status=x.compatibility?.status||"conditional";
  const verified=x.quote?.status==="verified";
  return `<article class="provider-card ${status}">
   <div class="provider-head"><div><h3>${esc(x.provider_name)}</h3><span class="status">${esc(status)}</span></div></div>
   <p>${esc(x.why_it_appears||x.compatibility?.reason||"")}</p>
   <div class="provider-data">
    <div><span>${text("Cantidad enviada","Amount sent")}</span><strong>${money(c.amount_sent)}</strong></div>
    <div><span>${text("Tarifa","Fee")}</span><strong>${money(c.fee)}</strong></div>
    <div><span>${text("Total pagado","Total paid")}</span><strong>${money(c.total_out_of_pocket)}</strong></div>
    <div><span>${text("Recibe","Recipient gets")}</span><strong>${money(c.recipient_amount,c.recipient_currency||"")}</strong></div>
    <div><span>${text("Tipo de cambio","Exchange rate")}</span><strong>${c.exchange_rate==null?text("No verificado","Not verified"):esc(c.exchange_rate)}</strong></div>
    <div><span>${text("Entrega","Delivery")}</span><strong>${esc(x.delivery_method||text("No verificado","Not verified"))}</strong></div>
   </div>
   <p class="${verified?"success":"warning"}">${verified?text("Datos comerciales verificados.","Verified commercial data."):text("Datos comerciales no verificados. Confirma el costo directamente antes de pagar.","Commercial data is not verified. Confirm the cost directly before paying.")}</p>
   ${(x.what_to_confirm||[]).length?`<details><summary>${text("Qué debes confirmar","What to confirm")}</summary><ul class="clean-list">${x.what_to_confirm.map(v=>`<li>${esc(v)}</li>`).join("")}</ul></details>`:""}
   <button class="secondary full" onclick="selectProvider('${esc(x.provider_id)}')">${text("Usar esta opción","Use this option")}</button>
  </article>`}).join("");
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("OPCIONES COMPATIBLES","COMPATIBLE OPTIONS")}</p><h1>${text("No hay una opción universal.","There is no universal option.")}</h1><p>${text("Las opciones aparecen según lo que necesitas. Esto no es un ranking.","Options appear according to your needs. This is not a ranking.")}</p></section>
 <section class="provider-list">${cards||`<div class="card"><p>${text("No hay opciones disponibles para estas condiciones.","No options are available for these conditions.")}</p></div>`}</section>
 <button class="secondary full" onclick="showAnalysis()">${text("Volver al análisis","Back to analysis")}</button>
 </main>`;
}

async function selectProvider(id){
 setLoading(text("Preparando la opción seleccionada…","Preparing the selected option…"));
 try{
  const r=await post(`/api/session/${SESSION.session_id}/select/${encodeURIComponent(id)}`,{});
  SESSION=r.session||SESSION;
  await showPreparation();
 }catch(e){renderError(e)}
}
async function showPreparation(){
 try{
  const r=await get(`/api/session/${SESSION.session_id}/preparation`);SESSION=r.session||SESSION;renderPreparation(r);
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
 try{
  const r=await get(`/api/session/${SESSION.session_id}/guide`);SESSION=r.session||SESSION;renderGuide(r);
 }catch(e){renderError(e)}
}
function renderGuide(r){
 const s=r.session||SESSION,g=s.send_guide||r.guide||{};
 const steps=(g.steps||[]).sort((a,b)=>(a.order||0)-(b.order||0)).map((x,i)=>`<div class="step"><b>${i+1}</b><div><h3>${esc(x.title||"")}</h3><p>${esc(x.description||x.instruction||x.text||"")}</p>${x.what_to_check?`<small>${text("Comprueba:","Check:")} ${esc(x.what_to_check)}</small>`:""}</div></div>`).join("");
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("GUÍA DE ENVÍO","SEND GUIDE")}</p><h1>${esc(g.title||text("Haz el envío paso a paso","Send it step by step"))}</h1><p>${esc(g.introduction||"")}</p></section>
 <section class="card"><div class="steps">${steps}</div></section>
 <section class="card"><h2>${text("Reglas importantes","Important rules")}</h2><ul class="clean-list">${(g.rules||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
 <button class="primary full" onclick="showFinalCheck()">${text("Verificar antes de continuar","Verify before continuing")}</button>
 </main>`;
}
async function showFinalCheck(){
 try{
  const r=await post(`/api/session/${SESSION.session_id}/final-check`,{language:LANG,provider_id:SESSION.selected_provider_id||null,confirm_provider_data:false});
  SESSION=r.session||SESSION;renderFinalCheck(r);
 }catch(e){renderError(e)}
}
function renderFinalCheck(r){
 const s=r.session||SESSION,f=s.final_check||r,items=f.items||[];
 app.innerHTML=`<header class="topbar"><div class="brand">REMESAS</div><button class="ghost" onclick="restart()">${text("Reiniciar","Restart")}</button></header>
 <main class="container"><section class="hero compact"><p class="eyebrow">${text("VERIFICACIÓN FINAL","FINAL CHECK")}</p><h1>${text("Comprueba estos datos antes de pagar","Check these details before paying")}</h1><p>${esc(f.message||"")}</p></section>
 <section class="card final-check">${items.map(x=>`<div class="check-item ${esc(x.status)}"><div><strong>${esc(x.label)}</strong><span>${esc(x.message||x.description||"")}</span></div><b>${x.status==="ok"?"✓":x.status==="missing"?"!":"?"}</b></div>`).join("")}</section>
 <section class="card warning"><strong>${text("Último paso","Last step")}</strong><p>${text("El precio, tipo de cambio, método de entrega y cantidad que recibirá el destinatario deben coincidir con la información mostrada por el proveedor en el momento del pago.","The price, exchange rate, delivery method, and recipient amount must match the provider's information at the time of payment.")}</p></section>
 ${f.can_continue?`<button class="primary full" onclick="providerHandoff()">${text("Continuar con el proveedor","Continue to provider")}</button>`:`<button class="secondary full" onclick="showPreparation()">${text("Revisar preparación","Review preparation")}</button>`}
 </main>`;
}
async function providerHandoff(){
 try{
  const r=await post(`/api/session/${SESSION.session_id}/final-check`,{language:LANG,provider_id:SESSION.selected_provider_id||null,confirm_provider_data:true});
  const s=r.session||SESSION,f=s.final_check||r;
  if(!f.can_continue){renderFinalCheck(r);return}
  const url=f.official_url||s.selected_provider?.official_url;
  if(url)window.open(url,"_blank","noopener,noreferrer");
  else renderError(Error(text("No hay una página oficial disponible para este proveedor.","No official page is available for this provider.")));
 }catch(e){renderError(e)}
}
async function restart(){
 try{if(SESSION?.session_id)await del(`/api/session/${SESSION.session_id}`)}catch(_){}
 SESSION=null;renderOpening();
}
init();
