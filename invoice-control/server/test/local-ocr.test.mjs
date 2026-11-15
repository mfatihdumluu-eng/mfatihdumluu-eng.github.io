import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInvoiceText} from '../src/local-ocr.mjs';
test('reads Dutch invoice with explicit quantity, unit price and line total',()=>{
 const x=parseInvoiceText('Groothandel ABC B.V.\nFactuurnummer: F-2026-100\nFactuurdatum: 13-11-2026\n\nYoghurt 1L 10 2,50 25,00\nKaas 500g 2 5,00 10,00\nSubtotaal 35,00\nBTW 3,15\nTotaal 38,15');
 assert.equal(x.supplier,'Groothandel ABC B.V.');
 assert.equal(x.invoiceNumber,'F-2026-100');
 assert.equal(x.date,'2026-11-13');
 assert.equal(x.items.length,2);
 assert.equal(x.items[0].name,'Yoghurt 1L');
 assert.equal(x.items[0].qty,10);
 assert.equal(x.items[0].price,2.5);
 assert.equal(x.totalGross,38.15);
 assert.equal(x.totalTax,3.15);
});
test('suspicious line total does not invent quantities',()=>{
 const x=parseInvoiceText('Groothandel XYZ\nFactuurnummer: 12345\nAppels 10 2,00 900,00\nTotaal 900,00');
 assert.equal(x.items.length,0);
 assert(x.warnings.some(w=>w.includes('hesap uyuşmazlığı')));
});
test('unreadable scan yields review warnings and no fabricated data',()=>{
 const x=parseInvoiceText('???  ### ###');
 assert.equal(x.items.length,0);
 assert.equal(x.totalGross,null);
 assert(x.warnings.some(w=>w.includes('manuel')));
});
