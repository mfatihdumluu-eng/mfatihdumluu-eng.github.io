const SUPABASE_URL="https://hroarfuwpfsqilsijwpp.supabase.co";
const SUPABASE_KEY="sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:"emigro-admin-auth",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let profiles=[],quotes=[],memberFilter="all",quoteFilter="all",activeQuote=null,profileMap={};

const euro=n=>new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(Number(n||0));
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const memberStatus=s=>({pending:"Onay bekliyor",approved:"Onaylı",rejected:"Reddedildi",suspended:"Askıya alındı"}[s]||s);
const quoteStatus=s=>({new:"Yeni",reviewing:"İnceleniyor",offered:"Teklif verildi",accepted:"Kabul edildi",declined:"Reddedildi",closed:"Kapalı"}[s]||s);

async function guard(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){
   document.getElementById("adminLoginShell").classList.remove("hidden");
   document.getElementById("adminShell").classList.add("hidden");
   document.getElementById("adminTopbar").classList.add("hidden");
   return false;
 }
 const {data:me,error}=await sb.from("emigro_catalog_profiles").select("*").eq("id",session.user.id).single();
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
 await Promise.all([loadProfiles(),loadQuotes()]);
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
  <div class="member-actions">
   <button class="approve" onclick="setStatus('${p.id}','approved')">Onayla</button>
   <button onclick="setStatus('${p.id}','pending')">Beklemeye al</button>
   <button class="reject" onclick="setStatus('${p.id}','rejected')">Reddet</button>
   <button class="suspend" onclick="setStatus('${p.id}','suspended')">Askıya al</button>
  </div>
 </article>`).join(""):'<div class="admin-loading">Bu durumda üye bulunmuyor.</div>';
}

async function setStatus(id,status){
 const {error}=await sb.rpc("emigro_catalog_admin_set_status",{target_user:id,new_status:status});
 if(error){alert("Durum güncellenemedi: "+error.message);return}
 await loadProfiles();
}
window.setStatus=setStatus;

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
 if(!(activeQuote.items||[]).length){alert("Teklifte en az bir ürün olmalı.");return false}
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
 if(error){alert("Teklif kaydedilemedi: "+error.message);return false}
 await loadQuotes();
 activeQuote=quotes.find(q=>q.id===activeQuote.id);
 document.getElementById("offerStatus").value=activeQuote.status;
 renderOfferProducts();
 updateOfferPreview();
 return true;
}
document.getElementById("saveOfferBtn").onclick=async()=>{if(await saveOffer())alert("Taslak kaydedildi.")};
document.getElementById("publishOfferBtn").onclick=async()=>{
 document.getElementById("offerStatus").value="offered";
 if(await saveOffer("offered"))alert("Teklif müşteriye yayınlandı. Müşteri hesabındaki Tekliflerim bölümünde görebilir.");
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
async function generateOfferPdfFile(){
 if(!activeQuote)return null;
 const v=currentOfferValues();
 const iframe=document.createElement("iframe");
 iframe.setAttribute("aria-hidden","true");
 iframe.style.position="fixed";
 iframe.style.left="0";
 iframe.style.top="0";
 iframe.style.width="794px";
 iframe.style.height="1123px";
 iframe.style.opacity="0.001";
 iframe.style.pointerEvents="none";
 iframe.style.zIndex="-9999";
 document.body.appendChild(iframe);
 const filename=(v.number||"Emigro-Offerte")+".pdf";
 try{
   const doc=iframe.contentDocument;
   doc.open();doc.write(offerPrintHtml());doc.close();
   await new Promise(resolve=>setTimeout(resolve,500));
   if(doc.fonts?.ready) await doc.fonts.ready;
   const imgs=[...doc.images];
   await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r})));
   const sheet=doc.querySelector(".sheet");
   if(!sheet)throw new Error("Teklif sayfası oluşturulamadı");
   const blob=await html2pdf().set({
     margin:0,
     filename,
     image:{type:"jpeg",quality:0.98},
     html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",logging:false},
     jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
     pagebreak:{mode:["avoid-all","css","legacy"]}
   }).from(sheet).outputPdf("blob");
   if(!blob||blob.size<1000)throw new Error("PDF içeriği boş oluştu");
   return new File([blob],filename,{type:"application/pdf"});
 } finally {
   iframe.remove();
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
   const shareData={
     title:`Emigro offerte ${v.number}`,
     text:`Beste ${p.contact_name||""},\n\nHierbij ontvangt u onze offerte ${v.number}.\nTotaal: ${euro(final)}\nVerzendkosten: ${euro(v.shipping)}\nGeldig t/m: ${v.validTo?new Date(v.validTo).toLocaleDateString("nl-NL"):"—"}\n\nMet vriendelijke groet,\nEmigro Cash & Carry`,
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
   alert("PDF hazırlanamadı: "+(err?.message||err));
 }finally{
   btn.disabled=false;btn.textContent="PDF ile e-posta gönder";
 }
};

document.querySelectorAll("[data-admin-tab]").forEach(b=>b.onclick=()=>{
 const quotesTab=b.dataset.adminTab==="quotes";
 document.getElementById("membersPanel").classList.toggle("hidden",quotesTab);
 document.getElementById("quotesPanel").classList.toggle("hidden",!quotesTab);
 document.querySelectorAll("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===b));
});
document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{memberFilter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderMembers()});
document.querySelectorAll("[data-qfilter]").forEach(b=>b.onclick=()=>{quoteFilter=b.dataset.qfilter;document.querySelectorAll("[data-qfilter]").forEach(x=>x.classList.toggle("active",x===b));renderQuotes()});
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

(async()=>{if(await guard())await loadAll()})();