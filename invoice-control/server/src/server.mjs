import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import {scryptSync,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import {compareSupplierMonth} from './engine.mjs';
import nodemailer from 'nodemailer';
const app=Fastify({logger:true,bodyLimit:2_000_000,trustProxy:false});
await app.register(cookie);
await app.register(rateLimit,{max:150,timeWindow:'1 minute'});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
const audit=async(actor,action,type,id,details={})=>db.query('INSERT INTO audit_events(actor_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)',[actor||null,action,type,String(id??''),JSON.stringify(details)]);
const passOk=(pass,hashed)=>{try{const [salt,expected]=hashed.split(':');const actual=scryptSync(pass,salt,64),a=Buffer.from(expected,'hex');return actual.length===a.length&&timingSafeEqual(actual,a)}catch{return false}};
const deny=(reply,status,message)=>reply.code(status).send({error:message});
const isAdmin=u=>u.role==='admin'||u.role==='system';
const hasBranch=(u,b)=>isAdmin(u)||Number(b)===Number(u.branch_id);
const monthOk=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'');
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
app.listen({port,host:process.env.HOST||'127.0.0.1'}).catch(err=>{app.log.error(err);process.exit(1)});
+values.length);
 }
 if(!columns.length)return deny(reply,400,'Güncellenecek alan bulunamadı');
 values.push(req.params.id);
 const r=await db.query('UPDATE suppliers SET '+columns.join(',')+' WHERE id=,async(req,reply)=>{if(req.user.role!=='system')return deny(reply,403,'Sistem admini gerekli');return{items:(await db.query('SELECT id,name,email,role,branch_id,active FROM users ORDER BY role,email')).rows}});
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
 const r=await db.query("SELECT d.*,s.email AS recipient FROM disputes d JOIN suppliers s ON d.supplier_id=s.id WHERE d.id=$1 AND d.status='approved'",[req.params.id]);
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
app.listen({port,host:process.env.HOST||'127.0.0.1'}).catch(err=>{app.log.error(err);process.exit(1)});
+values.length+' RETURNING id,name,kvk,vat_id,email,company_email,contact_person,address,phone,website,active',values);
 if(!r.rowCount)return deny(reply,404,'Tedarikçi bulunamadı');
 await audit(req.user.id,'update','supplier',req.params.id,{fields:keys.filter(key=>key in input)});
 return{supplier:r.rows[0]}
});
app.get('/api/users',async(req,reply)=>{if(req.user.role!=='system')return deny(reply,403,'Sistem admini gerekli');return{items:(await db.query('SELECT id,name,email,role,branch_id,active FROM users ORDER BY role,email')).rows}});
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
 const r=await db.query("SELECT d.*,s.email AS recipient FROM disputes d JOIN suppliers s ON d.supplier_id=s.id WHERE d.id=$1 AND d.status='approved'",[req.params.id]);
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
app.listen({port,host:process.env.HOST||'127.0.0.1'}).catch(err=>{app.log.error(err);process.exit(1)});
