import fs from 'node:fs/promises';
import pg from 'pg';
import {randomBytes,scryptSync} from 'node:crypto';
if(!process.env.DATABASE_URL){console.error('DATABASE_URL missing. Set the internal Render Postgres connection URL as a secret env var.');process.exit(1)}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:12000});
try{
 await pool.query(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 const email=String(process.env.INVOICE_SYSTEM_EMAIL||'').trim().toLowerCase();
 const password=String(process.env.INVOICE_SYSTEM_PASSWORD||'');
 if(email&&password){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<20)
   throw Error('INVOICE_SYSTEM_EMAIL must be a valid email and INVOICE_SYSTEM_PASSWORD must contain at least 20 characters');
  const salt=randomBytes(16).toString('hex');
  const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
  // Only bootstrap when absent: later deploys never reset the password.
  await pool.query(
   "INSERT INTO users(email,name,password_hash,role,branch_id) VALUES($1,$2,$3,'system',NULL) ON CONFLICT(email) DO NOTHING",
   [email,'Sistem Admini',hash]
  );
 }
 console.log('Database schema ready; system admin bootstrap: '+(email?'configured':'not configured'));
}catch(e){console.error('Bootstrap failed:',e.message);process.exitCode=1}
finally{await pool.end()}
