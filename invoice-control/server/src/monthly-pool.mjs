// Cross-branch monthly comparisons of human-reviewed Nutrient invoices.
// A comparison is valid only for exactly matching supplier + product identity + unit.
// Supplier SKUs are supplier-specific. Without EAN or SKU, exact description match
// can be used as a candidate but is NOT a verified canonical product match.
export const normalized=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('nl-NL').replace(/\s+/g,' ').trim();
const n=v=>v===null||v===undefined||v===''?null:Number(v);
const money=v=>Math.round(v*10000)/10000;
function identity(item,supplier){
 const ean=String(item.ean||'').replace(/[^\d]/g,'');
 const sku=normalized(item.sku);
 if(ean.length>=8&&ean.length<=14)return{key:'ean:'+ean,type:'ean',quality:'EAN eşleşmesi'};
 if(sku)return{key:'supplier:'+supplier+'|sku:'+sku,type:'sku',quality:'Tedarikçi ürün kodu eşleşmesi'};
 return null; // Do not call two similarly named products the same product.
}
export function comparePoolMonth(invoices,{month,branchId=null}={}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw Error('YYYY-MM gerekli');
 const groups=new Map(),included=[];
 for(const inv of invoices){
  if(inv.source!=='nutrient'||inv.comparison_ready!==true||!inv.branch_id||String(inv.invoice_date||'').slice(0,7)!==month)continue;
  included.push(inv);
  const supplier=normalized(inv.supplier_name);
  for(const [index,row] of (Array.isArray(inv.items)?inv.items:[]).entries()){
   const id=identity(row,supplier),unit=normalized(row.unit);
   const qty=n(row.qty),line=n(row.lineTotal),price=n(row.price);
   if(!id||!unit||!Number.isFinite(qty)||qty<=0||(!Number.isFinite(line)&&!Number.isFinite(price)))continue;
   // Use effective NET unit price when the invoiced line amount includes discount.
   const effective=Number.isFinite(line)?line/qty:price;
   if(!Number.isFinite(effective)||effective<0)continue;
   const key=[supplier,id.key,unit].join('|');
   const item={branchId:Number(inv.branch_id),branchName:String(inv.branch_name||''),invoiceId:inv.id,invoiceNumber:inv.invoice_number,
    date:String(inv.invoice_date).slice(0,10),supplier:inv.supplier_name,product:row.name,
    sku:row.sku||'',ean:row.ean||'',unit:row.unit,quantity:qty,price:money(effective),lineIndex:index};
   if(!groups.has(key))groups.set(key,{id,unit,rows:[]});
   groups.get(key).rows.push(item);
  }
 }
 const results=[];
 for(const {id,unit,rows} of groups.values()){
  const branchIds=new Set(rows.map(x=>x.branchId));
  if(branchIds.size<2)continue;
  const min=Math.min(...rows.map(x=>x.price)),max=Math.max(...rows.map(x=>x.price));
  if(max-min<=0.02)continue;
  const best=rows.find(x=>x.price===min);
  const candidates=branchId?rows.filter(x=>x.branchId===Number(branchId)):rows;
  if(!candidates.length)continue;
  const impact=candidates.reduce((s,r)=>s+Math.max(0,r.price-min)*r.quantity,0);
  results.push({
   product:best.product,supplier:best.supplier,productKey:id.key,identityQuality:id.quality,
   unit,minPrice:min,maxPrice:max,spread:money(max-min),branchCount:branchIds.size,
   invoiceCount:rows.length,estimatedDifference:Math.round(impact*100)/100,
   rows:rows.sort((a,b)=>a.date.localeCompare(b.date)||a.branchId-b.branchId)
  });
 }
 results.sort((a,b)=>b.estimatedDifference-a.estimatedDifference);
 return {month,invoiceCount:included.length,comparedGroups:results.length,items:results};
}
