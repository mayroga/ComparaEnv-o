const APP={name:"REMESAS",version:"4.0.1",lang:localStorage.getItem("remesas_lang_v4")||localStorage.getItem("remesas_lang")||"es",session:null,config:null,comparison:null,pendingParsed:null,keys:{money:"remesas_money_v4",expenses:"remesas_expenses_v4",family:"remesas_family_v4",prefs:"remesas_prefs_v4",lang:"remesas_lang_v4",savings:"remesas_savings_v4"}};

const DEFAULT_COUNTRIES=[
{code:"MX",name:{es:"México",en:"Mexico"},currency:"MXN"},
{code:"GT",name:{es:"Guatemala",en:"Guatemala"},currency:"GTQ"},
{code:"SV",name:{es:"El Salvador",en:"El Salvador"},currency:"USD"},
{code:"HN",name:{es:"Honduras",en:"Honduras"},currency:"HNL"},
{code:"NI",name:{es:"Nicaragua",en:"Nicaragua"},currency:"NIO"},
{code:"CR",name:{es:"Costa Rica",en:"Costa Rica"},currency:"CRC"},
{code:"PA",name:{es:"Panamá",en:"Panama"},currency:"USD"},
{code:"CO",name:{es:"Colombia",en:"Colombia"},currency:"COP"},
{code:"VE",name:{es:"Venezuela",en:"Venezuela"},currency:"VES"},
{code:"EC",name:{es:"Ecuador",en:"Ecuador"},currency:"USD"},
{code:"PE",name:{es:"Perú",en:"Peru"},currency:"PEN"},
{code:"BO",name:{es:"Bolivia",en:"Bolivia"},currency:"BOB"},
{code:"PY",name:{es:"Paraguay",en:"Paraguay"},currency:"PYG"},
{code:"CL",name:{es:"Chile",en:"Chile"},currency:"CLP"},
{code:"AR",name:{es:"Argentina",en:"Argentina"},currency:"ARS"},
{code:"BR",name:{es:"Brasil",en:"Brazil"},currency:"BRL"},
{code:"DO",name:{es:"República Dominicana",en:"Dominican Republic"},currency:"DOP"},
{code:"CU",name:{es:"Cuba",en:"Cuba"},currency:"CUP"}
];

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const money=(v,c="USD")=>{const n=Number(v);if(!Number.isFinite(n))return"—";try{return new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:c,maximumFractionDigits:2}).format(n)}catch{return`${n.toFixed(2)} ${c}`}};
const getJSON=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const setJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const t=(es,en)=>APP.lang==="en"?en:es;

const toast=m=>{const old=document.querySelector(".toast");if(old)old.remove();const el=document.createElement("div");el.className="toast";el.textContent=m;document.body.appendChild(el);setTimeout(()=>el.remove(),3200)};
const loading=(m=t("Cargando...","Loading..."))=>`<div class="loading"><span class="spinner"></span><span>${esc(m)}</span></div>`;
const errorBox=m=>`<div class="error">${esc(m)}</div>`;

async function api(url,options={}){
const opts={...options,headers:{"Content-Type":"application/json",...(options.headers||{})}};
const r=await fetch(url,opts);
let data=null;
try{data=await r.json()}catch{}
if(!r.ok)throw new Error(data?.detail||data?.message||t("No se pudo completar la operación.","The operation could not be completed."));
return data;
}

async function loadConfig(){
APP.config=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);
return APP.config;
}

async function startSession(){
const data=await api("/api/session",{method:"POST",body:JSON.stringify({language:APP.lang})});
APP.session=data.session||null;
return APP.session;
}

function normalizeCountry(c){
if(!c)return null;
if(typeof c==="string")return{code:c.toUpperCase(),name:c,currency:""};
if(typeof c!=="object")return null;
const code=String(c.code||c.id||"").trim().toUpperCase();
if(!code)return null;
return{code,name:c.name||code,currency:c.currency||""};
}

function getCountries(){
const c=APP.config?.countries;
let list=[];
if(Array.isArray(c))list=c;
else if(Array.isArray(c?.supported))list=c.supported;
else if(Array.isArray(c?.initial_supported)){
const names=c.country_names||{};
list=c.initial_supported.map(code=>({code,name:names?.[code]?.name||code,currency:names?.[code]?.currency||""}));
}else if(c?.country_names&&typeof c.country_names==="object"){
list=Object.entries(c.country_names).map(([code,v])=>({code,name:v?.name||code,currency:v?.currency||""}));
}
const normalized=list.map(normalizeCountry).filter(Boolean);
const seen=new Set();
const clean=normalized.filter(x=>{if(seen.has(x.code))return false;seen.add(x.code);return true});
return clean.length?clean:DEFAULT_COUNTRIES;
}

function countryName(code){
const c=getCountries().find(x=>x.code===String(code||"").toUpperCase());
if(!c)return String(code||"");
if(typeof c.name==="object")return c.name[APP.lang]||c.name.es||c.name.en||c.code;
return c.name;
}

function getDeliveryMethods(){
const list=APP.config?.delivery_methods;
if(Array.isArray(list)&&list.length)return list;
return[
{id:"cash_pickup",label:t("Retiro en efectivo","Cash pickup")},
{id:"bank_account",label:t("Cuenta bancaria","Bank account")},
{id:"debit_card",label:t("Tarjeta de débito","Debit card")},
{id:"mobile_wallet",label:t("Billetera móvil","Mobile wallet")},
{id:"home_delivery",label:t("Entrega a domicilio","Home delivery")}
];
}

function getPaymentMethods(){
const list=APP.config?.payment_methods;
if(Array.isArray(list)&&list.length)return list;
return[
{id:"bank_account",label:t("Cuenta bancaria","Bank account")},
{id:"debit_card",label:t("Tarjeta de débito","Debit card")},
{id:"credit_card",label:t("Tarjeta de crédito","Credit card")},
{id:"cash",label:t("Efectivo","Cash")},
{id:"other",label:t("Otro","Other")}
];
}

function shell(content){
const cfg=APP.config||{};
const appName=cfg.app?.name||APP.name;
return`<div class="app-shell">
<header class="topbar">
<button class="brand" style="border:0;background:transparent;padding:0;text-align:left" onclick="renderHome()">${esc(appName)}<small>${esc(cfg.app?.brand||"May Roga LLC")}</small></button>
<div class="top-actions"><button class="lang-btn" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div>
</header>
${content}
<footer class="footer">
<div><strong>REMESAS</strong> · ${esc(cfg.app?.brand||"May Roga LLC")}</div>
<div class="legal">${esc(t("REMESAS es una herramienta de organización y preparación. No es un banco, financiera, asesor financiero ni procesador de pagos. No recibe ni transmite fondos de remesas.","REMESAS is an organization and preparation tool. It is not a bank, financial institution, financial advisor, or payment processor. It does not receive or transmit remittance funds."))}</div>
<div class="footer-links">
<button class="btn secondary small" onclick="renderHelp()">${esc(t("Ayuda","Help"))}</button>
<button class="btn secondary small" onclick="deleteLocalData()">${esc(t("Borrar datos locales","Delete local data"))}</button>
</div>
</footer>
</div>`;
}

function render(content){
const app=$("app");
if(app)app.innerHTML=shell(content);
window.scrollTo({top:0,behavior:"smooth"});
}

function actionCard(icon,title,desc,action){
return`<button class="card action-card" onclick="${action}" style="border:1px solid var(--border);text-align:left;color:inherit"><div class="action-icon">${icon}</div><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div></button>`;
}

function frequencyFactor(f){
switch(String(f||"monthly")){
case"weekly":return 4.345;
case"biweekly":return 2.173;
case"one_time":return 1;
default:return 1;
}
}

function calculateLocalAvailable(){
const moneyData=getJSON(APP.keys.money,{});
const expenses=getJSON(APP.keys.expenses,[]);
const savings=getJSON(APP.keys.savings,{});
const income=Number(moneyData.income||0);
const expenseTotal=expenses.reduce((a,x)=>a+Number(x.amount||0)*frequencyFactor(x.frequency||"monthly"),0);
const saving=Number(savings.amount||0);
return income-expenseTotal-saving;
}

function renderHome(){
const moneyData=getJSON(APP.keys.money,{});
const expenses=getJSON(APP.keys.expenses,[]);
const available=calculateLocalAvailable();
render(`
<section class="hero">
<h1>${esc(t("TENGO → GANO → GASTO → AHORRO → QUIERO → PUEDO → HAGO","HAVE → EARN → SPEND → SAVE → WANT → CAN → DO"))}</h1>
<p>${esc(t("Organiza tu dinero, prepara una remesa y revisa opciones sin complicarte.","Organize your money, prepare a remittance and review options without unnecessary complexity."))}</p>
<div class="hero-actions">
<button class="btn" onclick="renderRemittance()">${esc(t("Preparar remesa","Prepare remittance"))}</button>
<button class="btn secondary" onclick="renderMoney()">${esc(t("Ver mi dinero","View my money"))}</button>
</div>
</section>
<section class="section">
<div class="section-title"><div><h2>${esc(t("¿Qué necesitas ahora?","What do you need now?"))}</h2><p>${esc(t("Elige una acción; cada opción produce un resultado.","Choose an action; each option produces a result."))}</p></div></div>
<div class="grid">
${actionCard("💸",t("Enviar dinero","Send money"),t("Prepara una remesa y revisa proveedores.","Prepare a remittance and review providers."),"renderRemittance()")}
${actionCard("💰",t("Mi dinero","My money"),t("Calcula lo que tienes disponible.","Calculate what you have available."),"renderMoney()")}
${actionCard("📅",t("Mi semana","My week"),t("Convierte tus ingresos a una referencia semanal.","Convert your income to a weekly reference."),"renderWeek()")}
${actionCard("🧾",t("Mis gastos","My expenses"),t("Registra y revisa tus gastos en este dispositivo.","Record and review expenses on this device."),"renderExpenses()")}
${actionCard("👨‍👩‍👧",t("Familia","Family"),t("Guarda referencias locales para preparar remesas.","Save local references for preparing remittances."),"renderFamily()")}
${actionCard("❓",t("Ayuda","Help"),t("Pregunta qué necesitas y recibe orientación.","Ask what you need and get guidance."),"renderHelp()")}
${actionCard("🛒",t("Quiero comprar","I want to buy"),t("Comprueba cómo una compra cambia tu cálculo.","See how a purchase changes your calculation."),"renderPurchase()")}
${actionCard("🏦",t("Ahorro","Savings"),t("Registra una cantidad para un objetivo.","Record an amount for a goal."),"renderSavings()")}
</div>
</section>
<section class="section">
<div class="section-title"><h2>${esc(t("Resumen local","Local summary"))}</h2></div>
<div class="balance-grid">
<div class="balance"><span>${esc(t("Ingresos registrados","Recorded income"))}</span><strong>${money(moneyData.income||0)}</strong></div>
<div class="balance"><span>${esc(t("Gastos registrados","Recorded expenses"))}</span><strong>${money(expenses.reduce((a,x)=>a+Number(x.amount||0)*frequencyFactor(x.frequency||"monthly"),0))}</strong></div>
<div class="balance ${available>=0?"positive":"negative"}"><span>${esc(t("Disponible calculado","Calculated available"))}</span><strong>${money(available)}</strong></div>
</div>
</section>
<section class="section">
<div class="privacy">
<div><strong>${esc(t("Privacidad clara","Clear privacy"))}</strong>
<div class="legal">${esc(t("Tus registros de dinero se guardan en este dispositivo. La información necesaria para una sesión de remesa puede procesarse temporalmente en memoria del servidor; no se guarda como registro permanente por REMESAS.","Your money records are stored on this device. Information needed for a remittance session may be temporarily processed in server memory; REMESAS does not keep it as a permanent record."))}</div>
</div>
<button class="btn danger small" onclick="deleteLocalData()">${esc(t("Borrar","Delete"))}</button>
</div>
</section>`);
}

function renderRemittance(parsed=null){
const s=APP.session||{};
const countries=getCountries();
const destinations=countries.map(c=>{
const code=esc(c.code);
const label=typeof c.name==="object"?(c.name[APP.lang]||c.name.es||c.name.en||c.code):c.name;
const selected=String(s.destination_country||parsed?.destination_country||"").toUpperCase()===c.code;
return`<option value="${code}" ${selected?"selected":""}>${esc(label)}</option>`;
}).join("");
const selectedDelivery=s.delivery_method||parsed?.delivery_method||"";
const selectedPayment=s.payment_method||parsed?.payment_method||"";
const deliveryOptions=getDeliveryMethods().map(x=>`<option value="${esc(x.id)}" ${selectedDelivery===x.id?"selected":""}>${esc(typeof x.label==="object"?(x.label[APP.lang]||x.label.es||x.label.en||x.id):x.label||x.id)}</option>`).join("");
const paymentOptions=getPaymentMethods().map(x=>`<option value="${esc(x.id)}" ${selectedPayment===x.id?"selected":""}>${esc(typeof x.label==="object"?(x.label[APP.lang]||x.label.es||x.label.en||x.id):x.label||x.id)}</option>`).join("");
const amount=s.amount||parsed?.amount||"";
const priority=s.priority||parsed?.priority||"";
const frequency=s.frequency||parsed?.frequency||"one_time";
render(`
<section class="section">
<div class="section-title">
<div><h1>${esc(t("Preparar una remesa","Prepare a remittance"))}</h1><p>${esc(t("Solo preguntamos lo que puede cambiar el siguiente paso.","We only ask for information that can change the next step."))}</p></div>
<button class="btn secondary small" onclick="renderHome()">${esc(t("Inicio","Home"))}</button>
</div>
<div class="card">
<label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label>
<input id="rem-amount" type="number" min="0.01" step="0.01" value="${esc(amount)}" placeholder="100">
<div class="form-grid">
<div>
<label>${esc(t("¿A qué país?","Where to?"))}</label>
<select id="rem-country"><option value="">${esc(t("Selecciona","Select"))}</option>${destinations}</select>
</div>
<div>
<label>${esc(t("¿Qué es más importante?","What matters most?"))}</label>
<select id="rem-priority">
<option value="">${esc(t("Selecciona","Select"))}</option>
<option value="recipient_gets_more" ${priority==="recipient_gets_more"?"selected":""}>${esc(t("Que reciba más","Recipient gets more"))}</option>
<option value="fastest" ${priority==="fastest"?"selected":""}>${esc(t("Que llegue rápido","Arrive fast"))}</option>
<option value="save" ${priority==="save"?"selected":""}>${esc(t("Ahorrar","Save"))}</option>
<option value="balanced" ${priority==="balanced"?"selected":""}>${esc(t("Equilibrio","Balanced"))}</option>
<option value="compare_all" ${priority==="compare_all"?"selected":""}>${esc(t("Comparar opciones","Compare options"))}</option>
</select>
</div>
<div>
<label>${esc(t("Frecuencia","Frequency"))}</label>
<select id="rem-frequency">
<option value="one_time" ${frequency==="one_time"?"selected":""}>${esc(t("Una vez","One time"))}</option>
<option value="weekly" ${frequency==="weekly"?"selected":""}>${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly" ${frequency==="biweekly"?"selected":""}>${esc(t("Cada dos semanas","Biweekly"))}</option>
<option value="monthly" ${frequency==="monthly"?"selected":""}>${esc(t("Mensual","Monthly"))}</option>
</select>
</div>
<div>
<label>${esc(t("Urgencia","Urgency"))}</label>
<select id="rem-urgency">
<option value="">${esc(t("Selecciona","Select"))}</option>
<option value="normal">${esc(t("Normal","Normal"))}</option>
<option value="urgent">${esc(t("Urgente","Urgent"))}</option>
</select>
</div>
<div>
<label>${esc(t("Forma de entrega","Delivery method"))}</label>
<select id="rem-delivery"><option value="">${esc(t("Selecciona","Select"))}</option>${deliveryOptions}</select>
</div>
<div>
<label>${esc(t("Forma de pago","Payment method"))}</label>
<select id="rem-payment"><option value="">${esc(t("Selecciona","Select"))}</option>${paymentOptions}</select>
</div>
</div>
<label>${esc(t("¿Algo más que debamos saber? Opcional","Anything else? Optional"))}</label>
<textarea id="rem-special" maxlength="500" placeholder="${esc(t("Escribe solo lo necesario.","Write only what is necessary."))}">${esc(s.special_need||"")}</textarea>
<button class="btn" onclick="compareRemittance()">${esc(t("Revisar opciones","Review options"))}</button>
</div>
<div id="rem-status"></div>
</section>`);
}

async function compareRemittance(){
const amount=Number($("rem-amount")?.value||0);
const country=String($("rem-country")?.value||"").toUpperCase();
const priority=$("rem-priority")?.value||null;
const frequency=$("rem-frequency")?.value||"one_time";
const urgency=$("rem-urgency")?.value||null;
const delivery=$("rem-delivery")?.value||null;
const payment=$("rem-payment")?.value||null;
const special=$("rem-special")?.value?.trim()||null;
if(!Number.isFinite(amount)||amount<=0){toast(t("Indica un monto válido.","Enter a valid amount."));return}
if(!country){toast(t("Selecciona el país de destino.","Select the destination country."));return}
const known=getCountries().some(x=>x.code===country);
if(!known){toast(t("Ese país no está disponible en el catálogo actual.","That country is not available in the current catalog."));return}
const status=$("rem-status");
if(status)status.innerHTML=loading(t("Revisando opciones...","Reviewing options..."));
try{
if(!APP.session)await startSession();
const need=await api("/api/need",{method:"POST",body:JSON.stringify({session_id:APP.session?.session_id,language:APP.lang,amount,destination_country:country,priority,urgency:urgency==="urgent",frequency,delivery_method:delivery,payment_method:payment,special_need:special,need_type:"remittance"})});
APP.session=need.session||APP.session;
const result=await api(`/api/session/${APP.session.session_id}/compare`,{method:"POST",body:JSON.stringify({session_id:APP.session.session_id,amount,destination_country:country,send_currency:"USD",priority,delivery_method:delivery,payment_method:payment,language:APP.lang})});
APP.comparison=result;
renderComparison(result);
}catch(e){
if(status)status.innerHTML=errorBox(e.message);
}
}

function providerLabel(p){
return p?.provider_name||p?.name||p?.provider_id||"Provider";
}

function providerCard(p){
const verified=p?.commercial_verified||p?.commercial_status==="verified";
const url=p?.continue_url||p?.official_site||"";
const methods=[];
if(Array.isArray(p?.delivery_methods))methods.push(`${t("Entrega","Delivery")}: ${p.delivery_methods.join(", ")}`);
if(Array.isArray(p?.payment_methods))methods.push(`${t("Pago","Payment")}: ${p.payment_methods.join(", ")}`);
return`<div class="card provider-card">
<h3>${esc(providerLabel(p))}</h3>
<div class="status">${esc(verified?t("Datos verificados","Verified data"):t("Revisar en sitio oficial","Review official site"))}</div>
${p?.fee!=null?`<p><strong>${esc(t("Comisión","Fee"))}:</strong> ${esc(p.fee)}</p>`:""}
${p?.exchange_rate!=null?`<p><strong>${esc(t("Tasa","Rate"))}:</strong> ${esc(p.exchange_rate)}</p>`:""}
${p?.recipient_amount!=null?`<p><strong>${esc(t("Recibe","Receives"))}:</strong> ${esc(p.recipient_amount)}</p>`:""}
${p?.delivery_time!=null?`<p><strong>${esc(t("Tiempo","Timing"))}:</strong> ${esc(p.delivery_time)}</p>`:""}
${methods.map(x=>`<p>${esc(x)}</p>`).join("")}
<button class="btn" onclick="selectProvider('${esc(p.provider_id)}')">${esc(t("Revisar esta opción","Review this option"))}</button>
${url?`<button class="btn secondary" onclick="openOfficial('${esc(url)}')">${esc(t("Sitio oficial","Official site"))}</button>`:""}
</div>`;
}

function renderComparison(data){
const available=Array.isArray(data?.available_providers)?data.available_providers:[];
const results=Array.isArray(data?.results)?data.results:[];
const merged=available.length?available:results;
render(`
<section class="section">
<div class="section-title"><div><h1>${esc(t("Opciones para revisar","Options to review"))}</h1><p>${esc(data?.destination_name||countryName(data?.destination_country||""))} · ${money(data?.amount||0)}</p></div></div>
<div class="notice">${esc(data?.message||t("Revisa las opciones y confirma los datos finales en el sitio oficial.","Review the options and confirm final details on the official site."))}</div>
${data?.explanation?`<div class="card"><p>${esc(data.explanation)}</p></div>`:""}
<div class="grid">${merged.map(providerCard).join("")||`<div class="card">${esc(t("No hay proveedores disponibles para mostrar.","No providers are available to display."))}</div>`}</div>
<div class="actions"><button class="btn secondary" onclick="renderRemittance()">${esc(t("Modificar remesa","Modify remittance"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div>
</section>`);
}

async function selectProvider(providerId){
if(!APP.session?.session_id){toast(t("La sesión terminó. Empieza de nuevo.","The session ended. Start again."));renderRemittance();return}
try{
const option=await api(`/api/session/${APP.session.session_id}/select/${encodeURIComponent(providerId)}`,{method:"POST"});
APP.session.selected_option=option;
renderFinalCheck(option);
}catch(e){render(`<section class="section">${errorBox(e.message)}<button class="btn secondary" onclick="renderRemittance()">${esc(t("Intentar de nuevo","Try again"))}</button></section>`)}
}

function renderFinalCheck(option){
const country=APP.session?.destination_country||"";
const amount=Number(APP.session?.amount||0);
const delivery=APP.session?.delivery_method||"";
render(`
<section class="section">
<div class="section-title"><div><h1>${esc(t("Última revisión","Final review"))}</h1><p>${esc(providerLabel(option))}</p></div></div>
<div class="card">
<p><strong>${esc(t("País","Country"))}:</strong> ${esc(countryName(country))}</p>
<p><strong>${esc(t("Monto","Amount"))}:</strong> ${money(amount)}</p>
<p><strong>${esc(t("Entrega","Delivery"))}:</strong> ${esc(delivery||t("Revisar","Review"))}</p>
<p>${esc(t("Antes de continuar, confirma la información final directamente con el proveedor.","Before continuing, confirm the final information directly with the provider."))}</p>
<ul>
<li>${esc(t("Comisión final","Final fee"))}: ${esc(option?.fee??t("No verificada","Not verified"))}</li>
<li>${esc(t("Tasa de cambio","Exchange rate"))}: ${esc(option?.exchange_rate??t("No verificada","Not verified"))}</li>
<li>${esc(t("Cantidad recibida","Recipient amount"))}: ${esc(option?.recipient_amount??t("No verificada","Not verified"))}</li>
</ul>
<button class="btn" onclick="runFinalCheck()">${esc(t("Confirmar revisión","Confirm review"))}</button>
<button class="btn secondary" onclick="renderComparison(APP.comparison)">${esc(t("Volver a opciones","Back to options"))}</button>
</div>
</section>`);
}

async function runFinalCheck(){
const s=APP.session||{};
try{
const data=await api("/api/final-check",{method:"POST",body:JSON.stringify({session_id:s.session_id,provider_id:s.selected_option?.provider_id||"",destination_country:s.destination_country,amount:Number(s.amount||0),send_currency:"USD",delivery_method:s.delivery_method||null,payment_method:s.payment_method||null,recipient_information:null,fee:s.selected_option?.fee??null,exchange_rate:s.selected_option?.exchange_rate??null,recipient_amount:s.selected_option?.recipient_amount??null,language:APP.lang})});
renderFinalResult(data,s.selected_option);
}catch(e){toast(e.message)}
}

function renderFinalResult(data,option){
const url=option?.continue_url||option?.official_site||"";
render(`
<section class="section">
<div class="card">
<h1>${esc(t("Revisión terminada","Review completed"))}</h1>
<p>${esc(data?.message||t("Revisa los datos finales en el sitio oficial.","Review the final details on the official site."))}</p>
${Array.isArray(data?.checks)?`<div class="checks">${data.checks.map(c=>`<div class="check"><span>${c.complete?"✓":"!"}</span><strong>${esc(c.label)}</strong><span>${esc(c.value)}</span></div>`).join("")}</div>`:""}
<div class="notice">${esc(t("REMESAS no completa el envío. El siguiente paso ocurre en el sitio oficial del proveedor.","REMESAS does not complete the transfer. The next step occurs on the provider's official site."))}</div>
${url?`<button class="btn" onclick="openOfficial('${esc(url)}')">${esc(t("Continuar en sitio oficial","Continue on official site"))}</button>`:""}
<button class="btn secondary" onclick="renderHome()">${esc(t("Terminar","Finish"))}</button>
</div>
</section>`);
}

function openOfficial(url){
if(!/^https:\/\//i.test(url)){toast(t("Solo se permiten enlaces HTTPS.","Only HTTPS links are allowed."));return}
window.open(url,"_blank","noopener,noreferrer");
}

async function changeLanguage(){
APP.lang=APP.lang==="es"?"en":"es";
localStorage.setItem(APP.keys.lang,APP.lang);
localStorage.setItem("remesas_lang",APP.lang);
try{
await loadConfig();
if(APP.session)APP.session.language=APP.lang;
renderHome();
}catch(e){toast(e.message)}
}

function renderMoney(){
const d=getJSON(APP.keys.money,{});
render(`
<section class="section">
<div class="section-title"><div><h1>${esc(t("Mi dinero","My money"))}</h1><p>${esc(t("Registra lo que tienes y calcula lo disponible.","Record what you have and calculate what remains."))}</p></div></div>
<div class="card">
<label>${esc(t("Ingresos disponibles","Available income"))}</label>
<input id="money-income" type="number" min="0" step="0.01" value="${esc(d.income||"")}">
<label>${esc(t("Dinero inicial adicional","Additional starting money"))}</label>
<input id="money-start" type="number" min="0" step="0.01" value="${esc(d.start||"")}">
<button class="btn" onclick="saveMoney()">${esc(t("Calcular","Calculate"))}</button>
</div>
<div id="money-result" class="card">
<strong>${esc(t("Disponible calculado","Calculated available"))}: ${money(calculateLocalAvailable())}</strong>
</div>
</section>`);
}

function saveMoney(){
const income=Number($("money-income")?.value||0);
const start=Number($("money-start")?.value||0);
if(income<0||start<0){toast(t("Usa cantidades válidas.","Use valid amounts."));return}
setJSON(APP.keys.money,{income,start});
toast(t("Guardado en este dispositivo.","Saved on this device."));
renderMoney();
}

function renderWeek(){
const d=getJSON(APP.keys.money,{});
const income=Number(d.income||0);
render(`
<section class="section"><div class="card">
<h1>${esc(t("Mi semana","My week"))}</h1>
<p>${esc(t("Una referencia sencilla a partir de tus ingresos registrados.","A simple reference based on your recorded income."))}</p>
<h2>${money(income/4.345)}</h2>
<p>${esc(t("Referencia semanal aproximada.","Approximate weekly reference."))}</p>
<button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div></section>`);
}

function renderExpenses(){
const items=getJSON(APP.keys.expenses,[]);
render(`
<section class="section">
<div class="section-title"><div><h1>${esc(t("Mis gastos","My expenses"))}</h1><p>${esc(t("Los registros permanecen en este dispositivo.","Records stay on this device."))}</p></div></div>
<div class="card">
<label>${esc(t("Concepto","Description"))}</label><input id="exp-name" maxlength="100">
<label>${esc(t("Cantidad","Amount"))}</label><input id="exp-amount" type="number" min="0.01" step="0.01">
<label>${esc(t("Frecuencia","Frequency"))}</label>
<select id="exp-frequency"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Cada dos semanas","Biweekly"))}</option><option value="one_time">${esc(t("Una vez","One time"))}</option></select>
<button class="btn" onclick="addExpense()">${esc(t("Agregar gasto","Add expense"))}</button>
</div>
<div class="card">${items.length?items.map((x,i)=>`<div class="list-row"><span>${esc(x.name)}</span><strong>${money(x.amount)}</strong><button class="btn danger small" onclick="removeExpense(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<p>${esc(t("Todavía no hay gastos registrados.","No expenses recorded yet."))}</p>`}</div>
<button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</section>`);
}

function addExpense(){
const name=$("exp-name")?.value.trim();
const amount=Number($("exp-amount")?.value||0);
const frequency=$("exp-frequency")?.value||"monthly";
if(!name||amount<=0){toast(t("Completa concepto y cantidad.","Enter a description and amount."));return}
const items=getJSON(APP.keys.expenses,[]);
items.push({name,amount,frequency,created_at:new Date().toISOString()});
setJSON(APP.keys.expenses,items);
toast(t("Gasto guardado.","Expense saved."));
renderExpenses();
}

function removeExpense(i){
const items=getJSON(APP.keys.expenses,[]);
items.splice(i,1);
setJSON(APP.keys.expenses,items);
renderExpenses();
}

function renderFamily(){
const items=getJSON(APP.keys.family,[]);
render(`
<section class="section"><div class="card">
<h1>${esc(t("Familia","Family"))}</h1>
<p>${esc(t("Guarda referencias locales para no repetir información.","Store local references so you do not repeat information."))}</p>
<label>${esc(t("Nombre","Name"))}</label><input id="fam-name" maxlength="100">
<label>${esc(t("País","Country"))}</label>
<select id="fam-country"><option value="">${esc(t("Selecciona","Select"))}</option>${getCountries().map(c=>`<option value="${c.code}">${esc(typeof c.name==="object"?(c.name[APP.lang]||c.name.es||c.name.en||c.code):c.name)}</option>`).join("")}</select>
<button class="btn" onclick="addFamily()">${esc(t("Guardar referencia","Save reference"))}</button>
</div>
<div class="card">${items.length?items.map((x,i)=>`<div class="list-row"><span>${esc(x.name)} · ${esc(countryName(x.country))}</span><button class="btn danger small" onclick="removeFamily(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<p>${esc(t("No hay referencias guardadas.","No saved references."))}</p>`}</div>
<button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</section>`);
}

function addFamily(){
const name=$("fam-name")?.value.trim();
const country=$("fam-country")?.value||"";
if(!name||!country){toast(t("Completa nombre y país.","Enter name and country."));return}
const items=getJSON(APP.keys.family,[]);
items.push({name,country});
setJSON(APP.keys.family,items);
renderFamily();
}

function removeFamily(i){
const items=getJSON(APP.keys.family,[]);
items.splice(i,1);
setJSON(APP.keys.family,items);
renderFamily();
}

function renderSavings(){
const d=getJSON(APP.keys.savings,{});
render(`
<section class="section"><div class="card">
<h1>${esc(t("Ahorro","Savings"))}</h1>
<p>${esc(t("Registra cuánto quieres separar y observa el efecto en tu disponible.","Record how much you want to set aside and see its effect on available money."))}</p>
<label>${esc(t("Cantidad de ahorro","Savings amount"))}</label>
<input id="saving-amount" type="number" min="0" step="0.01" value="${esc(d.amount||"")}">
<button class="btn" onclick="saveSavings()">${esc(t("Guardar ahorro","Save savings"))}</button>
<p>${esc(t("Disponible después del ahorro","Available after savings"))}: <strong>${money(calculateLocalAvailable())}</strong></p>
<button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div></section>`);
}

function saveSavings(){
const amount=Number($("saving-amount")?.value||0);
if(amount<0){toast(t("Cantidad inválida.","Invalid amount."));return}
setJSON(APP.keys.savings,{amount});
toast(t("Ahorro guardado.","Savings saved."));
renderSavings();
}

function renderPurchase(){
render(`
<section class="section"><div class="card">
<h1>${esc(t("Planear una compra","Plan a purchase"))}</h1>
<p>${esc(t("Comprueba cómo una compra cambia tu dinero disponible antes de hacerla.","See how a purchase changes your available money before buying."))}</p>
<label>${esc(t("Precio de la compra","Purchase price"))}</label>
<input id="purchase-amount" type="number" min="0.01" step="0.01">
<button class="btn" onclick="calculatePurchase()">${esc(t("Calcular efecto","Calculate effect"))}</button>
<div id="purchase-result"></div>
<button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div></section>`);
}

function calculatePurchase(){
const amount=Number($("purchase-amount")?.value||0);
if(amount<=0){toast(t("Indica una cantidad válida.","Enter a valid amount."));return}
const available=calculateLocalAvailable();
const result=available-amount;
$("purchase-result").innerHTML=`<div class="notice"><strong>${esc(t("Después de la compra","After purchase"))}:</strong> ${money(result)}</div>`;
}

function renderHelp(){
const topics=APP.config?.help_topics||[];
render(`
<section class="section">
<div class="card">
<h1>${esc(t("Ayuda","Help"))}</h1>
<p>${esc(t("Elige una pregunta para obtener una respuesta funcional.","Choose a question to get a useful answer."))}</p>
${topics.length?topics.map(x=>`<button class="card" style="width:100%;text-align:left;margin-top:10px" onclick="showHelpTopic(${JSON.stringify(x.answer||"").replace(/"/g,"&quot;")})"><strong>${esc(x.label||"")}</strong></button>`).join(""):`<p>${esc(t("La ayuda básica está disponible desde las preguntas de la aplicación.","Basic help is available through the app questions."))}</p>`}
<button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button>
</div></section>`);
}

function showHelpTopic(answer){
const text=typeof answer==="object"?(answer[APP.lang]||answer.es||answer.en||""):answer;
toast(text);
}

async function askAssistant(text){
try{
const data=await api("/api/assistant",{method:"POST",body:JSON.stringify({need_type:"other",language:APP.lang,text})});
toast(data.message||t("Respuesta recibida.","Response received."));
}catch(e){toast(e.message)}
}

function deleteLocalData(){
const ok=confirm(t("¿Borrar todos los registros locales de REMESAS?","Delete all REMESAS local records?"));
if(!ok)return;
Object.values(APP.keys).forEach(k=>localStorage.removeItem(k));
localStorage.removeItem("remesas_lang");
APP.lang="es";
toast(t("Datos locales borrados.","Local data deleted."));
renderHome();
}

async function boot(){
try{
await loadConfig();
await startSession();
renderHome();
}catch(e){
const app=$("app");
if(app)app.innerHTML=`<section class="section"><div class="card">${errorBox(e.message)}<button class="btn" onclick="location.reload()">${esc(t("Intentar de nuevo","Try again"))}</button></div></section>`;
}
}

window.renderHome=renderHome;
window.renderRemittance=renderRemittance;
window.compareRemittance=compareRemittance;
window.selectProvider=selectProvider;
window.runFinalCheck=runFinalCheck;
window.renderMoney=renderMoney;
window.renderWeek=renderWeek;
window.renderExpenses=renderExpenses;
window.addExpense=addExpense;
window.removeExpense=removeExpense;
window.renderFamily=renderFamily;
window.addFamily=addFamily;
window.removeFamily=removeFamily;
window.renderSavings=renderSavings;
window.saveSavings=saveSavings;
window.renderPurchase=renderPurchase;
window.calculatePurchase=calculatePurchase;
window.renderHelp=renderHelp;
window.showHelpTopic=showHelpTopic;
window.changeLanguage=changeLanguage;
window.deleteLocalData=deleteLocalData;
window.openOfficial=openOfficial;

document.addEventListener("DOMContentLoaded",boot);
