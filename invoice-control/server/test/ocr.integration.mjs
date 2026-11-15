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
test('PDF column-major text stream keeps physical product rows and wrapped names',async()=>{
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([800,600]);
 const draw=(text,x,y)=>page.drawText(text,{x,y,size:14,font});
 header.forEach((line,i)=>draw(line,40,560-i*25));
 // Drawing each entire column in sequence reproduces supplier PDFs whose text
 // stream order differs from the visual row order.
 for(const [x,heading,values] of [[40,'Artikelnummer',['SKU123','SKU456']],[160,'Omschrijving',['Kipfilet','Doner']],[430,'Aantal',['2','3']],[530,'Prijs',['10,00','5,00']],[650,'Bedrag',['20,00','15,00']]]){
  draw(heading,x,430);values.forEach((text,i)=>draw(text,x,400-i*60));
 }
 draw('gemarineerd 500g',160,380);draw('Subtotaal 35,00',500,250);draw('BTW 9% 3,15',500,225);draw('Totaal 38,15',500,200);
 const x=await readInvoiceBuffer(Buffer.from(await doc.save()),'application/pdf');
 assert.equal(x.items.length,2,x.rawText);assert.equal(x.items[0].name,'Kipfilet gemarineerd 500g');assert.equal(x.items[0].qty,2);assert.equal(x.items[0].price,10);assert.equal(x.items[0].sku,'SKU123');assert.equal(x.items[1].name,'Doner');assert.equal(x.items[1].lineTotal,15);assert.equal(x.totalGross,38.15);
});
test('scanned table columns keep product descriptions out of quantity and price fields',async()=>{
 const cells=[['TEST Groothandel BV',80,70],['Factuurnummer: TEST-TABLE-1',80,130],['Factuurdatum: 15-11-2026',80,190],['Omschrijving',80,310],['Aantal',850,310],['Prijs',1100,310],['Bedrag',1350,310],['Kipfilet',80,390],['2',890,390],['10,00',1100,390],['20,00',1350,390],['gemarineerd 500g',80,435],['Doner',80,510],['3',890,510],['5,00',1100,510],['15,00',1350,510],['Subtotaal 35,00',1000,650],['BTW 9% 3,15',1000,710],['Totaal 38,15',1000,770]];
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="950"><rect width="100%" height="100%" fill="white"/>'+cells.map(([s,x,y])=>'<text x="'+x+'" y="'+y+'" font-family="DejaVu Sans" font-size="32">'+s+'</text>').join('')+'</svg>';
 const x=await readInvoiceBuffer(await sharp(Buffer.from(svg)).png().toBuffer(),'image/png');
 assert.equal(x.items.length,2,x.rawText);assert.equal(x.items[0].name,'Kipfilet gemarineerd 500g');assert.equal(x.items[0].qty,2);assert.equal(x.items[0].price,10);assert.equal(x.items[1].name,'Doner');assert.equal(x.totalGross,38.15);
});
