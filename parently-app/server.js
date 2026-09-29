import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "data.json");
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.use(express.json({limit:"18mb"}));
app.use(express.static(path.join(__dirname, "public"),{
  etag:false,
  lastModified:false,
  setHeaders(res,filePath){
    if(filePath.endsWith(".js")||filePath.endsWith(".css")||filePath.endsWith(".html")){
      res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma","no-cache");
      res.setHeader("Expires","0");
    }
  }
}));

const initialCards = [
  ["2-5","Duygularımı Tanıyorum","😊","Bugün yüzün hangi duyguyu gösteriyor?","Sence bu duygu bedeninin neresinde hissediliyor?","Çocuğun seçimini düzeltmeden merakla dinleyin.","Duygusunu fark etmesini övün: “Bunu fark etmen çok güzel.”","Duygularını bana her zaman anlatabilirsin."],
  ["2-5","Duygularımı Tanıyorum","😡","Kızınca bedeninde ne oluyor?","Ellerin, yüzün ya da karnın sana ne söylüyor?","Önce bedensel işaretleri isimlendirin.","“Kızdığını söyleyebilmen güçlü bir şey.”","Kızgın olsan da yanındayım."],
  ["2-5","Duygularımı Tanıyorum","😢","Üzgün olduğunda benden nasıl yardım istersin?","Sarılmak mı, konuşmak mı, biraz beklemek mi?","Çocuğa birkaç güvenli seçenek sunun.","Yardım istemesini fark edin ve güçlendirin.","Üzgünken yalnız değilsin."],
  ["2-5","Duygularımı Tanıyorum","😄","Bugün seni en çok ne güldürdü?","O anı tekrar canlandıralım mı?","Olumlu anıyı ayrıntılandırmasına yardım edin.","“Mutluluğunu benimle paylaşman hoşuma gidiyor.”","Senin sevincin bana da iyi geliyor."],
  ["2-5","Duygularımı Tanıyorum","😨","Bir şeyden korktuğunda ne sana iyi gelir?","Yanında kimi istersin?","Korkuyu küçümsemeden güven verin.","Korkusunu söylemesini cesaret olarak çerçeveleyin.","Korktuğunda bana gelebilirsin."],
  ["2-5","Duygularımı Tanıyorum","⏳","Beklemek zor olduğunda ne yapabiliriz?","Birlikte üç şey sayalım mı?","Kısa beklemeleri oyunlaştırın.","Küçük bekleme başarısını hemen fark edin.","Beklemek zor olsa da birlikte yapabiliriz."],
  ["2-5","Duygularımı Tanıyorum","🤩","Çok heyecanlandığında bedenin ne yapıyor?","Kalbin hızlı mı, sesin yüksek mi?","Heyecanı olumlu bir beden sinyali olarak konuşun.","“Heyecanını fark etmen harika.”","Heyecanını benimle paylaşabilirsin."],
  ["2-5","Duygularımı Tanıyorum","🙁","İstediğin şey olmayınca ne hissediyorsun?","O anda sana ne yardımcı olabilir?","Hayal kırıklığına isim verin, hemen çözmeye çalışmayın.","Duyguyu yönetme çabasını övün.","Olmayınca üzülmek normal; yanındayım."],
  ["2-5","Duygularımı Tanıyorum","🌿","Sakinleşmek için ne yapmak istersin?","Nefes, sarılma, su içme, sessizlik?","Çocuğa kişisel sakinleşme menüsü oluşturun.","Kendi yöntemini seçmesini destekleyin.","Sakinleşmek için zaman ayırabiliriz."],
  ["2-5","Duygularımı Tanıyorum","🌟","Bugün kendinle gurur duyduğun ne yaptın?","Bunu yaparken neye dikkat ettin?","Sonuca değil çabaya vurgu yapın.","“Çabanı fark ettim.”","Seninle gurur duyuyorum; en çok da çabanla."],
  ["6-9","Güven ve Bağ","🤝","Bugün benim sana daha çok yardımcı olmamı istediğin bir şey var mı?","Bunu nasıl yapmamı istersin?","Savunmaya geçmeden dinleyin.","İsteğini açıkça söylemesini güçlendirin.","Seni anlamak benim için önemli."],
  ["6-9","Ebeveyni Tanıma","🧠","Sence ben çocukken en çok neyi severdim?","Tahmininden sonra ben de anlatayım.","Karşılıklı hikâye paylaşın.","Merakını takdir edin.","Benim de bir zamanlar çocuk olduğumu bilmeni seviyorum."],
  ["6-9","Sınır ve Adalet","⚖️","Sence evdeki hangi kural adil, hangisi zor?","Bir kuralı birlikte daha anlaşılır hale getirelim mi?","Kuralları tartışmaya açık ama sınırları net tutun.","Görüşünü saygılı söylemesini övün.","Fikrini duymak benim için önemli."],
  ["6-9","Hayal ve Gelecek","🚀","Bir gün istediğin her şeyi öğrenebilseydin ne öğrenirdin?","İlk küçük adım ne olurdu?","Çözüm üretmek yerine merak edin.","Hayal kurmasını destekleyin.","Hayallerini benimle paylaşman çok değerli."],
  ["10-13","Güven ve Bağ","💬","Bazen yetişkinlerin anlamadığını düşündüğün bir konu var mı?","Ben o konuda neyi daha iyi yapabilirim?","Savunmasız dinleme yapın.","Dürüstlüğünü takdir edin.","Söylediklerini ciddiye alıyorum."],
  ["10-13","Duygu Yansıtma","🪞","Bu hafta seni en çok zorlayan duygu hangisiydi?","Bu duygu sana ne anlatıyor olabilir?","Yorum yapmadan önce çocuğun kelimelerini yansıtın.","Duyguyu tarif etme becerisini güçlendirin.","Her duygunu benimle konuşabilirsin."],
  ["10-13","Sınır ve Adalet","📱","Telefon ve ekran kurallarımızda sence en zor olan ne?","İki tarafın da kabul edebileceği bir öneri üretelim mi?","Müzakere alanı ile değişmez sınırları ayırın.","Gerekçeli önerilerini takdir edin.","Kuralları birlikte konuşabiliriz."],
  ["10-13","Hayal ve Gelecek","🎯","Bir yıl sonra kendinde hangi konuda ilerleme görmek istersin?","Bu hafta atabileceğin minicik adım ne?","Hedefi küçültmesine yardım edin.","Küçük ilerlemeleri görünür kılın.","Yolculuğunda yanında olacağım."],
  ["14-16","Güven ve Bağ","🧩","Sana fazla karıştığımı düşündüğün bir alan var mı?","Desteğimle kontrolüm arasındaki sınırı nasıl daha iyi kurabiliriz?","Özerkliğe saygı gösterin.","Sınırını ifade etmesini güçlendirin.","Büyürken sana alan açmayı öğreniyorum."],
  ["14-16","Duygu Yansıtma","🌊","Son günlerde zihnini en çok meşgul eden şey ne?","Benden çözüm mü, sadece dinlememi mi istersin?","Çözüm vermeden önce izin sorun.","İhtiyacını net söylemesini takdir edin.","Nasıl yanında olmamı istediğini söyleyebilirsin."],
  ["14-16","Sınır ve Adalet","🗣️","Evde hangi konuda daha fazla söz hakkı istersin?","Bu sorumlulukla birlikte hangi özgürlük gelebilir?","Özgürlük ve sorumluluğu birlikte konuşun.","Olgun müzakereyi fark edin.","Söz hakkın bizim için önemli."],
  ["14-16","Hayal ve Gelecek","🌍","Şu an gelecekle ilgili seni heyecanlandıran ya da kaygılandıran ne var?","Bunu birlikte küçük parçalara ayıralım mı?","Belirsizliği normalleştirin.","Kendi planını üretmesine alan açın.","Geleceği tek başına çözmek zorunda değilsin."]
].map((x,i)=>({id:"card-"+(i+1),ageGroup:x[0],category:x[1],emoji:x[2],question:x[3],followUp:x[4],parentGuide:x[5],positiveReinforcement:x[6],connectionPhrase:x[7],difficulty:i%3+1,tags:[x[1].toLowerCase().replaceAll(" ","-")]}));

function defaultExperts(){
  return [
    {id:"exp1",name:"Dr. Elif Kaya",role:"expert",title:"Aile ve Çocuk Uzmanı",avatar:"EK",color:"#2f7d68",languages:["tr","nl"],status:"online",bio:"Ebeveynlik, aile içi iletişim ve çocuk gelişimi alanında destek."},
    {id:"exp2",name:"Meryem El Amrani",role:"expert",title:"Gezinscoach",avatar:"ME",color:"#8c6a9e",languages:["nl","ar-MA","tr"],status:"online",bio:"Çok dilli aileler, göç deneyimi ve günlük aile rutinleri üzerine destek."},
    {id:"exp3",name:"Omar Haddad",role:"expert",title:"Psychosociaal begeleider",avatar:"OH",color:"#b06b4f",languages:["nl","ar-SY"],status:"away",bio:"Aile iletişimi, ergenlik ve sosyal-duygusal destek."}
  ];
}
function makeStateForCode(code){
  const s=baseState(code);
  if(code==="UZMANDEMO1"){
    s.familyName="Demir Ailesi";
    s.pin="1111";
    s.profiles=[
      {id:"p1",name:"Ayşe",role:"parent",avatar:"A",color:"#21B889"},
      {id:"p2",name:"Murat",role:"parent",avatar:"M",color:"#FF6255"},
      {id:"c1",name:"Ece",role:"child",age:7,ageGroup:"6-9",avatar:"E",color:"#FFD75A",interests:"resim, dans"}
    ];
    s.expertConnections=[{id:"ec1",expertId:"exp1",status:"active",familyChatAccess:false,childProfileIds:["c1"],createdAt:new Date().toISOString()}];
  }else if(code==="UZMANDEMO2"){
    s.familyName="Yılmaz Ailesi";
    s.pin="2222";
    s.profiles=[
      {id:"p1",name:"Selin",role:"parent",avatar:"S",color:"#21B889"},
      {id:"p2",name:"Kerem",role:"parent",avatar:"K",color:"#5967d8"},
      {id:"c1",name:"Deniz",role:"child",age:5,ageGroup:"2-5",avatar:"D",color:"#FFD75A",interests:"lego, müzik"},
      {id:"c2",name:"Ada",role:"child",age:11,ageGroup:"10-13",avatar:"A",color:"#e59cbd",interests:"kitap, yüzme"}
    ];
    s.expertConnections=[{id:"ec1",expertId:"exp2",status:"active",familyChatAccess:true,childProfileIds:["c1","c2"],createdAt:new Date().toISOString()}];
  }else if(code==="UZMANDEMO3"){
    s.familyName="Acar Ailesi";
    s.pin="3333";
    s.profiles=[
      {id:"p1",name:"Zeynep",role:"parent",avatar:"Z",color:"#21B889"},
      {id:"c1",name:"Mina",role:"child",age:4,ageGroup:"2-5",avatar:"M",color:"#FFD75A",interests:"oyun"},
      {id:"c2",name:"Emir",role:"child",age:9,ageGroup:"6-9",avatar:"E",color:"#84c5e8",interests:"futbol, oyun"},
      {id:"c3",name:"Lina",role:"child",age:15,ageGroup:"14-16",avatar:"L",color:"#c6a2e8",interests:"müzik, arkadaşlar"}
    ];
    s.expertConnections=[{id:"ec1",expertId:"exp3",status:"active",familyChatAccess:false,childProfileIds:["c2","c3"],createdAt:new Date().toISOString()}];
  }
  s.activeProfileId=s.profiles.find(p=>p.role==="child")?.id||s.profiles[0]?.id;
  s.experts=defaultExperts();
  return s;
}
function baseState(code="AILE2026"){
  const today=new Date().toISOString().slice(0,10);
  return {
    version:1,familyCode:code,familyName:"Dumlu Ailesi",
    profiles:[
      {id:"p1",name:"Kimya",role:"parent",avatar:"K",color:"#6A3EEA"},
      {id:"p2",name:"Fatih",role:"parent",avatar:"F",color:"#4B1AC1"},
      {id:"c1",name:"Çınar",role:"child",age:9,ageGroup:"6-9",avatar:"Ç",color:"#FFD13B",interests:"oyun, spor, çizim"}
    ],
    activeProfileId:"c1",mode:"parent",pin:"2026",
    moods:[{id:"m1",profileId:"c1",date:today,mood:"😊",label:"İyi",note:"Bugün okul güzeldi."}],
    cards:initialCards, favorites:[], cardNotes:{}, completedCards:[],
    tasks:[
      {id:"t1",title:"10 dakika özel zaman",description:"Çocuğun seçtiği etkinliği birlikte yap.",assigneeId:"c1",due:today,status:"pending",requiresApproval:false,type:"ritual"},
      {id:"t2",title:"Kitap çantasını hazırla",description:"Yarın için çantanı kontrol et.",assigneeId:"c1",due:today,status:"submitted",requiresApproval:true,type:"task"}
    ],
    rituals:[
      {id:"r1",title:"Yatmadan önce 3 soru",days:["Pzt","Çar","Cum"],doneDates:[]},
      {id:"r2",title:"Şükür / güzel an",days:["Her gün"],doneDates:[today]}
    ],
    calendar:[{id:"e1",title:"Aile oyun zamanı",date:today,time:"19:00",type:"special"}],
    messages:[
      {id:"msg1",senderId:"p1",text:"Bugün okuldan sonra nasıl hissediyorsun?",at:new Date().toISOString()},
      {id:"msg2",senderId:"c1",text:"İyiyim 😊 Biraz yoruldum.",at:new Date().toISOString()}
    ],
    specialSessions:[],
    supportTickets:[],
    experts:defaultExperts(),
    expertConnections:[],
    expertMessages:[],
    expertSessions:[],
    expertInvites:[],
    settings:{language:"tr",notifications:true,highContrast:false}
  };
}

function readLocal(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE,"utf8")); }catch{ return {}; }
}
function writeLocal(data){ fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2)); }

async function initDb(){
  if(!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS parently_state (family_code text primary key, data jsonb not null, updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS parently_site_settings (key text primary key, data jsonb not null, updated_at timestamptz default now())`);
}
const SITE_FILE=path.join(__dirname,"site-config.json");
function defaultHomeConfig(){
  return {
    branding:{name:"Parently",tagline:"Aile bağını güçlendir",logoImage:""},
    navigation:{how:"Nasıl çalışır?",cards:"Kartları keşfet",features:"Özellikler",pricing:"Planlar",contact:"İletişim",app:"Uygulamaya Gir"},
    demoPng:"",
    storyImage:"",
    slides:[
      {id:"slide-1",badge:"♡ Daha güçlü aile bağları için",title:"Ailenizle daha fazla anlamlı zaman, daha",highlight:"güçlü yarınlar.",description:"Parently, ailelerin birlikte kaliteli zaman geçirmesini, duygularını paylaşmasını ve daha güçlü bağlar kurmasını destekleyen modern bir aile uygulamasıdır.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Tanıtımı Keşfet",secondaryUrl:"#how",image:""},
      {id:"slide-2",badge:"💬 Her gün yeni bir konuşma",title:"Doğru sorularla çocuğunuzun dünyasına",highlight:"daha yakından bakın.",description:"Yaşa uygun kartlar ve takip soruları, aile içinde doğal ve anlamlı sohbetler başlatmanıza yardımcı olur.",primaryLabel:"Kartları Keşfet",primaryUrl:"#cards",secondaryLabel:"Nasıl Çalışır?",secondaryUrl:"#how",image:""},
      {id:"slide-3",badge:"🌿 Küçük rutinler, güçlü bağlar",title:"Duygular, rutinler ve aile zamanı",highlight:"tek yerde.",description:"Duygu takibi, aile ajandası ve günlük küçük görevlerle birlikte geçirilen zamanı daha görünür hale getirin.",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Özellikleri Gör",secondaryUrl:"#features",image:""}
    ],
    sections:{
      strip:{title:"Birlikte geçirilen zaman, küçük anlarda büyür.",meta:"Kartlar · Rutinler · Aile ajandası"},
      how:{eyebrow:"Nasıl çalışır?",title:"Başlamak için uzun bir plan yapmanız gerekmiyor.",description:"Bir kart seçin, birbirinizi dinleyin ve iyi gelen anları tekrar edin.",noteLabel:"3 adım",noteText:"Küçük ritüeller, güçlü bağlar.",steps:[
        {icon:"✦",label:"SOHBET",title:"Yaşa uygun bir kart seçin",description:"Çocuğunuzun dünyasına yakın bir soruyla sohbeti açın."},
        {icon:"◌",label:"DİNLEME",title:"Herkese söz verin",description:"Doğru cevap aramadan, merakla ve sırayla dinleyin."},
        {icon:"◷",label:"RUTİN",title:"Küçük bir alışkanlık oluşturun",description:"Günün size uygun bir anını aile zamanı olarak ayırın."}
      ]},
      cards:{eyebrow:"Kartları keşfet",title:"İlk soruyu şimdi deneyin.",description:"Yaş grubunu seçip yeni bir soru açın. Bu örnekler, Parently kartlarının sohbeti nasıl başlattığını göstermek için burada.",emptyTitle:"PNG alanı",emptyDescription:"Yönetim panelinden şeffaf PNG yükleyin."},
      features:{eyebrow:"Parently ile",title:"Günlük hayatın içinde birbirinize yaklaşın.",description:"Bir uygulama, ailenizin yerini tutmaz. Sohbet için doğru anı bulmanıza ve birlikte kurduğunuz alışkanlıkları hatırlamanıza yardım eder.",items:[
        {symbol:"✳",title:"Sohbet kartları",description:"Farklı yaşlara uygun sorularla konuşmaya başlayın.",label:"Bir soruyla başlayın ♡",copy:"Yaşa uygun sorularla sohbeti başlatın; doğru cevabı aramak yerine birbirinizi merakla dinleyin.",image:""},
        {symbol:"◷",title:"Aile rutinleri",description:"Birlikte yapmak istediklerinize zaman ayırın.",label:"Küçük rutinleri koruyun ◷",copy:"Birlikte yapmak istediğiniz küçük şeylere zaman ayırın ve onları aile ritminizin doğal parçası haline getirin.",image:""},
        {symbol:"▤",title:"Ortak ajanda",description:"Aile planlarını tek yerde görün.",label:"Aile planları tek yerde ▤",copy:"Okul, aktivite ve özel aile zamanlarını tek bir ortak ajandada görün; herkes ne olacağını bilsin.",image:""}
      ]},
      pricing:{eyebrow:"Planlar",title:"Ailenize uygun başlangıcı seçin.",description:"Planlar lansman öncesi taslak olarak gösterilmektedir.",noteLabel:"Esnek başlangıç",noteText:"İhtiyacınıza göre büyütün.",plans:[
        {icon:"✦",tag:"Başlangıç",name:"Demo",price:"Ücretsiz",description:"Parently deneyimini tanımak için.",features:["Temel kartlar","Demo aile profili","Ajanda ön izlemesi"],button:"Demoyu aç",url:"/panel.html"},
        {icon:"♡",tag:"Önerilen",name:"Aile",price:"Yakında",description:"Tam aile deneyimi için planlanan paket.",features:["Tüm kartlar ve aktiviteler","Aile rutinleri ve ajanda","Çoklu dil desteği"],button:"Erken erişim",url:"#contact"},
        {icon:"◎",tag:"Uzmanlar",name:"Profesyonel",price:"Yakında",description:"Uzmanlar ve kurumlar için genişletilmiş yapı.",features:["Birden fazla aile alanı","Gelişmiş raporlama","İçerik yönetimi"],button:"Bilgi al",url:"#contact"}
      ]},
      closing:{eyebrow:"Bir soru yeter",title:"Bu akşam nasıl bir sohbet başlatacaksınız?",description:"Parently’yi deneyin veya erken erişim hakkında bilgi alın.",button:"Uygulamaya Gir",url:"/panel.html"},
      footer:{description:"Birlikte konuşmaya küçük bir başlangıç."}
    }
  };
}
function deepMerge(base,extra){
  if(Array.isArray(base)){
    if(!Array.isArray(extra))return base;
    const mergeObjects=base.every(x=>x&&typeof x==="object"&&!Array.isArray(x))&&extra.every(x=>x&&typeof x==="object"&&!Array.isArray(x));
    if(mergeObjects){
      const out=base.map((x,i)=>extra[i]===undefined?x:deepMerge(x,extra[i]));
      return out.concat(extra.slice(base.length));
    }
    return extra;
  }
  if(base&&typeof base==="object"){
    const out={...base};
    if(extra&&typeof extra==="object"){
      for(const [k,v] of Object.entries(extra)){
        out[k]=Object.prototype.hasOwnProperty.call(base,k)?deepMerge(base[k],v):v;
      }
    }
    return out;
  }
  return extra===undefined?base:extra;
}
function translateSiteConfig(base,siteTranslation){
  if(!siteTranslation||typeof siteTranslation!=="object")return base;
  return deepMerge(base,siteTranslation);
}
let homeConfigWriteQueue=Promise.resolve();
function withHomeConfigLock(fn){
  const run=homeConfigWriteQueue.catch(()=>{}).then(fn);
  homeConfigWriteQueue=run.catch(()=>{});
  return run;
}
async function loadHomeConfig(){
  if(pool){
    await initDb();
    const r=await pool.query("SELECT data FROM parently_site_settings WHERE key=$1",["home"]);
    if(r.rows[0]) return r.rows[0].data;
    const data=defaultHomeConfig();
    await pool.query("INSERT INTO parently_site_settings(key,data) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",["home",data]);
    return data;
  }
  try{return JSON.parse(fs.readFileSync(SITE_FILE,"utf8"));}catch{return defaultHomeConfig();}
}
async function saveHomeConfig(data){
  const d=deepMerge(defaultHomeConfig(),data||{});
  const clean={
    branding:{
      name:String(d.branding?.name||"Parently").slice(0,80),
      tagline:String(d.branding?.tagline||"Aile bağını güçlendir").slice(0,140),
      logoImage:String(d.branding?.logoImage||"").slice(0,8_000_000)
    },
    navigation:d.navigation,
    demoPng:String(d.demoPng||"").slice(0,8_000_000),
    storyImage:String(d.storyImage||"").slice(0,8_000_000),
    slides:(d.slides||[]).slice(0,12).map((s,i)=>({
      id:"slide-"+(i+1),badge:String(s.badge||"").slice(0,120),title:String(s.title||"").slice(0,220),highlight:String(s.highlight||"").slice(0,160),
      description:String(s.description||"").slice(0,700),primaryLabel:String(s.primaryLabel||"").slice(0,80),primaryUrl:String(s.primaryUrl||"/panel.html").slice(0,300),
      secondaryLabel:String(s.secondaryLabel||"").slice(0,80),secondaryUrl:String(s.secondaryUrl||"#how").slice(0,300),image:String(s.image||"").slice(0,8_000_000)
    })),
    sections:d.sections
  };
  if(clean.slides.length===0)clean.slides=[...defaultHomeConfig().slides];
  if(pool){
    await initDb();
    await pool.query("INSERT INTO parently_site_settings(key,data,updated_at) VALUES($1,$2,now()) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=now()",["home",clean]);
  }else fs.writeFileSync(SITE_FILE,JSON.stringify(clean,null,2));
  return clean;
}
async function loadState(code){
  const key=(code||"AILE2026").toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,30)||"AILE2026";
  if(pool){
    await initDb();
    const r=await pool.query("SELECT data FROM parently_state WHERE family_code=$1",[key]);
    if(r.rows[0]) return r.rows[0].data;
    const state=makeStateForCode(key);
    await pool.query("INSERT INTO parently_state(family_code,data) VALUES($1,$2)",[key,state]);
    return state;
  }
  const all=readLocal();
  if(!all[key]){ all[key]=baseState(key); writeLocal(all); }
  return all[key];
}
async function saveState(code,state){
  const key=(code||state.familyCode||"AILE2026").toUpperCase();
  state.familyCode=key;
  if(pool){
    await initDb();
    await pool.query("INSERT INTO parently_state(family_code,data,updated_at) VALUES($1,$2,now()) ON CONFLICT(family_code) DO UPDATE SET data=excluded.data,updated_at=now()",[key,state]);
  }else{
    const all=readLocal(); all[key]=state; writeLocal(all);
  }
  return state;
}

const familyLocks=new Map();
function withFamilyLock(code,fn){
  const key=(code||"AILE2026").toUpperCase();
  const prev=familyLocks.get(key)||Promise.resolve();
  const next=prev.catch(()=>{}).then(fn);
  familyLocks.set(key,next.finally(()=>{if(familyLocks.get(key)===next)familyLocks.delete(key)}));
  return next;
}
function mergeById(current=[],incoming=[]){
  const map=new Map();
  for(const item of current||[]) if(item?.id) map.set(item.id,item);
  for(const item of incoming||[]) if(item?.id) map.set(item.id,{...(map.get(item.id)||{}),...item});
  return [...map.values()];
}
function mergeMoods(current=[],incoming=[]){
  const keys=new Set((incoming||[]).map(m=>m.profileId+"|"+m.date));
  const keep=(current||[]).filter(m=>!keys.has(m.profileId+"|"+m.date));
  return mergeById(keep,incoming);
}
function mergeState(current,incoming){
  const merged={...current,...incoming};
  for(const key of ["profiles","cards","tasks","rituals","calendar","messages","specialSessions","completedCards","supportTickets","expertConnections","expertMessages","expertSessions","expertInvites"]){
    if(incoming[key]) merged[key]=mergeById(current[key],incoming[key]);
  }
  if(incoming.moods) merged.moods=mergeMoods(current.moods,incoming.moods);
  if(incoming.cardNotes) merged.cardNotes={...(current.cardNotes||{}),...incoming.cardNotes};
  if(incoming.points) merged.points={...(current.points||{}),...incoming.points};
  delete merged.mode;
  delete merged.activeProfileId;
  merged._rev=(Number(current?._rev)||0)+1;
  merged.updatedAt=new Date().toISOString();
  return merged;
}

const streamClients=new Map();
function broadcast(code,event="state"){
  const key=(code||"AILE2026").toUpperCase();
  const set=streamClients.get(key);
  if(!set)return;
  const payload="event: "+event+"\ndata: "+JSON.stringify({code:key,at:new Date().toISOString()})+"\n\n";
  for(const res of [...set]){try{res.write(payload)}catch{set.delete(res)}}
}
setInterval(()=>{
  for(const set of streamClients.values()) for(const res of [...set]){try{res.write(": ping\n\n")}catch{set.delete(res)}}
},25000).unref();

app.get("/api/health",(req,res)=>res.json({ok:true,db:!!pool,time:new Date().toISOString(),realtime:true}));
app.get("/api/site/languages",async(req,res)=>{
  try{
    const state=await loadState("AILE2026");
    const packs=state?.languagePacks||{};
    const base=[
      {code:"tr",name:"Türkçe",label:"Türkçe",flag:"🇹🇷",direction:"ltr",loaded:true},
      {code:"nl",name:"Nederlands",label:"Nederlands",flag:"🇳🇱",direction:"ltr"},
      {code:"ar-MA",name:"الدارجة المغربية",label:"Fas / Darija",flag:"🇲🇦",direction:"rtl"},
      {code:"ar-SY",name:"العربية السورية",label:"Suriye Arapçası",flag:"🇸🇾",direction:"rtl"},
      {code:"so",name:"Soomaali",label:"Soomaali",flag:"🇸🇴",direction:"ltr"},
      {code:"pl",name:"Polski",label:"Polski",flag:"🇵🇱",direction:"ltr"}
    ];
    const loaded=Object.values(packs).map(p=>p?.meta).filter(Boolean);
    res.json(base.map(x=>{
      const hit=loaded.find(m=>String(m.code||"").toLowerCase()===String(x.code).toLowerCase());
      return hit?{...x,...hit,loaded:true}:{...x,loaded:!!x.loaded};
    }));
  }catch(e){
    console.error("site languages load failed",e);
    res.status(500).json({error:"site_languages_load_failed"});
  }
});
app.get("/api/site/home",async(req,res)=>{
  try{
    const base=deepMerge(defaultHomeConfig(),await loadHomeConfig());
    const lang=String(req.query.lang||"").trim();
    if(!lang||/^tr(?:-|$)/i.test(lang))return res.json(base);
    const state=await loadState("AILE2026");
    const packs=state?.languagePacks||{};
    const p=packs[lang]||Object.values(packs).find(x=>String(x?.meta?.code||"").toLowerCase()===lang.toLowerCase());
    res.json(translateSiteConfig(base,p?.site||null));
  }catch(e){console.error(e);res.status(500).json({error:"site_home_load_failed"});}
});
app.put("/api/site/home",async(req,res)=>{
  try{
    const familyCode=String(req.body?.familyCode||"").toUpperCase();
    const pin=String(req.body?.pin||"");
    const family=await loadState(familyCode);
    if(!family||String(family.pin||"")!==pin)return res.status(403).json({error:"admin_auth_failed"});
    const saved=await withHomeConfigLock(async()=>{
      const current=deepMerge(defaultHomeConfig(),await loadHomeConfig());
      const next=deepMerge(defaultHomeConfig(),req.body?.config||{});

      next.branding=next.branding||{};
      next.branding.logoImage=current.branding?.logoImage||"";
      next.demoPng=current.demoPng||"";
      next.storyImage=current.storyImage||"";

      next.slides=Array.isArray(next.slides)?next.slides:[];
      for(let i=0;i<next.slides.length;i++){
        next.slides[i]=next.slides[i]||{};
        next.slides[i].image=current.slides?.[i]?.image||"";
      }

      next.sections=next.sections||{};
      next.sections.features=next.sections.features||{};
      next.sections.features.items=Array.isArray(next.sections.features.items)?next.sections.features.items:[];
      for(let i=0;i<next.sections.features.items.length;i++){
        next.sections.features.items[i]=next.sections.features.items[i]||{};
        next.sections.features.items[i].image=current.sections?.features?.items?.[i]?.image||"";
      }

      return saveHomeConfig(next);
    });
    res.json(saved);
  }catch(e){console.error(e);res.status(500).json({error:"site_home_save_failed"});}
});
app.put("/api/site/home/slide-image",async(req,res)=>{
  try{
    const familyCode=String(req.body?.familyCode||"").toUpperCase();
    const pin=String(req.body?.pin||"");
    const index=Number(req.body?.index);
    const image=String(req.body?.image||"");
    const family=await loadState(familyCode);
    if(!family||String(family.pin||"")!==pin)return res.status(403).json({error:"admin_auth_failed"});
    if(!Number.isInteger(index)||index<0||index>11)return res.status(400).json({error:"invalid_slide_index"});
    if(image&&(!image.startsWith("data:image/")||image.length>8_000_000))return res.status(400).json({error:"invalid_slide_image"});
    const config=deepMerge(defaultHomeConfig(),await loadHomeConfig());
    while(config.slides.length<=index){
      const n=config.slides.length+1;
      config.slides.push({id:"slide-"+n,badge:"Slide "+n,title:"Yeni başlık",highlight:"Vurgulu metin.",description:"",primaryLabel:"Uygulamaya Gir",primaryUrl:"/panel.html",secondaryLabel:"Daha fazla bilgi",secondaryUrl:"#features",image:""});
    }
    config.slides[index].image=image;
    const saved=await saveHomeConfig(config);
    res.json({ok:true,index,imageLen:(saved.slides[index]?.image||"").length,slide:saved.slides[index]});
  }catch(e){console.error("slide image save failed",e);res.status(500).json({error:"slide_image_save_failed"});}
});
app.put("/api/site/home/media",async(req,res)=>{
  try{
    const familyCode=String(req.body?.familyCode||"").toUpperCase();
    const pin=String(req.body?.pin||"");
    const pathKey=String(req.body?.path||"");
    const image=String(req.body?.image||"");
    const family=await loadState(familyCode);
    if(!family||String(family.pin||"")!==pin)return res.status(403).json({error:"admin_auth_failed"});
    if(image&&(!image.startsWith("data:image/")||image.length>8_000_000))return res.status(400).json({error:"invalid_image"});

    const allowed=[
      "branding.logoImage","demoPng","storyImage",
      ...Array.from({length:12},(_,i)=>"slides."+i+".image"),
      ...Array.from({length:3},(_,i)=>"sections.features.items."+i+".image")
    ];
    if(!allowed.includes(pathKey))return res.status(400).json({error:"invalid_media_path"});

    const result=await withHomeConfigLock(async()=>{
      const config=deepMerge(defaultHomeConfig(),await loadHomeConfig());
      const parts=pathKey.split(".");
      let cur=config;
      for(let i=0;i<parts.length-1;i++){
        const k=/^\d+$/.test(parts[i])?Number(parts[i]):parts[i];
        const next=parts[i+1];
        if(cur[k]==null)cur[k]=/^\d+$/.test(next)?[]:{};
        cur=cur[k];
      }
      const last=/^\d+$/.test(parts.at(-1))?Number(parts.at(-1)):parts.at(-1);
      cur[last]=image;
      const saved=await saveHomeConfig(config);
      let check=saved;
      for(const p of parts)check=check?.[/^\d+$/.test(p)?Number(p):p];
      return {ok:true,path:pathKey,imageLen:String(check||"").length};
    });
    res.json(result);
  }catch(e){
    console.error("site media save failed",e);
    res.status(500).json({error:"site_media_save_failed"});
  }
});
app.get("/api/experts",(req,res)=>res.json(defaultExperts()));

app.post("/api/expert/message/:code",async(req,res)=>{
  try{
    const saved=await withFamilyLock(req.params.code,async()=>{
      const state=await loadState(req.params.code);
      state.experts=state.experts?.length?state.experts:defaultExperts();
      state.expertConnections=state.expertConnections||[];
      state.expertMessages=state.expertMessages||[];
      const expertId=String(req.body?.expertId||"");
      const senderType=String(req.body?.senderType||"parent");
      const senderId=String(req.body?.senderId||"");
      const channel=String(req.body?.channel||"private");
      const text=String(req.body?.text||"").trim().slice(0,4000);
      if(!expertId||!text)return null;
      const connection=state.expertConnections.find(x=>x.expertId===expertId&&x.status!=="revoked");
      if(channel==="family"&&!connection?.familyChatAccess)return null;
      state.expertMessages.push({
        id:"em-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
        expertId,senderType,senderId,channel,text,at:new Date().toISOString()
      });
      return saveState(req.params.code,state);
    });
    if(!saved)return res.status(400).json({error:"expert_message_invalid"});
    broadcast(req.params.code);
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({error:"expert_message_failed"});}
});

app.post("/api/expert/connection/:code",async(req,res)=>{
  try{
    const saved=await withFamilyLock(req.params.code,async()=>{
      const state=await loadState(req.params.code);
      state.experts=state.experts?.length?state.experts:defaultExperts();
      state.expertConnections=state.expertConnections||[];
      const expertId=String(req.body?.expertId||"");
      if(!expertId)return null;
      let link=state.expertConnections.find(x=>x.expertId===expertId&&x.status!=="revoked");
      if(!link){
        link={id:"ec-"+Date.now(),expertId,status:"active",familyChatAccess:false,childProfileIds:[],createdAt:new Date().toISOString()};
        state.expertConnections.push(link);
      }
      if(Array.isArray(req.body?.childProfileIds))link.childProfileIds=req.body.childProfileIds.map(String);
      if(typeof req.body?.familyChatAccess==="boolean")link.familyChatAccess=req.body.familyChatAccess;
      if(req.body?.status)link.status=String(req.body.status);
      link.updatedAt=new Date().toISOString();
      await saveState(req.params.code,state);
      return link;
    });
    if(!saved)return res.status(400).json({error:"expert_connection_invalid"});
    broadcast(req.params.code);
    res.json({ok:true,connection:saved});
  }catch(e){console.error(e);res.status(500).json({error:"expert_connection_failed"});}
});

app.post("/api/expert/session/:code",async(req,res)=>{
  try{
    const saved=await withFamilyLock(req.params.code,async()=>{
      const state=await loadState(req.params.code);
      state.expertSessions=state.expertSessions||[];
      const action=String(req.body?.action||"request");
      const sessionId=String(req.body?.sessionId||"");
      if(action==="request"){
        const expertId=String(req.body?.expertId||"");
        if(!expertId)return null;
        const id="es-"+Date.now()+"-"+Math.random().toString(36).slice(2,6);
        const safeCode=String(req.params.code||"family").replace(/[^a-z0-9]/gi,"");
        const session={
          id,expertId,type:"video",status:"requested",
          requestedBy:String(req.body?.requestedBy||""),
          requestedAt:new Date().toISOString(),
          scheduledFor:String(req.body?.scheduledFor||""),
          note:String(req.body?.note||"").slice(0,1000),
          roomUrl:"https://meet.jit.si/Parently-"+safeCode+"-"+id.replace(/[^a-z0-9]/gi,"")
        };
        state.expertSessions.push(session);
        await saveState(req.params.code,state);
        return session;
      }
      const session=state.expertSessions.find(x=>x.id===sessionId);
      if(!session)return null;
      if(["accept","start","complete","cancel"].includes(action)){
        session.status={accept:"accepted",start:"active",complete:"completed",cancel:"cancelled"}[action];
        session.updatedAt=new Date().toISOString();
      }
      await saveState(req.params.code,state);
      return session;
    });
    if(!saved)return res.status(400).json({error:"expert_session_invalid"});
    broadcast(req.params.code);
    res.json({ok:true,session:saved});
  }catch(e){console.error(e);res.status(500).json({error:"expert_session_failed"});}
});

app.get("/api/state/:code",async(req,res)=>{try{res.json(await loadState(req.params.code));}catch(e){console.error(e);res.status(500).json({error:"state_load_failed"});}});
app.get("/api/events/:code",(req,res)=>{
  const key=(req.params.code||"AILE2026").toUpperCase();
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders?.();
  const set=streamClients.get(key)||new Set();set.add(res);streamClients.set(key,set);
  res.write("event: ready\ndata: "+JSON.stringify({code:key})+"\n\n");
  req.on("close",()=>{set.delete(res);if(!set.size)streamClients.delete(key)});
});
app.put("/api/state/:code",async(req,res)=>{
  try{
    const saved=await withFamilyLock(req.params.code,async()=>{
      const current=await loadState(req.params.code);
      const merged=mergeState(current,req.body||{});
      return saveState(req.params.code,merged);
    });
    broadcast(req.params.code);
    res.json(saved);
  }catch(e){console.error(e);res.status(500).json({error:"state_save_failed"});}
});
app.post("/api/message/:code",async(req,res)=>{
  try{
    const msg=await withFamilyLock(req.params.code,async()=>{
      const state=await loadState(req.params.code);
      const m={id:crypto.randomUUID(),senderId:req.body.senderId,text:String(req.body.text||"").trim().slice(0,1000),at:new Date().toISOString()};
      if(!m.text)throw Object.assign(new Error("empty"),{status:400});
      state.messages=mergeById(state.messages,[m]);
      state._rev=(Number(state._rev)||0)+1;state.updatedAt=new Date().toISOString();
      await saveState(req.params.code,state);
      return m;
    });
    broadcast(req.params.code,"message");
    res.json(msg);
  }catch(e){console.error(e);res.status(e.status||500).json({error:e.status===400?"empty":"message_failed"});}
});
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("Parently running on",PORT));
