// Invoice Control OCR: document processing stays on this server.
import {parseInvoiceText} from './invoice-parser.mjs';
export {parseInvoiceText} from './invoice-parser.mjs';
const maxPages=()=>Math.min(20,Math.max(1,Number.parseInt(process.env.OCR_MAX_PAGES||'10',10)||10));
const informative=text=>String(text||'').replace(/\s/g,'').length>=70&&/\d+[.,]\d{2}/.test(text);
export async function prepareImage(data){
 const {default:sharp}=await import('sharp');
 sharp.cache({memory:16,files:0,items:16});sharp.concurrency(1);
 // Decode limit prevents small compressed files expanding without bounds.
 return sharp(data,{limitInputPixels:32_000_000}).rotate().resize({width:2200,height:3000,fit:'inside',withoutEnlargement:true})
  .flatten({background:'#ffffff'}).grayscale().normalise().png().toBuffer();
}
export async function readInvoiceBuffer(data,mime){
 let worker,doc;
 const details=[],texts=[],start=Date.now(),limit=maxPages();
 const recognize=async(buffer)=>{
  if(!worker){
   const {createWorker}=await import('tesseract.js');
   worker=await createWorker('nld+eng',1,{errorHandler:()=>{}});
   await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
  }
  const input=await prepareImage(buffer);
  let timer;
  try{
   return await Promise.race([worker.recognize(input),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCR_TIMEOUT')),120000);})]);
  }finally{clearTimeout(timer);}
 };
 try{
  if(mime==='application/pdf'){
   const {PDFParse}=await import('pdf-parse');
   const parser=new PDFParse({data:new Uint8Array(data)});doc=parser;
   const result=await parser.getText({first:limit,pageJoiner:'',cellSeparator:' ',lineEnforce:true});
   const pages=Number(result.total||result.pages.length),count=Math.min(pages,limit);
   let complete=pages<=limit;
   for(let page=1;page<=count;page++){
    const text=result.pages.find(x=>x.num===page)?.text||'';
    if(informative(text)){texts.push(text);details.push({page,method:'pdf-text'});continue;}
    if(Date.now()-start>180000){complete=false;break;}
    const info=await parser.getInfo({partial:[page],parsePageInfo:true});
    const size=info.pages.find(x=>x.pageNumber===page);
    const width=size?Math.min(1800,Math.max(1,Math.floor(3000*size.width/size.height))):1800;
    const raster=await parser.getScreenshot({partial:[page],desiredWidth:width,imageBuffer:true,imageDataUrl:false});
    const ocr=await recognize(Buffer.from(raster.pages[0].data));
    texts.push(ocr.data.text);details.push({page,method:'ocr',confidence:ocr.data.confidence});
   }
   const output=parseInvoiceText(texts.join('\n'));
   output.extractionComplete=output.extractionComplete&&complete;
   if(!complete)output.warnings.push('Belgenin '+details.length+'/'+pages+' sayfası okundu. Eksik sayfaları ayrı dosya olarak yükleyin; bu sonuç kaydedilemez.');
   const scanned=details.filter(x=>x.method==='ocr').length;
   return{...output,method:scanned?(scanned===details.length?'scanned-pdf-ocr':'mixed-pdf-ocr'):'pdf-text',pages,processedPages:details.length,pageDetails:details};
  }
  const result=await recognize(data);
  return{...parseInvoiceText(result.data.text),method:'image-ocr',pages:1,processedPages:1,ocrConfidence:result.data.confidence,pageDetails:[{page:1,method:'ocr',confidence:result.data.confidence}]};
 }finally{
  // Both resources must be closed even if one cleanup fails.
  try{if(worker)await worker.terminate();}finally{if(doc)await doc.destroy();}
 }
}
