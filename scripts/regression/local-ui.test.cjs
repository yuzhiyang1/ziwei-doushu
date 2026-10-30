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
async function assertPainted(locator, description, minOpacity = 0.9) {
 const state = await locator.evaluate(element => {
  let opacity=1, visible=true;
  for(let node=element;node;node=node.parentElement) {
   const style=getComputedStyle(node);
   opacity *= Number(style.opacity);
   if(style.display==='none' || style.visibility==='hidden' || style.visibility==='collapse') visible=false;
  }
  const rect=element.getBoundingClientRect();
  return {opacity,visible,width:rect.width,height:rect.height,text:element.textContent};
 });
 assert.ok(state.visible && state.opacity>=minOpacity && state.width>0 && state.height>0,
  `${description} must actually paint, not merely exist: ${JSON.stringify(state)}`);
}
async function assertChartPainted(page, description) {
 const board=page.locator('.local-workspace .local-chart-grid');
 const cells=board.locator('[data-testid^="palace-cell-"]');
 assert.equal(await cells.count(),12,`${description}: all 12 palaces exist`);
 for(const cell of await cells.all()) await assertPainted(cell,description+' palace cell');
 await assertPainted(board.getByTestId('chart-title'),description+' title');
 await assertPainted(board.getByTestId('chart-center'),description+' center');
 const major=cells.getByText('紫微',{exact:true});
 assert.equal(await major.count(),1,`${description}: major star 紫微 exists exactly once`);
 await major.scrollIntoViewIfNeeded();
 await assertPainted(major,description+' major star',0.5);
 const inViewport=await major.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;});
 assert.ok(inViewport,`${description}: visible major star intersects viewport after scroll`);
}

(async () => {
 const browser = await chromium.launch({ headless: true, chromiumSandbox: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}) });
 const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1365,height:1000} });
 const page = await context.newPage(), errors=[], requests=[];
 await fs.mkdir('test-results', {recursive:true});
 page.setDefaultTimeout(20000);
 await page.clock.install({time:new Date('2026-10-30T12:00:00Z')});
 page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
 page.on('dialog', dialog => dialog.accept());
 async function birth(scope,name,year='1990') {
  await scope.getByPlaceholder('请输入姓名').fill(name);
  await scope.getByLabel('出生年份',{exact:true}).selectOption(year);
  await scope.getByLabel('出生月份',{exact:true}).selectOption('5');
  await scope.getByLabel('出生日期',{exact:true}).selectOption('9');
  await scope.getByLabel('出生小时',{exact:true}).selectOption('23');
  await scope.getByLabel('出生分钟',{exact:true}).selectOption('55');
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
  await page.getByText(/^排盘口径（/).click();
  await page.getByLabel('星曜亮度表',{exact:true}).selectOption('ZZ');
  await page.getByLabel('闰月归属',{exact:true}).selectOption('next-month');
  await page.getByLabel('晚子时排盘日',{exact:true}).selectOption('current-day');
  const extraSchools=[['庚年四化','GYWTY','default'],['天马','lunar-month','year'],['截空','zhanyan','default'],['魁钺','table2','default'],['天使天伤','iztro-zhongzhou','default'],['长生十二神','fire-earth','default']];
  for(const [label,alternate,original] of extraSchools) {
   await page.getByLabel(label,{exact:true}).selectOption(alternate);
   assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),alternate);
   await page.getByLabel(label,{exact:true}).selectOption(original);
   assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),original);
  }

  await page.getByText(/^本地档案与备份/).click();
  await page.getByRole('button',{name:'保存当前命盘',exact:true}).click();
  await eventually(async()=>/（1）/.test(await page.locator('summary').first().innerText()),'archive saved');
  await page.getByRole('button',{name:'保存当前命盘',exact:true}).click();
  assert.match(await page.locator('summary').first().innerText(),/（1）/);
  const backupDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出备份',exact:true}).click();
  const backup=await backupDownload, backupText=await fs.readFile(await backup.path(),'utf8');
  assert.equal(JSON.parse(backupText).profiles.length,1); assert.ok(!backupText.includes('apiKey'));
  const savedSchool=JSON.parse(backupText).profiles[0].birth.schoolConfig;
  assert.equal(savedSchool.brightnessSchool,'ZZ');assert.equal(savedSchool.leapMonth,'next-month');assert.equal(savedSchool.lateZishi,'current-day');
  assert.equal(JSON.parse(backupText).profiles[0].birth.day,9);
  await page.reload(); await page.getByText(/^本地档案与备份/).click();
  await page.getByRole('button',{name:/QA甲 ·/}).click();
  await page.getByRole('heading',{name:'十三维本地解读'}).waitFor();
  await page.getByText(/^排盘口径（/).click();
  assert.equal(await page.getByLabel('星曜亮度表',{exact:true}).inputValue(),'ZZ');
  assert.equal(await page.getByLabel('闰月归属',{exact:true}).inputValue(),'next-month');
  assert.equal(await page.getByLabel('晚子时排盘日',{exact:true}).inputValue(),'current-day');
  await page.getByRole('button',{name:'搜索本地相似盘'}).click();
  await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  await page.getByRole('button',{name:'删除QA甲档案'}).click();
  await eventually(async()=>/（0）/.test(await page.locator('summary').first().innerText()),'archive deleted');
  await page.getByLabel('导入备份',{exact:false}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await page.getByText('备份恢复成功',{exact:true}).waitFor();
  await page.getByLabel('导入备份',{exact:false}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});
  await page.locator('details').filter({has:page.getByText(/^本地档案与备份/)}).getByRole('status').filter({hasText:/格式|版本|不支持|无效/}).waitFor();
  assert.match(await page.locator('summary').first().innerText(),/（1）/);
  const reportDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出文本报告'}).click();
  assert.ok((await fs.readFile(await (await reportDownload).path(),'utf8')).length>1000);
  const pngDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出本命 PNG'}).click();
  const png=await fs.readFile(await (await pngDownload).path()); assert.equal(png.subarray(1,4).toString(),'PNG'); assert.ok(png.length>10000);
  await assertChartPainted(page,'desktop');
  await page.screenshot({path:'test-results/chart-desktop.png',fullPage:true});
  assert.equal(await page.locator('.printable-report .report-section').count(),13);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.printable-report').isVisible(),true);
  assert.equal(await page.locator('.local-workspace').isVisible(),false);
  await assertPainted(page.locator('.printable-report').getByTestId('chart-center'),'print center');
  for(const cell of await page.locator('.printable-report [data-testid^="palace-cell-"]').all()) await assertPainted(cell,'print palace');
  await page.screenshot({path:'test-results/report-print.png',fullPage:true});
  await page.pdf({path:'test-results/report.pdf',format:'A4',printBackground:true});
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'本命',exact:true}).click();
  const chat=page.getByRole('region',{name:'自带模型问答'});
  await chat.getByText('模型连接设置',{exact:true}).click();
  await chat.getByLabel('API 地址',{exact:true}).fill('https://qa.invalid/v1');
  await chat.getByLabel('模型名称',{exact:true}).fill('mock-only');
  await chat.getByLabel('问答问题').fill('未配置Key不发送');
  await chat.locator('input[type=checkbox]').check();
  assert.equal(await chat.getByRole('button',{name:'发送问题'}).isDisabled(),true);
  assert.equal(await chat.getByLabel('API Key',{exact:true}).isVisible(),true);
  await chat.getByLabel('API Key',{exact:true}).fill('QA-KEY-NOT-PERSISTED');
  await chat.locator('input[type=checkbox]').check();
  let calls=0;
  await page.route('https://qa.invalid/**',async route=>{calls++;assert.equal(route.request().url(),'https://qa.invalid/v1/chat/completions');assert.equal(route.request().headers().authorization,'Bearer QA-KEY-NOT-PERSISTED');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'MOCK RESPONSE: browser flow only'}}]})});});
  await chat.getByLabel('问答问题').fill('解释当前命盘的依据');
  await chat.getByRole('button',{name:'发送问题'}).click();
  await chat.getByText(/MOCK RESPONSE/).waitFor(); assert.equal(calls,1);
  const keyBackupDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出备份',exact:true}).click();
  const keyBackupText=await fs.readFile(await (await keyBackupDownload).path(),'utf8');
  assert.ok(!keyBackupText.includes('QA-KEY-NOT-PERSISTED'));
  assert.ok(keyBackupText.includes('MOCK RESPONSE'));
  await page.unroute('https://qa.invalid/**');
  await page.route('https://qa.invalid/**',async route=>{await sleep(1500);await route.fulfill({status:503,body:'unavailable'}).catch(()=>{});});
  await chat.getByLabel('问答问题').fill('测试取消'); await chat.getByRole('button',{name:'发送问题'}).click();
  await chat.getByRole('button',{name:'取消请求'}).click(); await chat.getByText(/请求已取消/).waitFor();
  await page.reload(); await page.getByText(/^本地档案与备份/).click();
  await page.clock.setFixedTime(new Date('2027-10-30T12:00:00Z'));
  await page.getByRole('button',{name:/QA甲 ·/}).click();
  await page.getByText('模型连接设置',{exact:true}).click(); assert.equal(await page.getByLabel('API Key',{exact:true}).inputValue(),'');
  await page.getByText(/MOCK RESPONSE/).waitFor();
  await page.getByRole('button',{name:'清空模型配置'}).click();
  assert.equal(await page.getByLabel('API 地址',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('模型名称',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('API Key',{exact:true}).inputValue(),'');
  assert.equal(await page.getByRole('button',{name:'发送问题'}).isDisabled(),true);
  await page.getByText(/MOCK RESPONSE/).waitFor();
  // Synthetic v4-shaped fixtures, NOT real publisher interpretations. Real Worker/IndexedDB executes.
  const dataset=page.getByRole('region',{name:'公开数据集与本地匹配'});
  await dataset.getByText('当前显示命盘 / 精确报告查找键：1990-05-09 子时 男。',{exact:true}).waitFor();
  await dataset.getByText(/^按数据集口径重排后匹配：1990-05-10 子时 男。/).waitFor();
  const row=(month,day,hour)=>({k:`1990-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}-${hour}-male`,y:1990,m:month,d:day,h:hour,g:'male',ms:'紫微',t:{},c:Object.fromEntries(['overview','personality','love','career','wealth','health','family','children','move','friends','home','spirit','parents'].map((key,i)=>[key,'QA合成报告维度'+i+'；不是官方数据']))});
  const rows=[row(5,9,0),row(5,9,1),row(5,10,0)];
  // Dataset ranking deliberately normalizes schools: raw 5/9 23:55 => default next-day 5/10.
  // Exact report lookup stays keyed to the displayed current-day chart (5/9 子时).
  const jsonl=values=>Buffer.from(values.map(value=>JSON.stringify(value)).join('\n')+'\n');
  const upload=buffer=>({name:'qa-synthetic-1990.jsonl',mimeType:'application/x-ndjson',buffer});
  let workers=0;page.on('worker',()=>workers++);
  await dataset.getByLabel('导入公开年度JSONL').setInputFiles(upload(jsonl(rows)));
  await dataset.getByTestId('dataset-status').filter({hasText:/导入完成/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='1 年 / 3 条索引','expected 3 committed dataset records');
  await eventually(async()=>!(await dataset.getByLabel('导入公开年度JSONL').isDisabled()),'dataset operation fully settled');
  await dataset.getByLabel('导入公开年度JSONL').setInputFiles(upload(jsonl(rows)));
  await dataset.getByTestId('dataset-status').filter({hasText:/导入完成/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='1 年 / 3 条索引','expected 3 committed dataset records');
  await eventually(async()=>!(await dataset.getByLabel('导入公开年度JSONL').isDisabled()),'dataset operation fully settled');
  await dataset.getByLabel('导入公开年度JSONL').setInputFiles(upload(Buffer.concat([jsonl(rows),Buffer.from('{invalid json}\n')])));
  await dataset.getByTestId('dataset-status').filter({hasText:/JSON|解析|格式|行/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='1 年 / 3 条索引','expected 3 committed dataset records');
  await eventually(async()=>!(await dataset.getByLabel('导入公开年度JSONL').isDisabled()),'dataset operation fully settled');
  const many=Array.from({length:600},(_,i)=>row(1+Math.floor(i/336),1+Math.floor(i/12)%28,i%12));
  await dataset.getByLabel('导入公开年度JSONL').setInputFiles(upload(jsonl(many)));
  await dataset.getByRole('button',{name:'取消数据操作'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/操作已取消/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='1 年 / 3 条索引','expected 3 committed dataset records');
  await eventually(async()=>!(await dataset.getByLabel('导入公开年度JSONL').isDisabled()),'dataset operation fully settled');
  await dataset.getByRole('button',{name:'匹配已导入样本'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/已匹配 3 条/}).waitFor();
  await dataset.getByText('1990-05-10 子时 男 · 结构得分 100%',{exact:true}).waitFor();
  assert.equal(await dataset.locator('ol > li').count(),3);
  await dataset.getByLabel('导入公开年度JSONL').setInputFiles(upload(jsonl(rows)));
  await dataset.getByTestId('dataset-status').filter({hasText:/导入完成/}).waitFor();
  await eventually(async()=>!(await dataset.getByLabel('导入公开年度JSONL').isDisabled()),'replacement settled');
  assert.equal(await dataset.locator('ol > li').count(),0,'successful dataset replacement clears stale matches');

  await dataset.getByLabel('读取公开十三维报告JSONL').setInputFiles(upload(jsonl([rows[1]])));
  await dataset.getByTestId('dataset-status').filter({hasText:/没有|未找到|无匹配/}).waitFor();
  assert.equal(await dataset.getByRole('article',{name:'公开十三维报告'}).count(),0);
  await dataset.getByLabel('读取公开十三维报告JSONL').setInputFiles(upload(jsonl(rows)));
  await dataset.getByRole('article',{name:'公开十三维报告'}).waitFor();
  await dataset.getByRole('article',{name:'公开十三维报告'}).getByRole('heading',{name:'公开 v4 原文 · 1990-05-09 子时 男',exact:true}).waitFor();
  const rawReport=await dataset.getByRole('article',{name:'公开十三维报告'}).locator('pre').innerText();
  for(let i=0;i<13;i++)assert.ok(rawReport.includes('QA合成报告维度'+i));
  assert.ok(workers>=7,'dataset operations really use browser Workers');
  await page.screenshot({path:'test-results/dataset-synthetic.png',fullPage:true});
  await dataset.getByRole('button',{name:'关闭公开报告'}).click();
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
  await page.reload(); await page.getByText(/^本地档案与备份/).click(); await page.getByRole('button',{name:/QA甲 ·/}).click();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='1 年 / 3 条索引','dataset index persists after reload');
  await dataset.getByRole('button',{name:'匹配已导入样本'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/已匹配 3 条/}).waitFor();
  assert.equal(await dataset.locator('ol > li').count(),3);
  await dataset.getByRole('button',{name:'删除1990年数据索引'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/索引已删除/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='0 年 / 0 条索引','dataset deletion refresh completed');
  assert.equal(await dataset.locator('ol > li').count(),0,'deleting dataset clears stale matches');
  assert.equal(await page.getByRole('button',{name:/QA甲 ·/}).count(),1,'deleting public index keeps private archive');
  await context.setOffline(true);
  await page.getByRole('button',{name:'流年',exact:true}).click();
  await page.getByRole('button',{name:'搜索本地相似盘'}).click(); await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  await context.setOffline(false);
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
  await page.setViewportSize({width:390,height:844});
  await assertChartPainted(page,'mobile');
  await page.screenshot({path:'test-results/chart-mobile.png',fullPage:true});
  await page.setViewportSize({width:1365,height:1000});
  await page.goto(base+'/heming');
  const parties=page.locator('section').filter({has:page.getByRole('heading',{name:'甲方',exact:true})});
  await birth(parties,'甲');
  await birth(page.locator('section').filter({has:page.getByRole('heading',{name:'乙方',exact:true})}),'乙','1991');
  await page.getByRole('heading',{name:'十二宫结构对照'}).waitFor(); assert.equal(await page.locator('tbody tr').count(),12);
  await parties.getByText(/^排盘口径（/).click();
  await parties.getByLabel('星曜亮度表',{exact:true}).selectOption('XD1');
  const second=page.locator('section').filter({has:page.getByRole('heading',{name:'乙方',exact:true})});
  await second.getByText(/^排盘口径（/).click();
  assert.equal(await second.getByLabel('星曜亮度表',{exact:true}).inputValue(),'default');
  await page.getByRole('button',{name:'展开双方命盘'}).click();
  await page.getByRole('button',{name:'收起双方命盘'}).click();
  await page.getByRole('button',{name:'展开双方命盘'}).click();
  await page.getByRole('button',{name:'收起双方命盘'}).click();
  const pairAI=page.getByRole('button',{name:'开启自带模型合盘问答'});
  assert.equal(await pairAI.isDisabled(),true);
  await page.getByRole('region',{name:'合盘结果'}).locator('input[type=checkbox]').check();
  await pairAI.click();
  await page.getByRole('region',{name:'自带模型问答'}).waitFor();
  await page.getByRole('region',{name:'合盘结果'}).locator('input[type=checkbox]').first().uncheck();
  assert.equal(await page.getByRole('region',{name:'自带模型问答'}).count(),0);
  await page.screenshot({path:'test-results/pair.png',fullPage:true});
  await page.getByRole('button',{name:'编辑并重新排盘'}).first().click();
  assert.equal(await page.getByRole('heading',{name:'十二宫结构对照'}).count(),0);
  await page.getByRole('button',{name:'取消编辑，保留原盘'}).click(); await page.getByRole('heading',{name:'十二宫结构对照'}).waitFor();
  for(const path of ['/study','/library','/library/search?q=紫微']) { await page.goto(base+path); assert.ok((await page.locator('body').innerText()).length>100); }
  assert.equal(errors.length,0,errors.join('\n')); assert.ok(!requests.some(url=>/\/api\/(interpret|heming)/.test(url)));
  console.log('PASS: browser local flows; AI response mocked; offline in-session only, not offline server restart.');
 } catch(error) { await page.screenshot({path:'test-results/failure.png',fullPage:true}).catch(()=>{}); await fs.writeFile('test-results/failure.txt',String(error)+'\n'+await page.locator('body').innerText().catch(()=>'')); throw error; } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
