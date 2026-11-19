import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { approvedFigures, figurePath, index, measureComparison, validateCollection } from '../assets/js/science/contracts.mjs';
import { routeFor } from '../assets/js/science/portal.mjs';
import { collectLocalReview, collectSite } from '../scripts/build_site.mjs';
import { createRelease, example } from './fixtures/science.mjs';

const compare = value => {
  const [pair] = value.comparisons;
  return measureComparison(pair, pair.conditions[0], index(value.metrics), index(value.experiments));
};

test('descriptive comparison certifies only matching measurements and handles ties', () => {
  const data = example();
  const first = compare(data);
  assert(first.descriptive);
  assert.deepEqual([...first.winners], ['metric-exp-pinn']);
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
  assert.equal(routeFor('#priorities').section, 'priorities');
  assert.equal(routeFor('#%E0%A4').section, 'overview');
});

test('empty static package ships editorial data and empty catalogs only', async () => {
  const files = await collectSite();
  for (const key of ['experiments', 'timeline', 'metrics', 'comparisons', 'figures', 'literature']) {
    assert.deepEqual(JSON.parse(files.get(`data/${key}.json`)), []);
  }
  assert(files.has('data/updates.json'));
  assert(![...files.keys()].some(key => /(?:staging|\.experiment-import|\.parquet|reports|\.md$)/.test(key)));
});

test('restricted package verifies importer hashes, cross references and images', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pinn-build-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const release = await createRelease(directory);
  const files = await collectSite(release);
  const overview = JSON.parse(files.get('data/overview.json'));
  assert.equal(overview.groups.length, 1);
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
