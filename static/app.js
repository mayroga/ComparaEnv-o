/* static/app.js — REMESAS | May Roga LLC | Human-first UI */
"use strict";

const APP_VERSION="4.1.0";
const LS="remesas_";
let lang=localStorage.getItem(LS+"language")||"es";
let config=null;
let session=null;
let currentView="home";
let busy=false;
let selectedProvider=null;

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const txt=(es,en)=>lang==="en"?en:es;
const save=(k,v)=>localStorage.setItem(LS+k,JSON.stringify(v));
const load=(k,d=null)=>{try{const v=localStorage.getItem(LS+k);return v===null?d:JSON.parse(v)}catch{return d}};
const remove=(k)=>localStorage.removeItem(LS+k);

function money(v,c="USD"){
    if(v===null||v===undefined||v==="")return "—";
    return `${Number(v).toLocaleString(lang==="es"?"es-US":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`;
}

function labelOf(value){
    if(!value)return "";
    if(typeof value==="string")return value;
    if(Array.isArray(value))return value.map(labelOf).filter(Boolean).join(", ");
    if(typeof value==="object"){
        if(value[lang])return labelOf(value[lang]);
        if(value.label)return labelOf(value.label);
        if(value.name)return labelOf(value.name);
        if(value.id)return value.id;
    }
    return String(value);
}

async function api(url,opt={}){
    const options={...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}};
    const response=await fetch(url,options);
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok){
        throw new Error(data.detail||data.error||data.message||txt(
            "No pudimos completar esta acción. Intenta nuevamente.",
            "We could not complete this action. Please try again."
        ));
    }
    return data;
}

function injectStyle(){
    if($("remesas-ui-style"))return;
    const style=document.createElement("style");
    style.id="remesas-ui-style";
    style.textContent=`
:root{
 --r-bg:#f6f8fb;
 --r-card:#ffffff;
 --r-card-soft:#eef5fb;
 --r-primary:#1769aa;
 --r-primary-dark:#0d4f83;
 --r-text:#152536;
 --r-muted:#536577;
 --r-line:#d8e1ea;
 --r-green:#147a4b;
 --r-green-soft:#e9f7f0;
 --r-yellow:#8a6100;
 --r-yellow-soft:#fff7df;
 --r-red:#9b2c2c;
 --r-red-soft:#fff0f0;
 --r-shadow:0 4px 18px rgba(20,40,60,.08);
}

*{box-sizing:border-box}

html{font-size:18px;scroll-behavior:smooth}

body{
 margin:0;
 background:var(--r-bg);
 color:var(--r-text);
 font-family:Arial,Helvetica,sans-serif;
 line-height:1.5;
}

button,input,select,textarea{font:inherit}

button{
 cursor:pointer;
 -webkit-tap-highlight-color:transparent;
}

button:focus,input:focus,select:focus,textarea:focus{
 outline:3px solid rgba(23,105,170,.22);
 outline-offset:2px;
}

#app{min-height:100vh}

.r-wrap{
 width:100%;
 max-width:900px;
 margin:0 auto;
 padding:18px;
}

.r-top{
 display:flex;
 align-items:center;
 justify-content:space-between;
 gap:12px;
 margin-bottom:18px;
}

.r-brand{
 text-align:center;
 flex:1;
}

.r-brand-name{
 font-size:25px;
 font-weight:900;
 letter-spacing:.3px;
}

.r-brand-company{
 display:block;
 color:var(--r-muted);
 font-size:13px;
 margin-top:1px;
}

.r-top-btn{
 min-width:58px;
 min-height:52px;
 padding:10px 14px;
 border:2px solid var(--r-line);
 border-radius:15px;
 background:#fff;
 color:var(--r-text);
 font-weight:800;
}

.r-top-btn.lang{
 font-size:14px;
}

.r-hero{
 background:var(--r-card);
 border:1px solid var(--r-line);
 border-radius:24px;
 padding:28px 24px;
 box-shadow:var(--r-shadow);
 margin-bottom:18px;
}

.r-hero h1{
 margin:0 0 12px;
 font-size:34px;
 line-height:1.15;
}

.r-hero h2{
 margin:0 0 10px;
 font-size:25px;
}

.r-hero p{
 margin:8px 0 0;
 color:var(--r-muted);
 font-size:19px;
 line-height:1.55;
}

.r-purpose{
 margin-top:20px;
 padding:18px;
 border-radius:18px;
 background:var(--r-card-soft);
 border-left:6px solid var(--r-primary);
}

.r-purpose strong{
 display:block;
 font-size:20px;
 margin-bottom:6px;
}

.r-purpose p{
 font-size:17px;
 margin:0;
}

.r-notice{
 margin:14px 0;
 padding:17px;
 border-radius:16px;
 background:var(--r-yellow-soft);
 border:1px solid #ecd58e;
 color:#604900;
 font-size:16px;
}

.r-security{
 margin:14px 0;
 padding:18px;
 border-radius:17px;
 background:var(--r-green-soft);
 border:1px solid #b8e1cc;
 color:#164b34;
}

.r-security strong{
 display:block;
 font-size:19px;
 margin-bottom:7px;
}

.r-security ul{
 margin:8px 0 0 22px;
 padding:0;
}

.r-security li{
 margin:6px 0;
}

.r-grid{
 display:grid;
 grid-template-columns:repeat(2,minmax(0,1fr));
 gap:14px;
}

.r-card{
 background:var(--r-card);
 border:1px solid var(--r-line);
 border-radius:21px;
 padding:21px;
 box-shadow:var(--r-shadow);
}

.r-card-icon{
 font-size:40px;
 line-height:1;
 margin-bottom:13px;
}

.r-card h3{
 font-size:23px;
 line-height:1.2;
 margin:0 0 8px;
}

.r-card p{
 margin:0 0 18px;
 color:var(--r-muted);
 font-size:17px;
 line-height:1.45;
}

.r-main-btn,
.r-card button,
.r-choice,
.r-secondary-btn{
 min-height:58px;
 border-radius:15px;
 border:2px solid transparent;
 font-weight:800;
 padding:13px 17px;
}

.r-main-btn{
 width:100%;
 background:var(--r-primary);
 color:white;
 font-size:19px;
}

.r-main-btn:hover{
 background:var(--r-primary-dark);
}

.r-secondary-btn{
 width:100%;
 background:#fff;
 color:var(--r-primary-dark);
 border-color:var(--r-line);
 font-size:17px;
}

.r-section{
 margin:22px 0;
}

.r-section-title{
 font-size:25px;
 font-weight:900;
 margin:0 0 12px;
}

.r-form{
 background:var(--r-card);
 border:1px solid var(--r-line);
 border-radius:22px;
 padding:22px;
 box-shadow:var(--r-shadow);
}

.r-field{
 margin-bottom:20px;
}

.r-field label{
 display:block;
 font-weight:900;
 font-size:19px;
 margin-bottom:7px;
}

.r-help{
 color:var(--r-muted);
 font-size:15px;
 margin:4px 0 9px;
}

.r-input,
.r-select,
.r-textarea{
 width:100%;
 min-height:56px;
 padding:13px 15px;
 border:2px solid var(--r-line);
 border-radius:14px;
 background:white;
 color:var(--r-text);
 font-size:19px;
}

.r-textarea{
 min-height:120px;
 resize:vertical;
}

.r-row{
 display:grid;
 grid-template-columns:1fr 1fr;
 gap:14px;
}

.r-choice-grid{
 display:grid;
 grid-template-columns:repeat(2,minmax(0,1fr));
 gap:10px;
}

.r-choice{
 width:100%;
 min-height:82px;
 text-align:left;
 background:#fff;
 border-color:var(--r-line);
 color:var(--r-text);
 font-size:18px;
}

.r-choice strong{
 display:block;
 font-size:18px;
}

.r-choice small{
 display:block;
 margin-top:5px;
 color:var(--r-muted);
 font-size:14px;
 font-weight:500;
 line-height:1.35;
}

.r-choice.active{
 border-color:var(--r-primary);
 background:#edf6fd;
 box-shadow:0 0 0 2px rgba(23,105,170,.12);
}

.r-step{
 display:flex;
 align-items:center;
 gap:9px;
 margin-bottom:15px;
}

.r-step-number{
 width:38px;
 height:38px;
 border-radius:50%;
 background:var(--r-primary);
 color:white;
 display:flex;
 align-items:center;
 justify-content:center;
 font-weight:900;
 flex:none;
}

.r-step-text{
 font-size:15px;
 color:var(--r-muted);
 font-weight:700;
}

.r-answer{
 margin-top:16px;
 padding:19px;
 border-radius:17px;
 background:var(--r-card-soft);
 border:1px solid var(--r-line);
 font-size:18px;
}

.r-answer strong{
 display:block;
 font-size:21px;
 margin-bottom:6px;
}

.r-result{
 background:#fff;
 border:1px solid var(--r-line);
 border-radius:21px;
 padding:21px;
 margin:13px 0;
 box-shadow:var(--r-shadow);
}

.r-result h3{
 font-size:23px;
 margin:0;
}

.r-result-top{
 display:flex;
 align-items:flex-start;
 justify-content:space-between;
 gap:12px;
}

.r-badge{
 display:inline-block;
 border-radius:30px;
 padding:7px 11px;
 font-size:13px;
 font-weight:900;
 white-space:nowrap;
}

.r-badge.verified{
 background:var(--r-green-soft);
 color:var(--r-green);
}

.r-badge.official{
 background:#edf3f8;
 color:#405669;
}

.r-data{
 width:100%;
 border-collapse:collapse;
 margin-top:15px;
 font-size:17px;
}

.r-data td{
 padding:10px 4px;
 border-bottom:1px solid var(--r-line);
 vertical-align:top;
}

.r-data td:first-child{
 color:var(--r-muted);
 width:48%;
}

.r-data td:last-child{
 text-align:right;
 font-weight:800;
}

.r-actions{
 display:grid;
 grid-template-columns:1fr 1fr;
 gap:10px;
 margin-top:16px;
}

.r-link{
 display:flex;
 align-items:center;
 justify-content:center;
 text-decoration:none;
 text-align:center;
}

.r-empty{
 padding:25px;
 border-radius:18px;
 border:2px dashed var(--r-line);
 background:#fff;
 color:var(--r-muted);
 font-size:18px;
 text-align:center;
}

.r-alert{
 padding:18px;
 border-radius:17px;
 margin:14px 0;
 font-size:17px;
 line-height:1.5;
}

.r-alert.warning{
 background:var(--r-yellow-soft);
 border:1px solid #ecd58e;
 color:#604900;
}

.r-alert.danger{
 background:var(--r-red-soft);
 border:1px solid #efbcbc;
 color:var(--r-red);
}

.r-alert.success{
 background:var(--r-green-soft);
 border:1px solid #b8e1cc;
 color:#164b34;
}

.r-list{
 margin:9px 0 0 22px;
 padding:0;
}

.r-list li{
 margin:7px 0;
}

.r-money-box{
 display:grid;
 grid-template-columns:repeat(2,1fr);
 gap:12px;
}

.r-money{
 background:#fff;
 border:1px solid var(--r-line);
 border-radius:18px;
 padding:18px;
}

.r-money span{
 display:block;
 color:var(--r-muted);
 font-size:15px;
 margin-bottom:5px;
}

.r-money strong{
 font-size:25px;
}

.r-positive{color:var(--r-green)}
.r-negative{color:var(--r-red)}

.r-footer{
 margin:30px 0 12px;
 padding-top:20px;
 border-top:1px solid var(--r-line);
 color:var(--r-muted);
 font-size:14px;
 line-height:1.6;
 text-align:center;
}

.r-footer strong{
 color:var(--r-text);
}

.r-legal{
 background:#fff;
 border:1px solid var(--r-line);
 border-radius:18px;
 padding:18px;
 margin-top:15px;
 font-size:14px;
 color:var(--r-muted);
}

.r-legal strong{
 color:var(--r-text);
}

.r-toast{
 position:fixed;
 z-index:9999;
 left:50%;
 bottom:20px;
 transform:translateX(-50%);
 width:min(92%,700px);
 padding:16px 18px;
 background:#152536;
 color:white;
 border-radius:16px;
 box-shadow:0 10px 30px rgba(0,0,0,.2);
 font-size:17px;
 font-weight:700;
 text-align:center;
}

.r-loading{
 min-height:70vh;
 display:flex;
 flex-direction:column;
 justify-content:center;
 align-items:center;
 text-align:center;
 font-size:22px;
}

.r-big-number{
 font-size:34px;
 font-weight:900;
 margin:8px 0;
}

.r-small{
 font-size:14px;
 color:var(--r-muted);
}

.r-delete{
 margin-top:20px;
 color:var(--r-red);
 border-color:#e9c0c0;
}

@media(max-width:650px){
 html{font-size:17px}
 .r-wrap{padding:12px}
 .r-hero{padding:22px 18px}
 .r-hero h1{font-size:29px}
 .r-hero p{font-size:18px}
 .r-grid,
 .r-choice-grid,
 .r-row,
 .r-actions,
 .r-money-box{grid-template-columns:1fr}
 .r-card{padding:18px}
 .r-card h3{font-size:21px}
 .r-card-icon{font-size:36px}
 .r-form{padding:18px}
 .r-choice{min-height:72px}
 .r-top-btn{min-width:52px}
}

@media(min-width:900px){
 .r-grid{grid-template-columns:repeat(4,1fr)}
}
`;
    document.head.appendChild(style);
}

function toast(message){
    const old=$("remesas-toast");
    if(old)old.remove();
    const el=document.createElement("div");
    el.id="remesas-toast";
    el.className="r-toast";
    el.textContent=message;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3600);
}

function top(){
    return `
<header class="r-top">
    <button class="r-top-btn" onclick="goHome()" aria-label="${txt("Volver al inicio","Back to home")}">⌂</button>
    <div class="r-brand">
        <div class="r-brand-name">REMESAS</div>
        <span class="r-brand-company">May Roga LLC</span>
    </div>
    <button class="r-top-btn lang" onclick="toggleLanguage()">${lang==="es"?"EN":"ES"}</button>
</header>`;
}

function legalBlock(){
    return `
<div class="r-security">
<strong>🔒 ${txt("TU SEGURIDAD","YOUR SECURITY")}</strong>
${txt(
`Esta aplicación no necesita tu contraseña bancaria, PIN, CVV, código de seguridad ni contraseña de ningún proveedor. Nunca los escribas aquí.`,
`This app does not need your bank password, PIN, CVV, security code, or provider password. Never enter them here.`
)}
<ul>
<li>${txt("No guardamos esos datos en REMESAS.","We do not store those credentials in REMESAS.")}</li>
<li>${txt("El envío de dinero se realiza directamente con el proveedor.","The money transfer is completed directly with the provider.")}</li>
<li>${txt("Antes de confirmar, revisa siempre la información final.","Always review the final information before confirming.")}</li>
</ul>
</div>`;
}

function legalFooter(){
    return `
<footer class="r-footer">
<strong>REMESAS — May Roga LLC</strong><br>
${txt(
"REMESAS es una herramienta privada de información y organización. No es un banco, institución financiera, asesor financiero ni procesador de pagos. REMESAS no recibe, guarda ni mueve tu dinero y no realiza el envío por ti.",
"REMESAS is a private information and organization tool. It is not a bank, financial institution, financial advisor, or payment processor. REMESAS does not receive, store, or move your money and does not make the transfer for you."
)}
<br><br>
${txt(
"Las tarifas, tasas de cambio, tiempos, disponibilidad y requisitos pueden cambiar. REMESAS solo presenta información comercial como actual cuando existe verificación. Si no existe, te dirige a la fuente oficial.",
"Fees, exchange rates, timing, availability, and requirements can change. REMESAS presents commercial information as current only when it is verified. When it is not verified, the app directs you to the official source."
)}
<br><br>
${txt(
"Tu información personal de dinero que registras para organizarte permanece en este dispositivo mediante almacenamiento local. Las sesiones de comparación son temporales.",
"Personal money information you record for organization stays on this device through local storage. Comparison sessions are temporary."
)}
</footer>`;
}

function shell(content){
    const app=$("app");
    if(!app)return;
    app.innerHTML=`<main class="r-wrap">${top()}${content}${legalFooter()}</main>`;
    window.scrollTo({top:0,behavior:"instant"});
}

function home(){
    currentView="home";

    const opening=config?.opening||{};
    const purpose=txt(
        "REMESAS te ayuda a entender qué necesitas hacer con tu dinero, organizarlo, preparar una remesa, revisar opciones y continuar con información oficial.",
        "REMESAS helps you understand what you need to do with your money, organize it, prepare a transfer, review options, and continue with official information."
    );

    shell(`
<section class="r-hero">
    <h1>${esc(opening.title||txt("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"))}</h1>
    <p>${esc(opening.secondary_text||txt(
        "No necesitas saber de finanzas ni de tecnología. La aplicación te guía paso a paso.",
        "You do not need to know finance or technology. The app guides you step by step."
    ))}</p>

    <div class="r-purpose">
        <strong>${txt("¿Para qué sirve REMESAS?","What is REMESAS for?")}</strong>
        <p>${purpose}</p>
    </div>

    <div class="r-notice">
        <strong>ℹ️ ${txt("IMPORTANTE","IMPORTANT")}</strong><br>
        ${esc(opening.notice||txt(
            "No inventamos tarifas, tasas, tiempos ni disponibilidad. Cuando un dato no está verificado, te lo decimos y te mostramos dónde comprobarlo.",
            "We do not invent fees, rates, timing, or availability. When information is not verified, we tell you and show you where to check it."
        ))}
    </div>
</section>

<section class="r-section">
<h2 class="r-section-title">${txt("¿Qué necesitas hacer hoy?","What do you need to do today?")}</h2>

<div class="r-grid">
${homeCard("💸","Enviar dinero","Send money",
"Quiero preparar una remesa y saber qué revisar.",
"I want to prepare a transfer and know what to review.",
"remittance")}

${homeCard("💰","Mi dinero","My money",
"Quiero saber cuánto entra, cuánto sale y cuánto queda.",
"I want to know what comes in, what goes out, and what remains.",
"money")}

${homeCard("🧾","Mis gastos","My expenses",
"Quiero registrar y entender mis gastos.",
"I want to record and understand my expenses.",
"expenses")}

${homeCard("📅","Mi semana","My week",
"Quiero ver qué pasó con mi dinero durante la semana.",
"I want to see what happened with my money this week.",
"week")}

${homeCard("🏦","Ahorro","Savings",
"Quiero crear una meta y saber cuánto me falta.",
"I want to create a goal and see what remains.",
"savings")}

${homeCard("🛒","Una compra","A purchase",
"Quiero saber si una compra cabe en mi dinero.",
"I want to know if a purchase fits my money.",
"purchase")}

${homeCard("👨‍👩‍👧","Familia","Family",
"Quiero organizar una necesidad de dinero familiar.",
"I want to organize a family money need.",
"family")}

${homeCard("❓","No sé qué hacer","I don't know what to do",
"Explícame qué puedo hacer.",
"Explain what I can do.",
"help")}
</div>
</section>

${legalBlock()}
`);
}

function homeCard(icon,es,en,descEs,descEn,action){
    return `
<article class="r-card">
<div class="r-card-icon">${icon}</div>
<h3>${txt(es,en)}</h3>
<p>${txt(descEs,descEn)}</p>
<button class="r-main-btn" onclick="openAction('${action}')">${txt("Quiero hacerlo","I want to do this")}</button>
</article>`;
}

function openAction(action){
    currentView=action;
    if(action==="remittance")return remittanceStart();
    if(action==="money")return moneyView();
    if(action==="expenses")return expensesView();
    if(action==="week")return weekView();
    if(action==="savings")return savingsView();
    if(action==="purchase")return purchaseView();
    if(action==="family")return familyView();
    if(action==="help")return helpView();
}

async function remittanceStart(){
    if(!session){
        if(busy)return;
        busy=true;
        try{
            const result=await api(`/api/session?language=${lang}`,{method:"POST"});
            session=result.session;
            save("session_id",session.session_id);
        }catch(error){
            toast(error.message);
            return;
        }finally{
            busy=false;
        }
    }
    remittanceForm();
}

function remittanceForm(){
    const countries=config?.countries||[];
    const priorities=config?.opening?.priorities||[];
    const deliveries=config?.delivery_methods||[];
    const payments=config?.payment_methods||[];

    shell(`
<section class="r-hero">
<div class="r-step"><div class="r-step-number">1</div><div class="r-step-text">${txt("Primero entendemos tu necesidad","First we understand your need")}</div></div>
<h1>${txt("Quiero enviar dinero","I want to send money")}</h1>
<p>${txt(
"No tienes que saber qué proveedor usar. Primero dime lo básico y yo te guío.",
"You do not need to know which provider to use. Tell me the basics and I will guide you."
)}</p>
</section>

<section class="r-form">

<div class="r-field">
<label for="rm-amount">${txt("¿Cuánto quieres enviar?","How much do you want to send?")}</label>
<div class="r-help">${txt("Solo necesitamos una cantidad aproximada para comenzar.","We only need an approximate amount to begin.")}</div>
<input class="r-input" id="rm-amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(session?.amount||"")}" placeholder="100">
</div>

<div class="r-field">
<label for="rm-country">${txt("¿A qué país va el dinero?","Which country is the money going to?")}</label>
<div class="r-help">${txt("El país cambia las opciones que podemos mostrarte.","The country can change which options we can show you.")}</div>
<select class="r-select" id="rm-country">
<option value="">${txt("Toca aquí para elegir el país","Tap here to choose the country")}</option>
${countries.map(c=>`
<option value="${esc(c.id)}" ${session?.destination_country===c.id?"selected":""}>
${esc(c.name)}${c.currency?` — ${esc(c.currency)}`:""}
</option>`).join("")}
</select>
</div>

<div class="r-field">
<label>${txt("¿Qué es más importante para ti?","What matters most to you?")}</label>
<div class="r-help">${txt("No es obligatorio. Elige solo si quieres que lo tengamos en cuenta.","Optional. Choose only if you want us to consider it.")}</div>
<div class="r-choice-grid">
${priorities.map(p=>`
<button type="button" class="r-choice ${session?.priority===p.id?"active":""}" onclick="pickPriority(this,'${esc(p.id)}')">
<strong>${esc(p.icon||"•")} ${esc(p.label)}</strong>
<small>${esc(p.why||"")}</small>
</button>`).join("")}
</div>
<input id="rm-priority" type="hidden" value="${esc(session?.priority||"")}">
</div>

<div class="r-field">
<label for="rm-delivery">${txt("¿Cómo quieres que reciba el dinero?","How should the recipient receive the money?")}</label>
<div class="r-help">${txt("Si todavía no lo sabes, déjalo en 'Todavía no sé'.","If you do not know yet, leave it as 'I don't know yet'.")}</div>
<select class="r-select" id="rm-delivery">
<option value="">${txt("Todavía no sé","I don't know yet")}</option>
${deliveries.map(x=>`
<option value="${esc(x.id)}" ${session?.delivery_method===x.id?"selected":""}>
${esc(x.label)}
</option>`).join("")}
</select>
</div>

<div class="r-field">
<label for="rm-payment">${txt("¿Cómo piensas pagar el envío?","How do you plan to pay for the transfer?")}</label>
<div class="r-help">${txt("Esto puede cambiar las opciones disponibles.","This can change the available options.")}</div>
<select class="r-select" id="rm-payment">
<option value="">${txt("Todavía no sé","I don't know yet")}</option>
${payments.map(x=>`
<option value="${esc(x.id)}" ${session?.payment_method===x.id?"selected":""}>
${esc(x.label)}
</option>`).join("")}
</select>
</div>

<div class="r-field">
<label for="rm-special">${txt("¿Hay algo especial que quieras decirnos?","Is there anything special you want to tell us?")}</label>
<div class="r-help">${txt("Opcional. No escribas contraseñas, códigos ni datos bancarios secretos.","Optional. Do not enter passwords, codes, or secret banking information.")}</div>
<textarea class="r-textarea" id="rm-special" maxlength="1000" placeholder="${txt(
"Ejemplo: es urgente, es para mi familia, no sé qué opción usar...",
"Example: it is urgent, it is for my family, I do not know which option to use..."
)}">${esc(session?.special_need||"")}</textarea>
</div>

<button class="r-main-btn" onclick="submitRemittance()">
${txt("Continuar y mostrar opciones","Continue and show options")}
</button>

</section>

${legalBlock()}
`);
}

function pickPriority(button,id){
    document.querySelectorAll(".r-choice").forEach(x=>x.classList.remove("active"));
    button.classList.add("active");
    const field=$("rm-priority");
    if(field)field.value=id;
}

async function submitRemittance(){
    const amount=Number($("rm-amount")?.value);
    const country=$("rm-country")?.value;

    if(!amount||amount<=0){
        toast(txt("Primero indica cuánto quieres enviar.","First enter how much you want to send."));
        return;
    }

    if(amount>1000000){
        toast(txt("El monto supera el límite de esta herramienta.","The amount exceeds this tool's limit."));
        return;
    }

    if(!country){
        toast(txt("Primero elige el país de destino.","First choose the destination country."));
        return;
    }

    if(busy)return;
    busy=true;

    try{
        const body={
            session_id:session?.session_id||null,
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

        delete body.send_currency;

        const result=await api("/api/need",{
            method:"POST",
            body:JSON.stringify(body)
        });

        session=result.session;
        save("session_id",session.session_id);

        const comparison=await api(`/api/session/${encodeURIComponent(session.session_id)}/compare`,{
            method:"POST"
        });

        renderComparison(comparison);

    }catch(error){
        toast(error.message);
    }finally{
        busy=false;
    }
}

function renderComparison(data){
    const providers=data.available_providers||[];
    const verified=data.results||[];

    shell(`
<section class="r-hero">
<div class="r-step"><div class="r-step-number">2</div><div class="r-step-text">${txt("Ahora revisamos lo que podemos verificar","Now we review what can be verified")}</div></div>
<h1>${txt("Estas son tus opciones","These are your options")}</h1>
<p>${esc(data.destination_name||"")} · ${money(data.amount,data.send_currency||"USD")}</p>

<div class="r-answer">
<strong>${txt("¿Qué hicimos?","What did we do?")}</strong>
${esc(data.explanation||data.message||txt(
"Revisamos las opciones disponibles para tu destino sin inventar información comercial.",
"We reviewed available options for your destination without inventing commercial information."
))}
</div>
</section>

${data.warning?`<div class="r-alert warning"><strong>⚠️ ${txt("Antes de continuar","Before continuing")}</strong><br>${esc(data.warning)}</div>`:""}

<section class="r-section">
<h2 class="r-section-title">${txt("Opciones disponibles","Available options")}</h2>

${providers.length
?providers.map(providerCard).join("")
:`<div class="r-empty">${txt(
"No encontramos proveedores disponibles en el catálogo para este destino.",
"We did not find providers available in the catalog for this destination."
)}</div>`}
</section>

${verified.length
?`<div class="r-alert success"><strong>✓ ${txt("Hay información comercial verificada","Verified commercial information is available")}</strong><br>${txt(
"Los datos marcados como verificados tienen una fuente y una fecha de verificación. Aun así, revisa la información final antes de enviar.",
"Data marked as verified has a source and verification date. Still review the final information before sending."
)}</div>`
:"<div class=\"r-alert warning\"><strong>ℹ️ "+txt("No hay datos comerciales actuales verificados","No current verified commercial data")+"</strong><br>"+txt(
"No vamos a inventar una tarifa, una tasa de cambio ni un tiempo de entrega. Puedes abrir directamente el sitio oficial de cada proveedor.",
"We will not invent a fee, exchange rate, or delivery time. You can open each provider's official website directly."
)+"</div>"}

<button class="r-secondary-btn" onclick="remittanceForm()">${txt("← Cambiar mis datos","← Change my information")}</button>
`);
}

function providerCard(p){
    const verified=Boolean(p.commercial_verified||p.status==="verified");

    const fee=verified&&p.fee!==null&&p.fee!==undefined
        ?money(p.fee,p.send_currency||"USD")
        :txt("Consultar","Check official site");

    const rate=verified&&p.exchange_rate
        ?String(p.exchange_rate)
        :txt("Consultar","Check official site");

    const recipient=verified&&p.recipient_amount!==null&&p.recipient_amount!==undefined
        ?money(p.recipient_amount,p.recipient_currency||"")
        :txt("Consultar","Check official site");

    const delivery=verified&&p.delivery_time
        ?p.delivery_time
        :verified&&p.estimated_delivery
        ?p.estimated_delivery
        :txt("Consultar","Check official site");

    return `
<article class="r-result">
<div class="r-result-top">
<div>
<h3>${esc(p.provider_name||p.name||"Proveedor")}</h3>
<div class="r-small">${txt("Proveedor disponible para revisar","Provider available for review")}</div>
</div>
<span class="r-badge ${verified?"verified":"official"}">
${verified?txt("Dato verificado","Verified data"):txt("Fuente oficial","Official source")}
</span>
</div>

<table class="r-data">
<tr><td>${txt("Tarifa","Fee")}</td><td>${esc(fee)}</td></tr>
<tr><td>${txt("Tasa de cambio","Exchange rate")}</td><td>${esc(rate)}</td></tr>
<tr><td>${txt("Lo que recibiría","Recipient gets")}</td><td>${esc(recipient)}</td></tr>
<tr><td>${txt("Tiempo de entrega","Delivery time")}</td><td>${esc(delivery)}</td></tr>
<tr><td>${txt("Forma de entrega","Delivery method")}</td><td>${esc(labelOf(p.delivery_methods||p.delivery_method)||txt("Consultar","Check"))}</td></tr>
<tr><td>${txt("Forma de pago","Payment method")}</td><td>${esc(labelOf(p.payment_methods||p.payment_method)||txt("Consultar","Check"))}</td></tr>
</table>

${p.important_condition?`
<div class="r-answer"><strong>${txt("Importante","Important")}</strong>${esc(p.important_condition)}</div>
`:""}

<div class="r-actions">
<button class="r-main-btn" onclick="selectProvider('${esc(p.provider_id)}')">
${txt("Revisar esta opción","Review this option")}
</button>
${p.continue_url?`
<a class="r-secondary-btn r-link" href="${esc(p.continue_url)}" target="_blank" rel="noopener noreferrer">
${txt("Abrir sitio oficial","Open official site")}
</a>`:""}
</div>
</article>`;
}

async function selectProvider(providerId){
    if(!session?.session_id||busy)return;
    busy=true;

    try{
        const result=await api(
            `/api/session/${encodeURIComponent(session.session_id)}/select/${encodeURIComponent(providerId)}`,
            {method:"POST"}
        );

        session=result.session;
        selectedProvider=result.selected_option;

        const final=await api(
            `/api/session/${encodeURIComponent(session.session_id)}/final-check`,
            {method:"POST"}
        );

        renderFinal(final);

    }catch(error){
        toast(error.message);
    }finally{
        busy=false;
    }
}

function renderFinal(data){
    const checks=data.checks||[];
    const option=session?.selected_option||selectedProvider||{};

    shell(`
<section class="r-hero">
<div class="r-step"><div class="r-step-number">3</div><div class="r-step-text">${txt("Revisamos antes de salir de REMESAS","We review before leaving REMESAS")}</div></div>
<h1>${txt("Revisión final","Final review")}</h1>
<p>${esc(option.provider_name||"")}</p>

<div class="r-notice">
<strong>⚠️ ${txt("Todavía no estás enviando el dinero","You are not sending the money yet")}</strong><br>
${txt(
"Esta pantalla solo te ayuda a revisar lo básico. El envío se realiza después, directamente con el proveedor.",
"This screen only helps you review the basics. The transfer happens afterward, directly with the provider."
)}
</div>
</section>

<section class="r-result">
<h2>${txt("Comprueba estas cosas","Check these things")}</h2>
<table class="r-data">
${checks.map(c=>`
<tr>
<td>${esc(c.label)}</td>
<td class="${c.complete?"r-positive":"r-negative"}">
${esc(c.value??"—")} ${c.complete?"✓":"!"}
</td>
</tr>`).join("")}
</table>
</section>

${data.important_note?`
<div class="r-alert warning">
<strong>${txt("Importante","Important")}</strong><br>
${esc(data.important_note)}
</div>`:""}

${data.message?`
<div class="r-answer">
<strong>${txt("¿Qué significa esto?","What does this mean?")}</strong>
${esc(data.message)}
</div>`:""}

${Array.isArray(data.precautions)&&data.precautions.length?`
<div class="r-security">
<strong>🔒 ${txt("Antes de continuar","Before continuing")}</strong>
<ul>${data.precautions.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
</div>`:legalBlock()}

<div class="r-actions">
<button class="r-main-btn" onclick="continueOfficial()" ${data.ready_to_continue?"":"disabled"}>
${txt("Ir al proveedor oficial","Go to official provider")}
</button>
<button class="r-secondary-btn" onclick="remittanceForm()">
${txt("Cambiar algo","Change something")}
</button>
</div>

<div class="r-alert warning">
<strong>⚠️ ${txt("Recuerda","Remember")}</strong><br>
${txt(
"El proveedor puede cambiar tarifas, tasas, requisitos o disponibilidad. Revisa todo nuevamente en su sitio antes de confirmar.",
"The provider may change fees, rates, requirements, or availability. Review everything again on its site before confirming."
)}
</div>
`);
}

function continueOfficial(){
    const url=session?.selected_option?.continue_url||session?.selected_option?.official_site;
    if(!url){
        toast(txt("No tenemos un enlace oficial disponible.","No official link is available."));
        return;
    }
    window.open(url,"_blank","noopener,noreferrer");
}

function getRecords(){
    return load("money_records",[]);
}

function setRecords(records){
    save("money_records",records);
}

function moneyTotals(records=getRecords()){
    const income=records.filter(x=>x.type==="income").reduce((a,x)=>a+Number(x.amount||0),0);
    const essential=records.filter(x=>x.type==="essential_expense").reduce((a,x)=>a+Number(x.amount||0),0);
    const flexible=records.filter(x=>x.type==="expense"||x.type==="flexible_expense").reduce((a,x)=>a+Number(x.amount||0),0);
    const savings=records.filter(x=>x.type==="saving").reduce((a,x)=>a+Number(x.amount||0),0);
    const remittances=records.filter(x=>x.type==="remittance").reduce((a,x)=>a+Number(x.amount||0),0);
    const purchases=records.filter(x=>x.type==="purchase").reduce((a,x)=>a+Number(x.amount||0),0);
    return {income,essential,flexible,savings,remittances,purchases,available:income-essential-flexible-savings-remittances-purchases};
}

function moneyView(){
    currentView="money";
    const totals=moneyTotals();

    shell(`
<section class="r-hero">
<h1>${txt("Mi dinero","My money")}</h1>
<p>${txt(
"Aquí puedes ver lo que registraste. La información personal se guarda en este dispositivo.",
"Here you can see what you recorded. Personal information is stored on this device."
)}</p>

<div class="r-purpose">
<strong>${txt("¿Qué resuelve esta ventana?","What does this screen solve?")}</strong>
<p>${txt(
"Te ayuda a saber qué entró, qué salió, cuánto apartaste y cuánto queda según los datos que tú registraste.",
"It helps you see what came in, what went out, what you set aside, and what remains based on the information you recorded."
)}</p>
</div>
</section>

<section class="r-money-box">
${moneyBox("💵","Entró","Income",totals.income,true)}
${moneyBox("🧾","Salió","Out",totals.essential+totals.flexible+totals.purchases,false)}
${moneyBox("🏦","Ahorro","Savings",totals.savings,false)}
${moneyBox("💰","Queda registrado","Recorded remaining",totals.available,totals.available>=0)}
</section>

<section class="r-section">
<h2 class="r-section-title">${txt("¿Qué quieres hacer?","What do you want to do?")}</h2>
<div class="r-grid">
${smallAction("➕","Registrar entrada","Record income","recordMoney('income')")}
${smallAction("🧾","Registrar gasto","Record expense","recordMoney('expense')")}
${smallAction("🏦","Registrar ahorro","Record savings","recordMoney('saving')")}
${smallAction("💸","Registrar remesa","Record transfer","recordMoney('remittance')")}
${smallAction("🛒","Registrar compra","Record purchase","recordMoney('purchase')")}
${smallAction("👀","Ver movimientos","See activity","showRecords()")}
</div>
</section>

${dataForAccountantNotice()}
<button class="r-secondary-btn r-delete" onclick="deleteLocalMoneyData()">${txt("Borrar mis datos guardados en este dispositivo","Delete my saved data from this device")}</button>
`);
}

function moneyBox(icon,es,en,value,positive){
    return `
<div class="r-money">
<span>${icon} ${txt(es,en)}</span>
<strong class="${positive?"r-positive":value>0?"":"r-negative"}">${money(value)}</strong>
</div>`;
}

function smallAction(icon,es,en,onclick){
    return `
<article class="r-card">
<div class="r-card-icon">${icon}</div>
<h3>${txt(es,en)}</h3>
<button class="r-main-btn" onclick="${onclick}">${txt("Hacerlo","Do it")}</button>
</article>`;
}

function dataForAccountantNotice(){
    return `
<div class="r-alert success">
<strong>📁 ${txt("Información organizada","Organized information")}</strong><br>
${txt(
"Los registros pueden ayudarte a entregar a tu contador información organizada sobre entradas y salidas. REMESAS no prepara ni presenta tus impuestos y no decide qué es deducible.",
"These records can help you give your accountant organized information about income and expenses. REMESAS does not prepare or file taxes and does not decide what is deductible."
)}
</div>`;
}

function recordMoney(type){
    const names={
        income:["Entrada","Income"],
        expense:["Gasto","Expense"],
        saving:["Ahorro","Savings"],
        remittance:["Remesa","Transfer"],
        purchase:["Compra","Purchase"]
    };
    const [es,en]=names[type]||names.expense;

    shell(`
<section class="r-hero">
<h1>${txt(es,en)}</h1>
<p>${txt(
"Registra solamente la información que necesitas para organizarte.",
"Record only the information you need to stay organized."
)}</p>
</section>

<section class="r-form">
<div class="r-field">
<label for="rec-amount">${txt("¿Cuánto?","How much?")}</label>
<input class="r-input" id="rec-amount" type="number" min="0.01" step="0.01" inputmode="decimal">
</div>

<div class="r-field">
<label for="rec-note">${txt("¿Qué fue?","What was it?")}</label>
<input class="r-input" id="rec-note" maxlength="200" placeholder="${txt(
"Ejemplo: salario, comida, renta...",
"Example: salary, food, rent..."
)}">
</div>

<button class="r-main-btn" onclick="saveMoneyRecord('${type}')">${txt("Guardar en mi dispositivo","Save on my device")}</button>
</section>

${legalBlock()}
`);
}

function saveMoneyRecord(type){
    const amount=Number($("rec-amount")?.value);
    if(!amount||amount<=0){
        toast(txt("Indica una cantidad válida.","Enter a valid amount."));
        return;
    }

    const records=getRecords();
    records.push({
        id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
        type,
        amount,
        note:$("rec-note")?.value.trim()||"",
        date:new Date().toISOString()
    });

    setRecords(records);
    toast(txt("Guardado en este dispositivo.","Saved on this device."));
    moneyView();
}

function showRecords(){
    const records=getRecords().sort((a,b)=>new Date(b.date)-new Date(a.date));

    shell(`
<section class="r-hero">
<h1>${txt("Mis movimientos","My activity")}</h1>
<p>${txt("Aquí puedes revisar lo que has registrado.","Here you can review what you recorded.")}</p>
</section>

${records.length
?records.slice(0,100).map(recordCard).join("")
:`<div class="r-empty">${txt(
"Todavía no has registrado movimientos.",
"You have not recorded any activity yet."
)}</div>`}

<button class="r-main-btn" onclick="moneyView()">${txt("Volver a Mi dinero","Back to My money")}</button>
`);
}

function recordCard(x){
    const names={
        income:["Entrada","Income"],
        expense:["Gasto","Expense"],
        essential_expense:["Gasto necesario","Essential expense"],
        flexible_expense:["Gasto","Expense"],
        saving:["Ahorro","Savings"],
        remittance:["Remesa","Transfer"],
        purchase:["Compra","Purchase"]
    };
    const n=names[x.type]||["Movimiento","Activity"];
    return `
<article class="r-result">
<div class="r-result-top">
<div>
<h3>${esc(x.note||txt(n[0],n[1]))}</h3>
<div class="r-small">${txt(n[0],n[1])} · ${new Date(x.date).toLocaleDateString(lang==="es"?"es-US":"en-US")}</div>
</div>
<strong class="${x.type==="income"||x.type==="saving"?"r-positive":"r-negative"}">${money(x.amount)}</strong>
</div>
</article>`;
}

function expensesView(){
    const records=getRecords().filter(x=>["expense","essential_expense","flexible_expense"].includes(x.type));
    const total=records.reduce((a,x)=>a+Number(x.amount||0),0);

    shell(`
<section class="r-hero">
<h1>${txt("Mis gastos","My expenses")}</h1>
<p>${txt(
"Registra y revisa en qué está saliendo tu dinero.",
"Record and review where your money is going."
)}</p>

<div class="r-purpose">
<strong>${txt("¿Qué resuelve esta ventana?","What does this screen solve?")}</strong>
<p>${txt(
"Te permite ver tus gastos registrados y saber cuánto has gastado.",
"It lets you see your recorded expenses and how much you have spent."
)}</p>
</div>

<div class="r-big-number">${money(total)}</div>
<div class="r-small">${txt("Total de gastos registrados","Total recorded expenses")}</div>
</section>

<div class="r-grid">
${smallAction("➕","Agregar gasto","Add expense","recordMoney('expense')")}
${smallAction("👀","Ver movimientos","See activity","showRecords()")}
</div>

<section class="r-section">
<h2 class="r-section-title">${txt("Gastos registrados","Recorded expenses")}</h2>
${records.length
?records.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50).map(recordCard).join("")
:`<div class="r-empty">${txt(
"No tienes gastos registrados todavía.",
"You have no recorded expenses yet."
)}</div>`}
</section>
`);
}

function weekView(){
    const since=Date.now()-7*24*60*60*1000;
    const records=getRecords().filter(x=>new Date(x.date).getTime()>=since);
    const total=moneyTotals(records);

    shell(`
<section class="r-hero">
<h1>${txt("Mi semana","My week")}</h1>
<p>${txt(
"Un resumen sencillo de los últimos 7 días según lo que registraste.",
"A simple summary of the last 7 days based on what you recorded."
)}</p>
</section>

<div class="r-money-box">
${moneyBox("💵","Entró","Income",total.income,true)}
${moneyBox("🧾","Gasté","Spent",total.essential+total.flexible+total.purchases,false)}
${moneyBox("🏦","Ahorré","Saved",total.savings,true)}
${moneyBox("💰","Diferencia","Difference",total.income-total.essential-total.flexible-total.purchases-total.savings,total.income-total.essential-total.flexible-total.purchases-total.savings>=0)}
</div>

<div class="r-alert success">
<strong>📁 ${txt("¿Para qué sirve?","What is this for?")}</strong><br>
${txt(
"Te permite ver rápidamente cómo se movió tu dinero durante la semana y tener información organizada para tu propio control.",
"It lets you quickly see how your money moved during the week and keep organized information for your own records."
)}
</div>

<button class="r-main-btn" onclick="moneyView()">${txt("Ir a Mi dinero","Go to My money")}</button>
`);
}

function familyView(){
    const saved=load("family_need",null);

    shell(`
<section class="r-hero">
<h1>${txt("Familia","Family")}</h1>
<p>${txt(
"Cuéntame qué necesidad de dinero tienes relacionada con tu familia y te ayudo a convertirla en una acción.",
"Tell me what family money need you have and I will help turn it into an action."
)}</p>

<div class="r-purpose">
<strong>${txt("Ejemplos","Examples")}</strong>
<p>${txt(
"Enviar dinero a mi madre · organizar una ayuda mensual · registrar un gasto familiar · ahorrar para una necesidad.",
"Send money to my mother · organize monthly support · record a family expense · save for a family need."
)}</p>
</div>
</section>

<section class="r-form">
<div class="r-field">
<label for="family-note">${txt("¿Qué necesitas hacer?","What do you need to do?")}</label>
<textarea class="r-textarea" id="family-note" maxlength="1000" placeholder="${txt(
"Escribe con tus propias palabras...",
"Write it in your own words..."
)}">${esc(saved?.text||"")}</textarea>
</div>

<button class="r-main-btn" onclick="familyResolve()">${txt("Ayúdame a organizarlo","Help me organize it")}</button>
</section>
`);
}

function familyResolve(){
    const value=$("family-note")?.value.trim();

    if(!value){
        toast(txt("Primero dime qué necesitas.","First tell me what you need."));
        return;
    }

    save("family_need",{text:value,date:new Date().toISOString()});

    const lower=value.toLowerCase();

    if(/enviar|mandar|remesa|transferir|send|remittance|transfer/.test(lower)){
        toast(txt("Parece una necesidad de envío. Te llevo a Enviar dinero.","This sounds like a transfer need. Taking you to Send money."));
        setTimeout(()=>openAction("remittance"),500);
        return;
    }

    if(/gasto|pagar|expense|pay/.test(lower)){
        toast(txt("Puedes registrar ese gasto en Mis gastos.","You can record that expense in My expenses."));
        setTimeout(()=>openAction("expenses"),500);
        return;
    }

    if(/ahorro|ahorrar|save|saving/.test(lower)){
        toast(txt("Puedes convertir esa necesidad en una meta de ahorro.","You can turn that need into a savings goal."));
        setTimeout(()=>openAction("savings"),500);
        return;
    }

    shell(`
<section class="r-hero">
<h1>${txt("Ya entendimos la necesidad","We understood the need")}</h1>
<p>${esc(value)}</p>
</section>

<div class="r-answer">
<strong>${txt("¿Qué puedes hacer ahora?","What can you do now?")}</strong>
${txt(
"Puedes guardarla en este dispositivo y luego convertirla en un envío, gasto o meta de ahorro cuando corresponda.",
"You can keep it on this device and later turn it into a transfer, expense, or savings goal when appropriate."
)}
</div>

<button class="r-main-btn" onclick="familyView()">${txt("Volver","Back")}</button>
`);
}

function savingsView(){
    const goal=load("savings_goal",{name:"",target:0,saved:0});
    const remaining=Math.max(0,Number(goal.target||0)-Number(goal.saved||0));

    shell(`
<section class="r-hero">
<h1>${txt("Ahorro","Savings")}</h1>
<p>${txt(
"Una meta sencilla: cuánto quieres guardar, cuánto tienes y cuánto falta.",
"A simple goal: how much you want to save, how much you have, and what remains."
)}</p>
</section>

<section class="r-form">
<div class="r-field">
<label for="sav-name">${txt("¿Para qué estás ahorrando?","What are you saving for?")}</label>
<input class="r-input" id="sav-name" maxlength="120" value="${esc(goal.name||"")}" placeholder="${txt("Ejemplo: fondo familiar","Example: family fund")}">
</div>

<div class="r-row">
<div class="r-field">
<label for="sav-target">${txt("¿Cuánto necesitas?","How much do you need?")}</label>
<input class="r-input" id="sav-target" type="number" min="0.01" step="0.01" value="${goal.target||""}">
</div>

<div class="r-field">
<label for="sav-saved">${txt("¿Cuánto tienes?","How much do you have?")}</label>
<input class="r-input" id="sav-saved" type="number" min="0" step="0.01" value="${goal.saved||""}">
</div>
</div>

<button class="r-main-btn" onclick="saveGoal()">${txt("Guardar mi meta","Save my goal")}</button>
</section>

${goal.target?`
<section class="r-result">
<h2>${esc(goal.name||txt("Mi meta","My goal"))}</h2>
<div class="r-big-number">${money(goal.saved)} / ${money(goal.target)}</div>
<div class="r-answer">
<strong>${remaining>0?txt("Todavía falta","Remaining"):txt("Meta alcanzada","Goal reached")}</strong>
${money(remaining)}
</div>
</section>`:""}
`);
}

function saveGoal(){
    const target=Number($("sav-target")?.value);
    const savedAmount=Number($("sav-saved")?.value)||0;

    if(!target||target<=0){
        toast(txt("Indica una meta válida.","Enter a valid goal."));
        return;
    }

    if(savedAmount<0){
        toast(txt("La cantidad ahorrada no puede ser negativa.","Saved amount cannot be negative."));
        return;
    }

    save("savings_goal",{
        name:$("sav-name")?.value.trim()||txt("Mi meta","My goal"),
        target,
        saved:savedAmount
    });

    toast(txt("Meta guardada en este dispositivo.","Goal saved on this device."));
    savingsView();
}

function purchaseView(){
    shell(`
<section class="r-hero">
<h1>${txt("Una compra","A purchase")}</h1>
<p>${txt(
"Antes de comprar, puedes comprobar cuánto dinero te quedaría.",
"Before buying, you can check how much money you would have left."
)}</p>

<div class="r-purpose">
<strong>${txt("¿Qué resuelve esta ventana?","What does this screen solve?")}</strong>
<p>${txt(
"Evita hacer la cuenta mentalmente. Escribe lo que tienes y lo que cuesta la compra.",
"No need to calculate mentally. Enter what you have and what the purchase costs."
)}</p>
</div>
</section>

<section class="r-form">
<div class="r-field">
<label for="buy-available">${txt("¿Cuánto tienes disponible?","How much do you have available?")}</label>
<input class="r-input" id="buy-available" type="number" min="0" step="0.01">
</div>

<div class="r-field">
<label for="buy-price">${txt("¿Cuánto cuesta la compra?","How much does it cost?")}</label>
<input class="r-input" id="buy-price" type="number" min="0.01" step="0.01">
</div>

<button class="r-main-btn" onclick="calculatePurchase()">${txt("Quiero saber cuánto me queda","I want to know what remains")}</button>
<div id="buy-result"></div>
</section>
`);
}

function calculatePurchase(){
    const available=Number($("buy-available")?.value);
    const price=Number($("buy-price")?.value);

    if(available<0||price<=0){
        toast(txt("Introduce cantidades válidas.","Enter valid amounts."));
        return;
    }

    const remaining=available-price;

    $("buy-result").innerHTML=`
<div class="r-answer">
<strong>${remaining>=0
?txt("Sí cabe dentro de la cantidad indicada.","It fits within the amount entered.")
:txt("La compra supera el dinero indicado.","The purchase exceeds the amount entered.")}</strong>
<div class="r-big-number ${remaining>=0?"r-positive":"r-negative"}">
${money(Math.abs(remaining))}
</div>
<div>${remaining>=0
?txt("Esto sería lo que te quedaría.","This is what you would have left.")
:txt("Esta es la cantidad que te faltaría.","This is the amount you would be short.")}</div>
</div>`;
}

function helpView(){
    const topics=config?.help_topics||[];

    shell(`
<section class="r-hero">
<h1>${txt("No sé qué hacer","I don't know what to do")}</h1>
<p>${txt(
"No tienes que conocer los términos. Escoge la pregunta que más se parece a tu problema.",
"You do not need to know the terminology. Choose the question closest to your problem."
)}</p>
</section>

<section class="r-grid">
${topics.map(topic=>`
<article class="r-card">
<div class="r-card-icon">❓</div>
<h3>${esc(topic.label||topic.title||"")}</h3>
<p>${esc(topic.answer||"")}</p>
<button class="r-main-btn" onclick="showHelp('${esc(topic.id)}')">${txt("Quiero entenderlo","I want to understand")}</button>
</article>`).join("")}
</section>

<div class="r-security">
<strong>🔒 ${txt("¿Qué nunca debes escribir aquí?","What should you never enter here?")}</strong>
${txt(
"Contraseñas bancarias, PIN, CVV, códigos de seguridad, claves de acceso o credenciales de proveedores.",
"Bank passwords, PINs, CVVs, security codes, login credentials, or provider passwords."
)}
</div>
`);
}

function showHelp(id){
    const topic=(config?.help_topics||[]).find(x=>x.id===id);
    if(!topic)return;

    shell(`
<section class="r-hero">
<h1>${esc(topic.label||"")}</h1>
<p>${esc(topic.answer||"")}</p>
</section>

<button class="r-main-btn" onclick="helpView()">${txt("← Ver todas las preguntas","← See all questions")}</button>

${id==="security"?legalBlock():""}
`);
}

async function toggleLanguage(){
    lang=lang==="es"?"en":"es";
    localStorage.setItem(LS+"language",lang);
    await loadConfig();
    renderCurrent();
}

function renderCurrent(){
    if(currentView==="home")return home();
    if(currentView==="remittance")return remittanceForm();
    if(currentView==="money")return moneyView();
    if(currentView==="expenses")return expensesView();
    if(currentView==="week")return weekView();
    if(currentView==="savings")return savingsView();
    if(currentView==="purchase")return purchaseView();
    if(currentView==="family")return familyView();
    if(currentView==="help")return helpView();
    home();
}

async function loadConfig(){
    try{
        config=await api(`/api/config?language=${lang}`);
    }catch(error){
        config={
            opening:{
                title:txt("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER"),
                secondary_text:txt(
                    "La aplicación te guía paso a paso.",
                    "The app guides you step by step."
                ),
                priorities:[],
                notice:txt(
                    "La información comercial no verificada se consulta directamente con el proveedor.",
                    "Unverified commercial information is checked directly with the provider."
                )
            },
            countries:[],
            delivery_methods:[],
            payment_methods:[],
            help_topics:[]
        };
        toast(error.message);
    }
}

async function restoreSession(){
    const id=localStorage.getItem(LS+"session_id");
    if(!id)return;

    try{
        const result=await api(`/api/session/${encodeURIComponent(id)}`);
        session=result.session;
    }catch{
        localStorage.removeItem(LS+"session_id");
        session=null;
    }
}

function deleteLocalMoneyData(){
    const ok=window.confirm(txt(
        "Esto borrará los registros de dinero guardados en este dispositivo. ¿Quieres continuar?",
        "This will delete the money records saved on this device. Continue?"
    ));

    if(!ok)return;

    remove("money_records");
    remove("savings_goal");
    remove("family_need");

    toast(txt(
        "Tus registros locales fueron borrados.",
        "Your local records were deleted."
    ));

    moneyView();
}

async function boot(){
    injectStyle();

    if($("app")){
        $("app").innerHTML=`
<div class="r-wrap">
<div class="r-loading">
<strong>REMESAS</strong>
<br>
${txt("Preparando tu guía...","Preparing your guide...")}
</div>
</div>`;
    }

    await loadConfig();
    await restoreSession();
    home();
}

window.goHome=()=>{currentView="home";home()};
window.toggleLanguage=toggleLanguage;
window.openAction=openAction;
window.remittanceStart=remittanceStart;
window.remittanceForm=remittanceForm;
window.pickPriority=pickPriority;
window.submitRemittance=submitRemittance;
window.selectProvider=selectProvider;
window.continueOfficial=continueOfficial;
window.moneyView=moneyView;
window.recordMoney=recordMoney;
window.saveMoneyRecord=saveMoneyRecord;
window.showRecords=showRecords;
window.expensesView=expensesView;
window.weekView=weekView;
window.familyView=familyView;
window.familyResolve=familyResolve;
window.savingsView=savingsView;
window.saveGoal=saveGoal;
window.purchaseView=purchaseView;
window.calculatePurchase=calculatePurchase;
window.helpView=helpView;
window.showHelp=showHelp;
window.deleteLocalMoneyData=deleteLocalMoneyData;

document.addEventListener("DOMContentLoaded",boot);
