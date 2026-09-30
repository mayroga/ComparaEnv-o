const APP={
config:null,session:null,lang:localStorage.getItem("remesas_lang")||"es",
version:"3.0.0",brainVersion:null,
keys:{money:"remesas_money_v3",expenses:"remesas_expenses_v3",family:"remesas_family_v3",prefs:"remesas_prefs_v3"}
};

const $=s=>document.querySelector(s);
const app=()=>$("#app");
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v)||0);
const t=(es,en)=>APP.lang==="en"?en:es;

async function api(url,options={}){
    const opts={...options,headers:{"Content-Type":"application/json",...(options.headers||{})}};
    const r=await fetch(url,opts);
    let data={};
    try{data=await r.json()}catch(e){}
    if(!r.ok)throw new Error(data.detail||data.error||t("No pudimos completar la operación.","We could not complete the operation."));
    return data;
}

function setLang(lang){
    APP.lang=lang==="en"?"en":"es";
    localStorage.setItem("remesas_lang",APP.lang);
    startSession().finally(()=>renderHome());
}

async function startSession(){
    try{
        const d=await api(`/api/session?language=${encodeURIComponent(APP.lang)}`,{method:"POST"});
        APP.session=d.session||null;
    }catch(e){APP.session=null}
}

async function loadConfig(){
    try{
        const d=await api(`/api/config?language=${encodeURIComponent(APP.lang)}`);
        APP.config=d;
        APP.brainVersion=d.app?.version||null;
        return d;
    }catch(e){
        APP.config=null;
        showError(e.message);
        return null;
    }
}

function topbar(title="REMESAS",back=true){
    return `<div class="topbar"><button class="icon-btn" onclick="${back?"renderHome()":"void(0)"}">${back?"←":""}</button><strong>${esc(title)}</strong><button class="lang-btn" onclick="setLang('${APP.lang==="es"?"en":"es"}')">${APP.lang==="es"?"EN":"ES"}</button></div>`;
}

function renderHome(){
    app().innerHTML=`
    <div class="topbar"><strong>REMESAS</strong><button class="lang-btn" onclick="setLang('${APP.lang==="es"?"en":"es"}')">${APP.lang==="es"?"EN":"ES"}</button></div>
    <section class="hero">
        <div class="brand">REMESAS</div>
        <div class="company">May Roga LLC</div>
        <h1>${t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER")}</h1>
        <p>${t("¿Qué necesitas resolver hoy?","What do you need to solve today?")}</p>
        <p class="small">${t("Primero entendemos lo que necesitas. Después te mostramos solo lo que tiene sentido para ti.","First we understand what you need. Then we show only what makes sense for you.")}</p>
    </section>
    <div class="notice">
        <strong>${t("¿Por qué preguntamos esto?","Why do we ask this?")}</strong>
        <p>${t("Para no llenarte de opciones que no necesitas. Tus datos personales de dinero se quedan en este dispositivo.","So we do not fill you with options you do not need. Your personal money data stays on this device.")}</p>
    </div>
    <section class="home-grid">
        <button class="home-card" onclick="renderRemittance()"><span>💸</span><strong>${t("Enviar dinero","Send money")}</strong><small>${t("Comparar las opciones disponibles de Western Union, MoneyGram, Remitly y Xoom.","Compare available options from Western Union, MoneyGram, Remitly and Xoom.")}</small></button>
        <button class="home-card" onclick="renderMoney()"><span>💰</span><strong>${t("Mi dinero","My money")}</strong><small>${t("Organizar ingresos, gastos, ahorro y dinero disponible.","Organize income, expenses, savings and available money.")}</small></button>
        <button class="home-card" onclick="renderWeek()"><span>📅</span><strong>${t("Mi semana","My week")}</strong><small>${t("Ver qué entra, qué sale y qué queda disponible.","See what comes in, what goes out and what remains available.")}</small></button>
        <button class="home-card" onclick="renderExpenses()"><span>🧾</span><strong>${t("Mis gastos","My expenses")}</strong><small>${t("Anotar gastos para entender en qué se va tu dinero.","Record expenses to understand where your money goes.")}</small></button>
        <button class="home-card" onclick="renderFamily()"><span>👨‍👩‍👧</span><strong>${t("Familia","Family")}</strong><small>${t("Guardar localmente personas y destinos frecuentes.","Save frequent people and destinations locally.")}</small></button>
        <button class="home-card" onclick="renderHelp()"><span>❓</span><strong>${t("No entiendo","I don't understand")}</strong><small>${t("Explicaciones sencillas sobre comisiones, cambio, requisitos y errores.","Simple explanations about fees, exchange rates, requirements and mistakes.")}</small></button>
        <button class="home-card" onclick="renderPurchase()"><span>🛒</span><strong>${t("Planear una compra","Plan a purchase")}</strong><small>${t("Ver cómo una compra cambia el dinero que te queda.","See how a purchase changes the money you have left.")}</small></button>
        <button class="home-card" onclick="renderSavings()"><span>💵</span><strong>${t("Ahorrar","Save")}</strong><small>${t("Registrar ahorro y ver su efecto en tu dinero disponible.","Record savings and see its effect on available money.")}</small></button>
    </section>
    <section class="card">
        <h2>${t("¿Tienes otra necesidad?","Something else?")}</h2>
        <p>${t("Escríbela con tus propias palabras. Primero intentaremos entender qué necesitas; no te enviaremos automáticamente a una remesadora.","Write it in your own words. We will first try to understand what you need; we will not automatically send you to a remittance provider.")}</p>
        <textarea id="freeNeed" placeholder="${t("Ej.: quiero enviar $300 a México y necesito entender las opciones","Example: I want to send $300 to Mexico and need to understand my options")}"></textarea>
        <button class="btn primary" onclick="understandNeed()">${t("Entender mi necesidad","Understand my need")}</button>
    </section>
    <section class="privacy-box">
        <strong>${t("Privacidad sencilla","Simple privacy")}</strong>
        <p>${t("Ingresos, gastos, compras, ahorro y nombres de familiares se guardan solamente en este navegador. No necesitas escribir aquí contraseñas, CVV ni códigos de seguridad.","Income, expenses, purchases, savings and family names are stored only in this browser. You do not need to enter passwords, CVV numbers or security codes here.")}</p>
        <button class="btn danger-outline" onclick="deleteLocalData()">${t("Borrar mis datos de este dispositivo","Delete my data from this device")}</button>
    </section>
    <footer>REMESAS · May Roga LLC · ${t("Información y organización. Tú decides.","Information and organization. You decide.")}</footer>`;
}

async function understandNeed(){
    const text=($("#freeNeed")?.value||"").trim();
    if(!text)return showError(t("Escribe primero qué necesitas.","First write what you need."));
    try{
        const d=await api("/api/assistant",{method:"POST",body:JSON.stringify({text,language:APP.lang})});
        renderAssistant(d);
    }catch(e){showError(e.message)}
}

function renderAssistant(data){
    const p=data.parsed||{},a=data.assistant||{};
    app().innerHTML=`${topbar(t("Entender mi necesidad","Understand my need"))}
    <section class="card">
        <div class="status ok">${esc(a.message||"")}</div>
        ${p.amount?`<div class="metric"><span>${t("Cantidad detectada","Amount detected")}</span><strong>${money(p.amount)}</strong></div>`:""}
        ${p.destination_country?`<div class="metric"><span>${t("Destino detectado","Destination detected")}</span><strong>${esc(countryName(p.destination_country))}</strong></div>`:""}
        ${p.priority?`<div class="metric"><span>${t("Prioridad detectada","Priority detected")}</span><strong>${esc(priorityLabel(p.priority))}</strong></div>`:""}
        ${a.remittance_required?`<button class="btn primary" onclick="beginParsedRemittance(${JSON.stringify(p).replace(/"/g,"&quot;")})">${t("Continuar con mi envío","Continue with my transfer")}</button>`:`<button class="btn primary" onclick="renderHome()">${t("Volver al inicio","Back home")}</button>`}
    </section>`;
}

async function beginParsedRemittance(parsed){
    try{
        if(!APP.session)await startSession();
        const body={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance"};
        ["amount","destination_country","priority","urgency","frequency"].forEach(k=>{if(parsed[k]!=null)body[k]=parsed[k]});
        const d=await api("/api/need",{method:"POST",body:JSON.stringify(body)});
        APP.session=d.session;
        renderRemittance(parsed);
    }catch(e){showError(e.message)}
}

function countryName(code){
    const c=(APP.config?.countries||[]).find(x=>x.id===code||x.code===code);
    return c?.name||code;
}
function priorityLabel(v){
    const m={fastest:t("Rapidez","Speed"),save:t("Ahorro","Savings"),recipient_gets_more:t("Más para quien recibe","More for recipient"),balanced:t("Equilibrio","Balance"),urgent:t("Urgente","Urgent"),compare_all:t("Comparar","Compare")};
    return m[v]||v;
}

function renderRemittance(parsed={}){
    const countries=APP.config?.countries||[];
    const delivery=APP.config?.delivery_methods||[];
    const payment=APP.config?.payment_methods||[];
    const s=APP.session||{};
    app().innerHTML=`${topbar(t("Enviar dinero","Send money"))}
    <section class="card">
        <h1>${t("Primero entendamos tu envío","First, let's understand your transfer")}</h1>
        <p class="small">${t("Solo preguntamos lo que puede cambiar la comparación.","We only ask what can change the comparison.")}</p>
        <label>${t("¿Cuánto quieres enviar?","How much do you want to send?")}</label>
        <input id="amount" type="number" min="0.01" step="0.01" value="${esc(parsed.amount??s.amount??"")}" placeholder="300">
        <label>${t("¿A qué país?","Which country?")}</label>
        <select id="country"><option value="">${t("Selecciona un país","Select a country")}</option>${countries.map(c=>`<option value="${esc(c.id)}" ${(parsed.destination_country||s.destination_country)===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select>
        <label>${t("¿Qué tan rápido lo necesitas?","How quickly do you need it?")}</label>
        <select id="urgency"><option value="">${t("No estoy seguro","Not sure")}</option><option value="true" ${(parsed.urgency||s.urgency)===true?"selected":""}>${t("Lo antes posible","As soon as possible")}</option><option value="false">${t("Puede esperar","It can wait")}</option></select>
        <label>${t("¿Qué te importa más?","What matters most?")}</label>
        <select id="priority"><option value="">${t("Quiero ver las opciones","I want to see the options")}</option><option value="fastest">${t("Rapidez","Speed")}</option><option value="save">${t("Costo/ahorro","Cost/savings")}</option><option value="recipient_gets_more">${t("Que reciba más","Recipient gets more")}</option><option value="balanced">${t("Equilibrio","Balance")}</option></select>
        <label>${t("¿Cómo quieres que reciba el dinero?","How should the recipient receive it?")}</label>
        <select id="delivery"><option value="">${t("Mostrar opciones disponibles","Show available options")}</option>${delivery.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join("")}</select>
        <label>${t("¿Cómo pagarías el envío?","How would you pay?")}</label>
        <select id="payment"><option value="">${t("Mostrar opciones disponibles","Show available options")}</option>${payment.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join("")}</select>
        <div id="moneyWarning"></div>
        <button class="btn primary" onclick="compare()">${t("Comparar opciones","Compare options")}</button>
    </section>`;
    updateMoneyWarning();
    $("#amount")?.addEventListener("input",updateMoneyWarning);
}

function getMoneyState(){
    try{return JSON.parse(localStorage.getItem(APP.keys.money)||"{}")}catch(e){return {}}
}
function updateMoneyWarning(){
    const amount=Number($("#amount")?.value||0),m=getMoneyState(),available=Number(m.available??NaN),reserved=Number(m.reserved??0);
    const box=$("#moneyWarning");
    if(!box)return;
    if(amount<=0){box.innerHTML="";return}
    if(Number.isFinite(available)&&amount>available)box.innerHTML=`<div class="status warning">${t("La cantidad supera el dinero disponible que registraste. Revísalo antes de continuar.","The amount is above the available money you recorded. Review it before continuing.")}</div>`;
    else if(reserved>0&&Number.isFinite(available)&&amount+reserved>available)box.innerHTML=`<div class="status warning">${t("Parte de tu dinero está reservado para otra obligación. Revisa antes de usarlo para la remesa.","Part of your money is reserved for another obligation. Review before using it for the transfer.")}</div>`;
    else if(amount>10000)box.innerHTML=`<div class="status warning">${t("La cantidad es alta. Revisa que hayas escrito la cantidad correcta.","The amount is high. Check that you entered the correct amount.")}</div>`;
    else box.innerHTML="";
}

async function compare(){
    const amount=Number($("#amount")?.value||0),country=$("#country")?.value||"",priority=$("#priority")?.value||null,urgency=$("#urgency")?.value,payment=$("#payment")?.value||null,delivery=$("#delivery")?.value||null;
    if(!amount||amount<=0)return showError(t("Escribe una cantidad válida.","Enter a valid amount."));
    if(!country)return showError(t("Selecciona el país de destino.","Select the destination country."));
    const body={amount,destination_country:country,priority,urgency:urgency===""?null:urgency==="true",delivery_method:delivery,payment_method:payment,language:APP.lang,send_currency:"USD"};
    try{
        if(APP.session){
            const n=await api("/api/need",{method:"POST",body:JSON.stringify({...body,session_id:APP.session.session_id,need_type:"remittance"})});
            APP.session=n.session;
            const d=await api(`/api/session/${APP.session.session_id}/compare`,{method:"POST"});
            renderComparison(d);
        }else{
            const d=await api("/api/compare",{method:"POST",body:JSON.stringify(body)});
            renderComparison(d);
        }
    }catch(e){showError(e.message)}
}

function providerStatus(p){
    return p.commercial_verified
        ? `<span class="status ok">${t("Datos comerciales verificados","Verified commercial data")}</span>`
        : `<span class="status warning">${t("Datos comerciales no verificados","Commercial data not verified")}</span>`;
}

function renderComparison(data){
    const results=data.results||[],providers=data.available_providers||[];
    app().innerHTML=`${topbar(t("Opciones para revisar","Options to review"))}
    <section class="card">
        <h1>${esc(data.destination_name||data.destination_country||"")}</h1>
        <div class="metric-grid">
            <div class="metric"><span>${t("Enviar","Send")}</span><strong>${money(data.amount)}</strong></div>
            <div class="metric"><span>${t("Datos verificados","Verified data")}</span><strong>${data.verified_count||0}</strong></div>
        </div>
        <p>${esc(data.explanation||data.message||"")}</p>
    </section>
    <section class="provider-list">${providers.map(p=>providerCard(p,data)).join("")}</section>
    ${data.differences?.length?`<section class="card"><h2>${t("Diferencias que sí podemos mostrar","Differences we can show")}</h2>${data.differences.map(d=>`<div class="difference"><strong>${esc(d.label)}</strong>${d.values.map(v=>`<div><span>${esc(v.provider_name)}</span><small>${esc(methodText(v.value))}</small></div>`).join("")}</div>`).join("")}</section>`:""}
    <section class="card warning-card"><h2>${t("Antes de continuar","Before continuing")}</h2><ul>${(data.precautions||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`;
}

function methodText(v){
    if(Array.isArray(v))return v.map(x=>methodLabel(x)).join(", ");
    if(typeof v==="boolean")return v?t("Sí","Yes"):t("No","No");
    return v??"";
}
function methodLabel(id){
    const all=[...(APP.config?.delivery_methods||[]),...(APP.config?.payment_methods||[])];
    return all.find(x=>x.id===id)?.label||id;
}

function providerCard(p,data){
    const verified=p.commercial_verified;
    return `<article class="provider-card">
        <div class="provider-head"><div><h2>${esc(p.provider_name)}</h2><p>${esc(p.country_name||data.destination_name||"")}</p></div>${providerStatus(p)}</div>
        <p class="small">${verified?t("Existe información comercial verificada para esta opción.","Verified commercial information is available for this option."):t("La opción está incluida para que puedas revisarla en el sitio oficial, pero no mostramos tarifas, tasas, tiempos ni disponibilidad como datos actuales sin verificación.","The option is included so you can review it on the official site, but we do not show fees, rates, delivery times or availability as current without verification.")}</p>
        ${verified?`<div class="metric-grid">
            ${p.fee!=null?`<div class="metric"><span>${t("Comisión","Fee")}</span><strong>${money(p.fee)}</strong></div>`:""}
            ${p.exchange_rate!=null?`<div class="metric"><span>${t("Cambio","Rate")}</span><strong>${esc(p.exchange_rate)}</strong></div>`:""}
            ${p.recipient_amount!=null?`<div class="metric"><span>${t("Recibe","Recipient")}</span><strong>${money(p.recipient_amount)}</strong></div>`:""}
        </div>`:""}
        <button class="btn primary" onclick="selectProvider('${esc(p.provider_id)}')">${t("Revisar esta opción","Review this option")}</button>
    </article>`;
}

async function selectProvider(id){
    if(!APP.session?.session_id)return openProvider(id);
    try{
        const d=await api(`/api/session/${APP.session.session_id}/select/${encodeURIComponent(id)}`,{method:"POST"});
        APP.session=d.session;
        renderFinalCheck(d.selected_option||{},d);
    }catch(e){showError(e.message)}
}

function openProvider(id){
    const p=(APP.config?.providers||[]).find(x=>x.id===id);
    if(!p?.continue_url)return showError(t("No hay un enlace oficial disponible.","No official link is available."));
    window.open(p.continue_url,"_blank","noopener,noreferrer");
}

async function finalCheck(){
    if(!APP.session?.session_id)return;
    try{
        const d=await api(`/api/session/${APP.session.session_id}/final-check`,{method:"POST"});
        renderFinalResult(d);
    }catch(e){showError(e.message)}
}

function renderFinalCheck(option,data){
    const verified=option.commercial_verified;
    app().innerHTML=`${topbar(t("Revisión final","Final review"))}
    <section class="card">
        <h1>${esc(option.provider_name||"")}</h1>
        <p>${t("Esta revisión no envía dinero. Solo prepara lo que debes comprobar antes de salir de REMESAS.","This review does not send money. It only prepares what you should check before leaving REMESAS.")}</p>
        <div class="review-grid">
            <div><span>${t("Cantidad","Amount")}</span><strong>${money(data.session?.amount||APP.session?.amount||0)}</strong></div>
            <div><span>${t("Destino","Destination")}</span><strong>${esc(option.country_name||"")}</strong></div>
            <div><span>${t("Datos comerciales","Commercial data")}</span><strong>${verified?t("Verificados","Verified"):t("No verificados","Not verified")}</strong></div>
        </div>
        ${!verified?`<div class="status warning">${t("Antes de confirmar, revisa directamente comisión, tasa de cambio, método, tiempo y disponibilidad en el sitio oficial.","Before confirming, review the fee, exchange rate, method, delivery time and availability directly on the official site.")}</div>`:""}
        <button class="btn primary" onclick="finalCheck()">${t("Hacer revisión final","Run final review")}</button>
        <button class="btn secondary" onclick="openProvider('${esc(option.provider_id)}')">${t("Revisar sitio oficial","Review official site")}</button>
    </section>`;
}

function renderFinalResult(data){
    app().innerHTML=`${topbar(t("Lista para revisar","Ready to review"))}
    <section class="card">
        <h1>${data.ready_to_continue?t("Revisión básica completa","Basic review complete"):t("Falta revisar algo","Something needs review")}</h1>
        <p>${esc(data.message||"")}</p>
        <div class="check-list">${(data.checks||[]).map(c=>`<div class="check-row ${c.status==="ok"?"ok":"review"}"><span>${c.status==="ok"?"✓":"!"}</span><div><strong>${esc(c.label)}</strong><small>${esc(c.value)}</small></div></div>`).join("")}</div>
        <div class="warning-card"><ul>${(data.precautions||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
        ${data.ready_to_continue?`<button class="btn primary" onclick="openProvider('${esc(data.provider_id)}')">${t("Continuar en el sitio oficial","Continue on official site")}</button>`:""}
    </section>`;
}

function renderMoney(){
    const m=getMoneyState();
    app().innerHTML=`${topbar(t("Mi dinero","My money"))}
    <section class="card"><h1>${t("Organiza tu dinero","Organize your money")}</h1>
    <p>${t("Todo queda en este dispositivo. Puedes cambiarlo cuando quieras.","Everything stays on this device. You can change it anytime.")}</p>
    <label>${t("¿Cuánto recibes?","How much do you receive?")}</label><input id="income" type="number" min="0" step="0.01" value="${m.income??""}">
    <label>${t("Frecuencia","Frequency")}</label><select id="incomeFreq"><option value="monthly">${t("Mensual","Monthly")}</option><option value="biweekly">${t("Quincenal","Biweekly")}</option><option value="weekly">${t("Semanal","Weekly")}</option></select>
    <label>${t("Necesidades esenciales","Essential needs")}</label><input id="essential" type="number" min="0" step="0.01" value="${m.essential??""}">
    <label>${t("Otros gastos","Other spending")}</label><input id="flexible" type="number" min="0" step="0.01" value="${m.flexible??""}">
    <label>${t("Ahorro","Savings")}</label><input id="savingsMoney" type="number" min="0" step="0.01" value="${m.savings??""}">
    <label>${t("Remesas","Remittances")}</label><input id="remittanceMoney" type="number" min="0" step="0.01" value="${m.remittance??""}">
    <button class="btn primary" onclick="calculateMoney()">${t("Calcular mi disponible","Calculate my available money")}</button></section>
    <section id="moneySummary"></section>`;
}

function calculateMoney(){
    const income=Math.max(Number($("#income")?.value||0),0),essential=Math.max(Number($("#essential")?.value||0),0),flexible=Math.max(Number($("#flexible")?.value||0),0),savings=Math.max(Number($("#savingsMoney")?.value||0),0),remittance=Math.max(Number($("#remittanceMoney")?.value||0),0);
    const available=income-essential-flexible-savings-remittance;
    const state={income,essential,flexible,savings,remittance,available,reserved:0,updated_at:new Date().toISOString()};
    localStorage.setItem(APP.keys.money,JSON.stringify(state));
    $("#moneySummary").innerHTML=`<section class="card"><div class="money-summary ${available<0?"negative":""}"><span>${t("Disponible aproximado","Approximate available")}</span><strong>${money(available)}</strong></div><p>${available<0?t("Tus cantidades registradas superan el ingreso registrado. Es una señal para revisar el plan, no una orden sobre qué hacer.","Your recorded amounts exceed the recorded income. This is a reason to review the plan, not an instruction about what to do."):t("Esta cifra es orientativa y usa solamente los datos que registraste aquí.","This figure is informational and uses only the data you entered here.")}</p></section>`;
}

function renderWeek(){
    const m=getMoneyState();
    const weekly=m.income?incomeToWeekly(Number(m.income),m.incomeFreq):0;
    const expenses=(Number(m.essential)||0)+(Number(m.flexible)||0)+(Number(m.savings)||0)+(Number(m.remittance)||0);
    const available=weekly-expenses;
    app().innerHTML=`${topbar(t("Mi semana","My week"))}<section class="card"><h1>${t("Tu semana en una vista","Your week at a glance")}</h1><div class="metric-grid"><div class="metric"><span>${t("Ingreso semanal estimado","Estimated weekly income")}</span><strong>${money(weekly)}</strong></div><div class="metric"><span>${t("Registrado para salir","Recorded outflow")}</span><strong>${money(expenses)}</strong></div><div class="metric"><span>${t("Queda aproximadamente","Approximate remainder")}</span><strong>${money(available)}</strong></div></div><p>${t("Es una organización orientativa basada en lo que has registrado. No representa el saldo de una cuenta bancaria.","This is an informational plan based on what you recorded. It is not a bank account balance.")}</p></section>`;
}
function incomeToWeekly(amount,freq){
    if(freq==="weekly")return amount;
    if(freq==="biweekly")return amount/2;
    if(freq==="monthly")return amount*12/52;
    return amount;
}

function getExpenses(){try{return JSON.parse(localStorage.getItem(APP.keys.expenses)||"[]")}catch(e){return[]}}
function saveExpenses(x){localStorage.setItem(APP.keys.expenses,JSON.stringify(x))}
function renderExpenses(){
    const items=getExpenses();
    app().innerHTML=`${topbar(t("Mis gastos","My expenses"))}<section class="card"><h1>${t("Anota un gasto","Record an expense")}</h1><input id="expenseDesc" placeholder="${t("Ej.: supermercado","Example: groceries")}"><input id="expenseAmount" type="number" min="0.01" step="0.01" placeholder="50.00"><select id="expenseCat"><option value="essential">${t("Esencial","Essential")}</option><option value="flexible">${t("Flexible","Flexible")}</option><option value="other">${t("Otro","Other")}</option></select><button class="btn primary" onclick="addExpense()">${t("Guardar gasto","Save expense")}</button></section><section class="card"><h2>${t("Gastos guardados en este dispositivo","Expenses saved on this device")}</h2>${items.length?items.map((x,i)=>`<div class="expense-row"><div><strong>${esc(x.description)}</strong><small>${esc(x.category||"")}</small></div><strong>${money(x.amount)}</strong><button onclick="removeExpense(${i})">×</button></div>`).join(""):`<p class="small">${t("Todavía no has registrado gastos.","You have not recorded expenses yet.")}</p>`}</section>`;
}
function addExpense(){
    const description=($("#expenseDesc")?.value||"").trim(),amount=Number($("#expenseAmount")?.value||0),category=$("#expenseCat")?.value||"other";
    if(!description||amount<=0)return showError(t("Escribe una descripción y cantidad válidas.","Enter a valid description and amount."));
    const x=getExpenses();x.unshift({description,amount,category,created_at:new Date().toISOString()});saveExpenses(x);renderExpenses();
}
function removeExpense(i){const x=getExpenses();x.splice(i,1);saveExpenses(x);renderExpenses()}

function getFamily(){try{return JSON.parse(localStorage.getItem(APP.keys.family)||"[]")}catch(e){return[]}}
function renderFamily(){
    const items=getFamily();
    app().innerHTML=`${topbar(t("Familia","Family"))}<section class="card"><h1>${t("Personas frecuentes","Frequent people")}</h1><p>${t("Solo para organizar información local. No guardamos contraseñas ni credenciales.","For local organization only. We do not store passwords or credentials.")}</p><input id="familyName" placeholder="${t("Nombre o apodo","Name or nickname")}"><input id="familyCountry" placeholder="${t("País","Country")}"><input id="familyAmount" type="number" min="0" step="0.01" placeholder="${t("Cantidad habitual","Usual amount")}"><button class="btn primary" onclick="addFamily()">${t("Guardar localmente","Save locally")}</button></section><section class="card">${items.map((x,i)=>`<div class="family-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.country)} · ${money(x.amount)}</small></div><button onclick="removeFamily(${i})">×</button></div>`).join("")}</section>`;
}
function addFamily(){
    const name=($("#familyName")?.value||"").trim(),country=($("#familyCountry")?.value||"").trim(),amount=Number($("#familyAmount")?.value||0);
    if(!name||!country)return showError(t("Escribe nombre y país.","Enter a name and country."));
    const x=getFamily();x.push({name,country,amount:amount>0?amount:null,created_at:new Date().toISOString()});localStorage.setItem(APP.keys.family,JSON.stringify(x));renderFamily();
}
function removeFamily(i){const x=getFamily();x.splice(i,1);localStorage.setItem(APP.keys.family,JSON.stringify(x));renderFamily()}

function renderSavings(){
    const m=getMoneyState();
    app().innerHTML=`${topbar(t("Ahorrar","Save"))}<section class="card"><h1>${t("Registrar ahorro","Record savings")}</h1><p>${t("Aquí solo organizamos una cantidad que tú decidas separar.","Here we only organize an amount you decide to set aside.")}</p><input id="saveAmount" type="number" min="0" step="0.01" value="${m.savings||""}" placeholder="100"><input id="savePurpose" placeholder="${t("¿Para qué?","For what?")}"><button class="btn primary" onclick="saveSavings()">${t("Guardar ahorro","Save savings")}</button></section>`;
}
function saveSavings(){
    const amount=Number($("#saveAmount")?.value||0),purpose=($("#savePurpose")?.value||"").trim();
    if(amount<0)return showError(t("La cantidad no es válida.","The amount is not valid."));
    const m=getMoneyState();m.savings=amount;m.savings_purpose=purpose;m.updated_at=new Date().toISOString();localStorage.setItem(APP.keys.money,JSON.stringify(m));
    renderMoney();
}

function renderPurchase(){
    const m=getMoneyState();
    app().innerHTML=`${topbar(t("Planear una compra","Plan a purchase"))}<section class="card"><h1>${t("¿Cómo afectaría esta compra?","How would this purchase affect you?")}</h1><input id="purchaseAmount" type="number" min="0.01" step="0.01" placeholder="100"><input id="purchaseName" placeholder="${t("¿Qué quieres comprar?","What do you want to buy?")}"><button class="btn primary" onclick="checkPurchase()">${t("Revisar efecto","Review effect")}</button></section><section id="purchaseResult"></section>`;
}
function checkPurchase(){
    const amount=Number($("#purchaseAmount")?.value||0),m=getMoneyState(),available=Number(m.available??0),reserved=Number(m.reserved??0);
    if(amount<=0)return showError(t("Escribe una cantidad válida.","Enter a valid amount."));
    const after=available-amount;
    const status=after<0?"warning":"ok";
    $("#purchaseResult").innerHTML=`<section class="card"><div class="money-summary ${status==="warning"?"negative":""}"><span>${t("Después de la compra","After the purchase")}</span><strong>${money(after)}</strong></div>${reserved>0?`<p class="status warning">${t("También tienes dinero marcado como reservado. Esta vista no lo trata como dinero libre.","You also have money marked as reserved. This view does not treat it as free money.")}</p>`:""}<p>${after<0?t("La cantidad registrada sería mayor que tu disponible registrado.","The recorded amount would be greater than your recorded available money."):t("La compra cabe dentro del disponible registrado según tus datos actuales.","The purchase fits within the available amount recorded from your current data.")}</p></section>`;
}

function renderHelp(){
    const topics=APP.config?.help_topics||[];
    app().innerHTML=`${topbar(t("No entiendo","I don't understand"))}<section class="card"><h1>${t("Explicaciones sencillas","Simple explanations")}</h1>${topics.map(x=>`<details><summary>${esc(x.label)}</summary><p>${esc(x.answer)}</p></details>`).join("")}</section>`;
}

function showError(message){
    let box=$("#globalError");
    if(!box){box=document.createElement("div");box.id="globalError";box.className="error-box";document.body.appendChild(box)}
    box.innerHTML=`${esc(message)} <button onclick="this.parentElement.remove()">×</button>`;
    setTimeout(()=>box?.remove(),7000);
}

function deleteLocalData(){
    if(!confirm(t("¿Borrar los datos guardados en este dispositivo?","Delete the data stored on this device?")))return;
    Object.keys(localStorage).filter(k=>k.startsWith("remesas_")).forEach(k=>localStorage.removeItem(k));
    APP.lang="es";localStorage.setItem("remesas_lang","es");
    loadConfig().finally(()=>startSession().finally(()=>renderHome()));
}

window.setLang=setLang;
window.renderHome=renderHome;
window.renderRemittance=renderRemittance;
window.renderMoney=renderMoney;
window.renderWeek=renderWeek;
window.renderExpenses=renderExpenses;
window.renderFamily=renderFamily;
window.renderHelp=renderHelp;
window.renderPurchase=renderPurchase;
window.renderSavings=renderSavings;
window.compare=compare;
window.selectProvider=selectProvider;
window.finalCheck=finalCheck;
window.openProvider=openProvider;
window.understandNeed=understandNeed;
window.beginParsedRemittance=beginParsedRemittance;
window.calculateMoney=calculateMoney;
window.addExpense=addExpense;
window.removeExpense=removeExpense;
window.addFamily=addFamily;
window.removeFamily=removeFamily;
window.saveSavings=saveSavings;
window.checkPurchase=checkPurchase;
window.deleteLocalData=deleteLocalData;

document.addEventListener("DOMContentLoaded",async()=>{
    await loadConfig();
    await startSession();
    renderHome();
});
