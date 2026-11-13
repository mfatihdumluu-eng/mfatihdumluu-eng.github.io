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
const upload=open('kolay-yukle.html'),u=upload.window;
assert(upload.window.document.body.textContent.includes('Tedarikçi'));
assert(upload.window.document.getElementById('number'));
assert(upload.window.document.getElementById('existingNumberResults'),'invoice number lookup visible on upload');
assert(upload.window.document.getElementById('docGross'),'gross amount field visible');
assert(upload.window.document.getElementById('docVat'),'BTW total field visible');

const products=u.eval("parseCSV('ean;urun;miktar;birim_fiyat\\n5449000000996;Coca Cola 1L;100;1,16\\n')");
assert.equal(products.length,1);
assert.equal(products[0].price,1.16);
u.document.getElementById('supplier').value='1';
u.document.getElementById('number').value='TEST-COLA-001';
u.eval("items=parseCSV('ean;urun;miktar;birim_fiyat\\n5449000000996;Coca Cola 1L;100;1,16\\n');renderRows()");
assert(u.eval("Boolean(canSave())"));
await u.eval("save(true)");
const saved=JSON.parse(u.localStorage.getItem('invoice-control-demo-invoices-v1'));
assert.equal(saved.length,1);
assert.equal(saved[0].approval,'Metin dosyası otomatik');
assert(saved[0].invoiceSummary,'invoice summary should be stored with uploaded invoice');
u.eval("searchExistingInvoice()");
assert(u.document.getElementById('existingNumberResults').innerHTML.includes('TEST-COLA-001'),'upload number lookup lists existing invoice');

w.localStorage.setItem('invoice-control-demo-invoices-v1',JSON.stringify(saved));
w.eval("role='admin';allTime=false;setMode('invoices')");
assert(root.innerHTML.includes('TEST-COLA-001'),'saved invoice appears in dashboard');

const scan=open('kolay-yukle.html'),ocr=scan.window;
ocr.document.getElementById('ocrWorkspace').classList.remove('hidden');
const recognized='Van Dijk Foodservice\nFactuurnummer: VD-2026-432\nFactuurdatum: 12-11-2026\n5449000000996 Coca Cola 1L 12 1,25 15,00\nTotaal excl. BTW 15,00\nBTW 9% 1,35\nTotaal te betalen 16,35';
ocr.document.getElementById('ocrText').value=recognized;
assert(ocr.eval('applyRecognizedText(true)'),'OCR text should map into inputs');
assert.equal(ocr.document.getElementById('number').value,'VD-2026-432');
assert.equal(ocr.document.getElementById('supplier').value,'2');
assert.equal(ocr.document.getElementById('date').value,'2026-11-12');
assert.equal(ocr.eval('items.length'),1);
assert.equal(ocr.eval('items[0].qty'),12);
assert.equal(ocr.eval('items[0].price'),1.25);
assert.equal(ocr.document.getElementById('docGross').value,'16.35');
assert.equal(ocr.document.getElementById('docVat9').value,'1.35');
assert(ocr.document.getElementById('ocrMapping').innerHTML.includes('VD-2026-432'));
scan.window.close();

const doyumSample=[
 '50 x Pakket Doyum Kip Döner (1doos:10pk, 1pk:700g) € 6,99 € 349,50 9%',
 '40 x Pakket Doyum %100 Rund Döner (1doos:10pk, 1pk:700g) € 7,99 € 319,60 9%',
 '10 x Pakket Doyum Iskender Kebab 1pk:700g, 1doos:10pk € 7,49 € 74,90 9%',
 '16 x Pakket Doyum Turkse Pizza (1doos:16*3*120g) € 3,50 € 56,00 9%',
 '12 x Pakket Doyum Premium Tenders (1doos:12pk, 1pk:700g) € 5,99 € 71,88 9%',
 '12 x Pakket Doyum Premium Nuggets (1doos:12pk, 1pk:700g) € 4,75 € 57,00 9%',
 '20 x Pakket Doyum Kıymalı İri Mantı 1 koli:20pk, 1pk:500g € 3,99 € 79,80 9%',
 '10 x Pakket Doyum Premium Beef Burger 1doos:10pk, 1pk:480g, 6st € 7,25 € 72,50 9%',
 '6 x Pakket Doyum Peynirli Tepsi Böreği (800g, 1doos:6pk) € 4,25 € 25,50 9%'
].join('\n');
const parsedDoyum=u.eval('parseText('+JSON.stringify(doyumSample)+')');
assert.equal(parsedDoyum.length,9,'Doyum quantity-first invoice should parse all 9 items');
assert.equal(Math.round(parsedDoyum.reduce((v,x)=>v+x.qty*x.price,0)*100)/100,1106.68,'All nine lines subtotal');
assert(parsedDoyum.every(x=>x.vatRate===9),'Doyum nine lines should have 9% BTW');
assert(u.eval('detectInvoiceFields("Doyum Food B.V.\\nFactuur 26704293\\nFactuurdatum 28-10-2026").supplier')==='7','Doyum supplier lookup');

const completeDoyum = doyumSample+
 '\n-5% x Korting € 1.106,68 € -55,33 9%\nSubtotaal € 1.051,35\n9% btw € 94,62\nTotaal € 1.145,97';
u.eval("items=parseText("+JSON.stringify(completeDoyum)+");mode='scan';setDocumentSummary(extractTotalsFromText("+JSON.stringify(completeDoyum)+"))");
assert.deepEqual(u.eval("invoiceReconciliationIssues(true)"),[],'complete Doyum invoice discount, VAT and total reconcile');
assert(u.document.getElementById('summaryRows').innerHTML.includes('1.145,97'),'calculated discounted gross should match document');
u.eval("items[1].price=9.99;updateSummary()");
assert(u.eval("invoiceReconciliationIssues(true)").length>0,'wrong price must prevent approval');
assert(u.eval("missingFields(true)").some(s=>s.includes('Ürün toplamı')),'incorrect OCR invoice should block save');
const mixed='40 x Pakket Doyum Rund Döner € 7,99 € 319,60 9% 10 x Pakket Doyum Iskender Kebab € 7,49 € 74,90 9%';
const mixedItems=u.eval("parseText("+JSON.stringify(mixed)+")");
assert(mixedItems.length<=2,'merged OCR rows must not create invented products');
assert(mixedItems.every(x=>!x.name.includes('€')&&!/10 x Pakket/i.test(x.name)),'OCR product name must not contain another product');
const badSaved={id:'33333',date:'2026-11-13',branch:0,supplier:1,source:'badphoto.jpeg',documentName:'badphoto.jpeg',status:'Onaylandı',items:[{ean:'',name:'OCR merged product',qty:40,price:7.9}],invoiceSummary:{document:{net:1051.35,vat:94.62,gross:1145.97,discount:55.33}}};
w.localStorage.setItem('invoice-control-demo-invoices-v1',JSON.stringify([...saved,badSaved]));
w.eval("role='admin';selectedInvoice='33333';mode='invoiceDetail';render()");
assert(root.textContent.includes('DOĞRULANMAMIŞ'),'old corrupt invoice must be flagged');
assert(root.textContent.includes('Hatalı Kaydı Kaldır'),'old corrupt invoice can be removed');
assert(!w.eval("comparisonEligible(invoices().find(x=>x.id==='33333'))"),'corrupt invoice must not feed comparison engine');
main.window.close();upload.window.close();
console.log('PASS: simple dashboard, cross-supplier search, product detail navigation, role restriction, month filter, CSV validation and saved invoice');
})().catch(err=>{console.error(err);process.exitCode=1});
