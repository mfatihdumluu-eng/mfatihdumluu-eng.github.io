import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

// Render provides a random secret once. Encrypt the API key at rest; never send it
// back to the browser, include it in logs, or commit it to the repository.
export function encryptionKey(seed=process.env.NUTRIENT_ENCRYPTION_KEY){
 const secret=String(seed||'');
 if(secret.length<24)throw new Error('NUTRIENT_ENCRYPTION_KEY is missing or too short');
 return createHash('sha256').update('invoice-control:nutrient:v1\0'+secret,'utf8').digest();
}
export function sealApiKey(secret,key=encryptionKey()){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const raw=String(secret||'').trim();
 if(raw.length<10||raw.length>2000)throw new Error('Invalid API key');
 const ciphertext=Buffer.concat([cipher.update(raw,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');
}
export function openApiKey(encrypted,key=encryptionKey()){
 const [version,iv,tag,body,...rest]=String(encrypted||'').split('.');
 if(version!=='v1'||!iv||!tag||!body||rest.length)throw new Error('Invalid encrypted key');
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));
 decipher.setAuthTag(Buffer.from(tag,'base64'));
 return Buffer.concat([decipher.update(Buffer.from(body,'base64')),decipher.final()]).toString('utf8');
}
