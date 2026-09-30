/* static/app.js — REMESAS | May Roga LLC | 4.1.0 */
"use strict";

const APP_VERSION="4.1.0";
const LS="remesas_";
let lang=localStorage.getItem(LS+"language")||"es";
let config=null;
let session=null;
let currentView="home";
let selectedProvider=null;
let busy=false;

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const t=(es,en)=>lang==="en"?en:es;
const money=(v,c="USD")=>v==null?"—":`${Number(v).toLocaleString(lang==="es"?"es-US":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`;
const save=(k,v)=>localStorage.setItem(LS+k,JSON.stringify(v));
const load=(k,d=null)=>{try{const v=localStorage.getItem(LS+k);return v===null?d:JSON.parse(v)}catch{return d}};
const del=k=>localStorage.removeItem(LS+k);

async function api(url,opt={}){
    const o={...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}};
    const r=await fetch(url,o);
    let d={};
    try{d=await r.json()}catch{}
    if(!r.ok)throw new Error(d.detail||d.error||d.message||t("No se pudo completar la operación.","The operation could not be completed."));
    return d;
}

function text(id,es,en){
    const e=$(id);
    if(e)e.textContent=t(es,en);
}

function injectCSS(){
    if($("remesas-runtime-css"))return;
    const s=document.createElement("style");
    s.id="remesas-runtime-css";
    s.textContent=`
    :root{--bg:#07111f;--card:#0d1b2d;--card2:#12243a;--line:#263b55;--text:#f4f7fb;--muted:#aab8c8;--accent:#49a7ff;--ok:#51d88a;--warn:#ffd166;--danger:#ff7777}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Arial,sans-serif}
    button,input,select,textarea{font:inherit}button{cursor:pointer}
    .rm-wrap{max-width:760px;margin:auto;padding:16px}.rm-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px}
    .rm-brand{font-weight:800;font-size:22px}.rm-brand small{display:block;color:var(--muted);font-size:10px;font-weight:500}
    .rm-lang,.rm-back,.rm-ghost{background:transparent;color:var(--text);border:1px solid var(--line);border-radius:12px;padding:9px 12px}
    .rm-hero{background:linear-gradient(145deg,#0d2035,#0b1727);border:1px solid var(--line);border-radius:22px;padding:22px;margin-bottom:14px}
    .rm-hero h1{margin:0 0 8px;font-size:28px}.rm-hero p{margin:0;color:var(--muted);line-height:1.5}
    .rm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.rm-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}
    .rm-card button,.rm-mainbtn{width:100%;border:0;border-radius:14px;padding:14px;background:var(--accent);color:#00111f;font-weight:800}
    .rm-card h3{margin:0 0 6px}.rm-card p{margin:0 0 12px;color:var(--muted);font-size:13px;line-height:1.45}
    .rm-icon{font-size:25px;margin-bottom:8px}.rm-section{margin:14px 0}.rm-section h2{font-size:19px;margin:0 0 10px}
    .rm-form{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}.rm-form label{display:block;margin:12px 0 6px;font-weight:700;font-size:13px}
    .rm-form input,.rm-form select,.rm-form textarea{width:100%;background:#071321;color:var(--text);border:1px solid var(--line);border-radius:12px;padding:12px;outline:none}
    .rm-form input:focus,.rm-form select:focus,.rm-form textarea:focus{border-color:var(--accent)}
    .rm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rm-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rm-option{background:var(--card2);color:var(--text);border:1px solid var(--line);border-radius:13px;padding:12px;text-align:left}
    .rm-option.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}.rm-option small{display:block;color:var(--muted);margin-top:4px}
    .rm-result{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:10px 0}
    .rm-result-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.rm-result h3{margin:0}
    .rm-badge{font-size:11px;padding:5px 8px;border-radius:20px;background:#17314b;color:#b9dcff}.rm-ok{color:var(--ok)}.rm-muted{color:var(--muted)}
    .rm-note{background:#13253a;border-left:3px solid var(--accent);padding:12px;border-radius:10px;color:#d7e4f1;font-size:13px;line-height:1.45}
    .rm-actions{display:flex;gap:8px;margin-top:12px}.rm-actions>*{flex:1}.rm-link{display:block;text-align:center;text-decoration:none}
    .rm-empty{text-align:center;padding:28px 16px;color:var(--muted);background:var(--card);border:1px dashed var(--line);border-radius:18px}
    .rm-table{width:100%;border-collapse:collapse;font-size:13px}.rm-table td{padding:9px 4px;border-bottom:1px solid var(--line)}.rm-table td:last-child{text-align:right;font-weight:700}
    .rm-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#102238;border:1px solid var(--line);padding:11px 15px;border-radius:14px;z-index:9999;max-width:90%;box-shadow:0 8px 30px #0008}
    .rm-footer{margin:24px 0 8px;text-align:center;color:var(--muted);font-size:11px;line-height:1.5}
    .rm-loader{text-align:center;padding:70px 20px;color:var(--muted)}.rm-danger{color:var(--danger)}.rm-success{color:var(--ok)}
    @media(max-width:520px){.rm-grid,.rm-options,.rm-row{grid-template-columns:1fr}.rm-wrap{padding:12px}.rm-hero h1{font-size:24px}}
    `;
    document.head.appendChild(s);
}

function toast(msg){
    const old=$("rm-toast");if(old)old.remove();
    const e=document.createElement("div");e.id="rm-toast";e.className="rm-toast";e.textContent=msg;
    document.body.appendChild(e);setTimeout(()=>e.remove(),3200);
}

function shell(content){
    const app=$("app");
    if(!app)return;
    app.innerHTML=`
    <main class="rm-wrap">
      <header class="rm-top">
        <button class="rm-back" onclick="goHome()">←</button>
        <div class="rm-brand">REMESAS<small>May Roga LLC</small></div>
        <button class="rm-lang" onclick="toggleLanguage()">${lang==="es"?"English":"Español"}</button>
      </header>
      ${content}
      <footer class="rm-footer">
        REMESAS ${APP_VERSION} · ${t("Información privada de apoyo. No es banco, financiera, asesor financiero ni procesador de pagos.","Private information service. Not a bank, financial institution, financial advisor or payment processor.")}
      </footer>
    </main>`;
}

function home(){
    currentView="home";
    shell(`
    <section class="rm-hero">
      <h1>${esc(config?.opening?.title?.[lang]||t("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1>
      <p>${esc(config?.opening?.subtitle?.[lang]||t("Entiende tu necesidad, organiza tu dinero y continúa con información verificable.","Understand your need, organize your money and continue with verifiable information."))}</p>
    </section>
    <section class="rm-grid">
      ${homeCard("💸","Enviar dinero", "Send money","remittance")
      }${homeCard("💰","Mi dinero","My money","money")
      }${homeCard("📅","Mi semana","My week","week")
      }${homeCard("🧾","Mis gastos","My expenses","expenses")
      }${homeCard("👨‍👩‍👧","Familia","Family","family")
      }${homeCard("🏦","Ahorro","Savings","savings")
      }${homeCard("🛒","Compra","Purchase","purchase")
      }${homeCard("❓","Ayuda","Help","help")}
    </section>
    <section class="rm-section"><div class="rm-note">${esc(config?.messages?.local_only||t("Tus datos personales de dinero permanecen en este dispositivo.","Your personal money data stays on this device."))}</div></section>
    `);
}

function homeCard(icon,es,en,action){
    return `<article class="rm-card"><div class="rm-icon">${icon}</div><h3>${t(es,en)}</h3><p>${homeDescription(action)}</p><button onclick="openAction('${action}')">${t("Abrir","Open")}</button></article>`;
}

function homeDescription(a){
    const d={
        remittance:["Prepara un envío y revisa opciones oficiales.","Prepare a transfer and review official options."],
        money:["Organiza entradas, salidas y saldo en tu dispositivo.","Organize income, expenses and balance on your device."],
        week:["Mira el movimiento de tu semana.","Review your weekly money movement."],
        expenses:["Registra y entiende tus gastos.","Record and understand your expenses."],
        family:["Organiza necesidades relacionadas con tu familia.","Organize family-related money needs."],
        savings:["Define una meta y cuánto falta.","Set a savings goal and see what remains."],
        purchase:["Calcula si una compra cabe en tu dinero.","Check whether a purchase fits your money."],
        help:["Encuentra una respuesta antes de actuar.","Find an answer before taking action."]
    };
    return esc(t(d[a][0],d[a][1]));
}

function openAction(action){
    currentView=action;
    if(action==="remittance")return remittance();
    if(action==="money")return moneyView();
    if(action==="week")return weekView();
    if(action==="expenses")return expensesView();
    if(action==="family")return familyView();
    if(action==="savings")return savingsView();
    if(action==="purchase")return purchaseView();
    if(action==="help")return helpView();
}

function remittance(){
    if(!session)return startRemittance();
    remittanceForm();
}

async function startRemittance(){
    if(busy)return;
    busy=true;
    try{
        const d=await api(`/api/session?language=${lang}`,{method:"POST"});
        session=d.session;
        save("session_id",session.session_id);
        remittanceForm();
    }catch(e){toast(e.message)}
    finally{busy=false}
}

function remittanceForm(){
    const countries=config?.countries||[];
    const priorities=config?.opening?.priorities||[];
    const deliveries=config?.delivery_methods||[];
    const payments=config?.payment_methods||[];
    shell(`
    <section class="rm-hero"><h1>${t("Enviar dinero","Send money")}</h1><p>${t("Solo pregunta lo necesario para saber qué opciones tienen sentido para ti.","Only ask for what is needed to identify relevant options.")}</p></section>
    <section class="rm-form">
      <div class="rm-row">
        <div><label>${t("¿Cuánto quieres enviar?","How much do you want to send?")}</label><input id="rm-amount" type="number" min="1" step="0.01" value="${session?.amount||""}" placeholder="100"></div>
        <div><label>${t("Moneda","Currency")}</label><input id="rm-currency" value="${session?.send_currency||"USD"}" maxlength="3"></div>
      </div>
      <label>${t("¿A qué país?","Which country?")}</label>
      <select id="rm-country"><option value="">${t("Selecciona un país","Select a country")}</option>${countries.map(c=>`<option value="${esc(c.id)}" ${session?.destination_country===c.id?"selected":""}>${esc(c.name)}${c.currency?" — "+esc(c.currency):""}</option>`).join("")}</select>
      <label>${t("¿Qué te importa más?","What matters most?")}</label>
      <div class="rm-options">${priorities.map(p=>`<button class="rm-option ${session?.priority===p.id?"active":""}" onclick="pickPriority(this,'${esc(p.id)}')">${esc(p.icon||"•")} ${esc(p.label)}<small>${esc(p.why||"")}</small></button>`).join("")}</div>
      <input id="rm-priority" type="hidden" value="${esc(session?.priority||"")}">
      <label>${t("¿Cómo debe recibirlo?","How should the recipient receive it?")}</label>
      <select id="rm-delivery"><option value="">${t("Todavía no sé","Not sure yet")}</option>${deliveries.map(x=>`<option value="${esc(x.id)}" ${session?.delivery_method===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select>
      <label>${t("¿Cómo pagarás el envío?","How will you pay?")}</label>
      <select id="rm-payment"><option value="">${t("Todavía no sé","Not sure yet")}</option>${payments.map(x=>`<option value="${esc(x.id)}" ${session?.payment_method===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select>
      <label>${t("¿Algo más que debamos saber?","Anything else we should know?")}</label>
      <textarea id="rm-special" rows="3" maxlength="1000" placeholder="${t("Opcional","Optional")}">${esc(session?.special_need||"")}</textarea>
      <button class="rm-mainbtn" onclick="submitRemittance()">${t("Ver opciones","See options")}</button>
    </section>`);
}

function pickPriority(el,id){
    document.querySelectorAll(".rm-option").forEach(x=>x.classList.remove("active"));
    el.classList.add("active");
    $("rm-priority").value=id;
}

async function submitRemittance(){
    const amount=Number($("rm-amount")?.value);
    const country=$("rm-country")?.value;
    if(!amount||amount<=0)return toast(t("Indica un monto válido.","Enter a valid amount."));
    if(!country)return toast(t("Indica el país de destino.","Enter the destination country."));
    if(busy)return;
    busy=true;
    try{
        const body={
            session_id:session?.session_id,
            language:lang,
            amount,
            send_currency:($("rm-currency")?.value||"USD").toUpperCase(),
            destination_country:country,
            priority:$("rm-priority")?.value||null,
            delivery_method:$("rm-delivery")?.value||null,
            payment_method:$("rm-payment")?.value||null,
            special_need:$("rm-special")?.value.trim()||null,
            need_type:"remittance"
        };
        const d=await api("/api/need",{method:"POST",body:JSON.stringify(body)});
        session=d.session;
        save("session_id",session.session_id);
        const result=await api(`/api/session/${session.session_id}/compare`,{method:"POST"});
        renderComparison(result);
    }catch(e){toast(e.message)}
    finally{busy=false}
}

function renderComparison(data){
    const providers=data.available_providers||[];
    shell(`
    <section class="rm-hero">
      <h1>${t("Opciones para tu envío","Options for your transfer")}</h1>
      <p>${esc(data.destination_name||"")} · ${money(data.amount,data.send_currency)}</p>
    </section>
    <div class="rm-note">${esc(data.message||"")}<br><br>${esc(data.warning||t("Confirma los datos finales en el sitio oficial.","Confirm final details on the official site."))}</div>
    <section class="rm-section"><h2>${t("Proveedores disponibles","Available providers")}</h2>
      ${providers.length?providers.map(providerCard).join(""):`<div class="rm-empty">${t("No hay proveedores disponibles para este destino.","No providers are available for this destination.")}</div>`}
    </section>
    <button class="rm-ghost" style="width:100%" onclick="remittanceForm()">${t("Cambiar datos","Change details")}</button>`);
}

function providerCard(p){
    const verified=p.commercial_verified;
    return `<article class="rm-result">
      <div class="rm-result-head"><h3>${esc(p.provider_name)}</h3><span class="rm-badge">${verified?t("Datos verificados","Verified data"):t("Fuente oficial","Official source")}</span></div>
      <table class="rm-table">
        <tr><td>${t("Entrega","Delivery")}</td><td>${esc(methodLabel(p.delivery_methods))}</td></tr>
        <tr><td>${t("Pago","Payment")}</td><td>${esc(methodLabel(p.payment_methods))}</td></tr>
        <tr><td>${t("Tarifa actual","Current fee")}</td><td>${verified?esc(p.fee??"—"):t("Consultar","Check official site")}</td></tr>
        <tr><td>${t("Tiempo","Timing")}</td><td>${verified?esc(p.delivery_time??"—"):t("Consultar","Check official site")}</td></tr>
      </table>
      <div class="rm-actions">
        <button class="rm-mainbtn" onclick="selectProvider('${esc(p.provider_id)}')">${t("Revisar","Review")}</button>
        ${p.continue_url?`<a class="rm-ghost rm-link" target="_blank" rel="noopener noreferrer" href="${esc(p.continue_url)}">${t("Sitio oficial","Official site")}</a>`:""}
      </div>
    </article>`;
}

function methodLabel(v){
    if(!Array.isArray(v)||!v.length)return t("Consultar","Check");
    return v.map(x=>typeof x==="object"?(x.label?.[lang]||x.label||x.id):x).join(", ");
}

async function selectProvider(id){
    if(!session?.session_id)return;
    if(busy)return;
    busy=true;
    try{
        const d=await api(`/api/session/${session.session_id}/select/${encodeURIComponent(id)}`,{method:"POST"});
        session=d.session;selectedProvider=d.selected_option;
        const check=await api(`/api/session/${session.session_id}/final-check`,{method:"POST"});
        renderFinal(check);
    }catch(e){toast(e.message)}
    finally{busy=false}
}

function renderFinal(data){
    const checks=data.checks||[];
    const option=session?.selected_option||selectedProvider||{};
    shell(`
    <section class="rm-hero"><h1>${t("Revisión final","Final review")}</h1><p>${esc(option.provider_name||"")}</p></section>
    <section class="rm-result">
      <table class="rm-table">${checks.map(c=>`<tr><td>${esc(c.label)}</td><td class="${c.complete?"rm-success":"rm-danger"}">${esc(c.value||"—")} ${c.complete?"✓":"!"}</td></tr>`).join("")}</table>
    </section>
    <div class="rm-note">${esc(data.important_note||"")}</div>
    <div class="rm-actions">
      <button class="rm-mainbtn" onclick="continueOfficial()">${t("Continuar al sitio oficial","Continue to official site")}</button>
      <button class="rm-ghost" onclick="remittanceForm()">${t("Cambiar","Change")}</button>
    </div>
    `);
}

function continueOfficial(){
    const url=session?.selected_option?.continue_url||session?.selected_option?.official_site;
    if(!url)return toast(t("No existe un enlace oficial disponible.","No official link is available."));
    window.open(url,"_blank","noopener,noreferrer");
}

function getRecords(){
    return load("money_records",[]);
}
function setRecords(v){save("money_records",v)}

function moneyView(){
    const records=getRecords();
    const income=records.filter(x=>x.type==="income").reduce((a,x)=>a+Number(x.amount||0),0);
    const expenses=records.filter(x=>x.type==="expense").reduce((a,x)=>a+Number(x.amount||0),0);
    const savings=records.filter(x=>x.type==="saving").reduce((a,x)=>a+Number(x.amount||0),0);
    shell(`
    <section class="rm-hero"><h1>${t("Mi dinero","My money")}</h1><p>${t("Tus registros permanecen en este dispositivo.","Your records stay on this device.")}</p></section>
    <section class="rm-result"><table class="rm-table">
      <tr><td>${t("Entró","Income")}</td><td class="rm-success">${money(income)}</td></tr>
      <tr><td>${t("Salió","Expenses")}</td><td class="rm-danger">${money(expenses)}</td></tr>
      <tr><td>${t("Ahorro registrado","Savings")}</td><td>${money(savings)}</td></tr>
      <tr><td>${t("Disponible registrado","Recorded balance")}</td><td>${money(income-expenses-savings)}</td></tr>
    </table></section>
    <div class="rm-actions">
      <button class="rm-mainbtn" onclick="recordMoney('income')">${t("Registrar entrada","Record income")}</button>
      <button class="rm-mainbtn" onclick="recordMoney('expense')">${t("Registrar gasto","Record expense")}</button>
    </div>
    <button class="rm-ghost" style="width:100%;margin-top:8px" onclick="recordMoney('saving')">${t("Registrar ahorro","Record savings")}</button>
    `);
}

function recordMoney(type){
    const label=type==="income"?t("Entrada","Income"):type==="expense"?t("Gasto","Expense"):t("Ahorro","Savings");
    shell(`
    <section class="rm-hero"><h1>${label}</h1><p>${t("Guárdalo solamente en este dispositivo.","Save it only on this device.")}</p></section>
    <section class="rm-form">
      <label>${t("Monto","Amount")}</label><input id="rec-amount" type="number" min="0.01" step="0.01">
      <label>${t("Descripción","Description")}</label><input id="rec-note" maxlength="200" placeholder="${t("Ej. salario, comida, ahorro...","e.g. salary, food, savings...")}">
      <button class="rm-mainbtn" onclick="saveMoneyRecord('${type}')">${t("Guardar","Save")}</button>
    </section>`);
}

function saveMoneyRecord(type){
    const amount=Number($("rec-amount")?.value);
    if(!amount||amount<=0)return toast(t("Indica un monto válido.","Enter a valid amount."));
    const records=getRecords();
    records.push({id:crypto.randomUUID?.()||String(Date.now()),type,amount,note:$("rec-note")?.value.trim()||"",date:new Date().toISOString()});
    setRecords(records);toast(t("Guardado en este dispositivo.","Saved on this device."));moneyView();
}

function weekView(){
    const records=getRecords(),now=Date.now(),week=records.filter(x=>now-new Date(x.date).getTime()<=7*86400000);
    const income=week.filter(x=>x.type==="income").reduce((a,x)=>a+Number(x.amount),0);
    const expenses=week.filter(x=>x.type==="expense").reduce((a,x)=>a+Number(x.amount),0);
    shell(`<section class="rm-hero"><h1>${t("Mi semana","My week")}</h1><p>${t("Resumen de los últimos 7 días.","Summary of the last 7 days.")}</p></section>
    <section class="rm-result"><table class="rm-table"><tr><td>${t("Entradas","Income")}</td><td>${money(income)}</td></tr><tr><td>${t("Gastos","Expenses")}</td><td>${money(expenses)}</td></tr><tr><td>${t("Diferencia","Difference")}</td><td>${money(income-expenses)}</td></tr></table></section>
    <div class="rm-note">${t("Estos datos pueden ayudarte a entregar a tu contador información organizada sobre entradas y salidas, pero REMESAS no prepara ni presenta impuestos.","These records can help organize income and expenses for your accountant, but REMESAS does not prepare or file taxes.")}</div>`);
}

function expensesView(){
    const records=getRecords().filter(x=>x.type==="expense").sort((a,b)=>new Date(b.date)-new Date(a.date));
    shell(`<section class="rm-hero"><h1>${t("Mis gastos","My expenses")}</h1><p>${t("Revisa lo que has registrado.","Review what you have recorded.")}</p></section>
    ${records.length?records.slice(0,50).map(x=>`<article class="rm-result"><div class="rm-result-head"><strong>${esc(x.note||t("Gasto","Expense"))}</strong><strong>${money(x.amount)}</strong></div><small class="rm-muted">${new Date(x.date).toLocaleDateString()}</small></article>`).join(""):`<div class="rm-empty">${t("Todavía no tienes gastos registrados.","You have no recorded expenses yet.")}</div>`}
    <button class="rm-mainbtn" onclick="recordMoney('expense')">${t("Registrar gasto","Record expense")}</button>`);
}

function familyView(){
    shell(`<section class="rm-hero"><h1>${t("Familia","Family")}</h1><p>${t("Organiza necesidades familiares sin guardar datos personales en el servidor.","Organize family money needs without storing personal data on the server.")}</p></section>
    <section class="rm-form"><label>${t("¿Qué necesitas organizar?","What do you need to organize?")}</label>
    <textarea id="family-note" rows="4" placeholder="${t("Ej. enviar dinero a mi madre, gasto familiar, ayuda mensual...","e.g. send money to my mother, family expense, monthly support...")}"></textarea>
    <button class="rm-mainbtn" onclick="familyResolve()">${t("Organizar","Organize")}</button></section>`);
}

function familyResolve(){
    const v=$("family-note")?.value.trim();
    if(!v)return toast(t("Escribe primero la necesidad.","Describe the need first."));
    save("family_need",{text:v,date:new Date().toISOString()});
    toast(t("Necesidad guardada localmente.","Need saved locally."));
}

function savingsView(){
    const goal=load("savings_goal",{name:"",target:0,saved:0});
    shell(`<section class="rm-hero"><h1>${t("Ahorro","Savings")}</h1><p>${t("Define una meta y registra lo que apartas.","Set a goal and record what you set aside.")}</p></section>
    <section class="rm-form"><label>${t("Meta","Goal")}</label><input id="sav-name" value="${esc(goal.name)}" placeholder="${t("Ej. fondo familiar","e.g. family fund")}">
    <label>${t("Cantidad objetivo","Target amount")}</label><input id="sav-target" type="number" value="${goal.target||""}">
    <label>${t("Ya ahorrado","Already saved")}</label><input id="sav-saved" type="number" value="${goal.saved||""}">
    <button class="rm-mainbtn" onclick="saveGoal()">${t("Guardar meta","Save goal")}</button></section>`);
    if(goal.target)document.querySelector(".rm-form").insertAdjacentHTML("afterend",`<section class="rm-result"><strong>${esc(goal.name||t("Meta","Goal"))}</strong><p>${money(goal.saved)} / ${money(goal.target)}</p><div class="rm-note">${t("Falta","Remaining")}: ${money(Math.max(0,goal.target-goal.saved))}</div></section>`);
}

function saveGoal(){
    const target=Number($("sav-target")?.value),saved=Number($("sav-saved")?.value)||0;
    if(!target||target<=0)return toast(t("Indica una meta válida.","Enter a valid goal."));
    save("savings_goal",{name:$("sav-name")?.value.trim()||t("Meta","Goal"),target,saved});toast(t("Meta guardada.","Goal saved."));savingsView();
}

function purchaseView(){
    shell(`<section class="rm-hero"><h1>${t("Compra","Purchase")}</h1><p>${t("Comprueba cómo una compra cambia tu dinero disponible.","Check how a purchase changes your available money.")}</p></section>
    <section class="rm-form"><label>${t("Dinero disponible","Available money")}</label><input id="buy-available" type="number">
    <label>${t("Precio de compra","Purchase price")}</label><input id="buy-price" type="number">
    <button class="rm-mainbtn" onclick="calculatePurchase()">${t("Calcular","Calculate")}</button><div id="buy-result"></div></section>`);
}

function calculatePurchase(){
    const a=Number($("buy-available")?.value),p=Number($("buy-price")?.value);
    if(a<0||p<=0)return toast(t("Introduce cantidades válidas.","Enter valid amounts."));
    const rest=a-p;
    $("buy-result").innerHTML=`<section class="rm-result"><strong>${rest>=0?t("Después de comprar te quedarían:","After the purchase you would have:"):t("La compra supera el dinero indicado por:","The purchase exceeds the amount entered by:")}</strong><p class="${rest>=0?"rm-success":"rm-danger"}">${money(Math.abs(rest))}</p></section>`;
}

function helpView(){
    const topics=config?.help_topics||[];
    shell(`<section class="rm-hero"><h1>${t("Ayuda","Help")}</h1><p>${t("Busca una respuesta concreta antes de actuar.","Find a concrete answer before acting.")}</p>
    <section class="rm-grid">${topics.map(x=>`<article class="rm-card"><h3>${esc(x.title)}</h3><p>${esc(x.answer)}</p><button onclick="showHelp('${esc(x.id)}')">${t("Ver","View")}</button></article>`).join("")}</section></section>`);
}

function showHelp(id){
    const x=(config?.help_topics||[]).find(v=>v.id===id);
    if(!x)return;
    shell(`<section class="rm-hero"><h1>${esc(x.title)}</h1><p>${esc(x.answer)}</p></section><button class="rm-mainbtn" onclick="helpView()">${t("Volver a ayuda","Back to help")}</button>`);
}

function toggleLanguage(){
    lang=lang==="es"?"en":"es";
    localStorage.setItem(LS+"language",lang);
    loadConfig().then(()=>renderCurrent());
}

function renderCurrent(){
    if(currentView==="home")home();
    else if(currentView==="remittance")remittance();
    else openAction(currentView);
}

async function loadConfig(){
    try{config=await api(`/api/config?language=${lang}`)}
    catch(e){toast(e.message)}
}

async function restoreSession(){
    const id=localStorage.getItem(LS+"session_id");
    if(!id)return;
    try{
        const d=await api(`/api/session/${encodeURIComponent(id)}`);
        session=d.session;
    }catch{localStorage.removeItem(LS+"session_id")}
}

async function boot(){
    injectCSS();
    const app=$("app");
    if(app)app.innerHTML=`<div class="rm-loader"><strong>REMESAS</strong><br><br>${t("Cargando...","Loading...")}</div>`;
    await loadConfig();
    await restoreSession();
    home();
}

window.goHome=()=>{currentView="home";home()};
window.toggleLanguage=toggleLanguage;
window.openAction=openAction;
window.startRemittance=startRemittance;
window.pickPriority=pickPriority;
window.submitRemittance=submitRemittance;
window.selectProvider=selectProvider;
window.continueOfficial=continueOfficial;
window.remittanceForm=remittanceForm;
window.recordMoney=recordMoney;
window.saveMoneyRecord=saveMoneyRecord;
window.familyResolve=familyResolve;
window.saveGoal=saveGoal;
window.calculatePurchase=calculatePurchase;
window.helpView=helpView;
window.showHelp=showHelp;

document.addEventListener("DOMContentLoaded",boot);
