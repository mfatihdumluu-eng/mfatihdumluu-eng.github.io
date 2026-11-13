import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import pg from 'pg';
import {scryptSync,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import {compareSupplierMonth} from './engine.mjs';
import {readFile} from 'node:fs/promises';
import {encryptSecret,decryptSecret,probeMindee,secretKey} from './mindee.mjs';
import {extractMindeeInvoice} from './mindee-invoice.mjs';
import {getMindeeModels} from './mindee-models.mjs';
import nodemailer from 'nodemailer';
const app=Fastify({logger:true,bodyLimit:2_000_000,trustProxy:false});
await app.register(cookie);
await app.register(rateLimit,{max:150,timeWindow:'1 minute'});
await app.register(multipart,{limits:{files:1,fileSize:10*1024*1024,fields:5}});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
const audit=async(actor,action,type,id,details={})=>db.query('INSERT INTO audit_events(actor_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)',[actor||null,action,type,String(id??''),JSON.stringify(details)]);
const passOk=(pass,hashed)=>{try{const [salt,expected]=hashed.split(':');const actual=scryptSync(pass,salt,64),a=Buffer.from(expected,'hex');return actual.length===a.length&&timingSafeEqual(actual,a)}catch{return false}};
const deny=(reply,status,message)=>reply.code(status).send({error:message});
const isAdmin=u=>u.role==='admin'||u.role==='system';
const hasBranch=(u,b)=>isAdmin(u)||Number(b)===Number(u.branch_id);
const monthOk=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'');
const isMindeeModelUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
const invoiceDateOk=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d));
app.addHook('onRequest',async(req,reply)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.method!=='OPTIONS'&&req.url!=='/api/login'){
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)return deny(reply,403,'Cross-origin mutation blocked');
 }
 if(!req.url.startsWith('/api')||req.url==='/api/login')return;
 const token=req.cookies.invoice_sid;
 if(!token)return deny(reply,401,'Oturum gerekli');
 const hash=createHash('sha256').update(token).digest('hex');
 const r=await db.query('SELECT u.id,u.name,u.email,u.role,u.branch_id FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash]);
 if(!r.rowCount)return deny(reply,401,'Oturum geçersiz');
 req.user=r.rows[0];req.tokenHash=hash;
});
app.get('/health',async()=>({ok:true,service:'invoice-control'}));

// Mindee V2: status is always based on an actual 200 response to
// GET https://api-v2.mindee.net/v2/search/models. Never report green just
// because an API key was pasted or stored.
async function requireSystemSession(req,reply,{redirectToLogin=false}={}){
 const token=req.cookies?.invoice_sid;
 if(!token){if(redirectToLogin)reply.redirect('/admin/login');else deny(reply,401,'Sistem admini girişi gerekli');return null}
 const hash=createHash('sha256').update(token).digest('hex');
 const r=await db.query('SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash]);
 if(!r.rowCount){if(redirectToLogin)reply.redirect('/admin/login');else deny(reply,401,'Oturum süresi doldu');return null}
 if(r.rows[0].role!=='system'){deny(reply,403,'Yalnızca Sistem Admini');return null}
 return r.rows[0];
}
app.get('/admin/login',async(req,reply)=>{
 const html=await readFile(new URL('../mindee-login.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private')
  .header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
app.get('/admin/invoices',async(req,reply)=>{
 const user=await requireSystemSession(req,reply,{redirectToLogin:true});if(!user)return;
 const html=await readFile(new URL('../mindee-archive.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private').header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
app.get('/admin/invoice-reader',async(req,reply)=>{
 const user=await requireSystemSession(req,reply,{redirectToLogin:true});if(!user)return;
 const html=await readFile(new URL('../mindee-reader.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private').header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
app.get('/admin/mindee',async(req,reply)=>{
 const user=await requireSystemSession(req,reply,{redirectToLogin:true});if(!user)return;
 const html=await readFile(new URL('../mindee-admin.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private')
  .header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
async function readMindeeSettings(){
 const r=await db.query('SELECT encrypted_secret,model_id,connection_status,verified_at,last_error FROM service_integrations WHERE provider=$1',['mindee']);
 return r.rows[0]||null;
}
async function mindeeStatus(check=false){
 const stored=await readMindeeSettings();
 if(!stored)return{status:'disconnected',connected:false,configured:false,message:'Mindee API anahtarı henüz eklenmedi.',checkedAt:null,modelId:''};
 const payload={configured:true,modelId:stored.model_id||'',keySaved:true};
 // A status is "connected" only when the last check is fresh.
 if(!check){
  const recent=stored.connection_status==='connected'&&stored.verified_at&&
   Date.now()-new Date(stored.verified_at).getTime()<300_000;
  return{...payload,status:recent?'connected':'disconnected',connected:Boolean(recent),
   message:recent?'Mindee bağlantısı yakın zamanda doğrulandı.':'Bağlantı yeniden kontrol edilmeli.',
   checkedAt:stored.verified_at||null};
 }
 let probe;
 try{
  const key=decryptSecret(stored.encrypted_secret,secretKey());
  probe=await probeMindee(key);
 }catch(error){
  probe={connected:false,message:'Mindee sunucu şifreleme ayarı eksik veya anahtar çözülemiyor.',code:'SERVER_KEY'};
 }
 const checkedAt=new Date().toISOString();
 await db.query('UPDATE service_integrations SET connection_status=$1,verified_at=$2,last_error=$3 WHERE provider=$4',
  [probe.connected?'connected':'disconnected',probe.connected?checkedAt:null,probe.connected?null:probe.message,'mindee']);
 return{...payload,status:probe.connected?'connected':'disconnected',connected:probe.connected,
  checkedAt:probe.connected?checkedAt:null,message:probe.message,code:probe.code};
}
app.get('/api/admin/mindee/status',{config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 try{return await mindeeStatus(req.query?.check==='1')}
 catch(error){req.log.error({error:error.message},'Mindee status failed');return deny(reply,503,'Mindee entegrasyon yapılandırması bulunamadı. Sunucu veritabanını güncelleyin.')}
});
app.get('/api/admin/mindee/models',{config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const stored=await readMindeeSettings();
 if(!stored)return deny(reply,409,'Önce Mindee API anahtarını bir kez kaydet.');
 try{
  const key=decryptSecret(stored.encrypted_secret,secretKey());
  const models=await getMindeeModels(key);
  return reply.header('Cache-Control','no-store').send({items:models,selectedId:stored.model_id||''});
 }catch(e){
  req.log.warn({err:String(e.message).slice(0,160)},'Mindee model discovery error');
  return deny(reply,502,'Mindee modelleri getirilemedi. Anahtarın erişim yetkisini kontrol et.');
 }
});
app.post('/api/admin/mindee/settings',{config:{rateLimit:{max:6,timeWindow:'5 minutes'}}},async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const rawKey=req.body?.apiKey,modelId=req.body?.modelId;
 if(modelId!==undefined&&(typeof modelId!=='string'||modelId.length>120||!/^[A-Za-z0-9_-]*$/.test(modelId)))
  return deny(reply,400,'Model ID geçersiz.');
 const stored=await readMindeeSettings();
 // A blank password field means "keep the existing API key"; never require
 // pasting the secret again just to choose a model or refresh the page.
 const replaceKey=typeof rawKey==='string'&&rawKey.trim()!=='';
 if(!replaceKey&&!stored)return deny(reply,400,'Mindee API anahtarını ilk defa kaydetmen gerekiyor.');
 let encrypted=stored?.encrypted_secret,clearKey;
 try{
  if(replaceKey){
   clearKey=rawKey.trim();
   if(clearKey.length<8||clearKey.length>500||!/^md_[A-Za-z0-9_-]+$/.test(clearKey))
    return deny(reply,400,'Mindee V2 anahtar biçimi geçersiz (md_...).');
   encrypted=encryptSecret(clearKey,secretKey());
  }else{clearKey=decryptSecret(stored.encrypted_secret,secretKey())}
 }catch{return deny(reply,503,'Sunucu şifreleme ayarları doğrulanamadı.')}
 let nextModel=modelId===undefined?(stored?.model_id||''):modelId.trim();
 if(nextModel&&!isMindeeModelUuid(nextModel)){
  // Users sometimes paste a display name / slug instead of Mindee's UUID.
  // Resolve it only when there is a uniquely matching model in this account.
  let models;
  try{models=await getMindeeModels(clearKey)}
  catch{return deny(reply,502,'Mindee modellerine erişilemedi. Modelleri Getir düğmesini kullan.')}
  const matches=models.filter(m=>m.name.toLowerCase()===nextModel.toLowerCase()||m.id===nextModel);
  if(matches.length===1&&isMindeeModelUuid(matches[0].id))nextModel=matches[0].id;
  else if(models.length===1&&isMindeeModelUuid(models[0].id))nextModel=models[0].id;
  else return deny(reply,400,'Model ID UUID biçiminde olmalı. Modelleri Getir düğmesinden faturaya ait modeli seç. Model adını ID alanına yazma.');
 }
 // Only verify new/updated key, never pretend that a fresh saved key is connected
 // when Mindee gives an authentication error.
 const test=await probeMindee(clearKey),verified=test.connected?new Date().toISOString():null;
 await db.query('INSERT INTO service_integrations(provider,encrypted_secret,model_id,connection_status,verified_at,last_error,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider) DO UPDATE SET encrypted_secret=EXCLUDED.encrypted_secret,model_id=EXCLUDED.model_id,connection_status=EXCLUDED.connection_status,verified_at=EXCLUDED.verified_at,last_error=EXCLUDED.last_error,updated_by=EXCLUDED.updated_by,updated_at=now()',
  ['mindee',encrypted,nextModel||null,test.connected?'connected':'disconnected',verified,test.connected?null:test.message,req.user.id]);
 await audit(req.user.id,'update','integration','mindee',{keyChanged:replaceKey,connected:test.connected,modelConfigured:Boolean(nextModel)});
 return{status:test.connected?'connected':'disconnected',connected:test.connected,configured:true,
  keySaved:true,modelId:nextModel,checkedAt:verified,message:test.message};
});
app.delete('/api/admin/mindee/settings',async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 await db.query('DELETE FROM service_integrations WHERE provider=$1',['mindee']);
 await audit(req.user.id,'delete','integration','mindee');
 return{ok:true,status:'disconnected',connected:false};
});


app.post('/api/admin/mindee/extract',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const config=await readMindeeSettings();
 if(!config)return deny(reply,409,'Önce Mindee API anahtarını kaydet.');
 let key;
 try{key=decryptSecret(config.encrypted_secret,secretKey())}
 catch{return deny(reply,503,'Mindee API şifre çözme hatası. Sistem ayarlarını kontrol edin.')}
 let chosenModel=config.model_id;
 if(!isMindeeModelUuid(chosenModel)){
  try{
   const models=await getMindeeModels(key);
   const matching=models.filter(m=>m.id===chosenModel||m.name.toLowerCase()===String(chosenModel||'').toLowerCase());
   if(matching.length===1&&isMindeeModelUuid(matching[0].id))chosenModel=matching[0].id;
   else if(models.length===1&&isMindeeModelUuid(models[0].id))chosenModel=models[0].id;
   if(isMindeeModelUuid(chosenModel)){
    await db.query('UPDATE service_integrations SET model_id=$1,updated_at=now() WHERE provider=$2',[chosenModel,'mindee']);
   }else if(models.length===0){
    return deny(reply,409,'Mindee hesabında geçerli UUID içeren Extraction modeli bulunamadı. app.mindee.com üzerinden model oluştur.');
   }else{
    return deny(reply,409,'Geçerli model UUID seçilmedi. API Ayarları → Modelleri Getir bölümünden fatura modelini seç.');
   }
  }catch(e){if(e?.statusCode||e?.code==='DB_ERROR')throw e;return deny(reply,502,'Mindee modelleri alınamadı. API ayarlarına girip bağlantıyı kontrol et.')}
 }
 let part;
 try{part=await req.file()}
 catch{return deny(reply,400,'PDF/JPG/PNG dosyası gerekli (en fazla 10 MB)')}
 if(!part)return deny(reply,400,'Dosya seçilmedi');
 const allowed={
  'application/pdf':true,'image/jpeg':true,'image/png':true,'image/webp':true
 };
 if(!allowed[part.mimetype]){part.file.resume();return deny(reply,415,'Yalnızca PDF, JPG, PNG veya WebP kabul edilir')}
 const filename=String(part.filename||'invoice.pdf').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,100);
 let buffer;
 try{buffer=await part.toBuffer()}
 catch{return deny(reply,413,'Dosya çok büyük veya okunamadı')}
 if(buffer.length===0||buffer.length>10*1024*1024)return deny(reply,413,'Dosya boyutu 1 bayt–10 MB olmalı');
 const isPdf=part.mimetype==='application/pdf'&&buffer.subarray(0,5).toString('utf8')==='%PDF-';
 const isJpeg=part.mimetype==='image/jpeg'&&buffer[0]===0xff&&buffer[1]===0xd8;
 const isPng=part.mimetype==='image/png'&&buffer.subarray(0,4).equals(Buffer.from([137,80,78,71]));
 const isWebp=part.mimetype==='image/webp'&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
 if(!(isPdf||isJpeg||isPng||isWebp))return deny(reply,415,'Dosya biçimi geçersiz veya uzantısıyla uyuşmuyor');
 try{
  const result=await extractMindeeInvoice(key,chosenModel,{data:buffer,filename});
  await audit(req.user.id,'extract','integration','mindee',{fileType:part.mimetype,lines:result.items.length,warnings:result.warnings.length});
  return reply.header('Cache-Control','no-store').send({provider:'mindee-v2',modelConfigured:true,requiresReview:true,...result});
 }catch(err){
  const detail=String(err?.message||'');
  const status=Number(err?.status||err?.statusCode||err?.httpStatus||0);
  req.log.warn({errorType:String(err?.name||'Error').slice(0,60),httpStatus:status||undefined,
   message:detail.slice(0,180)},'Mindee extraction failed');
  // Only return a safe classification, never raw provider error responses
  // that could contain filenames, customer information or credentials.
  let message='Mindee belge çıkarımı başarısız. Sunucu kayıtlarında ayrıntı bulunuyor.';
  if(status===401||/unauthori[sz]ed|invalid api key|api.key.*invalid/i.test(detail))
   message='Mindee API anahtarı reddedildi (401). Sistem Admini → API Ayarları bölümünü kontrol et.';
  else if(status===403||/forbidden/i.test(detail))
   message='Mindee hesabının bu modele erişim yetkisi yok (403).';
  else if(status===404||/model.{0,35}not found|unknown model/i.test(detail))
   message='Mindee Model ID bulunamadı. API Ayarları → Modelleri Getir bölümünden doğru modeli seç.';
  else if(status===429||/rate.limit|too many requests/i.test(detail))
   message='Mindee istek sınırına ulaşıldı (429).';
  else if(/timeout|timed out|polling retries/i.test(detail))
   message='Mindee fatura işleme zaman aşımına uğradı. Daha sonra tekrar dene.';
  else if(/ClientV2 is not a constructor|BufferInput is not a constructor|enqueueAndGetResult is not a function|SDK incompatible/i.test(detail))
   message='Mindee yazılım entegrasyonu hatası. Bu sorun API anahtarından kaynaklanmıyor.';
  else if(status===400||status===422)
   message='Mindee belgeyi veya model parametrelerini kabul etmedi ('+status+'). Dosya biçimini ve modeli kontrol et.';
  return reply.code(502).send({error:message,code:status||'EXTRACTION_FAILED'});
 }
});

// Private OCR review archive. An extracted invoice is NOT saved until a user
// clicks Save. Records are not used by price comparisons until separately approved.
app.get('/api/admin/mindee/invoices',async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const result=await db.query('SELECT id,supplier_name,invoice_number,invoice_date,created_at,total_gross,status,jsonb_array_length(items) AS item_count FROM mindee_invoice_reviews ORDER BY created_at DESC LIMIT 200');
 return reply.header('Cache-Control','no-store').send({items:result.rows});
});
app.get('/api/admin/mindee/invoices/:id',async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const result=await db.query('SELECT * FROM mindee_invoice_reviews WHERE id=$1',[req.params.id]);
 if(!result.rowCount)return deny(reply,404,'Fatura bulunamadı');
 return reply.header('Cache-Control','no-store').send({invoice:result.rows[0]});
});
app.post('/api/admin/mindee/invoices',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const b=req.body||{},items=b.items;
 const supplier=String(b.supplier||'').trim(),number=String(b.invoiceNumber||'').trim();
 if(!supplier||supplier.length>160||!number||number.length>120)return deny(reply,400,'Tedarikçi ve fatura numarası gerekli.');
 if(!Array.isArray(items)||!items.length||items.length>400)return deny(reply,400,'En az bir ürün satırı gerekli.');
 const date=b.date||null,due=b.dueDate||null;
 if(date&&!invoiceDateOk(date)||due&&!invoiceDateOk(due))return deny(reply,400,'Fatura tarihi geçersiz.');
 for(const it of items){
  if(!it||typeof it.name!=='string'||!it.name.trim()||it.name.length>500||
   !(Number(it.qty)>0)||!Number.isFinite(Number(it.price))||Number(it.price)<0)
   return deny(reply,400,'Ürün adı, miktarı veya birim fiyatı eksik.');
  if(it.lineTotal!=null&&Math.abs(Number(it.qty)*Number(it.price)-Number(it.lineTotal))>.04)
   return deny(reply,400,'Ürün satır toplamları uyuşmuyor. Önce düzelt.');
 }
 const parseAmount=value=>value==null||value===''?null:Number(value);
 const net=parseAmount(b.totalNet),tax=parseAmount(b.totalTax),gross=parseAmount(b.totalGross),discount=parseAmount(b.discount);
 if([net,tax,gross,discount].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>100000000)))
  return deny(reply,400,'Fatura toplam tutarları geçersiz.');
 if(net!==null&&tax!==null&&gross!==null&&Math.abs(net+tax-gross)>.05)
  return deny(reply,400,'Ara toplam + BTW genel toplamla uyuşmuyor.');
 const subtotal=items.reduce((sum,it)=>sum+Number(it.qty)*Number(it.price),0);
 if(net!==null&&Math.abs(subtotal-(discount||0)-net)>.05)
  return deny(reply,400,'Ürün satır toplamı - iskonto faturanın ara toplamına eşit değil.');
 const compact=items.map(it=>({name:it.name.trim(),ean:String(it.ean||'').slice(0,80),
  qty:Number(it.qty),price:Number(it.price),
  lineTotal:it.lineTotal==null?null:Number(it.lineTotal),vatRate:it.vatRate==null?null:Number(it.vatRate)}));
 const warnings=Array.isArray(b.warnings)?b.warnings.filter(x=>typeof x==='string').slice(0,100).map(x=>x.slice(0,400)):[];
 const result=await db.query(
  'INSERT INTO mindee_invoice_reviews(created_by,supplier_name,invoice_number,invoice_date,due_date,total_net,total_tax,total_gross,discount,items,warnings) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
  [req.user.id,supplier,number,date,due,net,tax,gross,discount,JSON.stringify(compact),JSON.stringify(warnings)]
 );
 await audit(req.user.id,'create','mindee_invoice',result.rows[0].id,{items:compact.length});
 return reply.code(201).send({id:result.rows[0].id,status:'review',message:'Fatura inceleme listesine kaydedildi'});
});
app.post('/api/login',{config:{rateLimit:{max:10,timeWindow:'5 minutes'}}},async(req,reply)=>{
 const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||'');
 const r=await db.query('SELECT * FROM users WHERE lower(email)=$1 AND active=true',[email]);
 if(!r.rowCount||!passOk(password,r.rows[0].password_hash))return deny(reply,401,'Giriş bilgileri yanlış');
 const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
 await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'8 hours\')',[hash,r.rows[0].id]);
 reply.setCookie('invoice_sid',token,{httpOnly:true,secure:process.env.COOKIE_SECURE!=='false',sameSite:'strict',path:'/',maxAge:8*3600});
 await audit(r.rows[0].id,'login','session','');
 return{user:{name:r.rows[0].name,email,role:r.rows[0].role,branch_id:r.rows[0].branch_id}};
});
app.post('/api/logout',async(req,reply)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.tokenHash]);reply.clearCookie('invoice_sid',{path:'/'});return{ok:true}});
app.get('/api/me',async(req)=>({user:req.user}));
app.get('/api/branches',async(req)=>{const p=isAdmin(req.user)?[]:[req.user.branch_id];const q=isAdmin(req.user)?'SELECT id,name,address FROM branches ORDER BY id':'SELECT id,name,address FROM branches WHERE id=$1';return{items:(await db.query(q,p)).rows}});
app.get('/api/suppliers',async()=>({items:(await db.query('SELECT id,name,kvk,vat_id,email,company_email,contact_person,address,phone,website,active FROM suppliers ORDER BY name')).rows}));
app.post('/api/suppliers',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');
 const {name,kvk,vat_id,email}=req.body||{};
 if(typeof name!=='string'||name.trim().length<2||name.length>160)return deny(reply,400,'Tedarikçi adı gerekli');
 const r=await db.query('INSERT INTO suppliers(name,kvk,vat_id,email) VALUES($1,$2,$3,$4) RETURNING *',[name.trim(),kvk||null,vat_id||null,email||null]);
 await audit(req.user.id,'create','supplier',r.rows[0].id);
 return reply.code(201).send(r.rows[0])
});

app.get('/api/suppliers/:id',async(req,reply)=>{
 const r=await db.query('SELECT id,name,kvk,vat_id,email,company_email,contact_person,address,phone,website,active FROM suppliers WHERE id=$1',[req.params.id]);
 if(!r.rowCount)return deny(reply,404,'Tedarikçi bulunamadı');
 return{supplier:r.rows[0]}
});
app.patch('/api/suppliers/:id',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Firma kartını yalnızca admin güncelleyebilir');
 const keys=['name','kvk','vat_id','email','company_email','contact_person','address','phone','website'];
 const values=[],columns=[];const input=req.body||{};
 for(const key of keys){
   if(!(key in input))continue;
   const value=input[key]===null?'':input[key];
   if(typeof value!=='string'||value.length>500)return deny(reply,400,'Alan türü veya uzunluğu geçersiz: '+key);
   if(key==='name'&&value.trim().length<2)return deny(reply,400,'Firma adı en az iki karakter olmalı');
   if(['email','company_email'].includes(key)&&value.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))return deny(reply,400,'Geçersiz e-posta');
   values.push(value.trim()||null);
   columns.push(key+'=$'+values.length);
 }
 if(!columns.length)return deny(reply,400,'Güncellenecek alan bulunamadı');
 values.push(req.params.id);
 const r=await db.query('UPDATE suppliers SET '+columns.join(',')+' WHERE id=$'+values.length+' RETURNING id,name,kvk,vat_id,email,company_email,contact_person,address,phone,website,active',values);
 if(!r.rowCount)return deny(reply,404,'Tedarikçi bulunamadı');
 await audit(req.user.id,'update','supplier',req.params.id,{fields:keys.filter(key=>key in input)});
 return{supplier:r.rows[0]};
});
app.get('/api/users',async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Sistem admini gerekli');
 return{items:(await db.query('SELECT id,name,email,role,branch_id,active FROM users ORDER BY role,email')).rows};
});
app.get('/api/invoices',async(req,reply)=>{
 const {month,branch_id,supplier_id}=req.query||{};if(!monthOk(month))return deny(reply,400,'YYYY-MM gerekli');
 if(branch_id&&!hasBranch(req.user,branch_id))return deny(reply,403,'Şube erişimi yok');
 const vals=[month+'-01'],conds=['invoice_date >= $1::date',"(invoice_date < ($1::date + interval '1 month'))"];
 if(!isAdmin(req.user)){vals.push(req.user.branch_id);conds.push('branch_id=$'+vals.length)}
 else if(branch_id){vals.push(branch_id);conds.push('branch_id=$'+vals.length)}
 if(supplier_id){vals.push(supplier_id);conds.push('supplier_id=$'+vals.length)}
 const r=await db.query('SELECT id,supplier_id,branch_id,invoice_number,invoice_date,status,created_at FROM invoices WHERE '+conds.join(' AND ')+' ORDER BY invoice_date DESC,id LIMIT 500',vals);
 return{items:r.rows}
});
app.get('/api/invoices/:id',async(req,reply)=>{
 const r=await db.query('SELECT * FROM invoices WHERE id=$1',[req.params.id]);
 if(!r.rowCount)return deny(reply,404,'Fatura bulunamadı');const invoice=r.rows[0];if(!hasBranch(req.user,invoice.branch_id))return deny(reply,403,'Şube erişimi yok');
 const lines=await db.query('SELECT id,product_id,raw_description,raw_ean,raw_sku,quantity,unit_net,vat_rate,discount_net,normalized_net_price FROM invoice_lines WHERE invoice_id=$1',[invoice.id]);
 return{invoice:{...invoice,document_path:undefined,document_hash:undefined},lines:lines.rows}
});
app.post('/api/invoices',async(req,reply)=>{
 const body=req.body||{},branch_id=Number(body.branch_id),supplier_id=body.supplier_id,invoice_number=String(body.invoice_number||''),invoice_date=body.invoice_date,items=body.items;
 if(!Number.isInteger(branch_id)||!hasBranch(req.user,branch_id))return deny(reply,403,'Şube erişimi yok');
 if(!invoiceDateOk(invoice_date)||invoice_number.length<1||invoice_number.length>120||!Array.isArray(items)||!items.length||items.length>500)return deny(reply,400,'Eksik fatura bilgisi');
 for(const row of items)if(!row.raw_description||row.raw_description.length>500||!(Number(row.quantity)>0)||!(Number(row.unit_net)>=0)||!Number.isFinite(Number(row.unit_net)))return deny(reply,400,'Geçersiz ürün satırı');
 const client=await db.connect();try{
  await client.query('BEGIN');
  const i=await client.query('INSERT INTO invoices(supplier_id,branch_id,invoice_number,invoice_date,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[supplier_id,branch_id,invoice_number,invoice_date,req.user.id]);
  for(const line of items){
    let productId=null;
    if(line.ean){const p=await client.query('SELECT id FROM products WHERE ean=$1',[String(line.ean)]);productId=p.rows[0]?.id||null}
    if(!productId&&line.supplier_sku){const p=await client.query('SELECT product_id FROM supplier_skus WHERE supplier_id=$1 AND supplier_sku=$2',[supplier_id,String(line.supplier_sku)]);productId=p.rows[0]?.product_id||null}
    await client.query('INSERT INTO invoice_lines(invoice_id,product_id,raw_description,raw_ean,raw_sku,quantity,unit_net,vat_rate,discount_net,normalized_quantity,normalized_net_price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$6,$7)',[i.rows[0].id,productId,line.raw_description,line.ean||null,line.supplier_sku||null,line.quantity,line.unit_net,line.vat_rate||0,line.discount_net||0]);
  }
  await client.query('COMMIT');await audit(req.user.id,'create','invoice',i.rows[0].id,{branch_id,supplier_id});return reply.code(201).send({id:i.rows[0].id,status:'review',message:'Kaydedildi; ürün eşleştirmesi ve insan kontrolü gerekli'})
 }catch(e){await client.query('ROLLBACK');if(e.code==='23505')return deny(reply,409,'Bu şube ve tedarikçide aynı numaralı fatura var');throw e}finally{client.release()}
});
app.get('/api/search',async(req,reply)=>{
 const q=String(req.query?.q||'').trim().slice(0,120),brand_id=req.query?.brand_id;
 const vals=['%'+q+'%'],cond=['(p.name ILIKE $1 OR p.ean ILIKE $1 OR b.name ILIKE $1)'];
 if(brand_id){vals.push(brand_id);cond.push('p.brand_id=$'+vals.length)}
 const r=await db.query('SELECT p.id,p.ean,p.name,p.unit,b.name AS brand FROM products p LEFT JOIN brands b ON b.id=p.brand_id WHERE '+cond.join(' AND ')+' ORDER BY p.name LIMIT 100',vals);return{items:r.rows}
});
app.get('/api/compare',async(req,reply)=>{
 const {month,supplier_id,branch_id}=req.query||{};if(!monthOk(month)||!supplier_id)return deny(reply,400,'YYYY-MM ve supplier_id gerekli');
 if(branch_id&&!hasBranch(req.user,branch_id))return deny(reply,403,'Şube erişimi yok');
 const r=await db.query(`SELECT i.id AS invoice_id,i.branch_id,i.supplier_id,i.invoice_date,l.product_id,p.name AS product_name,p.ean,p.unit,l.quantity,COALESCE(l.normalized_net_price,l.unit_net) AS unit_net FROM invoice_lines l JOIN invoices i ON i.id=l.invoice_id JOIN products p ON p.id=l.product_id WHERE i.supplier_id=$1 AND i.invoice_date >= $2::date AND i.invoice_date < ($2::date+interval '1 month') AND i.status<>'cancelled'`,[supplier_id,month+'-01']);
 const result=compareSupplierMonth(r.rows);
 if(req.user.role==='branch')return{items:result.filter(x=>x.branches.some(b=>Number(b.branch_id)===Number(req.user.branch_id))).map(x=>({...x,branches:undefined,own_price:x.branches.find(b=>Number(b.branch_id)===Number(req.user.branch_id))?.unit_net,comparison_branches:x.branches.length,estimated_difference:undefined}))};
 return{items:branch_id?result.filter(x=>x.branches.some(b=>Number(b.branch_id)===Number(branch_id))):result}
});
app.get('/api/compare/detail',async(req,reply)=>{
 const {month,supplier_id,product_id}=req.query||{};
 if(!monthOk(month)||!supplier_id||!product_id)return deny(reply,400,'Ay, tedarikçi ve ürün gerekli');
 const rows=(await db.query(`SELECT i.id AS invoice_id,i.invoice_number,i.invoice_date,i.branch_id,b.name AS branch_name,
 l.quantity,COALESCE(l.normalized_net_price,l.unit_net) AS net_unit_price
 FROM invoices i JOIN invoice_lines l ON l.invoice_id=i.id
 JOIN branches b ON b.id=i.branch_id
 WHERE i.supplier_id=$1 AND l.product_id=$2 AND i.invoice_date >=$3::date
 AND i.invoice_date < ($3::date+interval '1 month') AND i.status<>'cancelled'
 ORDER BY i.branch_id,i.invoice_date`,[supplier_id,product_id,month+'-01'])).rows;
 if(!rows.length)return deny(reply,404,'Karşılaştırma satırı bulunamadı');
 const minimum=Math.min(...rows.map(r=>Number(r.net_unit_price)));
 const own=rows.filter(r=>hasBranch(req.user,r.branch_id));
 const mapped=own.map(r=>{
   const price=Number(r.net_unit_price),qty=Number(r.quantity);
   return {invoice_id:r.invoice_id,invoice_number:r.invoice_number,invoice_date:r.invoice_date,
     branch_id:r.branch_id,branch_name:r.branch_name,quantity:qty,price_net:price,
     reference_net:minimum,unit_difference:Math.round((price-minimum)*10000)/10000,
     estimated_difference:Math.round(Math.max(0,price-minimum)*qty*100)/100};
 });
 if(!isAdmin(req.user)){
   return {month,supplier_id,product_id,comparison_basis:'same supplier, canonical product, unit and month',
     own_invoices:mapped,anonymous_reference:{lowest_net:minimum,other_branches_compared:new Set(rows.filter(r=>r.branch_id!==req.user.branch_id).map(r=>r.branch_id)).size},
     total_possible_difference:mapped.reduce((v,r)=>v+r.estimated_difference,0),notice:'Other branches invoices and identities are intentionally not provided'};
 }
 return {month,supplier_id,product_id,reference_net:minimum,
   invoices:mapped,total_possible_difference:mapped.reduce((v,r)=>v+r.estimated_difference,0),
   notice:'Investigation signal: validate contracts, invoice discounts, tiered pricing, and unit conversion'};
});
app.get('/api/reports',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');const month=req.query?.month;if(!monthOk(month))return deny(reply,400,'YYYY-MM gerekli');
 const r=await db.query(`SELECT s.id AS supplier_id,s.name AS supplier,COUNT(DISTINCT i.id) AS invoice_count,COALESCE(SUM(l.quantity*l.unit_net),0) AS invoiced_net FROM suppliers s LEFT JOIN invoices i ON i.supplier_id=s.id AND i.invoice_date >=$1::date AND i.invoice_date < ($1::date+interval '1 month') LEFT JOIN invoice_lines l ON l.invoice_id=i.id GROUP BY s.id,s.name ORDER BY s.name`,[month+'-01']);return{month,items:r.rows}
});
app.post('/api/disputes',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');let {supplier_id,invoice_id,subject,body}=req.body||{};
 if(typeof subject!=='string'||subject.length<5||subject.length>250||typeof body!=='string'||body.length<10||body.length>10000)return deny(reply,400,'İtiraz metni gerekli');
 const r=await db.query('INSERT INTO disputes(supplier_id,invoice_id,subject,body,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,status',[supplier_id,invoice_id||null,subject,body,req.user.id]);await audit(req.user.id,'create','dispute',r.rows[0].id);return reply.code(201).send(r.rows[0])
});
app.get('/api/disputes',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');
 return{items:(await db.query('SELECT d.id,d.supplier_id,s.name AS supplier,d.invoice_id,d.subject,d.status,d.created_at,d.sent_at FROM disputes d JOIN suppliers s ON d.supplier_id=s.id ORDER BY d.created_at DESC LIMIT 200')).rows}
});
app.post('/api/disputes/:id/approve',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');
 const r=await db.query("UPDATE disputes SET status='approved',approved_by=$2 WHERE id=$1 AND status='draft' RETURNING id,status",[req.params.id,req.user.id]);if(!r.rowCount)return deny(reply,409,'Sadece taslaklar onaylanır');await audit(req.user.id,'approve','dispute',req.params.id);return r.rows[0]
});
app.post('/api/disputes/:id/send',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');if(!process.env.SMTP_HOST||!process.env.SMTP_FROM)return deny(reply,503,'SMTP ayarlanmadı');
 const r=await db.query("SELECT d.*,COALESCE(NULLIF(s.company_email,''),s.email) AS recipient FROM disputes d JOIN suppliers s ON d.supplier_id=s.id WHERE d.id=$1 AND d.status='approved'",[req.params.id]);
 if(!r.rowCount)return deny(reply,409,'Onaylı itiraz bulunamadı');let d=r.rows[0];if(!d.recipient)return deny(reply,400,'Tedarikçi e-posta adresi yok');
 const mailer=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT||587)===465,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
 await mailer.sendMail({from:process.env.SMTP_FROM,to:d.recipient,subject:d.subject,text:d.body});
 await db.query("UPDATE disputes SET status='sent',sent_at=now() WHERE id=$1 AND status='approved'",[d.id]);await audit(req.user.id,'send','dispute',d.id,{recipient:d.recipient});return{ok:true}
});
app.post('/api/credit-notes',async(req,reply)=>{
 if(!isAdmin(req.user))return deny(reply,403,'Admin gerekli');let {dispute_id,supplier_id,credit_number,amount,received_at}=req.body||{};
 if(!invoiceDateOk(received_at)||typeof credit_number!=='string'||credit_number.length<1||!(Number(amount)>0))return deny(reply,400,'Geçersiz creditnota');
 const r=await db.query('INSERT INTO credit_notes(dispute_id,supplier_id,credit_number,amount,received_at) VALUES($1,$2,$3,$4,$5) RETURNING id',[dispute_id||null,supplier_id,credit_number,amount,received_at]);await audit(req.user.id,'create','credit_note',r.rows[0].id);return reply.code(201).send(r.rows[0])
});
app.get('/api/audit',async(req,reply)=>{if(req.user.role!=='system')return deny(reply,403,'Sistem admini gerekli');return{items:(await db.query('SELECT id,action,target_type,target_id,details,occurred_at FROM audit_events ORDER BY id DESC LIMIT 200')).rows}});
const port=Number(process.env.PORT||3000);
app.listen({port,host:process.env.HOST||'0.0.0.0'}).catch(err=>{app.log.error(err);process.exit(1)});
