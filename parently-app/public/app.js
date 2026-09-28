const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$("#view"), modal=$("#modal"), modalBody=$("#modalBody");
let state=null, route="home", familyCode=localStorage.getItem("parently_family")||"AILE2026", dirty=false;

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function profile(id){return state.profiles.find(p=>p.id===id)}
function activeChild(){let p=profile(state.activeProfileId);return p?.role==="child"?p:state.profiles.find(x=>x.role==="child")||p}
function today(){return new Date().toISOString().slice(0,10)}
async function api(url,opt={}){const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text());return r.json()}
async function load(){try{state=await api("/api/state/"+encodeURIComponent(familyCode));render();pollMessages()}catch(e){view.innerHTML='<div class="card">Bağlantı kurulamadı. Sayfayı yenileyin.</div>'}}
async function save(){dirty=false;state=await api("/api/state/"+encodeURIComponent(familyCode),{method:"PUT",body:JSON.stringify(state)});return state}
function markDirty(){dirty=true;save().catch(()=>toast("Kaydetme başarısız"))}
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden")}
$("#modalClose").onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};

function setRoute(r){route=r;$$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.route===r));render();window.scrollTo({top:0,behavior:"smooth"})}
$$(".nav-btn").forEach(b=>b.onclick=()=>setRoute(b.dataset.route));

function updateHeader(){
 const c=activeChild(); $("#profileBtn").textContent=c?.avatar||"?";
 $("#modeBtn").textContent=state.mode==="child"?"🧒 Çocuk Modu":"👨‍👩‍👧 Ebeveyn";
 $("#modeBtn").onclick=toggleMode; $("#profileBtn").onclick=profilePicker;
}
function toggleMode(){
 if(state.mode==="parent"){
   state.mode="child";markDirty();toast("Çocuk modu açıldı");render();
 }else{
   openModal('<h2>Ebeveyn moduna dön</h2><p class="muted">PIN kodunu girin.</p><input id="pin" class="input" type="password" inputmode="numeric"><button id="pinBtn" class="primary" style="margin-top:10px;width:100%">Devam</button>');
   $("#pinBtn").onclick=()=>{if($("#pin").value===state.pin){state.mode="parent";markDirty();closeModal();render()}else toast("PIN yanlış")};
 }
}
function profilePicker(){
 const cards=state.profiles.map(p=>'<button class="item profile-card" data-p="'+p.id+'" style="width:100%;text-align:left;border:1px solid var(--line)"><span class="profile-dot" style="background:'+p.color+'33;color:'+p.color+'">'+esc(p.avatar)+'</span><span><b>'+esc(p.name)+'</b><span class="muted" style="display:block">'+(p.role==="child"?(p.age+" yaş · "+p.ageGroup):"Ebeveyn")+'</span></span></button>').join("");
 openModal('<h2>Profil seç</h2><div class="list">'+cards+'</div>');
 $$("[data-p]").forEach(b=>b.onclick=()=>{state.activeProfileId=b.dataset.p;markDirty();closeModal();render()})
}

function render(){if(!state)return;updateHeader(); if(state.mode==="child"&&["reports"].includes(route))route="home"; ({home:homeView,cards:cardsView,agenda:agendaView,chat:chatView,reports:reportsView}[route]||homeView)()}

function homeView(){
 const c=activeChild(), completed=state.completedCards.filter(x=>x.profileId===c.id).length, dailyCard=state.cards.find(k=>k.ageGroup===c.ageGroup&&!state.completedCards.some(x=>x.cardId===k.id&&x.date===today()))||state.cards.find(k=>k.ageGroup===c.ageGroup);
 const moodToday=state.moods.find(m=>m.profileId===c.id&&m.date===today());
 view.innerHTML=`
 <section class="hero"><h1>Merhaba, ${esc(c.name)} 👋</h1><p>Bugün bağ kurmak için küçücük bir an yeter.</p>
 <div class="quick"><button data-go="cards">🃏 Kart seç</button><button data-special>⏱️ 10 dakika</button><button data-go="chat">💬 Mesajlaş</button></div></section>
 <section class="section"><div class="section-head"><h2>Bugün nasıl gidiyor?</h2><span class="muted">${moodToday?"Kaydedildi":"Bir duygu seç"}</span></div>
 <div class="moods">${[["😊","İyi"],["😌","Sakin"],["😐","Normal"],["😢","Üzgün"],["😡","Kızgın"],["😨","Kaygılı"]].map(m=>'<button class="mood" data-mood="'+m[0]+'" data-label="'+m[1]+'">'+m[0]+'<span>'+m[1]+'</span></button>').join("")}</div></section>
 <section class="section"><div class="section-head"><h2>Bugünün 3 dakikası</h2><span class="badge">${esc(c.ageGroup)}</span></div>
 <div class="today-card"><div class="emoji">${dailyCard?.emoji||"💜"}</div><div class="question">${esc(dailyCard?.question||"Bugün birbirinize güzel bir şey söyleyin.")}</div><p class="muted">${esc(dailyCard?.connectionPhrase||"Yanındayım.")}</p><div class="row"><button class="primary" data-open-card="${dailyCard?.id||""}">Kartı aç</button><button class="secondary" data-done-card="${dailyCard?.id||""}">✓ Tamamla</button></div></div></section>
 <section class="section"><div class="section-head"><h2>Günün ilerlemesi</h2><span class="muted">${completed} tamamlanan kart</span></div><div class="progress"><div style="width:${Math.min(100,completed*12)}%"></div></div></section>
 <section class="section"><div class="section-head"><h2>Bugünün ajandası</h2><button class="small-btn" data-go="agenda">Tümü</button></div><div class="list">${state.tasks.filter(t=>t.due===today()).slice(0,3).map(taskHtml).join("")||'<div class="item muted">Bugün için görev yok.</div>'}</div></section>`;
 bindCommon();
 $$("[data-mood]").forEach(b=>b.onclick=()=>saveMood(b.dataset.mood,b.dataset.label));
}

function saveMood(mood,label){
 const c=activeChild(); state.moods=state.moods.filter(m=>!(m.profileId===c.id&&m.date===today())); state.moods.push({id:crypto.randomUUID?.()||Date.now(),profileId:c.id,date:today(),mood,label,note:""});markDirty();toast("Duygu kaydedildi");render();
}
function bindCommon(){
 $$("[data-go]").forEach(b=>b.onclick=()=>setRoute(b.dataset.go));
 $$("[data-open-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.openCard));
 $$("[data-done-card]").forEach(b=>b.onclick=()=>completeCard(b.dataset.doneCard));
 $$("[data-special]").forEach(b=>b.onclick=specialTime);
 $$("[data-task]").forEach(b=>b.onclick=()=>taskAction(b.dataset.task));
}

let cardFilter="Tümü", ageFilter="";
function cardsView(){
 const c=activeChild(); if(!ageFilter)ageFilter=c.ageGroup;
 const cats=["Tümü",...new Set(state.cards.map(c=>c.category))];
 const visible=state.cards.filter(k=>(ageFilter==="Tümü"||k.ageGroup===ageFilter)&&(cardFilter==="Tümü"||k.category===cardFilter));
 view.innerHTML=`<div class="section-head"><div><h2>Kart Kütüphanesi</h2><span class="muted">Soru · Rehber · Pekiştirme · Ritüel</span></div><button class="small-btn" id="favOnly">⭐ Favoriler</button></div>
 <div class="filters">${["Tümü","2-5","6-9","10-13","14-16"].map(a=>'<button class="filter '+(ageFilter===a?"active":"")+'" data-age="'+a+'">'+a+'</button>').join("")}</div>
 <div class="filters">${cats.map(a=>'<button class="filter '+(cardFilter===a?"active":"")+'" data-cat="'+esc(a)+'">'+esc(a)+'</button>').join("")}</div>
 <div class="grid">${visible.map(k=>'<div class="card card-tile clickable" data-open-card="'+k.id+'"><div><div class="row space"><span class="emoji">'+k.emoji+'</span><span>'+ (state.favorites.includes(k.id)?"⭐":"") +'</span></div><span class="badge">'+esc(k.category)+'</span><h3>'+esc(k.question)+'</h3></div><span class="muted">'+k.ageGroup+' · Zorluk '+k.difficulty+'/3</span></div>').join("")}</div>`;
 $$("[data-age]").forEach(b=>b.onclick=()=>{ageFilter=b.dataset.age;render()});$$("[data-cat]").forEach(b=>b.onclick=()=>{cardFilter=b.dataset.cat;render()});
 $$("[data-open-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.openCard));
 $("#favOnly").onclick=()=>{const old=cardFilter;cardFilter="Tümü";const fav=state.cards.filter(k=>state.favorites.includes(k.id));view.querySelector(".grid").innerHTML=fav.map(k=>'<div class="card card-tile clickable" data-open-card="'+k.id+'"><span class="emoji">'+k.emoji+'</span><h3>'+esc(k.question)+'</h3></div>').join("")||'<div class="item">Henüz favori yok.</div>';$$("[data-open-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.openCard))};
}
function openCard(id){
 const k=state.cards.find(x=>x.id===id); if(!k)return;
 if(state.mode==="child"){
   openModal('<div class="emoji">'+k.emoji+'</div><h2>'+esc(k.question)+'</h2><p>'+esc(k.followUp)+'</p><button id="childDone" class="primary" style="width:100%">Bunu konuştuk ✓</button>');
   $("#childDone").onclick=()=>{completeCard(id);closeModal()};return;
 }
 const note=state.cardNotes[id]||"";
 openModal(`<div class="row space"><div><span class="badge">${esc(k.category)}</span><h2 style="margin:8px 0">${k.emoji} ${esc(k.question)}</h2></div><button id="favBtn" class="small-btn">${state.favorites.includes(id)?"⭐ Favoride":"☆ Favoriye ekle"}</button></div>
 <p><b>Takip sorusu:</b> ${esc(k.followUp)}</p>
 <div class="tabs"><button class="active" data-tab="guide">Rehber</button><button data-tab="reinforce">Pekiştirme</button><button data-tab="ritual">Ritüel</button></div>
 <div id="tabText" class="item">${esc(k.parentGuide)}</div>
 <label class="muted" style="display:block;margin-top:14px">Özel ebeveyn notu</label><textarea id="cardNote" rows="3" placeholder="Sadece ebeveynler görür...">${esc(note)}</textarea>
 <div class="row" style="margin-top:10px"><button id="saveCard" class="primary">Kaydet</button><button id="doneCard" class="secondary">✓ Tamamlandı</button></div>`);
 const texts={guide:k.parentGuide,reinforce:k.positiveReinforcement,ritual:k.connectionPhrase};
 $$("[data-tab]").forEach(b=>b.onclick=()=>{$$("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#tabText").textContent=texts[b.dataset.tab]});
 $("#favBtn").onclick=()=>{state.favorites.includes(id)?state.favorites=state.favorites.filter(x=>x!==id):state.favorites.push(id);markDirty();openCard(id)};
 $("#saveCard").onclick=()=>{state.cardNotes[id]=$("#cardNote").value;markDirty();toast("Not kaydedildi")};
 $("#doneCard").onclick=()=>{completeCard(id);closeModal()};
}
function completeCard(id){const c=activeChild();state.completedCards.push({id:Date.now()+"",cardId:id,profileId:c.id,date:today()});markDirty();toast("Bağ anı kaydedildi");render()}

function taskHtml(t){const ass=profile(t.assigneeId);return '<div class="item"><div class="row space"><div><div class="title">'+esc(t.title)+'</div><div class="muted">'+esc(ass?.name||"Aile")+' · '+esc(t.due)+'</div></div><span class="status '+t.status+'">'+({pending:"Bekliyor",submitted:"Onay bekliyor",done:"Tamamlandı"}[t.status]||t.status)+'</span></div><p class="muted">'+esc(t.description||"")+'</p><button class="small-btn" data-task="'+t.id+'">'+(t.status==="submitted"&&state.mode==="parent"?"Onayla":t.status==="done"?"Geri al":"Tamamla")+'</button></div>'}
function agendaView(){
 view.innerHTML=`<div class="section-head"><div><h2>Ajanda & Görevler</h2><span class="muted">Görev, ritüel ve aile planları</span></div><button class="primary" id="newTask">+ Yeni</button></div>
 <div class="card"><div class="form-grid"><input id="agendaDate" class="input" type="date" value="${today()}"><button id="newEvent" class="secondary">Takvime ekle</button></div></div>
 <section class="section"><div class="section-head"><h2>Görevler</h2></div><div class="list">${state.tasks.map(taskHtml).join("")}</div></section>
 <section class="section"><div class="section-head"><h2>Ritüeller</h2></div><div class="grid">${state.rituals.map(r=>'<div class="card"><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(r.days.join(", "))+'</p><button class="small-btn" data-ritual="'+r.id+'">'+(r.doneDates.includes(today())?"✓ Bugün yapıldı":"Bugün yaptık")+'</button></div>').join("")}</div></section>
 <section class="section"><div class="section-head"><h2>Planlananlar</h2></div><div class="list">${state.calendar.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>'<div class="item"><b>'+esc(e.title)+'</b><div class="muted">'+esc(e.date)+' '+esc(e.time||"")+'</div></div>').join("")}</div></section>`;
 bindCommon();
 $("#newTask").onclick=newTask;$("#newEvent").onclick=newEvent;$$("[data-ritual]").forEach(b=>b.onclick=()=>{const r=state.rituals.find(x=>x.id===b.dataset.ritual);r.doneDates.includes(today())?r.doneDates=r.doneDates.filter(d=>d!==today()):r.doneDates.push(today());markDirty();render()});
}
function newTask(){
 openModal('<h2>Yeni görev</h2><input id="tt" class="input" placeholder="Görev başlığı"><textarea id="td" rows="3" placeholder="Açıklama"></textarea><div class="form-grid"><input id="due" class="input" type="date" value="'+today()+'"><select id="assignee">'+state.profiles.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")+'</select></div><label><input id="approval" type="checkbox"> Çocuk tamamlayınca ebeveyn onayı iste</label><button id="addTask" class="primary" style="margin-top:12px;width:100%">Ekle</button>');
 $("#addTask").onclick=()=>{if(!$("#tt").value.trim())return toast("Başlık yazın");state.tasks.push({id:"t"+Date.now(),title:$("#tt").value.trim(),description:$("#td").value.trim(),assigneeId:$("#assignee").value,due:$("#due").value,status:"pending",requiresApproval:$("#approval").checked,type:"task"});markDirty();closeModal();render()};
}
function newEvent(){
 openModal('<h2>Takvime ekle</h2><input id="et" class="input" placeholder="Başlık"><div class="form-grid"><input id="ed" class="input" type="date" value="'+$("#agendaDate").value+'"><input id="etime" class="input" type="time"></div><button id="addEvent" class="primary" style="margin-top:12px;width:100%">Ekle</button>');
 $("#addEvent").onclick=()=>{state.calendar.push({id:"e"+Date.now(),title:$("#et").value||"Aile etkinliği",date:$("#ed").value,time:$("#etime").value,type:"event"});markDirty();closeModal();render()};
}
function taskAction(id){
 const t=state.tasks.find(x=>x.id===id);if(!t)return;
 if(t.status==="done"){t.status="pending"} else if(t.requiresApproval&&state.mode==="child"){t.status="submitted"} else if(t.status==="submitted"&&state.mode==="parent"){t.status="done"} else {t.status=t.requiresApproval?"submitted":"done"}
 markDirty();render();
}

let timerInterval=null;
function specialTime(){
 let seconds=600;
 openModal('<h2>⏱️ 10 Dakika Özel Zaman</h2><p class="muted">Çocuğun liderliğini takip et · düzeltmeyi azalt · olumlu davranışları fark et.</p><div id="timer" style="font-size:54px;font-weight:800;text-align:center;color:var(--p1);margin:20px">10:00</div><textarea id="sessionNote" rows="3" placeholder="Bu seanstan kısa bir not..."></textarea><div class="row"><button id="startTimer" class="primary">Başlat</button><button id="finishTimer" class="secondary">Bitir & Kaydet</button></div>');
 $("#startTimer").onclick=()=>{clearInterval(timerInterval);timerInterval=setInterval(()=>{seconds--;$("#timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");if(seconds<=0){clearInterval(timerInterval);toast("10 dakika tamamlandı 💜")}},1000)};
 $("#finishTimer").onclick=()=>{clearInterval(timerInterval);state.specialSessions.push({id:"s"+Date.now(),profileId:activeChild().id,date:new Date().toISOString(),duration:600-seconds,note:$("#sessionNote").value});markDirty();closeModal();toast("Özel zaman kaydedildi")};
}

function chatView(){
 const me=state.mode==="child"?activeChild():state.profiles.find(p=>p.role==="parent")||profile(state.activeProfileId);
 const messages=state.messages||[];
 view.innerHTML=`<div class="section-head"><div><h2>Aile Mesajları</h2><span class="muted">Aile kodu: ${esc(familyCode)}</span></div><button class="small-btn" id="familyCodeBtn">Aile kodu</button></div>
 <div id="chatBox" class="chat-box">${messages.map(m=>'<div class="bubble '+(m.senderId===me.id?"me":"")+'"><b>'+esc(profile(m.senderId)?.name||"Aile")+'</b><div>'+esc(m.text)+'</div><div class="meta">'+new Date(m.at).toLocaleString("tr-TR")+'</div></div>').join("")}</div>
 <div class="chat-send"><input id="msg" class="input" placeholder="Mesaj yaz..."><button id="send" class="primary">Gönder</button></div>`;
 const box=$("#chatBox");box.scrollTop=box.scrollHeight;
 $("#send").onclick=async()=>{const text=$("#msg").value.trim();if(!text)return;await api("/api/message/"+encodeURIComponent(familyCode),{method:"POST",body:JSON.stringify({senderId:me.id,text})});$("#msg").value="";await refreshMessages()};
 $("#msg").onkeydown=e=>{if(e.key==="Enter")$("#send").click()};
 $("#familyCodeBtn").onclick=changeFamilyCode;
}
async function refreshMessages(){try{const fresh=await api("/api/state/"+encodeURIComponent(familyCode));state.messages=fresh.messages||[];if(route==="chat")chatView()}catch{}}
function pollMessages(){setInterval(()=>{if(route==="chat")refreshMessages()},3500)}
function changeFamilyCode(){
 openModal('<h2>Aile kodu</h2><p class="muted">Başka cihazda aynı kodu yazarak aynı aile alanına bağlanabilirsiniz.</p><input id="fc" class="input" value="'+esc(familyCode)+'"><button id="fcSave" class="primary" style="margin-top:10px;width:100%">Bağlan</button>');
 $("#fcSave").onclick=()=>{const v=$("#fc").value.toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,30);if(!v)return;familyCode=v;localStorage.setItem("parently_family",v);closeModal();load();toast("Aile alanı değiştirildi")};
}

function reportsView(){
 const c=activeChild(), cc=state.completedCards.filter(x=>x.profileId===c.id), moods=state.moods.filter(x=>x.profileId===c.id), sessions=state.specialSessions.filter(x=>x.profileId===c.id), doneTasks=state.tasks.filter(x=>x.status==="done").length;
 const moodCounts={};moods.forEach(m=>moodCounts[m.mood]=(moodCounts[m.mood]||0)+1);
 const categories={};cc.forEach(x=>{const k=state.cards.find(c=>c.id===x.cardId);if(k)categories[k.category]=(categories[k.category]||0)+1});
 view.innerHTML=`<div class="section-head"><div><h2>${esc(c.name)} · Haftalık Özet</h2><span class="muted">Klinik değerlendirme değil; aile içi gözlem özeti</span></div><button class="small-btn" id="exportBtn">Dışa aktar</button></div>
 <div class="stat-grid"><div class="stat"><b>${cc.length}</b><span>Kart</span></div><div class="stat"><b>${doneTasks}</b><span>Görev</span></div><div class="stat"><b>${sessions.length}</b><span>Özel zaman</span></div></div>
 <section class="section"><div class="card"><h3>Bu hafta daha sık görünen duygular</h3><div class="moods">${Object.entries(moodCounts).map(([m,n])=>'<div class="mood">'+m+'<span>'+n+' kayıt</span></div>').join("")||'<span class="muted">Henüz duygu kaydı yok.</span>'}</div></div></section>
 <section class="section"><div class="card"><h3>En çok konuşulan temalar</h3>${Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([k,n])=>'<div class="row space" style="margin:10px 0"><span>'+esc(k)+'</span><b>'+n+'</b></div>').join("")||'<p class="muted">Kart tamamlandıkça burada görünecek.</p>'}</div></section>
 <section class="section"><div class="card"><h3>Ebeveyn notları</h3>${Object.entries(state.cardNotes).filter(x=>x[1]).map(([id,n])=>'<p><b>'+esc(state.cards.find(c=>c.id===id)?.category||"Kart")+':</b> '+esc(n)+'</p>').join("")||'<p class="muted">Henüz not yok.</p>'}</div></section>
 <section class="section"><button id="printBtn" class="primary">Yazdır / PDF</button> <button id="settingsBtn" class="secondary">Profil & Ayarlar</button></section>`;
 $("#printBtn").onclick=()=>window.print();$("#exportBtn").onclick=exportJson;$("#settingsBtn").onclick=settingsModal;
}
function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="parently-"+familyCode+".json";a.click();URL.revokeObjectURL(a.href)}
function settingsModal(){
 openModal(`<h2>Profil & Ayarlar</h2><p class="muted">Aile: ${esc(state.familyName)} · Kod: ${esc(familyCode)}</p>
 <div class="list">${state.profiles.map(p=>'<div class="item profile-card"><span class="profile-dot" style="background:'+p.color+'33;color:'+p.color+'">'+esc(p.avatar)+'</span><div><b>'+esc(p.name)+'</b><div class="muted">'+esc(p.role)+(p.age?" · "+p.age+" yaş":"")+'</div></div></div>').join("")}</div>
 <label class="muted">Çocuk modu PIN</label><input id="newPin" class="input" value="${esc(state.pin)}">
 <label class="muted" style="display:block;margin-top:10px">JSON içe aktar</label><input id="importFile" type="file" accept="application/json" class="input">
 <button id="saveSettings" class="primary" style="margin-top:12px;width:100%">Ayarları kaydet</button>`);
 $("#saveSettings").onclick=()=>{state.pin=$("#newPin").value||"2026";markDirty();closeModal();toast("Ayarlar kaydedildi")};
 $("#importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);markDirty();closeModal();render();toast("Yedek yüklendi")}catch{toast("Geçersiz dosya")}};r.readAsText(f)};
}

load();