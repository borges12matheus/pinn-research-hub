import { runTimestamp, timeLabel } from './analytics.mjs';
import { runTime } from './catalog-data.mjs';
import { index, measureComparison } from './contracts.mjs';
import { copy, label } from './copy.mjs';
import { anchor, badge, blank, definitions, filters, fragment, node, number, options, select, table, titleOf, valueOf } from './dom.mjs';
import { modelOf, runName, words } from './presentation.mjs';

export const metricName = (metric, locale) => titleOf(metric.title ?? label(metric.name, locale), locale);

export function audit(title, content) {
  const details = node('details', null, 'technical-details');
  details.append(node('summary', title), content);
  return details;
}

function metricEvidence(metric, locale, evaluation) {
  const ui = copy(locale);
  const title = words(locale, 'Detalhes da medida', 'Measurement details');
  const trigger = node('button', title, 'quiet-button');
  trigger.type = 'button';
  trigger.addEventListener('click', () => {
    const dialog = node('dialog', null, 'figure-dialog audit-dialog');
    dialog.setAttribute('aria-label', title);
    const close = node('button', ui.close);
    const clipboard = node('button', words(locale, 'Copiar referência técnica', 'Copy technical reference'));
    const reference = [metric.id, metric.experimentId, metric.evaluationId, metric.trainingId, metric.source.id, metric.source.sha256].filter(Boolean).join('\n');
    const status = node('p');
    status.setAttribute('role', 'status');
    close.onclick = () => dialog.close();
    clipboard.onclick = async () => {
      try {
        await navigator.clipboard.writeText(reference);
        status.textContent = words(locale, 'Referência copiada.', 'Reference copied.');
      } catch {
        const manual = node('textarea');
        manual.value = reference;
        manual.readOnly = true;
        manual.setAttribute('aria-label', ui.source);
        status.replaceChildren(manual);
        manual.focus();
        manual.select();
      }
    };
    dialog.append(close, node('h2', metricName(metric, locale)), definitions([
      [ui.definition, titleOf(metric.definition, locale)], [words(locale, 'Fórmula', 'Formula'), metric.formula],
      [ui.scope, metric.evaluationSet], [ui.unit, metric.unit], [ui.reference, metric.referenceType],
      [words(locale, 'Avaliação', 'Evaluation'), evaluation ? timeLabel(evaluation.evaluatedAt, locale) : null],
      [ui.operator, metric.calculationMethod], [ui.parameters, metric.operatorParameters],
      [ui.points, metric.pointCount], [ui.coverage, metric.validityMask],
      [words(locale, 'Nome original', 'Original name'), metric.originalName],
      [words(locale, 'Valor bruto', 'Raw value'), metric.value == null ? null : String(metric.value)],
      [ui.source, [metric.id, metric.experimentId, metric.evaluationId, metric.trainingId, metric.source.id, metric.source.sha256].filter(Boolean)],
    ], locale), clipboard, status);
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); }, { once: true });
    dialog.showModal();
    close.focus();
  });
  const cell = node('div', null, 'metric-evidence');
  cell.append(badge(metric.evidenceStatus, locale), trigger);
  return cell;
}

const categoryOf = metric => metric.category ?? (/divergence|mass|momentum|wall|continuity|residual/.test(metric.name) ? 'physics' : 'accuracy');

function downloadCSV(records, runs, evaluations) {
  const csv = value => {
    const raw = value == null ? '' : String(value);
    return '"' + (typeof value === 'string' && /^\s*[=+\-@\t\r\n]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""') + '"';
  };
  const columns = ['run_id', 'run_start', 'run_time_confidence', 'evaluation_id', 'evaluated_at', 'key', 'value',
    'unit', 'scope', 'reference', 'method', 'evidence', 'source_id'];
  const rows = records.map(metric => {
    const run = runs.get(metric.experimentId);
    const temporal = run ? runTime(run) : {};
    return [metric.experimentId, temporal.executedAt, temporal.executedAtConfidence,
      metric.evaluationId, evaluations.get(metric.evaluationId)?.evaluatedAt, metric.originalName ?? metric.name, metric.value,
      metric.unit, metric.evaluationSet, metric.referenceType, metric.calculationMethod, metric.evidenceStatus, metric.source.id];
  });
  const content = [columns, ...rows].map(row => row.map(csv).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const download = anchor('', url);
  download.download = 'pinn-metrics.csv';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function measurementTable(records, runs, locale, { evaluations = [], pairs = [], matrix = false } = {}) {
  const ui = copy(locale);
  if (!records.length) return blank(ui.noMetric);
  const evaluationIndex = index(evaluations);
  const region = node('div', null, 'metric-explorer');
  const results = node('div');
  const state = {};
  const runFor = metric => runs.get(metric.experimentId) ?? {};
  const names = new Map(records.map(metric => [metric.name, metricName(metric, locale)]));
  const categories = new Map([
    ['accuracy', ui.accuracy], ['physics', ui.physics], ['training', ui.training], ['other', words(locale, 'Outras medidas', 'Other measures')],
  ]);
  const dimensions = [
    [ui.category, metric => [categoryOf(metric)], value => categories.get(value)],
    [ui.model, metric => [modelOf(runFor(metric))]],
    [ui.seed, metric => [runFor(metric).seed]],
    [words(locale, 'Métrica', 'Metric'), metric => [metric.name], value => names.get(value)],
    [ui.scope, metric => [metric.evaluationSet]],
    [ui.reynolds, metric => runFor(metric).reynolds ?? []],
    [ui.evidence, metric => [metric.evidenceStatus]],
    [ui.operator, metric => [metric.calculationMethod]],
  ].map(([title, get, format], i) => ({
    key: i, title, get, values: options(records, get, format ?? (value => valueOf(value, locale))),
  }));
  const search = node('label', words(locale, 'Buscar modelo, métrica ou chave', 'Search by model, metric, or key'), 'select-field');
  const input = Object.assign(node('input'), { type: 'search' });
  search.append(input);
  const periods = [words(locale, 'Executado a partir de', 'Run from'), words(locale, 'Executado até', 'Run through')].map(title => {
    const container = node('label', title, 'select-field');
    const field = Object.assign(node('input'), { type: 'date' });
    field.addEventListener('change', resetPage);
    container.append(field);
    return [container, field];
  });
  let order = 'metric';
  let mode = matrix ? 'matrix' : 'list';
  let page = 0;
  let selected = [];
  const pageSize = 40;
  const sort = select(words(locale, 'Ordenar por', 'Sort by'), order, [
    ['metric', ui.metrics], ['model', ui.model], ['seed', ui.seed], ['value', ui.value],
  ], value => { order = value; resetPage(); });
  const modes = matrix ? select(words(locale, 'Visualização', 'View'), mode, [
    ['matrix', words(locale, 'Matriz por protocolo', 'Protocol matrix')], ['list', words(locale, 'Lista detalhada', 'Detailed list')],
  ], value => { mode = value; resetPage(); }) : null;
  const sortValue = {
    metric: item => names.get(item.name), model: item => modelOf(runFor(item)),
    seed: item => runFor(item).seed, value: item => item.value,
  };
  const searchIndex = new Map(records.map(metric => [metric.id, [runName(runFor(metric), locale), names.get(metric.name),
    metric.originalName, metric.name].filter(Boolean).join(' ').toLocaleLowerCase(locale)]));

  function drawMatrix() {
    const all = index(records);
    const visible = new Set(selected.map(metric => metric.id));
    const panels = [];
    for (const pair of pairs.filter(item => item.status === 'compatible')) {
      const conditions = pair.conditions.map(condition => [condition, measureComparison(pair, condition, all, runs)])
        .filter(([, measured]) => measured && !measured.descriptive && measured.records.every(metric => visible.has(metric.id)));
      const groups = new Map();
      for (const [condition, measured] of conditions) {
        const m = measured.records[0];
        const key = JSON.stringify([condition.scope, condition.operator, m.referenceType, m.operatorParameters,
          m.pointCount, m.validityMask?.fingerprint, m.validityMask?.evaluationFingerprint, m.source.kind]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push([condition, measured]);
      }
      for (const columns of groups.values()) {
        const [first] = columns[0];
        const title = [valueOf(first.scope, locale), valueOf(first.operator, locale),
          valueOf(columns[0][1].records[0].referenceType, locale)].join(' · ');
        panels.push(node('h4', title), table([
          ui.model, ui.seed, words(locale, 'Data e hora de início', 'Start date and time'),
          ...columns.map(([condition, measured]) => `${metricName(measured.records[0], locale)} · ${condition.unit} · ${valueOf(condition.scope, locale)}`),
        ], pair.experimentIds.map(id => {
          const run = runs.get(id);
          return [anchor(runName(run, locale), fragment('run', id)), valueOf(run.seed, locale), runTimestamp(run, locale),
            ...columns.map(([, measured]) => number(measured.records.find(metric => metric.experimentId === id)?.value, locale))];
        }), title));
      }
    }
    if (panels.length) { results.replaceChildren(...panels); return; }
    renderList(words(locale, 'A matriz exige medidas do mesmo protocolo. Medições individuais disponíveis abaixo.',
      'The matrix requires measurements under the same protocol. Individual measurements are available below.'));
  }

  function renderList(explanation) {
    const slice = selected.slice(page * pageSize, (page + 1) * pageSize);
    results.replaceChildren();
    if (explanation) results.append(node('p', explanation, 'metadata'));
    for (const [key, caption] of categories) {
      const inGroup = slice.filter(metric => categoryOf(metric) === key);
      if (!inGroup.length) continue;
      results.append(node('h4', caption), table([
        ui.model, ui.seed, words(locale, 'Métrica', 'Metric'), ui.value, ui.unit, ui.scope, ui.reference, ui.operator,
        words(locale, 'Avaliação', 'Evaluation'), ui.evidence,
      ], inGroup.map(metric => {
        const evaluation = evaluationIndex.get(metric.evaluationId);
        const protocol = metric.category === 'training' ? ui.training : evaluation?.evaluatedAt
          ? timeLabel(evaluation.evaluatedAt, locale)
          : words(locale, 'Data não informada', 'Date unreported');
        return [
          valueOf(modelOf(runFor(metric)), locale), valueOf(runFor(metric).seed, locale), metricName(metric, locale),
          number(metric.value, locale), valueOf(metric.unit, locale), valueOf(metric.evaluationSet, locale),
          valueOf(metric.referenceType, locale), valueOf(metric.calculationMethod, locale),
          protocol, metricEvidence(metric, locale, evaluation),
        ];
      }), caption));
    }
    pager.hidden = selected.length <= pageSize;
    current.textContent = `${Math.min(page * pageSize + 1, selected.length)}–${Math.min((page + 1) * pageSize, selected.length)} / ${selected.length}`;
    previous.disabled = page === 0;
    next.disabled = (page + 1) * pageSize >= selected.length;
  }

  const previous = node('button', words(locale, 'Anterior', 'Previous'));
  const next = node('button', words(locale, 'Próxima', 'Next'));
  const current = node('span');
  current.setAttribute('role', 'status');
  const pager = node('div', null, 'metric-pagination');
  pager.append(previous, current, next);
  previous.onclick = () => { page--; draw(); if (previous.disabled) next.focus(); };
  next.onclick = () => { page++; draw(); if (next.disabled) previous.focus(); };
  const exportButton = records.every(record => record.visibility === 'public') ? node('button', 'CSV') : null;
  if (exportButton) {
    exportButton.setAttribute('aria-label', words(locale, 'Exportar medições públicas filtradas em CSV', 'Export filtered public measurements as CSV'));
    exportButton.onclick = () => { if (selected.length) downloadCSV(selected, runs, evaluationIndex); };
  }
  function draw() {
    const query = input.value.trim().toLocaleLowerCase(locale);
    const [from, to] = periods.map(([, field]) => field.value);
    selected = records.filter(metric => {
      const day = runTime(runFor(metric)).executedAt?.slice(0, 10);
      return (!from || day && day >= from) && (!to || day && day <= to) && searchIndex.get(metric.id).includes(query)
        && dimensions.every(({ key, get }) => !state[key] || get(metric).some(value => String(value) === state[key]));
    }).sort((a, b) => {
      const [left, right] = [sortValue[order](a), sortValue[order](b)];
      if (left == null || right == null) return Number(left == null) - Number(right == null);
      return typeof left === 'number' ? left - right : String(left).localeCompare(String(right), locale);
    });
    pager.hidden = true;
    if (exportButton) exportButton.disabled = !selected.length;
    if (!selected.length) results.replaceChildren(blank(ui.noMatch));
    else if (mode === 'matrix') drawMatrix();
    else renderList();
  }
  function resetPage() { page = 0; draw(); }
  input.addEventListener('input', resetPage);
  const controls = filters(dimensions, state, resetPage, locale, () => {
    input.value = '';
    order = 'metric';
    sort.querySelector('select').value = order;
    for (const [, field] of periods) field.value = '';
  });
  controls.prepend(search, sort, ...periods.map(([container]) => container));
  if (exportButton) controls.append(exportButton);
  const disclosure = node('details', null, 'catalog-controls');
  disclosure.open = !matchMedia('(max-width: 42rem)').matches;
  disclosure.append(node('summary', words(locale, 'Filtros das medições', 'Measurement filters')), controls);
  region.append(...(modes ? [modes] : []), disclosure, results, pager);
  draw();
  return region;
}
