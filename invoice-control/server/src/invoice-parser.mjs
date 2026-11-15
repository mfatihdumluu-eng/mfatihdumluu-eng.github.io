import {decimal,validDate,calculatedLineTotal,checkInvoice} from './invoice-review.mjs';
import {columnField} from './invoice-layout.mjs';
const N='-?\\d+(?:[.,]\\d+)*';
const U='kg|kilo(?:gram)?|g|gram|st(?:uks?)?\\.?|pcs|pc|doos|dozen|ds|koli|col(?:li)?|pak(?:ket)?|pk|ltr|liter|l';
const unitValue=s=>{const x=String(s||'').toLowerCase().replace(/\.$/,'');return /^(st|stuk|stuks|pcs|pc)$/.test(x)?'adet':/^(doos|dozen|ds|koli|col|colli)$/.test(x)?'koli':/^(kilo|kilogram)$/.test(x)?'kg':/^(gram)$/.test(x)?'g':/^(ltr|liter)$/.test(x)?'l':/^(pk|pak|pakket)$/.test(x)?'paket':x;};
const amount=line=>{const m=line.match(new RegExp('('+N+'-?)\\s*(?:€|EUR)?\\s*$','i'));return m?decimal(m[1]):null;};
const dateValue=s=>{
 const m=String(s||'').match(/\b(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2})|(\d{1,2})[-./](\d{1,2})[-./](\d{4}))\b/);
 if(!m)return '';
 const d=m[1]?[m[1],m[2],m[3]]:[m[6],m[5],m[4]],iso=d.map((x,i)=>i?x.padStart(2,'0'):x).join('-');return validDate(iso)?iso:'';
};
const gtin=code=>{
 if(!/^(?:\d{8}|\d{12,14})$/.test(code))return false;
 const digits=code.slice(0,-1).split('').reverse();
 const sum=digits.reduce((n,d,i)=>n+Number(d)*(i%2?1:3),0);
 return (10-sum%10)%10===Number(code.at(-1));
};
function rowValue(raw,layout={}){
 let text=raw,vatRate=null,discountPercent=null,discountAmount=null,leadingCode='';
 if(layout.codeBeforeQuantity){const m=text.match(/^([A-Z0-9._/-]+)\s+(.+)$/i);if(m){leadingCode=m[1];text=m[2];}}
 const vat=text.match(/\s+(0|9|21)(?:[.,]0+)?\s*%\s*$/);
 if(vat){vatRate=decimal(vat[1]);text=text.slice(0,vat.index).trim();}
 // A percentage between unit price and amount is an explicit line discount.
 const reduction=text.match(new RegExp('\\s+('+N+')\\s*%\\s+(?:€\\s*)?('+N+')\\s*(?:€|EUR)?$','i'));
 if(reduction){discountPercent=decimal(reduction[1]);text=text.slice(0,reduction.index)+' '+reduction[2];}
 // A trailing rate identified as BTW is never part of the product name.
 let priceUnit='';
 text=text.replace(new RegExp('('+N+')\\s*\\/\\s*('+U+')\\b','gi'),(_,price,u)=>{priceUnit=unitValue(u);return price;});
 const tail=text.match(new RegExp('^(.*?)\\s+(?:€\\s*)?('+N+')\\s*(?:€|EUR)?\\s+(?:€\\s*)?('+N+')\\s*(?:€|EUR)?$','i'));
 if(!tail)return null;
 let left=tail[1].trim(),qty=null,unit='';
 const first=left.match(new RegExp('^('+N+')\\s*(?:[x×]\\s+|('+U+')\\s+)(.+)$','i'))||
  (layout.quantityFirst?left.match(new RegExp('^('+N+')\\s+()(.+)$','i')):null);
 if(first){qty=decimal(first[1]);unit=unitValue(first[2]);left=first[3];}
 else{
  const last=left.match(new RegExp('^(.+?)\\s+('+N+')\\s*(?:[x×]|('+U+'))?\\s*$','i'));
  if(!last)return null;left=last[1];qty=decimal(last[2]);unit=unitValue(last[3]);
 }
 if(!/[\p{L}]/u.test(left)||left.includes('€')||/\d\s*[x×]\s+.*\d\s*[x×]\s+/i.test(left))return null;
 let sku='',ean='';
 const code=left.match(/^([A-Z0-9][A-Z0-9._/-]{2,24})\s+(.+)$/i);
 const productCode=leadingCode||(code&&(layout.codeType==='sku'||/^\d{4,}$/.test(code[1])||/^[A-Z]+[-_]\d/i.test(code[1]))?code[1]:'');
 if(productCode){if(layout.codeType!=='sku'&&gtin(productCode))ean=productCode;else sku=productCode;if(!leadingCode)left=code[2];}
 const price=decimal(tail[2]),lineTotal=decimal(tail[3]);
 if(qty===null||price===null||lineTotal===null)return null;
 const item={name:left.slice(0,500),qty,price,lineTotal,vatRate,ean,sku,unit:unit||priceUnit,discountPercent,discountAmount,rawLine:raw};
 item.needsReview=calculatedLineTotal(item)===null||Math.abs(calculatedLineTotal(item)-lineTotal)>.011||!!(unit&&priceUnit&&unit!==priceUnit);
 if(unit&&priceUnit&&unit!==priceUnit)item.unitWarning='Miktar birimi ile fiyat birimi farklı; koli içeriğini kontrol edin.';
 return item;
}
export function parseInvoiceText(input){
 const all=String(input||'').replace(/\r\n?/g,'\n').split('\n').map(s=>s.replace(/[\u00a0 ]+/g,' ').replace(/^ +| +$/g,'')).filter(s=>s.trim());
 const lines=all.slice(0,3000),warnings=['OCR çıktısını orijinal faturayla karşılaştırın; otomatik sonuçlar kesin değildir.'];
 const find=re=>{for(const line of lines){const m=line.match(re);if(m)return m[1]||'';}return '';};
 const supplier=(lines.find(x=>x.length>3&&!/^\d/.test(x)&&!/factuur|invoice|bonnummer|datum|date|kvk|btw|tel|www|^pagina/i.test(x))||'').slice(0,160);
 const invoiceNumber=find(/\b(?:factuur(?:\s*(?:nummer|nr\.?|no\.?))?|invoice\s*(?:number|no\.?|#)|fact\.?\s*nr\.?|faktura\s*no)\s*[:#\s-]+\s*([A-Z0-9][A-Z0-9./_-]{1,65})\b/i);
 const date=dateValue(find(/(?:factuurdatum|invoice\s*date|^datum)\s*[:\s]+(.+)/i));
 const dueDate=dateValue(find(/(?:vervaldatum|due\s*date|betaling\s*voor)\s*[:\s]+(.+)/i));
 const totals={totalNet:null,totalTax:null,totalGross:null,discount:null},taxBreakdown=[],items=[];
 let taxExplicit=null,discountCents=0,discountFound=false,unparsed=0,layout={},columns=null,lastColumnItem=null,pending=[];
 const appendPending=()=>{if(lastColumnItem&&pending.length){lastColumnItem.name+=' '+pending.join(' ');lastColumnItem.rawLine+='\n'+pending.join('\n');}pending=[];};
 for(const rawLine of lines){
  const line=rawLine.replace(/\s+/g,' ').trim();
  const cells=rawLine.split('\t').map(x=>x.trim()),header=cells.map(columnField);
  if(['name','qty','price','lineTotal'].every(field=>header.includes(field))){appendPending();columns=header;lastColumnItem=null;continue;}
  const isSummary=/^(?:subtotaal|subtotal|totaal|total|btw|vat|te betalen|korting|factuurkorting|iban|betaling|(?:0|9|21)\s*%\s*btw)\b/i.test(line);
  if(isSummary){appendPending();columns=null;lastColumnItem=null;}
  if(columns&&cells.length===columns.length){
   const values=Object.fromEntries(columns.map((key,i)=>[key,cells[i]]).filter(([key])=>key));
   const value=key=>decimal(String(values[key]||'').replace(/%$/,''));
   const q=String(values.qty||'').match(new RegExp('^('+N+')\\s*('+U+')?$','i'));
   const name=String(values.name||''),hasNumbers=['qty','price','lineTotal'].some(key=>values[key]);
   if(!hasNumbers&&name){pending.push(name);continue;}
   if(hasNumbers){
    let fullName=name;
    if(pending.length){if(name&&lastColumnItem)appendPending();else{fullName=[...pending,name].filter(Boolean).join(' ');pending=[];}}
    const item={name:fullName,qty:q?decimal(q[1]):null,unit:unitValue(values.unit||(q?.[2]||'')),price:value('price'),lineTotal:value('lineTotal'),
     sku:values.sku||'',ean:values.ean||'',vatRate:value('vatRate'),discountPercent:value('discountPercent'),discountAmount:value('discountAmount'),rawLine};
    const expected=calculatedLineTotal(item);item.needsReview=expected===null||item.lineTotal===null||Math.abs(expected-item.lineTotal)>.011||!fullName;
    if(items.length<400){items.push(item);lastColumnItem=item;}else unparsed++;
    continue;
   }
  }

  const quantityHeader=line.search(/\b(?:aantal|quantity|hoeveelheid)\b/i),descriptionHeader=line.search(/\b(?:omschrijving|description)\b/i);
  if(quantityHeader>=0&&descriptionHeader>=0&&/prijs|price|bedrag|amount/i.test(line)){
   const codeHeader=line.search(/\b(?:artikel(?:nummer)?|art\.?nr|sku|ean)\b/i);
   layout={quantityFirst:quantityHeader<descriptionHeader,codeBeforeQuantity:codeHeader>=0&&codeHeader<quantityHeader&&quantityHeader<descriptionHeader,codeType:/\b(?:artikel|art\.?nr|sku)/i.test(line)?'sku':'ean'};continue;
  }
  const n=amount(line);
  const isDiscount=/^(?:-?\d+(?:[.,]\d+)?\s*%\s*[x×]?\s*)?(?:korting|discount|factuurkorting)\b/i.test(line);
  if(isDiscount){const off=amount(line.replace(/\s+(?:0|9|21)\s*%\s*$/,''));if(off!==null&&/\d+[.,]\d{2}/.test(line)){discountCents+=Math.round(Math.abs(off)*100);discountFound=true;}continue;}
  // Totals must start with a label; 'subtotaal' and BTW rows cannot become gross.
  if(/^(?:subtotaal|subtotal|totaal\s*(?:excl|exclusief)|netto\s*totaal|net\s*amount|(?:bedrag\s*)?excl\.?\s*btw)\b/i.test(line)){if(n!==null)totals.totalNet=n;continue;}
  if(/^(?:btw\s*(?:totaal|bedrag)|totaal\s*btw|vat\s*(?:total|amount)|total\s*tax)\b/i.test(line)){if(n!==null)taxExplicit=n;continue;}
  if(/^(?:btw\b|vat\b|(?:0|9|21)(?:[.,]0+)?\s*%\s*(?:btw|vat)\b)/i.test(line)){
   if(n!==null&&!/%\s*$/.test(line)){
    const rate=line.match(/\b(0|9|21)(?:[.,]0+)?\s*%/);
    if(rate)taxBreakdown.push({rate:Number(rate[1]),amount:n});else taxExplicit=n;
   }continue;
  }
  if(/^(?:totaal(?:\s*(?:te\s*betalen|incl|inclusief|bedrag))?|total(?:\s*(?:due|amount|incl|gross))?|amount\s*due|grand\s*total|te\s*betalen|eindtotaal)\b/i.test(line)){if(n!==null)totals.totalGross=n;continue;}
  if(/^(?:factuur|invoice|betaling|iban|bic|kvk|adres|address|tel|phone|datum|date|omschrijving|description|artikel(?:nummer)?|aantal|quantity|pagina|page)\b/i.test(line))continue;
  const item=rowValue(line,layout);
  if(item){if(items.length<400)items.push(item);else unparsed++;}
  else if(/\d+[.,]\d{2}\s*(?:€|EUR)?\s*(?:(?:0|9|21)\s*%)?$/.test(line)&&!/^[-=_ ]+$/.test(line))unparsed++;
 }
 appendPending();
 if(discountFound)totals.discount=discountCents/100;
 totals.totalTax=taxExplicit??(taxBreakdown.length?taxBreakdown.reduce((s,x)=>s+Math.round(x.amount*100),0)/100:null);
 if(new Set(taxBreakdown.map(x=>x.rate)).size<taxBreakdown.length)warnings.push('Tekrarlanan BTW oranları var; sayfa ara toplamlarını ve vergi toplamını kontrol edin.');
 if(!invoiceNumber)warnings.push('Fatura numarası güvenilir biçimde okunamadı.');
 if(!date)warnings.push('Fatura tarihi okunamadı.');
 if(!items.length)warnings.push('Ürün satırları güvenilir şekilde ayrıştırılamadı; manuel giriş gerekebilir.');
 const suspicious=items.filter(x=>x.needsReview).length;
 if(suspicious)warnings.push(suspicious+' satır hesap uyuşmazlığı veya birim farkı nedeniyle kontrol gerektiriyor; satırlar listede korundu.');
 if(unparsed)warnings.push(unparsed+' olası tutar satırı ayrıştırılamadı; orijinal belgeyle karşılaştırın.');
 if(totals.totalGross===null)warnings.push('Genel toplam bulunamadı.');
 if(totals.totalNet===null)warnings.push('BTW hariç ara toplam bulunamadı.');
 if(all.length>lines.length)warnings.push('Belge metni işlem sınırını aşıyor; tamamı ayrıştırılmadı.');
 const output={supplier,invoiceNumber,date,dueDate,items,...totals,taxBreakdown,warnings,rawText:lines.join('\n').slice(0,60000),extractionComplete:all.length<=lines.length};
 output.warnings.push(...checkInvoice(output).errors);
 return output;
}
