const SUPABASE_URL='https://hroarfuwpfsqilsijwpp.supabase.co';
const SUPABASE_KEY='sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const PARAMS=new URLSearchParams(location.search);
const ADMIN_MODE=PARAMS.get('mode')!=='worker';
const WORKER_ID=Number(PARAMS.get('staff')||0)||null;
const state={zones:[],staff:[],cards:[],logs:[],notifications:[],taskTags:[],settings:null,drawMode:false,drawStart:null,showAreas:true,isAdmin:ADMIN_MODE,redrawZoneId:null,workerStaffId:WORKER_ID};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dayNames=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),1800)}
function openModal(html){var box=$('#modal .modal-box');if(box)box.classList.remove('zone-sheet');$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden');var box=$('#modal .modal-box');if(box)box.classList.remove('zone-sheet')}
window.closeModal=closeModal;$('#closeModal').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};

function manualZones(){return state.zones.filter(z=>z.manual&&z.active)}
function zoneById(id){return state.zones.find(z=>String(z.id)===String(id))}
function staffById(id){return state.staff.find(p=>String(p.id)===String(id))}
function cardByZone(id){return state.cards.find(c=>String(c.zone_id)===String(id))}
function tagsFor(zoneId,type){return state.taskTags.filter(function(x){return String(x.zone_id)===String(zoneId)&&x.task_type===type&&x.active!==false}).sort(function(a,b){return (a.sort_order||0)-(b.sort_order||0)})}
function workerById(){return staffById(state.workerStaffId)}
function taskAssignedToWorker(t){var w=t.assigned||t.primary;return !!w&&String(w.id)===String(state.workerStaffId)}
function workerAssignedToZone(zoneId){
 if(state.isAdmin)return true;
 if(!state.workerStaffId)return false;
 var c=cardByZone(zoneId)||{},id=String(state.workerStaffId);
 var fields=[
   c.primary_staff_id,c.backup_staff_id,
   c.daily_primary_staff_id,c.daily_backup_staff_id,
   c.weekly_primary_staff_id,c.weekly_backup_staff_id,
   c.monthly_primary_staff_id,c.monthly_backup_staff_id
 ];
 return fields.some(function(x){return String(x||'')===id})
}
function workerZoneTypes(zoneId){
 var c=cardByZone(zoneId)||{},id=String(state.workerStaffId),out=[];
 ['daily','weekly','monthly'].forEach(function(type){
   var p=c[type+'_primary_staff_id']||(type==='daily'?c.primary_staff_id:null);
   var b=c[type+'_backup_staff_id']||(type==='daily'?c.backup_staff_id:null);
   if(String(p||'')===id||String(b||'')===id)out.push(type)
 });
 return out
}
function fmtDays(arr){return !arr?.length?'—':arr.map(x=>dayNames[x]).join(', ')}
function fmtMonthDays(arr){return !arr?.length?'—':arr.map(x=>x+'. gün').join(', ')}

async function loadAll(){
 try{
  $('#dbState').textContent='● Bağlanıyor';
  const [z,p,c,l,n,t,s]=await Promise.all([
   db.from('emigro_cleaning_zones').select('*').order('sort_order'),
   db.from('emigro_cleaning_staff').select('*').order('name'),
   db.from('emigro_cleaning_zone_cards').select('*'),
   db.from('emigro_cleaning_logs').select('*').order('work_date',{ascending:false}).limit(1500),
   db.from('emigro_cleaning_notifications').select('*').order('created_at',{ascending:false}).limit(500),
   db.from('emigro_cleaning_task_tags').select('*').order('sort_order'),
   db.from('emigro_cleaning_settings').select('*').eq('id',1).single()
  ]);
  [z,p,c,l,n,t,s].forEach(r=>{if(r.error)throw r.error});
  state.zones=z.data||[];state.staff=p.data||[];state.cards=c.data||[];state.logs=l.data||[];state.notifications=n.data||[];state.taskTags=t.data||[];state.settings=s.data||{};
  $('#dbState').textContent='● Veritabanı bağlı';
  applyPlanImage();renderAll();setupWorkerMode();
 }catch(e){console.error(e);$('#dbState').textContent='● Bağlantı hatası';toast('Veritabanı bağlantı hatası')}
}

function applyPlanImage(){
 const data=state.settings?.plan_image_data;
 if(data){$('#planImg').src=data;$('#planImg').classList.remove('hidden');$('#emptyPlan').classList.add('hidden')}
 else{$('#planImg').classList.add('hidden');$('#emptyPlan').classList.remove('hidden')}
}

function renderAll(){
  renderReport();renderTracking();renderCalendar();renderPlan();renderStaff();renderWorkerDemoLaunchers();renderWorkerProfilePicker();renderWorkerNotifications();renderNotifications();renderHistory();
  var demos=state.zones.filter(function(z){return String(z.code||'').startsWith('DEMO-')});
  var badge=$('#demoBadge');
  if(badge){
    if(demos.length){badge.classList.remove('hidden');badge.textContent='DEMO · '+demos.length+' ALAN'}
    else badge.classList.add('hidden');
  }
}
function renderPlan(){
 const zones=manualZones();$('#zoneCount').textContent=zones.length;
 const ov=$('#zoneOverlay');ov.innerHTML='';ov.style.display=state.showAreas?'block':'none';

 zones.forEach(function(z){
  var assigned=workerAssignedToZone(z.id);
  const e=document.createElement('div');
  e.className='zone-box'+(!state.isAdmin&&!assigned?' worker-zone-disabled':'')+(!state.isAdmin&&assigned?' worker-zone-active':'');
  e.style.cssText='left:'+z.x+'%;top:'+z.y+'%;width:'+z.w+'%;height:'+z.h+'%;--zone:'+(z.color||'#f47a20');
  e.innerHTML='<span class="zone-label">'+esc(z.name)+'</span>';
  if(state.isAdmin||assigned)e.onclick=function(){openZoneStatus(z.id)};
  else e.setAttribute('aria-disabled','true');
  ov.append(e)
 });

 if(state.isAdmin){
   $('#zoneMiniList').innerHTML=zones.length?zones.map(function(z){
     const card=cardByZone(z.id),p=staffById(card&&card.primary_staff_id),b=staffById(card&&card.backup_staff_id);
     return '<div class="zone-mini" onclick="openZoneStatus('+z.id+')"><span class="zone-mini-dot" style="background:'+(z.color||'#f47a20')+'"></span><div><b>'+esc(z.name)+'</b><small>'+(p?'Asıl: '+esc(p.name):'Asıl yok')+(b?' · Yedek: '+esc(b.name):'')+'</small></div></div>'
   }).join(''):'<div class="sub">Henüz alan tanımlanmadı.</div>';
 }else{
   var mine=zones.filter(function(z){return workerAssignedToZone(z.id)});
   $('#zoneMiniList').innerHTML=mine.length?mine.map(function(z){
     var types=workerZoneTypes(z.id).map(function(x){return typeNames[x]}).join(' · ');
     return '<div class="zone-mini worker-zone-mini" onclick="openZoneStatus('+z.id+')"><span class="zone-mini-dot" style="background:'+(z.color||'#079455')+'"></span><div><b>'+esc(z.name)+'</b><small>Atandığın alan · '+esc(types||'Görev')+'</small></div></div>'
   }).join(''):'<div class="worker-plan-empty">Bu kullanıcıya henüz plan alanı atanmadı.</div>';
 }
}
function scheduleLine(label,enabled,days,time,monthly=false){
 return `<div class="schedule-line"><strong>${label}</strong><div class="days">${enabled?(monthly?fmtMonthDays(days):fmtDays(days)):'Kapalı'}</div><div class="time">${enabled?(time?.slice(0,5)||'Saat yok'):'—'}</div></div>`
}
function completedOnTime(task){
 var l=logForTask(task);if(!l||l.status!=='done'||!l.completed_at)return false;
 return new Date(l.completed_at)<=dueAt(task);
}
function zoneCardState(zone){
 var now=new Date(),tasks=expectedTasks(dayStart(now),dayEnd(now)).filter(function(t){return String(t.zone.id)===String(zone.id)});
 if(!tasks.length)return {rank:2,key:'normal',label:'Bugün görev yok',tasks:tasks};
 var statuses=tasks.map(function(t){return {task:t,status:statusFor(t)}});
 if(statuses.some(function(x){return x.status.key==='overdue'}))return {rank:0,key:'critical',label:'Yapılmayan görev var',tasks:tasks};
 if(statuses.some(function(x){return x.status.key==='pending'}))return {rank:1,key:'active',label:'Bekleyen görev var',tasks:tasks};
 if(statuses.every(function(x){return x.status.key==='done'&&completedOnTime(x.task)}))return {rank:4,key:'completed',label:'Zamanında tamamlandı',tasks:tasks};
 if(statuses.every(function(x){return x.status.key==='done'}))return {rank:3,key:'late',label:'Tamamlandı · geç',tasks:tasks};
 return {rank:2,key:'normal',label:'Kontrol gerekli',tasks:tasks}
}

function renderCards(){
 const zones=manualZones().map(function(z){return {zone:z,state:zoneCardState(z)}}).sort(function(a,b){return a.state.rank-b.state.rank||a.zone.sort_order-b.zone.sort_order});
 $('#zoneCards').innerHTML=zones.length?zones.map(function(item){
  const z=item.zone,cs=item.state,c=cardByZone(z.id)||{},p=staffById(c.primary_staff_id),b=staffById(c.backup_staff_id);
  const todayRows=cs.tasks.length?cs.tasks.map(function(t){
    const st=statusFor(t);
    return '<span class="plan-task-chip '+st.key+'">'+typeNames[t.type]+' · '+(t.time?t.time.slice(0,5):'—')+' · '+st.label+'</span>'
  }).join(''):'<span class="plan-task-chip neutral">Bugün görev yok</span>';
  return '<article class="zone-card plan-status-card '+cs.key+'" onclick="openZoneStatus('+z.id+')">'+
   '<div class="zone-card-top"><div><h3>'+esc(z.name)+'</h3><div class="desc">'+esc(z.description||'Açıklama yok')+'</div></div><span class="zone-state-badge '+cs.key+'">'+cs.label+'</span></div>'+
   '<div class="people"><div class="person-box"><label>Bugünkü görevli</label><b>'+esc(((cs.tasks[0]&&(cs.tasks[0].assigned||cs.tasks[0].primary))||p)?.name||'Atanmadı')+'</b></div><div class="person-box"><label>Yedek</label><b>'+esc(b?.name||'Atanmadı')+'</b></div></div>'+
   '<div class="plan-task-chips">'+todayRows+'</div>'+
   '<div class="schedule-block">'+
    scheduleLine('Günlük',c.daily_enabled,c.daily_days,c.daily_time)+(c.daily_enabled&&c.daily_task?'<div class="desc">'+esc(c.daily_task)+'</div>':'')+
    scheduleLine('Haftalık',c.weekly_enabled,c.weekly_days,c.weekly_time)+(c.weekly_enabled&&c.weekly_task?'<div class="desc">'+esc(c.weekly_task)+'</div>':'')+
    scheduleLine('Aylık',c.monthly_enabled,c.monthly_days,c.monthly_time,true)+(c.monthly_enabled&&c.monthly_task?'<div class="desc">'+esc(c.monthly_task)+'</div>':'')+
   '</div>'+
   '<div class="card-actions" onclick="event.stopPropagation()"><button onclick="openZoneStatus('+z.id+')">Detay</button>'+(state.isAdmin?'<button onclick="openZoneCardModal('+z.id+')">Rutini Düzenle</button><button onclick="startZoneRedraw('+z.id+')">Alanı Değiştir</button>':'')+'</div>'+
  '</article>'
 }).join(''):'<div class="sub">Planda alan seçtikçe burada görünecek.</div>';
}

function renderStaff(){
 $('#staffGrid').innerHTML=state.staff.length?state.staff.map(p=>`<article class="staff-card"><h3>${esc(p.name)}</h3><p>${esc(p.role||'Rol belirtilmedi')}${p.phone?' · '+esc(p.phone):''}</p><div class="card-actions"><button onclick="editStaff(${p.id})">Düzenle</button></div></article>`).join(''):'<div style="font-size:11px;color:#6f7d86">Personel eklenmedi.</div>'
}
function renderHistory(){
 $('#historyBody').innerHTML=state.logs.length?state.logs.map(l=>`<tr><td>${l.work_date}</td><td>${esc(zoneById(l.zone_id)?.name||'')}</td><td>${esc(staffById(l.staff_id)?.name||'')}</td><td>${l.status==='done'?'Tamamlandı':'Atlandı'}</td><td>${esc(l.note||'')}</td></tr>`).join(''):'<tr><td colspan="5">Kayıt yok.</td></tr>'
}

function posPct(e){
 const r=$('#planStage').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))}
}
function startDraw(redrawZoneId=null){
 if(!state.isAdmin)return toast('Alan seçme yetkisi sadece adminde');
 if(!state.settings?.plan_image_data)return toast('Önce plan resmini yükle');
 state.drawMode=true;state.drawStart=null;state.redrawZoneId=redrawZoneId;$('#planStage').classList.add('drawing');
 $('#drawBtn').textContent='İptal';
 $('#drawStatus').textContent=redrawZoneId?'Alan için yeni sınırı mouse ile çiz.':'Mouse ile alanın çevresini çiz.';
}
function startZoneRedraw(id){
 if(!state.isAdmin)return toast('Alan değiştirme yetkisi sadece adminde');
 closeModal();startDraw(id);toast('Yeni alan sınırını çiz');
}
window.startZoneRedraw=startZoneRedraw
function cancelDraw(){state.drawMode=false;state.drawStart=null;state.redrawZoneId=null;$('#planStage').classList.remove('drawing');$('#drawRect').classList.add('hidden');$('#drawBtn').textContent='+ Alan Seç';$('#drawStatus').textContent='Alan seçmek için “Alan Seç”e bas.'}
$('#planStage').addEventListener('pointerdown',e=>{
 if(!state.drawMode)return;
 e.preventDefault();state.drawStart=posPct(e);const d=$('#drawRect');d.classList.remove('hidden');d.style.left=state.drawStart.x+'%';d.style.top=state.drawStart.y+'%';d.style.width='0%';d.style.height='0%'
});
$('#planStage').addEventListener('pointermove',e=>{
 if(!state.drawMode||!state.drawStart)return;const p=posPct(e),x=Math.min(p.x,state.drawStart.x),y=Math.min(p.y,state.drawStart.y),w=Math.abs(p.x-state.drawStart.x),h=Math.abs(p.y-state.drawStart.y),d=$('#drawRect');d.style.left=x+'%';d.style.top=y+'%';d.style.width=w+'%';d.style.height=h+'%'
});
$('#planStage').addEventListener('pointerup',async e=>{
 if(!state.drawMode||!state.drawStart)return;
 const p=posPct(e),box={x:Math.min(p.x,state.drawStart.x),y:Math.min(p.y,state.drawStart.y),w:Math.abs(p.x-state.drawStart.x),h:Math.abs(p.y-state.drawStart.y)};
 const redrawId=state.redrawZoneId;
 cancelDraw();
 if(box.w<1||box.h<1)return toast('Alan çok küçük');
 if(redrawId){
   const row={x:+box.x.toFixed(3),y:+box.y.toFixed(3),w:+box.w.toFixed(3),h:+box.h.toFixed(3)};
   const r=await db.from('emigro_cleaning_zones').update(row).eq('id',redrawId);
   if(r.error)return toast(r.error.message);
   toast('Alan konumu güncellendi');await loadAll();return;
 }
 openNewZoneModal(box)
});

function staffOptions(selected){
 return '<option value="">Atanmadı</option>'+state.staff.filter(p=>p.active).map(p=>`<option value="${p.id}" ${String(selected)===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('')
}
function weekdayChecks(name,arr=[]){
 return dayNames.map((d,i)=>`<label class="check"><input type="checkbox" name="${name}" value="${i}" ${arr.includes(i)?'checked':''}> ${d}</label>`).join('')
}
function monthDayChecks(arr=[]){
 return Array.from({length:31},(_,i)=>i+1).map(i=>`<label class="check"><input type="checkbox" name="monthly_days" value="${i}" ${arr.includes(i)?'checked':''}> ${i}</label>`).join('')
}
function zoneCardForm(z,c={}){
 return `<h2>${z.id?'Alan Kartı':'Yeni Alan'}</h2><form id="zoneCardForm"><div class="form-grid">
 <div class="field"><label>Alan adı</label><input name="name" required value="${esc(z.name||'')}"></div>
 <div class="field"><label>Renk</label><input name="color" type="color" value="${z.color||'#f47a20'}"></div>
 <div class="field"><label>Alan önceliği</label><select name="priority"><option value="normal" ${(z.priority||'normal')==='normal'?'selected':''}>Normal</option><option value="high" ${z.priority==='high'?'selected':''}>Yüksek</option><option value="critical" ${z.priority==='critical'?'selected':''}>Kritik</option></select></div>
 <div class="field"><label>Fotoğraf kanıtı</label><select name="proof_required"><option value="false" ${!z.proof_required?'selected':''}>İsteğe bağlı</option><option value="true" ${z.proof_required?'selected':''}>Zorunlu</option></select></div>
 <div class="field full"><label>Tanım / temizlenecekler</label><textarea name="description">${esc(z.description||'')}</textarea></div>

 <div class="field full"><label>Günlük</label><label class="check"><input type="checkbox" name="daily_enabled" ${c.daily_enabled?'checked':''}> Aktif</label><div class="checks">${weekdayChecks('daily_days',c.daily_days||[1,2,3,4,5,6,0])}</div></div>
 <div class="field"><label>Günlük saat</label><input type="time" name="daily_time" value="${c.daily_time?.slice(0,5)||''}"></div>
 <div class="field full"><label>Günlük ne yapılacak?</label><textarea name="daily_task" placeholder="Örn. zemin süpür, paspas yap...">${esc(c.daily_task||'')}</textarea></div>
 <div class="field full"><label>Günlük sabit görevler</label><textarea name="daily_tags" placeholder="Her satıra bir görev yazın. Örn. Kasap tezgâhını temizle&#10;Yerleri paspasla">${esc(tagsFor(z.id,'daily').map(function(x){return x.label}).join('\n'))}</textarea></div>

 <div class="field full"><label>Haftalık</label><label class="check"><input type="checkbox" name="weekly_enabled" ${c.weekly_enabled?'checked':''}> Aktif</label><div class="checks">${weekdayChecks('weekly_days',c.weekly_days||[])}</div></div>
 <div class="field"><label>Haftalık saat</label><input type="time" name="weekly_time" value="${c.weekly_time?.slice(0,5)||''}"></div>
 <div class="field full"><label>Haftalık ne yapılacak?</label><textarea name="weekly_task" placeholder="Örn. raf altlarını temizle...">${esc(c.weekly_task||'')}</textarea></div>
 <div class="field full"><label>Haftalık sabit görevler</label><textarea name="weekly_tags">${esc(tagsFor(z.id,'weekly').map(function(x){return x.label}).join('\n'))}</textarea></div>

 <div class="field full"><label>Aylık</label><label class="check"><input type="checkbox" name="monthly_enabled" ${c.monthly_enabled?'checked':''}> Aktif</label><div class="checks">${monthDayChecks(c.monthly_days||[])}</div></div>
 <div class="field"><label>Aylık saat</label><input type="time" name="monthly_time" value="${c.monthly_time?.slice(0,5)||''}"></div>
 <div class="field full"><label>Aylık ne yapılacak?</label><textarea name="monthly_task" placeholder="Örn. derin temizlik...">${esc(c.monthly_task||'')}</textarea></div>
 <div class="field full"><label>Aylık sabit görevler</label><textarea name="monthly_tags">${esc(tagsFor(z.id,'monthly').map(function(x){return x.label}).join('\n'))}</textarea></div>
 </div>
 <div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`
}
function openNewZoneModal(box){
 const z={name:'',description:'',color:'#f47a20',priority:'normal',proof_required:false,x:+box.x.toFixed(3),y:+box.y.toFixed(3),w:+box.w.toFixed(3),h:+box.h.toFixed(3),manual:true,active:true};
 openModal(zoneCardForm(z,{}));bindZoneCardForm(z,true)
}
window.openZoneCardModal=id=>{if(!state.isAdmin)return openZoneStatus(id);const z=zoneById(id),c=cardByZone(id)||{};openModal(zoneCardForm(z,c));bindZoneCardForm(z,false,c)};
function bindZoneCardForm(z,isNew,c={}){
 $('#zoneCardForm').onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(e.target);let zoneId=z.id;
  const zoneRow={name:fd.get('name'),description:fd.get('description'),color:fd.get('color'),priority:fd.get('priority')||'normal',proof_required:fd.get('proof_required')==='true',manual:true,active:true,x:z.x,y:z.y,w:z.w,h:z.h,shape:'rect',code:z.code||('MANUAL-'+Date.now())};
  if(isNew){const {data,error}=await db.from('emigro_cleaning_zones').insert(zoneRow).select().single();if(error)return toast(error.message);zoneId=data.id}
  else{const {error}=await db.from('emigro_cleaning_zones').update(zoneRow).eq('id',z.id);if(error)return toast(error.message)}
  const cardRow={
   zone_id:zoneId,
   primary_staff_id:c.primary_staff_id||null,
   backup_staff_id:c.backup_staff_id||null,
   backup_enabled:!!c.backup_enabled,
   backup_days:c.backup_days||[],
   daily_enabled:fd.has('daily_enabled'),daily_days:fd.getAll('daily_days').length?fd.getAll('daily_days').map(Number):(c.daily_days||[]),daily_time:fd.get('daily_time')||null,
   weekly_enabled:fd.has('weekly_enabled'),weekly_days:fd.getAll('weekly_days').length?fd.getAll('weekly_days').map(Number):(c.weekly_days||[]),weekly_time:fd.get('weekly_time')||null,
   monthly_enabled:fd.has('monthly_enabled'),monthly_days:fd.getAll('monthly_days').length?fd.getAll('monthly_days').map(Number):(c.monthly_days||[]),monthly_time:fd.get('monthly_time')||null,
   daily_task:fd.get('daily_task')||'',
   weekly_task:fd.get('weekly_task')||'',
   monthly_task:fd.get('monthly_task')||'',
   updated_at:new Date().toISOString()
  };
  const {error}=await db.from('emigro_cleaning_zone_cards').upsert(cardRow,{onConflict:'zone_id'});if(error)return toast(error.message);
  for(const tp of ['daily','weekly','monthly']){
    var del=await db.from('emigro_cleaning_task_tags').delete().eq('zone_id',zoneId).eq('task_type',tp);if(del.error)return toast(del.error.message);
    var labels=String(fd.get(tp+'_tags')||'').split(/\n+/).map(function(x){return x.trim()}).filter(Boolean);
    if(labels.length){
      var ins=await db.from('emigro_cleaning_task_tags').insert(labels.map(function(label,i){return {zone_id:zoneId,task_type:tp,label:label,active:true,sort_order:i}}));if(ins.error)return toast(ins.error.message)
    }
  }
  closeModal();toast('Alan kartı ve sabit görevler kaydedildi');loadAll()
 }
}
window.deleteZone=async id=>{if(!state.isAdmin)return toast('Alan silme yetkisi sadece adminde');if(!confirm('Bu seçili alan tamamen silinsin mi? Alan tanımı ve rutini kaldırılacak.'))return;const {error}=await db.from('emigro_cleaning_zones').delete().eq('id',id);if(error)return toast(error.message);loadAll()};

window.editStaff=id=>{
 const p=state.staff.find(x=>x.id===id)||{};
 openModal(`<h2>${p.id?'Personeli Düzenle':'Personel Ekle'}</h2><form id="staffForm"><div class="form-grid">
 <div class="field"><label>Ad Soyad</label><input name="name" required value="${esc(p.name||'')}"></div>
 <div class="field"><label>Rol</label><input name="role" value="${esc(p.role||'')}"></div>
 <div class="field"><label>Telefon</label><input name="phone" value="${esc(p.phone||'')}"></div>
 <div class="field"><label>Çalışma grubu</label><select name="department">
  <option value="">Seçiniz</option>
  ${['Kasa','Raf','Sebze Meyve','Genel Temizlik','Depo'].map(function(x){return '<option value="'+x+'" '+(p.department===x?'selected':'')+'>'+x+'</option>'}).join('')}
 </select></div>
 <div class="field"><label>Durum</label><select name="active"><option value="true" ${p.active!==false?'selected':''}>Aktif</option><option value="false" ${p.active===false?'selected':''}>Pasif</option></select></div>
 </div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`);
 $('#staffForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),row={name:fd.get('name'),role:fd.get('role'),phone:fd.get('phone'),department:fd.get('department')||null,active:fd.get('active')==='true'};const q=p.id?db.from('emigro_cleaning_staff').update(row).eq('id',p.id):db.from('emigro_cleaning_staff').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();loadAll()}
};


async function loadDemoData(){
 if(!confirm('Tam demo verileri yüklensin mi? Demo alanları/personeller güncellenir; kendi manuel alanların korunur.'))return;
 toast('Demo hazırlanıyor...');
 try{
  const people=[
   {name:'Ayşe Demir',role:'Temizlik Personeli',phone:'0611111111',active:true},
   {name:'Mehmet Kaya',role:'Temizlik Personeli',phone:'0622222222',active:true},
   {name:'Fatma Yılmaz',role:'Temizlik Personeli',phone:'0633333333',active:true},
   {name:'Ali Can',role:'Yedek Personel',phone:'0644444444',active:true},
   {name:'Zeynep Arslan',role:'Hijyen Sorumlusu',phone:'0655555555',active:true}
  ],staffIds={};
  for(const p of people){
   var q=await db.from('emigro_cleaning_staff').select('*').eq('name',p.name).limit(1);
   if(q.error)throw q.error;
   if(q.data&&q.data[0]){var u=await db.from('emigro_cleaning_staff').update(p).eq('id',q.data[0].id).select().single();if(u.error)throw u.error;staffIds[p.name]=u.data.id}
   else{var ins=await db.from('emigro_cleaning_staff').insert(p).select().single();if(ins.error)throw ins.error;staffIds[p.name]=ins.data.id}
  }

  const zones=[
   {code:'DEMO-GIRIS',name:'Giriş',description:'Kapı önü, paspas, cam altları ve giriş zemini.',color:'#8de4a6',x:6,y:75,w:14,h:12,sort_order:101,priority:'normal',proof_required:false},
   {code:'DEMO-KASA',name:'Kasa Alanı',description:'Kasa önü, bant çevresi ve müşteri temas noktaları.',color:'#ffab68',x:22,y:68,w:18,h:10,sort_order:102,priority:'high',proof_required:false},
   {code:'DEMO-SEBZE',name:'Sebze Reyonu',description:'Stand önü, zemin ve dökülen ürün kalıntıları.',color:'#ade37f',x:43,y:43,w:20,h:18,sort_order:103,priority:'high',proof_required:true},
   {code:'DEMO-KASAP',name:'Kasap Alanı',description:'Kasap önü, temas yüzeyleri ve zemin.',color:'#f78e92',x:42,y:18,w:22,h:17,sort_order:104,priority:'critical',proof_required:true},
   {code:'DEMO-DIPFRIZ',name:'Dipfriz Alanı',description:'Kapak çevresi, dış yüzey ve zemin.',color:'#6fbce6',x:67,y:28,w:18,h:18,sort_order:105,priority:'normal',proof_required:false},
   {code:'DEMO-RAFLAR',name:'Orta Raflar',description:'Koridor zemini, raf önleri ve raf altları.',color:'#f4d98e',x:56,y:48,w:26,h:25,sort_order:106,priority:'normal',proof_required:false},
   {code:'DEMO-NONFOOD',name:'Nonfood',description:'Nonfood koridorları ve raf çevresi.',color:'#cbb9eb',x:8,y:30,w:20,h:25,sort_order:107,priority:'normal',proof_required:false},
   {code:'DEMO-MUTFAK',name:'Mutfak',description:'Tezgah, lavabo, zemin ve çöp alanı.',color:'#ffb29a',x:7,y:7,w:20,h:15,sort_order:108,priority:'critical',proof_required:true},
   {code:'DEMO-TUVALET',name:'Tuvalet',description:'Klozet, lavabo, zemin ve sarf kontrolü.',color:'#d8c8ef',x:28,y:7,w:10,h:12,sort_order:109,priority:'critical',proof_required:true},
   {code:'DEMO-DEPO',name:'Depo',description:'Geçiş yolları, palet çevresi ve zemin.',color:'#d3bda3',x:70,y:6,w:24,h:18,sort_order:110,priority:'high',proof_required:false}
  ],zoneIds={};
  for(const z of zones){
   var zr=await db.from('emigro_cleaning_zones').upsert(Object.assign({},z,{manual:true,active:true,shape:'rect'}),{onConflict:'code'}).select().single();
   if(zr.error)throw zr.error;zoneIds[z.code]=zr.data.id;
  }

  var now=new Date(),dow=now.getDay(),dom=now.getDate();
  const specs=[
   ['DEMO-GIRIS','Ayşe Demir','Ali Can','Mehmet Kaya','Zeynep Arslan'],
   ['DEMO-KASA','Mehmet Kaya','Fatma Yılmaz','Ayşe Demir','Ali Can'],
   ['DEMO-SEBZE','Fatma Yılmaz','Ayşe Demir','Zeynep Arslan','Mehmet Kaya'],
   ['DEMO-KASAP','Ayşe Demir','Mehmet Kaya','Zeynep Arslan','Fatma Yılmaz'],
   ['DEMO-DIPFRIZ','Mehmet Kaya','Ali Can','Fatma Yılmaz','Ayşe Demir'],
   ['DEMO-RAFLAR','Fatma Yılmaz','Ali Can','Mehmet Kaya','Zeynep Arslan'],
   ['DEMO-NONFOOD','Ali Can','Ayşe Demir','Mehmet Kaya','Fatma Yılmaz'],
   ['DEMO-MUTFAK','Ayşe Demir','Fatma Yılmaz','Zeynep Arslan','Ali Can'],
   ['DEMO-TUVALET','Fatma Yılmaz','Ali Can','Zeynep Arslan','Ayşe Demir'],
   ['DEMO-DEPO','Mehmet Kaya','Ali Can','Fatma Yılmaz','Zeynep Arslan']
  ];
  for(let i=0;i<specs.length;i++){
   const [code,dPrim,dBack,wPrim,mPrim]=specs[i];
   const row={
    zone_id:zoneIds[code],
    primary_staff_id:staffIds[dPrim],backup_staff_id:staffIds[dBack],backup_enabled:true,backup_days:[2,5],
    daily_enabled:true,daily_days:[0,1,2,3,4,5,6],daily_time:pad2(7+(i%8))+':'+(i%2?'30':'00'),daily_task:zones[i].description,
    daily_primary_staff_id:staffIds[dPrim],daily_backup_staff_id:staffIds[dBack],daily_backup_days:[2,5],
    weekly_enabled:true,weekly_days:[dow],weekly_time:pad2(13+(i%5))+':00',weekly_task:'Haftalık detay temizlik: dipler, köşeler ve temas yüzeyleri.',weekly_primary_staff_id:staffIds[wPrim],weekly_backup_staff_id:staffIds[dBack],weekly_backup_days:i%3===0?[dow]:[],
    monthly_enabled:i<6,monthly_days:[dom],monthly_time:'08:30',monthly_task:'Aylık derin temizlik ve detay kontrolü.',monthly_primary_staff_id:staffIds[mPrim],monthly_backup_staff_id:staffIds[dBack],monthly_backup_days:i%2===0?[dom]:[],
    updated_at:new Date().toISOString()
   };
   var cr=await db.from('emigro_cleaning_zone_cards').upsert(row,{onConflict:'zone_id'});if(cr.error)throw cr.error;
  }

  // Add one intentionally unassigned weekly demo routine for admin warning.
  var unr=await db.from('emigro_cleaning_zone_cards').update({weekly_primary_staff_id:null,weekly_backup_staff_id:null,weekly_backup_days:[]}).eq('zone_id',zoneIds['DEMO-DEPO']);if(unr.error)throw unr.error;

  // Demo plan image only if user has not uploaded one.
  if(!state.settings||!state.settings.plan_image_data){
   var svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#f3f5f6"/><text x="50" y="70" font-family="Arial" font-size="34" font-weight="700" fill="#202d36">EMIGRO DEMO MARKET PLANI</text><rect x="70" y="120" width="250" height="250" fill="#8de4a6" stroke="#202d36"/><text x="150" y="250" font-size="28">GİRİŞ / DEPO</text><rect x="380" y="120" width="300" height="220" fill="#f4d98e" stroke="#202d36"/><text x="470" y="240" font-size="28">RAFLAR</text><rect x="740" y="120" width="180" height="220" fill="#f78e92" stroke="#202d36"/><text x="785" y="240" font-size="24">KASAP</text><rect x="70" y="430" width="250" height="220" fill="#d8c8ef" stroke="#202d36"/><text x="135" y="550" font-size="26">MUTFAK</text><rect x="380" y="430" width="220" height="220" fill="#ade37f" stroke="#202d36"/><text x="430" y="550" font-size="26">SEBZE</text><rect x="660" y="430" width="280" height="220" fill="#6fbce6" stroke="#202d36"/><text x="735" y="550" font-size="26">DİPFRİZ</text></svg>';
   var sr=await db.from('emigro_cleaning_settings').upsert({id:1,plan_image_data:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg),updated_at:new Date().toISOString()});if(sr.error)throw sr.error;
  }

  await loadAll();

  // Create demo completion/missed records for today.
  var demoTasks=expectedTasks(dayStart(now),dayEnd(now)).filter(function(t){return String(t.zone.code||'').startsWith('DEMO-')});
  var proofSvg='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#e8f7ef"/><text x="400" y="270" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#1f7a50">DEMO TEMİZLİK FOTOĞRAFI</text><text x="400" y="330" text-anchor="middle" font-family="Arial" font-size="24" fill="#456">Alan temizlendi</text></svg>');
  for(let i=0;i<Math.min(5,demoTasks.length);i++){
   var t=demoTasks[i],done=i<3,row={slot_key:t.key,schedule_id:null,zone_id:t.zone.id,staff_id:(t.assigned||t.primary)?.id||null,work_date:dateKeyLocal(t.date),status:done?'done':'skipped',completed_at:done?new Date().toISOString():null,note:done?'Demo: temizlik tamamlandı.':'Demo: görev zamanında tamamlanmadı.',task_type:t.type,planned_time:t.time,proof_image_data:done?proofSvg:null};
   var lr=await db.from('emigro_cleaning_logs').upsert(row,{onConflict:'slot_key'});if(lr.error)throw lr.error;
  }
  // Historical skips to demonstrate recurring-problem warning.
  var problemZone=zoneIds['DEMO-TUVALET'];
  for(let k=1;k<=3;k++){
   var hd=addLocalDays(now,-k*4),hk=problemZone+':daily:'+dateKeyLocal(hd);
   var hr=await db.from('emigro_cleaning_logs').upsert({slot_key:hk,schedule_id:null,zone_id:problemZone,staff_id:staffIds['Fatma Yılmaz'],work_date:dateKeyLocal(hd),status:'skipped',note:'Demo: tekrar eden aksama.',task_type:'daily',planned_time:'08:30',proof_image_data:null},{onConflict:'slot_key'});if(hr.error)throw hr.error;
  }

  await loadAll();
  var btn=document.querySelector('[data-view="tracking"]');if(btn)btn.click();
  toast('Demo hazır: alanlar, personeller, görevler ve rapor kayıtları yüklendi');
 }catch(err){
  console.error(err);toast('Demo yüklenemedi: '+(err.message||'Bilinmeyen hata'))
 }
}
$('#planUpload').onchange=async e=>{if(!state.isAdmin){toast('Plan değiştirme yetkisi sadece adminde');e.target.value='';return;}
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>12*1024*1024)return toast('Resim en fazla 12 MB olsun');
 const data=await compressImage(file);
 const {error}=await db.from('emigro_cleaning_settings').upsert({id:1,plan_image_data:data,updated_at:new Date().toISOString()});if(error)return toast(error.message);
 toast('Plan resmi kaydedildi');loadAll()
};
function compressImage(file){
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{const max=2200,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.9))};
  img.onerror=reject;img.src=url
 })
}

state.reportPeriod='today';
state.trackingType='daily';
const typeNames={daily:'Günlük',weekly:'Haftalık',monthly:'Aylık'};

function pad2(n){return String(n).padStart(2,'0')}
function dateKeyLocal(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function parseDateLocal(v){var p=v.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function dayStart(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function dayEnd(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999)}
function addLocalDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function weekStart(d){var x=dayStart(d),w=x.getDay();return addLocalDays(x,w===0?-6:1-w)}
function weekEnd(d){return dayEnd(addLocalDays(weekStart(d),6))}
function monthStart(d){return new Date(d.getFullYear(),d.getMonth(),1)}
function monthEnd(d){return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999)}
function shortDate(d){return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short'})}

function makeTask(zone,card,type,d){
 var primaryId=card[type+'_primary_staff_id'];
 var backupId=card[type+'_backup_staff_id'];
 // Daily keeps backward compatibility with older assignments.
 if(type==='daily'){
   if(!primaryId)primaryId=card.primary_staff_id;
   if(!backupId)backupId=card.backup_staff_id;
 }
 var backupDays=card[type+'_backup_days']||[];
 if(type==='daily'&&!backupDays.length)backupDays=card.backup_days||[];
 var backupActive=false;
 if(backupId){
   if(type==='monthly')backupActive=backupDays.includes(d.getDate());
   else backupActive=backupDays.includes(d.getDay());
 }
 var primary=staffById(primaryId),backup=staffById(backupId);
 return {
  key:zone.id+':'+type+':'+dateKeyLocal(d),
  zone:zone,card:card,type:type,date:new Date(d),time:card[type+'_time']||null,
  primary:primary,backup:backup,
  assigned:backupActive?backup:primary,
  backupActive:backupActive,
  taskText:card[type+'_task']||'',
  tags:tagsFor(zone.id,type)
 }
}
function expectedTasks(from,to){
 var out=[],zones=manualZones();
 for(var d=dayStart(from);d<=to;d=addLocalDays(d,1)){
  for(var i=0;i<zones.length;i++){
   var z=zones[i],c=cardByZone(z.id);if(!c)continue;
   var dow=d.getDay(),dom=d.getDate();
   if(c.daily_enabled&&(c.daily_days||[]).includes(dow)){
     var td=makeTask(z,c,'daily',d);if(td.primary||td.backup)out.push(td)
   }
   if(c.weekly_enabled&&(c.weekly_days||[]).includes(dow)){
     var tw=makeTask(z,c,'weekly',d);if(tw.primary||tw.backup)out.push(tw)
   }
   if(c.monthly_enabled&&(c.monthly_days||[]).includes(dom)){
     var tm=makeTask(z,c,'monthly',d);if(tm.primary||tm.backup)out.push(tm)
   }
  }
 }
 return out
}
function configuredTasks(from,to){
 var out=[],zones=manualZones();
 for(var d=dayStart(from);d<=to;d=addLocalDays(d,1)){
  for(var i=0;i<zones.length;i++){
   var z=zones[i],c=cardByZone(z.id);if(!c)continue;
   var dow=d.getDay(),dom=d.getDate();
   if(c.daily_enabled&&(c.daily_days||[]).includes(dow))out.push(makeTask(z,c,'daily',d));
   if(c.weekly_enabled&&(c.weekly_days||[]).includes(dow))out.push(makeTask(z,c,'weekly',d));
   if(c.monthly_enabled&&(c.monthly_days||[]).includes(dom))out.push(makeTask(z,c,'monthly',d));
  }
 }
 return out
}
function priorityRank(z){return z&&z.priority==='critical'?0:z&&z.priority==='high'?1:2}
function logForTask(t){return state.logs.find(function(l){return l.slot_key===t.key})}
function dueAt(t){
 var d=new Date(t.date),bits=(t.time||'23:59').slice(0,5).split(':').map(Number);
 d.setHours(bits[0]||0,bits[1]||0,0,0);return d
}
function statusFor(t){
 var l=logForTask(t);
 if(l&&l.status==='done')return {key:'done',label:'Yapıldı',log:l};
 if(l&&l.status==='skipped')return {key:'overdue',label:'Yapılmadı',log:l};
 if(dueAt(t)<new Date())return {key:'overdue',label:'Yapılmadı',log:null};
 return {key:'pending',label:'Bekliyor',log:null}
}
function periodRange(){
 var n=new Date();
 if(state.reportPeriod==='week')return [weekStart(n),weekEnd(n)];
 if(state.reportPeriod==='month')return [monthStart(n),monthEnd(n)];
 return [dayStart(n),dayEnd(n)]
}
function reportRowHtml(t){
 var st=statusFor(t),l=st.log,who=l?staffById(l.staff_id):(t.assigned||t.primary);
 var proof=l&&l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+t.key+'\')">':'';
 var action=st.key!=='done'?'<button onclick="openComplete(\''+t.key+'\')">Yaptım + Foto</button>':'<button onclick="showPhoto(\''+t.key+'\')">Kanıt</button>';
 var snap=l&&Array.isArray(l.task_tags_snapshot)&&l.task_tags_snapshot.length?l.task_tags_snapshot:(t.tags||[]);
 var tagHtml=snap.length?'<div class="report-tag-list">'+snap.map(function(x){return '<span>'+esc(x.label||x)+'</span>'}).join('')+'</div>':'';
 var note=l&&(l.issue_note||l.note)?'<div class="report-note"><b>Not:</b> '+esc(l.issue_note||l.note)+'</div>':'';
 return '<article class="report-row '+st.key+'"><div><h3>'+esc(t.zone.name)+' · '+typeNames[t.type]+'</h3><div class="sub">'+esc(t.taskText||'Görev açıklaması yok')+'</div>'+tagHtml+note+'</div><div><span class="pill">'+shortDate(t.date)+' · '+(t.time?t.time.slice(0,5):'Saat yok')+'</span></div><div><span class="pill">👤 '+esc((who&&who.name)||'Atanmamış')+'</span></div><div><span class="status '+st.key+'">'+st.label+'</span></div><div class="row-actions">'+proof+action+'</div></article>'
}
function renderReport(){
 if(!$('#reportList'))return;
 var now=new Date(),today=expectedTasks(dayStart(now),dayEnd(now)),done=today.filter(function(t){return statusFor(t).key==='done'}).length,over=today.filter(function(t){return statusFor(t).key==='overdue'}).length;
 $('#mToday').textContent=today.length;$('#mDone').textContent=done;$('#mOverdue').textContent=over;$('#mStaff').textContent=state.staff.filter(function(p){return p.active}).length;
 var futureConfigured=configuredTasks(dayStart(now),addLocalDays(dayStart(now),30));
 var unassignedMap=new Map();
 futureConfigured.forEach(function(t){if(!t.primary&&!t.backup)unassignedMap.set(t.zone.id+':'+t.type,t)});
 var unassigned=[...unassignedMap.values()],ua=$('#assignmentAlert');
 if(ua){if(unassigned.length){ua.classList.remove('hidden');ua.innerHTML='<h3>⚠ '+unassigned.length+' görev türünde sorumlu atanmadı</h3><p>'+unassigned.slice(0,8).map(function(t){return esc(t.zone.name)+' · '+typeNames[t.type]}).join(' • ')+(unassigned.length>8?' • +'+(unassigned.length-8)+' daha':'')+'</p>'}else ua.classList.add('hidden')}
 var since=dateKeyLocal(addLocalDays(now,-30)),problemCounts={};
 state.logs.filter(function(l){return l.slot_key&&l.status==='skipped'&&l.work_date>=since}).forEach(function(l){problemCounts[l.zone_id]=(problemCounts[l.zone_id]||0)+1});
 var recurring=Object.entries(problemCounts).filter(function(x){return x[1]>=3}).sort(function(a,b){return b[1]-a[1]}),pp=$('#problemPanel');
 if(pp){if(recurring.length){pp.classList.remove('hidden');pp.innerHTML='<h3>↻ Tekrarlayan aksama tespit edildi</h3><p>'+recurring.map(function(x){var z=zoneById(Number(x[0]));return esc((z&&z.name)||'Alan')+' · son 30 günde '+x[1]+' aksama'}).join(' • ')+'</p>'}else pp.classList.add('hidden')}
 var missed=expectedTasks(monthStart(now),now).filter(function(t){return statusFor(t).key==='overdue'}),ap=$('#alertPanel'),badge=$('#alertBadge');
 if(missed.length){ap.classList.remove('hidden');ap.innerHTML='<h3>⚠ '+missed.length+' aksayan temizlik var</h3><p>'+missed.slice(0,5).map(function(t){return esc(t.zone.name)+' · '+typeNames[t.type]+' · '+shortDate(t.date)}).join(' • ')+(missed.length>5?' • +'+(missed.length-5)+' daha':'')+'</p>';badge.classList.remove('hidden');badge.textContent=missed.length}else{ap.classList.add('hidden');badge.classList.add('hidden')}
 var rg=periodRange(),all=expectedTasks(rg[0],rg[1]),filter=$('#reportType').value||'',tasks=filter?all.filter(function(t){return t.type===filter}):all;
 ['daily','weekly','monthly'].forEach(function(tp){var list=all.filter(function(t){return t.type===tp}),d=list.filter(function(t){return statusFor(t).key==='done'}).length,id='#r'+tp.charAt(0).toUpperCase()+tp.slice(1);$(id).textContent=d+' / '+list.length});
 $('#reportList').innerHTML=tasks.length?tasks.map(reportRowHtml).join(''):'<div class="sub">Bu dönem için görev yok.</div>'
}
function renderTracking(){
 if(!$('#trackingDate'))return;
 var inp=$('#trackingDate');if(!inp.value)inp.value=dateKeyLocal(new Date());
 var d=parseDateLocal(inp.value),tasks=expectedTasks(dayStart(d),dayEnd(d)).filter(function(t){return t.type===state.trackingType});
 if(!state.isAdmin){if(!state.workerStaffId)tasks=[];else tasks=tasks.filter(taskAssignedToWorker);}
 tasks.sort(function(a,b){return priorityRank(a.zone)-priorityRank(b.zone)||dueAt(a)-dueAt(b)});
 var groups={overdue:[],pending:[],done:[]};
 tasks.forEach(function(t){groups[statusFor(t).key].push(t)});
 function item(t){
   var st=statusFor(t),l=st.log,who=t.assigned||t.primary,proof=l&&l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+t.key+'\')">':'';
   var actions=st.key==='done'
     ? (proof||'<span class="sub">Fotoğraf yok</span>')
     : '<button class="primary compact-btn" onclick="openComplete(\''+t.key+'\')">Yaptım</button>'+(state.isAdmin&&st.key==='overdue'?'<button class="ghost compact-btn" onclick="openWarningForTask(\''+t.key+'\')">Uyar</button>':'');
   return '<article class="today-task '+st.key+' priority-'+(t.zone.priority||'normal')+'" onclick="openZoneStatus('+t.zone.id+')"><div class="today-task-main"><div class="today-task-top"><span class="calendar-type-label">'+typeNames[t.type]+'</span>'+(t.zone.priority!=='normal'?'<span class="priority-badge '+t.zone.priority+'">'+(t.zone.priority==='critical'?'Kritik':'Yüksek')+'</span>':'')+'</div><h3>'+esc(t.zone.name)+'</h3><p>'+esc(t.taskText||'Görev açıklaması yok')+'</p>'+(t.tags&&t.tags.length?'<div class="task-tag-list">'+t.tags.map(function(x){return '<span>'+esc(x.label)+'</span>'}).join('')+'</div>':'')+'<div class="today-meta">🕒 '+(t.time?t.time.slice(0,5):'—')+' · 👤 '+esc((who&&who.name)||'Atanmamış')+'</div></div><div class="today-task-actions" onclick="event.stopPropagation()">'+actions+'</div></article>'
 }
 $('#todayOverCount').textContent=groups.overdue.length;$('#todayPendingCount').textContent=groups.pending.length;$('#todayDoneCount').textContent=groups.done.length;
 $('#todayOverdue').innerHTML=groups.overdue.length?groups.overdue.map(item).join(''):'<div class="today-empty">Aksayan iş yok.</div>';
 $('#todayPending').innerHTML=groups.pending.length?groups.pending.map(item).join(''):'<div class="today-empty">Bekleyen iş yok.</div>';
 $('#todayDone').innerHTML=groups.done.length?groups.done.map(item).join(''):'<div class="today-empty">Tamamlanan iş yok.</div>';
}
function taskByKey(key){
 var p=key.split(':'),z=zoneById(Number(p[0])),c=cardByZone(Number(p[0]));return z&&c?makeTask(z,c,p[1],parseDateLocal(p[2])):null
}
window.openComplete=function(key){
 var t=taskByKey(key);if(!t)return;
 var choices=[t.assigned,t.primary,t.backup].filter(Boolean).filter(function(p,i,a){return a.findIndex(function(x){return x.id===p.id})===i});
 if(!choices.length)choices=state.staff.filter(function(p){return p.active});
 if(!state.isAdmin&&workerById())choices=[workerById()];
 var opts=choices.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join('');
 openModal('<h2>Temizlik Tamamlandı</h2><form id="completeForm"><div class="form-grid"><div class="field full"><label>Alan / görev</label><div><b>'+esc(t.zone.name)+' · '+typeNames[t.type]+'</b><div class="sub">'+esc(t.taskText)+'</div></div></div><div class="field"><label>Yapan kişi</label><select name="staff_id" required '+(!state.isAdmin?'disabled':'')+'>'+opts+'</select>'+(!state.isAdmin&&workerById()?'<input type="hidden" name="staff_id" value="'+workerById().id+'">':'')+'</div><div class="field"><label>Planlanan saat</label><input value="'+(t.time?t.time.slice(0,5):'—')+'" disabled></div>'+(t.tags&&t.tags.length?'<div class="field full"><label>Sabit görevler</label><div class="worker-checklist">'+t.tags.map(function(x){return '<label><input type="checkbox" name="tag_done" value="'+x.id+'"> <span>'+esc(x.label)+'</span></label>'}).join('')+'</div></div>':'')+'<div class="field full"><label>Fotoğraf <span class="optional-label">(isteğe bağlı)</span></label><div class="proof-upload">İstersen yaptığın yerin fotoğrafını çek veya yükle.<br><input id="proofFile" type="file" accept="image/*" capture="environment" '+(state.isAdmin&&t.zone.proof_required?'required':'')+'></div></div><div class="field full"><label>Durum / Not</label><textarea name="note" placeholder="Bu alanda dikkat edilmesi gereken bir durum varsa yazın..."></textarea></div></div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Yaptım</button></div></form>');
 $('#completeForm').onsubmit=async function(e){
  e.preventDefault();var fd=new FormData(e.target),file=$('#proofFile').files&&$('#proofFile').files[0];if(state.isAdmin&&t.zone.proof_required&&!file)return toast('Bu alan için fotoğraf zorunlu');
  var checked=fd.getAll('tag_done').map(Number);if(t.tags&&t.tags.length&&checked.length<t.tags.length)return toast('Sabit görevlerin tamamını işaretleyin');
  var proof=file?await compressProof(file):null,row={slot_key:t.key,schedule_id:null,zone_id:t.zone.id,staff_id:+fd.get('staff_id'),work_date:dateKeyLocal(t.date),status:'done',completed_at:new Date().toISOString(),note:fd.get('note')||'',issue_note:fd.get('note')||'',task_type:t.type,planned_time:t.time,proof_image_data:proof,task_tags_snapshot:t.tags||[]};
  var res=await db.from('emigro_cleaning_logs').upsert(row,{onConflict:'slot_key'});if(res.error)return toast(res.error.message);closeModal();toast('Fotoğraflı tamamlanma kaydedildi');loadAll()
 }
};
window.markSkipped=async function(key){
 var t=taskByKey(key);if(!t)return;var note=prompt('Yapılmama nedeni:','');if(note===null)return;
 var activePerson=t.assigned||t.primary||t.backup;var row={slot_key:t.key,schedule_id:null,zone_id:t.zone.id,staff_id:activePerson?activePerson.id:null,work_date:dateKeyLocal(t.date),status:'skipped',completed_at:null,note:note,task_type:t.type,planned_time:t.time,proof_image_data:null};
 var r=await db.from('emigro_cleaning_logs').upsert(row,{onConflict:'slot_key'});if(r.error)return toast(r.error.message);loadAll()
};
window.showPhoto=function(key){var l=state.logs.find(function(x){return x.slot_key===key});if(!l||!l.proof_image_data)return toast('Fotoğraf yok');$('#photoView').src=l.proof_image_data;$('#photoModal').classList.remove('hidden')};
function compressProof(file){
 return new Promise(function(resolve,reject){var img=new Image(),url=URL.createObjectURL(file);img.onload=function(){var max=960,sc=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*sc),h=Math.round(img.height*sc),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.68))};img.onerror=reject;img.src=url})
}

function staffStats(id){
 var now=new Date(),tasks=expectedTasks(monthStart(now),now),primary=tasks.filter(function(t){return String((t.primary&&t.primary.id)||'')===String(id)}),done=state.logs.filter(function(l){return l.status==='done'&&String(l.staff_id)===String(id)&&l.work_date>=dateKeyLocal(monthStart(now))&&l.work_date<=dateKeyLocal(now)}).length,miss=primary.filter(function(t){return statusFor(t).key==='overdue'}).length;
 return {assigned:primary.length,done:done,missed:miss}
}
function renderStaff(){
 if(!$('#staffGrid'))return;
 $('#staffGrid').innerHTML=state.staff.length?state.staff.map(function(p){
  var st=staffStats(p.id),primary=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).primary_staff_id)===String(p.id)}),backup=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).backup_staff_id)===String(p.id)});
  return '<article class="staff-card" onclick="openPerson('+p.id+')"><div class="staff-card-top"><div><h3>'+esc(p.name)+'</h3><div class="desc">'+esc(p.role||'Rol belirtilmedi')+'</div></div><span class="pill">'+(p.active?'Aktif':'Pasif')+'</span></div><div class="staff-metrics"><div><b>'+st.assigned+'</b><span>Bu ay görev</span></div><div><b>'+st.done+'</b><span>Yaptı</span></div><div><b>'+st.missed+'</b><span>Aksadı</span></div></div><div class="responsibility">'+primary.map(function(z){return '<span>Asıl · '+esc(z.name)+'</span>'}).join('')+backup.map(function(z){return '<span>Yedek · '+esc(z.name)+'</span>'}).join('')+'</div><div class="card-actions"><button onclick="event.stopPropagation();editStaff('+p.id+')">Düzenle</button></div></article>'
 }).join(''):'<div class="sub">Personel eklenmedi.</div>'
}

function assignmentRowsForPerson(personId){
 return manualZones().map(function(z){
  var c=cardByZone(z.id)||{},isPrimary=String(c.primary_staff_id||'')===String(personId),isBackup=String(c.backup_staff_id||'')===String(personId);
  return '<div class="assignment-row"><div><b>'+esc(z.name)+'</b><span>'+esc(z.description||'')+'</span></div>'+
   '<label class="check"><input type="radio" name="role_'+z.id+'" value="primary" '+(isPrimary?'checked':'')+'> Asıl</label>'+
   '<label class="check"><input type="radio" name="role_'+z.id+'" value="backup" '+(isBackup?'checked':'')+'> Yedek</label>'+
   '<label class="check"><input type="radio" name="role_'+z.id+'" value="none" '+(!isPrimary&&!isBackup?'checked':'')+'> Yok</label>'+
   '<div class="backup-days '+(isBackup?'':'muted')+'">'+weekdayChecks('backup_'+z.id,c.backup_days||[])+'</div></div>'
 }).join('')
}
window.editPersonAssignments=function(id){
 if(!state.isAdmin)return toast('Atama yetkisi sadece adminde');
 var p=staffById(id);if(!p)return;
 openModal('<h2>'+esc(p.name)+' · Alan Atamaları</h2><form id="personAssignForm"><div class="assignment-editor">'+assignmentRowsForPerson(id)+'</div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Atamaları Kaydet</button></div></form>');
 $('#personAssignForm').onsubmit=async function(e){
  e.preventDefault();var fd=new FormData(e.target);
  for(const z of manualZones()){
   var c=cardByZone(z.id)||{},role=fd.get('role_'+z.id)||'none',row={zone_id:z.id,
     primary_staff_id:c.primary_staff_id||null,backup_staff_id:c.backup_staff_id||null,
     backup_enabled:c.backup_enabled||false,backup_days:c.backup_days||[],
     daily_enabled:c.daily_enabled||false,daily_days:c.daily_days||[],daily_time:c.daily_time||null,daily_task:c.daily_task||'',
     weekly_enabled:c.weekly_enabled||false,weekly_days:c.weekly_days||[],weekly_time:c.weekly_time||null,weekly_task:c.weekly_task||'',
     monthly_enabled:c.monthly_enabled||false,monthly_days:c.monthly_days||[],monthly_time:c.monthly_time||null,monthly_task:c.monthly_task||'',updated_at:new Date().toISOString()
   };
   if(role==='primary'){
     row.primary_staff_id=id;
     if(String(row.backup_staff_id)===String(id))row.backup_staff_id=null;
   }else if(role==='backup'){
     row.backup_staff_id=id;row.backup_enabled=true;row.backup_days=fd.getAll('backup_'+z.id).map(Number);
     if(String(row.primary_staff_id)===String(id))row.primary_staff_id=null;
   }else{
     if(String(row.primary_staff_id)===String(id))row.primary_staff_id=null;
     if(String(row.backup_staff_id)===String(id)){row.backup_staff_id=null;row.backup_enabled=false;row.backup_days=[]}
   }
   var rr=await db.from('emigro_cleaning_zone_cards').upsert(row,{onConflict:'zone_id'});if(rr.error)return toast(rr.error.message)
  }
  closeModal();toast('Personel alan atamaları kaydedildi');loadAll()
 }
};

window.openPerson=function(id){
 var p=staffById(id);if(!p)return;var now=new Date(),all=expectedTasks(monthStart(now),now),primary=all.filter(function(t){return String((t.primary&&t.primary.id)||'')===String(id)}),activity=state.logs.filter(function(l){return String(l.staff_id)===String(id)&&l.slot_key&&l.work_date>=dateKeyLocal(monthStart(now))}).sort(function(a,b){return b.work_date.localeCompare(a.work_date)}),pz=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).primary_staff_id)===String(id)}),bz=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).backup_staff_id)===String(id)}),miss=primary.filter(function(t){return statusFor(t).key==='overdue'});
 var rows=activity.length?activity.map(function(l){var z=zoneById(l.zone_id),photo=l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+l.slot_key+'\')">':'';return '<article class="report-row '+(l.status==='done'?'done':'overdue')+'"><div><h3>'+esc((z&&z.name)||'')+' · '+(typeNames[l.task_type]||'')+'</h3><div class="sub">'+l.work_date+' · '+esc(l.note||'')+'</div></div><div><span class="status '+(l.status==='done'?'done':'overdue')+'">'+(l.status==='done'?'Yapıldı':'Yapılmadı')+'</span></div><div></div><div></div><div class="row-actions">'+photo+'</div></article>'}).join(''):'<div class="sub">Bu ay kayıt yok.</div>';
 openModal('<h2>'+esc(p.name)+'</h2><div class="people"><div class="person-box"><label>Asıl sorumluluk</label><b>'+ (pz.map(function(z){return esc(z.name)}).join(', ')||'—') +'</b></div><div class="person-box"><label>Yedek sorumluluk</label><b>'+ (bz.map(function(z){return esc(z.name)}).join(', ')||'—') +'</b></div></div><div class="type-summary"><article><span>Bu ay planlanan</span><b>'+primary.length+'</b></article><article><span>Yaptığı</span><b>'+activity.filter(function(x){return x.status==='done'}).length+'</b></article><article><span>Aksayan</span><b>'+miss.length+'</b></article></div><div class="section-head"><div><h2>Bu Ay Aktivite</h2></div></div><div class="report-list">'+rows+'</div>')
};
function renderHistory(){
 if(!$('#historyBody'))return;
 var logs=state.logs.filter(function(l){return l.slot_key});
 $('#historyBody').innerHTML=logs.length?logs.map(function(l){var ph=l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+l.slot_key+'\')">':'—';return '<tr><td>'+l.work_date+'</td><td>'+(typeNames[l.task_type]||'—')+'</td><td>'+esc((zoneById(l.zone_id)||{}).name||'')+'</td><td>'+esc((staffById(l.staff_id)||{}).name||'')+'</td><td>'+(l.status==='done'?'Yapıldı':'Yapılmadı')+'</td><td>'+ph+'</td><td>'+esc(l.note||'')+'</td></tr>'}).join(''):'<tr><td colspan="7">Kayıt yok.</td></tr>'
}

if($('#closePhoto'))$('#closePhoto').onclick=function(){$('#photoModal').classList.add('hidden')};
if($('#photoModal'))$('#photoModal').onclick=function(e){if(e.target.id==='photoModal')$('#photoModal').classList.add('hidden')};
if($('#trackingDate'))$('#trackingDate').onchange=renderTracking;
if($('#reportType'))$('#reportType').onchange=renderReport;
$$('.period').forEach(function(b){b.onclick=function(){$$('.period').forEach(function(x){x.classList.toggle('active',x===b)});state.reportPeriod=b.dataset.period;renderReport()}});
$$('.nav').forEach(function(b){b.onclick=function(){
 $$('.nav').forEach(function(x){x.classList.toggle('active',x===b)});$$('.view').forEach(function(v){v.classList.toggle('active',v.id==='view-'+b.dataset.view)});
 var meta={report:['Yönetim','Raporlar, uyarılar ve geçmiş kayıtları.'],tracking:['Bugün','Günlük, haftalık ve aylık temizlik işleri.'],
        calendar:['Takvim','Planlanan temizlikler ve sorumlular.'],
        'worker-notifications':['Bildirimler','Yönetimden gelen mesaj ve uyarılar.'],plan:['Plan','Market alanları ve temizlik bölgeleri.'],staff:['Personel','Sorumluluklar ve görev durumu.'],notifications:['Uyarılar & Bildirimler','Personele gönderilen temizlik uyarıları ve takip kayıtları.'],history:['Geçmiş','Tamamlanan temizlikler ve fotoğraf kanıtları.']}[b.dataset.view];
 $('#pageTitle').textContent=meta[0];$('#pageSub').textContent=meta[1]
}});

state.warningFilter='open';

function zoneTasksInRange(zoneId,from,to){
 return expectedTasks(from,to).filter(function(t){return String(t.zone.id)===String(zoneId)})
}
function taskMiniHtml(t){
 var st=statusFor(t),l=st.log,photo=l&&l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+t.key+'\')">':'';
 var warn=st.key==='overdue'?'<button class="task-warn-btn" onclick="event.stopPropagation();openWarningForTask(\''+t.key+'\')">Uyar</button>':'';
 return '<article class="zone-task-card '+st.key+'">'+
   '<div class="zone-task-head"><div><span class="task-kind">'+typeNames[t.type]+'</span><b>'+(t.time?t.time.slice(0,5):'Saat yok')+'</b></div><span class="task-status '+st.key+'">'+st.label+'</span></div>'+
   '<p>'+esc(t.taskText||'Görev açıklaması yok')+'</p>'+
   '<div class="zone-task-foot"><span>'+shortDate(t.date)+'</span><div class="zone-task-actions">'+photo+warn+'</div></div>'+
  '</article>'
}
window.openZoneStatus=function(id){
 if(!state.isAdmin&&!workerAssignedToZone(id))return toast('Bu alan sana atanmadı');
 var z=zoneById(id),c=cardByZone(id)||{};if(!z)return;
 var p=staffById(c.primary_staff_id),b=staffById(c.backup_staff_id),now=new Date();
 var today=zoneTasksInRange(id,dayStart(now),dayEnd(now));
 var week=zoneTasksInRange(id,weekStart(now),weekEnd(now));
 var month=zoneTasksInRange(id,monthStart(now),monthEnd(now));
 var recent=state.logs.filter(function(l){return String(l.zone_id)===String(id)&&l.slot_key}).slice(0,6);

 function sum(tasks,type){
  var a=tasks.filter(function(t){return t.type===type});
  var done=a.filter(function(t){return statusFor(t).key==='done'}).length;
  var over=a.filter(function(t){return statusFor(t).key==='overdue'}).length;
  return '<div class="zone-summary-card"><span>'+typeNames[type]+'</span><b>'+a.length+' görev</b><small>'+(over?over+' yapılmadı':done===a.length&&a.length?'Tamamlandı':'Aksama yok')+'</small></div>'
 }
 var states=today.map(function(t){return statusFor(t).key});
 var overall=states.includes('overdue')?{key:'overdue',label:'Aksıyor'}:states.includes('pending')?{key:'pending',label:'Bekliyor'}:states.length&&states.every(function(x){return x==='done'})?{key:'done',label:'Tamamlandı'}:{key:'neutral',label:'Bugün görev yok'};

 var todayRows=today.length?today.map(taskMiniHtml).join(''):'<div class="empty-state-mini">Bugün bu alan için görev yok.</div>';
 var recentRows=recent.length?recent.map(function(l){
   var who=staffById(l.staff_id),proof=l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+l.slot_key+'\')">':'';
   return '<div class="recent-clean-row"><div><b>'+(typeNames[l.task_type]||'Temizlik')+'</b><span>'+l.work_date+' · '+esc((who&&who.name)||'')+'</span></div><span class="status '+(l.status==='done'?'done':'overdue')+'">'+(l.status==='done'?'Yapıldı':'Yapılmadı')+'</span>'+proof+'</div>'
 }).join(''):'<div class="empty-state-mini">Henüz kayıt yok.</div>';

 var backupDays=(b&&c.backup_enabled)?(c.backup_days||[]):[];
 var primaryDays=[0,1,2,3,4,5,6].filter(function(d){return !backupDays.includes(d)});

 var adminSettings=state.isAdmin
  ? '<details class="zone-settings"><summary>⚙ Ayarlar</summary><div class="zone-settings-menu">'+
    '<button class="ghost" onclick="openZoneCardModal('+z.id+')">Tanımlamayı Düzenle</button>'+
    '<button class="ghost" onclick="startZoneRedraw('+z.id+')">Alanı Yeniden Seç</button>'+
    '<button class="danger-btn" onclick="deleteZone('+z.id+')">Alanı Sil</button>'+
    '</div></details>'
  : '';

 openModal('<div class="zone-app-card compact-zone-card">'+
   '<header class="zone-detail-header"><div><span class="eyebrow">ALAN DURUMU</span><h2>'+esc(z.name)+'</h2><p>'+esc(z.description||'Alan açıklaması yok')+'</p></div><span class="zone-overall '+overall.key+'">'+overall.label+'</span></header>'+
   '<section class="assignee-card compact-assignees"><div class="assignee-title"><div><b>Temizlik Sorumluları</b><span>Aktif oldukları günler</span></div></div>'+
    '<div class="people"><div class="person-box"><label>Asıl sorumlu</label><b>'+esc((p&&p.name)||'Atanmadı')+'</b>'+(p?'<small>'+fmtDays(primaryDays)+'</small>':'')+'</div>'+
    '<div class="person-box"><label>Yedek sorumlu</label><b>'+esc((b&&b.name)||'Atanmadı')+'</b>'+(b&&backupDays.length?'<small>'+fmtDays(backupDays)+'</small>':'')+'</div></div>'+
   '</section>'+
   '<section class="zone-period-summary compact-summary">'+sum(week,'daily')+sum(week,'weekly')+sum(month,'monthly')+'</section>'+
   '<section class="zone-section"><div class="zone-section-head"><div><h3>Bugünkü Durum</h3><p>Planlanan işler</p></div></div><div class="zone-task-list compact-task-list">'+todayRows+'</div></section>'+
   '<section class="zone-section recent-section"><div class="zone-section-head"><div><h3>Son Kayıtlar</h3><p>Son işlemler</p></div></div><div class="recent-clean-list">'+recentRows+'</div></section>'+
   '<div class="zone-main-actions compact-actions">'+(state.isAdmin?'<button class="primary notify-main" onclick="openWarning('+z.id+',null,null)">Bildirim Gönder</button>':'')+adminSettings+'</div>'+
  '</div>');

 var box=$('#modal .modal-box');
 if(box){box.classList.add('zone-sheet','zone-detail-sheet')}
};
window.openZoneAssignee=function(zoneId){
 if(!state.isAdmin)return toast('Kişi atama yetkisi sadece adminde');
 var z=zoneById(zoneId),c=cardByZone(zoneId)||{};
 var staff=state.staff.filter(function(p){return p.active});
 var options='<option value="">Atanmadı</option>'+staff.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join('');

 function personSelects(type,title){
  var pval=c[type+'_primary_staff_id']||(type==='daily'?c.primary_staff_id:null)||'';
  var bval=c[type+'_backup_staff_id']||(type==='daily'?c.backup_staff_id:null)||'';
  return '<div class="freq-person-head"><div><b>'+title+'</b><span>'+(
    type==='daily'?'Her gün için sorumlu kişi seçilir.':
    type==='weekly'?'Haftalık özel temizlik için ayrı sorumlu tanımlayın.':
    'Aylık özel temizlik için ayrı sorumlu tanımlayın.'
  )+'</span></div></div>'+
  '<div class="assignment-person-grid">'+
   '<div class="field"><label>Asıl temizleyen</label><select id="'+type+'Primary" name="'+type+'_primary">'+options+'</select></div>'+
   '<div class="field"><label>Yedek temizleyen</label><select id="'+type+'Backup" name="'+type+'_backup">'+options+'</select></div>'+
  '</div>'+
  '<input type="hidden" id="'+type+'PrimaryValue" value="'+pval+'"><input type="hidden" id="'+type+'BackupValue" value="'+bval+'">'
 }

 openModal('<div class="zone-app-card"><div class="app-head"><span class="eyebrow">PERSONEL ATAMA</span><h2>'+esc((z&&z.name)||'Alan')+'</h2><p>Günlük, haftalık ve aylık temizliklerde farklı sorumlular tanımlayabilirsiniz.</p></div>'+
  '<form id="zoneAssigneeForm">'+
   '<div class="freq-tabs">'+
    '<button type="button" class="freq-tab active" data-freq="daily">Günlük</button>'+
    '<button type="button" class="freq-tab" data-freq="weekly">Haftalık</button>'+
    '<button type="button" class="freq-tab" data-freq="monthly">Aylık</button>'+
   '</div>'+

   '<section class="freq-panel active" data-freq-panel="daily">'+
    personSelects('daily','Günlük Temizlik')+
    '<div class="day-owner-card"><div class="day-owner-head"><div><b>Haftalık Sorumluluk</b><span>Her gün yalnızca Asıl veya Yedek görevli olur.</span></div><span id="dailyOwnerHint" class="backup-status-pill"></span></div>'+
     '<div id="dailyOwnerGrid" class="day-owner-grid"></div>'+
    '</div>'+
   '</section>'+

   '<section class="freq-panel" data-freq-panel="weekly">'+
    personSelects('weekly','Haftalık Özel Temizlik')+
    '<div class="special-assignment-card"><div class="special-head"><b>Rutinde Tanımlı Günler</b><span>'+fmtDays(c.weekly_days||[])+'</span></div>'+
     '<p>Yedek kullanmak istiyorsanız aşağıdan yedeğin devralacağı haftalık günleri seçin.</p>'+
     '<div class="checks special-day-checks">'+weekdayChecks('weekly_backup_days',c.weekly_backup_days||[])+'</div>'+
    '</div>'+
   '</section>'+

   '<section class="freq-panel" data-freq-panel="monthly">'+
    personSelects('monthly','Aylık Özel Temizlik')+
    '<div class="special-assignment-card"><div class="special-head"><b>Rutinde Tanımlı Ay Günleri</b><span>'+fmtMonthDays(c.monthly_days||[])+'</span></div>'+
     '<p>Yedeğin devralacağı ay günlerini seçebilirsiniz.</p>'+
     '<div class="checks special-day-checks month-special-days">'+monthDayChecks(c.monthly_backup_days||[])+'</div>'+
    '</div>'+
   '</section>'+

   '<div class="form-actions"><button type="button" class="ghost" onclick="openZoneStatus('+zoneId+')">Geri</button><button class="primary">Atamaları Kaydet</button></div>'+
  '</form></div>');

 var form=$('#zoneAssigneeForm');

 ['daily','weekly','monthly'].forEach(function(type){
   var p=$('#'+type+'Primary'),b=$('#'+type+'Backup');
   p.value=$('#'+type+'PrimaryValue').value;
   b.value=$('#'+type+'BackupValue').value;
   function guard(){
     if(p.value&&b.value&&p.value===b.value){b.value='';toast('Asıl ve yedek aynı kişi olamaz')}
   }
   p.onchange=guard;b.onchange=guard;
 });

 var dailyGrid=$('#dailyOwnerGrid'),dailyP=$('#dailyPrimary'),dailyB=$('#dailyBackup'),dailyHint=$('#dailyOwnerHint');
 function dailyBackupDaysFromState(){
   var d=c.daily_backup_days||[];
   if(!d.length&&c.backup_enabled)d=c.backup_days||[];
   return d
 }
 function renderDailyOwners(){
  var bd=dailyBackupDaysFromState();
  dailyGrid.innerHTML=dayNames.map(function(day,i){
    var useBackup=!!dailyB.value&&bd.includes(i);
    return '<div class="day-owner-row" data-day="'+i+'"><div class="day-name">'+day+'</div><div class="owner-toggle">'+
     '<label class="owner-choice '+(!useBackup?'selected':'')+'"><input type="radio" name="daily_owner_'+i+'" value="primary" '+(!useBackup?'checked':'')+'>Asıl</label>'+
     '<label class="owner-choice '+(useBackup?'selected':'')+' '+(!dailyB.value?'disabled':'')+'"><input type="radio" name="daily_owner_'+i+'" value="backup" '+(useBackup?'checked':'')+' '+(!dailyB.value?'disabled':'')+'>Yedek</label>'+
     '</div><div class="day-owner-person">'+(useBackup?esc(staffById(dailyB.value)?.name||'Yedek'):esc(staffById(dailyP.value)?.name||'Asıl seçilmedi'))+'</div></div>'
  }).join('');
  dailyGrid.querySelectorAll('input[type="radio"]').forEach(function(r){
    r.onchange=function(){
      var row=r.closest('.day-owner-row');
      row.querySelectorAll('.owner-choice').forEach(function(l){l.classList.remove('selected')});
      r.closest('.owner-choice').classList.add('selected');
      var who=r.value==='backup'?staffById(dailyB.value):staffById(dailyP.value);
      row.querySelector('.day-owner-person').textContent=(who&&who.name)||(r.value==='backup'?'Yedek':'Asıl seçilmedi');
      updateDailyHint()
    }
  });
  updateDailyHint()
 }
 function updateDailyHint(){
   var bc=0;dailyGrid.querySelectorAll('.day-owner-row').forEach(function(row){var x=row.querySelector('input:checked');if(x&&x.value==='backup')bc++});
   dailyHint.textContent=bc?(7-bc)+' gün Asıl · '+bc+' gün Yedek':'7 gün Asıl'
 }
 dailyP.onchange=function(){if(dailyP.value&&dailyB.value===dailyP.value){dailyB.value='';toast('Asıl ve yedek aynı kişi olamaz')}renderDailyOwners()};
 dailyB.onchange=function(){if(dailyB.value&&dailyP.value===dailyB.value){dailyB.value='';toast('Asıl ve yedek aynı kişi olamaz')}renderDailyOwners()};
 renderDailyOwners();

 $$('.freq-tab').forEach(function(btn){
  btn.onclick=function(){
   $$('.freq-tab').forEach(function(x){x.classList.toggle('active',x===btn)});
   $$('.freq-panel').forEach(function(x){x.classList.toggle('active',x.dataset.freqPanel===btn.dataset.freq)})
  }
 });

 form.onsubmit=async function(e){
  e.preventDefault();
  var dailyPrimary=dailyP.value?+dailyP.value:null,dailyBackup=dailyB.value?+dailyB.value:null,dailyBackupDays=[];
  dailyGrid.querySelectorAll('.day-owner-row').forEach(function(row){var x=row.querySelector('input:checked');if(x&&x.value==='backup')dailyBackupDays.push(Number(row.dataset.day))});
  if(dailyBackupDays.length&&!dailyBackup)return toast('Günlük yedek günleri var ama yedek kişi seçilmedi');

  var weeklyPrimary=$('#weeklyPrimary').value?+$('#weeklyPrimary').value:null,weeklyBackup=$('#weeklyBackup').value?+$('#weeklyBackup').value:null;
  var weeklyBackupDays=[...form.querySelectorAll('input[name="weekly_backup_days"]:checked')].map(function(x){return Number(x.value)});
  if(weeklyBackupDays.length&&!weeklyBackup)return toast('Haftalık yedek günleri var ama yedek kişi seçilmedi');

  var monthlyPrimary=$('#monthlyPrimary').value?+$('#monthlyPrimary').value:null,monthlyBackup=$('#monthlyBackup').value?+$('#monthlyBackup').value:null;
  var monthlyBackupDays=[...form.querySelectorAll('input[name="monthly_days"]:checked')].map(function(x){return Number(x.value)});
  if(monthlyBackupDays.length&&!monthlyBackup)return toast('Aylık yedek günleri var ama yedek kişi seçilmedi');

  var row={
   primary_staff_id:dailyPrimary,backup_staff_id:dailyBackup,backup_enabled:!!dailyBackup&&dailyBackupDays.length>0,backup_days:dailyBackupDays,
   daily_primary_staff_id:dailyPrimary,daily_backup_staff_id:dailyBackup,daily_backup_days:dailyBackupDays,
   weekly_primary_staff_id:weeklyPrimary,weekly_backup_staff_id:weeklyBackup,weekly_backup_days:weeklyBackupDays,
   monthly_primary_staff_id:monthlyPrimary,monthly_backup_staff_id:monthlyBackup,monthly_backup_days:monthlyBackupDays,
   updated_at:new Date().toISOString()
  };
  var q=cardByZone(zoneId)?db.from('emigro_cleaning_zone_cards').update(row).eq('zone_id',zoneId):db.from('emigro_cleaning_zone_cards').insert(Object.assign({zone_id:zoneId},row));
  var r=await q;if(r.error)return toast(r.error.message);
  toast('Günlük, haftalık ve aylık sorumlular kaydedildi');await loadAll();openZoneStatus(zoneId)
 };
 var box=$('#modal .modal-box');if(box)box.classList.add('zone-sheet');
};
window.openWarningForTask=function(key){
 var t=taskByKey(key);if(!t)return;openWarning(t.zone.id,t.type,dateKeyLocal(t.date))
};
window.openWarning=function(zoneId,type,workDate){
 var z=zoneById(zoneId),targetDate=workDate?parseDateLocal(workDate):new Date();
 var tasks=expectedTasks(dayStart(targetDate),dayEnd(targetDate)).filter(function(t){
   return String(t.zone.id)===String(zoneId)&&(type?t.type===type:true)
 });
 var task=tasks[0]||null;
 var person=task?(task.assigned||task.primary):null;
 if(!person){
   var c=cardByZone(zoneId)||{};
   var pid=(type?c[type+'_primary_staff_id']:null)||c.daily_primary_staff_id||c.primary_staff_id;
   person=staffById(pid);
 }
 if(!person)return toast('Bu görev için sorumlu kişi tanımlı değil');

 var taskLabel=type?typeNames[type]:'Temizlik';
 var defaultText=taskLabel+' yapılmadı. Lütfen kontrol edip görevi tamamlayın.';
 openModal('<div class="zone-app-card"><div class="app-head"><span class="eyebrow">UYARI GÖNDER</span><h2>'+esc((z&&z.name)||'Alan')+'</h2><p>Bildirim o anda görevli olan kişiye gönderilecek.</p></div>'+
  '<form id="warningForm"><div class="warning-person-card"><label>Gönderilecek kişi</label><b>'+esc(person.name)+'</b><small>'+esc(taskLabel)+(task&&task.time?' · '+task.time.slice(0,5):'')+'</small></div>'+
  '<div class="field"><label>Mesaj</label><textarea name="message" placeholder="İsterseniz kısa açıklama ekleyin...">'+esc(defaultText)+'</textarea></div>'+
  '<div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Bildirimi Gönder</button></div></form></div>');

 $('#warningForm').onsubmit=async function(e){
  e.preventDefault();var fd=new FormData(e.target),msg=(fd.get('message')||defaultText).trim();
  var row={staff_id:person.id,zone_id:zoneId||null,task_type:type||null,work_date:workDate||dateKeyLocal(targetDate),title:'Temizlik yapılmadı',message:msg,severity:'warning',status:'sent'};
  var r=await db.from('emigro_cleaning_notifications').insert(row);if(r.error)return toast(r.error.message);
  closeModal();toast(person.name+' kişisine bildirim gönderildi');loadAll()
 };
 var box=$('#modal .modal-box');if(box)box.classList.add('zone-sheet');
};
window.openGeneralWarning=function(){
 var opts=state.staff.filter(function(p){return p.active}).map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join('');
 var zopts='<option value="">Genel / alan yok</option>'+manualZones().map(function(z){return '<option value="'+z.id+'">'+esc(z.name)+'</option>'}).join('');
 openModal('<h2>Yeni Bildirim</h2><form id="generalWarningForm"><div class="form-grid">'+
 '<div class="field"><label>Kişi</label><select name="staff_id" required>'+opts+'</select></div>'+
 '<div class="field"><label>Alan</label><select name="zone_id">'+zopts+'</select></div>'+
 '<div class="field"><label>Tür</label><select name="severity"><option value="warning">Uyarı</option><option value="urgent">Acil</option><option value="info">Bilgilendirme</option></select></div>'+
 '<div class="field"><label>Başlık</label><select name="title"><option>Buna dikkat et</option><option>Temizlik yapılmadı</option><option>Temizlik kontrolü</option><option>Tekrar temizlenmeli</option></select></div>'+
 '<div class="field full"><label>Mesaj</label><textarea name="message" required placeholder="Personele iletilecek uyarıyı yazın..."></textarea></div>'+
 '</div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Gönder</button></div></form>');
 $('#generalWarningForm').onsubmit=async function(e){
  e.preventDefault();var fd=new FormData(e.target),row={staff_id:+fd.get('staff_id'),zone_id:fd.get('zone_id')?+fd.get('zone_id'):null,title:fd.get('title'),message:fd.get('message'),severity:fd.get('severity'),status:'sent'};
  var r=await db.from('emigro_cleaning_notifications').insert(row);if(r.error)return toast(r.error.message);closeModal();toast('Bildirim kaydedildi');loadAll()
 }
};

function renderWorkerNotifications(){
 var box=$('#workerNotificationList');if(!box)return;
 if(state.isAdmin){box.innerHTML='';return}
 var list=state.notifications.filter(function(n){return String(n.staff_id)===String(state.workerStaffId)});
 var openCount=list.filter(function(n){return n.status!=='resolved'}).length;
 var badge=$('#workerAlertBadge');
 if(badge){if(openCount){badge.classList.remove('hidden');badge.textContent=openCount}else badge.classList.add('hidden')}
 box.innerHTML=list.length?list.map(function(n){
   var z=zoneById(n.zone_id),sev=n.severity==='urgent'?'urgent':n.severity==='info'?'info':'warning';
   return '<article class="notification-card worker-message '+sev+'">'+
    '<div class="notification-icon">'+(sev==='urgent'?'!':sev==='info'?'i':'🔔')+'</div>'+
    '<div><div class="notification-title"><b>'+esc(n.title||'Yönetim bildirimi')+'</b><span>'+new Date(n.created_at).toLocaleString('tr-TR')+'</span></div>'+
    '<p>'+esc(n.message||'')+'</p>'+
    '<div class="notification-meta">'+(z?'📍 '+esc(z.name):'Yönetim')+(n.work_date?' · '+n.work_date:'')+'</div></div>'+
   '</article>'
 }).join(''):'<div class="worker-empty-message"><span>🔔</span><b>Yeni bildirimin yok</b><p>Yönetimden gelen mesajlar burada görünecek.</p></div>'
}

function renderNotifications(){
 if(!$('#notificationList'))return;
 var list=state.notifications.slice();
 if(state.warningFilter==='open')list=list.filter(function(n){return n.status!=='resolved'});
 var openCount=state.notifications.filter(function(n){return n.status!=='resolved'}).length;
 ['#warningBadge','#warningBadge2'].forEach(function(sel){
   var b=$(sel);if(!b)return;
   if(openCount){b.classList.remove('hidden');b.textContent=openCount}else b.classList.add('hidden');
 });
 $('#notificationList').innerHTML=list.length?list.map(function(n){
  var p=staffById(n.staff_id),z=zoneById(n.zone_id),sev=n.severity==='urgent'?'urgent':n.severity==='info'?'info':'warning';
  return '<article class="notification-card '+sev+'"><div class="notification-icon">'+(sev==='urgent'?'!':sev==='info'?'i':'⚠')+'</div><div><div class="notification-title"><b>'+esc(n.title)+'</b><span>'+new Date(n.created_at).toLocaleString('tr-TR')+'</span></div><p>'+esc(n.message)+'</p><div class="notification-meta">👤 '+esc((p&&p.name)||'—')+(z?' · 📍 '+esc(z.name):'')+(n.work_date?' · '+n.work_date:'')+'</div></div><div class="notification-actions">'+(n.status!=='resolved'?'<button onclick="resolveWarning('+n.id+')">Çözüldü</button>':'<span class="status done">Çözüldü</span>')+'</div></article>'
 }).join(''):'<div class="sub">Bu filtrede bildirim yok.</div>'
}
window.resolveWarning=async function(id){var r=await db.from('emigro_cleaning_notifications').update({status:'resolved'}).eq('id',id);if(r.error)return toast(r.error.message);loadAll()};

if($('#newWarningBtn'))$('#newWarningBtn').onclick=openGeneralWarning;
$$('.warning-filter').forEach(function(b){b.onclick=function(){$$('.warning-filter').forEach(function(x){x.classList.toggle('active',x===b)});state.warningFilter=b.dataset.warningFilter;renderNotifications()}});


function renderWorkerDemoLaunchers(){
 var box=$('#workerDemoGrid');if(!box)return;
 box.innerHTML='<button class="worker-demo-card worker-portal-launch" onclick="openWorkerView()">'+
  '<span class="worker-demo-icon">👥</span>'+
  '<span><b>Çalışan Portalını Aç</b><small>Kasa · Raf · Sebze Meyve · Genel Temizlik · Depo</small></span>'+
  '<em>›</em></button>'
}
function taskAssignedToWorkerFor(t,id){var w=t.assigned||t.primary;return !!w&&String(w.id)===String(id)}

window.openAssignTaskToStaff=function(staffId){
 if(!state.isAdmin)return toast('Görev atama yetkisi sadece adminde');
 var person=staffById(staffId);if(!person)return;
 var zones=manualZones().filter(function(z){return z.active!==false});
 if(!zones.length)return toast('Önce Plan ekranından bir alan tanımlayın');

 var zoneOpts=zones.map(function(z){return '<option value="'+z.id+'">'+esc(z.name)+'</option>'}).join('');
 openModal('<div class="zone-app-card assign-task-sheet">'+
  '<div class="app-head"><span class="eyebrow">GÖREV ATA</span><h2>'+esc(person.name)+'</h2><p>'+esc(person.department||person.role||'Personel')+' için yeni temizlik görevi oluştur.</p></div>'+
  '<form id="assignTaskForm"><div class="form-grid">'+
   '<div class="field full"><label>Alan</label><select name="zone_id" id="assignZone" required>'+zoneOpts+'</select></div>'+
   '<div class="field"><label>Görev türü</label><select name="task_type" id="assignTaskType"><option value="daily">Günlük</option><option value="weekly">Haftalık</option><option value="monthly">Aylık</option></select></div>'+
   '<div class="field"><label>Saat</label><input type="time" name="time" value="09:00" required></div>'+
   '<div class="field full"><label id="assignDaysLabel">Günler</label><div id="assignDaysBox" class="checks assign-days-box"></div></div>'+
   '<div class="field full"><label>Görev açıklaması</label><textarea name="task_text" required placeholder="Örn. Kasap tezgâhını ve zeminini temizle"></textarea></div>'+
   '<div class="field full"><label>Sabit görevler</label><textarea name="tags" placeholder="Her satıra bir görev yazın.&#10;Örn. Tezgâhı temizle&#10;Yerleri paspasla"></textarea><div class="field-help">Bu maddeler çalışan ekranında her görevde checkbox olarak görünür.</div></div>'+
  '</div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Görevi Ata</button></div></form></div>');

 var form=$('#assignTaskForm'),typeSel=$('#assignTaskType'),daysBox=$('#assignDaysBox'),daysLabel=$('#assignDaysLabel');

 function renderAssignDays(){
   var type=typeSel.value;
   if(type==='monthly'){
     daysLabel.textContent='Ayın günleri';
     daysBox.innerHTML=monthDayChecks([1]);
   }else{
     daysLabel.textContent=type==='daily'?'Haftanın günleri':'Haftalık yapılacak gün';
     daysBox.innerHTML=weekdayChecks('assign_days',type==='daily'?[0,1,2,3,4,5,6]:[1]);
   }
 }
 typeSel.onchange=renderAssignDays;
 renderAssignDays();

 form.onsubmit=async function(e){
   e.preventDefault();
   var fd=new FormData(form),zoneId=Number(fd.get('zone_id')),type=fd.get('task_type'),time=fd.get('time')||null;
   var taskText=(fd.get('task_text')||'').trim();
   if(!taskText)return toast('Görev açıklamasını yaz');

   var days=type==='monthly'
     ? [...form.querySelectorAll('input[name="monthly_days"]:checked')].map(function(x){return Number(x.value)})
     : [...form.querySelectorAll('input[name="assign_days"]:checked')].map(function(x){return Number(x.value)});
   if(!days.length)return toast('En az bir gün seç');

   var c=cardByZone(zoneId)||{};
   var row={zone_id:zoneId,updated_at:new Date().toISOString()};
   row[type+'_enabled']=true;
   row[type+'_days']=days;
   row[type+'_time']=time;
   row[type+'_task']=taskText;
   row[type+'_primary_staff_id']=staffId;
   row[type+'_backup_staff_id']=null;
   row[type+'_backup_days']=[];
   if(type==='daily'){
     row.primary_staff_id=staffId;
     row.backup_staff_id=null;
     row.backup_enabled=false;
     row.backup_days=[];
   }

   var q=cardByZone(zoneId)
     ? db.from('emigro_cleaning_zone_cards').update(row).eq('zone_id',zoneId)
     : db.from('emigro_cleaning_zone_cards').insert(row);
   var r=await q;if(r.error)return toast(r.error.message);

   var del=await db.from('emigro_cleaning_task_tags').delete().eq('zone_id',zoneId).eq('task_type',type);
   if(del.error)return toast(del.error.message);
   var labels=String(fd.get('tags')||'').split(/\n+/).map(function(x){return x.trim()}).filter(Boolean);
   if(labels.length){
     var ins=await db.from('emigro_cleaning_task_tags').insert(labels.map(function(label,i){
       return {zone_id:zoneId,task_type:type,label:label,active:true,sort_order:i}
     }));
     if(ins.error)return toast(ins.error.message)
   }

   closeModal();
   toast(person.name+' kişisine '+typeNames[type].toLowerCase()+' görev atandı');
   await loadAll();
   var staffNav=document.querySelector('.nav[data-view="staff"]');if(staffNav)staffNav.click();
 }
 var box=$('#modal .modal-box');if(box)box.classList.add('zone-sheet','assign-task-modal');
};

function renderStaff(){
 if(!$('#staffGrid'))return;
 $('#staffGrid').innerHTML=state.staff.length?state.staff.map(function(p){
  var st=staffStats(p.id),lines=staffResponsibilityLines(p.id);
  return '<article class="staff-card staff-responsibility-card" onclick="openPerson('+p.id+')"><div class="staff-card-top"><div><h3>'+esc(p.name)+'</h3><div class="desc">'+esc(p.role||'Rol belirtilmedi')+'</div></div><span class="pill">'+(p.active?'Aktif':'Pasif')+'</span></div>'+
   '<div class="staff-metrics"><div><b>'+st.assigned+'</b><span>Bu ay görev</span></div><div><b>'+st.done+'</b><span>Yaptı</span></div><div><b>'+st.missed+'</b><span>Aksadı</span></div></div>'+
   '<div class="staff-auto-assignments">'+(lines.length?lines.slice(0,6).map(function(x){return '<div><b>'+esc(x.zone.name)+'</b><span>'+typeNames[x.type]+' · '+x.role+' · '+(x.type==='monthly'?fmtMonthDays(x.days):fmtDays(x.days))+'</span></div>'}).join(''):'<div class="sub">Tanımlı görev alanı yok.</div>')+(lines.length>6?'<small>+'+(lines.length-6)+' görev daha</small>':'')+'</div>'+
   '<div class="card-actions staff-actions"><button class="assign-task-btn" onclick="event.stopPropagation();openAssignTaskToStaff('+p.id+')">+ Görev Ata</button><button onclick="event.stopPropagation();editStaff('+p.id+')">Düzenle</button><button onclick="event.stopPropagation();openWorkerView('+p.id+')">Kullanıcı Ekranı</button></div></article>'
 }).join(''):'<div class="sub">Personel eklenmedi.</div>'
}

window.openWorkerView=function(id){
 var url=location.pathname+'?mode=worker'+(id?'&staff='+id:'');
 window.open(url,'_blank');
};

state.calendarType='daily';

function renderCalendar(){
 if(!$('#calendarList'))return;
 var input=$('#calendarDate');if(!input.value)input.value=dateKeyLocal(new Date());
 var d=parseDateLocal(input.value),type=state.calendarType,tasks=expectedTasks(dayStart(d),dayEnd(d)).filter(function(t){return t.type===type});
 if(!state.isAdmin)tasks=tasks.filter(taskAssignedToWorker);
 $('#calendarList').innerHTML=tasks.length?tasks.map(function(t){
   var st=statusFor(t),who=t.assigned||t.primary;
   return '<article class="calendar-card '+st.key+'" onclick="openZoneStatus('+t.zone.id+')"><div><span class="calendar-type-label">'+typeNames[t.type]+'</span><h3>'+esc(t.zone.name)+'</h3><p>'+esc(t.taskText||'Görev açıklaması yok')+'</p>'+(t.tags&&t.tags.length?'<div class="task-tag-list">'+t.tags.map(function(x){return '<span>'+esc(x.label)+'</span>'}).join('')+'</div>':'')+'</div><div class="calendar-assignee"><label>Görevli</label><b>'+esc((who&&who.name)||'—')+'</b><small>'+(t.backupActive?'Yedek aktif':'Asıl aktif')+'</small></div><div><b class="calendar-time">'+(t.time?t.time.slice(0,5):'—')+'</b><span class="status '+st.key+'">'+st.label+'</span></div></article>'
 }).join(''):'<div class="calendar-empty">Bu gün için '+typeNames[type].toLowerCase()+' görev ve personel ataması yok.</div>'
}

function staffResponsibilityLines(personId){
 var lines=[];
 manualZones().forEach(function(z){
   var c=cardByZone(z.id)||{};
   ['daily','weekly','monthly'].forEach(function(type){
     var primaryId=c[type+'_primary_staff_id']||(type==='daily'?c.primary_staff_id:null);
     var backupId=c[type+'_backup_staff_id']||(type==='daily'?c.backup_staff_id:null);
     var backupDays=c[type+'_backup_days']||[];
     if(type==='daily'&&!backupDays.length)backupDays=c.backup_days||[];
     if(String(primaryId||'')===String(personId)){
       var baseDays=type==='daily'?(c.daily_days||[]):type==='weekly'?(c.weekly_days||[]):(c.monthly_days||[]);
       var days=baseDays.filter(function(x){return !backupDays.includes(x)});
       if(days.length)lines.push({zone:z,type:type,role:'Asıl',days:days})
     }
     if(String(backupId||'')===String(personId)&&backupDays.length)lines.push({zone:z,type:type,role:'Yedek',days:backupDays})
   })
 });
 return lines
}

function openManagementView(view){
  ['report','notifications','history'].forEach(function(v){
    var el=$('#view-'+v);if(el)el.classList.toggle('active',v===view);
  });
  $$('.nav').forEach(function(n){n.classList.toggle('active',n.dataset.view==='report')});
  var meta={
    report:['Yönetim','Raporlar, uyarılar ve geçmiş kayıtları.'],
    notifications:['Uyarılar','Gönderilen uyarılar ve açık bildirimler.'],
    history:['Geçmiş','Tamamlanan ve yapılmayan temizlik kayıtları.']
  }[view];
  if(meta){$('#pageTitle').textContent=meta[0];$('#pageSub').textContent=meta[1]}
}
function workerTasksToday(){
 if(state.isAdmin||!state.workerStaffId)return [];
 var n=new Date();return expectedTasks(dayStart(n),dayEnd(n)).filter(taskAssignedToWorker)
}
function emitWorkerNotice(title,body,key){
 try{
  var k='emigro-notice-'+key;if(localStorage.getItem(k))return;
  localStorage.setItem(k,new Date().toISOString());
  toast(title+' · '+body);
  if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body:body})
 }catch(e){}
}
function checkWorkerReminders(){
 var now=new Date();
 workerTasksToday().forEach(function(t){
   if(statusFor(t).key==='done')return;
   var due=dueAt(t),diff=due-now,late=now-due;
   if(diff>=0&&diff<=15*60*1000)emitWorkerNotice('15 dakika sonra görev',t.zone.name+' · '+typeNames[t.type],'pre-'+t.key);
   if(late>=2*60*60*1000)emitWorkerNotice('Görev 2 saat gecikti',t.zone.name+' hâlâ tamamlanmadı','late-'+t.key)
 })
}
window.enableWorkerNotifications=async function(){
 if(!('Notification' in window))return toast('Bu cihaz bildirimleri desteklemiyor');
 var p=await Notification.requestPermission();
 toast(p==='granted'?'Bildirimler açıldı':'Bildirim izni verilmedi')
};
function renderWorkerProfilePicker(){
 var wrap=$('#workerProfilePicker'),box=$('#workerProfileOptions');if(!wrap||!box)return;
 if(state.isAdmin){wrap.classList.add('hidden');return}
 wrap.classList.remove('hidden');
 var icons={'Kasa':'🧾','Raf':'🧹','Sebze Meyve':'🥬','Genel Temizlik':'🧽','Depo':'📦'};
 var people=state.staff.filter(function(p){return p.active}).sort(function(a,b){
   var da=a.department||'Diğer',dbb=b.department||'Diğer';
   return da.localeCompare(dbb,'tr')||a.name.localeCompare(b.name,'tr')
 });
 box.innerHTML=people.length?people.map(function(p){
   var active=String(p.id)===String(state.workerStaffId);
   var count=expectedTasks(dayStart(new Date()),dayEnd(new Date())).filter(function(t){return taskAssignedToWorkerFor(t,p.id)}).length;
   return '<button class="worker-profile-option '+(active?'active':'')+'" onclick="selectWorkerProfile('+p.id+')">'+
     '<span class="worker-profile-icon">'+(icons[p.department]||'👤')+'</span>'+
     '<span><b>'+esc(p.name)+'</b><small>'+esc(p.department||p.role||'Personel')+' · '+count+' görev</small></span>'+
   '</button>'
 }).join(''):'<div class="sub">Aktif personel yok.</div>'
}
window.selectWorkerProfile=function(id){
 state.workerStaffId=Number(id)||null;
 if(state.workerStaffId)localStorage.setItem('emigro-cleaning-worker',String(state.workerStaffId));
 renderWorkerProfilePicker();
 renderTracking();
 renderCalendar();
 renderPlan();
 renderWorkerNotifications();
 setupWorkerMode();
 var todayNav=document.querySelector('.nav[data-view="tracking"]');
 if(todayNav)todayNav.click();
};
function setupWorkerMode(){
 if(state.isAdmin){document.body.classList.remove('worker-mode');return}
 document.body.classList.add('worker-mode');
 var w=workerById();
 if(w){
   $('#pageTitle').textContent=w.name;
   $('#pageSub').textContent=(w.department||w.role||'Temizlik')+' · Bugünkü görevlerin';
 }else{
   $('#pageTitle').textContent='Çalışan Portalı';
   $('#pageSub').textContent='Yukarıdan görev profilini seç.';
 }
 var btn=$('#refreshBtn');if(btn)btn.title='Görevleri yenile';
 if($('#demoBtn'))$('#demoBtn').classList.add('hidden');
 if($('#workerNoticeBar'))$('#workerNoticeBar').classList.remove('hidden');
 checkWorkerReminders();
 if(!window.__workerReminderTimer)window.__workerReminderTimer=setInterval(checkWorkerReminders,60000)
}
function initCleaningAdmin(){
  if(!state.isAdmin){
    ['#drawBtn','.upload-btn','#demoBtn','#addStaffBtn'].forEach(function(sel){var el=$(sel);if(el)el.classList.add('hidden')});
    $$('.danger-btn').forEach(function(el){el.classList.add('hidden')});
    $$('.nav').forEach(function(el){
      var allowed=['tracking','calendar','plan','worker-notifications'];
      el.classList.toggle('hidden',!allowed.includes(el.dataset.view));
    });
    var todayNav=document.querySelector('.nav[data-view="tracking"]');
    if(todayNav)setTimeout(function(){todayNav.click()},0);
  }
  $$('.nav').forEach(function(b){
    b.onclick=function(){
      $$('.nav').forEach(function(x){x.classList.toggle('active',x===b)});
      $$('.view').forEach(function(v){v.classList.toggle('active',v.id==='view-'+b.dataset.view)});
      var meta={
        report:['Admin Raporu','Yapılan, bekleyen ve aksayan temizlikleri tek ekranda görün.'],
        tracking:['Görev Takibi','Fotoğraflı tamamlanma ve aksama takibi.'],
        plan:['Temizlik Planı','Plan resmini yükle ve alanları tanımla.'],
        cards:['Alan Kartları','Günlük, haftalık ve aylık görev tanımları.'],
        staff:['Personel Kartları','Sorumluluk ve performans takibi.'],
        notifications:['Uyarılar & Bildirimler','Personele gönderilen temizlik uyarıları ve takip kayıtları.'],
        history:['Geçmiş','Tamamlanan temizlikler ve fotoğraf kanıtları.']
      }[b.dataset.view];
      if(meta){$('#pageTitle').textContent=meta[0];$('#pageSub').textContent=meta[1]}
    }
  });

  if($('#drawBtn')) $('#drawBtn').onclick=function(){state.drawMode?cancelDraw():startDraw()};
  if($('#toggleAreasBtn')) $('#toggleAreasBtn').onclick=function(){
    state.showAreas=!state.showAreas;
    $('#toggleAreasBtn').textContent=state.showAreas?'Alanları Gizle':'Alanları Göster';
    renderPlan();
  };
  if($('#addStaffBtn')) $('#addStaffBtn').onclick=function(){editStaff(null)};
  if($('#refreshBtn')) $('#refreshBtn').onclick=loadAll;
  if($('#demoBtn')) $('#demoBtn').onclick=loadDemoData;
  if($('#newWarningBtn')) $('#newWarningBtn').onclick=openGeneralWarning;
  if($('#trackingDate')) $('#trackingDate').onchange=renderTracking;
  $$('.tracking-type').forEach(function(b){
    b.onclick=function(){
      $$('.tracking-type').forEach(function(x){x.classList.toggle('active',x===b)});
      state.trackingType=b.dataset.trackingType;
      renderTracking();
    }
  });
  if($('#calendarDate')) $('#calendarDate').onchange=renderCalendar;
  $$('.calendar-type').forEach(function(b){b.onclick=function(){$$('.calendar-type').forEach(function(x){x.classList.toggle('active',x===b)});state.calendarType=b.dataset.calendarType;renderCalendar()}});
  if($('#reportType')) $('#reportType').onchange=renderReport;

  $$('.period').forEach(function(b){
    b.onclick=function(){
      $$('.period').forEach(function(x){x.classList.toggle('active',x===b)});
      state.reportPeriod=b.dataset.period;
      renderReport();
    }
  });
  $$('.warning-filter').forEach(function(b){
    b.onclick=function(){
      $$('.warning-filter').forEach(function(x){x.classList.toggle('active',x===b)});
      state.warningFilter=b.dataset.warningFilter;
      renderNotifications();
    }
  });
  $$('.manage-tab').forEach(function(b){
    b.onclick=function(){openManagementView(b.dataset.manageView)}
  });

  window.addEventListener('keydown',function(e){if(e.key==='Escape'&&state.drawMode)cancelDraw()});
  loadAll();
  var active=document.querySelector('.nav.active');
  if(active&&active.dataset.view==='tracking'){
    $('#pageTitle').textContent='Temizlik İşleri';
    $('#pageSub').textContent='Günlük, haftalık ve aylık işleri sade şekilde takip edin.';
  }
}
initCleaningAdmin();

function applyMobileClass(){
 document.body.classList.toggle('mobile-ui',window.innerWidth<=760);
}
window.addEventListener('resize',applyMobileClass);
applyMobileClass();
