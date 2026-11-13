import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';

export const MINDEE_CHECK_URL='https://api-v2.mindee.net/v2/search/models';

export function secretKey(env=process.env.MINDEE_ENCRYPTION_KEY){
 const raw=String(env||'').trim();
 if(/^[a-f0-9]{64}$/i.test(raw))return Buffer.from(raw,'hex');
 const bytes=Buffer.from(raw,'base64');
 if(bytes.length===32&&/^[A-Za-z0-9+/]+={0,2}$/.test(raw))return bytes;
 // Render's generateValue produces a long random ASCII secret, rather than
 // necessarily 32 bytes of hex/base64. Derive a deterministic 256-bit key.
 if(raw.length>=24&&!/\s/.test(raw))return createHash('sha256').update('invoice-control/mindee/v1:'+raw).digest();
 throw new Error('MINDEE_ENCRYPTION_KEY must contain >=24 random characters');
}
export function encryptSecret(value,key=secretKey()){
 if(!value||typeof value!=='string')throw new Error('API anahtarı gerekli');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function decryptSecret(value,key=secretKey()){
 const parts=String(value||'').split('.');
 if(parts.length!==3)throw new Error('Encrypted API key format invalid');
 const [nonce,tag,data]=parts.map(x=>Buffer.from(x,'base64url'));
 if(nonce.length!==12||tag.length!==16)throw new Error('Encrypted API key format invalid');
 const decipher=createDecipheriv('aes-256-gcm',key,nonce);decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
}
// No document processing is triggered: GET /v2/search/models verifies credential
// validity without consuming an invoice extraction.
export async function probeMindee(apiKey,{fetchFn=fetch,timeoutMs=8000}={}){
 if(typeof apiKey!=='string'||apiKey.length<8)return{connected:false,code:'INVALID',message:'API anahtarı gerekli'};
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchFn(MINDEE_CHECK_URL,{
   method:'GET',headers:{Authorization:apiKey,Accept:'application/json'},
   redirect:'error',signal:controller.signal
  });
  if(response.ok)return{connected:true,code:'OK',message:'Mindee API bağlantısı doğrulandı'};
  if(response.status===401)return{connected:false,code:'401',message:'API anahtarı geçersiz veya iptal edilmiş (401)'};
  if(response.status===403)return{connected:false,code:'403',message:'Bu anahtarın model erişim yetkisi yok (403)'};
  if(response.status===429)return{connected:false,code:'429',message:'Mindee istek sınırına ulaşıldı (429)'};
  return{connected:false,code:String(response.status),message:'Mindee bağlantısı başarısız (HTTP '+response.status+')'};
 }catch(error){
  return{connected:false,code:'NETWORK',message:error?.name==='AbortError'?'Mindee bağlantısı zaman aşımına uğradı':'Mindee sunucusuna erişilemiyor'};
 }finally{clearTimeout(timeout)}
}
