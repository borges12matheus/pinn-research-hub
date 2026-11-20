import { validTimestamp } from './catalog-data.mjs';

export const collections = ['experiments', 'comparisons', 'metrics', 'timeline', 'figures', 'literature', 'evaluations', 'training'];
const evidence = ['verified', 'preliminary', 'planned', 'unknown'];
const comparisonStates = ['compatible', 'descriptive_only', 'blocked'];
const presentation = ['featured', 'validated', 'historical', 'partial', 'excluded'];
const scopes = ['test', 'full_domain'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
export const id = value => text(value) && /^[A-Za-z0-9][\w.:-]*$/.test(value);
const enumOf = (values, value) => values.includes(value);
const optional = (value, check) => value == null || check(value);
const list = (values, check) => Array.isArray(values) && values.every(check);
const ids = values => list(values, id) && new Set(values).size === values.length;
const positive = value => Number.isInteger(value) && value > 0;
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function external(value) {
  if (!text(value) || /\s|\\/.test(value)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export function figurePath(value) {
  return typeof value === 'string' && /^figures\/(?:[A-Za-z0-9][\w-]*\/)*[A-Za-z0-9][\w.-]*\.(?:png|webp|jpe?g)$/i.test(value);
}

const localized = value => text(value) || (object(value) && text(value.pt) && optional(value.en, text));
const provenance = value => object(value) && id(value.id) && /^[a-f0-9]{64}$/.test(value.sha256);
const figure = (value, visibility) => object(value) && id(value.id) && figurePath(value.path)
  && localized(value.caption) && localized(value.alt) && provenance(value.source)
  && value.published === (visibility === 'public') && optional(value.visibility, state => state === visibility)
  && ((id(value.experimentId) && value.comparisonId == null) || (id(value.comparisonId) && value.experimentId == null))
  && optional(value.evaluationSet, scope => enumOf(scopes, scope));

const timeInfo = value => object(value)
  && optional(value.startedAt, validTimestamp) && optional(value.finishedAt, validTimestamp)
  && optional(value.sourceRef, provenance) && optional(value.timezone, text)
  && (value.executedAtConfidence === 'confirmed'
    ? validTimestamp(value.executedAt) && ['run_metadata', 'log', 'manifest'].includes(value.executedAtSource)
    : value.executedAtConfidence === 'inferred' ? validTimestamp(value.executedAt)
      && value.executedAtSource === 'run_name' && (
        value.timezone === 'UTC' && value.executedAt.endsWith('Z')
        || value.timezone == null && !/(?:Z|[+-]\d\d:\d\d)$/.test(value.executedAt))
      : value.executedAtConfidence === 'unknown' && value.executedAtSource === 'unknown' && value.executedAt === null);

const schemas = {
  experiments: (value, visibility) => optional(value.phaseId, id) && optional(value.runId, id)
    && optional(value.modelFamily ?? value.model, text) && optional(value.reynolds, values => list(values, positive))
    && optional(value.seed, seed => Number.isInteger(seed) && seed >= 0)
    && optional(value.temporal, timeInfo) && optional(value.splitId, id) && optional(value.date, date)
    && ids(value.metrics) && list(value.figures ?? [], image => figure(image, visibility))
    && optional(value.limitations, values => list(values, text)) && optional(value.trainingBudget, object),
  comparisons: (value, visibility) => ids(value.experimentIds) && value.experimentIds.length >= 2
    && enumOf(comparisonStates, value.status) && list(value.figures ?? [], image => figure(image, visibility))
    && list(value.conditions, condition => object(condition) && enumOf(comparisonStates, condition.status)
      && enumOf(scopes, condition.scope) && id(condition.metric) && ids(condition.metricIds)
      && typeof condition.measurementCompatible === 'boolean' && list(condition.reasons, text)),
  metrics: (value, visibility) => (id(value.experimentId) || (visibility === 'private' && value.experimentId === null && id(value.evaluationId)))
    && optional(value.evaluationId, id) && optional(value.trainingId, id) && !(value.evaluationId && value.trainingId)
    && optional(value.category, category => ['accuracy', 'physics', 'training', 'other'].includes(category)) && id(value.name) && (value.value === null || Number.isFinite(value.value))
    && optional(value.unit, text) && text(value.definition)
    && optional(value.evaluationSet, scope => enumOf(scopes, scope))
    && optional(value.calculationMethod, text) && optional(value.referenceType, text)
    && optional(value.operatorParameters, object) && optional(value.pointCount, positive)
    && optional(value.validityMask, object)
    && (value.lowerIsBetter === null || typeof value.lowerIsBetter === 'boolean') && provenance(value.source),
  evaluations: (value, visibility) => (id(value.experimentId) || (value.experimentId === null && visibility === 'private' && value.kind === 'reevaluation'))
    && id(value.phaseId) && ['evaluation', 'reevaluation'].includes(value.kind) && ids(value.metricIds)
    && optional(value.evaluatedAt, validTimestamp) && optional(value.scope, scope => enumOf(scopes, scope))
    && optional(value.operator, text) && value.sourceRefs?.length > 0,
  training: value => id(value.experimentId) && value.sourceRefs?.length > 0 && list(value.points, row =>
    object(row) && text(row.stage) && Number.isInteger(row.epoch) && row.epoch >= 0
    && object(row.values) && Object.values(row.values).every(Number.isFinite)),
  timeline: value => optional(value.date, date) && (date(value.date) || text(value.period))
    && optional(value.phaseId, id)
    && enumOf(['methodology', 'experiment', 'validation', 'publication', 'decision'], value.category)
    && localized(value.title) && localized(value.summary) && ids(value.experimentIds ?? []) && ids(value.comparisonIds ?? [])
    && ids(value.decisionIds ?? []) && ids(value.hypothesisIds ?? []),
  figures: figure,
  literature: value => localized(value.title) && optional(value.url, external)
    && optional(value.authors, authors => list(authors, text) && authors.length > 0)
    && optional(value.year, year => Number.isInteger(year) && year > 0)
    && optional(value.venue, text) && optional(value.doi, text) && optional(value.isbn, text)
    && ids(value.experimentIds ?? []) && ids(value.hypothesisIds ?? []),
};

export function validateCollection(name, values, { localReview = false } = {}) {
  const visibility = localReview && name !== 'literature' ? 'private' : 'public';
  if (!Object.hasOwn(schemas, name) || !list(values, value => object(value) && id(value.id)
    && value.visibility === visibility
    && (visibility === 'private' || !['pending_review', 'excluded'].some(state =>
      [value.curationStatus, value.presentationStatus].includes(state)))
    && enumOf(evidence, value.evidenceStatus) && optional(value.updatedAt, date)
    && optional(value.presentationStatus, status => enumOf(presentation, status))
    && list(value.sources ?? [], external) && list(value.sourceRefs ?? [], provenance) && schemas[name](value, visibility))) {
    throw new Error(`Invalid ${visibility} collection: ${name}`);
  }
  if (!ids(values.map(value => value.id))) throw new Error(`Duplicate IDs in ${name}`);
  return values;
}

export const index = values => new Map(values.map(value => [value.id, value]));

export function measureComparison(pair, condition, metrics, experiments) {
  const records = condition.metricIds.map(key => metrics.get(key));
  const observedIds = new Set(records.map(record => record?.experimentId));
  if (pair.status === 'blocked' || condition.status === 'blocked' || condition.measurementCompatible !== true
    || records.length !== pair.experimentIds.length || observedIds.size !== pair.experimentIds.length
    || !pair.experimentIds.every(key => observedIds.has(key))
    || !records.every(metric => metric && metric.name === condition.metric && metric.evaluationSet === condition.scope
      && Number.isFinite(metric.value) && text(metric.unit) && metric.unit === condition.unit
      && text(metric.referenceType) && text(metric.calculationMethod) && metric.calculationMethod === condition.operator
      && metric.referenceType === records[0].referenceType && metric.definition === records[0].definition)) {
    return null;
  }
  // Imported conditions certify evaluator identity and masks. Also reject contradictions in the supplied metadata.
  const runs = pair.experimentIds.map(key => experiments.get(key));
  if (runs.some(run => !run || run.referenceType !== records[0].referenceType)) return null;
  const equal = values => new Set(values.filter(value => value != null).map(value => JSON.stringify(canonical(value)))).size <= 1;
  if (records[0].referenceType !== 'fine_rans') return null;
  const operatorParam = {
    local_least_squares_kdtree: 'neighbors',
    etl_grid_differences_plus_autograd: 'edgeOrder',
  }[condition.operator];
  const masks = records.map(metric => metric.validityMask);
  const caseFields = ['phaseId', 'caseId', 'reynolds', 'turbulenceModel', 'datasetHash', 'normalization'];
  if (caseFields.some(key => runs.some(run => run[key] == null) || !equal(runs.map(run => run[key])))
    || (condition.scope === 'test' && (runs.some(run => !run.splitVersion)
      || ['splitId', 'splitHash', 'splitVersion'].some(key => !equal(runs.map(run => run[key])))))
    || records.some(metric => !positive(metric.pointCount) || !object(metric.operatorParameters)
      || (operatorParam && !positive(metric.operatorParameters[operatorParam])))
    || masks.some(mask => !text(mask?.fingerprint) || !text(mask?.evaluationFingerprint)
      || !text(mask?.policy) || !positive(mask?.validCount))
    || !equal(records.map(metric => metric.operatorParameters)) || !equal(records.map(metric => metric.pointCount))
    || ['fingerprint', 'evaluationFingerprint', 'policy', 'validCount'].some(key => !equal(masks.map(mask => mask[key])))) return null;
  if (condition.status === 'compatible') {
    const budgets = runs.map(run => run.trainingBudget ?? {});
    const documentedAndEqual = values => values.every(value => value != null
      && (!object(value) || Object.values(value).every(field => field != null))) && equal(values);
    const controls = ['seed', 'features', 'targets', 'architecture'];
    const budgetControls = ['supervisedFraction', 'supervisedEpochLimit', 'batchSize', 'learningRate',
      'weightDecay', 'earlyStoppingPatience', 'schedulerPatience', 'schedulerFactor'];
    if (controls.some(key => !documentedAndEqual(runs.map(run => run[key])))
      || budgetControls.some(key => !documentedAndEqual(budgets.map(budget => budget[key])))
      || budgets.some(budget => budget.supervisedFraction > 0 && budget.supervisedFraction < 1)
      || ['physicsEpochLimit', 'lossWeights'].some(key => !equal(budgets.map(budget => budget[key] ?? null))
        || budgets.some(budget => budget[key] != null) && budgets.some(budget => budget[key] == null))) return null;
  }
  const direction = records[0].lowerIsBetter;
  const descriptive = pair.status === 'descriptive_only' || condition.status === 'descriptive_only';
  const ranked = !descriptive && records.every(metric => typeof direction === 'boolean' && metric.lowerIsBetter === direction);
  const best = ranked ? (direction ? Math.min : Math.max)(...records.map(metric => metric.value)) : null;
  const winners = new Set(best === null ? [] : records.filter(metric => metric.value === best).map(metric => metric.id));
  return { records, winners, tied: winners.size > 1, descriptive };
}

export function validateReferences(data, context) {
  const runs = index(data.experiments);
  const pairs = index(data.comparisons);
  const metrics = index(data.metrics);
  const events = index(data.timeline);
  const hypotheses = index(context.hypotheses);
  const decisions = index(context.decisions);
  const check = (values, target, owner) => {
    for (const key of values ?? []) if (!target.has(key)) throw new Error(`Unresolved reference: ${owner} → ${key}`);
  };
  for (const run of runs.values()) {
    check(run.metrics, metrics, run.id);
    if (run.metrics.some(key => metrics.get(key).experimentId !== run.id)) throw new Error(`Invalid metric owner: ${run.id}`);
  }
  const evaluations = index(data.evaluations ?? []);
  const history = index(data.training ?? []);
  for (const evaluation of evaluations.values()) {
    if (evaluation.experimentId && runs.get(evaluation.experimentId)?.phaseId !== evaluation.phaseId) {
      throw new Error(`Invalid evaluation owner: ${evaluation.id}`);
    }
    if (!evaluation.metricIds.length) throw new Error(`Empty evaluation: ${evaluation.id}`);
    for (const key of evaluation.metricIds) {
      const metric = metrics.get(key);
      if (!metric || metric.evaluationId !== evaluation.id || metric.experimentId !== evaluation.experimentId
        || metric.evaluationSet !== evaluation.scope || metric.calculationMethod !== evaluation.operator
        || !evaluation.sourceRefs.some(ref => ref.id === metric.source.id && ref.sha256 === metric.source.sha256)) {
        throw new Error(`Invalid evaluation metric: ${key}`);
      }
    }
  }
  for (const training of history.values()) check([training.experimentId], runs, training.id);
  for (const metric of metrics.values()) {
    if (metric.evaluationId && !evaluations.get(metric.evaluationId)?.metricIds.includes(metric.id)
      || metric.experimentId !== null && !runs.get(metric.experimentId)?.metrics.includes(metric.id)
      || metric.trainingId && history.get(metric.trainingId)?.experimentId !== metric.experimentId) {
      throw new Error(`Unlinked metric: ${metric.id}`);
    }
  }
  for (const pair of pairs.values()) {
    check(pair.experimentIds, runs, pair.id);
    for (const condition of pair.conditions) {
      check(condition.metricIds, metrics, pair.id);
      for (const key of condition.metricIds) {
        const metric = metrics.get(key);
        if (!pair.experimentIds.includes(metric.experimentId) || metric.name !== condition.metric
          || metric.evaluationSet !== condition.scope) throw new Error(`Invalid comparison metric: ${key}`);
      }
      if (condition.status !== 'blocked' && !measureComparison(pair, condition, metrics, runs)) {
        throw new Error(`Inconsistent comparability: ${pair.id}`);
      }
    }
  }
  for (const value of [...events.values(), ...data.literature, ...data.roadmap, ...data.priorities, ...data.publications]) {
    check(value.experimentIds, runs, value.id);
    check(value.comparisonIds, pairs, value.id);
    check(value.eventIds, events, value.id);
    check(value.hypothesisIds, hypotheses, value.id);
    check(value.decisionIds, decisions, value.id);
  }
  const milestones = index(data.roadmap);
  for (const priority of data.priorities) check(priority.roadmapId ? [priority.roadmapId] : [], milestones, priority.id);
  for (const image of data.figures) {
    check(image.experimentId ? [image.experimentId] : [image.comparisonId], image.experimentId ? runs : pairs, image.id);
  }
}

export function validateContext(value) {
  const entries = items => list(items, item => object(item) && id(item.id) && localized(item.title))
    && ids(items.map(item => item.id));
  if (!object(value) || !entries(value.phases) || !entries(value.hypotheses) || !entries(value.decisions)
    || !entries(value.groups) || !value.groups.every(group => optional(group.eventId, id) && optional(group.question, localized) && optional(group.readingNote, localized)) || !optional(value.baselineComparisonId, id) || !optional(value.featuredFigureId, id)) throw new Error('Invalid editorial index');
  return value;
}

export function validateOverview(value) {
  validateContext(value);
  if (!list(value.recent, event => object(event) && id(event.id) && date(event.date) && localized(event.title))
    || !value.groups.every(group => ids(group.eventIds) && group.eventIds.length > 0
      && ids(group.comparisonIds) && ids(group.experimentIds))
    || !optional(value.trainingRunIds, ids)
    || !optional(value.eligibleGroups, items => list(items, ids))
    || !optional(value.evaluationCounts, counts => object(counts) && Object.entries(counts).every(([key, n]) => id(key) && Number.isInteger(n) && n >= 0))
    || !optional(value.manuscript, entry => object(entry) && text(entry.title) && localized(entry.status))
    || !optional(value.visual, visual => object(visual) && id(visual.id)
      && ['comparison', 'figure'].includes(visual.type))
    || !optional(value.experimentalDate, date)
    || !optional(value.baseline, baseline => object(baseline) && id(baseline.comparisonId)
      && ids(baseline.experimentIds) && list(baseline.models, text)
      && baseline.models.length === baseline.experimentIds.length && enumOf(evidence, baseline.evidenceStatus))) {
    throw new Error('Invalid scientific overview');
  }
  return value;
}

export function approvedFigures(runs, pairs, standalone = [], { localReview = false } = {}) {
  const visibility = localReview ? 'private' : 'public';
  const found = new Map();
  for (const [owner, name] of [[runs, 'experimentId'], [pairs, 'comparisonId']]) {
    for (const record of owner) {
      for (const image of record.figures ?? []) {
        if (image[name] !== record.id) throw new Error(`Invalid figure owner: ${image.id}`);
        merge(image);
      }
    }
  }
  for (const image of standalone) merge(image);
  function merge(image) {
    if (!figure(image, visibility)) throw new Error(`Invalid ${visibility} figure: ${image.id}`);
    const normalized = { ...image, visibility, evidenceStatus: image.evidenceStatus ?? 'verified' };
    const previous = found.get(image.id);
    if (previous && JSON.stringify(canonical(previous)) !== JSON.stringify(canonical(normalized))) {
      throw new Error(`Conflicting figure ID: ${image.id}`);
    }
    found.set(image.id, normalized);
  }
  return [...found.values()];
}
