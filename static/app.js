const API="/api";
const STORAGE_KEY="remesas_local_v4";
let state={language:"es",session_id:null,config:null,session:null,providers:[],loading:false};

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(v,c="USD")=>typeof v==="number"&&!Number.isNaN(v)?new Intl.NumberFormat(state.language==="es"?"es-US":"en-US",{style:"currency",currency:c,maximumFractionDigits:2}).format(v):"";
const text=(es,en)=>state.language==="es"?(es??en):(en??es);

function loadLocal(){
 try{
  const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
  if(x&&typeof x==="object")state={...state,...x};
 }catch{}
}

function saveLocal(){
 try{
  localStorage.setItem(STORAGE_KEY,JSON.stringify({
   language:state.language,
   session_id:state.session_id,
   session:state.session
  }));
 }catch{}
}

async function api(path,opt={}){
 const o={
  ...opt,
  headers:{
   "Content-Type":"application/json",
   ...(opt.headers||{})
  }
 };
 const r=await fetch(API+path,o);
 let d={};
 try{d=await r.json()}catch{}
 if(!r.ok)throw new Error(d.detail||d.message||"Request failed");
 return d;
}

function setBusy(v){
 state.loading=v;
 document.querySelectorAll("button").forEach(b=>b.disabled=v);
}

function lang(){return state.language==="es"?"es":"en"}

function t(k){
 const m={
  send:["Enviar dinero","Send money"],
  money:["Mi dinero","My money"],
  week:["Mi semana","My week"],
  expenses:["Mis gastos","My expenses"],
  family:["Familia","Family"],
  help:["No entiendo","I don't understand"],
  purchase:["Planear una compra","Plan a purchase"],
  save:["Ahorrar","Save money"],
  understand:["Entender mi necesidad","Understand my need"],
  reset:["Borrar todo y empezar de nuevo","Delete everything and start over"]
 };
 return text(...(m[k]||[k,k]));
}

function icon(k){
 return{
  send:"💸",
  money:"💰",
  week:"📅",
  expenses:"🧾",
  family:"👨‍👩‍👧",
  help:"❓",
  purchase:"🛒",
  save:"💵"
 }[k]||"•";
}

function render(){
 const app=$("#app")||document.body;
 app.innerHTML=`
 <div class="app-shell">
  <header class="topbar">
   <div>
    <div class="brand">REMESAS</div>
    <div class="brand-sub">May Roga LLC</div>
   </div>
   <button class="lang-btn" id="langBtn">${state.language==="es"?"EN":"ES"}</button>
  </header>
  <main id="screen"></main>
  <footer class="footer">
   <button class="link-btn" id="privacyBtn">${text("Privacidad sencilla","Simple privacy")}</button>
   <button class="link-btn danger-link" id="resetBtn">${t("reset")}</button>
  </footer>
 </div>`;

 $("#langBtn").onclick=()=>{
  state.language=state.language==="es"?"en":"es";
  saveLocal();
  render();
 };

 $("#resetBtn").onclick=resetAll;
 $("#privacyBtn").onclick=privacy;
 home();
}

function home(){
 const s=$("#screen");
 s.innerHTML=`
 <section class="hero">
  <div class="eyebrow">REMESA</div>
  <h1>${text("TU DINERO, MÁS CLARO","YOUR MONEY, CLEARER")}</h1>
  <p>${text("Dime qué necesitas y te ayudamos a resolverlo paso a paso.","Tell us what you need and we will help you solve it step by step.")}</p>
 </section>

 <section class="quick-grid">
  ${card("send","Enviar dinero","Send money")}
  ${card("money","Mi dinero","My money")}
  ${card("week","Mi semana","My week")}
  ${card("expenses","Mis gastos","My expenses")}
  ${card("family","Familia","Family")}
  ${card("help","No entiendo","I don't understand")}
  ${card("purchase","Planear una compra","Plan a purchase")}
  ${card("save","Ahorrar","Save money")}
 </section>

 <section class="need-box">
  <h2>${text("¿Tienes otra necesidad?","Do you need something else?")}</h2>
  <p>${text("Escríbela con tus propias palabras. Primero intentaremos entenderla.","Write it in your own words. We will first try to understand it.")}</p>
  <textarea id="needText" placeholder="${text("Ejemplo: no entiendo por qué mi familiar recibe menos...","Example: I don't understand why my family member receives less...")}"></textarea>
  <button class="primary-btn" id="needBtn">${t("understand")}</button>
 </section>`;

 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>action(b.dataset.action));
 $("#needBtn").onclick=freeNeed;
}

function card(k,es,en){
 return`<button class="action-card" data-action="${k}">
  <span class="action-icon">${icon(k)}</span>
  <span>
   <strong>${text(es,en)}</strong>
   <small>${cardDesc(k)}</small>
  </span>
  <span class="arrow">›</span>
 </button>`;
}

function cardDesc(k){
 const x={
  send:["Resolver tu envío","Resolve your transfer"],
  money:["Saber cuánto tienes disponible","Know what you have available"],
  week:["Saber cuánto puedes gastar","Know how much you can spend"],
  expenses:["Anotar un gasto rápidamente","Record an expense quickly"],
  family:["Repetir necesidades frecuentes","Repeat frequent needs"],
  help:["Traducir algo complicado","Explain something complicated"],
  purchase:["Saber si puedes comprarlo","Know if you can afford it"],
  save:["Separar dinero para una meta","Set money aside for a goal"]
 };
 return text(...(x[k]||["Resolver","Solve"]));
}

async function action(k){
 if(k==="send")return sendStart();
 if(k==="money")return planner("money");
 if(k==="week")return planner("week");
 if(k==="expenses")return expense();
 if(k==="family")return family();
 if(k==="help")return help();
 if(k==="purchase")return purchase();
 if(k==="save")return saving();
}

function base(title,body){
 $("#screen").innerHTML=`
 <section class="inner">
  <button class="back-btn" onclick="home()">‹ ${text("Inicio","Home")}</button>
  <div class="section-title">
   <span class="big-icon">${title[0]}</span>
   <div><h1>${esc(title.slice(2))}</h1></div>
  </div>
  ${body}
 </section>`;
}

async function ensureSession(){
 if(state.session_id){
  try{
   const d=await api(`/session/${encodeURIComponent(state.session_id)}`);
   state.session=d.session||d;
   return state.session_id;
  }catch{
   state.session_id=null;
   state.session=null;
  }
 }

 const d=await api("/session",{
  method:"POST",
  body:JSON.stringify({language:state.language})
 });

 state.session_id=d.session?.session_id||d.session_id||d.id;
 state.session=d.session||d;
 saveLocal();
 return state.session_id;
}

async function sendStart(){
 base("💸 "+t("send"),`
 <div class="assistant-box">
  <h2>${text("Vamos directo al punto.","Let's get straight to it.")}</h2>
  <p>${text("Dime cuánto quieres enviar, a qué país y qué te importa más.","Tell me how much you want to send, which country, and what matters most.")}</p>
  <input id="sendText" inputmode="decimal" placeholder="${text("Ejemplo: 100 dólares a México rápido","Example: 100 dollars to Mexico fast")}">
  <div class="choice-row">
   <button class="choice" data-p="fast">${text("⚡ Rápido","⚡ Fast")}</button>
   <button class="choice" data-p="cheap">${text("💵 Menor costo","💵 Lower cost")}</button>
   <button class="choice" data-p="simple">${text("👌 Sencillo","👌 Simple")}</button>
  </div>
  <button class="primary-btn" id="sendGo">${text("Resolver mi envío","Solve my transfer")}</button>
 </div>
 <div id="sendResult"></div>`);

 document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-p]").forEach(x=>x.classList.remove("selected"));
  b.classList.add("selected");
 });

 $("#sendGo").onclick=sendResolve;
}

async function sendResolve(){
 const raw=$("#sendText").value.trim();

 if(!raw){
  return speak(text("Dime el monto y el país.","Tell me the amount and country."));
 }

 const p=document.querySelector("[data-p].selected")?.dataset.p||"simple";

 setBusy(true);

 try{
  const id=await ensureSession();

  const parsed=await api(`/session/${encodeURIComponent(id)}/need/parse`,{
   method:"POST",
   body:JSON.stringify({
    text:raw,
    language:state.language
   })
  });

  state.session=parsed.session||state.session;

  if(parsed.parsed?.priority)state.session.priority=parsed.parsed.priority;
  else state.session.priority=p;

  if(!state.session.priority)state.session.priority=p;

  saveLocal();

  const cmp=await api(`/session/${encodeURIComponent(id)}/compare`,{
   method:"POST"
  });

  state.session=cmp.session||state.session;
  saveLocal();

  showComparison(cmp);
 }catch(e){
  $("#sendResult").innerHTML=errorBox(e);
 }finally{
  setBusy(false);
 }
}

function showComparison(d){
 const winner=d.winner||d.selected||d.recommendation;
 const providers=d.available_providers||d.providers||d.results||[];

 let html=`
 <div class="answer-card">
  <div class="answer-ok">✓</div>
  ${
   winner?
   `<h2>${esc(winner.name||winner.provider_name||"Opción disponible")}</h2>
   <p>${esc(winner.message||winner.explanation||text("Esta opción coincide con lo que pediste según la información verificada disponible.","This option matches what you asked for using the verified information available."))}</p>`:
   `<h2>${text("Ya tenemos tus opciones.","We have your options.")}</h2>
   <p>${text("Revisamos lo que está disponible. Cuando un dato necesita confirmación, te llevamos directamente al sitio oficial.","We reviewed what is available. When a detail needs confirmation, we take you directly to the official site.")}</p>`
  }
 </div>`;

 html+=`
 <div class="provider-list">
  <h3>${text("Las 4 opciones","All 4 options")}</h3>
  ${providerCards(providers.length?providers:state.config?.providers||[])}
 </div>`;

 const w=winner?.id||winner?.provider_id;

 if(w){
  html+=`<button class="primary-btn" id="selectWinner">${text("Revisar esta opción","Review this option")}</button>`;
 }

 $("#sendResult").innerHTML=html;

 if(w)$("#selectWinner").onclick=()=>selectProvider(w);
}

function providerCards(arr){
 const ids=["western_union","moneygram","remitly","xoom"];
 const by=Object.fromEntries(arr.map(x=>[(x.id||x.provider_id),x]));

 return ids.map(id=>{
  const p=by[id]||{id,name:id.replace("_"," ")};

  const urls=p.official_urls||{};
  const url=
   p.continue_url||
   p.review_url||
   p.official_url||
   p.url||
   urls.send_money||
   urls.home||
   "#";

  const fee=p.fee??p.commission;
  const rate=p.exchange_rate;
  const recv=p.recipient_amount;

  return`
  <div class="provider-card">
   <div>
    <strong>${esc(p.name||p.provider_name)}</strong>
    <span class="status">
     ${
      p.verified||p.status==="verified"?
      text("Verificado","Verified"):
      text("Revisar en sitio oficial","Review on official site")
     }
    </span>
   </div>

   <div class="provider-data">
    ${fee!=null?`<span>${text("Comisión","Fee")}: ${money(Number(fee))}</span>`:""}
    ${rate!=null?`<span>${text("Cambio","Rate")}: ${esc(rate)}</span>`:""}
    ${recv!=null?`<span>${text("Recibe","Receives")}: ${money(Number(recv))}</span>`:""}
   </div>

   <a class="outline-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
    ${text("Sitio oficial","Official site")}
   </a>
  </div>`;
 }).join("");
}

async function selectProvider(id){
 setBusy(true);

 try{
  const sid=await ensureSession();

  const d=await api(`/session/${encodeURIComponent(sid)}/select/${encodeURIComponent(id)}`,{
   method:"POST"
  });

  state.session=d.session||state.session;
  saveLocal();

  await finalCheck(d);
 }catch(e){
  $("#sendResult").innerHTML=errorBox(e);
 }finally{
  setBusy(false);
 }
}

async function finalCheck(d){
 const sid=state.session_id;

 try{
  const x=await api(`/session/${encodeURIComponent(sid)}/final-check`,{
   method:"POST"
  });

  const p=x.provider||d.provider||{};
  const urls=p.official_urls||{};
  const url=
   x.continue_url||
   p.continue_url||
   p.review_url||
   p.official_url||
   urls.send_money||
   urls.home||
   "#";

  state.session=x.session||state.session;
  saveLocal();

  $("#sendResult").innerHTML=`
  <div class="answer-card">
   <div class="answer-ok">✓</div>
   <h2>${text("Revisa antes de enviar","Review before sending")}</h2>
   <p>${esc(x.message||text("La última confirmación ocurre en el sitio oficial. La app no envía el dinero por ti.","The final confirmation happens on the official site. The app does not send the money for you."))}</p>
   ${summary(x)}
  </div>

  <a class="primary-btn link-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
   ${text("Continuar al sitio oficial","Continue to official site")}
  </a>`;
 }catch(e){
  $("#sendResult").innerHTML=errorBox(e);
 }
}

function summary(x){
 const a=x.summary||x.check||{
  amount:x.amount,
  destination_country:x.destination_country,
  provider:x.provider?.name||x.provider?.provider_name
 };

 return`
 <div class="mini-summary">
  ${Object.entries(a)
   .filter(([k])=>!["provider_id","internal_code","backend_status"].includes(k))
   .slice(0,6)
   .map(([k,v])=>`
    <div>
     <span>${human(k)}</span>
     <strong>${typeof v==="object"?esc(v.value??v.name??""):esc(v)}</strong>
    </div>`)
   .join("")}
 </div>`;
}

function human(k){
 return({
  amount:"Monto",
  destination:"Destino",
  destination_country:"Destino",
  priority:"Prioridad",
  fee:"Comisión",
  exchange_rate:"Tipo de cambio",
  recipient_amount:"Recibe",
  sender_total:"Total",
  provider:"Proveedor"
 }[k]||k).replaceAll("_"," ");
}

async function planner(mode){
 base(
  mode==="money"?"💰 "+t("money"):"📅 "+t("week"),
  `<div class="assistant-box">
   <h2>${text("Déjame hacer las cuentas.","Let me do the math.")}</h2>
   <p>${text("Escribe tus números como te salgan. No necesitas categorías perfectas.","Write your numbers naturally. You don't need perfect categories.")}</p>
   <textarea id="plannerText" placeholder="${
    mode==="money"?
    text("Ejemplo: tengo 500, renta 200 y luz 80","Example: I have 500, rent 200 and electricity 80"):
    text("Ejemplo: me pagan el viernes y tengo 120 hasta entonces","Example: I get paid Friday and have 120 until then")
   }"></textarea>
   <button class="primary-btn" id="plannerGo">${text("Dime cuánto puedo usar","Tell me what I can use")}</button>
  </div>
  <div id="plannerResult"></div>`
 );

 $("#plannerGo").onclick=async()=>{
  const q=$("#plannerText").value.trim();
  if(!q)return;
  sayPlanner(q,mode);
 };
}

async function sayPlanner(q,mode){
 setBusy(true);

 try{
  const id=await ensureSession();

  const d=await api(`/session/${encodeURIComponent(id)}/need/parse`,{
   method:"POST",
   body:JSON.stringify({
    text:q,
    language:state.language
   })
  });

  state.session=d.session||state.session;
  saveLocal();

  $("#plannerResult").innerHTML=answerBox({
   answer:d.assistant||d.parsed?.message||text("Entendí tu necesidad. Vamos paso a paso.","I understood your need. Let's go step by step."),
   next_step:d.parsed?.next_action
  });
 }catch(e){
  $("#plannerResult").innerHTML=errorBox(e);
 }finally{
  setBusy(false);
 }
}

async function expense(){
 base("🧾 "+t("expenses"),`
 <div class="assistant-box">
  <h2>${text("Dime el gasto.","Tell me the expense.")}</h2>
  <input id="expenseText" inputmode="decimal" placeholder="${text("Ejemplo: gasté 12 en comida","Example: I spent 12 on food")}">
  <button class="primary-btn" id="expenseGo">${text("Anotar","Record it")}</button>
 </div>
 <div id="expenseResult"></div>`);

 $("#expenseGo").onclick=async()=>{
  const q=$("#expenseText").value.trim();
  if(!q)return;
  await sayPlanner(q,"expense");
 };
}

function family(){
 base("👨‍👩‍👧 "+t("family"),`
 <div class="assistant-box">
  <h2>${text("Tus envíos frecuentes viven en este dispositivo.","Your frequent transfers stay on this device.")}</h2>
  <p>${text("Aquí puedes guardar localmente un nombre, país, monto habitual y preferencia. Nunca guardes contraseñas ni códigos.","You can locally save a name, country, usual amount and preference. Never save passwords or security codes.")}</p>
  <div id="familyList"></div>
  <button class="primary-btn" id="familyAdd">${text("Agregar familiar","Add family member")}</button>
 </div>`);

 drawFamily();
 $("#familyAdd").onclick=addFamily;
}

function familyData(){
 try{
  return JSON.parse(localStorage.getItem("remesas_family_v1")||"[]");
 }catch{
  return[];
 }
}

function drawFamily(){
 const a=familyData();

 $("#familyList").innerHTML=a.length?
 a.map((x,i)=>`
  <div class="family-card">
   <div class="avatar">${esc((x.name||"?")[0].toUpperCase())}</div>
   <div>
    <strong>${esc(x.name)}</strong>
    <small>${esc(x.country||"")}${x.amount?` · ${money(Number(x.amount))}`:""}</small>
   </div>
   <button class="repeat-btn" data-i="${i}">
    ${text("Enviar lo de siempre","Repeat usual")}
   </button>
  </div>`).join(""):
 `<p class="muted">${text("Todavía no tienes un familiar guardado.","You don't have a saved family member yet.")}</p>`;

 document.querySelectorAll(".repeat-btn").forEach(b=>b.onclick=()=>repeatFamily(Number(b.dataset.i)));
}

function addFamily(){
 const n=prompt(text("Nombre del familiar","Family member name"));
 if(!n)return;

 const c=prompt(text("País","Country"));
 const a=prompt(text("Monto habitual","Usual amount"));

 const x=familyData();

 x.push({
  name:n,
  country:c||"",
  amount:a?Number(a):null,
  created_at:new Date().toISOString()
 });

 localStorage.setItem("remesas_family_v1",JSON.stringify(x));
 drawFamily();
}

function repeatFamily(i){
 const x=familyData()[i];
 if(!x)return;

 sendStart();

 setTimeout(()=>{
  const input=$("#sendText");
  if(input)input.value=`${x.amount||""} ${x.country||""}`;
 },0);
}

function help(){
 base("❓ "+t("help"),`
 <div class="assistant-box">
  <h2>${text("Dime qué no entiendes.","Tell me what you don't understand.")}</h2>
  <textarea id="helpText" placeholder="${text("Ejemplo: ¿qué significa tipo de cambio?","Example: what does exchange rate mean?")}"></textarea>
  <button class="primary-btn" id="helpGo">${text("Explícamelo","Explain it")}</button>
 </div>
 <div id="helpResult"></div>`);

 $("#helpGo").onclick=async()=>{
  const q=$("#helpText").value.trim();
  if(!q)return;

  setBusy(true);

  try{
   const id=await ensureSession();

   const d=await api("/assistant",{
    method:"POST",
    body:JSON.stringify({
     text:q,
     language:state.language
    })
   });

   $("#helpResult").innerHTML=answerBox({
    answer:d.assistant||d.message||text("Vamos paso a paso.","Let's go step by step."),
    next_step:d.parsed?.next_action
   });
  }catch(e){
   $("#helpResult").innerHTML=errorBox(e);
  }finally{
   setBusy(false);
  }
 };
}

function purchase(){
 base("🛒 "+t("purchase"),`
 <div class="assistant-box">
  <h2>${text("Antes de comprar, hacemos la cuenta completa.","Before you buy, we do the full calculation.")}</h2>
  <input id="purchaseText" inputmode="decimal" placeholder="${text("Ejemplo: quiero comprar algo de 80","Example: I want to buy something for 80")}">
  <button class="primary-btn" id="purchaseGo">${text("¿Me alcanza?","Can I afford it?")}</button>
 </div>
 <div id="purchaseResult"></div>`);

 $("#purchaseGo").onclick=async()=>{
  const q=$("#purchaseText").value.trim();
  if(!q)return;
  await sayPlanner(q,"purchase");
 };
}

function saving(){
 base("💵 "+t("save"),`
 <div class="assistant-box">
  <h2>${text("Vamos a guardar una cantidad que tenga sentido para ti.","Let's save an amount that makes sense for you.")}</h2>
  <input id="saveText" inputmode="decimal" placeholder="${text("Ejemplo: quiero guardar 5 para una emergencia","Example: I want to save 5 for an emergency")}">
  <button class="primary-btn" id="saveGo">${text("Planear mi ahorro","Plan my saving")}</button>
 </div>
 <div id="saveResult"></div>`);

 $("#saveGo").onclick=async()=>{
  const q=$("#saveText").value.trim();
  if(!q)return;
  await sayPlanner(q,"saving");
 };
}

function freeNeed(){
 const q=$("#needText").value.trim();
 if(!q)return;
 sayFreeNeed(q);
}

async function sayFreeNeed(q){
 setBusy(true);

 try{
  const id=await ensureSession();

  const d=await api(`/session/${encodeURIComponent(id)}/need/parse`,{
   method:"POST",
   body:JSON.stringify({
    text:q,
    language:state.language
   })
  });

  state.session=d.session||state.session;
  saveLocal();

  const a=d.assistant||d.message||text("Entendí tu necesidad. Vamos a resolverla.","I understood your need. Let's solve it.");

  $("#screen").innerHTML=`
  <div class="inner">
   <button class="back-btn" onclick="home()">‹ ${text("Inicio","Home")}</button>
   ${answerBox({
    answer:a,
    next_step:d.parsed?.next_action,
    official_url:d.official_url
   })}
  </div>`;
 }catch(e){
  $("#screen").innerHTML=errorBox(e);
 }finally{
  setBusy(false);
 }
}

function answerBox(d){
 const msg=d.answer||d.message||d.explanation||text("Vamos paso a paso.","Let's go step by step.");
 const next=d.next_step||d.action||"";
 const url=d.official_url||d.source_url;

 return`
 <div class="answer-card">
  <div class="answer-ok">✓</div>
  <h2>${esc(msg)}</h2>
  ${next?`<p>${esc(next)}</p>`:""}
  ${url?`
   <a class="primary-btn link-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
    ${text("Revisar sitio oficial","Review official site")}
   </a>`:""}
 </div>`;
}

function errorBox(e){
 return`
 <div class="error-card">
  <strong>${text("Tranquilo.","Don't worry.")}</strong>
  <p>${esc(e.message||text("No pudimos completar este paso. Puedes intentarlo otra vez.","We couldn't complete this step. You can try again."))}</p>
  <button class="outline-btn" onclick="home()">${text("Volver al inicio","Back home")}</button>
 </div>`;
}

function speak(s){
 const el=document.createElement("div");
 el.className="answer-card";
 el.innerHTML=`<h2>${esc(s)}</h2>`;
 $("#screen").appendChild(el);

 if("speechSynthesis" in window){
  try{
   window.speechSynthesis.cancel();
   const u=new SpeechSynthesisUtterance(s);
   u.lang=state.language==="es"?"es-US":"en-US";
   window.speechSynthesis.speak(u);
  }catch{}
 }
}

function privacy(){
 alert(text(
  "REMESAS guarda los datos personales y financieros de esta app en este dispositivo. Las consultas comerciales se procesan desde el servidor. Nunca pongas contraseñas, CVV ni códigos de seguridad aquí.",
  "REMESAS keeps personal and financial app data on this device. Commercial verification requests are processed by the server. Never enter passwords, CVV or security codes here."
 ));
}

function resetAll(){
 if(!confirm(text(
  "¿Borrar todo y empezar de nuevo?",
  "Delete everything and start over?"
 )))return;

 Object.keys(localStorage)
  .filter(k=>k.startsWith("remesas_"))
  .forEach(k=>localStorage.removeItem(k));

 const currentLanguage=state.language;

 state={
  language:currentLanguage,
  session_id:null,
  config:null,
  session:null,
  providers:[],
  loading:false
 };

 render();
}

async function boot(){
 loadLocal();

 try{
  state.config=await api(`/config?language=${encodeURIComponent(state.language)}`);
  state.providers=state.config?.providers||[];
 }catch(e){
  console.error("REMESAS config:",e);
 }

 render();
}

window.home=home;
window.addEventListener("DOMContentLoaded",boot);
