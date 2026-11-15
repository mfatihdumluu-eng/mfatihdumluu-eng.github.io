import {GoogleAuth} from 'google-auth-library';
import {decimal,validDate,checkInvoice} from './invoice-review.mjs';

// Credentials are supplied only through ADC on the backend (Render secret file
// or Workload Identity Federation). Never accept credentials or URLs from HTTP.
export const DOCUMENT_AI_ORIGIN='https://eu-documentai.googleapis.com';
const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
export class DocumentAIError extends Error {
 constructor(status,kind){super(kind);this.status=status;this.kind=kind;}
}
export function documentAIConfig(env=process.env){
 const project=env.GOOGLE_CLOUD_PROJECT||'',processor=env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID||'';
 const location=env.GOOGLE_DOCUMENT_AI_LOCATION||'eu';
 if(location!=='eu'||!/^([a-z][a-z0-9-]{4,61}[a-z0-9]|\d+)$/.test(project)||! /^[a-zA-Z0-9_-]{1,128}$/.test(processor))
  throw new DocumentAIError(503,'CONFIG');
 return{project,processor,location};
}
export function documentAIStatus(env=process.env){
 let configured=false;try{documentAIConfig(env);configured=Boolean(env.GOOGLE_APPLICATION_CREDENTIALS);}catch{}
 return{provider:'google-document-ai',region:'eu',configured,enabled:env.GOOGLE_DOCUMENT_AI_ENABLED==='true',connected:null};
}
const children=e=>Array.isArray(e?.properties)?e.properties:[];
const first=(entities,type)=>entities.find(e=>e.type===type||e.type?.endsWith('/'+type));
function textOf(entity,document){
 if(typeof entity?.mentionText==='string')return entity.mentionText.trim();
 return (entity?.textAnchor?.textSegments||[]).map(s=>Array.from(document.text||'').slice(Number(s.startIndex||0),Number(s.endIndex||0)).join('')).join('').trim();
}
function numberOf(e,doc){
 const nv=e?.normalizedValue;
 if(nv?.moneyValue){const m=nv.moneyValue;return decimal(Number(m.units||0)+Number(m.nanos||0)/1e9);}
 if(typeof nv?.floatValue==='number')return decimal(nv.floatValue);
 if(nv?.integerValue!=null)return decimal(nv.integerValue);
 return decimal(nv?.text??textOf(e,doc));
}
function percentOf(e,doc){
 // Text is a printed percentage; do not guess whether a normalized fraction
 // represents 0.09% or 9%. Preserve a missing line rate for human review.
 const raw=textOf(e,doc);return decimal(raw?raw.replace(/%/g,''):e?.normalizedValue?.text?.replace(/%/g,''));
}
function dateOf(e,doc){
 const d=e?.normalizedValue?.dateValue;
 const raw=d?`${String(d.year).padStart(4,'0')}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`:e?.normalizedValue?.text||textOf(e,doc);
 if(validDate(raw))return raw;
 const m=raw?.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/),iso=m?`${m[3]}-${m[2]}-${m[1]}`:'';
 return validDate(iso)?iso:'';
}
export function normalizeDocumentAI(body){
 const doc=body?.document;
 if(!doc||!Array.isArray(doc.entities))throw new DocumentAIError(502,'INVALID_DATA');
 const entities=doc.entities,warnings=[];
 const get=type=>first(entities,type),str=type=>textOf(get(type),doc),num=type=>numberOf(get(type),doc);
 const lines=entities.filter(e=>e.type==='line_item');
 const items=lines.slice(0,400).map((line,i)=>{
  const props=children(line),p=type=>first(props,type);
  const item={name:textOf(p('description'),doc),sku:textOf(p('product_code'),doc),ean:'',unit:textOf(p('unit'),doc),
   qty:numberOf(p('quantity'),doc),price:numberOf(p('unit_price'),doc),lineTotal:numberOf(p('amount'),doc),
   vatRate:percentOf(p('tax_rate')||p('vat_rate'),doc),discountPercent:null,discountAmount:null,rawLine:textOf(line,doc)};
  if(!item.name||item.qty===null||item.price===null||item.lineTotal===null)warnings.push(`Ürün ${i+1}: eksik alanları orijinal faturadan tamamlayın.`);
  if(item.vatRate===null)warnings.push(`Ürün ${i+1}: satır BTW oranı bulunamadı; faturadaki vergi dökümüyle kontrol edin.`);
  if(typeof line.confidence==='number'&&line.confidence<0.8)warnings.push(`Ürün ${i+1}: okuma güveni düşük; orijinal satırı kontrol edin.`);
  return item;
 });
 const taxBreakdown=entities.filter(e=>e.type==='vat').map(e=>{
  const p=type=>first(children(e),type);
  return{rate:percentOf(p('tax_rate'),doc),base:numberOf(p('amount'),doc),amount:numberOf(p('tax_amount'),doc)};
 });
 const currency=(get('currency')?.normalizedValue?.text||str('currency')||get('total_amount')?.normalizedValue?.moneyValue?.currencyCode||'').toUpperCase();
 const pages=doc.pages?.length||null;
 let complete=items.length>0&&lines.length<=400&&!doc.error;
 if(!items.length)warnings.push('Google Document AI ürün satırı bulamadı.');
 if(lines.length>400)warnings.push('400 ürün satırı sınırı aşıldı. Belgenin tamamı kaydedilemez.');
 if(currency&&currency!=='EUR'){complete=false;warnings.push('Bu ekran yalnızca EUR faturalarını kaydeder; para birimini kontrol edin.');}
 // A photograph of page 1 of 2 must not masquerade as the complete invoice.
 for(const m of (doc.text||'').matchAll(/(?:pagina|page|sayfa)\s*(\d+)\s*(?:van|of|\/)\s*(\d+)/gi)){
  if(Number(m[2])>(pages||1)){complete=false;warnings.push('Belgede ek sayfa bulunduğu yazıyor. Tüm sayfaları tek PDF olarak yükleyin.');break;}
 }
 const result={provider:'google-document-ai',method:'google-document-ai-invoice',region:'eu',requiresReview:true,
  supplier:str('supplier_name'),invoiceNumber:str('invoice_id'),date:dateOf(get('invoice_date'),doc),dueDate:dateOf(get('due_date'),doc),
  totalNet:num('net_amount'),totalTax:num('total_tax_amount'),totalGross:num('total_amount'),discount:null,
  items,taxBreakdown,currency:currency||'EUR',rawText:doc.text||'',pages,processedPages:pages,extractionComplete:complete,warnings};
 if(!result.invoiceNumber)warnings.push('Fatura numarası bulunamadı.');
 if(!result.supplier)warnings.push('Tedarikçi bulunamadı.');
 warnings.push(...checkInvoice(result).errors);
 return result;
}

// Preflight before the billable call. One request processes at most 10 pages;
// no automatic retry or fallback to a second paid provider is made.
export async function prepareDocumentAIInput(data,mime){
 if(!Buffer.isBuffer(data)||!data.length||data.length>10*1024*1024)throw new DocumentAIError(413,'FILE_SIZE');
 if(mime==='application/pdf'){
  if(data.subarray(0,5).toString()!=='%PDF-')throw new DocumentAIError(415,'FILE_TYPE');
  let task;
  try{
   const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
   task=getDocument({data:new Uint8Array(data),verbosity:0,isEvalSupported:false});
   const pdf=await task.promise;
   if(pdf.numPages>10)throw new DocumentAIError(422,'PAGE_LIMIT');
   return{data,mime,pages:pdf.numPages};
  }catch(e){if(e instanceof DocumentAIError)throw e;throw new DocumentAIError(422,'INVALID_FILE');}
  finally{await task?.destroy();}
 }
 if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new DocumentAIError(415,'FILE_TYPE');
 try{
  const {default:sharp}=await import('sharp');
  const meta=await sharp(data,{limitInputPixels:40000000}).metadata();
  if(!({jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[meta.format]===mime)||(meta.pages||1)>1)throw Error('format');
  // WebP is converted locally to the supported PNG transport format.
  return mime==='image/webp'?{data:await sharp(data).rotate().png().toBuffer(),mime:'image/png',pages:1}:{data,mime,pages:1};
 }catch{throw new DocumentAIError(415,'INVALID_FILE');}
}
export async function extractWithDocumentAI({data,mime,env=process.env,fetchFn=fetch,authClient=auth,timeoutMs=100000}){
 if(env.GOOGLE_DOCUMENT_AI_ENABLED!=='true')throw new DocumentAIError(503,'DISABLED');
 const config=documentAIConfig(env),input=await prepareDocumentAIInput(data,mime);
 if(input.data.length>10*1024*1024)throw new DocumentAIError(413,'FILE_SIZE');
 const url=`${DOCUMENT_AI_ORIGIN}/v1/projects/${config.project}/locations/eu/processors/${config.processor}:process`;
 let headers;
 try{headers=new Headers(await authClient.getRequestHeaders(url));}
 catch{throw new DocumentAIError(503,'AUTH');}
 headers.set('Content-Type','application/json');headers.set('Accept','application/json');
 let response;
 try{response=await fetchFn(url,{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(timeoutMs),
  body:JSON.stringify({skipHumanReview:true,rawDocument:{content:input.data.toString('base64'),mimeType:input.mime}})});}
 catch(e){throw new DocumentAIError(502,['TimeoutError','AbortError'].includes(e?.name)?'TIMEOUT':'NETWORK');}
 if(!response.ok){
  const kind=({400:'VALIDATION',401:'AUTH',403:'PERMISSION',404:'PROCESSOR',429:'QUOTA'})[response.status]||'UPSTREAM';
  throw new DocumentAIError(response.status===429?429:502,kind);
 }
 let body;try{body=await response.json();}catch{throw new DocumentAIError(502,'INVALID_DATA');}
 const result=normalizeDocumentAI(body);
 if(result.pages!==input.pages){result.extractionComplete=false;result.warnings.push('Gönderilen ve dönen sayfa sayısı uyuşmuyor.');}
 return result;
}
