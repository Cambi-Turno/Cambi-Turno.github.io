// Controlla automaticamente se GitHub Pages contiene una versione più recente.
let updateCheckRunning=false;
function contentHash(text){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36);
}
async function checkForAppUpdate(){
  if(updateCheckRunning) return;
  updateCheckRunning=true;
  try{
    const response=await fetch("/index.html?check="+Date.now(),{cache:"no-store"});
    if(!response.ok) return;
    const remoteHtml=await response.text();
    const remoteVersion=contentHash(remoteHtml);
    const key="cambiTurnoBuildHash";
    const savedVersion=localStorage.getItem(key);
    if(savedVersion&&savedVersion!==remoteVersion){
      localStorage.setItem(key,remoteVersion);
      const freshUrl=new URL(location.origin+location.pathname);
      freshUrl.searchParams.set("v",remoteVersion);
      location.replace(freshUrl.toString());
      return;
    }
    localStorage.setItem(key,remoteVersion);
  }catch(error){
    // In assenza di rete l'app continua a funzionare con la versione disponibile.
  }finally{
    updateCheckRunning=false;
  }
}
window.addEventListener("pageshow",checkForAppUpdate);
document.addEventListener("visibilitychange",()=>{if(!document.hidden) checkForAppUpdate();});
setInterval(checkForAppUpdate,300000);
checkForAppUpdate();

const DAY_NAMES=["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
const form=document.querySelector(".search-card");
const turno=document.querySelector("#turno");
const category=document.querySelector("#category");
const date=document.querySelector("#date");
const dateDisplay=document.querySelector("#dateDisplay");
const todayHint=document.querySelector("#todayHint");
const period=document.querySelector("#period");
const range=document.querySelector("#range");
const results=document.querySelector("#results");
const numberField=document.querySelector("#numberField");
const turnValidIndicator=document.querySelector("#turnValidIndicator");
const categoryField=document.querySelector("#categoryField");
const modeButtons=[...document.querySelectorAll(".mode-button")];
const accessGate=document.querySelector("#accessGate");
const accessForm=document.querySelector("#accessForm");
const matricolaInput=document.querySelector("#matricola");
const accessError=document.querySelector("#accessError");
const adminGear=document.querySelector("#adminGear");
const projectInfoButton=document.querySelector("#projectInfoButton");
const projectModal=document.querySelector("#projectModal");
const projectClose=document.querySelector("#projectClose");
const statsModal=document.querySelector("#statsModal");
const statsClose=document.querySelector("#statsClose");
const statsLogin=document.querySelector("#statsLogin");
const statsPin=document.querySelector("#statsPin");
const statsMessage=document.querySelector("#statsMessage");
const statsContent=document.querySelector("#statsContent");
const BACKEND_API_URL="https://cambi-turno-backend-test.antonio-mauceri82.workers.dev";
const SESSION_STORAGE_KEY="cambiTurnoBackendSession";
let pageViewRecorded=false;
let accessToken="";
let currentUserIsAdmin=false;

let searchMode="number";

function unlockSite(isAdmin=false){
  document.body.classList.remove("locked");
  accessGate.hidden=true;
  adminGear.hidden=!isAdmin;
  if(!isAdmin) recordAnonymousVisit();
}
function lockSite(message=""){
  accessToken="";
  currentUserIsAdmin=false;
  pageViewRecorded=false;
  try{sessionStorage.removeItem(SESSION_STORAGE_KEY);}catch(error){}
  document.body.classList.add("locked");
  accessGate.hidden=false;
  adminGear.hidden=true;
  results.innerHTML="";
  accessError.textContent=message;
}
function saveSession(data){
  accessToken=data.token;
  currentUserIsAdmin=data.admin===true;
  const expiresAt=Date.now()+Number(data.expiresIn||0)*1000;
  try{
    sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({
      token:accessToken,
      admin:currentUserIsAdmin,
      expiresAt
    }));
  }catch(error){}
}
function restoreSession(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)||"null");
    if(!saved?.token||!Number.isFinite(saved?.expiresAt)||saved.expiresAt<=Date.now()) return false;
    accessToken=saved.token;
    currentUserIsAdmin=saved.admin===true;
    unlockSite(currentUserIsAdmin);
    return true;
  }catch(error){
    return false;
  }
}
async function apiRequest(path,body,{authenticated=true,keepalive=false}={}){
  const headers={"Content-Type":"application/json"};
  if(authenticated){
    if(!accessToken) throw new Error("Accesso scaduto");
    headers.Authorization="Bearer "+accessToken;
  }
  const response=await fetch(BACKEND_API_URL+path,{
    method:"POST",
    headers,
    body:JSON.stringify(body),
    cache:"no-store",
    keepalive
  });
  let data={};
  try{data=await response.json();}catch(error){}
  if(response.status===401&&authenticated&&data.code==="SESSION_EXPIRED"){
    lockSite("Accesso scaduto. Inserisci nuovamente la matricola");
  }
  if(!response.ok) throw new Error(data.error||"Servizio temporaneamente non disponibile");
  return data;
}
async function matricolaHash(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function verifyMatricolaHash(hash){
  return apiRequest("/verify",{hash},{authenticated:false});
}
restoreSession();
accessForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const value=matricolaInput.value.replace(/\D/g,"");
  const submitButton=accessForm.querySelector('button[type="submit"]');
  submitButton.disabled=true;
  accessError.textContent="Verifica…";
  try{
    const hash=await matricolaHash(value);
    const verifica=await verifyMatricolaHash(hash);
    if(verifica.valid){
      accessError.textContent="";
      saveSession(verifica);
      unlockSite(currentUserIsAdmin);
      matricolaInput.value="";
      return;
    }
  }catch(error){
    accessError.textContent=error.message;
    return;
  }finally{
    submitButton.disabled=false;
  }
  accessError.textContent="Matricola non riconosciuta";
  matricolaInput.value="";
  matricolaInput.focus();
});


async function recordAnonymousVisit(){
  if(pageViewRecorded||!accessToken||currentUserIsAdmin) return;
  pageViewRecorded=true;
  let newSession=false;
  try{
    if(!sessionStorage.getItem("cambiTurnoStatsSession")){
      sessionStorage.setItem("cambiTurnoStatsSession",crypto.randomUUID());
      newSession=true;
    }
    await apiRequest("/event",{newSession},{keepalive:true});
  }catch(error){}
}
function closeProject(){
  projectModal.hidden=true;
}
projectInfoButton.addEventListener("click",()=>{
  projectModal.hidden=false;
  setTimeout(()=>projectClose.focus(),50);
});
projectClose.addEventListener("click",closeProject);
projectModal.addEventListener("click",event=>{if(event.target===projectModal) closeProject();});

function closeStats(){
  statsModal.hidden=true;
  statsPin.value="";
  statsMessage.textContent="";
  statsMessage.classList.remove("error");
  statsContent.hidden=true;
  statsLogin.hidden=false;
}
adminGear.addEventListener("click",()=>{
  statsModal.hidden=false;
  statsLogin.hidden=false;
  statsContent.hidden=true;
  statsMessage.textContent="";
  setTimeout(()=>statsPin.focus(),50);
});
statsClose.addEventListener("click",closeStats);
statsModal.addEventListener("click",event=>{if(event.target===statsModal) closeStats();});
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape") return;
  if(!projectModal.hidden) closeProject();
  if(!statsModal.hidden) closeStats();
});
statsLogin.addEventListener("submit",async event=>{
  event.preventDefault();
  statsMessage.classList.remove("error");
  statsContent.hidden=true;
  statsMessage.textContent="Caricamento…";
  try{
    const data=await apiRequest("/stats",{pin:statsPin.value});
    const totals=data.totals||{};
    document.querySelector("#viewsToday").textContent=totals.views_today||0;
    document.querySelector("#visitsToday").textContent=totals.visits_today||0;
    document.querySelector("#views7").textContent=totals.views_7||0;
    document.querySelector("#visits7").textContent=totals.visits_7||0;
    document.querySelector("#views30").textContent=totals.views_30||0;
    document.querySelector("#visits30").textContent=totals.visits_30||0;
    statsMessage.textContent="";
    statsLogin.hidden=true;
    statsContent.hidden=false;
    statsPin.value="";
  }catch(error){
    statsMessage.textContent=error.message;
    statsMessage.classList.add("error");
  }
});

function mondayOf(value){
  const d=new Date(value+"T12:00:00");
  const day=d.getDay();
  d.setDate(d.getDate()-(day===0?6:day-1));
  return d;
}
function dateFromValue(value){ return new Date(value+"T12:00:00"); }
function formatDate(d,year=true){
  return new Intl.DateTimeFormat("it-IT",year?{day:"numeric",month:"long",year:"numeric"}:{day:"numeric",month:"long"}).format(d);
}
function todayValue(){
  const today=new Date();
  return [today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
}
function selectedDateIsToday(){ return date.value===todayValue(); }
function updateTodayHint(){
  todayHint.hidden=!selectedDateIsToday();
}
function updateDateDisplay(){
  if(!date.value){dateDisplay.textContent="";return;}
  const selected=dateFromValue(date.value);
  dateDisplay.textContent=new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(selected);
}
function updateRange(){
  if(period.value==="day"){
    if(selectedDateIsToday()){
      range.textContent="";
      return;
    }
    const selected=dateFromValue(date.value);
    range.textContent=DAY_NAMES[(selected.getDay()+6)%7]+" "+formatDate(selected);
  }else{
    const start=mondayOf(date.value);
    const end=new Date(start); end.setDate(end.getDate()+6);
    range.textContent=formatDate(start,false)+" – "+formatDate(end);
  }
}
function setMode(mode){
  searchMode=mode;
  modeButtons.forEach(button=>button.classList.toggle("active",button.dataset.mode===mode));
  numberField.hidden=mode!=="number";
  categoryField.hidden=mode!=="category";
  turno.required=mode==="number";
  results.innerHTML="";
  turnValidIndicator.classList.remove("valid","invalid");
}
function parseTurnQueries(value){
  return value.toUpperCase().trim().split(/[\s,;+/]+/).map(item=>item.trim()).filter(Boolean);
}
function queryIsComplete(query){
  const value=query.trim().toUpperCase().replace(/^MS/,"");
  return /^\d{2,3}$/.test(value)||/^R\d+$/.test(value);
}
let validityTimer=0;
let validityRequest=0;
function setTurnValidity(valid,invalid){
  turnValidIndicator.classList.toggle("valid",valid);
  turnValidIndicator.classList.toggle("invalid",invalid);
  turnValidIndicator.textContent=invalid?"×":"✓";
  const message=invalid?"Turno non riconosciuto":"Turno riconosciuto";
  turnValidIndicator.setAttribute("aria-label",message);
  turnValidIndicator.title=message;
}
function updateTurnValidity(){
  clearTimeout(validityTimer);
  const requestId=++validityRequest;
  const queries=parseTurnQueries(turno.value);
  const allComplete=queries.length>0&&queries.every(queryIsComplete);
  setTurnValidity(false,false);
  if(!allComplete) return;
  validityTimer=setTimeout(async()=>{
    try{
      const data=await apiRequest("/exists",{query:turno.value});
      if(requestId!==validityRequest) return;
      setTurnValidity(data.valid===true,data.valid!==true);
    }catch(error){
      if(requestId===validityRequest) setTurnValidity(false,false);
    }
  },180);
}
function dutyLabel(duty){
  if(duty.startsWith("MS")){
    const number=Number(duty.replace(/^MS/,""));
    return String(number<100?number+100:number);
  }
  return duty;
}
function resultCard(item){
  const info=item.info;
  const pill=info?'<span class="category-pill">'+escapeHtml(info.category)+'</span>':"";
  const time=info?'<p class="result-time">'+escapeHtml(info.start)+' – '+escapeHtml(info.end)+'</p>':"";
  return '<article class="result"><i></i><div><p class="result-duty">Turno '+escapeHtml(dutyLabel(item.duty))+pill+'</p><h2>'+escapeHtml(item.driver)+'</h2>'+time+'<p>'+escapeHtml(item.rotation)+'</p></div></article>';
}
async function search(event){
  event.preventDefault();
  if(searchMode==="number"&&!turno.value.trim()) return;
  const searchButton=form.querySelector('button[type="submit"]');
  searchButton.disabled=true;
  results.innerHTML='<div class="empty">Ricerca in corso…</div>';
  try{
    const data=await apiRequest("/search",{
      date:date.value,
      mode:searchMode,
      period:period.value,
      query:turno.value,
      category:category.value
    });
    if(data.unavailable){
      results.innerHTML='<div class="empty">Rotazione invernale ancora non disponibile</div>';
      return;
    }
    const found=Array.isArray(data.results)?data.results:[];
    const description=searchMode==="number"?"turno "+escapeHtml(turno.value):escapeHtml(category.value.toLowerCase());
    if(!found.length){
      results.innerHTML='<div class="empty">Nessun '+description+' trovato nel periodo scelto.</div>';
      return;
    }
    let html="";
    if(period.value==="week"){
      for(let dayIndex=0;dayIndex<7;dayIndex++){
        const dayItems=found.filter(item=>item.dayIndex===dayIndex);
        if(!dayItems.length) continue;
        html+='<h2 class="day-heading">'+DAY_NAMES[dayIndex]+'</h2>';
        dayItems.forEach(item=>{html+=resultCard(item);});
      }
    }else{
      found.forEach(item=>{html+=resultCard(item);});
    }
    results.innerHTML=html;
  }catch(error){
    if(!document.body.classList.contains("locked")){
      results.innerHTML='<div class="empty">'+escapeHtml(error.message)+'</div>';
    }
  }finally{
    searchButton.disabled=false;
  }
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
const now=new Date();
date.value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
updateDateDisplay();
updateTodayHint();
updateRange();
turno.addEventListener("input",updateTurnValidity);
modeButtons.forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
date.addEventListener("change",()=>{updateDateDisplay();updateTodayHint();updateRange();});
date.addEventListener("click",()=>{
  try{
    if(typeof date.showPicker==="function") date.showPicker();
  }catch{}
});
period.addEventListener("change",updateRange);
form.addEventListener("submit",search);
setMode("number");
