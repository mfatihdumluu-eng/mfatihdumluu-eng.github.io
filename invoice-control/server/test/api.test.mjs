// In-memory PostgreSQL engine. Never connects to the production DATABASE_URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID,scryptSync} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from '../src/server.mjs';
import {parseInvoiceText} from '../src/local-ocr.mjs';
const fixture=()=>parseInvoiceText('TEST Groothandel BV\nFactuur: TEST-ROUNDTRIP-1\nFactuurdatum: 15-11-2026\nAB-123 Tomaten 2,5 kg 4,00 10% 9,00 9%\nSubtotaal 9,00\nBTW 9% 0,81\nTotaal 9,81');
async function setup(t,{auditFailure=false}={}){
 const db=new PGlite();
 await db.exec((await readFile(new URL('../schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 const query=async(sql,params)=>{const x=await db.query(sql,params);return{rows:x.rows,rowCount:x.rows.length||x.affectedRows||0};};
 const adapter={query,connect:async()=>({query,release(){}})};
 const id=randomUUID(),token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');
 await query("INSERT INTO users(id,email,name,password_hash,role) VALUES($1,'test@example.invalid','TEST System',$2,'system')",[id,'testsalt:'+scryptSync('test-only-password','testsalt',64).toString('hex')]);
 await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash,id]);
 if(auditFailure)await db.exec("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST audit failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit();");
 const app=await createApp({database:adapter,logger:false,readInvoice:async()=>fixture()});await app.ready();
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
 assert.equal((await query('SELECT * FROM invoices')).rowCount,0,'review does not enter price comparisons');
 assert.equal((await query("SELECT * FROM audit_events WHERE target_type='ocr_invoice'")).rowCount,1);
});
test('bad totals, invalid dates, nonfinite numbers and partial extraction never persist',async t=>{
 const {app,query,cookies}=await setup(t);
 for(const patch of [{totalGross:99},{date:'2026-02-30'},{extractionComplete:false},{items:[{name:'bad',qty:'Infinity',price:1,lineTotal:1}]},{items:[{name:'bad',qty:1,price:1,lineTotal:'NaN'}]}]){
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
 for(const url of ['/api/admin/ocr/invoices','/api/admin/ocr/extract'])assert.equal((await app.inject({method:url.endsWith('extract')?'POST':'GET',url,cookies})).statusCode,403);
});
test('upload validates MIME signatures and returns review-only extraction',async t=>{
 const {app,cookies,query}=await setup(t);
 function form(content,type='application/pdf'){return{method:'POST',url:'/api/admin/ocr/extract',cookies,headers:{'content-type':'multipart/form-data; boundary=testboundary'},payload:Buffer.from('--testboundary\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: '+type+'\r\n\r\n'+content+'\r\n--testboundary--\r\n')};}
 assert.equal((await app.inject(form('not a PDF'))).statusCode,415);
 const res=await app.inject(form('%PDF-1.7 test fixture'));assert.equal(res.statusCode,200,res.body);assert.equal(res.json().requiresReview,true);assert.equal(res.json().provider,'invoice-control-ocr');
 assert.equal((await query('SELECT * FROM mindee_invoice_reviews')).rowCount,0);
});
