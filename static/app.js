"use strict";
const APP={config:null,session:null,lang:localStorage.getItem("remesas_lang")||"es",version:"3.0.0",brainVersion:null,moneyKey:"remesas_money_v3",expensesKey:"remesas_expenses_v3",familyKey:"remesas_family_v3",prefsKey:"remesas_prefs_v3"};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=(n,c="USD")=>Number.isFinite(Number(n))?`${Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`:"—";
const t=(es,en)=>APP.lang==="en"?en:es;
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||"null")??d}catch(e){return d}};
const moneyData=()=>read(APP.moneyKey,{income:[],savings:0,remittance:0,purchases:[]});
const expensesData=()=>read(APP.expensesKey,[]);
const familyData=()=>read(APP.familyKey,[]);
const prefsData=()=>read(APP.prefsKey,{});
const api=async(url,opt={})=>{try{const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||d.error||t("No se pudo completar la operación.","The operation could not be completed."));return d}catch(e){throw e}};

function langToggle(){APP.lang=APP.lang==="es"?"en":"es";localStorage.setItem("remesas_lang",APP.lang);if(APP.session)APP.session.language=APP.lang;render()}
function setSession(s){APP.session=s;if(s?.session_id)localStorage.setItem("remesas_session_id",s.session_id)}
async function startSession(){try{const d=await api(`/api/session?language=${APP.lang}`,{method:"POST"});setSession(d.session)}catch(e){console.warn(e)}}
async function loadConfig(){const d=await api(`/api/config?language=${APP.lang}`);APP.config=d;APP.brainVersion=d.app?.version||null;localStorage.setItem("remesas_app_version",APP.version);localStorage.setItem("remesas_brain_version",APP.brainVersion||"")}
async function parseText(text){return api("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,language:APP.lang})})}

function humanDelivery(v){
 const key=String(v||"").toLowerCase();
 const map={bank_account:["Cuenta bancaria","Bank account"],cash_pickup:["Recibir en efectivo","Cash pickup"],mobile_wallet:["Billetera digital","Digital wallet"],home_delivery:["Entrega a domicilio","Home delivery"],cash:["Efectivo","Cash"]};
 return map[key]?t(...map[key]):v?t(String(v).replace(/_/g," "),String(v).replace(/_/g," ")):t("Revisar","Review")
}
function humanPayment(v){
 const key=String(v||"").toLowerCase();
 const map={bank_account:["Cuenta bancaria","Bank account"],debit_card:["Tarjeta de débito","Debit card"],credit_card:["Tarjeta de crédito","Credit card"],cash:["Efectivo","Cash"],cash_payment:["Efectivo","Cash"]};
 return map[key]?t(...map[key]):v?t(String(v).replace(/_/g," "),String(v).replace(/_/g," ")):t("Revisar","Review")
}
function humanStatus(v){const s=String(v||"").toLowerCase();if(["verified","verificado"].includes(s))return t("Verificado","Verified");if(["unverified","no_verified"].includes(s))return t("Sin datos comerciales verificados","No verified commercial data");return v||""}
function providerLink(p,topic="send_money"){
 const urls=p?.help_urls||p?.official_urls||{};
 return p?.[`${topic}_url`]||urls?.[topic]||p?.continue_url||p?.official_site||urls?.home||"#"
}
function providerName(id){return APP.config?.providers?.find(x=>x.provider_id===id)?.provider_name||APP.config?.providers?.find(x=>x.id===id)?.name||id||"Proveedor"}

async function compare(){
 const amount=Number($("#amount")?.value||0),country=$("#country")?.value||"",priority=$("#priority")?.value||null,delivery=$("#delivery")?.value||null,payment=$("#payment")?.value||null;
 if(!amount||amount<=0)return showError(t("Escribe una cantidad válida.","Enter a valid amount."));
 if(!country)return showError(t("Selecciona el país de destino.","Select the destination country."));
 if(!APP.session)await startSession();
 const body={session_id:APP.session?.session_id,language:APP.lang,need_type:"remittance",amount,destination_country:country,priority,delivery_method:delivery,payment_method:payment};
 try{
  const d=await api("/api/need",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  setSession(d.session);
  const result=await api("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount,destination_country:country,priority,delivery_method:delivery,payment_method:payment,language:APP.lang,send_currency:"USD"})});
  renderComparison(result);
 }catch(e){showError(e.message)}
}

async function selectProvider(id){
 if(!APP.session?.session_id)return showError(t("La sesión no está disponible. Intenta nuevamente.","The session is not available. Please try again."));
 try{
  const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(id)}`,{method:"POST"});
  setSession(d.session);
  renderFinalCheck();
 }catch(e){showError(e.message)}
}

async function finalCheck(){
 if(!APP.session?.session_id)return showError(t("La sesión no está disponible.","The session is not available."));
 try{
  const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,{method:"POST"});
  renderFinalResult(d);
 }catch(e){showError(e.message)}
}

async function askFreeText(){
 const input=$("#freeText"),text=input?.value?.trim()||"";
 if(!text)return showError(t("Escribe primero lo que necesitas.","First write what you need."));
 const box=$("#assistantResult");
 if(box)box.innerHTML=loading();
 try{const d=await parseText(text);renderAssistant(d,text)}catch(e){if(box)box.innerHTML=errorBox(e.message)}
}

function goRemittance(){renderRemittance()}
function render(){document.documentElement.lang=APP.lang;document.body.innerHTML=`<div id="app"></div>`;renderHome()}

function renderHome(){
 const app=$("#app");
 if(!app)return;
 app.innerHTML=`<div class="page"><header class="topbar"><div><strong>REMESAS</strong><small>May Roga LLC</small></div><button class="lang" onclick="langToggle()">${APP.lang==="es"?"EN":"ES"}</button></header><main class="container"><section class="hero"><span class="eyebrow">${t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER")}</span><h1>${t("¿Qué necesitas resolver hoy?","What do you need to solve today?")}</h1><p>${t("Primero entendemos lo que necesitas. Después te mostramos solo lo que tiene sentido para ti.","First we understand what you need. Then we show only what makes sense for you.")}</p></section><section class="notice"><strong>${t("¿Por qué preguntamos esto?","Why do we ask this?")}</strong><p>${t("Para no llenarte de opciones que no necesitas. Tus datos personales de dinero se quedan en este dispositivo.","So we do not fill your screen with options you do not need. Your personal money data stays on this device.")}</p></section><section class="home-grid">${homeCard("💸",t("Enviar dinero","Send money"),t("Comparar las opciones disponibles de Western Union, MoneyGram, Remitly y Xoom.","Compare available options from Western Union, MoneyGram, Remitly and Xoom."),"goRemittance()")}${homeCard("💰",t("Mi dinero","My money"),t("Organizar ingresos, gastos, ahorro y dinero disponible.","Organize income, expenses, savings and money available."),"renderMoney()")}${homeCard("📅",t("Mi semana","My week"),t("Ver qué entra, qué sale y qué queda disponible.","See what comes in, what goes out and what remains available."),"renderWeek()")}${homeCard("🧾",t("Mis gastos","My expenses"),t("Anotar gastos para entender en qué se va tu dinero.","Record expenses to understand where your money goes."),"renderExpenses()")}${homeCard("👨‍👩‍👧",t("Familia","Family"),t("Guardar localmente personas y destinos frecuentes.","Store frequent people and destinations locally."),"renderFamily()")}${homeCard("❓",t("No entiendo","I don't understand"),t("Explicaciones sencillas sobre comisiones, cambio, requisitos y errores.","Simple explanations about fees, exchange rates, requirements and mistakes."),"renderHelp()")}${homeCard("🛒",t("Planear una compra","Plan a purchase"),t("Ver cómo una compra cambia el dinero que te queda.","See how a purchase changes the money you have left."),"renderPurchase()")}${homeCard("💵",t("Ahorrar","Save money"),t("Registrar ahorro y ver su efecto en tu dinero disponible.","Record savings and see their effect on available money."),"renderSavings()")}</section><section class="assistant-box"><h2>${t("¿Tienes otra necesidad?","Something else?")}</h2><p>${t("Escríbela con tus propias palabras. Primero intentaremos entender qué necesitas; no te enviaremos automáticamente a una remesadora.","Write it in your own words. We will first understand what you need; we will not automatically send you to a remittance provider.")}</p><textarea id="freeText" rows="3" placeholder="${t("Ejemplo: no entiendo por qué mi familiar recibe menos...","Example: I don't understand why my family member receives less...")}"></textarea><button class="primary" onclick="askFreeText()">${t("Entender mi necesidad","Understand my need")}</button><div id="assistantResult"></div></section><section class="privacy"><strong>${t("Privacidad sencilla","Simple privacy")}</strong><p>${t("Ingresos, gastos, compras, ahorro y nombres de familiares se guardan solamente en este navegador. No necesitas escribir aquí contraseñas, CVV ni códigos de seguridad.","Income, expenses, purchases, savings and family names are stored only in this browser. You never need to enter passwords, CVV numbers or security codes here.")}</p><button class="danger-link" onclick="deleteLocalData()">${t("Borrar mis datos de este dispositivo","Delete my data from this device")}</button></section></main><footer>REMESAS · May Roga LLC · ${t("Información y organización. Tú decides.","Information and organization. You decide.")}</footer></div>`;
}
function homeCard(icon,title,text,action){return `<button class="home-card" onclick="${action}"><span class="card-icon">${icon}</span><strong>${title}</strong><span>${text}</span></button>`}

function renderRemittance(){
 const c=APP.config||{},countries=c.countries||[];
 $("#app").innerHTML=`<div class="page"><header class="topbar"><button class="back" onclick="renderHome()">←</button><div><strong>${t("Enviar dinero","Send money")}</strong><small>${t("Solo lo necesario","Only what you need")}</small></div><button class="lang" onclick="langToggle()">${APP.lang==="es"?"EN":"ES"}</button></header><main class="container"><section class="section-head"><h1>${t("Primero dime qué necesitas enviar","First tell me what you need to send")}</h1><p>${t("Estas preguntas sirven para comparar las opciones que realmente pueden importar en tu envío.","These questions help compare the options that may actually matter for your transfer.")}</p></section><div class="form-card"><label>${t("¿Cuánto quieres enviar?","How much do you want to send?")}</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="100"><label>${t("¿A qué país?","Which country?")}</label><select id="country"><option value="">${t("Selecciona","Select")}</option>${countries.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><label>${t("¿Qué importa más para este envío?","What matters most for this transfer?")}</label><select id="priority"><option value="">${t("Todavía no lo sé","I don't know yet")}</option><option value="fastest">${t("Necesito rapidez","I need speed")}</option><option value="save">${t("Quiero controlar el costo","I want to control cost")}</option><option value="recipient_gets_more">${t("Quiero revisar cuánto recibe","I want to review how much is received")}</option><option value="balanced">${t("Quiero equilibrio","I want balance")}</option><option value="compare_all">${t("Quiero comparar","I want to compare")}</option></select><details><summary>${t("¿Quieres indicar cómo pagar o recibir?","Want to specify payment or delivery?")}</summary><label>${t("Forma de entrega","Delivery method")}</label><select id="delivery"><option value="">${t("No especificar","No preference")}</option>${(c.delivery_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.label||humanDelivery(x.id))}</option>`).join("")}</select><label>${t("Forma de pago","Payment method")}</label><select id="payment"><option value="">${t("No especificar","No preference")}</option>${(c.payment_methods||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.label||humanPayment(x.id))}</option>`).join("")}</select></details><button class="primary" onclick="compare()">${t("Comparar opciones","Compare options")}</button></div><div id="results"></div></main></div>`;
}

function renderComparison(data){
 const box=$("#results");if(!box)return;
 const providers=data.available_providers||data.providers||[],results=data.results||[],verified=data.verified_count||0;
 box.innerHTML=`<section class="result-intro"><h2>${t("Lo que encontramos","What we found")}</h2><p>${esc(data.explanation||t("Revisamos las opciones disponibles con la información que podemos comprobar.","We reviewed the available options using information we can verify."))}</p><div class="status">${verified?`✓ ${verified} ${t("opción(es) con datos verificados","option(s) with verified data")}`:t("Los datos comerciales actuales no están verificados.","Current commercial data is not verified.")}</div></section><div class="provider-list">${providers.map(p=>providerCard(p,results)).join("")}</div>${data.differences?.length?`<section class="difference"><h3>${t("Diferencias que sí podemos comprobar","Differences we can verify")}</h3>${data.differences.map(d=>`<div><strong>${esc(d.label)}</strong><p>${(d.values||[]).map(v=>`${esc(v.provider_name||providerName(v.provider_id))}: ${esc(Array.isArray(v.value)?v.value.join(", "):v.value)}`).join(" · ")}</p></div>`).join("")}</section>`:""}${(data.precautions||[]).length?`<section class="notice"><strong>${t("Antes de continuar","Before continuing")}</strong><p>${data.precautions.map(x=>esc(x)).join(" ")}</p></section>`:""}`;
}

function providerCard(p,results){
 const id=p.provider_id||p.id||"",r=results.find(x=>(x.provider_id||x.id)===id),verified=!!r&&r.status==="verified";
 const sendUrl=providerLink(p,"send_money");
 return `<article class="provider-card"><div class="provider-head"><h3>${esc(p.provider_name||p.name||providerName(id))}</h3><span class="${verified?"verified":"unverified"}">${verified?"✓ "+t("Verificado","Verified"):t("Sin datos comerciales verificados","No verified commercial data")}</span></div>${verified?`<div class="metrics">${metric(t("Envías","You send"),money(r.amount_sent,r.send_currency))}${metric(t("Comisión","Fee"),r.fee!=null?money(r.fee,r.send_currency):"—")}${metric(t("Tasa","Rate"),r.exchange_rate??"—")}${metric(t("Recibe","Recipient gets"),r.recipient_amount!=null?money(r.recipient_amount,r.recipient_currency||""):"—")}${metric(t("Entrega","Delivery"),r.estimated_delivery??"—")}</div>`:`<p class="small">${t("No mostramos una tarifa, tasa, tiempo o cantidad recibida como si fuera actual cuando no está verificada.","We do not show a fee, rate, delivery time or recipient amount as current when it is not verified.")}`}${(p.delivery_options||p.payment_options)?.length?`<div class="small">${p.delivery_options?.length?t("Entrega: ","Delivery: ")+p.delivery_options.map(humanDelivery).join(", "):""}${p.payment_options?.length?` · ${t("Pago: ","Payment: ")}${p.payment_options.map(humanPayment).join(", ")}`:""}</div>`:""}<div class="provider-actions"><button class="secondary" onclick="selectProvider('${esc(id)}')">${t("Revisar esta opción","Review this option")}</button>${sendUrl&&sendUrl!=="#" ? `<a class="external" href="${esc(sendUrl)}" target="_blank" rel="noopener noreferrer">${t("Sitio oficial","Official site")}</a>`:""}</div></article>`;
}

function metric(a,b){return `<div><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`}

function renderFinalCheck(){
 const s=APP.session||{},o=s.selected_option||{},delivery=o.delivery_method||s.delivery_method,payment=s.payment_method;
 $("#app").innerHTML=`<div class="page"><header class="topbar"><button class="back" onclick="renderRemittance()">←</button><strong>${t("Revisión final","Final review")}</strong><button class="lang" onclick="langToggle()">${APP.lang==="es"?"EN":"ES"}</button></header><main class="container"><section class="section-head"><h1>${t("Revisa antes de continuar","Review before continuing")}</h1><p>${t("La aplicación no realiza el envío. Esta revisión te ayuda a comprobar la información antes de ir al sitio oficial.","The app does not execute the transfer. This review helps you check the information before going to the official site.")}</p></section><div class="review-card">${reviewRow(t("Proveedor","Provider"),o.provider_name||providerName(o.provider_id))}${reviewRow(t("Cantidad","Amount"),money(s.amount,s.send_currency))}${reviewRow(t("Destino","Destination"),engineCountry(s.destination_country))}${reviewRow(t("Entrega","Delivery"),humanDelivery(delivery))}${reviewRow(t("Pago","Payment"),humanPayment(payment))}${reviewRow(t("Comisión","Fee"),o.fee!=null?money(o.fee,s.send_currency):t("No verificada","Not verified"))}${reviewRow(t("Tasa de cambio","Exchange rate"),o.exchange_rate??t("No verificada","Not verified"))}${reviewRow(t("Cantidad recibida","Recipient amount"),o.recipient_amount!=null?money(o.recipient_amount,o.recipient_currency||""):t("No verificada","Not verified"))}</div><button class="primary" onclick="finalCheck()">${t("Comprobar revisión","Check review")}</button><div id="finalResult"></div></main></div>`;
}

function reviewRow(a,b){return `<div class="review-row"><span>${esc(a)}</span><strong>${esc(b??"—")}</strong></div>`}
function engineCountry(code){return APP.config?.countries?.find(x=>x.id===code)?.name||code||"—"}

function renderFinalResult(d){
 const box=$("#finalResult");if(!box)return;
 const o=APP.session?.selected_option||{},ready=!!d.ready_to_continue;
 const url=o.continue_url||o.send_money_url||o.help_urls?.send_money||o.official_urls?.send_money||o.official_site||"#";
 const topic=d.help_topic||d.topic||"";
 box.innerHTML=`<section class="notice ${ready?"success":"warning"}"><h3>${ready?"✓ "+t("Listo para revisar en el proveedor", "Ready to review on provider"):t("Falta revisar información","Information needs review")}</h3><p>${esc(d.message||"")}</p>${(d.precautions||[]).length?`<ul>${d.precautions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${ready&&url!=="#"?`<a class="primary link-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t("Continuar al sitio oficial","Continue to official site")}</a>`:!ready?providerHelpButton(o,topic):""}</section>`;
}

function providerHelpButton(o,topic){
 const url=o?.help_urls?.[topic]||o?.help_urls?.help||o?.official_urls?.[topic]||o?.official_urls?.help||o?.help_url||o?.official_site||"#";
 return url!=="#"?`<a class="secondary link-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t("Ver explicación oficial","View official explanation")}</a>`:"";
}

function renderAssistant(d,text){
 const box=$("#assistantResult");if(!box)return;
 const a=d.assistant||{},need=a.need_type||d.parsed?.need_type||"other";
 box.innerHTML=`<section class="assistant-answer"><span class="tag">${esc(humanNeed(need))}</span><p>${esc(a.message||"")}</p>${need==="remittance"?`<button class="primary" onclick="goRemittance()">${t("Ir a comparar remesas","Compare remittances")}</button>`:helpAction(need)}</section>`;
}
function humanNeed(v){const map={remittance:["Remesas","Remittances"],fees:["Comisiones","Fees"],exchange_rate:["Cambio de moneda","Exchange rate"],requirements:["Requisitos","Requirements"],personal_information:["Información personal","Personal information"],security:["Seguridad","Security"],mistake_prevention:["Evitar errores","Avoiding mistakes"],cancellation:["Cancelación","Cancellation"],recipient_information:["Datos del destinatario","Recipient information"],other:["Otra necesidad","Something else"]};return map[v]?t(...map[v]):String(v||"other").replace(/_/g," ")}
function helpAction(need){const map={fees:"fees",exchange_rate:"exchange_rate",requirements:"identification",personal_information:"security",security:"security",mistake_prevention:"mistake",cancellation:"cancellation",recipient_information:"recipient_amount"};const topic=map[need];return topic?`<button class="secondary" onclick="renderHelp('${topic}')">${t("Ver explicación sencilla","See simple explanation")}</button>`:""}

function renderHelp(selected=""){
 api(`/api/help?language=${APP.lang}`).then(d=>{
  $("#app").innerHTML=`<div class="page"><header class="topbar"><button class="back" onclick="renderHome()">←</button><strong>${t("No entiendo","I don't understand")}</strong><button class="lang" onclick="langToggle()">${APP.lang==="es"?"EN":"ES"}</button></header><main class="container"><section class="section-head"><h1>${t("Pregúntalo sin palabras difíciles","Ask without difficult words")}</h1><p>${t("Estas explicaciones sirven para entender el proceso. Las condiciones finales pertenecen al proveedor.","These explanations help you understand the process. Final terms belong to the provider.")}</p></section><div class="help-list">${(d.topics||[]).map(x=>`<button class="help-item" onclick="showHelpTopic('${esc(x.id)}')"><strong>${esc(x.label)}</strong></button>`).join("")}</div><div id="helpAnswer"></div></main></div>`;
  if(selected)showHelpTopic(selected);
 }).catch(e=>showError(e.message));
}
async function showHelpTopic(id){try{const d=await api(`/api/help/${encodeURIComponent(id)}?language=${APP.lang}`),x=d.topic||{},box=$("#helpAnswer");if(box)box.innerHTML=`<section class="answer-card"><h3>${esc(x.label)}</h3><p>${esc(x.answer)}</p></section>`}catch(e){showError(e.message)}}

function normalizeIncome(amount,frequency){
 amount=Number(amount)||0;const f=(frequency||"monthly").toLowerCase();
 if(f.includes("daily")||f.includes("día")||f==="day")return{daily:amount,weekly:amount*7,biweekly:amount*14,monthly:amount*30.4375};
 if(f.includes("weekly")||f.includes("sem"))return{daily:amount/7,weekly:amount,biweekly:amount*2,monthly:amount*4.345};
 if(f.includes("biweekly")||f.includes("quinc"))return{daily:amount/14,weekly:amount/2,biweekly:amount,monthly:amount*2.1725};
 return{daily:amount/30.4375,weekly:amount/4.345,biweekly:amount/2.1725,monthly:amount};
}

function calcMoney(){
 const m=moneyData(),expenses=expensesData();
 const income=m.income.reduce((s,x)=>s+normalizeIncome(x.amount,x.frequency).monthly,0);
 const exp=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
 const rem=Number(m.remittance||0),sav=Number(m.savings||0),remaining=income-exp-rem-sav;
 return{income,expenses:exp,remittance:rem,savings:sav,remaining,daily:remaining/30.4375,weekly:remaining/4.345,biweekly:remaining/2.1725,monthly:remaining};
}

function renderMoney(){
 const m=calcMoney();
 $("#app").innerHTML=pageWithBack(t("Mi dinero","My money"),`<section class="section-head"><h1>${t("Organiza tu dinero sin complicarlo","Organize your money without making it complicated")}</h1><p>${t("Esta sección no controla tu dinero. Solo organiza lo que tú escribes y calcula aproximaciones para que puedas decidir.","This section does not control your money. It only organizes what you enter and calculates estimates so you can decide.")}</p></section><div class="summary-grid">${metric(t("Ingresos mensuales","Monthly income"),money(m.income))}${metric(t("Gastos","Expenses"),money(m.expenses))}${metric(t("Remesas","Remittances"),money(m.remittance))}${metric(t("Ahorro","Savings"),money(m.savings))}${metric(t("Queda aprox.","Approx. remaining"),money(m.remaining))}</div><div class="period-grid">${metric(t("Por día","Per day"),money(m.daily))}${metric(t("Por semana","Per week"),money(m.weekly))}${metric(t("Por 2 semanas","2 weeks"),money(m.biweekly))}${metric(t("Por mes","Per month"),money(m.monthly))}</div><div class="form-card"><h3>${t("Agregar ingreso","Add income")}</h3><input id="incomeAmount" type="number" min="0.01" placeholder="900"><select id="incomeFrequency"><option value="monthly">${t("Mensual","Monthly")}</option><option value="biweekly">${t("Quincenal","Biweekly")}</option><option value="weekly">${t("Semanal","Weekly")}</option><option value="daily">${t("Diario","Daily")}</option></select><button class="primary" onclick="addIncome()">${t("Guardar ingreso","Save income")}</button></div><div class="form-card"><h3>${t("Remesa y ahorro","Transfer and savings")}</h3><input id="moneyRemittance" type="number" min="0" placeholder="${t("Remesas por mes","Monthly transfers")}"><input id="moneySavings" type="number" min="0" placeholder="${t("Ahorro por mes","Monthly savings")}"><button class="secondary" onclick="saveMoneyPlan()">${t("Actualizar cálculo","Update calculation")}</button></div>`);
}
function addIncome(){const amount=Number($("#incomeAmount")?.value||0),frequency=$("#incomeFrequency")?.value||"monthly";if(amount<=0)return showError(t("Escribe un ingreso válido.","Enter a valid income."));const m=moneyData();m.income.push({amount,frequency,created:new Date().toISOString()});save(APP.moneyKey,m);renderMoney()}
function saveMoneyPlan(){const m=moneyData();m.remittance=Number($("#moneyRemittance")?.value||0);m.savings=Number($("#moneySavings")?.value||0);save(APP.moneyKey,m);renderMoney()}

function renderWeek(){
 const m=calcMoney();
 $("#app").innerHTML=pageWithBack(t("Mi semana","My week"),`<section class="section-head"><h1>${t("¿Qué queda para la semana?","What remains for the week?")}</h1><p>${t("Calculamos una aproximación usando lo que registraste. No es una garantía de dinero disponible.","We calculate an estimate using what you entered. It is not a guarantee of available money.")}</p></section><div class="week-card"><div><small>${t("Ingresos","Income")}</small><strong>${money(m.income)}</strong></div><div><small>${t("Gastos","Expenses")}</small><strong>${money(m.expenses)}</strong></div><div><small>${t("Remesas","Transfers")}</small><strong>${money(m.remittance)}</strong></div><div><small>${t("Ahorro","Savings")}</small><strong>${money(m.savings)}</strong></div><div class="highlight"><small>${t("Disponible aprox. por día","Approx. available per day")}</small><strong>${money(m.daily)}</strong></div></div><div class="notice"><strong>${t("¿Para qué sirve?","What is it for?")}</strong><p>${t("Te ayuda a ver el efecto de tus gastos, remesas y ahorro antes de decidir qué hacer con el dinero restante.","It helps you see the effect of expenses, transfers and savings before deciding what to do with the money left.")}</p></div>`);
}

function renderExpenses(){
 const items=expensesData();
 $("#app").innerHTML=pageWithBack(t("Mis gastos","My expenses"),`<section class="section-head"><h1>${t("Entiende en qué se va tu dinero","Understand where your money goes")}</h1><p>${t("Anota tus gastos para saber qué necesitas cubrir antes de enviar, comprar o ahorrar.","Record your expenses to know what needs to be covered before sending, buying or saving.")}</p></section><div class="form-card"><input id="expenseDesc" placeholder="${t("Ej.: comida, alquiler, zapatos","Example: food, rent, shoes")}"><input id="expenseAmount" type="number" min="0.01" placeholder="50"><select id="expenseCategory"><option value="housing">${t("Vivienda","Housing")}</option><option value="food">${t("Comida","Food")}</option><option value="utilities">${t("Servicios","Utilities")}</option><option value="transport">${t("Transporte","Transport")}</option><option value="communication">${t("Comunicación","Communication")}</option><option value="health">${t("Salud","Health")}</option><option value="clothing">${t("Ropa","Clothing")}</option><option value="shoes">${t("Zapatos","Shoes")}</option><option value="remittance">${t("Remesa","Remittance")}</option><option value="savings">${t("Ahorro","Savings")}</option><option value="entertainment">${t("Entretenimiento","Entertainment")}</option><option value="leisure">${t("Ocio","Leisure")}</option><option value="travel">${t("Viaje","Travel")}</option><option value="shopping">${t("Compras","Shopping")}</option><option value="luxury">${t("Lujo","Luxury")}</option><option value="other">${t("Otro","Other")}</option></select><button class="primary" onclick="addExpense()">${t("Agregar gasto","Add expense")}</button></div><div class="expense-list">${items.length?items.map((x,i)=>`<div class="expense-row"><span><strong>${esc(x.description)}</strong><small>${esc(humanExpenseCategory(x.category))}</small></span><b>${money(x.amount)}</b><button onclick="deleteExpense(${i})" aria-label="${t("Eliminar","Delete")}">×</button></div>`).join(""):`<p class="empty">${t("Todavía no tienes gastos registrados.","You have no recorded expenses yet.")}</p>`}</div>`);
}
function humanExpenseCategory(v){const map={housing:["Vivienda","Housing"],food:["Comida","Food"],utilities:["Servicios","Utilities"],transport:["Transporte","Transport"],communication:["Comunicación","Communication"],health:["Salud","Health"],clothing:["Ropa","Clothing"],shoes:["Zapatos","Shoes"],remittance:["Remesa","Remittance"],savings:["Ahorro","Savings"],entertainment:["Entretenimiento","Entertainment"],leisure:["Ocio","Leisure"],travel:["Viaje","Travel"],shopping:["Compras","Shopping"],luxury:["Lujo","Luxury"],other:["Otro","Other"]};return map[v]?t(...map[v]):t("Otro","Other")}
function addExpense(){const description=$("#expenseDesc")?.value?.trim(),amount=Number($("#expenseAmount")?.value||0),category=$("#expenseCategory")?.value||"other";if(!description||amount<=0)return showError(t("Escribe el gasto y una cantidad válida.","Enter the expense and a valid amount."));const a=expensesData();a.push({description,amount,category,frequency:"monthly",created:new Date().toISOString()});save(APP.expensesKey,a);renderExpenses()}
function deleteExpense(i){const a=expensesData();a.splice(i,1);save(APP.expensesKey,a);renderExpenses()}

function renderFamily(){
 const a=familyData();
 $("#app").innerHTML=pageWithBack(t("Familia","Family"),`<section class="section-head"><h1>${t("No repitas los mismos datos","Don't repeat the same details")}</h1><p>${t("Guarda localmente un nombre o etiqueta y el país al que normalmente envías. Estos datos no se mandan al servidor.","Store a name or label and the country you normally send to. This information is not sent to the server.")}</p></section><div class="form-card"><input id="familyName" placeholder="${t("Ej.: Mamá","Example: Mom")}"><select id="familyCountry"><option value="">${t("Selecciona país","Select country")}</option>${(APP.config?.countries||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><button class="primary" onclick="addFamily()">${t("Guardar localmente","Save locally")}</button></div><div class="family-list">${a.length?a.map((x,i)=>`<div class="family-row"><span><strong>${esc(x.name)}</strong><small>${esc(engineCountry(x.country))}</small></span><button onclick="deleteFamily(${i})" aria-label="${t("Eliminar","Delete")}">×</button></div>`).join(""):`<p class="empty">${t("Todavía no hay personas guardadas.","No people saved yet.")}</p>`}</div>`);
}
function addFamily(){const name=$("#familyName")?.value?.trim(),country=$("#familyCountry")?.value||"";if(!name||!country)return showError(t("Escribe un nombre y selecciona el país.","Enter a name and select the country."));const a=familyData();a.push({name,country,created:new Date().toISOString()});save(APP.familyKey,a);renderFamily()}
function deleteFamily(i){const a=familyData();a.splice(i,1);save(APP.familyKey,a);renderFamily()}

function renderSavings(){
 const m=moneyData();
 $("#app").innerHTML=pageWithBack(t("Ahorrar","Save money"),`<section class="section-head"><h1>${t("Haz visible tu ahorro","Make your savings visible")}</h1><p>${t("Registra una cantidad para ver cuánto cambia lo que queda disponible. La aplicación no mueve ni administra tu dinero.","Record an amount to see how it changes what remains available. The app does not move or manage your money.")}</p></section><div class="form-card"><label>${t("Ahorro mensual aproximado","Approx. monthly savings")}</label><input id="saveAmount" type="number" min="0" value="${Number(m.savings||0)}"><button class="primary" onclick="setSavings()">${t("Guardar ahorro","Save savings")}</button></div><div class="answer-card"><h3>${t("Ahorro registrado","Recorded savings")}</h3><p>${money(m.savings)}</p></div>`);
}
function setSavings(){const m=moneyData();m.savings=Math.max(0,Number($("#saveAmount")?.value||0));save(APP.moneyKey,m);renderSavings()}

function renderPurchase(){
 $("#app").innerHTML=pageWithBack(t("Planear una compra","Plan a purchase"),`<section class="section-head"><h1>${t("¿Qué cambia si compro esto?","What changes if I buy this?")}</h1><p>${t("Escribe el precio para ver una aproximación de cómo afecta al dinero restante registrado.","Enter the price to estimate how it affects the remaining money you recorded.")}</p></section><div class="form-card"><input id="purchaseAmount" type="number" min="0.01" placeholder="100"><input id="purchaseName" placeholder="${t("Ej.: zapatos","Example: shoes")}"><button class="primary" onclick="calculatePurchase()">${t("Calcular efecto","Calculate effect")}</button></div><div id="purchaseResult"></div>`);
}
function calculatePurchase(){const amount=Number($("#purchaseAmount")?.value||0),name=$("#purchaseName")?.value?.trim()||t("Compra","Purchase"),m=calcMoney();if(amount<=0)return showError(t("Escribe una cantidad válida.","Enter a valid amount."));const after=m.remaining-amount;$("#purchaseResult").innerHTML=`<section class="answer-card"><h3>${esc(name)}</h3><p>${t("Disponible antes","Available before")}: <strong>${money(m.remaining)}</strong></p><p>${t("Precio","Price")}: <strong>${money(amount)}</strong></p><p>${t("Disponible después, aproximadamente","Approx. remaining afterward")}: <strong>${money(after)}</strong></p><button class="secondary" onclick="savePurchase(${amount},'${esc(name).replace(/'/g,"&#039;")}')">${t("Guardar esta compra","Save this purchase")}</button></section>`}
function savePurchase(amount,name){const m=moneyData();m.purchases=m.purchases||[];m.purchases.push({name,amount,created:new Date().toISOString()});save(APP.moneyKey,m);renderPurchase()}

function pageWithBack(title,content){return `<div class="page"><header class="topbar"><button class="back" onclick="renderHome()" aria-label="${t("Volver","Back")}">←</button><strong>${esc(title)}</strong><button class="lang" onclick="langToggle()">${APP.lang==="es"?"EN":"ES"}</button></header><main class="container">${content}</main></div>`}
function loading(){return `<div class="loading">${t("Analizando...","Analyzing...")}</div>`}
function errorBox(x){return `<div class="error">${esc(x)}</div>`}
function showError(x){const old=$("#errorGlobal");if(old)old.remove();document.body.insertAdjacentHTML("afterbegin",`<div id="errorGlobal" class="error-global">${esc(x)}<button onclick="this.parentElement.remove()">×</button></div>`)}

function deleteLocalData(){
 const ok=confirm(t("Esto borrará los datos de dinero, gastos, familia y preferencias guardados en este navegador. ¿Continuar?","This will delete money, expenses, family and preference data saved in this browser. Continue?"));
 if(!ok)return;
 [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey].forEach(k=>localStorage.removeItem(k));
 localStorage.removeItem("remesas_session_id");
 alert(t("Datos locales borrados.","Local data deleted."));
 APP.session=null;
 renderHome();
}

window.langToggle=langToggle;
window.renderHome=renderHome;
window.goRemittance=goRemittance;
window.compare=compare;
window.selectProvider=selectProvider;
window.finalCheck=finalCheck;
window.renderMoney=renderMoney;
window.renderWeek=renderWeek;
window.renderExpenses=renderExpenses;
window.renderFamily=renderFamily;
window.renderSavings=renderSavings;
window.renderPurchase=renderPurchase;
window.renderHelp=renderHelp;
window.showHelpTopic=showHelpTopic;
window.askFreeText=askFreeText;
window.addIncome=addIncome;
window.saveMoneyPlan=saveMoneyPlan;
window.addExpense=addExpense;
window.deleteExpense=deleteExpense;
window.addFamily=addFamily;
window.deleteFamily=deleteFamily;
window.setSavings=setSavings;
window.calculatePurchase=calculatePurchase;
window.savePurchase=savePurchase;
window.deleteLocalData=deleteLocalData;

document.addEventListener("DOMContentLoaded",async()=>{
 try{
  await loadConfig();
  await startSession();
  render();
 }catch(e){
  document.body.innerHTML=`<div class="page"><main class="container"><section class="error"><h2>REMESAS</h2><p>${esc(e.message||t("No se pudo cargar la aplicación.","The application could not be loaded."))}</p><button class="primary" onclick="location.reload()">${t("Intentar nuevamente","Try again")}</button></section></main></div>`;
 }
});
