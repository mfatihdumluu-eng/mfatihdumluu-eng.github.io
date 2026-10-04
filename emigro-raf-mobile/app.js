const DB_NAME='raf';
const DB_VERSION=2;
const ROLE_NAMES={employee:'Çalışan',cashier:'Kasa Kullanıcısı',warehouse:'Depo Sorumlusu',manager:'Mağaza Müdürü',superadmin:'Süper Admin',system_admin:'Sistem Yönetici'};
const STATUS={
  ok:{label:'OK',cls:'ok'},
  expiring:{label:'Tarihi yaklaşıyor',cls:'warn'},
  expired:{label:'Tarihi geçmiş',cls:'danger'},
  low:{label:'Stok az',cls:'warn'},
  missing:{label:'Rafta yok',cls:'dark'},
  damaged:{label:'Hasarlı/bozuk',cls:'danger'},
  label_missing:{label:'Raf etiketi yok',cls:'warn'},
  label_wrong:{label:'Raf etiketi yanlış',cls:'danger'},
  cash_price_wrong:{label:'Fiyat yanlış',cls:'danger'},
  cash_not_scanning:{label:'Kasada çıkmıyor / barkod okunmuyor',cls:'dark'},
  cash_discount_missing:{label:'İndirim uygulanmıyor',cls:'warn'},
  cash_barcode_mismatch:{label:'Ürün / barkod eşleşmiyor',cls:'danger'}
};
let currentRole='employee';
let currentView='home';
let issueUserFilter='all';
let issueTypeFilter='all';
let selectedShelfId=null;
let selectedSystemUserId=null;
let employeeShelfId=null;
let employeeMeter='all';
let employeeLevel='all';
let employeePosition='all';
let currentUser=null;
let viewAsUserId=null;
const RAF_AUTH_URL='https://hroarfuwpfsqilsijwpp.supabase.co/functions/v1/raf-auth';
const RAF_DATA_URL='https://hroarfuwpfsqilsijwpp.supabase.co/functions/v1/raf-data';

function authToken(){return localStorage.getItem('raf_auth_token')||'';}
function activeAppUserId(){return viewAsUserId||currentUser?.app_user_id||null;}
function isSystemAdmin(){return currentUser?.role==='system_admin';}
async function rafAuth(action,payload={}){
  const res=await fetch(RAF_AUTH_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,token:authToken(),...payload})
  });
  const out=await res.json().catch(()=>({ok:false,error:'Sunucu yanıtı okunamadı.'}));
  if(!res.ok&&out.ok!==true) throw new Error(out.error||'İşlem başarısız.');
  return out;
}
function showAuth(){
  document.getElementById('authScreen').style.display='flex';
  document.getElementById('mainApp').style.display='none';
}
function showApp(){
  document.getElementById('authScreen').style.display='none';
  document.getElementById('mainApp').style.display='block';
  const sys=document.getElementById('systemUserButton');
  if(sys) sys.style.display=isSystemAdmin()?'inline-flex':'none';
}
function setEffectiveUser(user){
  currentUser=user;
  viewAsUserId=null;
  currentRole=user.role==='system_admin'?'superadmin':user.role;
  currentView=user.role==='system_admin'?'system':'home';
}
async function ensureBundledCatalog(){
  const version='catalog_unique_barkod_v1';
  if(localStorage.getItem('raf_catalog_version')===version) return;
  try{
    const res=await fetch('./emigro_raf_catalog.csv',{cache:'no-store'});
    if(!res.ok) return;
    const text=await res.text();
    const wb=XLSX.read(text,{type:'string'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    if(!rows.length) return;
    const shelfMap=new Map();
    const products=[];
    for(const row of rows){
      const shelfCode=String(row['Raf Kodu']||'').trim();
      const name=String(row['Ürün']||'').trim();
      const barcode=String(row['Barkod']||'').trim();
      if(!shelfCode||!name) continue;
      if(!shelfMap.has(shelfCode)){
        shelfMap.set(shelfCode,{
          id:'s_'+shelfCode.toLowerCase(),code:shelfCode,name:shelfCode,
          department:String(row['Bölüm']||'-'),
          location:String(row['Bölüm']||'')+' · Raf '+shelfCode,
          approved:false,active:true
        });
      }
      const shelf=shelfMap.get(shelfCode);
      products.push({
        id:'p_'+(barcode||uid('x')),shelfId:shelf.id,shelfCode,
        name,barcode,unit:String(row['Birim']||'adet'),
        meter:Number(row['Metre']||0)||null,
        level:Number(row['Kat']||0)||null,
        position:Number(row['Sıra']||0)||null,
        locationCode:String(row['Konum Kodu']||''),
        widthCm:Number(row['Ürün Genişliği (cm)']||0)||null,
        startCm:Number(row['Başlangıç (cm)']||0),
        endCm:Number(row['Bitiş (cm)']||0),
        meterFillCm:Number(row['1 m Doluluk (cm)']||0),
        required:true,active:true
      });
    }
    const db=await openDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['shelves','products','assignments'],'readwrite');
      const shelvesStore=tx.objectStore('shelves');
      const productsStore=tx.objectStore('products');
      const assignmentsStore=tx.objectStore('assignments');
      shelvesStore.clear(); productsStore.clear(); assignmentsStore.clear();
      for(const s of shelfMap.values()) shelvesStore.put(s);
      for(const p of products) productsStore.put(p);
      const first=shelfMap.get('A1')||[...shelfMap.values()][0];
      if(first) assignmentsStore.put({id:'a_catalog_primary',userId:'u_emp',shelfId:first.id,assignmentType:'primary',active:true});
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
    localStorage.setItem('raf_catalog_version',version);
  }catch(e){console.error('Catalog import failed',e);}
}
async function initAuth(){
  await seed();
  await ensureBundledCatalog();
  currentUser={
    id:'preview-system',
    app_user_id:'u_admin',
    username:'fatih',
    name:'Fatih Dumlu',
    role:'system_admin',
    active:true,
    preview:true
  };
  viewAsUserId=null;
  currentRole='superadmin';
  currentView='system';
  document.getElementById('authScreen').style.display='none';
  const logout=document.getElementById('logoutButton'); if(logout) logout.style.display='none';
  showApp();
  await render();
}

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
async function localAll(store){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(store,'readonly').objectStore(store).getAll();
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function localPut(store,obj){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const r=db.transaction(store,'readwrite').objectStore(store).put(obj);
    r.onsuccess=()=>resolve(obj); r.onerror=()=>reject(r.error);
  });
}
async function localClearAll(){
  const db=await openDB();
  const tx=db.transaction(Array.from(db.objectStoreNames),'readwrite');
  Array.from(db.objectStoreNames).forEach(n=>tx.objectStore(n).clear());
  return new Promise(res=>tx.oncomplete=res);
}

async function rafData(action,payload={}){
  const res=await fetch(RAF_DATA_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,token:authToken(),...payload})
  });
  const out=await res.json().catch(()=>({ok:false,error:'Veri sunucusu yanıtı okunamadı.'}));
  if(!res.ok&&out.ok!==true) throw new Error(out.error||'Veri işlemi başarısız.');
  return out;
}
async function all(store){
  if(currentUser&&authToken()&&!currentUser?.preview){
    const out=await rafData('all',{store});
    return out.rows||[];
  }
  return localAll(store);
}
async function put(store,obj){
  if(currentUser&&authToken()&&!currentUser?.preview){
    const out=await rafData('put',{store,obj});
    return out.obj||obj;
  }
  return localPut(store,obj);
}
async function clearAll(){
  if(currentUser&&authToken()&&!currentUser?.preview){
    await rafData('clear');
  }
  return localClearAll();
}
async function ensureRemoteSeeded(){
  if(!currentUser||!authToken()) return;
  const info=await rafData('count');
  if((info.count||0)>0) return;
  if(!isSystemAdmin()) return;
  const stores=['users','shelves','products','assignments','dailyChecks','issues','settings','notifications'];
  const records=[];
  for(const store of stores){
    const rows=await localAll(store);
    for(const obj of rows) records.push({store,obj});
  }
  if(records.length) await rafData('batch_seed',{records});
}

const today=()=>new Date().toISOString().slice(0,10);
const timeNow=()=>new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
const uid=(p='id')=>p+'_'+Math.random().toString(36).slice(2,9);
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function icon(name,size=20){
  const paths={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/><path d="M9 21v-7h6v7"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01"/>',
    chart:'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    box:'<path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    note:'<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    shelves:'<path d="M4 5h16M4 12h16M4 19h16"/><path d="M6 3v4M10 3v4M14 10v4M18 10v4M7 17v4M13 17v4"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    test:'<path d="M9 3h6"/><path d="M10 3v5l-5.5 9.2A2.5 2.5 0 0 0 6.6 21h10.8a2.5 2.5 0 0 0 2.1-3.8L14 8V3"/><path d="M8 15h8"/>',
    print:'<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    external:'<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/>',
    scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/><path d="M9 9v6M12 9v6M15 9v6"/>'
  };
  return '<svg class="sf-icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.alert)+'</svg>';
}


async function seed(){
  const users=await all('users');
  if(users.length) return;
  const demoUsers=[
    {id:'u_emp',name:'Ahmet Yılmaz',username:'ahmet',role:'employee',active:true},
    {id:'u_cash',name:'Elif Demir',username:'elifkasa',role:'cashier',active:true},
    {id:'u_wh',name:'Mustafa Kaya',username:'mustafa',role:'warehouse',active:true},
    {id:'u_mgr',name:'Selin Demir',username:'selin',role:'manager',active:true},
    {id:'u_admin',name:'Fatih Dumlu',username:'fatih',role:'superadmin',active:true},
  ];
  const shelves=[
    {id:'s1',name:'Dranken 01',department:'İçecek',location:'Gang 1 - Sol',approved:true,active:true},
    {id:'s2',name:'Dranken 02',department:'İçecek',location:'Gang 1 - Sağ',approved:true,active:true},
    {id:'s3',name:'Bakliyat 01',department:'Kuru Gıda',location:'Gang 4 - Sol',approved:true,active:true},
    {id:'s4',name:'Koeling 01',department:'Soğuk',location:'Koeling A',approved:false,active:true}
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
    {id:'a1',userId:'u_emp',shelfId:'s1',assignmentType:'primary',active:true},
    {id:'a2',userId:'u_emp',shelfId:'s2',assignmentType:'primary',active:true},
    {id:'a3',userId:'u_emp',shelfId:'s3',assignmentType:'primary',active:true},
    {id:'a4',userId:'u_emp',shelfId:'s4',assignmentType:'primary',active:true}
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
    ['home','home','Bugün'],['products','box','Ürünler'],['scanner','scan','Barkod'],['notifications','bell','Bildirim'],['issues','alert','Sorunlar'],['performance','chart','Performans']
  ];
  if(role==='cashier') return [
    ['home','alert','Sorun Bildir'],['products','box','Ürünler'],['scanner','scan','Barkod']
  ];
  if(role==='warehouse') return [
    ['home','box','Depo'],['products','box','Ürünler'],['scanner','scan','Barkod'],['notifications','bell','Bildirim'],['issues','alert','Bekleyen'],['history','clock','Geçmiş']
  ];
  if(role==='manager') return [
    ['home','home','Özet'],['products','box','Ürünler'],['scanner','scan','Barkod'],['issues','alert','Hatalar'],['shelves','shelves','Raflar']
  ];
  return [
    ['home','home','Panel'],['products','box','Ürünler'],['scanner','scan','Barkod'],['issues','alert','Hatalar'],['adminnotes','note','Notlar'],['shelves','shelves','Raflar']
  ];
}
function renderNav(){
  const nav=document.getElementById('bottomNav');
  const items=[...navFor(currentRole)];
  if(isSystemAdmin()&&!viewAsUserId){
    items.push(['sysusers','users','Kullanıcılar']);
  }
  nav.innerHTML=items.map(([v,ic,t])=>`<button data-view="${v}" class="${v===currentView?'active':''}"><span>${icon(ic,21)}</span>${t}</button>`).join('');
  nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    currentView=b.dataset.view;
    if(currentView!=='sysuserdetail') selectedSystemUserId=null;
    render();
  });
}

async function render(){
  renderNav();
  document.querySelectorAll('#roleTabs button').forEach(b=>b.classList.toggle('active',b.dataset.role===currentRole));
  const data=await snapshot();
  const app=document.getElementById('app');
  if(currentView==='home') app.innerHTML=await homeView(data);
  else if(currentView==='issues') app.innerHTML=issuesView(data);
  else if(currentView==='shelves') app.innerHTML=shelvesView(data);
  else if(currentView==='products') app.innerHTML=productsView(data);
  else if(currentView==='scanner') app.innerHTML=scannerView(data);
  else if(currentView==='system'&&isSystemAdmin()) app.innerHTML=await systemView(data);
  else if(currentView==='sysusers'&&isSystemAdmin()) app.innerHTML=await systemUsersView(data);
  else if(currentView==='sysuserdetail'&&isSystemAdmin()) app.innerHTML=systemUserDetailView(data,selectedSystemUserId);
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
  if(currentRole==='cashier') return cashierHome(data);
  if(currentRole==='warehouse') return warehouseHome(data);
  if(currentRole==='manager') return managerHome(data,false);
  return managerHome(data,true);
}
function employeeHome(data){
  const assigned=data.assignments.filter(a=>a.userId===activeAppUserId()&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
  const shelves=data.shelves.filter(s=>assigned.includes(s.id)&&s.active);
  if(employeeShelfId){
    const shelf=shelves.find(s=>s.id===employeeShelfId);
    if(shelf) return employeeShelfDetail(data,shelf);
    employeeShelfId=null;
  }
  const prog=shelves.map(s=>shelfProgress(data,s.id));
  const done=prog.filter(p=>p.complete).length;
  const pct=shelves.length?Math.round(done/shelves.length*100):0;
  const pending=shelves.filter(s=>s.approved!==true);
  return `
  <section class="hero">
    <div class="hero-row"><div><div class="eyebrow">Bugünkü görev</div><h1>Rafları kontrol et</h1><p>Rafa gir, metre/kat/sıra seç ve bölümü topluca onayla.</p></div><div class="score">${pct}%</div></div>
    <div class="progress"><span style="width:${pct}%"></span></div>
  </section>
  ${employeeReminderBanner(data,shelves)}
  ${pending.length?`<div class="section-title"><h2>Onaylanmamış Raflar</h2><small>${pending.length} raf</small></div>${pending.map(s=>`<div class="notice pending-shelf"><b>Onay bekliyor:</b> ${esc(s.name)}<br><span>${esc(s.location||'')}</span></div>`).join('')}`:''}
  <div class="employee-tools">
    <button class="tool-card employee-product-search"><span class="tool-icon">${icon('box',22)}</span><span><strong>Ürün ara</strong><small>Ad veya barkod ile bul</small></span></button>
    <button class="tool-card employee-barcode-scan"><span class="tool-icon">${icon('test',22)}</span><span><strong>Barkod oku</strong><small>Ürün kartını aç</small></span></button>
  </div>
  <div class="section-title"><h2>Raflarım</h2><small>${done}/${shelves.length} tamamlandı</small></div>
  ${shelves.map(s=>employeeShelfTile(data,s)).join('')}
  `;
}

function employeeShelfTile(data,shelf){
  const progress=shelfProgress(data,shelf.id);
  const products=data.products.filter(p=>p.shelfId===shelf.id&&p.active&&p.required);
  const meters=[...new Set(products.map(p=>p.meter).filter(v=>v!=null))].sort((a,b)=>a-b);
  return '<button class="card employee-open-shelf" data-shelf="'+shelf.id+'"><div class="card-pad shelf-head"><div><div class="shelf-title">'+esc(shelf.name)+'</div><div class="sub">'+products.length+' ürün · '+meters.length+' metre · '+progress.done+'/'+progress.total+' kontrol</div></div><span class="badge '+(shelf.approved!==true?'warn':progress.complete?'ok':'dark')+'">'+(shelf.approved!==true?'Onaylanmamış':progress.complete?'Tamamlandı':'Aç')+'</span></div></button>';
}

function employeeShelfDetail(data,shelf){
  const allProducts=data.products.filter(p=>p.shelfId===shelf.id&&p.active&&p.required).sort((a,b)=>(a.meter||0)-(b.meter||0)||(a.level||0)-(b.level||0)||(a.position||0)-(b.position||0));
  const meters=[...new Set(allProducts.map(p=>p.meter).filter(v=>v!=null))].sort((a,b)=>a-b);
  const meterProducts=employeeMeter==='all'?allProducts:allProducts.filter(p=>String(p.meter)===String(employeeMeter));
  const levels=[...new Set(meterProducts.map(p=>p.level).filter(v=>v!=null))].sort((a,b)=>a-b);
  const levelProducts=employeeLevel==='all'?meterProducts:meterProducts.filter(p=>String(p.level)===String(employeeLevel));
  const positions=[...new Set(levelProducts.map(p=>p.position).filter(v=>v!=null))].sort((a,b)=>a-b);
  const filtered=employeePosition==='all'?levelProducts:levelProducts.filter(p=>String(p.position)===String(employeePosition));
  const checks=todaysChecks(data);
  const meterStatus=meters.map(m=>{
    const products=allProducts.filter(p=>String(p.meter)===String(m));
    const done=products.filter(p=>checks.some(x=>x.productId===p.id&&x.shelfId===shelf.id)).length;
    return {meter:m,total:products.length,done,complete:products.length>0&&done===products.length};
  });
  const selectedMeterStatus=employeeMeter==='all'?null:meterStatus.find(x=>String(x.meter)===String(employeeMeter));
  const meterOpts='<option value="all">Metre seç</option>'+meters.map(v=>'<option value="'+v+'" '+(String(employeeMeter)===String(v)?'selected':'')+'>Metre '+v+'</option>').join('');
  const levelOpts='<option value="all">Tüm katlar</option>'+levels.map(v=>'<option value="'+v+'" '+(String(employeeLevel)===String(v)?'selected':'')+'>Kat '+v+'</option>').join('');
  const posOpts='<option value="all">Tüm sıralar</option>'+positions.map(v=>'<option value="'+v+'" '+(String(employeePosition)===String(v)?'selected':'')+'>Sıra '+v+'</option>').join('');
  const meterCards=meterStatus.map(m=>'<button class="meter-status-card employee-select-meter '+(String(employeeMeter)===String(m.meter)?'active':'')+'" data-meter="'+m.meter+'"><strong>Metre '+m.meter+'</strong><span>'+m.done+'/'+m.total+' ürün</span><span class="badge '+(m.complete?'ok':'dark')+'">'+(m.complete?'Tamamlandı':'Bekliyor')+'</span></button>').join('');
  return '<div class="employee-detail-nav"><button class="back-home-btn" id="backEmployeeShelves">← Raflarıma dön</button>'+(employeeMeter!=='all'?'<button class="back-home-btn" id="backToMeters">← Metrelere dön</button>':'')+'</div>'
    +'<div class="section-title"><h2>'+esc(shelf.name)+'</h2><small>'+allProducts.length+' ürün</small></div>'
    +'<div id="meterListAnchor" class="section-title"><h2>Metreler</h2><small>'+meters.length+' bölüm</small></div>'
    +'<div class="meter-status-grid">'+meterCards+'</div>'
    +'<div id="meterControlSection" class="card meter-control-card"><div class="card-pad form-grid">'
    +'<div class="filter-triple"><label>Metre<select id="employeeMeterFilter">'+meterOpts+'</select></label><label>Kat<select id="employeeLevelFilter" '+(employeeMeter==='all'?'disabled':'')+'>'+levelOpts+'</select></label><label>Sıra<select id="employeePositionFilter" '+(employeeMeter==='all'?'disabled':'')+'>'+posOpts+'</select></label></div>'
    +'<div class="btn-row"><button class="btn secondary employee-product-search">Ürün ara</button><button class="btn secondary employee-barcode-scan">Barkod oku</button></div>'
    +(employeeMeter==='all'
      ?'<div class="notice"><b>Önce bir metre seç.</b><br>Toplu onay yalnızca tek bir metre için yapılabilir.</div>'
      :selectedMeterStatus?.complete
        ?'<div class="notice" style="background:#e8f7ef;border-color:#a8dfc2;color:#0f6d43"><b>✓ Metre '+esc(employeeMeter)+' bugün tamamen onaylandı.</b></div>'
        :'<button class="btn success full approve-meter" data-shelf="'+shelf.id+'" data-meter="'+employeeMeter+'">✓ Metre '+esc(employeeMeter)+' — tamamını sorun yok diye onayla</button>')
    +'</div></div>'
    +'<div class="section-title"><h2>'+ (employeeMeter==='all'?'Tüm ürünler':'Metre '+esc(employeeMeter)+' ürünleri') +'</h2><small>'+filtered.length+'</small></div>'
    +(filtered.length?filtered.map(p=>productCardHtml(data,p,true)).join(''):'<div class="card empty">Bu seçimde ürün yok.</div>');
}

function shelfCard(data,shelf){
  const pr=data.products.filter(p=>p.shelfId===shelf.id&&p.active&&p.required);
  const checks=todaysChecks(data).filter(c=>c.shelfId===shelf.id);
  const progress=shelfProgress(data,shelf.id);
  return `<article class="card">
    <div class="card-pad shelf-head">
      <div><div class="shelf-title">${esc(shelf.name)}</div><div class="sub">${esc(shelf.location)} · ${progress.done}/${progress.total} ürün</div></div>
      <span class="badge ${shelf.approved!==true?'warn':progress.complete?'ok':'dark'}">${shelf.approved!==true?'Onaylanmamış':progress.complete?'Tamamlandı':'Kontrol et'}</span>
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
  const direct=(data.notifications||[]).filter(n=>n.targetUserId===activeAppUserId()&&!n.closed);
  if(!missing.length&&!direct.length) return '<div class="notice" style="background:#e8f7ef;border-color:#a8dfc2;color:#0f6d43"><b>✓ Şu ana kadar gözden kaçan kontrol görünmüyor.</b></div>';
  const parts=[];
  if(direct.length) parts.push('<b>🔔 '+direct.length+' yönetici bildirimin var.</b>');
  if(missing.length) parts.push('<b>⚠ '+missing.length+' ürün henüz kontrol edilmedi.</b> Bildirim ekranından nerede olduklarını görebilirsin.');
  return '<button class="notice notice-button open-notifications">'+parts.join('<br>')+'</button>';
}

function shelfOwner(data,shelfId){
  const a=data.assignments.find(x=>x.shelfId===shelfId&&x.active&&x.assignmentType!=='backup');
  return a?data.users.find(u=>u.id===a.userId):null;
}
function shelfBackup(data,shelfId){
  const a=data.assignments.find(x=>x.shelfId===shelfId&&x.active&&x.assignmentType==='backup');
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
  const shelfIds=data.assignments.filter(a=>a.userId===userId&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
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
  const targetUser=['employee','warehouse','cashier'].includes(currentRole)?activeAppUserId():null;
  const direct=(data.notifications||[]).filter(n=>(!targetUser||n.targetUserId===targetUser)&&!n.closed).sort((a,b)=>b.ts-a.ts);
  const cards=[];
  if(currentRole==='employee'){
    const assigned=data.assignments.filter(a=>a.userId===activeAppUserId()&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
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

function cashierHome(data){
  const recent=data.issues.filter(i=>i.reportedBy===activeAppUserId()).sort((a,b)=>b.ts-a.ts).slice(0,5);
  return '<section class="hero"><div class="eyebrow">Kasa kullanıcısı</div><h1>Ürün sorunu bildir</h1><p>Ürünü yaz veya barkodu okut. Ürün kartı açıldığında kasa sorununu seç.</p></section>'
    +'<div class="card"><div class="card-pad form-grid">'
    +'<button class="btn full open-barcode-camera">'+icon('scan',18)+' Barkod okut</button>'
    +'<label>Ürün ara<input id="cashProductSearch" placeholder="Ürün adı veya barkod yaz" autocomplete="off"></label>'
    +'<div id="cashProductResults" class="search-results"><div class="sub">Ürün yazınca sonucu seç; kart açılacak.</div></div>'
    +'</div></div>'
    +'<div class="section-title"><h2>Son bildirdiklerim</h2><small>'+recent.length+' kayıt</small></div>'
    +(recent.length?recent.map(i=>issueCard(data,i,false)).join(''):'<div class="card empty">Henüz kasa sorunu bildirilmedi.</div>');
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
  ${isAdmin?'<div class="btn-row admin-actions" style="margin:0 0 12px"><button class="btn" id="sendNotification">'+icon('bell',18)+'<span>Uyarı gönder</span></button><button class="btn secondary" id="openTestCenter">'+icon('test',18)+'<span>Test Merkezi</span></button></div>':''}
  <div class="grid">
    <button class="metric metric-link dashboard-filter" data-filter="unchecked"><b>${done}/${activeShelves.length}</b><span>Raf tamamlandı</span><small>${activeShelves.length-done} raf kaldı</small></button>
    <button class="metric metric-link dashboard-filter" data-filter="all"><b>${issues.length}</b><span>Açık sorun</span><small>Tümünü gör</small></button>
    <button class="metric metric-link dashboard-filter" data-filter="expired"><b>${issues.filter(i=>i.type==='expired').length}</b><span>Tarihi geçmiş</span><small>Filtreli gör</small></button>
    <button class="metric metric-link dashboard-filter" data-filter="expiring"><b>${issues.filter(i=>i.type==='expiring').length}</b><span>Tarihi yaklaşan</span><small>Filtreli gör</small></button>
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
  ${isAdmin?'<div class="filter-card admin-home-filter"><label>Kullanıcı<select id="homeIssueUserFilter"><option value="all">Tüm kullanıcılar</option>'+data.users.filter(u=>u.active&&['employee','cashier'].includes(u.role)).map(u=>'<option value="'+u.id+'" '+(issueUserFilter===u.id?'selected':'')+'>'+esc(u.name)+'</option>').join('')+'</select></label><label>Sorun türü<select id="homeIssueTypeFilter">'+[['all','Tüm sorunlar'],['unchecked','Kontrol edilmemiş raflar'],['expiring','Tarihi yaklaşıyor'],['expired','Tarihi geçmiş'],['low','Stok az'],['missing','Rafta yok'],['damaged','Hasarlı / bozuk'],['label_missing','Raf etiketi yok'],['label_wrong','Raf etiketi yanlış'],
      ['cash_price_wrong','Fiyat yanlış'],
      ['cash_not_scanning','Kasada çıkmıyor / barkod okunmuyor'],
      ['cash_discount_missing','İndirim uygulanmıyor'],
      ['cash_barcode_mismatch','Ürün / barkod eşleşmiyor']].map(([v,l])=>'<option value="'+v+'" '+(issueTypeFilter===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><button class="btn secondary full" id="homeClearIssueFilters">Filtreleri temizle</button></div>':''}
  ${issues.filter(i=>!isAdmin||((issueUserFilter==='all'||i.reportedBy===issueUserFilter)&&(issueTypeFilter==='all'||i.type===issueTypeFilter))).slice(0,6).map(i=>issueCard(data,i,false)).join('')||'<div class="card empty">Bu filtreye uygun açık sorun yok.</div>'}
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
  if(['manager','superadmin'].includes(currentRole)&&issueOpen(i)){
    action+=`<div class="btn-row"><button class="btn success resolve-issue" data-id="${i.id}">${icon('check',17)}<span>Yapıldı / Onayla</span></button></div>`;
  }
  return `<article class="card ${cls}"><div class="card-pad"><div><strong>${esc(p?.name||'Ürün')}</strong>
  <div class="meta"><b>${STATUS[i.type]?.label||i.type}</b>${i.qty!=null?' · '+i.qty+' '+esc(i.unit||''):''}${i.expiry?' · SKT '+esc(i.expiry):''}<br>${esc(s?.name||p?.shelfCode||'')}${p?.meter!=null?' · Metre '+esc(p.meter):''}${p?.level!=null?' · Kat '+esc(p.level):''}${p?.position!=null?' · Sıra '+esc(p.position):''}${p?.locationCode?'<br>Konum: '+esc(p.locationCode):''}<br>${esc(u?.name||'')} · ${esc(i.time||'')}</div>${action}</div><span class="badge ${STATUS[i.type]?.cls||'dark'}">${i.state==='reported'?'Yeni':i.state==='warehouse_found'?'Bulundu':i.state==='warehouse_none'?'Depoda yok':'Açık'}</span></div></article>`;
}
function issuesView(data){
  let issues=data.issues.filter(issueOpen);
  if(currentRole==='employee'){
    const shelfIds=data.assignments.filter(a=>a.userId===activeAppUserId()&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
    issues=issues.filter(i=>shelfIds.includes(i.shelfId));
  }
  if(currentRole==='cashier') issues=issues.filter(i=>i.reportedBy===activeAppUserId());
  if(currentRole==='warehouse') issues=issues.filter(i=>i.type==='missing');

  if(currentRole==='superadmin'&&issueTypeFilter==='unchecked'){
    const shelves=data.shelves.filter(s=>s.active&&!shelfProgress(data,s.id).complete);
    const cards=shelves.map(s=>{
      const pg=shelfProgress(data,s.id);
      const owner=shelfOwner(data,s.id);
      return '<div class="card"><div class="card-pad"><div class="simple-row"><div><strong>'+esc(s.name)+'</strong><div class="meta">'+pg.done+'/'+pg.total+' ürün kontrol edildi · '+Math.max(0,pg.total-pg.done)+' kaldı'+(owner?'<br>Sorumlu: '+esc(owner.name):'')+'</div></div><span class="badge '+(afterDeadline(data.settings)?'danger':'dark')+'">'+(afterDeadline(data.settings)?'Gecikti':'Bekliyor')+'</span></div></div></div>';
    }).join('');
    return '<button class="back-home-btn" id="backAdminHome">'+icon('home',18)+'<span>Ana ekrana dön</span></button>'
      +'<div class="section-title"><h2>Kontrol edilmemiş raflar</h2><small>'+shelves.length+' raf</small></div>'
      +'<button class="btn secondary full" id="backToAllIssues" style="margin-bottom:12px">Tüm sorunlara dön</button>'
      +(cards||'<div class="card empty">Kontrol bekleyen raf yok.</div>');
  }

  if(currentRole==='superadmin'){
    if(issueUserFilter!=='all') issues=issues.filter(i=>i.reportedBy===issueUserFilter);
    if(issueTypeFilter!=='all') issues=issues.filter(i=>i.type===issueTypeFilter);

    const employeeOptions=data.users
      .filter(u=>u.active&&u.role==='employee')
      .map(u=>'<option value="'+u.id+'" '+(issueUserFilter===u.id?'selected':'')+'>'+esc(u.name)+'</option>')
      .join('');

    const typeOptions=[
      ['all','Tüm sorunlar'],
      ['unchecked','Kontrol edilmemiş raflar'],
      ['expiring','Tarihi yaklaşıyor'],
      ['expired','Tarihi geçmiş'],
      ['low','Stok az'],
      ['missing','Rafta yok'],
      ['damaged','Hasarlı / bozuk'],
      ['label_missing','Raf etiketi yok'],
      ['label_wrong','Raf etiketi yanlış']
    ].map(([v,l])=>'<option value="'+v+'" '+(issueTypeFilter===v?'selected':'')+'>'+l+'</option>').join('');

    return '<button class="back-home-btn" id="backAdminHome">'+icon('home',18)+'<span>Ana ekrana dön</span></button>'
      +'<div class="section-title"><h2>Hata / Sorunlar</h2><small>'+issues.length+' açık</small></div>'
      +'<div class="filter-card">'
      +'<label>Kullanıcı<select id="issueUserFilter"><option value="all">Tüm kullanıcılar</option>'+employeeOptions+'</select></label>'
      +'<label>Sorun türü<select id="issueTypeFilter">'+typeOptions+'</select></label>'
      +'<button class="btn secondary full" id="clearIssueFilters">Filtreleri temizle</button>'
      +'</div>'
      +(issues.length?issues.map(i=>issueCard(data,i,false)).join(''):'<div class="card empty">Bu filtreye uygun açık sorun yok.</div>');
  }

  return '<div class="section-title"><h2>Hata / Sorunlar</h2><small>'+issues.length+' açık</small></div>'
    +(issues.length?issues.map(i=>issueCard(data,i,currentRole==='warehouse')).join(''):'<div class="card empty">Açık sorun yok.</div>');
}

function shelvesView(data){
  const canManageShelf=currentRole==='superadmin';
  const canManageProducts=['manager','superadmin'].includes(currentRole);
  const activeShelves=data.shelves.filter(s=>s.active);
  const selected=selectedShelfId?data.shelves.find(s=>s.id===selectedShelfId&&s.active):null;
  if(selected){
    const ps=data.products.filter(p=>p.shelfId===selected.id&&p.active).sort((x,y)=>(x.meter||0)-(y.meter||0)||(x.level||0)-(y.level||0)||(x.position||0)-(y.position||0)||x.name.localeCompare(y.name,'tr'));
    const owner=shelfOwner(data,selected.id);
    const backup=shelfBackup(data,selected.id);
    return '<button class="back-home-btn" id="backShelfList">← Raflara dön</button>'
      +'<div class="section-title"><h2>'+esc(selected.name)+'</h2><small>'+ps.length+' ürün</small></div>'
      +'<div class="card"><div class="card-pad"><div class="meta">'+esc(selected.department)+' · '+esc(selected.location)+'</div>'
      +'<div class="owner-link">👤 Ana sorumlu: '+esc(owner?.name||'Atanmamış')+'</div>'
      +'<div class="owner-link backup-person">↪ Yedek: '+esc(backup?.name||'Yok')+'</div>'
      +(canManageShelf?'<button class="btn secondary assign-shelf-user" data-shelf="'+selected.id+'">Sorumlu Ata</button>':'')
      +(canManageProducts&&selected.approved!==true?'<button class="btn success approve-shelf" data-shelf="'+selected.id+'">✓ Rafı Onayla</button>':'')
      +(canManageProducts?'<button class="btn full add-product" data-shelf="'+selected.id+'">+ Bu rafa ürün ekle</button>':'')
      +'</div></div>'
      +(ps.length?ps.map(p=>productCardHtml(data,p,true)).join(''):'<div class="card empty">Bu rafta henüz ürün yok.</div>');
  }
  return '<div class="section-title"><h2>Raflar</h2>'
    +(canManageShelf?'<div class="shelf-admin-actions"><button class="btn secondary" id="importExcel">Excel Yükle</button><button class="btn" id="addShelf">+ Raf</button></div>':'')
    +'</div>'
    +'<div class="shelf-grid">'
    +activeShelves.map(s=>{
      const count=data.products.filter(p=>p.shelfId===s.id&&p.active).length;
      const owner=shelfOwner(data,s.id);
      return '<button class="card shelf-select-card" data-shelf="'+s.id+'"><div class="card-pad">'
        +'<strong>'+esc(s.name)+'</strong>'
        +'<div class="meta">'+esc(s.department)+' · '+esc(s.location)+'<br>'+count+' ürün<br>Ana: '+esc(owner?.name||'Atanmamış')+'<br>'+(s.approved===true?'✓ Onaylı':'⚠ Onaylanmamış')+'</div>'
        +'</div></button>';
    }).join('')
    +'</div>';
}

function productCardHtml(data,p,openable=true){
  const s=data.shelves.find(x=>x.id===p.shelfId);
  const owner=s?shelfOwner(data,s.id):null;
  const backup=s?shelfBackup(data,s.id):null;
  const editable=['manager','superadmin'].includes(currentRole);
  const employeeOwns=currentRole==='employee'&&owner?.id===activeAppUserId();
  const actionLabel=employeeOwns?'⚠ Sorun bildir':currentRole==='cashier'?'⚠ Kasa sorunu bildir':currentRole==='superadmin'?'Düzenle':'Admine bilgi ver';
  const actionClass=(employeeOwns||currentRole==='cashier')?'danger':'secondary';
  return '<article class="card product-info-card">'
    +'<div class="card-pad">'
    +'<div class="simple-row"><div><strong>'+esc(p.name)+'</strong><div class="meta">'+esc(p.barcode||'Barkod yok')+' · '+esc(p.unit||'')+'</div></div>'
    +(editable?'<span class="badge blue">Yönetilebilir</span>':'<span class="badge dark">Ürün</span>')+'</div>'
    +'<div class="product-location-hero compact">'
      +'<div><b>Raf</b><span>'+esc(s?.name||p.shelfCode||'-')+'</span></div>'
      +'<div><b>Metre</b><span>'+esc(p.meter??'-')+'</span></div>'
      +'<div><b>Kat</b><span>'+esc(p.level??'-')+'</span></div>'
      +'<div><b>Sıra</b><span>'+esc(p.position??'-')+'</span></div>'
    +'</div>'
    +'<div class="product-location-line"><b>Konum:</b> '+esc(p.locationCode||'-')+'</div>'
    +'<div class="product-location-line"><b>Raf sorumlusu:</b> '+esc(owner?.name||'Atanmamış')+'</div>'
    +(backup?'<div class="product-location-line"><b>Yedek:</b> '+esc(backup.name)+'</div>':'')
    +(openable?'<div class="product-card-actions"><button class="btn secondary product-card-detail" data-product="'+p.id+'">Detay</button><button class="btn '+actionClass+' product-card-action" data-product="'+p.id+'">'+actionLabel+'</button></div>':'')
    +'</div></article>';
}

function scannerView(data){
  return '<section class="hero"><div class="eyebrow">Barkod</div><h1>Ürünü okut</h1><p>Kamerayı barkoda tut. Ürün bulunduğunda kartı otomatik açılır.</p></section>'
    +'<div class="card"><div class="card-pad form-grid">'
    +'<button class="btn full open-barcode-camera">'+icon('scan',20)+' Kamerayı aç</button>'
    +'<label>Barkodu elle gir<input id="manualBarcodeInput" inputmode="numeric" placeholder="Barkod numarası"></label>'
    +'<button class="btn secondary full" id="manualBarcodeFind">Ürünü bul</button>'
    +'<div class="sub">Kamera tüm kullanıcılarda kullanılabilir. İşlem yetkisi kullanıcı rolüne göre değişir.</div>'
    +'</div></div>';
}
function productsView(data){
  return '<div class="section-title"><h2>Ürünler</h2><small>'+data.products.filter(p=>p.active).length+' ürün</small></div>'
    +'<div class="card"><div class="card-pad form-grid"><div class="btn-row"><button class="btn secondary full open-barcode-camera">'+icon('scan',18)+' Barkod oku</button></div><label>Ürün / barkod ara<input id="globalProductSearch" placeholder="Ürün adı veya barkod yaz" autocomplete="off"></label>'
    +'<div id="globalProductResults" class="search-results"><div class="sub">Aramaya başla. Ürün kartında raf ve sorumlular görünür.</div></div></div></div>';
}
function employeeProductSearchModal(data){
  openModal('Ürün ara','<div class="form-grid"><label>Ürün adı / barkod<input id="employeeSearchInput" placeholder="Yazmaya başla" autocomplete="off"></label><div id="employeeSearchResults" class="search-results"><div class="sub">Ürün adı veya barkod yaz.</div></div></div>');
  const input=document.getElementById('employeeSearchInput');
  input.oninput=()=>{
    const rows=productSearchRows(data,input.value);
    const box=document.getElementById('employeeSearchResults');
    box.innerHTML=rows.length?rows.map(p=>productSearchCard(data,p,false)).join(''):'<div class="sub">Eşleşen ürün bulunamadı.</div>';
    box.querySelectorAll('.open-product').forEach(b=>b.onclick=()=>productDetailModal(data,b.dataset.product));
  };
}

let barcodeTestIndex=0;
function normalizeBarcode(value){
  return String(value??'').trim().replace(/\.0+$/,'').replace(/[^0-9A-Za-z]/g,'').toUpperCase();
}
function findProductByBarcode(data,value){
  const raw=normalizeBarcode(value);
  if(!raw) return null;
  let p=data.products.find(x=>normalizeBarcode(x.barcode)===raw);
  if(p) return p;
  const digits=raw.replace(/\D/g,'');
  if(!digits) return null;
  p=data.products.find(x=>{
    const b=normalizeBarcode(x.barcode).replace(/\D/g,'');
    if(b===digits) return true;
    if(b.length===13&&b.startsWith('0')&&b.slice(1)===digits) return true;
    if(digits.length===13&&digits.startsWith('0')&&digits.slice(1)===b) return true;
    return false;
  });
  return p||null;
}
function barcodeScannerModal(data){
  const products=data.products.filter(p=>p.active);
  openModal('Barkod oku','<div class="form-grid"><video id="barcodeVideo" playsinline muted autoplay style="width:100%;border-radius:18px;background:#111;min-height:220px"></video><div id="barcodeStatus" class="sub">Kamera açılıyor...</div><button class="btn secondary full" id="testBarcodeScan">Test: farklı ürün aç</button></div>');
  let stream=null,stopped=false,zxingControls=null;
  const cleanup=()=>{stopped=true;if(zxingControls?.stop)zxingControls.stop();if(stream)stream.getTracks().forEach(t=>t.stop());};
  const oldClose=document.getElementById('modalClose').onclick;
  document.getElementById('modalClose').onclick=()=>{cleanup();closeModal();document.getElementById('modalClose').onclick=oldClose;};
  const openProduct=p=>{if(!p)return;cleanup();try{closeModal();}catch(e){}setTimeout(()=>productDetailModal(data,p.id),220);};
  document.getElementById('testBarcodeScan').onclick=()=>{
    if(!products.length){alert('Ürün bulunamadı.');return;}
    barcodeTestIndex=(barcodeTestIndex+1)%products.length;
    openProduct(products[barcodeTestIndex]);
  };
  const status=document.getElementById('barcodeStatus');
  const video=document.getElementById('barcodeVideo');
  const start=async()=>{
    if(!navigator.mediaDevices?.getUserMedia){status.textContent='Bu cihazda kamera erişimi desteklenmiyor.';return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(stopped)return;
      video.srcObject=stream;await video.play();
      status.textContent='Kamera açık. Barkodu çerçeveye getir.';
      if('BarcodeDetector' in window){
        const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39']});
        const tick=async()=>{
          if(stopped)return;
          try{
            const codes=await detector.detect(video);
            if(codes.length){
              const raw=String(codes[0].rawValue||'').trim();
              status.textContent='Barkod: '+raw;
              const p=findProductByBarcode(data,raw);
              if(p){openProduct(p);return;}
              status.textContent='Barkod okundu ama sistemde ürün bulunamadı: '+raw;
            }
          }catch(e){}
          if(!stopped) requestAnimationFrame(tick);
        };
        tick();
        return;
      }
      if(window.ZXingBrowser?.BrowserMultiFormatReader){
        stream.getTracks().forEach(t=>t.stop());stream=null;
        const reader=new ZXingBrowser.BrowserMultiFormatReader();
        zxingControls=await reader.decodeFromVideoDevice(undefined,video,(result,error,controls)=>{
          if(stopped)return;
          if(result){
            const raw=String(result.getText?.()||result.text||'').trim();
            status.textContent='Barkod: '+raw;
            const p=findProductByBarcode(data,raw);
            if(p){zxingControls=controls;openProduct(p);}
            else status.textContent='Barkod okundu ama sistemde ürün bulunamadı: '+raw;
          }
        });
        return;
      }
      status.textContent='Kamera açık. Bu tarayıcı otomatik barkod algılamayı desteklemiyor; test butonunu kullanabilirsin.';
    }catch(e){
      status.textContent='Kamera açılamadı. Tarayıcı kamera izni vermeli.';
    }
  };
  start();
}

function productLocationHtml(data,p){
  const s=data.shelves.find(x=>x.id===p.shelfId);
  const owner=s?shelfOwner(data,s.id):null;
  const backup=s?shelfBackup(data,s.id):null;
  return '<div class="product-location-hero">'
    +'<div><b>Raf</b><span>'+esc(s?.name||p.shelfCode||'-')+'</span></div>'
    +'<div><b>Metre</b><span>'+esc(p.meter??'-')+'</span></div>'
    +'<div><b>Kat</b><span>'+esc(p.level??'-')+'</span></div>'
    +'<div><b>Sıra</b><span>'+esc(p.position??'-')+'</span></div>'
    +'</div>'
    +'<div class="card" style="box-shadow:none"><div class="card-pad"><b>Konum Kodu:</b> '+esc(p.locationCode||'-')+'<br><b>Raf sorumlusu:</b> '+esc(owner?.name||'Atanmamış')+(backup?'<br><b>Yedek:</b> '+esc(backup.name):'')+'</div></div>';
}

async function sendAdminProductInfo(data,p,note){
  const s=data.shelves.find(x=>x.id===p.shelfId);
  const owner=s?shelfOwner(data,s.id):null;
  const who=data.users.find(u=>u.id===activeAppUserId());
  const loc=(s?.name||p.shelfCode||'Raf')+' · Metre '+(p.meter??'-')+' · Kat '+(p.level??'-')+' · Sıra '+(p.position??'-');
  for(const admin of data.users.filter(u=>u.active&&u.role==='superadmin')){
    await put('notifications',{id:uid('n'),targetUserId:admin.id,shelfId:p.shelfId,title:'Ürün hakkında bilgi',message:(who?.name||ROLE_NAMES[currentRole]||'Kullanıcı')+' · '+p.name+' · '+loc+(owner?' · Raf sorumlusu: '+owner.name:'')+(note?' · '+note:''),read:false,closed:false,ts:Date.now(),time:timeNow(),sentBy:activeAppUserId()});
  }
}

function adminInfoModal(data,p){
  openModal('Admine bilgi ver','<div class="form-grid">'+productLocationHtml(data,p)+'<label>Bilgi / Not<textarea id="adminProductInfo" rows="4" placeholder="Adminin bilmesi gereken durumu yaz"></textarea></label><button class="btn full" id="sendAdminProductInfo">Admine gönder</button></div>');
  document.getElementById('sendAdminProductInfo').onclick=async()=>{
    const note=document.getElementById('adminProductInfo').value.trim();
    if(!note){alert('Kısa bir bilgi yazın.');return;}
    await sendAdminProductInfo(data,p,note);
    closeModal();
    alert('Bilgi admine gönderildi.');
  };
}

function cashierIssueModal(data,p){
  const s=data.shelves.find(x=>x.id===p.shelfId);
  const owner=s?shelfOwner(data,s.id):null;
  openModal('Kasa sorunu bildir','<div class="form-grid">'+productLocationHtml(data,p)
    +'<div class="issue-group"><div class="issue-group-title">Kasa sorunu</div>'
    +'<label class="check-row"><input type="radio" name="cashModalIssue" value="cash_price_wrong"> Fiyat yanlış</label>'
    +'<label class="check-row"><input type="radio" name="cashModalIssue" value="cash_not_scanning"> Kasada çıkmıyor / barkod okunmuyor</label>'
    +'<label class="check-row"><input type="radio" name="cashModalIssue" value="cash_discount_missing"> İndirim uygulanmıyor</label>'
    +'<label class="check-row"><input type="radio" name="cashModalIssue" value="cash_barcode_mismatch"> Ürün / barkod eşleşmiyor</label></div>'
    +'<label>Not <span class="sub">(isteğe bağlı)</span><textarea id="cashModalNote" rows="3"></textarea></label>'
    +'<button class="btn danger full" id="submitCashModalIssue">Sorunu gönder</button></div>');
  document.getElementById('submitCashModalIssue').onclick=async()=>{
    const type=document.querySelector('input[name="cashModalIssue"]:checked')?.value;
    if(!type){alert('Sorun türünü seçin.');return;}
    const note=document.getElementById('cashModalNote').value||'';
    const issue={id:uid('i'),date:today(),time:timeNow(),ts:Date.now(),productId:p.id,shelfId:p.shelfId,type,state:'reported',reportedBy:activeAppUserId(),source:'cashier',note,assignedToUserId:owner?.id||null,visibility:['employee','manager','superadmin']};
    await put('issues',issue);
    const loc=(s?.name||p.shelfCode||'Raf')+' · Metre '+(p.meter??'-')+' · Kat '+(p.level??'-')+' · Sıra '+(p.position??'-');
    if(owner) await put('notifications',{id:uid('n'),targetUserId:owner.id,shelfId:p.shelfId,title:'Kasadan ürün sorunu',message:p.name+' · '+(STATUS[type]?.label||type)+' · '+loc+(note?' · '+note:''),read:false,closed:false,ts:Date.now(),time:timeNow(),sourceIssueId:issue.id});
    for(const admin of data.users.filter(u=>u.active&&u.role==='superadmin')) await put('notifications',{id:uid('n'),targetUserId:admin.id,shelfId:p.shelfId,title:'Kasadan ürün sorunu',message:p.name+' · '+(STATUS[type]?.label||type)+' · '+loc+(owner?' · Raf sorumlusu: '+owner.name:'')+(note?' · '+note:''),read:false,closed:false,ts:Date.now(),time:timeNow(),sourceIssueId:issue.id});
    closeModal();
    alert('Sorun raf sorumlusuna ve admine gönderildi.');
  };
}
function openProductAction(data,p){
  if(!p) return;
  if(currentRole==='employee'){
    const owner=shelfOwner(data,p.shelfId);
    if(owner?.id===activeAppUserId()){
      try{closeModal();}catch(e){}
      setTimeout(()=>showMultiIssueForm(data,p,p.shelfId),40);
    }else{
      adminInfoModal(data,p);
    }
    return;
  }
  if(currentRole==='cashier'){
    cashierIssueModal(data,p);
    return;
  }
  if(currentRole==='superadmin'){
    productDetailModal(data,p.id);
    return;
  }
  adminInfoModal(data,p);
}
function productDetailModal(data,productId){
  const p=data.products.find(x=>x.id===productId);
  if(!p) return;
  const s0=data.shelves.find(x=>x.id===p.shelfId);
  const owner0=s0?shelfOwner(data,s0.id):null;
  const employeeOwns=currentRole==='employee'&&owner0?.id===activeAppUserId();
  const editable=['manager','superadmin'].includes(currentRole);
  const actionLabel=employeeOwns?'⚠ Sorun bildir':currentRole==='cashier'?'⚠ Kasa sorunu bildir':'Admine bilgi ver';
  if(!editable){
    openModal('Ürün kartı','<div class="form-grid"><div><strong>'+esc(p.name)+'</strong><div class="meta">'+esc(p.barcode||'Barkod yok')+' · '+esc(p.unit||'')+'</div></div>'+productLocationHtml(data,p)+'<button class="btn '+((employeeOwns||currentRole==='cashier')?'danger':'secondary')+' full" id="productCardAction">'+actionLabel+'</button></div>');
    document.getElementById('productCardAction').onclick=()=>openProductAction(data,p);
    return;
  }
  const s=data.shelves.find(x=>x.id===p.shelfId);
  const owner=s?shelfOwner(data,s.id):null;
  const backup=s?shelfBackup(data,s.id):null;
  const shelfOptions=data.shelves.filter(x=>x.active).map(x=>'<option value="'+x.id+'" '+(x.id===p.shelfId?'selected':'')+'>'+esc(x.name)+'</option>').join('');
  openModal('Ürün kartı','<div class="form-grid"><div><strong>'+esc(p.name)+'</strong><div class="meta">'+esc(p.barcode||'Barkod yok')+'</div></div>'+productLocationHtml(data,p)
    +'<label>Ürün adı<input id="editProductName" value="'+esc(p.name)+'"></label>'
    +'<label>Barkod<input id="editProductBarcode" value="'+esc(p.barcode||'')+'"></label>'
    +'<label>Birim<select id="editProductUnit">'+['adet','kg','koli','paket','şişe','kasa'].map(u=>'<option '+(u===p.unit?'selected':'')+'>'+u+'</option>').join('')+'</select></label>'
    +'<label>Raf<select id="editProductShelf">'+shelfOptions+'</select></label>'
    +'<label>Metre<input id="editProductMeter" type="number" value="'+esc(p.meter??'')+'"></label>'
    +'<label>Kat<input id="editProductLevel" type="number" value="'+esc(p.level??'')+'"></label>'
    +'<label>Sıra<input id="editProductPosition" type="number" value="'+esc(p.position??'')+'"></label>'
    +'<label>Konum Kodu<input id="editProductLocationCode" value="'+esc(p.locationCode||'')+'"></label>'
    +'<div class="btn-row"><button class="btn full" id="saveProductEdit">Ürünü kaydet</button>'
    +(currentRole==='manager'?'<button class="btn secondary" id="productCardAction">Admine bilgi ver</button>':'')
    +'</div></div>');
  document.getElementById('saveProductEdit').onclick=async()=>{
    p.name=document.getElementById('editProductName').value||p.name;
    p.barcode=document.getElementById('editProductBarcode').value||'';
    p.unit=document.getElementById('editProductUnit').value;
    p.shelfId=document.getElementById('editProductShelf').value;
    p.meter=Number(document.getElementById('editProductMeter').value||0)||null;
    p.level=Number(document.getElementById('editProductLevel').value||0)||null;
    p.position=Number(document.getElementById('editProductPosition').value||0)||null;
    p.locationCode=document.getElementById('editProductLocationCode').value||'';
    await put('products',p);closeModal();render();
  };
  if(document.getElementById('productCardAction')) document.getElementById('productCardAction').onclick=()=>openProductAction(data,p);
}

async function systemUserChooser(data){
  if(!isSystemAdmin()) return;
  let accounts=[];
  if(currentUser?.preview){
    accounts=data.users.filter(u=>u.active).map(u=>({app_user_id:u.id,username:u.username,name:u.name,role:u.role,active:u.active}));
  }else{
    try{
      const out=await rafAuth('list_users');
      accounts=(out.users||[]).filter(a=>a.role!=='system_admin');
    }catch(e){
      accounts=data.users.filter(u=>u.active).map(u=>({app_user_id:u.id,username:u.username,name:u.name,role:u.role,active:u.active}));
    }
  }
  const rows=accounts.map(a=>{
    const local=data.users.find(u=>u.id===a.app_user_id)||data.users.find(u=>u.username===a.username);
    if(!local) return '<div class="card"><div class="card-pad"><strong>'+esc(a.name||a.username)+'</strong><div class="meta">@'+esc(a.username)+' · uygulama kaydı bağlı değil</div></div></div>';
    return '<button class="card system-switch-user" data-user="'+local.id+'"><div class="card-pad user-row"><div class="row-left"><div class="avatar">'+esc((a.name||a.username||'?').charAt(0))+'</div><div><strong>'+esc(a.name||a.username)+'</strong><div class="meta">@'+esc(a.username)+' · '+esc(ROLE_NAMES[local.role]||local.role)+'</div></div></div><span>›</span></div></button>';
  }).join('');
  const body='<div class="form-grid"><button class="btn secondary full system-back-admin">Sistem Yönetici ekranına dön</button>'+(rows||'<div class="card empty">Kullanıcı bulunamadı.</div>')+'</div>';
  openModal('Kullanıcı seç',body);
  document.querySelectorAll('.system-switch-user').forEach(b=>b.onclick=()=>{
    const u=data.users.find(x=>x.id===b.dataset.user);
    if(!u) return;
    viewAsUserId=u.id;
    currentRole=u.role;
    currentView='home';
    closeModal();
    render();
  });
  document.querySelector('.system-back-admin')?.addEventListener('click',()=>{
    viewAsUserId=null;
    currentRole='superadmin';
    currentView='system';
    closeModal();
    render();
  });
}

async function systemUsersView(data){
  if(!isSystemAdmin()) return '<div class="card empty">Yetkiniz yok.</div>';
  let accounts=[];
  if(currentUser?.preview){
    accounts=data.users.filter(u=>u.active).map(u=>({app_user_id:u.id,username:u.username,name:u.name,role:u.role,active:u.active}));
  }else{
    try{
      const out=await rafAuth('list_users');
      accounts=(out.users||[]).filter(a=>a.role!=='system_admin');
    }catch(e){
      accounts=data.users.filter(u=>u.active).map(u=>({app_user_id:u.id,username:u.username,name:u.name,role:u.role,active:u.active}));
    }
  }
  const cards=accounts.map(a=>{
    const local=data.users.find(u=>u.id===a.app_user_id)||data.users.find(u=>u.username===a.username);
    const role=ROLE_NAMES[a.role]||a.role;
    const shelfCount=local?data.assignments.filter(x=>x.userId===local.id&&x.active&&x.assignmentType!=='backup').length:0;
    const todayChecks=local?data.dailyChecks.filter(x=>x.reportedBy===local.id&&x.date===today()).length:0;
    const openIssues=local?data.issues.filter(x=>issueOpen(x)&&(x.reportedBy===local.id||x.assignedToUserId===local.id)).length:0;
    return '<button class="card system-user-card open-system-user" data-user="'+esc(local?.id||a.app_user_id||'')+'">'
      +'<div class="card-pad user-row"><div class="row-left"><div class="avatar">'+esc((a.name||a.username||'?').charAt(0))+'</div><div><strong>'+esc(a.name||a.username)+'</strong><div class="meta">@'+esc(a.username)+' · '+esc(role)+'<br>'+shelfCount+' raf · bugün '+todayChecks+' kontrol · '+openIssues+' açık kayıt</div></div></div><span>›</span></div>'
      +'</button>';
  }).join('');
  return '<section class="hero"><div class="eyebrow">Sistem Yönetici</div><h1>Kullanıcılar</h1><p>Bir kullanıcıya dokun; görevleri ve yaptığı işlemler doğrudan açılsın.</p></section>'
    +'<div class="section-title"><h2>Kullanıcılar</h2><small>'+accounts.length+' hesap</small></div>'
    +(cards||'<div class="card empty">Kullanıcı bulunamadı.</div>');
}

function systemUserDetailView(data,userId){
  const u=data.users.find(x=>x.id===userId);
  if(!u) return '<button class="back-home-btn" id="backSystemUsers">← Kullanıcılara dön</button><div class="card empty">Bu giriş hesabının uygulama kullanıcı kaydı henüz bağlı değil.</div>';
  const primaryIds=data.assignments.filter(a=>a.userId===u.id&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
  const backupIds=data.assignments.filter(a=>a.userId===u.id&&a.active&&a.assignmentType==='backup').map(a=>a.shelfId);
  const primary=primaryIds.map(id=>data.shelves.find(s=>s.id===id)).filter(Boolean);
  const backup=backupIds.map(id=>data.shelves.find(s=>s.id===id)).filter(Boolean);
  const checks=data.dailyChecks.filter(x=>x.reportedBy===u.id).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const todayChecks=checks.filter(x=>x.date===today());
  const ownIssues=data.issues.filter(x=>x.reportedBy===u.id||x.assignedToUserId===u.id).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const open=ownIssues.filter(issueOpen);
  const done=ownIssues.filter(i=>!issueOpen(i));
  const notes=(data.notifications||[]).filter(n=>n.targetUserId===u.id).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const taskCards=primary.length?primary.map(s=>{
    const pg=shelfProgress(data,s.id);
    return '<div class="card"><div class="card-pad"><div class="simple-row"><div><strong>'+esc(s.name)+'</strong><div class="meta">'+pg.done+'/'+pg.total+' ürün kontrol edildi</div></div><span class="badge '+(pg.complete?'ok':'dark')+'">'+(pg.complete?'Tamamlandı':'Bekliyor')+'</span></div></div></div>';
  }).join(''):'<div class="card empty">Ana sorumlu olduğu raf yok.</div>';
  const activity=[...checks.map(x=>({ts:x.ts||0,text:'Kontrol · '+(data.products.find(p=>p.id===x.productId)?.name||'Ürün')+' · '+(x.status==='ok'?'OK':'Sorun')})),...ownIssues.map(i=>({ts:i.ts||0,text:'Sorun · '+(STATUS[i.type]?.label||i.type)+' · '+(data.products.find(p=>p.id===i.productId)?.name||'Ürün')})),...notes.filter(n=>n.closed).map(n=>({ts:n.closedAt||n.ts||0,text:'Bildirim tamamlandı · '+(n.title||n.message||'')}))].sort((a,b)=>b.ts-a.ts).slice(0,12);
  return '<button class="back-home-btn" id="backSystemUsers">← Kullanıcılara dön</button>'
    +'<section class="hero"><div class="eyebrow">'+esc(ROLE_NAMES[u.role]||u.role)+'</div><h1>'+esc(u.name)+'</h1><p>@'+esc(u.username||'')+' · görev ve hareket özeti</p></section>'
    +'<div class="grid"><div class="metric"><b>'+primary.length+'</b><span>Ana raf</span></div><div class="metric"><b>'+todayChecks.length+'</b><span>Bugünkü kontrol</span></div><div class="metric"><b>'+open.length+'</b><span>Açık sorun</span></div><div class="metric"><b>'+done.length+'</b><span>Tamamlanan</span></div></div>'
    +'<div class="btn-row" style="margin:12px 0"><button class="btn view-user-screen" data-user="'+u.id+'">Kullanıcının ekranını aç</button><button class="btn secondary edit-user" data-user="'+u.id+'">Hesap / Şifre</button></div>'
    +'<div class="section-title"><h2>Görevleri</h2><small>'+primary.length+' ana · '+backup.length+' yedek</small></div>'+taskCards
    +(backup.length?'<div class="card"><div class="card-pad"><strong>Yedek olduğu raflar</strong><div class="meta">'+backup.map(s=>esc(s.name)).join('<br>')+'</div></div></div>':'')
    +'<div class="section-title"><h2>Son yaptığı işlemler</h2><small>'+activity.length+' kayıt</small></div>'
    +(activity.length?activity.map(a=>'<div class="card"><div class="card-pad"><div class="meta">'+esc(a.text)+'</div></div></div>').join(''):'<div class="card empty">Henüz işlem yok.</div>');
}
async function systemView(data){
  if(!isSystemAdmin()) return '<div class="card empty">Yetkiniz yok.</div>';
  let accounts=[];
  let loadError='';
  try{
    const out=await rafAuth('list_users');
    accounts=out.users||[];
  }catch(e){
    loadError=e.message||'Hesaplar yüklenemedi.';
  }
  const cards=accounts.map(a=>{
    const local=data.users.find(u=>u.id===a.app_user_id)||data.users.find(u=>u.username===a.username);
    const roleLabel=ROLE_NAMES[a.role]||a.role;
    const canView=!!local && a.role!=='system_admin';
    return '<div class="card"><div class="card-pad">'
      +'<div class="simple-row"><div><strong>'+esc(a.name||a.username)+'</strong><div class="meta">@'+esc(a.username)+' · '+esc(roleLabel)+'</div></div><span class="badge '+(a.active?'ok':'dark')+'">'+(a.active?'Aktif':'Pasif')+'</span></div>'
      +'<div class="account-detail"><b>Giriş hesabı:</b> Var</div>'
      +(a.email?'<div class="account-detail"><b>E-posta:</b> '+esc(a.email)+'</div>':'')
      +'<div class="account-detail"><b>Uygulama kullanıcısı:</b> '+(local?esc(local.name)+' ('+esc(local.id)+')':'Bağlantı yok')+'</div>'
      +'<div class="btn-row">'
      +(local?'<button class="btn secondary edit-user" data-user="'+local.id+'">Bilgiler / Şifre</button>':'')
      +(canView?'<button class="btn view-user-screen" data-user="'+local.id+'">Ekranını gör</button>':'')
      +'</div>'
      +'</div></div>';
  }).join('');
  return '<section class="hero"><div class="eyebrow">Sistem Yönetici</div><h1>Tüm kullanıcı hesapları</h1><p>Merkezi giriş sistemindeki bütün hesapları sadece sen görebilirsin.</p></section>'
    +'<div class="section-title"><h2>Hesaplar</h2><div class="shelf-admin-actions"><span class="badge dark">'+accounts.length+' hesap</span><button class="btn" id="addUser">+ Kullanıcı</button></div></div>'
    +(loadError?'<div class="notice" style="background:#fde9e9;border-color:#f3aaaa;color:#9f1d1d">'+esc(loadError)+'</div>':'')
    +(cards||'<div class="card empty">Merkezi giriş sisteminde kullanıcı bulunamadı.</div>');
}

function peopleView(data){
  if(!['manager','superadmin'].includes(currentRole)) return '<div class="card empty">Bu alan için yetkiniz yok.</div>';
  return `
  <div class="section-title"><h2>${currentRole==='superadmin'?'Kullanıcı Yönetimi':'Personel'}</h2>${currentRole==='superadmin'?'<button class="btn" id="addUser">+ Kullanıcı</button>':''}</div>
  ${data.users.map(u=>`<button class="card user-card ${currentRole==='superadmin'?'edit-user':'performance-user'}" data-user="${u.id}"><div class="card-pad user-row"><div class="row-left"><div class="avatar">${esc(u.name.charAt(0))}</div><div><strong>${esc(u.name)}</strong><div class="meta">@${esc(u.username)} · ${ROLE_NAMES[u.role]}</div></div></div><div class="user-card-right"><span class="badge ${u.active?'ok':'dark'}">${u.active?'Aktif':'Pasif'}</span>${icon(currentRole==='superadmin'?'users':'chart',18)}</div></div></button>`).join('')}
  `;
}
function performanceView(data){
  const assigned=data.assignments.filter(a=>a.userId===activeAppUserId()&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
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
  const u=data.users.find(x=>x.id===activeAppUserId())||data.users.find(x=>x.id===currentUser?.app_user_id);
  return `<div class="card"><div class="card-pad"><div class="row-left"><div class="avatar">${esc(u?.name?.charAt(0)||'E')}</div><div><strong>${esc(u?.name||'')}</strong><div class="meta">${ROLE_NAMES[currentRole]}<br>@${esc(u?.username||'')}</div></div></div></div></div>
  <div class="card"><div class="card-pad"><strong>Yetki</strong><div class="meta">${currentRole==='employee'?'Sadece atanmış raflarını kontrol eder ve sorun bildirir.':currentRole==='warehouse'?'Rafta yok bildirimlerini doğrular ve depo durumunu bildirir.':currentRole==='manager'?'Raf/ürün tanımlar, tüm kontrolleri ve hataları görür.':'Tüm sistemi, kullanıcıları, şifreleri, roller ve raf atamalarını yönetir.'}</div></div></div>`;
}

function openModal(title,body){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body;
  document.getElementById('modal').showModal();
}
function closeModal(){document.getElementById('modal').close();}

function productSearchRows(data,query){
  const q=(query||'').trim().toLocaleLowerCase('tr');
  if(!q) return [];
  return data.products.filter(p=>p.active&&(p.name.toLocaleLowerCase('tr').includes(q)||String(p.barcode||'').includes(q))).slice(0,20);
}
function productSearchCard(data,p,selectable=false){
  const s=data.shelves.find(x=>x.id===p.shelfId);
  const owner=s?shelfOwner(data,s.id):null;
  const backup=s?shelfBackup(data,s.id):null;
  const cls=selectable?'select-cash-product':'open-product';
  return '<button class="product-search-row '+cls+'" data-product="'+p.id+'">'
    +'<strong>'+esc(p.name)+'</strong>'
    +'<span>'+esc(p.barcode||'Barkod yok')+' · '+esc(s?.name||p.shelfCode||'Raf yok')+(p.meter!=null?' · M'+esc(p.meter):'')+(p.level!=null?' · K'+esc(p.level):'')+(p.position!=null?' · S'+esc(p.position):'')+'</span>'
    +(p.locationCode?'<span>Konum: '+esc(p.locationCode)+'</span>':'')
    +'<span>Ana: '+esc(owner?.name||'Atanmamış')+(backup?' · Yedek: '+esc(backup.name):'')+'</span>'
    +'</button>';
}
function excelImportModal(data){
  openModal('Excel ile ürün / raf yükle',
    '<div class="form-grid">'
    +'<div class="sub">Bu sistem artık sabit EMİGRO raf şablonunu kullanır: <b>Raf Kodu, Bölüm, Metre, Kat, Sıra, Konum Kodu, Ürün, Barkod, Birim, Ürün Genişliği (cm), Başlangıç (cm), Bitiş (cm), 1 m Doluluk (cm)</b>.</div>'
    +'<input id="excelFile" type="file" accept=".xlsx,.xls">'
    +'<button class="btn secondary full" id="downloadExcelTemplate">Boş şablonu indir</button>'
    +'<button class="btn full" id="processExcelImport">Dosyayı yükle</button>'
    +'<div id="excelImportStatus" class="sub"></div>'
    +'</div>');

  document.getElementById('downloadExcelTemplate').onclick=()=>{
    if(typeof XLSX==='undefined'){alert('Excel modülü yüklenemedi.');return;}
    const ws=XLSX.utils.json_to_sheet([
      {'Raf Kodu':'A1','Bölüm':'Bakliyat Bölümü 1','Metre':1,'Kat':1,'Sıra':1,'Konum Kodu':'A1-M01-K01-S01','Ürün':'Örnek Ürün','Barkod':'8690000000000','Birim':'Paket','Ürün Genişliği (cm)':12,'Başlangıç (cm)':0,'Bitiş (cm)':12,'1 m Doluluk (cm)':96}
    ]);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Ürünler');
    XLSX.writeFile(wb,'emigro_raf_urun_sablonu.xlsx');
  };

  document.getElementById('processExcelImport').onclick=async()=>{
    const file=document.getElementById('excelFile').files[0];
    const status=document.getElementById('excelImportStatus');
    if(!file){alert('Excel dosyası seçin.');return;}
    if(typeof XLSX==='undefined'){alert('Excel modülü yüklenemedi.');return;}
    status.textContent='Dosya okunuyor...';
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets['Ürünler']||wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    const required=['Raf Kodu','Bölüm','Metre','Kat','Sıra','Konum Kodu','Ürün','Barkod','Birim','Ürün Genişliği (cm)','Başlangıç (cm)','Bitiş (cm)','1 m Doluluk (cm)'];
    const first=rows[0]||{};
    const missing=required.filter(k=>!(k in first));
    if(missing.length){status.textContent='Eksik sütunlar: '+missing.join(', ');return;}
    let shelfCount=0,productCount=0,updatedCount=0;
    const shelfCache=[...data.shelves];
    const productCache=[...data.products];
    for(const row of rows){
      const shelfCode=String(row['Raf Kodu']||'').trim();
      const productName=String(row['Ürün']||'').trim();
      const barcode=String(row['Barkod']||'').trim();
      if(!shelfCode||!productName) continue;
      let shelf=shelfCache.find(s=>String(s.code||s.name).trim().toLocaleLowerCase('tr')===shelfCode.toLocaleLowerCase('tr'));
      if(!shelf){
        shelf={id:uid('s'),code:shelfCode,name:shelfCode,department:String(row['Bölüm']||'-'),location:'Raf '+shelfCode,approved:false,active:true};
        await put('shelves',shelf);
        shelfCache.push(shelf);
        shelfCount++;
      }else{
        shelf.code=shelfCode;
        shelf.department=String(row['Bölüm']||shelf.department||'-');
        await put('shelves',shelf);
      }
      let product=productCache.find(p=>barcode&&String(p.barcode||'')===barcode);
      const payload={
        shelfId:shelf.id,shelfCode,name:productName,barcode,unit:String(row['Birim']||'adet'),
        meter:Number(row['Metre']||0)||null,level:Number(row['Kat']||0)||null,position:Number(row['Sıra']||0)||null,
        locationCode:String(row['Konum Kodu']||''),widthCm:Number(row['Ürün Genişliği (cm)']||0)||null,
        startCm:Number(row['Başlangıç (cm)']||0),endCm:Number(row['Bitiş (cm)']||0),meterFillCm:Number(row['1 m Doluluk (cm)']||0),
        required:true,active:true
      };
      if(product){
        Object.assign(product,payload);
        await put('products',product);
        updatedCount++;
      }else{
        product={id:uid('p'),...payload};
        await put('products',product);
        productCache.push(product);
        productCount++;
      }
    }
    status.textContent=shelfCount+' yeni raf, '+productCount+' yeni ürün, '+updatedCount+' güncellenen ürün.';
    setTimeout(()=>{closeModal();selectedShelfId=null;render();},900);
  };
}

function bindActions(data){
  document.querySelectorAll('.product-card-detail').forEach(b=>b.onclick=()=>productDetailModal(data,b.dataset.product));
  document.querySelectorAll('.product-card-action').forEach(b=>b.onclick=()=>{
    const p=data.products.find(x=>x.id===b.dataset.product);
    if(!p) return;
    if(currentRole==='superadmin'){productDetailModal(data,p.id);return;}
    openProductAction(data,p);
  });
  document.querySelectorAll('.open-barcode-camera').forEach(b=>b.onclick=()=>barcodeScannerModal(data));
  document.getElementById('manualBarcodeFind')?.addEventListener('click',()=>{
    const raw=document.getElementById('manualBarcodeInput').value.trim();
    const p=findProductByBarcode(data,raw);
    if(!p){alert('Bu barkodla ürün bulunamadı.');return;}
    productDetailModal(data,p.id);
  });
  document.querySelectorAll('.employee-open-shelf').forEach(b=>b.onclick=()=>{
    employeeShelfId=b.dataset.shelf;
    employeeMeter='all';employeeLevel='all';employeePosition='all';
    render();
  });
  document.getElementById('backEmployeeShelves')?.addEventListener('click',()=>{
    employeeShelfId=null;employeeMeter='all';employeeLevel='all';employeePosition='all';render();
  });
  document.getElementById('backToMeters')?.addEventListener('click',()=>{
    employeeMeter='all';employeeLevel='all';employeePosition='all';
    render().then(()=>setTimeout(()=>document.getElementById('meterListAnchor')?.scrollIntoView({behavior:'smooth',block:'start'}),60));
  });
  const meterFilter=document.getElementById('employeeMeterFilter');
  if(meterFilter) meterFilter.onchange=()=>{employeeMeter=meterFilter.value;employeeLevel='all';employeePosition='all';render().then(()=>setTimeout(()=>document.getElementById('meterControlSection')?.scrollIntoView({behavior:'smooth',block:'start'}),60));};
  const levelFilter=document.getElementById('employeeLevelFilter');
  if(levelFilter) levelFilter.onchange=()=>{employeeLevel=levelFilter.value;employeePosition='all';render();};
  const positionFilter=document.getElementById('employeePositionFilter');
  if(positionFilter) positionFilter.onchange=()=>{employeePosition=positionFilter.value;render();};
  document.querySelectorAll('.employee-product-search').forEach(b=>b.onclick=()=>employeeProductSearchModal(data));
  document.querySelectorAll('.employee-barcode-scan').forEach(b=>b.onclick=()=>barcodeScannerModal(data));
  document.querySelectorAll('.employee-select-meter').forEach(b=>b.onclick=()=>{
    employeeMeter=b.dataset.meter;
    employeeLevel='all';
    employeePosition='all';
    render().then(()=>setTimeout(()=>document.getElementById('meterControlSection')?.scrollIntoView({behavior:'smooth',block:'start'}),60));
  });
  document.querySelectorAll('.approve-meter').forEach(b=>b.onclick=async()=>{
    const shelfId=b.dataset.shelf;
    const meter=b.dataset.meter;
    if(!meter||meter==='all'){alert('Önce bir metre seçin.');return;}
    const list=data.products.filter(p=>p.shelfId===shelfId&&p.active&&p.required&&String(p.meter)===String(meter));
    const checks=todaysChecks(data);
    const unchecked=list.filter(p=>!checks.some(x=>x.productId===p.id&&x.shelfId===shelfId));
    for(const p of unchecked) await saveCheck(p,shelfId,'ok',{bulk:true,meter:p.meter,level:p.level,position:p.position});
    render();
  });
  document.querySelectorAll('.product-detail-problem').forEach(b=>b.onclick=()=>{
    const p=data.products.find(x=>x.id===b.dataset.product);
    if(!p)return;
    closeModal();
    setTimeout(()=>showMultiIssueForm(data,p,b.dataset.shelf),40);
  });
  document.querySelectorAll('.shelf-select-card').forEach(b=>b.onclick=()=>{selectedShelfId=b.dataset.shelf;render();});
  document.getElementById('backShelfList')?.addEventListener('click',()=>{selectedShelfId=null;render();});

  const globalSearch=document.getElementById('globalProductSearch');
  if(globalSearch){
    globalSearch.oninput=()=>{
      const rows=productSearchRows(data,globalSearch.value);
      document.getElementById('globalProductResults').innerHTML=rows.length
        ?rows.map(p=>productSearchCard(data,p,false)).join('')
        :'<div class="sub">Eşleşen ürün bulunamadı.</div>';
      document.querySelectorAll('.open-product').forEach(b=>b.onclick=()=>productDetailModal(data,b.dataset.product));
    };
  }
  document.querySelectorAll('.open-product').forEach(b=>b.onclick=()=>productDetailModal(data,b.dataset.product));

  document.getElementById('importExcel')?.addEventListener('click',()=>excelImportModal(data));

  const adminSearch=document.getElementById('adminProductSearch');
  if(adminSearch){
    adminSearch.oninput=()=>{
      const rows=productSearchRows(data,adminSearch.value);
      document.getElementById('adminProductResults').innerHTML=rows.length
        ?rows.map(p=>productSearchCard(data,p,false)).join('')
        :'<div class="sub">Eşleşen ürün bulunamadı.</div>';
      document.querySelectorAll('#adminProductResults .open-product').forEach(b=>b.onclick=()=>productDetailModal(data,b.dataset.product));
    };
  }

  const cashSearch=document.getElementById('cashProductSearch');
  if(cashSearch){
    cashSearch.oninput=()=>{
      const rows=productSearchRows(data,cashSearch.value);
      document.getElementById('cashProductResults').innerHTML=rows.length
        ?rows.map(p=>productSearchCard(data,p,true)).join('')
        :'<div class="sub">Eşleşen ürün bulunamadı.</div>';
      document.querySelectorAll('.select-cash-product').forEach(b=>b.onclick=()=>{
        const p=data.products.find(x=>x.id===b.dataset.product);
        if(!p) return;
        productDetailModal(data,p.id);
      });
    };
  }
  document.getElementById('backAdminHome')?.addEventListener('click',()=>{
    issueUserFilter='all';
    issueTypeFilter='all';
    currentView='home';
    render();
  });
  document.querySelectorAll('.dashboard-filter').forEach(b=>b.onclick=()=>{
    issueUserFilter='all';
    issueTypeFilter=b.dataset.filter||'all';
    currentView='issues';
    render();
  });
  document.getElementById('backToAllIssues')?.addEventListener('click',()=>{
    issueTypeFilter='all';
    currentView='issues';
    render();
  });
  const userFilter=document.getElementById('issueUserFilter');
  if(userFilter) userFilter.onchange=()=>{issueUserFilter=userFilter.value;render();};
  const typeFilter=document.getElementById('issueTypeFilter');
  if(typeFilter) typeFilter.onchange=()=>{issueTypeFilter=typeFilter.value;render();};
  document.getElementById('clearIssueFilters')?.addEventListener('click',()=>{issueUserFilter='all';issueTypeFilter='all';render();});
  const homeUserFilter=document.getElementById('homeIssueUserFilter');
  if(homeUserFilter) homeUserFilter.onchange=()=>{issueUserFilter=homeUserFilter.value;render();};
  const homeTypeFilter=document.getElementById('homeIssueTypeFilter');
  if(homeTypeFilter) homeTypeFilter.onchange=()=>{issueTypeFilter=homeTypeFilter.value;render();};
  document.getElementById('homeClearIssueFilters')?.addEventListener('click',()=>{issueUserFilter='all';issueTypeFilter='all';render();});
  document.querySelectorAll('.open-notifications').forEach(b=>b.onclick=()=>{currentView='notifications';render();});
  document.querySelectorAll('.performance-user').forEach(b=>b.onclick=()=>monthlyPerformanceModal(data,b.dataset.user));
  document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>userDetailModal(data,b.dataset.user));
  document.querySelectorAll('.open-system-user').forEach(b=>b.onclick=()=>{
    selectedSystemUserId=b.dataset.user;
    currentView='sysuserdetail';
    render();
  });
  document.getElementById('backSystemUsers')?.addEventListener('click',()=>{
    selectedSystemUserId=null;
    currentView='sysusers';
    render();
  });

  document.querySelectorAll('.view-user-screen').forEach(b=>b.onclick=()=>{
    const u=data.users.find(x=>x.id===b.dataset.user);
    if(!u) return;
    viewAsUserId=u.id;
    currentRole=u.role;
    currentView='home';
    render();
  });
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
  document.querySelectorAll('.resolve-issue').forEach(b=>b.onclick=async()=>{
    const i=data.issues.find(x=>x.id===b.dataset.id);
    if(!i) return;
    i.state='resolved';
    i.resolvedAt=Date.now();
    i.resolvedTime=timeNow();
    i.resolvedBy=activeAppUserId()||'manager';
    await put('issues',i);
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
  document.querySelectorAll('.assign-shelf-user').forEach(b=>b.onclick=()=>assignShelfModal(data,b.dataset.shelf));
  document.querySelectorAll('.approve-shelf').forEach(b=>b.onclick=async()=>{
    const shelf=data.shelves.find(s=>s.id===b.dataset.shelf);
    if(!shelf) return;
    shelf.approved=true;
    shelf.approvedAt=Date.now();
    shelf.approvedBy=activeAppUserId()||'manager';
    await put('shelves',shelf);
    render();
  });
  document.getElementById('addShelf')?.addEventListener('click',shelfModal);
  document.getElementById('addUser')?.addEventListener('click',()=>userModal(data));
  document.getElementById('sendNotification')?.addEventListener('click',()=>notificationModal(data));
  document.getElementById('openTestCenter')?.addEventListener('click',()=>testCenterModal(data));
}

function showMultiIssueForm(data,p,shelfId){
  openModal('Sorun bildir',
    '<div class="form-grid">'
    +'<div><strong>'+esc(p.name)+'</strong><div class="sub">Aynı üründe farklı gruplardan birden fazla sorun seçebilirsin.</div></div>'

    +'<div class="issue-group"><div class="issue-group-title">Tarih durumu <span>birini seç</span></div>'
    +'<label class="check-row"><input class="issue-select" type="radio" name="dateIssue" value="expiring"> <span class="dot warn-dot"></span> Tarihi yaklaşıyor</label>'
    +'<label class="check-row"><input class="issue-select" type="radio" name="dateIssue" value="expired"> <span class="dot danger-dot"></span> Tarihi geçmiş</label>'
    +'<button type="button" class="mini-clear clear-radio" data-name="dateIssue">Seçimi kaldır</button>'
    +'<div id="expiryWrap" class="conditional-field" style="display:none"><label>Son kullanma tarihi<input id="multiExpiry" type="date"></label></div>'
    +'</div>'

    +'<div class="issue-group"><div class="issue-group-title">Stok durumu <span>birini seç</span></div>'
    +'<label class="check-row"><input class="issue-select" type="radio" name="stockIssue" value="low"> <span class="dot orange-dot"></span> Stok az</label>'
    +'<label class="check-row"><input class="issue-select" type="radio" name="stockIssue" value="missing"> <span class="dot dark-dot"></span> Rafta yok</label>'
    +'<button type="button" class="mini-clear clear-radio" data-name="stockIssue">Seçimi kaldır</button></div>'

    +'<div class="issue-group"><div class="issue-group-title">Raf etiketi <span>birini seç</span></div>'
    +'<label class="check-row"><input class="issue-select" type="radio" name="labelIssue" value="label_missing"> Raf etiketi yok</label>'
    +'<label class="check-row"><input class="issue-select" type="radio" name="labelIssue" value="label_wrong"> Raf etiketi yanlış</label>'
    +'<button type="button" class="mini-clear clear-radio" data-name="labelIssue">Seçimi kaldır</button></div>'

    +'<div class="issue-group"><div class="issue-group-title">Diğer sorunlar <span>opsiyonel</span></div>'
    +'<label class="check-row"><input class="issue-select" type="checkbox" value="damaged"> Hasarlı / bozuk</label></div>'

    +'<label>Miktar<input id="multiQty" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0"></label>'
    +'<label>Birim<select id="multiUnit"><option value="adet">Adet</option><option value="kg">Kg</option><option value="koli">Koli</option><option value="paket">Paket</option><option value="şişe">Şişe</option><option value="kasa">Kasa</option></select></label>'
    +'<label>Not <span class="sub">(isteğe bağlı)</span><input id="multiNote" placeholder="Örn. etiket farklı fiyat gösteriyor"></label>'
    +'<button class="btn full" id="saveMultiIssue">Sorunları bildir</button>'
    +'</div>');

  document.querySelectorAll('.check-row').forEach(row=>{
    row.onclick=(e)=>{
      const input=row.querySelector('input.issue-select');
      if(!input) return;
      e.preventDefault();

      if(input.type==='radio'){
        const wasChecked=input.checked;
        document.querySelectorAll('input[name="'+input.name+'"]').forEach(x=>x.checked=false);
        input.checked=!wasChecked;
      }else{
        input.checked=!input.checked;
      }

      row.classList.toggle('selected',input.checked);
      if(input.name){
        document.querySelectorAll('input[name="'+input.name+'"]').forEach(x=>{
          x.closest('.check-row')?.classList.toggle('selected',x.checked);
        });
      }

      if(input.name==='dateIssue') refreshExpiry();
    };
  });

  const expiryWrap=document.getElementById('expiryWrap');
  const dateRadios=[...document.querySelectorAll('input[name="dateIssue"]')];
  const refreshExpiry=()=>{
    const selected=dateRadios.some(x=>x.checked);
    expiryWrap.style.display=selected?'block':'none';
    if(!selected){
      const input=document.getElementById('multiExpiry');
      if(input) input.value='';
    }
  };
  dateRadios.forEach(r=>r.onchange=refreshExpiry);

  document.querySelectorAll('.clear-radio').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('input[name="'+btn.dataset.name+'"]').forEach(x=>{
        x.checked=false;
        x.closest('.check-row')?.classList.remove('selected');
      });
      if(btn.dataset.name==='dateIssue') refreshExpiry();
    };
  });

  document.getElementById('saveMultiIssue').onclick=async()=>{
    const selected=[...document.querySelectorAll('.issue-select:checked')].map(x=>x.value);
    if(!selected.length){alert('En az bir sorun seçin.');return;}
    const hasDate=selected.some(x=>x==='expiring'||x==='expired');
    const expiry=hasDate?document.getElementById('multiExpiry').value:null;
    if(hasDate&&!expiry){alert('Tarih sorunu için son kullanma tarihini girin.');return;}
    const qtyRaw=document.getElementById('multiQty').value;
    const qty=qtyRaw===''?null:Number(qtyRaw);
    const unit=document.getElementById('multiUnit').value;
    const note=document.getElementById('multiNote').value||'';

    await put('dailyChecks',{
      id:uid('c'),date:today(),ts:Date.now(),time:timeNow(),
      productId:p.id,shelfId,status:'problem',reportedBy:activeAppUserId(),problemTypes:selected
    });

    for(const type of selected){
      await put('issues',{
        id:uid('i'),date:today(),time:timeNow(),ts:Date.now(),
        productId:p.id,shelfId,type,state:'reported',reportedBy:activeAppUserId(),
        qty,unit,expiry:(type==='expiring'||type==='expired')?expiry:null,note,
        visibility:type.startsWith('label_')?['manager','superadmin']:['warehouse','manager','superadmin']
      });
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
      productId:p.id,shelfId:shelf.id,status:'ok',reportedBy:activeAppUserId()
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
      reportedBy:activeAppUserId(),qty:0,unit:p.unit||'adet',expiry:null,
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
  const check={id:uid('c'),date:today(),ts:Date.now(),time:timeNow(),productId:product.id,shelfId,status,reportedBy:activeAppUserId(),...extra};
  await put('dailyChecks',check);
  if(status!=='ok'){
    const issue={id:uid('i'),date:today(),time:timeNow(),ts:Date.now(),productId:product.id,shelfId,type:status,state:'reported',reportedBy:activeAppUserId(),qty:extra.qty??null,unit:extra.unit||product.unit,expiry:extra.expiry||null,visibility:['warehouse','manager','superadmin']};
    await put('issues',issue);
  }
}
function assignUserShelvesModal(data,userId){
  const user=data.users.find(u=>u.id===userId);
  if(!user) return;

  const currentPrimary=data.assignments.filter(a=>a.userId===userId&&a.active&&a.assignmentType!=='backup').map(a=>a.shelfId);
  const currentBackup=data.assignments.filter(a=>a.userId===userId&&a.active&&a.assignmentType==='backup').map(a=>a.shelfId);

  const freeShelves=data.shelves.filter(s=>{
    if(!s.active) return false;
    const owner=shelfOwner(data,s.id);
    return !owner || owner.id===userId;
  });

  const backupEligible=data.shelves.filter(s=>{
    if(!s.active) return false;
    const owner=shelfOwner(data,s.id);
    const backup=shelfBackup(data,s.id);
    return owner && owner.id!==userId && (!backup || backup.id===userId);
  });

  const primaryOptions=freeShelves.map(s=>{
    const selected=currentPrimary.includes(s.id)?'selected':'';
    return '<option value="'+s.id+'" '+selected+'>'+esc(s.name)+(shelfOwner(data,s.id)?.id===userId?' — mevcut':' — boş')+'</option>';
  }).join('');

  const backupOptions=backupEligible.map(s=>{
    const selected=currentBackup.includes(s.id)?'selected':'';
    const owner=shelfOwner(data,s.id);
    return '<option value="'+s.id+'" '+selected+'>'+esc(s.name)+' — ana: '+esc(owner?.name||'')+'</option>';
  }).join('');

  openModal('Raf sorumluları',
    '<div class="form-grid">'
    +'<div><strong>'+esc(user.name)+'</strong><div class="sub">Bu kullanıcıya boş rafları ana sorumlu olarak atayabilirsin. Dolu raflar burada görünmez.</div></div>'
    +'<label>Ana sorumlu rafları<select id="userPrimaryShelves" multiple size="6">'+(primaryOptions||'<option disabled>Boş raf yok</option>')+'</select></label>'
    +'<label>Yedek olacağı raflar <span class="sub">(isteğe bağlı)</span><select id="userBackupShelves" multiple size="5">'+(backupOptions||'<option disabled>Yedek atanabilecek raf yok</option>')+'</select></label>'
    +'<button class="btn full" id="saveUserShelfAssignments">Kaydet</button>'
    +'</div>');

  document.getElementById('saveUserShelfAssignments').onclick=async()=>{
    const primaryIds=[...document.getElementById('userPrimaryShelves').selectedOptions].map(o=>o.value);
    const backupIds=[...document.getElementById('userBackupShelves').selectedOptions].map(o=>o.value);

    const existing=data.assignments.filter(a=>a.userId===userId&&a.active);
    for(const a of existing){
      a.active=false;
      await put('assignments',a);
    }

    for(const shelfId of primaryIds){
      await put('assignments',{id:uid('a'),userId,shelfId,assignmentType:'primary',active:true});
    }
    for(const shelfId of backupIds){
      await put('assignments',{id:uid('a'),userId,shelfId,assignmentType:'backup',active:true});
    }

    closeModal();
    render();
  };
}

function assignShelfModal(data,shelfId){
  const shelf=data.shelves.find(s=>s.id===shelfId);
  if(!shelf) return;
  const employees=data.users.filter(u=>u.active&&u.role==='employee');
  const owner=shelfOwner(data,shelfId);
  const backup=shelfBackup(data,shelfId);
  const makeOptions=(selectedId,emptyLabel)=>{
    let html='<option value="">'+emptyLabel+'</option>';
    html+=employees.map(u=>'<option value="'+u.id+'" '+(u.id===selectedId?'selected':'')+'>'+esc(u.name)+'</option>').join('');
    return html;
  };
  const body='<div class="form-grid">'
    +'<div><strong>'+esc(shelf.name)+'</strong><div class="sub">Ana sorumlu günlük kontrolden sorumludur. Yedek kişi şimdilik yalnızca yedek olarak kayıt edilir.</div></div>'
    +'<label>Ana sorumlu<select id="primaryShelfUser">'+makeOptions(owner?.id,'Ana sorumlu seç')+'</select></label>'
    +'<label>Yedek kişi <span class="sub">(isteğe bağlı)</span><select id="backupShelfUser">'+makeOptions(backup?.id,'Yedek yok')+'</select></label>'
    +'<button class="btn full" id="saveShelfUsers">Kaydet</button></div>';
  openModal('Raf sorumluları',body);
  document.getElementById('saveShelfUsers').onclick=async()=>{
    const primaryId=document.getElementById('primaryShelfUser').value;
    const backupId=document.getElementById('backupShelfUser').value;
    if(!primaryId){alert('Ana sorumlu seçin.');return;}
    if(backupId&&backupId===primaryId){alert('Ana sorumlu ile yedek kişi aynı olamaz.');return;}
    for(const a of data.assignments.filter(a=>a.shelfId===shelfId&&a.active)){
      a.active=false;
      await put('assignments',a);
    }
    await put('assignments',{id:uid('a'),userId:primaryId,shelfId,assignmentType:'primary',active:true});
    if(backupId) await put('assignments',{id:uid('a'),userId:backupId,shelfId,assignmentType:'backup',active:true});
    closeModal();
    render();
  };
}
function shelfModal(){
  openModal('Yeni Raf',
    '<div class="form-grid">'
    +'<label>Raf Kodu<input id="sCode" placeholder="Örn. F1" autocapitalize="characters"></label>'
    +'<label>Bölüm<input id="sDept" placeholder="Örn. Bakliyat"></label>'
    +'<button class="btn full" id="saveShelf">Rafı oluştur</button>'
    +'</div>');
  document.getElementById('saveShelf').onclick=async()=>{
    const code=(document.getElementById('sCode').value||'Yeni Raf').trim().toUpperCase();
    await put('shelves',{id:uid('s'),code,name:code,department:document.getElementById('sDept').value||'-',location:'Raf '+code,approved:false,active:true});
    closeModal();render();
  };
}

function productModal(shelfId){
  openModal('Rafa ürün ekle',
    '<div class="form-grid">'
    +'<label>Ürün adı<input id="pName"></label>'
    +'<label>Barkod<input id="pBarcode" inputmode="numeric"></label>'
    +'<label>Birim<select id="pUnit"><option>Paket</option><option>Adet</option><option>Koli</option><option>Şişe</option><option>Kasa</option><option>kg</option></select></label>'
    +'<div class="location-grid"><label>Metre<input id="pMeter" type="number" min="1" inputmode="numeric"></label><label>Kat<input id="pLevel" type="number" min="1" inputmode="numeric"></label><label>Sıra<input id="pPosition" type="number" min="1" inputmode="numeric"></label></div>'
    +'<label>Ürün genişliği (cm)<input id="pWidth" type="number" step="0.1" min="0" inputmode="decimal"></label>'
    +'<label>Başlangıç (cm)<input id="pStart" type="number" step="0.1" min="0" inputmode="decimal"></label>'
    +'<label>Bitiş (cm)<input id="pEnd" type="number" step="0.1" min="0" inputmode="decimal"></label>'
    +'<button class="btn full" id="saveProduct">Ürünü ekle</button>'
    +'</div>');
  document.getElementById('saveProduct').onclick=async()=>{
    const data=await snapshot();
    const shelf=data.shelves.find(s=>s.id===shelfId);
    const meter=Number(document.getElementById('pMeter').value||0)||null;
    const level=Number(document.getElementById('pLevel').value||0)||null;
    const position=Number(document.getElementById('pPosition').value||0)||null;
    const shelfCode=shelf?.code||shelf?.name||'';
    const locationCode=(shelfCode&&meter&&level&&position)?shelfCode+'-M'+String(meter).padStart(2,'0')+'-K'+String(level).padStart(2,'0')+'-S'+String(position).padStart(2,'0'):'';
    await put('products',{
      id:uid('p'),shelfId,shelfCode,
      name:document.getElementById('pName').value||'Yeni ürün',
      barcode:document.getElementById('pBarcode').value,
      unit:document.getElementById('pUnit').value,
      meter,level,position,locationCode,
      widthCm:Number(document.getElementById('pWidth').value||0)||null,
      startCm:Number(document.getElementById('pStart').value||0),
      endCm:Number(document.getElementById('pEnd').value||0),
      meterFillCm:null,required:true,active:true
    });
    closeModal();render();
  };
}

function inviteUrl(user){
  return location.origin+location.pathname+'?login='+encodeURIComponent(user.username||'');
}
function shelfAssignmentOption(data,s,mode){
  const owner=shelfOwner(data,s.id);
  const backup=shelfBackup(data,s.id);
  let disabled=false;
  let note='';
  if(mode==='primary'){
    disabled=!!owner;
    note=owner?' — '+owner.name:'';
  }else{
    disabled=!owner||!!backup;
    if(!owner) note=' — önce ana sorumlu gerekli';
    else if(backup) note=' — yedek: '+backup.name;
    else note=' — ana: '+owner.name;
  }
  return '<option value="'+s.id+'" '+(disabled?'disabled':'')+'>'+esc(s.name+note)+'</option>';
}
function refreshUserShelfOptions(data){
  const select=document.getElementById('uShelves');
  if(!select) return;
  const mode=document.querySelector('input[name="assignmentMode"]:checked')?.value||'primary';
  select.innerHTML=data.shelves.filter(s=>s.active).map(s=>shelfAssignmentOption(data,s,mode)).join('');
  document.getElementById('assignmentHelp').textContent=mode==='primary'
    ?'Ana sorumlusu olan raflar seçilemez.'
    :'Sadece ana sorumlusu olan ve henüz yedeği bulunmayan raflar seçilebilir.';
}
function showInviteModal(user){
  const link=inviteUrl(user);
  openModal('Kullanıcı oluşturuldu',
    '<div class="form-grid">'
    +'<div class="notice" style="margin:0"><b>'+esc(user.name)+'</b><br>Kullanıcı adı: <b>'+esc(user.username)+'</b></div>'
    +'<label>Davet linki<input id="inviteLink" readonly value="'+esc(link)+'"></label>'
    +'<div class="btn-row"><button class="btn full" id="copyInvite">Davet linkini kopyala</button><button class="btn secondary full" id="shareInvite">Paylaş</button></div>'
    +'<div class="sub">Kullanıcı bu bağlantıdan giriş ekranına ulaşacak. Şifresini ayrıca güvenli şekilde paylaşabilirsin.</div>'
    +'</div>');
  document.getElementById('copyInvite').onclick=async()=>{
    await navigator.clipboard.writeText(link);
    document.getElementById('copyInvite').textContent='✓ Kopyalandı';
  };
  document.getElementById('shareInvite').onclick=async()=>{
    if(navigator.share) await navigator.share({title:'EMİGRO Raf Kontrol',text:'Giriş bağlantın',url:link});
    else {
      await navigator.clipboard.writeText(link);
      alert('Davet linki kopyalandı.');
    }
  };
}
function userModal(data){
  openModal('Yeni Kullanıcı',
    '<div class="form-grid">'
    +'<label>Ad soyad<input id="uName"></label>'
    +'<label>Kullanıcı adı<input id="uLogin" autocapitalize="none"></label>'
    +'<label>E-posta <span class="sub">(isteğe bağlı)</span><input id="uEmail" type="email"></label>'
    +'<label>Şifre<input id="uPass" type="password"></label>'
    +'<label>Rol<select id="uRole"><option value="employee">Çalışan</option><option value="cashier">Kasa Kullanıcısı</option><option value="warehouse">Depo Sorumlusu</option><option value="manager">Mağaza Müdürü</option><option value="superadmin">Süper Admin</option></select></label>'
    +'<div id="employeeShelfArea">'
      +'<div class="issue-group-title">Raf atama tipi</div>'
      +'<label class="check-row"><input type="radio" name="assignmentMode" value="primary" checked> Ana sorumlu olarak ata</label>'
      +'<label class="check-row"><input type="radio" name="assignmentMode" value="backup"> Yedek olarak ata</label>'
      +'<div class="sub" id="assignmentHelp"></div>'
      +'<label>Raflar<select id="uShelves" multiple size="6"></select></label>'
    +'</div>'
    +'<button class="btn full" id="saveUser">Kullanıcı oluştur ve davet et</button>'
    +'</div>');

  const roleEl=document.getElementById('uRole');
  const shelfArea=document.getElementById('employeeShelfArea');
  const updateRole=()=>{
    shelfArea.style.display=roleEl.value==='employee'?'grid':'none';
    refreshUserShelfOptions(data);
  };
  roleEl.onchange=updateRole;
  document.querySelectorAll('input[name="assignmentMode"]').forEach(r=>r.onchange=()=>refreshUserShelfOptions(data));
  updateRole();

  document.getElementById('saveUser').onclick=async()=>{
    const id=uid('u');
    const role=roleEl.value;
    const name=document.getElementById('uName').value||'Yeni Kullanıcı';
    const username=(document.getElementById('uLogin').value||uid('user')).trim().toLowerCase();
    const password=document.getElementById('uPass').value;
    const email=document.getElementById('uEmail').value.trim();
    if(password.length<4){alert('Şifre en az 4 karakter olmalı.');return;}
    try{
      const remote=await rafAuth('create_user',{app_user_id:id,name,username,password,email:email||null,role});
      const user={id,name,username,email:email||'',role,active:true,authId:remote.user?.id||null,inviteToken:uid('invite')};
      await put('users',user);
      if(role==='employee'){
        const mode=document.querySelector('input[name="assignmentMode"]:checked')?.value||'primary';
        const selected=[...document.getElementById('uShelves').selectedOptions];
        for(const o of selected){
          await put('assignments',{id:uid('a'),userId:id,shelfId:o.value,assignmentType:mode,active:true});
        }
      }
      showInviteModal(user);
    }catch(e){alert(e.message||'Kullanıcı oluşturulamadı.');}
  };
}
async function userDetailModal(data,userId){
  const user=data.users.find(u=>u.id===userId);
  if(!user) return;
  if(!user.inviteToken){
    user.inviteToken=uid('invite');
    await put('users',user);
  }
  const primary=data.assignments.filter(a=>a.userId===user.id&&a.active&&a.assignmentType!=='backup')
    .map(a=>data.shelves.find(s=>s.id===a.shelfId)?.name).filter(Boolean);
  const backup=data.assignments.filter(a=>a.userId===user.id&&a.active&&a.assignmentType==='backup')
    .map(a=>data.shelves.find(s=>s.id===a.shelfId)?.name).filter(Boolean);
  const link=inviteUrl(user);
  openModal('Kullanıcı bilgileri',
    '<div class="form-grid">'
    +'<div><strong>'+esc(user.name)+'</strong><div class="sub">'+esc(ROLE_NAMES[user.role]||user.role)+'</div></div>'
    +'<label>Kullanıcı adı<input id="editUsername" value="'+esc(user.username)+'"></label>'
    +'<label>E-posta<input id="editEmail" type="email" value="'+esc(user.email||'')+'"></label>'
    +'<label>Yeni şifre<input id="editPassword" type="password" placeholder="Değiştirmek istemiyorsan boş bırak"></label>'
    +'<button class="card shelf-permissions-card" id="editUserShelves" style="box-shadow:none;text-align:left"><div class="card-pad"><div class="simple-row"><div><strong>Raf yetkileri</strong><div class="meta">Ana: '+(primary.map(esc).join(', ')||'Yok')+'<br>Yedek: '+(backup.map(esc).join(', ')||'Yok')+'</div></div><span>›</span></div></div></button>'
    +'<label>Davet linki<input id="userInviteLink" readonly value="'+esc(link)+'"></label>'
    +'<div class="btn-row"><button class="btn secondary" id="copyUserInvite">Linki kopyala</button><button class="btn secondary" id="shareUserInvite">Paylaş</button></div>'
    +'<button class="btn full" id="saveUserSettings">Bilgileri kaydet</button>'
    +'</div>');
  document.getElementById('editUserShelves').onclick=()=>assignUserShelvesModal(data,user.id);
  document.getElementById('copyUserInvite').onclick=async()=>{
    await navigator.clipboard.writeText(link);
    document.getElementById('copyUserInvite').textContent='✓ Kopyalandı';
  };
  document.getElementById('shareUserInvite').onclick=async()=>{
    if(navigator.share) await navigator.share({title:'EMİGRO Raf Kontrol',text:'Giriş bağlantın',url:link});
    else {await navigator.clipboard.writeText(link);alert('Davet linki kopyalandı.');}
  };
  document.getElementById('saveUserSettings').onclick=async()=>{
    const username=(document.getElementById('editUsername').value||user.username).trim().toLowerCase();
    const email=document.getElementById('editEmail').value.trim();
    const pass=document.getElementById('editPassword').value;
    try{
      if(user.authId){
        const remote=await rafAuth('update_user',{id:user.authId,username,email:email||null,password:pass||undefined});
        user.authId=remote.user?.id||user.authId;
      }else{
        if(!pass){alert('Bu kullanıcı için henüz giriş hesabı yok. İlk şifreyi girin.');return;}
        const remote=await rafAuth('create_user',{app_user_id:user.id,name:user.name,username,password:pass,email:email||null,role:user.role});
        user.authId=remote.user?.id||null;
      }
      user.username=username;
      user.email=email;
      await put('users',user);
      closeModal();
      render();
    }catch(e){alert(e.message||'Kullanıcı kaydedilemedi.');}
  };
}

document.getElementById('roleTabs').addEventListener('click',e=>{
  if(!isSystemAdmin()) return;
  const b=e.target.closest('button[data-role]'); if(!b)return;
  const role=b.dataset.role;
  const roleUserMap={employee:'u_emp',cashier:'u_cash',warehouse:'u_wh',manager:'u_mgr',superadmin:'u_admin'};
  viewAsUserId=roleUserMap[role]||null;
  currentRole=role;
  currentView='home';
  render();
});
document.getElementById('modalClose').onclick=closeModal;
document.getElementById('resetDemo').onclick=async()=>{if(isSystemAdmin()&&confirm('Demo verileri sıfırlansın mı?')){await clearAll();await seed();render();}};

document.getElementById('loginButton').onclick=async()=>{
  const username=document.getElementById('loginUsername').value.trim().toLowerCase();
  const password=document.getElementById('loginPassword').value;
  const msg=document.getElementById('authMessage');
  msg.textContent='Giriş yapılıyor...';
  try{
    const out=await rafAuth('login',{username,password});
    localStorage.setItem('raf_auth_token',out.token);
    setEffectiveUser(out.user);
    await ensureRemoteSeeded();
    msg.textContent='';
    showApp();
    await render();
  }catch(e){
    msg.textContent=e.message||'Giriş yapılamadı.';
  }
};

document.getElementById('loginPassword').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('loginButton').click();
});

document.getElementById('forgotPassword').onclick=async()=>{
  const username=document.getElementById('loginUsername').value.trim().toLowerCase();
  const msg=document.getElementById('authMessage');
  if(!username){msg.textContent='Önce kullanıcı adını yaz.';return;}
  msg.textContent='İstek gönderiliyor...';
  try{
    await rafAuth('forgot',{username});
    msg.textContent='Hesabın kurtarma e-postası tanımlıysa şifre sıfırlama bağlantısı gönderildi.';
  }catch(e){
    msg.textContent=e.message||'İstek gönderilemedi.';
  }
};

document.getElementById('resetPasswordButton').onclick=async()=>{
  const p1=document.getElementById('resetPassword').value;
  const p2=document.getElementById('resetPassword2').value;
  const msg=document.getElementById('resetMessage');
  if(p1!==p2){msg.textContent='Şifreler aynı değil.';return;}
  const token=new URLSearchParams(location.search).get('reset')||'';
  msg.textContent='Şifre değiştiriliyor...';
  try{
    await rafAuth('reset',{reset_token:token,new_password:p1});
    history.replaceState({},'',location.pathname);
    document.getElementById('resetPanel').style.display='none';
    document.getElementById('loginPanel').style.display='block';
    msg.textContent='';
    document.getElementById('authMessage').textContent='Şifre değiştirildi. Yeni şifrenle giriş yapabilirsin.';
  }catch(e){
    msg.textContent=e.message||'Şifre değiştirilemedi.';
  }
};

document.getElementById('logoutButton').onclick=async()=>{
  try{await rafAuth('logout');}catch(e){}
  localStorage.removeItem('raf_auth_token');
  currentUser=null;
  viewAsUserId=null;
  currentRole='employee';
  currentView='home';
  showAuth();
};

document.getElementById('systemUserButton').onclick=async()=>{
  if(!isSystemAdmin()) return;
  const data=await snapshot();
  await systemUserChooser(data);
};

initAuth();
