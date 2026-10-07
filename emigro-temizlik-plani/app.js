const SUPABASE_URL='https://hroarfuwpfsqilsijwpp.supabase.co';
const SUPABASE_KEY='sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const state={zones:[],staff:[],cards:[],logs:[],notifications:[],settings:null,drawMode:false,drawStart:null,showAreas:true};
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
  const [z,p,c,l,n,s]=await Promise.all([
   db.from('emigro_cleaning_zones').select('*').order('sort_order'),
   db.from('emigro_cleaning_staff').select('*').order('name'),
   db.from('emigro_cleaning_zone_cards').select('*'),
   db.from('emigro_cleaning_logs').select('*').order('work_date',{ascending:false}).limit(1500),
   db.from('emigro_cleaning_notifications').select('*').order('created_at',{ascending:false}).limit(500),
   db.from('emigro_cleaning_settings').select('*').eq('id',1).single()
  ]);
  [z,p,c,l,n,s].forEach(r=>{if(r.error)throw r.error});
  state.zones=z.data||[];state.staff=p.data||[];state.cards=c.data||[];state.logs=l.data||[];state.notifications=n.data||[];state.settings=s.data||{};
  $('#dbState').textContent='● Veritabanı bağlı';
  applyPlanImage();renderAll();
 }catch(e){console.error(e);$('#dbState').textContent='● Bağlantı hatası';toast('Veritabanı bağlantı hatası')}
}

function applyPlanImage(){
 const data=state.settings?.plan_image_data;
 if(data){$('#planImg').src=data;$('#planImg').classList.remove('hidden');$('#emptyPlan').classList.add('hidden')}
 else{$('#planImg').classList.add('hidden');$('#emptyPlan').classList.remove('hidden')}
}

function renderAll(){renderReport();renderTracking();renderPlan();renderCards();renderStaff();renderNotifications();renderHistory()}
function renderPlan(){
 const zones=manualZones();$('#zoneCount').textContent=zones.length;
 const ov=$('#zoneOverlay');ov.innerHTML='';ov.style.display=state.showAreas?'block':'none';
 zones.forEach(z=>{
  const e=document.createElement('div');e.className='zone-box';e.style.cssText=`left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;--zone:${z.color||'#f47a20'}`;
  e.innerHTML=`<span class="zone-label">${esc(z.name)}</span>`;
  e.onclick=()=>openZoneStatus(z.id);
  ov.append(e)
 });
 $('#zoneMiniList').innerHTML=zones.length?zones.map(z=>{
   const card=cardByZone(z.id),p=staffById(card?.primary_staff_id),b=staffById(card?.backup_staff_id);
   return `<div class="zone-mini" onclick="openZoneStatus(${z.id})"><span class="zone-mini-dot" style="background:${z.color||'#f47a20'}"></span><div><b>${esc(z.name)}</b><small>${p?'Asıl: '+esc(p.name):'Asıl yok'}${b?' · Yedek: '+esc(b.name):''}</small></div></div>`
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
    ${c.daily_enabled&&c.daily_task?`<div class="desc">${esc(c.daily_task)}</div>`:''}
    ${scheduleLine('Haftalık',c.weekly_enabled,c.weekly_days,c.weekly_time)}
    ${c.weekly_enabled&&c.weekly_task?`<div class="desc">${esc(c.weekly_task)}</div>`:''}
    ${scheduleLine('Aylık',c.monthly_enabled,c.monthly_days,c.monthly_time,true)}
    ${c.monthly_enabled&&c.monthly_task?`<div class="desc">${esc(c.monthly_task)}</div>`:''}
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
 <div class="field full"><label>Günlük ne yapılacak?</label><textarea name="daily_task" placeholder="Örn. zemin süpür, paspas yap, raf önlerini sil...">${esc(c.daily_task||'')}</textarea></div>

 <div class="field full"><label>Haftalık</label><label class="check"><input type="checkbox" name="weekly_enabled" ${c.weekly_enabled?'checked':''}> Aktif</label><div class="checks">${weekdayChecks('weekly_days',c.weekly_days||[])}</div></div>
 <div class="field"><label>Haftalık saat</label><input type="time" name="weekly_time" value="${c.weekly_time?.slice(0,5)||''}"></div>
 <div class="field full"><label>Haftalık ne yapılacak?</label><textarea name="weekly_task" placeholder="Örn. raf altlarını temizle, köşeleri detaylı sil...">${esc(c.weekly_task||'')}</textarea></div>

 <div class="field full"><label>Aylık</label><label class="check"><input type="checkbox" name="monthly_enabled" ${c.monthly_enabled?'checked':''}> Aktif</label><div class="checks">${monthDayChecks(c.monthly_days||[])}</div></div>
 <div class="field"><label>Aylık saat</label><input type="time" name="monthly_time" value="${c.monthly_time?.slice(0,5)||''}"></div>
 <div class="field full"><label>Aylık ne yapılacak?</label><textarea name="monthly_task" placeholder="Örn. derin temizlik, duvar dipleri, dolap arkaları...">${esc(c.monthly_task||'')}</textarea></div>
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
   daily_task:fd.get('daily_task')||'',
   weekly_task:fd.get('weekly_task')||'',
   monthly_task:fd.get('monthly_task')||'',
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


async function loadDemoData(){
 if(!confirm('Demo verileri yüklensin mi? Mevcut manuel alanlar korunur, demo alanları eklenir/güncellenir.'))return;
 const people=[
  {name:'Ayşe Demir',role:'Temizlik',phone:'0611111111',active:true},
  {name:'Mehmet Kaya',role:'Temizlik',phone:'0622222222',active:true},
  {name:'Fatma Yılmaz',role:'Temizlik',phone:'0633333333',active:true},
  {name:'Ali Can',role:'Yedek',phone:'0644444444',active:true}
 ];
 const staffIds={};
 for(const p of people){
   const existing=state.staff.find(x=>x.name===p.name);
   if(existing){await db.from('emigro_cleaning_staff').update(p).eq('id',existing.id);staffIds[p.name]=existing.id}
   else{const {data,error}=await db.from('emigro_cleaning_staff').insert(p).select().single();if(error)return toast(error.message);staffIds[p.name]=data.id}
 }
 const zones=[
  {code:'DEMO-GIRIS',name:'Giriş',description:'Giriş zemini, kapı önü ve cam çevresi.',color:'#8de4a6',x:6,y:75,w:14,h:12,sort_order:101},
  {code:'DEMO-KASA',name:'Kasa Alanı',description:'Kasa çevresi, bant önü ve müşteri temas alanları.',color:'#ffab68',x:22,y:68,w:18,h:10,sort_order:102},
  {code:'DEMO-SEBZE',name:'Sebze Reyonu',description:'Sebze standı, zemin ve dökülen ürün kalıntıları.',color:'#ade37f',x:43,y:43,w:20,h:18,sort_order:103},
  {code:'DEMO-KASAP',name:'Kasap Alanı',description:'Kasap önü, zemin ve yakın temas yüzeyleri.',color:'#f78e92',x:42,y:18,w:22,h:17,sort_order:104},
  {code:'DEMO-DIPFRIZ',name:'Dipfriz Alanı',description:'Dipfriz dış yüzeyleri, kapak çevresi ve zemin.',color:'#6fbce6',x:67,y:28,w:18,h:18,sort_order:105},
  {code:'DEMO-RAFLAR',name:'Orta Raflar',description:'Raf önleri, koridor zemini ve raf altları.',color:'#f4d98e',x:56,y:48,w:26,h:25,sort_order:106},
  {code:'DEMO-NONFOOD',name:'Nonfood',description:'Nonfood koridorları ve raf çevresi.',color:'#cbb9eb',x:8,y:30,w:20,h:25,sort_order:107},
  {code:'DEMO-MUTFAK',name:'Mutfak',description:'Mutfak tezgah, lavabo, zemin ve çöp alanı.',color:'#ffb29a',x:7,y:7,w:20,h:15,sort_order:108},
  {code:'DEMO-TUVALET',name:'Tuvalet',description:'Tam hijyen temizliği ve sarf kontrolü.',color:'#d8c8ef',x:28,y:7,w:10,h:12,sort_order:109},
  {code:'DEMO-DEPO',name:'Depo',description:'Depo zemini, palet çevresi ve geçiş yolları.',color:'#d3bda3',x:70,y:6,w:24,h:18,sort_order:110}
 ];
 const zoneIds={};
 for(const z of zones){
   const existing=state.zones.find(x=>x.code===z.code);
   const row={...z,manual:true,active:true,shape:'rect'};
   if(existing){await db.from('emigro_cleaning_zones').update(row).eq('id',existing.id);zoneIds[z.code]=existing.id}
   else{const {data,error}=await db.from('emigro_cleaning_zones').insert(row).select().single();if(error)return toast(error.message);zoneIds[z.code]=data.id}
 }
 const cards=[
  ['DEMO-GIRIS','Ayşe Demir','Ali Can',true,[1,2,3,4,5,6,0],'07:30','Kapı önü, paspas, cam altları ve giriş zemini.',true,[1,4],'13:00','Kapı camları ve köşe temizliği.',true,[1],'08:00','Derin zemin temizliği ve duvar dipleri.'],
  ['DEMO-KASA','Mehmet Kaya','Fatma Yılmaz',true,[1,2,3,4,5,6,0],'08:00','Kasa önü, bant çevresi ve zemin.',true,[2,5],'15:00','Kasa altları ve kablo çevresi.',true,[1,15],'09:00','Detaylı kasa ve çevre temizliği.'],
  ['DEMO-SEBZE','Fatma Yılmaz','Ayşe Demir',true,[1,2,3,4,5,6,0],'09:00','Zemin, dökülen ürünler ve stand önleri.',true,[3,6],'16:00','Stand altları ve köşeler.',true,[5,20],'08:30','Derin stand ve kasa altı temizliği.'],
  ['DEMO-KASAP','Ayşe Demir','Mehmet Kaya',true,[1,2,3,4,5,6,0],'10:00','Kasap önü zemini ve temas yüzeyleri.',true,[2,5],'17:00','Detaylı yüzey ve zemin temizliği.',true,[10,25],'07:00','Derin temizlik ve kenar/köşe işlemleri.'],
  ['DEMO-DIPFRIZ','Mehmet Kaya','Ali Can',true,[1,2,3,4,5,6,0],'11:00','Kapak çevresi, dış yüzey ve zemin.',true,[4],'14:00','Alt/yan bölgeler ve detay silme.',true,[12],'08:00','Derin dış temizlik ve çevre kontrolü.'],
  ['DEMO-RAFLAR','Fatma Yılmaz','Ali Can',true,[1,2,3,4,5,6,0],'12:00','Koridor zemini ve görünür raf önleri.',true,[1,3,5],'16:30','Raf altları ve dipler.',true,[1,15,30],'07:30','Tüm raf altı, üstü ve detaylı koridor temizliği.'],
  ['DEMO-NONFOOD','Ali Can','Ayşe Demir',true,[1,2,3,4,5,6],'13:00','Zemin ve raf önü temizliği.',true,[2,6],'15:30','Raf altları ve köşeler.',true,[8,22],'09:00','Derin temizlik ve duvar dipleri.'],
  ['DEMO-MUTFAK','Ayşe Demir','Fatma Yılmaz',true,[1,2,3,4,5,6,0],'14:00','Tezgah, lavabo, zemin ve çöp.',true,[1,4],'18:00','Dolap önleri, cihaz çevresi.',true,[1,16],'08:00','Derin mutfak temizliği.'],
  ['DEMO-TUVALET','Fatma Yılmaz','Ali Can',true,[1,2,3,4,5,6,0],'08:30','Klozet, lavabo, zemin ve sarf kontrolü.',true,[1,3,5],'14:30','Duvar ve temas noktaları.',true,[1,15],'07:30','Derin hijyen temizliği.'],
  ['DEMO-DEPO','Mehmet Kaya','Ali Can',true,[1,2,3,4,5],'15:00','Geçiş yolları ve zemin.',true,[5],'17:30','Palet altları ve duvar dipleri.',true,[1,20],'08:00','Derin depo temizliği.']
 ];
 for(const c of cards){
   const [code,prim,backup,de,dd,dt,dtext,we,wd,wt,wtext,me,md,mt,mtext]=c;
   const row={zone_id:zoneIds[code],primary_staff_id:staffIds[prim],backup_staff_id:staffIds[backup],daily_enabled:de,daily_days:dd,daily_time:dt,weekly_enabled:we,weekly_days:wd,weekly_time:wt,monthly_enabled:me,monthly_days:md,monthly_time:mt,daily_task:dtext,weekly_task:wtext,monthly_task:mtext,updated_at:new Date().toISOString()};
   const {error}=await db.from('emigro_cleaning_zone_cards').upsert(row,{onConflict:'zone_id'});if(error)return toast(error.message)
 }
 toast('Demo verileri yüklendi');await loadAll();document.querySelector('[data-view="cards"]').click();
}

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
$('#addStaffBtn').onclick=()=>editStaff(null);$('#refreshBtn').onclick=loadAll;$('#demoBtn').onclick=loadDemoData;
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.drawMode)cancelDraw()});
loadAll();
state.reportPeriod='today';
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
 return {key:zone.id+':'+type+':'+dateKeyLocal(d),zone:zone,card:card,type:type,date:new Date(d),time:card[type+'_time']||null,primary:staffById(card.primary_staff_id),backup:staffById(card.backup_staff_id),taskText:card[type+'_task']||''}
}
function expectedTasks(from,to){
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
 var st=statusFor(t),l=st.log,who=l?staffById(l.staff_id):t.primary;
 var proof=l&&l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+t.key+'\')">':'';
 var action=st.key!=='done'?'<button onclick="openComplete(\''+t.key+'\')">Yaptım + Foto</button>':'<button onclick="showPhoto(\''+t.key+'\')">Kanıt</button>';
 return '<article class="report-row '+st.key+'"><div><h3>'+esc(t.zone.name)+' · '+typeNames[t.type]+'</h3><div class="sub">'+esc(t.taskText||'Görev açıklaması yok')+'</div></div><div><span class="pill">'+shortDate(t.date)+' · '+(t.time?t.time.slice(0,5):'Saat yok')+'</span></div><div><span class="pill">👤 '+esc((who&&who.name)||'Atanmamış')+'</span></div><div><span class="status '+st.key+'">'+st.label+'</span></div><div class="row-actions">'+proof+action+'</div></article>'
}
function renderReport(){
 if(!$('#reportList'))return;
 var now=new Date(),today=expectedTasks(dayStart(now),dayEnd(now)),done=today.filter(function(t){return statusFor(t).key==='done'}).length,over=today.filter(function(t){return statusFor(t).key==='overdue'}).length;
 $('#mToday').textContent=today.length;$('#mDone').textContent=done;$('#mOverdue').textContent=over;$('#mStaff').textContent=state.staff.filter(function(p){return p.active}).length;
 var missed=expectedTasks(monthStart(now),now).filter(function(t){return statusFor(t).key==='overdue'}),ap=$('#alertPanel'),badge=$('#alertBadge');
 if(missed.length){ap.classList.remove('hidden');ap.innerHTML='<h3>⚠ '+missed.length+' aksayan temizlik var</h3><p>'+missed.slice(0,5).map(function(t){return esc(t.zone.name)+' · '+typeNames[t.type]+' · '+shortDate(t.date)}).join(' • ')+(missed.length>5?' • +'+(missed.length-5)+' daha':'')+'</p>';badge.classList.remove('hidden');badge.textContent=missed.length}else{ap.classList.add('hidden');badge.classList.add('hidden')}
 var rg=periodRange(),all=expectedTasks(rg[0],rg[1]),filter=$('#reportType').value||'',tasks=filter?all.filter(function(t){return t.type===filter}):all;
 ['daily','weekly','monthly'].forEach(function(tp){var list=all.filter(function(t){return t.type===tp}),d=list.filter(function(t){return statusFor(t).key==='done'}).length,id='#r'+tp.charAt(0).toUpperCase()+tp.slice(1);$(id).textContent=d+' / '+list.length});
 $('#reportList').innerHTML=tasks.length?tasks.map(reportRowHtml).join(''):'<div class="sub">Bu dönem için görev yok.</div>'
}
function renderTracking(){
 if(!$('#trackingList'))return;
 var inp=$('#trackingDate');if(!inp.value)inp.value=dateKeyLocal(new Date());
 var d=parseDateLocal(inp.value),tasks=expectedTasks(dayStart(d),dayEnd(d));
 $('#trackingList').innerHTML=tasks.length?tasks.map(function(t){
  var st=statusFor(t),l=st.log,proof=l&&l.proof_image_data?'<img class="proof-thumb" src="'+l.proof_image_data+'" onclick="showPhoto(\''+t.key+'\')">':'';
  var act=st.key!=='done'?'<button onclick="openComplete(\''+t.key+'\')">Yaptım + Foto</button><button onclick="markSkipped(\''+t.key+'\')">Yapılmadı</button>':'<button onclick="showPhoto(\''+t.key+'\')">Fotoğraf</button>';
  return '<article class="report-row '+st.key+'"><div><h3>'+esc(t.zone.name)+' · '+typeNames[t.type]+'</h3><div class="sub">'+esc(t.taskText||'Görev açıklaması yok')+'</div></div><div><span class="pill">'+(t.time?t.time.slice(0,5):'Saat yok')+'</span></div><div><span class="pill">Asıl: '+esc((t.primary&&t.primary.name)||'—')+'<br>Yedek: '+esc((t.backup&&t.backup.name)||'—')+'</span></div><div><span class="status '+st.key+'">'+st.label+'</span></div><div class="row-actions">'+proof+act+'</div></article>'
 }).join(''):'<div class="sub">Seçili tarihte görev yok.</div>'
}
function taskByKey(key){
 var p=key.split(':'),z=zoneById(Number(p[0])),c=cardByZone(Number(p[0]));return z&&c?makeTask(z,c,p[1],parseDateLocal(p[2])):null
}
window.openComplete=function(key){
 var t=taskByKey(key);if(!t)return;
 var choices=[t.primary,t.backup].filter(Boolean).filter(function(p,i,a){return a.findIndex(function(x){return x.id===p.id})===i});
 if(!choices.length)choices=state.staff.filter(function(p){return p.active});
 var opts=choices.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join('');
 openModal('<h2>Temizlik Tamamlandı</h2><form id="completeForm"><div class="form-grid"><div class="field full"><label>Alan / görev</label><div><b>'+esc(t.zone.name)+' · '+typeNames[t.type]+'</b><div class="sub">'+esc(t.taskText)+'</div></div></div><div class="field"><label>Yapan kişi</label><select name="staff_id" required>'+opts+'</select></div><div class="field"><label>Planlanan saat</label><input value="'+(t.time?t.time.slice(0,5):'—')+'" disabled></div><div class="field full"><label>Fotoğraf kanıtı</label><div class="proof-upload">Temizlik sonrası fotoğraf yükleyin.<br><input id="proofFile" type="file" accept="image/*" capture="environment" required></div></div><div class="field full"><label>Not</label><textarea name="note" placeholder="Varsa açıklama..."></textarea></div></div><div class="form-actions"><button type="button" class="ghost" onclick="closeModal()">İptal</button><button class="primary">Yaptım Olarak Kaydet</button></div></form>');
 $('#completeForm').onsubmit=async function(e){
  e.preventDefault();var fd=new FormData(e.target),file=$('#proofFile').files&&$('#proofFile').files[0];if(!file)return toast('Fotoğraf yüklemek zorunlu');
  var proof=await compressProof(file),row={slot_key:t.key,schedule_id:null,zone_id:t.zone.id,staff_id:+fd.get('staff_id'),work_date:dateKeyLocal(t.date),status:'done',completed_at:new Date().toISOString(),note:fd.get('note')||'',task_type:t.type,planned_time:t.time,proof_image_data:proof};
  var res=await db.from('emigro_cleaning_logs').upsert(row,{onConflict:'slot_key'});if(res.error)return toast(res.error.message);closeModal();toast('Fotoğraflı tamamlanma kaydedildi');loadAll()
 }
};
window.markSkipped=async function(key){
 var t=taskByKey(key);if(!t)return;var note=prompt('Yapılmama nedeni:','');if(note===null)return;
 var row={slot_key:t.key,schedule_id:null,zone_id:t.zone.id,staff_id:t.card.primary_staff_id||null,work_date:dateKeyLocal(t.date),status:'skipped',completed_at:null,note:note,task_type:t.type,planned_time:t.time,proof_image_data:null};
 var r=await db.from('emigro_cleaning_logs').upsert(row,{onConflict:'slot_key'});if(r.error)return toast(r.error.message);loadAll()
};
window.showPhoto=function(key){var l=state.logs.find(function(x){return x.slot_key===key});if(!l||!l.proof_image_data)return toast('Fotoğraf yok');$('#photoView').src=l.proof_image_data;$('#photoModal').classList.remove('hidden')};
function compressProof(file){
 return new Promise(function(resolve,reject){var img=new Image(),url=URL.createObjectURL(file);img.onload=function(){var max=1200,sc=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*sc),h=Math.round(img.height*sc),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.76))};img.onerror=reject;img.src=url})
}

function staffStats(id){
 var now=new Date(),tasks=expectedTasks(monthStart(now),now),primary=tasks.filter(function(t){return String(t.card.primary_staff_id)===String(id)}),done=state.logs.filter(function(l){return l.status==='done'&&String(l.staff_id)===String(id)&&l.work_date>=dateKeyLocal(monthStart(now))&&l.work_date<=dateKeyLocal(now)}).length,miss=primary.filter(function(t){return statusFor(t).key==='overdue'}).length;
 return {assigned:primary.length,done:done,missed:miss}
}
function renderStaff(){
 if(!$('#staffGrid'))return;
 $('#staffGrid').innerHTML=state.staff.length?state.staff.map(function(p){
  var st=staffStats(p.id),primary=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).primary_staff_id)===String(p.id)}),backup=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).backup_staff_id)===String(p.id)});
  return '<article class="staff-card" onclick="openPerson('+p.id+')"><div class="staff-card-top"><div><h3>'+esc(p.name)+'</h3><div class="desc">'+esc(p.role||'Rol belirtilmedi')+'</div></div><span class="pill">'+(p.active?'Aktif':'Pasif')+'</span></div><div class="staff-metrics"><div><b>'+st.assigned+'</b><span>Bu ay görev</span></div><div><b>'+st.done+'</b><span>Yaptı</span></div><div><b>'+st.missed+'</b><span>Aksadı</span></div></div><div class="responsibility">'+primary.map(function(z){return '<span>Asıl · '+esc(z.name)+'</span>'}).join('')+backup.map(function(z){return '<span>Yedek · '+esc(z.name)+'</span>'}).join('')+'</div><div class="card-actions"><button onclick="event.stopPropagation();editStaff('+p.id+')">Düzenle</button></div></article>'
 }).join(''):'<div class="sub">Personel eklenmedi.</div>'
}
window.openPerson=function(id){
 var p=staffById(id);if(!p)return;var now=new Date(),all=expectedTasks(monthStart(now),now),primary=all.filter(function(t){return String(t.card.primary_staff_id)===String(id)}),activity=state.logs.filter(function(l){return String(l.staff_id)===String(id)&&l.slot_key&&l.work_date>=dateKeyLocal(monthStart(now))}).sort(function(a,b){return b.work_date.localeCompare(a.work_date)}),pz=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).primary_staff_id)===String(id)}),bz=manualZones().filter(function(z){return String((cardByZone(z.id)||{}).backup_staff_id)===String(id)}),miss=primary.filter(function(t){return statusFor(t).key==='overdue'});
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
 var meta={report:['Admin Raporu','Yapılan, bekleyen ve aksayan temizlikleri tek ekranda görün.'],tracking:['Görev Takibi','Fotoğraflı tamamlanma ve aksama takibi.'],plan:['Temizlik Planı','Plan resmini yükle ve alanları tanımla.'],cards:['Alan Kartları','Günlük, haftalık ve aylık görev tanımları.'],staff:['Personel Kartları','Sorumluluk ve performans takibi.'],history:['Geçmiş','Tamamlanan temizlikler ve fotoğraf kanıtları.']}[b.dataset.view];
 $('#pageTitle').textContent=meta[0];$('#pageSub').textContent=meta[1]
}});
