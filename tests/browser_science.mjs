import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectSite } from '../scripts/build_site.mjs';
import { startLocalReview } from '../scripts/preview_site.mjs';
import { createRelease } from './fixtures/science.mjs';

const temp = await mkdtemp(join(tmpdir(), 'pinn-browser-'));
let browser;
let server;
let review;
try {
  const original = await collectSite();
  const fixture = await collectSite(await createRelease(join(temp, 'release')));
  const contentType = path => path.endsWith('.json') ? 'application/json' : /\.m?js$/.test(path) ? 'text/javascript'
    : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : 'text/html';
  server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const match = path.match(/^\/(pinn-research-hub|partial)\/(.*)$/);
    const files = match ? fixture : original;
    const key = (match ? match[2] : path.slice(1)) || 'index.html';
    if (match?.[1] === 'partial' && key === 'data/metrics.json') { response.writeHead(404).end(); return; }
    if (!files.has(key)) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': contentType(key) }).end(files.get(key));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = join(temp, 'profile');
  await mkdir(profile);
  browser = spawn(process.env.CHROME_BIN || 'google-chrome', [
    '--headless', '--disable-gpu', '--no-sandbox', '--disable-background-networking', '--remote-debugging-pipe',
    `--user-data-dir=${profile}`,
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  let sequence = 0;
  let buffer = '';
  const pending = new Map();
  const exceptions = [];
  const requests = new Set();
  browser.stdio[4].setEncoding('utf8');
  browser.stdio[4].on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\0')) {
      const end = buffer.indexOf('\0');
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
      if (message.method === 'Network.requestWillBeSent') requests.add(message.params.request.url);
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    }
  });
  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 7000);
      pending.set(id, { resolve, reject, timer });
      browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await Promise.all(['Page', 'Runtime', 'Network'].map(domain => cdp(`${domain}.enable`)));
  async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, returnByValue: true });
    assert(!exceptionDetails, JSON.stringify(exceptionDetails));
    return result.value;
  }
  async function until(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    throw new Error(`Condition did not become true: ${expression}`);
  }
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const open = async path => {
    await cdp('Page.navigate', { url: origin + path });
    await until(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && document.getElementById('loading')?.hidden`);
  };
  async function key(key, code, virtualKey) {
    const params = { key, code, windowsVirtualKeyCode: virtualKey };
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...params });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  }

  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await open('/');
  await until("document.getElementById('scientific-dashboard').textContent.includes('aguarda divulgação')");
  if (process.env.PINN_QA_SCREENSHOT_DIR) {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(process.env.PINN_QA_SCREENSHOT_DIR, 'pinn-v03-desktop.png'), Buffer.from(data, 'base64'));
  }
  assert.equal(await evaluate("document.querySelector('#milestone-count').textContent"), '1 de 3 marcos concluídos');
  assert(![...requests].some(url => /data\/(metrics|figures)\.json$/.test(url)));
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.className'), 'skip-link');
  await key('Enter', 'Enter', 13);
  await until("document.activeElement.id === 'main-content'");
  await click('a[href="#experiments"]');
  await until("document.querySelector('#experiments .empty')?.textContent.includes('sem publicação')");
  await click('#language');
  await until("document.documentElement.lang === 'en' && document.querySelector('#experiments .empty')?.textContent.includes('awaiting')");
  for (const hiddenPath of ['/.experiment-import/featured/data/metrics.json', '/reports/import_report.json', '/config/featured_experiments.yaml', '/README.md']) {
    assert.equal((await fetch(origin + hiddenPath)).status, 404);
  }
  console.log('Editorial root, public empty state, delayed details, keyboard and restricted artifact');

  await open('/pinn-research-hub/');
  await until("document.querySelector('.baseline-details') !== null");
  const fixtureOrigin = `${origin}/pinn-research-hub/`;
  assert(!requests.has(fixtureOrigin + 'data/metrics.json'));
  await click('.baseline-details summary');
  await until("document.querySelector('.baseline-measurements')?.textContent.includes('0,21')");
  for (const width of [360, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: false });
    assert(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
  }

  await click('nav a[href="#timeline"]');
  await until("document.querySelector('#event-evt-example summary') !== null");
  assert(await evaluate("document.querySelector('#timeline').textContent.includes('Marcos sem data confirmada')"));
  await click('#event-evt-example summary');
  await click('#event-evt-example a[href="#pair-cmp-sst-20261113-212942"]');
  await until("document.querySelector('#pair-cmp-sst-20261113-212942 .measure-chart') !== null");
  assert(await evaluate("document.querySelector('#comparison').textContent.includes('Comparação descritiva')"));
  assert(await evaluate("document.querySelector('#comparison').textContent.includes('Melhor valor nesta condição')"));

  await evaluate("location.hash = '#pair-cmp-blocked'");
  await until("document.querySelector('#pair-cmp-blocked') !== null");
  assert.equal(await evaluate("document.querySelectorAll('#comparison .measure-chart').length"), 0);
  await click('#pair-cmp-blocked a[href="#run-exp-pinn"]');
  await until("document.querySelector('#run-exp-pinn table') !== null");
  assert(await evaluate("document.querySelector('#run-exp-pinn').textContent.includes('Não informado')"));

  await evaluate("location.hash = '#experiments'");
  await until("document.querySelector('#experiments .research-card') !== null && !document.querySelector('#run-exp-pinn')");
  await evaluate(`{
    const select = [...document.querySelectorAll('#experiments select')].find(control => [...control.options].some(option => option.value === 'PINN-cont'));
    select.value = 'PINN-cont';
    select.dispatchEvent(new Event('change'));
  }`);
  assert.equal(await evaluate("document.querySelectorAll('#experiments .research-card').length"), 1);
  await click('#experiments .filter-bar button');
  assert.equal(await evaluate("document.querySelectorAll('#experiments .research-card').length"), 2);

  await evaluate("location.hash = '#figure-figure-example'");
  await until("document.querySelector('#figure-figure-example img')?.complete");
  assert(await evaluate("document.querySelector('#figure-figure-example img').alt === 'Pixel de teste'"));
  await click('#figure-figure-example button');
  await until("document.querySelector('dialog[open]') !== null");
  await key('Escape', 'Escape', 27);
  await until("document.querySelector('dialog') === null");

  await click('#language');
  await until("document.querySelector('#timeline-title').textContent === 'Research timeline'");
  await open('/partial/');
  await evaluate("location.hash = '#run-exp-pinn'");
  await until("document.querySelector('#run-exp-pinn') !== null");
  assert(await evaluate("document.querySelector('#experiments').textContent.includes('Parte dos dados está indisponível')"));
  assert.equal(await evaluate("document.querySelectorAll('#run-exp-pinn table').length"), 0);
  assert([...requests].every(url => url.startsWith(origin + '/')), [...requests]);
  assert.deepEqual(exceptions, []);
  console.log('Project subpath, scientific links, filtering, descriptive and blocked comparison, gallery and PT/EN');

  if (process.argv.includes('--local-review')) {
    review = await startLocalReview({ port: 0 });
    const url = `http://127.0.0.1:${review.address().port}`;
    await cdp('Page.navigate', { url });
    await until("document.querySelector('#scientific-dashboard')?.textContent.includes('coleção experimental privada')");
    await until("document.querySelector('.baseline-details summary') !== null");
    await click('.baseline-details summary');
    await until("document.querySelectorAll('.baseline-measurements .facts dt').length === 8");

    await evaluate("location.hash = '#experiments'");
    await until("document.querySelectorAll('#experiments .research-card').length === 32");
    await evaluate("location.hash = '#event-evt-replicas-ke'");
    await until("document.querySelector('#event-evt-replicas-ke')?.open");
    await click('#event-evt-replicas-ke a[href="#pair-cmp-ke-20260919-024533"]');
    await until("document.querySelectorAll('#comparison .measure-chart').length === 4");
    await evaluate("location.hash = '#pair-cmp-sst-20261113-212942'");
    await until("document.querySelector('#pair-cmp-sst-20261113-212942') !== null");
    assert.equal(await evaluate("document.querySelectorAll('#comparison .measure-chart').length"), 0);

    await evaluate("location.hash = '#figure-replicas-ke-024533-abs'");
    await until("document.querySelector('#figure-replicas-ke-024533-abs img')?.naturalWidth > 0");
    assert.equal(await evaluate("document.querySelectorAll('#figures figure').length"), 7);
    assert.equal((await fetch(url + '/reports/managed.json')).status, 404);
    assert.equal((await fetch(url + '/.experiment-import/featured/data/metrics.json')).status, 404);
    assert.equal((await fetch(url + '/data/metrics.json')).headers.get('cache-control'), 'no-store');
    assert.deepEqual(exceptions, []);
    console.log('Private collection: 32 runs, baseline metrics, linked timeline, guarded comparisons and 7 figures');
  }
} finally {
  if (browser?.exitCode === null) {
    const exited = once(browser, 'exit');
    browser.kill();
    await exited;
  }
  server?.close();
  review?.close();
  await rm(temp, { recursive: true, force: true });
}
