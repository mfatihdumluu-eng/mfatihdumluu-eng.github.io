const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const fallbackSlides=[
{badge:"Aile içinde yakınlığa küçük bir alan açın",title:"Bir soru sor.",highlight:"Birbirinizi yeniden keşfedin.",description:"Yoğun günlerin içinde konuşmaya nereden başlayacağınızı düşünmeyin. Parently, yaşa uygun sohbet kartları ve küçük aile rutinleriyle size bir başlangıç verir.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Nasıl çalışır?",secondaryUrl:"#how",image:""},
{badge:"Her gün yeni bir konuşma",title:"Doğru sorularla",highlight:"çocuğunuzun dünyasına yaklaşın.",description:"Yaşa uygun sorular ve takip soruları, sohbeti doğal şekilde başlatmanıza yardımcı olur.",primaryLabel:"Kartları keşfet",primaryUrl:"#cards",secondaryLabel:"Özellikler",secondaryUrl:"#features",image:""},
{badge:"Küçük rutinler, güçlü bağlar",title:"Duygular, rutinler ve planlar",highlight:"tek bir aile alanında.",description:"Duygu takibi, ortak ajanda ve günlük aile rutinleriyle birlikte geçirilen zamanı daha görünür hale getirin.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Planlar",secondaryUrl:"#pricing",image:""}
];
let slides=fallbackSlides,siteConfig={slides:fallbackSlides,demoPng:""},index=0,timer=null,changing=false;
const preload=new Map();

function preloadImage(src){
  if(!src)return Promise.resolve();
  if(preload.has(src))return preload.get(src);
  const p=new Promise(resolve=>{const i=new Image();i.onload=i.onerror=resolve;i.src=src});
  preload.set(src,p);return p;
}
async function showSlide(n,instant=false){
  if(changing&&!instant)return;
  const next=(n+slides.length)%slides.length,s=slides[next]||fallbackSlides[next];
  changing=true;
  if(s.image)await preloadImage(s.image);
  const copy=q("#heroCopy"),art=q("#heroArt");
  if(!instant){copy?.classList.add("is-changing");art?.classList.add("is-changing");await new Promise(r=>setTimeout(r,130))}
  index=next;
  q("#heroBadge").textContent=s.badge||"";
  q("#heroTitle").textContent=s.title||"";
  q("#heroHighlight").textContent=s.highlight||"";
  q("#heroDescription").textContent=s.description||"";
  const totalTitle=((s.title||"")+" "+(s.highlight||"")).trim().length;
  copy?.classList.toggle("title-long",totalTitle>42&&totalTitle<=62);
  copy?.classList.toggle("title-xlong",totalTitle>62&&totalTitle<=84);
  copy?.classList.toggle("title-xxlong",totalTitle>84);
  const p=q("#heroPrimary");p.textContent=s.primaryLabel||"Uygulamaya Gir";p.href=s.primaryUrl||"/panel.html";
  const sec=q("#heroSecondary");sec.textContent=s.secondaryLabel||"Nasıl çalışır?";sec.href=s.secondaryUrl||"#how";
  const img=q("#heroSlideImage");
  if(s.image){
    if(img.src!==s.image) img.src=s.image;
    img.alt=s.highlight||s.title||"Parently";
    art.classList.add("has-image");
  }else{
    img.removeAttribute("src");
    img.alt="";
    art.classList.remove("has-image");
  }
  qa("#heroDots button").forEach((d,i)=>d.classList.toggle("active",i===index));
  requestAnimationFrame(()=>requestAnimationFrame(()=>{copy?.classList.remove("is-changing");art?.classList.remove("is-changing");changing=false}));
}
function restart(){clearInterval(timer);timer=setInterval(()=>showSlide(index+1),7000)}
function renderDots(){
  const host=q("#heroDots");
  if(!host)return;
  host.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Slide ${i+1}" class="${i===index?"active":""}"></button>`).join("");
  }
async function loadSite(){
  try{
    const r=await fetch("/api/site/home",{cache:"no-store"});
    if(r.ok){siteConfig=await r.json();if(Array.isArray(siteConfig.slides)&&siteConfig.slides.length)slides=siteConfig.slides}
  }catch{}
  renderDots();
  await Promise.all(slides.map(s=>preloadImage(s.image)));
  const demo=q("#demoPng"),empty=q("#pngEmpty"),stage=q(".demo-png-stage");
  if(siteConfig.demoPng){
    await preloadImage(siteConfig.demoPng);
    demo.src=siteConfig.demoPng;stage?.classList.add("has-image");if(empty)empty.hidden=true;
  }
  showSlide(0,true);restart();
}
q("#heroPrev")?.addEventListener("click",()=>{showSlide(index-1);restart()});
q("#heroNext")?.addEventListener("click",()=>{showSlide(index+1);restart()});
qa("#heroDots button").forEach((d,i)=>d.addEventListener("click",()=>{showSlide(i);restart()}));

const toggle=q("#menuToggle"),nav=q("#nav");
toggle?.addEventListener("click",()=>{const open=toggle.getAttribute("aria-expanded")!=="true";toggle.setAttribute("aria-expanded",String(open));nav.classList.toggle("open",open)});
qa('#nav a,a[href^="#"]').forEach(a=>a.addEventListener("click",e=>{
  const href=a.getAttribute("href"),target=href&&href.startsWith("#")?q(href):null;
  if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});history.replaceState(null,"",href)}
  nav?.classList.remove("open");toggle?.setAttribute("aria-expanded","false");
}));

const featureIntro=q("#featureIntro"),featureLabel=q("#featureLabel"),features=qa("#featureList li");
function activateFeature(el){
  features.forEach(x=>x.classList.toggle("active",x===el));
  if(featureIntro)featureIntro.textContent=el.dataset.copy||"";
  if(featureLabel)featureLabel.textContent=el.dataset.label||"";
}
features.forEach(el=>{
  el.addEventListener("mouseenter",()=>activateFeature(el));
  el.addEventListener("focus",()=>activateFeature(el));
});
q("#year").textContent=new Date().getFullYear();
document.addEventListener("visibilitychange",()=>document.hidden?clearInterval(timer):restart());
loadSite();
