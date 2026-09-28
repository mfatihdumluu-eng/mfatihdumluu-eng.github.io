(()=>{
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const FAMILY=()=>localStorage.getItem("parently_family")||"AILE2026";
const KEY="parently_language";
let state=null,currentCardId=null,busy=false;
const UI={
"Aile bağını güçlendir":"Aile bağını güçlendir","Ana Sayfa":"Ana Sayfa","Kartlar":"Kartlar","Ajanda":"Ajanda","Mesajlar":"Mesajlar","Raporlar":"Raporlar","Yönetim":"Yönetim",
"Ebeveyn":"Ebeveyn","Çocuk Modu":"Çocuk Modu","Kart Kütüphanesi":"Kart Kütüphanesi","Favoriler":"Favoriler","Tümü":"Tümü","Takip sorusu:":"Takip sorusu:",
"Rehber":"Rehber","Pekiştirme":"Pekiştirme","Ritüel":"Ritüel","Kaydet":"Kaydet","Tamamlandı":"Tamamlandı","Favoriye ekle":"Favoriye ekle","Favoride":"Favoride",
"Ajanda & Görevler":"Ajanda & Görevler","Görevler":"Görevler","Ritüeller":"Ritüeller","Aile mesajları":"Aile mesajları","Gönder":"Gönder","Raporlar & İçgörüler":"Raporlar & İçgörüler",
"YÖNETİM PANELİ":"YÖNETİM PANELİ","Parently içerik ve üyelik yönetimi":"Parently içerik ve üyelik yönetimi","İÇERİK":"İÇERİK","Yaş grubuna göre kartlar":"Yaş grubuna göre kartlar",
"+ Kart ekle":"+ Kart ekle","VERİ AKTARIMI":"VERİ AKTARIMI","CSV / JSON yükle":"CSV / JSON yükle","CSV kart dosyası":"CSV kart dosyası","CSV Dosyası Seç":"CSV Dosyası Seç",
"JSON veri dosyası":"JSON veri dosyası","JSON Dosyası Seç":"JSON Dosyası Seç","YAŞ GRUPLARI":"YAŞ GRUPLARI","İçerik grupları":"İçerik grupları","ÜYELİKLER":"ÜYELİKLER",
"Paket ve erişim matrisi":"Paket ve erişim matrisi","YENİ İÇERİK":"YENİ İÇERİK","Kart ekle":"Kart ekle","Yaş grubu":"Yaş grubu","Kategori":"Kategori","Emoji":"Emoji","Ana soru":"Ana soru",
"Takip sorusu":"Takip sorusu","Ebeveyn rehberi":"Ebeveyn rehberi","Pekiştirme cümlesi":"Pekiştirme cümlesi","Bağ cümlesi":"Bağ cümlesi","Zorluk":"Zorluk","İptal":"İptal","Kartı kaydet":"Kartı kaydet",
"2–5 yaş":"2–5 yaş","6–9 yaş":"6–9 yaş","10–13 yaş":"10–13 yaş","14–16 yaş":"14–16 yaş","1 · Kolay":"1 · Kolay","2 · Orta":"2 · Orta","3 · Derin":"3 · Derin",
"BUGÜN SENİN GÜNÜN":"BUGÜN SENİN GÜNÜN","Nasılım?":"Nasılım?","Duygumu seç":"Duygumu seç","Kart seç":"Kart seç","Birlikte konuşalım":"Birlikte konuşalım","Aileme yaz":"Aileme yaz",
"Herkese mesaj gönder":"Herkese mesaj gönder","Sakinleş":"Sakinleş","Kısa mola":"Kısa mola","GÖREVLERİM":"GÖREVLERİM","Bugün ne yapacağım?":"Bugün ne yapacağım?","BUGÜNKÜ DUYGUM":"BUGÜNKÜ DUYGUM",
"ÖDÜL HEDEFİM":"ÖDÜL HEDEFİM","EBEVEYN PANELİ":"EBEVEYN PANELİ","Bekleyen görev":"Bekleyen görev","Son duygu":"Son duygu","Toplam puan":"Toplam puan","Bağ kartları":"Bağ kartları",
"GÜNLÜK BAĞ":"GÜNLÜK BAĞ","Bugünün 3 dakikası":"Bugünün 3 dakikası","Kartı aç":"Kartı aç","BUGÜN":"BUGÜN","Görev ve rutin akışı":"Görev ve rutin akışı","Tüm ajanda":"Tüm ajanda",
"DUYGU":"DUYGU","Bugün nasıl gidiyor?":"Bugün nasıl gidiyor?"
};
const FLAGS={tr:"🇹🇷",nl:"🇳🇱",pl:"🇵🇱",so:"🇸🇴","ar-ma":"🇲🇦","ar-sy":"🇸🇾",darija:"🇲🇦"};
const PRESETS=[
  {code:"tr",name:"Türkçe",flag:"🇹🇷",direction:"ltr"},
  {code:"nl",name:"Nederlands",flag:"🇳🇱",direction:"ltr"},
  {code:"ar-MA",name:"الدارجة المغربية",label:"Fas / Darija",flag:"🇲🇦",direction:"rtl"},
  {code:"ar-SY",name:"العربية السورية",label:"Suriye Arapçası",flag:"🇸🇾",direction:"rtl"},
  {code:"so",name:"Soomaali",flag:"🇸🇴",direction:"ltr"},
  {code:"pl",name:"Polski",flag:"🇵🇱",direction:"ltr"}
];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const flag=(c,m={})=>m.flag||FLAGS[String(c||"").toLowerCase()]||"🌐";
const direction=(c,m={})=>m.direction||(/^ar(?:-|$)/i.test(String(c||""))||String(c||"").toLowerCase()==="darija"?"rtl":"ltr");
async function api(url,opt={}){const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text());return r.json()}
const code=()=>localStorage.getItem(KEY)||"tr";
const packs=()=>state?.languagePacks||{};
function pack(){const c=code();if(c.toLowerCase()==="tr")return null;return packs()[c]||Object.values(packs()).find(p=>String(p?.meta?.code||"").toLowerCase()===c.toLowerCase())||null}
function metas(){
  const loaded=Object.values(packs()).map(p=>p?.meta).filter(Boolean);
  return PRESETS.map(p=>{
    const hit=loaded.find(m=>String(m.code).toLowerCase()===String(p.code).toLowerCase());
    return hit?{...p,...hit,loaded:true}:{...p,loaded:p.code==="tr"};
  });
}
function template(meta={code:"tr",name:"Türkçe",flag:"🇹🇷",direction:"ltr"}){return {schema:"parently-language-pack",version:1,meta:{source:"tr",...meta},instructions:{a:"id ve ageGroup alanlarını değiştirmeyin.",b:"ui değerlerini ve cards içindeki metin alanlarını çevirin.",c:"Darija/Arapça için direction rtl kalmalıdır."},ui:{...UI},cards:(state?.cards||[]).map(c=>({id:c.id,ageGroup:c.ageGroup,category:c.category,emoji:c.emoji,question:c.question,followUp:c.followUp,parentGuide:c.parentGuide,positiveReinforcement:c.positiveReinforcement,connectionPhrase:c.connectionPhrase}))}}
function download(name,obj){const b=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function setDir(p){const m=p?.meta||{code:"tr",direction:"ltr"},d=direction(m.code,m);document.documentElement.lang=m.code||"tr";document.documentElement.dir=d;document.body.classList.toggle("rtl-mode",d==="rtl")}
function translateNodes(root,map){if(!root||!map)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),arr=[];while(w.nextNode())arr.push(w.currentNode);for(const n of arr){const raw=n.nodeValue,t=raw.trim();if(!t||!Object.prototype.hasOwnProperty.call(map,t)||map[t]===t)continue;n.nodeValue=(raw.match(/^\s*/)?.[0]||"")+map[t]+(raw.match(/\s*$/)?.[0]||"")}$$("input[placeholder],textarea[placeholder]").forEach(el=>{const p=el.getAttribute("placeholder");if(map[p])el.setAttribute("placeholder",map[p])})}
function translateCards(p){if(!p?.cards)return;const by=new Map(p.cards.map(c=>[c.id,c]));$$("[data-open-card]").forEach(el=>{const c=by.get(el.dataset.openCard);if(!c)return;const box=el.closest(".card-tile")||el,b=box.querySelector(".badge"),h=box.querySelector("h3");if(b&&c.category)b.textContent=c.category;if(h&&c.question)h.textContent=c.question});if(currentCardId&&!$("#modal")?.classList.contains("hidden")){const c=by.get(currentCardId),body=$("#modalBody");if(c&&body){const b=body.querySelector(".badge"),h=body.querySelector("h2"),ps=[...body.querySelectorAll("p")],tab=body.querySelector("#tabText");if(b&&c.category)b.textContent=c.category;if(h&&c.question)h.textContent=(c.emoji||"💬")+" "+c.question;if(ps[0]&&c.followUp)ps[0].innerHTML="<b>"+esc(p.ui?.["Takip sorusu:"]||"Takip sorusu:")+"</b> "+esc(c.followUp);if(tab&&c.parentGuide)tab.textContent=c.parentGuide}}}
function apply(){if(busy)return;busy=true;try{const p=pack();setDir(p);if(p){translateNodes($("#app"),p.ui||{});translateNodes($("#modal"),p.ui||{});translateCards(p)}}finally{busy=false}}
function ensureButton(){let b=$("#languageBtn");if(!b){b=document.createElement("button");b.id="languageBtn";b.className="language-btn";const a=$(".header-actions");if(a)a.insertBefore(b,$("#demoBtn")||a.firstChild)}if(!b)return;const c=code(),m=metas().find(x=>String(x.code).toLowerCase()===c.toLowerCase())||metas()[0];const label=flag(m.code,m)+" "+String(m.code).toUpperCase();if(b.textContent!==label)b.textContent=label;b.onclick=openMenu}
function openMenu(){
  const m=$("#modal"),body=$("#modalBody");if(!m||!body)return;
  body.innerHTML='<h2>🌐 Dil seç</h2><p class="muted">Yüklü olan diller aktif kullanılabilir. Diğerleri için Yönetim bölümünden JSON şablonunu indirip çevirerek yükleyin.</p><div class="language-picker">'+metas().map(x=>'<button class="language-choice '+(String(code()).toLowerCase()===String(x.code).toLowerCase()?"active":"")+' '+(!x.loaded?"disabled":"")+'" '+(x.loaded?'data-i18n-lang="'+esc(x.code)+'"':'disabled')+'><span>'+flag(x.code,x)+'</span><div><b>'+esc(x.label||x.name||x.code)+'</b><small>'+esc(String(x.code).toUpperCase())+(x.loaded?' · Hazır':' · JSON bekliyor')+'</small></div></button>').join("")+'</div>';
  m.classList.remove("hidden");
}
function injectAdmin(){
  const v=$("#view");if(!state||!v||!v.textContent.includes("YÖNETİM PANELİ")||$(".language-admin-section"))return;
  const list=metas();
  const section=document.createElement("section");section.className="card admin-panel section language-admin-section";
  section.innerHTML=
    '<div class="admin-panel-head"><div><span class="eyebrow">DİLLER & ÇEVİRİ</span><h2>Dil paketleri</h2></div><label class="language-upload-btn">Çeviri JSON yükle<input id="languageJsonIn" type="file" accept=".json,application/json" hidden></label></div>'+
    '<p class="muted">Bir dilin JSON şablonunu indirin, yalnızca metinleri çevirin ve geri yükleyin. Kart ID ve yaş gruplarını değiştirmeyin.</p>'+
    '<div class="language-template-grid">'+list.map(x=>'<div class="language-template-card '+(x.loaded?"loaded":"")+'"><div class="language-template-head"><span>'+flag(x.code,x)+'</span><div><b>'+esc(x.label||x.name||x.code)+'</b><small>'+esc(String(x.code).toUpperCase())+' · '+(x.loaded?"Hazır":"JSON bekliyor")+'</small></div></div><button class="secondary" data-download-lang="'+esc(x.code)+'">'+(x.code==="tr"?"Temel JSON indir":"JSON şablonu indir")+'</button></div>').join("")+'</div>'+
    '<div id="languageImportStatus"></div>';
  const memberships=[...v.querySelectorAll("section")].find(x=>x.textContent.includes("ÜYELİKLER"));
  if(memberships)memberships.before(section);else v.appendChild(section);
  $("#languageJsonIn").onchange=e=>preview(e.target.files?.[0]);
  $$("[data-download-lang]").forEach(b=>b.onclick=()=>{
    const p=PRESETS.find(x=>String(x.code).toLowerCase()===String(b.dataset.downloadLang).toLowerCase());
    if(!p)return;
    const fn="parently-language-"+String(p.code).replace(/[^a-z0-9-]/gi,"-")+".json";
    download(fn,template(p));
  });
}
function preview(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(p.schema!=="parently-language-pack"||!p.meta?.code||!p.meta?.name||!Array.isArray(p.cards))throw new Error();if(String(p.meta.code).toLowerCase()==="tr")throw new Error("tr");const n=p.cards.filter(x=>state.cards.some(c=>c.id===x.id)).length,s=$("#languageImportStatus");s._pack=p;s.innerHTML='<div class="upload-preview"><div class="upload-preview-head"><div><b>'+flag(p.meta.code,p.meta)+' '+esc(p.meta.name)+'</b><small>'+n+' / '+state.cards.length+' kart eşleşti · '+direction(p.meta.code,p.meta).toUpperCase()+'</small></div><span class="file-type">'+esc(String(p.meta.code).toUpperCase())+'</span></div><div class="upload-actions"><button id="cancelLangImport" class="secondary">İptal</button><button id="confirmLangImport" class="primary">Dil paketini yükle</button></div></div>'}catch(e){alert(e.message==="tr"?"Türkçe temel paket yüklenmez. Hedef dil kodunu değiştirin.":"Geçersiz Parently dil JSON dosyası.")}};r.readAsText(file)}
async function savePack(p){let c=String(p.meta.code).trim();p.meta.code=/^ar-ma$/i.test(c)?"ar-MA":c;p.meta.flag=flag(p.meta.code,p.meta);p.meta.direction=direction(p.meta.code,p.meta);state.languagePacks||={};state.languagePacks[p.meta.code]=p;const payload=JSON.parse(JSON.stringify(state));delete payload.mode;delete payload.activeProfileId;await api("/api/state/"+encodeURIComponent(FAMILY()),{method:"PUT",body:JSON.stringify(payload)});localStorage.setItem(KEY,p.meta.code);location.reload()}
document.addEventListener("click",e=>{const c=e.target.closest("[data-open-card]");if(c)currentCardId=c.dataset.openCard;const l=e.target.closest("[data-i18n-lang]");if(l){localStorage.setItem(KEY,l.dataset.i18nLang);location.reload();return}if(e.target.closest("#cancelLangImport")){const s=$("#languageImportStatus");if(s)s.innerHTML="";return}if(e.target.closest("#confirmLangImport")){const s=$("#languageImportStatus");if(s?._pack)savePack(s._pack).catch(()=>alert("Dil paketi kaydedilemedi."));return}});
async function boot(){try{state=await api("/api/state/"+encodeURIComponent(FAMILY()));state.languagePacks||={};ensureButton();apply();injectAdmin();setInterval(()=>{try{ensureButton();injectAdmin();apply()}catch(e){console.warn("i18n tick skipped",e)}},500)}catch(e){console.warn("Parently i18n disabled",e)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,300));else setTimeout(boot,300);
})();