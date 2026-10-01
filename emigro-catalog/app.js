const BRAND={navy:"#293369",red:"#ec0419"};
const VALIDITY={from:"01-10-2026",to:"30-10-2026"};
const palette=["#293369","#3b4a89","#5663a3","#ec0419","#f03748","#b60618","#68729d","#8890b1","#a61b2b"];
const cats=[
 ["Soft Drinks",palette[0],"Australia","🥤"],["Juices",palette[1],"Turkey","🍎"],["Sauces",palette[3],"Belgium","🥣"],
 ["Snacks",palette[4],"Netherlands","🍿"],["Frozen",palette[2],"Netherlands","❄️"],["Grocery",palette[5],"Turkey","🧺"],
 ["Dairy",palette[6],"Germany","🥛"],["Sweets",palette[8],"Turkey","🍬"],["Non-Food",palette[7],"Netherlands","✨"]
];
const names=["Original","Classic","Premium","Gold","Family","Select","Fresh","Royal","Extra","Natural","Special","Max","Traditional","Deluxe","Daily","Pro","Mini","XL","Pure","Signature","Choice","Plus","Top"];
const products=cats.flatMap((c,ci)=>Array.from({length:23},(_,i)=>{
 const id=ci*23+i+1,palletOnly=i%7===0,caseOnly=!palletOnly&&i%6===0;
 const casePrice=palletOnly?null:+(14.5+ci*1.35+(i%9)*.85).toFixed(2);
 const palletCases=48+((i+ci)%5)*6,caseQty=[6,12,18,24][(i+ci)%4];
 const palletPrice=caseOnly?null:+(((casePrice??20.5)*palletCases*.965).toFixed(2));
 const beverage=ci===0||ci===1;
 const statiegeld=beverage?(i%3===0?0:(i%2===0?0.15:0.25)):null;
 return {id,sku:`EM-${String(ci+1).padStart(2,"0")}-${String(i+1).padStart(3,"0")}`,
 brand:["Emigro","Manna","Golden","Anatolia","EuroTaste"][(i+ci)%5],
 name:`${names[i%names.length]} ${c[0].replace("Soft Drinks","Drink").replace("Non-Food","Care")}`,
 category:c[0],origin:c[2],ean:`87${String(10000000000+id*731).slice(-11)}`,
 net:["250 ml","330 ml","375 ml","500 ml","750 g","1 kg"][(i+ci)%6],
 caseQty,palletCases,casePrice,palletPrice,tone:c[1],icon:c[3],hero:i===0,featured:i===1||i===7,heroLayout:ci%2===0?"editorial":"grid4",
 beverage,statiegeld};
}));
const euro=n=>n==null?"Prijs op aanvraag":new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(n);
let active="All",shown=24,sort="name",query="",selected=null,selectedImage=0,compare=[],priceMode={},favorites=JSON.parse(localStorage.getItem("emigro-favorites")||"[]"),quoteItems=JSON.parse(localStorage.getItem("emigro-quote")||"[]");

const bottle=(p,large=false)=>`<div class="bottle ${large?"large":""}" style="background:linear-gradient(155deg,${p.tone},#1c234a)"><div class="cap"></div><div class="label">PREMIUM<br>SELECTION</div></div>`;
const catMeta=name=>cats.find(c=>c[0]===name);
const modeFor=p=>priceMode[p.id]||(p.casePrice!=null?"case":"pallet");
const currentPrice=p=>modeFor(p)==="case"?p.casePrice:p.palletPrice;
const depositText=p=>!p.beverage?"":(p.statiegeld>0?`Statiegeld: Ja · ${euro(p.statiegeld)}`:"Statiegeld: Nee");

function renderHero(){
 const heroes=products.filter(p=>p.hero).slice(0,4);
 const root=document.getElementById("heroCluster");
 root.innerHTML=heroes[0].heroLayout==="editorial"
  ?`<div class="hero-tile editorial"><div><div class="eyebrow">HERO PRODUCT</div><h3>${heroes[0].brand}<br>${heroes[0].name}</h3><small>${heroes[0].category} · ${heroes[0].origin}</small></div><div style="display:grid;place-items:center">${bottle(heroes[0],true)}</div></div>`
  :heroes.map(p=>`<div class="hero-tile" onclick="openProduct(${p.id})">${bottle(p)}<small>${p.name}</small></div>`).join("");
}
function renderCategorySquares(){
 document.getElementById("categorySquares").innerHTML=cats.map(c=>`
 <button class="category-square" style="--cat:${c[1]}" onclick="setCategory('${c[0]}')">
   <span class="category-square-icon">${c[3]}</span><strong>${c[0]}</strong><small>23 ürün</small>
 </button>`).join("");
}
function renderCategories(){
 document.getElementById("categories").innerHTML=
 `<button class="category-btn ${active==="All"?"active":""}" style="${active==="All"?`background:${BRAND.navy}`:""}" onclick="setCategory('All')"><span class="cat-icon">☰</span>Tümü (207)</button>`+
 cats.map(c=>`<button class="category-btn ${active===c[0]?"active":""}" ${active===c[0]?`style="background:${c[1]}"`:""} onclick="setCategory('${c[0]}')"><span class="cat-icon">${c[3]}</span>${c[0]} (23)</button>`).join("");
}
function setCategory(c){active=c;shown=24;renderAll();document.getElementById("products").scrollIntoView({behavior:"smooth",block:"start"})}
function filtered(){
 let list=products.filter(p=>(active==="All"||p.category===active)&&(`${p.brand} ${p.name} ${p.category} ${p.origin} ${p.ean} ${p.sku}`).toLowerCase().includes(query.toLowerCase()));
 if(sort==="low")list.sort((a,b)=>(a.casePrice??a.palletPrice??99999)-(b.casePrice??b.palletPrice??99999));
 else if(sort==="high")list.sort((a,b)=>(b.casePrice??b.palletPrice??0)-(a.casePrice??a.palletPrice??0));
 else list.sort((a,b)=>(a.brand+" "+a.name).localeCompare(b.brand+" "+b.name));
 return list;
}
function renderBanner(){
 const root=document.getElementById("categoryBanner");
 if(active==="All"){root.innerHTML="";return}
 const c=catMeta(active);
 root.innerHTML=`<div class="category-banner" style="background:linear-gradient(135deg,${c[1]},${BRAND.navy})"><div><div class="eyebrow" style="color:#fff;opacity:.8">KATEGORİ ${String(cats.indexOf(c)+1).padStart(2,"0")}</div><h2>${c[3]} ${c[0]}</h2><p>23 ürün · ${c[2]} ağırlıklı seçki</p></div><div class="category-mark">${c[3]}</div></div>`;
}
function heroBlock(index){
 const heroProducts=products.filter(p=>p.hero),p=heroProducts[Math.floor(index/12-1)%heroProducts.length];
 if(!p)return"";
 if(p.heroLayout==="grid4"){const four=products.filter(x=>x.category===p.category).slice(0,4);return `<section class="inline-hero grid4">${four.map(x=>`<div class="mini-hero" onclick="openProduct(${x.id})">${bottle(x)}<h4>${x.name}</h4><small>${x.brand}</small></div>`).join("")}</section>`}
 return `<section class="inline-hero"><div><div class="eyebrow">HERO PRODUCT · ${p.category}</div><h2 style="font:600 42px/.96 var(--serif);margin:8px 0">${p.brand}<br>${p.name}</h2><p>${p.origin} · ${p.net}</p><button class="ghost" onclick="openProduct(${p.id})">Ürünü aç</button></div><div style="display:grid;place-items:center">${bottle(p,true)}</div></section>`;
}
function quoteButton(p){
 const mode=modeFor(p),inQuote=quoteItems.some(x=>x.id===p.id&&x.mode===mode);
 return `<button class="quote-product-btn ${inQuote?"added":""}" onclick="addQuote(${p.id})">${inQuote?"✓ Teklif listesinde":"+ Teklif iste"}</button>`;
}
function card(p,index){
 const dual=p.casePrice!=null&&p.palletPrice!=null,mode=modeFor(p);
 return `${index>0&&index%12===0?heroBlock(index):""}<article class="card">
 <button class="card-media" onclick="openProduct(${p.id})"><span class="badge">${p.icon} ${p.category}</span>${bottle(p)}${p.beverage?`<span class="deposit-badge ${p.statiegeld>0?"yes":"no"}">${p.statiegeld>0?"Statiegeld":"Geen statiegeld"}</span>`:""}</button>
 <div class="card-body"><div class="brandline">${p.brand} · ${p.origin}</div><h3>${p.name}</h3><div class="meta"><span>${p.net}</span><span>EAN ${p.ean}</span><span>${p.palletCases} koli/palet</span></div>
 ${p.beverage?`<div class="deposit-line">${depositText(p)}</div>`:""}
 ${dual?`<div class="price-switch"><button class="${mode==="case"?"active":""}" onclick="setMode(${p.id},'case')">Koli</button><button class="${mode==="pallet"?"active":""}" onclick="setMode(${p.id},'pallet')">Palet</button></div>`:`<div class="single-type">ⓘ ${p.casePrice!=null?"Sadece koli fiyatı":"Sadece palet fiyatı"}</div>`}
 <div class="pricebox"><div><span>${mode==="case"?"Koli fiyatı":"Palet fiyatı"}</span><strong>${euro(currentPrice(p))}</strong></div><small>${mode==="case"?p.caseQty+" adet / koli":p.palletCases+" koli / palet"}</small></div>
 <div class="price-valid-mini">Geçerli: ${VALIDITY.from} / ${VALIDITY.to}</div>
 <div class="card-actions"><button class="ghost" onclick="openProduct(${p.id})">Detay</button><button class="ghost" ${compare.length>=3&&!compare.includes(p.id)?"disabled":""} onclick="toggleCompare(${p.id})">${compare.includes(p.id)?"Seçildi":"Kıyasla"}</button></div>
 ${quoteButton(p)}</div></article>`;
}
function setMode(id,mode){priceMode[id]=mode;renderProducts();if(selected?.id===id){renderDetailCommerce();renderDetailQuoteButton()}renderQuoteCart()}
function renderProducts(){
 const list=filtered();document.getElementById("resultCount").textContent=`${list.length} sonuç · ilk ${Math.min(shown,list.length)} ürün gösteriliyor`;
 document.getElementById("productGrid").innerHTML=list.slice(0,shown).map(card).join("");
 document.getElementById("loadMore").style.display=shown<list.length?"inline-block":"none";
}
function renderFeatured(){
 const list=products.filter(p=>p.featured).slice(0,8);
 document.getElementById("featuredGrid").innerHTML=list.map(p=>`<article class="featured-card" onclick="openProduct(${p.id})">${bottle(p)}<div class="brandline">${p.category}</div><h3>${p.brand}<br>${p.name}</h3><div class="meta">${p.origin} · ${p.net}</div>${p.beverage?`<div class="deposit-line">${depositText(p)}</div>`:""}</article>`).join("");
}
function renderAll(){renderBanner();renderCategories();renderProducts();renderCompareBar();renderQuoteCart()}
function openProduct(id){
 selected=products.find(p=>p.id===id);selectedImage=0;
 document.getElementById("modalTitle").textContent=selected.brand+" "+selected.name;
 document.getElementById("modalSub").textContent=selected.origin+" · "+selected.category;
 document.getElementById("factsGrid").innerHTML=[["SKU",selected.sku],["EAN",selected.ean],["Net",selected.net],["Koli içi",selected.caseQty],["Palet içi",selected.palletCases],["Menşei",selected.origin]].map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join("");
 document.getElementById("depositDetail").innerHTML=selected.beverage?`<div class="deposit-detail ${selected.statiegeld>0?"yes":"no"}"><b>${selected.statiegeld>0?"Statiegeld aanwezig":"Geen statiegeld"}</b><span>${selected.statiegeld>0?euro(selected.statiegeld)+" per verpakking":"Dit product heeft geen statiegeld"}</span></div>`:"";
 renderMedia();renderDetailCommerce();renderFav();renderDetailQuoteButton();
 document.getElementById("productModal").classList.remove("hidden");
 history.replaceState(null,"",`?product=${encodeURIComponent(selected.sku)}`);
}
function renderMedia(){
 const media=document.getElementById("mainMedia");
 media.innerHTML=selectedImage===0?bottle(selected,true):selectedImage===1?`<div class="case-visual">CASE<small>${selected.caseQty} PCS</small></div>`:`<div class="pallet-visual"><b>PALLET</b><small>${selected.palletCases} CASES</small></div>`;
 document.getElementById("thumbs").innerHTML=[["Ürün",0,bottle(selected)],["Koli",1,'<div class="case-visual" style="width:70px;height:46px;font-size:12px">CASE</div>'],["Palet",2,'<div class="pallet-visual" style="width:70px;height:46px;font-size:10px">PALLET</div>']].map(([n,i,v])=>`<button class="thumb ${selectedImage==i?"active":""}" onclick="selectedImage=${i};renderMedia()">${v}<span>${n}</span></button>`).join("");
}
function renderDetailCommerce(){
 const dual=selected.casePrice!=null&&selected.palletPrice!=null,mode=modeFor(selected);
 document.getElementById("detailPriceArea").innerHTML=`<div class="detail-commerce">${dual?`<div class="price-switch"><button class="${mode==="case"?"active":""}" onclick="setMode(${selected.id},'case')">Koli</button><button class="${mode==="pallet"?"active":""}" onclick="setMode(${selected.id},'pallet')">Palet</button></div>`:`<div class="single-type">ⓘ ${selected.casePrice!=null?"Sadece koli fiyatı":"Sadece palet fiyatı"}</div>`}<div class="detail-price"><span>${mode==="case"?"Koli fiyatı":"Palet fiyatı"}</span><strong>${euro(currentPrice(selected))}</strong><small>${mode==="case"?selected.caseQty+" adet / koli":selected.palletCases+" koli / palet"}</small></div><div class="detail-validity">Fiyat geçerliliği: <b>${VALIDITY.from} — ${VALIDITY.to}</b></div></div>`;
}
function renderDetailQuoteButton(){
 const mode=modeFor(selected),inQuote=quoteItems.some(x=>x.id===selected.id&&x.mode===mode);
 const b=document.getElementById("detailQuoteBtn");b.textContent=inQuote?"✓ Teklif listesinde":"+ Teklif iste";b.classList.toggle("added",inQuote);
}
function renderFav(){const yes=favorites.includes(selected.id);document.getElementById("favoriteBtn").textContent=yes?"✓ Favoride":"♡ Favorilere ekle"}
function toggleFavorite(){favorites=favorites.includes(selected.id)?favorites.filter(x=>x!==selected.id):[...favorites,selected.id];localStorage.setItem("emigro-favorites",JSON.stringify(favorites));renderFav()}
async function shareProduct(){const url=`${location.origin}${location.pathname}?product=${selected.sku}`;try{if(navigator.share)await navigator.share({title:selected.brand+" "+selected.name,url});else await navigator.clipboard.writeText(url);document.getElementById("shareBtn").textContent="✓ Kopyalandı";setTimeout(()=>document.getElementById("shareBtn").textContent="↗ Paylaş",1500)}catch{}}

function addQuote(id){
 const p=products.find(x=>x.id===id),mode=modeFor(p),existing=quoteItems.find(x=>x.id===id&&x.mode===mode);
 if(existing)quoteItems=quoteItems.filter(x=>!(x.id===id&&x.mode===mode));
 else quoteItems.push({id,mode,qty:1});
 persistQuote();renderProducts();renderQuoteCart();if(selected?.id===id)renderDetailQuoteButton();
}
function persistQuote(){localStorage.setItem("emigro-quote",JSON.stringify(quoteItems))}
function quoteLinePrice(item){const p=products.find(x=>x.id===item.id);return (item.mode==="case"?p.casePrice:p.palletPrice)||0}
function quoteTotal(){return quoteItems.reduce((sum,i)=>sum+quoteLinePrice(i)*i.qty,0)}
function renderQuoteCart(){
 const bar=document.getElementById("quoteCart");if(!quoteItems.length){bar.classList.add("hidden");return}bar.classList.remove("hidden");
 document.getElementById("quoteCount").textContent=quoteItems.length+" ürün";
 document.getElementById("quoteTotal").textContent=euro(quoteTotal());
}
function openQuote(){
 renderQuoteLines();document.getElementById("quoteModal").classList.remove("hidden");
}
function renderQuoteLines(){
 const root=document.getElementById("quoteLines");
 root.innerHTML=quoteItems.map((item,idx)=>{const p=products.find(x=>x.id===item.id),price=quoteLinePrice(item);return `<div class="quote-line"><div class="quote-thumb">${bottle(p)}</div><div><b>${p.brand} ${p.name}</b><span>${item.mode==="case"?"Koli":"Palet"} · ${euro(price)}</span>${p.beverage?`<small>${depositText(p)}</small>`:""}</div><label>Adet<input type="number" min="1" value="${item.qty}" onchange="updateQuoteQty(${idx},this.value)"></label><strong>${euro(price*item.qty)}</strong><button onclick="removeQuote(${idx})">×</button></div>`}).join("");
 document.getElementById("formQuoteTotal").textContent=euro(quoteTotal());
 document.getElementById("quoteSummaryField").value=quoteItems.map(item=>{const p=products.find(x=>x.id===item.id);return `${p.sku} | ${p.brand} ${p.name} | ${item.mode==="case"?"Koli":"Palet"} | Adet: ${item.qty} | ${euro(quoteLinePrice(item))}${p.beverage?" | "+depositText(p):""}`}).join("\n");
}
function updateQuoteQty(idx,val){quoteItems[idx].qty=Math.max(1,parseInt(val||"1",10));persistQuote();renderQuoteLines();renderQuoteCart()}
function removeQuote(idx){quoteItems.splice(idx,1);persistQuote();renderQuoteLines();renderQuoteCart();renderProducts();if(!quoteItems.length)closeModal("quoteModal")}
function toggleCompare(id){compare=compare.includes(id)?compare.filter(x=>x!==id):compare.length<3?[...compare,id]:compare;renderAll()}
function renderCompareBar(){
 const bar=document.getElementById("compareBar");if(!compare.length){bar.classList.add("hidden");return}bar.classList.remove("hidden");
 document.getElementById("compareCount").textContent=`${compare.length}/3 ürün seçildi`;
 document.getElementById("compareChips").innerHTML=compare.map(id=>{const p=products.find(x=>x.id===id);return `<span class="chip">${p.name} ×</span>`}).join("");
 document.getElementById("compareOpen").disabled=compare.length<2;
}
function openCompare(){
 const list=compare.map(id=>products.find(p=>p.id===id)),modes=list.map(modeFor),aligned=modes.every(m=>m===modes[0]);
 if(!aligned){
  document.getElementById("warnRows").innerHTML=list.map(p=>`<div class="facts-grid"><div><span>${p.name}</span><strong>${modeFor(p)==="case"?"Koli":"Palet"}</strong></div></div>`).join("");
  const canCase=list.every(p=>p.casePrice!=null),canPallet=list.every(p=>p.palletPrice!=null);
  document.getElementById("warnActions").innerHTML=`${canCase?'<button class="btn" onclick="alignCompare(\'case\')">Tümünü koliye çevir</button>':""}${canPallet?'<button class="btn" onclick="alignCompare(\'pallet\')">Tümünü palete çevir</button>':""}`;
  document.getElementById("compareWarn").classList.remove("hidden");return;
 }
 renderCompare(list);
}
function alignCompare(mode){compare.forEach(id=>priceMode[id]=mode);closeModal("compareWarn");renderCompare(compare.map(id=>products.find(p=>p.id===id)))}
function renderCompare(list){
 const mode=modeFor(list[0]);document.getElementById("compareDesc").textContent=(mode==="case"?"Koli":"Palet")+" fiyatları yan yana karşılaştırılıyor.";
 document.getElementById("compareGrid").innerHTML=list.map(p=>`<article class="compare-col"><div class="visual">${bottle(p)}</div><div class="brandline">${p.category}</div><h3>${p.brand}<br>${p.name}</h3><div class="compare-price"><span>${mode==="case"?"Koli fiyatı":"Palet fiyatı"}</span><strong>${euro(mode==="case"?p.casePrice:p.palletPrice)}</strong></div><dl><div><dt>Menşei</dt><dd>${p.origin}</dd></div><div><dt>Net</dt><dd>${p.net}</dd></div><div><dt>Koli içi</dt><dd>${p.caseQty}</dd></div><div><dt>Palet içi</dt><dd>${p.palletCases}</dd></div><div><dt>EAN</dt><dd>${p.ean}</dd></div>${p.beverage?`<div><dt>Statiegeld</dt><dd>${p.statiegeld>0?euro(p.statiegeld):"Yok"}</dd></div>`:""}</dl></article>`).join("");
 document.getElementById("compareModal").classList.remove("hidden");
}
function closeModal(id){document.getElementById(id).classList.add("hidden");if(id==="productModal")history.replaceState(null,"",location.pathname)}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.getElementById("search").oninput=e=>{query=e.target.value;shown=24;renderProducts()};
document.getElementById("sort").onchange=e=>{sort=e.target.value;renderProducts()};
document.getElementById("loadMore").onclick=()=>{shown+=24;renderProducts()};
document.getElementById("compareOpen").onclick=openCompare;
document.getElementById("priceInfoBtn").onclick=()=>document.getElementById("priceInfo").classList.remove("hidden");
document.getElementById("favoriteBtn").onclick=toggleFavorite;
document.getElementById("shareBtn").onclick=shareProduct;
document.getElementById("mainMedia").onclick=()=>{selectedImage=(selectedImage+1)%3;renderMedia()};
document.getElementById("detailQuoteBtn").onclick=()=>selected&&addQuote(selected.id);
document.getElementById("openQuote").onclick=openQuote;
renderHero();renderCategorySquares();renderFeatured();renderAll();
const sku=new URLSearchParams(location.search).get("product");if(sku){const p=products.find(x=>x.sku===sku);if(p)openProduct(p.id)}
