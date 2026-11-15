// In-memory PostgreSQL engine. Never connects to the production DATABASE_URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID,scryptSync} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from '../src/server.mjs';
import {parseInvoiceText} from '../src/local-ocr.mjs';
const fixture=()=>({provider:'nutrient',branchId:1,...parseInvoiceText('TEST Groothandel BV\nFactuur: TEST-ROUNDTRIP-1\nFactuurdatum: 15-11-2026\nAB-123 Tomaten 2,5 kg 4,00 10% 9,00 9%\nSubtotaal 9,00\nBTW 9% 0,81\nTotaal 9,81')});
async function setup(t,{auditFailure=false,documentAIExtractor}={}){
 const db=new PGlite();
 await db.exec((await readFile(new URL('../schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 await db.query("INSERT INTO branches(id,name) VALUES(1,'Test Şube 1'),(2,'Test Şube 2')");
 const query=async(sql,params)=>{const x=await db.query(sql,params);return{rows:x.rows,rowCount:x.rows.length||x.affectedRows||0};};
 const adapter={query,connect:async()=>({query,release(){}})};
 const id=randomUUID(),token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');
 await query("INSERT INTO users(id,email,name,password_hash,role) VALUES($1,'test@example.invalid','TEST System',$2,'system')",[id,'testsalt:'+scryptSync('test-only-password','testsalt',64).toString('hex')]);
 await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash,id]);
 if(auditFailure)await db.exec("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST audit failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit();");
 const app=await createApp({database:adapter,logger:false,documentAIExtractor});await app.ready();
 t.after(async()=>{await app.close();await db.close();});
 return{app,query,db,cookies:{invoice_sid:token},id};
}
test('OCR save/list/detail roundtrip preserves codes, units, discounts and existing rows',async t=>{
 const {app,query,cookies,id}=await setup(t);
 const existingId=randomUUID();
 await query("INSERT INTO mindee_invoice_reviews(id,created_by,supplier_name,invoice_number,items) VALUES($1,$2,'Existing record','KEEP-THIS',$3)",[existingId,id,JSON.stringify([{name:'Existing item',qty:1,price:3}])]);
 const before=(await query('SELECT row_to_json(t) AS data FROM mindee_invoice_reviews t WHERE id=$1',[existingId])).rows[0];
 const payload=fixture();assert.equal(payload.items.length,1);
 const res=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload});assert.equal(res.statusCode,201,res.body);
 const saved=await app.inject({url:'/api/admin/ocr/invoices/'+res.json().id,cookies});assert.equal(saved.statusCode,200);
 const invoice=saved.json().invoice;assert.equal(invoice.supplier_name,payload.supplier);assert.equal(Number(invoice.total_gross),9.81);
 for(const field of ['name','sku','ean','unit','qty','price','lineTotal','vatRate','discountPercent'])assert.equal(invoice.items[0][field],payload.items[0][field],field);
 assert.equal(invoice.status,'review');
 const list=await app.inject({url:'/api/admin/ocr/invoices',cookies});assert.equal(list.json().items.length,2);
 assert.deepEqual((await query('SELECT row_to_json(t) AS data FROM mindee_invoice_reviews t WHERE id=$1',[existingId])).rows[0],before);
 assert.equal((await query('SELECT * FROM invoices')).rowCount,0,'legacy comparison table stays untouched');
 assert.equal(Number(invoice.branch_id),1);
 assert.equal(invoice.source,'nutrient');
 assert.equal(invoice.comparison_ready,true);
 assert.equal((await query("SELECT * FROM audit_events WHERE target_type='shared_invoice'")).rowCount,1);
});
test('bad totals, invalid dates, nonfinite numbers and partial extraction never persist',async t=>{
 const {app,query,cookies}=await setup(t);
 for(const patch of [{totalGross:99},{date:'2026-02-30'},{extractionComplete:false},{currency:'USD'},{taxBreakdown:[{rate:9,base:9,amount:99}]},{taxBreakdown:[{rate:'garbage',base:9,amount:.81}]},{items:[{name:'bad',qty:'Infinity',price:1,lineTotal:1}]},{items:[{name:'bad',qty:1,price:1,lineTotal:'NaN'}]}]){
  const res=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:{...fixture(),...patch}});assert.equal(res.statusCode,400,res.body);
 }
 assert.equal((await query('SELECT * FROM mindee_invoice_reviews')).rowCount,0);
});
test('audit failure rolls back the invoice instead of reporting an ambiguous save',async t=>{
 const {app,query,cookies}=await setup(t,{auditFailure:true});
 const res=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:fixture()});assert.equal(res.statusCode,500);
 assert.equal((await query('SELECT * FROM mindee_invoice_reviews')).rowCount,0);
});
test('protected OCR routes require login, system role and same origin',async t=>{
 const {app,query,cookies,id}=await setup(t);
 for(const url of ['/api/admin/ocr/invoices','/api/admin/ocr/invoices/'+randomUUID()])assert.equal((await app.inject({url})).statusCode,401);
 assert.equal((await app.inject({url:'/admin/invoice-reader'})).statusCode,302);
 assert.equal((await app.inject({url:'/admin/ocr-review.mjs'})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,headers:{origin:'https://untrusted.invalid'},payload:fixture()})).statusCode,403);
 await query("UPDATE users SET role='admin' WHERE id=$1",[id]);
 assert.equal((await app.inject({url:'/api/admin/ocr/invoices',cookies})).statusCode,200);
 assert.equal((await app.inject({method:'POST',url:'/api/admin/ocr/extract',cookies})).statusCode,410);
});
test('local OCR endpoint is retired and untrusted direct manual rows cannot enter pool',async t=>{
 const {app,query,cookies}=await setup(t);
 assert.equal((await app.inject({method:'POST',url:'/api/admin/ocr/extract',cookies})).statusCode,410);
 const response=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:{...fixture(),provider:'local'}});
 assert.equal(response.statusCode,400);
 assert.equal((await query('SELECT * FROM mindee_invoice_reviews')).rowCount,0);
});
test('branch user cannot assign another branch and cannot access other branches invoices',async t=>{
 const {app,query,cookies,id}=await setup(t);
 const previous=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:fixture()});
 assert.equal(previous.statusCode,201,previous.body);
 await query("UPDATE users SET role='branch',branch_id=2 WHERE id=$1",[id]);
 const denied=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:fixture()});
 assert.equal(denied.statusCode,403,denied.body);
 const other=await app.inject({url:'/api/admin/ocr/invoices/'+previous.json().id,cookies});
 assert.equal(other.statusCode,403);
 const list=await app.inject({url:'/api/admin/ocr/invoices',cookies});
 assert.equal(list.statusCode,200);assert.equal(list.json().items.length,0);
 const mine=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:{...fixture(),branchId:2}});
 assert.equal(mine.statusCode,201,mine.body);
 const duplicate=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:{...fixture(),branchId:2}});
 assert.equal(duplicate.statusCode,409,duplicate.body);
});
test('monthly pool compares two attributed branches with matching SKU and unit',async t=>{
 const {app,query,cookies}=await setup(t);
 const a=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:fixture()});
 assert.equal(a.statusCode,201,a.body);
 const higher={...fixture(),provider:'google-document-ai',branchId:2,invoiceNumber:'TEST-BRANCH-2',
   items:fixture().items.map(x=>({...x,price:5,lineTotal:11.25})),totalNet:11.25,totalTax:1.01,totalGross:12.26,taxBreakdown:[{rate:9,base:11.25,amount:1.01}]};
 const b=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload:higher});
 assert.equal(b.statusCode,201,b.body);
 const r=await app.inject({url:'/api/admin/ocr/monthly-comparison?month=2026-11',cookies});
 assert.equal(r.statusCode,200,r.body);
 assert.equal(r.json().comparedGroups,1,r.body);
 assert.equal(r.json().items[0].branchCount,2);
});

test('Document AI shares the existing pool, preserves VAT summary and enforces branch ownership',async t=>{
 const {app,query,cookies,id}=await setup(t);
 const payload={...fixture(),provider:'google-document-ai',taxBreakdown:[{rate:9,base:9,amount:.81}]};
 const saved=await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload});assert.equal(saved.statusCode,201,saved.body);
 const record=(await query('SELECT source,branch_id,tax_breakdown FROM mindee_invoice_reviews WHERE id=$1',[saved.json().id])).rows[0];
 assert.equal(record.source,'google-document-ai');assert.equal(Number(record.branch_id),1);assert.deepEqual(record.tax_breakdown,payload.taxBreakdown);
 await query("UPDATE users SET role='branch',branch_id=2 WHERE id=$1",[id]);
 assert.equal((await app.inject({url:'/api/admin/ocr/invoices/'+saved.json().id,cookies})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/api/admin/ocr/invoices',cookies,payload})).statusCode,403);
});

test('Document AI route is disabled until explicit server activation and status never exposes credentials',async t=>{
 const keys=['INVOICE_OCR_PROVIDER','GOOGLE_DOCUMENT_AI_ENABLED','GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_CLOUD_PROJECT','GOOGLE_DOCUMENT_AI_PROCESSOR_ID'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 t.after(()=>{for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}});
 process.env.INVOICE_OCR_PROVIDER='google-document-ai';process.env.GOOGLE_DOCUMENT_AI_ENABLED='false';
 process.env.GOOGLE_APPLICATION_CREDENTIALS='/etc/secrets/private-test.json';process.env.GOOGLE_CLOUD_PROJECT='test-project-123';process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID='abc';
 let calls=0;
 const {app,cookies}=await setup(t,{documentAIExtractor:async()=>{calls++;return{...fixture(),provider:'google-document-ai',pages:1};}});
 assert.equal((await app.inject({method:'POST',url:'/api/admin/invoice-ocr/extract'})).statusCode,401);
 const status=await app.inject({url:'/api/admin/invoice-ocr/status',cookies});
 assert.equal(status.json().region,'eu');assert.equal(status.json().enabled,false);assert.equal(status.json().connected,null);assert(!status.body.includes('private-test'));
 const disabled=await app.inject({method:'POST',url:'/api/admin/invoice-ocr/extract',cookies});assert.equal(disabled.statusCode,503);assert.equal(calls,0);
 process.env.GOOGLE_DOCUMENT_AI_ENABLED='true';
 const boundary='test-google-boundary';
 const extracted=await app.inject({method:'POST',url:'/api/admin/invoice-ocr/extract',cookies,headers:{'content-type':'multipart/form-data; boundary='+boundary},
  payload:`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-synthetic\r\n--${boundary}--\r\n`});
 assert.equal(extracted.statusCode,200,extracted.body);assert.equal(calls,1);assert.equal(extracted.json().provider,'google-document-ai');
});

test('System Admin can create a branch login; branch user gets own branch access',async t=>{
 const {app,query,cookies}=await setup(t);
 const password='Test-secure-only-password-2026';
 const response=await app.inject({method:'POST',url:'/api/admin/branch-users',cookies,
  payload:{name:'Şube Sorumlusu',email:'branch-new@example.invalid',branchId:2,password}});
 assert.equal(response.statusCode,201,response.body);
 const id=response.json().user.id;
 const u=(await query('SELECT role,branch_id,password_hash FROM users WHERE id=$1',[id])).rows[0];
 assert.equal(u.role,'branch');assert.equal(Number(u.branch_id),2);assert(!u.password_hash.includes(password));
 const login=await app.inject({method:'POST',url:'/api/login',payload:{email:'branch-new@example.invalid',password}});
 assert.equal(login.statusCode,200,login.body);assert.equal(login.json().user.role,'branch');
 const denied=await app.inject({method:'POST',url:'/api/admin/branch-users',cookies:{invoice_sid:login.cookies.find(x=>x.name==='invoice_sid')?.value},payload:{name:'X',email:'x@example.invalid',branchId:1,password}});
 assert.equal(denied.statusCode,403);
});
