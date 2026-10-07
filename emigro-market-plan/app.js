(() => {
const STORAGE='emigro-plan-v1';
const GRID=40,SNAP=10;
const CATS={
  giris:['Giriş','#8de4a6'],koridor:['Koridor','#dce3e8'],depo:['Depo','#d3bda3'],soguk:['Soğuk','#84d0e8'],
  dondurucu:['Dondurucu','#6fbce6'],raf:['Raf','#f4d98e'],taze:['Taze / Sebze','#ade37f'],kasap:['Kasap','#f78e92'],
  icecek:['İçecek / Su','#8bd9df'],nonfood:['Nonfood','#cbb9eb'],kasa:['Kasa','#ffab68'],mutfak:['Mutfak','#ffb29a']
};
const PRESETS=[
 ['Tekli Raf',160,40,'raf'],['Çift Taraflı Raf',160,80,'raf'],['Duvar Rafı',320,30,'raf'],['Kısa Raf',80,40,'raf'],
 ['Uzun Raf',400,40,'raf'],['Dipfriz / Dondurucu',200,80,'dondurucu'],['Dik Dondurucu',160,40,'dondurucu'],
 ['Soğutucu Dolap',200,40,'soguk'],['Kasa',80,160,'kasa'],['Palet Alanı',60,60,'depo'],['Sebze-Meyve Standı',120,120,'taze'],
 ['Nonfood Standı',120,80,'nonfood'],['Depo Alanı',240,200,'depo'],['Koridor / Boş Alan',400,80,'koridor']
];
const A=(id,num,name,x,y,w,h,cat,rot=0)=>({id,num,name,x,y,w,h,cat,rot,locked:false});
const seed=()=>[
 A('a25',25,'mutfak koridor',20,220,240,60,'koridor'),
 A('a26',26,'mutfak',275,173,240,108,'mutfak'),
 A('a24',24,'iç koridor',20,293,495,50,'koridor'),
 A('a17',17,'su koridor',22,365,50,205,'icecek'),
 A('a18',18,'su koridor1',82,365,50,205,'icecek'),
 A('a9',9,'pat2',227,365,38,205,'raf'),
 A('a10',10,'pat3',287,365,38,205,'raf'),
 A('a11',11,'pat14',347,365,38,205,'raf'),
 A('a12',12,'pat5',407,365,38,205,'raf'),
 A('a13',13,'pat6',467,365,38,205,'raf'),
 A('a19',19,'nonfood koridor',22,592,240,38,'nonfood'),
 A('a20',20,'nonfood koridor1',22,640,240,38,'nonfood'),
 A('a21',21,'nonfood koridor2',22,688,240,38,'nonfood'),
 A('a22',22,'nonfood depo',22,736,240,50,'depo'),
 A('a23',23,'kasa',335,725,190,60,'kasa'),
 A('a6',6,'dipfriz sol',526,592,70,110,'dondurucu'),
 A('a7',7,'dipfriz sağ',610,592,72,110,'dondurucu'),
 A('a2',2,'giriş sağ koridor',694,498,60,289,'koridor'),
 A('a1',1,'giriş',790,720,120,60,'giris'),
 A('a14',14,'sebze karşısı baharat',520,360,145,49,'taze'),
 A('a33',33,'kasap deepfriz',545,24,220,150,'soguk'),
 A('a16',16,'kasap',545,174,318,150,'kasap'),
 A('a32',32,'sebze depo',862,24,234,150,'soguk'),
 A('a15',15,'sebze',862,174,234,150,'taze'),
 A('a4',4,'giriş sağ koridor depo',1280,66,145,180,'depo'),
 A('a36',36,'baharat',1430,66,96,36,'raf'),
 A('a31',31,'deepfriz 1',1455,144,30,345,'dondurucu'),
 A('a34',34,'palet içecekler 1',1485,144,30,345,'koridor'),
 A('a35',35,'baharat',1538,65,38,428,'raf'),
 A('a28',28,'deepfriz 2',1455,550,48,235,'dondurucu'),
 A('a30',30,'lokum şekerleme',1520,545,50,240,'dondurucu'),
 A('a27',27,'lokum şekerleme',1030,772,340,26,'soguk'),
 A('a5',5,'giriş sağ koridor ilerisi soğuk depo',981,797,290,108,'soguk'),
 A('a29',29,'deepfriz',1270,797,300,108,'dondurucu'),
 // Orta raf grubu - plandaki mevcut sıra
 A('s14','14','baharat',862,348,504,36,'raf'),
 A('s13','13','konserve',862,400,504,36,'raf'),
 A('s12','12','konserve',862,454,504,36,'raf'),
 A('s11','11','sos',862,508,504,36,'raf'),
 A('s10','10','mutfak grubu',862,562,504,36,'raf'),
 A('s9','9','zeytin / yağ',862,616,504,36,'raf'),
 A('s8','8','kahvaltılık',862,670,504,36,'raf'),
 A('s7','7','pirinç',862,724,504,36,'raf'),
 A('s6','6','bakliyat',862,778,504,36,'raf'),
 A('s5','5','çay kahve',862,832,504,36,'raf'),
 A('s4','4','kuruyemiş',862,886,504,36,'raf'),
 A('s3','3','lokum şekerleme',862,940,504,36,'raf'),
 A('s2','2','cips',862,994,504,36,'raf')
];

let areas=[],selected=new Set(),past=[],future=[],loaded=false;
let view={x:20,y:20,s:.85},drag=null,spaceDown=false,marquee=null;
const $=s=>document.querySelector(s), svg=$('#canvas'), layer=$('#planLayer'), viewport=$('#viewport');

function migrate(v){
 if(!Array.isArray(v)) return null;
 return v.map((o,i)=>({
  id:String(o.id||('m'+i)),num:o.num??i+1,name:String(o.name||'alan'),
  x:+o.x||0,y:+o.y||0,w:Math.max(10,+o.w||80),h:Math.max(10,+o.h||80),
  cat:o.cat||o.category||'raf',rot:[0,90,180,270].includes(+o.rot)?+o.rot:([0,90,180,270].includes(+o.rotation)?+o.rotation:0),
  locked:!!o.locked
 }));
}
try{ const raw=localStorage.getItem(STORAGE); areas=migrate(raw?JSON.parse(raw):null)||seed(); }catch{areas=seed()}
loaded=true;

function save(){ if(loaded)localStorage.setItem(STORAGE,JSON.stringify(areas));}
function snap(v,on=true){return on?Math.round(v/SNAP)*SNAP:Math.round(v)}
function maxNum(){return Math.max(0,...areas.map(a=>Number(a.num)||0))}
function commit(next,prev=areas){past.push(JSON.parse(JSON.stringify(prev)));if(past.length>100)past.shift();future=[];areas=next;save();render()}
function undo(){if(!past.length)return;future.unshift(JSON.parse(JSON.stringify(areas)));areas=past.pop();save();selected.clear();render()}
function redo(){if(!future.length)return;past.push(JSON.parse(JSON.stringify(areas)));areas=future.shift();save();selected.clear();render()}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.add('hidden'),1800)}
function worldFromEvent(e){const r=svg.getBoundingClientRect();return{x:(e.clientX-r.left-view.x)/view.s,y:(e.clientY-r.top-view.y)/view.s}}
function applyView(){viewport.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.s})`);$('#zoomLabel').textContent=Math.round(view.s*100)+'%'}
function areaFill(a){return (CATS[a.cat]||CATS.raf)[1]}

function render(){
 layer.innerHTML='';
 for(const a of areas){
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.classList.add('area');g.dataset.id=a.id;
  if(selected.has(a.id))g.classList.add('selected');if(a.locked)g.classList.add('locked');
  const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.classList.add('body');r.setAttribute('x',a.x);r.setAttribute('y',a.y);r.setAttribute('width',a.w);r.setAttribute('height',a.h);r.setAttribute('fill',areaFill(a));g.append(r);
  const cx=a.x+a.w/2,cy=a.y+a.h/2;const textG=document.createElementNS('http://www.w3.org/2000/svg','g');
  if(a.h>a.w*1.45)textG.setAttribute('transform',`rotate(-90 ${cx} ${cy})`);
  const n=document.createElementNS('http://www.w3.org/2000/svg','text');n.classList.add('num-text');n.setAttribute('x',cx);n.setAttribute('y',cy-4);n.setAttribute('text-anchor','middle');n.setAttribute('font-size',Math.max(10,Math.min(38,a.h*.34,a.w*.22)));n.textContent=a.num;textG.append(n);
  const nm=document.createElementNS('http://www.w3.org/2000/svg','text');nm.classList.add('name-text');nm.setAttribute('x',cx);nm.setAttribute('y',cy+14);nm.setAttribute('text-anchor','middle');nm.setAttribute('font-size',Math.max(6,Math.min(12,a.h*.12,a.w/(String(a.name).length*.65))));nm.textContent=a.name;textG.append(nm);g.append(textG);
  if(selected.has(a.id)&&selected.size===1&&!a.locked){
   for(const [c,hx,hy] of [['nw',a.x,a.y],['ne',a.x+a.w,a.y],['sw',a.x,a.y+a.h],['se',a.x+a.w,a.y+a.h]]){
    const h=document.createElementNS('http://www.w3.org/2000/svg','rect');h.classList.add('handle');h.dataset.corner=c;h.setAttribute('x',hx-6/view.s);h.setAttribute('y',hy-6/view.s);h.setAttribute('width',12/view.s);h.setAttribute('height',12/view.s);g.append(h);
   }
  }
  layer.append(g);
 }
 applyView();renderList();renderProps();$('#areaCount').textContent='('+areas.length+')';$('#selectionCount').textContent=selected.size+' seçili';
 $('#copyBtn').disabled=!selected.size;$('#deleteBtn').disabled=!selected.size;$('#undoBtn').disabled=!past.length;$('#redoBtn').disabled=!future.length;
}

function renderList(){
 const box=$('#areaList');box.innerHTML='';
 const sorted=[...areas].sort((a,b)=>(Number(a.num)||999)-(Number(b.num)||999));
 for(const a of sorted){
  const b=document.createElement('button');b.className='area-row'+(selected.has(a.id)?' selected':'');b.dataset.id=a.id;
  b.innerHTML=`<span class="swatch" style="background:${areaFill(a)}"></span><span class="area-num">${a.num}</span><span class="area-name">${esc(a.name)}</span>${a.locked?' 🔒':''}`;
  b.onclick=e=>selectArea(a.id,e.shiftKey);box.append(b);
 }
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function selectArea(id,add){
 if(add){selected.has(id)?selected.delete(id):selected.add(id)}else{selected.clear();selected.add(id)}render()
}

function renderProps(){
 const p=$('#properties');
 if(!selected.size){p.innerHTML='<h3>Özellikler</h3><div class="empty-props">Düzenlemek için bir alan seçin.<br><br><b>Shift + tıklama</b> ile birden fazla alan seçebilirsiniz.</div>';return}
 const sel=areas.filter(a=>selected.has(a.id));
 if(sel.length>1){
  const allLocked=sel.every(a=>a.locked);
  p.innerHTML=`<h3>${sel.length} alan seçili</h3><div class="field"><label>Toplu kategori</label><div class="category-grid">${catButtons('')}</div></div>
  <div class="multi-actions"><button id="groupLock">${allLocked?'Kilidi Aç':'Tümünü Kilitle'}</button></div>
  <div class="prop-actions"><button id="groupCopy">Kopyala</button><button id="groupDelete" class="danger">Sil</button></div>
  <div class="empty-props" style="margin-top:12px">${sel.map(a=>a.num+' · '+esc(a.name)).join('<br>')}</div>`;
  p.querySelectorAll('.cat-btn').forEach(b=>b.onclick=()=>bulkCat(b.dataset.cat));
  $('#groupLock').onclick=()=>bulkLock(!allLocked);$('#groupCopy').onclick=duplicateSelection;$('#groupDelete').onclick=deleteSelection;return
 }
 const a=sel[0];
 p.innerHTML=`<h3>Özellikler</h3>
 <div class="grid2"><div class="field"><label>No</label><input id="pNum" value="${a.num}"></div><div class="field"><label>Döndür</label><select id="pRot"><option>0</option><option>90</option><option>180</option><option>270</option></select></div></div>
 <div class="field"><label>Ad</label><input id="pName" value="${esc(a.name)}"></div>
 <div class="grid2">
  <div class="field"><label>X</label><input id="pX" type="number" value="${a.x}"></div><div class="field"><label>Y</label><input id="pY" type="number" value="${a.y}"></div>
  <div class="field"><label>Genişlik</label><input id="pW" type="number" value="${a.w}"></div><div class="field"><label>Yükseklik</label><input id="pH" type="number" value="${a.h}"></div>
 </div>
 <div class="field"><label>Renk / kategori</label><div class="category-grid">${catButtons(a.cat)}</div></div>
 <div class="prop-actions"><button id="lockOne" class="${a.locked?'orange':''}">${a.locked?'Kilidi Aç':'Kilitle'}</button><button id="copyOne">Kopyala</button><button id="deleteOne" class="danger">Sil</button></div>`;
 $('#pRot').value=String(a.rot||0);
 const bind=(id,key,conv=v=>v)=>{$(id).onchange=e=>patchOne(a.id,{[key]:conv(e.target.value)})};
 bind('#pNum','num');bind('#pName','name');bind('#pX','x',Number);bind('#pY','y',Number);bind('#pW','w',v=>Math.max(10,Number(v)));bind('#pH','h',v=>Math.max(10,Number(v)));bind('#pRot','rot',Number);
 p.querySelectorAll('.cat-btn').forEach(b=>b.onclick=()=>patchOne(a.id,{cat:b.dataset.cat}));
 $('#lockOne').onclick=()=>patchOne(a.id,{locked:!a.locked});$('#copyOne').onclick=duplicateSelection;$('#deleteOne').onclick=deleteSelection;
}
function catButtons(active){return Object.entries(CATS).map(([k,[label,color]])=>`<button class="cat-btn ${active===k?'active':''}" data-cat="${k}"><span class="swatch" style="background:${color}"></span>${label}</button>`).join('')}
function patchOne(id,patch){commit(areas.map(a=>a.id===id?{...a,...patch}:a))}
function bulkCat(cat){commit(areas.map(a=>selected.has(a.id)?{...a,cat}:a))}
function bulkLock(v){commit(areas.map(a=>selected.has(a.id)?{...a,locked:v}:a))}

function addPreset(p){
 const r=svg.getBoundingClientRect(), center={x:(r.width/2-view.x)/view.s,y:(r.height/2-view.y)/view.s};
 const n=maxNum()+1,id='a'+Date.now()+Math.random().toString(36).slice(2,5);
 const a=A(id,n,p[0],snap(center.x-p[1]/2),snap(center.y-p[2]/2),p[1],p[2],p[3]);
 commit([...areas,a]);selected.clear();selected.add(id);render()
}
function addGeneric(){addPreset(['Yeni Alan',160,100,'raf'])}
function duplicateSelection(){
 if(!selected.size)return;const sel=areas.filter(a=>selected.has(a.id));let n=maxNum();const ids=[];const copies=sel.map((a,i)=>{const id='a'+Date.now()+i+Math.random().toString(36).slice(2,5);ids.push(id);return{...a,id,num:++n,x:a.x+40,y:a.y+40,locked:false}});
 commit([...areas,...copies]);selected=new Set(ids);render()
}
function deleteSelection(){if(!selected.size)return;commit(areas.filter(a=>!selected.has(a.id)));selected.clear();render()}

function startAreaDrag(e,id,corner){
 const a=areas.find(x=>x.id===id);if(!a)return;
 if(e.shiftKey&&!corner){selected.has(id)?selected.delete(id):selected.add(id);render();return}
 if(!selected.has(id)){selected.clear();selected.add(id)}
 const sel=areas.filter(x=>selected.has(x.id));
 if(sel.some(x=>x.locked)){showToast('Seçimde kilitli alan var. Önce kilidi açın.');render();return}
 const p=worldFromEvent(e),orig=Object.fromEntries(sel.map(x=>[x.id,{x:x.x,y:x.y,w:x.w,h:x.h}]));
 drag=corner?{type:'resize',id,corner,start:p,orig:orig[id],before:JSON.parse(JSON.stringify(areas))}:{type:'move',ids:[...selected],start:p,orig,before:JSON.parse(JSON.stringify(areas))};
 render()
}
function moveDrag(e){
 if(!drag)return;
 if(drag.type==='pan'){view.x=drag.v.x+e.clientX-drag.sx;view.y=drag.v.y+e.clientY-drag.sy;applyView();return}
 if(drag.type==='marquee'){
  const p=worldFromEvent(e);marquee={x1:drag.start.x,y1:drag.start.y,x2:p.x,y2:p.y};drawMarquee();return
 }
 const p=worldFromEvent(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y,doSnap=!e.altKey;
 if(drag.type==='move'){
  areas=areas.map(a=>drag.ids.includes(a.id)?{...a,x:snap(drag.orig[a.id].x+dx,doSnap),y:snap(drag.orig[a.id].y+dy,doSnap)}:a);render()
 } else if(drag.type==='resize'){
  const o=drag.orig;let x=o.x,y=o.y,w=o.w,h=o.h,c=drag.corner;
  if(c.includes('e'))w=Math.max(20,snap(o.w+dx,doSnap));if(c.includes('s'))h=Math.max(20,snap(o.h+dy,doSnap));
  if(c.includes('w')){const nx=Math.min(snap(o.x+dx,doSnap),o.x+o.w-20);w=o.x+o.w-nx;x=nx}
  if(c.includes('n')){const ny=Math.min(snap(o.y+dy,doSnap),o.y+o.h-20);h=o.y+o.h-ny;y=ny}
  areas=areas.map(a=>a.id===drag.id?{...a,x,y,w,h}:a);render()
 }
}
function endDrag(e){
 if(!drag)return;
 if(drag.type==='marquee'){
  const box=normMarquee();$('#marquee').classList.add('hidden');
  if(box&&box.w>3&&box.h>3){const hits=areas.filter(a=>a.x>=box.x&&a.y>=box.y&&a.x+a.w<=box.x+box.w&&a.y+a.h<=box.y+box.h).map(a=>a.id);if(!drag.add)selected.clear();hits.forEach(id=>selected.add(id))}
  else if(!drag.add)selected.clear();
  drag=null;marquee=null;render();return
 }
 if(drag.type==='move'||drag.type==='resize'){const before=drag.before;if(JSON.stringify(before)!==JSON.stringify(areas)){past.push(before);future=[];save()}}
 drag=null;render()
}
function drawMarquee(){const b=normMarquee();if(!b)return;const m=$('#marquee');m.classList.remove('hidden');m.setAttribute('x',b.x);m.setAttribute('y',b.y);m.setAttribute('width',b.w);m.setAttribute('height',b.h)}
function normMarquee(){if(!marquee)return null;return{x:Math.min(marquee.x1,marquee.x2),y:Math.min(marquee.y1,marquee.y2),w:Math.abs(marquee.x2-marquee.x1),h:Math.abs(marquee.y2-marquee.y1)}}

svg.addEventListener('pointerdown',e=>{
 svg.setPointerCapture(e.pointerId);
 const h=e.target.closest('.handle'),g=e.target.closest('.area');
 if(g){e.stopPropagation();startAreaDrag(e,g.dataset.id,h&&h.dataset.corner);return}
 if(spaceDown||e.button===1){drag={type:'pan',sx:e.clientX,sy:e.clientY,v:{...view}};return}
 const p=worldFromEvent(e);drag={type:'marquee',start:p,add:e.shiftKey};marquee={x1:p.x,y1:p.y,x2:p.x,y2:p.y};drawMarquee()
});
svg.addEventListener('pointermove',moveDrag);svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,old=view.s,ns=Math.max(.15,Math.min(3,old*(e.deltaY<0?1.1:.9)));view.x=px-(px-view.x)/old*ns;view.y=py-(py-view.y)/old*ns;view.s=ns;applyView()},{passive:false});

window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.code==='Space'){spaceDown=true;e.preventDefault()}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelection()}
 else if(e.key==='Delete'||e.key==='Backspace')deleteSelection()
});
window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false});

function fit(){
 if(!areas.length)return;const r=svg.getBoundingClientRect();const minX=Math.min(...areas.map(a=>a.x)),minY=Math.min(...areas.map(a=>a.y)),maxX=Math.max(...areas.map(a=>a.x+a.w)),maxY=Math.max(...areas.map(a=>a.y+a.h));
 const s=Math.min((r.width-60)/(maxX-minX),(r.height-60)/(maxY-minY),2);view={s,x:(r.width-(maxX-minX)*s)/2-minX*s,y:(r.height-(maxY-minY)*s)/2-minY*s};applyView()
}
function zoom(f){const r=svg.getBoundingClientRect(),px=r.width/2,py=r.height/2,old=view.s,ns=Math.max(.15,Math.min(3,old*f));view.x=px-(px-view.x)/old*ns;view.y=py-(py-view.y)/old*ns;view.s=ns;applyView()}
function resetPlan(){if(confirm('Plan görseldeki başlangıç düzenine dönsün mü?')){commit(seed());selected.clear();setTimeout(fit,0)}}
function exportPNG(){
 const clone=layer.cloneNode(true);clone.querySelectorAll('.handle').forEach(n=>n.remove());clone.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));
 const minX=Math.min(...areas.map(a=>a.x))-20,minY=Math.min(...areas.map(a=>a.y))-20,maxX=Math.max(...areas.map(a=>a.x+a.w))+20,maxY=Math.max(...areas.map(a=>a.y+a.h))+20,w=maxX-minX,h=maxY-minY;
 const s='<svg xmlns="http://www.w3.org/2000/svg" width="'+w*2+'" height="'+h*2+'" viewBox="'+minX+' '+minY+' '+w+' '+h+'"><rect x="'+minX+'" y="'+minY+'" width="'+w+'" height="'+h+'" fill="#f4f6f7"/><style>.num-text{font-family:Arial;font-weight:800}.name-text{font-family:Arial;font-weight:600}.body{stroke:#323c43;stroke-width:1.4}</style>'+clone.outerHTML+'</svg>';
 const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=w*2;c.height=h*2;c.getContext('2d').drawImage(img,0,0);const a=document.createElement('a');a.download='emigro-market-plani.png';a.href=c.toDataURL('image/png');a.click()};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)
}
function printPlan(){window.print()}

for(const p of PRESETS){const b=document.createElement('button');b.className='preset';b.textContent=p[0];b.onclick=()=>addPreset(p);$('#presetGrid').append(b)}
$('#addBtn').onclick=addGeneric;$('#copyBtn').onclick=duplicateSelection;$('#deleteBtn').onclick=deleteSelection;$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
$('#zoomOutBtn').onclick=()=>zoom(.85);$('#zoomInBtn').onclick=()=>zoom(1.18);$('#fitBtn').onclick=fit;$('#resetBtn').onclick=resetPlan;$('#exportBtn').onclick=exportPNG;$('#printBtn').onclick=printPlan;
render();setTimeout(fit,50);
})();