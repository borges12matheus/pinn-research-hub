import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { approvedFigures, figurePath, index, measureComparison, validateCollection } from '../assets/js/science/contracts.mjs';
import { byRunTime, catalogFilters, catalogURL, matchesRun, reynoldsGroup, runTime, runsOverTime, validTimestamp } from '../assets/js/science/catalog-data.mjs';
import { routeFor } from '../assets/js/science/portal.mjs';
import { collectLocalReview, collectSite } from '../scripts/build_site.mjs';
import { createRelease, example } from './fixtures/science.mjs';

const compare = value => {
  const [pair] = value.comparisons;
  return measureComparison(pair, pair.conditions[0], index(value.metrics), index(value.experiments));
};

test('descriptive measurements have no winners and compatible measurements handle ties', () => {
  const data = example();
  const first = compare(data);
  assert(first.descriptive);
  assert.equal(first.records.length, 2);
  assert.equal(first.winners.size, 0);
  data.comparisons[0].status = 'compatible';
  data.comparisons[0].conditions[0].status = 'compatible';
  assert.deepEqual([...compare(data).winners], ['metric-exp-pinn']);
  data.metrics[0].value = data.metrics[1].value;
  const tie = compare(data);
  assert.equal(tie.winners.size, 2);
  assert(tie.tied);
  data.metrics[0].lowerIsBetter = null;
  assert.equal(compare(data).winners.size, 0);
});

test('comparison blocks scope, operator, unit, split and cohort conflicts', () => {
  const disagreements = [
    metric => { metric.unit = null; }, metric => { metric.evaluationSet = 'full_domain'; },
    metric => { metric.calculationMethod = 'openfoam_plus_autograd'; }, metric => { metric.value = null; },
    metric => { metric.validityMask.evaluationFingerprint = 'different'; },
  ];
  for (const modify of disagreements) {
    const data = example();
    modify(data.metrics[0]);
    assert.equal(compare(data), null);
  }
  const data = example();
  data.experiments[0].splitId = 'different';
  assert.equal(compare(data), null);
  const matching = example();
  assert.equal(measureComparison(matching.comparisons[1], matching.comparisons[1].conditions[0],
    index(matching.metrics), index(matching.experiments)), null);
});

test('contracts reject private or duplicated records and unsafe figure paths', () => {
  const data = example();
  assert.throws(() => validateCollection('experiments', [...data.experiments, data.experiments[0]]), /Duplicate/);
  data.experiments[0].visibility = 'private';
  assert.throws(() => validateCollection('experiments', data.experiments), /Invalid public/);
  assert(!figurePath('figures/../../private.png'));
  assert(!figurePath('https://example.org/file.png'));
  const image = data.comparisons[0].figures[0];
  const refs = approvedFigures([], data.comparisons);
  assert.equal(refs.length, 1);
  assert.throws(() => approvedFigures([], data.comparisons, [{ ...image, caption: 'Different' }]), /Conflicting figure/);
});

test('routes keep original anchors and stable details including malformed fragments', () => {
  assert.deepEqual(routeFor('#run-exp-pinn'), { section: 'experiments', key: 'run-exp-pinn', type: 'run', record: 'exp-pinn' });
  assert.deepEqual(routeFor('#/resultados/replicas-ke'),
    { section: 'investigation', key: 'group-replicas-ke', type: 'group', record: 'replicas-ke' });
  assert.deepEqual(routeFor('#/execucoes/exp-pinn'), routeFor('#run-exp-pinn'));
  assert.equal(routeFor('#/evolucao').section, 'timeline');
  assert.equal(routeFor('#/bibliografia-semanal').section, 'weekly-literature');
  assert.equal(routeFor('#priorities').section, 'priorities');
  assert.equal(routeFor('#%E0%A4').section, 'overview');
});

test('empty static package ships editorial data and empty catalogs only', async () => {
  const files = await collectSite();
  for (const key of ['experiments', 'timeline', 'metrics', 'comparisons', 'figures', 'evaluations', 'training']) {
    assert.deepEqual(JSON.parse(files.get(`data/${key}.json`)), []);
  }
  assert(files.has('data/updates.json'));
  const references = JSON.parse(files.get('data/literature.json'));
  assert.equal(references.length, 23);
  assert.equal(references.filter(record => record.doi).length, 17);
  assert(references.every(record => record.authors.length && record.title && record.year));
  assert(!String(files.get('data/literature.json')).includes('Zotero'));
  assert(![...files.keys()].some(key => /(?:staging|\.experiment-import|\.parquet|reports|\.md$)/.test(key)));
});

test('restricted package verifies importer hashes, cross references and images', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pinn-build-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const release = await createRelease(directory);
  const files = await collectSite(release);
  const overview = JSON.parse(files.get('data/overview.json'));
  assert.equal(overview.groups.length, 1);
  assert.equal(overview.visual, null);
  assert.equal(overview.selectionCount, 2);
  assert(overview.groups[0].question.pt);
  assert.equal(overview.experimentalDate, '2026-11-13');
  assert.equal(overview.baseline.experimentIds.length, 2);
  assert(files.has('figures/phase_02/example.png'));
  await writeFile(join(directory, 'figures/phase_02/example.png'), 'modified');
  await assert.rejects(collectSite(release), /Unapproved or modified artifact/);

  const data = example();
  data.timeline[0].experimentIds = ['missing'];
  await assert.rejects(collectSite(await createRelease(directory, data)), /Unresolved reference/);
  data.timeline[0].experimentIds = ['exp-mlp'];
  data.experiments[0].configurationPath = '/home/local/config.yaml';
  await assert.rejects(collectSite(await createRelease(directory, data)), /Internal configuration path/);
  data.experiments[0].configurationPath = null;
  data.experiments[0].visibility = 'private';
  await assert.rejects(collectSite(await createRelease(directory, data)), /Private record/);
});

test('local review retains private visibility and excludes staging reports from served files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pinn-review-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = example();
  for (const rows of Object.values(data)) for (const record of rows) record.visibility = 'private';
  data.comparisons[0].figures[0].published = false;
  const { approvals } = await createRelease(directory, data);
  await mkdir(join(directory, 'reports'));
  await writeFile(join(directory, 'reports/managed.json'), JSON.stringify(approvals));
  await writeFile(join(directory, 'reports/import_report.json'), 'private report');
  const options = { staging: directory };
  const files = await collectLocalReview(options);
  assert.match(files.get('index.html'), /<html data-local-review/);
  assert.equal(JSON.parse(files.get('data/experiments.json'))[0].visibility, 'private');
  const [figure] = JSON.parse(files.get('data/figures.json'));
  assert.equal(figure.visibility, 'private');
  assert.equal(figure.published, false);
  assert(!files.has('reports/import_report.json'));
  assert(!files.has('.nojekyll'));
  await assert.rejects(collectSite({ release: directory, approvals }), /Private record/);
  assert.doesNotMatch(String((await collectSite()).get('index.html')), /data-local-review/);
  await writeFile(join(directory, 'data/metrics.json'), '[]');
  await assert.rejects(collectLocalReview(options), /modified artifact/);
});

test('temporal selectors preserve provenance, count only confirmed activity and keep multicaso atomic', () => {
  const { experiments } = example();
  const [confirmed, inferred] = experiments;
  const noDate = { id: 'exp-missing', updatedAt: '2026-11-14', importedAt: '2026-11-15' };
  assert.equal(runTime(noDate).executedAt, null);
  assert.equal(runTime({ id: 'fallback', runId: 'mlp_20261113_123456' }).timezone, null);
  assert.equal(runTime({ id: 'invalid', runId: 'mlp_20260230_123456' }).executedAt, null);
  assert(!validTimestamp('2026-02-28T25:00:00'));
  assert(validTimestamp('2024-02-29T23:59:00'));
  assert.deepEqual([noDate, inferred, confirmed].sort(byRunTime), [confirmed, inferred, noDate]);
  assert.deepEqual(runsOverTime([confirmed, inferred, noDate], 'day'), { periods: [['2026-11-13', 1]], pending: 2 });
  assert.deepEqual(runsOverTime([confirmed], 'week').periods, [['2026-11-09', 1]]);
  const filter = { family: 'MLP', from: '2026-11-01', time: 'confirmed' };
  assert.deepEqual(catalogFilters(catalogURL(filter)), filter);
  assert(matchesRun(confirmed, filter));
  assert(!matchesRun(inferred, filter));
  const multi = { ...confirmed, reynolds: [36000, 20000, 28000] };
  assert.equal(reynoldsGroup(multi), '20000,28000,36000');
  assert(!matchesRun(multi, { re: '36000' }));
});

test('public build removes incomplete runs and dependent measurements, comparisons, figures and events', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pinn-identification-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = example();
  const legacy = { ...data.experiments[0], id: 'exp-generic', caseId: null, reynolds: null, seed: null, metrics: ['metric-generic'] };
  data.experiments.push(legacy);
  data.metrics.push({ ...data.metrics[0], id: 'metric-generic', experimentId: legacy.id });
  const pair = data.comparisons[1];
  const images = data.comparisons[0].figures.splice(0);
  pair.figures = images.map(image => ({ ...image, comparisonId: pair.id }));
  pair.experimentIds = [legacy.id, 'exp-mlp'];
  pair.conditions = [];
  data.timeline.push({ ...data.timeline[0], id: 'evt-generic', experimentIds: [legacy.id], comparisonIds: [pair.id] });
  const files = await collectSite(await createRelease(directory, data));
  for (const name of ['experiments', 'metrics', 'timeline']) assert(!String(files.get(`data/${name}.json`)).includes('generic'));
  assert(!String(files.get('data/comparisons.json')).includes(pair.id));
  assert(!files.has(images[0].path));
  assert.equal(JSON.parse(files.get('data/overview.json')).selectionCount, 2);
});
