// Real Chromium, real Fastify routes, isolated PostgreSQL, synthetic PDF.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {chromium} from 'playwright';
import {createApp} from '../src/server.mjs';
import {readInvoiceBuffer} from '../src/local-ocr.mjs';
import {sealApiKey,encryptionKey} from '../src/nutrient-secret.mjs';
test('Chromium PDF upload, correction, confirmed save and archive roundtrip',async()=>{
 const db=new PGlite();let app,browser;
 try{
  await db.exec((await readFile(new URL('../schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  const query=async(sql,params)=>{const r=await db.query(sql,params);return{rows:r.rows,rowCount:r.rows.length||r.affectedRows||0};};
  await query("INSERT INTO branches(id,name) VALUES(1,'Browser Şubesi')");
  process.env.NUTRIENT_ENCRYPTION_KEY='browser-test-only-encryption-seed-not-for-production';
  const uid=randomUUID(),token=randomUUID();
  await query("INSERT INTO users(id,email,name,password_hash,role) VALUES($1,'browser@example.invalid','TEST Browser','test-only','system')",[uid]);
  await query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),uid]);
  await query("INSERT INTO service_integrations(provider,encrypted_secret) VALUES('nutrient',$1)",[sealApiKey('mock-browser-only-key',encryptionKey())]);
  app=await createApp({database:{query,connect:async()=>({query,release(){}})},logger:false,
   nutrientExtractor:async({data,mime})=>({...await readInvoiceBuffer(data,mime),provider:'nutrient'})});
  const origin=await app.listen({port:0,host:'127.0.0.1'});
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1400,height:1000},locale:'tr-TR'});
  await context.addCookies([{name:'invoice_sid',value:token,url:origin,httpOnly:true}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/admin/invoice-reader');
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),pdf=doc.addPage([800,550]);
  ['TEST Groothandel BV','Factuurnummer: TEST-BROWSER-100','Factuurdatum: 15-11-2026','AB-123 Tomaten 2,5 kg 4,00 10% 9,00 9%','Subtotaal 9,00','BTW 9% 0,81','Totaal 9,81'].forEach((s,i)=>pdf.drawText(s,{x:45,y:490-i*52.5,size:20,font}));
  await page.locator('#file').setInputFiles({name:'TEST-only.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
  await page.locator('#branchId').selectOption('1');
  await page.locator('#extract').click();await page.locator('#result').waitFor({state:'visible'});
  assert.equal(await page.locator('#invoiceNumber').inputValue(),'TEST-BROWSER-100');
  assert.equal(await page.locator('[data-field="sku"]').inputValue(),'AB-123');
  assert.equal(await page.locator('[data-field="unit"]').inputValue(),'kg');
  assert(await page.locator('#saveInvoice').isDisabled());
  await page.locator('#reviewed').check();assert(await page.locator('#saveInvoice').isEnabled());
  await page.locator('[data-field="price"]').fill('5');assert(await page.locator('#saveInvoice').isDisabled());
  await page.locator('[data-field="price"]').fill('4');assert(await page.locator('#saveInvoice').isEnabled());
  assert(await page.evaluate(()=>{const table=document.querySelector('.invoice-table'),totals=document.getElementById('invoiceTotals');return table.scrollWidth<=table.parentElement.clientWidth&&totals.getBoundingClientRect().top>table.getBoundingClientRect().bottom;}),'desktop table must fit and totals must follow products');
  await page.screenshot({path:'/tmp/invoice-reader-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile layout must fit viewport');
  await page.screenshot({path:'/tmp/invoice-reader-mobile.png',fullPage:true});
  const savedResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/ocr/invoices')&&r.request().method()==='POST');
  await page.locator('#saveInvoice').click();assert.equal((await savedResponse).status(),201);assert(await page.locator('#saveInvoice').isDisabled());
  await page.goto(origin+'/admin/invoices');await page.getByRole('button',{name:'TEST-BROWSER-100'}).click();
  await page.locator('#details').waitFor({state:'visible'});assert((await page.locator('#details').innerText()).includes('AB-123'));
  assert((await page.locator('#details').innerText()).includes('kg'));assert((await page.locator('#details').innerText()).includes('10 iskonto'));
  const stored=(await query('SELECT items,branch_id,source,comparison_ready FROM mindee_invoice_reviews')).rows;assert.equal(stored.length,1);assert.equal(stored[0].items[0].discountPercent,10);assert.equal(Number(stored[0].branch_id),1);assert.equal(stored[0].source,'nutrient');assert.equal(stored[0].comparison_ready,true);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();if(app)await app.close();await db.close();}
});
