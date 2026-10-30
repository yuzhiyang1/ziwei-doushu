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
 const board=page.locator('.local-workspace .chart-pane');
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

async function openArchives(page) {
 const summary=page.getByText(/^本地档案与备份/);
 if(!await summary.evaluate(el=>el.closest('details').open)) await summary.click();
}
async function openAdvanced(page) {
 const details=page.locator('.workspace-tools');
 if(!await details.evaluate(el=>el.open)) await details.locator(':scope > summary').click();
}
async function assertReading(analysis) {
 const article=analysis.getByTestId('readable-analysis');
 await assertPainted(article.getByTestId('reading-summary'),'readable interpretation');
 assert.ok((await article.getByTestId('reading-summary').innerText()).length>100,'summary explains the chart, not a status placeholder');
 for(const name of ['可以发挥的特点','需要留意的张力','怎么用在日常思考里']) {
  const section=article.getByRole('heading',{name,exact:true}).locator('..');
  assert.equal(await section.locator('li').count(),2,`${name} has two substantive observations`);
  for(const item of await section.locator('li').all()) assert.ok((await item.innerText()).length>12);
 }
 assert.match(await article.locator('.reading-source').innerText(),/本地原创传统象征解读/);
}
async function assertInitialReading(page, name) {
 await page.getByRole('heading',{name:'十三维命盘分析'}).waitFor();
 // No scrollIntoView: capture the actual post-submit first screen, not a curated scroll position.
 await page.clock.runFor(500);
 await page.screenshot({path:`test-results/${name}-first-screen.png`,fullPage:false});
 const summary=page.getByRole('region',{name:'本地十三维解读'}).getByTestId('reading-summary');
 await assertPainted(summary,`${name} first-screen summary`);
 const rect=await summary.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
 assert.ok(rect.top>=0 && rect.top<rect.height-40 && rect.bottom>0,`${name}: meaningful summary starts in first viewport: ${JSON.stringify(rect)}`);
 assert.equal(await page.locator('.workspace-tools').evaluate(el=>el.open),false,'advanced datasets do not crowd initial reading');
 assert.equal(await page.locator('.reading-evidence').evaluate(el=>el.open),false,'technical evidence is initially folded');
 assert.equal(await page.getByRole('button',{name:'命盘分析',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByLabel('API Key',{exact:true}).isVisible(),false,'BYOK is optional, not a reading prerequisite');
 await assertReading(page.getByRole('region',{name:'本地十三维解读'}));
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
 async function birth(scope,name,year='1990',hour='23',minute='55') {
  await scope.getByPlaceholder('请输入姓名').fill(name);
  await scope.getByLabel('出生年份',{exact:true}).selectOption(year);
  await scope.getByLabel('出生月份',{exact:true}).selectOption('5');
  await scope.getByLabel('出生日期',{exact:true}).selectOption('9');
  await scope.getByLabel('出生小时',{exact:true}).selectOption(hour);
  await scope.getByLabel('出生分钟',{exact:true}).selectOption(minute);
  await scope.locator('button[type=submit]').click();
 }
 try {
  await page.goto(base+'/chart');
  // Independent non-子 chart: 1990 午年 branch 6, 08:00 辰时 index 4.
  // Default 天空=(6+1)%12=7; public year-hour rule=(6+1+4)%12=11.
  const skyPage=await context.newPage();skyPage.on('pageerror',e=>errors.push(e.message));
  await skyPage.clock.install({time:new Date('2026-10-30T12:00:00Z')});
  await skyPage.goto(base+'/chart');await birth(skyPage,'QA天空','1990','8','0');
  await assertInitialReading(skyPage,'desktop');
  const firstSummary=await skyPage.getByTestId('reading-summary').innerText();
  for(const concept of ['紫微','破军','统筹','重建']) assert.ok(firstSummary.includes(concept),`actual chart explanation includes ${concept}`);
  assert.match(await skyPage.getByTestId('readable-analysis').locator('.reading-columns').innerText(),/控制|推翻|成本|忽略|过渡/,'specific tension must accompany positive traits');
  await openAdvanced(skyPage);
  const skyBoard=skyPage.locator('.local-workspace .chart-pane');
  await skyBoard.getByTestId('palace-cell-7').getByText('天空',{exact:true}).waitFor();
  await skyPage.getByText(/^排盘口径（/).click();
  assert.equal(await skyPage.getByLabel('天空',{exact:true}).inputValue(),'year');
  await skyPage.getByLabel('天空',{exact:true}).selectOption('year-hour');
  await skyBoard.getByTestId('palace-cell-11').getByText('天空',{exact:true}).waitFor();
  assert.equal(await skyBoard.getByTestId('palace-cell-7').getByText('天空',{exact:true}).count(),0);
  assert.equal(await skyBoard.getByText('天空',{exact:true}).count(),1,'switch moves rather than duplicates 天空');
  await skyPage.screenshot({path:'test-results/tiankong-public-rule.png',fullPage:true});
  await skyPage.getByLabel('天空',{exact:true}).selectOption('year');
  await skyBoard.getByTestId('palace-cell-7').getByText('天空',{exact:true}).waitFor();
  assert.equal(await skyBoard.getByTestId('palace-cell-11').getByText('天空',{exact:true}).count(),0);
  await skyPage.close();
  // A genuinely fresh mobile visitor has no saved profile, dataset, model key, or theme preference.
  const mobileContext=await browser.newContext({viewport:{width:390,height:844}});
  const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.clock.install({time:new Date('2026-10-30T12:00:00Z')});
  await mobile.goto(base+'/chart');await birth(mobile,'移动首次体验','1990','8','0');
  await assertInitialReading(mobile,'mobile');
  assert.equal(await mobile.locator('.chart-pane').isVisible(),false,'mobile starts with readable analysis rather than chart');
  for(const view of ['mingpan','daxian','liunian','liuyue','liuri','liushi']) {
   await mobile.getByLabel('分析时序',{exact:true}).selectOption(view);
   await assertReading(mobile.getByRole('region',{name:'本地十三维解读'}));
  }
  await mobile.getByLabel('分析时序',{exact:true}).selectOption('mingpan');
  for(const width of [350,500]) {
   await mobile.setViewportSize({width,height:844});
   await mobile.getByRole('button',{name:'命盘',exact:true}).click();
   await assertChartPainted(mobile,`mobile ${width}px`);
   const overflow=await mobile.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(overflow.scroll<=overflow.width+1,`no document horizontal overflow at ${width}px: ${JSON.stringify(overflow)}`);
   const palace=mobile.locator('.chart-pane button[aria-label^="选择"]').first();
   await palace.focus();await palace.press('Enter');
   assert.equal(await mobile.getByRole('button',{name:'命盘分析',exact:true}).getAttribute('aria-pressed'),'true','keyboard palace selection opens its interpretation');
   await assertReading(mobile.getByRole('region',{name:'本地十三维解读'}));
   await mobile.screenshot({path:`test-results/mobile-${width}-reading.png`,fullPage:false});
  }
  await mobileContext.setOffline(true);
  await mobile.getByLabel('分析时序',{exact:true}).selectOption('liunian');
  await assertReading(mobile.getByRole('region',{name:'本地十三维解读'}));
  await mobileContext.setOffline(false);await mobileContext.close();

  await page.getByLabel('出生年份',{exact:true}).selectOption('1990');
  await page.getByLabel('出生月份',{exact:true}).selectOption('2');
  await page.getByLabel('出生日期',{exact:true}).selectOption('30');
  assert.match(await page.locator('body').innerText(),/2月没有30日/);
  await birth(page,'QA甲');
  await assertInitialReading(page,'desktop-second-chart');
  assert.notEqual(await page.getByTestId('reading-summary').innerText(),firstSummary,'different birth hours change interpretation, not just name/date');
  await page.getByRole('heading',{name:'十三维命盘分析'}).waitFor();
  const analysis = page.getByRole('region',{name:'本地十三维解读'});
  assert.equal(await analysis.locator('button[aria-pressed]').count(),13);
  for(const name of ['本命','大限','流年','流月','流日','时辰','本命','流日']) {
   await page.getByRole('button',{name,exact:true}).click();
   assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
   assert.ok((await page.getByTestId('time-context').innerText()).length>5);
   for(const button of await analysis.locator('.topic-tabs button').all()) {
    await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
    await assertReading(analysis);
    assert.match(await analysis.locator('.reading-layer').innerText(),new RegExp(name));
    assert.equal(await analysis.locator('.reading-evidence').evaluate(el=>el.open),false);
   }
   await analysis.getByRole('button',{name:'总览',exact:true}).click();
   await analysis.getByText('查看排盘依据与计算口径',{exact:true}).click();
   assert.match(await analysis.locator('.reading-evidence').innerText(),/十二宫叠宫：/);
   assert.match(await analysis.locator('.reading-evidence').innerText(),/本层四化分布：/);
   await analysis.getByRole('button',{name:'命宫',exact:true}).click();
   assert.ok((await analysis.locator('.reading-evidence').innerText()).includes(`${name}命宫在`));
   assert.match(await analysis.locator('.reading-evidence').innerText(),/叠本命.+宫/);
   assert.match(await analysis.locator('.reading-evidence').innerText(),/本层流曜：/);
   await analysis.getByText('查看排盘依据与计算口径',{exact:true}).click();
  }
  await page.getByLabel('运限公历日期').fill('2024-02-29');
  assert.match(await page.getByTestId('time-context').innerText(),/2024/);
  await openAdvanced(page);
  await page.getByText(/^排盘口径（/).click();
  await page.getByLabel('星曜亮度表',{exact:true}).selectOption('ZZ');
  await page.getByLabel('闰月归属',{exact:true}).selectOption('next-month');
  await page.getByLabel('晚子时排盘日',{exact:true}).selectOption('current-day');
  await page.getByLabel('天空',{exact:true}).selectOption('year-hour');
  assert.equal(await page.getByLabel('天空',{exact:true}).inputValue(),'year-hour');
  const extraSchools=[['庚年四化','GYWTY','default'],['天马','lunar-month','year'],['截空','zhanyan','default'],['魁钺','table2','default'],['天使天伤','iztro-zhongzhou','default'],['长生十二神','fire-earth','default']];
  for(const [label,alternate,original] of extraSchools) {
   await page.getByLabel(label,{exact:true}).selectOption(alternate);
   assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),alternate);
   await page.getByLabel(label,{exact:true}).selectOption(original);
   assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),original);
  }

  await openArchives(page);
  await page.getByRole('button',{name:'保存当前命盘',exact:true}).click();
  await eventually(async()=>/（1）/.test(await page.locator('summary').first().innerText()),'archive saved');
  await page.getByRole('button',{name:'保存当前命盘',exact:true}).click();
  assert.match(await page.locator('summary').first().innerText(),/（1）/);
  const backupDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出备份',exact:true}).click();
  const backup=await backupDownload, backupText=await fs.readFile(await backup.path(),'utf8');
  assert.equal(JSON.parse(backupText).profiles.length,1); assert.ok(!backupText.includes('apiKey'));
  const savedSchool=JSON.parse(backupText).profiles[0].birth.schoolConfig;
  assert.equal(savedSchool.tiankong,'year-hour');
  assert.equal(savedSchool.brightnessSchool,'ZZ');assert.equal(savedSchool.leapMonth,'next-month');assert.equal(savedSchool.lateZishi,'current-day');
  assert.equal(JSON.parse(backupText).profiles[0].birth.day,9);
  await page.reload(); await openArchives(page);
  await page.getByRole('button',{name:/QA甲 ·/}).click();await openArchives(page);
  await page.getByRole('heading',{name:'十三维命盘分析'}).waitFor();
  await openAdvanced(page);
  await page.getByText(/^排盘口径（/).click();
  assert.equal(await page.getByLabel('星曜亮度表',{exact:true}).inputValue(),'ZZ');
  assert.equal(await page.getByLabel('闰月归属',{exact:true}).inputValue(),'next-month');
  assert.equal(await page.getByLabel('晚子时排盘日',{exact:true}).inputValue(),'current-day');
  assert.equal(await page.getByLabel('天空',{exact:true}).inputValue(),'year-hour');
  await page.getByRole('button',{name:'搜索本地相似盘'}).click();
  await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  const localSimilar=page.locator('section').filter({has:page.getByRole('heading',{name:'相似命盘 · 本地档案',exact:true})});
  await page.getByLabel('档案年份范围').selectOption('cross-year');await page.getByRole('button',{name:'搜索本地相似盘'}).click();
  await localSimilar.getByRole('status').filter({hasText:/暂无档案/}).waitFor();
  assert.equal(await localSimilar.locator('details').count(),0);
  await page.getByLabel('档案年份范围').selectOption('same-year');await page.getByRole('button',{name:'搜索本地相似盘'}).click();
  await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  await page.getByLabel('档案年份范围').selectOption('all');

  await page.getByRole('button',{name:'删除QA甲档案'}).click();
  await eventually(async()=>/（0）/.test(await page.locator('summary').first().innerText()),'archive deleted');
  await page.getByLabel('导入备份',{exact:false}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await page.getByText('备份恢复成功',{exact:true}).waitFor();
  await page.getByLabel('导入备份',{exact:false}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});
  await page.locator('details').filter({has:page.getByText(/^本地档案与备份/)}).getByRole('status').filter({hasText:/格式|版本|不支持|无效/}).waitFor();
  assert.match(await page.locator('summary').first().innerText(),/（1）/);
  const reportDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出文本报告'}).click();
  const exportedReport=await fs.readFile(await (await reportDownload).path(),'utf8');
  assert.ok(exportedReport.length>1000);assert.ok(exportedReport.includes('天空 year-hour'));
  assert.ok((await page.locator('.printable-report').textContent()).includes('天空 year-hour'));
  const pngDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出本命 PNG'}).click();
  const png=await fs.readFile(await (await pngDownload).path()); assert.equal(png.subarray(1,4).toString(),'PNG'); assert.ok(png.length>10000);await fs.writeFile('test-results/exported-chart.png',png);
  await assertChartPainted(page,'desktop');
  await page.screenshot({path:'test-results/chart-desktop.png',fullPage:true});
  assert.equal(await page.locator('.printable-report .report-section').count(),13);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.printable-report').isVisible(),true);
  assert.equal(await page.locator('.local-workspace').isVisible(),false);
  await assertPainted(page.locator('.printable-report').getByTestId('chart-center'),'print center');
  const printedPalaceLabels=page.locator('.printable-report .palace-label-button');
  assert.equal(await printedPalaceLabels.count(),12,'printed chart retains all palace labels, not just stars');
  for(const label of await printedPalaceLabels.all()) {
   await assertPainted(label,'printed palace label');
   assert.ok((await label.innerText()).trim().length>=2);
  }
  assert.match(await printedPalaceLabels.allTextContents().then(xs=>xs.join(' ')),/命宫/);
  for(const cell of await page.locator('.printable-report [data-testid^="palace-cell-"]').all()) await assertPainted(cell,'print palace');
  await page.screenshot({path:'test-results/report-print.png',fullPage:true});
  await page.pdf({path:'test-results/report.pdf',format:'A4',printBackground:true});
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'本命',exact:true}).click();
  await page.getByRole('button',{name:'AI 深问',exact:true}).click();
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
  await page.route('https://qa.invalid/**',async route=>{calls++;assert.equal(route.request().url(),'https://qa.invalid/v1/chat/completions');assert.equal(route.request().headers().authorization,'Bearer QA-KEY-NOT-PERSISTED');const requestBody=route.request().postDataJSON();const system=requestBody.messages[0].content;let aiContext=JSON.parse(system.slice(system.indexOf('命盘：')+3));if(typeof aiContext==='string')aiContext=JSON.parse(aiContext);assert.equal(aiContext.chart.birthInfo.schoolConfig.tiankong,'year-hour');assert.equal(aiContext.selection.view,'mingpan');assert.equal(aiContext.readable.length,13);assert.match(aiContext.readable[0].summary,/命宫/);assert.equal(aiContext.analysis.length,13);assert.equal(aiContext.analysis[0].summary.view,'mingpan');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'MOCK RESPONSE: browser flow only'}}]})});});
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
  await page.reload(); await openArchives(page);
  await page.clock.setFixedTime(new Date('2027-10-30T12:00:00Z'));
  await page.getByRole('button',{name:/QA甲 ·/}).click();await openArchives(page);
  await page.getByRole('button',{name:'AI 深问',exact:true}).click();
  await page.getByText('模型连接设置',{exact:true}).click(); assert.equal(await page.getByLabel('API Key',{exact:true}).inputValue(),'');
  await page.getByText(/MOCK RESPONSE/).waitFor();
  await page.getByRole('button',{name:'清空模型配置'}).click();
  assert.equal(await page.getByLabel('API 地址',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('模型名称',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('API Key',{exact:true}).inputValue(),'');
  assert.equal(await page.getByRole('button',{name:'发送问题'}).isDisabled(),true);
  await page.getByText(/MOCK RESPONSE/).waitFor();
  // Synthetic v4-shaped fixtures, NOT real publisher interpretations. Real Worker/IndexedDB executes.
  await page.getByRole('button',{name:'命盘分析',exact:true}).click();
  await openAdvanced(page);
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

  const crossRow={...row(5,10,0),k:'1991-05-10-0-male',y:1991};
  await dataset.getByLabel('导入公开年度JSONL').setInputFiles({name:'qa-synthetic-1991.jsonl',mimeType:'application/x-ndjson',buffer:jsonl([crossRow])});
  await dataset.getByTestId('dataset-status').filter({hasText:/导入完成/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='2 年 / 4 条索引','both years imported');
  for(const [scope,count,year] of [['all',4,null],['same-year',3,'1990'],['cross-year',1,'1991']]) {
   await dataset.getByLabel('公开样本年份范围').selectOption(scope);
   await dataset.getByRole('button',{name:'匹配已导入样本'}).click();
   await dataset.getByTestId('dataset-status').filter({hasText:new RegExp(`已匹配 ${count} 条`)}).waitFor();
   assert.equal(await dataset.locator('ol > li').count(),count);
   if(year) for(const result of await dataset.locator('ol > li > details > summary').all()) assert.ok((await result.innerText()).startsWith(year+'-'));
  }
  await dataset.locator('ol > li > details > summary').first().click();
  assert.match(await dataset.locator('ol > li').first().innerText(),/跨公历排盘年；共同宫位主星：/);
  await dataset.getByLabel('公开样本年份范围').selectOption('all');
  assert.ok(workers>=11,'dataset operations really use browser Workers');

  await page.screenshot({path:'test-results/dataset-synthetic.png',fullPage:true});
  await dataset.getByRole('button',{name:'关闭公开报告'}).click();
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
  await page.reload(); await openArchives(page); await page.getByRole('button',{name:/QA甲 ·/}).click();await openArchives(page);
  await openAdvanced(page);
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='2 年 / 4 条索引','dataset index persists after reload');
  await dataset.getByRole('button',{name:'匹配已导入样本'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/已匹配 4 条/}).waitFor();
  assert.equal(await dataset.locator('ol > li').count(),4);
  await dataset.getByRole('button',{name:'删除1990年数据索引'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/索引已删除/}).waitFor();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='1 年 / 1 条索引','deleting 1990 preserves 1991');
  assert.equal(await dataset.locator('ol > li').count(),0,'deleting dataset clears stale matches');
  await dataset.getByRole('button',{name:'匹配已导入样本'}).click();
  await dataset.getByTestId('dataset-status').filter({hasText:/已匹配 1 条/}).waitFor();
  assert.match(await dataset.locator('ol > li > details > summary').innerText(),/^1991-/);
  await dataset.getByRole('button',{name:'删除1991年数据索引'}).click();
  await eventually(async()=>await dataset.getByTestId('dataset-count').innerText()==='0 年 / 0 条索引','public indices cleaned up');

  assert.equal(await page.getByRole('button',{name:/QA甲 ·/}).count(),1,'deleting public index keeps private archive');
  await context.setOffline(true);
  await page.getByRole('button',{name:'流年',exact:true}).click();
  await assertReading(analysis);
  await page.getByRole('button',{name:'搜索本地相似盘'}).click(); await page.getByText('QA甲 · 结构重合 100%',{exact:true}).waitFor();
  await context.setOffline(false);
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'命盘',exact:true}).click();
  await assertChartPainted(page,'mobile');
  await page.screenshot({path:'test-results/chart-mobile.png',fullPage:true});
  await page.setViewportSize({width:1365,height:1000});
  await page.goto(base+'/heming');
  const parties=page.locator('section').filter({has:page.getByRole('heading',{name:'甲方',exact:true})});
  await birth(parties,'甲');
  await birth(page.locator('section').filter({has:page.getByRole('heading',{name:'乙方',exact:true})}),'乙','1991');
  await page.getByRole('heading',{name:'十二宫结构对照'}).waitFor(); assert.equal(await page.locator('tbody tr').count(),12);
  const pairResearch=page.locator('[aria-label="逐宫双盘研究"]');
  assert.equal(await pairResearch.locator(':scope > details').count(),12);
  const pairDetail=pairResearch.locator(':scope > details').first();
  await pairDetail.locator('summary').click();
  await pairDetail.getByRole('heading',{name:'盘面事实（各自命盘）'}).waitFor();
  await pairDetail.getByRole('heading',{name:'集合算术（不是适婚评分）'}).waitFor();
  await pairDetail.getByRole('heading',{name:'主题参照与研究问题'}).waitFor();
  assert.match(await pairDetail.innerText(),/甲方/);assert.match(await pairDetail.innerText(),/乙方/);
  assert.match(await pairDetail.innerText(),/对宫|三合/);
  const pairDownload=page.waitForEvent('download');await page.getByRole('button',{name:'下载完整对照报告'}).click();
  const pairReport=await fs.readFile(await (await pairDownload).path(),'utf8');
  assert.match(pairReport,/集合算术/);assert.match(pairReport,/研究问题/);

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
  const pairChat=page.getByRole('region',{name:'自带模型问答'});await pairChat.waitFor();
  await pairChat.getByLabel('API 地址',{exact:true}).fill('https://pair-qa.invalid/v1');
  await pairChat.getByLabel('模型名称',{exact:true}).fill('mock-pair');
  await pairChat.getByLabel('API Key',{exact:true}).fill('QA-PAIR-KEY');
  await pairChat.locator('input[type=checkbox]').check();
  await page.route('https://pair-qa.invalid/**',async route=>{
   const system=route.request().postDataJSON().messages[0].content;
   const material=JSON.parse(system.slice(system.indexOf('命盘：')+3));
   assert.match(material,/双人十二宫结构研究报告/);assert.match(material,/甲方三方四正/);assert.match(material,/乙方三方四正/);assert.match(material,/主题参照与研究问题/);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'QA合盘模型 MOCK 验证'}}]})});
  });
  await pairChat.getByLabel('问答问题').fill('比较双方的盘面结构');await pairChat.getByRole('button',{name:'发送问题'}).click();
  await pairChat.getByText(/QA合盘模型 MOCK/).waitFor();
  await page.getByRole('region',{name:'合盘结果'}).locator('input[type=checkbox]').first().uncheck();
  assert.equal(await page.getByRole('region',{name:'自带模型问答'}).count(),0);
  await page.screenshot({path:'test-results/pair.png',fullPage:true});
  await page.getByRole('button',{name:'编辑并重新排盘'}).first().click();
  assert.equal(await page.getByRole('heading',{name:'十二宫结构对照'}).count(),0);
  await page.getByRole('button',{name:'取消编辑，保留原盘'}).click(); await page.getByRole('heading',{name:'十二宫结构对照'}).waitFor();
  await page.goto(base+'/study');
  const study=page.getByRole('region',{name:'天纪短引文研读工作台'});
  await study.getByTestId('study-status').filter({hasText:/本地短引文已加载/}).waitFor();
  assert.match(await study.getByTestId('study-count').innerText(),/^1848 条结果/);
  assert.equal(await study.getByTestId('study-entry').count(),20);
  await study.getByRole('button',{name:'下一页引文'}).click();assert.match(await study.getByTestId('study-count').innerText(),/第 2 /);
  await study.getByRole('button',{name:'上一页引文'}).click();
  await study.getByLabel('检索短引文').fill('QA不存在的独有测试字符串');
  await eventually(async()=>/0 条结果/.test(await study.getByTestId('study-count').innerText()),'study no-result search');
  await study.getByLabel('检索短引文').fill('紫微');
  await eventually(async()=>await study.getByTestId('study-entry').count()>0,'study keyword results');
  await study.getByLabel('检索短引文').fill('');
  await study.getByLabel('引文讲次').selectOption({index:1});
  assert.ok(await study.getByTestId('study-entry').count()>0);
  await study.getByLabel('引文讲次').selectOption('');
  await study.getByLabel('引文主题').selectOption('01-stars');
  assert.ok(await study.getByTestId('study-entry').count()>0);
  await study.getByLabel('引文主题').selectOption('');
  let entry=study.getByTestId('study-entry').first();
  const firstTitle=await entry.locator('h3').innerText();
  const source=await entry.getByRole('link',{name:'打开B站此秒出处（需联网）'}).getAttribute('href');
  assert.match(source,/^https:\/\/www\.bilibili\.com\/video\/BV.+\?p=\d+&t=\d+$/);
  await entry.getByText('个人收藏与笔记',{exact:true}).click();
  await entry.getByLabel('收藏此条').check();await entry.getByLabel('个人研读笔记').fill('QA个人笔记，不是原话');
  await entry.getByRole('button',{name:'保存研读笔记'}).click();await entry.getByRole('status').filter({hasText:/笔记已保存/}).waitFor();
  await entry.getByLabel('个人研读笔记').fill('未保存修改');await entry.getByRole('button',{name:'取消笔记修改'}).click();
  await eventually(async()=>await entry.getByLabel('个人研读笔记').inputValue()==='QA个人笔记，不是原话','note cancel restores saved text');
  await study.getByLabel('只看收藏').check();await eventually(async()=>await study.getByTestId('study-entry').count()===1,'favorite filter');
  await page.reload();await study.getByTestId('study-status').filter({hasText:/本地短引文已加载/}).waitFor();
  await study.getByLabel('只看收藏').check();await eventually(async()=>await study.getByTestId('study-entry').count()===1,'favorite persists');
  entry=study.getByTestId('study-entry').first();assert.equal(await entry.locator('h3').innerText(),firstTitle);
  await entry.getByText('个人收藏与笔记',{exact:true}).click();
  await eventually(async()=>await entry.getByLabel('个人研读笔记').inputValue()==='QA个人笔记，不是原话','note persists');
  await study.getByText('研读收藏与笔记备份',{exact:true}).click();
  const studyDownload=page.waitForEvent('download');await study.getByRole('button',{name:'导出研读备份'}).click();
  const studyBackup=await fs.readFile(await (await studyDownload).path(),'utf8');assert.equal(JSON.parse(studyBackup).notes.length,1);assert.ok(!studyBackup.includes('apiKey'));
  const altered=JSON.parse(studyBackup);altered.notes[0].note='QA恢复后的笔记';
  const studyFile={name:'study.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(altered))};
  await study.getByLabel('导入研读备份').setInputFiles(studyFile);await study.getByRole('region',{name:'研读备份确认'}).waitFor();
  await study.getByRole('button',{name:'取消恢复研读备份'}).click();assert.equal(await entry.getByLabel('个人研读笔记').inputValue(),'QA个人笔记，不是原话');
  await study.getByLabel('导入研读备份').setInputFiles(studyFile);await study.getByRole('region',{name:'研读备份确认'}).waitFor();
  await study.getByRole('button',{name:'确认恢复研读备份'}).click();await study.getByTestId('study-status').filter({hasText:/已合并恢复/}).waitFor();
  await entry.getByText('个人收藏与笔记',{exact:true}).click();
  await eventually(async()=>await entry.getByLabel('个人研读笔记').inputValue()==='QA恢复后的笔记','confirmed restore applied');
  await page.screenshot({path:'test-results/study-notes.png',fullPage:true});
  const selectedQuote=await entry.locator('blockquote').innerText();
  await entry.getByRole('button',{name:'选择此条用自带模型研读'}).click();
  const research=page.getByRole('region',{name:'选定引文模型研读'});
  await research.getByLabel('研读 API Base URL').fill('https://study-qa.invalid');
  await research.getByLabel('研读模型',{exact:true}).fill('mock-research');
  await research.getByLabel('同意发送所选研读材料').check();
  assert.equal(await research.getByRole('button',{name:'生成自研读解'}).isDisabled(),true);
  await research.getByLabel('研读 API Key').fill('QA-STUDY-KEY-PRIVATE');
  assert.equal(await research.getByLabel('同意发送所选研读材料').isChecked(),false);
  await research.getByLabel('同意发送所选研读材料').check();
  await research.getByLabel('研读模型',{exact:true}).fill('mock-research-updated');
  assert.equal(await research.getByLabel('同意发送所选研读材料').isChecked(),false);
  assert.equal(await research.getByRole('button',{name:'生成自研读解'}).isDisabled(),true);
  await research.getByLabel('同意发送所选研读材料').check();

  let studyCalls=0;
  await page.route('https://study-qa.invalid/**',async route=>{
   studyCalls++;assert.equal(route.request().url(),'https://study-qa.invalid/v1/chat/completions');
   assert.equal(route.request().headers().authorization,'Bearer QA-STUDY-KEY-PRIVATE');
   const body=route.request().postDataJSON(),system=body.messages[0].content;
   const payload=JSON.parse(system.slice(system.indexOf('命盘：')+3));
   assert.equal(payload.material.entry.quote,selectedQuote);assert.equal(payload.material.entry.id,JSON.parse(studyBackup).notes[0].id);
   assert.equal(payload.material.source,'Renhuai123/nihai-tianji-corpus@462faa4');
   assert.ok(!payload.material.entries&&!payload.material.rows,'only selected entry sent, never full corpus');
   assert.ok(route.request().postData().length<20000);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'QA模型研读 MOCK，仅验证接口流程'}}]})});
  });
  await research.getByRole('button',{name:'生成自研读解'}).click();
  await research.getByRole('article',{name:'模型生成研读解释'}).waitFor();assert.equal(studyCalls,1);
  await page.screenshot({path:'test-results/study-ai-mock.png',fullPage:true});
  const privateStudyDownload=page.waitForEvent('download');await study.getByRole('button',{name:'导出研读备份'}).click();
  const privateStudyText=await fs.readFile(await (await privateStudyDownload).path(),'utf8');
  assert.ok(!privateStudyText.includes('QA-STUDY-KEY-PRIVATE'));assert.ok(!privateStudyText.includes('QA模型研读'));
  await page.unroute('https://study-qa.invalid/**');
  await page.route('https://study-qa.invalid/**',async route=>{await sleep(1500);await route.fulfill({status:503,body:'mock unavailable'}).catch(()=>{});});
  await research.getByRole('button',{name:'生成自研读解'}).click();await research.getByRole('button',{name:'取消研读请求'}).click();
  await research.getByRole('status').filter({hasText:/已取消/}).waitFor();
  assert.equal(await research.getByRole('article',{name:'模型生成研读解释'}).count(),0);
  await study.getByLabel('只看收藏').uncheck();
  await study.getByTestId('study-entry').nth(1).getByRole('button',{name:'选择此条用自带模型研读'}).click();
  assert.equal(await research.getByLabel('研读 API Key').inputValue(),'');
  assert.equal(await research.getByLabel('同意发送所选研读材料').isChecked(),false);
  assert.equal(await research.getByRole('article',{name:'模型生成研读解释'}).count(),0);
  await page.reload();await study.getByTestId('study-status').filter({hasText:/本地短引文已加载/}).waitFor();
  await study.getByTestId('study-entry').first().getByRole('button',{name:'选择此条用自带模型研读'}).click();
  assert.equal(await research.getByLabel('研读 API Key').inputValue(),'');
  assert.equal(await research.getByRole('article',{name:'模型生成研读解释'}).count(),0);

  assert.ok(!requests.some(url=>url.startsWith('https://www.bilibili.com/')),'source links do not fetch videos automatically');
  for(const path of ['/library','/library/search?q=紫微']) { await page.goto(base+path); assert.ok((await page.locator('body').innerText()).length>100); }
  assert.equal(errors.length,0,errors.join('\n')); assert.ok(!requests.some(url=>/\/api\/(interpret|heming)/.test(url)));
  console.log('PASS: browser local flows; AI response mocked; offline in-session only, not offline server restart.');
 } catch(error) { await page.screenshot({path:'test-results/failure.png',fullPage:true}).catch(()=>{}); await fs.writeFile('test-results/failure.txt',String(error)+'\n'+await page.locator('body').innerText().catch(()=>'')); throw error; } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
