const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const fallbackSlides=[
{badge:"♡ Daha güçlü aile bağları için",title:"Ailenizle daha fazla anlamlı zaman, daha",highlight:"güçlü yarınlar.",description:"Parently, ailelerin birlikte kaliteli zaman geçirmesini, duygularını paylaşmasını ve daha güçlü bağlar kurmasını destekleyen modern bir aile uygulamasıdır.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Tanıtımı Keşfet",secondaryUrl:"#features",image:""},
{badge:"💬 Her gün yeni bir konuşma",title:"Doğru sorularla çocuğunuzun dünyasına",highlight:"daha yakından bakın.",description:"Yaşa uygun kartlar ve takip soruları, aile içinde doğal ve anlamlı sohbetler başlatmanıza yardımcı olur.",primaryLabel:"Kartları Keşfet",primaryUrl:"/panel.html",secondaryLabel:"Nasıl Çalışır?",secondaryUrl:"#features",image:""},
{badge:"🌿 Küçük rutinler, güçlü bağlar",title:"Duygular, rutinler ve aile zamanı",highlight:"tek yerde.",description:"Duygu takibi, aile ajandası ve günlük küçük görevlerle birlikte geçirilen zamanı daha görünür hale getirin.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Fiyatlandırma",secondaryUrl:"#pricing",image:""}
];
let slides=fallbackSlides,index=0,timer=null,changing=false;
const preloadCache=new Map();

function preloadImage(src){
  if(!src)return Promise.resolve();
  if(preloadCache.has(src))return preloadCache.get(src);
  const p=new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve();
    img.onerror=()=>resolve();
    img.src=src;
  });
  preloadCache.set(src,p);
  return p;
}

async function showSlide(n,instant=false){
  if(changing&&!instant)return;
  const next=(n+slides.length)%slides.length;
  const s=slides[next]||fallbackSlides[next];
  changing=true;
  if(s.image)await preloadImage(s.image);

  const copy=q(".hero-copy"),show=q("#heroShowcase");
  if(!instant){copy?.classList.add("is-changing");show?.classList.add("is-changing");await new Promise(r=>setTimeout(r,140));}

  index=next;
  q("#heroBadge") && (q("#heroBadge").textContent=s.badge||"");
  q("#heroTitle") && (q("#heroTitle").textContent=s.title||"");
  q("#heroHighlight") && (q("#heroHighlight").textContent=s.highlight||"");
  q("#heroDescription") && (q("#heroDescription").textContent=s.description||"");

  const p=q("#heroPrimary");
  if(p){p.href=s.primaryUrl||"/panel.html";p.innerHTML=(s.primaryLabel||"Uygulamaya Gir")+' <span>→</span>'}
  const sec=q("#heroSecondary");
  if(sec){sec.href=s.secondaryUrl||"#features";sec.textContent="▶ "+(s.secondaryLabel||"Tanıtımı Keşfet")}

  const img=q("#heroSlideImage");
  if(img&&show){
    if(s.image){img.src=s.image;img.alt=s.highlight||s.title||"Parently";show.classList.add("has-slide-image")}
    else{img.removeAttribute("src");img.alt="";show.classList.remove("has-slide-image")}
  }

  qa("#heroDots button").forEach((d,i)=>d.classList.toggle("active",i===index));
  requestAnimationFrame(()=>requestAnimationFrame(()=>{copy?.classList.remove("is-changing");show?.classList.remove("is-changing");changing=false;}));
}

function restart(){
  clearInterval(timer);
  timer=setInterval(()=>showSlide(index+1),7000);
}
async function loadSlides(){
  try{
    const r=await fetch("/api/site/home",{cache:"no-store"});
    if(r.ok){
      const data=await r.json();
      if(Array.isArray(data.slides)&&data.slides.length)slides=data.slides.slice(0,3);
    }
  }catch{}
  await Promise.all(slides.map(s=>preloadImage(s.image)));
  showSlide(0,true);
  restart();
}

q("#heroPrev")?.addEventListener("click",()=>{showSlide(index-1);restart()});
q("#heroNext")?.addEventListener("click",()=>{showSlide(index+1);restart()});
qa("#heroDots button").forEach((d,i)=>d.addEventListener("click",()=>{showSlide(i);restart()}));

const m=q("#menuBtn"),nav=q("#navLinks");
if(m&&nav)m.onclick=()=>{const open=nav.classList.toggle("mobile-open");m.textContent=open?"×":"☰"};

qa('a[href^="#"]').forEach(a=>a.addEventListener("click",e=>{
  const id=a.getAttribute("href");
  const target=id&&id.length>1?q(id):null;
  if(target){
    e.preventDefault();
    nav?.classList.remove("mobile-open");
    if(m)m.textContent="☰";
    target.scrollIntoView({behavior:"smooth",block:"start"});
    history.replaceState(null,"",id);
  }
}));

const sections=qa("main section[id]");
const navAnchors=qa(".nav-links a[href^='#']");
if("IntersectionObserver" in window){
  const obs=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible)return;
    navAnchors.forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+visible.target.id));
  },{rootMargin:"-30% 0px -55% 0px",threshold:[0,.15,.4,.7]});
  sections.forEach(s=>obs.observe(s));
}

q("#contactForm")?.addEventListener("submit",e=>{
  e.preventDefault();
  const note=q("#contactNote");
  if(note)note.textContent="Teşekkürler. Form tasarımı hazır; e-posta gönderim bağlantısı bağlandığında mesajınız gönderilecek.";
});

document.addEventListener("visibilitychange",()=>{if(document.hidden)clearInterval(timer);else restart()});
loadSlides();
