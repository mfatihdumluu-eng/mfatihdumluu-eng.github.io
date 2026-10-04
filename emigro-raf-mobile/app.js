const DB_NAME='raf';
const DB_VERSION=2;
const ROLE_NAMES={employee:'Çalışan',warehouse:'Depo Sorumlusu',manager:'Mağaza Müdürü',superadmin:'Süper Admin'};
const STATUS={
  ok:{label:'OK',cls:'ok'},
  expiring:{label:'Tarihi yaklaşıyor',cls:'warn'},
  expired:{label:'Tarihi geçmiş',cls:'danger'},
  low:{label:'Stok az',cls:'warn'},
  missing:{label:'Rafta yok',cls:'dark'},
  damaged:{label:'Hasarlı/bozuk',cls:'danger'},
  label_missing:{label:'Raf etiketi yok',cls:'warn'},
  label_wrong:{label:'Raf etiketi yanlış',cls:'danger'}
};
let currentRole='employee';
let currentView='home';

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      const stores=['users','shelves','products','assignments','dailyChecks','issues','settings','notifications'];
      stores.forEach(s=>{if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'});});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function all(store){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(store,'readonly').objectStore(store).getAll();
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function put(store,obj){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(store,'readwrite').objectStore(store).put(obj);
    r.onsuccess=()=>resolve(obj); r.onerror=()=>reject(r.error);
  });
}
async function clearAll(){
  const db=await openDB();
  const tx=db.transaction(Array.from(db.objectStoreNames),'readwrite');
  Array.from(db.objectStoreNames).forEach(n=>tx.objectStore(n).clear());
  return new Promise(res=>tx.oncomplete=res);
}
const today=()=>new Date().toISOString().slice(0,10);
const timeNow=()=>new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
const uid=(p='id')=>p+'_'+Math.random().toString(36).slice(2,9);
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

async function seed(){
  const users=await all('users');
  if(users.length) return;
  const demoUsers=[
    {id:'u_emp',name:'Ahmet Yılmaz',username:'ahmet',password:'1234',role:'employee',active:true},
    {id:'u_wh',name:'Mustafa Kaya',username:'mustafa',password:'1234',role:'warehouse',active:true},
    {id:'u_mgr',name:'Selin Demir',username:'selin',password:'1234',role:'manager',active:true},
    {id:'u_admin',name:'Fatih Dumlu',username:'admin',password:'admin123',role:'superadmin',active:true},
  ];
  const shelves=[
    {id:'s1',name:'Dranken 01',department:'İçecek',location:'Gang 1 - Sol',active:true},
    {id:'s2',name:'Dranken 02',department:'İçecek',location:'Gang 1 - Sağ',active:true},
    {id:'s3',name:'Bakliyat 01',department:'Kuru Gıda',location:'Gang 4 - Sol',active:true},
    {id:'s4',name:'Koeling 01',department:'Soğuk',location:'Koeling A',active:true}
  ];
  const products=[
    {id:'p1',shelfId:'s1',name:'Coca Cola 1.5L',barcode:'871000001',unit:'adet',required:true,active:true},
    {id:'p2',shelfId:'s1',name:'Fanta Orange 1.5L',barcode:'871000002',unit:'adet',required:true,active:true},
    {id:'p3',shelfId:'s1',name:'Sprite 1.5L',barcode:'871000003',unit:'adet',required:true,active:true},
    {id:'p4',shelfId:'s2',name:'Coca Cola Zero 330ml',barcode:'871000004',unit:'koli',required:true,active:true},
    {id:'p5',shelfId:'s2',name:'Fanta Exotic 330ml',barcode:'871000005',unit:'koli',required:true,active:true},
    {id:'p6',shelfId:'s3',name:'Basmati Pirinç 5kg',barcode:'871000006',unit:'adet',required:true,active:true},
    {id:'p7',shelfId:'s3',name:'Nohut 1kg',barcode:'871000007',unit:'adet',required:true,active:true},
    {id:'p8',shelfId:'s4',name:'Ayran 1L',barcode:'871000008',unit:'adet',required:true,active:true}
  ];
  const assignments=[
    {id:'a1',userId:'u_emp',shelfId:'s1',active:true},
    {id:'a2',userId:'u_emp',shelfId:'s2',active:true},
    {id:'a3',userId:'u_emp',shelfId:'s3',active:true},
    {id:'a4',userId:'u_emp',shelfId:'s4',active:true}
  ];
  for(const x of demoUsers) await put('users',x);
  for(const x of shelves) await put('shelves',x);
  for(const x of products) await put('products',x);
  for(const x of assignments) await put('assignments',x);
  await put('settings',{id:'main',deadline:'12:00',expiringDays:14});
}

async function snapshot(){
  const [users,shelves,products,assignments,dailyChecks,issues,settings,notifications]=await Promise.all(
    ['users','shelves','products','assignments','dailyChecks','issues','settings','notifications'].map(all)
  );
  return {users,shelves,products,assignments,dailyChecks,issues,notifications,settings:settings[0]||{deadline:'12:00'}};
}
function todaysChecks(data){return data.dailyChecks.filter(c=>c.date===today());}
function shelfProgress(data,shelfId){
  const p=data.products.filter(x=>x.shelfId===shelfId&&x.active&&x.required);
  const checks=todaysChecks(data).filter(c=>c.shelfId===shelfId);
  const unique=new Set(checks.map(c=>c.productId));
  return {total:p.length,done:unique.size,complete:p.length>0&&unique.size>=p.length};
}
function issueOpen(i){return !['resolved','closed'].includes(i.state);}
function afterDeadline(settings){
  const [h,m]=(settings.deadline||'12:00').split(':').map(Number);
  const n=new Date(); return n.getHours()>h || (n.getHours()===h&&n.getMinutes()>=m);
}

function navFor(role){
  if(role==='employee') return [
    ['home','⌂','Bugün'],['notifications','🔔','Bildirim'],['issues','!','Sorunlar'],['performance','★','Performans']
  ];
  if(role==='warehouse') return [
    ['home','⌂','Depo'],['notifications','🔔','Bildirim'],['issues','!','Bekleyen'],['history','≡','Geçmiş']
  ];
  if(role==='manager') return [
    ['home','⌂','Özet'],['issues','!','Hatalar'],['shelves','▦','Raflar'],['people','♟','Personel']
  ];
  return [
    ['home','⌂','Panel'],['issues','!','Hatalar'],['adminnotes','✎','Notlar'],['shelves','▦','Raflar'],['people','♟','Kullanıcı']
  ];
}
function renderNav(){
  const nav=document.getElementById('bottomNav');
  nav.innerHTML=navFor(currentRole).map(([v,ic,t])=>`<button data-view="${v}" class="${v===currentView?'active':''}"><span>${ic}</span>${t}</button>`).join('');
  nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();});
}

async function render(){
  renderNav();
  document.querySelectorAll('#roleTabs button').forEach(b=>b.classList.toggle('active',b.dataset.role===currentRole));
  const data=await snapshot();
  const app=document.getElementById('app');
  if(currentView==='home') app.innerHTML=await homeView(data);
  else if(currentView==='issues') app.innerHTML=issuesView(data);
  else if(currentView==='shelves') app.innerHTML=shelvesView(data);
  else if(currentView==='people') app.innerHTML=peopleView(data);
  else if(currentView==='performance') app.innerHTML=performanceView(data);
  else if(currentView==='history') app.innerHTML=historyView(data);
  else if(currentView==='notifications') app.innerHTML=notificationsView(data);
  else if(currentView==='adminnotes') app.innerHTML=adminNotesView(data);
  else app.innerHTML=profileView(data);
  bindActions(data);
}

async function homeView(data){
  if(currentRole==='employee') return employeeHome(data);
  if(currentRole==='warehouse') return warehouseHome(data);
  if(currentRole==='manager') return managerHome(data,false);
  return managerHome(data,true);
}
function employeeHome(data){
  const assigned=data.assignments.filter(a=>a.userId==='u_emp'&&a.active).map(a=>a.shelfId);
  const shelves=data.shelves.filter(s=>assigned.includes(s.id)&&s.active);
  const prog=shelves.map(s=>shelfProgress(data,s.id));
  const done=prog.filter(p=>p.complete).length;
  const pct=shelves.length?Math.round(done/shelves.length*100):0;
  return `
  <section class="hero">
    <div class="hero-row"><div><div class="eyebrow">Bugünkü görev</div><h1>Rafları kontrol et</h1><p>Her ürüne OK veya sorun durumu ver.</p></div><div class="score">${pct}%</div></div>
    <div class="progress"><span style="width:${pct}%"></span></div>
  </section>
  ${employeeReminderBanner(data,shelves)}
  <div class="section-title"><h2>Raflarım</h2><small>${done}/${shelves.length} tamamlandı</small></div>
  ${shelves.map(s=>shelfCard(data,s)).join('')}
  `;
}
function shelfCard(data,shelf){
  const pr=data.products.filter(p=>p.shelfId===shelf.id&&p.active&&p.required);
  const checks=todaysChecks(data).filter(c=>c.shelfId===shelf.id);
  const progress=shelfProgress(data,shelf.id);
  return `<article class="card">
    <div class="card-pad shelf-head">
      <div><div class="shelf-title">${esc(shelf.name)}</div><div class="sub">${esc(shelf.location)} · ${progress.done}/${progress.total} ürün</div></div>
      <span class="badge ${progress.complete?'ok':'dark'}">${progress.complete?'Tamamlandı':'Kontrol et'}</span>
    </div>
    ${pr.map(p=>{
      const c=checks.filter(x=>x.productId===p.id).sort((a,b)=>b.ts-a.ts)[0];
      if(c) return '';
      return `<div class="product">
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-actions primary-actions">
          <button class="ok check-btn" data-product="${p.id}" data-shelf="${shelf.id}" data-status="ok">✓ OK</button>
          <button class="danger problem-btn" data-product="${p.id}" data-shelf="${shelf.id}">⚠ Sorun bildir</button>
        </div>
      </div>`;
    }).join('')}
  </article>`;
}
function employeeReminderBanner(data,shelves){
  const checks=todaysChecks(data);
  const missing=[];
  shelves.forEach(s=>{
    data.products.filter(p=>p.shelfId===s.id&&p.active&&p.required).forEach(p=>{
      if(!checks.some(c=>c.productId===p.id)) missing.push({shelf:s,product:p});
    });
  });
  const direct=(data.notifications||[]).filter(n=>n.targetUserId==='u_emp'&&!n.closed);
  if(!missing.length&&!direct.length) return '<div class="notice" style="background:#e8f7ef;border-color:#a8dfc2;color:#0f6d43"><b>✓ Şu ana kadar gözden kaçan kontrol görünmüyor.</b></div>';
  const parts=[];
  if(direct.length) parts.push('<b>🔔 '+direct.length+' yönetici bildirimin var.</b>');
  if(missing.length) parts.push('<b>⚠ '+missing.length+' ürün henüz kontrol edilmedi.</b> Bildirim ekranından nerede olduklarını görebilirsin.');
  return '<button class="notice notice-button open-notifications">'+parts.join('<br>')+'</button>';
}

function shelfOwner(data,shelfId){
  const a=data.assignments.find(x=>x.shelfId===shelfId&&x.active);
  return a?data.users.find(u=>u.id===a.userId):null;
}
function adminNotesView(data){
  if(currentRole!=='superadmin') return '<div class="card empty">Bu alan sadece Süper Admin içindir.</div>';
  const notes=(data.notifications||[])
    .filter(n=>n.note||n.closed)
    .sort((a,b)=>(b.closedAt||b.noteAt||b.ts)-(a.closedAt||a.noteAt||a.ts));
  const rows=notes.map(n=>{
    const u=data.users.find(x=>x.id===n.targetUserId);
    const s=data.shelves.find(x=>x.id===n.shelfId);
    return '<article class="card admin-note"><div class="card-pad">'
      +'<div class="simple-row"><strong>'+esc(u?.name||'Personel')+'</strong><span class="badge '+(n.closed?'ok':'blue')+'">'+(n.closed?'Tamamlandı':'Not bıraktı')+'</span></div>'
      +'<div class="meta">'+(s?'<b>Raf:</b> '+esc(s.name)+'<br>':'')
      +'<b>Gönderilen:</b> '+esc(n.message||n.title||'')+'<br>'
      +(n.note?'<b>Personel notu:</b> '+esc(n.note)+'<br>':'')
      +(n.closedTime?'<b>Tamamlandı:</b> '+esc(n.closedTime):'')
      +'</div></div></article>';
  }).join('');
  return '<div class="section-title"><h2>Personel Notları</h2><small>'+notes.length+' kayıt</small></div>'
    +(rows||'<div class="card empty">Henüz personel notu yok.</div>');
}
function monthlyPerformanceModal(data,userId){
  const u=data.users.find(x=>x.id===userId);
  if(!u) return;
  const month=today().slice(0,7);
  const shelfIds=data.assignments.filter(a=>a.userId===userId&&a.active).map(a=>a.shelfId);
  const checks=data.dailyChecks.filter(x=>x.date?.startsWith(month)&&shelfIds.includes(x.shelfId));
  const issues=data.issues.filter(x=>x.date?.startsWith(month)&&x.reportedBy===userId);
  const expectedProducts=data.products.filter(p=>shelfIds.includes(p.shelfId)&&p.active&&p.required).length;
  const uniqueToday=new Set(todaysChecks(data).filter(x=>shelfIds.includes(x.shelfId)).map(x=>x.productId)).size;
  const completion=expectedProducts?Math.round(uniqueToday/expectedProducts*100):0;
  const score=Math.max(0,Math.min(100,70+Math.round(completion*.3)));
  const shelfNames=shelfIds.map(id=>data.shelves.find(s=>s.id===id)?.name).filter(Boolean);
  openModal('Aylık performans',
    '<div class="performance-profile">'
    +'<div class="row-left"><div class="avatar">'+esc(u.name.charAt(0))+'</div><div><strong>'+esc(u.name)+'</strong><div class="sub">'+month+'</div></div></div>'
    +'<div class="grid" style="margin-top:14px"><div class="metric"><b>'+score+'</b><span>Performans puanı</span></div><div class="metric"><b>'+checks.length+'</b><span>Ürün kontrolü</span></div><div class="metric"><b>'+issues.length+'</b><span>Sorun bildirimi</span></div><div class="metric"><b>'+completion+'%</b><span>Bugünkü tamamlanma</span></div></div>'
    +'<div class="card" style="box-shadow:none;border:1px solid var(--line)"><div class="card-pad"><strong>Sorumlu raflar</strong><div class="meta">'+shelfNames.map(esc).join('<br>')+'</div></div></div>'
    +'</div>');
}
function notificationsView(data){
  const targetUser=currentRole==='employee'?'u_emp':currentRole==='warehouse'?'u_wh':null;
  const direct=(data.notifications||[]).filter(n=>(!targetUser||n.targetUserId===targetUser)&&!n.closed).sort((a,b)=>b.ts-a.ts);
  const cards=[];
  if(currentRole==='employee'){
    const assigned=data.assignments.filter(a=>a.userId==='u_emp'&&a.active).map(a=>a.shelfId);
    const checks=todaysChecks(data);
    data.shelves.filter(s=>assigned.includes(s.id)&&s.active).forEach(s=>{
      const missed=data.products.filter(p=>p.shelfId===s.id&&p.active&&p.required&&!checks.some(c=>c.productId===p.id));
      if(missed.length) cards.push('<article class="card reminder-card"><div class="card-pad"><span class="badge warn">Kontrol bekliyor</span><h3>'+esc(s.name)+'</h3><div class="meta">'+esc(s.location)+'<br><b>'+missed.length+' ürün gözden kaçmış olabilir:</b><br>'+missed.map(p=>'• '+esc(p.name)).join('<br>')+'</div><button class="btn full go-shelf" data-shelf="'+s.id+'">Bu rafı kontrol et</button></div></article>');
    });
  }
  direct.forEach(n=>{
    const s=data.shelves.find(x=>x.id===n.shelfId);
    cards.push('<article class="card admin-note"><div class="card-pad"><span class="badge blue">Yönetici uyarısı</span><h3>'+esc(n.title||'Kontrol uyarısı')+'</h3><div class="meta">'+esc(n.message||'')+(s?'<br><b>Raf: '+esc(s.name)+'</b>':'')+'<br>'+esc(n.time||'')+(n.note?'<br><b>Not:</b> '+esc(n.note):'')+'</div>'+(s&&currentRole==='employee'?'<button class="btn full go-shelf" data-shelf="'+s.id+'">Rafa git</button>':'')+'<div class="btn-row"><button class="btn success close-note" data-id="'+n.id+'">✓ Baktım / Tamamladım</button><button class="btn secondary note-note" data-id="'+n.id+'">Not ekle</button></div></div></article>');
  });
  return '<div class="section-title"><h2>Bildirimler</h2><small>'+cards.length+' kayıt</small></div>'+(cards.join('')||'<div class="card empty">Yeni bildirim yok.</div>');
}
function warehouseHome(data){
  const missing=data.issues.filter(i=>i.type==='missing'&&issueOpen(i));
  const waiting=missing.filter(i=>i.state==='reported');
  return `
  <section class="hero"><div class="eyebrow">Depo sorumlusu</div><h1>${waiting.length} bekleyen raf talebi</h1><p>Rafta yok bildirilen ürünleri depoda kontrol et.</p></section>
  <div class="grid">
    <div class="metric"><b>${waiting.length}</b><span>Kontrol bekliyor</span></div>
    <div class="metric"><b>${missing.filter(i=>i.state==='warehouse_found').length}</b><span>Rafa gönderiliyor</span></div>
  </div>
  <div class="section-title"><h2>Bekleyenler</h2><small>öncelik sırasıyla</small></div>
  ${waiting.length?waiting.map(i=>issueCard(data,i,true)).join(''):'<div class="card empty">Bekleyen depo talebi yok.</div>'}
  `;
}
function managerHome(data,isAdmin){
  const checks=todaysChecks(data);
  const activeShelves=data.shelves.filter(s=>s.active);
  const done=activeShelves.filter(s=>shelfProgress(data,s.id).complete).length;
  const un=activeShelves.filter(s=>!shelfProgress(data,s.id).complete);
  const issues=data.issues.filter(issueOpen);
  const overdue=afterDeadline(data.settings)&&un.length;
  return `
  <section class="hero">
    <div class="hero-row"><div><div class="eyebrow">${isAdmin?'Süper Admin':'Mağaza Müdürü'}</div><h1>Günlük kontrol merkezi</h1><p>${today()} · Son durum canlı</p></div><div class="score">${activeShelves.length?Math.round(done/activeShelves.length*100):0}%</div></div>
    <div class="progress"><span style="width:${activeShelves.length?Math.round(done/activeShelves.length*100):0}%"></span></div>
  </section>
  ${overdue?`<div class="notice" style="background:#fde9e9;border-color:#f3aaaa;color:#9f1d1d"><b>🔴 ${un.length} raf 12:00'ye kadar kontrol edilmedi.</b><br>Yönetim aksiyonu gerekiyor.</div>`:''}
  ${isAdmin?'<div class="btn-row" style="margin:0 0 12px"><button class="btn" id="sendNotification">🔔 Uyarı gönder</button><button class="btn secondary" id="openTestCenter">🧪 Test Merkezi</button></div>':''}
  <div class="grid">
    <div class="metric"><b>${done}/${activeShelves.length}</b><span>Raf tamamlandı</span></div>
    <div class="metric"><b>${issues.length}</b><span>Açık sorun</span></div>
    <div class="metric"><b>${issues.filter(i=>i.type==='expired').length}</b><span>Tarihi geçmiş</span></div>
    <div class="metric"><b>${issues.filter(i=>i.type==='expiring').length}</b><span>Tarihi yaklaşan</span></div>
  </div>
  <div class="section-title"><h2>Bugün yapılacaklar</h2><small>${activeShelves.length-done} raf kaldı</small></div>
  ${activeShelves.map(s=>{
    const pg=shelfProgress(data,s.id);
    const owner=shelfOwner(data,s.id);
    const remain=Math.max(0,pg.total-pg.done);
    return `<div class="card"><div class="card-pad"><div class="simple-row"><div><strong>${esc(s.name)}</strong><div class="meta">${pg.done}/${pg.total} ürün kontrol edildi · ${remain} kaldı</div></div><span class="badge ${pg.complete?'ok':afterDeadline(data.settings)?'danger':'dark'}">${pg.complete?'Tamamlandı':afterDeadline(data.settings)?'Gecikti':'Bekliyor'}</span></div>${owner?`<button class="owner-link performance-user" data-user="${owner.id}">👤 ${esc(owner.name)} · performansı gör</button>`:'<div class="owner-link muted">Sorumlu atanmamış</div>'}</div></div>`;
  }).join('')}
  ${un.length?`<div class="section-title"><h2>${afterDeadline(data.settings)?'Yapılmayan / geciken':'Henüz tamamlanmayan'}</h2><small>${un.length} raf</small></div>`:''
  }
  <div class="section-title"><h2>Hata ekranı</h2><small>${issues.length} açık</small></div>
  ${issues.slice(0,4).map(i=>issueCard(data,i,false)).join('')||'<div class="card empty">Açık sorun yok.</div>'}
  `;
}
function issueCard(data,i,warehouseMode=false){
  const p=data.products.find(x=>x.id===i.productId);
  const s=data.shelves.find(x=>x.id===i.shelfId);
  const u=data.users.find(x=>x.id===i.reportedBy);
  const cls=i.type==='expired'?'alert':i.type==='expiring'?'alert warnline':i.type==='low'?'alert orangeline':'alert';
  let action='';
  if(warehouseMode&&i.state==='reported'){
    action=`<div class="btn-row"><button class="btn success wh-found" data-id="${i.id}">Depoda var</button><button class="btn danger wh-none" data-id="${i.id}">Depoda yok</button></div>`;
  }
  return `<article class="card ${cls}"><div class="card-pad"><div><strong>${esc(p?.name||'Ürün')}</strong>
  <div class="meta"><b>${STATUS[i.type]?.label||i.type}</b>${i.qty!=null?' · '+i.qty+' '+esc(i.unit||''):''}${i.expiry?' · SKT '+esc(i.expiry):''}<br>${esc(s?.name||'')} · ${esc(u?.name||'')} · ${esc(i.time||'')}</div>${action}</div><span class="badge ${STATUS[i.type]?.cls||'dark'}">${i.state==='reported'?'Yeni':i.state==='warehouse_found'?'Bulundu':i.state==='warehouse_none'?'Depoda yok':'Açık'}</span></div></article>`;
}
function issuesView(data){
  let issues=data.issues.filter(issueOpen);
  if(currentRole==='warehouse') issues=issues.filter(i=>i.type==='missing');
  return `<div class="section-title"><h2>Hata / Sorunlar</h2><small>${issues.length} açık</small></div>
    ${issues.length?issues.map(i=>issueCard(data,i,currentRole==='warehouse')).join(''):'<div class="card empty">Açık sorun yok.</div>'}`;
}
function shelvesView(data){
  const canEdit=['manager','superadmin'].includes(currentRole);
  return `
  <div class="section-title"><h2>Raf Yönetimi</h2>${canEdit?'<button class="btn" id="addShelf">+ Raf</button>':''}</div>
  ${data.shelves.filter(s=>s.active).map(s=>{
    const ps=data.products.filter(p=>p.shelfId===s.id&&p.active);
    return `<div class="card"><div class="card-pad"><div class="simple-row"><div><strong>${esc(s.name)}</strong><div class="meta">${esc(s.department)} · ${esc(s.location)}<br>${ps.length} ürün tanımlı</div>${shelfOwner(data,s.id)?`<button class="owner-link performance-user" data-user="${shelfOwner(data,s.id).id}">👤 ${esc(shelfOwner(data,s.id).name)}</button>`:'<div class="owner-link muted">Sorumlu atanmamış</div>'}</div>${canEdit?`<button class="btn secondary add-product" data-shelf="${s.id}">+ Ürün</button>`:''}</div></div>
    ${ps.slice(0,4).map(p=>`<div class="product"><div class="product-name">${esc(p.name)}</div><div class="sub">${esc(p.unit)} · ${esc(p.barcode||'')}</div></div>`).join('')}
    ${ps.length>4?`<div class="product sub">+${ps.length-4} ürün daha</div>`:''}</div>`;
  }).join('')}
  `;
}
function peopleView(data){
  if(!['manager','superadmin'].includes(currentRole)) return '<div class="card empty">Bu alan için yetkiniz yok.</div>';
  return `
  <div class="section-title"><h2>${currentRole==='superadmin'?'Kullanıcı Yönetimi':'Personel'}</h2>${currentRole==='superadmin'?'<button class="btn" id="addUser">+ Kullanıcı</button>':''}</div>
  ${data.users.map(u=>`<div class="card"><div class="card-pad user-row"><div class="row-left"><div class="avatar">${esc(u.name.charAt(0))}</div><div><strong>${esc(u.name)}</strong><div class="meta">@${esc(u.username)} · ${ROLE_NAMES[u.role]}</div></div></div><span class="badge ${u.active?'ok':'dark'}">${u.active?'Aktif':'Pasif'}</span></div></div>`).join('')}
  `;
}
function performanceView(data){
  const assigned=data.assignments.filter(a=>a.userId==='u_emp'&&a.active).map(a=>a.shelfId);
  const shelves=data.shelves.filter(s=>assigned.includes(s.id));
  const done=shelves.filter(s=>shelfProgress(data,s.id).complete).length;
  const pct=shelves.length?Math.round(done/shelves.length*100):0;
  const score=Math.max(0,Math.min(100,70+Math.round(pct*.3)));
  return `<section class="hero"><div class="eyebrow">Aylık performans</div><h1>${score}/100</h1><p>Tahmini prim seviyesi</p><div class="progress"><span style="width:${score}%"></span></div></section>
  <div class="card"><div class="card-pad"><strong>Günlük kontrol</strong><div class="meta">${pct}% tamamlanma</div><div class="kpi-line"><span style="width:${pct}%"></span></div></div></div>
  <div class="card"><div class="card-pad"><strong>Sorun bildirimi</strong><div class="meta">Sorun bulmak puan kaybettirmez; zamanında bildirim pozitif değerlendirilir.</div></div></div>`;
}
function historyView(data){
  return `<div class="section-title"><h2>Depo Geçmişi</h2><small>bugün</small></div>${data.issues.filter(i=>i.type==='missing').map(i=>issueCard(data,i,false)).join('')||'<div class="card empty">Kayıt yok.</div>'}`;
}
function profileView(data){
  const u=currentRole==='employee'?data.users.find(x=>x.id==='u_emp'):currentRole==='warehouse'?data.users.find(x=>x.id==='u_wh'):currentRole==='manager'?data.users.find(x=>x.id==='u_mgr'):data.users.find(x=>x.id==='u_admin');
  return `<div class="card"><div class="card-pad"><div class="row-left"><div class="avatar">${esc(u?.name?.charAt(0)||'E')}</div><div><strong>${esc(u?.name||'')}</strong><div class="meta">${ROLE_NAMES[currentRole]}<br>@${esc(u?.username||'')}</div></div></div></div></div>
  <div class="card"><div class="card-pad"><strong>Yetki</strong><div class="meta">${currentRole==='employee'?'Sadece atanmış raflarını kontrol eder ve sorun bildirir.':currentRole==='warehouse'?'Rafta yok bildirimlerini doğrular ve depo durumunu bildirir.':currentRole==='manager'?'Raf/ürün tanımlar, tüm kontrolleri ve hataları görür.':'Tüm sistemi, kullanıcıları, şifreleri, roller ve raf atamalarını yönetir.'}</div></div></div>`;
}

function openModal(title,body){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body;
  document.getElementById('modal').showModal();
}
function closeModal(){document.getElementById('modal').close();}

function bindActions(data){
  document.querySelectorAll('.open-notifications').forEach(b=>b.onclick=()=>{currentView='notifications';render();});
  document.querySelectorAll('.performance-user').forEach(b=>b.onclick=()=>monthlyPerformanceModal(data,b.dataset.user));
  document.querySelectorAll('.go-shelf').forEach(b=>b.onclick=()=>{currentView='home';render().then(()=>setTimeout(()=>document.querySelector('[data-shelf-card="'+b.dataset.shelf+'"]')?.scrollIntoView({behavior:'smooth',block:'start'}),50));});
  document.querySelectorAll('.close-note').forEach(b=>b.onclick=async()=>{
    const n=(data.notifications||[]).find(x=>x.id===b.dataset.id);
    if(!n) return;
    n.read=true;
    n.closed=true;
    n.closedAt=Date.now();
    n.closedTime=timeNow();
    await put('notifications',n);
    render();
  });
  document.querySelectorAll('.note-note').forEach(b=>b.onclick=()=>{
    const n=(data.notifications||[]).find(x=>x.id===b.dataset.id);
    if(!n) return;
    openModal('Not ekle','<div class="form-grid"><label>Not<input id="noteText" value="'+esc(n.note||'')+'" placeholder="Kısa not yaz"></label><button class="btn full" id="saveNote">Notu kaydet</button></div>');
    document.getElementById('saveNote').onclick=async()=>{
      n.note=document.getElementById('noteText').value||'';
      n.noteAt=Date.now();
      await put('notifications',n);
      closeModal();
      render();
    };
  });
  document.querySelectorAll('.problem-btn').forEach(b=>b.onclick=()=>{
    const p=data.products.find(x=>x.id===b.dataset.product);
    showMultiIssueForm(data,p,b.dataset.shelf);
  });
  document.querySelectorAll('.check-btn').forEach(b=>b.onclick=async()=>{
    const p=data.products.find(x=>x.id===b.dataset.product);
    await saveCheck(p,b.dataset.shelf,'ok',{});
    render();
  });
  document.querySelectorAll('.wh-found').forEach(b=>b.onclick=async()=>{
    const i=data.issues.find(x=>x.id===b.dataset.id);
    openModal('Depoda bulundu',`<div class="form-grid"><label>Depodaki toplam miktar<input id="whQty" type="number" step="0.01" min="0" inputmode="decimal"></label><label>Rafa gönderilecek miktar<input id="sendQty" type="number" step="0.01" min="0" inputmode="decimal"></label><button class="btn success full" id="confirmFound">Rafa gönder</button></div>`);
    document.getElementById('confirmFound').onclick=async()=>{
      i.state='warehouse_found';i.warehouseQty=Number(document.getElementById('whQty').value||0);i.sentQty=Number(document.getElementById('sendQty').value||0);i.warehouseAt=Date.now();
      await put('issues',i); closeModal(); render();
    };
  });
  document.querySelectorAll('.wh-none').forEach(b=>b.onclick=async()=>{
    const i=data.issues.find(x=>x.id===b.dataset.id); i.state='warehouse_none';i.warehouseAt=Date.now(); await put('issues',i); render();
  });
  document.querySelectorAll('.add-product').forEach(b=>b.onclick=()=>productModal(b.dataset.shelf));
  document.getElementById('addShelf')?.addEventListener('click',shelfModal);
  document.getElementById('addUser')?.addEventListener('click',()=>userModal(data));
  document.getElementById('sendNotification')?.addEventListener('click',()=>notificationModal(data));
  document.getElementById('openTestCenter')?.addEventListener('click',()=>testCenterModal(data));
}

function showMultiIssueForm(data,p,shelfId){
  openModal('Sorun bildir',
    '<div class="form-grid">'
    +'<div><strong>'+esc(p.name)+'</strong><div class="sub">Birden fazla sorun seçebilirsin.</div></div>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="expiring"> 🟡 Tarihi yaklaşıyor</label>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="expired"> 🔴 Tarihi geçmiş</label>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="low"> 🟠 Stok az</label>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="missing"> ⚫ Rafta yok</label>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="damaged"> ❌ Hasarlı / bozuk</label>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="label_missing"> 🏷️ Raf etiketi yok</label>'
    +'<label class="check-row"><input type="checkbox" name="issueType" value="label_wrong"> ⚠️ Raf etiketi yanlış</label>'
    +'<label>Son kullanma tarihi <span class="sub">(tarih sorunu varsa)</span><input id="multiExpiry" type="date"></label>'
    +'<label>Miktar<input id="multiQty" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0"></label>'
    +'<label>Birim<select id="multiUnit"><option value="adet">Adet</option><option value="kg">Kg</option><option value="koli">Koli</option><option value="paket">Paket</option><option value="şişe">Şişe</option><option value="kasa">Kasa</option></select></label>'
    +'<label>Not <span class="sub">(isteğe bağlı)</span><input id="multiNote" placeholder="Örn. etiket farklı fiyat gösteriyor"></label>'
    +'<button class="btn full" id="saveMultiIssue">Sorunları bildir</button>'
    +'</div>');
  document.getElementById('saveMultiIssue').onclick=async()=>{
    const selected=[...document.querySelectorAll('input[name="issueType"]:checked')].map(x=>x.value);
    if(!selected.length){alert('En az bir sorun seçin.');return;}
    const hasDate=selected.some(x=>x==='expiring'||x==='expired');
    const expiry=document.getElementById('multiExpiry').value;
    if(hasDate&&!expiry){alert('Tarih sorunu için son kullanma tarihini girin.');return;}
    const qtyRaw=document.getElementById('multiQty').value;
    const qty=qtyRaw===''?null:Number(qtyRaw);
    const unit=document.getElementById('multiUnit').value;
    const note=document.getElementById('multiNote').value||'';
    await put('dailyChecks',{id:uid('c'),date:today(),ts:Date.now(),time:timeNow(),productId:p.id,shelfId,status:'problem',reportedBy:'u_emp',problemTypes:selected});
    for(const type of selected){
      await put('issues',{id:uid('i'),date:today(),time:timeNow(),ts:Date.now(),productId:p.id,shelfId,type,state:'reported',reportedBy:'u_emp',qty,unit,expiry:(type==='expiring'||type==='expired')?expiry:null,note,visibility:type.startsWith('label_')?['manager','superadmin']:['warehouse','manager','superadmin']});
    }
    closeModal();
    render();
  };
}

async function createScenario(data,type){
  const shelf=data.shelves.find(s=>s.id==='s1')||data.shelves[0];
  const products=data.products.filter(p=>p.shelfId===shelf?.id&&p.active);
  const p=products[0]||data.products[0];
  if(!shelf||!p) return;

  if(type==='reset'){
    const db=await openDB();
    const tx=db.transaction(['dailyChecks','issues','notifications'],'readwrite');
    ['dailyChecks','issues','notifications'].forEach(n=>tx.objectStore(n).clear());
    await new Promise(res=>tx.oncomplete=res);
    return;
  }

  if(type==='ok'){
    await put('dailyChecks',{
      id:uid('c'),date:today(),ts:Date.now(),time:timeNow(),
      productId:p.id,shelfId:shelf.id,status:'ok',reportedBy:'u_emp'
    });
    return;
  }

  if(['expiring','expired','low','missing','damaged','label_missing','label_wrong'].includes(type)){
    const extra={qty:2,unit:p.unit||'adet'};
    if(type==='expiring'){
      extra.expiry=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
      extra.qty=8;
    }
    if(type==='expired'){
      extra.expiry=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
      extra.qty=4;
    }
    if(type==='low') extra.qty=3;
    if(type==='missing') extra.qty=0;
    await saveCheck(p,shelf.id,type,extra);
    return;
  }

  if(type==='warehouse_found'||type==='warehouse_none'){
    const issue={
      id:uid('i'),date:today(),time:timeNow(),ts:Date.now(),
      productId:p.id,shelfId:shelf.id,type:'missing',
      state:type==='warehouse_found'?'warehouse_found':'warehouse_none',
      reportedBy:'u_emp',qty:0,unit:p.unit||'adet',expiry:null,
      visibility:['warehouse','manager','superadmin']
    };
    if(type==='warehouse_found'){
      issue.warehouseQty=36;
      issue.sentQty=12;
      issue.warehouseAt=Date.now();
    }
    await put('issues',issue);
    return;
  }

  if(type==='employee_notice'||type==='warehouse_notice'){
    await put('notifications',{
      id:uid('n'),
      targetUserId:type==='employee_notice'?'u_emp':'u_wh',
      shelfId:shelf.id,
      title:'Test uyarısı',
      message:type==='employee_notice'
        ?'Bu rafın üst bölümünü tekrar kontrol et.'
        :'Rafta yok bildirilen ürünü depoda kontrol et.',
      read:false,closed:false,ts:Date.now(),time:timeNow(),sentBy:'u_admin'
    });
    return;
  }

  if(type==='all'){
    const list=['expiring','expired','low','missing','damaged','label_missing','label_wrong','warehouse_found','warehouse_none','employee_notice','warehouse_notice'];
    for(const item of list) await createScenario(data,item);
  }
}

function testCenterModal(data){
  const body=[
    '<div class="test-grid">',
    '<button class="test-btn ok" data-test="ok">✓ Sorunsuz kontrol</button>',
    '<button class="test-btn warn" data-test="expiring">🟡 Tarihi yaklaşan</button>',
    '<button class="test-btn danger" data-test="expired">🔴 Tarihi geçmiş</button>',
    '<button class="test-btn low" data-test="low">🟠 Stok az</button>',
    '<button class="test-btn missing" data-test="missing">⚫ Rafta yok</button>',
    '<button class="test-btn danger" data-test="damaged">❌ Hasarlı</button>',
    '<button class="test-btn warn" data-test="label_missing">🏷️ Etiket yok</button>',
    '<button class="test-btn danger" data-test="label_wrong">⚠️ Etiket yanlış</button>',
    '<button class="test-btn blue" data-test="warehouse_found">📦 Depoda var</button>',
    '<button class="test-btn danger" data-test="warehouse_none">🚫 Depoda yok</button>',
    '<button class="test-btn blue" data-test="employee_notice">🔔 Çalışana uyarı</button>',
    '<button class="test-btn blue" data-test="warehouse_notice">🔔 Depoya uyarı</button>',
    '<button class="test-btn fullspan" data-test="all">🧪 Tüm senaryoları oluştur</button>',
    '<button class="test-btn reset fullspan" data-test="reset">↻ Test kayıtlarını temizle</button>',
    '</div>',
    '<div class="sub" style="margin-top:12px">Bu alan sadece test için. Gerçek kullanıma geçerken kaldırılacak.</div>'
  ].join('');

  openModal('Test Merkezi',body);

  document.querySelectorAll('.test-btn').forEach(b=>{
    b.onclick=async()=>{
      await createScenario(data,b.dataset.test);
      closeModal();
      render();
    };
  });
}

function notificationModal(data){
  const shelfOpts=data.shelves.filter(s=>s.active).map(s=>{
    const owner=shelfOwner(data,s.id);
    return '<option value="'+s.id+'">'+esc(s.name)+' · '+esc(owner?.name||'Sorumlu yok')+'</option>';
  }).join('');
  openModal('Uyarı / not gönder',
    '<div class="form-grid">'
    +'<label>Hedef<select id="nRoute"><option value="shelf">Raf sorumlusuna</option><option value="warehouse">Depo sorumlusuna</option></select></label>'
    +'<label id="nShelfWrap">Raf<select id="nShelf">'+shelfOpts+'</select></label>'
    +'<div id="nOwnerPreview" class="notice" style="margin:0"></div>'
    +'<label>Başlık<input id="nTitle" value="Kontrol uyarısı"></label>'
    +'<label>Mesaj<input id="nMessage" placeholder="Örn. Üst bölümü tekrar kontrol et"></label>'
    +'<button class="btn full" id="saveNotification">Gönder</button>'
    +'</div>');
  const route=document.getElementById('nRoute');
  const shelf=document.getElementById('nShelf');
  const wrap=document.getElementById('nShelfWrap');
  const preview=document.getElementById('nOwnerPreview');
  const refresh=()=>{
    if(route.value==='warehouse'){
      wrap.style.display='none';
      const wh=data.users.find(u=>u.role==='warehouse'&&u.active);
      preview.innerHTML='<b>Bildirim:</b> '+esc(wh?.name||'Depo sorumlusu bulunamadı');
    }else{
      wrap.style.display='';
      const owner=shelfOwner(data,shelf.value);
      preview.innerHTML='<b>Raf sorumlusu:</b> '+esc(owner?.name||'Atanmamış');
    }
  };
  route.onchange=refresh;shelf.onchange=refresh;refresh();
  document.getElementById('saveNotification').onclick=async()=>{
    let targetUserId=null,shelfId=null;
    if(route.value==='warehouse'){
      targetUserId=data.users.find(u=>u.role==='warehouse'&&u.active)?.id||null;
    }else{
      shelfId=shelf.value;
      targetUserId=shelfOwner(data,shelfId)?.id||null;
    }
    if(!targetUserId){alert('Bu hedef için sorumlu kullanıcı bulunamadı.');return;}
    await put('notifications',{id:uid('n'),targetUserId,shelfId,title:document.getElementById('nTitle').value||'Kontrol uyarısı',message:document.getElementById('nMessage').value||'Lütfen belirtilen alanı kontrol edin.',read:false,closed:false,ts:Date.now(),time:timeNow(),sentBy:'u_admin'});
    closeModal();render();
  };
}

async function saveCheck(product,shelfId,status,extra){
  const check={id:uid('c'),date:today(),ts:Date.now(),time:timeNow(),productId:product.id,shelfId,status,reportedBy:'u_emp',...extra};
  await put('dailyChecks',check);
  if(status!=='ok'){
    const issue={id:uid('i'),date:today(),time:timeNow(),ts:Date.now(),productId:product.id,shelfId,type:status,state:'reported',reportedBy:'u_emp',qty:extra.qty??null,unit:extra.unit||product.unit,expiry:extra.expiry||null,visibility:['warehouse','manager','superadmin']};
    await put('issues',issue);
  }
}
function shelfModal(){
  openModal('Yeni Raf',`<div class="form-grid"><label>Raf adı<input id="sName" placeholder="Dranken 03"></label><label>Bölüm<input id="sDept" placeholder="İçecek"></label><label>Konum<input id="sLoc" placeholder="Gang 2 - Sol"></label><button class="btn full" id="saveShelf">Rafı oluştur</button></div>`);
  document.getElementById('saveShelf').onclick=async()=>{await put('shelves',{id:uid('s'),name:document.getElementById('sName').value||'Yeni Raf',department:document.getElementById('sDept').value||'-',location:document.getElementById('sLoc').value||'-',active:true});closeModal();render();};
}
function productModal(shelfId){
  openModal('Rafa ürün ekle',`<div class="form-grid"><label>Ürün adı<input id="pName"></label><label>Barkod<input id="pBarcode" inputmode="numeric"></label><label>Birim<select id="pUnit"><option>adet</option><option>kg</option><option>koli</option><option>paket</option><option>şişe</option><option>kasa</option></select></label><button class="btn full" id="saveProduct">Ürünü ekle</button></div>`);
  document.getElementById('saveProduct').onclick=async()=>{await put('products',{id:uid('p'),shelfId,name:document.getElementById('pName').value||'Yeni ürün',barcode:document.getElementById('pBarcode').value,unit:document.getElementById('pUnit').value,required:true,active:true});closeModal();render();};
}
function userModal(data){
  const shelfOpts=data.shelves.filter(s=>s.active).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  openModal('Yeni Kullanıcı',`<div class="form-grid"><label>Ad soyad<input id="uName"></label><label>Kullanıcı adı<input id="uLogin" autocapitalize="none"></label><label>Şifre<input id="uPass" type="password"></label><label>Rol<select id="uRole"><option value="employee">Çalışan</option><option value="warehouse">Depo Sorumlusu</option><option value="manager">Mağaza Müdürü</option><option value="superadmin">Süper Admin</option></select></label><label>Sorumlu raflar<select id="uShelves" multiple size="5">${shelfOpts}</select></label><button class="btn full" id="saveUser">Kullanıcı oluştur</button></div>`);
  document.getElementById('saveUser').onclick=async()=>{
    const id=uid('u'); const role=document.getElementById('uRole').value;
    await put('users',{id,name:document.getElementById('uName').value||'Yeni Kullanıcı',username:document.getElementById('uLogin').value||uid('user'),password:document.getElementById('uPass').value||'1234',role,active:true});
    if(role==='employee'){
      [...document.getElementById('uShelves').selectedOptions].forEach(async o=>await put('assignments',{id:uid('a'),userId:id,shelfId:o.value,active:true}));
    }
    closeModal();render();
  };
}

document.getElementById('roleTabs').addEventListener('click',e=>{
  const b=e.target.closest('button[data-role]'); if(!b)return;
  currentRole=b.dataset.role; currentView='home'; render();
});
document.getElementById('modalClose').onclick=closeModal;
document.getElementById('resetDemo').onclick=async()=>{if(confirm('Demo verileri sıfırlansın mı?')){await clearAll();await seed();render();}};
seed().then(render);
