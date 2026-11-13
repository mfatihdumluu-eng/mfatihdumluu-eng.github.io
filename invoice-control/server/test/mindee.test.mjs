import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encryptSecret,decryptSecret,secretKey,probeMindee,MINDEE_CHECK_URL} from '../src/mindee.mjs';

test('Mindee V2 API key encryption is authenticated; no plaintext exposed',()=>{
 const key=randomBytes(32),secret='md_abcdef0123456789';
 const ciphertext=encryptSecret(secret,key);
 assert(!ciphertext.includes(secret));
 assert.equal(decryptSecret(ciphertext,key),secret);
 assert.throws(()=>decryptSecret(ciphertext,randomBytes(32)));
});
test('server encryption key requires 32 bytes of hex',()=>{
 assert.throws(()=>secretKey('short'));
 assert.equal(secretKey(randomBytes(32).toString('hex')).length,32);
});
test('green only for real 2xx Mindee v2 models response',async()=>{
 let calls=0;
 const fetchFn=async(url,opts)=>{
  calls++;
  assert.equal(url,MINDEE_CHECK_URL);
  assert.equal(opts.method,'GET');
  assert.equal(opts.headers.Authorization,'md_VALID');
  return{ok:true,status:200};
 };
 const result=await probeMindee('md_VALID',{fetchFn});
 assert.equal(calls,1);
 assert.equal(result.connected,true);
});
test('401, 403, 429 and other failures are disconnected',async()=>{
 for(const status of [401,403,429,500]){
  const result=await probeMindee('md_INVALID',{fetchFn:async()=>({ok:false,status})});
  assert.equal(result.connected,false);
  assert.equal(result.code,String(status));
 }
});
test('network error stays red',async()=>{
 const result=await probeMindee('md_NETWORK',{fetchFn:async()=>{throw new Error('network')}})
 assert.equal(result.connected,false);
 assert.equal(result.code,'NETWORK');
});
