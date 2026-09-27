"use strict";

const APP={
  config:null,
  sessionId:null,
  need:null,
  comparison:null,
  selectedProvider:null,
  language:localStorage.getItem("remesas_language")||"es",
  amount:"",
  destination:localStorage.getItem("remesas_destination")||"",
  priority:"",
  delivery:"",
  freeText:""
};

const TEXT={
  es:{
    loading:"Cargando...",
    title:"REMESAS",
    subtitle:"Encuentra la opción que mejor se adapta a lo que necesitas hoy.",
    question:"¿QUÉ NECESITAS HOY?",
    amount:"¿Cuánto quieres enviar?",
    amountPlaceholder:"Ej. 500",
    destination:"¿A qué país quieres enviar?",
    destinationPlaceholder:"Selecciona un país",
    priority:"¿Qué es lo más importante para ti?",
    fastest:"MÁS RÁPIDO",
    save:"AHORRAR",
    receiveMore:"QUE RECIBA MÁS",
    urgent:"URGENTE",
    balanced:"MEJOR EQUILIBRIO",
    compare:"COMPARAR TODO",
    other:"OTRA NECESIDAD",
    freeText:"Cuéntame qué necesitas",
    freeTextPlaceholder:"Ej. Quiero mandar $500 a México y necesito que llegue hoy.",
    continue:"CONTINUAR",
    back:"ATRÁS",
    clear:"EMPEZAR DE NUEVO",
    help:"NO SÉ QUÉ HACER",
    options:"Opciones para ti",
    verified:"Información verificada",
    fee:"Tarifa",
    rate:"Tipo de cambio",
    receive:"Recibe",
    delivery:"Entrega",
    method:"Forma de entrega",
    official:"IR AL PROVEEDOR",
    review:"REVISA ANTES DE ENVIAR",
    country:"País",
    sendAmount:"Monto a enviar",
    receiveAmount:"Monto que recibe",
    payment:"Forma de pago",
    check:"VERIFICAR",
    selected:"Opción seleccionada",
    finalText:"Antes de continuar, revisa que los datos coincidan con lo que quieres enviar.",
    yes:"CONFIRMAR",
    no:"VOLVER",
    noResults:"No encontramos una opción verificada para esta combinación todavía.",
    tryAgain:"Prueba cambiar la forma de entrega o el monto.",
    error:"No pudimos completar la consulta. Inténtalo nuevamente.",
    helpTitle:"Te ayudamos a decidir",
    helpText:"No necesitas saber qué plataforma usar. Dime qué es lo más importante para ti y te mostramos las opciones disponibles.",
    close:"CERRAR",
    language:"EN"
  },
  en:{
    loading:"Loading...",
    title:"REMITTANCES",
    subtitle:"Find the option that best fits what you need today.",
    question:"WHAT DO YOU NEED TODAY?",
    amount:"How much do you want to send?",
    amountPlaceholder:"Example: 500",
    destination:"Which country are you sending to?",
    destinationPlaceholder:"Select a country",
    priority:"What matters most to you?",
    fastest:"FASTEST",
    save:"SAVE MONEY",
    receiveMore:"RECIPIENT GETS MORE",
    urgent:"URGENT",
    balanced:"BEST BALANCE",
    compare:"COMPARE EVERYTHING",
    other:"OTHER NEED",
    freeText:"Tell me what you need",
    freeTextPlaceholder:"Example: I want to send $500 to Mexico and need it there today.",
    continue:"CONTINUE",
    back:"BACK",
    clear:"START OVER",
    help:"I DON'T KNOW WHAT TO DO",
    options:"Options for you",
    verified:"Verified information",
    fee:"Fee",
    rate:"Exchange rate",
    receive:"Recipient gets",
    delivery:"Delivery",
    method:"Delivery method",
    official:"GO TO PROVIDER",
    review:"REVIEW BEFORE SENDING",
    country:"Country",
    sendAmount:"Amount to send",
    receiveAmount:"Recipient gets",
    payment:"Payment method",
    check:"VERIFY",
    selected:"Selected option",
    finalText:"Before continuing, make sure the details match what you want to send.",
    yes:"CONFIRM",
    no:"GO BACK",
    noResults:"We couldn't find a verified option for this combination yet.",
    tryAgain:"Try changing the delivery method or amount.",
    error:"We couldn't complete the request. Please try again.",
    helpTitle:"We'll help you decide",
    helpText:"You don't need to know which platform to use. Tell us what matters most and we'll show you the available options.",
    close:"CLOSE",
    language:"ES"
  }
};

const $=id=>document.getElementById(id);
const t=k=>(TEXT[APP.language]||TEXT.es)[k]||k;

function esc(v){
  return String(v==null?"":v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function money(v,currency="USD"){
  if(v===null||v===undefined||v==="")return"—";
  const n=Number(v);
  if(!Number.isFinite(n))return esc(v);
  try{
    return new Intl.NumberFormat(
      APP.language==="es"?"es-US":"en-US",
      {
        style:"currency",
        currency:currency||"USD",
        maximumFractionDigits:2
      }
    ).format(n);
  }catch(e){
    return `${n.toFixed(2)} ${currency}`.trim();
  }
}

function saveLocal(){
  localStorage.setItem("remesas_language",APP.language);
  if(APP.destination)
    localStorage.setItem("remesas_destination",APP.destination);
}

async function api(url,options={}){
  const opts={
    ...options,
    headers:{
      "Content-Type":"application/json",
      ...(options.headers||{})
    }
  };

  const response=await fetch(url,opts);
  let data=null;

  try{
    data=await response.json();
  }catch(e){}

  if(!response.ok){
    throw new Error(
      data?.detail||
      data?.message||
      data?.error||
      t("error")
    );
  }

  return data;
}

async function createSession(){
  try{
    const data=await api("/api/session",{
      method:"POST",
      body:JSON.stringify({
        language:APP.language
      })
    });

    const session=data?.session||data;

    APP.sessionId=
      session?.session_id||
      session?.id||
      null;

    return APP.sessionId;
  }catch(e){
    APP.sessionId=null;
    throw e;
  }
}

async function ensureSession(){
  if(APP.sessionId)return APP.sessionId;
  return await createSession();
}

function header(){
  return`
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">R</div>
        <div>
          <strong>${esc(t("title"))}</strong>
          <span>May Roga LLC</span>
        </div>
      </div>
      <button class="language-btn" id="languageBtn">
        ${esc(t("language"))}
      </button>
    </header>`;
}

function bindLanguage(callback){
  $("languageBtn")?.addEventListener("click",()=>{
    APP.language=APP.language==="es"?"en":"es";
    saveLocal();
    callback();
  });
}

function localizedValue(value){
  if(value===null||value===undefined)return"";
  if(typeof value==="string"||typeof value==="number")
    return String(value);

  if(typeof value==="object"){
    return String(
      value[APP.language]||
      value.es||
      value.en||
      value.label||
      value.name||
      value.id||
      ""
    );
  }

  return"";
}

function renderHome(){
  const countries=APP.config?.countries||[];
  const priorities=
    APP.config?.opening?.priorities||
    APP.config?.priorities||
    [];

  const priorityMap={
    fastest:"fastest",
    save:"save",
    recipient_gets_more:"receiveMore",
    urgent:"urgent",
    balanced:"balanced",
    compare_all:"compare"
  };

  let countryOptions=
    `<option value="">${esc(t("destinationPlaceholder"))}</option>`;

  countries.forEach(c=>{
    const id=
      typeof c==="string"
        ?c
        :(c.code||c.id||"");

    const name=
      typeof c==="string"
        ?c
        :(
          c.name||
          c.name_es&&APP.language==="es"?c.name_es:
          c.name_en&&APP.language==="en"?c.name_en:
          c.name_es||
          c.name_en||
          c.country||
          id
        );

    countryOptions+=`
      <option value="${esc(id)}"
        ${APP.destination===id?"selected":""}>
        ${esc(localizedValue(name))}
      </option>`;
  });

  const list=priorities.length
    ?priorities
    :[
      "fastest",
      "save",
      "recipient_gets_more",
      "urgent",
      "balanced",
      "compare_all"
    ];

  const priorityButtons=list.map(p=>{
    const id=
      typeof p==="string"
        ?p
        :(p.id||p.value||"");

    let label="";

    if(typeof p==="string"){
      label=t(priorityMap[id]||id);
    }else{
      label=localizedValue(
        p.label||
        p.name||
        p.title||
        id
      );
    }

    return`
      <button
        class="priority-btn ${APP.priority===id?"active":""}"
        data-priority="${esc(id)}">
        ${esc(label)}
      </button>`;
  }).join("");

  $("app").innerHTML=`
    ${header()}
    <main class="shell">
      <section class="hero">
        <div class="hero-badge">● SIMPLE · CLARO · DIRECTO</div>
        <h1>${esc(t("question"))}</h1>
        <p>${esc(t("subtitle"))}</p>
      </section>

      <section class="main-card">
        <div class="field">
          <label>${esc(t("amount"))}</label>
          <div class="amount-wrap">
            <span>$</span>
            <input
              id="amountInput"
              inputmode="decimal"
              type="number"
              min="1"
              step="0.01"
              placeholder="${esc(t("amountPlaceholder"))}"
              value="${esc(APP.amount)}">
          </div>
        </div>

        <div class="field">
          <label>${esc(t("destination"))}</label>
          <select id="destinationInput">
            ${countryOptions}
          </select>
        </div>

        <div class="field">
          <label>${esc(t("priority"))}</label>
          <div class="priority-grid">
            ${priorityButtons}
          </div>
        </div>

        <button class="help-link" id="helpBtn">?</button>

        <button class="primary-btn" id="continueBtn">
          ${esc(t("continue"))}
        </button>

        <button class="secondary-btn" id="freeTextBtn">
          ${esc(t("other"))}
        </button>

        <div id="freeTextArea" class="free-text-area hidden">
          <label>${esc(t("freeText"))}</label>
          <textarea
            id="freeTextInput"
            rows="3"
            placeholder="${esc(t("freeTextPlaceholder"))}">${esc(APP.freeText)}</textarea>

          <button class="primary-btn" id="freeTextContinue">
            ${esc(t("continue"))}
          </button>
        </div>
      </section>

      <footer class="footer">
        <span>© May Roga LLC</span>
        <button id="clearBtn">${esc(t("clear"))}</button>
      </footer>
    </main>

    <div id="modal"></div>`;

  bindHome();
}

function bindHome(){
  bindLanguage(renderHome);

  $("amountInput")?.addEventListener("input",e=>{
    APP.amount=e.target.value;
  });

  $("destinationInput")?.addEventListener("change",e=>{
    APP.destination=e.target.value;
    saveLocal();
  });

  document.querySelectorAll(".priority-btn").forEach(button=>{
    button.addEventListener("click",()=>{
      APP.priority=button.dataset.priority;

      document.querySelectorAll(".priority-btn")
        .forEach(x=>x.classList.remove("active"));

      button.classList.add("active");
    });
  });

  $("continueBtn")?.addEventListener(
    "click",
    startComparison
  );

  $("freeTextBtn")?.addEventListener("click",()=>{
    $("freeTextArea")?.classList.toggle("hidden");
    $("freeTextInput")?.focus();
  });

  $("freeTextContinue")?.addEventListener(
    "click",
    startFreeText
  );

  $("helpBtn")?.addEventListener(
    "click",
    showHelp
  );

  $("clearBtn")?.addEventListener(
    "click",
    resetAll
  );
}

async function startComparison(){
  const amount=Number(APP.amount);

  if(!amount||amount<=0){
    focusField("amountInput");
    return;
  }

  if(!APP.destination){
    focusField("destinationInput");
    return;
  }

  if(!APP.priority)
    APP.priority="balanced";

  renderLoading();

  try{
    /*
     * /api/need actualmente crea/aplica una sesión
     * porque schemas.py no tiene session_id.
     * Por eso tomamos el session_id que devuelve
     * realmente ese endpoint.
     */
    const needResponse=await api("/api/need",{
      method:"POST",
      body:JSON.stringify({
        language:APP.language,
        amount,
        destination_country:APP.destination,
        priority:APP.priority,
        delivery_method:APP.delivery||null,
        free_text:APP.freeText||null
      })
    });

    APP.need=needResponse?.session||null;

    if(APP.need?.session_id)
      APP.sessionId=APP.need.session_id;

    /*
     * La comparación no depende de que session_id
     * exista en ComparisonRequest.
     */
    APP.comparison=await api("/api/compare",{
      method:"POST",
      body:JSON.stringify({
        language:APP.language,
        amount,
        send_currency:"USD",
        destination_country:APP.destination,
        priority:APP.priority,
        delivery_method:APP.delivery||null
      })
    });

    renderResults();
  }catch(e){
    renderError(e.message);
  }
}

async function startFreeText(){
  const text=$("freeTextInput")?.value.trim();

  if(!text)return;

  APP.freeText=text;
  renderLoading();

  try{
    await ensureSession();

    const response=await api("/api/need/parse",{
      method:"POST",
      body:JSON.stringify({
        language:APP.language,
        text,
        current_amount:
          APP.amount
            ?Number(APP.amount)
            :null,
        current_destination_country:
          APP.destination||null
      })
    });

    const parsed=response?.parsed||response;

    if(parsed.amount!==null&&parsed.amount!==undefined)
      APP.amount=String(parsed.amount);

    if(parsed.destination_country)
      APP.destination=parsed.destination_country;

    if(parsed.priority)
      APP.priority=parsed.priority;

    if(parsed.delivery_method)
      APP.delivery=parsed.delivery_method;

    if(!APP.amount||!APP.destination){
      renderNeedMissing(parsed);
      return;
    }

    await startComparison();
  }catch(e){
    renderError(e.message);
  }
}

function focusField(id){
  const el=$(id);

  if(!el)return;

  el.focus();
  el.classList.add("input-error");

  setTimeout(()=>{
    el.classList.remove("input-error");
  },1400);
}

function renderLoading(){
  $("app").innerHTML=`
    ${header()}
    <main class="shell centered">
      <section class="loading-card">
        <div class="loader large"></div>
        <h2>${esc(t("options"))}</h2>
        <p>${esc(t("loading"))}</p>
      </section>
    </main>`;

  bindLanguage(renderLoading);
}

function results(){
  const c=APP.comparison||{};

  return(
    c.results||
    c.options||
    c.providers||
    []
  );
}

function resultId(r){
  return(
    r.provider_id||
    r.id||
    r.provider?.id||
    ""
  );
}

function resultName(r){
  return(
    r.provider_name||
    r.name||
    r.provider?.name||
    resultId(r)
  );
}

function resultValue(r,key){
  if(r[key]!==undefined)
    return r[key];

  if(
    r.commercial_data&&
    r.commercial_data[key]!==undefined
  )
    return r.commercial_data[key];

  if(
    r.quote&&
    r.quote[key]!==undefined
  )
    return r.quote[key];

  return null;
}

function renderResults(){
  const list=results();

  $("app").innerHTML=`
    ${header()}
    <main class="shell">
      <section class="results-head">
        <button class="back-btn" id="backBtn">
          ← ${esc(t("back"))}
        </button>

        <div>
          <div class="hero-badge">
            ● ${esc(t("verified"))}
          </div>

          <h1>${esc(t("options"))}</h1>
          <p>${esc(formatNeedSummary())}</p>
        </div>
      </section>

      <section class="results-list">
        ${
          list.length
            ?list.map((r,i)=>renderResultCard(r,i)).join("")
            :emptyResults()
        }
      </section>

      <footer class="footer">
        <button id="clearBtn">
          ${esc(t("clear"))}
        </button>
      </footer>
    </main>`;

  $("backBtn")?.addEventListener(
    "click",
    renderHome
  );

  $("clearBtn")?.addEventListener(
    "click",
    resetAll
  );

  document.querySelectorAll("[data-provider]")
    .forEach(button=>{
      button.addEventListener("click",async()=>{
        const id=button.dataset.provider;

        APP.selectedProvider=
          list.find(r=>resultId(r)===id)||null;

        if(!APP.selectedProvider){
          renderError(t("error"));
          return;
        }

        /*
         * Registrar la selección en la sesión antes
         * de pasar al chequeo final.
         */
        try{
          await ensureSession();

          await api(
            `/api/session/${encodeURIComponent(APP.sessionId)}/select/${encodeURIComponent(id)}`,
            {method:"POST"}
          );
        }catch(e){
          renderError(e.message);
          return;
        }

        renderFinalCheck(APP.selectedProvider);
      });
    });

  bindLanguage(renderResults);
}

function emptyResults(){
  return`
    <div class="empty-card">
      <div class="empty-icon">—</div>
      <h2>${esc(t("noResults"))}</h2>
      <p>${esc(t("tryAgain"))}</p>
    </div>`;
}

function formatNeedSummary(){
  const amount=APP.amount
    ?money(Number(APP.amount),"USD")
    :"";

  return`${amount} → ${getCountryName(APP.destination)}`;
}

function renderResultCard(r,index){
  const id=resultId(r);
  const name=resultName(r);

  const fee=resultValue(r,"fee");
  const rate=resultValue(r,"exchange_rate");
  const recipient=resultValue(r,"recipient_amount");

  const delivery=
    resultValue(r,"estimated_delivery")||
    resultValue(r,"delivery_time");

  const method=
    resultValue(r,"delivery_method");

  const currency=
    resultValue(r,"recipient_currency")||
    resultValue(r,"receive_currency")||
    resultValue(r,"currency")||
    "";

  const source=resultValue(r,"source");
  const verified=resultValue(r,"verified_at");
  const status=resultValue(r,"status");

  return`
    <article class="provider-card">
      <div class="provider-top">
        <div>
          <span class="provider-number">
            ${index+1}
          </span>

          <h2>${esc(name)}</h2>
        </div>

        <span class="verified-pill">
          ✓ ${esc(t("verified"))}
        </span>
      </div>

      <div class="provider-main">
        <div class="receive-box">
          <span>${esc(t("receive"))}</span>

          <strong>
            ${
              recipient!==null&&
              recipient!==undefined
                ?money(recipient,currency)
                :"—"
            }
          </strong>
        </div>

        <div class="details-grid">
          <div>
            <span>${esc(t("fee"))}</span>

            <strong>
              ${
                fee!==null&&
                fee!==undefined
                  ?money(fee,"USD")
                  :"—"
              }
            </strong>
          </div>

          <div>
            <span>${esc(t("rate"))}</span>

            <strong>
              ${
                rate!==null&&
                rate!==undefined
                  ?esc(rate)
                  :"—"
              }
            </strong>
          </div>

          <div>
            <span>${esc(t("delivery"))}</span>

            <strong>
              ${
                delivery!==null&&
                delivery!==undefined
                  ?esc(delivery)
                  :"—"
              }
            </strong>
          </div>

          <div>
            <span>${esc(t("method"))}</span>

            <strong>
              ${
                method
                  ?esc(formatMethod(method))
                  :"—"
              }
            </strong>
          </div>
        </div>
      </div>

      <div class="provider-foot">
        ${
          verified
            ?`<small>✓ ${esc(verified)}</small>`
            :""
        }

        ${
          source
            ?`
              <a
                href="${esc(source)}"
                target="_blank"
                rel="noopener noreferrer">
                ${esc(t("verified"))}
              </a>`
            :""
        }
      </div>

      <button
        class="primary-btn provider-btn"
        data-provider="${esc(id)}">
        ${esc(t("check"))}
      </button>
    </article>`;
}

function formatMethod(value){
  const map={
    cash_pickup:
      APP.language==="es"
        ?"Efectivo"
        :"Cash pickup",

    bank_account:
      APP.language==="es"
        ?"Cuenta bancaria"
        :"Bank account",

    debit_card:
      APP.language==="es"
        ?"Tarjeta de débito"
        :"Debit card",

    credit_card:
      APP.language==="es"
        ?"Tarjeta de crédito"
        :"Credit card",

    mobile_wallet:
      APP.language==="es"
        ?"Billetera móvil"
        :"Mobile wallet",

    home_delivery:
      APP.language==="es"
        ?"Entrega a domicilio"
        :"Home delivery"
  };

  return map[value]||value;
}

function renderFinalCheck(provider){
  if(!provider){
    renderError(t("error"));
    return;
  }

  const name=resultName(provider);
  const recipient=
    resultValue(provider,"recipient_amount");

  const fee=
    resultValue(provider,"fee");

  const rate=
    resultValue(provider,"exchange_rate");

  const method=
    resultValue(provider,"delivery_method");

  const payment=
    resultValue(provider,"payment_method");

  const currency=
    resultValue(provider,"recipient_currency")||
    resultValue(provider,"receive_currency")||
    resultValue(provider,"currency")||
    "";

  $("app").innerHTML=`
    ${header()}

    <main class="shell">
      <section class="results-head">
        <button class="back-btn" id="backBtn">
          ← ${esc(t("back"))}
        </button>

        <div>
          <div class="hero-badge">
            ● ${esc(t("selected"))}
          </div>

          <h1>${esc(name)}</h1>
          <p>${esc(t("finalText"))}</p>
        </div>
      </section>

      <section class="review-card">
        <h2>${esc(t("review"))}</h2>

        <div class="review-row">
          <span>${esc(t("country"))}</span>
          <strong>
            ${esc(getCountryName(APP.destination))}
          </strong>
        </div>

        <div class="review-row">
          <span>${esc(t("sendAmount"))}</span>
          <strong>
            ${money(Number(APP.amount),"USD")}
          </strong>
        </div>

        <div class="review-row">
          <span>${esc(t("fee"))}</span>
          <strong>
            ${
              fee!==null&&fee!==undefined
                ?money(fee,"USD")
                :"—"
            }
          </strong>
        </div>

        <div class="review-row">
          <span>${esc(t("rate"))}</span>
          <strong>
            ${
              rate!==null&&rate!==undefined
                ?esc(rate)
                :"—"
            }
          </strong>
        </div>

        <div class="review-row highlight">
          <span>${esc(t("receiveAmount"))}</span>
          <strong>
            ${
              recipient!==null&&
              recipient!==undefined
                ?money(recipient,currency)
                :"—"
            }
          </strong>
        </div>

        <div class="review-row">
          <span>${esc(t("method"))}</span>
          <strong>
            ${
              method
                ?esc(formatMethod(method))
                :"—"
            }
          </strong>
        </div>

        ${
          payment
            ?`
              <div class="review-row">
                <span>${esc(t("payment"))}</span>
                <strong>
                  ${esc(formatMethod(payment))}
                </strong>
              </div>`
            :""
        }

        <div class="review-actions">
          <button class="secondary-btn" id="backResults">
            ${esc(t("no"))}
          </button>

          <button class="primary-btn" id="verifyBtn">
            ${esc(t("yes"))}
          </button>
        </div>

        <div id="finalStatus"></div>
      </section>

      <footer class="footer">
        <button id="clearBtn">
          ${esc(t("clear"))}
        </button>
      </footer>
    </main>`;

  $("backBtn")?.addEventListener(
    "click",
    renderResults
  );

  $("backResults")?.addEventListener(
    "click",
    renderResults
  );

  $("clearBtn")?.addEventListener(
    "click",
    resetAll
  );

  $("verifyBtn")?.addEventListener(
    "click",
    ()=>performFinalCheck(provider)
  );

  bindLanguage(
    ()=>renderFinalCheck(provider)
  );
}

async function performFinalCheck(provider){
  const status=$("finalStatus");

  if(!status)return;

  status.innerHTML=`
    <div class="checking">
      <div class="loader"></div>
      ${esc(t("loading"))}
    </div>`;

  try{
    await ensureSession();

    /*
     * La selección ya fue registrada en la sesión.
     * Usamos el endpoint de sesión porque main.py
     * construye aquí el FinalCheckRequest correctamente.
     */
    const result=await api(
      `/api/session/${encodeURIComponent(APP.sessionId)}/final-check`,
      {method:"POST"}
    );

    const ready=
      result.ready_to_continue===true;

    const providerUrl=
      provider?.continue_url||
      provider?.official_url||
      provider?.official_site||
      null;

    status.innerHTML=`
      <div class="${ready?"success-box":"error-box"}">
        <strong>
          ${
            ready
              ?"✓ "+esc(t("verified"))
              :esc(t("review"))
          }
        </strong>

        <p>
          ${esc(
            result.message||
            t("finalText")
          )}
        </p>

        ${
          ready&&providerUrl
            ?`
              <a
                class="primary-btn link-btn"
                href="${esc(providerUrl)}"
                target="_blank"
                rel="noopener noreferrer">
                ${esc(t("official"))}
              </a>`
            :""
        }
      </div>`;
  }catch(e){
    status.innerHTML=`
      <div class="error-box">
        ${esc(e.message||t("error"))}
      </div>`;
  }
}

function renderNeedMissing(){
  const missing=[];

  if(!APP.amount)
    missing.push(t("amount"));

  if(!APP.destination)
    missing.push(t("destination"));

  $("app").innerHTML=`
    ${header()}

    <main class="shell">
      <section class="main-card">
        <div class="hero-badge">
          ● ${esc(t("helpTitle"))}
        </div>

        <h1>${esc(t("question"))}</h1>
        <p>${esc(t("helpText"))}</p>

        <div class="missing-box">
          ${missing.map(x=>`
            <div>• ${esc(x)}</div>
          `).join("")}
        </div>

        <button class="primary-btn" id="completeBtn">
          ${esc(t("continue"))}
        </button>

        <button class="secondary-btn" id="backBtn">
          ${esc(t("back"))}
        </button>
      </section>
    </main>`;

  $("completeBtn")?.addEventListener(
    "click",
    renderHome
  );

  $("backBtn")?.addEventListener(
    "click",
    renderHome
  );

  bindLanguage(renderNeedMissing);
}

function showHelp(){
  const modal=$("modal");

  if(!modal)return;

  modal.innerHTML=`
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-card">
        <button class="modal-close" id="modalClose">
          ×
        </button>

        <div class="hero-badge">?</div>

        <h2>${esc(t("helpTitle"))}</h2>

        <p>${esc(t("helpText"))}</p>

        <button class="primary-btn" id="modalStart">
          ${esc(t("continue"))}
        </button>
      </div>
    </div>`;

  $("modalClose")?.addEventListener(
    "click",
    closeModal
  );

  $("modalBackdrop")?.addEventListener(
    "click",
    e=>{
      if(e.target.id==="modalBackdrop")
        closeModal();
    }
  );

  $("modalStart")?.addEventListener(
    "click",
    ()=>{
      closeModal();
      $("amountInput")?.focus();
    }
  );
}

function closeModal(){
  const modal=$("modal");

  if(modal)
    modal.innerHTML="";
}

function renderError(message){
  $("app").innerHTML=`
    ${header()}

    <main class="shell centered">
      <section class="error-card">
        <div class="error-icon">!</div>

        <h2>${esc(t("error"))}</h2>

        <p>${esc(message||"")}</p>

        <button class="primary-btn" id="retryBtn">
          ${esc(t("back"))}
        </button>
      </section>
    </main>`;

  $("retryBtn")?.addEventListener(
    "click",
    renderHome
  );

  bindLanguage(
    ()=>renderError(message)
  );
}

function getCountryName(code){
  const countries=APP.config?.countries||[];

  const found=countries.find(c=>{
    const id=
      typeof c==="string"
        ?c
        :(c.code||c.id);

    return id===code;
  });

  if(!found)return code;

  if(typeof found==="string")
    return found;

  return localizedValue(
    found.name||
    (
      APP.language==="es"
        ?found.name_es
        :found.name_en
    )||
    found.country||
    code
  );
}

async function resetServerSession(){
  if(!APP.sessionId)return;

  try{
    await api(
      `/api/session/${encodeURIComponent(APP.sessionId)}`,
      {method:"DELETE"}
    );
  }catch(e){}
}

async function resetAll(){
  await resetServerSession();

  APP.sessionId=null;
  APP.need=null;
  APP.comparison=null;
  APP.selectedProvider=null;
  APP.amount="";
  APP.destination="";
  APP.priority="";
  APP.delivery="";
  APP.freeText="";

  localStorage.removeItem(
    "remesas_destination"
  );

  renderHome();
}

function renderFatal(message){
  $("app").innerHTML=`
    <main class="shell centered">
      <section class="error-card">
        <div class="error-icon">!</div>

        <h1>${esc(t("title"))}</h1>

        <p>
          ${esc(message||t("error"))}
        </p>

        <button
          class="primary-btn"
          onclick="location.reload()">
          ${esc(t("continue"))}
        </button>
      </section>
    </main>`;
}

async function loadConfig(){
  try{
    APP.config=await api(
      `/api/config?language=${encodeURIComponent(APP.language)}`
    );

    renderHome();
  }catch(e){
    renderFatal(e.message);
  }
}

document.addEventListener(
  "DOMContentLoaded",
  loadConfig
);
