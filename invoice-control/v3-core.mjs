// Invoice Control V3 — portable pure matching/search engine, no platform SDK.
export const BRANCHES=[
 {id:1,name:"Dordrecht – Wielwijk",address:"Admiraalsplein 85-87, 3317 BC Dordrecht"},
 {id:2,name:"Dordrecht – Merwedepolder Oost",address:"Rivierenplein 20, 3313 HD Dordrecht"},
 {id:3,name:"Schiedam",address:"'s-Gravelandseweg 668, 3119 NA Schiedam"},
 {id:4,name:"Utrecht",address:"Van Heuven Goedhartlaan 77A, 3527 CG Utrecht"},
 {id:5,name:"Breda",address:"Charleroistraat 172, 4826 LP Breda"},
 {id:6,name:"Bergen op Zoom",address:"Piusplein 12 (Kamperfoeliestraat 50), 4621 EA Bergen op Zoom"},
 {id:7,name:"Gorinchem",address:"Piazza Center 96, 4204 BT Gorinchem"},
 {id:8,name:"Tilburg",address:"Wilhelminapark, 5041 ED Tilburg"},
 {id:9,name:"Eindhoven",address:"Henüz belirtilmedi"}
];
export const SUPPLIERS=[
 {id:"s1",name:"Holland Dairy BV",email:"",contact:"",address:"",phone:"",brand:"Çeşitli"},
 {id:"s2",name:"Van Dijk Foodservice",email:"",contact:"",address:"",phone:"",brand:"Çeşitli"},
 {id:"s3",name:"Freshline Groothandel",email:"",contact:"",address:"",phone:"",brand:"Çeşitli"},
 {id:"s4",name:"Euro Foods BV",email:"",contact:"",address:"",phone:"",brand:"Çeşitli"},
 {id:"s5",name:"Delta Distributie",email:"",contact:"",address:"",phone:"",brand:"Çeşitli"},
 {id:"s6",name:"Noord Trade",email:"",contact:"",address:"",phone:"",brand:"Çeşitli"}
];
export const DEMO_ADMIN_EMAIL=""; // Configure an actual mailbox in settings before sending.
export function safe(s){return String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
export const fmt=n=>new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(Number(n)||0);
export const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
export function canon(text){
 return String(text??"").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/\bcoca[\s-]*cola\b/g,"cocacola").replace(/\bcoke\b/g,"cocacola").replace(/\bpepsi[\s-]*cola\b/g,"pepsi")
 .replace(/\bzero[\s-]*sugar\b/g,"zero").replace(/\bsugar[\s-]*free\b/g,"zero")
 .replace(/(\d+)\s*(?:litre|liter|lt|l)\b/g,"$1l")
 .replace(/(\d+)\s*(?:ml)\b/g,"$1ml")
 .replace(/(\d+)\s*(?:kg|kilo)\b/g,"$1kg")
 .replace(/(\d+)\s*(?:gr|gram|g)\b/g,"$1g")
 .replace(/[^a-z0-9]+/g," ").trim();
}
export function packageKey(text){
 const raw=canon(text);
 const found=raw.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg)\b/i);
 if(!found)return "";
 let n=Number(found[1].replace(",",".")),unit=found[2];
 if(unit==="l"){n*=1000;unit="ml"}
 if(unit==="kg"){n*=1000;unit="g"}
 return Math.round(n)+unit;
}
export function productKey(item){
 const ean=String(item.ean||"").replace(/\D/g,"");
 return ean.length>=8?"ean:"+ean:null;
}
export function isSimilar(a,b){
 if(a.ean&&b.ean&&String(a.ean)===String(b.ean))return{score:100,reason:"Aynı EAN"};
 const pa=packageKey(a.name),pb=packageKey(b.name);
 if(pa&&pb&&pa!==pb)return{score:0,reason:"Ambalaj miktarı farklı"};
 const brandA=canon(a.brand||""),brandB=canon(b.brand||"");
 const na=canon(a.name),nb=canon(b.name);
 if(brandA&&brandB&&brandA!==brandB)return{score:0,reason:"Markalar farklı"};
 const tokensA=new Set(na.split(/\s+/).filter(x=>x.length>1&&!/^\d+(?:ml|l|kg|g)$/.test(x)));
 const tokensB=new Set(nb.split(/\s+/).filter(x=>x.length>1&&!/^\d+(?:ml|l|kg|g)$/.test(x)));
 const intersection=[...tokensA].filter(x=>tokensB.has(x)).length;
 const union=new Set([...tokensA,...tokensB]).size;
 const score=na===nb?99:union?Math.round(100*intersection/union):0;
 return {score:pa&&pb&&pa===pb?Math.min(99,score+8):score,reason:na===nb?"Aynı ürün adı":"Benzer ürün adı (doğrulama gerekli)"};
}
export function matchesSearch(item,query){const q=canon(query);return !q||canon([item.name,item.brand,item.ean,item.sku].join(" ")).includes(q)}
export function invoiceMatches(inv,query){
 const q=canon(query);
 return !q||canon([inv.invoiceNo,inv.supplierName,inv.date,inv.branchName,inv.rawText, ...inv.items.flatMap(x=>[x.name,x.brand,x.ean,x.sku])].join(" ")).includes(q);
}
export function monthOf(date){return /^\d{4}-\d{2}/.test(String(date))?String(date).slice(0,7):""}
export function invoiceSearch(invoices,{month,allTime=false,query="",branchId=null,supplierId=""}={}){
 return invoices.filter(i=>(allTime||!month||monthOf(i.date)===month)&&(!branchId||Number(i.branchId)===Number(branchId))&&(!supplierId||i.supplierId===supplierId)&&invoiceMatches(i,query)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
export function indexItems(invoices,{month,allTime=false}={}){
 return invoices.filter(i=>allTime||!month||monthOf(i.date)===month).flatMap(inv=>inv.items.map((item,idx)=>({...item,invoiceId:inv.id,invoiceNo:inv.invoiceNo,invoiceDate:inv.date,supplierId:inv.supplierId,supplierName:inv.supplierName,branchId:inv.branchId,branchName:inv.branchName,lineIdx:idx})));
}
export function findCrossSupplier(invoices,query,{month,allTime=false,limit=120}={}){
 const target={name:query};
 const q=canon(query);
 if(!q)return [];
 const matches=indexItems(invoices,{month,allTime}).map(x=>{
  const direct=matchesSearch(x,q);
  const similar=isSimilar(target,x);
  const score=direct?100:similar.score;
  return {...x,matchScore:score,matchReason:direct?"Arama eşleşmesi":similar.reason}
 }).filter(x=>x.matchScore>=58).sort((a,b)=>b.matchScore-a.matchScore||String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
 return matches.slice(0,limit);
}
export function crossBranchDiscrepancies(invoices,{month,allTime=false}={}){
 const rows=indexItems(invoices,{month,allTime}),groups=new Map();
 for(const x of rows){const prod=productKey(x)||("name:"+canon(x.name)+"|"+packageKey(x.name));
  const key=x.supplierId+"|"+prod;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(x);
 }
 const output=[];
 for(const [key,list] of groups){
  const byBranch=new Map();
  for(const x of list){const b=byBranch.get(x.branchId);if(!b||x.unitPrice<b.unitPrice)byBranch.set(x.branchId,x)}
  if(byBranch.size<2)continue;
  const low=Math.min(...list.map(x=>Number(x.unitPrice))),high=Math.max(...list.map(x=>Number(x.unitPrice)));
  if(high-low<0.025)continue;
  output.push({key,supplierId:list[0].supplierId,name:list[0].name,ean:list[0].ean||"",low,high,
   difference:round(high-low),percent:low?round((high-low)/low*100):0,
   total:round(list.reduce((sum,x)=>sum+Math.max(0,Number(x.unitPrice)-low)*Number(x.qty),0)),
   lines:list,branches:byBranch.size});
 }
 return output.sort((a,b)=>b.total-a.total);
}
export function invoiceTotal(invoice){return round(invoice.items.reduce((v,x)=>v+Number(x.qty)*Number(x.unitPrice),0))}
export function fixtures(){
 const suppliers=SUPPLIERS.map(x=>({...x})),invoices=[];
 const products=[
  {ean:"5449000000996",name:"Coca Cola 1L",brand:"Coca Cola",qty:100,unitPrice:1.16},
  {ean:"5449000000996",name:"Coca-Cola 1 L",brand:"Coca Cola",qty:120,unitPrice:1.37},
  {ean:"8711234000001",name:"Beyaz Peynir 800 g",brand:"Anadolu",qty:80,unitPrice:4.26},
  {ean:"8711234000001",name:"Beyaz Peynir 800g",brand:"Anadolu",qty:100,unitPrice:4.65},
  {ean:"8711234000002",name:"Yoğurt 1 kg",brand:"Anadolu",qty:70,unitPrice:1.41}
 ];
 function make(id,date,branchId,supplierId,invoiceNo,items){
 const s=suppliers.find(s=>s.id===supplierId),branch=BRANCHES.find(b=>b.id===branchId);
 const subtotal=round(items.reduce((x,r)=>x+r.qty*r.unitPrice,0));
 const vat=round(subtotal*.09);
 return {id,invoiceNo,date,branchId,supplierId,supplierName:s.name,branchName:branch.name,
 source:"Örnek Veri",createdAt:date+"T11:00:00",items:items.map(x=>({...x,unit:"adet",vatRate:9})),
 fields:{supplierName:s.name,supplierTaxNo:"DEMO",supplierAddress:"Örnek tedarikçi adresi",recipientName:branch.name,recipientAddress:branch.address,invoiceNo,date,subtotal,vatTotal:vat,total:round(subtotal+vat),currency:"EUR",dueDate:"",paymentReference:"",iban:""},rawText:"ÖRNEK FATURA "+invoiceNo+"\n"+items.map(x=>x.name+" "+x.qty+" × "+x.unitPrice).join("\n"),docId:null};
 }
 invoices.push(make("d1","2026-11-03",1,"s1","HD-2026-111",[{...products[0],qty:100,unitPrice:1.16},products[2]]));
 invoices.push(make("d2","2026-11-05",2,"s1","HD-2026-112",[{...products[1],qty:120,unitPrice:1.37},products[3]]));
 invoices.push(make("d3","2026-11-07",3,"s2","VD-2026-51",[{...products[0],name:"Coca-Cola 1 liter",qty:90,unitPrice:1.29},products[4]]));
 invoices.push(make("d4","2026-11-10",4,"s2","VD-2026-54",[{...products[0],qty:75,unitPrice:1.17},products[2]]));
 invoices.push(make("d5","2026-11-12",1,"s3","FG-2026-101",[{ean:"8711234000088",name:"Elma Golden 1 kg",brand:"Fresh",qty:30,unitPrice:1.50}]));
 invoices.push(make("d6","2026-10-04",1,"s1","HD-2026-101",[{...products[0],qty:100,unitPrice:1.05}]));
 invoices.push(make("d7","2026-11-13",7,"s4","EF-2026-1",[{...products[0],qty:50,unitPrice:1.41}]));
 invoices.push(make("d8","2026-11-09",2,"s3","FG-2026-100",[{...products[0],name:"Coca Cola Original 1L",qty:40,unitPrice:1.20}]));
 return {suppliers,invoices};
}
