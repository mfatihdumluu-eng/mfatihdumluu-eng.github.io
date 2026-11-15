// Nutrient Data Extraction API: one schema-guided request per user-approved document.
// Never log request bodies, document content, or API credentials.
export const NUTRIENT_URL='https://api.nutrient.io/extraction/extract';
export const invoiceSchema={
 type:'object',
 description:'Extract exactly what is printed on the supplier invoice, including EVERY product row in original order. Never infer missing product lines. All monetary numbers are euros unless the document says otherwise.',
 properties:{
  supplier:{type:'string',description:'Exact supplier name as printed'},
  invoiceNumber:{type:'string',description:'Exact invoice number including punctuation and leading zeroes; NOT customer/account/order number'},
  date:{type:'string',description:'Invoice issue date YYYY-MM-DD if known'},
  dueDate:{type:'string',description:'Due date YYYY-MM-DD if present'},
  totalNet:{type:'number',description:'Subtotal excluding VAT, after any invoice-level discount'},
  totalTax:{type:'number',description:'Total VAT / BTW amount in euros'},
  totalGross:{type:'number',description:'Amount due or total including BTW in euros'},
  discount:{type:'number',description:'Invoice-level discount amount (not discounts already included in line totals)'},
  items:{type:'array',description:'ALL invoice product/service lines, in printed order, one item per physical invoice line. Exclude subtotal, VAT, total, heading, shipping-note and other non-product summary lines; preserve exact product descriptions.',items:{
   type:'object',properties:{
    name:{type:'string',description:'Full printed product description (including continuation text)'},
    sku:{type:'string',description:'Printed supplier product/article number, preserve leading zeros'},
    ean:{type:'string',description:'Printed EAN/GTIN barcode, preserve leading zeroes'},
    unit:{type:'string',description:'Printed unit like ST, KG, DOOS, COLLI, L, PAK'},
    qty:{type:'number',description:'Exact printed invoice quantity, not package content'},
    price:{type:'number',description:'Printed net unit price before any line discount'},
    lineTotal:{type:'number',description:'Printed extended NET line amount after line discount where available'},
    vatRate:{type:'number',description:'BTW/VAT percentage, e.g. 9 or 21, not fraction'},
    discountPercent:{type:'number',description:'Printed line discount percentage when present'},
    discountAmount:{type:'number',description:'Printed line discount amount in euros when present'},
    rawLine:{type:'string',description:'Original invoice text for this row to help human verify'}
   }
  }},
  taxBreakdown:{type:'array',description:'VAT summary rows by rate where printed',items:{type:'object',properties:{
   rate:{type:'number'},amount:{type:'number'},base:{type:'number'}
  }}}
 }
};
function value(x){if(x&&typeof x==='object'&&!Array.isArray(x)&&'value'in x)return value(x.value);return x}
function str(x){const v=value(x);return typeof v==='string'?v.trim():v==null?'':String(v)}
function num(x){const v=value(x);if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function date(x){const t=str(x);return /^\d{4}-\d{2}-\d{2}$/.test(t)?t:''}
export function normalizeNutrient(body){
 const data=body?.output?.data??body?.output?.extractedData??body?.data??body?.result??null;
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('NUTRIENT_EMPTY_DATA');
 const rows=value(data.items),warnings=[];
 const items=Array.isArray(rows)?rows.slice(0,500).map((raw,i)=>{
  const a=raw&&typeof raw==='object'?raw:{};
  const item={name:str(a.name),sku:str(a.sku),ean:str(a.ean),unit:str(a.unit),
   qty:num(a.qty),price:num(a.price),lineTotal:num(a.lineTotal),
   vatRate:num(a.vatRate),discountPercent:num(a.discountPercent),discountAmount:num(a.discountAmount),
   rawLine:str(a.rawLine)};
  if(!item.name)warnings.push('Ürün '+(i+1)+' açıklaması eksik.');
  if(item.qty==null||item.price==null)warnings.push('Ürün '+(i+1)+' miktarı veya birim fiyatı eksik.');
  if(item.qty!==null&&item.price!==null&&item.lineTotal!==null&&
   !item.discountAmount&&!item.discountPercent&&Math.abs(item.qty*item.price-item.lineTotal)>0.03)
   warnings.push('Ürün '+(i+1)+' miktar × fiyat ile satır toplamı uyuşmuyor.');
  return item;
 }):[];
 if(!Array.isArray(rows)||!items.length)warnings.push('Nutrient ürün satırı bulamadı. Belge ile karşılaştırın.');
 if(rows?.length>500)warnings.push('500 satır sınırı aşıldı, belge tam okunamadı.');
 const totalNet=num(data.totalNet),totalTax=num(data.totalTax),totalGross=num(data.totalGross);
 if(totalGross===null)warnings.push('Fatura toplamı bulunamadı.');
 if(totalNet!==null&&totalTax!==null&&totalGross!==null&&Math.abs(totalNet+totalTax-totalGross)>0.04)
  warnings.push('Ara toplam + BTW genel toplamla uyuşmuyor; indirim veya ek masrafları kontrol edin.');
 const taxes=value(data.taxBreakdown);
 return{
  supplier:str(data.supplier),invoiceNumber:str(data.invoiceNumber),date:date(data.date),dueDate:date(data.dueDate),
  totalNet,totalTax,totalGross,discount:num(data.discount),items,
  taxBreakdown:Array.isArray(taxes)?taxes.map(r=>({rate:num(r.rate),amount:num(r.amount),base:num(r.base)})):[],
  warnings,rawText:'',method:'nutrient-extract',pages:body?.metrics?.pagesProcessed??null,
  extractionComplete:items.length>0&&rows?.length<=500,
  provider:'nutrient',requiresReview:true,
  usage:body?.usage?.data_extraction_credits?{
   cost:num(body.usage.data_extraction_credits.cost),
   remainingCredits:num(body.usage.data_extraction_credits.remainingCredits)
  }:null
 };
}
export class NutrientRequestError extends Error{
 constructor(status,kind){super(kind);this.status=status;this.kind=kind}
}
export async function extractWithNutrient({apiKey,data,mime,filename,fetchFn=fetch,timeoutMs=100000}){
 if(!apiKey||!Buffer.isBuffer(data)||!data.length||data.length>10*1024*1024)throw Error('Invalid input');
 const form=new FormData();
 form.append('file',new Blob([data],{type:mime}),String(filename||'invoice.pdf').replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,110));
 form.append('instructions',JSON.stringify({mode:'understand',schema:invoiceSchema}));
 let response;
 try{
  response=await fetchFn(NUTRIENT_URL,{
   method:'POST',headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},
   body:form,signal:AbortSignal.timeout(timeoutMs),redirect:'error'
  });
 }catch(e){
  if(e?.name==='TimeoutError'||e?.name==='AbortError')throw new NutrientRequestError(504,'TIMEOUT');
  throw new NutrientRequestError(502,'NETWORK');
 }
 if(!response.ok){
  if(response.status===401||response.status===403)throw new NutrientRequestError(response.status,'AUTH');
  if(response.status===402||response.status===429)throw new NutrientRequestError(response.status,'QUOTA');
  if(response.status===400||response.status===422)throw new NutrientRequestError(response.status,'VALIDATION');
  throw new NutrientRequestError(response.status,'UPSTREAM');
 }
 let body;
 try{body=await response.json()}catch{throw new NutrientRequestError(502,'INVALID_RESPONSE')}
 try{return normalizeNutrient(body)}catch{throw new NutrientRequestError(502,'INVALID_DATA')}
}
