import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import pg from 'pg';
import {scryptSync,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import {compareSupplierMonth} from './engine.mjs';
import {readFile} from 'node:fs/promises';
import {comparePoolMonth} from './monthly-pool.mjs';
import {sealApiKey,openApiKey,encryptionKey} from './nutrient-secret.mjs';
import {extractWithNutrient,NutrientRequestError} from './nutrient-extract.mjs';
import nodemailer from 'nodemailer';
import {pathToFileURL} from 'node:url';
import {prepareReview,validDate} from './invoice-review.mjs';
export async function createApp({database,logger=true}={}){
const app=Fastify({logger,bodyLimit:2_000_000,trustProxy:false});
await app.register(cookie);
await app.register(rateLimit,{max:150,timeWindow:'1 minute'});
await app.register(multipart,{limits:{files:1,fileSize:10*1024*1024,fields:5}});
const db=database||new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
if(!database)app.addHook('onClose',async()=>db.end());
const audit=async(actor,action,type,id,details={})=>db.query('INSERT INTO audit_events(actor_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)',[actor||null,action,type,String(id??''),JSON.stringify(details)]);
const passOk=(pass,hashed)=>{try{const [salt,expected]=hashed.split(':');const actual=scryptSync(pass,salt,64),a=Buffer.from(expected,'hex');return actual.length===a.length&&timingSafeEqual(actual,a)}catch{return false}};
const deny=(reply,status,message)=>reply.code(status).send({error:message});
const isAdmin=u=>u.role==='admin'||u.role==='system';
const hasBranch=(u,b)=>isAdmin(u)||Number(b)===Number(u.branch_id);
const monthOk=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'');
const invoiceDateOk=validDate;
app.addHook('onRequest',async(req,reply)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.method!=='OPTIONS'&&req.url!=='/api/login'){
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)return deny(reply,403,'Farklı kaynaktan gelen değişiklik isteği engellendi');
 }
 if(!req.url.startsWith('/api')||req.url==='/api/login')return;
 const token=req.cookies.invoice_sid;
 if(!token)return deny(reply,401,'Oturum gerekli');
 const hash=createHash('sha256').update(token).digest('hex');
 const r=await db.query('SELECT u.id,u.name,u.email,u.role,u.branch_id FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash]);
 if(!r.rowCount)return deny(reply,401,'Oturum geçersiz');
 req.user=r.rows[0];req.tokenHash=hash;
});
app.get('/health',async()=>({ok:true,service:'invoice-control',ocrVersion:'3'}));
app.get('/admin/ocr-review.mjs',async(req,reply)=>{
 const user=await requireInvoiceSession(req,reply);if(!user)return;
 return reply.type('application/javascript').header('Cache-Control','no-store').send(await readFile(new URL('./invoice-review.mjs',import.meta.url),'utf8'));
});
app.get('/',async(_req,reply)=>reply.redirect('/admin/invoice-reader'));


// Private Invoice Control OCR endpoints require an authenticated system admin.
async function requireSystemSession(req,reply,{redirectToLogin=false}={}){
 const token=req.cookies?.invoice_sid;
 if(!token){if(redirectToLogin)reply.redirect('/admin/login');else deny(reply,401,'Sistem admini girişi gerekli');return null}
 const hash=createHash('sha256').update(token).digest('hex');
 const r=await db.query('SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash]);
 if(!r.rowCount){if(redirectToLogin)reply.redirect('/admin/login');else deny(reply,401,'Oturum süresi doldu');return null}
 if(r.rows[0].role!=='system'){deny(reply,403,'Yalnızca Sistem Admini');return null}
 return r.rows[0];
}
async function requireInvoiceSession(req,reply,{redirectToLogin=false}={}){
 const token=req.cookies?.invoice_sid;
 if(!token){if(redirectToLogin)reply.redirect('/admin/login');else deny(reply,401,'Fatura ekranı için giriş gerekli');return null}
 const hash=createHash('sha256').update(token).digest('hex');
 const r=await db.query('SELECT u.id,u.name,u.role,u.branch_id,u.email FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash]);
 if(!r.rowCount){if(redirectToLogin)reply.redirect('/admin/login');else deny(reply,401,'Oturum süresi doldu');return null}
 return r.rows[0];
}
app.get('/admin/login',async(req,reply)=>{
 const html=await readFile(new URL('../ocr-login.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private')
  .header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; object-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
app.get('/admin/invoices',async(req,reply)=>{
 const user=await requireInvoiceSession(req,reply,{redirectToLogin:true});if(!user)return;
 const html=await readFile(new URL('../ocr-archive.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private').header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; object-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
app.get('/admin/nutrient',async(req,reply)=>{
 const user=await requireSystemSession(req,reply,{redirectToLogin:true});if(!user)return;
 const html=await readFile(new URL('../nutrient-settings.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private').header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});
app.get('/admin/invoice-reader',async(req,reply)=>{
 const user=await requireInvoiceSession(req,reply,{redirectToLogin:true});if(!user)return;
 const html=await readFile(new URL('../ocr-reader.html',import.meta.url),'utf8');
 return reply.type('text/html; charset=utf-8')
  .header('Cache-Control','no-store, private').header('Referrer-Policy','no-referrer')
  .header('X-Frame-Options','DENY')
  .header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; object-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  .send(html);
});

// A stored key is "configured", NOT "connected". First document processing
// will be the real API verification and may consume free trial credits.
app.get('/api/admin/nutrient/status',async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const r=await db.query("SELECT updated_at FROM service_integrations WHERE provider='nutrient'");
 return reply.header('Cache-Control','no-store').send({
  configured:Boolean(r.rowCount),connected:null,
  message:r.rowCount?'API anahtarı şifreli olarak kaydedilmiş. Canlı Nutrient isteği henüz yapılmadı.':'Nutrient API anahtarı henüz girilmedi.',
  updatedAt:r.rows[0]?.updated_at||null
 });
});
app.post('/api/admin/nutrient/settings',{config:{rateLimit:{max:5,timeWindow:'5 minutes'}}},async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 const apiKey=req.body?.apiKey;
 if(typeof apiKey!=='string'||apiKey.trim().length<10||apiKey.trim().length>2000||/\s/.test(apiKey.trim()))
  return deny(reply,400,'Nutrient API anahtarını boşluk içermeden gir.');
 let encrypted;
 try{encrypted=sealApiKey(apiKey.trim(),encryptionKey());}
 catch(error){req.log.error({reason:error?.message},'Nutrient encryption not ready');return deny(reply,503,'Sunucu güvenli anahtar saklama için henüz yapılandırılmadı.');}
 await db.query(
  "INSERT INTO service_integrations(provider,encrypted_secret,model_id,connection_status,verified_at,last_error,updated_by) VALUES('nutrient',$1,NULL,'disconnected',NULL,NULL,$2) ON CONFLICT(provider) DO UPDATE SET encrypted_secret=EXCLUDED.encrypted_secret,model_id=NULL,connection_status='disconnected',verified_at=NULL,last_error=NULL,updated_by=EXCLUDED.updated_by,updated_at=now()",
  [encrypted,req.user.id]
 );
 await audit(req.user.id,'update','integration','nutrient',{configured:true});
 return reply.header('Cache-Control','no-store').send({ok:true,configured:true,connected:null,message:'Nutrient API anahtarı güvenle kaydedildi. Test henüz yapılmadı.'});
});
app.delete('/api/admin/nutrient/settings',async(req,reply)=>{
 if(req.user.role!=='system')return deny(reply,403,'Yalnızca Sistem Admini');
 await db.query("DELETE FROM service_integrations WHERE provider='nutrient'");
 await audit(req.user.id,'delete','integration','nutrient');
 return reply.header('Cache-Control','no-store').send({ok:true,configured:false});
});

// The user explicitly chooses Nutrient; local OCR remains the privacy-preserving default.
// The document is sent only to the fixed Nutrient HTTPS endpoint, not an arbitrary URL.
app.post('/api/admin/nutrient/extract',{config:{rateLimit:{max:4,timeWindow:'1 minute'}}},async(req,reply)=>{
 if(req.user.role==='branch'&&!req.user.branch_id)return deny(reply,403,'Kullanıcının şubesi tanımlı değil.');
 const stored=await db.query("SELECT encrypted_secret FROM service_integrations WHERE provider='nutrient'");
 if(!stored.rowCount)return deny(reply,409,'Önce Nutrient API anahtarını Sistem Admini → Nutrient API Ayarları bölümünde kaydet.');
 let apiKey;
 try{apiKey=openApiKey(stored.rows[0].encrypted_secret,encryptionKey());}
 catch{return deny(reply,503,'Kayıtlı Nutrient anahtarı çözülemiyor. Şifreleme ayarını kontrol et.');}
 let part;
 try{part=await req.file()}catch{return deny(reply,400,'Dosya yüklenemedi (en fazla 10 MB).')}
 if(!part)return deny(reply,400,'Önce PDF veya fotoğraf seç.');
 const mime=part.mimetype;
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(mime)){
  part.file.resume();return deny(reply,415,'Yalnızca PDF, JPG, PNG ve WebP desteklenir.');
 }
 let buffer;
 try{buffer=await part.toBuffer()}catch{return deny(reply,413,'Dosya okunamadı veya 10 MB sınırı aşıldı.')}
 if(!buffer.length||buffer.length>10*1024*1024)return deny(reply,413,'Dosya 10 MB sınırını aşıyor.');
 const valid=(mime==='application/pdf'&&buffer.subarray(0,5).toString()==='%PDF-')||
  (mime==='image/jpeg'&&buffer[0]===255&&buffer[1]===216)||
  (mime==='image/png'&&buffer.subarray(0,4).equals(Buffer.from([137,80,78,71])))||
  (mime==='image/webp'&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP');
 if(!valid)return deny(reply,415,'Dosya biçimi içerikle eşleşmiyor.');
 try{
  const result=await extractWithNutrient({apiKey,data:buffer,mime,filename:part.filename});
  await audit(req.user.id,'extract','nutrient_invoice','',{items:result.items.length,pages:result.pages||0});
  return reply.header('Cache-Control','no-store').send(result);
 }catch(e){
  const kind=e instanceof NutrientRequestError?e.kind:'INTERNAL';
  const status=e instanceof NutrientRequestError?e.status:502;
  req.log.warn({kind,httpStatus:status},'Nutrient extraction failed'); // no invoice data or key
  const message=kind==='AUTH'?'Nutrient API anahtarı reddedildi. Sistem Admini → Nutrient ayarlarını kontrol et.':
   kind==='QUOTA'?'Nutrient ücretsiz kredi veya istek sınırına ulaşıldı.':
   kind==='VALIDATION'?'Nutrient belgeyi veya çıkarım şemasını kabul etmedi. Dosya türünü ve servis erişimini kontrol et.':
   kind==='TIMEOUT'?'Nutrient yanıtı zaman aşımına uğradı.':
   kind==='INVALID_DATA'?'Nutrient yanıtında beklenen fatura alanları yok; veri kaydedilmedi.':
   'Nutrient işlemi tamamlanamadı. Sunucu kayıtlarında neden kodu var.';
  return reply.code(status===401||status===403?502:status===429?429:502).send({error:message,code:kind});
 }
});
let ocrProcessing=false;
// Old local OCR has been removed from the production workflow.
app.post('/api/admin/ocr/extract',async(_req,reply)=>deny(reply,410,'Yerel OCR kaldırıldı. Nutrient Data Extraction ile fatura oku.'));
// Private OCR review archive. An extracted invoice is NOT saved until a user
// clicks Save. Records are not used by price comparisons until separately approved.
app.get('/api/admin/ocr/invoices',async(req,reply)=>{
 const {month,branch_id}=req.query||{};
 if(month&&!monthOk(month))return deny(reply,400,'YYYY-MM geçersiz');
 if(branch_id&&(!isAdmin(req.user)||!Number.isInteger(Number(branch_id))))return deny(reply,403,'Şube filtresi için admin yetkisi gerekli');
 const params=[],where=[];
 if(req.user.role==='branch'){params.push(req.user.branch_id);where.push('r.branch_id=$'+params.length);}
 else if(branch_id){params.push(Number(branch_id));where.push('r.branch_id=$'+params.length);}
 if(month){params.push(month+'-01');where.push('r.invoice_date >= $'+params.length+'::date AND r.invoice_date < ($'+params.length+"::date + interval '1 month')");}
 const sql='SELECT r.id,r.supplier_name,r.invoice_number,r.invoice_date,r.created_at,r.total_gross,r.status,r.source,r.comparison_ready,r.branch_id,b.name AS branch_name,jsonb_array_length(r.items) AS item_count FROM mindee_invoice_reviews r LEFT JOIN branches b ON b.id=r.branch_id'
  +(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY r.invoice_date DESC NULLS LAST,r.created_at DESC LIMIT 500';
 const result=await db.query(sql,params);
 return reply.header('Cache-Control','no-store').send({items:result.rows});
});
app.get('/api/admin/ocr/invoices/:id',async(req,reply)=>{
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(req.params.id))return deny(reply,400,'Fatura kimliği geçersiz');
 const result=await db.query('SELECT r.*,b.name AS branch_name FROM mindee_invoice_reviews r LEFT JOIN branches b ON b.id=r.branch_id WHERE r.id=$1',[req.params.id]);
 if(!result.rowCount)return deny(reply,404,'Fatura bulunamadı');
 if(req.user.role==='branch'&&Number(result.rows[0].branch_id)!==Number(req.user.branch_id))return deny(reply,403,'Yalnızca kendi şubenizin faturalarını açabilirsiniz');
 return reply.header('Cache-Control','no-store').send({invoice:result.rows[0]});
});
app.post('/api/admin/ocr/invoices',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async(req,reply)=>{
 const review=prepareReview(req.body);
 if(review.errors.length)return reply.code(400).send({error:review.errors[0],errors:review.errors});
 if(req.body?.provider!=='nutrient')return deny(reply,400,'Ortak havuza yalnızca Nutrient ile okunan ve doğrulanan fatura kaydedilir.');
 if(!review.value.date)return deny(reply,400,'Fatura tarihi zorunlu; aylık kıyaslama için gerekli.');
 const wanted=Number(req.body?.branchId),branchId=req.user.role==='branch'?Number(req.user.branch_id):wanted;
 if(!Number.isInteger(branchId)||branchId<1)return deny(reply,400,'Lütfen faturanın ait olduğu şubeyi seç.');
 if(req.user.role==='branch'&&req.body?.branchId!=null&&Number(req.body.branchId)!==branchId)return deny(reply,403,'Başka şubenin adına fatura kaydedilemez.');
 const branch=await db.query('SELECT id,name FROM branches WHERE id=$1',[branchId]);
 if(!branch.rowCount)return deny(reply,400,'Şube bulunamadı.');
 const b=review.value;
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const result=await client.query(
   "INSERT INTO mindee_invoice_reviews(created_by,branch_id,source,comparison_ready,supplier_name,invoice_number,invoice_date,due_date,total_net,total_tax,total_gross,discount,items,warnings,status) VALUES($1,$2,'nutrient',true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'review') RETURNING id",
   [req.user.id,branchId,b.supplier,b.invoiceNumber,b.date,b.dueDate,b.totalNet,b.totalTax,b.totalGross,b.discount,JSON.stringify(b.items),JSON.stringify(b.warnings)]
  );
  await client.query('INSERT INTO audit_events(actor_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)',
   [req.user.id,'create','shared_invoice',result.rows[0].id,JSON.stringify({items:b.items.length,branchId,provider:'nutrient'})]);
  await client.query('COMMIT');
  return reply.code(201).send({id:result.rows[0].id,branchId,branchName:branch.rows[0].name,status:'review',comparisonReady:true,message:'Fatura ortak havuza şube adıyla kaydedildi.'});
 }catch(error){
  await client.query('ROLLBACK');
  if(error.code==='23505')return deny(reply,409,'Bu şube için aynı tedarikçi ve fatura numarası zaten kaydedilmiş.');
  throw error;
 }finally{client.release()}
});
app.get('/api/admin/ocr/monthly-comparison',async(req,reply)=>{
 const {month,branch_id}=req.query||{};
 if(!monthOk(month))return deny(reply,400,'YYYY-MM gerekli');
 if(branch_id&&!isAdmin(req.user))return deny(reply,403,'Şube filtresi için admin yetkisi gerekli');
 const branchId=req.user.role==='branch'?Number(req.user.branch_id):branch_id?Number(branch_id):null;
 if(branchId!==null&&(!Number.isInteger(branchId)||branchId<=0))return deny(reply,400,'Geçersiz şube');
 const q=await db.query(
  "SELECT r.id,r.branch_id,r.supplier_name,r.invoice_number,r.invoice_date,r.items,r.source,r.comparison_ready,b.name AS branch_name FROM mindee_invoice_reviews r JOIN branches b ON b.id=r.branch_id WHERE r.invoice_date >= $1::date AND r.invoice_date < ($1::date + interval '1 month') AND r.source='nutrient' AND r.comparison_ready=true",
  [month+'-01']
 );
 const results=comparePoolMonth(q.rows.map(row=>({...row,invoice_date:String(row.invoice_date).slice(0,10)})),{month,branchId});
 if(req.user.role==='branch'){
  // Anonymized benchmark: never expose other branch names, invoice IDs or raw lines.
  results.items=results.items.filter(x=>x.rows.some(r=>r.branchId===branchId)).map(x=>({
   product:x.product,supplier:x.supplier,productKey:x.productKey,identityQuality:x.identityQuality,
   unit:x.unit,minPrice:x.minPrice,maxPrice:x.maxPrice,spread:x.spread,
   branchCount:x.branchCount,invoiceCount:x.invoiceCount,estimatedDifference:x.estimatedDifference,
   ownRows:x.rows.filter(r=>r.branchId===branchId),otherBranches:'anonim'
  }));
  results.comparedGroups=results.items.length;
 }
 return reply.header('Cache-Control','no-store').send(results);
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
return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const app=await createApp();
 try{await app.listen({port:Number(process.env.PORT||3000),host:process.env.HOST||'0.0.0.0'});}
 catch(err){app.log.error(err);process.exit(1);}
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{app.close().catch(err=>{app.log.error(err);process.exitCode=1;});});
}
