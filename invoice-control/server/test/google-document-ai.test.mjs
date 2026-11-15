import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {normalizeDocumentAI,extractWithDocumentAI,documentAIConfig,documentAIStatus,prepareDocumentAIInput,DocumentAIError} from '../src/google-document-ai.mjs';
// Synthetic response, never represented as a real Google extraction.
const field=(type,mentionText,normalizedValue)=>({type,mentionText,...(normalizedValue?{normalizedValue}:{})});
export const sampleDocument=()=>({document:{text:'TEST Groothandel\nFactuur 000123-A\nTest melk\nTest brood',pages:[{pageNumber:1}],entities:[
 field('invoice_id','000123-A'),field('supplier_name','TEST Groothandel'),
 field('invoice_date','15-11-2026',{dateValue:{year:2026,month:11,day:15}}),
 field('due_date','29-11-2026'),field('currency','EUR'),
 field('net_amount','18,00'),field('total_tax_amount','1,62'),field('total_amount','19,62',{moneyValue:{units:'19',nanos:620000000,currencyCode:'EUR'}}),
 {type:'line_item',mentionText:'2 Test melk 4,00 8,00',confidence:0.99,properties:[
  field('line_item/description','Test melk'),field('line_item/product_code','00001'),field('line_item/unit','ST'),
  field('line_item/quantity','2'),field('line_item/unit_price','4,00'),field('line_item/amount','8,00')]},
 {type:'line_item',mentionText:'2,5 Test brood 4,00 10,00',properties:[
  field('line_item/description','Test brood'),field('line_item/product_code','00002'),field('line_item/unit','KG'),
  field('line_item/quantity','2,5'),field('line_item/unit_price','4,00'),field('line_item/amount','10,00')]},
 {type:'vat',properties:[field('vat/tax_rate','9%'),field('vat/amount','18,00'),field('vat/tax_amount','1,62')]}
]}});
const env={GOOGLE_DOCUMENT_AI_ENABLED:'true',GOOGLE_CLOUD_PROJECT:'invoice-test-123',GOOGLE_DOCUMENT_AI_PROCESSOR_ID:'abc123',GOOGLE_DOCUMENT_AI_LOCATION:'eu'};
test('maps exact invoice ID, supplier, ordered lines, Dutch numbers and VAT summary without guessing row rates',()=>{
 const r=normalizeDocumentAI(sampleDocument());
 assert.equal(r.invoiceNumber,'000123-A');assert.equal(r.supplier,'TEST Groothandel');
 assert.equal(r.date,'2026-11-15');assert.equal(r.dueDate,'2026-11-29');
 assert.deepEqual(r.items.map(x=>[x.name,x.sku,x.qty,x.price,x.lineTotal]),[['Test melk','00001',2,4,8],['Test brood','00002',2.5,4,10]]);
 assert.equal(r.items[0].vatRate,null);assert.equal(r.totalGross,19.62);
 assert.deepEqual(r.taxBreakdown,[{rate:9,base:18,amount:1.62}]);assert.equal(r.extractionComplete,true);
 assert.equal(r.provider,'google-document-ai');assert.equal(r.region,'eu');assert.equal(r.requiresReview,true);
});
test('partial photographed invoice, unknown lines and non-EUR cannot silently enter the pool',()=>{
 const partial=sampleDocument();partial.document.text+='\nPagina 1 van 2';
 assert.equal(normalizeDocumentAI(partial).extractionComplete,false);
 const foreign=sampleDocument();foreign.document.entities.find(x=>x.type==='currency').mentionText='USD';
 assert.equal(normalizeDocumentAI(foreign).extractionComplete,false);
 const empty=sampleDocument();empty.document.entities=empty.document.entities.filter(x=>x.type!=='line_item');
 assert.equal(normalizeDocumentAI(empty).extractionComplete,false);
 assert.throws(()=>normalizeDocumentAI({error:{message:'private error'}}),{kind:'INVALID_DATA'});
});
test('EU configuration rejects host/path injection, other regions and defaults to disabled',()=>{
 assert.throws(()=>documentAIConfig({...env,GOOGLE_DOCUMENT_AI_LOCATION:'us'}),{kind:'CONFIG'});
 assert.throws(()=>documentAIConfig({...env,GOOGLE_DOCUMENT_AI_PROCESSOR_ID:'abc/../../other'}),{kind:'CONFIG'});
 assert.equal(documentAIStatus({}).enabled,false);assert.equal(documentAIStatus({}).connected,null);
});
test('disabled integration, corrupt documents and 11-page PDFs make no auth or billable calls',async()=>{
 let calls=0;const authClient={getRequestHeaders:async()=>{calls++;return new Headers();}},fetchFn=async()=>{calls++;};
 await assert.rejects(extractWithDocumentAI({data:Buffer.from('x'),mime:'image/png',env:{},authClient,fetchFn}),{kind:'DISABLED'});
 await assert.rejects(extractWithDocumentAI({data:Buffer.from('%PDF-invalid'),mime:'application/pdf',env,authClient,fetchFn}),{kind:'INVALID_FILE'});
 const pdf=await PDFDocument.create();for(let i=0;i<11;i++)pdf.addPage();
 await assert.rejects(extractWithDocumentAI({data:Buffer.from(await pdf.save()),mime:'application/pdf',env,authClient,fetchFn}),{kind:'PAGE_LIMIT'});
 assert.equal(calls,0);
});
test('uses ADC bearer auth and only EU endpoint; sends one complete document with no retry',async()=>{
 const data=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer();
 let count=0;
 const args={data,mime:'image/png',env,authClient:{getRequestHeaders:async url=>{
  assert(url.startsWith('https://eu-documentai.googleapis.com/'));return new Headers({Authorization:'Bearer test-only'});
 }},fetchFn:async(url,opts)=>{
  count++;assert.equal(url,'https://eu-documentai.googleapis.com/v1/projects/invoice-test-123/locations/eu/processors/abc123:process');
  assert.equal(opts.headers.get('Authorization'),'Bearer test-only');assert.equal(opts.redirect,'error');
  assert.equal(JSON.parse(opts.body).rawDocument.content,data.toString('base64'));
  return{ok:true,json:async()=>sampleDocument()};
 }};
 assert.equal((await extractWithDocumentAI(args)).items.length,2);assert.equal(count,1);
 count=0;
 await assert.rejects(extractWithDocumentAI({...args,fetchFn:async()=>{count++;return{ok:false,status:403,json:()=>{throw Error('must not log private response');}};}}),e=>e instanceof DocumentAIError&&e.kind==='PERMISSION'&&!e.message.includes('private'));
 assert.equal(count,1);
 const converted=await prepareDocumentAIInput(await sharp(data).webp().toBuffer(),'image/webp');assert.equal(converted.mime,'image/png');
 await assert.rejects(prepareDocumentAIInput(data,'image/jpeg'),{kind:'INVALID_FILE'});
});
