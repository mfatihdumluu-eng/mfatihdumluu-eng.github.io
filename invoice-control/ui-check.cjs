const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
function open(file){
 const html=fs.readFileSync(path.join(__dirname,file),'utf8');
 const errors=[];
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://example.test/invoice-control/'+file,pretendToBeVisual:true,beforeParse(w){
  w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};
  w.addEventListener('error',e=>errors.push(String(e.message||e.error)));
 }});
 assert.deepEqual(errors,[],file+' startup errors');
 return dom;
}
(async()=>{
const main=open('index.html'),w=main.window,root=w.document.getElementById('view');
assert(w.document.body.textContent.includes('Invoice Control'));
assert(w.document.getElementById('actions').textContent.includes('Fatura Yükle'));
assert(w.document.getElementById('actions').textContent.includes('Ürün Ara'));
w.eval("setMode('search');term='Coca Cola';render()");
assert(root.textContent.includes('Coca Cola 1L'));
assert(root.textContent.includes('Van Dijk Foodservice'));
w.eval("chooseProduct('5449000000996')");
assert(root.textContent.includes('Ürün Kartı'));
assert(root.textContent.includes('9 Şubede Fiyatlar'),'nine branch comparison should be shown');
assert(root.textContent.includes('Holland Dairy BV'),'supplier group 1');
assert(root.textContent.includes('Van Dijk Foodservice'),'supplier group 2');
assert(root.innerHTML.includes('price-diff'),'price differences should be visibly red');
assert(root.innerHTML.includes('price-ref'),'reference prices should be visibly green');
assert(root.innerHTML.includes('HD-2026-111'));
assert(root.innerHTML.includes('VD-2026-51'));
w.eval("chooseInvoice('VD-2026-51')");
assert(root.textContent.includes('VD-2026-51'));
assert(root.textContent.includes('Yoğurt'));
w.eval("backInvoice()");
assert(root.textContent.includes('Ürün Kartı'),'invoice back must return to product');
w.eval("role='branch';branch=0;allTime=false;setMode('invoices')");
assert(root.textContent.includes('HD-2026-111'));
assert(!root.textContent.includes('VD-2026-51'));
w.eval("role='admin';allTime=false;invoiceNumberQuery='HD2026111';setMode('invoices')");
assert(root.innerHTML.includes('HD-2026-111'),'partial invoice-number search should find the invoice');
assert(!root.innerHTML.includes('VD-2026-51'),'invoice number search excludes other invoices');
w.eval("invoiceNumberQuery='';render()");
w.eval("role='admin';allTime=true;setMode('invoices')");
assert(root.innerHTML.includes('HD-2026-101'),'admin all-time');
w.eval("role='admin';allTime=false;setMode('errors')");
assert(root.textContent.includes('FARK +'),'errors should show unit price difference');
assert(!root.textContent.includes('Olası fark €'),'errors should no longer emphasize totals');
w.eval("role='branch';branch=0;allTime=true;setMode('invoices')");
assert(!root.textContent.includes('HD-2026-101'),'branch no all-time');
// Legacy local upload/OCR was intentionally retired. The public demo now links to
// the authenticated Nutrient reader and the shared monthly comparison.
const legacyUpload=fs.readFileSync(path.join(__dirname,'kolay-yukle.html'),'utf8');
assert(legacyUpload.includes('https://invoice-control-api.onrender.com/admin/invoice-reader'));
assert(legacyUpload.includes('Nutrient'));
assert(main.window.document.body.textContent.includes('Aylık fiyat kıyaslaması'));
main.window.close();
console.log('PASS: dashboard regression checks and sole Nutrient upload route');
})().catch(err=>{console.error(err);process.exitCode=1});
