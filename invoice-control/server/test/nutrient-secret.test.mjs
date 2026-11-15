import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptionKey,sealApiKey,openApiKey} from '../src/nutrient-secret.mjs';
test('Nutrient key is encrypted with authenticated AES-256-GCM',()=>{
 const key=encryptionKey('an-adequately-long-random-server-secret-for-testing');
 const raw='example_nutrient_api_key_for_test';
 const encrypted=sealApiKey(raw,key);
 assert(!encrypted.includes(raw));
 assert.equal(openApiKey(encrypted,key),raw);
 assert.throws(()=>openApiKey(encrypted,encryptionKey('another-long-random-server-secret-with-different-entropy')));
});
test('No key without valid server encryption secret',()=>{
 assert.throws(()=>encryptionKey('short'));
});
