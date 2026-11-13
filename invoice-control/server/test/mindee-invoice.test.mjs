import test from 'node:test';
import assert from 'node:assert/strict';
import * as mindee from 'mindee';
import {normalizeMindeeInvoice,extractMindeeInvoice} from '../src/mindee-invoice.mjs';
test('Mindee V2 invoice fields convert into editable product rows',()=>{
 const response={inference:{result:{fields:{
  supplier_name:{value:'Doyum Food B.V.'},
  invoice_number:{value:'26704293'},date:{value:'2026-10-28'},
  total_net:{value:1051.35},total_tax:{value:94.62},total_amount:{value:1145.97},
  line_items:{items:[
   {fields:{description:{value:'Pakket Doyum Kip Döner'},quantity:{value:50},unit_price:{value:6.99},total_price:{value:349.50},tax_rate:{value:0.09}}},
   {fields:{description:{value:'Pakket Doyum Rund Döner'},quantity:{value:40},unit_price:{value:7.99},total_price:{value:319.60},tax_rate:{value:9}}}
  ]}
 }}}};
 const parsed=normalizeMindeeInvoice(response);
 assert.equal(parsed.supplier,'Doyum Food B.V.');
 assert.equal(parsed.invoiceNumber,'26704293');
 assert.equal(parsed.items.length,2);
 assert.equal(parsed.items[0].qty,50);
 assert.equal(parsed.items[0].price,6.99);
 assert.equal(parsed.items[0].vatRate,9);
 assert.equal(parsed.items[1].vatRate,9);
 assert.equal(parsed.totalGross,1145.97);
});
test('Never invent quantity, price or missing rows',()=>{
 const parsed=normalizeMindeeInvoice({inference:{result:{fields:{
  line_items:{value:[{description:'Test ürün',quantity:null,unit_price:null}]},
  total_amount:{value:null}
 }}}});
 assert.equal(parsed.items.length,1);
 assert.equal(parsed.items[0].qty,null);
 assert.equal(parsed.items[0].price,null);
 assert(parsed.warnings.length>=2);
});
test('Unit price mismatch produces verification warning',()=>{
 const parsed=normalizeMindeeInvoice({inference:{result:{fields:{
  line_items:{value:[{description:'Elma',quantity:10,unit_price:2,total_price:21}]},
  total_amount:{value:21}
 }}}});
 assert(parsed.warnings.some(x=>x.includes('satır toplamı')));
});

test('official Mindee Node SDK V2 constructor and extraction classes exist',()=>{
 assert.equal(typeof mindee.Client,'function');
 assert.equal(typeof mindee.BufferInput,'function');
 assert(mindee.product?.Extraction);
});
test('invoice processing calls correct SDK class and model with a stub, without sending a file',async()=>{
 const response={inference:{result:{fields:{invoice_number:{value:'TEST-123'},total_amount:{value:15},line_items:{value:[{description:'Ürün',quantity:3,unit_price:5,total_price:15}]}}}}};
 let called=false;
 const result=await extractMindeeInvoice('md_fake','model_123',
  {data:Buffer.from('not a real PDF'),filename:'test.pdf'},{
   clientFactory:()=>({enqueueAndGetResult:async(product,input,params)=>{
    called=true;
    assert.equal(product,mindee.product.Extraction);
    assert.equal(params.modelId,'model_123');
    assert.equal(input.filename,'test.pdf');
    return response;
   }})
  });
 assert(called);
 assert.equal(result.invoiceNumber,'TEST-123');
 assert.equal(result.items.length,1);
});
