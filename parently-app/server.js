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

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname, "public")));

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
}
async function loadState(code){
  const key=(code||"AILE2026").toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,30)||"AILE2026";
  if(pool){
    await initDb();
    const r=await pool.query("SELECT data FROM parently_state WHERE family_code=$1",[key]);
    if(r.rows[0]) return r.rows[0].data;
    const state=baseState(key);
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
  for(const key of ["profiles","cards","tasks","rituals","calendar","messages","specialSessions","completedCards","supportTickets"]){
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
