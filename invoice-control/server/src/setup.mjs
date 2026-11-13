import fs from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import pg from 'pg';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const names=['Dordrecht – Wielwijk','Dordrecht – Merwedepolder Oost','Schiedam','Utrecht','Breda','Bergen op Zoom','Gorinchem','Tilburg','Eindhoven'];
const addresses=['Admiraalsplein 85-87, 3317 BC Dordrecht','Rivierenplein 20, 3313 HD Dordrecht',"'s-Gravelandseweg 668, 3119 NA Schiedam",'Van Heuven Goedhartlaan 77A, 3527 CG Utrecht','Charleroistraat 172, 4826 LP Breda','Piusplein 12 (Kamperfoeliestraat 50), 4621 EA Bergen op Zoom','Piazza Center 96, 4204 BT Gorinchem','Wilhelminapark, 5041 ED Tilburg',null];
const hash=(password)=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')};
try{
 await db.query(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 await db.query('ALTER TABLE branches ADD COLUMN IF NOT EXISTS address text');
 for(let i=0;i<names.length;i++)await db.query('INSERT INTO branches(name,address) VALUES ($1,$2) ON CONFLICT(name) DO UPDATE SET address=EXCLUDED.address',[names[i],addresses[i]]);
 const list=(await db.query('SELECT id,name FROM branches ORDER BY id')).rows;
 let created=0;
 for(const b of list){const email='sube'+b.id+'@demo.invalid',existing=await db.query('SELECT 1 FROM users WHERE email=$1',[email]);if(existing.rowCount)continue;const pass=randomBytes(18).toString('base64url');await db.query('INSERT INTO users(email,name,password_hash,role,branch_id) VALUES ($1,$2,$3,$4,$5)',[email,'Şube '+b.name,hash(pass),'branch',b.id]);console.log(email+' | temporary password: '+pass);created++}
 for(const [email,name,role] of [['admin@demo.invalid','Firma Admini','admin'],['system@demo.invalid','Sistem Admini','system']]){const existing=await db.query('SELECT 1 FROM users WHERE email=$1',[email]);if(existing.rowCount)continue;const pass=randomBytes(18).toString('base64url');await db.query('INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,$3,$4)',[email,name,hash(pass),role]);console.log(email+' | temporary password: '+pass);created++}
 console.log('Created '+created+' users. Store passwords securely; change and enable MFA before production.');
}catch(e){console.error(e);process.exitCode=1}finally{await db.end()}
