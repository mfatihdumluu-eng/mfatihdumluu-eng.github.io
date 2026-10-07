const SUPABASE_URL='https://hroarfuwpfsqilsijwpp.supabase.co';
const SUPABASE_KEY='sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const state={zones:[],staff:[],cards:[],logs:[],settings:null,drawMode:false,drawStart:null,showAreas:true};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dayNames=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),1800)}
function openModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
window.closeModal=closeModal;$('#closeModal').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};

function manualZones(){return state.zones.filter(z=>z.manual&&z.active)}
function zoneById(id){return state.zones.find(z=>String(z.id)===String(id))}
function staffById(id){return state.staff.find(p=>String(p.id)===String(id))}
function cardByZone(id){return state.cards.find(c=>String(c.zone_id)===String(id))}
function fmtDays(arr){return !arr?.length?'—':arr.map(x=>dayNames[x]).join(', ')}
function fmtMonthDays(arr){return !arr?.length?'—':arr.map(x=>x+'. gün').join(', ')}

async function loadAll(){
 try{
  $('#dbState').textContent='● Bağlanıyor';
  const [z,p,c,l,s]=await Promise.all([
   db.from('emigro_cleaning_zones').select('*').order('sort_order'),
   db.from('emigro_cleaning_staff').select('*').order('name'),
   db.from('emigro_cleaning_zone_cards').select('*'),
   db.from('emigro_cleaning_logs').select('*').order('work_date',{ascending:false}).limit(300),
   db.from('emigro_cleaning_settings').select('*').eq('id',1).single()
  ]);
  [z,p,c,l,s].forEach(r=>{if(r.error)throw r.error});
  state.zones=z.data||[];state.staff=p.data||[];state.cards=c.data||[];state.logs=l.data||[];state.settings=s.data||{};
  $('#dbState').textContent='● Veritabanı bağlı';
  applyPlanImage();renderAll();
 }catch(e){console.error(e);$('#dbState').textContent='● Bağlantı hatası';toast('Veritabanı bağlantı hatası')}
}

function applyPlanImage(){
 const data=state.settings?.plan_image_data;
 if(data){$('#planImg').src=data;$('#planImg').classList.remove('hidden');$('#emptyPlan').classList.add('hidden')}
 else{$('#planImg').classList.add('hidden');$('#emptyPlan').classList.remove('hidden')}
}

function renderAll(){renderPlan();renderCards();renderStaff();renderHistory()}
function renderPlan(){
 const zones=manualZones();$('#zoneCount').textContent=zones.length;
 const ov=$('#zoneOverlay');ov.innerHTML='';ov.style.display=state.showAreas?'block':'none';
 zones.forEach(z=>{
  const e=document.createElement('div');e.className='zone-box';e.style.cssText=`left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;--zone:${z.color||'#f47a20'}`;
  e.innerHTML=`<span class="zone-label">${esc(z.name)}</span>`;
  e.onclick=()=>openZoneCardModal(z.id);
  ov.append(e)
 });
 $('#zoneMiniList').innerHTML=zones.length?zones.map(z=>{
   const card=cardByZone(z.id),p=staffById(card?.primary_staff_id),b=staffById(card?.backup_staff_id);
   return `<div class="zone-mini" onclick="openZoneCardModal(${z.id})"><span class="zone-mini-dot" style="background:${z.color||'#f47a20'}"></span><div><b>${esc(z.name)}</b><small>${p?'Asıl: '+esc(p.name):'Asıl yok'}${b?' · Yedek: '+esc(b.name):''}</small></div></div>`
 }).join(''):'<div style="padding:12px;font-size:10px;color:#6f7d86">Henüz alan tanımlanmadı.</div>';
}

function scheduleLine(label,enabled,days,time,monthly=false){
 return `<div class="schedule-line"><strong>${label}</strong><div class="days">${enabled?(monthly?fmtMonthDays(days):fmtDays(days)):'Kapalı'}</div><div class="time">${enabled?(time?.slice(0,5)||'Saat yok'):'—'}</div></div>`
}
function renderCards(){
 const zones=manualZones();
 $('#zoneCards').innerHTML=zones.length?zones.map(z=>{
  const c=cardByZone(z.id)||{},p=staffById(c.primary_staff_id),b=staffById(c.backup_staff_id);
  return `<article class="zone-card">
   <div class="zone-card-top"><div><h3>${esc(z.name)}</h3><div class="desc">${esc(z.description||'Açıklama yok')}</div></div><span class="zone-mini-dot" style="background:${z.color||'#f47a20'}"></span></div>
   <div class="people"><div class="person-box"><label>Asıl temizleyen</label><b>${esc(p?.name||'Atanmadı')}</b></div><div class="person-box"><label>Yedek temizleyen</label><b>${esc(b?.name||'Atanmadı')}</b></div></div>
   <div class="schedule-block">
    ${scheduleLine('Günlük',c.daily_enabled,c.daily_days,c.daily_time)}
    ${scheduleLine('Haftalık',c.weekly_enabled,c.weekly_days,c.weekly_time)}
    ${scheduleLine('Aylık',c.monthly_enabled,c.monthly_days,c.monthly_time,true)}
   </div>
   <div class="card-actions"><button onclick="openZoneCardModal(${z.id})">Düzenle</button><button class="danger-btn" onclick="deleteZone(${z.id})">Sil</button></div>
  </article>`
 }).join(''):'<div style="font-size:11px;color:#6f7d86">Planda alan seçtikçe kartlar burada oluşacak.</div>';
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
function startDraw(){if(!state.settings?.plan_image_data)return toast('Önce plan resmini yükle');state.drawMode=true;state.drawStart=null;$('#drawBtn').textContent='İptal';$('#drawStatus').textContent='Mouse ile alanın çevresini çiz.'}
function cancelDraw(){state.drawMode=false;state.drawStart=null;$('#drawRect').classList.add('hidden');$('#drawBtn').textContent='+ Alan Seç';$('#drawStatus').textContent='Alan seçmek için “Alan Seç”e bas.'}
$('#planStage').addEventListener('pointerdown',e=>{
 if(!state.drawMode)return;
 e.preventDefault();state.drawStart=posPct(e);const d=$('#drawRect');d.classList.remove('hidden');d.style.left=state.drawStart.x+'%';d.style.top=state.drawStart.y+'%';d.style.width='0%';d.style.height='0%'
});
$('#planStage').addEventListener('pointermove',e=>{
 if(!state.drawMode||!state.drawStart)return;const p=posPct(e),x=Math.min(p.x,state.drawStart.x),y=Math.min(p.y,state.drawStart.y),w=Math.abs(p.x-state.drawStart.x),h=Math.abs(p.y-state.drawStart.y),d=$('#drawRect');d.style.left=x+'%';d.style.top=y+'%';d.style.width=w+'%';d.style.height=h+'%'
});
$('#planStage').addEventListener('pointerup',e=>{
 if(!state.drawMode||!state.drawStart)return;const p=posPct(e),box={x:Math.min(p.x,state.drawStart.x),y:Math.min(p.y,state.drawStart.y),w:Math.abs(p.x-state.drawStart.x),h:Math.abs(p.y-state.drawStart.y)};cancelDraw();if(box.w<1||box.h<1)return toast('Alan çok küçük');openNewZoneModal(box)
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
 <div class="field full"><label>Tanım / temizlenecekler</label><textarea name="description">${esc(z.description||'')}</textarea></div>
 <div class="field"><label>Asıl temizleyen</label><select name="primary_staff_id">${staffOptions(c.primary_staff_id)}</select></div>
 <div class="field"><label>Yedek temizleyen</label><select name="backup_staff_id">${staffOptions(c.backup_staff_id)}</select></div>

 <div class="field full"><label>Günlük</label><label class="check"><input type="checkbox" name="daily_enabled" ${c.daily_enabled?'checked':''}> Aktif</label><div class="checks">${weekdayChecks('daily_days',c.daily_days||[1,2,3,4,5,6,0])}</div></div>
 <div class="field"><label>Günlük saat</label><input type="time" name="daily_time" value="${c.daily_time?.slice(0,5)||''}"></div>

 <div class="field full"><label>Haftalık</label><label class="check"><input type="checkbox" name="weekly_enabled" ${c.weekly_enabled?'checked':''}> Aktif</label><div class="checks">${weekdayChecks('weekly_days',c.weekly_days||[])}</div></div>
 <div class="field"><label>Haftalık saat</label><input type="time" name="weekly_time" value="${c.weekly_time?.slice(0,5)||''}"></div>

 <div class="field full"><label>Aylık</label><label class="check"><input type="checkbox" name="monthly_enabled" ${c.monthly_enabled?'checked':''}> Aktif</label><div class="checks">${monthDayChecks(c.monthly_days||[])}</div></div>
 <div class="field"><label>Aylık saat</label><input type="time" name="monthly_time" value="${c.monthly_time?.slice(0,5)||''}"></div>
 </div>
 <div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`
}
function openNewZoneModal(box){
 const z={name:'',description:'',color:'#f47a20',x:+box.x.toFixed(3),y:+box.y.toFixed(3),w:+box.w.toFixed(3),h:+box.h.toFixed(3),manual:true,active:true};
 openModal(zoneCardForm(z,{}));bindZoneCardForm(z,true)
}
window.openZoneCardModal=id=>{const z=zoneById(id),c=cardByZone(id)||{};openModal(zoneCardForm(z,c));bindZoneCardForm(z,false,c)};
function bindZoneCardForm(z,isNew,c={}){
 $('#zoneCardForm').onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(e.target);let zoneId=z.id;
  const zoneRow={name:fd.get('name'),description:fd.get('description'),color:fd.get('color'),manual:true,active:true,x:z.x,y:z.y,w:z.w,h:z.h,shape:'rect',code:z.code||('MANUAL-'+Date.now())};
  if(isNew){const {data,error}=await db.from('emigro_cleaning_zones').insert(zoneRow).select().single();if(error)return toast(error.message);zoneId=data.id}
  else{const {error}=await db.from('emigro_cleaning_zones').update(zoneRow).eq('id',z.id);if(error)return toast(error.message)}
  const cardRow={
   zone_id:zoneId,
   primary_staff_id:fd.get('primary_staff_id')?+fd.get('primary_staff_id'):null,
   backup_staff_id:fd.get('backup_staff_id')?+fd.get('backup_staff_id'):null,
   daily_enabled:fd.has('daily_enabled'),daily_days:fd.getAll('daily_days').map(Number),daily_time:fd.get('daily_time')||null,
   weekly_enabled:fd.has('weekly_enabled'),weekly_days:fd.getAll('weekly_days').map(Number),weekly_time:fd.get('weekly_time')||null,
   monthly_enabled:fd.has('monthly_enabled'),monthly_days:fd.getAll('monthly_days').map(Number),monthly_time:fd.get('monthly_time')||null,
   updated_at:new Date().toISOString()
  };
  const {error}=await db.from('emigro_cleaning_zone_cards').upsert(cardRow,{onConflict:'zone_id'});if(error)return toast(error.message);
  closeModal();toast('Alan kartı kaydedildi');loadAll()
 }
}
window.deleteZone=async id=>{if(!confirm('Bu alanı ve kartını silmek istiyor musun?'))return;const {error}=await db.from('emigro_cleaning_zones').delete().eq('id',id);if(error)return toast(error.message);loadAll()};

window.editStaff=id=>{
 const p=state.staff.find(x=>x.id===id)||{};
 openModal(`<h2>${p.id?'Personeli Düzenle':'Personel Ekle'}</h2><form id="staffForm"><div class="form-grid">
 <div class="field"><label>Ad Soyad</label><input name="name" required value="${esc(p.name||'')}"></div>
 <div class="field"><label>Rol</label><input name="role" value="${esc(p.role||'')}"></div>
 <div class="field"><label>Telefon</label><input name="phone" value="${esc(p.phone||'')}"></div>
 <div class="field"><label>Durum</label><select name="active"><option value="true" ${p.active!==false?'selected':''}>Aktif</option><option value="false" ${p.active===false?'selected':''}>Pasif</option></select></div>
 </div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Kaydet</button></div></form>`);
 $('#staffForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),row={name:fd.get('name'),role:fd.get('role'),phone:fd.get('phone'),active:fd.get('active')==='true'};const q=p.id?db.from('emigro_cleaning_staff').update(row).eq('id',p.id):db.from('emigro_cleaning_staff').insert(row);const {error}=await q;if(error)return toast(error.message);closeModal();loadAll()}
};

$('#planUpload').onchange=async e=>{
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

$$('.nav').forEach(b=>b.onclick=()=>{
 $$('.nav').forEach(x=>x.classList.toggle('active',x===b));$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+b.dataset.view));
 const meta={plan:['Temizlik Planı','Plan resmini yükle, alanları kendin seç ve kartlarını oluştur.'],cards:['Alan Kartları','Her alanın sorumluları ve temizlik zamanları.'],staff:['Personel','Asıl ve yedek temizleyen kişileri yönet.'],history:['Geçmiş','Tamamlanan temizlik kayıtları.']}[b.dataset.view];
 $('#pageTitle').textContent=meta[0];$('#pageSub').textContent=meta[1]
});
$('#drawBtn').onclick=()=>state.drawMode?cancelDraw():startDraw();
$('#toggleAreasBtn').onclick=()=>{state.showAreas=!state.showAreas;$('#toggleAreasBtn').textContent=state.showAreas?'Alanları Gizle':'Alanları Göster';renderPlan()};
$('#addStaffBtn').onclick=()=>editStaff(null);$('#refreshBtn').onclick=loadAll;
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.drawMode)cancelDraw()});
loadAll();