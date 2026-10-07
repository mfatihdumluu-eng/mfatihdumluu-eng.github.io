const SUPABASE_URL='https://hroarfuwpfsqilsijwpp.supabase.co';
const SUPABASE_KEY='sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let state={zones:[],staff:[],schedules:[],logs:[],activeTab:'dashboard',selectedZone:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const dayNames=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),1800)}
function modal(html){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
$('#modalClose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};

async function loadAll(){
 $('#dbStatus').className='status-dot';$('#dbStatus').textContent='DB...';
 try{
  const [z,s,sc,l]=await Promise.all([
   db.from('emigro_cleaning_zones').select('*').order('sort_order'),
   db.from('emigro_cleaning_staff').select('*').order('name'),
   db.from('emigro_cleaning_schedules').select('*').order('planned_time',{ascending:true}),
   db.from('emigro_cleaning_logs').select('*').order('work_date',{ascending:false}).limit(500)
  ]);
  for(const r of [z,s,sc,l])if(r.error)throw r.error;
  state.zones=z.data||[];state.staff=s.data||[];state.schedules=sc.data||[];state.logs=l.data||[];
  $('#dbStatus').className='status-dot ok';$('#dbStatus').textContent='DB bağlı';renderAll();
 }catch(e){console.error(e);$('#dbStatus').className='status-dot bad';$('#dbStatus').textContent='DB hata';toast('Veritabanı bağlantı hatası')}
}
function renderAll(){renderSelects();renderDashboard();renderMap();renderZones();renderStaff();renderSchedules();renderHistory()}
function renderSelects(){
 const zones=state.zones.filter(x=>x.active);const staff=state.staff.filter(x=>x.active);
 const zOpts=zones.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 const sOpts=staff.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 for(const id of ['todayZoneFilter','historyZone']){const el=$('#'+id);const cur=el.value;el.innerHTML='<option value="">Tüm alanlar</option>'+zOpts;el.value=cur}
 for(const id of ['todayStaffFilter','historyStaff']){const el=$('#'+id);const cur=el.value;el.innerHTML='<option value="">Tüm personel</option>'+sOpts;el.value=cur}
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
function getZone(id){return state.zones.find(x=>String(x.id)===String(id))}
function getStaff(id){return state.staff.find(x=>String(x.id)===String(id))}
function getLog(scheduleId,date=today()){return state.logs.find(x=>String(x.schedule_id)===String(scheduleId)&&x.work_date===date)}
function renderDashboard(){
 const now=new Date();$('#todayLabel').textContent=now.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const sf=$('#todayStaffFilter')?.value||'',zf=$('#todayZoneFilter')?.value||'';
 let due=state.schedules.filter(x=>dueToday(x));
 if(sf)due=due.filter(x=>String(x.staff_id)===sf);if(zf)due=due.filter(x=>String(x.zone_id)===zf);
 const done=due.filter(x=>getLog(x.id)?.status==='done').length;
 $('#statDue').textContent=due.length;$('#statDone').textContent=done;$('#statOpen').textContent=due.length-done;$('#statPeople').textContent=state.staff.filter(x=>x.active).length;
 const box=$('#todayTasks');box.innerHTML=due.length?due.map(sc=>{
  const z=getZone(sc.zone_id),p=getStaff(sc.staff_id),log=getLog(sc.id),isDone=log?.status==='done';
  return `<div class="task-card ${isDone?'done':''}">
   <div class="task-top"><h3>${esc(sc.task_title)}</h3><span class="badge">${sc.planned_time?sc.planned_time.slice(0,5):'Saat yok'}</span></div>
   <div class="task-meta"><span>📍 ${esc(z?.name||'Alan yok')}</span><span>👤 ${esc(p?.name||'Atanmamış')}</span>${sc.instructions?`<span>🧽 ${esc(sc.instructions)}</span>`:''}</div>
   <div class="task-actions">${isDone?`<button onclick="undoDone(${sc.id})">Tamamlandı ✓</button>`:`<button class="done-btn" onclick="completeTask(${sc.id})">✓ Tamamlandı</button><button onclick="skipTask(${sc.id})">Atla</button>`}</div>
  </div>`
 }).join(''):'<div class="empty">Bugün için planlanmış görev yok.</div>';
}
async function completeTask(id){
 const sc=state.schedules.find(x=>x.id===id);if(!sc)return;
 const note=prompt('İsterseniz kısa not ekleyin:','')??'';
 const row={schedule_id:sc.id,zone_id:sc.zone_id,staff_id:sc.staff_id,work_date:today(),status:'done',completed_at:new Date().toISOString(),note};
 const {error}=await db.from('emigro_cleaning_logs').upsert(row,{onConflict:'schedule_id,work_date'});if(error)return toast('Kaydedilemedi');
 toast('Görev tamamlandı');await loadAll()
}
async function skipTask(id){const sc=state.schedules.find(x=>x.id===id);if(!sc)return;const note=prompt('Atlama nedeni:','')??'';const {error}=await db.from('emigro_cleaning_logs').upsert({schedule_id:sc.id,zone_id:sc.zone_id,staff_id:sc.staff_id,work_date:today(),status:'skipped',note},{onConflict:'schedule_id,work_date'});if(error)return toast('Kaydedilemedi');await loadAll()}
async function undoDone(id){const log=getLog(id);if(!log)return;await db.from('emigro_cleaning_logs').delete().eq('id',log.id);await loadAll()}

function renderMap(){
 const plan=$('#floorPlan');plan.innerHTML='';
 for(const z of state.zones.filter(x=>x.active)){
  const b=document.createElement('div');b.className='zone-box'+(state.selectedZone===z.id?' active':'');b.style.cssText=`left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;background:${z.color}`;b.innerHTML=`<div>${esc(z.name)}<small>${assignedPeople(z.id)}</small></div>`;b.onclick=()=>{state.selectedZone=z.id;renderMap();renderInspector(z.id)};plan.append(b)
 }
 if(state.selectedZone)renderInspector(state.selectedZone)
}
function assignedPeople(zoneId){const ids=[...new Set(state.schedules.filter(x=>x.active&&x.zone_id===zoneId&&x.staff_id).map(x=>x.staff_id))];return ids.map(id=>getStaff(id)?.name).filter(Boolean).join(', ')}
function renderInspector(zoneId){
 const z=getZone(zoneId),ins=$('#zoneInspector');if(!z)return ins.innerHTML='<div class="empty">Alan bulunamadı.</div>';
 const sc=state.schedules.filter(x=>x.active&&x.zone_id===z.id);
 ins.innerHTML=`<h2>${esc(z.name)}</h2><div class="desc">${esc(z.description||'Açıklama yok')}</div>
 <h4>Sorumlular</h4><div class="mini-list">${assignedPeople(z.id)?assignedPeople(z.id).split(', ').map(x=>`<div class="mini-row">👤 ${esc(x)}</div>`).join(''):'<div class="empty">Henüz personel atanmadı.</div>'}</div>
 <h4>Planlı görevler</h4><div class="mini-list">${sc.length?sc.map(x=>`<div class="mini-row"><b>${esc(x.task_title)}</b><br>${frequencyLabel(x)} · ${esc(getStaff(x.staff_id)?.name||'Atanmamış')}</div>`).join(''):'<div class="empty">Görev yok.</div>'}</div>
 <div class="card-actions"><button onclick="editZone(${z.id})">Alanı Düzenle</button><button onclick="openScheduleModal(null,${z.id})">Görev Ata</button></div>`;
}
function renderZones(){
 $('#zonesGrid').innerHTML=state.zones.map(z=>`<div class="entity-card"><div class="chip" style="background:${z.color}">ALAN</div><h3>${esc(z.name)}</h3><p>${esc(z.description||'Açıklama yok')}</p><div>${assignedPeople(z.id)?assignedPeople(z.id).split(', ').map(x=>`<span class="chip">👤 ${esc(x)}</span>`).join(''):'<span class="chip">Personel yok</span>'}</div><div class="card-actions"><button onclick="editZone(${z.id})">Düzenle</button><button onclick="openScheduleModal(null,${z.id})">Görev Ata</button></div></div>`).join('')
}
function renderStaff(){
 $('#staffGrid').innerHTML=state.staff.length?state.staff.map(p=>{const count=state.schedules.filter(x=>x.active&&x.staff_id===p.id).length;return `<div class="entity-card"><div class="chip">${p.active?'AKTİF':'PASİF'}</div><h3>${esc(p.name)}</h3><p>${esc(p.role||'Rol belirtilmedi')}${p.phone?'<br>'+esc(p.phone):''}</p><span class="chip">${count} planlı görev</span><div class="card-actions"><button onclick="editStaff(${p.id})">Düzenle</button></div></div>`}).join(''):'<div class="empty">Personel eklenmedi.</div>'
}
function frequencyLabel(sc){if(sc.frequency==='daily')return 'Her gün';if(sc.frequency==='weekly')return 'Haftalık · '+(sc.weekdays||[]).map(x=>dayNames[x]).join(', ');if(sc.frequency==='monthly')return 'Her ay '+sc.month_day+'. gün';return 'Tek sefer · '+(sc.due_date||'')}
function renderSchedules(){
 $('#scheduleList').innerHTML=state.schedules.length?state.schedules.map(sc=>`<div class="schedule-row"><div><b>${esc(sc.task_title)}</b><br><span>${esc(getZone(sc.zone_id)?.name||'Alan yok')}</span></div><div><b>${esc(getStaff(sc.staff_id)?.name||'Atanmamış')}</b><br><span>Personel</span></div><div><b>${frequencyLabel(sc)}</b><br><span>Tekrar</span></div><div><b>${sc.planned_time?sc.planned_time.slice(0,5):'—'}</b><br><span>Saat</span></div><button onclick="openScheduleModal(${sc.id})">Düzenle</button></div>`).join(''):'<div class="empty">Çizelge henüz boş.</div>'
}
function renderHistory(){
 const date=$('#historyDate')?.value||'',sf=$('#historyStaff')?.value||'',zf=$('#historyZone')?.value||'';
 let logs=[...state.logs];if(date)logs=logs.filter(x=>x.work_date===date);if(sf)logs=logs.filter(x=>String(x.staff_id)===sf);if(zf)logs=logs.filter(x=>String(x.zone_id)===zf);
 $('#historyBody').innerHTML=logs.length?logs.map(l=>{const sc=state.schedules.find(x=>x.id===l.schedule_id);return `<tr><td>${l.work_date}</td><td>${esc(getZone(l.zone_id)?.name||'')}</td><td>${esc(sc?.task_title||'')}</td><td>${esc(getStaff(l.staff_id)?.name||'')}</td><td>${l.status==='done'?'Tamamlandı':'Atlandı'}</td><td>${esc(l.note||'')}</td></tr>`}).join(''):'<tr><td colspan="6">Kayıt yok.</td></tr>'
}

function zoneForm(z={}){
 return `<h2>${z.id?'Alanı Düzenle':'Yeni Temizlik Alanı'}</h2><form id="zoneForm"><div class="form-grid">
 <div class="field"><label>Alan adı</label><input name="name" required value="${esc(z.name||'')}"></div><div class="field"><label>Kod</label><input name="code" value="${esc(z.code||'')}"></div>
 <div class="field full"><label>Tanım / temizlik kapsamı</label><textarea name="description">${esc(z.description||'')}</textarea></div>
 <div class="field"><label>Renk</label><input name="color" type="color" value="${z.color||'#dbe4ea'}"></div><div class="field"><label>Aktif</label><select name="active"><option value="true" ${z.active!==false?'selected':''}>Evet</option><option value="false" ${z.active===false?'selected':''}>Hayır</option></select></div>
 <div class="field"><label>X %</label><input name="x" type="number" step=".1" value="${z.x??10}"></div><div class="field"><label>Y %</label><input name="y" type="number" step=".1" value="${z.y??10}"></div>
 <div class="field"><label>Genişlik %</label><input name="w" type="number" step=".1" value="${z.w??10}"></div><div class="field"><label>Yükseklik %</label><input name="h" type="number" step=".1" value="${z.h??10}"></div>
 </div><div class="form-actions"><button type="button" onclick="closeModal()">İptal</button><button class="save">Kaydet</button></div></form>`;
}
function editZone(id){const z=state.zones.find(x=>x.id===id)||{};modal(zoneForm(z));$('#zoneForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),row={name:fd.get('name'),code:fd.get('code')||null,description:fd.get('description'),color:fd.get('color'),active:fd.get('active')==='true',x:+fd.get('x'),y:+fd.get('y'),w:+fd.get('w'),h:+fd.get('h')};const q=z.id?db.from('emigro_cleaning_zones').update(row).eq('id',z.id):db.from('emigro_cleaning_zones').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();await loadAll()}}
function addZone(){editZone(null)}

function staffForm(p={}){
 return `<h2>${p.id?'Personeli Düzenle':'Personel Ekle'}</h2><form id="staffForm"><div class="form-grid"><div class="field"><label>Ad Soyad</label><input name="name" required value="${esc(p.name||'')}"></div><div class="field"><label>Rol</label><input name="role" value="${esc(p.role||'')}"></div><div class="field"><label>Telefon</label><input name="phone" value="${esc(p.phone||'')}"></div><div class="field"><label>Aktif</label><select name="active"><option value="true" ${p.active!==false?'selected':''}>Evet</option><option value="false" ${p.active===false?'selected':''}>Hayır</option></select></div></div><div class="form-actions"><button type="button" onclick="closeModal()">İptal</button><button class="save">Kaydet</button></div></form>`;
}
function editStaff(id){const p=state.staff.find(x=>x.id===id)||{};modal(staffForm(p));$('#staffForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),row={name:fd.get('name'),role:fd.get('role'),phone:fd.get('phone'),active:fd.get('active')==='true'};const q=p.id?db.from('emigro_cleaning_staff').update(row).eq('id',p.id):db.from('emigro_cleaning_staff').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();await loadAll()}}

function openScheduleModal(id=null,presetZone=null){
 const sc=state.schedules.find(x=>x.id===id)||{zone_id:presetZone,frequency:'daily',weekdays:[],active:true};
 const zoneOpts=state.zones.filter(x=>x.active).map(x=>`<option value="${x.id}" ${String(sc.zone_id)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('');
 const staffOpts='<option value="">Atanmamış</option>'+state.staff.filter(x=>x.active).map(x=>`<option value="${x.id}" ${String(sc.staff_id)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('');
 modal(`<h2>${sc.id?'Görevi Düzenle':'Temizlik Görevi Planla'}</h2><form id="scheduleForm"><div class="form-grid">
 <div class="field"><label>Alan</label><select name="zone_id" required>${zoneOpts}</select></div><div class="field"><label>Personel</label><select name="staff_id">${staffOpts}</select></div>
 <div class="field full"><label>Görev</label><input name="task_title" required value="${esc(sc.task_title||'Genel temizlik')}"></div>
 <div class="field full"><label>Talimat / kapsam</label><textarea name="instructions">${esc(sc.instructions||'')}</textarea></div>
 <div class="field"><label>Sıklık</label><select name="frequency" id="frequency"><option value="daily">Her gün</option><option value="weekly">Haftalık</option><option value="monthly">Aylık</option><option value="once">Tek sefer</option></select></div>
 <div class="field"><label>Saat</label><input name="planned_time" type="time" value="${sc.planned_time?.slice(0,5)||''}"></div>
 <div class="field full" id="weeklyFields"><label>Günler</label><div class="weekday-row">${dayNames.map((n,i)=>`<label><input type="checkbox" name="weekdays" value="${i}" ${(sc.weekdays||[]).includes(i)?'checked':''}>${n}</label>`).join('')}</div></div>
 <div class="field" id="monthlyField"><label>Ayın günü</label><input name="month_day" type="number" min="1" max="31" value="${sc.month_day||1}"></div>
 <div class="field" id="onceField"><label>Tarih</label><input name="due_date" type="date" value="${sc.due_date||today()}"></div>
 <div class="field"><label>Aktif</label><select name="active"><option value="true" ${sc.active!==false?'selected':''}>Evet</option><option value="false" ${sc.active===false?'selected':''}>Hayır</option></select></div>
 </div><div class="form-actions">${sc.id?'<button type="button" id="deleteSchedule">Sil</button>':''}<button type="button" onclick="closeModal()">İptal</button><button class="save">Kaydet</button></div></form>`);
 $('#frequency').value=sc.frequency;const toggle=()=>{const f=$('#frequency').value;$('#weeklyFields').style.display=f==='weekly'?'grid':'none';$('#monthlyField').style.display=f==='monthly'?'grid':'none';$('#onceField').style.display=f==='once'?'grid':'none'};$('#frequency').onchange=toggle;toggle();
 $('#scheduleForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),row={zone_id:+fd.get('zone_id'),staff_id:fd.get('staff_id')?+fd.get('staff_id'):null,task_title:fd.get('task_title'),instructions:fd.get('instructions'),frequency:fd.get('frequency'),weekdays:fd.getAll('weekdays').map(Number),month_day:fd.get('frequency')==='monthly'?+fd.get('month_day'):null,planned_time:fd.get('planned_time')||null,due_date:fd.get('frequency')==='once'?fd.get('due_date'):null,active:fd.get('active')==='true'};const q=sc.id?db.from('emigro_cleaning_schedules').update(row).eq('id',sc.id):db.from('emigro_cleaning_schedules').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();await loadAll()};
 if(sc.id)$('#deleteSchedule').onclick=async()=>{if(!confirm('Bu görevi silmek istiyor musunuz?'))return;await db.from('emigro_cleaning_schedules').delete().eq('id',sc.id);closeModal();await loadAll()}
}

$$('.tabs button').forEach(b=>b.onclick=()=>{state.activeTab=b.dataset.tab;$$('.tabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.tab').forEach(x=>x.classList.toggle('active',x.id==='tab-'+state.activeTab));if(state.activeTab==='map')setTimeout(renderMap,0)});
$('#refreshBtn').onclick=loadAll;$('#addZoneBtn').onclick=addZone;$('#addZoneBtnMap').onclick=addZone;$('#addStaffBtn').onclick=()=>editStaff(null);$('#addScheduleBtn').onclick=()=>openScheduleModal();$('#newScheduleBtn').onclick=()=>openScheduleModal();
for(const id of ['todayStaffFilter','todayZoneFilter'])$('#'+id).onchange=renderDashboard;
for(const id of ['historyDate','historyStaff','historyZone'])$('#'+id).onchange=renderHistory;
loadAll();