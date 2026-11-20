import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectSite } from '../scripts/build_site.mjs';
import { startLocalReview } from '../scripts/preview_site.mjs';
import { createRelease, example } from './fixtures/science.mjs';

const temp = await mkdtemp(join(tmpdir(), 'pinn-browser-'));
let browser;
let server;
let review;
try {
  const original = await collectSite();
  const sample = example();
  const source = sample.comparisons[0];
  sample.comparisons.push({ ...source, id: 'cmp-compatible', status: 'compatible', figures: [],
    conditions: source.conditions.map(condition => ({ ...condition, status: 'compatible', reasons: [] })), limitations: [] });
  sample.timeline[0].comparisonIds.push('cmp-compatible');
  const fixture = await collectSite(await createRelease(join(temp, 'release'), sample));
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
  await until("document.querySelector('.analytics-kpis') !== null");
  if (process.env.PINN_QA_SCREENSHOT_DIR) {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(process.env.PINN_QA_SCREENSHOT_DIR, 'pinn-v05-public-desktop.png'), Buffer.from(data, 'base64'));
  }
  assert(await evaluate(`(() => {
    const luminance = color => {
      const rgb = color.match(/\\d+(?:\\.\\d+)?/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    return [
      ['nav a', '.site-header'], ['.research-summary', '.hero'],
      ['.hero .primary-action', '.hero .primary-action'], ['.analytics-kpis dt', '.analytics-kpis'],
    ].every(([text, background]) => {
      const fg = luminance(getComputedStyle(document.querySelector(text)).color);
      const bg = luminance(getComputedStyle(document.querySelector(background)).backgroundColor);
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) >= 4.5;
    });
  })()`));
  assert.equal(await evaluate("document.querySelector('#milestone-count').textContent"), '1 de 3 marcos concluídos');
  assert(![...requests].some(url => /data\/(metrics|figures)\.json$/.test(url)));
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.className'), 'skip-link');
  await key('Enter', 'Enter', 13);
  await until("document.activeElement.id === 'main-content'");
  await click('nav a[href="#/resultados"]');
  await until("document.querySelector('#results a[href=\"#/execucoes\"]') !== null");
  await click('#results a[href="#/execucoes"]');
  await until("document.querySelector('#experiments .empty')?.textContent.includes('sem publicação')");
  await click('#language');
  await until("document.documentElement.lang === 'en' && document.querySelector('#experiments .empty')?.textContent.includes('awaiting')");
  for (const hiddenPath of ['/.experiment-import/featured/data/metrics.json', '/reports/import_report.json', '/config/featured_experiments.yaml', '/README.md']) {
    assert.equal((await fetch(origin + hiddenPath)).status, 404);
  }
  assert(await evaluate("document.querySelector('.bfs-diagram').textContent.includes('Backward-facing step')"));
  await evaluate("location.hash = '#justification'");
  await until("document.activeElement.id === 'justification' && document.querySelectorAll('#justification li').length === 3");
  await click('nav a[href="#/bibliografia-semanal"]');
  await until("document.querySelector('#weekly-literature').textContent.includes('Under construction') && !document.querySelector('#weekly-literature').hidden");
  await click('#weekly-literature a[href="#literature"]');
  await until("document.querySelectorAll('.bibliography-list > li').length === 23");
  await evaluate(`{
    const input = document.querySelector('.bibliography-search input');
    input.value = 'pioch';
    input.dispatchEvent(new Event('input'));
  }`);
  assert.equal(await evaluate("document.querySelectorAll('.bibliography-list > li').length"), 1);
  console.log('Editorial root, public empty state, delayed details, keyboard and restricted artifact');

  await open('/pinn-research-hub/');
  await until("document.querySelectorAll('.activity-chart').length === 4");
  const fixtureOrigin = `${origin}/pinn-research-hub/`;
  await until("!document.getElementById('overview-visual').hidden");
  assert(await evaluate("document.querySelector('#overview-visual .measure-chart') !== null"));
  assert(requests.has(fixtureOrigin + 'data/metrics.json'));
  await click('.activity-chart a[href*="time=confirmed"]');
  await until("document.querySelectorAll('#experiments .run-list tbody tr').length === 1");
  assert(await evaluate("document.querySelector('#experiments .run-timestamp').textContent.includes('08:13:00')"));
  await cdp('Page.reload');
  await until("document.querySelectorAll('#experiments .run-list tbody tr').length === 1");
  assert(await evaluate("location.hash.includes('time=confirmed')"));
  for (const width of [375, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: false });
    assert(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
  }

  await click('nav a[href="#/evolucao"]');
  await until("document.querySelector('#event-evt-example a') !== null");
  assert(await evaluate("document.querySelector('#timeline').textContent.includes('Marcos sem data confirmada')"));
  await click('#event-evt-example a[href="#/resultados/baseline-sst"]');
  await until("document.activeElement.id === 'group-baseline-sst'");
  await cdp('Page.reload');
  await until("document.activeElement.id === 'group-baseline-sst' && document.querySelector('#investigation table') !== null");
  assert(await evaluate("document.querySelector('#timeline').hidden"));
  assert(await evaluate("document.querySelector('#investigation .metric-explorer table').textContent.includes('08:13:00')"));
  await evaluate(`{
    const select = [...document.querySelectorAll('#investigation .metric-explorer select')].find(control => control.value === 'matrix');
    select.value = 'list';
    select.dispatchEvent(new Event('change'));
  }`);
  const measure = '#investigation .metric-evidence button';
  await click(measure);
  await until("document.querySelector('.audit-dialog[open]')?.textContent.includes('Vector RMSE')");
  await key('Escape', 'Escape', 27);
  await until("document.activeElement.classList.contains('quiet-button')");
  await click('#investigation a[href="#/comparacoes/cmp-sst-20261113-212942"]');
  await until("document.querySelector('#pair-cmp-sst-20261113-212942 table') !== null");
  assert(await evaluate("document.querySelector('#comparison').textContent.includes('Comparação descritiva')"));
  assert.equal(await evaluate("document.querySelectorAll('#comparison .measure-chart').length"), 0);
  assert(await evaluate("!document.querySelector('#comparison').textContent.includes('Melhor valor')"));

  await evaluate("location.hash = '#/comparacoes/cmp-compatible'");
  await until("document.querySelector('#pair-cmp-compatible .measure-chart') !== null");

  await evaluate("location.hash = '#pair-cmp-blocked'");
  await until("document.querySelector('#pair-cmp-blocked') !== null");
  assert.equal(await evaluate("document.querySelectorAll('#comparison .measure-chart').length"), 0);
  await click('#pair-cmp-blocked a[href="#/execucoes/exp-pinn"]');
  await until("document.querySelector('#run-exp-pinn table') !== null");
  assert(await evaluate("document.querySelector('#run-exp-pinn').textContent.includes('Não informado')"));

  await evaluate("location.hash = '#experiments'");
  await until("document.querySelector('#experiments .run-list tbody tr') !== null && !document.querySelector('#run-exp-pinn')");
  await evaluate(`{
    const select = [...document.querySelectorAll('#experiments select')].find(control => [...control.options].some(option => option.value === 'PINN-cont'));
    select.value = 'PINN-cont';
    select.dispatchEvent(new Event('change'));
  }`);
  assert.equal(await evaluate("document.querySelectorAll('#experiments .run-list tbody tr').length"), 1);
  await click('#experiments .filter-bar button');
  assert.equal(await evaluate("document.querySelectorAll('#experiments .run-list tbody tr').length"), 2);

  await evaluate("location.hash = '#figure-figure-example'");
  await until("document.querySelector('#figure-figure-example img')?.complete");
  assert(await evaluate("document.querySelector('#figure-figure-example img').alt === 'Pixel de teste'"));
  await click('#figure-figure-example button');
  await until("document.querySelector('dialog[open]') !== null");
  await click('dialog .dialog-controls button:nth-child(2)');
  assert(await evaluate("document.querySelector('dialog .figure-viewport').classList.contains('zoomed')"));
  await key('Escape', 'Escape', 27);
  await until("document.querySelector('dialog') === null");

  await click('#language');
  await until("document.querySelector('#timeline-title').textContent === 'Research timeline'");
  await open('/partial/');
  await evaluate("location.hash = '#run-exp-pinn'");
  await until("document.querySelector('#run-exp-pinn') !== null");
  assert(await evaluate("document.querySelector('#experiments').textContent.includes('Parte dos dados está indisponível')"));
  assert.equal(await evaluate("document.querySelectorAll('#run-exp-pinn table').length"), 0);
  assert([...requests].filter(url => /^https?:/.test(url)).every(url => url.startsWith(origin + '/')), [...requests]);
  assert.deepEqual(exceptions, []);
  console.log('Project subpath, scientific links, filtering, descriptive and blocked comparison, gallery and PT/EN');

  if (process.argv.includes('--local-review')) {
    review = await startLocalReview({ port: 0 });
    const url = `http://127.0.0.1:${review.address().port}`;
    await cdp('Page.navigate', { url });
    await until("document.querySelector('#review-badge')?.title.includes('coleção experimental privada')");
    await until("document.querySelectorAll('.activity-chart').length === 4 && document.querySelector('.analytics-kpis').textContent.includes('32')");
    assert(await evaluate("document.querySelector('.analytics-kpis').textContent.includes('21:32:59')"));
    assert(await evaluate("document.querySelector('.activity-chart:nth-child(2)').textContent.includes('confirmação · 7')"));
    await until("document.querySelector('#overview-visual img')?.naturalWidth > 0");
    if (process.env.PINN_QA_SCREENSHOT_DIR) {
      const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(process.env.PINN_QA_SCREENSHOT_DIR, 'pinn-v05-dashboard-local.png'), Buffer.from(data, 'base64'));
    }

    await evaluate("location.hash = '#experiments'");
    await until("document.querySelectorAll('#experiments .run-list tbody tr').length === 32");
    assert.equal(await evaluate("document.querySelectorAll('#experiments .run-timestamp').length"), 32);
    await evaluate("location.hash = '#event-evt-replicas-ke'");
    await until("document.querySelector('#event-evt-replicas-ke a[href=\"#/resultados/replicas-ke\"]') !== null");
    const screenshots = process.env.PINN_QA_SCREENSHOT_DIR;
    for (const width of [375, 768, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      assert(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
      if (screenshots) {
        await evaluate('window.scrollTo(0, 0)');
        const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(screenshots, `pinn-v05-timeline-${width}.png`), Buffer.from(data, 'base64'));
      }
    }
    await click('#event-evt-replicas-ke a[href="#/resultados/replicas-ke"]');
    await until("document.activeElement.id === 'group-replicas-ke'");
    for (const width of [375, 768, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      assert(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
      if (screenshots) {
        await evaluate('window.scrollTo(0, 0)');
        const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(screenshots, `pinn-v05-investigation-${width}.png`), Buffer.from(data, 'base64'));
      }
    }
    await evaluate(`{
      const input = document.querySelector('#investigation input[type=search]');
      input.value = 'sem coincidência';
      input.dispatchEvent(new Event('input'));
    }`);
    assert.equal(await evaluate("document.querySelectorAll('#investigation table').length"), 0);
    await click('#investigation .filter-bar button');
    assert(await evaluate("document.querySelectorAll('#investigation table').length > 0"));
    await click('#investigation a[href="#/comparacoes/cmp-ke-20260919-024533"]');
    await until("document.querySelectorAll('#comparison table').length === 4");
    assert.equal(await evaluate("document.querySelectorAll('#comparison .measure-chart').length"), 0);
    await evaluate("location.hash = '#pair-cmp-sst-20261113-212942'");
    await until("document.querySelector('#pair-cmp-sst-20261113-212942') !== null");
    assert.equal(await evaluate("document.querySelectorAll('#comparison .measure-chart').length"), 0);

    await evaluate("location.hash = '#/execucoes/exp-ke-pinn-cont-base-20260919-024952'");
    await until("document.querySelector('#run-graphics .measure-chart') !== null && document.querySelector('#run-graphics figure') !== null");
    assert(await evaluate("document.querySelector('#run-exp-ke-pinn-cont-base-20260919-024952 .run-timestamp').textContent.includes('UTC')"));
    await click('#run-graphics details summary');
    await until("document.querySelector('#run-graphics canvas') !== null");
    await evaluate("location.hash = '#figure-replicas-ke-024533-abs'");
    await until("document.querySelector('#figure-replicas-ke-024533-abs img')?.naturalWidth > 0");
    assert.equal(await evaluate("document.querySelectorAll('#figures figure').length"), 7);
    assert.equal((await fetch(url + '/reports/managed.json')).status, 404);
    assert.equal((await fetch(url + '/.experiment-import/featured/data/metrics.json')).status, 404);
    assert.equal((await fetch(url + '/data/metrics.json')).headers.get('cache-control'), 'no-store');
    assert.deepEqual(exceptions, []);
    await new Promise(resolve => review.close(resolve));
    review = await startLocalReview({ port: 0, staging: '.experiment-import/catalog' });
    const catalog = `http://127.0.0.1:${review.address().port}`;
    await cdp('Page.navigate', { url: catalog + '/#/execucoes' });
    await until("document.querySelectorAll('#experiments .run-list tbody tr').length === 70");
    await click('#experiments a[href="#/reavaliacoes"]');
    await until("document.querySelectorAll('.reevaluation').length === 14");
    assert(await evaluate("document.querySelector('.reevaluation').textContent.includes('Treino de origem não confirmado')"));
    assert.equal((await fetch(catalog + '/reports/import_report.json')).status, 404);
    assert.deepEqual(exceptions, []);
    console.log('Private profiles: 32 featured runs and 7 curated figures; 70 historical runs and 14 distinct reevaluations');
  }
} finally {
  if (browser?.exitCode === null) {
    const exited = once(browser, 'exit');
    browser.kill();
    await exited;
  }
  server?.close();
  review?.close();
  await rm(temp, { recursive: true, force: true, maxRetries: 4 });
}
