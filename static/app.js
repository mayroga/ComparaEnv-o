"use strict";

const APP={
  config:null,sessionId:null,
  language:localStorage.getItem("remesas_language")||"es",
  screen:"home",
  amount:"",
  destination:localStorage.getItem("remesas_destination")||"",
  priority:"",
  delivery:"",
  payment:"",
  freeText:"",
  comparison:null,
  selectedProvider:null,
  money:{
    available:Number(localStorage.getItem("remesas_money_available")||0),
    payWhen:localStorage.getItem("remesas_money_pay_when")||"week",
    needs:JSON.parse(localStorage.getItem("remesas_money_needs")||"[]"),
    expenses:JSON.parse(localStorage.getItem("remesas_money_expenses")||"[]"),
    family:JSON.parse(localStorage.getItem("remesas_money_family")||"[]")
  }
};

const TEXT={
es:{
title:"REMESAS",brand:"May Roga LLC",language:"EN",
home:"INICIO",money:"MI DINERO",week:"MI SEMANA",send:"ENVIAR DINERO",expenses:"MIS GASTOS",family:"FAMILIA",
heroTitle:"TU DINERO, MÁS CLARO",heroText:"Primero vemos cuánto puedes usar hasta tu próximo pago. Después comparamos dónde enviar tu dinero.",
moneyTitle:"💵 MI DINERO",moneyText:"Dime cuánto tienes disponible y cuándo vuelves a cobrar.",
availableMoney:"¿CUÁNTO DINERO TIENES DISPONIBLE?",moneyPlaceholder:"Ej. 386",
payWhen:"¿CUÁNDO VUELVES A COBRAR?",
today:"HOY",thisWeek:"ESTA SEMANA",twoWeeks:"EN 2 SEMANAS",thisMonth:"ESTE MES",
cover:"¿QUÉ NECESITAS CUBRIR ANTES DE COBRAR OTRA VEZ?",
house:"Casa",food:"Comida",car:"Carro",insurance:"Seguro",phone:"Teléfono",debts:"Deudas",familyNeed:"Familia",other:"Otro",
calculate:"CALCULAR",daily:"Puedes disponer aproximadamente",perDay:"por día",
untilPay:"Hasta tu próximo pago",available:"Dinero disponible",
sendQuestion:"💸 ¿QUIERES ENVIAR DINERO?",sendExplain:"Puedes revisar cuánto puedes enviar y cuánto conservar para tus gastos.",
sendAmount:"¿CUÁNTO QUIERES ENVIAR?",sendAmountPlaceholder:"Ej. 100",
keep:"Te quedarían aproximadamente",
compare:"COMPARAR ENVÍOS →",compareOnly:"SOLO COMPARAR ENVÍOS",
noSend:"NO QUIERO ENVIAR AHORA",
safe:"🟢 Este envío deja dinero disponible para el período indicado.",
warning:"⚠️ Revisa este envío: puede dejarte con poco dinero hasta tu próximo pago.",
notEnough:"⚠️ Este envío es mayor que el dinero que tienes disponible.",
needKeep:"¿CUÁNTO NECESITAS CONSERVAR?",recommended:"OPCIÓN QUE COINCIDE CON TU PRIORIDAD",
options:"OPCIONES PARA TI",availableProviders:"PLATAFORMAS DISPONIBLES",
verified:"Información verificada",unverified:"No confirmado",
commercialUnavailable:"Cotización actual no confirmada",
fee:"Tarifa",rate:"Tipo de cambio",receive:"Recibe",delivery:"Entrega",method:"Forma de entrega",
official:"IR AL PROVEEDOR",review:"REVISA ANTES DE ENVIAR",country:"País",send:"Monto a enviar",
receiveAmount:"Monto que recibe",payment:"Forma de pago",check:"VERIFICAR",selected:"Opción seleccionada",
finalText:"Antes de continuar, revisa que los datos coincidan con lo que quieres enviar.",
yes:"CONFIRMAR",no:"VOLVER",back:"ATRÁS",clear:"EMPEZAR DE NUEVO",
loading:"Buscando opciones para lo que necesitas.",error:"No pudimos completar la consulta. Inténtalo nuevamente.",
countryRequired:"Selecciona un país.",amountRequired:"Indica cuánto quieres enviar.",
priority:"¿QUÉ ES LO MÁS IMPORTANTE PARA TI?",fastest:"MÁS RÁPIDO",save:"AHORRAR",receiveMore:"QUE RECIBA MÁS",urgent:"URGENTE",balanced:"MEJOR EQUILIBRIO",compareAll:"COMPARAR TODO",
freeText:"Cuéntame qué necesitas",freeTextPlaceholder:"Ej. Quiero mandar $500 a México y necesito que llegue hoy.",
help:"NO SÉ QUÉ HACER",helpTitle:"Te ayudamos a decidir",helpText:"No necesitas conocer las remesadoras. Dinos cuánto quieres enviar y qué es más importante para ti.",
spentToday:"Gastado hoy",planned:"Gastos previstos",income:"Ingresos",remaining:"Disponible",
addExpense:"AGREGAR GASTO",expenseName:"¿En qué gastaste?",expenseAmount:"¿Cuánto?",add:"AGREGAR",noExpenses:"Todavía no has agregado gastos.",
familyTitle:"👨‍👩‍👧 FAMILIA",familyText:"Puedes guardar nombres o etiquetas solo en este dispositivo.",familyName:"Nombre o etiqueta",familyCountry:"País",saveFamily:"GUARDAR",noFamily:"Todavía no has agregado familiares.",
delete:"BORRAR",localOnly:"Solo en este dispositivo",
saved:"Guardado",summary:"RESUMEN",resetMoney:"BORRAR DATOS DE MI DINERO",
day1:"1 día",days7:"7 días",days14:"14 días",days30:"30 días",
currency:"USD",noQuote:"—",continue:"CONTINUAR"
},
en:{
title:"REMITTANCES",brand:"May Roga LLC",language:"ES",
home:"HOME",money:"MY MONEY",week:"MY WEEK",send:"SEND MONEY",expenses:"MY EXPENSES",family:"FAMILY",
heroTitle:"YOUR MONEY, CLEARER",heroText:"First we see how much you can use until your next paycheck. Then we compare where to send your money.",
moneyTitle:"💵 MY MONEY",moneyText:"Tell me how much you have available and when you get paid again.",
availableMoney:"HOW MUCH MONEY DO YOU HAVE AVAILABLE?",moneyPlaceholder:"Example: 386",
payWhen:"WHEN DO YOU GET PAID AGAIN?",
today:"TODAY",thisWeek:"THIS WEEK",twoWeeks:"IN 2 WEEKS",thisMonth:"THIS MONTH",
cover:"WHAT DO YOU NEED TO COVER BEFORE YOU GET PAID AGAIN?",
house:"Home",food:"Food",car:"Car",insurance:"Insurance",phone:"Phone",debts:"Debts",familyNeed:"Family",other:"Other",
calculate:"CALCULATE",daily:"You can have approximately",perDay:"per day",
untilPay:"Until your next paycheck",available:"Available money",
sendQuestion:"💸 DO YOU WANT TO SEND MONEY?",sendExplain:"Check how much you can send while keeping enough for your expenses.",
sendAmount:"HOW MUCH DO YOU WANT TO SEND?",sendAmountPlaceholder:"Example: 100",
keep:"You would have approximately",
compare:"COMPARE TRANSFERS →",compareOnly:"COMPARE TRANSFERS ONLY",
noSend:"I DON'T WANT TO SEND NOW",
safe:"🟢 This transfer leaves money available for the selected period.",
warning:"⚠️ Review this transfer: it may leave you with little money until your next paycheck.",
notEnough:"⚠️ This transfer is greater than the money you currently have available.",
needKeep:"HOW MUCH DO YOU NEED TO KEEP?",
recommended:"OPTION MATCHING YOUR PRIORITY",
options:"OPTIONS FOR YOU",availableProviders:"AVAILABLE PLATFORMS",
verified:"Verified information",unverified:"Not confirmed",
commercialUnavailable:"Current quote not confirmed",
fee:"Fee",rate:"Exchange rate",receive:"Recipient gets",delivery:"Delivery",method:"Delivery method",
official:"GO TO PROVIDER",review:"REVIEW BEFORE SENDING",country:"Country",send:"Amount to send",
receiveAmount:"Recipient gets",payment:"Payment method",check:"VERIFY",selected:"Selected option",
finalText:"Before continuing, make sure the details match what you want to send.",
yes:"CONFIRM",no:"GO BACK",back:"BACK",clear:"START OVER",
loading:"Looking for options that fit what you need.",error:"We couldn't complete the request. Please try again.",
countryRequired:"Select a country.",amountRequired:"Enter the amount.",
priority:"WHAT MATTERS MOST TO YOU?",fastest:"FASTEST",save:"SAVE MONEY",receiveMore:"RECIPIENT GETS MORE",urgent:"URGENT",balanced:"BEST BALANCE",compareAll:"COMPARE EVERYTHING",
freeText:"Tell me what you need",freeTextPlaceholder:"Example: I want to send $500 to Mexico and need it there today.",
help:"I DON'T KNOW WHAT TO DO",helpTitle:"We'll help you decide",helpText:"You don't need to know the remittance providers. Tell us how much you want to send and what matters most.",
spentToday:"Spent today",planned:"Planned expenses",income:"Income",remaining:"Available",
addExpense:"ADD EXPENSE",expenseName:"What did you spend on?",expenseAmount:"How much?",add:"ADD",noExpenses:"You haven't added any expenses yet.",
familyTitle:"👨‍👩‍👧 FAMILY",familyText:"You can save names or labels only on this device.",familyName:"Name or label",familyCountry:"Country",saveFamily:"SAVE",noFamily:"You haven't added family members yet.",
delete:"DELETE",localOnly:"Only on this device",saved:"Saved",summary:"SUMMARY",resetMoney:"CLEAR MY MONEY DATA",
day1:"1 day",days7:"7 days",days14:"14 days",days30:"30 days",currency:"USD",noQuote:"—",continue:"CONTINUE"
}};

function t(k){return(TEXT[APP.language]||TEXT.es)[k]||k}

function esc(v){
return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function money(v,currency="USD"){
if(v===null||v===undefined||v==="")return"—";
const n=Number(v);
if(!Number.isFinite(n))return"—";
try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:currency||"USD",maximumFractionDigits:2}).format(n)}
catch(e){return`${n.toFixed(2)} ${currency}`}
}

async function api(url,options={}){
const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
let data=null;
try{data=await r.json()}catch(e){}
if(!r.ok)throw new Error(data?.detail||data?.message||data?.error||t("error"));
return data;
}

function saveLocal(){
localStorage.setItem("remesas_language",APP.language);
if(APP.destination)localStorage.setItem("remesas_destination",APP.destination);
localStorage.setItem("remesas_money_available",String(APP.money.available||0));
localStorage.setItem("remesas_money_pay_when",APP.money.payWhen);
localStorage.setItem("remesas_money_needs",JSON.stringify(APP.money.needs||[]));
localStorage.setItem("remesas_money_expenses",JSON.stringify(APP.money.expenses||[]));
localStorage.setItem("remesas_money_family",JSON.stringify(APP.money.family||[]));
}

function renderHeader(){
return`<header class="topbar"><div class="brand"><div class="brand-mark">R</div><div><strong>${esc(t("title"))}</strong><span>${esc(t("brand"))}</span></div></div><button class="language-btn" id="languageBtn">${esc(t("language"))}</button></header><nav class="nav-tabs"><button data-screen="home" class="${APP.screen==="home"?"active":""}">🏠 ${esc(t("home"))}</button><button data-screen="money" class="${APP.screen==="money"?"active":""}">💵 ${esc(t("money"))}</button><button data-screen="week" class="${APP.screen==="week"?"active":""}">📊 ${esc(t("week"))}</button><button data-screen="expenses" class="${APP.screen==="expenses"?"active":""}">🧾 ${esc(t("expenses"))}</button><button data-screen="family" class="${APP.screen==="family"?"active":""}">👨‍👩‍👧 ${esc(t("family"))}</button></nav>`;
}

function bindHeader(){
document.getElementById("languageBtn")?.addEventListener("click",async()=>{
APP.language=APP.language==="es"?"en":"es";saveLocal();
try{await loadConfig()}catch(e){}
renderScreen();
});
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>{APP.screen=b.dataset.screen;renderScreen()}));
}

function daysUntilPay(){
return APP.money.payWhen==="today"?1:APP.money.payWhen==="week"?7:APP.money.payWhen==="two_weeks"?14:30;
}

function payLabel(){
const map={today:t("today"),week:t("thisWeek"),two_weeks:t("twoWeeks"),month:t("thisMonth")};
return map[APP.money.payWhen]||t("thisWeek");
}

function dailyAvailable(){
const available=Number(APP.money.available)||0;
const spent=APP.money.expenses.reduce((a,x)=>a+(Number(x.amount)||0),0);
return Math.max(0,available-spent)/daysUntilPay();
}

function moneyNeedsTotal(){
return APP.money.needs.reduce((sum,id)=>{
const item=APP.money.expenses.find(x=>x.category===id);
return sum+(item?Number(item.amount)||0:0);
},0);
}

function renderHome(){
const daily=dailyAvailable();
const available=Math.max(0,(Number(APP.money.available)||0)-APP.money.expenses.reduce((a,x)=>a+(Number(x.amount)||0),0));
const hasMoney=Number(APP.money.available)>0;
const app=document.getElementById("app");
app.innerHTML=`${renderHeader()}<main class="shell">
<section class="hero home-hero"><div class="hero-badge">● SIMPLE · CLARO · DIRECTO</div><h1>${esc(t("heroTitle"))}</h1><p>${esc(t("heroText"))}</p></section>
<section class="dashboard-grid">
<div class="dashboard-card main-money"><span class="dash-icon">💵</span><small>${esc(t("available"))}</small><strong>${hasMoney?money(available):"—"}</strong><span>${esc(t("daily"))}: <b>${hasMoney?money(daily):"—"}</b> ${esc(t("perDay"))}</span></div>
<div class="dashboard-card"><span class="dash-icon">📅</span><small>${esc(t("untilPay"))}</small><strong>${hasMoney?payLabel():"—"}</strong><span>${hasMoney?`${daysUntilPay()} ${APP.language==="es"?"días":"days"}`:""}</span></div>
</section>
<section class="main-card home-actions"><h2>${esc(t("moneyTitle"))}</h2><p>${esc(t("moneyText"))}</p><button class="primary-btn" id="moneyBtn">${esc(t("money"))}</button><button class="secondary-btn" id="compareBtn">${esc(t("compareOnly"))}</button></section>
<footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer>
</main>`;
bindHeader();
document.getElementById("moneyBtn")?.addEventListener("click",()=>{APP.screen="money";renderScreen()});
document.getElementById("compareBtn")?.addEventListener("click",()=>{APP.screen="send";renderScreen()});
document.getElementById("clearBtn")?.addEventListener("click",restart);
}

function renderMoney(){
const needs=[
["house","🏠"],["food","🍎"],["car","🚗"],["insurance","🛡️"],["phone","📱"],["debts","💳"],["familyNeed","👨‍👩‍👧"],["other","➕"]
];
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell">
<section class="results-head"><div class="hero-badge">💵 ${esc(t("money"))}</div><h1>${esc(t("moneyTitle"))}</h1><p>${esc(t("moneyText"))}</p></section>
<section class="main-card money-card">
<div class="field"><label>${esc(t("availableMoney"))}</label><div class="amount-wrap"><span>$</span><input id="moneyInput" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${esc(t("moneyPlaceholder"))}" value="${APP.money.available||""}"></div></div>
<div class="field"><label>${esc(t("payWhen"))}</label><div class="pay-grid">
${[["today","today"],["week","thisWeek"],["two_weeks","twoWeeks"],["month","thisMonth"]].map(x=>`<button class="pay-btn ${APP.money.payWhen===x[0]?"active":""}" data-pay="${x[0]}">${esc(t(x[1]))}</button>`).join("")}
</div></div>
<div class="field"><label>${esc(t("cover"))}</label><div class="need-grid">${needs.map(n=>`<label class="check-card"><input type="checkbox" value="${n[0]}" ${APP.money.needs.includes(n[0])?"checked":""}><span>${n[1]}</span>${esc(t(n[0]))}</label>`).join("")}</div></div>
<button class="primary-btn" id="calculateMoney">${esc(t("calculate"))}</button>
</section>
${renderMoneySummary()}
</main>`;
bindHeader();
document.getElementById("moneyInput")?.addEventListener("input",e=>APP.money.available=Math.max(0,Number(e.target.value)||0));
document.querySelectorAll("[data-pay]").forEach(b=>b.addEventListener("click",()=>{APP.money.payWhen=b.dataset.pay;renderMoney()}));
document.querySelectorAll(".need-grid input").forEach(x=>x.addEventListener("change",()=>{APP.money.needs=[...document.querySelectorAll(".need-grid input:checked")].map(i=>i.value);saveLocal()}));
document.getElementById("calculateMoney")?.addEventListener("click",()=>{saveLocal();renderMoney()});
}

function renderMoneySummary(){
if(!(Number(APP.money.available)>0))return"";
const available=Math.max(0,Number(APP.money.available)-APP.money.expenses.reduce((a,x)=>a+(Number(x.amount)||0),0));
const daily=available/daysUntilPay();
return`<section class="money-summary"><div class="summary-label">💵 ${esc(t("summary"))}</div><div class="summary-main"><div><small>${esc(t("available"))}</small><strong>${money(available)}</strong></div><div><small>${esc(t("untilPay"))}</small><strong>${esc(payLabel())}</strong></div><div><small>${esc(t("daily"))}</small><strong>${money(daily)}</strong><span>${esc(t("perDay"))}</span></div></div><div class="summary-note">${esc(t("sendExplain"))}</div><button class="primary-btn" id="goSend">${esc(t("send"))} →</button><button class="secondary-btn" id="resetMoney">${esc(t("resetMoney"))}</button></section>`;
}

function renderSend(){
const available=Math.max(0,Number(APP.money.available)-APP.money.expenses.reduce((a,x)=>a+(Number(x.amount)||0),0));
const send=Number(APP.amount)||0;
const left=available-send;
const countries=APP.config?.countries||[];
let options=`<option value="">${esc(t("countryRequired"))}</option>`;
countries.forEach(c=>{
const id=typeof c==="string"?c:(c.id||c.code||"");
const name=typeof c==="string"?c:(c.name||c.country||id);
options+=`<option value="${esc(id)}" ${APP.destination===id?"selected":""}>${esc(name)}</option>`;
});
const priorities=["fastest","save","recipient_gets_more","urgent","balanced","compare_all"];
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell">
<section class="results-head"><div class="hero-badge">💸 ${esc(t("send"))}</div><h1>${esc(t("sendQuestion"))}</h1><p>${esc(t("sendExplain"))}</p></section>
${available>0?`<section class="balance-strip"><span>${esc(t("available"))}</span><strong>${money(available)}</strong><small>${esc(t("untilPay"))}: ${esc(payLabel())}</small></section>`:""}
<section class="main-card">
<div class="field"><label>${esc(t("sendAmount"))}</label><div class="amount-wrap"><span>$</span><input id="amountInput" type="number" min="1" step="0.01" inputmode="decimal" placeholder="${esc(t("sendAmountPlaceholder"))}" value="${esc(APP.amount)}"></div></div>
${send>0&&available>0?`<div class="send-impact ${left<0?"danger":left<Math.max(available*.2,50)?"warning":"safe"}"><strong>${left<0?esc(t("notEnough")):left<Math.max(available*.2,50)?esc(t("warning")):esc(t("safe"))}</strong><span>${esc(t("keep"))}: <b>${money(Math.max(0,left))}</b></span></div>`:""}
<div class="field"><label>${esc(t("destination"))}</label><select id="destinationInput">${options}</select></div>
<div class="field"><label>${esc(t("priority"))}</label><div class="priority-grid">${priorities.map(p=>`<button class="priority-btn ${APP.priority===p?"active":""}" data-priority="${p}">${esc(t(p==="recipient_gets_more"?"receiveMore":p==="compare_all"?"compareAll":p))}</button>`).join("")}</div></div>
<button class="primary-btn" id="continueSend">${esc(t("compare"))}</button>
<button class="secondary-btn" id="backMoney">${esc(t("money"))}</button>
</section>
</main>`;
bindHeader();
document.getElementById("amountInput")?.addEventListener("input",e=>{APP.amount=e.target.value;renderSend()});
document.getElementById("destinationInput")?.addEventListener("change",e=>{APP.destination=e.target.value;saveLocal()});
document.querySelectorAll("[data-priority]").forEach(b=>b.addEventListener("click",()=>{APP.priority=b.dataset.priority;renderSend()}));
document.getElementById("continueSend")?.addEventListener("click",startComparison);
document.getElementById("backMoney")?.addEventListener("click",()=>{APP.screen="money";renderScreen()});
}

function renderWeek(){
const spent=APP.money.expenses.reduce((a,x)=>a+(Number(x.amount)||0),0);
const available=Math.max(0,Number(APP.money.available)-spent);
const daily=available/daysUntilPay();
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell">
<section class="results-head"><div class="hero-badge">📊 ${esc(t("week"))}</div><h1>${esc(t("summary"))}</h1><p>${esc(t("untilPay"))}: ${esc(payLabel())}</p></section>
<section class="dashboard-grid">
<div class="dashboard-card"><small>${esc(t("income"))}</small><strong>${money(APP.money.available)}</strong></div>
<div class="dashboard-card"><small>${esc(t("spentToday"))}</small><strong>${money(spent)}</strong></div>
<div class="dashboard-card main-money"><small>${esc(t("remaining"))}</small><strong>${money(available)}</strong><span>${money(daily)} ${esc(t("perDay"))}</span></div>
</section>
<section class="main-card"><h2>${esc(t("planned"))}</h2><div class="expense-list">${APP.money.expenses.length?APP.money.expenses.map(renderExpense).join(""):`<p class="empty-text">${esc(t("noExpenses"))}</p>`}</div><button class="primary-btn" id="addExpenseBtn">${esc(t("addExpense"))}</button></section>
</main>`;
bindHeader();
document.querySelectorAll("[data-delete-expense]").forEach(b=>b.addEventListener("click",()=>{APP.money.expenses.splice(Number(b.dataset.deleteExpense),1);saveLocal();renderWeek()}));
document.getElementById("addExpenseBtn")?.addEventListener("click",()=>{APP.screen="expenses";renderScreen()});
}

function renderExpense(x,i){
return`<div class="expense-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.category||"")}</small></div><b>${money(x.amount)}</b><button data-delete-expense="${i}" aria-label="${esc(t("delete"))}">×</button></div>`;
}

function renderExpenses(){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell">
<section class="results-head"><div class="hero-badge">🧾 ${esc(t("expenses"))}</div><h1>${esc(t("expenses"))}</h1><p>${esc(t("sendExplain"))}</p></section>
<section class="main-card">
<div class="field"><label>${esc(t("expenseName"))}</label><input class="text-input" id="expenseName" type="text" maxlength="80"></div>
<div class="field"><label>${esc(t("expenseAmount"))}</label><div class="amount-wrap"><span>$</span><input id="expenseAmount" type="number" min="0" step="0.01"></div></div>
<button class="primary-btn" id="saveExpense">${esc(t("add"))}</button>
</section>
<section class="main-card expense-section"><h2>${esc(t("spentToday"))}</h2><div class="expense-list">${APP.money.expenses.length?APP.money.expenses.map(renderExpense).join(""):`<p class="empty-text">${esc(t("noExpenses"))}</p>`}</div></section>
</main>`;
bindHeader();
document.getElementById("saveExpense")?.addEventListener("click",()=>{
const name=document.getElementById("expenseName")?.value.trim();
const amount=Number(document.getElementById("expenseAmount")?.value);
if(!name||!amount||amount<=0)return;
APP.money.expenses.push({name,amount,date:new Date().toISOString().slice(0,10)});
saveLocal();renderExpenses();
});
document.querySelectorAll("[data-delete-expense]").forEach(b=>b.addEventListener("click",()=>{APP.money.expenses.splice(Number(b.dataset.deleteExpense),1);saveLocal();renderExpenses()}));
}

function renderFamily(){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell">
<section class="results-head"><div class="hero-badge">👨‍👩‍👧 ${esc(t("family"))}</div><h1>${esc(t("familyTitle"))}</h1><p>${esc(t("familyText"))}</p></section>
<section class="main-card">
<div class="field"><label>${esc(t("familyName"))}</label><input class="text-input" id="familyName" type="text" maxlength="80" placeholder="Mamá"></div>
<div class="field"><label>${esc(t("familyCountry"))}</label><input class="text-input" id="familyCountry" type="text" maxlength="60" placeholder="Cuba"></div>
<button class="primary-btn" id="saveFamily">${esc(t("saveFamily"))}</button>
</section>
<section class="main-card"><div class="local-note">🔒 ${esc(t("localOnly"))}</div><div class="family-list">${APP.money.family.length?APP.money.family.map((x,i)=>`<div class="family-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.country)}</small></div><button data-delete-family="${i}">${esc(t("delete"))}</button></div>`).join(""):`<p class="empty-text">${esc(t("noFamily"))}</p>`}</div></section>
</main>`;
bindHeader();
document.getElementById("saveFamily")?.addEventListener("click",()=>{
const name=document.getElementById("familyName")?.value.trim();
const country=document.getElementById("familyCountry")?.value.trim();
if(!name)return;
APP.money.family.push({name,country:country||""});
saveLocal();renderFamily();
});
document.querySelectorAll("[data-delete-family]").forEach(b=>b.addEventListener("click",()=>{APP.money.family.splice(Number(b.dataset.deleteFamily),1);saveLocal();renderFamily()}));
}

function renderScreen(){
if(APP.screen==="money")renderMoney();
else if(APP.screen==="week")renderWeek();
else if(APP.screen==="expenses")renderExpenses();
else if(APP.screen==="family")renderFamily();
else if(APP.screen==="send")renderSend();
else renderHome();
}

function collectNeed(){
return{
session_id:APP.sessionId,language:APP.language,amount:Number(APP.amount),
send_currency:"USD",destination_country:APP.destination,
priority:APP.priority||"balanced",delivery_method:APP.delivery||null,
payment_method:APP.payment||null,special_need:APP.freeText||null
};
}

async function createSession(){
try{
const data=await api(`/api/session?language=${encodeURIComponent(APP.language)}`,{method:"POST",body:"{}"});
APP.sessionId=data?.session?.session_id||data?.session_id||null;
return APP.sessionId;
}catch(e){APP.sessionId=null;return null}
}

async function ensureSession(){if(!APP.sessionId)await createSession();return APP.sessionId}
async function loadConfig(){APP.config=await api(`/api/config?language=${encodeURIComponent(APP.language)}`)}

function renderLoading(){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="loading-card"><div class="loader large"></div><h2>${esc(t("options"))}</h2><p>${esc(t("loading"))}</p></section></main>`;
bindHeader();
}

async function startComparison(){
APP.amount=document.getElementById("amountInput")?.value||APP.amount;
APP.destination=document.getElementById("destinationInput")?.value||APP.destination;
const amount=Number(APP.amount);
if(!APP.destination){document.getElementById("destinationInput")?.focus();return}
if(!amount||amount<=0){document.getElementById("amountInput")?.focus();return}
if(!APP.priority)APP.priority="balanced";
saveLocal();renderLoading();
try{
await ensureSession();
const need=collectNeed();
await api("/api/need",{method:"POST",body:JSON.stringify(need)});
APP.comparison=await api("/api/compare",{method:"POST",body:JSON.stringify(need)});
APP.screen="results";renderResults();
}catch(e){renderError(e.message)}
}

function resultId(r){return r?.provider_id||r?.id||""}

function getResults(){
const data=APP.comparison||{};
const verified=Array.isArray(data.results)?data.results:[];
const available=Array.isArray(data.available_providers)?data.available_providers:[];
const merged=[],seen=new Set();
verified.forEach(r=>{const id=resultId(r);if(id&&!seen.has(id)){seen.add(id);merged.push({...r,commercial_verified:true,commercial_status:"verified"})}});
available.forEach(p=>{const id=resultId(p);if(id&&!seen.has(id)){seen.add(id);merged.push({...p,provider_id:id,provider_name:p.provider_name||p.name||id})}});
return merged;
}

function resultValue(r,key){
if(r?.[key]!==undefined)return r[key];
if(r?.commercial_data?.[key]!==undefined)return r.commercial_data[key];
return null;
}

function priorityMatch(results){
const verified=results.filter(r=>r.commercial_verified===true||r.commercial_status==="verified");
if(!verified.length)return null;
const valid=verified.filter(r=>resultValue(r,"recipient_amount")!==null);
if(!valid.length)return verified[0];
const p=APP.priority;
if(p==="recipient_gets_more")return [...valid].sort((a,b)=>Number(resultValue(b,"recipient_amount")||0)-Number(resultValue(a,"recipient_amount")||0))[0];
if(p==="save")return [...valid].sort((a,b)=>Number(resultValue(a,"fee")??999999)-Number(resultValue(b,"fee")??999999))[0];
if(p==="fastest"||p==="urgent")return [...valid].sort((a,b)=>String(resultValue(a,"estimated_delivery")||"").localeCompare(String(resultValue(b,"estimated_delivery")||"")))[0];
return valid[0];
}

function renderResults(){
const data=APP.comparison||{};
const results=getResults();
const recommendation=priorityMatch(results);
const verified=results.some(r=>r.commercial_verified===true||r.commercial_status==="verified");
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell">
<section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div class="hero-badge">● ${esc(verified?t("verified"):t("availableProviders"))}</div><h1>${esc(t("options"))}</h1><p>${esc(formatSummary())}</p></section>
${recommendation?renderRecommendation(recommendation):""}
<section class="results-list">${results.length?results.map(renderResultCard).join(""):`<div class="empty-card"><div class="empty-icon">—</div><h2>${esc(data.message||t("commercialUnavailable"))}</h2><p>${esc(t("tryAgain"))}</p></div>`}</section>
<footer class="footer"><span>© May Roga LLC</span><button id="clearBtn">${esc(t("clear"))}</button></footer>
</main>`;
bindHeader();
document.getElementById("backBtn")?.addEventListener("click",()=>{APP.screen="send";renderScreen()});
document.getElementById("clearBtn")?.addEventListener("click",restart);
document.querySelectorAll("[data-provider]").forEach(b=>b.addEventListener("click",()=>{const p=results.find(x=>resultId(x)===b.dataset.provider);if(p)renderFinalCheck(p)}));
}

function renderRecommendation(r){
return`<section class="recommend-card"><span>✓ ${esc(t("recommended"))}</span><h2>${esc(r.provider_name||resultId(r))}</h2><p>${r.recipient_amount!=null?`${esc(t("receive"))}: <strong>${money(r.recipient_amount,r.currency||r.recipient_currency||"USD")}</strong>`:esc(t("verified"))}</p></section>`;
}

function formatSummary(){return`${money(Number(APP.amount),"USD")} → ${esc(countryName(APP.destination))}`}

function countryName(code){
const list=APP.config?.countries||[];
const found=list.find(c=>(typeof c==="string"?c:(c.id||c.code))===code);
return found?(typeof found==="string"?found:(found.name||found.country||code)):code||"";
}

function renderResultCard(r,i){
const id=resultId(r),name=r.provider_name||id;
const verified=r.commercial_verified===true||r.commercial_status==="verified";
const fee=verified?resultValue(r,"fee"):null;
const rate=verified?resultValue(r,"exchange_rate"):null;
const recipient=verified?resultValue(r,"recipient_amount"):null;
const delivery=verified?(resultValue(r,"delivery_time")??resultValue(r,"estimated_delivery")):null;
const method=verified?resultValue(r,"delivery_method"):null;
const currency=resultValue(r,"currency")||resultValue(r,"recipient_currency")||"USD";
const url=r.continue_url||r.official_site||"";
return`<article class="provider-card ${priorityMatch([r])?"matched-provider":""}">
<div class="provider-top"><div><span class="provider-number">${i+1}</span><h2>${esc(name)}</h2></div><span class="verified-pill ${verified?"":"neutral"}">${verified?"✓ "+esc(t("verified")):esc(t("unverified"))}</span></div>
<div class="provider-main"><div class="receive-box"><span>${esc(t("receive"))}</span><strong>${recipient!==null?money(recipient,currency):esc(t("noQuote"))}</strong></div>
<div class="details-grid"><div><span>${esc(t("fee"))}</span><strong>${fee!==null?money(fee):esc(t("noQuote"))}</strong></div><div><span>${esc(t("rate"))}</span><strong>${rate!==null?esc(rate):esc(t("noQuote"))}</strong></div><div><span>${esc(t("delivery"))}</span><strong>${delivery!==null?esc(delivery):esc(t("noQuote"))}</strong></div><div><span>${esc(t("method"))}</span><strong>${method?esc(formatMethod(method)):esc(t("noQuote"))}</strong></div></div></div>
<div class="provider-foot"><small>${verified?esc(t("verified")):esc(t("commercialUnavailable"))}</small>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div>
<button class="primary-btn provider-btn" data-provider="${esc(id)}">${esc(verified?t("check"):t("official"))}</button></article>`;
}

function formatMethod(v){
const map={cash_pickup:APP.language==="es"?"Efectivo":"Cash pickup",bank_account:APP.language==="es"?"Cuenta bancaria":"Bank account",debit_card:APP.language==="es"?"Tarjeta de débito":"Debit card",mobile_wallet:APP.language==="es"?"Billetera móvil":"Mobile wallet",home_delivery:APP.language==="es"?"Entrega a domicilio":"Home delivery"};
return map[v]||v;
}

async function renderFinalCheck(provider){
const id=resultId(provider);
const verified=provider.commercial_verified===true||provider.commercial_status==="verified";
if(!verified){
const url=provider.continue_url||provider.official_site;
if(url)window.open(url,"_blank","noopener,noreferrer");
return;
}
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell"><section class="results-head"><button class="back-btn" id="backBtn">← ${esc(t("back"))}</button><div class="hero-badge">● ${esc(t("selected"))}</div><h1>${esc(provider.provider_name||id)}</h1><p>${esc(t("finalText"))}</p></section>
<section class="review-card"><h2>${esc(t("review"))}</h2><div class="review-row"><span>${esc(t("country"))}</span><strong>${esc(countryName(APP.destination))}</strong></div><div class="review-row"><span>${esc(t("send"))}</span><strong>${money(Number(APP.amount))}</strong></div><div class="review-row"><span>${esc(t("fee"))}</span><strong>${provider.fee!=null?money(provider.fee):"—"}</strong></div><div class="review-row"><span>${esc(t("rate"))}</span><strong>${provider.exchange_rate!=null?esc(provider.exchange_rate):"—"}</strong></div><div class="review-row highlight"><span>${esc(t("receiveAmount"))}</span><strong>${provider.recipient_amount!=null?money(provider.recipient_amount,provider.currency||provider.recipient_currency||"USD"):"—"}</strong></div><div class="review-row"><span>${esc(t("method"))}</span><strong>${provider.delivery_method?esc(formatMethod(provider.delivery_method)):"—"}</strong></div><div class="review-actions"><button class="secondary-btn" id="backResults">${esc(t("no"))}</button><button class="primary-btn" id="verifyBtn">${esc(t("yes"))}</button></div><div id="finalStatus"></div></section></main>`;
bindHeader();
document.getElementById("backBtn")?.addEventListener("click",renderResults);
document.getElementById("backResults")?.addEventListener("click",renderResults);
document.getElementById("verifyBtn")?.addEventListener("click",()=>performFinalCheck(provider,id));
}

async function performFinalCheck(provider,id){
const status=document.getElementById("finalStatus");
if(!status)return;
status.innerHTML=`<div class="checking"><div class="loader"></div>${esc(t("loading"))}</div>`;
try{
await ensureSession();
const result=await api("/api/final-check",{method:"POST",body:JSON.stringify({
language:APP.language,provider_id:id,amount:Number(APP.amount),send_currency:"USD",
destination_country:APP.destination,delivery_method:provider.delivery_method||null,
payment_method:provider.payment_method||null,recipient_amount:provider.recipient_amount??null,
fee:provider.fee??null,exchange_rate:provider.exchange_rate??null
})});
const ready=result?.ready_to_continue!==false;
const url=provider.continue_url||provider.official_site;
status.innerHTML=`<div class="${ready?"success-box":"error-box"}"><strong>${ready?"✓ ":""}${esc(ready?t("verified"):t("error"))}</strong><p>${esc(result?.message||t("finalText"))}</p>${ready&&url?`<a class="primary-btn link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("official"))}</a>`:""}</div>`;
}catch(e){status.innerHTML=`<div class="error-box">${esc(e.message||t("error"))}</div>`}
}

function showHelp(){
const modal=document.getElementById("modal")||document.body.appendChild(Object.assign(document.createElement("div"),{id:"modal"}));
modal.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card"><button class="modal-close" id="modalClose">×</button><div class="hero-badge">?</div><h2>${esc(t("helpTitle"))}</h2><p>${esc(t("helpText"))}</p><button class="primary-btn" id="modalStart">${esc(t("continue"))}</button></div></div>`;
document.getElementById("modalClose")?.addEventListener("click",()=>modal.innerHTML="");
document.getElementById("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")modal.innerHTML=""});
document.getElementById("modalStart")?.addEventListener("click",()=>{modal.innerHTML="";APP.screen="send";renderScreen()});
}

function renderError(message){
document.getElementById("app").innerHTML=`${renderHeader()}<main class="shell centered"><section class="error-card"><div class="error-icon">!</div><h2>${esc(t("error"))}</h2><p>${esc(message||"")}</p><button class="primary-btn" id="retryBtn">${esc(t("back"))}</button></section></main>`;
bindHeader();
document.getElementById("retryBtn")?.addEventListener("click",renderHome);
}

function restart(){
APP.sessionId=null;APP.amount="";APP.destination="";APP.priority="";APP.delivery="";APP.payment="";APP.freeText="";APP.comparison=null;APP.selectedProvider=null;APP.screen="home";
APP.money={available:0,payWhen:"week",needs:[],expenses:[],family:[]};
["remesas_destination","remesas_money_available","remesas_money_pay_when","remesas_money_needs","remesas_money_expenses","remesas_money_family"].forEach(k=>localStorage.removeItem(k));
createSession().finally(renderHome);
}

async function boot(){
try{await loadConfig();await createSession();renderHome()}
catch(e){renderError(e.message)}
}

document.addEventListener("DOMContentLoaded",boot);
