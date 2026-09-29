const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const api=async(url,opt={})=>{const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text());return r.json()};
let experts=[],state=null,expertId=localStorage.getItem("parently_expert")||"exp1",familyCode=localStorage.getItem("parently_expert_family")||"UZMANDEMO1";
let tab="families",channel="private",aiSummary=null,aiDraft="",aiTool=null;

function exp(){return experts.find(x=>x.id===expertId)||experts[0]}
function link(){return (state.expertConnections||[]).find(x=>x.expertId===expertId&&x.status!=="revoked")}
function kids(){return (state.profiles||[]).filter(x=>x.role==="child")}
function allowedKids(){const l=link();return kids().filter(k=>(l?.childProfileIds||[]).includes(k.id))}
function fmt(d){try{return new Date(d).toLocaleString("tr-TR")}catch{return d||""}}
function renderSidebar(){
 const e=exp(),l=link(),parents=(state.profiles||[]).filter(x=>x.role==="parent");
 return '<aside class="xp-card"><div class="profile-hero"><span class="profile-avatar" style="background:'+e.color+'">'+esc(e.avatar)+'</span><div><b>'+esc(e.name)+'</b><small>'+esc(e.title)+'</small></div></div><hr><h3>'+esc(state.familyName||familyCode)+'</h3><div class="xp-family"><b>Ebeveynler</b><small>'+parents.map(x=>esc(x.name)).join(", ")+'</small></div><div class="xp-family"><b>Çocuklar</b><small>'+kids().map(x=>esc(x.name+" · "+(x.age||"")+" yaş")).join("<br>")+'</small></div><div class="perm"><span>'+(l?"Bağlantı aktif":"Bağlantı yok")+'</span>'+(l?.familyChatAccess?'<span>Aile sohbeti açık</span>':'')+(l?.childProfileIds||[]).map(id=>'<span>'+esc(state.profiles.find(x=>x.id===id)?.name||id)+'</span>').join("")+'</div></aside>';
}
async function boot(){
 experts=await api("/api/experts");
 $("#expertSelect").innerHTML=experts.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.title)+'</option>').join("");
 $("#expertSelect").value=expertId;$("#familySelect").value=familyCode;
 $("#expertSelect").onchange=()=>{expertId=$("#expertSelect").value;localStorage.setItem("parently_expert",expertId);aiSummary=null;aiDraft="";aiTool=null;load()};
 $("#familySelect").onchange=()=>{familyCode=$("#familySelect").value;localStorage.setItem("parently_expert_family",familyCode);aiSummary=null;aiDraft="";aiTool=null;load()};
 $$("[data-xp-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.xpTab;$$("[data-xp-tab]").forEach(x=>x.classList.toggle("active",x===b));render()});
 await load();
}
async function load(){
 state=await api("/api/state/"+encodeURIComponent(familyCode));
 ["expertMessages","expertSessions","expertConnections","expertNotes","expertPrograms","expertProgramAssignments"].forEach(k=>state[k]||=[]);
 render();
}
function render(){if(!state)return;$("#xpApp").innerHTML='<div class="xp-grid">'+renderSidebar()+'<section>'+({families:renderFamilyFile,messages:renderMessages,sessions:renderSessions,programs:renderPrograms,ai:renderAI,profile:renderProfile}[tab]||renderFamilyFile)()+'</section></div>';bindTab()}
function renderFamilyFile(){
 const l=link(),ak=allowedKids();
 const moods=(state.moods||[]).filter(m=>ak.some(k=>k.id===m.profileId)).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
 const notes=(state.expertNotes||[]).filter(n=>n.expertId===expertId).slice().reverse();
 const tasks=(state.tasks||[]).filter(t=>t.expertId===expertId).slice().reverse().slice(0,8);
 return '<section class="xp-card"><div class="section-head"><div><span class="eyebrow">AİLE DOSYASI</span><h2>'+esc(state.familyName||familyCode)+'</h2></div></div><div class="metric-grid"><div class="metric"><span>Çocuk</span><b>'+ak.length+'</b></div><div class="metric"><span>Özel not</span><b>'+notes.filter(n=>!n.sharedWithFamily).length+'</b></div><div class="metric"><span>Paylaşılan not</span><b>'+notes.filter(n=>n.sharedWithFamily).length+'</b></div><div class="metric"><span>Aktif program</span><b>'+state.expertProgramAssignments.filter(a=>a.expertId===expertId&&a.status==="active").length+'</b></div></div></section>'+
 '<div class="two-col section"><section class="xp-card"><h3>Son duygu kayıtları</h3>'+(moods.map(m=>'<div class="task-card"><b>'+esc(state.profiles.find(x=>x.id===m.profileId)?.name||"Çocuk")+' · '+esc(m.mood+" "+(m.label||""))+'</b><small>'+esc(m.date)+' · '+esc(m.note||"Not yok")+'</small></div>').join("")||'<div class="empty">İzin verilen kayıt yok.</div>')+'</section><section class="xp-card"><h3>Uzman görevleri</h3>'+(tasks.map(t=>'<div class="task-card"><b>'+esc(t.title)+'</b><small>'+esc(t.description||"")+' · '+esc(t.status)+'</small></div>').join("")||'<div class="empty">Henüz görev göndermediniz.</div>')+'</section></div>'+
 '<div class="two-col section"><section class="xp-card"><h3>Özel uzman notları</h3><div class="stack-form"><label>Çocuk<select id="noteChild" class="input"><option value="">Genel aile notu</option>'+ak.map(k=>'<option value="'+k.id+'">'+esc(k.name)+'</option>').join("")+'</select></label><label>Başlık<input id="noteTitle" class="input" placeholder="Örn. 29 Eylül görüşme notu"></label><label>Not<textarea id="noteText" class="input" rows="5" placeholder="Sadece uzman tarafından görülecek çalışma notu..."></textarea></label><label><input id="noteShared" type="checkbox"> Aileyle paylaş</label><button id="saveNote" class="primary">Notu kaydet</button></div></section><section class="xp-card"><h3>Kayıtlı notlar</h3>'+(notes.map(n=>'<div class="note '+(n.sharedWithFamily?"shared":"")+'"><div><b>'+esc(n.title||"Uzman notu")+'</b> <span class="status">'+(n.sharedWithFamily?"Aileyle paylaşıldı":"Özel")+'</span></div><p>'+esc(n.text)+'</p><small>'+fmt(n.createdAt)+'</small></div>').join("")||'<div class="empty">Henüz not yok.</div>')+'</section></div>'+
 '<section class="xp-card section"><h3>Aileye küçük görev gönder</h3><div class="form-grid"><label>Çocuk<select id="taskChild" class="input">'+ak.map(k=>'<option value="'+k.id+'">'+esc(k.name)+'</option>').join("")+'</select></label><label>Görev başlığı<input id="taskTitle" class="input" placeholder="10 dakika özel zaman"></label><label>Açıklama<textarea id="taskDesc" class="input" rows="3"></textarea></label><label>Tarih<input id="taskDue" type="date" class="input" value="'+new Date().toISOString().slice(0,10)+'"></label></div><div class="xp-controls"><button id="sendTask" class="primary">Aileye gönder</button></div></section>';
}
function renderMessages(){
 const l=link(),msgs=(state.expertMessages||[]).filter(x=>x.expertId===expertId&&x.channel===channel);
 return '<section class="xp-card"><div class="xp-tabs"><button id="privateTab" class="secondary '+(channel==="private"?"active":"")+'">Özel mesaj</button><button id="familyTab" class="secondary '+(channel==="family"?"active":"")+'" '+(!l?.familyChatAccess?"disabled":"")+'>Aile sohbeti</button></div><div class="xp-chat">'+(msgs.map(m=>'<div class="xp-msg '+(m.senderType==="expert"?"me":"")+'">'+esc(m.text)+'<small>'+fmt(m.at)+'</small></div>').join("")||'<div class="empty">Henüz mesaj yok.</div>')+'</div><div class="xp-compose"><input id="xpMsg" class="input" placeholder="Mesaj yaz…"><button id="xpSend" class="primary" '+(!l?"disabled":"")+'>Gönder</button></div><div class="xp-controls" style="margin-top:10px"><button id="aiReplyInline" class="secondary">✨ AI yanıt taslağı</button></div></section>';
}
function renderSessions(){
 const sessions=(state.expertSessions||[]).filter(x=>x.expertId===expertId).slice().reverse();
 return '<section class="xp-card"><span class="eyebrow">GÖRÜŞMELER</span><h2>Randevu ve görüntülü görüşmeler</h2>'+(sessions.map(s=>'<div class="session"><div><b>Görüntülü görüşme</b> <span class="status">'+esc(s.status)+'</span></div><small>'+fmt(s.requestedAt)+'</small><div class="xp-controls">'+(s.status==="requested"?'<button class="primary" data-accept="'+s.id+'">Kabul et</button>':'')+(['accepted','active'].includes(s.status)?'<a class="primary" target="_blank" rel="noopener" href="'+esc(s.roomUrl)+'">Görüşmeye katıl ↗</a>':'')+(s.status==="active"?'<button class="secondary" data-complete="'+s.id+'">Tamamla</button>':'')+'</div></div>').join("")||'<div class="empty">Henüz görüşme talebi yok.</div>')+'</section>'+
 '<section class="xp-card section"><h3>Görüşme sonrası kısa not</h3><textarea id="sessionNoteText" class="input" rows="5" placeholder="Konuşulanlar, aile için sonraki küçük adım..."></textarea><div class="xp-controls"><button id="saveSessionNote" class="secondary">Özel not olarak kaydet</button><button id="aiPostFromNote" class="primary">✨ AI aile özeti taslağı</button></div><div id="sessionAiOutput" class="xp-ai-output">'+(aiTool?.mode==="postsummary"?renderTool(aiTool.data):'<div class="empty">Henüz taslak yok.</div>')+'</div></section>';
}
function renderPrograms(){
 const programs=(state.expertPrograms||[]).filter(p=>p.expertId===expertId),assignments=(state.expertProgramAssignments||[]).filter(a=>a.expertId===expertId),ak=allowedKids();
 return '<section class="xp-card"><span class="eyebrow">KART & PROGRAMLAR</span><h2>Uzman programları</h2><p class="muted">Program oluşturun, aileye atayın; ilk haftanın görevi aile ajandasına otomatik eklenir.</p><div class="xp-controls"><button id="createBondProgram" class="primary">+ 4 Haftalık Bağ Programı oluştur</button></div>'+(programs.map(p=>'<div class="program-card"><div><b>'+esc(p.title)+'</b><small>'+esc(p.description||"")+'</small></div><div class="week-grid">'+(p.weeks||[]).map(w=>'<div class="week-box"><b>'+w.week+'. hafta · '+esc(w.title)+'</b><small>'+esc(w.goal)+'</small><p>'+esc(w.task)+'</p></div>').join("")+'</div><div class="xp-controls"><select data-program-child="'+p.id+'" class="input">'+ak.map(k=>'<option value="'+k.id+'">'+esc(k.name)+'</option>').join("")+'</select><button class="secondary" data-assign-program="'+p.id+'">Aileye ata</button></div></div>').join("")||'<div class="empty">Henüz program yok.</div>')+'</section>'+
 '<section class="xp-card section"><h3>Aktif atamalar</h3>'+(assignments.map(a=>'<div class="task-card"><b>'+esc(programs.find(p=>p.id===a.programId)?.title||"Program")+'</b><small>'+esc(state.profiles.find(x=>x.id===a.childId)?.name||a.childId)+' · '+esc(a.status)+'</small></div>').join("")||'<div class="empty">Henüz program atanmadı.</div>')+'</section>'+
 '<section class="xp-card section"><h3>AI ile aileye özel kart üret</h3><div class="form-grid"><label>Çocuk<select id="proAiChild" class="input">'+ak.map(k=>'<option value="'+k.id+'">'+esc(k.name)+'</option>').join("")+'</select></label><label>Konu<input id="proAiTopic" class="input" placeholder="Örn. okulda arkadaşlık"></label></div><div class="xp-controls"><button id="proGenerateCard" class="primary">✨ 3 kart üret</button></div><div id="proCardResult" class="xp-ai-output">'+(aiTool?.mode==="cards"?renderTool(aiTool.data):'<div class="empty">Henüz kart üretilmedi.</div>')+'</div></section>';
}
function renderAI(){
 return '<section class="xp-card"><span class="eyebrow">AI ASİSTAN</span><h2>Görüşme hazırlığı ve yazım desteği</h2><p class="muted">AI yalnızca uzman erişimi verilen verileri kullanır. Çıktılar taslaktır; karar ve gönderim uzmana aittir.</p><div class="three-col"><button id="aiPrebrief" class="primary">Görüşme öncesi özet</button><button id="aiQuestions" class="secondary">Görüşme soruları üret</button><button id="aiReply" class="secondary">Yanıt taslağı oluştur</button></div><label class="stack-form section">Ek yönerge<textarea id="aiInstruction" class="input" rows="3" placeholder="Örn. özellikle okul ve kardeş ilişkisine odaklan"></textarea></label><div id="aiExpertOutput" class="xp-ai-output">'+renderAIOutput()+'</div></section>';
}
function renderAIOutput(){
 if(aiDraft)return '<div class="ai-draft"><span class="eyebrow">YANIT TASLAĞI</span><textarea id="aiDraftText" class="input" rows="6">'+esc(aiDraft)+'</textarea><div class="xp-controls"><button id="copyDraftToMessage" class="secondary">Mesajlara aktar</button></div></div>';
 if(aiSummary)return renderTool(aiSummary);
 if(aiTool)return renderTool(aiTool.data);
 return '<div class="empty">Henüz AI çıktısı yok.</div>';
}
function renderTool(data){
 if(!data)return '<div class="empty">Çıktı yok.</div>';
 if(Array.isArray(data))return '<ul>'+data.map(x=>'<li>'+esc(typeof x==="string"?x:JSON.stringify(x))+'</li>').join("")+'</ul>';
 if(data.cards)return '<div>'+data.cards.map(c=>'<div class="task-card"><b>'+esc((c.emoji||"💬")+" "+c.question)+'</b><small>'+esc(c.followUp||"")+'</small></div>').join("")+'<div class="xp-controls"><button id="sendGeneratedCards" class="secondary">Bu kartları aileye gönder</button></div></div>';
 let html="";
 for(const [k,v] of Object.entries(data)){const label={brief:"Özet",priorities:"Öncelikler",questions:"Sorular",familySummary:"Aileye gönderilecek özet",nextSteps:"Sonraki adımlar",recommendedCards:"Önerilen kart temaları",summary:"Özet",strengths:"Güçlü taraflar",attentionPoints:"Dikkat noktaları",conversationIdeas:"Görüşme fikirleri"}[k]||k;if(Array.isArray(v))html+='<div class="section"><b>'+esc(label)+'</b><ul>'+v.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></div>';else html+='<div class="section"><b>'+esc(label)+'</b><p>'+esc(v)+'</p></div>'}
 return html;
}
function renderProfile(){
 const e=exp();
 return '<section class="xp-card"><div class="profile-hero"><span class="profile-avatar" style="background:'+e.color+'">'+esc(e.avatar)+'</span><div><span class="eyebrow">UZMAN PROFİLİM</span><h2>'+esc(e.name)+'</h2><p>'+esc(e.title)+'</p></div></div><div class="form-grid section"><label>Ad<input id="pfName" class="input" value="'+esc(e.name)+'"></label><label>Unvan<input id="pfTitle" class="input" value="'+esc(e.title)+'"></label><label>Deneyim yılı<input id="pfYears" type="number" class="input" value="'+esc(e.experienceYears||0)+'"></label><label>Uygunluk<input id="pfAvailability" class="input" value="'+esc(e.availability||"")+'"></label></div><div class="stack-form"><label>Kısa tanıtım<textarea id="pfBio" class="input" rows="4">'+esc(e.bio||"")+'</textarea></label><label>Çalışma yaklaşımı<textarea id="pfApproach" class="input" rows="4">'+esc(e.approach||"")+'</textarea></label><label>Eğitimler <span class="subtle">Her satıra bir eğitim</span><textarea id="pfEducation" class="input" rows="5">'+esc((e.education||[]).join("\n"))+'</textarea></label><label>Uzmanlık alanları <span class="subtle">Virgülle ayırın</span><input id="pfSpecialties" class="input" value="'+esc((e.specialties||[]).join(", "))+'"></label><label>Diller <span class="subtle">Virgülle ayırın</span><input id="pfLanguages" class="input" value="'+esc((e.languages||[]).join(", "))+'"></label></div><div class="xp-controls section"><button id="saveProfile" class="primary">Profili kaydet</button></div></section>';
}
function bindTab(){
 if(tab==="families")bindFamily();if(tab==="messages")bindMessages();if(tab==="sessions")bindSessions();if(tab==="programs")bindPrograms();if(tab==="ai")bindAI();if(tab==="profile")bindProfile();
}
function bindFamily(){
 $("#saveNote")?.addEventListener("click",async()=>{const text=$("#noteText").value.trim();if(!text)return;await api("/api/expert/note/"+familyCode,{method:"POST",body:JSON.stringify({expertId,childId:$("#noteChild").value,title:$("#noteTitle").value,text,sharedWithFamily:$("#noteShared").checked})});await load()});
 $("#sendTask")?.addEventListener("click",async()=>{await api("/api/expert/task/"+familyCode,{method:"POST",body:JSON.stringify({expertId,childId:$("#taskChild").value,title:$("#taskTitle").value,description:$("#taskDesc").value,due:$("#taskDue").value})});await load()});
}
function bindMessages(){
 $("#privateTab").onclick=()=>{channel="private";render()};$("#familyTab")?.addEventListener("click",()=>{channel="family";render()});
 $("#xpSend")?.addEventListener("click",async()=>{const text=$("#xpMsg").value.trim();if(!text)return;await api("/api/expert/message/"+familyCode,{method:"POST",body:JSON.stringify({expertId,senderType:"expert",senderId:expertId,channel,text})});await load()});
 $("#aiReplyInline")?.addEventListener("click",async()=>{const out=await api("/api/ai/expert-reply/"+familyCode,{method:"POST",body:JSON.stringify({expertId})});const box=$("#xpMsg");if(box)box.value=out.result?.draft||""});
}
function bindSessions(){
 $$("[data-accept]").forEach(b=>b.onclick=async()=>{await api("/api/expert/session/"+familyCode,{method:"POST",body:JSON.stringify({action:"accept",sessionId:b.dataset.accept})});await load()});
 $$("[data-complete]").forEach(b=>b.onclick=async()=>{await api("/api/expert/session/"+familyCode,{method:"POST",body:JSON.stringify({action:"complete",sessionId:b.dataset.complete})});await load()});
 $("#saveSessionNote")?.addEventListener("click",async()=>{const text=$("#sessionNoteText").value.trim();if(!text)return;await api("/api/expert/note/"+familyCode,{method:"POST",body:JSON.stringify({expertId,type:"session",title:"Görüşme sonrası not",text,sharedWithFamily:false})});await load()});
 $("#aiPostFromNote")?.addEventListener("click",async()=>{const out=await api("/api/ai/expert-tool/"+familyCode,{method:"POST",body:JSON.stringify({expertId,mode:"postsummary",instruction:$("#sessionNoteText").value})});aiTool={mode:"postsummary",data:out.result};render()});
}
function bindPrograms(){
 $("#createBondProgram")?.addEventListener("click",async()=>{const weeks=[
 {title:"Dinleme",goal:"Çocuğun deneyimini çözüm vermeden dinlemek",task:"Bu hafta iki kez 10 dakika özel dinleme zamanı ayırın.",cardPrompt:"Bugün seni en çok düşündüren şey neydi?"},
 {title:"Duygular",goal:"Duyguları isimlendirmek ve kabul etmek",task:"Üç gün kısa duygu check-in'i yapın.",cardPrompt:"Bu hafta en güçlü hissettiğin duygu neydi?"},
 {title:"Sınırlar",goal:"Sınırları açık ve sakin biçimde konuşmak",task:"Bir ev kuralını birlikte konuşup nedenini yazın.",cardPrompt:"Evde hangi kural sana en zor geliyor?"},
 {title:"Aile rutini",goal:"Sürdürülebilir bir bağ ritüeli oluşturmak",task:"Haftalık 20 dakikalık aile zamanı belirleyin.",cardPrompt:"Birlikte yapmayı istediğin küçük bir şey ne?"}
 ];await api("/api/expert/program/"+familyCode,{method:"POST",body:JSON.stringify({action:"create",expertId,title:"4 Haftalık Ebeveyn–Çocuk Bağ Programı",description:"Dinleme, duygu, sınırlar ve aile rutini üzerine dört haftalık yapı.",weeks})});await load()});
 $$("[data-assign-program]").forEach(b=>b.onclick=async()=>{const sel=$('[data-program-child="'+b.dataset.assignProgram+'"]');await api("/api/expert/program/"+familyCode,{method:"POST",body:JSON.stringify({action:"assign",programId:b.dataset.assignProgram,childId:sel?.value||""})});await load()});
 $("#proGenerateCard")?.addEventListener("click",async()=>{const out=await api("/api/ai/cards/"+familyCode,{method:"POST",body:JSON.stringify({profileId:$("#proAiChild").value,topic:$("#proAiTopic").value,goal:"Uzman tarafından önerilen",count:3})});aiTool={mode:"cards",data:out};render()});
 $("#sendGeneratedCards")?.addEventListener("click",async()=>{if(!aiTool?.data?.cards?.length)return;await api("/api/ai/cards/"+familyCode+"/save",{method:"POST",body:JSON.stringify({cards:aiTool.data.cards})});$("#sendGeneratedCards").textContent="Aile kartlarına eklendi ✓";$("#sendGeneratedCards").disabled=true});
}
function bindAI(){
 $("#aiPrebrief")?.addEventListener("click",async()=>{const out=await api("/api/ai/expert-tool/"+familyCode,{method:"POST",body:JSON.stringify({expertId,mode:"prebrief",instruction:$("#aiInstruction").value})});aiTool={mode:"prebrief",data:out.result};aiSummary=null;aiDraft="";render()});
 $("#aiQuestions")?.addEventListener("click",async()=>{const out=await api("/api/ai/expert-tool/"+familyCode,{method:"POST",body:JSON.stringify({expertId,mode:"questions",instruction:$("#aiInstruction").value})});aiTool={mode:"questions",data:out.result};aiSummary=null;aiDraft="";render()});
 $("#aiReply")?.addEventListener("click",async()=>{const out=await api("/api/ai/expert-reply/"+familyCode,{method:"POST",body:JSON.stringify({expertId,instruction:$("#aiInstruction").value})});aiDraft=out.result?.draft||"";aiTool=null;aiSummary=null;render()});
 $("#copyDraftToMessage")?.addEventListener("click",()=>{channel="private";tab="messages";$$("[data-xp-tab]").forEach(b=>b.classList.toggle("active",b.dataset.xpTab==="messages"));render();setTimeout(()=>{if($("#xpMsg"))$("#xpMsg").value=$("#aiDraftText")?.value||aiDraft},0)});
}
function bindProfile(){
 $("#saveProfile")?.addEventListener("click",async()=>{await api("/api/expert/profile/"+expertId,{method:"POST",body:JSON.stringify({name:$("#pfName").value,title:$("#pfTitle").value,experienceYears:Number($("#pfYears").value)||0,availability:$("#pfAvailability").value,bio:$("#pfBio").value,approach:$("#pfApproach").value,education:$("#pfEducation").value.split("\n").map(x=>x.trim()).filter(Boolean),specialties:$("#pfSpecialties").value.split(",").map(x=>x.trim()).filter(Boolean),languages:$("#pfLanguages").value.split(",").map(x=>x.trim()).filter(Boolean)})});experts=await api("/api/experts");$("#expertSelect").innerHTML=experts.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.title)+'</option>').join("");$("#expertSelect").value=expertId;render()});
}
boot().catch(e=>{$("#xpApp").innerHTML='<div class="xp-card">Uzman portalı yüklenemedi.</div>';console.error(e)});