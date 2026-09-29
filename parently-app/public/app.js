const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$("#view"), modal=$("#modal"), modalBody=$("#modalBody");
let state=null, route="home", familyCode=localStorage.getItem("parently_family")||"AILE2026";
let deviceMode=localStorage.getItem("parently_mode")||"parent";
let deviceProfileId=localStorage.getItem("parently_profile")||"";
let syncSource=null, saveInFlight=false, lastSyncAt=0;

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const today=()=>new Date().toISOString().slice(0,10);
const profile=id=>state.profiles.find(p=>p.id===id);
const activeChild=()=>{const p=profile(state.activeProfileId);return p?.role==="child"?p:state.profiles.find(x=>x.role==="child")||p};
const api=async(url,opt={})=>{const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text());return r.json()};
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden")}
$("#modalClose").onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};

function defaults(){
  state.points ||= {};
  state.rewards ||= [
    {id:"rw1",title:"Birlikte film seçme",cost:30,emoji:"🎬"},
    {id:"rw2",title:"Akşam oyununu seçme",cost:20,emoji:"🎲"},
    {id:"rw3",title:"Hafta sonu özel etkinlik",cost:60,emoji:"🌟"}
  ];
  state.moodStreaks ||= {};
  state.quietHours ||= {enabled:false,start:"20:30",end:"07:00"};
  state.encouragements ||= [];
  state.settings ||= {language:"tr",notifications:true,highContrast:false};
  state.membership ||= {plan:"premium",status:"active",startedAt:today(),renewalAt:""};
  state.adminConfig ||= {ageGroups:{"2-5":{enabled:true,label:"2–5 yaş"},"6-9":{enabled:true,label:"6–9 yaş"},"10-13":{enabled:true,label:"10–13 yaş"},"14-16":{enabled:true,label:"14–16 yaş"}},plans:{trial:{name:"Trial",maxParents:1,maxChildren:1,ageGroups:["2-5","6-9","10-13","14-16"],ai:false},standard:{name:"Standard",maxParents:1,maxChildren:1,ageGroups:["2-5","6-9","10-13","14-16"],ai:false},premium:{name:"Premium",maxParents:2,maxChildren:4,ageGroups:["2-5","6-9","10-13","14-16"],ai:true}}};
  state.profiles.forEach(p=>{state.points[p.id] ??= 0});
}
function applyDeviceUi(){
  if(!state)return;
  const validProfile=state.profiles?.some(p=>p.id===deviceProfileId);
  state.mode=deviceMode;
  if(validProfile)state.activeProfileId=deviceProfileId;
  else{
    const preferred=deviceMode==="child"?state.profiles?.find(p=>p.role==="child"):state.profiles?.find(p=>p.role==="parent");
    if(preferred){deviceProfileId=preferred.id;state.activeProfileId=preferred.id;localStorage.setItem("parently_profile",deviceProfileId)}
  }
}
function persistDeviceUi(){
  deviceMode=state.mode||"parent";
  deviceProfileId=state.activeProfileId||"";
  localStorage.setItem("parently_mode",deviceMode);
  localStorage.setItem("parently_profile",deviceProfileId);
}
function setSyncStatus(kind,label){
  const el=$("#syncStatus");if(!el)return;
  el.className="sync-status "+kind;
  const txt=el.querySelector("span");if(txt)txt.textContent=label;
}
function startRealtimeSync(){
  if(syncSource){syncSource.close();syncSource=null}
  try{
    setSyncStatus("connecting","Bağlanıyor");
    syncSource=new EventSource("/api/events/"+encodeURIComponent(familyCode));
    syncSource.addEventListener("ready",()=>{setSyncStatus("online","Canlı");lastSyncAt=Date.now()});
    const refresh=async()=>{
      if(saveInFlight||!modal.classList.contains("hidden"))return;
      try{
        const fresh=await api("/api/state/"+encodeURIComponent(familyCode));
        state=fresh;defaults();applyDeviceUi();lastSyncAt=Date.now();setSyncStatus("online","Canlı");render();
      }catch{setSyncStatus("offline","Bağlantı yok")}
    };
    syncSource.addEventListener("state",refresh);
    syncSource.addEventListener("message",refresh);
    syncSource.onerror=()=>setSyncStatus("offline","Yeniden bağlanıyor");
  }catch{setSyncStatus("offline","Bağlantı yok")}
}
async function load(){
  try{
    setSyncStatus("connecting","Bağlanıyor");
    state=await api("/api/state/"+encodeURIComponent(familyCode));
    defaults();applyDeviceUi();render();startRealtimeSync();pollMessages();
  }catch(e){
    setSyncStatus("offline","Bağlantı yok");
    view.innerHTML='<div class="card">Bağlantı kurulamadı. Sayfayı yenileyin.</div>';
  }
}
async function save(){
  saveInFlight=true;setSyncStatus("syncing","Kaydediliyor");
  try{
    const payload=JSON.parse(JSON.stringify(state));
    delete payload.mode;delete payload.activeProfileId;
    const fresh=await api("/api/state/"+encodeURIComponent(familyCode),{method:"PUT",body:JSON.stringify(payload)});
    state=fresh;defaults();applyDeviceUi();lastSyncAt=Date.now();setSyncStatus("online","Canlı");return state;
  }finally{saveInFlight=false}
}
function markDirty(){save().catch(()=>{setSyncStatus("offline","Kaydetme hatası");toast("Kaydetme başarısız")})}

const DEMO_CODE="DEMO2026";
function isDemo(){return familyCode===DEMO_CODE}
function dateOffset(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function buildDemoState(base){
  const demo=JSON.parse(JSON.stringify(base));
  demo.familyCode=DEMO_CODE;
  demo.familyName="Parently Demo Ailesi";
  demo.mode="parent";
  demo.pin="2026";
  demo.profiles=[
    {id:"p1",name:"Kimya",role:"parent",avatar:"K",color:"#21B889"},
    {id:"p2",name:"Fatih",role:"parent",avatar:"F",color:"#FF6255"},
    {id:"c1",name:"Çınar",role:"child",age:9,ageGroup:"6-9",avatar:"Ç",color:"#FFD75A",interests:"oyun, spor, çizim"}
  ];
  demo.activeProfileId="c1";
  demo.points={p1:0,p2:0,c1:47};
  demo.rewards=[
    {id:"rw1",title:"Akşam oyununu seçme",cost:20,emoji:"🎲"},
    {id:"rw2",title:"Birlikte film seçme",cost:35,emoji:"🎬"},
    {id:"rw3",title:"Hafta sonu özel etkinlik",cost:60,emoji:"🌟"}
  ];
  const moods=[["😊","İyi",2],["😌","Sakin",2],["😐","Normal",3],["😢","Üzgün",4],["😊","İyi",3],["😡","Kızgın",4],["😌","Sakin",2],["😊","İyi",2],["😨","Kaygılı",4],["😐","Normal",3],["😊","İyi",3],["😌","Sakin",2]];
  demo.moods=Array.from({length:30},(_,i)=>{
    const m=moods[i%moods.length];
    return {id:"dm"+i,profileId:"c1",date:dateOffset(-29+i),mood:m[0],label:m[1],intensity:m[2],note:i%5===0?"Okul ve arkadaşlarla ilgili kısa demo notu.":""}
  });
  demo.tasks=[
    {id:"dt1",title:"10 dakika özel zaman",description:"Çocuğun seçtiği etkinliği birlikte yap.",assigneeId:"c1",due:dateOffset(0),status:"pending",requiresApproval:false,type:"ritual"},
    {id:"dt2",title:"Kitap çantasını hazırla",description:"Yarın için çantanı kontrol et.",assigneeId:"c1",due:dateOffset(0),status:"submitted",requiresApproval:true,type:"task"},
    {id:"dt3",title:"Odayı 5 dakika toparla",description:"Sadece masanı ve yerdekileri toparla.",assigneeId:"c1",due:dateOffset(0),status:"done",requiresApproval:false,type:"task"},
    {id:"dt4",title:"Bir aile üyesine güzel bir şey söyle",description:"Günlük bağ görevi.",assigneeId:"c1",due:dateOffset(1),status:"pending",requiresApproval:false,type:"ritual"},
    {id:"dt5",title:"Spor çantasını hazırla",description:"Spor kıyafeti ve su şişesi.",assigneeId:"c1",due:dateOffset(2),status:"pending",requiresApproval:true,type:"task"}
  ];
  demo.rituals=[
    {id:"dr1",title:"Yatmadan önce 3 soru",days:["Pzt","Çar","Cum"],doneDates:[dateOffset(-2),dateOffset(0)]},
    {id:"dr2",title:"Günün güzel anı",days:["Her gün"],doneDates:[dateOffset(-3),dateOffset(-2),dateOffset(-1),dateOffset(0)]},
    {id:"dr3",title:"Haftalık aile oyunu",days:["Pazar"],doneDates:[]}
  ];
  demo.calendar=[
    {id:"de1",title:"Aile oyun zamanı",date:dateOffset(0),time:"19:00",type:"özel zaman"},
    {id:"de2",title:"Yüzme dersi",date:dateOffset(2),time:"16:15",type:"aktivite"},
    {id:"de3",title:"Aile yürüyüşü",date:dateOffset(4),time:"11:00",type:"aile"},
    {id:"de4",title:"Okul görüşmesi",date:dateOffset(7),time:"15:00",type:"okul"}
  ];
  const now=Date.now();
  demo.messages=[
    {id:"dmsg1",senderId:"p1",text:"Bugün okuldan sonra nasıl hissediyorsun?",at:new Date(now-1000*60*90).toISOString()},
    {id:"dmsg2",senderId:"c1",text:"İyiyim 😊 Biraz yoruldum.",at:new Date(now-1000*60*82).toISOString()},
    {id:"dmsg3",senderId:"p2",text:"Akşam aile oyunu için ben hazırım 🎲",at:new Date(now-1000*60*55).toISOString()},
    {id:"dmsg4",senderId:"c1",text:"Ben oyunu seçebilir miyim?",at:new Date(now-1000*60*50).toISOString()},
    {id:"dmsg5",senderId:"p1",text:"Tabii, bu akşam seçim senin 💚",at:new Date(now-1000*60*45).toISOString()}
  ];
  const ids=(demo.cards||[]).filter(c=>c.ageGroup==="6-9").map(c=>c.id);
  demo.completedCards=[];
  for(let i=0;i<18;i++){if(ids.length)demo.completedCards.push({id:"dcc"+i,cardId:ids[i%ids.length],profileId:"c1",date:dateOffset(-(i%14))})}
  demo.favorites=ids.slice(0,3);
  demo.cardNotes={};
  if(ids[0])demo.cardNotes[ids[0]]="İsteklerini daha açık söylemeye başladı; özellikle okul sonrası konuşmalarda.";
  if(ids[1])demo.cardNotes[ids[1]]="Kurallar konuşulurken önce fikrini sormak işe yarıyor.";
  demo.specialSessions=[
    {id:"ds1",profileId:"c1",date:new Date(now-1000*60*60*24*2).toISOString(),duration:600,note:"Birlikte lego yaptık."},
    {id:"ds2",profileId:"c1",date:new Date(now-1000*60*60*24*5).toISOString(),duration:720,note:"Kısa yürüyüş ve sohbet."},
    {id:"ds3",profileId:"c1",date:new Date(now-1000*60*60*24*8).toISOString(),duration:540,note:"Masa oyunu oynadık."}
  ];
  demo.quietHours={enabled:true,start:"20:30",end:"07:00"};
  demo.settings={language:"tr",notifications:true,highContrast:false};
  return demo;
}
async function activateDemo(reset=false){
  try{
    if(!isDemo())localStorage.setItem("parently_before_demo",familyCode);
    familyCode=DEMO_CODE;
    localStorage.setItem("parently_family",familyCode);
    let demo=await api("/api/state/"+DEMO_CODE);
    if(reset||!demo.demoSeedVersion){
      demo=buildDemoState(demo);
      demo.demoSeedVersion=2;
      state=demo;
      await save();
    }else{state=demo;defaults()}
    deviceMode="parent";deviceProfileId=state.profiles.find(p=>p.role==="parent")?.id||state.activeProfileId;applyDeviceUi();persistDeviceUi();route="home";render();startRealtimeSync();toast("Demo modu aktif");
  }catch(e){toast("Demo başlatılamadı")}
}
async function exitDemo(){
  familyCode=localStorage.getItem("parently_before_demo")||"AILE2026";
  localStorage.setItem("parently_family",familyCode);
  state=await api("/api/state/"+encodeURIComponent(familyCode));
  defaults();applyDeviceUi();route="home";render();startRealtimeSync();toast("Demo modundan çıkıldı");
}
function demoMenu(){
  if(!isDemo())return activateDemo(false);
  openModal('<h2>Demo modu</h2><p class="muted">Demo verileri gerçek aile kayıtlarından ayrıdır. Aynı DEMO2026 alanını iki cihazda açarak mesajları ve değişiklikleri birlikte test edebilirsiniz.</p><div class="list"><button id="resetDemo" class="primary full">Demo verilerini sıfırla</button><button id="exitDemo" class="secondary full">Demodan çık</button></div>');
  $("#resetDemo").onclick=async()=>{closeModal();await activateDemo(true)};
  $("#exitDemo").onclick=async()=>{closeModal();await exitDemo()};
}

function setRoute(r){route=r;$$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.route===r));render();window.scrollTo({top:0,behavior:"smooth"})}
$$(".nav-btn").forEach(b=>b.onclick=()=>setRoute(b.dataset.route));

function moodMeta(pid){
  const m=[...state.moods].filter(x=>x.profileId===pid).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const color={"😊":"#43c58a","😌":"#73c9d7","😐":"#b8aee0","😢":"#6f8edb","😡":"#ef6b72","😨":"#f0a95a"}[m?.mood]||"#cfc6e8";
  return {m,color};
}
function updateHeader(){
  const c=activeChild(), mm=moodMeta(c.id);
  $("#profileBtn").textContent=c?.avatar||"?";
  $("#profileBtn").style.boxShadow="0 0 0 4px "+mm.color+"88";
  $("#modeBtn").textContent=state.mode==="child"?"🧒 Çocuk Modu":"👨‍👩‍👧 Ebeveyn";
  const db=$("#demoBtn");if(db){db.textContent=isDemo()?"● Demo aktif":"▶ Demo";db.classList.toggle("active",isDemo());db.onclick=demoMenu;}
  $("#modeBtn").onclick=toggleMode;$("#profileBtn").onclick=profilePicker;
}
async function toggleMode(){
  if(state.mode==="parent"){
    state.mode="child";
    state.activeProfileId=activeChild()?.id||state.activeProfileId;
    persistDeviceUi();
    toast("Çocuk modu açıldı");
    render();
    return;
  }
  const demoHint=isDemo()?'<div class="demo-pin-hint">Demo PIN: <b>2026</b></div>':'';
  openModal('<h2>Ebeveyn moduna dön</h2><p class="muted">Ebeveyn alanına geçmek için PIN kodunu girin.</p>'+demoHint+'<input id="pin" class="input pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN"><div id="pinError" class="pin-error"></div><button id="pinBtn" class="primary full">Ebeveyne geç</button>');
  const submit=async()=>{
    const pin=String($("#pin").value||"").trim();
    const expected=String(state.pin||"2026").trim();
    if(pin!==expected){$("#pinError").textContent="PIN yanlış. Tekrar deneyin.";$("#pin").focus();return}
    const parent=state.profiles.find(p=>p.role==="parent");
    state.mode="parent";
    if(parent)state.activeProfileId=parent.id;
    persistDeviceUi();
    closeModal();
    route="home";
    render();
    toast("Ebeveyn modu açıldı");
  };
  $("#pinBtn").onclick=submit;
  $("#pin").onkeydown=e=>{if(e.key==="Enter")submit()};
  setTimeout(()=>$("#pin")?.focus(),50);
}
function profilePicker(){
  openModal('<h2>Kim kullanıyor?</h2><p class="muted">Ortak cihazlarda herkes kendi profilini seçebilir.</p><div class="profile-picker">'+state.profiles.map(p=>{const mm=moodMeta(p.id);return '<button class="pick-profile" data-p="'+p.id+'"><span class="halo" style="--halo:'+mm.color+'"><span style="background:'+p.color+'">'+esc(p.avatar)+'</span></span><b>'+esc(p.name)+'</b><small>'+(p.role==="child"?(p.age+" yaş"):"Ebeveyn")+'</small></button>'}).join("")+'</div>');
  $("[data-p]").forEach(b=>b.onclick=()=>{state.activeProfileId=b.dataset.p;persistDeviceUi();closeModal();render()})
}
function render(){
  if(!state)return;defaults();updateHeader();
  document.body.classList.toggle("child-mode",state.mode==="child");
  document.body.classList.toggle("parent-mode",state.mode!=="child");
  if(state.mode==="child"&&["reports","admin","indexadmin"].includes(route))route="home";
  (state.mode==="child"&&route==="home"?childHome:{home:homeView,cards:cardsView,agenda:agendaView,chat:chatView,reports:reportsView,admin:adminView,indexadmin:indexAdminView}[route]||homeView)()
}
function familyStrip(){
  return '<div class="family-strip">'+state.profiles.map(p=>{const mm=moodMeta(p.id);return '<div class="mini-person"><span class="halo small" style="--halo:'+mm.color+'"><span style="background:'+p.color+'">'+esc(p.avatar)+'</span></span><small>'+esc(p.name)+'</small></div>'}).join("")+'</div>';
}
function homeView(){
 const c=activeChild(), completed=state.completedCards.filter(x=>x.profileId===c.id).length;
 const dailyCard=state.cards.find(k=>k.ageGroup===c.ageGroup&&!state.completedCards.some(x=>x.cardId===k.id&&x.date===today()))||state.cards.find(k=>k.ageGroup===c.ageGroup);
 const moodToday=state.moods.find(m=>m.profileId===c.id&&m.date===today());
 const points=state.points[c.id]||0;
 const pending=state.tasks.filter(t=>t.assigneeId===c.id&&t.status!=="done").length;
 const approvals=state.tasks.filter(t=>t.assigneeId===c.id&&t.status==="submitted");
 const upcoming=[...state.calendar].filter(e=>e.date>=today()).sort((x,y)=>(x.date+(x.time||"")).localeCompare(y.date+(y.time||""))).slice(0,4);
 const lastMood=[...state.moods].filter(m=>m.profileId===c.id).sort((x,y)=>y.date.localeCompare(x.date))[0];
 view.innerHTML=`
 <section class="parent-overview-head">
   <div><span class="eyebrow">EBEVEYN PANELİ</span><h1>${esc(c.name)} için bugünün görünümü</h1><p>Bağ kurma, duygu, rutin ve aile planlarını tek ekranda takip edin.</p></div>
   <div class="parent-child-switch"><span style="background:${c.color}">${esc(c.avatar)}</span><div><b>${esc(c.name)}</b><small>${c.age} yaş · ${c.ageGroup}</small></div><button id="switchChild">Değiştir</button></div>
 </section>
 <div class="parent-dashboard-grid">
   <section class="parent-main-column">
     <div class="parent-kpis">
       <button class="parent-kpi" data-go="agenda"><span>Bekleyen görev</span><b>${pending}</b><small>${approvals.length} onay bekliyor</small></button>
       <button class="parent-kpi" data-go="reports"><span>Son duygu</span><b>${lastMood?.mood||"—"}</b><small>${lastMood?.label||"Kayıt yok"}</small></button>
       <button class="parent-kpi" id="rewardBtn"><span>Toplam puan</span><b>${points}</b><small>Ödül sistemi</small></button>
       <button class="parent-kpi" data-go="cards"><span>Bağ kartları</span><b>${completed}</b><small>tamamlanan</small></button>
     </div>
     ${approvals.length?'<section class="parent-alert"><div><span class="eyebrow">ONAY BEKLİYOR</span><h3>'+approvals.length+' görev sizin onayınızı bekliyor</h3></div><button class="primary" data-go="agenda">Görevleri incele</button></section>':''}
     <section class="section">
       <div class="section-head"><div><span class="eyebrow">GÜNLÜK BAĞ</span><h2>Bugünün 3 dakikası</h2></div><span class="badge">${esc(c.ageGroup)}</span></div>
       <div class="today-card premium parent-daily-card"><div class="emoji">${dailyCard?.emoji||"💜"}</div><div><div class="question">${esc(dailyCard?.question||"Bugün birbirinize güzel bir şey söyleyin.")}</div><p class="muted">${esc(dailyCard?.connectionPhrase||"Yanındayım.")}</p></div><div class="parent-daily-actions"><button class="primary" data-open-card="${dailyCard?.id||""}">Kartı aç</button><button class="secondary" data-done-card="${dailyCard?.id||""}">Tamamlandı</button></div></div>
     </section>
     <section class="section">
       <div class="section-head"><div><span class="eyebrow">BUGÜN</span><h2>Görev ve rutin akışı</h2></div><button class="small-btn" data-go="agenda">Tüm ajanda</button></div>
       <div class="timeline">${state.tasks.filter(t=>t.due===today()).slice(0,6).map(taskTimeline).join("")||'<div class="empty">Bugün için görev yok.</div>'}</div>
     </section>
   </section>
   <aside class="parent-side-column">
     <section class="parent-side-card mood-summary-card">
       <div class="section-head"><div><span class="eyebrow">DUYGU</span><h2>Bugün nasıl gidiyor?</h2></div></div>
       <div class="parent-current-mood"><strong>${moodToday?.mood||"🙂"}</strong><div><b>${moodToday?.label||"Henüz kayıt yok"}</b><small>${moodToday?.intensity?moodToday.intensity+"/5 şiddet":"Çocuk check-in yaptığında görünür"}</small></div></div>
       <div class="moods compact">${[["😊","İyi"],["😌","Sakin"],["😐","Normal"],["😢","Üzgün"],["😡","Kızgın"],["😨","Kaygılı"]].map(m=>'<button class="mood '+(moodToday?.mood===m[0]?"selected":"")+'" data-mood="'+m[0]+'" data-label="'+m[1]+'">'+m[0]+'</button>').join("")}</div>
     </section>
     <section class="parent-side-card">
       <div class="section-head"><div><span class="eyebrow">YAKLAŞAN</span><h2>Aile takvimi</h2></div></div>
       <div class="upcoming-list">${upcoming.map(e=>'<div class="upcoming-row"><div class="upcoming-date"><b>'+new Date(e.date+"T12:00:00").getDate()+'</b><span>'+new Date(e.date+"T12:00:00").toLocaleDateString("tr-TR",{month:"short"})+'</span></div><div><b>'+esc(e.title)+'</b><small>'+esc(e.time||"Tüm gün")+'</small></div></div>').join("")||'<div class="empty">Yaklaşan plan yok.</div>'}</div>
       <button class="small-btn full" data-go="agenda">Takvimi aç</button>
     </section>
     <section class="parent-side-card insight-card">
       <span class="eyebrow">HAFTALIK İÇGÖRÜ</span><h3>${esc(weeklyInsight(c))}</h3><button class="small-btn" data-go="reports">Detaylı rapor</button>
     </section>
   </aside>
 </div>`;
 bindCommon();$$("[data-mood]").forEach(b=>b.onclick=()=>moodCheckin(b.dataset.mood,b.dataset.label));
 $("#rewardBtn").onclick=rewardsModal;$("#switchChild").onclick=profilePicker;
}
function childHome(){
 const c=activeChild(), points=state.points[c.id]||0;
 const tasks=state.tasks.filter(t=>t.assigneeId===c.id&&t.status!=="done"&&t.due<=today());
 const moodToday=state.moods.find(m=>m.profileId===c.id&&m.date===today());
 const doneToday=state.tasks.filter(t=>t.assigneeId===c.id&&t.status==="done"&&t.due===today()).length;
 const nextReward=[...state.rewards].sort((a,b)=>a.cost-b.cost).find(r=>r.cost>points);
 view.innerHTML=`
 <section class="child-world">
   <div class="child-sky">
     <div class="child-greeting">
       <span class="kid-avatar halo" style="--halo:${moodMeta(c.id).color}"><span style="background:${c.color}">${esc(c.avatar)}</span></span>
       <div><span class="eyebrow">BUGÜN SENİN GÜNÜN</span><h1>Merhaba ${esc(c.name)}! 👋</h1><p>Küçük görevlerini tamamla, puanlarını topla ve ailene bir mesaj bırak.</p></div>
     </div>
     <div class="child-score-card"><span>⭐</span><b>${points}</b><small>puanım</small></div>
   </div>

   <div class="child-progress-wrap">
     <div class="child-progress-copy"><b>Bugünkü ilerlemem</b><span>${doneToday} görev tamamlandı</span></div>
     <div class="child-progress"><i style="width:${Math.min(100,doneToday*35)}%"></i></div>
     <small>${nextReward?"Sonraki ödüle "+Math.max(0,nextReward.cost-points)+" puan kaldı":"Harika gidiyorsun!"}</small>
   </div>

   <div class="kid-actions">
     <button data-mood-open class="kid-action mint">😊<b>Nasılım?</b><small>Duygumu seç</small></button>
     <button data-go="cards" class="kid-action peach">🃏<b>Kart seç</b><small>Birlikte konuşalım</small></button>
     <button data-go="chat" class="kid-action yellow">💬<b>Aileme yaz</b><small>Herkese mesaj gönder</small></button>
     <button data-calm class="kid-action blue">🌿<b>Sakinleş</b><small>Kısa mola</small></button>
   </div>

   <section class="section child-section">
     <div class="section-head"><div><span class="eyebrow">GÖREVLERİM</span><h2>Bugün ne yapacağım?</h2></div><span class="badge">${tasks.length} kaldı</span></div>
     <div class="kid-task-list">${tasks.map(t=>'<button class="kid-task" data-task="'+t.id+'"><span class="kid-task-icon">'+(t.type==="ritual"?"💜":"✅")+'</span><div><b>'+esc(t.title)+'</b><small>'+esc(t.description||"")+'</small></div><i>›</i></button>').join("")||'<div class="empty child-empty">🎉 Bugünkü görevlerin tamam!<br><small>Şimdi kendin için güzel bir şey yapabilirsin.</small></div>'}</div>
   </section>

   <section class="section child-bottom-grid">
     <div class="child-mood-card"><span class="eyebrow">BUGÜNKÜ DUYGUM</span><strong>${moodToday?moodToday.mood:"🙂"}</strong><b>${moodToday?esc(moodToday.label):"Henüz seçmedim"}</b><button class="small-btn" data-mood-open>Değiştir</button></div>
     <div class="child-reward-card"><span class="eyebrow">ÖDÜL HEDEFİM</span><strong>🎁</strong><b>${nextReward?esc(nextReward.title):"Yeni bir ödül seç"}</b><small>${nextReward?nextReward.cost+" puan":points+" puan"}</small></div>
   </section>
 </section>`;
 bindCommon();$$("[data-mood-open]").forEach(b=>b.onclick=()=>moodPickerModal());$$("[data-calm]").forEach(b=>b.onclick=calmCorner);const rewardCard=$(".child-reward-card");if(rewardCard){rewardCard.setAttribute("role","button");rewardCard.tabIndex=0;rewardCard.onclick=rewardsModal;rewardCard.onkeydown=e=>{if(e.key==="Enter"||e.key===" ")rewardsModal()}};
}
function weeklyInsight(c){
 const recent=state.moods.filter(m=>m.profileId===c.id).slice(-7);
 if(!recent.length)return "Bu hafta ilk duygu kaydınızı birlikte oluşturun.";
 const lows=recent.filter(m=>["😢","😡","😨"].includes(m.mood)).length;
 if(lows>=3)return "Bu hafta zorlayıcı duygular daha sık görünmüş. Çözüm vermeden önce dinlemek iyi bir başlangıç olabilir.";
 const positives=recent.filter(m=>["😊","😌"].includes(m.mood)).length;
 if(positives>=3)return "Bu hafta olumlu ve sakin anlar daha sık görünmüş. Bu anları neyin desteklediğini konuşabilirsiniz.";
 return "Duygular dengeli görünüyor. Günlük kısa check-in alışkanlığını sürdürmek faydalı olabilir.";
}
function moodPickerModal(){
 openModal('<h2>Bugün nasılsın?</h2><p class="muted">Bir duygu seç. Sonra ne kadar güçlü olduğunu belirleyebilirsin.</p><div class="mood-modal">'+[["😊","İyi"],["😌","Sakin"],["😐","Normal"],["😢","Üzgün"],["😡","Kızgın"],["😨","Kaygılı"]].map(m=>'<button data-mm="'+m[0]+'" data-ml="'+m[1]+'">'+m[0]+'<small>'+m[1]+'</small></button>').join("")+'</div>');
 $$("[data-mm]").forEach(b=>b.onclick=()=>moodCheckin(b.dataset.mm,b.dataset.ml));
}
function moodCheckin(mood,label){
 closeModal();
 openModal('<h2>'+mood+' '+esc(label)+'</h2><p class="muted">Bu duygu ne kadar güçlü?</p><div class="intensity" id="intensity">'+[1,2,3,4,5].map(n=>'<button data-int="'+n+'">'+n+'<small>'+["Çok az","Az","Orta","Güçlü","Çok güçlü"][n-1]+'</small></button>').join("")+'</div><textarea id="moodNote" rows="3" placeholder="İstersen kısa bir not ekle..."></textarea><button id="moodSave" class="primary full">Kaydet</button>');
 let intensity=3;$$("[data-int]").forEach(b=>b.onclick=()=>{intensity=+b.dataset.int;$$("[data-int]").forEach(x=>x.classList.toggle("active",x===b))});
 $("#moodSave").onclick=()=>{const c=activeChild();state.moods=state.moods.filter(m=>!(m.profileId===c.id&&m.date===today()));state.moods.push({id:"m"+Date.now(),profileId:c.id,date:today(),mood,label,intensity,note:$("#moodNote").value});state.points[c.id]=(state.points[c.id]||0)+2;markDirty();closeModal();toast("Duygu kaydedildi +2 puan");render()}
}
function rewardsModal(){
 const c=activeChild(), pts=state.points[c.id]||0;
 openModal('<h2>🎁 Ödüller</h2><p class="muted">'+esc(c.name)+' şu anda <b>'+pts+' puana</b> sahip.</p><div class="list">'+state.rewards.map(r=>'<div class="item row space"><div><b>'+r.emoji+' '+esc(r.title)+'</b><div class="muted">'+r.cost+' puan</div></div><button class="small-btn" data-redeem="'+r.id+'" '+(pts<r.cost?"disabled":"")+'>Kullan</button></div>').join("")+'</div>');
 $$("[data-redeem]").forEach(b=>b.onclick=()=>{const r=state.rewards.find(x=>x.id===b.dataset.redeem);if((state.points[c.id]||0)<r.cost)return;state.points[c.id]-=r.cost;markDirty();toast("Ödül kullanıldı 🎉");rewardsModal()})
}
function calmCorner(){
 openModal('<h2>🌿 Sakin Köşe</h2><p class="muted">Terapi yerine geçmez; kısa öz-düzenleme araçlarıdır.</p><div class="calm-grid"><button id="breath">🌬️<b>4–4 nefes</b><small>4 sn al · 4 sn ver</small></button><button id="ground">👣<b>5-4-3-2-1</b><small>Duyularına dön</small></button><button id="pause">💧<b>Kısa mola</b><small>Su iç · omuzlarını bırak</small></button></div><div id="calmText" class="calm-panel">Bir araç seç.</div>');
 $("#breath").onclick=()=>runBreath();$("#ground").onclick=()=>$("#calmText").innerHTML="<b>5 şey gör</b><br>4 şeye dokun<br>3 şey duy<br>2 şey kokla<br>1 şey tat veya hayal et.";$("#pause").onclick=()=>$("#calmText").innerHTML="<b>30 saniyelik mola</b><br>Ayaklarını yere koy. Omuzlarını gevşet. Bir yudum su iç. Sonra yeniden başla.";
}
function runBreath(){let n=0;const el=$("#calmText");const id=setInterval(()=>{el.innerHTML='<div class="breath-orb '+(n%2?"out":"in")+'"></div><b>'+(n%2?"Nefesi ver…":"Nefes al…")+'</b>';n++;if(n>7){clearInterval(id);el.innerHTML="<b>Tamamlandı 🌿</b><br>Şimdi bedeninde ne değiştiğini fark et."}},4000)}

function bindCommon(){
 $$("[data-go]").forEach(b=>b.onclick=()=>setRoute(b.dataset.go));
 $$("[data-open-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.openCard));
 $$("[data-done-card]").forEach(b=>b.onclick=()=>completeCard(b.dataset.doneCard));
 $$("[data-special]").forEach(b=>b.onclick=specialTime);
 $$("[data-task]").forEach(b=>b.onclick=()=>taskAction(b.dataset.task));
}
let cardFilter="Tümü", ageFilter="";
function cardsView(){
 const c=activeChild();if(!ageFilter)ageFilter=c.ageGroup;
 const cats=["Tümü",...new Set(state.cards.map(c=>c.category))], visible=state.cards.filter(k=>(ageFilter==="Tümü"||k.ageGroup===ageFilter)&&(cardFilter==="Tümü"||k.category===cardFilter));
 view.innerHTML='<div class="section-head"><div><h2>Kart Kütüphanesi</h2><span class="muted">Soru · Rehber · Pekiştirme · Ritüel</span></div><button class="small-btn" id="favOnly">⭐ Favoriler</button></div><div class="filters">'+["Tümü","2-5","6-9","10-13","14-16"].map(a=>'<button class="filter '+(ageFilter===a?"active":"")+'" data-age="'+a+'">'+a+'</button>').join("")+'</div><div class="filters">'+cats.map(a=>'<button class="filter '+(cardFilter===a?"active":"")+'" data-cat="'+esc(a)+'">'+esc(a)+'</button>').join("")+'</div><div class="grid">'+visible.map(cardTile).join("")+'</div>';
 $$("[data-age]").forEach(b=>b.onclick=()=>{ageFilter=b.dataset.age;render()});$$("[data-cat]").forEach(b=>b.onclick=()=>{cardFilter=b.dataset.cat;render()});$$("[data-open-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.openCard));
 $("#favOnly").onclick=()=>{view.querySelector(".grid").innerHTML=state.cards.filter(k=>state.favorites.includes(k.id)).map(cardTile).join("")||'<div class="empty">Henüz favori yok.</div>';$$("[data-open-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.openCard))}
}
function cardTile(k){return '<div class="card card-tile clickable" data-open-card="'+k.id+'"><div><div class="row space"><span class="emoji">'+k.emoji+'</span><span>'+(state.favorites.includes(k.id)?"⭐":"")+'</span></div><span class="badge">'+esc(k.category)+'</span><h3>'+esc(k.question)+'</h3></div><span class="muted">'+k.ageGroup+' · Zorluk '+k.difficulty+'/3</span></div>'}
function openCard(id){
 const k=state.cards.find(x=>x.id===id);if(!k)return;
 if(state.mode==="child"){openModal('<div class="emoji">'+k.emoji+'</div><h2>'+esc(k.question)+'</h2><p>'+esc(k.followUp)+'</p><button id="childDone" class="primary full">Bunu konuştuk ✓</button>');$("#childDone").onclick=()=>{completeCard(id);closeModal()};return}
 const note=state.cardNotes[id]||"";
 openModal('<div class="row space"><div><span class="badge">'+esc(k.category)+'</span><h2 style="margin:8px 0">'+k.emoji+' '+esc(k.question)+'</h2></div><button id="favBtn" class="small-btn">'+(state.favorites.includes(id)?"⭐ Favoride":"☆ Favoriye ekle")+'</button></div><p><b>Takip sorusu:</b> '+esc(k.followUp)+'</p><div class="tabs"><button class="active" data-tab="guide">Rehber</button><button data-tab="reinforce">Pekiştirme</button><button data-tab="ritual">Ritüel</button></div><div id="tabText" class="item">'+esc(k.parentGuide)+'</div><label class="muted block">Özel ebeveyn notu</label><textarea id="cardNote" rows="3" placeholder="Sadece ebeveynler görür...">'+esc(note)+'</textarea><div class="row wrap topgap"><button id="saveCard" class="primary">Kaydet</button><button id="doneCard" class="secondary">✓ Tamamlandı</button></div>');
 const texts={guide:k.parentGuide,reinforce:k.positiveReinforcement,ritual:k.connectionPhrase};
 $$("[data-tab]").forEach(b=>b.onclick=()=>{$$("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#tabText").textContent=texts[b.dataset.tab]});
 $("#favBtn").onclick=()=>{state.favorites.includes(id)?state.favorites=state.favorites.filter(x=>x!==id):state.favorites.push(id);markDirty();openCard(id)};
 $("#saveCard").onclick=()=>{state.cardNotes[id]=$("#cardNote").value;markDirty();toast("Not kaydedildi")};$("#doneCard").onclick=()=>{completeCard(id);closeModal()}
}
function completeCard(id){const c=activeChild();state.completedCards.push({id:"cc"+Date.now(),cardId:id,profileId:c.id,date:today()});state.points[c.id]=(state.points[c.id]||0)+3;markDirty();toast("Bağ anı kaydedildi +3 puan");render()}

function taskTimeline(t){const ass=profile(t.assigneeId);return '<div class="timeline-item"><span class="timeline-dot '+t.status+'"></span><div><b>'+esc(t.title)+'</b><small>'+esc(ass?.name||"Aile")+' · '+esc(t.due)+'</small></div><button class="small-btn" data-task="'+t.id+'">'+(t.status==="submitted"&&state.mode==="parent"?"Onayla":t.status==="done"?"✓":"Tamamla")+'</button></div>'}
function taskHtml(t){const ass=profile(t.assigneeId);return '<div class="item"><div class="row space"><div><div class="title">'+esc(t.title)+'</div><div class="muted">'+esc(ass?.name||"Aile")+' · '+esc(t.due)+'</div></div><span class="status '+t.status+'">'+({pending:"Bekliyor",submitted:"Onay bekliyor",done:"Tamamlandı"}[t.status]||t.status)+'</span></div><p class="muted">'+esc(t.description||"")+'</p><button class="small-btn" data-task="'+t.id+'">'+(t.status==="submitted"&&state.mode==="parent"?"Onayla":t.status==="done"?"Geri al":"Tamamla")+'</button></div>'}
function agendaView(){
 view.innerHTML='<div class="section-head"><div><h2>Ajanda & Görevler</h2><span class="muted">Aile gününü tek yerde gör</span></div><button class="primary" id="newTask">+ Yeni</button></div><div class="week-strip">'+weekDays()+'</div><section class="section"><div class="section-head"><h2>Görevler</h2></div><div class="list">'+state.tasks.map(taskHtml).join("")+'</div></section><section class="section"><div class="section-head"><h2>Ritüeller</h2></div><div class="grid">'+state.rituals.map(r=>'<div class="card"><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(r.days.join(", "))+'</p><button class="small-btn" data-ritual="'+r.id+'">'+(r.doneDates.includes(today())?"✓ Bugün yapıldı":"Bugün yaptık")+'</button></div>').join("")+'</div></section><section class="section"><div class="section-head"><h2>Planlananlar</h2><button class="secondary" id="newEvent">Takvime ekle</button></div><div class="list">'+state.calendar.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>'<div class="item row space"><div><b>'+esc(e.title)+'</b><div class="muted">'+esc(e.date)+' '+esc(e.time||"")+'</div></div><span class="badge">'+esc(e.type||"etkinlik")+'</span></div>').join("")+'</div></section>';
 bindCommon();$("#newTask").onclick=newTask;$("#newEvent").onclick=newEvent;$$("[data-ritual]").forEach(b=>b.onclick=()=>{const r=state.rituals.find(x=>x.id===b.dataset.ritual);r.doneDates.includes(today())?r.doneDates=r.doneDates.filter(d=>d!==today()):r.doneDates.push(today());markDirty();render()});
}
function weekDays(){const d=new Date();return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);const ds=x.toISOString().slice(0,10);return '<div class="day '+(ds===today()?"today":"")+'"><b>'+x.toLocaleDateString("tr-TR",{weekday:"short"})+'</b><span>'+x.getDate()+'</span><small>'+state.calendar.filter(e=>e.date===ds).length+' plan</small></div>'}).join("")}
function newTask(){openModal('<h2>Yeni görev</h2><input id="tt" class="input" placeholder="Görev başlığı"><textarea id="td" rows="3" placeholder="Açıklama"></textarea><div class="form-grid"><input id="due" class="input" type="date" value="'+today()+'"><select id="assignee">'+state.profiles.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")+'</select></div><label class="check"><input id="approval" type="checkbox"> Çocuk tamamlayınca ebeveyn onayı iste</label><button id="addTask" class="primary full">Ekle</button>');$("#addTask").onclick=()=>{if(!$("#tt").value.trim())return toast("Başlık yazın");state.tasks.push({id:"t"+Date.now(),title:$("#tt").value.trim(),description:$("#td").value.trim(),assigneeId:$("#assignee").value,due:$("#due").value,status:"pending",requiresApproval:$("#approval").checked,type:"task"});markDirty();closeModal();render()}}
function newEvent(){openModal('<h2>Takvime ekle</h2><input id="et" class="input" placeholder="Başlık"><div class="form-grid"><input id="ed" class="input" type="date" value="'+today()+'"><input id="etime" class="input" type="time"></div><button id="addEvent" class="primary full">Ekle</button>');$("#addEvent").onclick=()=>{state.calendar.push({id:"e"+Date.now(),title:$("#et").value||"Aile etkinliği",date:$("#ed").value,time:$("#etime").value,type:"etkinlik"});markDirty();closeModal();render()}}
function taskAction(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;const before=t.status;if(t.status==="done")t.status="pending";else if(t.requiresApproval&&state.mode==="child")t.status="submitted";else if(t.status==="submitted"&&state.mode==="parent")t.status="done";else t.status=t.requiresApproval?"submitted":"done";if(before!=="done"&&t.status==="done"){state.points[t.assigneeId]=(state.points[t.assigneeId]||0)+5;toast("Görev tamamlandı +5 puan")}markDirty();render()}

let timerInterval=null;
function specialTime(){let seconds=600;openModal('<h2>⏱️ 10 Dakika Özel Zaman</h2><div class="special-reminders"><span>👂 Çocuğun liderliğini takip et</span><span>🧩 Düzeltmeyi azalt</span><span>✨ Olumluyu fark et</span></div><div id="timer" class="timer">10:00</div><textarea id="sessionNote" rows="3" placeholder="Bu seanstan kısa bir not..."></textarea><div class="row wrap"><button id="startTimer" class="primary">Başlat</button><button id="finishTimer" class="secondary">Bitir & Kaydet</button></div>');$("#startTimer").onclick=()=>{clearInterval(timerInterval);timerInterval=setInterval(()=>{seconds--;$("#timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");if(seconds<=0){clearInterval(timerInterval);toast("10 dakika tamamlandı 💜")}},1000)};$("#finishTimer").onclick=()=>{clearInterval(timerInterval);state.specialSessions.push({id:"s"+Date.now(),profileId:activeChild().id,date:new Date().toISOString(),duration:600-seconds,note:$("#sessionNote").value});state.points[activeChild().id]=(state.points[activeChild().id]||0)+5;markDirty();closeModal();toast("Özel zaman kaydedildi +5 puan")}}

function chatView(){
 const me=state.mode==="child"?activeChild():(profile(state.activeProfileId)?.role==="parent"?profile(state.activeProfileId):state.profiles.find(p=>p.role==="parent")||profile(state.activeProfileId));
 const messages=state.messages||[], quiet=state.quietHours.enabled;
 const members=state.profiles.map(p=>'<div class="chat-member"><span style="background:'+p.color+'">'+esc(p.avatar)+'</span><div><b>'+esc(p.name)+'</b><small>'+(p.role==="child"?"Çocuk":"Ebeveyn")+'</small></div></div>').join("");
 const recentCount=messages.filter(m=>Date.now()-new Date(m.at).getTime()<86400000).length;
 view.innerHTML=`
 <div class="family-chat-layout">
   <aside class="family-chat-sidebar">
     <div class="family-chat-title"><span class="eyebrow">AİLE GRUBU</span><h2>${esc(state.familyName||"Bizim Aile")}</h2><p>Evdeki herkes aynı sohbet alanında.</p></div>
     <div class="family-code-box"><span>Aile kodu</span><b>${esc(familyCode)}</b><button id="familyCodeBtn">Değiştir</button></div>
     <div class="chat-member-list"><h3>Aile üyeleri</h3>${members}</div>
     <div class="chat-summary"><b>${recentCount}</b><span>son 24 saatte mesaj</span></div>
   </aside>
   <section class="family-chat-main">
     <div class="family-chat-head">
       <div><span class="eyebrow">TOPLU SOHBET</span><h2>Ailece mesajlaşma</h2><p class="muted">Mesajı gönderdiğinde tüm aile üyeleri aynı akışta görür.</p></div>
       ${quiet?'<span class="quiet-chip">🌙 '+state.quietHours.start+'–'+state.quietHours.end+'</span>':''}
     </div>
     <div id="chatBox" class="chat-box family-group-chat">${messages.map(m=>{
       const p=profile(m.senderId);
       return '<div class="group-message '+(m.senderId===me.id?"me":"")+'"><span class="group-avatar" style="background:'+(p?.color||"#21B889")+'">'+esc(p?.avatar||"?")+'</span><div class="group-bubble"><div class="group-name">'+esc(p?.name||"Aile")+'</div><div>'+esc(m.text)+'</div><div class="meta">'+new Date(m.at).toLocaleString("tr-TR")+'</div></div></div>'
     }).join("")}</div>
     <div class="chat-compose">
       <div class="compose-who">Gönderen: <b>${esc(me.name)}</b>${state.mode==="parent"?'<button id="changeSender" class="sender-change">Değiştir</button>':""}</div>
       <div class="chat-send"><input id="msg" class="input" placeholder="Ailene bir mesaj yaz..."><button id="send" class="primary">Herkese gönder</button></div>
     </div>
   </section>
 </div>`;
 const box=$("#chatBox");box.scrollTop=box.scrollHeight;
 $("#send").onclick=async()=>{const text=$("#msg").value.trim();if(!text)return;await api("/api/message/"+encodeURIComponent(familyCode),{method:"POST",body:JSON.stringify({senderId:me.id,text})});$("#msg").value="";await refreshMessages()};
 $("#msg").onkeydown=e=>{if(e.key==="Enter")$("#send").click()};
 $("#familyCodeBtn").onclick=changeFamilyCode;
 const changeSender=$("#changeSender");
 if(changeSender)changeSender.onclick=()=>{openModal('<h2>Mesajı kim gönderiyor?</h2><p class="muted">Ebeveyn profilini seçin.</p><div class="profile-picker">'+state.profiles.filter(p=>p.role==="parent").map(p=>'<button class="pick-profile" data-sender="'+p.id+'"><span class="profile-dot" style="background:'+p.color+'">'+esc(p.avatar)+'</span><b>'+esc(p.name)+'</b></button>').join("")+'</div>');$$("[data-sender]").forEach(b=>b.onclick=()=>{state.activeProfileId=b.dataset.sender;persistDeviceUi();closeModal();chatView()})};
}
async function refreshMessages(){try{const fresh=await api("/api/state/"+encodeURIComponent(familyCode));state.messages=fresh.messages||[];if(route==="chat")chatView()}catch{}}
function pollMessages(){setInterval(()=>{if(route==="chat")refreshMessages()},3500)}
function changeFamilyCode(){openModal('<h2>Aile kodu</h2><p class="muted">Başka cihazda aynı kodu yazarak aynı aile alanına bağlanabilirsiniz.</p><input id="fc" class="input" value="'+esc(familyCode)+'"><button id="fcSave" class="primary full">Bağlan</button>');$("#fcSave").onclick=()=>{const v=$("#fc").value.toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,30);if(!v)return;familyCode=v;localStorage.setItem("parently_family",v);closeModal();load();toast("Aile alanı değiştirildi")}}

let reportDays=7;
function reportsView(){
 const c=activeChild();
 const allMoods=state.moods.filter(x=>x.profileId===c.id);
 const last7Dates=Array.from({length:reportDays},(_,i)=>{const d=new Date();d.setDate(d.getDate()-((reportDays-1)-i));return d.toISOString().slice(0,10)});
 const weekMoods=allMoods.filter(m=>last7Dates.includes(m.date));
 const weekCards=state.completedCards.filter(x=>x.profileId===c.id&&last7Dates.includes(x.date));
 const childTasks=state.tasks.filter(x=>x.assigneeId===c.id);
 const doneTasks=childTasks.filter(x=>x.status==="done").length;
 const completionRate=childTasks.length?Math.round(doneTasks/childTasks.length*100):0;
 const sessions=state.specialSessions.filter(x=>x.profileId===c.id);
 const points=state.points[c.id]||0;
 const avgIntensity=weekMoods.length?(weekMoods.reduce((a,m)=>a+(m.intensity||3),0)/weekMoods.length).toFixed(1):"—";
 const moodCounts={};weekMoods.forEach(m=>moodCounts[m.mood]=(moodCounts[m.mood]||0)+1);
 const topMood=Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
 const categories={};weekCards.forEach(x=>{const k=state.cards.find(ca=>ca.id===x.cardId);if(k)categories[k.category]=(categories[k.category]||0)+1});
 const topCategory=Object.entries(categories).sort((a,b)=>b[1]-a[1])[0]?.[0]||"Henüz yok";
 const noteCount=Object.values(state.cardNotes||{}).filter(Boolean).length;
 const sessionMinutes=Math.round(sessions.reduce((a,x)=>a+(x.duration||0),0)/60);
 view.innerHTML=`
 <div class="report-period-tabs"><button data-period="7" class="${reportDays===7?"active":""}">7 gün</button><button data-period="30" class="${reportDays===30?"active":""}">30 gün</button><button data-period="90" class="${reportDays===90?"active":""}">90 gün</button></div><div class="report-header">
   <div><span class="eyebrow">EBEVEYN RAPORU</span><h1>${esc(c.name)} için gelişim ve bağ özeti</h1><p>Bu ekran tanı koymaz; aile içindeki duygu, rutin ve bağ kurma alışkanlıklarını görünür kılar.</p></div>
   <div class="report-actions"><button id="exportBtn" class="small-btn">Veriyi dışa aktar</button><button id="printBtn" class="primary">PDF / Yazdır</button></div>
 </div>

 <div class="report-kpis">
   <div class="report-kpi"><span>Duygu check-in</span><b>${weekMoods.length}</b><small>seçili dönem</small></div>
   <div class="report-kpi"><span>Bağ kartı</span><b>${weekCards.length}</b><small>tamamlanan</small></div>
   <div class="report-kpi"><span>Görev tamamlama</span><b>%${completionRate}</b><small>${doneTasks}/${childTasks.length} görev</small></div>
   <div class="report-kpi"><span>Özel zaman</span><b>${sessionMinutes}</b><small>dakika</small></div>
   <div class="report-kpi"><span>Puan</span><b>${points}</b><small>toplam</small></div>
 </div>

 <div class="report-grid two">
   <section class="card report-panel">
     <div class="report-panel-head"><div><span class="eyebrow">DUYGU</span><h3>Duygu görünümü</h3></div><span class="report-pill">Ort. şiddet: ${avgIntensity}/5</span></div>
     <div class="week-moods">${last7MoodCells(c.id)}</div>
     <div class="report-mini-grid"><div><span>En sık duygu</span><b>${topMood}</b></div><div><span>Kayıt sayısı</span><b>${weekMoods.length}</b></div></div>
   </section>

   <section class="card report-panel">
     <div class="report-panel-head"><div><span class="eyebrow">BAĞLANTI</span><h3>Bu hafta öne çıkan tema</h3></div></div>
     <div class="big-highlight">${esc(topCategory)}</div>
     <p class="muted">Tamamlanan konuşma kartlarına göre hesaplanır.</p>
     <div class="theme-list">${Object.entries(categories).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,n])=>'<div><span>'+esc(k)+'</span><b>'+n+'</b></div>').join("")||'<div class="empty">Henüz yeterli kart verisi yok.</div>'}</div>
   </section>
 </div>

 <div class="report-grid three">
   <section class="card report-panel"><span class="eyebrow">RUTİN</span><h3>Görev ve sorumluluklar</h3><div class="donut-wrap"><div class="donut" style="--pct:${completionRate}"><b>%${completionRate}</b></div><div><p><b>${doneTasks}</b> tamamlandı</p><p><b>${childTasks.filter(t=>t.status==="submitted").length}</b> onay bekliyor</p><p><b>${childTasks.filter(t=>t.status==="pending").length}</b> bekliyor</p></div></div></section>
   <section class="card report-panel"><span class="eyebrow">ÖZEL ZAMAN</span><h3>Birlikte geçirilen süre</h3><div class="report-number">${sessionMinutes}<small> dakika</small></div><p class="muted">${sessions.length} kayıtlı özel zaman oturumu</p></section>
   <section class="card report-panel"><span class="eyebrow">EBEVEYN NOTLARI</span><h3>Takip edilen gözlemler</h3><div class="report-number">${noteCount}<small> not</small></div><p class="muted">Kartlar üzerinden kaydettiğiniz özel ebeveyn notları.</p></section>
 </div>

 <section class="card report-panel insight-panel">
   <div><span class="eyebrow">BU HAFTA DİKKAT ÇEKEN</span><h3>${esc(weeklyInsight(c))}</h3><p class="muted">Bu yorum yalnızca Parently içindeki aile kayıtlarının basit özetidir; klinik değerlendirme değildir.</p></div>
 </section>

 <section class="card report-panel">
   <div class="report-panel-head"><div><span class="eyebrow">NOTLAR</span><h3>Ebeveyn gözlem notları</h3></div><button id="settingsBtn" class="secondary">Profil & Ayarlar</button></div>
   <div class="notes-report">${Object.entries(state.cardNotes||{}).filter(x=>x[1]).map(([id,n])=>'<div class="note-row"><b>'+esc(state.cards.find(ca=>ca.id===id)?.category||"Kart")+'</b><p>'+esc(n)+'</p></div>').join("")||'<div class="empty">Henüz ebeveyn notu yok.</div>'}</div>
 </section>`;
 $("#printBtn").onclick=()=>window.print();$("#exportBtn").onclick=exportJson;$("#settingsBtn").onclick=settingsModal;$$("[data-period]").forEach(b=>b.onclick=()=>{reportDays=+b.dataset.period;reportsView()});
}
function last7MoodCells(pid){const n=Math.min(reportDays,14);return Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-((n-1)-i));const ds=d.toISOString().slice(0,10),m=state.moods.find(x=>x.profileId===pid&&x.date===ds);return '<div class="mood-day"><small>'+d.toLocaleDateString("tr-TR",{weekday:"short"})+'</small><b>'+(m?.mood||"·")+'</b><span>'+(m?.intensity?m.intensity+"/5":"")+'</span></div>'}).join("")}
function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="parently-"+familyCode+".json";a.click();URL.revokeObjectURL(a.href)}
function settingsModal(){
 openModal('<h2>Profil & Ayarlar</h2><p class="muted">Aile: '+esc(state.familyName)+' · Kod: '+esc(familyCode)+'</p><div class="list">'+state.profiles.map(p=>'<div class="item profile-card"><span class="profile-dot" style="background:'+p.color+'33;color:'+p.color+'">'+esc(p.avatar)+'</span><div><b>'+esc(p.name)+'</b><div class="muted">'+esc(p.role)+(p.age?" · "+p.age+" yaş":"")+'</div></div></div>').join("")+'</div><label class="muted block">Ebeveyn PIN</label><input id="newPin" class="input" value="'+esc(state.pin)+'"><div class="item settings-row"><div><b>🌙 Sessiz saatler</b><div class="muted">Aile mesaj bildirimlerini sakin tut</div></div><input id="qh" type="checkbox" '+(state.quietHours.enabled?"checked":"")+'></div><div class="form-grid"><input id="qs" class="input" type="time" value="'+state.quietHours.start+'"><input id="qe" class="input" type="time" value="'+state.quietHours.end+'"></div><label class="muted block">JSON içe aktar</label><input id="importFile" type="file" accept="application/json" class="input"><button id="saveSettings" class="primary full">Ayarları kaydet</button>');
 $("#saveSettings").onclick=()=>{state.pin=$("#newPin").value||"2026";state.quietHours={enabled:$("#qh").checked,start:$("#qs").value,end:$("#qe").value};markDirty();closeModal();toast("Ayarlar kaydedildi")};$("#importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);defaults();markDirty();closeModal();render();toast("Yedek yüklendi")}catch{toast("Geçersiz dosya")}};r.readAsText(f)}
}

let homeSlidesCache=null;
async function optimizeImageDataUrl(source,{maxW=1600,maxH=1600,quality=.82}={}){
  if(!source||!String(source).startsWith("data:image/"))return source;
  try{
    if(String(source).length<420000)return source;
    const blob=await (await fetch(source)).blob();
    const bitmap=await createImageBitmap(blob);
    const scale=Math.min(1,maxW/bitmap.width,maxH/bitmap.height);
    const w=Math.max(1,Math.round(bitmap.width*scale));
    const h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{alpha:true});
    ctx.drawImage(bitmap,0,0,w,h);
    bitmap.close?.();
    return canvas.toDataURL("image/webp",quality);
  }catch(e){
    console.warn("image optimization skipped",e);
    return source;
  }
}
async function optimizeImageFile(file,opts){
  const raw=await new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result||""));
    r.onerror=reject;
    r.readAsDataURL(file);
  });
  return optimizeImageDataUrl(raw,opts);
}
async function optimizeIndexMedia(config){
  if(!config)return config;
  const jobs=[];
  const add=(getter,setter,opts)=>{
    const v=getter();
    if(v&&String(v).length>420000)jobs.push(optimizeImageDataUrl(v,opts).then(setter));
  };
  add(()=>config.branding?.logoImage,v=>config.branding.logoImage=v,{maxW:700,maxH:300,quality:.86});
  add(()=>config.demoPng,v=>config.demoPng=v,{maxW:1400,maxH:1400,quality:.86});
  add(()=>config.storyImage,v=>config.storyImage=v,{maxW:1600,maxH:1200,quality:.82});
  (config.slides||[]).forEach((s)=>add(()=>s.image,v=>s.image=v,{maxW:1600,maxH:1600,quality:.84}));
  (config.sections?.features?.items||[]).forEach((x)=>add(()=>x.image,v=>x.image=v,{maxW:1400,maxH:1200,quality:.82}));
  if(jobs.length)await Promise.all(jobs);
  return config;
}
function indexAdminFallback(){
  return {
    branding:{name:"Parently",tagline:"Aile bağını güçlendir",logoImage:""},
    navigation:{how:"Nasıl çalışır?",cards:"Kartları keşfet",features:"Özellikler",pricing:"Planlar",contact:"İletişim",app:"Uygulamaya Gir"},
    demoPng:"",storyImage:"",
    slides:[
      {id:"slide-1",badge:"Aile içinde yakınlığa küçük bir alan açın",title:"Bir soru sor.",highlight:"Birbirinizi yeniden keşfedin.",description:"Yoğun günlerin içinde konuşmaya nereden başlayacağınızı düşünmeyin.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Nasıl çalışır?",secondaryUrl:"#how",image:""}
    ],
    sections:{
      strip:{title:"Birlikte geçirilen zaman, küçük anlarda büyür.",meta:"Kartlar · Rutinler · Aile ajandası"},
      how:{eyebrow:"Nasıl çalışır?",title:"Başlamak için uzun bir plan yapmanız gerekmiyor.",description:"Bir kart seçin, birbirinizi dinleyin ve iyi gelen anları tekrar edin.",noteLabel:"3 adım",noteText:"Küçük ritüeller, güçlü bağlar.",steps:[
        {icon:"✦",label:"SOHBET",title:"Yaşa uygun bir kart seçin",description:"Çocuğunuzun dünyasına yakın bir soruyla sohbeti açın."},
        {icon:"◌",label:"DİNLEME",title:"Herkese söz verin",description:"Doğru cevap aramadan, merakla ve sırayla dinleyin."},
        {icon:"◷",label:"RUTİN",title:"Küçük bir alışkanlık oluşturun",description:"Günün size uygun bir anını aile zamanı olarak ayırın."}
      ]},
      cards:{eyebrow:"Kartları keşfet",title:"İlk soruyu şimdi deneyin.",description:"Yaş grubunu seçip yeni bir soru açın.",emptyTitle:"PNG alanı",emptyDescription:"Yönetim panelinden şeffaf PNG yükleyin."},
      features:{eyebrow:"Parently ile",title:"Günlük hayatın içinde birbirinize yaklaşın.",description:"Bir uygulama, ailenizin yerini tutmaz.",items:[
        {symbol:"✳",title:"Sohbet kartları",description:"Farklı yaşlara uygun sorularla konuşmaya başlayın.",label:"Bir soruyla başlayın ♡",copy:"Yaşa uygun sorularla sohbeti başlatın.",image:""},
        {symbol:"◷",title:"Aile rutinleri",description:"Birlikte yapmak istediklerinize zaman ayırın.",label:"Küçük rutinleri koruyun ◷",copy:"Birlikte yapmak istediğiniz küçük şeylere zaman ayırın.",image:""},
        {symbol:"▤",title:"Ortak ajanda",description:"Aile planlarını tek yerde görün.",label:"Aile planları tek yerde ▤",copy:"Aile planlarını tek yerde görün.",image:""}
      ]},
      pricing:{eyebrow:"Planlar",title:"Ailenize uygun başlangıcı seçin.",description:"Planlar lansman öncesi taslak olarak gösterilmektedir.",noteLabel:"Esnek başlangıç",noteText:"İhtiyacınıza göre büyütün.",plans:[
        {icon:"✦",tag:"Başlangıç",name:"Demo",price:"Ücretsiz",description:"Parently deneyimini tanımak için.",features:["Temel kartlar"],button:"Demoyu aç",url:"/panel.html"},
        {icon:"♡",tag:"Önerilen",name:"Aile",price:"Yakında",description:"Tam aile deneyimi için planlanan paket.",features:["Tüm kartlar ve aktiviteler"],button:"Erken erişim",url:"#contact"},
        {icon:"◎",tag:"Uzmanlar",name:"Profesyonel",price:"Yakında",description:"Uzmanlar ve kurumlar için genişletilmiş yapı.",features:["Gelişmiş raporlama"],button:"Bilgi al",url:"#contact"}
      ]},
      closing:{eyebrow:"Bir soru yeter",title:"Bu akşam nasıl bir sohbet başlatacaksınız?",description:"Parently’yi deneyin veya erken erişim hakkında bilgi alın.",button:"Uygulamaya Gir",url:"/panel.html"},
      footer:{description:"Birlikte konuşmaya küçük bir başlangıç."}
    }
  };
}
function mergeIndexAdmin(base,extra){
  if(Array.isArray(base)){
    if(!Array.isArray(extra))return base;
    return base.map((v,i)=>extra[i]===undefined?v:mergeIndexAdmin(v,extra[i])).concat(extra.slice(base.length));
  }
  if(base&&typeof base==="object"){
    const out={...base};
    if(extra&&typeof extra==="object")Object.entries(extra).forEach(([k,v])=>{out[k]=k in base?mergeIndexAdmin(base[k],v):v});
    return out;
  }
  return extra===undefined?base:extra;
}
async function loadHomeSlidesAdmin(){
  const pageHost=$("#indexGeneralAdmin");
  const sliderHost=$("#homeSliderAdmin");
  homeSlidesCache=mergeIndexAdmin(indexAdminFallback(),homeSlidesCache||{});
  if(pageHost){
    try{renderIndexGeneralAdmin();renderHomeSlidesAdmin()}catch(e){console.error("index fallback render failed",e)}
  }else if(sliderHost){
    try{renderHomeSlidesAdmin()}catch(e){console.error("slider fallback render failed",e)}
  }
  try{
    const r=await fetch("/api/site/home?admin=1&t="+Date.now(),{cache:"no-store",headers:{"Accept":"application/json"}});
    if(!r.ok)throw new Error("site_home_http_"+r.status);
    const remote=await r.json();
    homeSlidesCache=mergeIndexAdmin(indexAdminFallback(),remote||{});
    if($("#indexGeneralAdmin")){renderIndexGeneralAdmin();renderHomeSlidesAdmin()}
    else if($("#homeSliderAdmin"))renderHomeSlidesAdmin();
  }catch(e){
    console.error("index admin load failed",e);
    const target=$("#indexGeneralAdmin")||$("#homeSliderAdmin");
    if(target)target.insertAdjacentHTML("afterbegin",'<div class="upload-danger" id="indexLoadWarning">Sunucu verisi alınamadı; düzenleme alanları yine açık. Kaydetmeden önce bağlantıyı kontrol edin.</div>');
  }
}
function renderHomeSlidesAdmin(){
  const host=$("#homeSliderAdmin");
  if(!host||!homeSlidesCache)return;
  if(!Array.isArray(homeSlidesCache.slides))homeSlidesCache.slides=[];
  const slides=homeSlidesCache.slides;

  host.innerHTML=
    '<div class="home-slider-toolbar"><div><span class="eyebrow">SLIDER YÖNETİMİ</span><h3>'+slides.length+' slide</h3><p class="muted">Her slide için farklı görsel, başlık, açıklama ve buton ayarlayın.</p></div><button id="addHomeSlide" class="primary" type="button">+ Slide ekle</button></div>'+
    '<div class="home-slider-admin-grid">'+slides.map((s,i)=>{
      return `<article class="home-slide-editor" data-slide-editor="${i}">
        <div class="slide-text-editor-head">
          <div><span class="slide-index">SLIDE ${i+1}</span><h3>${esc(s.highlight||s.title||("Slide "+(i+1)))}</h3></div>
          <span class="media-status ${s.image?"ok":"empty"}">${s.image?"Görsel üstte yüklendi":"Üstte görsel seçin"}</span>
        </div>

        <label>Üst etiket<input class="input" data-slide-field="badge" value="${esc(s.badge||"")}"></label>
        <label>Ana başlık<input class="input" data-slide-field="title" value="${esc(s.title||"")}"></label>
        <label>Vurgulu başlık<input class="input" data-slide-field="highlight" value="${esc(s.highlight||"")}"></label>
        <label>Açıklama<textarea class="input slide-textarea" data-slide-field="description">${esc(s.description||"")}</textarea></label>

        <div class="slide-two-col">
          <label>1. Buton<input class="input" data-slide-field="primaryLabel" value="${esc(s.primaryLabel||"")}"></label>
          <label>1. Link<input class="input" data-slide-field="primaryUrl" value="${esc(s.primaryUrl||"")}"></label>
        </div>
        <div class="slide-two-col">
          <label>2. Buton<input class="input" data-slide-field="secondaryLabel" value="${esc(s.secondaryLabel||"")}"></label>
          <label>2. Link<input class="input" data-slide-field="secondaryUrl" value="${esc(s.secondaryUrl||"")}"></label>
        </div>

        <div class="slide-editor-footer">
          <small>Önerilen: 1600×1600 px · 1:1 · transparan PNG önerilir.</small>
          <button class="danger-link" data-slide-delete="${i}" type="button" ${slides.length<=1?"disabled":""}>Slide’ı sil</button>
        </div>
      </article>`;
    }).join("")+'</div>'+
    '<div class="home-slider-save"><button id="saveHomeSlides" class="primary" type="button">Ana sayfa ayarlarını kaydet ve yayınla</button><small>Slide sayısı otomatik algılanır. Her slide kendi görselini kullanır ve ana sayfadaki noktalar slide sayısına göre oluşur.</small></div>';

  $$("[data-slide-editor]").forEach(card=>{
    const i=Number(card.dataset.slideEditor);
    card.querySelectorAll("[data-slide-field]").forEach(el=>{
      el.oninput=()=>{homeSlidesCache.slides[i][el.dataset.slideField]=el.value};
    });
  });

  $("[data-slide-file]").forEach(inp=>inp.onchange=()=>{
    const i=Number(inp.dataset.slideFile);
    readImage(inp,"slides."+i+".image","Slide "+(i+1)+" görseli");
  });

  $("[data-slide-image-remove]").forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.slideImageRemove);
    try{
      await saveIndexMedia("slides."+i+".image","");
      renderIndexGeneralAdmin();renderHomeSlidesAdmin();
      toast("Slide "+(i+1)+" görseli kaldırıldı");
    }catch(err){console.error(err);toast("Slide görseli kaldırılamadı")}
  });

  $$("[data-slide-delete]").forEach(btn=>btn.onclick=()=>{
    if(homeSlidesCache.slides.length<=1)return;
    const i=Number(btn.dataset.slideDelete);
    homeSlidesCache.slides.splice(i,1);
    renderHomeSlidesAdmin();
    toast("Slide kaldırıldı. Kaydettiğinizde yayınlanacak.");
  });

  const add=$("#addHomeSlide");
  if(add)add.onclick=()=>{
    if(homeSlidesCache.slides.length>=12){toast("En fazla 12 slide ekleyebilirsiniz.");return}
    const n=homeSlidesCache.slides.length+1;
    homeSlidesCache.slides.push({
      id:"slide-"+n,
      badge:"Yeni slide",
      title:"Yeni başlık",
      highlight:"Vurgulu metin.",
      description:"Bu slide için açıklamanızı yazın.",
      primaryLabel:"Uygulamaya Gir",
      primaryUrl:"/panel.html",
      secondaryLabel:"Daha fazla bilgi",
      secondaryUrl:"#features",
      image:""
    });
    renderHomeSlidesAdmin();
    toast("Yeni slide eklendi. Görselini seçip kaydedin.");
  };

  $("#saveHomeSlides").onclick=async()=>{
    const btn=$("#saveHomeSlides");
    try{
      btn.disabled=true;
      btn.textContent="Hazırlanıyor...";
      await optimizeIndexMedia(homeSlidesCache);
      btn.textContent="Kaydediliyor...";
      homeSlidesCache=await api("/api/site/home",{
        method:"PUT",
        body:JSON.stringify({familyCode,pin:String(state.pin||""),config:homeSlidesCache})
      });
      renderHomeSlidesAdmin();
      toast("Ana sayfa sliderı yayınlandı");
    }catch(e){
      console.error(e);
      toast("Slider kaydedilemedi");
    }finally{
      const b=$("#saveHomeSlides");if(b){b.disabled=false;b.textContent="Ana sayfa ayarlarını kaydet ve yayınla"}
    }
  };
}


function sitePathGet(obj,path){
  return String(path||"").split(".").reduce((a,k)=>a==null?undefined:a[k],obj);
}
function sitePathSet(obj,path,value){
  const parts=String(path||"").split(".");
  let cur=obj;
  parts.forEach((k,i)=>{
    const last=i===parts.length-1;
    const key=/^\d+$/.test(k)?Number(k):k;
    if(last)cur[key]=value;
    else{
      const next=parts[i+1],arr=/^\d+$/.test(next);
      if(cur[key]==null)cur[key]=arr?[]:{};
      cur=cur[key];
    }
  });
}
function indexField(path,label,type="input"){
  const v=esc(sitePathGet(homeSlidesCache,path)||"");
  return '<label class="index-field"><span>'+esc(label)+'</span>'+(type==="textarea"?'<textarea class="input" data-site-path="'+path+'">'+v+'</textarea>':'<input class="input" data-site-path="'+path+'" value="'+v+'">')+'</label>';
}
async function saveIndexMedia(path,image){
  const result=await api("/api/site/home/media",{
    method:"PUT",
    body:JSON.stringify({familyCode,pin:String(state?.pin||""),path,image:String(image||"")})
  });
  if(!result?.ok)throw new Error("site_media_save_failed");
  sitePathSet(homeSlidesCache,path,String(image||""));
  return result;
}
async function saveSingleSlideImage(index,image){
  return saveIndexMedia("slides."+index+".image",image);
}
async function saveIndexConfigNow(message="Index kaydedildi"){
  if(!homeSlidesCache)return false;
  try{
    await optimizeIndexMedia(homeSlidesCache);
    homeSlidesCache=await api("/api/site/home",{
      method:"PUT",
      body:JSON.stringify({familyCode,pin:String(state.pin||""),config:homeSlidesCache})
    });
    toast(message);
    return true;
  }catch(e){
    console.error("index autosave failed",e);
    toast("Görsel sunucuya kaydedilemedi");
    return false;
  }
}
function renderIndexGeneralAdmin(){
  const host=$("#indexGeneralAdmin");
  if(!host||!homeSlidesCache)return;
  const b=homeSlidesCache.branding||{};
  const s=homeSlidesCache.sections||{};
  homeSlidesCache.slides=Array.isArray(homeSlidesCache.slides)?homeSlidesCache.slides:[];
  while(homeSlidesCache.slides.length<3){
    const n=homeSlidesCache.slides.length+1;
    homeSlidesCache.slides.push({
      id:"slide-"+n,badge:"Slide "+n,title:"Yeni başlık",highlight:"Vurgulu metin.",
      description:"Bu slide için açıklamanızı yazın.",
      primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",
      secondaryLabel:"Daha fazla bilgi",secondaryUrl:"#features",image:""
    });
  }

  const mediaControl=(id,title,help,value,accept="image/png,image/jpeg,image/webp",story=false,spec="")=>
    '<div class="index-media-control"><div class="index-media-preview '+(story?"story ":"")+(value?"has-image":"")+'">'+(value?'<img src="'+esc(value)+'" alt="'+esc(title)+' önizleme">':'<div class="media-empty-preview"><span>＋</span><b>Görsel yok</b></div>')+'</div><div class="index-media-copy"><div class="media-title-row"><b>'+esc(title)+'</b><span class="media-status '+(value?'ok':'empty')+'">'+(value?'Yüklendi':'Boş')+'</span></div><small>'+esc(help)+'</small>'+(spec?'<div class="media-spec">'+spec+'</div>':'')+'</div><label class="upload-button">Görsel seç<input id="'+id+'" type="file" accept="'+accept+'" hidden></label><button class="secondary" data-remove-media="'+id+'" type="button" '+(value?'':'disabled')+'>Görseli kaldır</button></div>';

  host.innerHTML=
    '<section class="index-order-card card admin-panel"><div class="index-order-badge">01</div><div class="admin-panel-head"><div><span class="eyebrow">ÜST ALAN</span><h2>Logo, marka ve menü</h2><p class="muted">Index sayfasında en üstte görünen alan.</p></div></div>'+
      '<div class="index-brand-grid"><div>'+indexField("branding.name","Marka adı")+indexField("branding.tagline","Alt slogan")+'</div>'+
      mediaControl("indexLogoFile","Logo","Boş bırakırsanız mevcut Parently işareti kullanılır.",b.logoImage,"image/png,image/jpeg,image/webp",false,'<b>Önerilen:</b> 600 × 220 px · <b>Format:</b> PNG / WebP · <b>Şeffaf:</b> Evet')+'</div>'+
      '<div class="index-editor-block"><h3>Menü metinleri</h3><div class="index-field-grid">'+indexField("navigation.how","Nasıl çalışır")+indexField("navigation.cards","Kartları keşfet")+indexField("navigation.features","Özellikler")+indexField("navigation.pricing","Planlar")+indexField("navigation.contact","İletişim")+indexField("navigation.app","Uygulama butonu")+'</div></div>'+
    '</section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">02</div><div class="admin-panel-head"><div><span class="eyebrow">HERO</span><h2>Slider</h2><p class="muted">3 slide için 3 ayrı görsel yükleyin. Slide değişince Index’te sağdaki görsel de değişir.</p></div></div>'+
      '<div class="hero-image-upload-grid">'+homeSlidesCache.slides.slice(0,3).map((sl,i)=>{return '<div class="hero-image-upload-card"><div class="hero-image-upload-preview '+(sl.image?'has-image':'')+'">'+(sl.image?'<img src="'+esc(sl.image)+'" alt="Slide '+(i+1)+' önizleme">':'<div class="media-empty-preview"><span>＋</span><b>SLIDE '+(i+1)+' GÖRSELİ YOK</b></div>')+'</div><div class="media-title-row"><b>Slide '+(i+1)+' görseli</b><span class="media-status '+(sl.image?'ok':'empty')+'">'+(sl.image?'Yüklendi':'Boş')+'</span></div><small>Bu resim yalnızca Slide '+(i+1)+' aktifken görünür.</small><div class="media-spec"><b>Önerilen:</b> 1600 × 1600 px · <b>Oran:</b> 1:1 · <b>Format:</b> PNG / WebP / JPG · <b>Şeffaf PNG:</b> desteklenir</div><label class="upload-button hero-image-upload-button">Görsel seç<input type="file" data-hero-image-file="'+i+'" accept="image/jpeg,image/png,image/webp" hidden></label><button class="secondary" type="button" data-hero-image-remove="'+i+'">Görseli kaldır</button></div>';}).join("")+'</div>'+
      '<div class="index-editor-block"><h3>Slide metinleri ve butonları</h3><div id="homeSliderAdmin"></div></div></section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">03</div><div class="admin-panel-head"><div><span class="eyebrow">BİLGİ ŞERİDİ</span><h2>Koyu şerit</h2></div></div><div class="index-field-grid">'+indexField("sections.strip.title","Ana metin")+indexField("sections.strip.meta","Yan metin")+'</div></section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">04</div><div class="admin-panel-head"><div><span class="eyebrow">NASIL ÇALIŞIR?</span><h2>3 adım bölümü</h2><p class="muted">İkonlar da kendi adımlarının içinde düzenlenir.</p></div></div>'+
      '<div class="index-field-grid">'+indexField("sections.how.eyebrow","Etiket")+indexField("sections.how.title","Başlık")+indexField("sections.how.description","Açıklama","textarea")+indexField("sections.how.noteLabel","Kısa etiket")+indexField("sections.how.noteText","Kısa mesaj")+'</div>'+
      '<div class="index-repeat-grid">'+(s.how?.steps||[]).map((_,i)=>'<div class="index-repeat-card"><b>Adım '+(i+1)+'</b>'+indexField("sections.how.steps."+i+".icon","İkon")+indexField("sections.how.steps."+i+".label","Etiket")+indexField("sections.how.steps."+i+".title","Başlık")+indexField("sections.how.steps."+i+".description","Açıklama","textarea")+'</div>').join("")+'</div>'+
    '</section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">05</div><div class="admin-panel-head"><div><span class="eyebrow">KARTLARI KEŞFET</span><h2>Metinler ve PNG</h2><p class="muted">Şeffaf PNG görseli burada yönetilir; arka zemin görünür kalır.</p></div></div>'+
      '<div class="index-field-grid">'+indexField("sections.cards.eyebrow","Etiket")+indexField("sections.cards.title","Başlık")+indexField("sections.cards.description","Açıklama","textarea")+indexField("sections.cards.emptyTitle","Boş alan başlığı")+indexField("sections.cards.emptyDescription","Boş alan açıklaması")+'</div>'+
      mediaControl("demoPngFile","Şeffaf PNG","Kartları keşfet bölümündeki sağ görsel alanı.",""+(homeSlidesCache.demoPng||""),"image/png",true,'<b>Önerilen:</b> 1600 × 1600 px · <b>Oran:</b> 1:1 · <b>Format:</b> PNG · <b>Zemin:</b> transparan kalır')+
    '</section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">06</div><div class="admin-panel-head"><div><span class="eyebrow">ÖZELLİKLER</span><h2>Parently ile</h2><p class="muted">Büyük görsel ve üç özellik satırı burada birlikte yönetilir.</p></div></div>'+
      '<div class="index-field-grid">'+indexField("sections.features.eyebrow","Etiket")+indexField("sections.features.title","Başlık")+indexField("sections.features.description","Başlangıç açıklaması","textarea")+'</div>'+
      mediaControl("storyImageFile","Büyük bölüm görseli","Aile veya uygulama görselinizi yükleyin.",homeSlidesCache.storyImage||"","image/png,image/jpeg,image/webp",true,'<b>Önerilen:</b> 1600 × 1600 px · <b>Oran:</b> 1:1 · <b>Format:</b> PNG / WebP · <b>Şeffaf PNG:</b> zemin görünür')+
      '<div class="index-repeat-grid feature-admin-grid">'+(s.features?.items||[]).map((item,i)=>'<div class="index-repeat-card"><b>Özellik '+(i+1)+'</b>'+mediaControl("featureImageFile"+i,"Hover resmi","Mouse bu özelliğin üzerine gelince soldaki büyük alanda bu resim gösterilir.",item.image||"","image/png,image/jpeg,image/webp",true,'<b>Önerilen:</b> 1600 × 1600 px · <b>Oran:</b> 1:1 · <b>Format:</b> PNG / WebP · <b>Şeffaf:</b> zemin görünür')+indexField("sections.features.items."+i+".symbol","İkon")+indexField("sections.features.items."+i+".title","Başlık")+indexField("sections.features.items."+i+".description","Kısa açıklama")+indexField("sections.features.items."+i+".label","Görsel etiketi")+indexField("sections.features.items."+i+".copy","Hover açıklaması","textarea")+'</div>').join("")+'</div>'+
    '</section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">07</div><div class="admin-panel-head"><div><span class="eyebrow">FİYATLANDIRMA</span><h2>Planlar</h2><p class="muted">Her planın ikonu, metinleri ve butonu kendi kartında.</p></div></div>'+
      '<div class="index-field-grid">'+indexField("sections.pricing.eyebrow","Etiket")+indexField("sections.pricing.title","Başlık")+indexField("sections.pricing.description","Açıklama")+indexField("sections.pricing.noteLabel","Yan etiket")+indexField("sections.pricing.noteText","Yan mesaj")+'</div>'+
      '<div class="index-repeat-grid">'+(s.pricing?.plans||[]).map((p,i)=>'<div class="index-repeat-card"><b>Plan '+(i+1)+'</b>'+indexField("sections.pricing.plans."+i+".icon","İkon")+indexField("sections.pricing.plans."+i+".tag","Etiket")+indexField("sections.pricing.plans."+i+".name","Ad")+indexField("sections.pricing.plans."+i+".price","Fiyat")+indexField("sections.pricing.plans."+i+".description","Açıklama","textarea")+indexField("sections.pricing.plans."+i+".button","Buton")+indexField("sections.pricing.plans."+i+".url","Buton linki")+'<label class="index-field"><span>Özellikler (satır satır)</span><textarea class="input" data-plan-features="'+i+'">'+esc((p.features||[]).join("\n"))+'</textarea></label></div>').join("")+'</div>'+
    '</section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">08</div><div class="admin-panel-head"><div><span class="eyebrow">KAPANIŞ</span><h2>Son çağrı alanı</h2></div></div><div class="index-field-grid">'+indexField("sections.closing.eyebrow","Etiket")+indexField("sections.closing.title","Başlık")+indexField("sections.closing.description","Açıklama","textarea")+indexField("sections.closing.button","Buton")+indexField("sections.closing.url","Buton linki")+'</div></section>'+

    '<section class="index-order-card card admin-panel"><div class="index-order-badge">09</div><div class="admin-panel-head"><div><span class="eyebrow">FOOTER</span><h2>Alt alan</h2></div></div><div class="index-field-grid">'+indexField("sections.footer.description","Footer açıklaması")+'</div></section>';

  $$("[data-site-path]").forEach(el=>el.oninput=()=>sitePathSet(homeSlidesCache,el.dataset.sitePath,el.value));
  $$("[data-plan-features]").forEach(el=>el.oninput=()=>{const i=Number(el.dataset.planFeatures);sitePathSet(homeSlidesCache,"sections.pricing.plans."+i+".features",el.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))});

  const readImage=async(input,path,label,requirePng=false)=>{
    const file=input?.files?.[0];if(!file)return;
    if(requirePng&&file.type!=="image/png"){toast("Bu alan için PNG seçin");input.value="";return}
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type||"")){toast("PNG, JPG veya WebP seçin");input.value="";return}
    if(file.size>5*1024*1024){toast("Görsel 5 MB'dan küçük olmalı");input.value="";return}
    try{
      toast(label+" yükleniyor...");
      const raw=await new Promise((resolve,reject)=>{
        const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=reject;r.readAsDataURL(file);
      });
      await saveIndexMedia(path,raw);
      renderIndexGeneralAdmin();
      renderHomeSlidesAdmin();
      toast(label+" kaydedildi");
    }catch(e){
      console.error("media upload failed",path,e);
      toast(label+" kaydedilemedi");
    }
  };

  $("#indexLogoFile")&&( $("#indexLogoFile").onchange=()=>readImage($("#indexLogoFile"),"branding.logoImage","Logo") );
  $("#demoPngFile")&&( $("#demoPngFile").onchange=()=>readImage($("#demoPngFile"),"demoPng","PNG",true) );
  $("#storyImageFile")&&( $("#storyImageFile").onchange=()=>readImage($("#storyImageFile"),"storyImage","Bölüm görseli") );
  (s.features?.items||[]).forEach((_,i)=>{
    const input=$("#featureImageFile"+i);
    if(input)input.onchange=()=>readImage(input,"sections.features.items."+i+".image","Özellik "+(i+1)+" resmi");
  });

  $$("[data-hero-image-file]").forEach(inp=>inp.onchange=()=>{
    const i=Number(inp.dataset.heroImageFile);
    readImage(inp,"slides."+i+".image","Slide "+(i+1)+" görseli");
  });

  $$("[data-hero-image-remove]").forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.heroImageRemove);
    try{
      await saveIndexMedia("slides."+i+".image","");
      renderIndexGeneralAdmin();renderHomeSlidesAdmin();
      toast("Slide "+(i+1)+" görseli kaldırıldı");
    }catch(err){console.error(err);toast("Slide görseli kaldırılamadı")}
  });

  $$("[data-remove-media]").forEach(btn=>btn.onclick=async()=>{
    let path="";
    if(btn.dataset.removeMedia==="indexLogoFile")path="branding.logoImage";
    if(btn.dataset.removeMedia==="demoPngFile")path="demoPng";
    if(btn.dataset.removeMedia==="storyImageFile")path="storyImage";
    if(/^featureImageFile\d+$/.test(btn.dataset.removeMedia)){
      const i=Number(btn.dataset.removeMedia.replace("featureImageFile",""));
      path="sections.features.items."+i+".image";
    }
    if(!path)return;
    try{
      await saveIndexMedia(path,"");
      renderIndexGeneralAdmin();renderHomeSlidesAdmin();
      toast("Görsel kaldırıldı");
    }catch(err){console.error(err);toast("Görsel kaldırılamadı")}
  });
}
function indexAdminView(){
  if(state.mode!=="parent"){route="home";render();return}
  view.innerHTML=
    '<section class="admin-head"><div><span class="eyebrow">INDEX</span><h1>Ön site yönetimi</h1><p>Alanlar index sayfasındaki sırayla dizildi. Logo, ikon, metin ve görselleri hangi bölümde görünüyorsa aynı bölümden düzenleyin.</p></div><div class="admin-head-actions"><a class="secondary" href="/" target="_blank">Index’i aç ↗</a><button id="indexSaveAll" class="primary">Tüm Index’i kaydet</button></div></section>'+
    '<div class="index-admin-order-note"><b>Index sırası:</b> Üst alan → Slider → Bilgi şeridi → Nasıl çalışır → Kartları keşfet → Özellikler → Fiyatlandırma → Kapanış → Footer</div>'+
    '<div id="indexGeneralAdmin"></div>';
  loadHomeSlidesAdmin().then(()=>{
    const saveBtn=$("#indexSaveAll");
    if(saveBtn)saveBtn.onclick=async()=>{
      try{
        saveBtn.disabled=true;saveBtn.textContent="Hazırlanıyor...";
        await optimizeIndexMedia(homeSlidesCache);
        saveBtn.textContent="Kaydediliyor...";
        homeSlidesCache=await api("/api/site/home",{method:"PUT",body:JSON.stringify({familyCode,pin:String(state.pin||""),config:homeSlidesCache})});
        renderIndexGeneralAdmin();renderHomeSlidesAdmin();toast("Index yayınlandı");
      }catch(e){
        console.error(e);toast("Index kaydedilemedi");
      }finally{
        const b=$("#indexSaveAll");if(b){b.disabled=false;b.textContent="Tüm Index’i kaydet"}
      }
    };
  });
}

function adminView(){
  if(state.mode!=="parent"){route="home";render();return}
  const groups=state.adminConfig.ageGroups,plans=state.adminConfig.plans;
  const counts=Object.keys(groups).map(g=>({g,n:state.cards.filter(c=>c.ageGroup===g).length}));
  const plan=plans[state.membership.plan]||plans.premium;
  const last=state.adminConfig.lastCsvImport;
  view.innerHTML=
    '<section class="admin-head"><div><span class="eyebrow">YÖNETİM PANELİ</span><h1>Parently içerik ve üyelik yönetimi</h1><p>Yaş gruplarını, kartları, veri aktarımını ve paket erişimlerini buradan yönetin.</p></div><div class="admin-head-actions"><button id="adminCsvOut" class="secondary">Kart CSV</button><button id="adminJsonOut" class="primary">JSON yedek</button></div></section>'+
    '<div class="admin-kpis"><div><span>Toplam kart</span><b>'+state.cards.length+'</b></div><div><span>Aktif yaş grubu</span><b>'+Object.values(groups).filter(x=>x.enabled).length+'</b></div><div><span>Ebeveyn</span><b>'+state.profiles.filter(p=>p.role==="parent").length+'</b></div><div><span>Çocuk</span><b>'+state.profiles.filter(p=>p.role==="child").length+'</b></div><div><span>Paket</span><b class="plan-word">'+esc(plan.name)+'</b></div></div>'+
    '<div class="admin-grid">'+
      '<section class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">İÇERİK</span><h2>Yaş grubuna göre kartlar</h2></div><button id="adminNewCard" class="primary" type="button">+ Kart ekle</button></div><div class="age-admin-grid">'+counts.map(x=>'<button class="age-admin-card" data-admin-age="'+x.g+'"><span>'+esc(groups[x.g].label)+'</span><b>'+x.n+' kart</b></button>').join("")+'</div></section>'+
      '<section class="card admin-panel"><span class="eyebrow">VERİ AKTARIMI</span><h2>CSV / JSON yükle</h2><p class="muted">Dosyayı seçin, satır sayısını kontrol edin ve onayladıktan sonra aktarın.</p>'+(isDemo()?'<div class="upload-danger"><b>⚠ Demo modu aktif</b><br>Buraya yüklenen kartlar yalnızca DEMO2026 alanına gider. Gerçek kartlar için önce Demo modundan çıkın.</div>':'<div class="last-import"><b>✓ Gerçek aile alanı</b><small>'+esc(familyCode)+' · Yüklenen kartlar kalıcı DB kaydına gider.</small></div>')+
      (last?'<div class="last-import"><b>Son CSV: '+last.count+' kart yüklendi</b><small>'+esc(last.fileName||"")+'</small></div>':'')+
      '<label class="admin-upload"><div><b>CSV kart dosyası</b><small>Yaş grubu, kategori, soru ve rehber alanlarını toplu yükleyin.</small></div><span class="upload-button">CSV Dosyası Seç</span><input id="adminCsvIn" type="file" accept=".csv,text/csv" hidden></label><div id="csvPreview" class="upload-preview hidden"></div>'+
      '<label class="admin-upload"><div><b>JSON veri dosyası</b><small>Aile, profil, kart, görev, mesaj ve ayar verilerini içe aktarın.</small></div><span class="upload-button">JSON Dosyası Seç</span><input id="adminJsonIn" type="file" accept=".json,application/json" hidden></label><div id="jsonPreview" class="upload-preview hidden"></div></section>'+
    '</div>'+

    '<section class="card admin-panel section"><div class="admin-panel-head"><div><span class="eyebrow">YAŞ GRUPLARI</span><h2>İçerik grupları</h2></div></div><div class="age-toggle-list">'+Object.entries(groups).map(([g,c])=>'<label class="age-toggle-row"><div><b>'+esc(c.label)+'</b><small>'+g+' içerikleri</small></div><input type="checkbox" data-age-toggle="'+g+'" '+(c.enabled?"checked":"")+'></label>').join("")+'</div></section>'+
    '<section class="card admin-panel section"><div class="admin-panel-head"><div><span class="eyebrow">ÜYELİKLER</span><h2>Paket ve erişim matrisi</h2></div><select id="adminPlanSelect" class="membership-select">'+Object.entries(plans).map(([id,p])=>'<option value="'+id+'" '+(state.membership.plan===id?"selected":"")+'>'+esc(p.name)+'</option>').join("")+'</select></div><div class="plans-grid">'+Object.entries(plans).map(([id,p])=>'<div class="plan-admin-card '+(state.membership.plan===id?"current":"")+'"><h3>'+esc(p.name)+'</h3><div class="plan-limits"><span><b>'+p.maxParents+'</b> ebeveyn</span><span><b>'+p.maxChildren+'</b> çocuk</span><span><b>'+(p.ai?"✓":"—")+'</b> AI</span></div><p class="muted">Yaş grubu erişimi</p><div class="plan-age-access">'+Object.keys(groups).map(g=>'<label><input type="checkbox" data-plan="'+id+'" data-plan-age="'+g+'" '+(p.ageGroups.includes(g)?"checked":"")+'>'+esc(groups[g].label)+'</label>').join("")+'</div></div>').join("")+'</div></section>';

  $("#adminJsonOut").onclick=async()=>{
    try{
      const site=await api("/api/site/home");
      const bundle={schema:"parently-full-backup",version:2,exportedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(state)),site};
      downloadAdmin("parently-full-export.json",JSON.stringify(bundle,null,2),"application/json");
      toast("Panel + Index + dil paketleri birlikte indirildi");
    }catch{toast("Tam JSON yedeği hazırlanamadı")}
  };
  $("#adminCsvOut").onclick=()=>exportCardsCsv();
  $("#adminPlanSelect").onchange=e=>{state.membership.plan=e.target.value;markDirty();adminView()};
  $$("[data-age-toggle]").forEach(el=>el.onchange=()=>{state.adminConfig.ageGroups[el.dataset.ageToggle].enabled=el.checked;markDirty()});
  $$("[data-plan-age]").forEach(el=>el.onchange=()=>{const p=state.adminConfig.plans[el.dataset.plan],g=el.dataset.planAge;p.ageGroups=el.checked?[...new Set(p.ageGroups.concat(g))]:p.ageGroups.filter(x=>x!==g);markDirty()});
  $$("[data-admin-age]").forEach(el=>el.onclick=()=>{ageFilter=el.dataset.adminAge;cardFilter="Tümü";setRoute("cards")});
}
function downloadAdmin(name,text,type){
  const blob=new Blob([text],{type:type}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);
}
function exportCardsCsv(){
  const cols=["ageGroup","category","emoji","question","followUp","parentGuide","positiveReinforcement","connectionPhrase","difficulty"];
  const q=v=>{const x=String(v??"");return /[",\n]/.test(x)?'"'+x.replaceAll('"','""')+'"':x};
  const rows=[cols.join(",")].concat(state.cards.map(c=>cols.map(k=>q(c[k])).join(",")));
  downloadAdmin("parently-cards.csv",rows.join("\n"),"text/csv");
}
function adminNewCard(){
  openModal(
    '<div class="admin-card-modal">'+
    '<span class="eyebrow">YENİ İÇERİK</span><h2>Kart ekle</h2><p class="muted">Kartın yaş grubunu seçin ve içerik alanlarını doldurun.</p>'+
    '<label>Yaş grubu</label><select id="adminAge" class="input"><option value="2-5">2–5 yaş</option><option value="6-9">6–9 yaş</option><option value="10-13">10–13 yaş</option><option value="14-16">14–16 yaş</option></select>'+
    '<div class="form-grid"><div><label>Kategori</label><input id="adminCat" class="input" placeholder="Örn. Güven ve Bağ"></div><div><label>Emoji</label><input id="adminEmoji" class="input" value="💬"></div></div>'+
    '<label>Ana soru</label><textarea id="adminQuestion" class="input" rows="3" placeholder="Çocuğa sorulacak ana soru"></textarea>'+
    '<label>Takip sorusu</label><textarea id="adminFollowUp" class="input" rows="2"></textarea>'+
    '<label>Ebeveyn rehberi</label><textarea id="adminGuide" class="input" rows="3"></textarea>'+
    '<label>Pekiştirme cümlesi</label><textarea id="adminReinforcement" class="input" rows="2"></textarea>'+
    '<label>Bağ cümlesi</label><textarea id="adminConnection" class="input" rows="2"></textarea>'+
    '<label>Zorluk</label><select id="adminDifficulty" class="input"><option value="1">1 · Kolay</option><option value="2">2 · Orta</option><option value="3">3 · Derin</option></select>'+
    '<div class="modal-actions"><button type="button" data-admin-cancel class="secondary">İptal</button><button type="button" id="adminCardSave" class="primary">Kartı kaydet</button></div>'+
    '</div>'
  );
}
function parseAdminCsv(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted;
    }else if(ch===","&&!quoted){row.push(field);field="";
    }else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&text[i+1]==="\n")i++;
      row.push(field);field="";
      if(row.some(v=>String(v).trim()!==""))rows.push(row);
      row=[];
    }else field+=ch;
  }
  row.push(field);
  if(row.some(v=>String(v).trim()!==""))rows.push(row);
  return rows;
}
function normalizeCsvHeader(h){
  const k=String(h||"").trim().toLowerCase().replace(/[ _-]+/g,"");
  const map={agegroup:"ageGroup","yaşgrubu":"ageGroup",yasgrubu:"ageGroup",category:"category",kategori:"category",emoji:"emoji",question:"question",soru:"question",anasoru:"question",followup:"followUp",takipsorusu:"followUp",parentguide:"parentGuide",ebeveynrehberi:"parentGuide",rehber:"parentGuide",positivereinforcement:"positiveReinforcement","pekiştirme":"positiveReinforcement",pekistirme:"positiveReinforcement",connectionphrase:"connectionPhrase","bağcümlesi":"connectionPhrase",bagcumlesi:"connectionPhrase",difficulty:"difficulty",zorluk:"difficulty"};
  return map[k]||String(h||"").trim();
}
function previewCardsCsv(file){
  if(!file)return;
  if(isDemo()){
    $("#adminCsvIn").value="";
    return toast("Demo modunda CSV yüklenmez. Önce Demo modundan çıkın.");
  }
  const r=new FileReader();
  r.onload=()=>{
    try{
      const matrix=parseAdminCsv(String(r.result));
      if(matrix.length<2)throw new Error("empty");
      const head=matrix[0].map(normalizeCsvHeader);
      if(!head.includes("ageGroup")||!head.includes("question"))throw new Error("missing_columns");
      const rawRows=matrix.slice(1);
      const rows=rawRows.map(vals=>{const o={};head.forEach((h,i)=>o[h]=vals[i]??"");return o}).filter(o=>String(o.ageGroup||"").trim()&&String(o.question||"").trim());
      const box=$("#csvPreview");if(!box)return;
      box.classList.remove("hidden");
      box._rows=rows;box._rawCount=rawRows.length;box._fileName=file.name;
      box.innerHTML='<div class="upload-preview-head"><div><b>'+esc(file.name)+'</b><small>Toplam '+rawRows.length+' satır okundu · '+rows.length+' kart içe aktarılabilir</small></div><span class="file-type">CSV</span></div>'+
        '<div class="csv-count-banner"><b>'+rows.length+'</b><span>kart hazır</span></div>'+
        '<div class="preview-table">'+rows.slice(0,5).map(o=>'<div><span>'+esc(o.ageGroup)+'</span><b>'+esc(o.category||"Kategori yok")+'</b><small>'+esc(o.question)+'</small></div>').join("")+'</div>'+
        '<div class="upload-actions"><button type="button" id="cancelCsvImport" class="secondary">İptal</button><button type="button" id="confirmCsvImport" class="primary">'+rows.length+' kartı aktar</button></div>';
    }catch(e){toast(e.message==="missing_columns"?"CSV içinde ageGroup/yaş grubu ve question/soru kolonları bulunamadı":"CSV okunamadı")}
  };
  r.readAsText(file);
}
async function commitCardsCsv(rows,meta={}){
  if(!rows?.length)return toast("Aktarılacak kart bulunamadı");
  const stamp=Date.now();
  rows.forEach((o,n)=>state.cards.push({id:"card-"+stamp+"-"+n,ageGroup:String(o.ageGroup||"").trim(),category:String(o.category||"İçe Aktarılan").trim()||"İçe Aktarılan",emoji:String(o.emoji||"💬").trim()||"💬",question:String(o.question||"").trim(),followUp:String(o.followUp||"").trim(),parentGuide:String(o.parentGuide||"").trim(),positiveReinforcement:String(o.positiveReinforcement||"").trim(),connectionPhrase:String(o.connectionPhrase||"").trim(),difficulty:Math.min(3,Math.max(1,Number(o.difficulty)||1)),tags:[]}));
  state.adminConfig.lastCsvImport={count:rows.length,rawCount:meta.rawCount||rows.length,fileName:meta.fileName||"",at:new Date().toISOString()};
  try{await save();adminView();toast(rows.length+" kart başarıyla yüklendi")}catch{toast("CSV kartları kaydedilemedi")}
}
function previewAdminJson(file){
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const raw=JSON.parse(r.result);
      const incoming=raw?.schema==="parently-full-backup"?raw.state:raw;
      const site=raw?.schema==="parently-full-backup"?raw.site:null;
      if(!incoming?.profiles||!incoming?.cards)throw new Error();
      const box=$("#jsonPreview");box.classList.remove("hidden");
      const summary=[
        ["Profil",(incoming.profiles||[]).length],
        ["Kart",(incoming.cards||[]).length],
        ["Görev",(incoming.tasks||[]).length],
        ["Mesaj",(incoming.messages||[]).length],
        ["Dil paketi",Object.keys(incoming.languagePacks||{}).length],
        ["Index",site?"✓":"Eski yedek"]
      ];
      box._bundle={state:incoming,site};
      box.innerHTML='<div class="upload-preview-head"><div><b>'+esc(file.name)+'</b><small>'+esc(incoming.familyName||"Parently tam veri dosyası")+'</small></div><span class="file-type">JSON</span></div><div class="json-summary">'+summary.map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join("")+'</div><div class="upload-danger">Yeni yedek formatında panel, dil paketleri ve Index ayarları birlikte aktarılır. Eski JSON dosyaları da desteklenir.</div><div class="upload-actions"><button id="cancelJsonImport" class="secondary">İptal</button><button id="confirmJsonImport" class="primary">JSON verisini aktar</button></div>';
      $("#cancelJsonImport").onclick=()=>{box.classList.add("hidden");$("#adminJsonIn").value=""};
      $("#confirmJsonImport").onclick=()=>commitAdminJson(box._bundle);
    }catch{toast("Geçersiz Parently JSON dosyası")}
  };
  r.readAsText(file);
}
async function commitAdminJson(bundle){
  try{
    const incoming=bundle?.state||bundle;
    state=incoming;
    defaults();
    applyDeviceUi();
    await save();
    if(bundle?.site){
      await api("/api/site/home",{method:"PUT",body:JSON.stringify({familyCode,pin:String(state.pin||""),config:bundle.site})});
    }
    adminView();
    toast(bundle?.site?"Panel + Index + diller birlikte aktarıldı":"Eski JSON panel verisi aktarıldı");
  }catch{toast("JSON verisi kaydedilemedi")}
}

document.addEventListener("click",async e=>{
  if(e.target.closest("#adminNewCard")){e.preventDefault();adminNewCard();return}
  if(e.target.closest("[data-admin-cancel]")){e.preventDefault();closeModal();return}
  if(e.target.closest("#adminCardSave")){
    e.preventDefault();
    const q=$("#adminQuestion")?.value.trim()||"";
    if(!q)return toast("Ana soru gerekli");
    state.cards.push({
      id:"card-"+Date.now(),
      ageGroup:$("#adminAge").value,
      category:$("#adminCat").value.trim()||"Yeni Kategori",
      emoji:$("#adminEmoji").value.trim()||"💬",
      question:q,
      followUp:$("#adminFollowUp").value.trim(),
      parentGuide:$("#adminGuide").value.trim(),
      positiveReinforcement:$("#adminReinforcement").value.trim(),
      connectionPhrase:$("#adminConnection").value.trim(),
      difficulty:Number($("#adminDifficulty").value)||1,
      tags:[]
    });
    try{await save();closeModal();adminView();toast("Kart kaydedildi")}catch{toast("Kart kaydedilemedi")}
    return;
  }
  if(e.target.closest("#cancelCsvImport")){
    const box=$("#csvPreview");if(box)box.classList.add("hidden");
    const inp=$("#adminCsvIn");if(inp)inp.value="";
    return;
  }
  if(e.target.closest("#confirmCsvImport")){
    const box=$("#csvPreview");
    await commitCardsCsv(box?._rows||[],{rawCount:box?._rawCount,fileName:box?._fileName});
    return;
  }
});
document.addEventListener("change",e=>{
  if(e.target?.id==="adminCsvIn"){previewCardsCsv(e.target.files?.[0]);return}
  if(e.target?.id==="adminJsonIn"){previewAdminJson(e.target.files?.[0]);return}
});

load();