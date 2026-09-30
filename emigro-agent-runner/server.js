import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const app=express();
const PORT=process.env.PORT||10000;
const CONTROL_KEY=process.env.CONTROL_KEY||"";
const PUBLIC_BASE_URL=process.env.PUBLIC_BASE_URL||"";
const BROWSER_PROVIDER=(process.env.BROWSER_PROVIDER||"browserbase").toLowerCase();

const BROWSERBASE_API_KEY=process.env.BROWSERBASE_API_KEY||"";
let BROWSERBASE_CONTEXT_ID=process.env.BROWSERBASE_CONTEXT_ID||"";
let BROWSERBASE_PROJECT_ID=process.env.BROWSERBASE_PROJECT_ID||"";

const TINYFISH_API_KEY=process.env.TINYFISH_API_KEY||"";
const TINYFISH_PROFILE_ID=process.env.TINYFISH_PROFILE_ID||"prof_91c373d0b2654a8f";

const bb=BROWSERBASE_API_KEY?new Browserbase({apiKey:BROWSERBASE_API_KEY}):null;
const jobs=new Map();
const loginSessions=new Map();

const uploadDir="/tmp/emigro-uploads";
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,uploadDir),
  filename:(_,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname||".jpg"))
});
const upload=multer({storage,limits:{files:10,fileSize:15*1024*1024}});

app.use(cors({
  origin:["https://mfatihdumluu-eng.github.io"],
  methods:["GET","POST","OPTIONS"],
  allowedHeaders:["Content-Type","X-Control-Key"]
}));
app.use(express.json({limit:"1mb"}));
app.use("/media",express.static(uploadDir,{maxAge:"1h"}));

function authorized(req){return CONTROL_KEY && req.get("X-Control-Key")===CONTROL_KEY}
function cleanup(files=[]){for(const f of files){try{fs.unlinkSync(f.path)}catch{}}}
function jobUpdate(id,patch){const j=jobs.get(id)||{};jobs.set(id,{...j,...patch,updatedAt:new Date().toISOString()})}
async function ensureBrowserbaseProject(){
  if(!bb) return "";
  if(BROWSERBASE_PROJECT_ID) return BROWSERBASE_PROJECT_ID;
  const projects=await bb.projects.list();
  if(!projects?.length) throw new Error("Browserbase projesi bulunamadı.");
  BROWSERBASE_PROJECT_ID=projects[0].id;
  return BROWSERBASE_PROJECT_ID;
}
async function ensureBrowserbaseContext(){
  if(!bb) return "";
  if(BROWSERBASE_CONTEXT_ID) return BROWSERBASE_CONTEXT_ID;
  const projectId=await ensureBrowserbaseProject();
  const ctx=await bb.contexts.create({projectId,name:"emigro-social-agent-"+Date.now()});
  BROWSERBASE_CONTEXT_ID=ctx.id;
  return BROWSERBASE_CONTEXT_ID;
}
function currentProvider(){
  if(BROWSER_PROVIDER==="browserbase" && BROWSERBASE_API_KEY) return "browserbase";
  if(BROWSER_PROVIDER==="tinyfish" && TINYFISH_API_KEY) return "tinyfish";
  if(BROWSERBASE_API_KEY) return "browserbase";
  if(TINYFISH_API_KEY) return "tinyfish";
  return "none";
}

app.get("/",(_,res)=>res.json({service:"Emigro Social Runner",version:"2.0.0",ok:true}));
app.get("/health",async(_,res)=>{
  const provider=currentProvider();
  try{
    if(provider==="browserbase" && BROWSERBASE_API_KEY && !BROWSERBASE_CONTEXT_ID) await ensureBrowserbaseContext();
  }catch(e){}
  res.json({
    ok:true,
    runner:"render",
    provider,
    browserbaseConfigured:Boolean(BROWSERBASE_API_KEY),
    browserbaseProjectConfigured:Boolean(BROWSERBASE_PROJECT_ID),
    browserbaseProjectId:BROWSERBASE_PROJECT_ID||null,
    browserbaseContextConfigured:Boolean(BROWSERBASE_CONTEXT_ID),
    browserbaseContextId:BROWSERBASE_CONTEXT_ID||null,
    tinyfishConfigured:Boolean(TINYFISH_API_KEY),
    ready:provider==="browserbase"?Boolean(BROWSERBASE_API_KEY&&BROWSERBASE_CONTEXT_ID):provider==="tinyfish"?Boolean(TINYFISH_API_KEY&&TINYFISH_PROFILE_ID):false
  });
});

app.post("/browserbase/context/create",async(req,res)=>{
  if(!authorized(req))return res.status(401).json({ok:false,error:"Yetkisiz istek."});
  if(!bb)return res.status(503).json({ok:false,error:"Browserbase API anahtarı bağlı değil."});
  try{
    const ctx=await bb.contexts.create({name:"emigro-social-agent-"+Date.now()});
    res.json({ok:true,contextId:ctx.id});
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}
});

app.post("/browserbase/login/start",async(req,res)=>{
  if(!authorized(req))return res.status(401).json({ok:false,error:"Yetkisiz istek."});
  if(!bb)return res.status(503).json({ok:false,error:"Browserbase API anahtarı bağlı değil."});
  if(!BROWSERBASE_CONTEXT_ID) await ensureBrowserbaseContext();
  try{
    const projectId=await ensureBrowserbaseProject();
    const session=await bb.sessions.create({
      projectId,
      browserSettings:{context:{id:BROWSERBASE_CONTEXT_ID,persist:true}}
    });
    const browser=await chromium.connectOverCDP(session.connectUrl);
    const context=browser.contexts()[0];
    const page=context.pages()[0]||await context.newPage();
    await page.goto("https://www.facebook.com/",{waitUntil:"domcontentloaded",timeout:60000});
    const debug=await bb.sessions.debug(session.id);
    loginSessions.set(session.id,{browser,startedAt:Date.now()});
    setTimeout(async()=>{
      const x=loginSessions.get(session.id);
      if(x){try{await x.browser.close()}catch{};loginSessions.delete(session.id)}
    },15*60*1000);
    res.json({ok:true,sessionId:session.id,liveViewUrl:debug.debuggerFullscreenUrl});
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}
});

app.post("/browserbase/login/finish/:id",async(req,res)=>{
  if(!authorized(req))return res.status(401).json({ok:false,error:"Yetkisiz istek."});
  const x=loginSessions.get(req.params.id);
  if(!x)return res.status(404).json({ok:false,error:"Aktif giriş oturumu bulunamadı."});
  try{await x.browser.close()}catch{}
  loginSessions.delete(req.params.id);
  res.json({ok:true,message:"Oturum kapatıldı; context birkaç saniye içinde kaydedilir."});
});

async function clickAny(scope,patterns,{timeout=12000}={}){
  for(const pattern of patterns){
    try{
      const loc=scope.getByRole("button",{name:pattern}).first();
      if(await loc.isVisible({timeout:1500})){await loc.click({timeout});return true}
    }catch{}
    try{
      const loc=scope.getByText(pattern,{exact:false}).first();
      if(await loc.isVisible({timeout:1500})){await loc.click({timeout});return true}
    }catch{}
  }
  return false;
}

async function uploadFiles(page,files){
  if(!files?.length)return false;
  const input=page.locator('input[type="file"]').last();
  await input.waitFor({state:"attached",timeout:15000});
  await input.setInputFiles(files.map(f=>f.path));
  return true;
}

async function facebookPost(page,files,caption){
  await page.goto("https://www.facebook.com/",{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForTimeout(1500);
  const opened=await clickAny(page,[/What's on your mind/i,/Wat ben je aan het doen/i,/Waar denk je aan/i,/Ne düşünüyorsun/i,/Bir gönderi oluştur/i,/Create post/i]);
  if(!opened)throw new Error("Facebook gönderi oluşturucu bulunamadı.");
  await page.waitForTimeout(1200);
  const dialog=page.locator('div[role="dialog"]').last();
  if(files?.length){
    const photoClicked=await clickAny(dialog,[/Photo\/video/i,/Foto\/video/i,/Fotoğraf\/video/i]);
    if(photoClicked)await page.waitForTimeout(500);
    await uploadFiles(page,files);
    await page.waitForTimeout(1200);
  }
  if(caption){
    const box=dialog.locator('[contenteditable="true"][role="textbox"],[contenteditable="true"]').first();
    await box.waitFor({state:"visible",timeout:15000});
    await box.click();
    await page.keyboard.insertText(caption);
  }
  const posted=await clickAny(dialog,[/^Post$/i,/^Plaatsen$/i,/^Publiceren$/i,/^Gönder$/i],{timeout:20000});
  if(!posted)throw new Error("Facebook gönderi paylaş düğmesi bulunamadı.");
  await page.waitForTimeout(2500);
  return {published:true};
}

async function facebookStory(page,files){
  if(!files?.length)throw new Error("Facebook Hikâye için görsel gerekli.");
  const results=[];
  for(const file of files){
    await page.goto("https://www.facebook.com/stories/create/",{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForTimeout(1200);
    await clickAny(page,[/Create a photo story/i,/Fotoverhaal maken/i,/Fotoğraf hikayesi oluştur/i,/Photo story/i]);
    await page.waitForTimeout(600);
    await uploadFiles(page,[file]);
    await page.waitForTimeout(1200);
    const shared=await clickAny(page,[/Share to story/i,/Delen in verhaal/i,/Hikâyede paylaş/i,/Share/i],{timeout:20000});
    if(!shared)throw new Error("Facebook Hikâye paylaş düğmesi bulunamadı.");
    await page.waitForTimeout(1800);
    results.push({published:true,file:path.basename(file.path)});
  }
  return {published:true,frames:results.length};
}

async function instagramPost(page,files,caption){
  await page.goto("https://www.instagram.com/",{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForTimeout(1500);
  const created=await clickAny(page,[/^Create$/i,/^Maken$/i,/^Oluştur$/i,/New post/i]);
  if(!created)throw new Error("Instagram Oluştur düğmesi bulunamadı.");
  await page.waitForTimeout(800);
  await clickAny(page,[/^Post$/i,/^Gönderi$/i]);
  if(files?.length)await uploadFiles(page,files);
  else throw new Error("Instagram Gönderi için görsel gerekli.");
  await page.waitForTimeout(1000);
  await clickAny(page,[/^Next$/i,/^Volgende$/i,/^İleri$/i]);
  await page.waitForTimeout(800);
  await clickAny(page,[/^Next$/i,/^Volgende$/i,/^İleri$/i]);
  await page.waitForTimeout(800);
  if(caption){
    const ta=page.locator('textarea[aria-label*="caption" i],textarea,div[contenteditable="true"]').last();
    if(await ta.isVisible({timeout:4000})){await ta.click();await page.keyboard.insertText(caption)}
  }
  const shared=await clickAny(page,[/^Share$/i,/^Delen$/i,/^Paylaş$/i],{timeout:20000});
  if(!shared)throw new Error("Instagram paylaş düğmesi bulunamadı.");
  await page.waitForTimeout(2200);
  return {published:true};
}

async function instagramStory(page,files){
  if(!files?.length)throw new Error("Instagram Hikâye için görsel gerekli.");
  const results=[];
  for(const file of files){
    await page.goto("https://www.instagram.com/",{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForTimeout(1200);
    const created=await clickAny(page,[/^Create$/i,/^Maken$/i,/^Oluştur$/i]);
    if(!created)throw new Error("Instagram Oluştur düğmesi bulunamadı.");
    await page.waitForTimeout(500);
    await clickAny(page,[/^Story$/i,/^Verhaal$/i,/^Hikâye$/i]);
    await page.waitForTimeout(500);
    await uploadFiles(page,[file]);
    await page.waitForTimeout(1000);
    const shared=await clickAny(page,[/^Share$/i,/Share to story/i,/Delen/i,/Paylaş/i],{timeout:20000});
    if(!shared)throw new Error("Instagram Hikâye paylaş düğmesi bulunamadı.");
    await page.waitForTimeout(1600);
    results.push({published:true,file:path.basename(file.path)});
  }
  return {published:true,frames:results.length};
}

async function runBrowserbaseJob(jobId,targets,files,caption){
  let browser=null;
  let sessionId="";
  try{
    jobUpdate(jobId,{status:"RUNNING",startedAt:new Date().toISOString(),provider:"browserbase"});
    const projectId=await ensureBrowserbaseProject();
    const session=await bb.sessions.create({
      projectId,
      browserSettings:{context:{id:BROWSERBASE_CONTEXT_ID,persist:true}}
    });
    sessionId=session.id;
    jobUpdate(jobId,{sessionId});
    browser=await chromium.connectOverCDP(session.connectUrl);
    const context=browser.contexts()[0];
    const page=context.pages()[0]||await context.newPage();
    const results={};

    for(const target of targets){
      try{
        if(target==="Facebook Gönderi")results[target]=await facebookPost(page,files,caption);
        else if(target==="Facebook Hikâye")results[target]=await facebookStory(page,files);
        else if(target==="Instagram Gönderi")results[target]=await instagramPost(page,files,caption);
        else if(target==="Instagram Hikâye")results[target]=await instagramStory(page,files);
        else results[target]={published:false,error:"Bilinmeyen hedef"};
      }catch(e){
        results[target]={published:false,error:String(e?.message||e)};
      }
    }

    const success=Object.values(results).some(x=>x?.published);
    jobUpdate(jobId,{status:success?"COMPLETED":"FAILED",finishedAt:new Date().toISOString(),results});
  }catch(e){
    jobUpdate(jobId,{status:"FAILED",finishedAt:new Date().toISOString(),error:String(e?.message||e),sessionId});
  }finally{
    try{if(browser)await browser.close()}catch{}
    setTimeout(()=>cleanup(files),5*60*1000);
  }
}

async function runTinyfish(targets,files,caption){
  const base=PUBLIC_BASE_URL.replace(/\/$/,"");
  const media=(files||[]).map(f=>base+"/media/"+encodeURIComponent(path.basename(f.path)));
  const goal=[
    "You are operating the user's authorized personal/business social media session.",
    "Publish the supplied content ONLY to these selected destinations: "+targets.join(", ")+".",
    "Caption text: "+JSON.stringify(caption)+".",
    media.length?"Media URLs, in order: "+media.join(" , "):"No media files.",
    "For Instagram/Facebook Post with multiple images, create one multi-image/carousel post where the site supports it.",
    "For Instagram/Facebook Story with multiple images, publish them as consecutive story frames in the same order.",
    "Do not alter account settings, follow/unfollow, message anyone, react, or perform any unrelated action.",
    "If the session is logged out, requires MFA, CAPTCHA, or the requested destination is unavailable, STOP without publishing elsewhere and report the blocker."
  ].join("\n");
  const r=await fetch("https://agent.tinyfish.ai/v1/automation/run-async",{
    method:"POST",
    headers:{"X-API-Key":TINYFISH_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({url:"https://www.facebook.com/",goal,browser_profile:"lite",use_profile:true,profile_id:TINYFISH_PROFILE_ID})
  });
  const text=await r.text();let data={};try{data=JSON.parse(text)}catch{data={raw:text}}
  if(!r.ok)throw new Error("TinyFish başlatılamadı: "+text);
  return data;
}

app.post("/publish",upload.array("images",10),async(req,res)=>{
  if(!authorized(req)){cleanup(req.files);return res.status(401).json({ok:false,error:"Yetkisiz istek."});}
  const targets=JSON.parse(req.body.targets||"[]");
  const caption=(req.body.caption||"").trim();
  if(!targets.length){cleanup(req.files);return res.status(400).json({ok:false,error:"En az bir paylaşım türü seçin."});}
  if(!caption && !(req.files||[]).length){cleanup(req.files);return res.status(400).json({ok:false,error:"Metin veya görsel gerekli."});}

  const provider=currentProvider();
  if(provider==="browserbase"){
    if(!BROWSERBASE_CONTEXT_ID) await ensureBrowserbaseContext();
    const jobId=crypto.randomUUID();
    jobs.set(jobId,{id:jobId,status:"PENDING",provider:"browserbase",createdAt:new Date().toISOString(),targets});
    runBrowserbaseJob(jobId,targets,req.files||[],caption);
    return res.json({ok:true,status:"started",provider:"browserbase",run:{id:jobId,runId:jobId}});
  }

  if(provider==="tinyfish"){
    try{
      const data=await runTinyfish(targets,req.files||[],caption);
      setTimeout(()=>cleanup(req.files),60*60*1000);
      return res.json({ok:true,status:"started",provider:"tinyfish",run:data});
    }catch(e){cleanup(req.files);return res.status(500).json({ok:false,error:String(e?.message||e)})}
  }

  cleanup(req.files);
  return res.status(503).json({ok:false,error:"Hiçbir uzak tarayıcı sağlayıcısı yapılandırılmadı."});
});

app.get("/run/:id",async(req,res)=>{
  if(!authorized(req))return res.status(401).json({ok:false,error:"Yetkisiz istek."});
  if(jobs.has(req.params.id))return res.json(jobs.get(req.params.id));

  if(TINYFISH_API_KEY){
    try{
      const r=await fetch("https://agent.tinyfish.ai/v1/automation/runs/"+encodeURIComponent(req.params.id),{headers:{"X-API-Key":TINYFISH_API_KEY}});
      const text=await r.text();let data={};try{data=JSON.parse(text)}catch{data={raw:text}}
      return res.status(r.status).json(data);
    }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e)})}
  }
  res.status(404).json({ok:false,error:"Çalışma bulunamadı."});
});

app.listen(PORT,()=>console.log("Emigro runner v2 listening on",PORT));
