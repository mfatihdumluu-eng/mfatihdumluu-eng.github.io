// Temporary, environment-gated database transfer support. Remove after cutover.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

const root = path.join(os.tmpdir(), 'parently-db-transfer');
const dumpFile = path.join(root, 'parently.dump');
const manifestFile = path.join(root, 'manifest.json');
const qid = s => '"' + s.replaceAll('"', '""') + '"';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function pgEnv(url) {
  const u = new URL(url);
  return { PGHOST:u.hostname, PGPORT:u.port||'5432', PGDATABASE:decodeURIComponent(u.pathname.slice(1)), PGUSER:decodeURIComponent(u.username), PGPASSWORD:decodeURIComponent(u.password), PGSSLMODE:u.searchParams.get('sslmode')||(u.hostname.endsWith('.neon.tech')?'verify-full':'prefer'), PGCONNECT_TIMEOUT:'20', PGCHANNELBINDING:u.searchParams.get('channel_binding')||'prefer' };
}
const schemasWhere = "n.nspname !~ '^pg_' AND n.nspname NOT IN ('information_schema', 'neon')";
let binaries;
let state = { status: 'idle', stage: 'ready' };

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        fs.mkdirSync(root, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(root, 'command-error.txt'), stderr, { mode: 0o600 });
        reject(Object.assign(new Error('Transfer command failed'), { code: 'COMMAND_FAILED', exitCode: code }));
      } else resolve(stdout);
    });
  });
}

async function installTools() {
  if (binaries) return binaries;
  try {
    const v = await run('pg_dump', ['--version']);
    if (/PostgreSQL\) 18\./.test(v)) return binaries = { dump: 'pg_dump', restore: 'pg_restore', env: {}, version: v.trim() };
  } catch {}
  state.stage = 'install-postgresql-18-client';
  if (process.platform !== 'linux' || process.arch !== 'x64') throw Object.assign(new Error('Unsupported runtime'), { code: 'PLATFORM' });
  const release = fs.readFileSync('/etc/os-release', 'utf8');
  const codename = release.match(/^VERSION_CODENAME=(.*)$/m)?.[1]?.replaceAll('"', '');
  if (!['bookworm', 'bullseye', 'trixie', 'jammy', 'noble'].includes(codename)) throw Object.assign(new Error('Unsupported distribution'), { code: 'DISTRO' });
  const origin = 'https://apt.postgresql.org/pub/repos/apt/';
  const response = await fetch(origin + 'dists/' + codename + '-pgdg/main/binary-amd64/Packages.gz');
  if (!response.ok) throw Object.assign(new Error('Client index unavailable'), { code: 'CLIENT_INDEX' });
  const packages = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8').split(/\n\n/);
  const dest = path.join(root, 'client');
  fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
  for (const name of ['libpq5', 'postgresql-client-18']) {
    const entry = packages.find(p => p.startsWith('Package: ' + name + '\n') && /\nArchitecture: amd64\n/.test(p));
    const filename = entry?.match(/^Filename: (.*)$/m)?.[1];
    const expected = entry?.match(/^SHA256: (.*)$/m)?.[1];
    if (!filename || !expected || !filename.startsWith('pool/')) throw Object.assign(new Error('Client package unavailable'), { code: 'CLIENT_PACKAGE' });
    const r = await fetch(origin + filename);
    if (!r.ok) throw Object.assign(new Error('Client download failed'), { code: 'CLIENT_DOWNLOAD' });
    const bytes = Buffer.from(await r.arrayBuffer());
    if (sha(bytes) !== expected) throw Object.assign(new Error('Client checksum mismatch'), { code: 'CLIENT_CHECKSUM' });
    const file = path.join(root, name + '.deb');
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    await run('dpkg-deb', ['--extract', file, dest]);
  }
  const env = { LD_LIBRARY_PATH: path.join(dest, 'usr/lib/x86_64-linux-gnu') + ':' + (process.env.LD_LIBRARY_PATH || '') };
  const dump = path.join(dest, 'usr/lib/postgresql/18/bin/pg_dump');
  const restore = path.join(dest, 'usr/lib/postgresql/18/bin/pg_restore');
  const version = (await run(dump, ['--version'], env)).trim();
  binaries = { dump, restore, env, version };
  return binaries;
}

async function connect(url) {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20000 });
  await c.connect();
  return c;
}

async function inventory(c) {
  const query = async sql => (await c.query(sql)).rows;
  const relations = await query(`SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls, c.reloptions AS options FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemasWhere} AND c.relkind IN ('r','p','v','m','S','f') ORDER BY 1,2`);
  const columns = await query(`SELECT n.nspname AS schema,c.relname AS relation,a.attnum AS position,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE ${schemasWhere} AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,3`);
  const constraints = await query(`SELECT n.nspname AS schema,c.relname AS relation,k.conname AS name,k.contype AS type,pg_get_constraintdef(k.oid,true) AS definition,k.convalidated AS validated FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemasWhere} ORDER BY 1,2,3`);
  const indexes = await query(`SELECT n.nspname AS schema,c.relname AS relation,i.relname AS name,pg_get_indexdef(x.indexrelid) AS definition,x.indisvalid AS valid,x.indisready AS ready FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemasWhere} ORDER BY 1,2,3`);
  const triggers = await query(`SELECT n.nspname AS schema,c.relname AS relation,t.tgname AS name,pg_get_triggerdef(t.oid,true) AS definition,t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemasWhere} AND NOT t.tgisinternal ORDER BY 1,2,3`);
  const functions = await query(`SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${schemasWhere} AND p.prokind IN ('f','p') ORDER BY 1,2,3`);
  const types = await query(`SELECT n.nspname AS schema,t.typname AS name,t.typtype AS kind,e.enumlabel AS label,e.enumsortorder AS position FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace LEFT JOIN pg_enum e ON e.enumtypid=t.oid WHERE ${schemasWhere} AND t.typtype IN ('e','d','r','m') ORDER BY 1,2,5`);
  const views = await query(`SELECT n.nspname AS schema,c.relname AS name,pg_get_viewdef(c.oid,true) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemasWhere} AND c.relkind IN ('v','m') ORDER BY 1,2`);
  const policies = await query("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname !~ '^pg_' AND schemaname NOT IN ('information_schema','neon') ORDER BY 1,2,3");
  const sequences = await query("SELECT sequence_schema AS schema,sequence_name AS name,data_type,start_value,minimum_value,maximum_value,increment,cycle_option FROM information_schema.sequences WHERE sequence_schema !~ '^pg_' AND sequence_schema NOT IN ('information_schema','neon') ORDER BY 1,2");
  for (const s of sequences) Object.assign(s, (await query(`SELECT last_value::text,is_called FROM ${qid(s.schema)}.${qid(s.name)}`))[0]);
  const extensions = await query("SELECT extname AS name,extversion AS version FROM pg_extension ORDER BY 1");
  const tableData = [];
  for (const r of relations.filter(r => ['r','p','m'].includes(r.kind))) {
    const [data] = await query(`SELECT count(*)::text AS rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM ${qid(r.schema)}.${qid(r.name)} t`);
    tableData.push({ schema: r.schema, name: r.name, ...data });
  }
  const schema = { relations, columns, constraints, indexes, triggers, functions, types, views, policies, sequences, extensions };
  const [database] = await query("SELECT current_database() AS name,current_user AS role,current_setting('server_version') AS version,pg_database_size(current_database())::text AS bytes");
  const [largeObjects] = await query('SELECT count(*)::text AS count FROM pg_largeobject_metadata');
  const grants = await query("SELECT table_schema,table_name,grantee,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema !~ '^pg_' AND table_schema NOT IN ('information_schema','neon') ORDER BY 1,2,3,4");
  return { database, schema, tableData, largeObjects, grants, schemaSha256: sha(JSON.stringify(schema)), dataSha256: sha(JSON.stringify(tableData)) };
}

async function takeBackup() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Database unavailable'), { code: 'NO_DATABASE' });
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const tools = await installTools();
  state.stage = 'snapshot-inventory-and-pg-dump';
  const c = await connect(process.env.DATABASE_URL);
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: [snapshot] } = await c.query('SELECT pg_export_snapshot() AS id');
    const manifest = await inventory(c);
    await run(tools.dump, ['--format=custom', '--no-password', '--lock-wait-timeout=15000', '--snapshot=' + snapshot.id, '--file=' + dumpFile], { ...tools.env, ...pgEnv(process.env.DATABASE_URL) });
    await c.query('COMMIT');
    fs.chmodSync(dumpFile, 0o600);
    const toc = await run(tools.restore, ['--list', dumpFile], tools.env);
    fs.writeFileSync(path.join(root, 'archive-list.txt'), toc, { mode: 0o600 });
    Object.assign(manifest, { createdAt: new Date().toISOString(), dumpVersion: tools.version, dumpBytes: fs.statSync(dumpFile).size, dumpSha256: sha(fs.readFileSync(dumpFile)) });
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), { mode: 0o600 });
    return { tables: manifest.tableData.length, rows: manifest.tableData.reduce((n,t) => n + Number(t.rows), 0), dumpBytes: manifest.dumpBytes, dumpSha256: manifest.dumpSha256, schemaSha256: manifest.schemaSha256, dataSha256: manifest.dataSha256, pgDump: tools.version };
  } finally { await c.end(); }
}

function sourceUrl() { return process.env.PARENTLY_MIGRATION_SOURCE_URL || process.env.DATABASE_URL; }
function targetUrl() {
  const u = new URL(process.env.PARENTLY_MIGRATION_TARGET_URL);
  if (!u.hostname.endsWith('.neon.tech') || !u.pathname.endsWith('/parently_db')) throw Object.assign(new Error('Unexpected destination'), { code: 'TARGET_VALIDATION' });
  return u.href;
}
async function compare() {
  const s = await connect(sourceUrl()), t = await connect(targetUrl());
  try {
    await s.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await t.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const source = await inventory(s), target = await inventory(t);
    const result = { schemaEqual: source.schemaSha256 === target.schemaSha256, dataEqual: source.dataSha256 === target.dataSha256, source, target };
    fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    return { schemaEqual: result.schemaEqual, dataEqual: result.dataEqual, sourceTables: source.tableData.length, targetTables: target.tableData.length, sourceRows: source.tableData.reduce((n,t)=>n+Number(t.rows),0), targetRows: target.tableData.reduce((n,t)=>n+Number(t.rows),0), sourceVersion: source.database.version, targetVersion: target.database.version };
  } finally { await s.end(); await t.end(); }
}
async function restore() {
  if (process.env.PARENTLY_MAINTENANCE !== '1') throw Object.assign(new Error('Maintenance required'), { code: 'MAINTENANCE_REQUIRED' });
  if (!fs.existsSync(dumpFile)) throw Object.assign(new Error('Backup required'), { code: 'BACKUP_REQUIRED' });
  const before = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const c = await connect(sourceUrl());
  try {
    const current = await inventory(c);
    if (current.dataSha256 !== before.dataSha256 || current.schemaSha256 !== before.schemaSha256) throw Object.assign(new Error('Source changed since backup'), { code: 'SOURCE_CHANGED' });
  } finally { await c.end(); }
  const target = await connect(targetUrl());
  try {
    const { rows: [r] } = await target.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemasWhere} AND c.relkind IN ('r','p','v','m','S','f')`);
    if (r.count !== 0) throw Object.assign(new Error('Destination must be empty'), { code: 'TARGET_NOT_EMPTY' });
  } finally { await target.end(); }
  const tools = await installTools();
  state.stage = 'restore-single-transaction';
  await run(tools.restore, ['--single-transaction', '--exit-on-error', '--no-owner', '--no-acl', '--no-tablespaces', '--no-password', '--dbname=' + 'parently_db', dumpFile], { ...tools.env, ...pgEnv(targetUrl()) });
  state.stage = 'compare-source-and-destination';
  const result = await compare();
  if (!result.schemaEqual || !result.dataEqual) throw Object.assign(new Error('Verification differs'), { code: 'VERIFICATION_DIFFERS' });
  return result;
}

export function installDbTransfer(app, pool) {
  const secret = process.env.PARENTLY_MIGRATION_TOKEN || '';
  if (secret.length < 48 || !pool) return;
  const auth = req => {
    const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const a = Buffer.from(secret), b = Buffer.from(supplied);
    return a.length === b.length && crypto.timingSafeEqual(a,b);
  };
  const storage = new AsyncLocalStorage();
  const originalQuery = pool.query.bind(pool);
  pool.query = (...args) => storage.getStore()?.query(...args) ?? originalQuery(...args);
  app.use('/_parently-db-transfer', async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    if (!auth(req)) return res.sendStatus(404);
    try {
      if (req.method === 'GET' && req.path === '/status') return res.json({ ...state, maintenance: process.env.PARENTLY_MAINTENANCE === '1', currentHost: new URL(process.env.DATABASE_URL).hostname, envKeys: Object.keys(process.env).filter(k=>!k.startsWith('npm_')).sort() });
      if (req.method === 'GET' && req.path === '/connection') return res.json({ url: process.env.DATABASE_URL });
      const files = { '/file/dump': dumpFile, '/file/manifest': manifestFile, '/file/verification': path.join(root,'verification.json'), '/file/error': path.join(root,'command-error.txt'), '/file/toc': path.join(root,'archive-list.txt') };
      if (req.method === 'GET' && files[req.path] && fs.existsSync(files[req.path])) return res.download(files[req.path]);
      const jobs = { '/run/backup': takeBackup, '/run/restore': restore, '/run/verify': compare };
      if (req.method === 'POST' && jobs[req.path]) {
        if (state.status === 'running') return res.status(409).json({error:'busy'});
        state = { status:'running', stage:req.path, startedAt:new Date().toISOString() };
        jobs[req.path]().then(result=>{ state={status:'complete',stage:req.path,result,completedAt:new Date().toISOString()}; }).catch(e=>{ state={status:'failed',stage:state.stage,error:e.code||e.name,exitCode:e.exitCode}; });
        return res.status(202).json({accepted:true});
      }
      return res.sendStatus(404);
    } catch(e) { return res.status(500).json({error:e.code||e.name}); }
  });
  app.use(async (req,res,next) => {
    if (req.path === '/api/health') return next();
    const authorized = auth(req);
    if (process.env.PARENTLY_MAINTENANCE === '1' && !authorized) {
      res.setHeader('Retry-After','120');
      return res.status(503).send('Parently veritabanı bakımı sürüyor. Lütfen kısa süre sonra yeniden deneyin.');
    }
    if (!authorized || req.headers['x-parently-migration-rollback'] !== '1') return next();
    const c = await pool.connect();
    await c.query('BEGIN');
    const originalJson = res.json.bind(res);
    let finished = false;
    const rollback = async () => { if(!finished){finished=true;try{await c.query('ROLLBACK');}finally{c.release();}} };
    res.json = body => { rollback().then(()=>originalJson(body)).catch(()=>{res.statusCode=500;res.end('rollback_failed');}); return res; };
    res.on('close',()=>{rollback().catch(()=>{});});
    storage.run(c,()=>next());
  });
}
