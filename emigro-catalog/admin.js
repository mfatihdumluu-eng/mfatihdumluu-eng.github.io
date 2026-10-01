const SUPABASE_URL="https://hroarfuwpfsqilsijwpp.supabase.co";
const SUPABASE_KEY="sb_publishable_tAn6zZNaqMQW-BLXwXI30g_lmBUWENo";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let profiles=[],filter="all";

async function guard(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.replace("./index.html?auth=1&source=admin");return false}
 const {data:me}=await sb.from("emigro_catalog_profiles").select("*").eq("id",session.user.id).single();
 if(me?.role!=="admin"){
   document.querySelector(".admin-shell").innerHTML='<section class="admin-hero"><div class="eyebrow">EMIGRO B2B ADMIN</div><h1>Erişim yok</h1><p>Bu alan yalnızca Emigro admin kullanıcıları içindir.</p><a class="btn" href="./index.html">Kataloğa dön</a></section>';
   return false;
 }
 return true;
}
async function loadProfiles(){
 const {data,error}=await sb.from("emigro_catalog_profiles").select("*").order("created_at",{ascending:false});
 if(error){document.getElementById("adminList").innerHTML='<div class="admin-loading">Üyelikler yüklenemedi: '+error.message+'</div>';return}
 profiles=data||[];render();
}
function esc(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function statusLabel(s){return {pending:"Onay bekliyor",approved:"Onaylı",rejected:"Reddedildi",suspended:"Askıya alındı"}[s]||s}
function render(){
 const counts={all:profiles.length,pending:0,approved:0,rejected:0,suspended:0};profiles.forEach(p=>counts[p.status]=(counts[p.status]||0)+1);
 document.getElementById("adminStats").innerHTML=[
  ["Toplam",counts.all],["Bekleyen",counts.pending],["Onaylı",counts.approved],["Reddedilen",counts.rejected],["Askıda",counts.suspended]
 ].map(([l,n])=>'<div><span>'+l+'</span><strong>'+n+'</strong></div>').join("");
 const list=filter==="all"?profiles:profiles.filter(p=>p.status===filter);
 document.getElementById("adminList").innerHTML=list.length?list.map(p=>`
 <article class="member-card">
  <div class="member-card-head"><div><span class="status-pill ${p.status}">${statusLabel(p.status)}</span><h3>${esc(p.company_name||"Firma adı yok")}</h3><p>${esc(p.contact_name)} · ${esc(p.contact_role)}</p></div><small>${new Date(p.created_at).toLocaleDateString("nl-NL")}</small></div>
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
document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));render()});
document.getElementById("refreshBtn").onclick=loadProfiles;
document.getElementById("logoutAdmin").onclick=async()=>{await sb.auth.signOut();location.href="./index.html"};
(async()=>{if(await guard())await loadProfiles()})();