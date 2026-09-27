const APP={config:null,sessionId:null,need:{},comparison:null,selectedProvider:null,language:"es",amount:null,destination:null,priority:null,delivery:null,freeText:""};
const TEXT={
es:{
title:"¿QUÉ NECESITAS HOY?",subtitle:"Encuentra la opción que mejor se adapta a lo que necesitas hoy.",amount:"¿Cuánto quieres enviar?",country:"¿A qué país quieres enviar?",selectCountry:"Selecciona un país",priority:"¿Qué es lo más importante para ti?",continue:"CONTINUAR",other:"OTRA NECESIDAD",freeTextPlaceholder:"Escribe lo que necesitas, por ejemplo: Quiero mandar $500 a México y necesito que llegue hoy.",compare:"COMPARAR",back:"VOLVER",results:"Opciones encontradas",verified:"DATOS VERIFICADOS",fee:"Comisión",rate:"Tipo de cambio",receive:"Recibe",delivery:"Entrega",available:"Disponible",condition:"Condición importante",choose:"ELEGIR",finalCheck:"VERIFICACIÓN FINAL",finalText:"Revisa estos datos antes de continuar con el proveedor.",countryCheck:"País de destino",amountCheck:"Cantidad a enviar",currencyCheck:"Moneda",providerCheck:"Proveedor",continueProvider:"CONTINUAR CON EL PROVEEDOR",restart:"EMPEZAR DE NUEVO",noResults:"No encontramos opciones con datos comerciales verificados en este momento.",error:"No pudimos completar la consulta. Inténtalo nuevamente.",requiredAmount:"Indica cuánto quieres enviar.",requiredCountry:"Selecciona un país.",loading:"Consultando opciones...",yes:"Sí",no:"No",review:"REVISAR",unavailable:"NO DISPONIBLE",notRequired:"NO REQUERIDO",priorityFastest:"MÁS RÁPIDO",prioritySave:"AHORRAR",priorityRecipient:"QUE RECIBA MÁS",priorityUrgent:"URGENTE",priorityBalanced:"MEJOR EQUILIBRIO",priorityCompare:"QUIERO COMPARAR TODO",priorityOther:"OTRA NECESIDAD",language:"ENGLISH"},
en:{
title:"WHAT DO YOU NEED TODAY?",subtitle:"Find the option that best fits what you need today.",amount:"How much do you want to send?",country:"Where do you want to send it?",selectCountry:"Select a country",priority:"What matters most to you?",continue:"CONTINUE",other:"OTHER NEED",freeTextPlaceholder:"Write what you need, for example: I want to send $500 to Mexico and need it to arrive today.",compare:"COMPARE",back:"BACK",results:"Options found",verified:"VERIFIED DATA",fee:"Fee",rate:"Exchange rate",receive:"Recipient gets",delivery:"Delivery",available:"Available",condition:"Important condition",choose:"CHOOSE",finalCheck:"FINAL CHECK",finalText:"Review these details before continuing with the provider.",countryCheck:"Destination country",amountCheck:"Amount to send",currencyCheck:"Currency",providerCheck:"Provider",continueProvider:"CONTINUE WITH PROVIDER",restart:"START OVER",noResults:"We could not find options with verified commercial data at this time.",error:"We could not complete the request. Please try again.",requiredAmount:"Enter the amount you want to send.",requiredCountry:"Select a country.",loading:"Checking options...",yes:"Yes",no:"No",review:"REVIEW",unavailable:"UNAVAILABLE",notRequired:"NOT REQUIRED",priorityFastest:"FASTEST",prioritySave:"SAVE",priorityRecipient:"RECIPIENT GETS MORE",priorityUrgent:"URGENT",priorityBalanced:"BEST BALANCE",priorityCompare:"COMPARE EVERYTHING",priorityOther:"OTHER NEED",language:"ESPAÑOL"}
};
function t(k){return(TEXT[APP.language]&&TEXT[APP.language][k])||TEXT.es[k]||k}
function localizedValue(v,language=APP.language){
    if(v==null)return"";
    if(typeof v==="string")return v;
    if(typeof v==="number"||typeof v==="boolean")return String(v);
    if(typeof v==="object")return v[language]||v.es||v.en||v.name||v.label||v.id||"";
    return String(v);
}
function esc(v){
    return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function money(v,currency="USD"){
    if(v==null||v==="")return"—";
    const n=Number(v);
    if(!Number.isFinite(n))return esc(v);
    try{return new Intl.NumberFormat(APP.language==="es"?"es-US":"en-US",{style:"currency",currency:currency||"USD",maximumFractionDigits:2}).format(n)}
    catch{return `${n.toFixed(2)} ${currency}`}
}
function api(path,options={}){
    return fetch(path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options}).then(async r=>{
        const data=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(data.detail||data.message||t("error"));
        return data;
    });
}
function countryLabel(c){
    if(!c)return"";
    return c.name||localizedValue(c.name_es&&c.name_en?{es:c.name_es,en:c.name_en}:c.name_es||c.name_en||c.code)||c.code||"";
}
function priorityId(p){
    return typeof p==="string"?p:(p&&p.id)||"";
}
function priorityLabel(p){
    const id=priorityId(p);
    if(p&&typeof p==="object"&&(p.label!==undefined||p.name!==undefined))return localizedValue(p.label??p.name??id);
    const map={fastest:"priorityFastest",save:"prioritySave",recipient_gets_more:"priorityRecipient",urgent:"priorityUrgent",balanced:"priorityBalanced",compare_all:"priorityCompare",other:"priorityOther"};
    return t(map[id]||id);
}
function deliveryLabel(v){
    if(!v)return"—";
    const m={bank_account:APP.language==="es"?"Cuenta bancaria":"Bank account",cash_pickup:APP.language==="es"?"Efectivo":"Cash pickup",debit_card:APP.language==="es"?"Tarjeta de débito":"Debit card",mobile_wallet:APP.language==="es"?"Billetera móvil":"Mobile wallet",home_delivery:APP.language==="es"?"Entrega a domicilio":"Home delivery",other:APP.language==="es"?"Otro":"Other"};
    return m[v]||localizedValue(v);
}
function statusLabel(s){
    return s==="unavailable"?t("unavailable"):s==="review"?t("review"):s==="not_required"?t("notRequired"):s;
}
function setLoading(msg=t("loading")){
    const app=document.getElementById("app");
    if(app)app.innerHTML=`<div class="card loading-card"><p>${esc(msg)}</p></div>`;
}
function createSession(){
    return api("/api/session",{method:"POST",body:"{}"}).then(data=>{
        APP.sessionId=data?.session?.session_id||data?.session_id||data?.id||null;
        return APP.sessionId;
    });
}
async function ensureSession(){
    if(APP.sessionId)return APP.sessionId;
    return createSession();
}
function renderHeader(){
    return `<div class="topbar"><span>● SIMPLE · CLARO · DIRECTO</span><button class="lang-btn" onclick="toggleLanguage()">${esc(t("language"))}</button></div>`;
}
function renderHome(){
    const cfg=APP.config||{};
    const countries=Array.isArray(cfg.countries)?cfg.countries:[];
    const priorities=Array.isArray(cfg.priorities)?cfg.priorities:[];
    const selected=APP.priority||"balanced";
    const options=priorities.map(p=>{
        const id=priorityId(p);
        return `<button type="button" class="priority-btn ${selected===id?"active":""}" data-priority="${esc(id)}" onclick="selectPriority('${esc(id)}')">${esc(priorityLabel(p))}</button>`;
    }).join("");
    const countryOptions=countries.map(c=>{
        const code=c.code||c.id||"";
        return `<option value="${esc(code)}" ${APP.destination===code?"selected":""}>${esc(countryLabel(c))}</option>`;
    }).join("");
    document.getElementById("app").innerHTML=`${renderHeader()}<div class="card home-card"><h1>${esc(t("title"))}</h1><p class="subtitle">${esc(t("subtitle"))}</p><label>${esc(t("amount"))}</label><div class="amount-input"><span>$</span><input id="amountInput" type="number" min="0.01" step="0.01" value="${APP.amount??""}" inputmode="decimal" placeholder="0.00"></div><label>${esc(t("country"))}</label><select id="countryInput"><option value="">${esc(t("selectCountry"))}</option>${countryOptions}</select><label>${esc(t("priority"))}</label><div class="priority-grid">${options}</div><button class="primary-btn" onclick="startComparison()">${esc(t("continue"))}</button><button class="secondary-btn" onclick="showOtherNeed()">${esc(t("other"))}</button></div><footer>© May Roga LLC <button class="restart-btn" onclick="restartApp()">${esc(t("restart"))}</button></footer>`;
}
function selectPriority(id){
    APP.priority=id;
    document.querySelectorAll(".priority-btn").forEach(b=>b.classList.toggle("active",b.dataset.priority===id));
}
async function startComparison(){
    const amount=Number(document.getElementById("amountInput")?.value);
    const destination=document.getElementById("countryInput")?.value;
    if(!amount||amount<=0){alert(t("requiredAmount"));return}
    if(!destination){alert(t("requiredCountry"));return}
    APP.amount=amount;APP.destination=destination;APP.priority=APP.priority||"balanced";
    setLoading();
    try{
        const need=await api("/api/need",{method:"POST",body:JSON.stringify({language:APP.language,amount:APP.amount,send_currency:"USD",destination_country:APP.destination,priority:APP.priority,delivery_method:APP.delivery||null})});
        APP.sessionId=need?.session?.session_id||APP.sessionId;
        if(!APP.sessionId)await ensureSession();
        const data=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/compare`,{method:"POST",body:"{}"});
        APP.comparison=data;
        renderResults();
    }catch(e){
        document.getElementById("app").innerHTML=`${renderHeader()}<div class="card error-card"><h2>${esc(t("error"))}</h2><p>${esc(e.message||t("error"))}</p><button class="primary-btn" onclick="renderHome()">${esc(t("back"))}</button></div>`;
    }
}
async function startFreeText(){
    const text=document.getElementById("freeTextInput")?.value.trim();
    if(!text)return;
    setLoading();
    try{
        await ensureSession();
        const data=await api("/api/need/parse",{method:"POST",body:JSON.stringify({language:APP.language,text,current_amount:APP.amount,current_destination_country:APP.destination})});
        const parsed=data?.parsed||{};
        APP.amount=parsed.amount??APP.amount;
        APP.destination=parsed.destination_country??APP.destination;
        APP.priority=parsed.priority??APP.priority;
        APP.delivery=parsed.delivery_method??APP.delivery;
        APP.freeText=text;
        if(APP.amount&&APP.destination){
            const need=await api("/api/need",{method:"POST",body:JSON.stringify({language:APP.language,amount:APP.amount,send_currency:parsed.send_currency||"USD",destination_country:APP.destination,priority:APP.priority||"balanced",urgency:parsed.urgency||null,delivery_method:APP.delivery||null,payment_method:parsed.payment_method||null,special_need:parsed.special_need||null,free_text:text})});
            APP.sessionId=need?.session?.session_id||APP.sessionId;
            const result=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/compare`,{method:"POST",body:"{}"});
            APP.comparison=result;renderResults();
        }else{
            renderHome();document.getElementById("freeTextInput")?.focus();
        }
    }catch(e){
        renderHome();alert(e.message||t("error"));
    }
}
function showOtherNeed(){
    document.getElementById("app").innerHTML=`${renderHeader()}<div class="card"><h1>${esc(t("other"))}</h1><p class="subtitle">${esc(t("subtitle"))}</p><textarea id="freeTextInput" rows="5" maxlength="2000" placeholder="${esc(t("freeTextPlaceholder"))}"></textarea><button class="primary-btn" onclick="startFreeText()">${esc(t("compare"))}</button><button class="secondary-btn" onclick="renderHome()">${esc(t("back"))}</button></div>`;
}
function resultValue(r){
    return r?.recipient_amount??null;
}
function renderResultCard(r,i){
    const currency=r.recipient_currency||"";
    const available=r.availability;
    return `<div class="result-card"><div class="result-head"><div><h3>${esc(r.provider_name)}</h3><span class="verified">${esc(t("verified"))}</span></div><strong>${money(resultValue(r),currency)}</strong></div><div class="result-grid"><div><small>${esc(t("fee"))}</small><b>${money(r.fee,r.send_currency||"USD")}</b></div><div><small>${esc(t("rate"))}</small><b>${r.exchange_rate!=null?esc(r.exchange_rate):"—"}</b></div><div><small>${esc(t("delivery"))}</small><b>${esc(r.estimated_delivery||"—")}</b></div><div><small>${esc(t("available"))}</small><b>${available===true?t("yes"):available===false?t("no"):"—"}</b></div></div>${r.delivery_method?`<p><small>${esc(t("delivery"))}:</small> ${esc(deliveryLabel(r.delivery_method))}</p>`:""}${r.important_condition?`<p class="condition"><small>${esc(t("condition"))}:</small> ${esc(r.important_condition)}</p>`:""}<button class="primary-btn" onclick="selectProvider(${i})">${esc(t("choose"))}</button></div>`;
}
function renderResults(){
    const data=APP.comparison||{};
    const results=Array.isArray(data.results)?data.results:[];
    if(!results.length){
        document.getElementById("app").innerHTML=`${renderHeader()}<div class="card"><h1>${esc(t("results"))}</h1><p>${esc(data.message||t("noResults"))}</p><button class="primary-btn" onclick="renderHome()">${esc(t("back"))}</button></div>`;
        return;
    }
    document.getElementById("app").innerHTML=`${renderHeader()}<div class="card results-card"><h1>${esc(t("results"))}</h1><p class="subtitle">${esc(data.message||"")}</p><div class="results-list">${results.map(renderResultCard).join("")}</div><button class="secondary-btn" onclick="renderHome()">${esc(t("back"))}</button></div>`;
}
async function selectProvider(index){
    const results=APP.comparison?.results||[];
    const provider=results[index];
    if(!provider)return;
    APP.selectedProvider=provider;
    setLoading();
    try{
        await ensureSession();
        await api(`/api/session/${encodeURIComponent(APP.sessionId)}/select/${encodeURIComponent(provider.provider_id)}`,{method:"POST"});
        renderFinalCheck(provider);
    }catch(e){
        renderResults();alert(e.message||t("error"));
    }
}
function renderFinalCheck(provider,check=null){
    const checks=check?.checks||[];
    const checkHtml=checks.length?checks.map(c=>`<div class="check-row"><span>${esc(c.label)}</span><b>${esc(c.value||statusLabel(c.status))}</b></div>`).join(""):`<div class="check-row"><span>${esc(t("countryCheck"))}</span><b>${esc(countryName(APP.destination))}</b></div><div class="check-row"><span>${esc(t("amountCheck"))}</span><b>${money(APP.amount,"USD")}</b></div><div class="check-row"><span>${esc(t("currencyCheck"))}</span><b>USD</b></div><div class="check-row"><span>${esc(t("providerCheck"))}</span><b>${esc(provider.provider_name)}</b></div>`;
    document.getElementById("app").innerHTML=`${renderHeader()}<div class="card final-card"><h1>${esc(t("finalCheck"))}</h1><p class="subtitle">${esc(t("finalText"))}</p><div class="check-list">${checkHtml}</div>${check&&!check.ready_to_continue?`<p class="condition">${esc(check.important_note||"")}</p>`:""}<button class="primary-btn" onclick="performFinalCheck()">${esc(t("continueProvider"))}</button><button class="secondary-btn" onclick="renderResults()">${esc(t("back"))}</button></div>`;
}
function countryName(code){
    const c=(APP.config?.countries||[]).find(x=>(x.code||x.id)===code);
    return countryLabel(c)||code||"";
}
async function performFinalCheck(){
    const p=APP.selectedProvider;
    if(!p)return;
    setLoading();
    try{
        await ensureSession();
        const data=await api(`/api/session/${encodeURIComponent(APP.sessionId)}/final-check`,{method:"POST"});
        const url=p.continue_url||p.official_url||p.provider_url||p.checkout_url||p.url;
        if(data?.ready_to_continue&&url){
            window.location.href=url;
            return;
        }
        renderFinalCheck(p,data);
    }catch(e){
        renderFinalCheck(p,{ready_to_continue:false,important_note:e.message||t("error")});
    }
}
function toggleLanguage(){
    APP.language=APP.language==="es"?"en":"es";
    localStorage.setItem("remesas_language",APP.language);
    renderHome();
}
function restartApp(){
    APP.sessionId=null;APP.need={};APP.comparison=null;APP.selectedProvider=null;APP.amount=null;APP.destination=null;APP.priority=null;APP.delivery=null;APP.freeText="";
    renderHome();
}
async function loadConfig(){
    try{
        const data=await api("/api/config");
        APP.config=data||{};
        APP.language=localStorage.getItem("remesas_language")||data?.language||"es";
        renderHome();
    }catch(e){
        document.getElementById("app").innerHTML=`<div class="card error-card"><h2>${esc(t("error"))}</h2><p>${esc(e.message||"")}</p></div>`;
    }
}
document.addEventListener("DOMContentLoaded",loadConfig);
