// Invoice Control OCR: document processing stays on this server.
import {parseInvoiceText} from './invoice-parser.mjs';
import {positionedText,ocrPositionedText} from './invoice-layout.mjs';
export {parseInvoiceText} from './invoice-parser.mjs';
const maxPages=()=>Math.min(20,Math.max(1,Number.parseInt(process.env.OCR_MAX_PAGES||'10',10)||10));
const informative=text=>String(text||'').replace(/\s/g,'').length>=70&&/\d+[.,]\d{2}/.test(text);
export async function prepareImage(data){
 const {default:sharp}=await import('sharp');
 sharp.cache({memory:16,files:0,items:16});sharp.concurrency(1);
 return sharp(data,{limitInputPixels:32_000_000}).rotate().resize({width:2200,height:3000,fit:'inside',withoutEnlargement:true})
  .flatten({background:'#ffffff'}).grayscale().normalise().png().toBuffer();
}
function pdfWords(content,viewport){
 const words=[];
 for(const item of content.items){
  if(!item.str?.trim()||!item.transform)continue;
  const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
  const parts=[...item.str.matchAll(/\S+/g)],height=Math.abs(item.height)||Math.abs(item.transform[3])||10;
  // A PDF text item can contain a whole sentence. Keep its word positions rather
  // than treating the sentence centre as a numeric table column.
  for(const part of parts){const start=part.index/item.str.length,end=(part.index+part[0].length)/item.str.length;
   words.push({text:part[0],x0:x+item.width*start,x1:x+item.width*end,y0:y-height,y1:y});}
 }
 return words;
}
export async function readInvoiceBuffer(data,mime){
 let worker,doc,loadingTask;
 const details=[],texts=[],start=Date.now(),limit=maxPages();
 const recognize=async(buffer)=>{
  if(!worker){const {createWorker}=await import('tesseract.js');worker=await createWorker('nld+eng',1,{errorHandler:()=>{}});await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});}
  const input=await prepareImage(buffer);let timer;
  try{return await Promise.race([worker.recognize(input,{}, {text:true,blocks:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCR_TIMEOUT')),120000);})]);}
  finally{clearTimeout(timer);}
 };
 try{
  if(mime==='application/pdf'){
   const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
   loadingTask=getDocument({data:new Uint8Array(data),verbosity:0,isEvalSupported:false});doc=await loadingTask.promise;
   const pages=doc.numPages,count=Math.min(pages,limit);let complete=pages<=limit;
   for(let pageNumber=1;pageNumber<=count;pageNumber++){
    const page=await doc.getPage(pageNumber),base=page.getViewport({scale:1});
    const text=positionedText(pdfWords(await page.getTextContent(),base));
    if(informative(text)){texts.push(text);details.push({page:pageNumber,method:'pdf-text'});page.cleanup();continue;}
    if(Date.now()-start>180000){complete=false;break;}
    const scale=Math.min(1800/base.width,3000/base.height),viewport=page.getViewport({scale});
    const {createCanvas}=await import('@napi-rs/canvas');
    const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    try{
     await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
     const ocr=await recognize(canvas.toBuffer('image/png'));
     texts.push(ocrPositionedText(ocr.data));details.push({page:pageNumber,method:'ocr',confidence:ocr.data.confidence});
    }finally{canvas.width=1;canvas.height=1;page.cleanup();}
   }
   const output=parseInvoiceText(texts.join('\n'));output.extractionComplete=output.extractionComplete&&complete;
   if(!complete)output.warnings.push('Belgenin '+details.length+'/'+pages+' sayfası okundu. Eksik sayfaları ayrı dosya olarak yükleyin; bu sonuç kaydedilemez.');
   const scanned=details.filter(x=>x.method==='ocr').length;
   return{...output,method:scanned?(scanned===details.length?'scanned-pdf-ocr':'mixed-pdf-ocr'):'pdf-text',pages,processedPages:details.length,pageDetails:details};
  }
  const result=await recognize(data);
  return{...parseInvoiceText(ocrPositionedText(result.data)),method:'image-ocr',pages:1,processedPages:1,ocrConfidence:result.data.confidence,pageDetails:[{page:1,method:'ocr',confidence:result.data.confidence}]};
 }finally{
  try{if(worker)await worker.terminate();}finally{if(loadingTask)await loadingTask.destroy();}
 }
}
