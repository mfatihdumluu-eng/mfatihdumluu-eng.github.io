const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const api=async(url,opt={})=>{const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text());return r.json()};
const code=(localStorage.getItem("parently_family")||"DEMO2026").toUpperCase();
let state,experts,selectedId="",generatedCards=[];
async function load(){[state,experts]=await Promise.all([api("/api/state/"+encodeURIComponent(code)),api("/api/experts")]);state.expertConnections||=[];state.expertMessages||=[];state.expertSessions||=[];selectedId=selectedId||state.expertConnections.find(x=>x.status==="active")?.expertId||experts[0]?.id||"";render()}
function parent(){const id=localStorage.getItem("parently_profile");return state.profiles.find(x=>x.id===id&&x.role==="parent")||state.profiles.find(x=>x.role==="parent")}
function connection(id){return state.expertConnections.find(x=>x.expertId===id&&x.status!=="revoked")}
function renderAiCards(){
  if(!generatedCards.length)return '<div class="empty">Henüz AI kartı üretilmedi.</div>';
  return generatedCards.map((x,i)=>'<label class="ai-card-result"><input type="checkbox" data-ai-card="'+i+'" checked><div><div class="ai-card-result-head"><span>'+esc(x.emoji||"💬")+'</span><b>'+esc(x.category||"Aileye Özel")+'</b></div><h4>'+esc(x.question)+'</h4><p><b>Takip:</b> '+esc(x.followUp)+'</p><small>'+esc(x.parentGuide)+'</small></div></label>').join("")+'<div class="expert-actions"><button id="saveAiCards" class="secondary">Seçilenleri Kartlar’a ekle</button></div>';
}
function render(){
 const p=parent(),e=experts.find(x=>x.id===selectedId)||experts[0],link=connection(e?.id),kids=state.profiles.filter(x=>x.role==="child");
 const msgs=state.expertMessages.filter(x=>x.expertId===e?.id&&x.channel==="private");
 const sessions=state.expertSessions.filter(x=>x.expertId===e?.id).slice().reverse();
 $("#expertApp").innerHTML='<aside class="expert-card"><div class="section-head"><div><span class="eyebrow">UZMAN SEÇİN</span><h3>Uzmanlar</h3></div></div><div class="expert-list">'+experts.map(x=>'<button class="expert-person '+(x.id===e.id?"active":"")+'" data-exp="'+x.id+'"><span class="expert-avatar" style="background:'+x.color+'">'+esc(x.avatar)+'</span><span><b>'+esc(x.name)+'</b><small>'+esc(x.title)+'</small><small>'+esc((x.specialties||[]).slice(0,2).join(" · "))+'</small><span class="expert-chip">'+esc(x.status)+'</span></span></button>').join("")+'</div></aside>'+
 '<main><section class="expert-panel"><div class="expert-person"><span class="expert-avatar" style="background:'+e.color+'">'+esc(e.avatar)+'</span><div><div class="media-title-row"><h2>'+esc(e.name)+'</h2><span class="expert-chip">'+esc(e.status)+'</span></div><small>'+esc(e.title)+'</small><p>'+esc(e.bio)+'</p></div></div><div class="expert-profile-grid"><div><span class="eyebrow">EĞİTİM</span><ul class="expert-detail-list">'+(e.education||[]).map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></div><div><span class="eyebrow">UZMANLIK ALANLARI</span><div class="expert-tag-list">'+(e.specialties||[]).map(x=>'<span>'+esc(x)+'</span>').join("")+'</div></div><div><span class="eyebrow">DİLLER</span><div class="expert-tag-list">'+(e.languages||[]).map(x=>'<span>'+esc(x.toUpperCase())+'</span>').join("")+'</div></div><div><span class="eyebrow">DENEYİM & UYGUNLUK</span><p><b>'+esc(e.experienceYears||"—")+' yıl deneyim</b><br><small>'+esc(e.availability||"")+'</small></p></div></div><div class="expert-approach"><span class="eyebrow">ÇALIŞMA YAKLAŞIMI</span><p>'+esc(e.approach||"")+'</p></div><div class="expert-actions"><button id="connectBtn" class="primary">'+(link?"Bu uzman seçili":"Bu uzmanı seç")+'</button><button id="videoBtn" class="secondary" '+(!link?"disabled":"")+'>Görüntülü görüşme talebi</button></div></section>'+
 '<section class="expert-panel section ai-card-studio"><div class="section-head"><div><span class="eyebrow">AI KART STÜDYOSU</span><h3>Ailenize özel kart üretin</h3><p class="muted">Çocuğu, konuyu ve amacı seçin. AI önce taslak üretir; kartlara yalnızca siz eklersiniz.</p></div></div><div class="ai-card-form"><label>Çocuk<select id="aiChild" class="input">'+kids.map(k=>'<option value="'+k.id+'">'+esc(k.name)+' · '+esc(k.ageGroup)+'</option>').join("")+'</select></label><label>Konu<input id="aiTopic" class="input" placeholder="Örn. okulda arkadaşlık, özgüven, kardeş kıskançlığı"></label><label>Amaç<select id="aiGoal" class="input"><option>Bağ kurma</option><option>Duyguları konuşma</option><option>Özgüven</option><option>Sınırlar</option><option>Problem çözme</option><option>Aile iletişimi</option></select></label><label>Kart sayısı<select id="aiCount" class="input"><option>3</option><option>4</option><option>5</option></select></label></div><div class="expert-actions"><button id="generateAiCards" class="primary">✨ Özel kart üret</button><span id="aiCardStatus" class="muted"></span></div><div id="aiCardsPreview" class="ai-cards-preview">'+renderAiCards()+'</div></section>'+
 '<section class="expert-panel section"><h3>Özel mesajlaşma</h3><div id="supportChat" class="support-chat">'+(msgs.map(m=>'<div class="support-msg '+(m.senderType==="parent"?"me":"")+'">'+esc(m.text)+'<small>'+new Date(m.at).toLocaleString("tr-TR")+'</small></div>').join("")||'<div class="empty">Henüz mesaj yok.</div>')+'</div><div class="compose"><input id="expertMsg" class="input" placeholder="Uzmanınıza mesaj yazın…"><button id="sendExpert" class="primary" '+(!link?"disabled":"")+'>Gönder</button></div></section>'+
 '<section class="expert-panel section"><h3>Erişim izinleri</h3><p class="muted">Uzman yalnızca seçtiğiniz çocuk profillerini ve izin verdiğiniz aile sohbetini görür.</p><div class="permission-list">'+kids.map(k=>'<label class="permission-row"><span>'+esc(k.name)+' profiline erişim</span><input type="checkbox" data-kid="'+k.id+'" '+(link?.childProfileIds?.includes(k.id)?"checked":"")+' '+(!link?"disabled":"")+'></label>').join("")+'<label class="permission-row"><span>Uzmanı aile sohbetine dahil et</span><input id="familyChatAccess" type="checkbox" '+(link?.familyChatAccess?"checked":"")+' '+(!link?"disabled":"")+'></label></div></section>'+
 '<section class="expert-panel section"><h3>Görüntülü görüşmeler</h3><div class="sessions">'+(sessions.map(s=>'<div class="session"><div><b>Görüntülü görüşme</b> <span class="status">'+esc(s.status)+'</span></div><small>'+new Date(s.requestedAt).toLocaleString("tr-TR")+'</small>'+(["accepted","active"].includes(s.status)?'<div class="expert-actions"><a class="primary" target="_blank" rel="noopener" href="'+esc(s.roomUrl)+'">Görüşmeye katıl ↗</a></div>':'')+'</div>').join("")||'<div class="empty">Henüz görüşme talebi yok.</div>')+'</div></section></main>';
 document.querySelectorAll("[data-exp]").forEach(b=>b.onclick=()=>{selectedId=b.dataset.exp;render()});
 $("#connectBtn").onclick=async()=>{await api("/api/expert/connection/"+code,{method:"POST",body:JSON.stringify({expertId:e.id,childProfileIds:kids.map(k=>k.id)})});await load()};
 if($("#sendExpert"))$("#sendExpert").onclick=async()=>{const text=$("#expertMsg").value.trim();if(!text)return;await api("/api/expert/message/"+code,{method:"POST",body:JSON.stringify({expertId:e.id,senderType:"parent",senderId:p?.id||"",channel:"private",text})});$("#expertMsg").value="";await load()};
 if($("#videoBtn"))$("#videoBtn").onclick=async()=>{await api("/api/expert/session/"+code,{method:"POST",body:JSON.stringify({action:"request",expertId:e.id,requestedBy:p?.id||""})});await load()};
 document.querySelectorAll("[data-kid]").forEach(x=>x.onchange=savePermissions);
 const fc=$("#familyChatAccess");if(fc)fc.onchange=savePermissions;
 const gen=$("#generateAiCards");
 if(gen)gen.onclick=async()=>{
   const status=$("#aiCardStatus");status.textContent="Kartlar hazırlanıyor…";gen.disabled=true;
   try{
     const out=await api("/api/ai/cards/"+code,{method:"POST",body:JSON.stringify({profileId:$("#aiChild").value,topic:$("#aiTopic").value,goal:$("#aiGoal").value,count:Number($("#aiCount").value)||3})});
     generatedCards=out.cards||[];
     status.textContent=out.provider==="openai"?"AI ile üretildi":"Demo AI üreticisi kullanıldı";
     $("#aiCardsPreview").innerHTML=renderAiCards();
     bindAiSave();
   }catch(e){status.textContent="Kart üretilemedi."}finally{gen.disabled=false}
 };
 bindAiSave();
}
function bindAiSave(){
  const b=$("#saveAiCards");if(!b)return;
  b.onclick=async()=>{
    const selected=[...document.querySelectorAll("[data-ai-card]:checked")].map(x=>generatedCards[Number(x.dataset.aiCard)]).filter(Boolean);
    if(!selected.length)return;
    b.disabled=true;b.textContent="Ekleniyor…";
    try{
      await api("/api/ai/cards/"+code+"/save",{method:"POST",body:JSON.stringify({cards:selected})});
      b.textContent="Kartlara eklendi ✓";
    }catch{b.disabled=false;b.textContent="Tekrar dene"}
  };
}
async function savePermissions(){const e=experts.find(x=>x.id===selectedId),kids=[...document.querySelectorAll("[data-kid]:checked")].map(x=>x.dataset.kid);await api("/api/expert/connection/"+code,{method:"POST",body:JSON.stringify({expertId:e.id,childProfileIds:kids,familyChatAccess:!!$("#familyChatAccess")?.checked})});await load()}
load().catch(e=>{$("#expertApp").innerHTML='<div class="expert-card">Uzman alanı yüklenemedi.</div>';console.error(e)});