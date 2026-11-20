/** @typedef {'confirmed' | 'inferred' | 'unknown'} Confidence */
/** @typedef {'run_metadata' | 'log' | 'manifest' | 'run_name' | 'unknown'} TimeSource */
/** @typedef {{executedAt: string | null, executedAtConfidence: Confidence, executedAtSource: TimeSource, timezone?: string | null}} Temporal */
/** @typedef {{id: string, phaseId?: string | null, runId?: string | null, modelFamily?: string | null,
  model?: string | null, reynolds?: number[] | null, turbulenceModel?: string | null, seed?: number | null,
  curationStatus?: string, presentationStatus?: string, visibility?: string, temporal?: Temporal | null,
  metrics?: string[]}} Run */
/** @typedef {{phase?: string, family?: string, re?: string, turbulence?: string, curation?: string,
  from?: string, to?: string, investigation?: string, seed?: string, measures?: string, time?: string}} RunFilters */

const TIME = /^(\d{4}-\d\d-\d\d)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;
const offset = /(?:Z|[+-]\d\d:\d\d)$/;
export const missing = '~unknown';
export const filterKeys = /** @type {const} */ (['phase', 'family', 're', 'turbulence', 'curation', 'from', 'to', 'investigation', 'seed', 'measures', 'time']);

/** @param {unknown} value @returns {value is string} */
export function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = TIME.exec(value);
  if (!match || match[1].startsWith('0000-')) return false;
  const day = new Date(match[1]);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === match[1];
}

/** @param {Run} run @returns {Temporal} */
export function runTime(run) {
  if (run.temporal) return run.temporal;
  const suffix = /_(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)$/.exec(run.runId ?? '');
  const inferred = suffix ? `${suffix[1]}-${suffix[2]}-${suffix[3]}T${suffix[4]}:${suffix[5]}:${suffix[6]}` : null;
  if (validTimestamp(inferred)) return { executedAt: inferred, executedAtConfidence: 'inferred', executedAtSource: 'run_name', timezone: null };
  return { executedAt: null, executedAtConfidence: 'unknown', executedAtSource: 'unknown', timezone: null };
}

/** @param {Run} run */
export function runFamily(run) {
  return run.modelFamily ?? run.model ?? missing;
}

/** @param {Run} run */
export function reynoldsGroup(run) {
  return [...new Set(run.reynolds ?? [])].sort((a, b) => a - b).join(',') || missing;
}

/** @param {Run} run */
export function runCuration(run) {
  if (['excluded', 'archived', 'pending_review'].includes(run.curationStatus ?? '')) return run.curationStatus;
  if (run.presentationStatus === 'excluded') return 'excluded';
  if (run.presentationStatus === 'historical') return 'archived';
  return run.presentationStatus === 'featured' ? 'featured' : run.visibility === 'public' ? 'supporting'
    : run.curationStatus ?? missing;
}

/** @param {Run} run @param {RunFilters} filter @param {Set<string> | undefined} members */
export function matchesRun(run, filter, members) {
  const temporal = runTime(run);
  const day = temporal.executedAt?.slice(0, 10);
  return (!filter.phase || (run.phaseId ?? missing) === filter.phase)
    && (!filter.family || runFamily(run) === filter.family)
    && (!filter.re || reynoldsGroup(run) === filter.re)
    && (!filter.time || temporal.executedAtConfidence === filter.time)
    && (!filter.turbulence || (run.turbulenceModel ?? missing) === filter.turbulence)
    && (!filter.curation || runCuration(run) === filter.curation)
    && (!filter.seed || String(run.seed ?? missing) === filter.seed)
    && (!filter.investigation || members?.has(run.id) === true)
    && (!filter.measures || (run.metrics?.length ? 'with' : 'without') === filter.measures)
    && (!filter.from || Boolean(day && day >= filter.from))
    && (!filter.to || Boolean(day && day <= filter.to));
}

/** @param {Run} a @param {Run} b */
export function byRunTime(a, b) {
  const left = runTime(a);
  const right = runTime(b);
  const rank = { confirmed: 2, inferred: 1, unknown: 0 };
  const difference = rank[right.executedAtConfidence] - rank[left.executedAtConfidence];
  if (difference) return difference;
  const l = left.executedAt ?? '';
  const r = right.executedAt ?? '';
  const known = Number(offset.test(r)) - Number(offset.test(l));
  if (known) return known;
  const order = offset.test(l) ? Date.parse(r) - Date.parse(l) : r.localeCompare(l);
  return order || a.id.localeCompare(b.id);
}

/** @param {Run[]} runs @param {(run: Run) => string} key */
export function countBy(runs, key) {
  /** @type {Map<string, number>} */
  const groups = new Map();
  for (const run of runs) {
    const name = key(run);
    groups.set(name, (groups.get(name) ?? 0) + 1);
  }
  return groups;
}

/** @param {string} day @param {'day' | 'week' | 'month'} interval */
export function periodFor(day, interval) {
  if (interval === 'month') return day.slice(0, 7);
  if (interval === 'week') {
    const date = new Date(day);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0, 10);
  }
  return day;
}

/** @param {Run[]} runs @param {'day' | 'week' | 'month'} interval */
export function runsOverTime(runs, interval) {
  const confirmed = runs.filter(run => run.temporal?.executedAtConfidence === 'confirmed' && run.temporal.executedAt);
  return {
    periods: [...countBy(confirmed, run => periodFor(/** @type {string} */ (run.temporal?.executedAt).slice(0, 10), interval))]
      .sort(([a], [b]) => a.localeCompare(b)),
    pending: runs.length - confirmed.length,
  };
}

/** @param {string} hash @returns {RunFilters} */
export function catalogFilters(hash) {
  const params = new URLSearchParams(hash.split('?')[1]);
  return Object.fromEntries(filterKeys.flatMap(key => params.has(key) ? [[key, params.get(key) ?? '']] : []));
}

/** @param {RunFilters} filters @param {string} path */
export function catalogURL(filters, path = '#/execucoes') {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params.size ? `${path}?${params}` : path;
}
