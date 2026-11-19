export const collections = ['experiments', 'comparisons', 'metrics', 'timeline', 'figures', 'literature'];
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

const schemas = {
  experiments: (value, visibility) => optional(value.phaseId, id) && optional(value.runId, id)
    && optional(value.modelFamily ?? value.model, text) && optional(value.reynolds, values => list(values, positive))
    && optional(value.seed, seed => Number.isInteger(seed) && seed >= 0)
    && optional(value.splitId, id) && optional(value.date, date)
    && ids(value.metrics) && list(value.figures ?? [], image => figure(image, visibility))
    && optional(value.limitations, values => list(values, text)) && optional(value.trainingBudget, object),
  comparisons: (value, visibility) => ids(value.experimentIds) && value.experimentIds.length >= 2
    && enumOf(comparisonStates, value.status) && list(value.figures ?? [], image => figure(image, visibility))
    && list(value.conditions, condition => object(condition) && enumOf(comparisonStates, condition.status)
      && enumOf(scopes, condition.scope) && id(condition.metric) && ids(condition.metricIds)
      && typeof condition.measurementCompatible === 'boolean' && list(condition.reasons, text)),
  metrics: value => id(value.experimentId) && id(value.name) && (value.value === null || Number.isFinite(value.value))
    && optional(value.unit, text) && text(value.definition)
    && optional(value.evaluationSet, scope => enumOf(scopes, scope))
    && optional(value.calculationMethod, text) && optional(value.referenceType, text)
    && optional(value.operatorParameters, object) && optional(value.pointCount, positive)
    && optional(value.validityMask, object)
    && (value.lowerIsBetter === null || typeof value.lowerIsBetter === 'boolean') && provenance(value.source),
  timeline: value => optional(value.date, date) && (date(value.date) || text(value.period))
    && optional(value.phaseId, id)
    && enumOf(['methodology', 'experiment', 'validation', 'publication', 'decision'], value.category)
    && localized(value.title) && localized(value.summary) && ids(value.experimentIds ?? []) && ids(value.comparisonIds ?? [])
    && ids(value.decisionIds ?? []) && ids(value.hypothesisIds ?? []),
  figures: figure,
  literature: value => localized(value.title) && optional(value.url, external)
    && ids(value.experimentIds ?? []) && ids(value.hypothesisIds ?? []),
};

export function validateCollection(name, values, { localReview = false } = {}) {
  const visibility = localReview && name !== 'literature' ? 'private' : 'public';
  if (!Object.hasOwn(schemas, name) || !list(values, value => object(value) && id(value.id)
    && value.visibility === visibility && enumOf(evidence, value.evidenceStatus) && optional(value.updatedAt, date)
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
  const caseFields = ['phaseId', 'caseId', 'reynolds', 'turbulenceModel', 'datasetHash', 'normalization'];
  if (caseFields.some(key => runs.some(run => run[key] == null) || !equal(runs.map(run => run[key])))
    || (condition.scope === 'test' && (runs.some(run => !run.splitVersion)
      || ['splitId', 'splitHash', 'splitVersion'].some(key => !equal(runs.map(run => run[key])))))
    || records.some(metric => !positive(metric.pointCount) || !text(metric.validityMask?.fingerprint)
      || !text(metric.validityMask?.evaluationFingerprint))
    || !equal(records.map(metric => metric.operatorParameters)) || !equal(records.map(metric => metric.pointCount))
    || !equal(records.map(metric => metric.validityMask?.fingerprint))
    || !equal(records.map(metric => metric.validityMask?.evaluationFingerprint))) return null;
  const direction = records[0].lowerIsBetter;
  const ranked = records.every(metric => typeof direction === 'boolean' && metric.lowerIsBetter === direction);
  const best = ranked ? (direction ? Math.min : Math.max)(...records.map(metric => metric.value)) : null;
  const winners = new Set(best === null ? [] : records.filter(metric => metric.value === best).map(metric => metric.id));
  return { records, winners, tied: winners.size > 1, descriptive: pair.status === 'descriptive_only' || condition.status === 'descriptive_only' };
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
  for (const metric of metrics.values()) {
    if (!runs.get(metric.experimentId)?.metrics.includes(metric.id)) throw new Error(`Unlinked metric: ${metric.id}`);
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
  for (const image of data.figures) {
    check(image.experimentId ? [image.experimentId] : [image.comparisonId], image.experimentId ? runs : pairs, image.id);
  }
}

export function validateContext(value) {
  const entries = items => list(items, item => object(item) && id(item.id) && localized(item.title))
    && ids(items.map(item => item.id));
  if (!object(value) || !entries(value.phases) || !entries(value.hypotheses) || !entries(value.decisions)
    || !entries(value.groups) || !optional(value.baselineComparisonId, id)) throw new Error('Invalid editorial index');
  return value;
}

export function validateOverview(value) {
  validateContext(value);
  if (!list(value.recent, event => object(event) && id(event.id) && date(event.date) && localized(event.title))
    || !value.groups.every(group => ids(group.eventIds) && group.eventIds.length > 0)
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
