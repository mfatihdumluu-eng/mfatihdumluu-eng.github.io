const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$("#view"), modal=$("#modal"), modalBody=$("#modalBody");
let state=null, route="home", familyCode=localStorage.getItem("parently_family")||"AILE2026";

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
  state.profiles.forEach(p=>{state.points[p.id] ??= 0});
}
async function load(){try{state=await api("/api/state/"+encodeURIComponent(familyCode));defaults();await save();render();pollMessages()}catch(e){view.innerHTML='<div class="card">Bağlantı kurulamadı. Sayfayı yenileyin.</div>'}}
async function save(){state=await api("/api/state/"+encodeURIComponent(familyCode),{method:"PUT",body:JSON.stringify(state)});return state}
function markDirty(){save().catch(()=>toast("Kaydetme başarısız"))}

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
  $("#modeBtn").onclick=toggleMode;$("#profileBtn").onclick=profilePicker;
}
function toggleMode(){
  if(state.mode==="parent"){state.mode="child";markDirty();toast("Çocuk modu açıldı");render()}
  else{
    openModal('<h2>Ebeveyn moduna dön</h2><p class="muted">4 haneli ebeveyn PIN kodunu girin.</p><input id="pin" class="input" type="password" inputmode="numeric" maxlength="6"><button id="pinBtn" class="primary full">Devam</button>');
    $("#pinBtn").onclick=()=>{if($("#pin").value===state.pin){state.mode="parent";markDirty();closeModal();render()}else toast("PIN yanlış")}
  }
}
function profilePicker(){
  openModal('<h2>Kim kullanıyor?</h2><p class="muted">Ortak cihazlarda herkes kendi profilini seçebilir.</p><div class="profile-picker">'+state.profiles.map(p=>{const mm=moodMeta(p.id);return '<button class="pick-profile" data-p="'+p.id+'"><span class="halo" style="--halo:'+mm.color+'"><span style="background:'+p.color+'">'+esc(p.avatar)+'</span></span><b>'+esc(p.name)+'</b><small>'+(p.role==="child"?(p.age+" yaş"):"Ebeveyn")+'</small></button>'}).join("")+'</div>');
  $$("[data-p]").forEach(b=>b.onclick=()=>{state.activeProfileId=b.dataset.p;markDirty();closeModal();render()})
}
function render(){
  if(!state)return;defaults();updateHeader();
  document.body.classList.toggle("child-mode",state.mode==="child");
  document.body.classList.toggle("parent-mode",state.mode!=="child");
  if(state.mode==="child"&&route==="reports")route="home";
  (state.mode==="child"&&route==="home"?childHome:{home:homeView,cards:cardsView,agenda:agendaView,chat:chatView,reports:reportsView}[route]||homeView)()
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
 view.innerHTML=`
 <section class="hero polished"><div><span class="eyebrow">BUGÜN</span><h1>${esc(c.name)} ile bağlantı zamanı</h1><p>Bir soru, küçük bir an, gerçek bir bağ.</p></div><div class="hero-score"><b>${points}</b><span>puan</span></div></section>
 ${familyStrip()}
 <section class="section"><div class="dashboard-row"><button class="dash-card" data-go="agenda"><span>✅</span><b>${pending}</b><small>bekleyen görev</small></button><button class="dash-card" id="rewardBtn"><span>🎁</span><b>${points}</b><small>ödül puanı</small></button><button class="dash-card" id="calmBtn"><span>🌿</span><b>3</b><small>sakinleşme aracı</small></button></div></section>
 <section class="section"><div class="section-head"><h2>Bugün nasıl gidiyor?</h2><span class="muted">${moodToday?"Kaydedildi":"30 saniyelik check-in"}</span></div>
 <div class="moods">${[["😊","İyi"],["😌","Sakin"],["😐","Normal"],["😢","Üzgün"],["😡","Kızgın"],["😨","Kaygılı"]].map(m=>'<button class="mood '+(moodToday?.mood===m[0]?"selected":"")+'" data-mood="'+m[0]+'" data-label="'+m[1]+'">'+m[0]+'<span>'+m[1]+'</span></button>').join("")}</div></section>
 <section class="section"><div class="section-head"><h2>Bugünün 3 dakikası</h2><span class="badge">${esc(c.ageGroup)}</span></div>
 <div class="today-card premium"><div class="emoji">${dailyCard?.emoji||"💜"}</div><div class="question">${esc(dailyCard?.question||"Bugün birbirinize güzel bir şey söyleyin.")}</div><p class="muted">${esc(dailyCard?.connectionPhrase||"Yanındayım.")}</p><div class="row wrap"><button class="primary" data-open-card="${dailyCard?.id||""}">Kartı aç</button><button class="secondary" data-done-card="${dailyCard?.id||""}">✓ Tamamla</button><button class="soft" data-special>⏱️ Özel zaman</button></div></div></section>
 <section class="section"><div class="section-head"><h2>Bugünün akışı</h2><button class="small-btn" data-go="agenda">Ajandaya git</button></div><div class="timeline">${state.tasks.filter(t=>t.due===today()).slice(0,4).map(taskTimeline).join("")||'<div class="empty">Bugün için görev yok.</div>'}</div></section>
 <section class="section"><div class="card insight"><div><span class="eyebrow">HAFTALIK İPUCU</span><h3>${weeklyInsight(c)}</h3></div><button class="small-btn" data-go="reports">Detay</button></div></section>`;
 bindCommon();$$("#view [data-mood]").forEach(b=>b.onclick=()=>moodCheckin(b.dataset.mood,b.dataset.label));
 $("#rewardBtn").onclick=rewardsModal;$("#calmBtn").onclick=calmCorner;
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
 bindCommon();$("[data-mood-open]").forEach(b=>b.onclick=()=>moodPickerModal());$("[data-calm]").forEach(b=>b.onclick=calmCorner);const rewardCard=$(".child-reward-card");if(rewardCard)rewardCard.onclick=rewardsModal;
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
 const me=state.mode==="child"?activeChild():state.profiles.find(p=>p.role==="parent")||profile(state.activeProfileId);
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
       <div class="compose-who">Gönderen: <b>${esc(me.name)}</b></div>
       <div class="chat-send"><input id="msg" class="input" placeholder="Ailene bir mesaj yaz..."><button id="send" class="primary">Herkese gönder</button></div>
     </div>
   </section>
 </div>`;
 const box=$("#chatBox");box.scrollTop=box.scrollHeight;
 $("#send").onclick=async()=>{const text=$("#msg").value.trim();if(!text)return;await api("/api/message/"+encodeURIComponent(familyCode),{method:"POST",body:JSON.stringify({senderId:me.id,text})});$("#msg").value="";await refreshMessages()};
 $("#msg").onkeydown=e=>{if(e.key==="Enter")$("#send").click()};
 $("#familyCodeBtn").onclick=changeFamilyCode;
}
async function refreshMessages(){try{const fresh=await api("/api/state/"+encodeURIComponent(familyCode));state.messages=fresh.messages||[];if(route==="chat")chatView()}catch{}}
function pollMessages(){setInterval(()=>{if(route==="chat")refreshMessages()},3500)}
function changeFamilyCode(){openModal('<h2>Aile kodu</h2><p class="muted">Başka cihazda aynı kodu yazarak aynı aile alanına bağlanabilirsiniz.</p><input id="fc" class="input" value="'+esc(familyCode)+'"><button id="fcSave" class="primary full">Bağlan</button>');$("#fcSave").onclick=()=>{const v=$("#fc").value.toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,30);if(!v)return;familyCode=v;localStorage.setItem("parently_family",v);closeModal();load();toast("Aile alanı değiştirildi")}}

function reportsView(){
 const c=activeChild();
 const allMoods=state.moods.filter(x=>x.profileId===c.id);
 const last7Dates=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10)});
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
 <div class="report-header">
   <div><span class="eyebrow">EBEVEYN RAPORU</span><h1>${esc(c.name)} için gelişim ve bağ özeti</h1><p>Bu ekran tanı koymaz; aile içindeki duygu, rutin ve bağ kurma alışkanlıklarını görünür kılar.</p></div>
   <div class="report-actions"><button id="exportBtn" class="small-btn">Veriyi dışa aktar</button><button id="printBtn" class="primary">PDF / Yazdır</button></div>
 </div>

 <div class="report-kpis">
   <div class="report-kpi"><span>Duygu check-in</span><b>${weekMoods.length}</b><small>son 7 gün</small></div>
   <div class="report-kpi"><span>Bağ kartı</span><b>${weekCards.length}</b><small>tamamlanan</small></div>
   <div class="report-kpi"><span>Görev tamamlama</span><b>%${completionRate}</b><small>${doneTasks}/${childTasks.length} görev</small></div>
   <div class="report-kpi"><span>Özel zaman</span><b>${sessionMinutes}</b><small>dakika</small></div>
   <div class="report-kpi"><span>Puan</span><b>${points}</b><small>toplam</small></div>
 </div>

 <div class="report-grid two">
   <section class="card report-panel">
     <div class="report-panel-head"><div><span class="eyebrow">DUYGU</span><h3>7 günlük duygu görünümü</h3></div><span class="report-pill">Ort. şiddet: ${avgIntensity}/5</span></div>
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
 $("#printBtn").onclick=()=>window.print();$("#exportBtn").onclick=exportJson;$("#settingsBtn").onclick=settingsModal;
}
function last7MoodCells(pid){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=d.toISOString().slice(0,10),m=state.moods.find(x=>x.profileId===pid&&x.date===ds);return '<div class="mood-day"><small>'+d.toLocaleDateString("tr-TR",{weekday:"short"})+'</small><b>'+(m?.mood||"·")+'</b><span>'+(m?.intensity?m.intensity+"/5":"")+'</span></div>'}).join("")}
function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="parently-"+familyCode+".json";a.click();URL.revokeObjectURL(a.href)}
function settingsModal(){
 openModal('<h2>Profil & Ayarlar</h2><p class="muted">Aile: '+esc(state.familyName)+' · Kod: '+esc(familyCode)+'</p><div class="list">'+state.profiles.map(p=>'<div class="item profile-card"><span class="profile-dot" style="background:'+p.color+'33;color:'+p.color+'">'+esc(p.avatar)+'</span><div><b>'+esc(p.name)+'</b><div class="muted">'+esc(p.role)+(p.age?" · "+p.age+" yaş":"")+'</div></div></div>').join("")+'</div><label class="muted block">Ebeveyn PIN</label><input id="newPin" class="input" value="'+esc(state.pin)+'"><div class="item settings-row"><div><b>🌙 Sessiz saatler</b><div class="muted">Aile mesaj bildirimlerini sakin tut</div></div><input id="qh" type="checkbox" '+(state.quietHours.enabled?"checked":"")+'></div><div class="form-grid"><input id="qs" class="input" type="time" value="'+state.quietHours.start+'"><input id="qe" class="input" type="time" value="'+state.quietHours.end+'"></div><label class="muted block">JSON içe aktar</label><input id="importFile" type="file" accept="application/json" class="input"><button id="saveSettings" class="primary full">Ayarları kaydet</button>');
 $("#saveSettings").onclick=()=>{state.pin=$("#newPin").value||"2026";state.quietHours={enabled:$("#qh").checked,start:$("#qs").value,end:$("#qe").value};markDirty();closeModal();toast("Ayarlar kaydedildi")};$("#importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);defaults();markDirty();closeModal();render();toast("Yedek yüklendi")}catch{toast("Geçersiz dosya")}};r.readAsText(f)}
}
load();