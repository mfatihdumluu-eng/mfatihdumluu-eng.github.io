// Invoice Control local OCR. No document data or credentials are sent to Mindee.
// All parsed fields are suggestions; a person must confirm before saving.
const number=s=>{
 if(s===null||s===undefined)return null;
 let x=String(s).trim().replace(/[€\s]/g,'');
 if(!x||!/^-?[\d.,]+$/.test(x))return null;
 const comma=x.lastIndexOf(','),dot=x.lastIndexOf('.');
 if(comma>=0&&dot>=0)x=comma>dot?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'');
 else if(comma>=0)x=x.replace(',','.');
 else if((x.match(/\./g)||[]).length>1)x=x.replace(/\./g,'');
 const n=Number(x);return Number.isFinite(n)?n:null;
};
const amount=(line)=>{const m=String(line).match(/(?:€\s*)?(-?[\d.,]+)\s*(?:€)?\s*$/);return m?number(m[1]):null};
const dateValue=s=>{
 let m=String(s||'').match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
 if(m){const v=[m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-');return !Number.isNaN(Date.parse(v))?v:''}
 m=String(s||'').match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
 if(m){const v=[m[3],m[2].padStart(2,'0'),m[1].padStart(2,'0')].join('-');return !Number.isNaN(Date.parse(v))?v:''}
 return '';
};
const findValue=(lines,re)=>{for(const l of lines){const m=l.match(re);if(m)return m[1]?.trim()||''}return ''};
export function parseInvoiceText(input){
 const lines=String(input||'').replace(/\r/g,'\n').split('\n').map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,1100);
 const supplier=(lines.find(x=>x.length>3&&!/^\d/.test(x)&&!/factuur|invoice|bonnummer|datum|date|kvk|btw|tel|www/i.test(x))||lines[0]||'').slice(0,160);
 const invoiceNumber=findValue(lines,/(?:factuur(?:nummer|nr|no)?|invoice\s*(?:number|no|#)|fact\s*nr|faktura\s*no)\s*[:#.\s-]+\s*([A-Z0-9][A-Z0-9./_-]{1,65})/i);
 const date=dateValue(findValue(lines,/(?:factuurdatum|invoice\s*date|datum|date)\s*[:\s]+\s*([^\s]{7,12})/i))||dateValue(lines.find(s=>dateValue(s))||'');
 const dueDate=dateValue(findValue(lines,/(?:vervaldatum|due\s*date|betaling\s*voor)\s*[:\s]+\s*([^\s]{7,12})/i));
 const totals={net:null,tax:null,gross:null,discount:null};
 const totalPatterns=[
  ['gross',/(?:totaal(?:\s*te\s*betalen)?|total\s*(?:due|amount|incl|gross)?|amount\s*due|grand\s*total|te\s*betalen|eindtotaal)/i],
  ['net',/(?:subtotaal|subtotal|excl\.?\s*btw|netto\s*totaal|net\s*amount)/i],
  ['tax',/(?:btw\s*(?:bedrag|totaal)?|vat\s*(?:amount|total)?|total\s*tax)/i],
  ['discount',/(?:korting|discount)/i]
 ];
 for(const l of lines){
  for(const [key,re] of totalPatterns){if(re.test(l)){const n=amount(l);if(n!==null)totals[key]=n}}
 }
 const items=[];let suppressed=0;
 for(const line of lines){
  if(items.length>=300)break;
  if(/(?:factuur|invoice|totaal|total|subtotaal|subtotal|korting|discount|betaling|btw|vat|iban|adres|address|tel|phone|datum|date|omschrijving|description|prijs|price|aantal|quantity)/i.test(line))continue;
  // Only trust rows where a quantity, price and extended amount are clearly present.
  const m=line.match(/^(.{3,180}?)\s+(\d{1,5}(?:[.,]\d{1,3})?)\s*(?:x|×|st|pcs)?\s+(\d{1,9}(?:[.,]\d{1,4})?)\s+(\d{1,10}[.,]\d{2})(?:\s*(?:€|EUR))?$/i);
  if(!m)continue;
  const qty=number(m[2]),price=number(m[3]),lineTotal=number(m[4]);
  if(!qty||qty<=0||price===null||lineTotal===null)continue;
  if(Math.abs(qty*price-lineTotal)>.06){suppressed++;continue}
  items.push({name:m[1].slice(0,180),qty,price,lineTotal,vatRate:null,ean:''});
 }
 const warnings=['OCR çıktısını orijinal faturayla karşılaştırın; otomatik sonuçlar kesin değildir.'];
 if(!invoiceNumber)warnings.push('Fatura numarası güvenilir biçimde okunamadı.');
 if(!date)warnings.push('Fatura tarihi okunamadı.');
 if(!items.length)warnings.push('Ürün satırları güvenilir şekilde ayrıştırılamadı; manuel giriş gerekebilir.');
 if(suppressed)warnings.push(suppressed+' satır hesap uyuşmazlığı nedeniyle ürün listesine eklenmedi.');
 if(totals.gross===null)warnings.push('Genel toplam bulunamadı.');
 return{supplier,invoiceNumber,date,dueDate,items,totalNet:totals.net,totalTax:totals.tax,totalGross:totals.gross,discount:totals.discount,warnings,rawText:lines.join('\n').slice(0,25000)};
}
export async function readInvoiceBuffer(data,mime){
 if(mime==='application/pdf'){
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:new Uint8Array(data)});
  let text='',pages=0;
  try{const result=await parser.getText();text=String(result.text||'');pages=Number(result.total||result.pages?.length||0)}
  finally{await parser.destroy()}
  if(text.replace(/\s/g,'').length>=70)return{...parseInvoiceText(text),method:'pdf-text',pages};
  const {pdf}=await import('pdf-to-img');
  const {createWorker}=await import('tesseract.js');
  const doc=await pdf('data:application/pdf;base64,'+Buffer.from(data).toString('base64'),{scale:1.6});
  const worker=await createWorker('eng');
  try{
   const texts=[];let count=0;
   for await(const page of doc){const x=await worker.recognize(page);texts.push(x.data.text);if(++count>=3)break}
   return{...parseInvoiceText(text+'\n'+texts.join('\n')),method:'scanned-pdf-ocr',pages:count};
  }finally{await worker.terminate();await doc.destroy()}
 }
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('eng');
 try{const result=await worker.recognize(data);return{...parseInvoiceText(result.data.text),method:'image-ocr',pages:1,ocrConfidence:result.data.confidence}}
 finally{await worker.terminate()}
}
