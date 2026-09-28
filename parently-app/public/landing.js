const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const fallbackSlides=[
{badge:"♡ Daha güçlü aile bağları için",title:"Ailenizle daha fazla anlamlı zaman, daha",highlight:"güçlü yarınlar.",description:"Parently, ailelerin birlikte kaliteli zaman geçirmesini, duygularını paylaşmasını ve daha güçlü bağlar kurmasını destekleyen modern bir aile uygulamasıdır.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Tanıtımı Keşfet",secondaryUrl:"/uygulama.html",image:""},
{badge:"💬 Her gün yeni bir konuşma",title:"Doğru sorularla çocuğunuzun dünyasına",highlight:"daha yakından bakın.",description:"Yaşa uygun kartlar ve takip soruları, aile içinde doğal ve anlamlı sohbetler başlatmanıza yardımcı olur.",primaryLabel:"Kartları Keşfet",primaryUrl:"/panel.html",secondaryLabel:"Nasıl Çalışır?",secondaryUrl:"/uygulama.html",image:""},
{badge:"🌿 Küçük rutinler, güçlü bağlar",title:"Duygular, rutinler ve aile zamanı",highlight:"tek yerde.",description:"Duygu takibi, aile ajandası ve günlük küçük görevlerle birlikte geçirilen zamanı daha görünür hale getirin.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Özellikleri Gör",secondaryUrl:"/uygulama.html",image:""}
];
let slides=fallbackSlides,index=0,timer=null;
function showSlide(n){
  index=(n+slides.length)%slides.length;
  const s=slides[index]||fallbackSlides[index];
  if(q("#heroBadge"))q("#heroBadge").textContent=s.badge||"";
  if(q("#heroTitle"))q("#heroTitle").textContent=s.title||"";
  if(q("#heroHighlight"))q("#heroHighlight").textContent=s.highlight||"";
  if(q("#heroDescription"))q("#heroDescription").textContent=s.description||"";
  const p=q("#heroPrimary");if(p){p.href=s.primaryUrl||"/panel.html";p.innerHTML=(s.primaryLabel||"Uygulamaya Gir")+' <span>→</span>'}
  const sec=q("#heroSecondary");if(sec){sec.href=s.secondaryUrl||"/uygulama.html";sec.textContent="▶ "+(s.secondaryLabel||"Tanıtımı Keşfet")}
  const img=q("#heroSlideImage"),show=q("#heroShowcase");
  if(img&&show){
    if(s.image){img.src=s.image;img.alt=s.highlight||s.title||"Parently";show.classList.add("has-slide-image")}
    else{img.removeAttribute("src");img.alt="";show.classList.remove("has-slide-image")}
  }
  qa("#heroDots button").forEach((d,i)=>d.classList.toggle("active",i===index));
}
function restart(){clearInterval(timer);timer=setInterval(()=>showSlide(index+1),6500)}
async function loadSlides(){
  try{
    const r=await fetch("/api/site/home",{cache:"no-store"});
    if(r.ok){const data=await r.json();if(Array.isArray(data.slides)&&data.slides.length)slides=data.slides.slice(0,3)}
  }catch{}
  showSlide(0);restart();
}
q("#heroPrev")?.addEventListener("click",()=>{showSlide(index-1);restart()});
q("#heroNext")?.addEventListener("click",()=>{showSlide(index+1);restart()});
qa("#heroDots button").forEach((d,i)=>d.addEventListener("click",()=>{showSlide(i);restart()}));
const m=q("#menuBtn"),nav=q("#navLinks");
if(m&&nav)m.onclick=()=>{const open=nav.classList.toggle("mobile-open");m.textContent=open?"×":"☰"};
loadSlides();
