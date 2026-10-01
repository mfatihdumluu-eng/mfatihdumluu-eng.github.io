const SUPABASE_URL="https://hroarfuwpfsqilsijwpp.supabase.co";
const SUPABASE_KEY="sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:"emigro-admin-auth",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let profiles=[],quotes=[],memberFilter="all",quoteFilter="all",activeQuote=null,profileMap={};
let adminProducts=[],orders=[],orderFilter="all",adminProfile=null;
let importRows=[],importImageFiles=new Map(),existingProducts=new Map(),defaultImageUrls={kutu:null,palet:null},imageQualityWarnings=new Map();

const euro=n=>new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(Number(n||0));
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const memberStatus=s=>({pending:"Onay bekliyor",approved:"Onaylı",rejected:"Reddedildi",suspended:"Askıya alındı"}[s]||s);
const quoteStatus=s=>({new:"Yeni",reviewing:"İnceleniyor",offered:"Teklif verildi",accepted:"Kabul edildi",declined:"Reddedildi",closed:"Kapalı"}[s]||s);
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


async function guard(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){
   document.getElementById("adminLoginShell").classList.remove("hidden");
   document.getElementById("adminShell").classList.add("hidden");
   document.getElementById("adminTopbar").classList.add("hidden");
   return false;
 }
 const {data:me,error}=await sb.from("emigro_catalog_profiles").select("*").eq("id",session.user.id).single();
 adminProfile=me||null;
 if(error||me?.role!=="admin"){
   await sb.auth.signOut();
   document.getElementById("adminLoginShell").classList.remove("hidden");
   document.getElementById("adminShell").classList.add("hidden");
   document.getElementById("adminTopbar").classList.add("hidden");
   document.getElementById("adminLoginMessage").textContent="Bu hesap admin hesabı değil. Müşteri hesabıyla admin paneline giriş yapılamaz.";
   return false;
 }
 document.getElementById("adminLoginShell").classList.add("hidden");
 document.getElementById("adminShell").classList.remove("hidden");
 document.getElementById("adminTopbar").classList.remove("hidden");
 return true;
}

async function loadAll(){
 await Promise.all([loadProfiles(),loadQuotes(),loadAdminProducts(),loadOrders(),loadActivePricePeriod()]);
}
async function loadProfiles(){
 const {data,error}=await sb.from("emigro_catalog_profiles").select("*").order("created_at",{ascending:false});
 if(error){document.getElementById("adminList").innerHTML='<div class="admin-loading">Üyelikler yüklenemedi: '+esc(error.message)+'</div>';return}
 profiles=data||[];profileMap=Object.fromEntries(profiles.map(p=>[p.id,p]));renderMembers();
}
async function loadQuotes(){
 const {data,error}=await sb.from("emigro_catalog_quotes").select("*").order("created_at",{ascending:false});
 if(error){document.getElementById("quoteList").innerHTML='<div class="admin-loading">Teklifler yüklenemedi: '+esc(error.message)+'</div>';return}
 quotes=data||[];renderQuotes();
}

function renderMembers(){
 const counts={all:profiles.length,pending:0,approved:0,rejected:0,suspended:0};
 profiles.forEach(p=>counts[p.status]=(counts[p.status]||0)+1);
 document.getElementById("adminStats").innerHTML=[["Toplam",counts.all],["Bekleyen",counts.pending],["Onaylı",counts.approved],["Reddedilen",counts.rejected],["Askıda",counts.suspended]]
 .map(([l,n])=>'<div><span>'+l+'</span><strong>'+n+'</strong></div>').join("");
 const list=memberFilter==="all"?profiles:profiles.filter(p=>p.status===memberFilter);
 document.getElementById("adminList").innerHTML=list.length?list.map(p=>`
 <article class="member-card">
  <div class="member-card-head"><div><span class="status-pill ${p.status}">${memberStatus(p.status)}</span><h3>${esc(p.company_name||"Firma adı yok")}</h3><p>${esc(p.contact_name)} · ${esc(p.contact_role)}</p></div><small>${new Date(p.created_at).toLocaleDateString("nl-NL")}</small></div>
  <div class="member-details">
   <div><span>E-posta</span><b>${esc(p.email)}</b></div><div><span>Telefon</span><b>${esc(p.phone)}</b></div>
   <div><span>Adres</span><b>${esc(p.company_address)} · ${esc(p.postal_code)} ${esc(p.city)} · ${esc(p.country)}</b></div>
   <div><span>KvK</span><b>${esc(p.kvk_number)}</b></div><div><span>BTW</span><b>${esc(p.btw_number)}</b></div><div><span>Rol</span><b>${esc(p.role)}</b></div>
  </div>
  ${p.referred_by?`<div class="member-referral"><span>DAVET BİLGİSİ</span><b>${esc((profileMap[p.referred_by]?.role==="admin"?"Emigro Cash & Carry":profileMap[p.referred_by]?.company_name)||"Davet eden kullanıcı")}</b><small>${esc(profileMap[p.referred_by]?.contact_name||profileMap[p.referred_by]?.email||"")} · Kod: ${esc(p.referred_by_code||"—")}</small></div>`:""}
  <div class="member-actions">
   <button class="approve" ${p.status==="approved"?"disabled":""} onclick="setStatus('${p.id}','approved',this)">${p.status==="approved"?"Onaylandı":"Onayla"}</button>
   <button ${p.status==="pending"?"disabled":""} onclick="setStatus('${p.id}','pending',this)">Beklemeye al</button>
   <button class="reject" ${p.status==="rejected"?"disabled":""} onclick="setStatus('${p.id}','rejected',this)">Reddet</button>
   <button class="suspend" ${p.status==="suspended"?"disabled":""} onclick="setStatus('${p.id}','suspended',this)">Askıya al</button>
  </div>
 </article>`).join(""):'<div class="admin-loading">Bu durumda üye bulunmuyor.</div>';
}

async function setStatus(id,status,btn){
 const original=btn?.textContent||"";
 if(btn){btn.disabled=true;btn.textContent="Kaydediliyor…"}
 const {error}=await sb.rpc("emigro_catalog_admin_set_status",{target_user:id,new_status:status});
 if(error){
   if(btn){btn.disabled=false;btn.textContent=original}
   notify("Durum güncellenemedi: "+error.message);
   return;
 }
 const {data:check,error:checkError}=await sb.from("emigro_catalog_profiles").select("status").eq("id",id).single();
 if(checkError||check?.status!==status){
   if(btn){btn.disabled=false;btn.textContent=original}
   notify("Durum kaydedildi ancak ekran doğrulaması başarısız oldu. Sayfayı yenileyin.");
   return;
 }
 await loadProfiles();
 const labels={approved:"Üyelik onaylandı.",pending:"Üyelik beklemeye alındı.",rejected:"Üyelik reddedildi.",suspended:"Üyelik askıya alındı."};
 notify(labels[status]||"Durum güncellendi.");
}
window.setStatus=setStatus;

async function saveCustomerPricing(id){
 const discount=Number(document.getElementById("memberDiscount-"+id)?.value||0);
 const level=document.getElementById("memberPriceLevel-"+id)?.value?.trim()||"standard";
 const {error}=await sb.rpc("emigro_catalog_admin_set_customer_pricing",{target_user:id,p_discount:discount,p_price_level:level});
 if(error){notify("Müşteri fiyat ayarı kaydedilemedi: "+error.message);return}
 await loadProfiles();
 notify("Müşteri fiyat ayarı kaydedildi.");
}
window.saveCustomerPricing=saveCustomerPricing;

function quoteBase(q){return Number(q.estimated_total||0)}
function quoteDiscount(q,percent,amount){
 const pct=quoteBase(q)*(Number(percent||0)/100);
 return Math.min(quoteBase(q),pct+Number(amount||0));
}
function quoteGrand(q,percent,amount,shipping){
 return Math.max(0,quoteBase(q)-quoteDiscount(q,percent,amount)+Number(shipping||0));
}
function renderQuotes(){
 const counts={all:quotes.length,new:0,reviewing:0,offered:0,accepted:0,declined:0,closed:0};
 quotes.forEach(q=>counts[q.status]=(counts[q.status]||0)+1);
 document.getElementById("quoteStats").innerHTML=[["Toplam",counts.all],["Yeni",counts.new],["İnceleniyor",counts.reviewing],["Teklif verildi",counts.offered],["Kabul",counts.accepted]]
 .map(([l,n])=>'<div><span>'+l+'</span><strong>'+n+'</strong></div>').join("");
 document.getElementById("newQuoteBadge").textContent=counts.new?counts.new:"";
 const list=quoteFilter==="all"?quotes:quotes.filter(q=>q.status===quoteFilter);
 document.getElementById("quoteList").innerHTML=list.length?list.map(q=>{
   const p=profileMap[q.user_id]||{};
   const final=quoteGrand(q,q.discount_percent,q.discount_amount,q.shipping_fee);
   return `<article class="quote-admin-card">
    <div class="quote-admin-head"><div><span class="quote-status ${q.status}">${quoteStatus(q.status)}</span><h3>${esc(p.company_name||"Bilinmeyen firma")}</h3><p>${esc(p.contact_name||"")} · ${esc(p.email||"")}</p></div><div><small>${new Date(q.created_at).toLocaleString("nl-NL")}</small><strong>${euro(final)}</strong></div></div>
    <div class="quote-admin-meta"><span>${(q.items||[]).length} ürün</span><span>${esc(p.postal_code||"")} ${esc(p.city||"")}</span><span>Teklif no: ${esc(q.offer_number||"—")}</span><span>Geçerli: ${q.offer_valid_to?new Date(q.offer_valid_to).toLocaleDateString("nl-NL"):"—"}</span></div>
    <button class="btn" onclick="openOffer('${q.id}')">Teklifi aç / cevapla</button>
   </article>`;
 }).join(""):'<div class="admin-loading">Bu durumda teklif bulunmuyor.</div>';
}

function openOffer(id){
 activeQuote=quotes.find(q=>q.id===id);if(!activeQuote)return;
 const p=profileMap[activeQuote.user_id]||{};
 document.getElementById("offerCustomerLine").textContent=`${p.company_name||""} · ${p.company_address||""}, ${p.postal_code||""} ${p.city||""}`;
 document.getElementById("offerNumber").value=activeQuote.offer_number||`EM-${new Date().getFullYear()}-${String(quotes.indexOf(activeQuote)+1).padStart(4,"0")}`;
 document.getElementById("offerStatus").value=activeQuote.status==="new"?"reviewing":activeQuote.status;
 document.getElementById("discountPercent").value=Number(activeQuote.discount_percent||0);
 document.getElementById("discountAmount").value=Number(activeQuote.discount_amount||0);
 document.getElementById("shippingFee").value=Number(activeQuote.shipping_fee||0);
 document.getElementById("offerValidTo").value=activeQuote.offer_valid_to||"2026-10-30";
 document.getElementById("adminNote").value=activeQuote.admin_note||"";
 renderOfferProducts();
 updateOfferPreview();
 document.getElementById("offerModal").classList.remove("hidden");
}
window.openOffer=openOffer;

function recalcActiveQuoteBase(){
 if(!activeQuote)return 0;
 const total=(activeQuote.items||[]).reduce((s,i)=>s+Number(i.unit_price||0)*Number(i.qty||0),0);
 activeQuote.estimated_total=Number(total.toFixed(2));
 return activeQuote.estimated_total;
}
function renderOfferProducts(){
 const root=document.getElementById("offerProducts");
 const items=activeQuote?.items||[];
 if(!items.length){
   root.innerHTML='<div class="admin-loading">Teklifte ürün kalmadı. En az bir ürün bırakın.</div>';
   recalcActiveQuoteBase();updateOfferPreview();return;
 }
 root.innerHTML=items.map((i,idx)=>`
   <div class="offer-product-line">
     <span>${idx+1}</span>
     <div><b>${esc(i.name)}</b><small>${esc(i.sku)} · ${i.mode==="case"?"Koli":"Palet"} · Adet: ${i.qty}</small></div>
     <strong>${euro(Number(i.unit_price||0)*Number(i.qty||0))}</strong>
     <button type="button" class="remove-offer-item" onclick="removeOfferItem(${idx})">Ürünü çıkar</button>
   </div>
 `).join("");
 recalcActiveQuoteBase();
}
function removeOfferItem(idx){
 if(!activeQuote?.items?.[idx])return;
 if(!confirm("Bu ürünü tekliften çıkarmak istiyor musunuz?"))return;
 activeQuote.items.splice(idx,1);
 renderOfferProducts();
 updateOfferPreview();
}
window.removeOfferItem=removeOfferItem;

function currentOfferValues(){
 return {
  percent:Number(document.getElementById("discountPercent").value||0),
  amount:Number(document.getElementById("discountAmount").value||0),
  shipping:Number(document.getElementById("shippingFee").value||0),
  validTo:document.getElementById("offerValidTo").value,
  number:document.getElementById("offerNumber").value.trim(),
  note:document.getElementById("adminNote").value.trim(),
  status:document.getElementById("offerStatus").value
 };
}
function updateOfferPreview(){
 if(!activeQuote)return;
 const v=currentOfferValues(),p=profileMap[activeQuote.user_id]||{};
 const discount=quoteDiscount(activeQuote,v.percent,v.amount),final=quoteGrand(activeQuote,v.percent,v.amount,v.shipping);
 document.getElementById("offerTotals").innerHTML=`
  <div><span>Subtotaal</span><strong>${euro(quoteBase(activeQuote))}</strong></div>
  <div><span>Korting</span><strong>− ${euro(discount)}</strong></div>
  <div><span>Verzendkosten</span><strong>${euro(v.shipping)}</strong></div>
  <div class="grand"><span>Totaal</span><strong>${euro(final)}</strong></div>`;
 document.getElementById("offerPreview").innerHTML=`
  <div class="offer-preview-head"><img src="./logo.svg" alt="Emigro"><div><span>OFFERTE</span><strong>${esc(v.number||"—")}</strong></div></div>
  <div class="offer-preview-customer"><div><span>Aan</span><b>${esc(p.company_name||"")}</b><small>${esc(p.contact_name||"")}<br>${esc(p.company_address||"")}<br>${esc(p.postal_code||"")} ${esc(p.city||"")} · ${esc(p.country||"")}</small></div><div><span>KvK</span><b>${esc(p.kvk_number||"—")}</b><span>BTW</span><b>${esc(p.btw_number||"—")}</b></div></div>
  <div class="offer-preview-summary"><div><span>Subtotaal</span><b>${euro(quoteBase(activeQuote))}</b></div><div><span>Korting</span><b>− ${euro(discount)}</b></div><div><span>Verzendkosten</span><b>${euro(v.shipping)}</b></div><div class="grand"><span>Totaal</span><b>${euro(final)}</b></div></div>
  <div class="offer-preview-note">${v.note?esc(v.note):"Geen aanvullende notitie."}</div>
  <div class="offer-preview-valid"><span>Deze offerte is geldig t/m</span><strong>${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}</strong></div>`;
}
["discountPercent","discountAmount","shippingFee","offerValidTo","offerNumber","adminNote","offerStatus"].forEach(id=>document.getElementById(id).addEventListener("input",updateOfferPreview));

async function saveOffer(forceStatus=null){
 if(!activeQuote)return false;
 if(!(activeQuote.items||[]).length){notify("Teklifte en az bir ürün olmalı.");return false}
 const v=currentOfferValues();
 const status=forceStatus||v.status;
 recalcActiveQuoteBase();
 const {error}=await sb.rpc("emigro_catalog_admin_update_quote_full",{
  quote_id:activeQuote.id,
  p_status:status,
  p_shipping_fee:v.shipping,
  p_discount_percent:v.percent,
  p_discount_amount:v.amount,
  p_offer_valid_to:v.validTo||null,
  p_admin_note:v.note,
  p_offer_number:v.number,
  p_items:activeQuote.items,
  p_estimated_total:activeQuote.estimated_total
 });
 if(error){notify("Teklif kaydedilemedi: "+error.message);return false}
 await loadQuotes();
 activeQuote=quotes.find(q=>q.id===activeQuote.id);
 document.getElementById("offerStatus").value=activeQuote.status;
 renderOfferProducts();
 updateOfferPreview();
 return true;
}
document.getElementById("saveOfferBtn").onclick=async()=>{if(await saveOffer())notify("Taslak kaydedildi.")};
document.getElementById("publishOfferBtn").onclick=async()=>{
 document.getElementById("offerStatus").value="offered";
 if(await saveOffer("offered"))notify("Teklif müşteriye yayınlandı. Müşteri hesabındaki Tekliflerim bölümünde görebilir.");
};

function offerPrintHtml(){
 const q=activeQuote,v=currentOfferValues(),p=profileMap[q.user_id]||{};
 const discount=quoteDiscount(q,v.percent,v.amount),final=quoteGrand(q,v.percent,v.amount,v.shipping);
 const logoUrl=new URL("./logo.svg",location.href).href;
 const rows=(q.items||[]).map((i,idx)=>`<tr><td>${idx+1}</td><td><b>${esc(i.name)}</b><br><small>${esc(i.sku)}</small></td><td>${i.mode==="case"?"Koli":"Palet"}</td><td>${i.qty}</td><td>${euro(i.unit_price)}</td><td>${euro(Number(i.unit_price||0)*Number(i.qty||0))}</td></tr>`).join("");
 return `<!doctype html><html><head><meta charset="utf-8"><title>Offerte ${esc(v.number)}</title><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet"><style>
 body{font-family:Roboto,Arial,sans-serif;color:#293369;margin:0;background:#fff}.sheet{width:210mm;min-height:297mm;padding:18mm;box-sizing:border-box;position:relative}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #293369;padding-bottom:8mm}.head img{width:62mm}.head h1{margin:0;color:#ec0419;font-size:26px}.head p{margin:3px 0;font-size:11px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:15mm;margin:10mm 0}.box{border:1px solid #dfe2ed;border-radius:3mm;padding:5mm}.box span{display:block;font-size:8px;color:#717996;text-transform:uppercase}.box b{display:block;margin:1mm 0;font-size:12px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{text-align:left;padding:3mm 2mm;border-bottom:1px solid #e7e9f0}th{color:#6f7690;font-size:8px}.totals{width:80mm;margin-left:auto;margin-top:8mm}.totals div{display:flex;justify-content:space-between;padding:2.4mm 0;border-bottom:1px solid #e7e9f0}.totals .grand{font-size:16px;font-weight:700;color:#ec0419}.note{margin-top:10mm;border-left:3px solid #293369;padding-left:5mm;font-size:10px;line-height:1.5}.valid{position:absolute;left:18mm;right:18mm;bottom:15mm;background:#fff1f3;border:1px solid #f3c4ca;border-radius:3mm;padding:4mm;display:flex;justify-content:space-between;color:#9f1321}.valid strong{color:#ec0419}.foot{position:absolute;right:18mm;bottom:7mm;font-size:8px;color:#858ba1}
 </style></head><body><div class="sheet">
 <div class="head"><img src="${logoUrl}"><div><h1>Offerte</h1><p>Offertenummer: <b>${esc(v.number)}</b></p><p>Datum: ${new Date().toLocaleDateString("nl-NL")}</p></div></div>
 <div class="cols"><div class="box"><span>Aan</span><b>${esc(p.company_name||"")}</b><div>${esc(p.contact_name||"")}</div><div>${esc(p.company_address||"")}</div><div>${esc(p.postal_code||"")} ${esc(p.city||"")} · ${esc(p.country||"")}</div></div><div class="box"><span>KvK</span><b>${esc(p.kvk_number||"—")}</b><span>BTW</span><b>${esc(p.btw_number||"—")}</b><span>E-mail</span><b>${esc(p.email||"—")}</b></div></div>
 <table><thead><tr><th>#</th><th>Product</th><th>Type</th><th>Aantal</th><th>Prijs</th><th>Totaal</th></tr></thead><tbody>${rows}</tbody></table>
 <div class="totals"><div><span>Subtotaal</span><b>${euro(quoteBase(q))}</b></div><div><span>Korting${v.percent?" ("+v.percent+"%)":""}</span><b>− ${euro(discount)}</b></div><div><span>Verzendkosten</span><b>${euro(v.shipping)}</b></div><div class="grand"><span>Totaal</span><b>${euro(final)}</b></div></div>
 ${v.note?`<div class="note"><b>Opmerking</b><br>${esc(v.note)}</div>`:""}
 <div class="valid"><span>Deze offerte is geldig t/m</span><strong>${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}</strong></div><div class="foot">Emigro Cash & Carry · B2B offerte</div>
 </div></body></html>`;
}
document.getElementById("printOfferBtn").onclick=()=>{
 if(!activeQuote)return;
 const w=window.open("","_blank");w.document.write(offerPrintHtml());w.document.close();setTimeout(()=>w.print(),350);
};
function buildPdfOfferNode(){
 const q=activeQuote,v=currentOfferValues(),p=profileMap[q.user_id]||{};
 const discount=quoteDiscount(q,v.percent,v.amount),final=quoteGrand(q,v.percent,v.amount,v.shipping);
 const rows=(q.items||[]).map((i,idx)=>`
   <tr>
     <td style="padding:10px 8px;border-bottom:1px solid #e2e5ee;font-size:11px">${idx+1}</td>
     <td style="padding:10px 8px;border-bottom:1px solid #e2e5ee"><b style="font-size:12px">${esc(i.name)}</b><br><span style="font-size:10px;color:#68708b">${esc(i.sku)}</span></td>
     <td style="padding:10px 8px;border-bottom:1px solid #e2e5ee;font-size:11px">${i.mode==="case"?"Koli":"Palet"}</td>
     <td style="padding:10px 8px;border-bottom:1px solid #e2e5ee;font-size:11px">${i.qty}</td>
     <td style="padding:10px 8px;border-bottom:1px solid #e2e5ee;font-size:11px;text-align:right">${euro(i.unit_price)}</td>
     <td style="padding:10px 8px;border-bottom:1px solid #e2e5ee;font-size:11px;text-align:right;font-weight:700">${euro(Number(i.unit_price||0)*Number(i.qty||0))}</td>
   </tr>`).join("");

 const node=document.createElement("div");
 node.style.cssText="width:794px;min-height:1123px;background:#fff;color:#293369;font-family:Roboto,Arial,sans-serif;box-sizing:border-box;padding:64px 72px;position:relative";
 node.innerHTML=`
   <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #293369;padding-bottom:26px">
     <img src="${new URL("./logo.svg",location.href).href}" style="width:220px;height:78px;object-fit:contain;object-position:left top" alt="Emigro">
     <div style="text-align:right">
       <div style="font-size:32px;font-weight:700;color:#ec0419;line-height:1">Offerte</div>
       <div style="margin-top:8px;font-size:12px">Offertenummer: <b>${esc(v.number||"—")}</b></div>
       <div style="margin-top:4px;font-size:12px">Datum: ${new Date().toLocaleDateString("nl-NL")}</div>
     </div>
   </div>

   <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:34px">
     <div style="border:1px solid #dfe3ed;border-radius:14px;padding:20px">
       <div style="font-size:9px;color:#68708b;text-transform:uppercase;letter-spacing:.08em">Aan</div>
       <div style="font-size:15px;font-weight:700;margin-top:5px">${esc(p.company_name||"")}</div>
       <div style="font-size:12px;line-height:1.6;margin-top:6px">${esc(p.contact_name||"")}<br>${esc(p.company_address||"")}<br>${esc(p.postal_code||"")} ${esc(p.city||"")} · ${esc(p.country||"")}</div>
     </div>
     <div style="border:1px solid #dfe3ed;border-radius:14px;padding:20px">
       <div style="font-size:9px;color:#68708b;text-transform:uppercase">KvK</div><div style="font-size:12px;font-weight:700;margin:4px 0 10px">${esc(p.kvk_number||"—")}</div>
       <div style="font-size:9px;color:#68708b;text-transform:uppercase">BTW</div><div style="font-size:12px;font-weight:700;margin:4px 0 10px">${esc(p.btw_number||"—")}</div>
       <div style="font-size:9px;color:#68708b;text-transform:uppercase">E-mail</div><div style="font-size:12px;font-weight:700;margin-top:4px">${esc(p.email||"—")}</div>
     </div>
   </div>

   <table style="width:100%;border-collapse:collapse;margin-top:36px">
     <thead>
       <tr style="color:#5f6780">
         <th style="text-align:left;padding:8px;font-size:10px">#</th>
         <th style="text-align:left;padding:8px;font-size:10px">Product</th>
         <th style="text-align:left;padding:8px;font-size:10px">Type</th>
         <th style="text-align:left;padding:8px;font-size:10px">Aantal</th>
         <th style="text-align:right;padding:8px;font-size:10px">Prijs</th>
         <th style="text-align:right;padding:8px;font-size:10px">Totaal</th>
       </tr>
     </thead>
     <tbody>${rows}</tbody>
   </table>

   <div style="width:330px;margin-left:auto;margin-top:34px">
     <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e5ee;font-size:13px"><span>Subtotaal</span><b>${euro(quoteBase(q))}</b></div>
     <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e5ee;font-size:13px"><span>Korting${v.percent?" ("+v.percent+"%)":""}</span><b>− ${euro(discount)}</b></div>
     <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e5ee;font-size:13px"><span>Verzendkosten</span><b>${euro(v.shipping)}</b></div>
     <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e2e5ee;font-size:17px;color:#ec0419"><span style="font-weight:700">Totaal</span><b>${euro(final)}</b></div>
   </div>

   ${v.note?`<div style="margin-top:28px;border-left:4px solid #293369;background:#f7f8fc;padding:14px 16px;font-size:11px;line-height:1.6"><b>Opmerking</b><br>${esc(v.note)}</div>`:""}

   <div style="position:absolute;left:72px;right:72px;bottom:70px;background:#fff1f3;border:1px solid #f1bcc4;border-radius:14px;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;color:#a01928">
     <span style="font-size:12px">Deze offerte is geldig t/m</span>
     <strong style="font-size:16px;color:#ec0419">${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}</strong>
   </div>
   <div style="position:absolute;right:72px;bottom:38px;font-size:9px;color:#858ca0">Emigro Cash & Carry · B2B offerte</div>
 `;
 return node;
}

async function generateOfferPdfFile(){
 if(!activeQuote)return null;
 const v=currentOfferValues();
 const stage=document.createElement("div");
 stage.style.cssText="position:fixed;left:0;top:0;width:794px;height:1123px;z-index:-9999;pointer-events:none;background:#fff";
 const node=buildPdfOfferNode();
 stage.appendChild(node);
 document.body.appendChild(stage);
 const filename=(v.number||"Emigro-Offerte")+".pdf";
 try{
   await new Promise(resolve=>setTimeout(resolve,300));
   if(document.fonts?.ready)await document.fonts.ready;
   const imgs=[...node.querySelectorAll("img")];
   await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r})));
   const blob=await html2pdf().set({
     margin:0,
     filename,
     image:{type:"jpeg",quality:1},
     html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",logging:false},
     jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}
   }).from(node).outputPdf("blob");
   if(!blob||blob.size<5000)throw new Error("PDF içeriği boş veya eksik oluştu");
   return new File([blob],filename,{type:"application/pdf"});
 } finally {
   stage.remove();
 }
}
document.getElementById("mailOfferBtn").onclick=async()=>{
 if(!activeQuote)return;
 const btn=document.getElementById("mailOfferBtn");
 const p=profileMap[activeQuote.user_id]||{},v=currentOfferValues();
 const final=quoteGrand(activeQuote,v.percent,v.amount,v.shipping);
 btn.disabled=true;btn.textContent="PDF hazırlanıyor…";
 try{
   const file=await generateOfferPdfFile();
   const mailText=`Beste ${p.contact_name||""},\n\nHierbij ontvangt u onze offerte ${v.number}.\nTotaal: ${euro(final)}\nVerzendkosten: ${euro(v.shipping)}\nGeldig t/m: ${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}\n\nMet vriendelijke groet,\nEmigro Cash & Carry`;

   let sentAutomatically=false;
   try{
     const {data:{session}}=await sb.auth.getSession();
     const bytes=new Uint8Array(await file.arrayBuffer());
     let binary="";const chunk=0x8000;
     for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
     const pdfBase64=btoa(binary);
     const res=await fetch(SUPABASE_URL+"/functions/v1/send-offer-email",{
       method:"POST",
       headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token},
       body:JSON.stringify({to:p.email,subject:`Emigro offerte ${v.number}`,body:mailText,filename:file.name,pdf_base64:pdfBase64})
     });
     const result=await res.json().catch(()=>({}));
     if(res.ok&&result.ok){sentAutomatically=true;notify("Teklif PDF olarak müşteriye e-posta ile gönderildi.");}
   }catch{}
   if(sentAutomatically)return;

   const shareData={
     title:`Emigro offerte ${v.number}`,
     text:mailText,
     files:[file]
   };
   if(navigator.canShare&&navigator.canShare({files:[file]})){
     await navigator.share(shareData);
   }else{
     const url=URL.createObjectURL(file);
     const a=document.createElement("a");
     a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
     setTimeout(()=>URL.revokeObjectURL(url),1500);
     const subject=encodeURIComponent(`Emigro offerte ${v.number}`);
     const body=encodeURIComponent(`Beste ${p.contact_name||""},\n\nHierbij ontvangt u onze offerte ${v.number}.\nTotaal: ${euro(final)}\nVerzendkosten: ${euro(v.shipping)}\nGeldig t/m: ${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}\n\nDe PDF-offerte is zojuist gedownload. Voeg deze als bijlage toe aan deze e-mail.\n\nMet vriendelijke groet,\nEmigro Cash & Carry`);
     location.href=`mailto:${p.email||""}?subject=${subject}&body=${body}`;
   }
 }catch(err){
   notify("PDF hazırlanamadı: "+(err?.message||err));
 }finally{
   btn.disabled=false;btn.textContent="PDF ile e-posta gönder";
 }
};

document.getElementById("whatsappOfferBtn").onclick=()=>{
 if(!activeQuote)return;
 const p=profileMap[activeQuote.user_id]||{},v=currentOfferValues();
 const final=quoteGrand(activeQuote,v.percent,v.amount,v.shipping);
 const phone=String(p.phone||"").replace(/\D/g,"");
 const text=encodeURIComponent(`Beste ${p.contact_name||""},\nEmigro offerte ${v.number}\nTotaal: ${euro(final)}\nGeldig t/m: ${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}\n\nDe PDF-offerte kan vanuit het adminpaneel worden gedeeld.`);
 window.open("https://wa.me/"+phone+"?text="+text,"_blank");
};


const PRODUCT_HEADERS=[
 {key:"product_name",label:"urun_adi"},
 {key:"barcode",label:"barkod"},
 {key:"brand",label:"marka"},
 {key:"category",label:"kategori"},
 {key:"sale_type",label:"satis_tipi"},
 {key:"unit_price",label:"birim_fiyat"},
 {key:"net_value",label:"net_deger"},
 {key:"net_unit",label:"net_birim"},
 {key:"units_per_case",label:"koli_ici_adet"},
 {key:"cases_per_pallet",label:"palet_ici_koli_adedi"},
 {key:"min_order_qty",label:"min_siparis_adedi"},
 {key:"max_order_qty",label:"max_siparis_adedi"},
 {key:"origin",label:"mensei"},
 {key:"statiegeld",label:"statiegeld"},
 {key:"statiegeld_scope",label:"statiegeld_tipi"},
 {key:"is_featured",label:"one_cikan"}
];
const SITE_CATEGORIES=["Soft Drinks","Juices","Sauces","Snacks","Frozen","Grocery","Dairy","Sweets","Non-Food"];
const SALE_TYPES=["case","pallet","both"];
const STATIEGELD_SCOPES=["none","case","pallet","both"];
const REQUIRED_PRODUCT_KEYS=["product_name","barcode","brand","category","sale_type","unit_price","net_value","net_unit","units_per_case","cases_per_pallet","origin","statiegeld","statiegeld_scope"];

function normalizeHeader(v){
 return String(v??"").trim().toLowerCase()
  .replace(/[ıİ]/g,"i").replace(/[şŞ]/g,"s").replace(/[ğĞ]/g,"g")
  .replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o").replace(/[çÇ]/g,"c")
  .replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
function toNumber(v){
 if(typeof v==="number")return Number.isFinite(v)?v:null;
 const s=String(v??"").trim().replace(/\s/g,"").replace(",",".");
 if(!s)return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function toInt(v){const n=toNumber(v);return Number.isInteger(n)?n:null}
function toBool(v){
 const s=String(v??"").trim().toLowerCase();
 return ["1","true","ja","yes","evet","x"].includes(s);
}
function cleanBarcode(v){
 return String(v??"").trim().replace(/\.0$/,"").replace(/\s+/g,"");
}
function fileBase(name){
 return String(name||"").replace(/\.[^.]+$/,"").toLowerCase();
}
function escAttr(v=""){return esc(v).replace(/"/g,"&quot;")}

function rowErrors(row,index){
 const e=[];
 if(!String(row.product_name||"").trim())e.push("Ürün adı");
 if(!cleanBarcode(row.barcode))e.push("Barkod");
 if(!String(row.brand||"").trim())e.push("Marka");
 if(!String(row.category||"").trim())e.push("Kategori");
 else if(!SITE_CATEGORIES.includes(String(row.category)))e.push("Geçersiz kategori");
 if(!SALE_TYPES.includes(String(row.sale_type||"")))e.push("Satış tipi");
 if(!(Number(row.unit_price)>0))e.push("Tek birim fiyatı");
 if(!(Number(row.net_value)>0))e.push("Net gramaj/değer");
 if(!String(row.net_unit||"").trim())e.push("Net birim");
 if(!(Number.isInteger(Number(row.units_per_case))&&Number(row.units_per_case)>0))e.push("Koli içi adet");
 if(!(Number.isInteger(Number(row.cases_per_pallet))&&Number(row.cases_per_pallet)>0))e.push("Palet içi koli adedi");
 if(!(Number.isInteger(Number(row.min_order_qty))&&Number(row.min_order_qty)>0))e.push("Minimum sipariş adedi");
 if(row.max_order_qty!==null&&row.max_order_qty!==""&&!(Number.isInteger(Number(row.max_order_qty))&&Number(row.max_order_qty)>=Number(row.min_order_qty||1)))e.push("Maksimum sipariş adedi");
 if(!String(row.origin||"").trim())e.push("Menşei");
 if(!(Number(row.statiegeld)>=0))e.push("Statiegeld (yoksa 0)");
 if(!STATIEGELD_SCOPES.includes(String(row.statiegeld_scope||"")))e.push("Statiegeld tipi");
 if(String(row.statiegeld_scope||"")==="none" && Number(row.statiegeld)!==0)e.push("Statiegeld yoksa tutar 0 olmalı");
 if(String(row.statiegeld_scope||"")!=="none" && !(Number(row.statiegeld)>0))e.push("Statiegeld tipi seçiliyse tutar > 0 olmalı");
 const barcode=cleanBarcode(row.barcode).toLowerCase();
 const hasMain=!!importImageFiles.get(barcode)||!!existingProducts.get(cleanBarcode(row.barcode))?.image_1;
 if(!hasMain)e.push("Ana ürün görseli ("+cleanBarcode(row.barcode)+".jpg/png)");
 return e;
}
function importStats(){
 const valid=importRows.filter((r,i)=>rowErrors(r,i).length===0).length;
 return {total:importRows.length,valid,invalid:importRows.length-valid};
}
function renderImportSummary(){
 const root=document.getElementById("productImportSummary");
 const s=importStats();
 if(!s.total){root.innerHTML="";document.getElementById("productImportActions").classList.add("hidden");return}
 root.innerHTML=`
  <div><span>Toplam</span><strong>${s.total}</strong></div>
  <div class="ok"><span>Hazır</span><strong>${s.valid}</strong></div>
  <div class="bad"><span>Eksik</span><strong>${s.invalid}</strong></div>
  <div><span>Eşleşen görsel</span><strong>${[...importImageFiles.keys()].filter(k=>!["kutu","palet"].includes(k)).length}</strong></div>`;
 document.getElementById("productImportActions").classList.remove("hidden");
}
function previewUrlFor(base,existingUrl=null){
 const f=importImageFiles.get(String(base||"").toLowerCase());
 return f?URL.createObjectURL(f):existingUrl;
}
function renderImportRows(){
 const root=document.getElementById("productImportList");
 if(!importRows.length){root.innerHTML='<div class="admin-loading">Excel yüklendiğinde ürün kartları burada oluşacak.</div>';renderImportSummary();return}
 root.innerHTML=importRows.map((r,i)=>{
   const errors=rowErrors(r,i);
   const bc=cleanBarcode(r.barcode);
   const ex=existingProducts.get(bc)||{};
   const img1=previewUrlFor(bc,ex.image_1);
   const img2=previewUrlFor(bc+"-2",ex.image_2)||previewUrlFor("kutu",defaultImageUrls.kutu);
   const img3=previewUrlFor(bc+"-3",ex.image_3)||previewUrlFor("palet",defaultImageUrls.palet);
   const casePrice=(Number(r.unit_price)||0)*(Number(r.units_per_case)||0);
   const palletPrice=casePrice*(Number(r.cases_per_pallet)||0);
   return `<article class="import-product-card ${errors.length?"invalid":"valid"}">
    <div class="import-product-top">
      <div class="import-images">
        <div>${img1?'<img src="'+escAttr(img1)+'">':'<span>ANA<br>RESİM YOK</span>'}<small>${esc(bc||"barkod")}</small></div>
        <div>${img2?'<img src="'+escAttr(img2)+'">':'<span>KUTU<br>YOK</span>'}<small>${esc(bc?bc+"-2":"-2")}</small></div>
        <div>${img3?'<img src="'+escAttr(img3)+'">':'<span>PALET<br>YOK</span>'}<small>${esc(bc?bc+"-3":"-3")}</small></div>
      </div>
      <div class="import-card-status">
        <b>${errors.length?"Eksik bilgi":"Hazır"}</b>
        <span>${errors.length?errors.join(" · "):"Sisteme eklenebilir"}</span>
        ${imageQualityWarnings.get(bc.toLowerCase())?`<span class="image-warning">⚠ ${esc(imageQualityWarnings.get(bc.toLowerCase()))}</span>`:""}
      </div>
    </div>

    <div class="import-fields">
      <label>Ürün adı<input value="${escAttr(r.product_name)}" oninput="updateImportField(${i},'product_name',this.value)"></label>
      <label>Barkod<input value="${escAttr(bc)}" oninput="updateImportField(${i},'barcode',this.value)"></label>
      <label>Marka<input value="${escAttr(r.brand)}" oninput="updateImportField(${i},'brand',this.value)"></label>
      <label>Kategori<select onchange="updateImportField(${i},'category',this.value)">${SITE_CATEGORIES.map(x=>`<option value="${x}" ${r.category===x?"selected":""}>${x}</option>`).join("")}</select></label>
      <label>Satış tipi<select onchange="updateImportField(${i},'sale_type',this.value)"><option value="both" ${r.sale_type==="both"?"selected":""}>Koli + Palet</option><option value="case" ${r.sale_type==="case"?"selected":""}>Sadece Koli</option><option value="pallet" ${r.sale_type==="pallet"?"selected":""}>Sadece Palet</option></select></label>
      <label>Tek birim fiyatı (€)<input type="number" min="0.0001" step="0.0001" value="${r.unit_price??""}" oninput="updateImportField(${i},'unit_price',this.value)"><small>Müşteriye gösterilmez</small></label>
      <label>Net değer<input type="number" min="0.001" step="0.001" value="${r.net_value??""}" oninput="updateImportField(${i},'net_value',this.value)"></label>
      <label>Net birim<input value="${escAttr(r.net_unit)}" placeholder="g / kg / ml / l" oninput="updateImportField(${i},'net_unit',this.value)"></label>
      <label>Koli içi adet<input type="number" min="1" step="1" value="${r.units_per_case??""}" oninput="updateImportField(${i},'units_per_case',this.value)"></label>
      <label>Palet içi koli adedi<input type="number" min="1" step="1" value="${r.cases_per_pallet??""}" oninput="updateImportField(${i},'cases_per_pallet',this.value)"></label>
      <label>Minimum sipariş adedi<input type="number" min="1" step="1" value="${r.min_order_qty??1}" oninput="updateImportField(${i},'min_order_qty',this.value)"></label>
      <label>Maksimum sipariş adedi<input type="number" min="1" step="1" value="${r.max_order_qty??""}" oninput="updateImportField(${i},'max_order_qty',this.value)"><small>Müşteri tarafında gösterilmez</small></label>
      <label>Menşei<input value="${escAttr(r.origin)}" oninput="updateImportField(${i},'origin',this.value)"></label>
      <label>Statiegeld (€)<input type="number" min="0" step="0.01" value="${r.statiegeld??0}" oninput="updateImportField(${i},'statiegeld',this.value)"><small>Yoksa 0</small></label>
      <label>Statiegeld tipi<select onchange="updateImportField(${i},'statiegeld_scope',this.value)"><option value="none" ${r.statiegeld_scope==="none"?"selected":""}>Yok</option><option value="both" ${r.statiegeld_scope==="both"?"selected":""}>Koli + Palet</option><option value="case" ${r.statiegeld_scope==="case"?"selected":""}>Sadece Koli</option><option value="pallet" ${r.statiegeld_scope==="pallet"?"selected":""}>Sadece Palet</option></select></label>
      <label class="import-check"><input type="checkbox" ${r.is_featured?"checked":""} onchange="updateImportField(${i},'is_featured',this.checked)"><span>Öne çıkan ürün</span></label>
    </div>
    <div class="import-price-preview">
      ${r.sale_type!=="pallet"?`<span>Koli fiyatı <b>${euro(casePrice)}</b></span>`:""}
      ${r.sale_type!=="case"?`<span>Palet fiyatı <b>${euro(palletPrice)}</b></span>`:""}
      <span>Satış: <b>${r.sale_type==="case"?"Sadece Koli":r.sale_type==="pallet"?"Sadece Palet":"Koli + Palet"}</b></span>
      <span>Statiegeld: <b>${r.statiegeld_scope==="none"?"Yok":r.statiegeld_scope==="case"?"Sadece Koli":r.statiegeld_scope==="pallet"?"Sadece Palet":"Koli + Palet"}</b></span>
      <small>Tek ürün fiyatı katalogda gösterilmez.</small>
    </div>
   </article>`;
 }).join("");
 renderImportSummary();
}
window.updateImportField=(idx,key,value)=>{
 const numeric=["unit_price","net_value","statiegeld"].includes(key);
 const integer=["units_per_case","cases_per_pallet","min_order_qty","max_order_qty"].includes(key);
 importRows[idx][key]=numeric?toNumber(value):integer?(String(value).trim()===""?null:toInt(value)):value;
 renderImportRows();
};

async function loadExistingProductMap(){
 const {data,error}=await sb.rpc("emigro_catalog_admin_products");
 if(error){console.warn(error);existingProducts=new Map();return}
 existingProducts=new Map((data||[]).map(p=>[String(p.barcode),p]));
}
async function loadDefaultImages(){
 try{
  const {data}=await sb.storage.from("emigro-product-images").list("defaults",{limit:100});
  for(const x of data||[]){
   const base=fileBase(x.name);
   if(base==="kutu"||base==="palet"){
     const {data:urlData}=sb.storage.from("emigro-product-images").getPublicUrl("defaults/"+x.name);
     defaultImageUrls[base]=urlData.publicUrl;
   }
  }
 }catch{}
}

async function parseProductExcel(file){
 const buf=await file.arrayBuffer();
 const wb=XLSX.read(buf,{type:"array"});
 const ws=wb.Sheets[wb.SheetNames[0]];
 const raw=XLSX.utils.sheet_to_json(ws,{defval:"",raw:false});
 if(!raw.length){notify("Excel dosyasında ürün satırı bulunamadı.");return}

 const normalizedRows=raw.map(obj=>{
   const n={};Object.entries(obj).forEach(([k,v])=>n[normalizeHeader(k)]=v);
   return n;
 });
 const labels=PRODUCT_HEADERS.map(h=>h.label);
 const first=normalizedRows[0]||{};
 const missingColumns=labels.filter(h=>!(h in first));
 if(missingColumns.length){
   notify("Excel şablonunda eksik sütun var: "+missingColumns.join(", ")+"\nÖnce 'Excel şablonunu indir' dosyasını kullanın.");
   return;
 }

 importRows=normalizedRows.map(n=>({
   product_name:String(n.urun_adi||"").trim(),
   barcode:cleanBarcode(n.barkod),
   brand:String(n.marka||"").trim(),
   category:String(n.kategori||"").trim(),
   sale_type:String(n.satis_tipi||"").trim().toLowerCase(),
   unit_price:toNumber(n.birim_fiyat),
   net_value:toNumber(n.net_deger),
   net_unit:String(n.net_birim||"").trim(),
   units_per_case:toInt(n.koli_ici_adet),
   cases_per_pallet:toInt(n.palet_ici_koli_adedi),
   min_order_qty:toInt(n.min_siparis_adedi)||1,
   max_order_qty:String(n.max_siparis_adedi||"").trim()===""?null:toInt(n.max_siparis_adedi),
   origin:String(n.mensei||"").trim(),
   statiegeld:toNumber(n.statiegeld),
   statiegeld_scope:String(n.statiegeld_tipi||"").trim().toLowerCase(),
   is_featured:toBool(n.one_cikan)
 }));
 await loadExistingProductMap();
 renderImportRows();
}

document.getElementById("productExcelInput").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{await parseProductExcel(file)}catch(err){notify("Excel okunamadı: "+(err?.message||err))}
};
document.getElementById("productImagesInput").onchange=async e=>{
 importImageFiles.clear();imageQualityWarnings.clear();
 const files=[...(e.target.files||[])];
 for(const file of files){
   const base=fileBase(file.name);importImageFiles.set(base,file);
   if(file.type.startsWith("image/")){
     try{
       const bmp=await createImageBitmap(file);
       if(bmp.width<600||bmp.height<600)imageQualityWarnings.set(base,`Görsel düşük çözünürlükte (${bmp.width}×${bmp.height}px). En az 600×600 önerilir.`);
       bmp.close?.();
     }catch{}
   }
 }
 renderImportRows();
};
document.getElementById("clearProductImport").onclick=()=>{
 importRows=[];importImageFiles.clear();imageQualityWarnings.clear();
 document.getElementById("productExcelInput").value="";
 document.getElementById("productImagesInput").value="";
 renderImportRows();
};

document.getElementById("downloadProductTemplate").onclick=()=>{
 const rows=[{
  urun_adi:"Örnek Ürün",
  barkod:"111232132131",
  marka:"Örnek Marka",
  kategori:"Grocery",
  satis_tipi:"both",
  birim_fiyat:1.25,
  net_deger:500,
  net_birim:"g",
  koli_ici_adet:12,
  palet_ici_koli_adedi:48,
  min_siparis_adedi:1,
  max_siparis_adedi:"",
  mensei:"Netherlands",
  statiegeld:0,
  statiegeld_tipi:"none",
  one_cikan:"hayir"
 }];
 const ws=XLSX.utils.json_to_sheet(rows,{header:PRODUCT_HEADERS.map(h=>h.label)});
 ws["!cols"]=[24,18,20,18,14,14,12,12,12,14,22,18,12,16,14].map(w=>({wch:w}));
 const info=XLSX.utils.aoa_to_sheet([
  ["EMIGRO TOPLU ÜRÜN YÜKLEME ŞABLONU"],
  ["Zorunlu sütunlar","urun_adi, barkod, marka, kategori, satis_tipi, birim_fiyat, net_deger, net_birim, koli_ici_adet, palet_ici_koli_adedi, min_siparis_adedi, max_siparis_adedi, mensei, statiegeld, statiegeld_tipi"],
  ["Barkod","Metin olarak girin. Ana görsel dosya adı barkod ile aynı olmalı."],
  ["Görsel 1","111232132131.jpg / png"],
  ["Görsel 2","111232132131-2.jpg / png; yoksa kutu görseli kullanılır"],
  ["Görsel 3","111232132131-3.jpg / png; yoksa palet görseli kullanılır"],
  ["Varsayılan görseller","kutu.jpg ve palet.jpg"],
  ["Kategori","Yalnızca: Soft Drinks, Juices, Sauces, Snacks, Frozen, Grocery, Dairy, Sweets, Non-Food"],
  ["Satış tipi","case = sadece koli, pallet = sadece palet, both = koli + palet"],
  ["Birim fiyat","Tek ürün fiyatıdır; sadece arka planda koli/palet hesabı için kullanılır, müşteriye gösterilmez."],
  ["Minimum / maksimum","min_siparis_adedi zorunlu; max_siparis_adedi boş bırakılabilir. Maksimum sınır müşteri ekranında gösterilmez."],
  ["Koli fiyatı","birim_fiyat × koli_ici_adet"],
  ["Palet fiyatı","birim_fiyat × koli_ici_adet × palet_ici_koli_adedi"],
  ["Statiegeld","Yoksa mutlaka 0 yazın."],
  ["Statiegeld tipi","none = yok, case = sadece koli, pallet = sadece palet, both = koli + palet"],
  ["one_cikan","evet/hayir"]
 ]);
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,ws,"Urunler");
 XLSX.utils.book_append_sheet(wb,info,"Aciklama");
 XLSX.writeFile(wb,"emigro-toplu-urun-sablonu.xlsx");
};

async function uploadImportImage(file,pathBase){
 if(!file)return null;
 const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
 const path=pathBase+"."+ext;
 const {error}=await sb.storage.from("emigro-product-images").upload(path,file,{upsert:true,contentType:file.type||undefined});
 if(error)throw error;
 const {data}=sb.storage.from("emigro-product-images").getPublicUrl(path);
 return data.publicUrl;
}
async function resolveDefaultImage(kind){
 const file=importImageFiles.get(kind);
 if(file){
   const url=await uploadImportImage(file,"defaults/"+kind);
   defaultImageUrls[kind]=url;return url;
 }
 return defaultImageUrls[kind]||null;
}


document.getElementById("downloadImportErrors").onclick=()=>{
 const rows=importRows.map((r,i)=>({
  satir:i+2,barkod:r.barcode||"",urun_adi:r.product_name||"",hatalar:rowErrors(r,i).join(" | "),
  gorsel_uyarisi:imageQualityWarnings.get(cleanBarcode(r.barcode).toLowerCase())||""
 })).filter(x=>x.hatalar||x.gorsel_uyarisi);
 if(!rows.length){notify("Hata veya görsel uyarısı bulunmuyor.");return}
 const ws=XLSX.utils.json_to_sheet(rows);
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Hatalar");
 XLSX.writeFile(wb,"emigro-urun-yukleme-hata-raporu.xlsx");
};

async function loadActivePricePeriod(){
 const {data,error}=await sb.from("emigro_catalog_price_periods").select("*").eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
 const label=document.getElementById("activePricePeriod");if(!label)return;
 if(error||!data){label.textContent="Aktif dönem bulunamadı.";return}
 label.textContent=`Aktif: ${data.name} · ${new Date(data.valid_from).toLocaleDateString("nl-NL")} — ${new Date(data.valid_to).toLocaleDateString("nl-NL")}`;
 document.getElementById("pricePeriodName").value=data.name||"";
 document.getElementById("pricePeriodFrom").value=data.valid_from||"";
 document.getElementById("pricePeriodTo").value=data.valid_to||"";
}
document.getElementById("savePricePeriod").onclick=async()=>{
 const name=document.getElementById("pricePeriodName").value.trim();
 const from=document.getElementById("pricePeriodFrom").value;
 const to=document.getElementById("pricePeriodTo").value;
 if(!from||!to){notify("Başlangıç ve bitiş tarihini girin.");return}
 if(!confirm("Yeni fiyat dönemi aktif edilecek. Bundan sonra kaydedilen/yüklenen ürün fiyatları bu döneme bağlanacak. Devam edilsin mi?"))return;
 const {error}=await sb.rpc("emigro_catalog_admin_set_price_period",{p_name:name,p_valid_from:from,p_valid_to:to});
 if(error){notify("Fiyat dönemi kaydedilemedi: "+error.message);return}
 await loadActivePricePeriod();notify("Yeni fiyat dönemi aktif edildi.");
};

document.getElementById("saveValidProducts").onclick=async()=>{
 const valid=importRows.map((r,i)=>({r,i,errors:rowErrors(r,i)})).filter(x=>!x.errors.length);
 const invalid=importRows.length-valid.length;
 if(!valid.length){notify("Sisteme eklenebilecek eksiksiz ürün yok. Kırmızı kartlardaki alanları tamamlayın.");return}
 if(!confirm(valid.length+" ürün sisteme eklenecek/güncellenecek."+ (invalid?" "+invalid+" eksik ürün eklenmeyecek.":"") +" Devam edilsin mi?"))return;

 const btn=document.getElementById("saveValidProducts");
 btn.disabled=true;btn.textContent="Ürünler yükleniyor…";
 let ok=0,failed=[];
 try{
   const defaultKutu=await resolveDefaultImage("kutu");
   const defaultPalet=await resolveDefaultImage("palet");

   for(const {r,i} of valid){
     try{
       const bc=cleanBarcode(r.barcode);
       const ex=existingProducts.get(bc)||{};
       const mainFile=importImageFiles.get(bc.toLowerCase());
       const secondFile=importImageFiles.get((bc+"-2").toLowerCase());
       const thirdFile=importImageFiles.get((bc+"-3").toLowerCase());

       const image1=mainFile?await uploadImportImage(mainFile,"products/"+bc):ex.image_1||null;
       const image2=secondFile?await uploadImportImage(secondFile,"products/"+bc+"-2"):(ex.image_2||defaultKutu||null);
       const image3=thirdFile?await uploadImportImage(thirdFile,"products/"+bc+"-3"):(ex.image_3||defaultPalet||null);

       const {error}=await sb.rpc("emigro_catalog_admin_upsert_product",{
        p_barcode:bc,
        p_product_name:r.product_name,
        p_brand:r.brand,
        p_category:r.category,
        p_unit_price:Number(r.unit_price),
        p_net_value:Number(r.net_value),
        p_net_unit:r.net_unit,
        p_units_per_case:Number(r.units_per_case),
        p_cases_per_pallet:Number(r.cases_per_pallet),
        p_origin:r.origin,
        p_statiegeld:Number(r.statiegeld||0),
        p_sale_type:r.sale_type,
        p_statiegeld_scope:r.statiegeld_scope,
        p_min_order_qty:Number(r.min_order_qty||1),
        p_max_order_qty:r.max_order_qty==null?null:Number(r.max_order_qty),
        p_image_1:image1,
        p_image_2:image2,
        p_image_3:image3,
        p_is_featured:!!r.is_featured
       });
       if(error)throw error;
       ok++;
     }catch(err){failed.push("Satır "+(i+2)+": "+(err?.message||err))}
   }
   await loadExistingProductMap();
   renderImportRows();
   notify(ok+" ürün başarıyla sisteme eklendi/güncellendi."+ (failed.length?"\n\nHatalar:\n"+failed.slice(0,10).join("\n"):""));
 }finally{
   btn.disabled=false;btn.textContent="Geçerli ürünleri sisteme ekle";
 }
};


async function loadAdminProducts(){
 const [{data:prods,error:pErr},{data:units,error:uErr}]=await Promise.all([
   sb.rpc("emigro_catalog_admin_products"),
   sb.from("emigro_catalog_unit_prices").select("product_id,unit_price")
 ]);
 if(pErr||uErr){console.warn(pErr||uErr);return}
 const um=new Map((units||[]).map(x=>[x.product_id,x.unit_price]));
 adminProducts=(prods||[]).map(p=>({...p,unit_price:Number(um.get(p.id)||0)}));
 renderAdminProducts();
}
function renderAdminProducts(){
 const root=document.getElementById("adminProductList");if(!root)return;
 const q=(document.getElementById("adminProductSearch")?.value||"").toLowerCase().trim();
 const list=adminProducts.filter(p=>!q||[p.product_name,p.brand,p.barcode,p.category].some(v=>String(v||"").toLowerCase().includes(q)));
 root.innerHTML=list.length?list.map(p=>`
  <article class="admin-product-card ${p.is_active?"":"inactive"}">
   <div class="admin-product-media">${p.image_1?'<img src="'+esc(p.image_1)+'" alt="">':'<span>Resim yok</span>'}</div>
   <div class="admin-product-edit">
    <div class="admin-product-title"><div><span>${esc(p.category)}</span><h3>${esc(p.brand)} ${esc(p.product_name)}</h3><small>Barkod: ${esc(p.barcode)}</small></div><b>${p.is_active?"Aktif":"Pasif"}</b></div>
    <div class="admin-product-fields">
      <label>Ürün adı<input id="pm-name-${p.id}" value="${escAttr(p.product_name)}"></label>
      <label>Marka<input id="pm-brand-${p.id}" value="${escAttr(p.brand)}"></label>
      <label>Kategori<select id="pm-cat-${p.id}">${SITE_CATEGORIES.map(x=>'<option value="'+x+'" '+(p.category===x?'selected':'')+'>'+x+'</option>').join("")}</select></label>
      <label>Satış tipi<select id="pm-sale-${p.id}"><option value="both" ${p.sale_type==="both"?"selected":""}>Koli + Palet</option><option value="case" ${p.sale_type==="case"?"selected":""}>Sadece Koli</option><option value="pallet" ${p.sale_type==="pallet"?"selected":""}>Sadece Palet</option></select></label>
      <label>Tek birim fiyatı (€)<input id="pm-unit-${p.id}" type="number" step="0.0001" value="${p.unit_price}"><small>Müşteriye gösterilmez</small></label>
      <label>Net değer<input id="pm-net-${p.id}" type="number" step="0.001" value="${p.net_value}"></label>
      <label>Net birim<input id="pm-netunit-${p.id}" value="${escAttr(p.net_unit)}"></label>
      <label>Koli içi<input id="pm-case-${p.id}" type="number" min="1" value="${p.units_per_case}"></label>
      <label>Palet içi koli<input id="pm-pallet-${p.id}" type="number" min="1" value="${p.cases_per_pallet}"></label>
      <label>Minimum talep<input id="pm-min-${p.id}" type="number" min="1" value="${p.min_order_qty||1}"></label>
      <label>Maksimum talep<input id="pm-max-${p.id}" type="number" min="1" value="${p.max_order_qty??""}"><small>Müşteri tarafında gösterilmez</small></label>
      <label>Menşei<input id="pm-origin-${p.id}" value="${escAttr(p.origin)}"></label>
      <label>Statiegeld (€)<input id="pm-stat-${p.id}" type="number" min="0" step="0.01" value="${p.statiegeld||0}"></label>
      <label>Statiegeld tipi<select id="pm-stscope-${p.id}"><option value="none" ${p.statiegeld_scope==="none"?"selected":""}>Yok</option><option value="both" ${p.statiegeld_scope==="both"?"selected":""}>Koli + Palet</option><option value="case" ${p.statiegeld_scope==="case"?"selected":""}>Sadece Koli</option><option value="pallet" ${p.statiegeld_scope==="pallet"?"selected":""}>Sadece Palet</option></select></label>
    </div>
    <div class="admin-product-actions"><button class="btn" onclick="saveAdminProduct('${p.id}')">Kaydet</button><button class="ghost" onclick="toggleAdminProduct('${p.id}',${!p.is_active})">${p.is_active?"Pasife al":"Aktifleştir"}</button><button class="ghost" onclick="showPriceHistory('${p.id}')">Fiyat geçmişi</button></div>
    <div id="price-history-${p.id}" class="price-history hidden"></div>
   </div>
  </article>`).join(""):'<div class="admin-loading">Ürün bulunamadı.</div>';
}
async function saveAdminProduct(id){
 const p=adminProducts.find(x=>x.id===id);if(!p)return;
 const get=s=>document.getElementById(s+"-"+id)?.value;
 const maxRaw=get("pm-max");
 const {error}=await sb.rpc("emigro_catalog_admin_upsert_product",{
  p_barcode:p.barcode,p_product_name:get("pm-name"),p_brand:get("pm-brand"),p_category:get("pm-cat"),
  p_unit_price:Number(get("pm-unit")),p_net_value:Number(get("pm-net")),p_net_unit:get("pm-netunit"),
  p_units_per_case:Number(get("pm-case")),p_cases_per_pallet:Number(get("pm-pallet")),p_origin:get("pm-origin"),
  p_statiegeld:Number(get("pm-stat")||0),p_sale_type:get("pm-sale"),p_statiegeld_scope:get("pm-stscope"),
  p_min_order_qty:Number(get("pm-min")||1),p_max_order_qty:String(maxRaw||"").trim()===""?null:Number(maxRaw),
  p_image_1:p.image_1,p_image_2:p.image_2,p_image_3:p.image_3,p_is_featured:!!p.is_featured
 });
 if(error){notify("Ürün kaydedilemedi: "+error.message);return}
 await loadAdminProducts();notify("Ürün güncellendi.");
}
window.saveAdminProduct=saveAdminProduct;
async function toggleAdminProduct(id,active){
 const {error}=await sb.rpc("emigro_catalog_admin_set_product_active",{p_product_id:id,p_active:active});
 if(error){notify("Ürün durumu değiştirilemedi: "+error.message);return}
 await loadAdminProducts();
}
window.toggleAdminProduct=toggleAdminProduct;
async function showPriceHistory(id){
 const root=document.getElementById("price-history-"+id);if(!root)return;
 root.classList.remove("hidden");root.innerHTML="Yükleniyor…";
 const {data,error}=await sb.from("emigro_catalog_price_history").select("*").eq("product_id",id).order("created_at",{ascending:false}).limit(12);
 if(error){root.textContent=error.message;return}
 root.innerHTML=(data||[]).map(x=>'<div><span>'+new Date(x.created_at).toLocaleDateString("nl-NL")+'</span><b>'+euro(x.case_price)+' / koli</b><b>'+euro(x.pallet_price)+' / palet</b></div>').join("")||"Geçmiş yok.";
}
window.showPriceHistory=showPriceHistory;

const orderStatusLabel=s=>({new:"Yeni",preparing:"Hazırlanıyor",ready:"Hazır",shipped:"Sevk edildi",completed:"Tamamlandı",cancelled:"İptal"}[s]||s);
async function loadOrders(){
 try{await sb.rpc("emigro_catalog_admin_sync_completed_orders")}catch{}
 const {data,error}=await sb.from("emigro_catalog_orders").select("*").order("created_at",{ascending:false});
 if(error){console.warn(error);return}
 orders=data||[];renderOrders();
}
function renderOrders(){
 const root=document.getElementById("orderList");if(!root)return;
 const filtered=orderFilter==="all"?orders:orders.filter(o=>o.status===orderFilter);
 const active=filtered.filter(o=>!["completed","cancelled"].includes(o.status));
 const finished=filtered.filter(o=>["completed","cancelled"].includes(o.status));

 const renderOrder=o=>{
  const p=profileMap[o.user_id]||{};
  const isFinished=["completed","cancelled"].includes(o.status);
  const shippingInfo=o.tracking_number
    ? `<div class="admin-shipping-summary"><span>Kargo takip</span><strong>${esc(o.tracking_number)}</strong>${o.shipped_at?`<small>Kargoya verildi: ${new Date(o.shipped_at).toLocaleString("nl-NL")}</small>`:""}</div>`
    : o.status==="shipped"
      ? `<div class="admin-shipping-summary shipped"><span>Durum</span><strong>Gönderildi</strong>${o.shipped_at?`<small>${new Date(o.shipped_at).toLocaleString("nl-NL")}</small>`:""}</div>`
      : "";

  return `<article class="quote-admin-card order-admin-card ${isFinished?"is-finished":""}">
    <div class="quote-admin-head"><div><span class="quote-status ${o.status}">${orderStatusLabel(o.status)}</span><h3>${esc(o.order_number||"Sipariş")}</h3><p>${esc(p.company_name||"")} · ${esc(p.contact_name||"")}</p></div><div><small>${new Date(o.created_at).toLocaleString("nl-NL")}</small><strong>${euro(o.total)}</strong></div></div>
    <div class="quote-admin-meta">
      <span>${(o.items||[]).length} ürün</span>
      <span>Talep teslim: ${o.requested_delivery_date?new Date(o.requested_delivery_date+"T12:00:00").toLocaleDateString("nl-NL"):"—"}</span>
      <span>Onaylı teslim: ${o.confirmed_delivery_date?new Date(o.confirmed_delivery_date+"T12:00:00").toLocaleDateString("nl-NL"):"—"}</span>
      ${o.completed_at?`<span>Tamamlandı: ${new Date(o.completed_at).toLocaleString("nl-NL")}</span>`:""}
    </div>
    ${shippingInfo}
    <div class="order-admin-controls">
      <select id="order-status-${o.id}" ${isFinished?"disabled":""}><option value="new" ${o.status==="new"?"selected":""}>Yeni</option><option value="preparing" ${o.status==="preparing"?"selected":""}>Hazırlanıyor</option><option value="ready" ${o.status==="ready"?"selected":""}>Hazır</option><option value="shipped" ${o.status==="shipped"?"selected":""}>Sevk edildi</option><option value="completed" ${o.status==="completed"?"selected":""}>Tamamlandı</option><option value="cancelled" ${o.status==="cancelled"?"selected":""}>İptal</option></select>
      <input id="order-date-${o.id}" type="date" value="${o.confirmed_delivery_date||""}" ${isFinished?"disabled":""}>
      <input id="order-note-${o.id}" placeholder="Admin notu" value="${escAttr(o.admin_note||"")}" ${isFinished?"disabled":""}>
      <input id="order-track-${o.id}" placeholder="Kargo takip numarası (opsiyonel)" value="${escAttr(o.tracking_number||"")}" ${isFinished?"disabled":""}>
      <input id="order-trackurl-${o.id}" placeholder="Takip linki (opsiyonel)" value="${escAttr(o.tracking_url||"")}" ${isFinished?"disabled":""}>
      ${!isFinished?`<div class="order-admin-action-row"><button class="btn" onclick="saveOrder('${o.id}')">Siparişi güncelle</button>${o.status!=="shipped"?`<button class="ghost ship-now-btn" onclick="markOrderShipped('${o.id}')">Gönderildi</button>`:""}</div>`:'<div class="finished-order-note">Bu sipariş biten siparişlere taşındı.</div>'}
    </div>
  </article>`;
 };

 if(!filtered.length){root.innerHTML='<div class="admin-loading">Sipariş bulunamadı.</div>';return}
 if(orderFilter!=="all"){
   root.innerHTML=filtered.map(renderOrder).join("");
   return;
 }
 root.innerHTML=`
   <section class="admin-order-group">
     <div class="admin-order-group-head"><div><span>AKTİF SİPARİŞLER</span><strong>${active.length}</strong></div><small>Hazırlık, sevkiyat ve teslimat sürecindekiler.</small></div>
     <div class="admin-order-group-list">${active.length?active.map(renderOrder).join(""):'<div class="admin-loading">Aktif sipariş yok.</div>'}</div>
   </section>
   <section class="admin-order-group finished-orders">
     <div class="admin-order-group-head"><div><span>BİTEN / ESKİ SİPARİŞLER</span><strong>${finished.length}</strong></div><small>Teslim alınan, teslim tarihi geçen veya iptal edilen siparişler.</small></div>
     <div class="admin-order-group-list">${finished.length?finished.map(renderOrder).join(""):'<div class="admin-loading">Henüz biten sipariş yok.</div>'}</div>
   </section>`;
}
async function saveOrder(id,forcedStatus=null){
 const status=forcedStatus||document.getElementById("order-status-"+id).value;
 const tracking=document.getElementById("order-track-"+id).value.trim();
 const trackingUrl=document.getElementById("order-trackurl-"+id).value.trim();
 if(trackingUrl&&!/^https?:\/\//i.test(trackingUrl)){
   notify("Takip linki http:// veya https:// ile başlamalı.","error");
   document.getElementById("order-trackurl-"+id).focus();
   return;
 }
 const {error}=await sb.rpc("emigro_catalog_admin_update_order",{
  p_order_id:id,p_status:status,
  p_confirmed_delivery_date:document.getElementById("order-date-"+id).value||null,
  p_admin_note:document.getElementById("order-note-"+id).value||"",
  p_tracking_number:tracking,
  p_tracking_url:trackingUrl
 });
 if(error){notify("Sipariş güncellenemedi: "+error.message,"error");return}
 await loadOrders();
 notify(status==="shipped"?"Sipariş gönderildi olarak işaretlendi.":"Sipariş bilgileri güncellendi.","success");
}
window.saveOrder=saveOrder;
async function markOrderShipped(id){
 const select=document.getElementById("order-status-"+id);
 if(select)select.value="shipped";
 await saveOrder(id,"shipped");
}
window.markOrderShipped=markOrderShipped;

document.getElementById("adminProductSearch").oninput=renderAdminProducts;
document.querySelectorAll("[data-ofilter]").forEach(b=>b.onclick=()=>{orderFilter=b.dataset.ofilter;document.querySelectorAll("[data-ofilter]").forEach(x=>x.classList.toggle("active",x===b));renderOrders()});

function setAdminMobileScreen(tab){
 document.body.classList.remove("admin-screen-members","admin-screen-quotes","admin-screen-products","admin-screen-productManager","admin-screen-orders");
 document.body.classList.add("admin-screen-"+tab);
 if(matchMedia("(max-width:700px)").matches)window.scrollTo({top:0,behavior:"smooth"});
}
async function activateAdminTab(b){
 const tab=b.dataset.adminTab;
 document.getElementById("membersPanel").classList.toggle("hidden",tab!=="members");
 document.getElementById("quotesPanel").classList.toggle("hidden",tab!=="quotes");
 document.getElementById("productsPanel").classList.toggle("hidden",tab!=="products");
 document.getElementById("productManagerPanel").classList.toggle("hidden",tab!=="productManager");
 document.getElementById("ordersPanel").classList.toggle("hidden",tab!=="orders");
 document.querySelectorAll("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x.dataset.adminTab===tab));
 if(matchMedia("(max-width:700px)").matches)setAdminMobileScreen(tab);
 if(tab==="products"){await loadDefaultImages();await loadExistingProductMap();renderImportRows()}
 if(tab==="productManager"){await loadAdminProducts()}
 if(tab==="orders"){await loadOrders()}
}
document.querySelectorAll("[data-admin-tab]").forEach(b=>b.onclick=()=>activateAdminTab(b));
if(matchMedia("(max-width:700px)").matches)setAdminMobileScreen("members");
document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{memberFilter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderMembers()});
document.querySelectorAll("[data-qfilter]").forEach(b=>b.onclick=()=>{quoteFilter=b.dataset.qfilter;document.querySelectorAll("[data-qfilter]").forEach(x=>x.classList.toggle("active",x===b));renderQuotes()});

function adminInviteMessage(){
 const link=document.getElementById("adminInviteLink")?.textContent||"";
 return `Emigro Cash & Carry olarak zakelijke müşterilerimize özel B2B platformumuza sizi davet ediyoruz.

Bu platform üzerinden size özel tekliflerimizi görebilir, hızlı ve kolay şekilde teklif/sipariş işlemlerinizi gerçekleştirebilirsiniz. Size bu yeni kanal üzerinden hizmet vermekten mutluluk duyarız.

Davet bağlantınız:
${link}

Emigro Cash & Carry`;
}
function openAdminInvitePanel(){
 if(!adminProfile?.referral_code){notify("Davet kodu oluşturulamadı. Sayfayı yenileyin.");return}
 const link=new URL("./?ref="+encodeURIComponent(adminProfile.referral_code),location.href).href;
 document.getElementById("adminInviteLink").textContent=link;
 document.getElementById("adminInviteCode").textContent="Davet kodu: "+adminProfile.referral_code;
 document.getElementById("adminInviteModal").classList.remove("hidden");
}
document.getElementById("openAdminInvite").onclick=openAdminInvitePanel;
document.getElementById("adminInviteCopy").onclick=async()=>{
 const link=document.getElementById("adminInviteLink").textContent;
 try{await navigator.clipboard.writeText(link);notify("Davet bağlantısı kopyalandı.");}
 catch{prompt("Davet bağlantısını kopyalayın:",link)}
};
document.getElementById("adminInviteEmail").onclick=()=>{
 const raw=document.getElementById("adminInviteEmails").value||"";
 const emails=raw.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
 const subject=encodeURIComponent("Emigro Cash & Carry B2B daveti");
 const body=encodeURIComponent(adminInviteMessage());
 const bcc=encodeURIComponent(emails.join(","));
 location.href=`mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
};
document.getElementById("adminInviteShare").onclick=async()=>{
 const link=document.getElementById("adminInviteLink").textContent;
 const text=adminInviteMessage();
 if(navigator.share){
   try{await navigator.share({title:"Emigro Cash & Carry B2B daveti",text,url:link});return}catch{}
 }
 try{await navigator.clipboard.writeText(text);notify("Davet metni kopyalandı. WhatsApp, SMS veya e-posta üzerinden toplu olarak paylaşabilirsiniz.");}
 catch{prompt("Davet metnini kopyalayın:",text)}
};

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).classList.add("hidden"));
function closeOfferModal(){document.getElementById("offerModal").classList.add("hidden");activeQuote=null}
document.getElementById("closeOfferBtn").onclick=closeOfferModal;
document.getElementById("offerModal").addEventListener("click",e=>{if(e.target.id==="offerModal")closeOfferModal()});
document.getElementById("refreshBtn").onclick=loadAll;
document.getElementById("adminLoginForm").onsubmit=async e=>{
 e.preventDefault();
 const msg=document.getElementById("adminLoginMessage");
 msg.textContent="Admin hesabı kontrol ediliyor...";
 const email=document.getElementById("adminEmail").value.trim();
 const password=document.getElementById("adminPassword").value;
 const {error}=await sb.auth.signInWithPassword({email,password});
 if(error){msg.textContent="Giriş başarısız: "+error.message;return}
 if(await guard()){msg.textContent="";await loadAll()}
};
document.getElementById("logoutAdmin").onclick=async()=>{
 await sb.auth.signOut();
 document.getElementById("adminShell").classList.add("hidden");
 document.getElementById("adminTopbar").classList.add("hidden");
 document.getElementById("adminLoginShell").classList.remove("hidden");
};

function setupAdminKeyboardAwareDock(){
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
setupAdminKeyboardAwareDock();

(async()=>{if(await guard())await loadAll()})();