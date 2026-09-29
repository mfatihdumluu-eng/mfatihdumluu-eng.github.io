const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];

const SUPPORTED=["tr","nl","ar-MA","ar-SY","so","pl"];
function detectLanguage(){
  const saved=localStorage.getItem("parently_language");
  if(saved&&SUPPORTED.some(x=>x.toLowerCase()===saved.toLowerCase()))return SUPPORTED.find(x=>x.toLowerCase()===saved.toLowerCase());
  const list=[...(navigator.languages||[]),navigator.language||""].filter(Boolean);
  for(const raw of list){
    const l=String(raw).toLowerCase();
    if(l.startsWith("tr"))return"tr";
    if(l.startsWith("nl"))return"nl";
    if(l.startsWith("pl"))return"pl";
    if(l.startsWith("so"))return"so";
    if(l==="ary"||l.startsWith("ar-ma"))return"ar-MA";
    if(l.startsWith("ar-sy")||l.startsWith("ar"))return"ar-SY";
  }
  return"tr";
}
const siteLang=detectLanguage();
document.documentElement.lang=siteLang;
document.documentElement.dir=/^ar/i.test(siteLang)?"rtl":"ltr";

const fallbackSlides=[
{badge:"Aile içinde yakınlığa küçük bir alan açın",title:"Bir soru sor.",highlight:"Birbirinizi yeniden keşfedin.",description:"Yoğun günlerin içinde konuşmaya nereden başlayacağınızı düşünmeyin. Parently, yaşa uygun sohbet kartları ve küçük aile rutinleriyle size bir başlangıç verir.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Nasıl çalışır?",secondaryUrl:"#how",image:""}
];
const fallbackVisuals=[
{kicker:"BUGÜNÜN SOHBETİ",title:"Bugün seni en çok ne gülümsetti?",pill:"Birlikte konuşalım",foot:"Bir soruyla başlayın",noteKicker:"KÜÇÜK BİR RUTİN",note:"Akşam yemeğinde herkes bir şey anlatsın.",theme:"conversation"},
{kicker:"SOHBET KARTLARI",title:"Bugün birlikte yapmayı en çok ne isterdin?",pill:"Kartı aç",foot:"Merakla dinleyin",noteKicker:"KÜÇÜK BİR AN",note:"Herkes gününden bir güzel an paylaşsın.",theme:"cards"},
{kicker:"AİLE AJANDASI",title:"Bu hafta birlikte neye zaman ayıralım?",pill:"Plan oluşturalım",foot:"Birlikte karar verin",noteKicker:"ORTAK RUTİN",note:"Haftada bir aile zamanı seçin ve ajandaya ekleyin.",theme:"agenda"}
];

let siteConfig={slides:fallbackSlides},slides=fallbackSlides,index=0,timer=null,changing=false;
const preload=new Map();
function preloadImage(src){
  if(!src)return Promise.resolve();
  if(preload.has(src))return preload.get(src);
  const p=new Promise(resolve=>{const i=new Image();i.onload=i.onerror=resolve;i.src=src});
  preload.set(src,p);return p;
}
function setText(sel,value){const el=q(sel);if(el&&value!==undefined&&value!==null)el.textContent=value}
function safeIcon(value,fallback){
  const v=String(value??"").trim();
  if(!v||v.length>4||/[A-Za-zÀ-žĞğİıŞşÇçÖöÜü]{2,}/.test(v))return fallback;
  return v;
}
function setNavigation(config){
  const n=config.navigation||{};
  setText("#navHow",n.how);setText("#navCards",n.cards);setText("#navFeatures",n.features);setText("#navPricing",n.pricing);setText("#navContact",n.contact);setText("#navAppButton",n.app);
}
function setBrand(config){
  const b=config.branding||{};
  setText("#brandName",b.name||"Parently");setText("#brandTagline",b.tagline||"");
  qa(".footer-brand .brand-copy strong").forEach(el=>el.textContent=b.name||"Parently");
  qa(".footer-brand .brand-copy small").forEach(el=>el.textContent=b.tagline||"");
  const img=q("#brandLogoImage"),mark=q("#brandMark");
  if(img&&b.logoImage){img.src=b.logoImage;img.hidden=false;if(mark)mark.hidden=true}
  else{if(img){img.removeAttribute("src");img.hidden=true}if(mark)mark.hidden=false}
}
function applySections(config){
  const s=config.sections||{};
  setText("#stripTitle",s.strip?.title);setText("#stripMeta",s.strip?.meta);

  setText("#howEyebrow",s.how?.eyebrow);setText("#howTitle",s.how?.title);setText("#howDescription",s.how?.description);
  setText("#howNoteLabel",s.how?.noteLabel);setText("#howNoteText",s.how?.noteText);
  qa(".how-form").forEach((el,i)=>{const d=s.how?.steps?.[i];if(!d)return;const icon=el.querySelector(".form-icon"),meta=el.querySelector(".form-meta small"),h=el.querySelector("h3"),p=el.querySelector("p");if(icon)icon.textContent=safeIcon(d.icon,["✦","◌","◷"][i]||"✦");if(meta)meta.textContent=d.label||"";if(h)h.textContent=d.title||"";if(p)p.textContent=d.description||""});

  setText("#cardsEyebrow",s.cards?.eyebrow);setText("#cardsTitle",s.cards?.title);setText("#cardsDescription",s.cards?.description);
  setText("#pngEmptyTitle",s.cards?.emptyTitle);setText("#pngEmptyDescription",s.cards?.emptyDescription);

  setText("#featuresEyebrow",s.features?.eyebrow);setText("#featuresTitle",s.features?.title);setText("#featureIntro",s.features?.description);
  const items=s.features?.items||[];
  qa("#featureList li").forEach((el,i)=>{const d=items[i];if(!d)return;const sym=el.querySelector(".symbol"),b=el.querySelector("b"),sp=el.querySelector("div span");if(sym)sym.textContent=safeIcon(d.symbol,["✳","◷","▤"][i]||"✳");if(b)b.textContent=d.title||"";if(sp)sp.textContent=d.description||"";el.dataset.label=d.label||"";el.dataset.copy=d.copy||"";el.dataset.image=d.image||""});
  if(items[0]){setText("#featureLabel",items[0].label);setText("#featureIntro",items[0].copy||s.features?.description)}

  setText("#pricingEyebrow",s.pricing?.eyebrow);setText("#pricingTitle",s.pricing?.title);setText("#pricingDescription",s.pricing?.description);
  setText("#pricingNoteLabel",s.pricing?.noteLabel);setText("#pricingNoteText",s.pricing?.noteText);
  qa("#pricing .plan-organic").forEach((el,i)=>{const d=s.pricing?.plans?.[i];if(!d)return;const icon=el.querySelector(".plan-card-icon"),tag=el.querySelector(".plan-tag"),h=el.querySelector("h3"),price=el.querySelector(".price"),p=el.querySelector("p"),ul=el.querySelector("ul"),a=el.querySelector(".plan-action");if(icon)icon.textContent=safeIcon(d.icon,["✦","♡","◎"][i]||"✦");if(tag)tag.textContent=d.tag||"";if(h)h.textContent=d.name||"";if(price)price.textContent=d.price||"";if(p)p.textContent=d.description||"";if(ul)ul.innerHTML=(d.features||[]).map(x=>"<li>"+String(x).replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]))+"</li>").join("");if(a){a.firstChild.textContent=(d.button||"")+" ";a.href=d.url||"#contact"}});

  setText("#closingEyebrow",s.closing?.eyebrow);setText("#closingTitle",s.closing?.title);setText("#closingDescription",s.closing?.description);
  const cb=q("#closingButton");if(cb){cb.textContent=s.closing?.button||"Uygulamaya Gir";cb.href=s.closing?.url||"/panel.html"}
  setText("#footerDescription",s.footer?.description);
}
function setStoryVisual(src){
  const box=q("#storyPhoto"),story=q("#storyImage"),ph=q("#storyPlaceholder");
  if(!box)return;
  if(src){
    box.style.backgroundImage='url('+JSON.stringify(src)+')';
    box.style.backgroundSize="cover";
    box.style.backgroundPosition="center";
    box.classList.add("has-hover-image");
    if(story){story.removeAttribute("src");story.hidden=true}
    if(ph)ph.hidden=true;
  }else{
    box.style.backgroundImage="";
    box.classList.remove("has-hover-image");
    if(story){story.removeAttribute("src");story.hidden=true}
    if(ph)ph.hidden=false;
  }
}
function applyMedia(config){
  const demo=q("#demoPng"),stage=q(".demo-png-stage"),empty=q("#pngEmpty");
  if(config.demoPng){demo.src=config.demoPng;stage?.classList.add("has-image");if(empty)empty.hidden=true}else{demo?.removeAttribute("src");stage?.classList.remove("has-image");if(empty)empty.hidden=false}
  setStoryVisual(config.storyImage||"");
}
function renderDots(){
  const host=q("#heroDots");if(!host)return;
  host.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Slide ${i+1}" class="${i===index?"active":""}"></button>`).join("");
  qa("#heroDots button").forEach((d,i)=>d.addEventListener("click",()=>{showSlide(i);restart()}));
}
async function showSlide(n,instant=false){
  if(changing&&!instant)return;
  const next=(n+slides.length)%slides.length,s=slides[next]||fallbackSlides[0];
  changing=true;if(s.image)await preloadImage(s.image);
  const copy=q("#heroCopy"),art=q("#heroArt");
  if(!instant){copy?.classList.add("is-changing");art?.classList.add("is-changing");await new Promise(r=>setTimeout(r,130))}
  index=next;
  setText("#heroBadge",s.badge||"");setText("#heroTitle",s.title||"");setText("#heroHighlight",s.highlight||"");setText("#heroDescription",s.description||"");
  const total=((s.title||"")+" "+(s.highlight||"")).trim().length;
  copy?.classList.toggle("title-long",total>42&&total<=62);copy?.classList.toggle("title-xlong",total>62&&total<=84);copy?.classList.toggle("title-xxlong",total>84);
  const p=q("#heroPrimary");if(p){p.textContent=s.primaryLabel||"";p.href=s.primaryUrl||"/panel.html"}
  const sec=q("#heroSecondary");if(sec){sec.textContent=s.secondaryLabel||"";sec.href=s.secondaryUrl||"#how"}
  const img=q("#heroSlideImage");
  if(s.image){
    const nextSrc=String(s.image);
    if(img.getAttribute("src")!==nextSrc)img.setAttribute("src",nextSrc);
    img.alt=s.highlight||s.title||"Parently";
    img.dataset.slideId=s.id||String(index);
    art.classList.add("has-image");
    art.classList.remove("theme-conversation","theme-cards","theme-agenda");
  }
  else{
    img.removeAttribute("src");img.alt="";art.classList.remove("has-image");
    const fv=fallbackVisuals[index%fallbackVisuals.length];
    setText("#fallbackKicker",fv.kicker);setText("#fallbackTitle",fv.title);setText("#fallbackPill",fv.pill);setText("#fallbackFoot",fv.foot);setText("#fallbackNoteKicker",fv.noteKicker);setText("#fallbackNote",fv.note);
    art.classList.remove("theme-conversation","theme-cards","theme-agenda");art.classList.add("theme-"+fv.theme);
  }
  qa("#heroDots button").forEach((d,i)=>d.classList.toggle("active",i===index));
  requestAnimationFrame(()=>requestAnimationFrame(()=>{copy?.classList.remove("is-changing");art?.classList.remove("is-changing");changing=false}));
}
function restart(){clearInterval(timer);timer=setInterval(()=>showSlide(index+1),7000)}
async function loadSite(){
  try{
    const r=await fetch("/api/site/home?lang="+encodeURIComponent(siteLang),{cache:"no-store"});
    if(r.ok){siteConfig=await r.json();if(Array.isArray(siteConfig.slides)&&siteConfig.slides.length)slides=siteConfig.slides}
  }catch{}
  setBrand(siteConfig);setNavigation(siteConfig);applySections(siteConfig);applyMedia(siteConfig);renderDots();
  const featureImgs=(siteConfig.sections?.features?.items||[]).map(x=>x.image).filter(Boolean);
  await Promise.all([...(slides||[]).map(s=>preloadImage(s.image)),...featureImgs.map(preloadImage),preloadImage(siteConfig.demoPng),preloadImage(siteConfig.storyImage),preloadImage(siteConfig.branding?.logoImage)]);
  if(features[0])activateFeature(features[0]);
  showSlide(0,true);restart();
}
q("#heroPrev")?.addEventListener("click",()=>{showSlide(index-1);restart()});
q("#heroNext")?.addEventListener("click",()=>{showSlide(index+1);restart()});

const toggle=q("#menuToggle"),nav=q("#nav");
toggle?.addEventListener("click",()=>{const open=toggle.getAttribute("aria-expanded")!=="true";toggle.setAttribute("aria-expanded",String(open));nav.classList.toggle("open",open)});
qa('#nav a,a[href^="#"]').forEach(a=>a.addEventListener("click",e=>{const href=a.getAttribute("href"),target=href&&href.startsWith("#")?q(href):null;if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});history.replaceState(null,"",href)}nav?.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}));

const featureIntro=q("#featureIntro"),featureLabel=q("#featureLabel"),features=qa("#featureList li");
function activateFeature(el){
  features.forEach(x=>x.classList.toggle("active",x===el));
  if(featureIntro)featureIntro.textContent=el.dataset.copy||"";
  if(featureLabel)featureLabel.textContent=el.dataset.label||"";
  const src=el.dataset.image||siteConfig.storyImage||"";
  setStoryVisual(src);
}
features.forEach(el=>{el.addEventListener("mouseenter",()=>activateFeature(el));el.addEventListener("focus",()=>activateFeature(el))});
q("#year").textContent=new Date().getFullYear();
document.addEventListener("visibilitychange",()=>document.hidden?clearInterval(timer):restart());
loadSite();
