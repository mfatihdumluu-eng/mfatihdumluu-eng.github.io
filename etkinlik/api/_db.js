import { neon } from '@neondatabase/serverless';
export const db = () => { if(!process.env.DATABASE_URL) throw new Error('Database configuration missing'); return neon(process.env.DATABASE_URL); };
export function respond(res,status,data){res.status(status).setHeader('Cache-Control','no-store').json(data)}
export function sanitize(value,max=500){return typeof value==='string'?value.trim().slice(0,max):''}
export function authorized(req){const key=process.env.ADMIN_API_KEY;const supplied=req.headers['x-admin-key'];if(!key||typeof supplied!=='string')return false;const a=new TextEncoder().encode(key),b=new TextEncoder().encode(supplied);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
