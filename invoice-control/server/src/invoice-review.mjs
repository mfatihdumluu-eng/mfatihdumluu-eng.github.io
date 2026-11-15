// Shared by the review screen and API. No database or OCR dependencies.
export function decimal(value) {
 if(value===null||value===undefined||String(value).trim()==='')return null;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let s=String(value).trim().replace(/(?:EUR|€)/gi,'').replace(/[\s\u00a0]/g,'');
 if(/^\([\d.,]+\)$/.test(s))s='-'+s.slice(1,-1);
 if(/^[\d.,]+-$/.test(s))s='-'+s.slice(0,-1);
 if(!/^-?\d+(?:[.,]\d+)*$/.test(s))return null;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0){
  const group=comma>dot?/^-?\d{1,3}(?:\.\d{3})+,\d+$/:/^-?\d{1,3}(?:,\d{3})+\.\d+$/;
  if(!group.test(s))return null;
  s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 }else if(comma>=0){if((s.match(/,/g)||[]).length!==1)return null;s=s.replace(',','.');}
 else if((s.match(/\./g)||[]).length>1){if(!/^-?\d{1,3}(?:\.\d{3})+$/.test(s))return null;s=s.replace(/\./g,'');}
 const n=Number(s);return Number.isFinite(n)?n:null;
}
export const validDate=s=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number(s.slice(0,4))<1)return false;
 const date=new Date(s+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===s;
};
const scaled=n=>BigInt(Math.round(n*10000));
const roundRatio=(value,divisor)=>Number((value+divisor/2n)/divisor)/100;
export function calculatedLineTotal(item){
 const q=decimal(item.qty),p=decimal(item.price),rate=decimal(item.discountPercent)??0,off=decimal(item.discountAmount)??0;
 if(q===null||p===null||q<=0||p<0||q>1e8||p>1e8||rate<0||rate>100||off<0||off>1e8)return null;
 // Four decimal places for quantities/prices; round to cents only after discount.
 const value=scaled(q)*scaled(p)*(1000000n-scaled(rate))-scaled(off)*10000000000n;
 if(value<0n)return null;
 return roundRatio(value,1000000000000n);
}
const precise=n=>Math.abs(n*10000-Math.round(n*10000))<.0001;
const cents=n=>Math.abs(n*100-Math.round(n*100))<.0001;
export function checkInvoice(invoice){
 const errors=[],items=Array.isArray(invoice.items)?invoice.items:[];
 let subtotal=0;
 if(!items.length||items.length>400)errors.push('1 ile 400 arasında ürün satırı gerekli.');
 items.forEach((item,index)=>{
  const label=(index+1)+'. ürün';
  if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>500){errors.push(label+': ürün adı gerekli.');return;}
  const qty=decimal(item.qty),price=decimal(item.price),line=decimal(item.lineTotal),vat=decimal(item.vatRate);
  const rate=decimal(item.discountPercent),off=decimal(item.discountAmount);
  if(qty===null||qty<=0||qty>1e8||!precise(qty)||price===null||price<0||price>1e8||!precise(price))errors.push(label+': miktar ve fiyat geçersiz (en fazla 4 ondalık).');
  if(vat!==null&&(vat<0||vat>100)||item.vatRate!=null&&item.vatRate!==''&&vat===null)errors.push(label+': BTW oranı geçersiz.');
  if(rate!==null&&(rate<0||rate>100)||off!==null&&(off<0||off>1e8)||item.discountPercent!=null&&item.discountPercent!==''&&rate===null||item.discountAmount!=null&&item.discountAmount!==''&&off===null)errors.push(label+': iskonto geçersiz.');
  if(rate&&off)errors.push(label+': yüzde ve tutar iskontosundan yalnızca birini kullanın.');
  const expected=calculatedLineTotal(item);
  if(line===null||line<0||line>1e8||!cents(line)||expected===null||Math.abs(expected-line)>.011)errors.push(label+': miktar × fiyat − satır iskontosu, satır toplamıyla uyuşmuyor.');
  if(line!==null)subtotal+=Math.round(line*100);
 });
 subtotal/=100;
 const amounts={};
 for(const key of ['totalNet','totalTax','totalGross','discount']){
  const value=invoice[key],n=decimal(value);amounts[key]=n;
  if(value!=null&&value!==''&&(n===null||n<0||n>1e8||!cents(n)))errors.push('Fatura toplam tutarları geçersiz (en fazla 2 ondalık).');
 }
 const {totalNet:net,totalTax:tax,totalGross:gross,discount}=amounts;
 if(net!==null&&Math.abs(subtotal-(discount??0)-net)>.021)errors.push('Ürün satır toplamı − fatura iskontosu, ara toplamla uyuşmuyor.');
 if(net!==null&&tax!==null&&gross!==null&&Math.abs(net+tax-gross)>.021)errors.push('Ara toplam + BTW, genel toplamla uyuşmuyor.');
 // Accept both line-level and rate-group VAT rounding. A mixed-rate invoice
 // discount has no assumed allocation; the operator must verify that breakdown.
 if(tax!==null&&items.length&&items.every(it=>decimal(it?.vatRate)!==null&&decimal(it?.lineTotal)!==null)){
  const rates=new Set(items.map(it=>decimal(it.vatRate)));
  if(!(discount>0)||rates.size===1){
   const groups=new Map();let perLine=0;
   for(const it of items){const rate=decimal(it.vatRate),value=decimal(it.lineTotal);groups.set(rate,(groups.get(rate)||0)+value);perLine+=Math.round(value*rate);}
   const grouped=[...groups].reduce((sum,[rate,value])=>sum+Math.round((value-(rates.size===1?(discount||0):0))*rate),0)/100;
   if(Math.abs(tax-grouped)>.021&&(!(discount>0)&&Math.abs(tax-perLine/100)>.021||discount>0))errors.push('BTW toplamı, okunan ürün vergi oranlarıyla uyuşmuyor.');
  }
 }
 if(invoice.extractionComplete===false)errors.push('Belgenin tamamı okunmadı. Eksik sayfaları ayrı dosya olarak yeniden okuyun.');
 return{errors:[...new Set(errors)],subtotal,...amounts};
}
export function prepareReview(body){
 const b=body||{},supplier=String(b.supplier||'').trim(),invoiceNumber=String(b.invoiceNumber||'').trim();
 const check=checkInvoice(b),errors=[...check.errors];
 if(!supplier||supplier.length>160||!invoiceNumber||invoiceNumber.length>120)errors.unshift('Tedarikçi ve fatura numarası gerekli.');
 if(b.date&&!validDate(b.date)||b.dueDate&&!validDate(b.dueDate))errors.push('Fatura tarihi geçersiz.');
 const items=(Array.isArray(b.items)?b.items:[]).filter(Boolean).map(it=>({
  name:String(it.name||'').trim(),ean:String(it.ean||'').slice(0,80),sku:String(it.sku||'').slice(0,80),unit:String(it.unit||'').slice(0,30),
  qty:decimal(it.qty),price:decimal(it.price),lineTotal:decimal(it.lineTotal),vatRate:decimal(it.vatRate),
  discountPercent:decimal(it.discountPercent),discountAmount:decimal(it.discountAmount),rawLine:String(it.rawLine||'').slice(0,1000)
 }));
 const warnings=Array.isArray(b.warnings)?b.warnings.filter(x=>typeof x==='string').slice(0,100).map(x=>x.slice(0,400)):[];
 return{errors:[...new Set(errors)],value:{supplier,invoiceNumber,date:b.date||null,dueDate:b.dueDate||null,items,warnings,
  totalNet:check.totalNet,totalTax:check.totalTax,totalGross:check.totalGross,discount:check.discount}};
}
