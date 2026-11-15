import test from 'node:test';
import assert from 'node:assert/strict';
import {positionedText} from '../src/invoice-layout.mjs';
import {parseInvoiceText} from '../src/local-ocr.mjs';
const header='TEST Supplier\nFactuur: TEST-LAYOUT-1\nFactuurdatum: 15-11-2026\n';
test('tabular columns keep amounts and product name separate, preserving source order',()=>{
 const x=parseInvoiceText(header+'Artikelnummer\tOmschrijving\tAantal\tEenheid\tPrijs\tKorting %\tBedrag\tBTW\nABC123\t7up Frisdrank 24 x 330 ml\t2\tdoos\t12,5000\t10\t22,50\t9\nXYZ456\t100% Rund Doner 700g\t5\tst\t3,00\t\t15,00\t9\nSubtotaal 37,50\nBTW 9% 3,38\nTotaal 40,88');
 assert.equal(x.items.length,2);assert.equal(x.items[0].name,'7up Frisdrank 24 x 330 ml');assert.equal(x.items[0].sku,'ABC123');assert.equal(x.items[0].qty,2);assert.equal(x.items[0].price,12.5);assert.equal(x.items[0].discountPercent,10);assert.equal(x.items[1].name,'100% Rund Doner 700g');
 assert.equal(x.items[1].vatRate,9);assert.equal(x.totalGross,40.88);
});
test('wrapped descriptions stay with their original product, before or after amounts',()=>{
 const x=parseInvoiceText(header+'Omschrijving\tAantal\tPrijs\tBedrag\nKipfilet\t2\t10,00\t20,00\nmet marinade 500g\t\t\t\nRund Doner\t3\t5,00\t15,00\n1 doos: 10 pakken\t\t\t\nSubtotaal 35,00');
 assert.deepEqual(x.items.map(i=>i.name),['Kipfilet met marinade 500g','Rund Doner 1 doos: 10 pakken']);
 const y=parseInvoiceText(header+'Omschrijving\tAantal\tPrijs\tBedrag\nKipfilet met marinade\t\t\t\n\t2\t10,00\t20,00');assert.equal(y.items[0].name,'Kipfilet met marinade');
});
test('brand names with digits are not stripped into invented article codes',()=>{
 const x=parseInvoiceText(header+'7up Frisdrank 2 12,50 25,00\nB12 Vitamine 1 4,00 4,00');assert.equal(x.items[0].name,'7up Frisdrank');assert.equal(x.items[0].sku,'');assert.equal(x.items[1].name,'B12 Vitamine');
});
test('positioned reading order recovers a column-major PDF and multi-line name',()=>{
 const words=[];const put=(text,x0,y0,width=40)=>words.push({text,x0,x1:x0+width,y0,y1:y0+10});
 // Deliberately shuffled text stream, as in supplier PDFs.
 put('Aantal',350,100);put('2',370,125,8);put('3',370,165,8);
 put('Bedrag',550,100);put('20,00',560,125,30);put('15,00',560,165,30);
 put('Omschrijving',100,100,90);put('Kipfilet',100,125,55);put('gemarineerd',100,140,80);put('Doner',100,165,40);
 put('Prijs',450,100,30);put('10,00',450,125,30);put('5,00',455,165,25);
 const text=positionedText(words),x=parseInvoiceText(header+text);
 assert.equal(x.items.length,2,text);assert.equal(x.items[0].name,'Kipfilet gemarineerd');assert.equal(x.items[0].qty,2);assert.equal(x.items[0].price,10);assert.equal(x.items[1].name,'Doner');assert.equal(x.items[1].lineTotal,15);
});
