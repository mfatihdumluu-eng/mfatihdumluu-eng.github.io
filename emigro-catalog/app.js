const SUPABASE_URL="https://hroarfuwpfsqilsijwpp.supabase.co";
const SUPABASE_KEY="sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:"emigro-customer-auth",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const BRAND={navy:"#293369",red:"#ec0419"};
let VALIDITY={from:"01-10-2026",to:"30-10-2026"};
const palette=["#293369","#3b4a89","#5663a3","#8890b1"];
let cats=[
 ["Zuivel",palette[0],"Emigro assortiment","🥛"],
 ["Drinks",palette[1],"Emigro assortiment","🥤"],
 ["Diepvries",palette[2],"Emigro assortiment","❄️"],
 ["Non-Food",palette[3],"Emigro assortiment","📦"]
];

const demoProducts=[
 {id:101,sku:"28584",brand:"Yayla",name:"Yayla Yogurt 3.5% 6x1kg",category:"Zuivel",origin:"—",ean:"4027394103014",net:"6x1kg",caseQty:6,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[0],icon:"🥛",hero:true,featured:true,heroLayout:"editorial",beverage:false,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:12,sourceUrl:"https://www.emigro.nl/yayla/4524-yayla-yogurt-35-6x1kg",sourceReference:"28584",campaignBadge:"NIEUW"},
 {id:102,sku:"7472",brand:"Yayla",name:"Yayla Koy Yogurt 2kg",category:"Zuivel",origin:"—",ean:"4027394003703",net:"2kg",caseQty:1,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[0],icon:"🥛",hero:false,featured:true,heroLayout:"editorial",beverage:false,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:18,sourceUrl:"https://www.emigro.nl/yayla/4527-yayla-koy-yogurt-2kg",sourceReference:"7472",campaignBadge:"VOLUME DEAL"},
 {id:103,sku:"26500",brand:"Landhof",name:"Landhof Volle Melk 12x1L",category:"Zuivel",origin:"—",ean:"8718989030070",net:"12x1L",caseQty:12,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[0],icon:"🥛",hero:false,featured:false,heroLayout:"editorial",beverage:true,statiegeld:0,statiegeldScope:"none",specialOfferMode:"pallet",specialOfferQty:2,sourceUrl:"https://www.emigro.nl/landhof/4494-landhof-volle-melk-12x-1lt",sourceReference:"26500",campaignBadge:"ACTIE"},
 {id:201,sku:"17318",brand:"Fuze Tea",name:"Fuze Tea Green Tea 24x330ml",category:"Drinks",origin:"—",ean:"17318",net:"24x330ml",caseQty:24,palletCases:54,caseAvailable:true,palletAvailable:true,tone:palette[1],icon:"🥤",hero:true,featured:true,heroLayout:"grid4",beverage:true,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:20,sourceUrl:"https://www.emigro.nl/1128-fuze-tea",sourceReference:"17318",campaignBadge:"ACTIE"},
 {id:202,sku:"25912",brand:"Fuze Tea",name:"Fuzetea Sparkling Lemon Black Tea 24x330ml",category:"Drinks",origin:"—",ean:"25912",net:"24x330ml",caseQty:24,palletCases:54,caseAvailable:true,palletAvailable:true,tone:palette[1],icon:"🥤",hero:false,featured:true,heroLayout:"grid4",beverage:true,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:20,sourceUrl:"https://www.emigro.nl/1128-fuze-tea",sourceReference:"25912",campaignBadge:"VOLUME DEAL"},
 {id:203,sku:"23959",brand:"Fuze Tea",name:"Fuzetea Black Tea Peach Hibiscus 24x330ml",category:"Drinks",origin:"—",ean:"23959",net:"24x330ml",caseQty:24,palletCases:54,caseAvailable:true,palletAvailable:true,tone:palette[1],icon:"🥤",hero:false,featured:false,heroLayout:"grid4",beverage:true,statiegeld:0,statiegeldScope:"none",specialOfferMode:"pallet",specialOfferQty:2,sourceUrl:"https://www.emigro.nl/1128-fuze-tea",sourceReference:"23959",campaignBadge:"ACTIE"},
 {id:301,sku:"11522",brand:"Firat",name:"Firat Lahmacun 60 stuks",category:"Diepvries",origin:"—",ean:"11522",net:"60 stuks",caseQty:1,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[2],icon:"❄️",hero:true,featured:true,heroLayout:"editorial",beverage:false,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:10,sourceUrl:"https://www.emigro.nl/",sourceReference:"11522",campaignBadge:"NIEUW"},
 {id:401,sku:"6575",brand:"Emigro",name:"Pizza Doos 40cm",category:"Non-Food",origin:"—",ean:"1000000004694",net:"40cm",caseQty:1,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[3],icon:"📦",hero:true,featured:true,heroLayout:"grid4",beverage:false,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:20,sourceUrl:"https://www.emigro.nl/pizza-doos-doner-box/3929-pizza-doos-40cm",sourceReference:"6575",campaignBadge:"VOLUME DEAL"},
 {id:402,sku:"24750",brand:"Eyup Sabri",name:"Eyup Sabri Doekjes Klasik Citroen 150st",category:"Non-Food",origin:"—",ean:"8691685020319",net:"150st",caseQty:1,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[3],icon:"📦",hero:false,featured:true,heroLayout:"grid4",beverage:false,statiegeld:0,statiegeldScope:"none",specialOfferMode:"case",specialOfferQty:12,sourceUrl:"https://www.emigro.nl/eyup-sabri/3982-eyup-sabri-doekjes-klasik-citroen-150st",sourceReference:"24750",campaignBadge:"ACTIE"},
 {id:403,sku:"27958",brand:"Premium Quality",name:"Menu Box 2 Vak 100st",category:"Non-Food",origin:"—",ean:"8712426025209",net:"100st",caseQty:1,palletCases:48,caseAvailable:true,palletAvailable:true,tone:palette[3],icon:"📦",hero:false,featured:false,heroLayout:"grid4",beverage:false,statiegeld:0,statiegeldScope:"none",specialOfferMode:"pallet",specialOfferQty:2,sourceUrl:"https://www.emigro.nl/menubakken-met-deksel/3830-premium-quality-menu-box-2-vak-100st",sourceReference:"27958",campaignBadge:"HORECA"}
];
let products=[...demoProducts];
const euro=n=>n==null?"—":new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(Number(n));
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const jsId=id=>JSON.stringify(id);
function notify(message,type="info"){
 const stack=document.getElementById("toastStack");
 if(!stack){console.log(message);return}
 const el=document.createElement("div");
 el.className="app-toast "+type;
 el.textContent=String(message||"");
 stack.appendChild(el);
 requestAnimationFrame(()=>el.classList.add("show"));
 setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),180)},3200);
}
function syncNetworkState(){
 const banner=document.getElementById("networkBanner");
 if(!banner)return;
 banner.classList.toggle("hidden",navigator.onLine);
}
window.addEventListener("online",()=>{syncNetworkState();notify("İnternet bağlantısı geri geldi.","success")});
window.addEventListener("offline",syncNetworkState);
syncNetworkState();

let active="All",shown=24,sort="name",query="",originFilter="",saleFilter="",depositFilter="",campaignBadgeFilter="",selected=null,selectedImage=0,priceMode={};
let favorites=JSON.parse(localStorage.getItem("emigro-favorites")||"[]");
let quoteItems=JSON.parse(localStorage.getItem("emigro-quote")||"[]");
let session=null,profile=null,priceMap={},pendingAction=null,kvkVerified=false,verifiedKvkData=null,demoMode=false;
let customerOrders=[],customerAddresses=[],customerNotifications=[],customerQuotes=[],liveCatalogLoaded=false;
const REFERRAL_CODE=(new URLSearchParams(location.search).get("ref")||"").trim().toUpperCase();
const URL_PARAMS=new URLSearchParams(location.search);
const CAMPAIGN_TITLE=(URL_PARAMS.get("campaign")||"Deze week geselecteerd").trim();
const CAMPAIGN_SOURCE=(URL_PARAMS.get("src")||"email").trim();
let referralLandingHandled=false;

const approved=()=>demoMode||profile?.status==="approved";
const isAdmin=()=>profile?.role==="admin";
const demoPriceFor=(p,mode)=>{
 const ci=Math.floor((p.id-1)/23),i=(p.id-1)%23;
 const casePrice=p.caseAvailable?Number((14.5+ci*1.35+(i%9)*.85).toFixed(2)):null;
 const palletPrice=p.palletAvailable?Number(((casePrice??20.5)*p.palletCases*.965).toFixed(2)):null;
 return mode==="case"?casePrice:palletPrice;
};
const priceFor=(p,mode)=>{
 if(demoMode)return demoPriceFor(p,mode);
 const row=priceMap[p.sku];
 const base=mode==="case"?row?.case_price:row?.pallet_price;
 if(base==null)return base;
 const discount=Number(profile?.customer_discount_percent||0);
 return Number((Number(base)*(1-discount/100)).toFixed(2));
};
const modeFor=p=>priceMode[p.id]||(p.caseAvailable?"case":"pallet");
const currentPrice=p=>priceFor(p,modeFor(p));
const displayPrice=n=>n==null?"Prijs op aanvraag":euro(n);
const productSourceLink=p=>p?.sourceUrl?`<a class="source-product-link" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">Bekijk op Emigro.nl ↗</a>`:"";
const specialOfferRule=p=>p?.specialOfferMode&&p?.specialOfferQty?{mode:p.specialOfferMode,qty:Number(p.specialOfferQty)}:null;
const specialOfferText=p=>{const r=specialOfferRule(p);return r?`Vanaf ${r.qty} ${r.mode==="case"?"dozen":"pallets"} maken we voor dit product een persoonlijke prijs.`:""};
const specialOfferReached=(p,mode,qty)=>{const r=specialOfferRule(p);return !!r&&r.mode===mode&&Number(qty)>=r.qty};
const depositText=p=>{
 if(!p.beverage&&Number(p.statiegeld||0)<=0)return"";
 if(!p.statiegeld||p.statiegeldScope==="none")return"Statiegeld: Nee";
 const scope=p.statiegeldScope==="case"?"Sadece koli":p.statiegeldScope==="pallet"?"Sadece palet":"Koli + palet";
 return `Statiegeld: Ja · ${euro(p.statiegeld)} · ${scope}`;
};
const bottle=(p,large=false)=>p.image1
 ? `<img class="real-product-image ${large?"large":""}" src="${p.image1}" alt="${p.brand} ${p.name}">`
 : `<div class="bottle ${large?"large":""}" style="background:linear-gradient(155deg,${p.tone},#1c234a)"><div class="cap"></div><div class="label">PREMIUM<br>SELECTION</div></div>`;

async function loadActiveValidity(){
 const {data,error}=await sb.from("emigro_catalog_price_periods").select("name,valid_from,valid_to").eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data)return;
 const fmt=s=>new Date(s+"T12:00:00").toLocaleDateString("nl-NL");
 VALIDITY={from:fmt(data.valid_from),to:fmt(data.valid_to),rawFrom:data.valid_from,rawTo:data.valid_to,name:data.name};
 const text=VALIDITY.from+" — "+VALIDITY.to;
 const global=document.getElementById("globalValidity");if(global)global.textContent=text;
 const quoteStrong=document.getElementById("quoteValidityStrong");if(quoteStrong)quoteStrong.textContent=text;
 const hidden=document.getElementById("quoteValidityHidden");if(hidden)hidden.value=VALIDITY.from+" / "+VALIDITY.to;
 const confirm=document.getElementById("quoteValidityConfirmText");if(confirm)confirm.innerHTML='Fiyatların yalnızca <b>'+text+'</b> tarihleri arasında geçerli olduğunu gördüm ve kabul ediyorum.';
}
async function loadLiveCatalog(){
 const {data,error}=await sb.from("emigro_catalog_products_public").select("*").order("category").order("product_name");
 if(error||!data?.length){liveCatalogLoaded=false;return;}
 liveCatalogLoaded=true;

 const oldMeta=new Map(cats.map(c=>[c[0].toLowerCase(),c]));
 const unique=[...new Set(data.map(x=>x.category).filter(Boolean))];
 cats=unique.map((name,i)=>{
   const known=oldMeta.get(String(name).toLowerCase());
   return known||[name,palette[i%palette.length],"—",["🧺","🥤","🍬","🥣","❄️","🥛","✨"][i%7]];
 });

 const firstByCat=new Set();
 products=data.map((r,i)=>{
   const ci=Math.max(0,cats.findIndex(c=>c[0]===r.category));
   const isFirst=!firstByCat.has(r.category);if(isFirst)firstByCat.add(r.category);
   return {
    id:r.id,
    sku:r.barcode,
    brand:r.brand,
    name:r.product_name,
    category:r.category,
    origin:r.origin,
    ean:r.barcode,
    net:`${Number(r.net_value)} ${r.net_unit}`,
    caseQty:Number(r.units_per_case),
    palletCases:Number(r.cases_per_pallet),
    caseAvailable:r.sale_type==="case"||r.sale_type==="both",
    palletAvailable:r.sale_type==="pallet"||r.sale_type==="both",
    tone:cats[ci]?.[1]||palette[ci%palette.length],
    icon:cats[ci]?.[3]||"🧺",
    hero:isFirst,
    featured:!!r.is_featured,
    heroLayout:ci%2===0?"editorial":"grid4",
    beverage:Number(r.statiegeld||0)>0||/drink|juice|soft/i.test(r.category||""),
    statiegeld:Number(r.statiegeld||0),
    statiegeldScope:r.statiegeld_scope||"none",
    image1:r.image_1||null,
    image2:r.image_2||null,
    image3:r.image_3||null,
    minQty:Number(r.min_order_qty||1),
    specialOfferMode:r.special_offer_mode||null,
    specialOfferQty:r.special_offer_qty==null?null:Number(r.special_offer_qty),
    sourceUrl:r.source_url||null,
    sourceReference:r.source_reference||r.barcode||null,
    campaignBadge:r.campaign_badge||null
   };
 });
 quoteItems=quoteItems.filter(item=>products.some(p=>String(p.id)===String(item.id)));
 persistQuote();
 const statEls=document.querySelectorAll(".stats strong");
 if(statEls[0])statEls[0].textContent=products.length+"+";
 const originSelect=document.getElementById("originFilter");
 if(originSelect){
   const origins=[...new Set(products.map(p=>p.origin).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
   originSelect.innerHTML='<option value="">Tüm menşeiler</option>'+origins.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 }
}
function openModal(id){
 const wrap=document.getElementById(id);
 if(!wrap)return;
 wrap.classList.remove("hidden");
 const modal=wrap.querySelector(".modal");
 if(modal){
   modal.scrollTop=0;
   requestAnimationFrame(()=>{modal.scrollTop=0});
 }
}
function closeModal(id){
 document.getElementById(id).classList.add("hidden");
 if(id==="productModal"){
   clearInterval(alternativeTimer);
   alternativeTimer=null;
   history.replaceState(null,"",location.pathname);
 }
}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));

async function loadProfile(){
 if(!session?.user){profile=null;priceMap={};return}
 const {data,error}=await sb.from("emigro_catalog_profiles").select("*").eq("id",session.user.id).single();
 if(error){console.warn(error);profile=null;return}
 profile=data;
 if(approved()) await loadPrices(); else priceMap={};
}
async function loadPrices(){
 const {data,error}=await sb.from("emigro_catalog_prices").select("sku,case_price,pallet_price,valid_from,valid_to");
 if(error){console.warn(error);priceMap={};return}
 priceMap=Object.fromEntries((data||[]).map(r=>[r.sku,r]));
}
async function syncAuth(){
 const {data}=await sb.auth.getSession();session=data.session;
 await loadProfile();
 renderAuthButton();renderAll();
 const params=new URLSearchParams(location.search);
 if(params.get("auth")==="required"||params.get("auth")==="1"){
   pendingAction=params.get("next")==="print"?"pdf":null;
   if(approved()&&pendingAction==="pdf"){location.href="./print.html?autoprint=1";return}
   openAuth(params.get("next")==="print"?"PDF kataloğu indirmek için onaylı üyelikle giriş yapın.":"Fiyatları görmek için giriş yapın.",pendingAction);
 }
}
function renderAuthButton(){
 const btn=document.getElementById("accountBtn");
 const accountQuick=document.getElementById("customerAccountBtn");
 const nav=document.getElementById("customerDashboardNav");
 const dash=document.getElementById("customerDashboard");
 if(demoMode){
   btn.textContent="Emigro Demo B.V.";
   accountQuick?.classList.remove("hidden");
   nav?.classList.remove("hidden");dash?.classList.add("hidden");
   return;
 }
 if(!session){
   btn.textContent="Giriş / Üyelik";
   accountQuick?.classList.add("hidden");
   nav?.classList.add("hidden");dash?.classList.add("hidden");
   return;
 }
 btn.textContent=profile?.company_name||session.user.email||"Hesabım";
 accountQuick?.classList.remove("hidden");
 nav?.classList.remove("hidden");dash?.classList.add("hidden");
}
function openAuth(reason="Fiyatları görmek ve teklif istemek için onaylı üyelik gerekir.",action=null){
 pendingAction=action;
 const productModal=document.getElementById("productModal");
 if(productModal&&!productModal.classList.contains("hidden"))closeModal("productModal");
 document.getElementById("authReason").textContent=reason;
 document.getElementById("authTitle").textContent=session?"Hesabım":"Giriş yap veya üye ol";
 document.getElementById("loginForm").classList.toggle("hidden",!!session||demoMode);
 document.getElementById("registerForm").classList.add("hidden");
 document.querySelector(".auth-tabs").classList.toggle("hidden",!!session||demoMode);
 document.getElementById("accountPanel").classList.toggle("hidden",!(session||demoMode));
 if(session||demoMode) renderAccountPanel();
 openModal("authModal");
}
window.openAuth=openAuth;
function renderAccountPanel(){
 const status=document.getElementById("accountStatus"),facts=document.getElementById("accountFacts");
 const label=demoMode?"Demo kullanıcı":({pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",suspended:"Askıya alındı"}[profile?.status]||"Profil yükleniyor");
 status.className="account-status "+(profile?.status||"pending");
 status.innerHTML=`<strong>${label}</strong><span>${approved()?"Fiyat, PDF katalog ve teklif özellikleri açık.":"Emigro onayından sonra fiyat, PDF ve teklif özellikleri açılır."}</span>`;
 facts.innerHTML=profile?`<div><span>Firma</span><b>${profile.company_name||"—"}</b></div><div><span>Yetkili</span><b>${profile.contact_name||"—"}</b></div><div><span>KvK</span><b>${profile.kvk_number||"—"}</b></div><div><span>BTW</span><b>${profile.btw_number||"—"}</b></div>`:"";
 const corporateAdminCandidate=!demoMode&&(session?.user?.email||"").toLowerCase().endsWith("@emigro.nl");
 document.getElementById("adminPanelBtn").classList.add("hidden");
}
function switchAuthTab(tab){
 const login=tab==="login";
 document.getElementById("loginForm").classList.toggle("hidden",!login);
 document.getElementById("registerForm").classList.toggle("hidden",login);
 document.getElementById("loginTab").classList.toggle("active",login);
 document.getElementById("registerTab").classList.toggle("active",!login);
}
async function finishPendingAction(){
 if(!approved())return;
 if(pendingAction==="pdf"){pendingAction=null;location.href="./print.html?autoprint=1";return}
 if(pendingAction==="quote"&&selected){pendingAction=null;addQuote(selected.id);return}
 pendingAction=null;
}
async function requestPdf(){
 if(!approved()){openAuth("PDF kataloğunu indirmek için Emigro tarafından onaylanmış üyeliğinizle giriş yapın.","pdf");return}
 location.href=demoMode?"./print.html?demo=1&autoprint=1":"./print.html?autoprint=1";
}
window.requestPdf=requestPdf;

document.getElementById("loginTab").onclick=()=>switchAuthTab("login");
document.getElementById("registerTab").onclick=()=>switchAuthTab("register");
document.getElementById("accountBtn").onclick=()=>openAuth();
document.getElementById("customerAccountBtn").onclick=()=>{
 if(matchMedia("(max-width:700px)").matches){openCustomerDashboardScreen(customerDashboardTab||"quotes","account");return}
 const dash=document.getElementById("customerDashboard");
 dash.classList.remove("hidden");
 loadCustomerDashboard();
 dash.scrollIntoView({behavior:"smooth",block:"start"});
};
document.getElementById("adminPanelBtn").onclick=()=>location.href="./admin.html";
document.getElementById("myQuotesBtn").onclick=()=>openMyQuotes();
document.getElementById("logoutBtn").onclick=async()=>{if(!demoMode)await sb.auth.signOut();demoMode=false;session=null;profile=null;priceMap={};quoteItems=[];persistQuote();closeModal("authModal");renderAuthButton();renderAll()};
document.getElementById("loginForm").onsubmit=async e=>{
 e.preventDefault();const box=document.getElementById("loginMessage");box.textContent="Giriş yapılıyor...";
 const {data,error}=await sb.auth.signInWithPassword({email:document.getElementById("loginEmail").value.trim(),password:document.getElementById("loginPassword").value});
 if(error){box.textContent=error.message;return}
 session=data.session;await loadProfile();
 if(profile?.role==="admin"){
   await sb.auth.signOut();session=null;profile=null;priceMap={};
   box.innerHTML='Bu hesap admin hesabıdır. <a href="./admin.html">Admin giriş ekranına git</a>.';
   renderAuthButton();renderAll();return;
 }
 renderAuthButton();renderAll();
 if(profile?.status==="pending"){box.textContent="Üyeliğiniz Emigro onayını bekliyor.";renderAccountPanel();document.getElementById("loginForm").classList.add("hidden");document.querySelector(".auth-tabs").classList.add("hidden");document.getElementById("accountPanel").classList.remove("hidden");return}
 if(!approved()){box.textContent="Bu üyelik henüz fiyat erişimine açık değil.";return}
 closeModal("authModal");await finishPendingAction();
};
async function verifyKvk(){
 const input=document.getElementById("regKvk"),status=document.getElementById("kvkStatus"),btn=document.getElementById("verifyKvkBtn");
 const kvk=input.value.replace(/\D/g,"");
 kvkVerified=false;verifiedKvkData=null;
 if(!/^\d{8}$/.test(kvk)){status.textContent="KVK numarası 8 rakamdan oluşmalı.";status.className="kvk-status error";return}
 btn.disabled=true;btn.textContent="Doğrulanıyor…";status.textContent="Resmi KVK kaydı kontrol ediliyor…";status.className="kvk-status";
 try{
  const res=await fetch(SUPABASE_URL+"/functions/v1/verify-kvk",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({kvk})});
  const data=await res.json();
  if(!res.ok||!data.ok){
    if(data.reason==="KVK_API_KEY_NOT_CONFIGURED") status.textContent="Canlı KVK doğrulaması için Emigro KVK API anahtarı henüz bağlanmadı.";
    else if(data.reason==="NOT_FOUND") status.textContent="Bu KVK numarası resmi kayıtta bulunamadı.";
    else status.textContent="KVK doğrulanamadı. Numarayı kontrol edin.";
    status.className="kvk-status error";return;
  }
  kvkVerified=true;verifiedKvkData=data;input.value=data.kvkNummer||kvk;
  status.textContent="✓ KVK doğrulandı"+(data.naam?" · "+data.naam:"");
  status.className="kvk-status success";
  if(data.naam&&!document.getElementById("regCompany").value.trim())document.getElementById("regCompany").value=data.naam;
 }catch{
  status.textContent="KVK doğrulama servisine ulaşılamadı.";status.className="kvk-status error";
 }finally{btn.disabled=false;btn.textContent="KVK doğrula"}
}
document.getElementById("verifyKvkBtn").onclick=verifyKvk;
document.getElementById("regKvk").addEventListener("input",()=>{kvkVerified=false;verifiedKvkData=null;document.getElementById("kvkStatus").textContent="KVK numarası değişti; yeniden doğrulayın.";document.getElementById("kvkStatus").className="kvk-status"});
const demoBtn=document.getElementById("demoLoginBtn");
if(new URLSearchParams(location.search).get("demo")==="1")demoBtn.classList.remove("hidden");
demoBtn.onclick=()=>{
 demoMode=true;
 profile={status:"approved",role:"member",company_name:"Emigro Demo B.V.",contact_name:"Demo Gebruiker",email:"demo@emigro.local",phone:"010-0000000",kvk_number:"12345678",btw_number:"NL000000000B01"};
 closeModal("authModal");renderAuthButton();renderAll();
};
document.getElementById("registerForm").onsubmit=async e=>{
 e.preventDefault();const box=document.getElementById("registerMessage");
 const kvkValue=document.getElementById("regKvk").value.trim();
 if(kvkValue && !kvkVerified){box.textContent="KVK numarası girdiyseniz önce doğrulayın veya alanı boş bırakın.";return}
 box.textContent="Başvurunuz oluşturuluyor...";
 const email=document.getElementById("regEmail").value.trim();
 const password=document.getElementById("regPassword").value;
 const metadata={
  company_name:document.getElementById("regCompany").value.trim(),
  company_address:document.getElementById("regAddress").value.trim(),
  postal_code:document.getElementById("regPostal").value.trim(),
  city:document.getElementById("regCity").value.trim(),
  country:document.getElementById("regCountry").value.trim(),
  contact_name:document.getElementById("regContact").value.trim(),
  contact_role:document.getElementById("regRole").value.trim(),
  phone:document.getElementById("regPhone").value.trim(),
  kvk_number:document.getElementById("regKvk").value.trim(),
  btw_number:document.getElementById("regBtw").value.trim(),
  referral_code:REFERRAL_CODE
 };
 const {data,error}=await sb.auth.signUp({email,password,options:{data:metadata}});
 if(error){box.textContent=error.message;return}
 box.innerHTML="<b>Başvurunuz alındı.</b> E-posta doğrulaması gerekiyorsa gelen bağlantıyı açın. Ardından üyeliğiniz Emigro tarafından kontrol edilip onaylanacaktır.";
 if(data.session){session=data.session;await loadProfile();renderAuthButton();renderAll()}
};

function renderHero(){
 const root=document.getElementById("heroCluster");if(!root)return;
 const pool=[products.find(p=>p.campaignBadge==="ACTIE"),products.find(p=>p.campaignBadge==="VOLUME DEAL"),products.find(p=>p.campaignBadge==="NIEUW")].filter(Boolean);
 const list=[...new Map(pool.map(p=>[p.id,p])).values()];
 const lead=list[0]||products.find(p=>p.featured)||products[0];
 const side=list.slice(1,3);
 if(!lead){root.innerHTML="";return}
 const leadPrice=currentPrice(lead);
 root.innerHTML=`<div class="mail-flyer-lead"><button class="mail-flyer-product" onclick="openProduct(${jsId(lead.id)})"><span class="mail-flyer-badge">${esc(lead.campaignBadge||"SELECTIE")}</span><div class="mail-flyer-product-media">${bottle(lead,true)}</div><div class="mail-flyer-product-copy"><small>${esc(lead.brand)}</small><b>${esc(lead.name)}</b><strong>${approved()?displayPrice(leadPrice):"🔒 Login voor prijs"}</strong><em>Bekijk product →</em></div></button></div><div class="mail-flyer-side">${side.map(p=>`<button onclick="openProduct(${jsId(p.id)})"><span>${esc(p.campaignBadge||"DEAL")}</span><div class="mail-flyer-side-media">${bottle(p)}</div><div><small>${esc(p.brand)}</small><b>${esc(p.name)}</b></div></button>`).join("")}</div>`;
}
function renderCategorySquares(){
 const root=document.getElementById("categorySquares");if(!root)return;
 root.innerHTML=cats.map(c=>{const count=products.filter(p=>p.category===c[0]).length;return `<button class="category-square mail-category-card" style="--cat:${c[1]}" onclick="setCategory('${c[0].replace(/'/g,"\\'")}')"><span class="mail-category-icon">${c[3]}</span><div><strong>${c[0]}</strong><small>${count} producten</small></div><span class="mail-category-arrow">→</span></button>`}).join("");
}
function renderCategories(){
 document.getElementById("categories").innerHTML=`<button class="category-btn ${active==="All"?"active":""}" style="${active==="All"?`background:${BRAND.navy}`:""}" onclick="setCategory('All')"><span class="cat-icon">☰</span>Alle (${products.length})</button>`+
 cats.map(c=>{const count=products.filter(p=>p.category===c[0]).length;return `<button class="category-btn ${active===c[0]?"active":""}" ${active===c[0]?`style="background:${c[1]}"`:""} onclick="setCategory('${c[0].replace(/'/g,"\\'")}')"><span class="cat-icon">${c[3]}</span>${c[0]} (${count})</button>`}).join("");
}
function setCategory(c){active=c;campaignBadgeFilter="";shown=24;renderAll();document.getElementById("products").scrollIntoView({behavior:"smooth",block:"start"})}
window.setCategory=setCategory;
function filtered(){
 let list=products.filter(p=>{
   if(active!=="All"&&p.category!==active)return false;
   if(campaignBadgeFilter&&p.campaignBadge!==campaignBadgeFilter)return false;
   if(originFilter&&p.origin!==originFilter)return false;
   if(saleFilter==="case"&&!(p.caseAvailable&&!p.palletAvailable))return false;
   if(saleFilter==="pallet"&&!(p.palletAvailable&&!p.caseAvailable))return false;
   if(saleFilter==="both"&&!(p.caseAvailable&&p.palletAvailable))return false;
   if(depositFilter==="yes"&&!(Number(p.statiegeld||0)>0))return false;
   if(depositFilter==="no"&&Number(p.statiegeld||0)>0)return false;
   return (`${p.brand} ${p.name} ${p.category} ${p.origin} ${p.ean} ${p.sku}`).toLowerCase().includes(query.toLowerCase());
 });
 if(sort==="low"&&approved())list.sort((a,b)=>(priceFor(a,"case")??priceFor(a,"pallet")??99999)-(priceFor(b,"case")??priceFor(b,"pallet")??99999));
 else if(sort==="high"&&approved())list.sort((a,b)=>(priceFor(b,"case")??priceFor(b,"pallet")??0)-(priceFor(a,"case")??priceFor(a,"pallet")??0));
 else list.sort((a,b)=>(a.brand+" "+a.name).localeCompare(b.brand+" "+b.name));
 return list;
}
function campaignGroupInfo(label){
 const map={
  "VOLUME DEAL":{title:"Volume deals",text:"Persoonlijke prijs bij grotere afname.",tone:"#293369",icon:"↗"},
  "NIEUW":{title:"Nieuw",text:"Nieuwe producten in de selectie.",tone:"#ec0419",icon:"+"},
  "ACTIE":{title:"Acties",text:"Scherp geselecteerde campagneproducten.",tone:"#a61b2b",icon:"%"},
  "HORECA":{title:"Horeca",text:"Voor keuken, take-away en service.",tone:"#5663a3",icon:"★"}
 };
 return map[label]||{title:label,text:"Geselecteerde campagneproducten.",tone:"#293369",icon:"•"};
}
function renderCampaignShowcase(){
 const root=document.getElementById("campaignShowcaseGrid");if(!root)return;
 const labels=["ACTIE","VOLUME DEAL","NIEUW","HORECA"];
 const groups=labels.map(label=>({label,items:products.filter(p=>p.campaignBadge===label)})).filter(g=>g.items.length);
 root.innerHTML=groups.map(g=>{
   const info=campaignGroupInfo(g.label);
   return `<button class="campaign-filter-card email-filter-card" style="--campaign-tone:${info.tone}" onclick="showCampaign('${g.label.replace(/'/g,"\\'")}')">
     <span class="campaign-filter-icon">${info.icon}</span>
     <div><b>${g.label}</b><small>${g.items.length} product${g.items.length===1?"":"en"}</small></div>
   </button>`;
 }).join("");
}
function showCampaign(label){
 campaignBadgeFilter=label||"";
 active="All";shown=24;
 renderProducts();renderBanner();renderCategories();
 const box=document.getElementById("campaignActiveFilter");
 if(box)box.innerHTML=campaignBadgeFilter?`<span class="active-campaign-chip">${esc(campaignBadgeFilter)} <button type="button" onclick="showCampaign('')">×</button></span>`:"";
 document.getElementById("products")?.scrollIntoView({behavior:"smooth",block:"start"});
}
window.showCampaign=showCampaign;

function renderBanner(){
 const root=document.getElementById("categoryBanner");if(active==="All"){root.innerHTML="";return}
 const c=cats.find(x=>x[0]===active);
 const count=products.filter(p=>p.category===active).length;root.innerHTML=`<div class="category-banner" style="background:linear-gradient(135deg,${c[1]},${BRAND.navy})"><div><div class="eyebrow" style="color:#fff;opacity:.8">CATEGORIE ${String(cats.indexOf(c)+1).padStart(2,"0")}</div><h2>${c[3]} ${c[0]}</h2><p>${count} producten · selectie uit Emigro.nl</p></div><div class="category-mark">${c[3]}</div></div>`;
}
function heroBlock(index){
 const hp=products.filter(p=>p.hero),p=hp[Math.floor(index/12-1)%hp.length];if(!p)return"";
 if(p.heroLayout==="grid4"){const four=products.filter(x=>x.category===p.category).slice(0,4);return `<section class="inline-hero grid4">${four.map(x=>`<div class="mini-hero" onclick="openProduct(${jsId(x.id)})">${bottle(x)}<h4>${x.name}</h4><small>${x.brand}</small></div>`).join("")}</section>`}
 return `<section class="inline-hero"><div><div class="eyebrow">HERO PRODUCT · ${p.category}</div><h2 style="font:600 42px/.96 var(--serif);margin:8px 0">${p.brand}<br>${p.name}</h2><p>${p.origin} · ${p.net}</p><button class="ghost" onclick="openProduct(${jsId(p.id)})">Ürünü aç</button></div><div style="display:grid;place-items:center">${bottle(p,true)}</div></section>`;
}
function lockedPrice(){
 const text=session?(profile?.status==="pending"?"Lidmaatschap wacht op goedkeuring":"Prijs toegang niet actief"):"Log in om prijzen te bekijken";
 return `<button class="price-locked" onclick="openAuth(\'Log in met uw Emigro-klantaccount om prijzen en persoonlijke offertes te bekijken.\')"><span>🔒</span><b>${text}</b><small>Emigro-account vereist</small></button>`;
}
function card(p,index){
 const mode=modeFor(p),dual=p.caseAvailable&&p.palletAvailable,price=currentPrice(p),rule=specialOfferRule(p);
 return `<article class="card action-card flyer-product-card">
   <button class="flyer-product-image" onclick="openProduct(${jsId(p.id)})">${p.campaignBadge?`<span class="flyer-badge">${esc(p.campaignBadge)}</span>`:""}${bottle(p)}</button>
   <div class="flyer-product-copy">
     <div class="flyer-brand">${esc(p.brand)}</div>
     <h3 onclick="openProduct(${jsId(p.id)})">${esc(p.name)}</h3>
     <div class="flyer-pack">${esc(p.net)} · ${p.caseQty} per doos</div>
     ${approved()?`<div class="flyer-price"><div><span>${mode==="case"?"Prijs per doos":"Prijs per pallet"}</span><small>${mode==="case"?p.caseQty+" stuks":p.palletCases+" dozen"}</small></div><strong>${displayPrice(price)}</strong></div>`:`<button class="flyer-login-price" type="button" onclick="openAuth('Log in om uw zakelijke prijs te bekijken.')"><span>🔒</span><div><b>Zakelijke prijs</b><small>Log in om te bekijken</small></div><strong>→</strong></button>`}
     ${rule?`<div class="flyer-volume-deal"><b>Volume deal</b><span>Vanaf ${rule.qty} ${rule.mode==="case"?"dozen":"pallets"} persoonlijke prijs</span></div>`:""}
     ${dual?`<div class="flyer-pack-switch"><button class="${mode==="case"?"active":""}" onclick="setMode(${jsId(p.id)},'case')">Doos</button><button class="${mode==="pallet"?"active":""}" onclick="setMode(${jsId(p.id)},'pallet')">Pallet</button></div>`:""}
     <div class="flyer-actions"><button class="flyer-view" type="button" onclick="openProduct(${jsId(p.id)})">Details</button><button class="flyer-offer" type="button" onclick="event.stopPropagation();${approved()?`addQuote(${jsId(p.id)})`:`openAuth('Log in om voor dit product een persoonlijke offerte aan te vragen.','quote')`}">+ Offerte</button></div>
   </div>
 </article>`;
}
function renderProducts(){
 const list=filtered();document.getElementById("resultCount").textContent=`${list.length} producten · ${Math.min(shown,list.length)} zichtbaar`;
 const campaignBox=document.getElementById("campaignActiveFilter");
 if(campaignBox)campaignBox.innerHTML=campaignBadgeFilter?`<span class="active-campaign-chip">${esc(campaignBadgeFilter)} <button type="button" onclick="showCampaign('')">×</button></span>`:"";
 document.getElementById("productGrid").innerHTML=list.slice(0,shown).map(card).join("");
 document.getElementById("loadMore").style.display=shown<list.length?"inline-block":"none";
}
function renderFeatured(){
 const root=document.getElementById("featuredGrid");if(!root)return;
 const list=products.filter(p=>p.featured).slice(0,4);
 root.innerHTML=list.map(p=>{
   const price=currentPrice(p);
   return `<article class="featured-card promo-featured-simple">
     <button class="featured-simple-media" onclick="openProduct(${jsId(p.id)})">
       ${p.campaignBadge?`<span class="featured-badge">${esc(p.campaignBadge)}</span>`:""}
       ${bottle(p)}
     </button>
     <div class="featured-simple-copy">
       <span>${esc(p.brand)}</span>
       <h3 onclick="openProduct(${jsId(p.id)})">${esc(p.name)}</h3>
       <strong>${approved()?displayPrice(price):"🔒 Login voor prijs"}</strong>
       <button type="button" onclick="openProduct(${jsId(p.id)})">Bekijk product</button>
     </div>
   </article>`;
 }).join("");
}
function setMode(id,mode){priceMode[id]=mode;renderProducts();if(selected?.id===id){renderDetailCommerce();renderDetailQuoteButton()}renderQuoteCart()}
window.setMode=setMode;

function openProduct(id){
 selected=products.find(p=>String(p.id)===String(id));
 if(!selected){console.warn("Ürün bulunamadı:",id);return}
 selectedImage=0;
 document.getElementById("modalTitle").textContent=selected.brand+" "+selected.name;
 document.getElementById("modalSub").textContent=selected.origin+" · "+selected.category;
 document.getElementById("factsGrid").innerHTML=[["Referentie",selected.sourceReference||selected.sku],["EAN",selected.ean],["Verpakking",selected.net],["Per doos",selected.caseQty],["Dozen / pallet",selected.palletCases],["Categorie",selected.category]].map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join("")+(selected.sourceUrl?`<div class="facts-source"><span>Bron</span><a href="${esc(selected.sourceUrl)}" target="_blank" rel="noopener">Emigro.nl ↗</a></div>`:"");
 document.getElementById("depositDetail").innerHTML=(selected.beverage||selected.statiegeld>0)?`<div class="deposit-detail ${selected.statiegeld>0?"yes":"no"}"><b>${selected.statiegeld>0?"Statiegeld aanwezig":"Geen statiegeld"}</b><span>${selected.statiegeld>0?euro(selected.statiegeld)+" · "+(selected.statiegeldScope==="case"?"yalnız koli":selected.statiegeldScope==="pallet"?"yalnız palet":"koli + palet"):"Dit product heeft geen statiegeld"}</span></div>`:"";
 renderMedia();renderDetailCommerce();renderFav();renderDetailQuoteButton();openModal("productModal");
 try{renderAlternativeProducts()}catch(err){console.warn("Alternatif ürünler yüklenemedi",err)}
 history.replaceState(null,"",`?product=${encodeURIComponent(selected.sku)}`);
}
window.openProduct=openProduct;

let alternativeTimer=null;
function pickAlternativeProducts(){
 if(!selected)return [];
 const sameCategory=products.filter(p=>p.id!==selected.id&&p.category===selected.category);
 const other=products.filter(p=>p.id!==selected.id&&p.category!==selected.category);
 const pool=[...sameCategory.sort(()=>Math.random()-.5),...other.sort(()=>Math.random()-.5)];
 const seen=new Set(),result=[];
 for(const p of pool){
   if(seen.has(p.id))continue;
   seen.add(p.id);result.push(p);
   if(result.length>=8)break;
 }
 return result;
}
function renderAlternativeProducts(){
 const root=document.getElementById("alternativeProducts");
 if(!root||!selected)return;
 const list=pickAlternativeProducts();
 root.innerHTML=list.map(p=>{
   const mode=modeFor(p);
   const price=approved()?euro(priceFor(p,mode)||0):"";
   return `<button type="button" class="alternative-card" onclick="openProduct(${jsId(p.id)})">
      <div class="alternative-image">${bottle(p)}</div>
      <div class="alternative-copy">
        <span>${esc(p.category)}</span>
        <b>${esc(p.brand)} ${esc(p.name)}</b>
        <small>Barkod: ${esc(p.ean)}</small>
        ${approved()?`<strong>${price} <em>/ ${mode==="case"?"koli":"palet"}</em></strong>`:""}
      </div>
    </button>`;
 }).join("");
 clearInterval(alternativeTimer);
 alternativeTimer=setInterval(()=>{
   const modal=document.getElementById("productModal");
   if(modal&&!modal.classList.contains("hidden"))renderAlternativeProducts();
 },12000);
}
window.renderAlternativeProducts=renderAlternativeProducts;
function renderMedia(){
 const media=document.getElementById("mainMedia");
 const options=[{label:"Ürün",idx:0,show:true},{label:"Koli",idx:1,show:selected.caseAvailable},{label:"Palet",idx:2,show:selected.palletAvailable}].filter(x=>x.show);
 if(!options.some(x=>x.idx===selectedImage))selectedImage=options[0]?.idx??0;

 const visual=(idx,thumb=false)=>{
   if(idx===0){
     if(selected.image1)return `<img class="${thumb?"thumb-product-image":"detail-product-image"}" src="${selected.image1}" alt="${selected.brand} ${selected.name}">`;
     return bottle(selected,!thumb);
   }
   const url=idx===1?selected.image2:selected.image3;
   if(url)return `<img class="${thumb?"thumb-product-image":"detail-product-image"}" src="${url}" alt="${idx===1?"Koli":"Palet"}">`;
   return idx===1
    ?`<div class="${thumb?"thumb-pack-visual":"detail-pack-visual"} case-pack"><b>KOLİ</b><small>${selected.caseQty} ADET</small></div>`
    :`<div class="${thumb?"thumb-pack-visual":"detail-pack-visual"} pallet-pack"><b>PALET</b><small>${selected.palletCases} KOLİ</small></div>`;
 };
 media.innerHTML=`<div class="detail-media-frame">${visual(selectedImage,false)}</div>`;
 document.getElementById("thumbs").innerHTML=options.map(o=>`
  <button class="thumb ${selectedImage===o.idx?"active":""}" onclick="selectedImage=${o.idx};renderMedia()">
    <div class="thumb-media-frame">${visual(o.idx,true)}</div>
    <span>${o.label}</span>
  </button>`).join("");
}
window.renderMedia=renderMedia;
function renderDetailCommerce(){
 const dual=selected.caseAvailable&&selected.palletAvailable,mode=modeFor(selected),price=currentPrice(selected);
 document.getElementById("detailPriceArea").innerHTML=`<div class="detail-commerce">${dual?`<div class="price-switch"><button class="${mode==="case"?"active":""}" onclick="setMode(${jsId(selected.id)},\'case\')">Doos</button><button class="${mode==="pallet"?"active":""}" onclick="setMode(${jsId(selected.id)},\'pallet\')">Pallet</button></div>`:`<div class="single-type">ⓘ ${selected.caseAvailable?"Alleen doos":"Alleen pallet"}</div>`}${approved()?`<div class="detail-price"><span>${mode==="case"?"Prijs per doos":"Prijs per pallet"}</span><strong>${displayPrice(price)}</strong><small>${price==null?"Prijs wordt bij de offerte bevestigd":(mode==="case"?selected.caseQty+" stuks / doos":selected.palletCases+" dozen / pallet")}</small></div><div class="detail-validity">Prijsperiode: <b>${VALIDITY.from} — ${VALIDITY.to}</b></div>`:lockedPrice()}${selected.sourceUrl?`<div class="detail-source-link"><a href="${esc(selected.sourceUrl)}" target="_blank" rel="noopener">Bekijk product op Emigro.nl ↗</a></div>`:""}</div>`;
}
function renderDetailQuoteButton(){
 const b=document.getElementById("detailQuoteBtn");
 const controls=document.getElementById("detailQuoteControls");
 if(!approved()){
   controls.innerHTML="";
   b.textContent="🔒 Inloggen voor offerte";b.classList.remove("added");return;
 }
 const mode=modeFor(selected);
 const existing=quoteItems.find(x=>x.id===selected.id&&x.mode===mode);
 const qty=existing?.qty||selected.minQty||1;
 controls.innerHTML=`
   <div class="detail-quote-box">
     <div class="detail-quote-field">
       <span>Talep türü</span>
       <div class="detail-quote-type">
         ${selected.caseAvailable?`<button type="button" class="${mode==="case"?"active":""}" onclick="setMode(${jsId(selected.id)},'case')">Koli</button>`:""}
         ${selected.palletAvailable?`<button type="button" class="${mode==="pallet"?"active":""}" onclick="setMode(${jsId(selected.id)},'pallet')">Palet</button>`:""}
       </div>
     </div>
     <label class="detail-quote-field"><span>Adet</span><input id="detailQuoteQty" type="number" min="${selected.minQty||1}" step="1" value="${qty}" oninput="updateDetailQuoteTotal(this.value)"><small>Minimum: ${selected.minQty||1}</small></label>
     ${specialOfferRule(selected)?`<div class="detail-special-offer ${specialOfferReached(selected,mode,qty)?"reached":""}" id="detailSpecialOffer"><b>${specialOfferReached(selected,mode,qty)?"Özel teklif seviyesine ulaştınız":"Özel teklif fırsatı"}</b><span>${specialOfferText(selected)}</span></div>`:""}
     <div class="detail-quote-summary">
       <span>Birim fiyat</span><small id="detailQuoteUnit">${euro(currentPrice(selected))} / ${mode==="case"?"koli":"palet"}</small>
       <span id="detailQuoteTotalLabel">${qty} ${mode==="case"?"koli":"palet"} toplamı</span>
       <strong id="detailQuoteTotal">${euro(currentPrice(selected)*qty)}</strong>
     </div>
   </div>`;
 b.textContent=existing?"✓ Offertelijst bijwerken":"+ Aan offertelijst toevoegen";
 b.classList.toggle("added",!!existing);
}
function updateDetailQuoteTotal(value){
 if(!selected)return;
 const qty=Math.max(1,parseInt(value||"1",10));
 const mode=modeFor(selected);
 const unit=Number(currentPrice(selected)||0);
 const total=document.getElementById("detailQuoteTotal");
 const label=document.getElementById("detailQuoteTotalLabel");
 if(total)total.textContent=euro(unit*qty);
 if(label)label.textContent=qty+" "+(mode==="case"?"koli":"palet")+" toplamı";
 const note=document.getElementById("detailSpecialOffer");
 if(note){const reached=specialOfferReached(selected,mode,qty);note.classList.toggle("reached",reached);note.innerHTML=`<b>${reached?"Özel teklif seviyesine ulaştınız":"Özel teklif fırsatı"}</b><span>${specialOfferText(selected)}</span>`}
}
window.updateDetailQuoteTotal=updateDetailQuoteTotal;

function renderFav(){const yes=favorites.includes(selected.id);document.getElementById("favoriteBtn").textContent=yes?"✓ Favoride":"♡ Favorilere ekle"}
function toggleFavorite(){favorites=favorites.includes(selected.id)?favorites.filter(x=>x!==selected.id):[...favorites,selected.id];localStorage.setItem("emigro-favorites",JSON.stringify(favorites));renderFav()}
async function shareProduct(){const url=`${location.origin}${location.pathname}?product=${selected.sku}`;try{if(navigator.share)await navigator.share({title:selected.brand+" "+selected.name,url});else await navigator.clipboard.writeText(url);document.getElementById("shareBtn").textContent="✓ Kopyalandı";setTimeout(()=>document.getElementById("shareBtn").textContent="↗ Paylaş",1500)}catch{}}
document.getElementById("favoriteBtn").onclick=toggleFavorite;
document.getElementById("shareBtn").onclick=shareProduct;
document.getElementById("mainMedia").onclick=()=>{selectedImage=(selectedImage+1)%3;renderMedia()};

function addQuote(id,requestedQty=null){
 const p=products.find(x=>x.id===id);
 if(!approved()){pendingAction="quote";openAuth("Teklif isteyebilmek için Emigro tarafından onaylanmış üyeliğinizle giriş yapın.","quote");return}
 const mode=modeFor(p);
 const qty=Math.max(Number(p.minQty||1),parseInt(requestedQty||String(p.minQty||1),10));
 const existing=quoteItems.find(x=>x.id===id&&x.mode===mode);
 if(existing)existing.qty=qty;else quoteItems.push({id,mode,qty});
 persistQuote();renderProducts();renderQuoteCart();if(selected?.id===id)renderDetailQuoteButton();
}
window.addQuote=addQuote;
function persistQuote(){localStorage.setItem("emigro-quote",JSON.stringify(quoteItems))}
function quoteLinePrice(item){const p=products.find(x=>x.id===item.id);return priceFor(p,item.mode)||0}
function quoteTotal(){return quoteItems.reduce((sum,i)=>sum+quoteLinePrice(i)*i.qty,0)}
function renderQuoteCart(){
 const bar=document.getElementById("quoteCart");
 if(!approved()||!quoteItems.length){bar.classList.add("hidden");return}
 bar.classList.remove("hidden");document.getElementById("quoteCount").textContent=quoteItems.length+" producten";document.getElementById("quoteTotal").textContent=euro(quoteTotal());
}
function populateMemberQuote(){
 document.getElementById("memberName").value=profile.contact_name||"";
 document.getElementById("memberCompany").value=profile.company_name||"";
 document.getElementById("memberEmail").value=profile.email||session.user.email||"";
 document.getElementById("memberPhone").value=profile.phone||"";
 document.getElementById("memberNumber").value=profile.id||"";
}
function customerQuoteStatus(s){return {new:"Talep alındı",reviewing:"İnceleniyor",offered:"Teklif hazır",accepted:"Kabul edildi",declined:"Reddedildi",closed:"Kapalı"}[s]||s}
function calcCustomerQuote(q){
 const base=Number(q.estimated_total||0);
 const pct=base*(Number(q.discount_percent||0)/100);
 const discount=Math.min(base,pct+Number(q.discount_amount||0));
 const shipping=Number(q.shipping_fee||0);
 return {base,discount,shipping,total:Math.max(0,base-discount+shipping)};
}
async function openMyQuotes(){
 if(!session){openAuth("Tekliflerinizi görmek için müşteri hesabınızla giriş yapın.");return}
 openModal("myQuotesModal");
 const root=document.getElementById("myQuotesList");
 root.innerHTML='<div class="admin-loading">Teklifler yükleniyor…</div>';
 const {data,error}=await sb.from("emigro_catalog_quotes").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false});
 if(error){root.innerHTML='<div class="admin-loading">Teklifler yüklenemedi: '+error.message+'</div>';return}
 const list=data||[];
 if(!list.length){root.innerHTML='<div class="my-quotes-empty"><b>Henüz teklif talebiniz yok.</b><span>Ürünlerden teklif istediğinizde talepleriniz burada görünür.</span></div>';return}
 root.innerHTML=list.map(q=>{
   const t=calcCustomerQuote(q);
   const ready=["offered","accepted","declined"].includes(q.status);
   const items=(q.items||[]).map(i=>`<div class="my-quote-item"><div><b>${i.name}</b><small>${i.sku} · ${i.mode==="case"?"Koli":"Palet"} · ${i.qty} adet</small></div><strong>${euro(Number(i.unit_price||0)*Number(i.qty||0))}</strong></div>`).join("");
   return `<article class="my-quote-card ${ready?"ready":""}">
     <div class="my-quote-head"><div><span class="my-quote-status ${q.status}">${customerQuoteStatus(q.status)}</span><h3>${q.offer_number?"Teklif "+q.offer_number:"Teklif talebi"}</h3><small>${new Date(q.created_at).toLocaleString("nl-NL")}</small></div><strong>${ready?euro(t.total):euro(t.base)}</strong></div>
     <div class="my-quote-items">${items}</div>
     ${ready?`<div class="my-quote-summary">
       <div><span>Subtotaal</span><b>${euro(t.base)}</b></div>
       <div><span>Korting${Number(q.discount_percent||0)?' ('+Number(q.discount_percent)+'%)':''}</span><b>− ${euro(t.discount)}</b></div>
       <div><span>Verzendkosten</span><b>${euro(t.shipping)}</b></div>
       <div class="grand"><span>Totaal</span><b>${euro(t.total)}</b></div>
     </div>`:`<div class="my-quote-wait">Emigro teklifinizi hazırlıyor. Hazır olduğunda burada toplam, korting, kargo ve geçerlilik tarihi görünecek.</div>`}
     ${q.admin_note?`<div class="my-quote-note"><b>Emigro notu</b><span>${q.admin_note}</span></div>`:""}
     ${q.offer_valid_to?`<div class="my-quote-valid"><span>Teklif geçerlilik tarihi</span><strong>${new Date(q.offer_valid_to).toLocaleDateString("nl-NL")}</strong></div>`:""}
     ${q.status==="offered"?`<div class="customer-offer-actions"><button class="btn" onclick="decideCustomerQuote('${q.id}','accepted')">Teklifi kabul et</button><button class="ghost reject-offer" onclick="decideCustomerQuote('${q.id}','declined')">Teklifi reddet</button></div>`:""}
     ${q.status==="accepted"?'<div class="customer-decision accepted">✓ Bu teklifi kabul ettiniz.</div>':""}
     ${q.status==="declined"?'<div class="customer-decision declined">Bu teklifi reddettiniz.</div>':""}
   </article>`;
 }).join("");
}
window.openMyQuotes=openMyQuotes;

let customerDashboardTab="quotes";
async function loadCustomerDashboard(){
 if(!session||!document.getElementById("customerDashboard"))return;
 try{await sb.rpc("emigro_catalog_sync_my_completed_orders")}catch{}
 const root=document.getElementById("customerDashboardList");
 root.innerHTML='<div class="admin-loading">Hesap verileri yükleniyor…</div>';

 const [qRes,oRes,aRes,nRes]=await Promise.all([
  sb.from("emigro_catalog_quotes").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false}),
  sb.from("emigro_catalog_orders").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false}),
  sb.from("emigro_catalog_addresses").select("*").eq("user_id",session.user.id).order("is_default",{ascending:false}).order("created_at",{ascending:false}),
  sb.from("emigro_catalog_notifications").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false}).limit(50)
 ]);
 if(qRes.error||oRes.error||aRes.error||nRes.error){root.innerHTML='<div class="admin-loading">Veriler yüklenemedi.</div>';return}

 const quotes=qRes.data||[];
 customerQuotes=quotes;
 customerOrders=oRes.data||[];
 customerAddresses=aRes.data||[];
 customerNotifications=nRes.data||[];

 const counts={
  all:quotes.length,
  pending:quotes.filter(q=>["new","reviewing"].includes(q.status)).length,
  offered:quotes.filter(q=>q.status==="offered").length,
  accepted:quotes.filter(q=>q.status==="accepted").length,
  rejected:quotes.filter(q=>q.status==="declined").length,
  unread:customerNotifications.filter(n=>!n.is_read).length
 };
 document.getElementById("customerDashboardStats").innerHTML=[
  ["Toplam teklif",counts.all],["İncelenen",counts.pending],["Cevaplanan",counts.offered],["Sipariş",customerOrders.length],["Bildirim",counts.unread]
 ].map(([l,n])=>`<div><span>${l}</span><strong>${n}</strong></div>`).join("");

 if(customerDashboardTab==="favorites"){
   const favs=products.filter(p=>favorites.includes(p.id));
   root.innerHTML=favs.length?'<div class="customer-favorites-grid">'+favs.map(p=>`
    <article class="customer-favorite-card">
      <button class="customer-favorite-media" onclick="openProduct(${jsId(p.id)})">${bottle(p)}</button>
      <div><span>${esc(p.category)}</span><b>${esc(p.brand)} ${esc(p.name)}</b><small>Barkod: ${esc(p.ean)}</small></div>
      <button class="btn" onclick="openProduct(${jsId(p.id)})">Ürünü aç</button>
    </article>`).join("")+'</div>':'<div class="my-quotes-empty"><b>Favoriniz yok.</b><span>Ürün detayından favorilere ekleyebilirsiniz.</span></div>';
   return;
 }

 if(customerDashboardTab==="addresses"){
   root.innerHTML=`
    <div class="address-manager">
      <div class="address-list">${customerAddresses.length?customerAddresses.map(a=>`
       <article class="address-card"><div><span>${a.is_default?"Varsayılan adres":"Teslimat adresi"}</span><h3>${esc(a.label)}</h3><p>${esc(a.address)}<br>${esc(a.postal_code)} ${esc(a.city)} · ${esc(a.country)}</p></div><button class="ghost" onclick="deleteAddress('${a.id}')">Sil</button></article>`).join(""):'<div class="my-quotes-empty"><b>Kayıtlı adres yok.</b></div>'}</div>
      <form class="address-form" id="addressForm">
       <h3>Yeni teslimat adresi</h3>
       <input id="addrLabel" placeholder="Adres adı: Depo / Şube / Merkez" required>
       <input id="addrAddress" placeholder="Adres" required>
       <div class="two-col"><input id="addrPostal" placeholder="Posta kodu" required><input id="addrCity" placeholder="Şehir" required></div>
       <input id="addrCountry" value="Nederland" required>
       <label class="validity-check"><input type="checkbox" id="addrDefault"><span>Varsayılan teslimat adresi</span></label>
       <button class="btn" type="submit">Adresi kaydet</button>
      </form>
    </div>`;
   document.getElementById("addressForm").onsubmit=addAddress;
   return;
 }

 if(customerDashboardTab==="notifications"){
   root.innerHTML=customerNotifications.length?customerNotifications.map(n=>`
    <article class="notification-card ${n.is_read?"read":"unread"}">
      <div><span>${new Date(n.created_at).toLocaleString("nl-NL")}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div>
      ${n.is_read?"":`<button class="ghost" onclick="markNotificationRead('${n.id}')">Okundu</button>`}
    </article>`).join(""):'<div class="my-quotes-empty"><b>Yeni bildiriminiz yok.</b></div>';
   return;
 }

 if(customerDashboardTab==="invite"){
   const {data:stats,error:statsError}=await sb.rpc("emigro_catalog_referral_stats");
   const stat=Array.isArray(stats)?stats[0]:stats;
   const code=stat?.referral_code||profile?.referral_code||"";
   const link=code?new URL("./?ref="+encodeURIComponent(code),location.href).href:"";
   root.innerHTML=`
    <section class="customer-invite-panel">
      <div class="customer-invite-copy">
        <div class="eyebrow">DAVET ET & AVANTAJ KAZAN</div>
        <h3>Zakelijke müşterilerinizi Emigro B2B'ye davet edin</h3>
        <p>Sizden gelen müşterilerimizin ilk alışverişlerinde hem size hem de davet ettiğiniz kişilere ekstra indirim avantajları sunulacaktır.</p>
        <p>Davet bağlantınızla kayıt olan kişinin sizin tarafınızdan geldiği sistemde otomatik olarak kaydedilir.</p>
      </div>
      <div class="invite-stat-grid">
        <div><span>Davet kodunuz</span><strong>${esc(code||"—")}</strong></div>
        <div><span>Kayıt olan</span><strong>${statsError?"—":Number(stat?.invited_count||0)}</strong></div>
        <div><span>Onaylanan</span><strong>${statsError?"—":Number(stat?.approved_count||0)}</strong></div>
      </div>
      <div class="invite-link-box"><span>Davet bağlantısı</span><strong id="customerInviteLink">${esc(link)}</strong></div>
      <div class="invite-actions">
        <button class="btn" onclick="shareCustomerInvite()">Telefondan paylaş</button>
        <button class="ghost" onclick="emailCustomerInvite()">E-posta ile gönder</button>
        <button class="ghost" onclick="copyCustomerInvite()">Bağlantıyı kopyala</button>
      </div>
    </section>`;
   return;
 }

 if(customerDashboardTab==="orders"){
   const activeOrders=customerOrders.filter(o=>!["completed","cancelled"].includes(o.status));
   const finishedOrders=customerOrders.filter(o=>["completed","cancelled"].includes(o.status));
   const renderOrder=o=>{
     const items=(o.items||[]).map(i=>`<div class="customer-dash-item"><div><b>${esc(i.name)}</b><small>${esc(i.sku)} · ${i.mode==="case"?"Koli":"Palet"} · ${i.qty} adet</small></div><strong>${euro(Number(i.unit_price||0)*Number(i.qty||0))}</strong></div>`).join("");
     const addressOptions=customerAddresses.map(a=>`<option value="${a.id}" ${o.delivery_address_id===a.id?"selected":""}>${esc(a.label)} · ${esc(a.city)}</option>`).join("");
     const canConfirm=["ready","shipped"].includes(o.status);
     const shippedText=o.shipped_at?new Date(o.shipped_at).toLocaleString("nl-NL"):"—";
     const completedText=o.completed_at?new Date(o.completed_at).toLocaleString("nl-NL"):"—";
     return `<article class="customer-dash-card order-card ${o.status}">
       <div class="customer-dash-card-head"><div><span class="my-quote-status ${o.status}">${customerOrderStatus(o.status)}</span><h3>${esc(o.order_number||"Sipariş")}</h3><small>${new Date(o.created_at).toLocaleString("nl-NL")}</small></div><strong>${euro(o.total)}</strong></div>
       <div class="customer-dash-items">${items}</div>
       <div class="order-customer-meta">
         <span>İstenen teslim: <b>${o.requested_delivery_date?new Date(o.requested_delivery_date+"T12:00:00").toLocaleDateString("nl-NL"):"—"}</b></span>
         <span>Onaylanan teslim: <b>${o.confirmed_delivery_date?new Date(o.confirmed_delivery_date+"T12:00:00").toLocaleDateString("nl-NL"):"—"}</b></span>
         <span>Kargoya verildi: <b>${shippedText}</b></span>
         ${o.status==="completed"?`<span>Tamamlandı: <b>${completedText}</b></span>`:""}
       </div>
       ${o.status==="preparing"?'<div class="customer-shipping-state preparing"><b>Siparişiniz hazırlanıyor</b></div>':""}
       ${o.status==="shipped"&&o.delivery_method==="emigro_vehicle"?'<div class="customer-shipping-state emigro"><b>Emigro Cash & Carry aracı siparişinizi getiriyor</b><span>Teslimat Emigro ekibi tarafından yapılacaktır.</span></div>':""}
       ${o.status==="shipped"&&o.delivery_method==="carrier"?`<div class="customer-shipping-state carrier"><b>Siparişiniz kargoya verildi</b>${o.tracking_number?`<span>Takip no: ${esc(o.tracking_number)}</span>`:""}${/^https?:\/\//i.test(o.tracking_url||"")?`<a class="btn" href="${esc(o.tracking_url)}" target="_blank" rel="noopener">Kargoyu takip et</a>`:""}</div>`:""}
       ${["new","preparing"].includes(o.status)?`<div class="order-delivery-edit"><select id="order-address-${o.id}"><option value="">Teslimat adresi seçin</option>${addressOptions}</select><input id="order-request-date-${o.id}" type="date" value="${o.requested_delivery_date||""}"><button class="ghost" onclick="saveCustomerOrderDelivery('${o.id}')">Teslimat bilgisini kaydet</button></div>`:""}
       <div class="customer-offer-actions">
         ${canConfirm?`<button class="btn delivery-confirm-btn" onclick="confirmOrderDelivered('${o.id}')">Teslim aldım</button>`:""}
         <button class="ghost" onclick="repeatOrder('${o.id}')">Aynı ürünler için yeniden teklif iste</button>
       </div>
      </article>`;
   };
   root.innerHTML=customerOrders.length?`
     <div class="customer-order-section">
       <div class="customer-order-section-head"><div><span>AKTİF SİPARİŞLER</span><strong>${activeOrders.length}</strong></div><small>Hazırlık, sevkiyat ve teslimat sürecindeki siparişleriniz.</small></div>
       <div class="customer-order-list">${activeOrders.length?activeOrders.map(renderOrder).join(""):'<div class="my-quotes-empty"><b>Aktif siparişiniz yok.</b><span>Yeni bir teklifi kabul ettiğinizde siparişiniz burada görünür.</span></div>'}</div>
     </div>
     <div class="customer-order-section finished">
       <div class="customer-order-section-head"><div><span>BİTEN SİPARİŞLER</span><strong>${finishedOrders.length}</strong></div><small>Teslim alınan, teslim tarihi geçen veya iptal edilen siparişler.</small></div>
       <div class="customer-order-list">${finishedOrders.length?finishedOrders.map(renderOrder).join(""):'<div class="my-quotes-empty"><b>Henüz biten sipariş yok.</b></div>'}</div>
     </div>`:'<div class="my-quotes-empty"><b>Henüz siparişiniz yok.</b><span>Kabul ettiğiniz teklifler otomatik olarak Siparişlerim bölümüne düşer.</span></div>';
   return;
 }

 let filtered=quotes;
 if(customerDashboardTab==="accepted")filtered=quotes.filter(q=>q.status==="accepted");
 if(customerDashboardTab==="rejected")filtered=quotes.filter(q=>q.status==="declined");

 if(!filtered.length){
   root.innerHTML='<div class="my-quotes-empty"><b>Bu bölümde henüz kayıt yok.</b><span>Yeni hareketler burada otomatik görünecek.</span></div>';
   return;
 }
 root.innerHTML=filtered.map(q=>{
   const t=calcCustomerQuote(q);
   const ready=["offered","accepted","declined"].includes(q.status);
   const items=(q.items||[]).map(i=>`<div class="customer-dash-item"><div><b>${esc(i.name)}</b><small>${esc(i.sku)} · ${i.mode==="case"?"Koli":"Palet"} · ${i.qty} adet</small></div><strong>${euro(Number(i.unit_price||0)*Number(i.qty||0))}</strong></div>`).join("");
   const expiryDate=q.offer_valid_to?new Date(q.offer_valid_to+"T23:59:59"):null;
   const expired=q.status==="offered"&&expiryDate&&expiryDate<new Date();
   const expirySoon=q.status==="offered"&&!expired&&expiryDate&&((expiryDate-new Date())/(1000*60*60*24)<=2);
   return `<article class="customer-dash-card ${q.status}">
    <div class="customer-dash-card-head"><div><span class="my-quote-status ${q.status}">${customerQuoteStatus(q.status)}</span><h3>${q.offer_number?"Teklif "+esc(q.offer_number):"Teklif talebi"}</h3><small>${new Date(q.created_at).toLocaleString("nl-NL")}</small></div><strong>${ready?euro(t.total):euro(t.base)}</strong></div>
    <div class="customer-dash-items">${items}</div>
    ${ready?`<div class="customer-dash-summary"><div><span>Subtotaal</span><b>${euro(t.base)}</b></div><div><span>Korting</span><b>− ${euro(t.discount)}</b></div><div><span>Verzendkosten</span><b>${euro(t.shipping)}</b></div><div class="grand"><span>Totaal</span><b>${euro(t.total)}</b></div></div>`:""}
    ${q.admin_note?`<div class="my-quote-note"><b>Emigro notu</b><span>${esc(q.admin_note)}</span></div>`:""}
    ${q.offer_valid_to?`<div class="my-quote-valid ${expired?"expired-offer":expirySoon?"expiry-soon":""}"><span>Teklif geçerlilik tarihi</span><strong>${new Date(q.offer_valid_to).toLocaleDateString("nl-NL")}</strong>${expired?"<small>Süresi doldu</small>":""}</div>`:""}
    ${q.status==="offered"&&!expired?`<div class="customer-offer-actions"><button class="btn" onclick="decideCustomerQuote('${q.id}','accepted')">Teklifi kabul et</button><button class="ghost reject-offer" onclick="decideCustomerQuote('${q.id}','declined')">Teklifi reddet</button></div>`:""}
    ${expired?'<div class="customer-decision declined">Bu teklifin süresi doldu. Yeni teklif talebi oluşturabilirsiniz.</div>':""}
    ${q.status==="accepted"?'<div class="customer-decision accepted">✓ Kabul edildi · Siparişlerim bölümünde görünüyor.</div>':""}
    ${q.status==="declined"?'<div class="customer-decision declined">Reddedildi</div>':""}
   </article>`;
 }).join("");
}

const customerOrderStatus=s=>({new:"Yeni",preparing:"Hazırlanıyor",ready:"Hazır",shipped:"Sevk edildi",completed:"Tamamlandı",cancelled:"İptal"}[s]||s);

async function addAddress(e){
 e.preventDefault();
 const isDefault=document.getElementById("addrDefault").checked;
 if(isDefault&&customerAddresses.length){
   for(const a of customerAddresses.filter(x=>x.is_default))await sb.from("emigro_catalog_addresses").update({is_default:false}).eq("id",a.id);
 }
 const {error}=await sb.from("emigro_catalog_addresses").insert({
  user_id:session.user.id,label:document.getElementById("addrLabel").value.trim(),address:document.getElementById("addrAddress").value.trim(),
  postal_code:document.getElementById("addrPostal").value.trim(),city:document.getElementById("addrCity").value.trim(),country:document.getElementById("addrCountry").value.trim(),is_default:isDefault
 });
 if(error){notify("Adres kaydedilemedi: "+error.message);return}
 await loadCustomerDashboard();
}
async function deleteAddress(id){
 if(!confirm("Bu adres silinsin mi?"))return;
 const {error}=await sb.from("emigro_catalog_addresses").delete().eq("id",id);
 if(error){notify("Adres silinemedi: "+error.message);return}
 await loadCustomerDashboard();
}
window.deleteAddress=deleteAddress;

async function markNotificationRead(id){
 await sb.from("emigro_catalog_notifications").update({is_read:true}).eq("id",id);
 await loadCustomerDashboard();
}
window.markNotificationRead=markNotificationRead;

async function saveCustomerOrderDelivery(id){
 const addressId=document.getElementById("order-address-"+id).value||null;
 const date=document.getElementById("order-request-date-"+id).value||null;
 const {error}=await sb.rpc("emigro_catalog_customer_update_order_delivery",{p_order_id:id,p_address_id:addressId,p_requested_date:date,p_customer_note:""});
 if(error){notify("Teslimat bilgisi kaydedilemedi: "+error.message);return}
 await loadCustomerDashboard();
}
window.saveCustomerOrderDelivery=saveCustomerOrderDelivery;

async function confirmOrderDelivered(id){
 if(!confirm("Bu siparişi teslim aldığınızı onaylıyor musunuz?"))return;
 const {error}=await sb.rpc("emigro_catalog_customer_confirm_delivery",{p_order_id:id});
 if(error){notify("Teslimat onaylanamadı: "+error.message,"error");return}
 notify("Sipariş teslim alındı olarak tamamlandı.","success");
 await loadCustomerDashboard();
}
window.confirmOrderDelivered=confirmOrderDelivered;

function repeatOrder(id){
 const order=customerOrders.find(o=>o.id===id);if(!order)return;
 const next=[];
 for(const item of order.items||[]){
   const p=products.find(x=>String(x.id)===String(item.product_id))||products.find(x=>x.sku===item.sku);
   if(!p)continue;
   const mode=item.mode==="pallet"&&p.palletAvailable?"pallet":p.caseAvailable?"case":"pallet";
   next.push({id:p.id,mode,qty:Math.max(Number(p.minQty||1),Number(item.qty||1))});
 }
 if(!next.length){notify("Bu siparişteki ürünler artık katalogda bulunmuyor.");return}
 quoteItems=next;persistQuote();renderQuoteCart();renderProducts();openQuote();
}
window.repeatOrder=repeatOrder;

document.getElementById("customerDashboardNav").onclick=()=>{
 const dash=document.getElementById("customerDashboard");
 dash.classList.remove("hidden");
 loadCustomerDashboard();
 dash.scrollIntoView({behavior:"smooth",block:"start"});
};
document.getElementById("refreshCustomerDashboard").onclick=loadCustomerDashboard;
document.getElementById("closeCustomerDashboard").onclick=()=>{
 const dash=document.getElementById("customerDashboard");
 dash.classList.add("hidden");
 window.scrollTo({top:0,behavior:"smooth"});
};
document.querySelectorAll("[data-customer-tab]").forEach(b=>b.onclick=()=>{
 customerDashboardTab=b.dataset.customerTab;
 document.querySelectorAll("[data-customer-tab]").forEach(x=>x.classList.toggle("active",x===b));
 loadCustomerDashboard();
});

async function decideCustomerQuote(id,decision){
 const q=customerQuotes.find(x=>x.id===id);
 if(decision==="accepted"&&q?.offer_valid_to&&new Date(q.offer_valid_to+"T23:59:59")<new Date()){
   notify("Bu teklifin geçerlilik süresi dolmuş. Yeni teklif talebi oluşturun.","error");
   return;
 }
 const label=decision==="accepted"?"kabul etmek":"reddetmek";
 if(!confirm("Bu teklifi "+label+" istediğinize emin misiniz?"))return;
 const {error}=await sb.rpc("emigro_catalog_customer_decide_quote",{p_quote_id:id,p_decision:decision});
 if(error){notify("İşlem tamamlanamadı: "+error.message);return}
 await openMyQuotes();
 if(decision==="accepted"){
   customerDashboardTab="quotes";
   document.querySelectorAll("[data-customer-tab]").forEach(x=>x.classList.toggle("active",x.dataset.customerTab==="quotes"));
   document.getElementById("customerDashboard")?.classList.remove("hidden");
   if(matchMedia("(max-width:700px)").matches)setMobileScreen("dashboard");
   setMobileNavActive("quotes");
   notify("Offerte geaccepteerd.","success");
 }
 await loadCustomerDashboard();
}
window.decideCustomerQuote=decideCustomerQuote;
function openQuote(){
 if(!approved()){openAuth("Teklif talebi yalnızca Emigro tarafından onaylanmış B2B üyeler içindir.","quote");return}
 renderQuoteLines();populateMemberQuote();openModal("quoteModal");
}
function renderQuoteLines(){
 document.getElementById("quoteLines").innerHTML=quoteItems.map((item,idx)=>{
   const p=products.find(x=>x.id===item.id),price=quoteLinePrice(item);
   const special=specialOfferRule(p);
   const reached=specialOfferReached(p,item.mode,item.qty);
   return `<div class="quote-line"><div class="quote-thumb">${bottle(p)}</div><div><b>${p.brand} ${p.name}</b><span>${item.mode==="case"?"Koli":"Palet"} · ${euro(price)}</span>${p.beverage?`<small>${depositText(p)}</small>`:""}${special?`<small class="quote-special-note ${reached?"reached":""}">${reached?"Özel teklif uygulanacak · ":""}${specialOfferText(p)}</small>`:""}</div><label>Adet<input type="number" min="${p.minQty||1}" value="${item.qty}" onchange="updateQuoteQty(${idx},this.value)"></label><strong>${euro(price*item.qty)}</strong><button onclick="removeQuote(${idx})">×</button></div>`;
 }).join("");
 document.getElementById("formQuoteTotal").textContent=euro(quoteTotal());
 document.getElementById("quoteSummaryField").value=quoteItems.map(item=>{const p=products.find(x=>x.id===item.id);return `${p.sku} | ${p.brand} ${p.name} | ${item.mode==="case"?"Koli":"Palet"} | Adet: ${item.qty} | ${euro(quoteLinePrice(item))}${specialOfferReached(p,item.mode,item.qty)?" | ÖZEL TEKLİF":""}${p.beverage?" | "+depositText(p):""}`}).join("\n");
}
function updateQuoteQty(idx,val){const p=products.find(x=>x.id===quoteItems[idx].id);quoteItems[idx].qty=Math.max(Number(p?.minQty||1),parseInt(val||String(p?.minQty||1),10));persistQuote();renderQuoteLines();renderQuoteCart()}
function removeQuote(idx){quoteItems.splice(idx,1);persistQuote();renderQuoteLines();renderQuoteCart();renderProducts();if(!quoteItems.length)closeModal("quoteModal")}
window.updateQuoteQty=updateQuoteQty;window.removeQuote=removeQuote;
document.getElementById("detailQuoteBtn").onclick=()=>{
 if(!selected)return;
 if(!approved()){addQuote(selected.id);return}
 const qty=document.getElementById("detailQuoteQty")?.value||1;
 addQuote(selected.id,qty);
};
document.getElementById("openQuote").onclick=openQuote;
document.getElementById("quoteForm").onsubmit=async e=>{
 e.preventDefault();
 if(!approved()){closeModal("quoteModal");openAuth("Teklif göndermek için onaylı üyelik gerekir.","quote");return}
 if(!document.getElementById("validityConfirm").checked)return;
 const btn=document.getElementById("quoteSubmitBtn");btn.disabled=true;btn.textContent="Gönderiliyor...";
 const note=document.getElementById("quoteNote").value||"";
 let payload,submitRpc;
 if(liveCatalogLoaded){
   payload=quoteItems.map(item=>({product_id:item.id,mode:item.mode,qty:Number(item.qty)}));
   submitRpc="emigro_catalog_submit_quote";
 }else{
   payload=quoteItems.map(item=>{
     const p=products.find(x=>String(x.id)===String(item.id));
     return {
       demo_id:Number(item.id),
       sku:p?.sku||"",
       name:[p?.brand,p?.name].filter(Boolean).join(" "),
       mode:item.mode,
       qty:Number(item.qty),
       unit_price:Number(quoteLinePrice(item)||0),
       special_offer_required:specialOfferReached(p,item.mode,item.qty),
       special_offer_threshold_mode:p?.specialOfferMode||null,
       special_offer_threshold_qty:p?.specialOfferQty||null
     };
   });
   submitRpc="emigro_catalog_submit_demo_quote";
 }
 const {data,error}=await sb.rpc(submitRpc,{p_items:payload,p_note:note});
 if(error){
   btn.disabled=false;btn.textContent="Teklif talebini gönder";
   const msg=String(error.message||"");
   if(msg.includes("exceeds allowed limit"))notify("Bu ürün için talep edilen miktar izin verilen sınırın üzerinde. Adedi düşürüp tekrar deneyin.");
   else if(msg.includes("minimum quantity"))notify("Bir veya daha fazla üründe minimum sipariş adedinin altında miktar girdiniz.");
   else if(msg.includes("invalid input syntax for type uuid"))notify("Teklif listenizde eski bir test ürünü kaldı. Liste temizlendi; ürünü yeniden ekleyip tekrar deneyin.","error");
   else notify("Teklif kaydedilemedi: "+msg,"error");
   return
 }
 quoteItems=[];persistQuote();renderQuoteCart();renderProducts();
 document.getElementById("quoteNote").value="";
 document.getElementById("validityConfirm").checked=false;
 btn.disabled=false;btn.textContent="Teklif talebini gönder";
 closeModal("quoteModal");
 notify("Teklif talebiniz başarıyla Emigro'ya gönderildi. Talep no: "+String(data).slice(0,8).toUpperCase()+". Emigro teklifinizi admin panelinden hazırlayacak.");
};

async function scanBarcode(){
 const search=document.getElementById("search");
 if(!("BarcodeDetector" in window)||!navigator.mediaDevices?.getUserMedia){
   const code=prompt("Barkodu yazın veya yapıştırın:");
   if(code!=null){query=code.trim();search.value=query;shown=24;renderProducts()}
   return;
 }
 let stream=null,wrap=null;
 try{
   const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128"]});
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
   wrap=document.createElement("div");wrap.className="barcode-scanner-overlay";
   wrap.innerHTML='<div class="barcode-scanner-card"><video playsinline autoplay></video><div class="barcode-frame"></div><button class="ghost" type="button">Kapat</button><small>Barkodu çerçevenin içine getirin</small></div>';
   document.body.appendChild(wrap);
   const video=wrap.querySelector("video");video.srcObject=stream;await video.play();
   let stopped=false;
   const close=()=>{stopped=true;stream?.getTracks().forEach(t=>t.stop());wrap?.remove()};
   wrap.querySelector("button").onclick=close;
   while(!stopped){
     const codes=await detector.detect(video);
     if(codes?.length){
       query=codes[0].rawValue||"";search.value=query;shown=24;renderProducts();close();break;
     }
     await new Promise(r=>setTimeout(r,250));
   }
 }catch(err){
   stream?.getTracks().forEach(t=>t.stop());wrap?.remove();
   const code=prompt("Kamera ile barkod okunamadı. Barkodu yazın:");
   if(code!=null){query=code.trim();search.value=query;shown=24;renderProducts()}
 }
}
document.getElementById("priceInfoBtn").onclick=()=>openModal("priceInfo");
document.getElementById("search").oninput=e=>{query=e.target.value;shown=24;renderProducts()};
document.getElementById("sort").onchange=e=>{sort=e.target.value;if((sort==="low"||sort==="high")&&!approved()){sort="name";e.target.value="name";openAuth("Fiyata göre sıralama yalnızca onaylı üyeler için kullanılabilir.")}renderProducts()};
document.getElementById("originFilter").onchange=e=>{originFilter=e.target.value;shown=24;renderProducts()};
document.getElementById("saleFilter").onchange=e=>{saleFilter=e.target.value;shown=24;renderProducts()};
document.getElementById("depositFilter").onchange=e=>{depositFilter=e.target.value;shown=24;renderProducts()};
document.getElementById("scanBarcodeBtn").onclick=scanBarcode;
document.getElementById("loadMore").onclick=()=>{shown+=24;renderProducts()};

function syncOfficialLoginLink(){
 const a=document.getElementById("officialEmigroLogin");
 if(!a)return;
 const back=location.href;
 a.href="https://www.emigro.nl/aanmelden?back="+encodeURIComponent(back);
}
function updateEmailStickyCta(){
 const el=document.getElementById("emailStickyCta");if(!el)return;
 const fromEmail=CAMPAIGN_SOURCE==="email";
 el.classList.toggle("hidden",!fromEmail||approved());
}
function renderCampaignMeta(){
 const title=document.getElementById("campaignTitle");if(title)title.textContent=CAMPAIGN_TITLE;
 const note=document.getElementById("campaignMailNote");if(note)note.classList.toggle("hidden",CAMPAIGN_SOURCE!=="email");
}
function renderAll(){syncOfficialLoginLink();renderCampaignMeta();updateEmailStickyCta();renderBanner();renderCategories();renderProducts();renderQuoteCart()}
function setMobileNavActive(name){
 document.querySelectorAll("[data-mobile-nav]").forEach(b=>b.classList.toggle("active",b.dataset.mobileNav===name));
}
function setMobileScreen(name){
 document.body.classList.remove("screen-home","screen-categories","screen-products","screen-dashboard","screen-account");
 document.body.classList.add("screen-"+name);
 setMobileNavActive(name==="dashboard"?"quotes":name);
 window.scrollTo({top:0,behavior:"smooth"});
}
function closeMobilePanels(){
 document.querySelectorAll(".modal-backdrop").forEach(m=>m.classList.add("hidden"));
 document.body.classList.remove("mobile-panel-open");
}
function openCustomerDashboardScreen(tab="quotes",navName="account"){
 if(!session){openAuth("Müşteri hesabınızı açmak için giriş yapın.");return}
 customerDashboardTab=tab;
 document.querySelectorAll("[data-customer-tab]").forEach(x=>x.classList.toggle("active",x.dataset.customerTab===tab));
 const dash=document.getElementById("customerDashboard");
 dash.classList.remove("hidden");
 setMobileScreen("dashboard");
 setMobileNavActive(navName);
 loadCustomerDashboard();
}
document.querySelectorAll("[data-mobile-nav]").forEach(btn=>btn.onclick=()=>{
 const action=btn.dataset.mobileNav;
 closeMobilePanels();
 if(action==="home"){document.getElementById("customerDashboard")?.classList.add("hidden");setMobileScreen("home");return}
 if(action==="categories"){document.getElementById("customerDashboard")?.classList.add("hidden");setMobileScreen("categories");return}
 if(action==="products"){document.getElementById("customerDashboard")?.classList.add("hidden");setMobileScreen("products");return}
 if(action==="quotes"){
   if(!session){openAuth("Tekliflerinizi görmek için müşteri hesabınızla giriş yapın.");return}
   openCustomerDashboardScreen("quotes","quotes");return;
 }
 if(action==="account"){
   if(!session){openAuth("Müşteri hesabınızı açmak için giriş yapın.");return}
   openCustomerDashboardScreen(customerDashboardTab||"quotes","account");return;
 }
});

function customerInviteMessage(){
 const link=document.getElementById("customerInviteLink")?.textContent||"";
 return `Emigro Cash & Carry B2B platformuna sizi davet ediyorum.

Bu platform üzerinden özel teklifler ve hızlı sipariş imkanlarından yararlanabilirsiniz.

Davet bağlantım:
${link}

İlk alışverişinizde hem size hem de beni davet eden müşteri olarak bana ekstra indirim avantajı sağlanacaktır.`;
}
async function copyCustomerInvite(){
 const link=document.getElementById("customerInviteLink")?.textContent||"";
 try{await navigator.clipboard.writeText(link);notify("Davet bağlantısı kopyalandı.");}
 catch{prompt("Davet bağlantısını kopyalayın:",link)}
}
async function shareCustomerInvite(){
 const link=document.getElementById("customerInviteLink")?.textContent||"";
 const text=customerInviteMessage();
 if(navigator.share){
   try{await navigator.share({title:"Emigro Cash & Carry B2B daveti",text,url:link});return}catch{}
 }
 try{await navigator.clipboard.writeText(text);notify("Davet metni kopyalandı. WhatsApp, SMS veya başka bir uygulamada paylaşabilirsiniz.");}
 catch{prompt("Davet metnini kopyalayın:",text)}
}
function emailCustomerInvite(){
 const subject=encodeURIComponent("Emigro Cash & Carry B2B daveti");
 const body=encodeURIComponent(customerInviteMessage());
 location.href=`mailto:?subject=${subject}&body=${body}`;
}
window.copyCustomerInvite=copyCustomerInvite;
window.shareCustomerInvite=shareCustomerInvite;
window.emailCustomerInvite=emailCustomerInvite;

async function handleReferralLanding(){
 if(referralLandingHandled||!REFERRAL_CODE||session)return;
 referralLandingHandled=true;
 let inviterLabel="Emigro müşterisi";
 try{
   const {data}=await sb.rpc("emigro_catalog_referral_inviter",{p_code:REFERRAL_CODE});
   const row=Array.isArray(data)?data[0]:data;
   if(row?.company_name)inviterLabel=row.company_name;
 }catch{}
 const notice=document.getElementById("referralNotice");
 if(notice){
   notice.classList.remove("hidden");
   notice.innerHTML=`<b>${esc(inviterLabel)} tarafından davet edildiniz.</b><span>Davet kodu: ${esc(REFERRAL_CODE)}. Başvurunuz tamamlandığında bu davet otomatik olarak hesabınıza bağlanacaktır.</span>`;
 }
 openAuth("Emigro B2B platformuna davet edildiniz.");
 switchAuthTab("register");
}

function setupKeyboardAwareMobileDock(){
 const vv=window.visualViewport;
 let baseHeight=vv?.height||window.innerHeight;
 const editable=el=>el&&["INPUT","TEXTAREA","SELECT"].includes(el.tagName);
 const sync=()=>{
   const current=vv?.height||window.innerHeight;
   const focused=editable(document.activeElement);
   const keyboardLikely=focused && current < baseHeight-120;
   document.body.classList.toggle("keyboard-open",keyboardLikely);
   if(!focused && current>baseHeight-40)baseHeight=Math.max(baseHeight,current);
 };
 document.addEventListener("focusin",e=>{if(editable(e.target))setTimeout(sync,60)});
 document.addEventListener("focusout",()=>setTimeout(sync,180));
 vv?.addEventListener("resize",sync);
 window.addEventListener("orientationchange",()=>setTimeout(()=>{baseHeight=vv?.height||window.innerHeight;sync()},350));
}
setupKeyboardAwareMobileDock();

async function bootstrapCatalog(){
 await Promise.all([loadActiveValidity(),loadLiveCatalog()]);
 renderHero();renderCategorySquares();renderFeatured();renderAll();
 await syncAuth();
 if(matchMedia("(max-width:700px)").matches&&!document.body.classList.contains("screen-home")&&!document.body.classList.contains("screen-categories")&&!document.body.classList.contains("screen-products")&&!document.body.classList.contains("screen-dashboard"))setMobileScreen("home");
 await handleReferralLanding();
 const sku=new URLSearchParams(location.search).get("product");if(sku){const p=products.find(x=>x.sku===sku);if(p)openProduct(p.id)}
}
bootstrapCatalog();
sb.auth.onAuthStateChange(()=>setTimeout(syncAuth,0));
