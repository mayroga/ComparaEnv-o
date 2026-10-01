"use strict";

const APP={name:"REMESAS",version:"4.3.2",lang:localStorage.getItem("remesas_lang_v4")||"es",session:null,config:null,access:localStorage.getItem("remesas_access_v4")||"",moneyKey:"remesas_money_v4",expensesKey:"remesas_expenses_v4",familyKey:"remesas_family_v4",prefsKey:"remesas_prefs_v4",savingsKey:"remesas_savings_v4",plansKey:"remesas_plans_v4"};

const app=document.getElementById("app");

const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const t=(es,en)=>APP.lang==="en"?en:es;
const money=v=>new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v)||0);
const num=v=>Number(v)||0;

const getJSON=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||"")??f}catch{return f}};
const setJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};

const token=()=>APP.access||localStorage.getItem("remesas_access_v4")||"";

function headers(x={}){
 const h={"Content-Type":"application/json",...x},z=token();
 if(z)h["X-Remesas-Access-Token"]=z;
 h["X-Remesas-Language"]=APP.lang;
 return h
}

async function api(u,o={}){
 const c=new AbortController(),tm=setTimeout(()=>c.abort(),15000);
 try{
  const r=await fetch(u,{...o,headers:headers(o.headers||{}),signal:c.signal});
  let d={};
  try{d=await r.json()}catch{}
  if(!r.ok)throw Error(d.detail||d.error||d.message||t("No se pudo completar esta acción.","This action could not be completed."));
  return d
 }catch(e){
  if(e.name==="AbortError")throw Error(t("La operación tardó demasiado. Inténtalo de nuevo.","The operation took too long. Please try again."));
  throw e
 }finally{
  clearTimeout(tm)
 }
}

async function loadConfig(){
 try{
  APP.config=await api("/api/config?language="+encodeURIComponent(APP.lang))
 }catch{
  APP.config=APP.config||{app:{brand:"May Roga LLC"},countries:[],help_topics:[]}
 }
 return APP.config
}

async function serviceStatus(){
 try{return await api("/api/access/status")}
 catch{return{active:false}}
}

async function verifyAccess(){
 const s=await serviceStatus();
 if(s.active&&s.access_token){
  APP.access=s.access_token;
  localStorage.setItem("remesas_access_v4",APP.access)
 }
 return!!s.active
}

async function startService(){
 try{
  const d=await api("/api/service/start",{method:"POST",body:"{}"});
  APP.session=d.session||d;
  return true
 }catch(e){
  showError(e.message);
  return false
 }
}

function topbar(title="REMESAS"){
 return`<header class="topbar"><button class="btn secondary small" onclick="renderHome()">⌂</button><strong class="brand">${esc(title)}</strong><div class="top-actions"><button class="btn lang-btn small" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div></header>`
}

function shell(c,title="REMESAS"){
 app.innerHTML=`<div class="app-shell">${topbar(title)}<main>${c}</main></div>`;
 window.scrollTo(0,0)
}

function card(a,b,c,d=""){
 return`<button class="action-card" onclick="${c}"><span class="action-icon">${d}</span><strong>${esc(a)}</strong><small>${esc(b)}</small></button>`
}

function expenses(){
 return getJSON(APP.expensesKey,[]).filter(x=>x&&typeof x==="object")
}

function savings(){
 return getJSON(APP.savingsKey,[]).filter(x=>x&&typeof x==="object")
}

function family(){
 return getJSON(APP.familyKey,[]).filter(x=>x&&typeof x==="object")
}

function plans(){
 return getJSON(APP.plansKey,[]).filter(x=>x&&typeof x==="object")
}

function moneyState(){
 const m=getJSON(APP.moneyKey,{});
 m.have=num(m.have);
 m.incomeTotal=num(m.incomeTotal);
 m.monthlyIncome=num(m.monthlyIncome);
 m.expenseTotal=expenses().reduce((a,x)=>a+num(x.amount),0);
 m.savingsTotal=savings().reduce((a,x)=>a+num(x.amount),0);
 m.remittance=num(m.remittance);
 m.available=m.have+m.incomeTotal-m.expenseTotal-m.savingsTotal-m.remittance;
 return m
}

function saveMoney(){
 setJSON(APP.moneyKey,moneyState())
}

function homeStats(){
 const m=moneyState(),e=expenses(),s=savings(),f=family(),p=plans();
 return`<div class="balance-grid">
 <div class="balance"><small>${esc(t("Disponible","Available"))}</small><b>${money(m.available)}</b><span>${esc(t("Lo que queda según tus registros.","What remains in your records."))}</span></div>
 <div class="balance"><small>GASTOS</small><b>${e.length}</b><span>${esc(t("Pagos anotados.","Recorded payments."))}</span></div>
 <div class="balance"><small>FAMILIA</small><b>${f.length}</b><span>${esc(t("Personas anotadas.","People recorded."))}</span></div>
 <div class="balance"><small>AHORRO</small><b>${s.length}</b><span>${esc(t("Dinero apartado.","Money set aside."))}</span></div>
 <div class="balance"><small>PLANES</small><b>${p.length}</b><span>${esc(t("Metas anotadas.","Goals recorded."))}</span></div>
 </div>`
}

function renderHome(){
 const brand=APP.config?.app?.brand||"May Roga LLC";
 app.innerHTML=`<div class="app-shell">
 <header class="hero">
 <div class="topbar">
 <strong class="brand">REMESAS<br><small>${esc(brand)}</small></strong>
 <div class="top-actions"><button class="btn lang-btn small" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button></div>
 </div>
 <h1>${esc(t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1>
 <p>${esc(t("Entiende tu dinero con palabras sencillas. Mira qué tienes, qué entra, qué sale y qué puedes hacer.","Understand your money in simple words. See what you have, what comes in, what goes out, and what you can do."))}</p>
 <div class="hero-actions">
 <button class="btn" onclick="renderRemittance()">💸 ${esc(t("QUIERO ENVIAR DINERO","I WANT TO SEND MONEY"))}</button>
 <button class="btn secondary" onclick="renderHelp()">❓ ${esc(t("NO SÉ QUÉ HACER","I DON'T KNOW WHAT TO DO"))}</button>
 </div>
 </header>
 <main>
 <section class="section">
 <div class="section-title"><div><h2>${esc(t("Tu dinero, paso a paso","Your money, step by step"))}</h2><p>${esc(t("Cada número tiene una explicación y una acción.","Every number has an explanation and an action."))}</p></div></div>
 <div class="grid three">
 ${card("TENGO","Lo que tienes ahora.","renderTengo()","💵")}
 ${card("GANO","Lo que entra.","renderGano()","➕")}
 ${card("GASTO","Lo que sale.","renderExpenses()","➖")}
 ${card("AHORRO","Lo que decides guardar.","renderSavings()","🏦")}
 ${card("QUIERO","Lo que quieres lograr.","renderGoals()","🛒")}
 ${card("PUEDO","Lo que queda.","renderPuedo()","📅")}
 ${card("HAGO","El siguiente paso.","renderHago()","✅")}
 </div>
 ${homeStats()}
 </section>
 <section class="section">
 <div class="grid two">
 ${card("GUÍA RÁPIDA","Prepara una remesa paso a paso.","renderQuickGuide()","🧭")}
 ${card("APRENDER","Aprende cómo funciona.","renderLearn()","📖")}
 ${card("COMPARAR","Mira las remesadoras disponibles.","renderRemittance()","🔎")}
 ${card("PDF DE MI DINERO","Guarda tus datos.","exportMoneyPDF()","📄")}
 ${card("ENTRAR PDF","Recupera tus datos.","pickPDF()","📥")}
 ${card("AYUDA","Busca una respuesta.","renderHelp()","❓")}
 </div>
 </section>
 <section class="section">
 <div class="card">
 <h2>${esc(t("¿Qué quieres resolver hoy?","What do you want to solve today?"))}</h2>
 <p>${esc(t("Escríbelo como se lo dirías a una persona.","Write it like you would tell a person."))}</p>
 <textarea id="freeNeed" maxlength="2000" placeholder="${esc(t("Ejemplo: quiero mandar $200 a México y saber si me alcanza.","Example: I want to send $200 to Mexico and know if I can afford it."))}"></textarea>
 <button class="btn" onclick="understandNeed()">${esc(t("AYÚDAME CON ESTO","HELP ME WITH THIS"))}</button>
 </div>
 </section>
 <section class="section">
 <div class="legal">
 <b>${esc(t("Para tu tranquilidad","For your peace of mind"))}</b>
 <p>${esc(t("REMESAS te ayuda a entender y organizar tus propios datos. No recibe ni envía tu dinero. Antes de enviar, revisa la cantidad, el destinatario y las condiciones que muestre la remesadora oficial.","REMESAS helps you understand and organize your own information. It does not receive or send your money. Before sending, review the amount, recipient, and conditions shown by the official provider."))}</p>
 </div>
 <button class="btn danger" onclick="deleteLocalData()">${esc(t("BORRAR MIS DATOS","DELETE MY DATA"))}</button>
 </section>
 <footer class="footer">${esc(brand)} · REMESAS ${APP.version}<div class="footer-links"><button onclick="renderHelp()">${esc(t("Ayuda","Help"))}</button><button onclick="renderAbout()">${esc(t("Privacidad","Privacy"))}</button></div></footer>
 </main>
 </div>`
}

function renderTengo(){
 const m=moneyState();
 shell(`<section class="section"><div class="card">
 <h1>💵 TENGO</h1>
 <p>${esc(t("Primero sabemos con cuánto cuentas.","First we find out what you have."))}</p>
 <label>${esc(t("¿Cuánto tienes disponible ahora?","How much do you have available now?"))}</label>
 <input id="haveAmount" type="number" min="0" step=".01" value="${m.have||""}">
 <button class="btn" onclick="saveTengo()">${esc(t("GUARDAR Y EXPLICAR","SAVE AND EXPLAIN"))}</button>
 <div id="tengoResult"></div>
 </div></section>`,"TENGO");
 showTengo(m.have)
}

function saveTengo(){
 const v=num(document.getElementById("haveAmount")?.value);
 if(v<0)return showError(t("Escribe una cantidad válida.","Enter a valid amount."));
 const m=moneyState();
 m.have=v;
 setJSON(APP.moneyKey,m);
 showTengo(v)
}

function showTengo(v){
 const b=document.getElementById("tengoResult");
 if(!b)return;
 b.innerHTML=`<div class="notice"><h3>${money(v)}</h3><p>${esc(t(`Son ${money(v)} que registraste como dinero disponible ahora. Lo usamos como punto de partida.`,`This is ${money(v)} that you recorded as available now. We use it as the starting point.`))}</p></div><button class="btn secondary" onclick="renderPuedo()">${esc(t("VER QUÉ PUEDO HACER","SEE WHAT I CAN DO"))}</button>`
}

function renderGano(){
 shell(`<section class="section"><div class="card">
 <h1>➕ GANO</h1>
 <p>${esc(t("Aquí anotamos el dinero que entra.","Here we record money coming in."))}</p>
 <label>${esc(t("¿Cuánto recibes?","How much do you receive?"))}</label>
 <input id="gainAmount" type="number" min="0" step=".01">
 <label>${esc(t("¿Cada cuánto?","How often?"))}</label>
 <select id="gainFreq">
 <option value="weekly">${esc(t("Cada semana","Every week"))}</option>
 <option value="biweekly">${esc(t("Cada quincena","Every two weeks"))}</option>
 <option value="monthly">${esc(t("Cada mes","Every month"))}</option>
 </select>
 <label>${esc(t("¿De dónde viene?","Where does it come from?"))}</label>
 <input id="gainSource" maxlength="100" placeholder="${esc(t("Trabajo, negocio, ayuda...","Work, business, help..."))}">
 <button class="btn" onclick="saveGano()">${esc(t("GUARDAR","SAVE"))}</button>
 <div id="ganoResult"></div>
 </div></section>`,"GANO")
}

function saveGano(){
 const v=num(document.getElementById("gainAmount")?.value);
 const f=document.getElementById("gainFreq")?.value||"monthly";
 const src=(document.getElementById("gainSource")?.value||"").trim();
 if(v<=0)return showError(t("Escribe cuánto recibes.","Enter how much you receive."));
 const m=moneyState();
 m.income=v;
 m.incomeFrequency=f;
 m.incomeSource=src;
 m.incomeTotal=f==="weekly"?v*4.333333:f==="biweekly"?v*2.166667:v;
 m.monthlyIncome=m.incomeTotal;
 setJSON(APP.moneyKey,m);
 const freq=APP.lang==="en"?(f==="weekly"?"each week":f==="biweekly"?"every two weeks":"each month"):(f==="weekly"?"cada semana":f==="biweekly"?"cada quincena":"cada mes");
 const msg=APP.lang==="en"?`You recorded ${money(v)} as money coming in ${freq}. We convert it to a monthly reference to help explain the rest.`:`Registraste ${money(v)} como dinero que entra ${freq}. Lo convertimos a una referencia mensual para ayudarte a entender el resto.`;
 document.getElementById("ganoResult").innerHTML=`<div class="notice"><h3>${money(v)}</h3><p>${esc(msg)}</p></div><button class="btn" onclick="renderPuedo()">${esc(t("VER QUÉ PUEDO HACER","SEE WHAT I CAN DO"))}</button>`
}

function renderExpenses(){
 const a=expenses();
 shell(`<section class="section">
 <div class="card">
 <h1>➖ GASTO</h1>
 <p>${esc(t("Aquí anotamos lo que sale. La app lo suma para mostrarte qué queda.","Here we record what goes out. The app adds it to show what remains."))}</p>
 <label>${esc(t("¿En qué gastaste?","What did you spend on?"))}</label>
 <input id="expenseName" maxlength="100">
 <label>${esc(t("¿Cuánto?","How much?"))}</label>
 <input id="expenseAmount" type="number" min="0" step=".01">
 <label>${esc(t("¿Cada cuánto?","How often?"))}</label>
 <select id="expenseFreq">
 <option value="monthly">${esc(t("Cada mes","Every month"))}</option>
 <option value="weekly">${esc(t("Cada semana","Every week"))}</option>
 <option value="biweekly">${esc(t("Cada quincena","Every two weeks"))}</option>
 <option value="once">${esc(t("Una vez","Once"))}</option>
 </select>
 <button class="btn" onclick="addExpense()">${esc(t("AGREGAR GASTO","ADD EXPENSE"))}</button>
 </div>
 <div class="card"><h2>${esc(t("Mis gastos","My expenses"))}</h2>
 ${a.length?a.map((x,i)=>`<div class="list-row"><div><b>${esc(x.name)}</b><small>${money(x.amount)} · ${esc(x.frequency||"monthly")}</small></div><button class="btn danger small" onclick="removeExpense(${i})">×</button></div>`).join(""):esc(t("Todavía no hay gastos registrados.","No expenses recorded yet."))}
 </div>
 </section>`,"GASTO")
}

function addExpense(){
 const n=(document.getElementById("expenseName")?.value||"").trim();
 const a=num(document.getElementById("expenseAmount")?.value);
 const f=document.getElementById("expenseFreq")?.value||"monthly";
 if(!n||a<=0)return showError(t("Escribe el gasto y su cantidad.","Enter the expense and amount."));
 const x=expenses();
 x.push({name:n,amount:a,frequency:f,date:new Date().toISOString()});
 setJSON(APP.expensesKey,x);
 renderExpenses()
}

function removeExpense(i){
 const x=expenses();
 x.splice(i,1);
 setJSON(APP.expensesKey,x);
 renderExpenses()
}

function renderSavings(){
 const a=savings();
 shell(`<section class="section">
 <div class="card">
 <h1>🏦 AHORRO</h1>
 <p>${esc(t("El ahorro es dinero que decides apartar para una meta o una necesidad futura.","Savings is money you choose to set aside for a goal or future need."))}</p>
 <label>${esc(t("¿Cuánto quieres apartar?","How much do you want to set aside?"))}</label>
 <input id="savingAmount" type="number" min="0" step=".01">
 <label>${esc(t("¿Para qué?","For what?"))}</label>
 <input id="savingName" maxlength="100">
 <button class="btn" onclick="saveSavings()">${esc(t("GUARDAR AHORRO","SAVE SAVINGS"))}</button>
 </div>
 <div class="card"><h2>${esc(t("Mis ahorros","My savings"))}</h2>
 ${a.length?a.map((x,i)=>`<div class="list-row"><div><b>${esc(x.name)}</b><small>${money(x.amount)}</small></div><button class="btn danger small" onclick="removeSavings(${i})">×</button></div>`).join(""):esc(t("Todavía no hay ahorro registrado.","No savings recorded yet."))}
 </div>
 </section>`,"AHORRO")
}

function saveSavings(){
 const a=num(document.getElementById("savingAmount")?.value);
 const n=(document.getElementById("savingName")?.value||"").trim();
 if(a<=0||!n)return showError(t("Escribe una cantidad y para qué es.","Enter an amount and what it is for."));
 const x=savings();
 x.push({amount:a,name:n,date:new Date().toISOString()});
 setJSON(APP.savingsKey,x);
 renderSavings()
}

function removeSavings(i){
 const x=savings();
 x.splice(i,1);
 setJSON(APP.savingsKey,x);
 renderSavings()
}

function renderGoals(){
 const a=plans();
 shell(`<section class="section">
 <div class="card">
 <h1>🛒 QUIERO</h1>
 <p>${esc(t("Aquí ponemos lo que quieres lograr. Así la app puede compararlo con lo que tienes disponible.","Here we record what you want to achieve so the app can compare it with what you have available."))}</p>
 <label>${esc(t("¿Qué quieres lograr o comprar?","What do you want to achieve or buy?"))}</label>
 <input id="planName" maxlength="100">
 <label>${esc(t("¿Cuánto necesitas?","How much do you need?"))}</label>
 <input id="planAmount" type="number" min="0" step=".01">
 <button class="btn" onclick="savePlan()">${esc(t("GUARDAR META","SAVE GOAL"))}</button>
 </div>
 <div class="card"><h2>${esc(t("Mis metas","My goals"))}</h2>
 ${a.length?a.map((x,i)=>`<div class="list-row"><div><b>${esc(x.name)}</b><small>${money(x.amount)}</small></div><button class="btn danger small" onclick="removePlan(${i})">×</button></div>`).join(""):esc(t("Todavía no hay metas registradas.","No goals recorded yet."))}
 </div>
 </section>`,"QUIERO")
}

function savePlan(){
 const n=(document.getElementById("planName")?.value||"").trim();
 const a=num(document.getElementById("planAmount")?.value);
 if(!n||a<=0)return showError(t("Escribe la meta y cuánto cuesta.","Enter the goal and its amount."));
 const x=plans();
 x.push({name:n,amount:a,date:new Date().toISOString()});
 setJSON(APP.plansKey,x);
 renderGoals()
}

function removePlan(i){
 const x=plans();
 x.splice(i,1);
 setJSON(APP.plansKey,x);
 renderGoals()
}

function renderFamily(){
 const a=family();
 shell(`<section class="section">
 <div class="card">
 <h1>👨‍👩‍👧‍👦 FAMILIA</h1>
 <p>${esc(t("Personas para las que quieres recordar apoyo o remesas. Estos datos se quedan en este dispositivo.","People for whom you want to remember support or remittances. This data stays on this device."))}</p>
 <label>${esc(t("Nombre o apodo","Name or nickname"))}</label>
 <input id="familyName" maxlength="80">
 <label>${esc(t("Cantidad habitual","Usual amount"))}</label>
 <input id="familyAmount" type="number" min="0" step=".01">
 <button class="btn" onclick="saveFamily()">${esc(t("GUARDAR PERSONA","SAVE PERSON"))}</button>
 </div>
 <div class="card"><h2>${esc(t("Mi familia","My family"))}</h2>
 ${a.length?a.map((x,i)=>`<div class="list-row"><div><b>${esc(x.name)}</b><small>${money(x.amount)}</small></div><button class="btn danger small" onclick="removeFamily(${i})">×</button></div>`).join(""):esc(t("Todavía no hay personas registradas.","No people recorded yet."))}
 </div>
 </section>`,"FAMILIA")
}

function saveFamily(){
 const n=(document.getElementById("familyName")?.value||"").trim();
 const a=num(document.getElementById("familyAmount")?.value);
 if(!n)return showError(t("Escribe un nombre o apodo.","Enter a name or nickname."));
 const x=family();
 x.push({name:n,amount:a,date:new Date().toISOString()});
 setJSON(APP.familyKey,x);
 renderFamily()
}

function removeFamily(i){
 const x=family();
 x.splice(i,1);
 setJSON(APP.familyKey,x);
 renderFamily()
}

function renderMoney(){
 const m=moneyState();
 shell(`<section class="section"><div class="card">
 <h1>💰 ${esc(t("MI DINERO","MY MONEY"))}</h1>
 <p>${esc(t("Aquí juntamos TENGO, GANO, GASTO y AHORRO para explicar PUEDO.","Here we combine HAVE, EARN, SPEND, and SAVE to explain CAN."))}</p>
 <div class="result-list">
 <div><b>TENGO: ${money(m.have)}</b></div>
 <div><b>GANO: ${money(m.monthlyIncome)}</b></div>
 <div><b>GASTO: ${money(m.expenseTotal)}</b></div>
 <div><b>AHORRO: ${money(m.savingsTotal)}</b></div>
 <div><b>PUEDO: ${money(m.available)}</b></div>
 </div>
 <button class="btn" onclick="renderPeriod('weekly')">${esc(t("VER MI SEMANA","SEE MY WEEK"))}</button>
 <button class="btn secondary" onclick="renderPeriod('biweekly')">${esc(t("VER MI QUINCENA","SEE MY TWO WEEKS"))}</button>
 <button class="btn secondary" onclick="renderPeriod('monthly')">${esc(t("VER MI MES","SEE MY MONTH"))}</button>
 </div></section>`,"MI DINERO")
}

function renderWeek(){
 renderPeriod("weekly")
}

function renderPuedo(){
 const m=moneyState();
 const ok=m.available>=0;
 const msg=ok
 ?(APP.lang==="en"?`According to what you recorded, ${money(m.available)} has no other recorded destination.`:`Según lo que registraste, ${money(m.available)} no tiene otro destino registrado.`)
 :(APP.lang==="en"?`Your records show ${money(Math.abs(m.available))} more committed than available. Review your expenses, savings, and goals.`:`Tus registros muestran ${money(Math.abs(m.available))} más comprometidos que disponibles. Revisa gastos, ahorro y metas.`);

 shell(`<section class="section"><div class="card">
 <h1>📅 PUEDO</h1>
 <p>${esc(t("Aquí la app junta tus números para explicarte qué aparece disponible.","Here the app combines your numbers to explain what appears available."))}</p>
 <div class="notice"><h2>${money(m.available)}</h2><p>${esc(msg)}</p></div>
 <div class="result-list">
 <div><b>TENGO: ${money(m.have)}</b></div>
 <div><b>GANO: ${money(m.monthlyIncome)}</b></div>
 <div><b>GASTO: ${money(m.expenseTotal)}</b></div>
 <div><b>AHORRO: ${money(m.savingsTotal)}</b></div>
 </div>
 <button class="btn" onclick="renderHago()">${esc(t("¿QUÉ HAGO AHORA?","WHAT DO I DO NOW?"))}</button>
 </div></section>`,"PUEDO")
}

function renderHago(){
 const m=moneyState();
 const msg=m.available<0
 ?t("Primero revisa gastos, ahorro y metas. La app muestra más dinero comprometido que disponible.","First review expenses, savings, and goals. The app shows more committed than available money.")
 :t("Puedes revisar una remesa, una compra, un ahorro o tus números. El siguiente paso depende de lo que necesitas.","You can review a remittance, a purchase, savings, or your numbers. The next step depends on what you need.");

 shell(`<section class="section"><div class="card">
 <h1>✅ HAGO</h1>
 <div class="notice"><h2>${money(m.available)}</h2><p>${esc(msg)}</p></div>
 <div class="grid two">
 ${card("ENVIAR","Preparar una remesa.","renderRemittance()","💸")}
 ${card("AHORRAR","Apartar dinero.","renderSavings()","🏦")}
 ${card("COMPRAR","Revisar una compra.","renderPurchase()","🛒")}
 ${card("REVISAR","Volver a mis números.","renderMoney()","💰")}
 </div>
 </div></section>`,"HAGO")
}

function renderPeriod(p){
 const m=moneyState();
 const factor=p==="weekly"?4.333333:p==="biweekly"?2.166667:1;
 const inc=m.monthlyIncome/factor;
 const exp=m.expenseTotal/factor;
 const sav=m.savingsTotal/factor;
 const a=inc-exp-sav;
 const title=p==="weekly"?t("MI SEMANA","MY WEEK"):p==="biweekly"?t("MI QUINCENA","MY TWO WEEKS"):t("MI MES","MY MONTH");
 const ex=APP.lang==="en"?`Based on your own data, approximately ${money(a)} remains after income, expenses, and savings for this period.`:`Según tus propios datos, quedan aproximadamente ${money(a)} después de entradas, gastos y ahorro para este periodo.`;

 shell(`<section class="section"><div class="card">
 <h1>📆 ${esc(title)}</h1>
 <div class="notice"><h2>${money(a)}</h2><p>${esc(ex)}</p></div>
 <div class="result-list">
 <div><b>${esc(t("Entra","Comes in"))}: ${money(inc)}</b></div>
 <div><b>${esc(t("Sale","Goes out"))}: ${money(exp)}</b></div>
 <div><b>${esc(t("Guardas","Save"))}: ${money(sav)}</b></div>
 </div>
 <button class="btn" onclick="renderHago()">${esc(t("¿QUÉ HAGO CON ESTO?","WHAT DO I DO WITH THIS?"))}</button>
 </div></section>`,"PERIODO")
}

function renderPurchase(){
 shell(`<section class="section"><div class="card">
 <h1>🛒 ${esc(t("QUIERO COMPRAR","I WANT TO BUY"))}</h1>
 <p>${esc(t("La app compara la compra con lo que aparece disponible según tus registros.","The app compares the purchase with what appears available from your records."))}</p>
 <label>${esc(t("¿Qué quieres comprar?","What do you want to buy?"))}</label>
 <input id="purchaseName" maxlength="100">
 <label>${esc(t("¿Cuánto cuesta?","How much does it cost?"))}</label>
 <input id="purchaseAmount" type="number" min="0" step=".01">
 <button class="btn" onclick="checkPurchase()">${esc(t("REVISAR COMPRA","REVIEW PURCHASE"))}</button>
 </div></section>`,"COMPRA")
}

function checkPurchase(){
 const n=(document.getElementById("purchaseName")?.value||"").trim();
 const a=num(document.getElementById("purchaseAmount")?.value);
 const m=moneyState();
 if(!n||a<=0)return showError(t("Dime qué quieres comprar y cuánto cuesta.","Tell me what you want to buy and how much it costs."));
 const x=m.available-a;
 const msg=x>=0
 ?(APP.lang==="en"?`After that purchase, ${money(x)} would remain according to your records.`:`Después de esa compra quedarían ${money(x)} según tus registros.`)
 :(APP.lang==="en"?`The purchase exceeds the amount shown as free by ${money(Math.abs(x))}.`:`La compra supera en ${money(Math.abs(x))} lo que aparece libre.`);

 shell(`<section class="section"><div class="card">
 <h1>${esc(n)}</h1>
 <div class="notice"><h2>${money(x)}</h2><p>${esc(msg)}</p></div>
 <button class="btn" onclick="renderPuedo()">${esc(t("REVISAR MIS NÚMEROS","REVIEW MY NUMBERS"))}</button>
 </div></section>`,"RESULTADO")
}

async function renderRemittance(){
 if(!await ensureService())return;

 shell(`<section class="section"><div class="card">
 <h1>💸 QUIERO ENVIAR DINERO</h1>
 <p>${esc(t("Dime solo lo necesario para preparar tu remesa.","Tell me only what is needed to prepare your remittance."))}</p>
 <label>${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label>
 <input id="remAmount" type="number" min=".01" step=".01">
 <label>${esc(t("¿A qué país?","To which country?"))}</label>
 <select id="remCountry">
 <option value="">${esc(t("Selecciona","Select"))}</option>
 ${(APP.config?.countries||[]).map(c=>`<option value="${esc(c.id||c.code)}">${esc(c.name?.es||c.name?.en||c.name||c.id)}</option>`).join("")}
 </select>
 <label>${esc(t("¿Qué te importa más?","What matters most?"))}</label>
 <select id="remPriority">
 <option value="">${esc(t("Todavía no lo sé","I don't know yet"))}</option>
 <option value="fastest">${esc(t("Que llegue rápido","Arrive quickly"))}</option>
 <option value="save">${esc(t("Ahorrar","Save"))}</option>
 <option value="recipient_gets_more">${esc(t("Que reciba más","Recipient gets more"))}</option>
 <option value="urgent">${esc(t("Es urgente","It's urgent"))}</option>
 <option value="balanced">${esc(t("Un poco de todo","A bit of everything"))}</option>
 </select>
 <button class="btn" onclick="compare()">${esc(t("VER MIS OPCIONES","SEE MY OPTIONS"))}</button>
 </div></section>`,"REMESAS")
}

async function compare(){
 const a=num(document.getElementById("remAmount")?.value);
 const d=document.getElementById("remCountry")?.value;
 const p=document.getElementById("remPriority")?.value||null;

 if(a<=0||!d)return showError(t("Dime cuánto quieres enviar y a qué país.","Tell me how much you want to send and to which country."));

 try{
  if(!APP.session&&!await startService())return;
  const r=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/compare`,{method:"POST",body:JSON.stringify({language:APP.lang,amount:a,currency:"USD",destination:d,priority:p})});
  showComparison(r)
 }catch(e){
  showError(e.message)
 }
}

function providerCard(p){
 const id=p.provider_id||p.id||"";
 const name=(p.name||id).toUpperCase();
 const url=p.official_url||p.url||"#";
 const ok=(p.commercial_status||p.commercial_data_status)==="verified";

 return`<div class="provider-card">
 <div class="provider-head"><h2>${esc(name)}</h2><span class="provider-status">${esc(ok?t("VERIFICADO","VERIFIED"):t("CONFIRMA CON LA REMESADORA","CONFIRM WITH PROVIDER"))}</span></div>
 <p>${esc(ok?t("Hay información comercial verificada disponible.","Verified commercial information is available."):t("No mostramos tarifa, tasa o tiempo actual sin verificación. Confirma las condiciones directamente con la remesadora.","We do not show a current fee, rate, or delivery time without verification."))}</p>
 <button class="btn" onclick="openOfficial('${esc(url)}')">${esc(t("ABRIR SITIO OFICIAL","OPEN OFFICIAL SITE"))}</button>
 <button class="btn secondary" onclick="selectProvider('${esc(id)}')">${esc(t("ELEGIR PARA REVISAR","CHOOSE TO REVIEW"))}</button>
 </div>`
}

function showComparison(d){
 const a=[...(Array.isArray(d.results)?d.results:[]),...(Array.isArray(d.available_providers)?d.available_providers:[])]
 .filter((x,i,A)=>(x.provider_id||x.id)&&A.findIndex(y=>(y.provider_id||y.id)===(x.provider_id||x.id))===i);

 shell(`<section class="section"><div class="card">
 <h1>🔎 COMPARAR</h1>
 <p>${esc(d.explanation||t("Estas son las remesadoras que puedes revisar. Las condiciones finales deben confirmarse con la fuente oficial.","These are the providers you can review. Final terms must be confirmed with the official source."))}</p>
 ${a.map(providerCard).join("")||`<div class="empty">${esc(t("No hay opciones para mostrar.","There are no options to show."))}</div>`}
 <button class="btn secondary" onclick="renderLearn()">${esc(t("APRENDER ANTES DE ENVIAR","LEARN BEFORE SENDING"))}</button>
 </div></section>`,"COMPARAR")
}

async function selectProvider(id){
 if(!APP.session)return showError(t("La sesión de remesa no está disponible.","The remittance session is not available."));
 try{
  await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(id)}`,{method:"POST",body:"{}"});
  renderFinalCheck(id)
 }catch(e){
  showError(e.message)
 }
}

function renderFinalCheck(id){
 shell(`<section class="section"><div class="card">
 <h1>✅ REVISIÓN FINAL</h1>
 <p>${esc(t("Antes de continuar revisa cantidad, destinatario y forma de entrega.","Before continuing, review amount, recipient, and delivery."))}</p>
 <label class="check-row"><input id="ck1" type="checkbox"> ${esc(t("Revisé la cantidad.","I reviewed the amount."))}</label>
 <label class="check-row"><input id="ck2" type="checkbox"> ${esc(t("Revisé al destinatario.","I reviewed the recipient."))}</label>
 <label class="check-row"><input id="ck3" type="checkbox"> ${esc(t("Revisé cómo recibirá el dinero.","I reviewed how the money will be received."))}</label>
 <button class="btn" onclick="finishCheck('${esc(id||"")}')">${esc(t("CONFIRMAR REVISIÓN","CONFIRM REVIEW"))}</button>
 </div></section>`,"REVISIÓN")
}

async function finishCheck(id){
 if(!["ck1","ck2","ck3"].every(x=>document.getElementById(x)?.checked))return showError(t("Revisa las tres casillas.","Review all three boxes."));

 try{
  const d=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,{method:"POST",body:JSON.stringify({
   language:APP.lang,
   provider_id:id,
   amount:APP.session.amount,
   currency:"USD",
   destination:APP.session.destination_country,
   recipient_information_entered:true,
   checks:{amount:true,recipient:true,delivery:true}
  })});

  shell(`<section class="section"><div class="card">
  <h1>✅ ${esc(t("YA PUEDES CONTINUAR","YOU CAN CONTINUE"))}</h1>
  <p>${esc(d.message||t("Revisa las condiciones finales en el sitio oficial antes de confirmar.","Review final terms on the official site before confirming."))}</p>
  <button class="btn" onclick="openOfficial('${esc(APP.session?.selected_option?.official_url||"#")}')">${esc(t("IR AL SITIO OFICIAL","GO TO OFFICIAL SITE"))}</button>
  </div></section>`,"LISTO")
 }catch(e){
  showError(e.message)
 }
}

function openOfficial(u){
 if(!u||u==="#")return showError(t("No hay un sitio oficial disponible.","No official site is available."));
 window.open(u,"_blank","noopener,noreferrer")
}

async function renderQuickGuide(){
 let d={};
 try{d=await api("/api/quick-guide")}catch{}
 const a=Array.isArray(d.steps)?d.steps:[];

 shell(`<section class="section"><div class="card">
 <h1>🧭 GUÍA RÁPIDA</h1>
 <p>${esc(t("País → cantidad → entrega → pago → destinatario → revisión → sitio oficial.","Country → amount → delivery → payment → recipient → review → official site."))}</p>
 <div class="result-list">
 ${(a.length?a:[
 {title:"1. País",text:t("Confirma dónde recibirá el dinero.","Confirm where the money will be received.")},
 {title:"2. Cantidad",text:t("Confirma cuánto quieres enviar.","Confirm how much you want to send.")},
 {title:"3. Revisión",text:t("Revisa todo antes de continuar.","Review everything before continuing.")}
 ]:a).map(x=>`<div><b>${esc(x.title||x.name||"Paso")}</b><small>${esc(x.text||x.description||"")}</small></div>`).join("")}
 </div>
 <button class="btn" onclick="renderRemittance()">${esc(t("PREPARAR MI REMESA","PREPARE MY REMITTANCE"))}</button>
 </div></section>`,"GUÍA RÁPIDA")
}

async function renderLearn(){
 let d={};
 try{d=await api("/api/learn")}catch{}
 window.lessons=Array.isArray(d.lessons)?d.lessons:Array.isArray(d)?d:[];

 shell(`<section class="section"><div class="card">
 <h1>📖 APRENDER</h1>
 <p>${esc(t("Aprende el proceso con palabras sencillas. La información actual debe confirmarse con la fuente oficial.","Learn the process in simple words. Current information must be confirmed with the official source."))}</p>
 <div class="grid two">${window.lessons.map((x,i)=>card(x.title||`Paso ${i+1}`,x.summary||x.text||"",`showLesson(${i})`,"📘")).join("")}</div>
 <button class="btn secondary" onclick="exportLearningPDF()">${esc(t("GUARDAR GUÍA","SAVE GUIDE"))}</button>
 </div></section>`,"APRENDER")
}

function showLesson(i){
 const x=(window.lessons||[])[i]||{title:t("Antes de enviar","Before sending"),text:t("Confirma país, cantidad, entrega, destinatario y condiciones finales.","Confirm country, amount, delivery, recipient, and final terms.")};

 shell(`<section class="section"><div class="card">
 <h1>📘 ${esc(x.title||"")}</h1>
 <p>${esc(x.text||x.description||x.summary||"")}</p>
 <button class="btn" onclick="renderLearn()">${esc(t("VOLVER","BACK"))}</button>
 <button class="btn secondary" onclick="renderRemittance()">${esc(t("PREPARAR REMESA","PREPARE REMITTANCE"))}</button>
 </div></section>`,"APRENDER")
}

async function renderHelp(){
 let d={};
 try{d=await api("/api/help")}catch{}
 window.helpTopics=Array.isArray(d.topics)?d.topics:Array.isArray(APP.config?.help_topics)?APP.config.help_topics:[];

 shell(`<section class="section"><div class="card">
 <h1>❓ AYUDA</h1>
 <p>${esc(t("Dime qué necesitas y te ayudamos a encontrar el siguiente paso.","Tell me what you need and we will help find the next step."))}</p>
 <textarea id="helpText" maxlength="1000"></textarea>
 <button class="btn" onclick="askHelp()">${esc(t("AYÚDAME","HELP ME"))}</button>
 <div class="grid two">${window.helpTopics.map((x,i)=>card(x.title||x.name||x.id,x.description||"",`showHelpTopic(${i})`,"❓")).join("")}</div>
 </div></section>`,"AYUDA")
}

async function askHelp(){
 const q=(document.getElementById("helpText")?.value||"").trim();
 if(!q)return showError(t("Escribe tu pregunta.","Write your question."));

 try{
  const d=await api("/api/assistant",{method:"POST",body:JSON.stringify({language:APP.lang,text:q})});
  shell(`<section class="section"><div class="card">
  <h1>❓ RESPUESTA</h1>
  <div class="assistant"><p>${esc(d.answer||d.message||t("Revisa la Guía Rápida.","Review the Quick Guide."))}</p></div>
  <button class="btn" onclick="renderHelp()">${esc(t("VOLVER","BACK"))}</button>
  </div></section>`,"AYUDA")
 }catch{
  showError(t("Revisa la Guía Rápida.","Review the Quick Guide."))
 }
}

function showHelpTopic(i){
 const x=(window.helpTopics||[])[i]||{};
 shell(`<section class="section"><div class="card">
 <h1>❓ ${esc(x.title||x.name||x.id||"Ayuda")}</h1>
 <p>${esc(x.description||x.text||"")}</p>
 <button class="btn" onclick="renderHelp()">${esc(t("VOLVER","BACK"))}</button>
 </div></section>`,"AYUDA")
}

function renderAbout(){
 shell(`<section class="section"><div class="card">
 <h1>REMESAS</h1>
 <p>${esc(t("Servicio independiente de May Roga LLC para entender, organizar y preparar información relacionada con dinero y remesas.","Independent May Roga LLC service to understand, organize, and prepare information related to money and remittances."))}</p>
 <p>${esc(t("No es banco, institución financiera, procesador de pagos, remesadora, asesor financiero ni preparador de impuestos.","It is not a bank, financial institution, payment processor, remittance company, financial advisor, or tax preparer."))}</p>
 <button class="btn" onclick="renderHome()">${esc(t("VOLVER","BACK"))}</button>
 </div></section>`,"PRIVACIDAD")
}

async function ensureService(){
 if(await verifyAccess()){
  if(!APP.session&&!await startService())return false;
  return true
 }
 renderGate();
 return false
}

function renderGate(){
 app.innerHTML=`<div class="app-shell"><main><section class="hero">
 <div class="topbar">
 <strong class="brand">REMESAS<br><small>May Roga LLC</small></strong>
 <button class="btn lang-btn small" onclick="changeLanguage()">${APP.lang==="es"?"EN":"ES"}</button>
 </div>
 <h1>${esc(t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1>
 <p>${esc(t("Organiza tu dinero, prepara remesas y revisa la información antes de continuar.","Organize your money, prepare remittances, and review information before continuing."))}</p>
 <div class="card">
 <h2>${esc(t("ENTRA AL SERVICIO","ENTER THE SERVICE"))}</h2>
 <p>${esc(t("Pago único de $10.99. Acceso durante 20 minutos.","One-time $10.99 payment. Access for 20 minutes."))}</p>
 <button class="btn" onclick="startPaidAccess()">💳 ${esc(t("PAGAR $10.99 Y ENTRAR","PAY $10.99 AND ENTER"))}</button>
 </div>
 </section></main></div>`;
 installAdminGesture()
}

async function startPaidAccess(){
 try{
  const d=await api("/api/create-checkout-session",{method:"POST",body:JSON.stringify({language:APP.lang})});
  if(d.url)return location.href=d.url;
  if(d.checkout_url)return location.href=d.checkout_url;
  showError(t("No se pudo abrir el pago.","Could not open payment."))
 }catch(e){
  showError(e.message)
 }
}

function installAdminGesture(){
 let n=0,last=0;
 const f=()=>{
  const now=Date.now();
  if(now-last>900)n=0;
  n++;
  last=now;
  if(n>=3){
   n=0;
   showAdmin()
  }
 };
 app.addEventListener("click",f)
}

function showAdmin(){
 const x=document.createElement("div");
 x.className="modal-backdrop";
 x.innerHTML=`<div class="modal">
 <div class="modal-head"><h2>${esc(t("ENTRAR","SIGN IN"))}</h2><button class="close" onclick="this.closest('.modal-backdrop').remove()">×</button></div>
 <label>${esc(t("USERNAME","USERNAME"))}</label>
 <input id="adminUser" autocomplete="username">
 <label>${esc(t("PASSWORD","PASSWORD"))}</label>
 <input id="adminPass" type="password" autocomplete="current-password">
 <button class="btn" onclick="adminLogin()">${esc(t("ENTRAR","SIGN IN"))}</button>
 </div>`;
 document.body.appendChild(x)
}

async function adminLogin(){
 const u=document.getElementById("adminUser")?.value||"";
 const p=document.getElementById("adminPass")?.value||"";

 if(!u||!p)return showError(t("Escribe usuario y clave.","Enter username and password."));

 try{
  const d=await api("/api/access/admin",{method:"POST",body:JSON.stringify({username:u,password:p})});
  APP.access=d.access_token||d.token||"";
  if(APP.access)localStorage.setItem("remesas_access_v4",APP.access);
  document.querySelector(".modal-backdrop")?.remove();
  if(await startService())renderHome()
 }catch{
  showError(t("Usuario o clave incorrectos.","Incorrect username or password."))
 }
}

function pickPDF(){
 const i=document.createElement("input");
 i.type="file";
 i.accept=".pdf,application/pdf";
 i.onchange=()=>i.files?.[0]&&restorePDF(i.files[0]);
 i.click()
}

async function restorePDF(file){
 try{
  for(const u of ["/api/pdf/import","/api/pdf/restore","/api/import/pdf"]){
   try{
    const f=new FormData;
    f.append("file",file);
    const r=await fetch(u,{method:"POST",headers:{"X-Remesas-Access-Token":token(),"X-Remesas-Language":APP.lang},body:f});
    if(r.ok){
     const d=await r.json();
     if(d?.kind==="REMESAS_MONEY"||d?.data?.kind==="REMESAS_MONEY"){
      applyImportedData(d.data||d);
      return
     }
    }
   }catch{}
  }

  showError(t("No pude leer ese PDF. Usa un PDF guardado desde REMESAS.","I could not read that PDF. Use a PDF saved from REMESAS."))
 }catch{
  showError(t("No pude leer ese PDF.","I could not read that PDF."))
 }
}

function applyImportedData(d){
 if(!d||d.kind!=="REMESAS_MONEY")return showError(t("Este no parece ser un PDF de REMESAS.","This does not appear to be a REMESAS PDF."));

 if(d.money)setJSON(APP.moneyKey,d.money);
 if(Array.isArray(d.expenses))setJSON(APP.expensesKey,d.expenses);
 if(Array.isArray(d.savings))setJSON(APP.savingsKey,d.savings);
 if(Array.isArray(d.family))setJSON(APP.familyKey,d.family);
 if(Array.isArray(d.plans))setJSON(APP.plansKey,d.plans);

 const m=moneyState();
 setJSON(APP.moneyKey,m);

 shell(`<section class="section"><div class="card">
 <h1>✅ ${esc(t("TUS DATOS HAN VUELTO","YOUR DATA IS BACK"))}</h1>
 <p>${esc(t("Recuperamos tus registros y volvimos a calcular lo que queda.","We recovered your records and recalculated what remains."))}</p>
 <div class="notice"><h2>${money(m.available)}</h2><p>${esc(t("Ese es el dinero que queda según la información recuperada.","That is the money left according to the recovered information."))}</p></div>
 <button class="btn" onclick="renderPuedo()">${esc(t("VER MI DINERO","SEE MY MONEY"))}</button>
 </div></section>`,"RECUPERADO")
}

function loadScript(src){
 return new Promise((resolve,reject)=>{
  const old=document.querySelector(`script[data-remesas-src="${src}"]`);
  if(old)return resolve();
  const s=document.createElement("script");
  s.src=src;
  s.async=true;
  s.dataset.remesasSrc=src;
  s.onload=resolve;
  s.onerror=()=>reject(Error("PDF"));
  document.head.appendChild(s)
 })
}

async function ensureJsPDF(){
 if(window.jspdf?.jsPDF)return true;
 await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
 return!!window.jspdf?.jsPDF
}

async function exportMoneyPDF(){
 try{
  if(!await ensureJsPDF())throw Error("PDF");

  const m=moneyState(),e=expenses(),s=savings(),f=family(),p=plans(),d=new Date();

  const payload={
   kind:"REMESAS_MONEY",
   version:APP.version,
   money:m,
   expenses:e,
   savings:s,
   family:f,
   plans:p,
   date:d.toISOString()
  };

  const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const pdf=new window.jspdf.jsPDF();

  const lines=[
   "REMESAS - MAY ROGA LLC",
   `Fecha: ${d.toLocaleString(APP.lang==="es"?"es-US":"en-US")}`,
   "",
   "TENGO",
   `${money(m.have)} - dinero registrado como disponible.`,
   "",
   "GANO",
   `${money(m.monthlyIncome)} - entrada mensual de referencia.`,
   "",
   "GASTO",
   `${money(m.expenseTotal)} - gastos registrados.`,
   "",
   "AHORRO",
   `${money(m.savingsTotal)} - dinero apartado.`,
   "",
   "PUEDO",
   `${money(m.available)} - dinero que queda según tus registros.`,
   "",
   "Este PDF contiene información organizada por REMESAS.",
   "No prepara impuestos ni sustituye al contador.",
   "",
   "REMESAS_DATA:"+encoded
  ];

  let y=18;

  for(const line of lines){
   if(y>280){
    pdf.addPage();
    y=18
   }

   const parts=pdf.splitTextToSize(String(line),185);
   pdf.text(parts,12,y);
   y+=7*parts.length
  }

  pdf.save(`REMESAS_${d.toISOString().slice(0,10)}.pdf`)
 }catch{
  showError(t("No se pudo crear el PDF. Inténtalo de nuevo.","The PDF could not be created. Please try again."))
 }
}

async function exportLearningPDF(){
 try{
  const d=await api("/api/learning-pdf");
  if(d.url)return window.open(d.url,"_blank");
  if(d.download_url)return window.open(d.download_url,"_blank")
 }catch{}
 showError(t("La guía está disponible en APRENDER.","The guide is available in LEARN."))
}

function understandNeed(){
 const s=(document.getElementById("freeNeed")?.value||"").trim();

 if(!s)return showError(t("Escribe qué necesitas.","Write what you need."));

 const m=s.match(/\$?\s?(\d+(?:[.,]\d{1,2})?)/);
 const cs=APP.config?.countries||[];
 let d=null;

 for(const c of cs){
  const a=[c.id,c.code,c.name?.es,c.name?.en,...(c.aliases||[])].filter(Boolean);
  if(a.some(x=>s.toLowerCase().includes(String(x).toLowerCase()))){
   d=c.id||c.code;
   break
  }
 }

 if(m&&d)return beginParsedRemittance({amount:num(m[1].replace(",",".")),destination_country:d});
 if(/ahorr|guardar|meta|compr|carro|casa|viaje/i.test(s))return renderGoals();
 if(/gast|pagar|comida|renta|alquiler/i.test(s))return renderExpenses();

 renderHelp()
}

async function beginParsedRemittance(x){
 if(!await ensureService())return;

 shell(`<section class="section"><div class="card">
 <h1>💸 ${esc(t("PREPARAR REMESA","PREPARE REMITTANCE"))}</h1>
 <p>${esc(t(`Entendí que quieres enviar ${money(x.amount)} a ${x.destination_country}.`,`I understood that you want to send ${money(x.amount)} to ${x.destination_country}.`))}</p>
 <button class="btn" onclick="renderRemittance()">${esc(t("REVISAR DATOS","REVIEW DATA"))}</button>
 </div></section>`,"REMESA")
}

function showError(m){
 document.querySelector(".toast")?.remove();
 const b=document.createElement("div");
 b.className="toast";
 b.textContent=m;
 document.body.appendChild(b);
 setTimeout(()=>b.remove(),5000)
}

async function changeLanguage(){
 APP.lang=APP.lang==="es"?"en":"es";
 localStorage.setItem("remesas_lang_v4",APP.lang);
 await loadConfig();
 renderHome()
}

function deleteLocalData(){
 if(!confirm(t("¿Quieres borrar tus datos guardados?","Do you want to delete your saved data?")))return;
 [APP.moneyKey,APP.expensesKey,APP.familyKey,APP.prefsKey,APP.savingsKey,APP.plansKey].forEach(k=>localStorage.removeItem(k));
 location.reload()
}

async function start(){
 await loadConfig();

 if(await verifyAccess()){
  if(await startService())renderHome()
 }else{
  renderGate()
 }
}

Object.assign(window,{
 renderHome,
 renderTengo,
 saveTengo,
 renderGano,
 saveGano,
 renderExpenses,
 addExpense,
 removeExpense,
 renderSavings,
 saveSavings,
 removeSavings,
 renderGoals,
 savePlan,
 removePlan,
 renderPuedo,
 renderHago,
 renderFamily,
 saveFamily,
 removeFamily,
 renderMoney,
 renderWeek,
 renderPeriod,
 renderPurchase,
 checkPurchase,
 renderRemittance,
 compare,
 showComparison,
 selectProvider,
 renderFinalCheck,
 finishCheck,
 openOfficial,
 renderQuickGuide,
 renderLearn,
 showLesson,
 renderHelp,
 askHelp,
 showHelpTopic,
 renderAbout,
 startPaidAccess,
 showAdmin,
 adminLogin,
 pickPDF,
 restorePDF,
 exportMoneyPDF,
 exportLearningPDF,
 understandNeed,
 beginParsedRemittance,
 changeLanguage,
 deleteLocalData
});

start();
