import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const provenance = { id: 'src-test', kind: 'fixture', sha256: 'a'.repeat(64) };
const common = { visibility: 'public', evidenceStatus: 'verified', sources: [] };
const phaseId = 'bfs-physics-informed-learning';
const pairId = 'cmp-sst-20261113-212942';
const picture = {
  id: 'figure-example', path: 'figures/phase_02/example.png', comparisonId: pairId, experimentId: null,
  caption: { pt: 'Figura de teste', en: 'Test figure' }, alt: { pt: 'Pixel de teste', en: 'Test pixel' },
  field: 'velocity_u', evaluationSet: 'test', unit: 'm/s', source: provenance, published: true,
};
const metric = (owner, value) => ({
  ...common, id: `metric-${owner}`, experimentId: owner, name: 'rmse_uv_corrected',
  value, unit: 'm/s', referenceType: 'fine_rans', calculationMethod: 'pointwise_field_error',
  evaluationSet: 'test', definition: 'Vector RMSE fixture', lowerIsBetter: true, source: provenance,
  operatorParameters: {}, pointCount: 4,
  validityMask: { evaluationFingerprint: 'same', fingerprint: 'all', validCount: 4, validFraction: 1 },
});
const run = (id, model) => ({
  ...common, id, runId: id, model, phaseId, type: 'baseline', date: '2026-11-13', modelFamily: model, reynolds: [5100], seed: 42,
  splitId: 'split-example', splitVersion: 'v2', caseId: 'case-example', dataset: 'synthetic.parquet',
  datasetHash: 'same', normalization: 'dataset_native', turbulenceModel: 'k_sst', referenceType: 'fine_rans', presentationStatus: 'featured',
  temporal: id === 'exp-mlp' ? {
    executedAt: '2026-11-13T08:13:00-03:00', executedAtConfidence: 'confirmed', executedAtSource: 'run_metadata', sourceRef: provenance,
  } : {
    executedAt: '2026-11-13T08:22:00', executedAtConfidence: 'inferred', executedAtSource: 'run_name', timezone: null,
  },
  metrics: [`metric-${id}`], figures: [], trainingBudget: { supervisedFraction: null },
});
const condition = {
  metric: 'rmse_uv_corrected', scope: 'test', status: 'descriptive_only', measurementCompatible: true,
  operator: 'pointwise_field_error', metricIds: ['metric-exp-mlp', 'metric-exp-pinn'], unit: 'm/s',
  reasons: ['physics_budget_differs'],
};
const pair = {
  ...common, id: pairId, phaseId, experimentIds: ['exp-mlp', 'exp-pinn'], status: 'descriptive_only',
  limitations: ['physics_budget_differs'], conditions: [condition], figures: [picture], manifestSource: provenance,
};
export function example() {
  return structuredClone({
    experiments: [run('exp-mlp', 'MLP'), run('exp-pinn', 'PINN-cont')],
    comparisons: [pair, { ...pair, id: 'cmp-blocked', status: 'blocked', figures: [], conditions: [
      { ...condition, status: 'blocked', measurementCompatible: false, reasons: ['unit_unverified'] },
    ] }],
    metrics: [metric('exp-mlp', 0.21), metric('exp-pinn', 0.18)],
    timeline: [
      { ...common, id: 'evt-example', phaseId, date: '2026-11-13', category: 'experiment', curationGroupId: 'baseline-sst',
        title: { pt: 'Evento de teste', en: 'Test milestone' }, summary: { pt: 'Evidência sintética para QA', en: 'Synthetic QA evidence' },
        experimentIds: ['exp-mlp', 'exp-pinn'], comparisonIds: [pairId], decisionIds: ['DEC-05'], hypothesisIds: ['H01'] },
      { ...common, id: 'evt-undated', date: null, period: 'Período a confirmar', evidenceStatus: 'planned',
        category: 'methodology', title: { pt: 'Evento planejado', en: 'Planned milestone' },
        summary: { pt: 'Plano de teste', en: 'Test plan' } },
    ],
  });
}
export async function createRelease(directory, data = example()) {
  const approvals = {};
  const entries = Object.entries(data).map(([name, records]) => [`data/${name}.json`, Buffer.from(JSON.stringify(records))]);
  entries.push([picture.path, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhYsAAAAASUVORK5CYII=', 'base64')]);
  for (const [key, bytes] of entries) {
    const path = join(directory, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    approvals[key] = createHash('sha256').update(bytes).digest('hex');
  }
  return { release: directory, approvals };
}
