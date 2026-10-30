/** Browser acceptance checks; run against npm run dev or npm start.
 * npm install --no-save playwright (or PLAYWRIGHT_MODULE=/path/to/playwright)
 * BASE_URL=http://127.0.0.1:3000 CHROMIUM_PATH=/usr/bin/chromium node scripts/regression/local-ui.test.cjs
 * AI is intentionally mocked. This is NOT a real provider/CORS acceptance test.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(fn, label) { for(let i=0;i<50;i++){if(await fn()) return; await sleep(100);} throw new Error(label); }
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}) });
 const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1365,height:1000} });
 const page = await context.newPage(), errors=[], requests=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
 page.on('dialog', dialog => dialog.accept());
 async function birth(scope,name,year='1990') {
  await scope.getByPlaceholder('请输入姓名').fill(name);
  await scope.getByLabel('出生年份',{exact:true}).selectOption(year);
  await scope.getByLabel('出生月份',{exact:true}).selectOption('5');
  await scope.getByLabel('出生日期',{exact:true}).selectOption('9');
  await scope.locator('button[type=submit]').click();
 }
 try {
  await page.goto(base+'/chart');
  await page.getByLabel('出生年份',{exact:true}).selectOption('1990');
  await page.getByLabel('出生月份',{exact:true}).selectOption('2');
  await page.getByLabel('出生日期',{exact:true}).selectOption('30');
  assert.match(await page.locator('body').innerText(),/2月没有30日/);
  await birth(page,'QA甲');
  await page.getByRole('heading',{name:'十三维本地解读'}).waitFor();
  const analysis = page.getByRole('region',{name:'本地十三维解读'});
  assert.equal(await analysis.locator('button[aria-pressed]').count(),13);
  for(const button of await analysis.locator('button[aria-pressed]').all()) { await button.click(); assert.equal(await button.getAttribute('aria-pressed'),'true'); }
  for(const name of ['本命','大限','流年','流月','流日','时辰','本命','流日']) {
   await page.getByRole('button',{name,exact:true}).click();
   assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
   assert.ok((await page.getByTestId('time-context').innerText()).length>5);
  }
  await page.getByLabel('运限公历日期').fill('2024-02-29');
  assert.match(await page.getByTestId('time-context').innerText(),/2024/);
  await page.getByText(/^本地档案与备份/).click();
  await page.getByRole('button',{name:'保存当前命盘',exact:true}).click();
  await eventually(async()=>/（1）/.test(await page.locator('summary').first().innerText()),'archive saved');
  await page.getByRole('button',{name:'保存当前命盘',exact:true}).click();
  assert.match(await page.locator('summary').first().innerText(),/（1）/);
  const backupDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出备份',exact:true}).click();
  const backup=await backupDownload, backupText=await fs.readFile(await backup.path(),'utf8');
  assert.equal(JSON.parse(backupText).profiles.length,1); assert.ok(!backupText.includes('apiKey'));
  await page.reload(); await page.getByText(/^本地档案与备份/).click();
  await page.getByRole('button',{name:/QA甲 ·/}).click();
  await page.getByRole('heading',{name:'十三维本地解读'}).waitFor();
  await page.getByRole('button',{name:'搜索本地相似盘'}).click();
  await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  await page.getByRole('button',{name:'删除QA甲档案'}).click();
  await eventually(async()=>/（0）/.test(await page.locator('summary').first().innerText()),'archive deleted');
  await page.getByLabel('导入备份',{exact:false}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await page.getByText('备份恢复成功',{exact:true}).waitFor();
  await page.getByLabel('导入备份',{exact:false}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});
  assert.match(await page.locator('summary').first().innerText(),/（1）/);
  const reportDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出文本报告'}).click();
  assert.ok((await fs.readFile(await (await reportDownload).path(),'utf8')).length>1000);
  const pngDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出本命 PNG'}).click();
  const png=await fs.readFile(await (await pngDownload).path()); assert.equal(png.subarray(1,4).toString(),'PNG'); assert.ok(png.length>10000);
  const chat=page.getByRole('region',{name:'自带模型问答'});
  await chat.getByText('模型连接设置',{exact:true}).click();
  await chat.getByLabel('API 地址',{exact:true}).fill('https://qa.invalid/v1/chat/completions');
  await chat.getByLabel('模型名称',{exact:true}).fill('mock-only');
  await chat.getByLabel('API Key',{exact:true}).fill('QA-KEY-NOT-PERSISTED');
  await chat.locator('input[type=checkbox]').check();
  let calls=0;
  await page.route('https://qa.invalid/**',async route=>{calls++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'MOCK RESPONSE: browser flow only'}}]})});});
  await chat.getByLabel('问答问题').fill('解释当前命盘的依据');
  await chat.getByRole('button',{name:'发送问题'}).click();
  await chat.getByText(/MOCK RESPONSE/).waitFor(); assert.equal(calls,1);
  await page.unroute('https://qa.invalid/**');
  await page.route('https://qa.invalid/**',async route=>{await sleep(1500);await route.fulfill({status:503,body:'unavailable'}).catch(()=>{});});
  await chat.getByLabel('问答问题').fill('测试取消'); await chat.getByRole('button',{name:'发送问题'}).click();
  await chat.getByRole('button',{name:'取消请求'}).click(); await chat.getByText(/请求已取消/).waitFor();
  await page.reload(); await page.getByText(/^本地档案与备份/).click(); await page.getByRole('button',{name:/QA甲 ·/}).click();
  await page.getByText('模型连接设置',{exact:true}).click(); assert.equal(await page.getByLabel('API Key',{exact:true}).inputValue(),'');
  await page.getByText(/MOCK RESPONSE/).waitFor();
  await context.setOffline(true);
  await page.getByRole('button',{name:'流年',exact:true}).click();
  await page.getByRole('button',{name:'搜索本地相似盘'}).click(); await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  await context.setOffline(false);
  await page.goto(base+'/heming');
  const parties=page.locator('section').filter({has:page.getByRole('heading',{name:'甲方',exact:true})});
  await birth(parties,'甲');
  await birth(page.locator('section').filter({has:page.getByRole('heading',{name:'乙方',exact:true})}),'乙','1991');
  await page.getByRole('heading',{name:'十二宫结构对照'}).waitFor(); assert.equal(await page.locator('tbody tr').count(),12);
  await page.getByRole('button',{name:'编辑并重新排盘'}).first().click();
  assert.equal(await page.getByRole('heading',{name:'十二宫结构对照'}).count(),0);
  await page.getByRole('button',{name:'取消编辑，保留原盘'}).click(); await page.getByRole('heading',{name:'十二宫结构对照'}).waitFor();
  for(const path of ['/study','/library','/library/search?q=紫微']) { await page.goto(base+path); assert.ok((await page.locator('body').innerText()).length>100); }
  assert.equal(errors.length,0,errors.join('\n')); assert.ok(!requests.some(url=>/\/api\/(interpret|heming)/.test(url)));
  console.log('PASS: browser local flows; AI response mocked; offline in-session only, not offline server restart.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
