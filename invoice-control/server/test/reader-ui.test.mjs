import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {calculatedLineTotal,checkInvoice,prepareReview} from '../src/invoice-review.mjs';
import {parseInvoiceText} from '../src/local-ocr.mjs';
test('review UI requires confirmation, blocks mismatches and prevents repeated saves',async()=>{
 const html=(await readFile(new URL('../ocr-reader.html',import.meta.url),'utf8')).replace('<script type="module">','<script>').replace(/import \{calculatedLineTotal,checkInvoice,prepareReview\} from '[^']+';/,'');
 const fixture=parseInvoiceText('TEST Supplier\nFactuur: TEST-UI-1\nFactuurdatum: 15-11-2026\nAB-123 Tomaten 2,5 kg 4,00 10% 9,00 9%\nSubtotaal 9,00\nBTW 9% 0,81\nTotaal 9,81');
 const calls=[],errors=[];
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.invalid/admin/invoice-reader',beforeParse(w){
  Object.assign(w,{calculatedLineTotal,checkInvoice,prepareReview});
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  w.fetch=async(url,opts)=>{calls.push({url,payload:opts.body});return{ok:true,json:async()=>url.endsWith('extract')?fixture:{id:'test',status:'review'}};};
  w.addEventListener('error',e=>errors.push(e.message));
 }});
 try{
  const w=dom.window,d=w.document,$=id=>d.getElementById(id);
  Object.defineProperty($('file'),'files',{value:[new w.File(['%PDF-'],'test.pdf',{type:'application/pdf'})]});
  $('file').onchange({target:$('file')});await $('extract').onclick();
  assert.equal($('invoiceNumber').value,'TEST-UI-1');assert.equal(d.querySelector('[data-field="unit"]').value,'kg');assert($('saveInvoice').disabled);
  $('reviewed').checked=true;$('reviewed').dispatchEvent(new w.Event('change'));assert(!$('saveInvoice').disabled);
  const price=d.querySelector('[data-field="price"]');price.value='5';price.dispatchEvent(new w.Event('input'));assert($('saveInvoice').disabled);
  price.value='4';price.dispatchEvent(new w.Event('input'));assert(!$('saveInvoice').disabled);
  await $('saveInvoice').onclick();assert($('saveInvoice').disabled);await $('saveInvoice').onclick();assert.equal(calls.filter(c=>c.url.endsWith('/invoices')).length,1);
  const payload=JSON.parse(calls.at(-1).payload);assert.equal(payload.items[0].sku,'AB-123');assert.equal(payload.items[0].discountPercent,10);
  $('file').onchange({target:$('file')});assert($('result').classList.contains('hidden'));assert($('saveInvoice').disabled);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
