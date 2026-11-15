import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWithNutrient,normalizeNutrient,NutrientRequestError} from '../src/nutrient-extract.mjs';

const sample={output:{data:{
 supplier:'Groothandel B.V.',invoiceNumber:'00042-2026',date:'2026-11-15',
 totalNet:100,totalTax:9,totalGross:109,
 items:[{name:'Yoghurt',sku:'0009988',unit:'ST',qty:10,price:10,lineTotal:100,vatRate:9}]
}},metrics:{pagesProcessed:1},usage:{data_extraction_credits:{cost:15,remainingCredits:4985}}};
test('Maps Nutrient output.data invoice preserving line order and leading zeros',()=>{
 const x=normalizeNutrient(sample);
 assert.equal(x.invoiceNumber,'00042-2026');
 assert.equal(x.items[0].sku,'0009988');
 assert.equal(x.items[0].qty,10);
 assert.equal(x.items[0].vatRate,9);
 assert.equal(x.totalGross,109);
 assert.equal(x.provider,'nutrient');
 assert.equal(x.extractionComplete,true);
});
test('Missing line prices are never invented and marked for review',()=>{
 const x=normalizeNutrient({output:{data:{supplier:'S',items:[{name:'A',qty:3}]}}});
 assert.equal(x.items[0].price,null);
 assert(x.warnings.some(w=>w.includes('birim fiyatı eksik')));
});
test('Sends exact authorized Nutrient /extraction/extract request with schema',async()=>{
 let seen=false;
 const fetchFn=async(url,options)=>{
  seen=true;
  assert.equal(url,'https://api.nutrient.io/extraction/extract');
  assert.equal(options.headers.Authorization,'Bearer example_fake_key');
  assert.equal(options.body.get('file').name,'invoice.pdf');
  const ins=JSON.parse(options.body.get('instructions'));
  assert.equal(ins.mode,'understand');
  assert.equal(ins.schema.properties.items.type,'array');
  return {ok:true,json:async()=>sample};
 };
 const r=await extractWithNutrient({apiKey:'example_fake_key',data:Buffer.from('%PDF-1.7'),mime:'application/pdf',filename:'invoice.pdf',fetchFn});
 assert(seen);
 assert.equal(r.items.length,1);
});
test('Rejects provider failure without leaking the API secret',async()=>{
 await assert.rejects(
  extractWithNutrient({apiKey:'private-secret',data:Buffer.from('%PDF'),mime:'application/pdf',filename:'a.pdf',
   fetchFn:async()=>({ok:false,status:401})}),
  err=>err instanceof NutrientRequestError&&err.kind==='AUTH'&&!err.message.includes('private-secret')
 );
});
