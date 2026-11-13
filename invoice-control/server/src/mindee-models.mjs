export const MINDEE_MODELS_URL='https://api-v2.mindee.net/v2/search/models';
export function parseMindeeModels(body){
 const raw=body?.models?.models||body?.models?.items||body?.models||body?.items||body?.data?.models||body?.results||body;
 const arr=Array.isArray(raw)?raw:Array.isArray(raw?.items)?raw.items:Array.isArray(raw?.models)?raw.models:[];
 return arr.filter(x=>x&&typeof x.id==='string'&&x.id.length>1).map(x=>({
  id:x.id,name:String(x.name||x.id).slice(0,140),
  type:String(x.model_type||x.modelType||x.type||'').toLowerCase()
 })).filter(x=>!x.type||x.type.includes('extraction'));
}
export async function getMindeeModels(key,{fetchFn=fetch}={}){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
 try{
  const res=await fetchFn(MINDEE_MODELS_URL,{
   headers:{Authorization:key,Accept:'application/json'},signal:ctl.signal,redirect:'error'
  });
  if(!res.ok)throw Error('Mindee model listesi okunamadı (HTTP '+res.status+').');
  return parseMindeeModels(await res.json());
 }finally{clearTimeout(timer)}
}
