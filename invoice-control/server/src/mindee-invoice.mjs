import * as mindee from 'mindee';

// Maps Mindee V2 Invoice model field names to our editable review-only format.
// The Mindee data schema may be customized: unknown fields remain in rawResult.
const unwrap=v=>{
 if(v===null||v===undefined)return null;
 if(typeof v!=='object')return v;
 if(Array.isArray(v))return v.map(unwrap);
 if(Object.prototype.hasOwnProperty.call(v,'value'))return unwrap(v.value);
 if(Object.prototype.hasOwnProperty.call(v,'values'))return unwrap(v.values);
 if(Object.prototype.hasOwnProperty.call(v,'items'))return unwrap(v.items);
 if(Object.prototype.hasOwnProperty.call(v,'fields'))return unwrap(v.fields);
 return Object.fromEntries(Object.entries(v).filter(([k])=>!['confidence','locations','bounding_box','polygon'].includes(k)).map(([k,val])=>[k,unwrap(val)]));
};
const val=(fields,...names)=>{for(const name of names)if(fields?.[name]!=null)return unwrap(fields[name]);return null};
const number=value=>{
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
};
const txt=value=>value===null||value===undefined?'':String(value);
export function normalizeMindeeInvoice(response){
 let raw;
 try{raw=typeof response?.getRawHttp==='function'?response.getRawHttp():response}catch{}
 if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{raw=null}}
 const root=raw&&typeof raw==='object'?raw:response;
 const fields=root?.inference?.result?.fields ||root?.inference?.result?.prediction?.fields ||root?.inference?.prediction?.fields ||
  root?.inference?.result ||response?.inference?.result?.fields ||response?.inference?.result ||{};
 const data=unwrap(fields)||{};
 const rows=val(data,'line_items','items','invoice_lines')||[];
 const items=Array.isArray(rows)?rows.map(row=>{
  const description=val(row,'description','name','product_name')||'';
  const qty=number(val(row,'quantity','qty')),price=number(val(row,'unit_price','unit_net','price'));
  const lineTotal=number(val(row,'total_price','total_amount','amount'));
  const rate=number(val(row,'tax_rate','vat_rate'));
  return{ean:txt(val(row,'product_code','ean','sku')),name:txt(description),
    qty,price,lineTotal,vatRate:rate===null?null:(rate<=1&&rate>0?rate*100:rate)};
 }).filter(r=>r.name):[];
 const taxes=val(data,'taxes')||[];
 const taxList=Array.isArray(taxes)?taxes.map(x=>({
  rate:number(val(x,'rate')),base:number(val(x,'base')),amount:number(val(x,'amount'))
 })):[];
 const totalNet=number(val(data,'total_net','subtotal','net_amount'));
 const totalTax=number(val(data,'total_tax','tax_amount','vat_amount'));
 const totalGross=number(val(data,'total_amount','total_due','amount_due'));
 const discount=number(val(data,'total_discount','discount'));
 const warnings=[];
 if(!items.length)warnings.push('Mindee hiç ürün satırı döndürmedi. Modelinde line_items alanı olmalı.');
 for(const [i,r] of items.entries()){
  if(r.qty===null||r.price===null)warnings.push((i+1)+'. ürünün miktarı veya birim fiyatı eksik.');
  else if(r.lineTotal!==null&&Math.abs(r.qty*r.price-r.lineTotal)>.03)
   warnings.push((i+1)+'. ürün tutarı uyuşmuyor: miktar × birim fiyat ≠ satır toplamı.');
 }
 if(totalGross===null)warnings.push('Fatura genel toplamı okunamadı.');
 if(totalNet!==null&&totalTax!==null&&totalGross!==null&&Math.abs(totalNet+totalTax-totalGross)>.04)
  warnings.push('Ara toplam + BTW, genel toplama eşit değil. İskonto veya başka tutarlar kontrol edilmeli.');
 const date=txt(val(data,'date','invoice_date')).slice(0,10);
 return {
  supplier:txt(val(data,'supplier_name','vendor_name')),
  invoiceNumber:txt(val(data,'invoice_number','invoice_id')),
  date: /^\d{4}-\d{2}-\d{2}$/.test(date)?date:'',
  dueDate:txt(val(data,'due_date')),
  items,totalNet,totalTax,totalGross,discount,taxes:taxList,warnings,
  rawFields:data
 };
}
export async function extractMindeeInvoice(apiKey,modelId,file,{clientFactory=key=>new mindee.Client({apiKey:key})}={}){
 if(!modelId||typeof modelId!=='string')throw new Error('Mindee Model ID gerekli');
 if(typeof mindee.Client!=='function'||typeof mindee.BufferInput!=='function'||!mindee.product?.Extraction)throw new Error('Mindee Node SDK incompatible with V2 extraction');
 if(!file?.data?.length||file.data.length>10*1024*1024)throw new Error('Geçersiz dosya boyutu (en çok 10 MB)');
 const client=clientFactory(apiKey);
 const inputSource=new mindee.BufferInput({buffer:file.data,filename:file.filename});
 const response=await client.enqueueAndGetResult(mindee.product.Extraction,inputSource,{modelId});
 return normalizeMindeeInvoice(response);
}
