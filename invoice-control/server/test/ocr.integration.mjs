// Synthetic documents generated in memory. No real invoice is read or saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {readInvoiceBuffer} from '../src/local-ocr.mjs';
const header=['TEST Groothandel BV','Factuurnummer: TEST-OCR-100','Factuurdatum: 15-11-2026'];
const lines=[...header,'Appels 10 st 2,50 25,00 9%','Subtotaal 25,00','BTW 9% 2,25','Totaal 27,25'];
async function image(rows=lines){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><rect width="100%" height="100%" fill="white"/>'+rows.map((s,i)=>'<text x="90" y="'+(120+i*105)+'" font-family="DejaVu Sans" font-size="40" fill="black">'+s.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</text>').join('')+'</svg>';
 return sharp(Buffer.from(svg)).png().toBuffer();
}
async function pdf(pages){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(const rows of pages){const page=doc.addPage([800,550]);if(Buffer.isBuffer(rows)){const pic=await doc.embedPng(rows);page.drawImage(pic,{x:0,y:0,width:800,height:550});}
 else rows.forEach((text,i)=>page.drawText(text,{x:45,y:490-i*52.5,size:20,font}));}
 return Buffer.from(await doc.save());
}
function assertInvoice(x){assert.equal(x.invoiceNumber,'TEST-OCR-100',x.rawText);assert.equal(x.items.length,1,x.rawText);assert.equal(x.items[0].qty,10);assert.equal(x.items[0].price,2.5);assert.equal(x.totalNet,25);assert.equal(x.totalTax,2.25);assert.equal(x.totalGross,27.25);assert(x.extractionComplete);}
test('digital PDF text extraction',async()=>{const x=await readInvoiceBuffer(await pdf([lines]),'application/pdf');assertInvoice(x);assert.equal(x.method,'pdf-text');});
test('PNG, JPEG with orientation metadata, and WebP run through real OCR',async()=>{
 const png=await image();
 for(const [mime,bytes] of [['image/png',png],['image/jpeg',await sharp(png).rotate(270).jpeg().withMetadata({orientation:6}).toBuffer()],['image/webp',await sharp(png).webp().toBuffer()]]){
  const x=await readInvoiceBuffer(bytes,mime);assertInvoice(x);assert.equal(x.method,'image-ocr');assert(x.ocrConfidence>50);
 }
});
test('mixed PDF uses text on digital pages and OCR on scanned pages once',async()=>{
 const x=await readInvoiceBuffer(await pdf([[...header,'Appels 10 st 2,50 25,00 9%'],await image(['Subtotaal 25,00','BTW 9% 2,25','Totaal 27,25'])]),'application/pdf');
 assertInvoice(x);assert.equal(x.method,'mixed-pdf-ocr');assert.equal(x.pages,2);assert.equal(x.processedPages,2);assert.deepEqual(x.pageDetails.map(p=>p.method),['pdf-text','ocr']);
});
test('four scanned pages include final total beyond page three',async()=>{
 const pages=[];
 for(let i=0;i<4;i++)pages.push(await image(i===0?lines.slice(0,4):[`TEST vervolgpagina ${i+1}`,'Peren 1 st 1,00 1,00 9%',...(i===3?['Subtotaal 28,00','BTW 9% 2,52','Totaal 30,52']:[])]));
 const x=await readInvoiceBuffer(await pdf(pages),'application/pdf');
 assert.equal(x.method,'scanned-pdf-ocr');assert.equal(x.pages,4);assert.equal(x.processedPages,4);assert.equal(x.items.length,4,x.rawText);assert.equal(x.totalGross,30.52);assert.equal(x.totalTax,2.52);assert(x.extractionComplete);
});
test('page cap is explicit and blocks saving partial output',async()=>{
 const previous=process.env.OCR_MAX_PAGES;process.env.OCR_MAX_PAGES='1';
 try{const x=await readInvoiceBuffer(await pdf([lines,lines]),'application/pdf');assert.equal(x.pages,2);assert.equal(x.processedPages,1);assert.equal(x.extractionComplete,false);assert(x.warnings.some(s=>s.includes('1/2')));}
 finally{if(previous===undefined)delete process.env.OCR_MAX_PAGES;else process.env.OCR_MAX_PAGES=previous;}
});
