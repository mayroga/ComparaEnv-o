const APP={name:"REMESAS",version:"4.0.0",lang:localStorage.getItem("remesas_lang_v4")||localStorage.getItem("remesas_lang")||"es",session:null,config:null,comparison:null,pendingParsed:null,keys:{money:"remesas_money_v4",expenses:"remesas_expenses_v4",family:"remesas_family_v4",prefs:"remesas_prefs_v4",lang:"remesas_lang_v4",savings:"remesas_savings_v4"}};

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const money=(v,c="USD")=>{const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat(APP.lang==="en"?"en-US":"es-US",{style:"currency",currency:c,maximumFractionDigits:2}).format(n):"—"};
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

function shell(content){
    const cfg=APP.config||{};
    const appName=cfg.app?.name||APP.name;
    return `<div class="app-shell">
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

function actionCard(icon,title,desc,action){
    return `<button class="card action-card" onclick="${action}" style="border:1px solid var(--border);text-align:left;color:inherit"><div class="action-icon">${icon}</div><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div></button>`;
}

function renderRemittance(parsed=null){
    const s=APP.session||{};
    const countries=APP.config?.countries||[];
    const destinations=countries.map(c=>{
        const code=esc(c.code||"");
        const name=typeof c.name==="object"?(c.name[APP.lang]||c.name.es||c.name.en||c.code):c.name;
        const selected=String(s.destination_country||parsed?.destination_country||"").toUpperCase()===String(c.code||"").toUpperCase();
        return `<option value="${code}" ${selected?"selected":""}>${esc(name||code)}</option>`;
    }).join("");
    const amount=s.amount??parsed?.amount??"";
    const priority=s.priority||parsed?.priority||"";
    const urgency=s.urgency??parsed?.urgency??false;
    const frequency=s.frequency||parsed?.frequency||"one_time";
    const delivery=s.delivery_method||parsed?.delivery_method||"";
    const payment=s.payment_method||parsed?.payment_method||"";
    render(`
<section class="section">
<div class="section-title"><div><h2>${esc(t("Preparar una remesa","Prepare a remittance"))}</h2><p>${esc(t("Solo pedimos lo necesario para revisar opciones.","We only ask for what is needed to review options."))}</p></div></div>
<div class="card form-card">
<div class="notice info">${esc(t("REMESAS no mueve tu dinero. Antes de enviar una transacción, siempre debes revisar las condiciones actuales directamente con el proveedor oficial.","REMESAS does not move your money. Before sending a transaction, always review current conditions directly with the official provider."))}</div>
<div class="form-row">
<div class="field"><label for="remAmount">${esc(t("¿Cuánto quieres enviar?","How much do you want to send?"))}</label><input id="remAmount" type="number" min=".01" max="1000000" step=".01" value="${esc(amount)}" placeholder="100"></div>
<div class="field"><label for="remCountry">${esc(t("¿A qué país?","Which country?"))}</label><select id="remCountry"><option value="">${esc(t("Selecciona","Select"))}</option>${destinations}</select></div>
</div>
<div class="field"><label>${esc(t("¿Qué te importa más?","What matters most?"))}</label><div class="choice-grid">
${choice("priority","save",t("Ahorrar / menor costo","Save / lower cost"),priority)}
${choice("priority","fastest",t("Rapidez","Speed"),priority)}
${choice("priority","recipient_gets_more",t("Más para quien recibe","More for recipient"),priority)}
${choice("priority","balanced",t("Equilibrio","Balance"),priority)}
</div></div>
<div class="check-row"><input id="remUrgency" type="checkbox" ${urgency?"checked":""}><label for="remUrgency">${esc(t("Es urgente o necesitas hacerlo hoy","It is urgent or you need it today"))}</label></div>
<div class="form-row">
<div class="field"><label for="remFrequency">${esc(t("Frecuencia","Frequency"))}</label><select id="remFrequency">
<option value="one_time" ${frequency==="one_time"?"selected":""}>${esc(t("Una vez","One time"))}</option>
<option value="weekly" ${frequency==="weekly"?"selected":""}>${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly" ${frequency==="biweekly"?"selected":""}>${esc(t("Quincenal","Biweekly"))}</option>
<option value="monthly" ${frequency==="monthly"?"selected":""}>${esc(t("Mensual","Monthly"))}</option>
</select></div>
<div class="field"><label for="remDelivery">${esc(t("Cómo recibe","How recipient receives"))}</label><input id="remDelivery" value="${esc(delivery)}" placeholder="${esc(t("Opcional","Optional"))}"></div>
</div>
<div class="field"><label for="remPayment">${esc(t("Cómo pagas","How you pay"))}</label><input id="remPayment" value="${esc(payment)}" placeholder="${esc(t("Opcional","Optional"))}"></div>
<div class="actions"><button class="btn" onclick="compareRemittance()">${esc(t("Revisar opciones","Review options"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div>
</div>
</section>`);
}

function choice(name,value,label,current){
    const id=`${name}_${value}`;
    return `<div class="choice"><input id="${esc(id)}" name="${esc(name)}" type="radio" value="${esc(value)}" ${current===value?"checked":""}><label for="${esc(id)}">${esc(label)}</label></div>`;
}

async function compareRemittance(){
    const amount=Number($("remAmount")?.value||0);
    const country=String($("remCountry")?.value||"").toUpperCase();
    if(!amount||amount<=0||amount>1000000)return toast(t("Introduce un monto válido.","Enter a valid amount."));
    if(!country)return toast(t("Selecciona el país.","Select the country."));
    if(!APP.session)await startSession();
    const priority=document.querySelector('input[name="priority"]:checked')?.value||null;
    const payload={session_id:APP.session.session_id,language:APP.lang,need_type:"remittance",amount,destination_country:country,priority,urgency:Boolean($("remUrgency")?.checked),frequency:$("remFrequency")?.value||null,delivery_method:$("remDelivery")?.value.trim()||null,payment_method:$("remPayment")?.value.trim()||null};
    try{
        render(loading(t("Preparando la revisión...","Preparing the review...")));
        const need=await api("/api/need",{method:"POST",body:JSON.stringify(payload)});
        APP.session=need.session||APP.session;
        const result=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/compare`,{method:"POST"});
        APP.comparison=result;
        renderComparison(result);
    }catch(e){
        render(`<section class="section">${errorBox(e.message)}<div class="actions"><button class="btn" onclick="renderRemittance()">${esc(t("Intentar de nuevo","Try again"))}</button></div></section>`);
    }
}

function renderComparison(data){
    const options=data.available_providers||[];
    const results=data.results||[];
    const verified=new Map(results.map(x=>[x.provider_id,x]));
    APP.comparison=data;
    const cards=options.length?options.map(p=>providerCard(p,verified.get(p.provider_id))).join(""):`<div class="empty">${esc(t("No hay proveedores candidatos en el catálogo actual para este destino.","There are no candidate providers in the current catalog for this destination."))}</div>`;
    render(`
<section class="section">
<div class="section-title"><div><h2>${esc(t("Opciones para tu remesa","Options for your remittance"))}</h2><p>${esc(data.destination_name||data.destination_country||"")}</p></div></div>
${data.explanation?`<div class="notice info">${esc(data.explanation)}</div>`:""}
${!data.results_available?`<div class="notice warning" style="margin-top:12px">${esc(t("No hay tarifas, tasas, tiempos o disponibilidad actuales verificadas por REMESAS. Por eso no se presenta ningún proveedor como más barato, más rápido o mejor. Revisa cada opción en su sitio oficial.","REMESAS has no currently verified fees, rates, delivery times, or availability. Therefore no provider is presented as cheaper, faster, or better. Review each option on its official site."))}</div>`:""}
<div class="result-list" style="margin-top:14px">${cards}</div>
${data.precautions?.length?`<div class="card" style="margin-top:14px"><h3>${esc(t("Antes de continuar","Before continuing"))}</h3><ul class="list">${data.precautions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
<div class="actions"><button class="btn secondary" onclick="renderRemittance()">${esc(t("Cambiar datos","Change details"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div>
</section>`);
}

function providerCard(p,result){
    const verified=Boolean(result);
    const commercial=[];
    if(verified){
        if(result.fee!=null)commercial.push(`<div class="metric"><span>${esc(t("Tarifa verificada","Verified fee"))}</span><strong>${money(result.fee)}</strong></div>`);
        if(result.exchange_rate!=null)commercial.push(`<div class="metric"><span>${esc(t("Tasa verificada","Verified rate"))}</span><strong>${esc(result.exchange_rate)}</strong></div>`);
        if(result.recipient_amount!=null)commercial.push(`<div class="metric"><span>${esc(t("Recibe","Recipient gets"))}</span><strong>${money(result.recipient_amount,result.recipient_currency||"USD")}</strong></div>`);
        if(result.estimated_delivery!=null)commercial.push(`<div class="metric"><span>${esc(t("Entrega","Delivery"))}</span><strong>${esc(result.estimated_delivery)}</strong></div>`);
        if(result.availability!=null)commercial.push(`<div class="metric"><span>${esc(t("Disponibilidad","Availability"))}</span><strong>${result.availability?esc(t("Disponible","Available")):esc(t("No disponible","Unavailable"))}</strong></div>`);
    }
    const methods=p.delivery_methods?.length?p.delivery_methods.map(x=>esc(typeof x==="object"?(x.name||x.id||JSON.stringify(x)):x)).join(", "):t("No especificados","Not specified");
    const providerId=JSON.stringify(String(p.provider_id||""));
    const official=p.continue_url?`<button class="btn secondary" onclick="openOfficial(${JSON.stringify(String(p.continue_url))})">${esc(t("Sitio oficial","Official site"))}</button>`:"";
    return `<article class="provider-card">
<div class="provider-head"><div><h3>${esc(p.provider_name||"")}</h3><p>${esc(t("Proveedor del catálogo oficial","Official catalog provider"))}</p></div><span class="provider-status ${verified?"verified":""}">${verified?esc(t("Datos verificados","Verified data")):esc(t("Revisar sitio oficial","Review official site"))}</span></div>
${commercial.length?`<div class="provider-data">${commercial.join("")}</div>`:`<div class="notice warning" style="margin-top:13px">${esc(t("No hay datos comerciales actuales verificados para mostrar aquí.","There is no currently verified commercial data to display here."))}</div>`}
<div class="notice" style="margin-top:12px"><strong>${esc(t("Métodos declarados","Declared methods"))}:</strong> ${methods}<br><small>${esc(t("Estos métodos requieren confirmación en el sitio oficial y no representan disponibilidad actual.","These methods require confirmation on the official site and do not represent current availability."))}</small></div>
<div class="actions"><button class="btn" onclick="selectProvider(${providerId})">${esc(t("Revisar esta opción","Review this option"))}</button>${official}</div>
</article>`;
}

async function selectProvider(providerId){
    if(!APP.session?.session_id)return toast(t("La sesión no está disponible.","The session is unavailable."));
    try{
        const data=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/select/${encodeURIComponent(providerId)}`,{method:"POST"});
        APP.session=data.session||APP.session;
        renderSelectedProvider(data.selected_option||APP.session.selected_option);
    }catch(e){toast(e.message)}
}

function renderSelectedProvider(option){
    const name=option?.provider_name||"";
    render(`
<section class="section">
<div class="card form-card">
<div class="section-title"><div><h2>${esc(t("Has elegido revisar esta opción","You chose to review this option"))}</h2><p>${esc(name)}</p></div></div>
<div class="notice warning">${esc(t("Elegir una opción aquí no inicia una transferencia. REMESAS no procesa el dinero.","Selecting an option here does not start a transfer. REMESAS does not process the money."))}</div>
<div class="actions">
<button class="btn" onclick="finalCheck()">${esc(t("Hacer revisión final","Run final check"))}</button>
${option?.continue_url?`<button class="btn secondary" onclick="openOfficial(${JSON.stringify(String(option.continue_url))})">${esc(t("Abrir sitio oficial","Open official site"))}</button>`:""}
<button class="btn secondary" onclick="renderComparison(APP.comparison||{})">${esc(t("Volver a opciones","Back to options"))}</button>
</div>
</div>
</section>`);
}

async function finalCheck(){
    if(!APP.session?.session_id)return toast(t("La sesión no está disponible.","The session is unavailable."));
    render(loading(t("Revisando datos básicos...","Checking basic details...")));
    try{
        const data=await api(`/api/session/${encodeURIComponent(APP.session.session_id)}/final-check`,{method:"POST"});
        APP.session.final_check=data;
        renderFinalResult(data,APP.session.selected_option);
    }catch(e){
        render(`<section class="section">${errorBox(e.message)}<div class="actions"><button class="btn" onclick="renderHome()">${esc(t("Inicio","Home"))}</button></div></section>`);
    }
}

function renderFinalResult(data,option){
    const checks=(data.checks||[]).map(c=>`<div class="notice ${c.ok?"success":"danger"}" style="margin-bottom:8px"><strong>${esc(c.label)}</strong><br>${esc(c.message)}</div>`).join("");
    render(`
<section class="section">
<div class="card form-card">
<div class="section-title"><div><h2>${esc(t("Revisión final","Final review"))}</h2><p>${esc(option?.provider_name||"")}</p></div></div>
${checks}
<div class="notice info">${esc(data.message||"")}</div>
<div class="card" style="margin-top:14px;box-shadow:none"><strong>${esc(t("Recuerda antes de enviar","Before submitting"))}</strong><ul class="list">
<li>${esc(t("Confirma la tarifa final y la tasa de cambio en el sitio oficial.","Confirm the final fee and exchange rate on the official site."))}</li>
<li>${esc(t("Confirma disponibilidad y tiempo de entrega actuales.","Confirm current availability and delivery timing."))}</li>
<li>${esc(t("Revisa cuidadosamente los datos del destinatario.","Carefully review recipient information."))}</li>
<li>${esc(t("Nunca introduzcas contraseñas, CVV o credenciales bancarias en REMESAS.","Never enter passwords, CVV, or bank credentials into REMESAS."))}</li>
</ul></div>
<div class="actions">
${option?.continue_url?`<button class="btn" onclick="openOfficial(${JSON.stringify(String(option.continue_url))})">${esc(t("Continuar al sitio oficial","Continue to official site"))}</button>`:""}
<button class="btn secondary" onclick="renderHome()">${esc(t("Terminar","Finish"))}</button>
</div>
</div>
</section>`);
}

function openOfficial(url){
    if(!url||!/^https:\/\//i.test(String(url)))return toast(t("Enlace oficial no disponible.","Official link unavailable."));
    window.open(String(url),"_blank","noopener,noreferrer");
}

async function changeLanguage(){
    APP.lang=APP.lang==="es"?"en":"es";
    localStorage.setItem(APP.keys.lang,APP.lang);
    localStorage.setItem("remesas_lang",APP.lang);
    try{await loadConfig()}catch{}
    if(APP.session?.session_id){
        try{
            const data=await api("/api/need",{method:"POST",body:JSON.stringify({session_id:APP.session.session_id,language:APP.lang})});
            APP.session=data.session||APP.session;
        }catch{}
    }
    renderHome();
}

function renderMoney(){
    const data=getJSON(APP.keys.money,{});
    render(`
<section class="section">
<div class="section-title"><div><h2>${esc(t("Mi dinero","My money"))}</h2><p>${esc(t("Calcula una referencia con tus propios datos.","Calculate a reference using your own data."))}</p></div></div>
<div class="card form-card">
<div class="form-row">
<div class="field"><label>${esc(t("Ingreso principal","Main income"))}</label><input id="income" type="number" min="0" max="1000000" step=".01" value="${esc(data.income??"")}"></div>
<div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="incomeFreq">
<option value="monthly" ${data.frequency==="monthly"?"selected":""}>${esc(t("Mensual","Monthly"))}</option>
<option value="weekly" ${data.frequency==="weekly"?"selected":""}>${esc(t("Semanal","Weekly"))}</option>
<option value="biweekly" ${data.frequency==="biweekly"?"selected":""}>${esc(t("Quincenal","Biweekly"))}</option>
</select></div>
</div>
<div class="form-row">
<div class="field"><label>${esc(t("Otros ingresos mensuales","Other monthly income"))}</label><input id="otherIncome" type="number" min="0" max="1000000" step=".01" value="${esc(data.otherIncome??"")}"></div>
<div class="field"><label>${esc(t("Remesa mensual","Monthly remittance"))}</label><input id="moneyRemittance" type="number" min="0" max="1000000" step=".01" value="${esc(data.remittance??"")}"></div>
</div>
<div class="form-row">
<div class="field"><label>${esc(t("Gastos esenciales mensuales","Monthly essential expenses"))}</label><input id="essential" type="number" min="0" max="1000000" step=".01" value="${esc(data.essential??"")}"></div>
<div class="field"><label>${esc(t("Gastos flexibles mensuales","Monthly flexible expenses"))}</label><input id="flexible" type="number" min="0" max="1000000" step=".01" value="${esc(data.flexible??"")}"></div>
</div>
<div class="field"><label>${esc(t("Ahorro mensual","Monthly savings"))}</label><input id="moneySavings" type="number" min="0" max="1000000" step=".01" value="${esc(data.savings??"")}"></div>
<div class="actions"><button class="btn" onclick="calculateMoney()">${esc(t("Calcular","Calculate"))}</button><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div>
<div id="moneyResult"></div>
</div>
</section>`);
}

function frequencyFactor(freq){
    if(freq==="weekly")return 52/12;
    if(freq==="biweekly")return 26/12;
    return 1;
}

function calculateMoney(){
    const data={income:Number($("income")?.value||0),frequency:$("incomeFreq")?.value||"monthly",otherIncome:Number($("otherIncome")?.value||0),remittance:Number($("moneyRemittance")?.value||0),essential:Number($("essential")?.value||0),flexible:Number($("flexible")?.value||0),savings:Number($("moneySavings")?.value||0)};
    setJSON(APP.keys.money,data);
    const monthlyIncome=data.income*frequencyFactor(data.frequency)+data.otherIncome;
    const available=monthlyIncome-data.essential-data.flexible-data.remittance-data.savings;
    $("moneyResult").innerHTML=`<div class="balance-grid" style="margin-top:15px"><div class="balance"><span>${esc(t("Ingreso mensual estimado","Estimated monthly income"))}</span><strong>${money(monthlyIncome)}</strong></div><div class="balance ${available>=0?"positive":"negative"}"><span>${esc(t("Disponible","Available"))}</span><strong>${money(available)}</strong></div></div><div class="notice ${available>=0?"success":"warning"}" style="margin-top:12px">${esc(available>=0?t("Según los datos introducidos, el cálculo queda positivo. Esto es una referencia, no asesoría financiera.","Based on the entered data, the calculation is positive. This is a reference, not financial advice."):t("Según los datos introducidos, el cálculo queda negativo. Revisa los montos antes de decidir una remesa o compra.","Based on the entered data, the calculation is negative. Review the amounts before deciding on a remittance or purchase."))}</div>`;
}

function calculateLocalAvailable(){
    const d=getJSON(APP.keys.money,{});
    const income=Number(d.income||0)*frequencyFactor(d.frequency||"monthly")+Number(d.otherIncome||0);
    const expenses=getJSON(APP.keys.expenses,[]);
    const expenseTotal=expenses.reduce((a,x)=>a+Number(x.amount||0)*frequencyFactor(x.frequency||"monthly"),0);
    return income-expenseTotal-Number(d.remittance||0)-Number(d.savings||0);
}

function renderWeek(){
    const d=getJSON(APP.keys.money,{});
    const monthly=Number(d.income||0)*frequencyFactor(d.frequency||"monthly")+Number(d.otherIncome||0);
    const weekly=monthly*12/52;
    render(`<section class="section"><div class="card form-card"><div class="section-title"><h2>${esc(t("Mi semana","My week"))}</h2></div><div class="balance-grid"><div class="balance"><span>${esc(t("Ingreso mensual estimado","Estimated monthly income"))}</span><strong>${money(monthly)}</strong></div><div class="balance positive"><span>${esc(t("Referencia semanal","Weekly reference"))}</span><strong>${money(weekly)}</strong></div></div><div class="notice info" style="margin-top:14px">${esc(t("Es una conversión matemática para ayudarte a organizarte; no es una recomendación financiera.","This is a mathematical conversion to help you organize; it is not financial advice."))}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}

function renderExpenses(){
    const expenses=getJSON(APP.keys.expenses,[]);
    const list=expenses.length?expenses.map((x,i)=>`<div class="notice" style="margin-bottom:8px"><strong>${esc(x.description)}</strong> · ${money(x.amount)}<br><small>${esc(x.category||"")} · ${esc(x.frequency||"monthly")}</small><button class="btn danger small" style="float:right" onclick="deleteExpense(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<div class="empty">${esc(t("Todavía no hay gastos registrados.","No expenses have been recorded yet."))}</div>`;
    render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Mis gastos","My expenses"))}</h2><p>${esc(t("Los registros permanecen en este dispositivo.","Records remain on this device."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Descripción","Description"))}</label><input id="expDesc" maxlength="120"></div><div class="field"><label>${esc(t("Monto","Amount"))}</label><input id="expAmount" type="number" min=".01" max="1000000" step=".01"></div></div><div class="form-row"><div class="field"><label>${esc(t("Categoría","Category"))}</label><input id="expCat" maxlength="60"></div><div class="field"><label>${esc(t("Frecuencia","Frequency"))}</label><select id="expFreq"><option value="monthly">${esc(t("Mensual","Monthly"))}</option><option value="weekly">${esc(t("Semanal","Weekly"))}</option><option value="biweekly">${esc(t("Quincenal","Biweekly"))}</option></select></div></div><button class="btn" onclick="addExpense()">${esc(t("Guardar gasto local","Save local expense"))}</button><div style="margin-top:15px">${list}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}

function addExpense(){
    const description=$("expDesc")?.value.trim(),amount=Number($("expAmount")?.value||0);
    if(!description||!amount||amount<=0||amount>1000000)return toast(t("Introduce descripción y monto válidos.","Enter a valid description and amount."));
    const expenses=getJSON(APP.keys.expenses,[]);
    expenses.push({description,amount,category:$("expCat")?.value.trim()||"",frequency:$("expFreq")?.value||"monthly",created_at:new Date().toISOString()});
    setJSON(APP.keys.expenses,expenses);
    renderExpenses();
}

function deleteExpense(i){
    const expenses=getJSON(APP.keys.expenses,[]);
    expenses.splice(i,1);
    setJSON(APP.keys.expenses,expenses);
    renderExpenses();
}

function renderFamily(){
    const family=getJSON(APP.keys.family,[]);
    const list=family.length?family.map((x,i)=>`<div class="notice" style="margin-bottom:8px"><strong>${esc(x.name)}</strong> · ${esc(x.country||"")} · ${money(x.amount||0)}<button class="btn danger small" style="float:right" onclick="deleteFamily(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<div class="empty">${esc(t("No hay referencias familiares guardadas.","No family references saved."))}</div>`;
    render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Familia","Family"))}</h2><p>${esc(t("Referencias guardadas solo en este dispositivo.","References saved only on this device."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Nombre o apodo","Name or nickname"))}</label><input id="famName" maxlength="80"></div><div class="field"><label>${esc(t("País","Country"))}</label><input id="famCountry" maxlength="60"></div></div><div class="field"><label>${esc(t("Monto habitual","Usual amount"))}</label><input id="famAmount" type="number" min="0" max="1000000" step=".01"></div><button class="btn" onclick="addFamily()">${esc(t("Guardar referencia","Save reference"))}</button><div style="margin-top:15px">${list}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}

function addFamily(){
    const name=$("famName")?.value.trim(),country=$("famCountry")?.value.trim(),amount=Number($("famAmount")?.value||0);
    if(!name)return toast(t("Introduce un nombre o apodo.","Enter a name or nickname."));
    if(amount<0||amount>1000000)return toast(t("Monto inválido.","Invalid amount."));
    const family=getJSON(APP.keys.family,[]);
    family.push({name,country,amount,created_at:new Date().toISOString()});
    setJSON(APP.keys.family,family);
    renderFamily();
}

function deleteFamily(i){
    const family=getJSON(APP.keys.family,[]);
    family.splice(i,1);
    setJSON(APP.keys.family,family);
    renderFamily();
}

function renderSavings(){
    const savings=getJSON(APP.keys.savings,[]);
    const list=savings.length?savings.map((x,i)=>`<div class="notice" style="margin-bottom:8px"><strong>${money(x.amount)}</strong> · ${esc(x.type||"general")}<button class="btn danger small" style="float:right" onclick="deleteSavings(${i})">${esc(t("Borrar","Delete"))}</button></div>`).join(""):`<div class="empty">${esc(t("No hay registros de ahorro.","No savings records."))}</div>`;
    render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Ahorro","Savings"))}</h2><p>${esc(t("Registra una cantidad y su objetivo localmente.","Record an amount and its goal locally."))}</p></div></div><div class="card form-card"><div class="form-row"><div class="field"><label>${esc(t("Cantidad","Amount"))}</label><input id="savAmount" type="number" min="0" max="1000000" step=".01"></div><div class="field"><label>${esc(t("Objetivo","Goal"))}</label><input id="savType" maxlength="60" placeholder="${esc(t("Ej. emergencia","E.g. emergency"))}"></div></div><button class="btn" onclick="addSavings()">${esc(t("Guardar ahorro","Save savings"))}</button><div style="margin-top:15px">${list}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}

function addSavings(){
    const amount=Number($("savAmount")?.value||0);
    if(!Number.isFinite(amount)||amount<=0||amount>1000000)return toast(t("Cantidad inválida.","Invalid amount."));
    const savings=getJSON(APP.keys.savings,[]);
    savings.push({amount,type:$("savType")?.value.trim()||"general",created_at:new Date().toISOString()});
    setJSON(APP.keys.savings,savings);
    renderSavings();
}

function deleteSavings(i){
    const savings=getJSON(APP.keys.savings,[]);
    savings.splice(i,1);
    setJSON(APP.keys.savings,savings);
    renderSavings();
}

function renderPurchase(){
    const available=calculateLocalAvailable();
    render(`<section class="section"><div class="card form-card"><div class="section-title"><div><h2>${esc(t("Quiero comprar","I want to buy"))}</h2><p>${esc(t("Comprueba el efecto matemático de una compra sobre tu cálculo local.","Check the mathematical effect of a purchase on your local calculation."))}</p></div></div><div class="notice info">${esc(t("Disponible calculado actualmente:","Currently calculated available:"))} <strong>${money(available)}</strong></div><div class="form-row" style="margin-top:14px"><div class="field"><label>${esc(t("Precio","Price"))}</label><input id="purchaseAmount" type="number" min=".01" max="1000000" step=".01"></div><div class="field"><label>${esc(t("Categoría","Category"))}</label><input id="purchaseCat" maxlength="60"></div></div><button class="btn" onclick="calculatePurchase()">${esc(t("Comprobar","Check"))}</button><div id="purchaseResult"></div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}

function calculatePurchase(){
    const amount=Number($("purchaseAmount")?.value||0);
    if(!amount||amount<=0||amount>1000000)return toast(t("Introduce un precio válido.","Enter a valid price."));
    const after=calculateLocalAvailable()-amount;
    $("purchaseResult").innerHTML=`<div class="balance ${after>=0?"positive":"negative"}" style="margin-top:14px"><span>${esc(t("Disponible después de la compra","Available after purchase"))}</span><strong>${money(after)}</strong></div><div class="notice ${after>=0?"success":"warning"}" style="margin-top:10px">${esc(after>=0?t("El cálculo sigue siendo positivo con los datos introducidos.","The calculation remains positive with the entered data."):t("El cálculo queda negativo con los datos introducidos; revisa tus números antes de tomar una decisión.","The calculation becomes negative with the entered data; review your numbers before making a decision."))}</div>`;
}

function renderHelp(){
    const topics=APP.config?.help_topics||[];
    const topicList=topics.length?topics.map(x=>`<button class="card action-card" style="width:100%;margin-bottom:9px;min-height:auto;text-align:left" onclick="showHelpTopic(${JSON.stringify(String(x.id))})"><h3>${esc(x.title)}</h3><p>${esc(t("Ver explicación","View explanation"))}</p></button>`).join(""):`<div class="empty">${esc(t("No hay temas de ayuda configurados.","No help topics are configured."))}</div>`;
    render(`<section class="section"><div class="section-title"><div><h2>${esc(t("Ayuda","Help"))}</h2><p>${esc(t("También puedes escribir tu situación con tus propias palabras.","You can also describe your situation in your own words."))}</p></div></div><div class="card form-card"><div class="assistant"><textarea id="assistantText" maxlength="2000" placeholder="${esc(t("Ej.: quiero enviar $200 a México esta semana...","E.g.: I want to send $200 to Mexico this week..."))}"></textarea><button class="btn" onclick="askAssistant()">${esc(t("Ayúdame","Help me"))}</button><div id="assistantResult"></div></div><div style="margin-top:18px">${topicList}</div><div class="actions"><button class="btn secondary" onclick="renderHome()">${esc(t("Volver","Back"))}</button></div></div></section>`);
}

async function askAssistant(){
    const text=$("assistantText")?.value.trim();
    if(!text)return toast(t("Escribe lo que necesitas.","Describe what you need."));
    $("assistantResult").innerHTML=loading(t("Revisando tu mensaje...","Reviewing your message..."));
    try{
        const data=await api("/api/assistant",{method:"POST",body:JSON.stringify({text,language:APP.lang})});
        APP.pendingParsed=data.parsed||{};
        const canRemit=data.parsed?.need_type==="remittance";
        $("assistantResult").innerHTML=`<div class="assistant-box" style="margin-top:12px"><strong>${esc(t("Respuesta","Response"))}</strong><div>${esc(data.assistant||"")}</div>${canRemit?`<div class="actions"><button class="btn" onclick="beginParsedRemittance()">${esc(t("Preparar esta remesa","Prepare this remittance"))}</button></div>`:""}</div>`;
    }catch(e){$("assistantResult").innerHTML=errorBox(e.message)}
}

function beginParsedRemittance(){
    const p=APP.pendingParsed||{};
    if(!APP.session){
        startSession().then(()=>renderRemittance(p)).catch(()=>renderRemittance(p));
    }else renderRemittance(p);
}

function showHelpTopic(id){
    const topic=(APP.config?.help_topics||[]).find(x=>String(x.id)===String(id));
    if(!topic)return;
    const modal=document.createElement("div");
    modal.className="modal-backdrop";
    modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>${esc(topic.title)}</h2><button class="close" onclick="this.closest('.modal-backdrop').remove()">×</button></div><div class="notice info" style="margin-top:15px">${esc(topic.answer)}</div><div class="actions"><button class="btn" onclick="this.closest('.modal-backdrop').remove()">${esc(t("Cerrar","Close"))}</button></div></div>`;
    document.body.appendChild(modal);
}

async function deleteLocalData(){
    const ok=confirm(t("Esto borrará los registros locales de REMESAS de este dispositivo. ¿Continuar?","This will delete REMESAS local records from this device. Continue?"));
    if(!ok)return;
    Object.values(APP.keys).forEach(k=>localStorage.removeItem(k));
    localStorage.removeItem("remesas_lang");
    if(APP.session?.session_id){
        try{await api(`/api/session/${encodeURIComponent(APP.session.session_id)}`,{method:"DELETE"})}catch{}
    }
    APP.session=null;
    APP.comparison=null;
    APP.pendingParsed=null;
    toast(t("Datos locales borrados.","Local data deleted."));
    setTimeout(()=>location.reload(),500);
}

async function boot(){
    try{
        await loadConfig();
        await startSession();
        renderHome();
    }catch(e){
        const app=$("app");
        if(app)app.innerHTML=`<div class="app-shell"><section class="section"><div class="card">${errorBox(t("No se pudo cargar REMESAS. Revisa que el servidor y los archivos JSON estén disponibles y sean válidos.","REMESAS could not be loaded. Check that the server and JSON files are available and valid."))}<div class="legal" style="margin-top:10px">${esc(e.message)}</div><div class="actions"><button class="btn" onclick="location.reload()">${esc(t("Intentar nuevamente","Try again"))}</button></div></div></section></div>`;
    }
}

document.addEventListener("DOMContentLoaded",boot);

window.renderHome=renderHome;
window.renderRemittance=renderRemittance;
window.compareRemittance=compareRemittance;
window.selectProvider=selectProvider;
window.finalCheck=finalCheck;
window.openOfficial=openOfficial;
window.changeLanguage=changeLanguage;
window.renderMoney=renderMoney;
window.calculateMoney=calculateMoney;
window.renderWeek=renderWeek;
window.renderExpenses=renderExpenses;
window.addExpense=addExpense;
window.deleteExpense=deleteExpense;
window.renderFamily=renderFamily;
window.addFamily=addFamily;
window.deleteFamily=deleteFamily;
window.renderSavings=renderSavings;
window.addSavings=addSavings;
window.deleteSavings=deleteSavings;
window.renderPurchase=renderPurchase;
window.calculatePurchase=calculatePurchase;
window.renderHelp=renderHelp;
window.askAssistant=askAssistant;
window.beginParsedRemittance=beginParsedRemittance;
window.showHelpTopic=showHelpTopic;
window.deleteLocalData=deleteLocalData;
