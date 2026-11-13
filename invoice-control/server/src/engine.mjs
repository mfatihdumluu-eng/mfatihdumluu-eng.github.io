/** Pure invoice comparison engine, currency handled in integer 1/10000 EUR units. */
export function money4(value){const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Invalid price');return Math.round(n*10000)}
export function euroFrom4(units){return Math.round(units/100)/100}
export function compareLine(line,references,agreement=null){
  const current=money4(line.unit_net);
  const normalized=current/(Number(line.package_multiplier)||1);
  const comparable=references.filter(x=>x.supplier_id===line.supplier_id&&x.product_id===line.product_id&&x.unit===line.unit&&x.branch_id!==line.branch_id).map(x=>({branch_id:x.branch_id,unit_net:Number(x.unit_net),invoice_id:x.invoice_id,invoice_date:x.invoice_date})).filter(x=>Number.isFinite(x.unit_net));
  const floor=comparable.length?Math.min(...comparable.map(x=>x.unit_net)):null;
  const contract=agreement&&Number.isFinite(Number(agreement.net_unit_price))?Number(agreement.net_unit_price):null;
  const threshold=0.02;
  const amount=(reference)=>reference===null?null:euroFrom4(Math.max(0,Math.round((Number(line.unit_net)-reference)*10000))*Number(line.quantity));
  const crossDifference=floor===null?null:Math.round((Number(line.unit_net)-floor)*10000)/10000;
  const contractDifference=contract===null?null:Math.round((Number(line.unit_net)-contract)*10000)/10000;
  return {unit_net:Number(line.unit_net),cross_branch_reference:floor,contract_reference:contract,cross_branch_difference:crossDifference,contract_difference:contractDifference,estimated_cross_impact:amount(floor),estimated_contract_impact:amount(contract),cross_branch_flag:crossDifference!==null&&Math.abs(crossDifference)>threshold,contract_flag:contractDifference!==null&&Math.abs(contractDifference)>threshold,comparison_count:comparable.length,comparison_basis:'supplier + EAN/product + unit + month; differences require human review',normalized_hint:normalized};
}
export function compareSupplierMonth(lines){
  const groups=new Map();
  for(const line of lines){if(!line.product_id||!line.supplier_id||!line.unit)continue;const key=[line.supplier_id,line.product_id,line.unit].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(line)}
  const output=[];
  for(const [key,list] of groups){
    const branches=new Map();
    for(const row of list){const old=branches.get(row.branch_id);if(!old||Number(row.unit_net)<Number(old.unit_net))branches.set(row.branch_id,row)}
    if(branches.size<2)continue;
    const values=[...branches.values()],min=Math.min(...values.map(x=>Number(x.unit_net))),max=Math.max(...values.map(x=>Number(x.unit_net)));
    if(max-min<=.02)continue;
    output.push({supplier_id:list[0].supplier_id,product_id:list[0].product_id,unit:list[0].unit,min_net:min,max_net:max,spread_percent:min>0?Math.round((max/min-1)*10000)/100:null,estimated_difference:Math.round(values.reduce((v,x)=>v+Math.max(0,Number(x.unit_net)-min)*Number(x.quantity),0)*100)/100,branches:values.map(x=>({branch_id:x.branch_id,unit_net:Number(x.unit_net),invoice_id:x.invoice_id,quantity:Number(x.quantity)}))})
  }
  return output.sort((a,b)=>b.estimated_difference-a.estimated_difference)
}
