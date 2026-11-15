// Keep physical reading order instead of relying on PDF content-stream order.
// The same coordinates are used for native PDF text and Tesseract words.
export function columnField(label){
 const s=String(label).toLowerCase().replace(/[\s_.:%€()/-]/g,'');
 if(/^(omschrijving|description|artikelomschrijving|productomschrijving|benaming|name)$/.test(s))return 'name';
 if(/^(aantal|quantity|hoeveelheid|qty)$/.test(s))return 'qty';
 if(/^(prijs|price|unitprice|stuksprijs|eenheidsprijs|nettoprijs)$/.test(s))return 'price';
 if(/^(bedrag|amount|totaal|total|lineamount|linetotal|regelbedrag)$/.test(s))return 'lineTotal';
 if(/^(btw|vat|vatrate)$/.test(s))return 'vatRate';
 if(/^(korting|discount)$/.test(s)&&/[€]|eur/i.test(label))return 'discountAmount';
 if(/^(korting|discount|discountpercent)$/.test(s))return 'discountPercent';
 if(/^(kortingbedrag|discountamount)$/.test(s))return 'discountAmount';
 if(/^(artikel|artikelnummer|artikelnr|artikelcode|artnr|sku|code)$/.test(s))return 'sku';
 if(/^(ean|barcode)$/.test(s))return 'ean';
 if(/^(eenheid|unit)$/.test(s))return 'unit';
 return null;
}
export const columnLabels={name:'Omschrijving',qty:'Aantal',price:'Prijs',lineTotal:'Bedrag',vatRate:'BTW',sku:'Artikelnummer',ean:'EAN',unit:'Eenheid',discountPercent:'Korting %',discountAmount:'Kortingbedrag'};
export function positionedText(input){
 const unique=new Map();
 for(const word of input){if(word.text?.trim()&&[word.x0,word.y0,word.x1,word.y1].every(Number.isFinite)){const key=[word.text.trim(),...['x0','y0','x1','y1'].map(k=>Math.round(word[k]*10))].join('|');unique.set(key,{...word,text:word.text.trim()});}}
 const words=[...unique.values()];
 words.sort((a,b)=>(a.y0+a.y1-b.y0-b.y1)/2||a.x0-b.x0);
 const rows=[];
 for(const word of words){
  const center=(word.y0+word.y1)/2,height=Math.max(1,word.y1-word.y0),last=rows.at(-1);
  if(last&&Math.abs(last.center-center)<=Math.min(last.height,height)*.48){last.words.push(word);last.height=Math.max(last.height,height);}
  else rows.push({center,height,words:[word]});
 }
 let columns=null;
 const output=[];
 for(const row of rows){
  const tokens=row.words.sort((a,b)=>a.x0-b.x0),plain=tokens.map(w=>w.text).join(' ');
  const headers=tokens.map(w=>({...w,field:columnField(w.text)})).filter(w=>w.field);
  if(['name','qty','price','lineTotal'].every(key=>headers.some(w=>w.field===key))){
   columns=headers.filter((h,i)=>headers.findIndex(x=>x.field===h.field)===i);
   output.push(columns.map(c=>columnLabels[c.field]).join('\t'));continue;
  }
  if(!columns){output.push(plain);continue;}
  if(/^(?:subtotaal|subtotal|totaal|total|btw|vat|te betalen|korting|factuurkorting|iban|betaling)\b/i.test(plain)){columns=null;output.push(plain);continue;}
  const used=new Set(),cells=columns.map(()=>[]);
  // Numeric columns are anchored by the right edge, as on most invoices.
  for(const [i,column] of columns.entries()){
   if(!['qty','price','lineTotal','vatRate','discountPercent','discountAmount'].includes(column.field))continue;
   const nearby=columns.filter(c=>c!==column).map(c=>Math.abs(c.x0-column.x0));
   const radius=Math.max(10,Math.min(70,Math.min(...nearby)*.48));
   const choices=tokens.map((word,index)=>({word,index,distance:Math.min(Math.abs(word.x1-column.x1),Math.abs(word.x0-column.x0))}))
    .filter(({word,index,distance})=>!used.has(index)&&distance<=radius&&/^-?\d+(?:[.,]\d+)*(?:\s*[%€]|kg|st|pcs)?$/i.test(word.text)).sort((a,b)=>a.distance-b.distance);
   if(choices.length){const selected=choices[0];cells[i].push(selected.word.text);used.add(selected.index);
    if(column.field==='qty'&&!columns.some(c=>c.field==='unit')){const extra=tokens.findIndex((w,index)=>!used.has(index)&&/^(?:kg|st\.?|pcs|doos|ds|pak|pk|l)$/i.test(w.text)&&w.x0>=selected.word.x1-2&&w.x0-selected.word.x1<row.height*1.6);if(extra>=0){cells[i].push(tokens[extra].text);used.add(extra);}}
   }
  }
  for(const [i,column] of columns.entries()){
   if(['qty','price','lineTotal','vatRate','discountPercent','discountAmount'].includes(column.field))continue;
   const next=columns[i+1],previous=columns[i-1];
   const start=column.x0-Math.min(15,previous?(column.x0-previous.x0)*.15:15),end=next?next.x0-4:Infinity;
   tokens.forEach((word,index)=>{if(!used.has(index)&&!/^[$€%]$/.test(word.text)&&word.x0>=start&&word.x0<end){cells[i].push(word.text);used.add(index);}});
  }
  const amountCount=columns.filter((c,i)=>['qty','price','lineTotal'].includes(c.field)&&cells[i].length).length;
  const name=cells[columns.findIndex(c=>c.field==='name')].join(' ');
  // Preserve unrecognized rows in raw text instead of assigning uncertain values.
  if(amountCount===0&&!name){output.push(plain);continue;}
  output.push(cells.map(c=>c.join(' ')).join('\t'));
 }
 return output.join('\n');
}
export function ocrPositionedText(data){
 const words=[];
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[]){words.push({text:word.text,...word.bbox});}
 return words.length?positionedText(words):data.text||'';
}
