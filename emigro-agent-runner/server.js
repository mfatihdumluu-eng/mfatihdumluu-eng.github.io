import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app=express();
const PORT=process.env.PORT||10000;
const CONTROL_KEY=process.env.CONTROL_KEY||"";
const TINYFISH_API_KEY=process.env.TINYFISH_API_KEY||"";
const TINYFISH_PROFILE_ID=process.env.TINYFISH_PROFILE_ID||"prof_91c373d0b2654a8f";
const PUBLIC_BASE_URL=process.env.PUBLIC_BASE_URL||"";

const uploadDir="/tmp/emigro-uploads";
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,uploadDir),
  filename:(_,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname||".jpg"))
});
const upload=multer({storage,limits:{files:10,fileSize:15*1024*1024}});

app.use(cors({origin:["https://mfatihdumluu-eng.github.io"],methods:["GET","POST","OPTIONS"],allowedHeaders:["Content-Type","X-Control-Key"]}));
app.use(express.json({limit:"1mb"}));
app.use("/media",express.static(uploadDir,{maxAge:"1h"}));

function authorized(req){return CONTROL_KEY && req.get("X-Control-Key")===CONTROL_KEY}
function cleanup(files=[]){for(const f of files){try{fs.unlinkSync(f.path)}catch{}}}

app.get("/",(_,res)=>res.json({service:"Emigro Social Runner",ok:true}));
app.get("/health",(req,res)=>{
  res.json({
    ok:true,
    runner:"render",
    tinyfishConfigured:Boolean(TINYFISH_API_KEY),
    profileConfigured:Boolean(TINYFISH_PROFILE_ID),
    ready:Boolean(TINYFISH_API_KEY&&TINYFISH_PROFILE_ID)
  });
});

app.post("/publish",upload.array("images",10),async(req,res)=>{
  if(!authorized(req)){cleanup(req.files);return res.status(401).json({ok:false,error:"Yetkisiz istek."});}
  if(!TINYFISH_API_KEY){cleanup(req.files);return res.status(503).json({ok:false,error:"TinyFish API anahtarı henüz bağlanmadı."});}
  const targets=JSON.parse(req.body.targets||"[]");
  const caption=(req.body.caption||"").trim();
  if(!targets.length){cleanup(req.files);return res.status(400).json({ok:false,error:"En az bir paylaşım türü seçin."});}
  if(!caption && !(req.files||[]).length){cleanup(req.files);return res.status(400).json({ok:false,error:"Metin veya görsel gerekli."});}

  const base=PUBLIC_BASE_URL.replace(/\/$/,"");
  const media=(req.files||[]).map(f=>base+"/media/"+encodeURIComponent(path.basename(f.path)));
  const goal=[
    "You are operating the user's authorized personal/business social media session.",
    "Publish the supplied content ONLY to these selected destinations: "+targets.join(", ")+".",
    "Caption text: "+JSON.stringify(caption)+".",
    media.length?"Media URLs, in order: "+media.join(" , "):"No media files.",
    "For Instagram/Facebook Post with multiple images, create one multi-image/carousel post where the site supports it.",
    "For Instagram/Facebook Story with multiple images, publish them as consecutive story frames in the same order.",
    "Do not alter account settings, follow/unfollow, message anyone, react, or perform any unrelated action.",
    "If the session is logged out, requires MFA, CAPTCHA, or the requested destination is unavailable, STOP without publishing elsewhere and report the blocker.",
    "Before the final Publish/Share action, verify the selected destination and caption/media match this request exactly.",
    "Return a concise result per destination: published, blocked, or failed, and include the resulting post URL when the site exposes one."
  ].join("\n");

  try{
    const r=await fetch("https://agent.tinyfish.ai/v1/automation/run-async",{
      method:"POST",
      headers:{"X-API-Key":TINYFISH_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({
        url:"https://www.facebook.com/",
        goal,
        browser_profile:"lite",
        use_profile:true,
        profile_id:TINYFISH_PROFILE_ID
      })
    });
    const text=await r.text();
    let data={};try{data=JSON.parse(text)}catch{data={raw:text}}
    if(!r.ok){cleanup(req.files);return res.status(r.status).json({ok:false,error:"Uzak tarayıcı başlatılamadı.",detail:data});}
    setTimeout(()=>cleanup(req.files),60*60*1000);
    res.json({ok:true,status:"started",run:data,mediaCount:media.length});
  }catch(e){
    cleanup(req.files);
    res.status(500).json({ok:false,error:"Yayın servisine ulaşılamadı.",detail:String(e?.message||e)});
  }
});

app.get("/run/:id",async(req,res)=>{
  if(!authorized(req))return res.status(401).json({ok:false,error:"Yetkisiz istek."});
  if(!TINYFISH_API_KEY)return res.status(503).json({ok:false,error:"TinyFish API anahtarı henüz bağlanmadı."});
  try{
    const r=await fetch("https://agent.tinyfish.ai/v1/automation/runs/"+encodeURIComponent(req.params.id),{
      headers:{"X-API-Key":TINYFISH_API_KEY}
    });
    const text=await r.text();let data={};try{data=JSON.parse(text)}catch{data={raw:text}}
    res.status(r.status).json(data);
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}
});

app.listen(PORT,()=>console.log("Emigro runner listening on",PORT));
