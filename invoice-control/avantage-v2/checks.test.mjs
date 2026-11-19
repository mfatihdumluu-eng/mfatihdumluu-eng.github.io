import test from 'node:test';
import assert from 'node:assert/strict';
import {checkInvoice, findDuplicate} from './checks.mjs';
test('valid arithmetic still requires manual approval',()=>{
 assert.deepEqual(checkInvoice({supplierId:'s',invoiceNumber:'1',netCents:10000,vatCents:2100,grossCents:12100}),
   {status:'ready_for_manual_review',issues:[]});
});
test('difference is computed in exact cents',()=>{
 const result=checkInvoice({supplierId:'s',invoiceNumber:'1',netCents:10000,vatCents:2100,grossCents:12101});
 assert.equal(result.status,'needs_review');
 assert.equal(result.issues.find(x=>x.code==='TOTAL_MISMATCH').differenceCents,1);
});
test('empty and fractional monetary values require review',()=>{
 const result=checkInvoice({supplierId:'',invoiceNumber:'',netCents:1.5,vatCents:null,grossCents:100});
 assert.equal(result.issues.filter(x=>x.code==='INVALID_AMOUNT').length,2);
});
test('duplicate must match tenant and supplier',()=>{
 const invoice={tenantId:'a',supplierId:'s',invoiceNumber:' N-10 '};
 const rows=[{tenantId:'b',supplierId:'s',invoiceNumber:'N-10'},{tenantId:'a',supplierId:'different',invoiceNumber:'N-10'}];
 assert.equal(findDuplicate(invoice,rows),false);
 rows.push({tenantId:'a',supplierId:'s',invoiceNumber:'n-10'});
 assert.equal(findDuplicate(invoice,rows),true);
});
