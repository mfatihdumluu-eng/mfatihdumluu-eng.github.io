import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInvoiceText} from '../src/local-ocr.mjs';
import {checkInvoice,calculatedLineTotal,prepareReview,decimal,validDate} from '../src/invoice-review.mjs';
const header='TEST Groothandel B.V.\nFactuurnummer: TEST-2026-100\nFactuurdatum: 13-11-2026\n';
test('reads Dutch invoice and keeps distinct subtotal, BTW and gross',()=>{
 const x=parseInvoiceText(header+'Yoghurt 1L 10 2,50 25,00\nKaas 500g 2 5,00 10,00\nSubtotaal 35,00\nBTW 3,15\nTotaal 38,15');
 assert.equal(x.supplier,'TEST Groothandel B.V.');assert.equal(x.invoiceNumber,'TEST-2026-100');assert.equal(x.date,'2026-11-13');
 assert.equal(x.items.length,2);assert.equal(x.items[0].name,'Yoghurt 1L');assert.equal(x.items[0].qty,10);assert.equal(x.items[0].price,2.5);
 assert.equal(x.totalNet,35);assert.equal(x.totalGross,38.15);assert.equal(x.totalTax,3.15);
});
test('suspicious line survives for correction without inventing quantities',()=>{
 const x=parseInvoiceText(header+'Appels 10 2,00 900,00\nTotaal 900,00');
 assert.equal(x.items.length,1);assert.equal(x.items[0].qty,10);assert.equal(x.items[0].lineTotal,900);assert(x.items[0].needsReview);
 assert(x.warnings.some(w=>w.includes('hesap uyuşmazlığı')));assert(prepareReview(x).errors.length);
});
test('unreadable scan yields warnings and no fabricated data',()=>{
 const x=parseInvoiceText('???  ### ###');assert.equal(x.items.length,0);assert.equal(x.totalGross,null);assert(x.warnings.some(w=>w.includes('manuel')));
});
test('mixed VAT rates aggregate; explicit tax total overrides breakdown',()=>{
 const rows=header+'Appels 10 10,00 100,00 9%\nZeep 2 25,00 50,00 21%\nTotaal excl. BTW 150,00\nBTW 9% over 100,00 9,00\n21% btw over 50,00 10,50';
 const x=parseInvoiceText(rows+'\nTotaal incl. BTW 169,50');
 assert.equal(x.totalTax,19.5);assert.equal(x.totalNet,150);assert.equal(x.totalGross,169.5);assert.deepEqual(x.taxBreakdown.map(t=>t.rate),[9,21]);assert.deepEqual(checkInvoice(x).errors,[]);
 assert.equal(parseInvoiceText(rows+'\nTotaal BTW 19,50\nTe betalen 169,50').totalTax,19.5);assert.equal(parseInvoiceText('BTW 9%').totalTax,null);
});
test('subtotal cannot replace gross and bare percentages are not amounts',()=>{
 const x=parseInvoiceText('Totaal te betalen 109,00\nSubtotaal 100,00\nBTW 9,00\nKorting 5%');
 assert.equal(x.totalGross,109);assert.equal(x.totalNet,100);assert.equal(x.discount,null);
});
test('quantity first, SKU, kilograms, cases, four decimals and line discount',()=>{
 const x=parseInvoiceText(header+'50 x Pakket Doyum Kip Doner (1doos:10pk, 1pk:700g) € 6,99 € 349,50 9%\nAB-123 Tomaten 2,500 kg 3,2000 8,00 9%\n8712345678906 Melk 2 doos 12,50 25,00 9%\nNoten 4 st 2,5000 10% 9,00 9%');
 assert.equal(x.items.length,4);assert.equal(x.items[0].qty,50);assert.equal(x.items[0].vatRate,9);assert.equal(x.items[0].price,6.99);
 assert.equal(x.items[1].sku,'AB-123');assert.equal(x.items[1].unit,'kg');assert.equal(x.items[1].qty,2.5);
 assert.equal(x.items[2].ean,'8712345678906');assert.equal(x.items[2].unit,'koli');assert.equal(x.items[2].price,12.5);
 assert.equal(x.items[3].discountPercent,10);assert.deepEqual(checkInvoice(x).errors,[]);
});
test('invoice discount applied once after line totals',()=>{
 const x=parseInvoiceText(header+'50 x Pakket Kip € 6,99 € 349,50 9%\n40 x Pakket Rund € 7,99 € 319,60 9%\n-5% x Korting € 669,10 € -33,46 9%\nSubtotaal 635,64\n9% btw 57,21\nTotaal 692,85');
 assert.equal(x.items.length,2);assert.equal(x.discount,33.46);assert.equal(x.totalTax,57.21);assert.deepEqual(checkInvoice(x).errors,[]);
});
test('conflicting units demand review without automatic case conversion',()=>{
 const x=parseInvoiceText(header+'Kaas 2 doos 6,00/kg 12,00');assert.equal(x.items[0].qty,2);assert.equal(x.items[0].price,6);assert(x.items[0].unitWarning);assert(x.items[0].needsReview);
});
test('invalid dates, malformed decimals and nonfinite numbers are rejected',()=>{
 for(const x of ['2026-02-30','2026-13-01','2025-02-29','0000-01-01'])assert(!validDate(x));assert(validDate('2024-02-29'));
 assert.equal(parseInvoiceText('Factuurdatum: 30-02-2026').date,'');assert.equal(decimal('1.234,56'),1234.56);assert.equal(decimal('1,234.56'),1234.56);assert.equal(decimal('12,500'),12.5);
 for(const value of ['1,2,3','1.23.4',Infinity])assert.equal(decimal(value),null);
 const sample={supplier:'TEST',invoiceNumber:'TEST-1',items:[{name:'Test',qty:1,price:1,lineTotal:1}]};
 for(const value of [Infinity,'Infinity',null,''])assert(prepareReview({...sample,items:[{...sample.items[0],qty:value}]}).errors.length);
 for(const patch of [{vatRate:'garbage'},{discountPercent:110},{discountAmount:1,discountPercent:1}])assert(prepareReview({...sample,items:[{...sample.items[0],...patch}]}).errors.length);
 assert(prepareReview({...sample,extractionComplete:false}).errors.length);
});
test('currency rounds extended amounts once, including half cents',()=>{
 assert.equal(calculatedLineTotal({qty:1,price:1.005}),1.01);assert.equal(calculatedLineTotal({qty:3,price:0.3333}),1);
 assert.equal(calculatedLineTotal({qty:2.5,price:4.1234,discountPercent:10}),9.28);assert.equal(calculatedLineTotal({qty:2,price:10,discountAmount:3.75}),16.25);
 assert(checkInvoice({items:[{name:'A',qty:1,price:1,lineTotal:1},{name:'B',qty:1,price:1,lineTotal:1}],totalNet:2.03}).errors.length);
});
test('merged OCR product rows cannot fabricate a product',()=>{
 assert.equal(parseInvoiceText(header+'40 x Pakket Rund € 7,99 € 319,60 9% 10 x Pakket Kip € 7,49 € 74,90 9%').items.length,0);
});
test('table headings distinguish quantity-first rows and article numbers from EANs',()=>{
 const x=parseInvoiceText(header+'Artikel Aantal Omschrijving Prijs Bedrag BTW\n12345678 10 Appels 2,50 25,00 9%');
 assert.equal(x.items.length,1);assert.equal(x.items[0].qty,10);assert.equal(x.items[0].name,'Appels');assert.equal(x.items[0].sku,'12345678');
 const y=parseInvoiceText(header+'Aantal Omschrijving Prijs Bedrag\n10 Appels 2,50 25,00');assert.equal(y.items[0].qty,10);
});
test('VAT amount must agree with known line rates; supports group and line rounding',()=>{
 const x={items:[{name:'A',qty:1,price:100,lineTotal:100,vatRate:9}],totalNet:100,totalTax:21,totalGross:121};
 assert(checkInvoice(x).errors.some(x=>x.includes('vergi oranları')));
 assert.deepEqual(checkInvoice({...x,totalTax:9,totalGross:109}).errors,[]);
});
