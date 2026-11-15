import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePoolMonth} from '../src/monthly-pool.mjs';
const invoice=(id,branchId,product,price,date='2026-11-10',overrides={})=>({
 id,branch_id:branchId,branch_name:'Branch '+branchId,source:'nutrient',comparison_ready:true,
 supplier_name:'Wholesale Supplier',invoice_number:'INV-'+id,invoice_date:date,
 items:[{name:product,sku:'CODE-01',ean:'',unit:'ST',qty:10,price,lineTotal:10*price}],...overrides
});
test('finds monthly differences for matching supplier SKU across branches',()=>{
 const r=comparePoolMonth([invoice('a',1,'Milk',2),invoice('b',2,'Milk 1L',3)],{month:'2026-11'});
 assert.equal(r.comparedGroups,1);
 assert.equal(r.items[0].branchCount,2);
 assert.equal(r.items[0].minPrice,2);
 assert.equal(r.items[0].maxPrice,3);
 assert.equal(r.items[0].estimatedDifference,10);
});
test('excludes incorrect months, unconfirmed, legacy, other units and unmatched identifiers',()=>{
 const invoices=[
  invoice('a',1,'Milk',2),invoice('b',2,'Milk',3,'2026-10-10'),
  invoice('c',2,'Milk',3,'2026-11-11',{comparison_ready:false}),
  invoice('d',2,'Milk',3,'2026-11-11',{source:'legacy'}),
  invoice('e',2,'Milk',3,'2026-11-11',{items:[{name:'Milk',sku:'CODE-01',unit:'KG',qty:1,price:3,lineTotal:3}]}),
  invoice('f',2,'Milk',3,'2026-11-11',{items:[{name:'Milk',sku:'',ean:'',unit:'ST',qty:1,price:3,lineTotal:3}]})
 ];
 assert.equal(comparePoolMonth(invoices,{month:'2026-11'}).comparedGroups,0);
});
test('does not compare same supplier SKU from different suppliers',()=>{
 const r=comparePoolMonth([invoice('a',1,'Milk',2),invoice('b',2,'Milk',3,'2026-11-10',{supplier_name:'Other Supplier'})],{month:'2026-11'});
 assert.equal(r.comparedGroups,0);
});
test('branch filter calculates only relevant branch impact',()=>{
 const data=[invoice('a',1,'Milk',2),invoice('b',2,'Milk',3),invoice('c',3,'Milk',4)];
 const r=comparePoolMonth(data,{month:'2026-11',branchId:2});
 assert.equal(r.items.length,1);
 assert.equal(r.items[0].estimatedDifference,10);
});
