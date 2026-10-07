const SUPABASE_URL='https://hroarfuwpfsqilsijwpp.supabase.co';
const SUPABASE_KEY='sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const state={zones:[],staff:[],schedules:[],logs:[],assignments:[],view:'dashboard',drawMode:false,drawStart:null,overlayVisible:true,activeZone:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const dayNames=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),1800)}
function openModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
window.closeModal=closeModal;
$('#closeModal').onclick=closeModal;
$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};

function manualZones(){return state.zones.filter(z=>z.manual&&z.active)}
function zoneById(id){return state.zones.find(z=>String(z.id)===String(id))}
function staffById(id){return state.staff.find(p=>String(p.id)===String(id))}
function scheduleById(id){return state.schedules.find(s=>String(s.id)===String(id))}
function zoneAssignments(zoneId){return state.assignments.filter(a=>String(a.zone_id)===String(zoneId))}
function assignedStaff(zoneId){return zoneAssignments(zoneId).map(a=>staffById(a.staff_id)).filter(Boolean)}
function getLog(scheduleId,date=today()){return state.logs.find(l=>String(l.schedule_id)===String(scheduleId)&&l.work_date===date)}

async function loadAll(){
 $('#dbState').textContent='● Bağlanıyor';$('#dbState').className='db-state';
 try{
  const [z,p,s,l,a]=await Promise.all([
   db.from('emigro_cleaning_zones').select('*').order('sort_order'),
   db.from('emigro_cleaning_staff').select('*').order('name'),
   db.from('emigro_cleaning_schedules').select('*').order('planned_time',{ascending:true}),
   db.from('emigro_cleaning_logs').select('*').order('work_date',{ascending:false}).limit(500),
   db.from('emigro_cleaning_assignments').select('*')
  ]);
  [z,p,s,l,a].forEach(r=>{if(r.error)throw r.error});
  state.zones=z.data||[];state.staff=p.data||[];state.schedules=s.data||[];state.logs=l.data||[];state.assignments=a.data||[];
  $('#dbState').textContent='● Veritabanı bağlı';$('#dbState').className='db-state ok';
  renderAll();
 }catch(err){console.error(err);$('#dbState').textContent='● Bağlantı hatası';$('#dbState').className='db-state bad';toast('Veritabanına bağlanılamadı')}
}

function dueToday(sc,d=new Date()){
 if(!sc.active)return false;
 const iso=d.toISOString().slice(0,10),dow=d.getDay(),dom=d.getDate();
 if(sc.frequency==='daily')return true;
 if(sc.frequency==='weekly')return (sc.weekdays||[]).includes(dow);
 if(sc.frequency==='monthly')return Number(sc.month_day)===dom;
 if(sc.frequency==='once')return sc.due_date===iso;
 return false;
}
function freqLabel(sc){
 if(sc.frequency==='daily')return 'Her gün';
 if(sc.frequency==='weekly')return 'Haftalık · '+(sc.weekdays||[]).map(d=>dayNames[d]).join(', ');
 if(sc.frequency==='monthly')return 'Her ay '+(sc.month_day||1)+'. gün';
 return 'Tek sefer · '+(sc.due_date||'');
}

function renderAll(){renderDashboard();renderPlan();renderSchedule();renderStaff();renderHistory();fillHistoryFilters()}
function renderDashboard(){
 const zones=manualZones();
 const due=state.schedules.filter(s=>s.active&&zoneById(s.zone_id)?.manual&&dueToday(s));
 const done=due.filter(s=>getLog(s.id)?.status==='done').length;
 $('#mZones').textContent=zones.length;$('#mDue').textContent=due.length;$('#mDone').textContent=done;$('#mStaff').textContent=state.staff.filter(p=>p.active).length;
 $('#todayText').textContent=new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 $('#todayList').innerHTML=due.length?due.map(sc=>{
  const z=zoneById(sc.zone_id),p=staffById(sc.staff_id),log=getLog(sc.id),isDone=log?.status==='done';
  return `<article class="task-row ${isDone?'done':''}">
    <div><h3>${esc(sc.task_title)}</h3><div class="sub">📍 ${esc(z?.name||'Alan')} ${sc.instructions?' · '+esc(sc.instructions):''}</div></div>
    <div><span class="pill">👤 ${esc(p?.name||'Atanmamış')}</span></div>
    <div><span class="pill">🕒 ${sc.planned_time?sc.planned_time.slice(0,5):'Saat yok'}</span></div>
    <div class="row-actions">${isDone?`<button onclick="undoDone(${sc.id})">✓ Tamamlandı</button>`:`<button class="ok" onclick="completeTask(${sc.id})">Tamamla</button><button onclick="skipTask(${sc.id})">Atla</button>`}</div>
  </article>`
 }).join(''):'<div class="sub">Bugün için tanımlı görev yok.</div>';
}
window.completeTask=async id=>{
 const sc=scheduleById(id);if(!sc)return;const note=prompt('Not (isteğe bağlı):','')??'';
 const {error}=await db.from('emigro_cleaning_logs').upsert({schedule_id:sc.id,zone_id:sc.zone_id,staff_id:sc.staff_id,work_date:today(),status:'done',completed_at:new Date().toISOString(),note},{onConflict:'schedule_id,work_date'});
 if(error)return toast(error.message);toast('Görev tamamlandı');loadAll()
};
window.skipTask=async id=>{
 const sc=scheduleById(id);if(!sc)return;const note=prompt('Atlama nedeni:','')??'';
 const {error}=await db.from('emigro_cleaning_logs').upsert({schedule_id:sc.id,zone_id:sc.zone_id,staff_id:sc.staff_id,work_date:today(),status:'skipped',note},{onConflict:'schedule_id,work_date'});
 if(error)return toast(error.message);loadAll()
};
window.undoDone=async id=>{const log=getLog(id);if(!log)return;await db.from('emigro_cleaning_logs').delete().eq('id',log.id);loadAll()};

function renderPlan(){
 const zones=manualZones();
 $('#zoneCount').textContent=zones.length;
 const overlay=$('#zoneOverlay');overlay.innerHTML='';overlay.style.display=state.overlayVisible?'block':'none';
 zones.forEach(z=>{
  const e=document.createElement('div');e.className='zone-box'+(state.activeZone===z.id?' active':'');e.style.cssText=`left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;--zone:${z.color||'#f47a20'}`;
  const people=assignedStaff(z.id).map(p=>p.name).join(', ');
  e.innerHTML=`<span class="zone-label">${esc(z.name)}${people?'<br><small>'+esc(people)+'</small>':''}</span>`;
  e.onclick=ev=>{ev.stopPropagation();state.activeZone=z.id;renderPlan();openZoneModal(z.id)};
  overlay.append(e)
 });
 $('#zoneList').innerHTML=zones.length?zones.map(z=>{
  const people=assignedStaff(z.id);
  return `<button class="zone-item ${state.activeZone===z.id?'active':''}" onclick="selectZone(${z.id})"><span class="zone-dot" style="background:${z.color||'#f47a20'}"></span><span><b>${esc(z.name)}</b><span>${people.length?people.map(p=>esc(p.name)).join(', '):'Personel atanmadı'}</span></span></button>`
 }).join(''):'<div class="sub" style="padding:12px">Henüz alan çizilmedi. “Alan Seç” ile plan üzerinden başlayın.</div>';
}
window.selectZone=id=>{state.activeZone=id;renderPlan();openZoneModal(id)};

function startDraw(){
 state.drawMode=true;state.drawStart=null;$('#drawHint').classList.remove('hidden');$('#drawBtn').textContent='Çizimi İptal';$('#drawBtn').classList.add('danger-btn');
}
function cancelDraw(){
 state.drawMode=false;state.drawStart=null;$('#drawHint').classList.add('hidden');$('#drawRect').classList.add('hidden');$('#drawBtn').textContent='+ Alan Seç';$('#drawBtn').classList.remove('danger-btn')
}
function posPct(ev){
 const r=$('#planStage').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,(ev.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(ev.clientY-r.top)/r.height*100))}
}
$('#planStage').addEventListener('pointerdown',e=>{
 if(!state.drawMode)return;
 e.preventDefault();$('#planStage').setPointerCapture(e.pointerId);
 state.drawStart=posPct(e);const dr=$('#drawRect');dr.classList.remove('hidden');dr.style.left=state.drawStart.x+'%';dr.style.top=state.drawStart.y+'%';dr.style.width='0%';dr.style.height='0%';
});
$('#planStage').addEventListener('pointermove',e=>{
 if(!state.drawMode||!state.drawStart)return;
 const p=posPct(e),x=Math.min(p.x,state.drawStart.x),y=Math.min(p.y,state.drawStart.y),w=Math.abs(p.x-state.drawStart.x),h=Math.abs(p.y-state.drawStart.y);
 const dr=$('#drawRect');dr.style.left=x+'%';dr.style.top=y+'%';dr.style.width=w+'%';dr.style.height=h+'%';
});
$('#planStage').addEventListener('pointerup',e=>{
 if(!state.drawMode||!state.drawStart)return;
 const p=posPct(e),box={x:Math.min(p.x,state.drawStart.x),y:Math.min(p.y,state.drawStart.y),w:Math.abs(p.x-state.drawStart.x),h:Math.abs(p.y-state.drawStart.y)};
 state.drawStart=null;$('#drawRect').classList.add('hidden');
 if(box.w<1||box.h<1){toast('Alan çok küçük');return}
 cancelDraw();openNewZoneModal(box);
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.drawMode)cancelDraw()});

function staffChecks(zoneId){
 const assigned=new Set(zoneAssignments(zoneId).map(a=>String(a.staff_id)));
 return state.staff.filter(p=>p.active).map(p=>`<label class="check"><input type="checkbox" name="staff_ids" value="${p.id}" ${assigned.has(String(p.id))?'checked':''}> ${esc(p.name)}</label>`).join('')||'<div class="sub">Önce personel ekleyin.</div>'
}
function zoneForm(z){
 return `<h2>${z.id?'Alanı Düzenle':'Yeni Temizlik Alanı'}</h2>
 <form id="zoneForm"><div class="form-grid">
  <div class="field"><label>Alan adı</label><input name="name" required value="${esc(z.name||'')}"></div>
  <div class="field"><label>Renk</label><input name="color" type="color" value="${z.color||'#f47a20'}"></div>
  <div class="field full"><label>Alan tanımı / temizlenecekler</label><textarea name="description" placeholder="Örn. zemin, raf altları, cam yüzeyler, çöp...">${esc(z.description||'')}</textarea></div>
  <div class="field full"><label>Bu alandan sorumlu kişiler</label><div class="checks">${staffChecks(z.id)}</div></div>
 </div>
 <div class="form-actions">${z.id?'<button type="button" class="danger-btn" id="deleteZone">Alanı Sil</button>':''}<button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`
}
function openNewZoneModal(box){
 const z={name:'',description:'',color:'#f47a20',x:+box.x.toFixed(3),y:+box.y.toFixed(3),w:+box.w.toFixed(3),h:+box.h.toFixed(3),manual:true,active:true};
 openModal(zoneForm(z));
 bindZoneForm(z,true)
}
function openZoneModal(id){
 const z=zoneById(id);if(!z)return;openModal(zoneForm(z));bindZoneForm(z,false)
}
window.openZoneModal=openZoneModal;
function bindZoneForm(z,isNew){
 $('#zoneForm').onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(e.target);
  const row={name:fd.get('name'),description:fd.get('description'),color:fd.get('color'),manual:true,active:true,x:z.x,y:z.y,w:z.w,h:z.h,shape:'rect',code:z.code||('MANUAL-'+Date.now())};
  let zoneId=z.id;
  if(isNew){const {data,error}=await db.from('emigro_cleaning_zones').insert(row).select().single();if(error)return toast(error.message);zoneId=data.id}
  else{const {error}=await db.from('emigro_cleaning_zones').update(row).eq('id',z.id);if(error)return toast(error.message)}
  const ids=fd.getAll('staff_ids').map(Number);
  await db.from('emigro_cleaning_assignments').delete().eq('zone_id',zoneId);
  if(ids.length){const {error}=await db.from('emigro_cleaning_assignments').insert(ids.map(staff_id=>({zone_id:zoneId,staff_id})));if(error)return toast(error.message)}
  closeModal();toast('Alan kaydedildi');await loadAll();
 };
 if(z.id)$('#deleteZone').onclick=async()=>{
  if(!confirm('Bu temizlik alanını silmek istiyor musunuz?'))return;
  const {error}=await db.from('emigro_cleaning_zones').delete().eq('id',z.id);if(error)return toast(error.message);
  closeModal();state.activeZone=null;loadAll()
 }
}

function renderStaff(){
 $('#staffGrid').innerHTML=state.staff.length?state.staff.map(p=>{
  const zoneCount=new Set(state.assignments.filter(a=>a.staff_id===p.id).map(a=>a.zone_id)).size;
  return `<article class="staff-card"><h3>${esc(p.name)}</h3><p>${esc(p.role||'Rol belirtilmedi')}${p.phone?' · '+esc(p.phone):''}</p><div style="margin-top:8px"><span class="pill">${zoneCount} alan</span></div><div class="row-actions"><button onclick="editStaff(${p.id})">Düzenle</button></div></article>`
 }).join(''):'<div class="sub">Personel eklenmedi.</div>'
}
function staffForm(p={}){
 return `<h2>${p.id?'Personeli Düzenle':'Personel Ekle'}</h2><form id="staffForm"><div class="form-grid">
 <div class="field"><label>Ad Soyad</label><input name="name" required value="${esc(p.name||'')}"></div>
 <div class="field"><label>Rol</label><input name="role" value="${esc(p.role||'')}"></div>
 <div class="field"><label>Telefon</label><input name="phone" value="${esc(p.phone||'')}"></div>
 <div class="field"><label>Durum</label><select name="active"><option value="true" ${p.active!==false?'selected':''}>Aktif</option><option value="false" ${p.active===false?'selected':''}>Pasif</option></select></div>
 </div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`
}
window.editStaff=id=>{
 const p=state.staff.find(x=>x.id===id)||{};openModal(staffForm(p));
 $('#staffForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),row={name:fd.get('name'),role:fd.get('role'),phone:fd.get('phone'),active:fd.get('active')==='true'};const q=p.id?db.from('emigro_cleaning_staff').update(row).eq('id',p.id):db.from('emigro_cleaning_staff').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();loadAll()}
};

function renderSchedule(){
 const rows=state.schedules.filter(sc=>zoneById(sc.zone_id)?.manual);
 $('#scheduleList').innerHTML=rows.length?rows.map(sc=>{
  const z=zoneById(sc.zone_id),p=staffById(sc.staff_id);
  return `<article class="data-row"><div><h3>${esc(sc.task_title)}</h3><div class="sub">${esc(z?.name||'')}</div></div><div><span class="pill">👤 ${esc(p?.name||'Atanmamış')}</span></div><div><span class="pill">${esc(freqLabel(sc))} · ${sc.planned_time?sc.planned_time.slice(0,5):'Saat yok'}</span></div><div class="row-actions"><button onclick="openSchedule(${sc.id})">Düzenle</button></div></article>`
 }).join(''):'<div class="sub">Henüz temizlik görevi planlanmadı.</div>'
}
function scheduleForm(sc={}){
 const zOpts=manualZones().map(z=>`<option value="${z.id}" ${String(sc.zone_id)===String(z.id)?'selected':''}>${esc(z.name)}</option>`).join('');
 const pOpts='<option value="">Atanmamış</option>'+state.staff.filter(p=>p.active).map(p=>`<option value="${p.id}" ${String(sc.staff_id)===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('');
 return `<h2>${sc.id?'Görevi Düzenle':'Temizlik Görevi Planla'}</h2><form id="scheduleForm"><div class="form-grid">
 <div class="field"><label>Alan</label><select name="zone_id" required>${zOpts}</select></div><div class="field"><label>Personel</label><select name="staff_id">${pOpts}</select></div>
 <div class="field full"><label>Görev</label><input name="task_title" required value="${esc(sc.task_title||'Genel temizlik')}"></div>
 <div class="field full"><label>Talimat</label><textarea name="instructions">${esc(sc.instructions||'')}</textarea></div>
 <div class="field"><label>Sıklık</label><select name="frequency" id="freq"><option value="daily">Her gün</option><option value="weekly">Haftalık</option><option value="monthly">Aylık</option><option value="once">Tek sefer</option></select></div>
 <div class="field"><label>Saat</label><input name="planned_time" type="time" value="${sc.planned_time?.slice(0,5)||''}"></div>
 <div class="field full" id="weekField"><label>Haftanın günleri</label><div class="checks">${dayNames.map((d,i)=>`<label class="check"><input name="weekdays" type="checkbox" value="${i}" ${(sc.weekdays||[]).includes(i)?'checked':''}> ${d}</label>`).join('')}</div></div>
 <div class="field" id="monthField"><label>Ayın günü</label><input name="month_day" type="number" min="1" max="31" value="${sc.month_day||1}"></div>
 <div class="field" id="onceField"><label>Tarih</label><input name="due_date" type="date" value="${sc.due_date||today()}"></div>
 <div class="field"><label>Durum</label><select name="active"><option value="true" ${sc.active!==false?'selected':''}>Aktif</option><option value="false" ${sc.active===false?'selected':''}>Pasif</option></select></div>
 </div><div class="form-actions">${sc.id?'<button type="button" class="danger-btn" id="deleteSchedule">Sil</button>':''}<button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`
}
window.openSchedule=id=>{
 const sc=state.schedules.find(s=>s.id===id)||{};openModal(scheduleForm(sc));bindSchedule(sc)
};
function bindSchedule(sc){
 $('#freq').value=sc.frequency||'daily';
 const toggle=()=>{const f=$('#freq').value;$('#weekField').style.display=f==='weekly'?'grid':'none';$('#monthField').style.display=f==='monthly'?'grid':'none';$('#onceField').style.display=f==='once'?'grid':'none'};$('#freq').onchange=toggle;toggle();
 $('#scheduleForm').onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(e.target),frequency=fd.get('frequency');
  const row={zone_id:+fd.get('zone_id'),staff_id:fd.get('staff_id')?+fd.get('staff_id'):null,task_title:fd.get('task_title'),instructions:fd.get('instructions'),frequency,weekdays:fd.getAll('weekdays').map(Number),month_day:frequency==='monthly'?+fd.get('month_day'):null,planned_time:fd.get('planned_time')||null,due_date:frequency==='once'?fd.get('due_date'):null,active:fd.get('active')==='true'};
  const q=sc.id?db.from('emigro_cleaning_schedules').update(row).eq('id',sc.id):db.from('emigro_cleaning_schedules').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();loadAll()
 };
 if(sc.id)$('#deleteSchedule').onclick=async()=>{if(!confirm('Görev silinsin mi?'))return;await db.from('emigro_cleaning_schedules').delete().eq('id',sc.id);closeModal();loadAll()}
}

function fillHistoryFilters(){
 const z=$('#historyZone'),p=$('#historyStaff'),zv=z.value,pv=p.value;
 z.innerHTML='<option value="">Tüm alanlar</option>'+manualZones().map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 p.innerHTML='<option value="">Tüm personel</option>'+state.staff.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 z.value=zv;p.value=pv
}
function renderHistory(){
 let rows=state.logs.filter(l=>zoneById(l.zone_id)?.manual);
 const d=$('#historyDate')?.value||'',p=$('#historyStaff')?.value||'',z=$('#historyZone')?.value||'';
 if(d)rows=rows.filter(x=>x.work_date===d);if(p)rows=rows.filter(x=>String(x.staff_id)===p);if(z)rows=rows.filter(x=>String(x.zone_id)===z);
 $('#historyBody').innerHTML=rows.length?rows.map(l=>{const sc=scheduleById(l.schedule_id);return `<tr><td>${l.work_date}</td><td>${esc(zoneById(l.zone_id)?.name||'')}</td><td>${esc(sc?.task_title||'')}</td><td>${esc(staffById(l.staff_id)?.name||'')}</td><td>${l.status==='done'?'Tamamlandı':'Atlandı'}</td><td>${esc(l.note||'')}</td></tr>`}).join(''):'<tr><td colspan="6">Kayıt yok.</td></tr>'
}

function switchView(v){
 state.view=v;
 $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
 $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));
 const meta={
  dashboard:['Genel Bakış','Bugünkü temizlik durumu ve görevler'],
  plan:['Temizlik Planı','Market planı üzerinde alanları kendiniz tanımlayın'],
  schedule:['Çizelge','Alan ve personel bazlı temizlik planı'],
  staff:['Personel','Çalışan ve sorumluluk yönetimi'],
  history:['Geçmiş','Tamamlanan temizlik kayıtları']
 }[v];
 $('#viewTitle').textContent=meta[0];$('#viewSub').textContent=meta[1];
 if(v==='plan')setTimeout(renderPlan,50)
}
$$('.nav').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#drawBtn').onclick=()=>state.drawMode?cancelDraw():startDraw();
$('#toggleOverlayBtn').onclick=()=>{state.overlayVisible=!state.overlayVisible;$('#toggleOverlayBtn').textContent=state.overlayVisible?'Alanları Gizle':'Alanları Göster';renderPlan()};
$('#refreshBtn').onclick=loadAll;
$('#quickTaskBtn').onclick=()=>{if(!manualZones().length)return toast('Önce planda alan tanımlayın');openSchedule(null)};
$('#addScheduleBtn').onclick=()=>{if(!manualZones().length)return toast('Önce planda alan tanımlayın');openSchedule(null)};
$('#addStaffBtn').onclick=()=>editStaff(null);
['historyDate','historyStaff','historyZone'].forEach(id=>$('#'+id).onchange=renderHistory);

loadAll();
