import { index, measureComparison } from './contracts.mjs';
import { copy, label, reason, translated } from './copy.mjs';
import {
  anchor, badge, blank, definitions, fraction, fragment, linked, node, number, outside,
  runTitle, select, table, titleOf, valueOf,
} from './dom.mjs';

import { audit, measurementTable } from './measurements.mjs';
import { pairName, phaseOf, runName, words } from './presentation.mjs';

import { catalogToolbar, filteredRuns, reynoldsLabel, runTimestamp, timeLabel } from './analytics.mjs';
import { figureCard } from './research.mjs';
import { byRunTime, catalogURL, reynoldsGroup, runCuration, runFamily, runTime } from './catalog-data.mjs';

export function renderCatalog(region, data, context, market, locale, loadTraining) {
  const ui = copy(locale);
  const records = data.experiments;
  const state = market.catalog;
  const run = records.find(item => item.id === market.runId);
  if (run) {
    const navigation = node('div', null, 'reference-list');
    navigation.append(anchor(ui.experiments, catalogURL(state)));
    for (const group of context.groups.filter(item => item.experimentIds.includes(run.id))) {
      navigation.append(anchor(titleOf(group.title, locale), fragment('group', group.id)));
    }
    region.replaceChildren(navigation, runDetails(run, data, context, locale, loadTraining));
    return;
  }
  if (!records.length) {
    region.replaceChildren(blank(ui.emptyExperiments));
    return;
  }
  const listing = node('div', null, 'run-list');
  const status = node('p', null, 'metadata');
  status.setAttribute('role', 'status');
  let order = 'timestamp';
  const orderBy = {
    timestamp: byRunTime,
    model: (a, b) => runFamily(a).localeCompare(runFamily(b), locale) || byRunTime(a, b),
    seed: (a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || byRunTime(a, b),
  };
  function draw(persist = false) {
    if (persist) history.replaceState(null, '', catalogURL(state));
    const visible = filteredRuns(records, state, context).sort(orderBy[order]);
    const view = words(locale, 'Execuções no catálogo', 'Runs in catalog');
    status.textContent = `${view} · ${visible.length} / ${records.length}`;
    if (!visible.length) {
      listing.replaceChildren(blank(ui.noMatch));
      return;
    }
    const headers = [words(locale, 'Execução', 'Run'), words(locale, 'Data e hora de início', 'Start date and time'),
      ui.model, `${ui.case} / Re`, ui.seed, words(locale, 'Avaliações', 'Evaluations'), ui.curation];
    listing.replaceChildren(table(headers, visible.map(run => {
      const detail = catalogURL(state, fragment('run', run.id));
      const metadata = node('div');
      metadata.append(valueOf(run.caseId, locale), node('small', reynoldsLabel(reynoldsGroup(run), locale)));
      return [anchor(runName(run, locale), detail), runTimestamp(run, locale), valueOf(runFamily(run), locale), metadata,
        valueOf(run.seed, locale), number(context.evaluationCounts?.[run.id] ?? 0, locale), badge(runCuration(run), locale)];
    }), view));
  }
  const sorting = select(words(locale, 'Ordenar execuções', 'Sort runs'), order, [
    ['timestamp', words(locale, 'Data e confiança', 'Date and confidence')], ['model', ui.model], ['seed', ui.seed],
  ], value => { order = value; draw(); });
  const reevaluations = context.reevaluationCounts ?? {};
  const nav = node('div', null, 'reference-list');
  nav.append(anchor(ui.results, '#/resultados'));
  if (reevaluations.linked || reevaluations.pending) nav.append(anchor(
    `${ui.reevaluations} · ${reevaluations.linked + reevaluations.pending}`, '#/reavaliacoes'));
  region.replaceChildren(nav, catalogToolbar(records, context, state, () => draw(true), locale, true), sorting, status, listing);
  if (market.runId) region.prepend(blank(ui.notInformed));
  draw();
}

export function renderReevaluations(region, data, locale) {
  const ui = copy(locale);
  const runs = index(data.experiments);
  const metrics = index(data.metrics);
  const items = data.evaluations.filter(item => item.kind === 'reevaluation');
  region.replaceChildren(anchor(ui.experiments, '#/execucoes'));
  if (!items.length) { region.append(blank(ui.noMetric)); return; }
  for (const item of items) {
    const run = runs.get(item.experimentId);
    const summary = [valueOf(item.scope, locale), valueOf(item.operator, locale),
      timeLabel(item.evaluatedAt, locale)].join(' · ');
    const detail = node('details', null, 'technical-details reevaluation');
    const body = node('div');
    body.append(run ? anchor(runName(run, locale), fragment('run', run.id))
      : node('p', words(locale, 'Treino de origem não confirmado', 'Training origin unconfirmed')));
    detail.append(node('summary', summary), body);
    detail.addEventListener('toggle', () => {
      if (detail.open && body.childElementCount === 1) body.append(measurementTable(
        item.metricIds.map(key => metrics.get(key)).filter(Boolean), runs, locale, { evaluations: [item] }));
    });
    region.append(detail);
  }
}

export function budgetFacts(budget, locale) {
  const ui = copy(locale);
  return definitions([
    [ui.ratio, fraction(budget?.supervisedFraction, locale)], [ui.pointsSupervised, budget?.supervisedPoints],
    [ui.physicsPoints, budget?.physicsPoints], [ui.wallTime, budget?.wallTimeSeconds == null ? null : `${number(budget.wallTimeSeconds, locale)} s`],
    [ui.epoch, budget?.supervisedEpochLimit], [ui.physicsEpoch, budget?.physicsEpochLimit],
    [ui.batchSize, budget?.batchSize], [ui.lossWeights, budget?.lossWeights],
  ], locale);
}

export function limitations(values, locale) {
  if (!Array.isArray(values) || !values.length) return null;
  const list = node('ul', null, 'limits');
  for (const item of values) if (typeof item === 'string') list.append(node('li', reason(item, locale)));
  return list;
}

function runDetails(run, data, context, locale, loadTraining) {
  const ui = copy(locale);
  const article = node('article', null, 'detail-card');
  article.id = `run-${run.id}`;
  article.tabIndex = -1;
  const runs = index(data.experiments);
  const measures = data.metrics.filter(record => record.experimentId === run.id);
  const pairs = data.comparisons.filter(pair => pair.experimentIds.includes(run.id));
  const notes = [...new Set([...(run.limitations ?? []), ...pairs.flatMap(pair => pair.limitations ?? [])])];
  article.append(node('h3', runName(run, locale)), runTimestamp(run, locale), badge(run.evidenceStatus, locale), definitions([
    [ui.objective, translated(run.objective, locale)], [ui.phase, phaseOf(context, run.phaseId, locale)],
    [ui.seed, run.seed], [ui.case, run.caseId], [ui.reference, run.referenceType], [ui.curation, runCuration(run)],
  ], locale), node('h4', ui.metrics), measurementTable(measures, runs, locale, { evaluations: data.evaluations }),
    audit(ui.configuration, runConfiguration(run, locale)),
    node('h4', ui.limitations), limitations(notes, locale) ?? blank(ui.notInformed));
  const temporal = runTime(run);
  const provenance = definitions([
    [words(locale, 'Horário exato na fonte', 'Exact timestamp in source'), temporal.executedAt],
    [words(locale, 'Fim do treinamento', 'End of training'), temporal.finishedAt],
    [words(locale, 'Origem temporal', 'Timestamp provenance'), [temporal.executedAtSource, temporal.sourceRef?.id].filter(Boolean)],
    [ui.runId, runTitle(run)], [ui.commit, run.commitSha], [ui.datasetHash, run.datasetHash],
    [ui.splitHash, run.splitHash], [ui.configHash, run.configHash],
    [ui.sources, (run.sourceRefs ?? []).map(ref => `${ref.id} · ${ref.sha256}`)],
  ], locale);
  for (const url of run.sources ?? []) provenance.append(outside(new URL(url).hostname, url));
  article.append(audit(ui.source, provenance));
  const graphics = runGraphics(run, measures, pairs, data, runs, context, loadTraining, locale);
  article.querySelector('h4').before(graphics);
  article.append(linked(ui.comparison, pairs.map(pair => pair.id), index(pairs), 'pair', pair => pairName(pair, runs, locale), locale));
  return article;
}

function runGraphics(run, measures, pairs, data, runs, context, loadTraining, locale) {
  const ui = copy(locale);
  const section = node('section', null, 'run-graphics');
  section.id = 'run-graphics';
  section.append(node('h4', ui.runGraphics));
  const chartGroups = node('div', null, 'run-chart-grid');
  const specs = [
    [words(locale, 'RMSE de velocidade', 'Velocity RMSE'), 'rmse_uv_coarse', 'rmse_uv_corrected'],
    [words(locale, 'RMSE de pressão', 'Pressure RMSE'), 'rmse_p_coarse', 'rmse_p_corrected'],
    [words(locale, 'RMSE de divergência em relação a zero', 'Divergence RMSE relative to zero'),
      'divergence_coarse_rmse', 'divergence_corrected_rmse'],
  ];
  for (const [title, coarseName, correctedName] of specs) {
    const originals = measures.filter(metric => metric.name === coarseName);
    for (const corrected of measures.filter(metric => metric.name === correctedName)) {
      const coarse = originals.find(metric => metric.source.id === corrected.source.id
        && metric.evaluationId === corrected.evaluationId && metric.evaluationSet === corrected.evaluationSet
        && metric.calculationMethod === corrected.calculationMethod && metric.referenceType === corrected.referenceType
        && metric.unit === corrected.unit && metric.pointCount === corrected.pointCount);
      if (!coarse || !corrected.evaluationSet || !corrected.referenceType || !corrected.calculationMethod || !corrected.unit
        || !Number.isFinite(coarse.value) || !Number.isFinite(corrected.value)) continue;
      if (coarseName.startsWith('divergence') && (!coarse.validityMask?.fingerprint
        || coarse.validityMask.fingerprint !== corrected.validityMask?.fingerprint)) continue;
      const panel = node('section', null, 'run-chart');
      panel.append(node('h5', title), node('p', [valueOf(corrected.evaluationSet, locale), corrected.unit,
        valueOf(corrected.calculationMethod, locale), valueOf(corrected.referenceType, locale)].join(' · '), 'metadata'),
      makeChart([coarse, corrected], metric => metric.id === coarse.id ? words(locale, 'Campo coarse', 'Coarse field')
        : words(locale, 'Campo corrigido', 'Corrected field'), locale));
      chartGroups.append(panel);
    }
  }
  if (chartGroups.childElementCount) section.append(chartGroups);
  if (context.trainingRunIds?.includes(run.id)) section.append(trainingPanel(run, loadTraining, locale));
  const pairIndex = index(pairs);
  const direct = data.figures.filter(image => image.experimentId === run.id);
  const associated = data.figures.filter(image => pairIndex.has(image.comparisonId));
  for (const [title, figures] of [[words(locale, 'Figuras da execução', 'Run figures'), direct],
    [words(locale, 'Figuras de comparações vinculadas', 'Figures from linked comparisons'), associated]]) {
    if (!figures.length) continue;
    const gallery = node('div', null, 'research-grid gallery-grid');
    gallery.append(...figures.map(image => figureCard(image, locale, runs, pairIndex, { anchorId: false })));
    section.append(node('h5', title), gallery);
  }
  if (section.childElementCount === 1) section.append(blank(words(locale,
    'Nenhum gráfico ou figura com os metadados necessários está disponível para esta execução.',
    'No chart or figure with the required metadata is available for this run.')));
  return section;
}

function trainingPanel(run, load, locale) {
  const ui = copy(locale);
  const content = node('div');
  const panel = audit(words(locale, 'Histórico de perdas por época', 'Loss history by epoch'), content);
  panel.addEventListener('toggle', async () => {
    if (!panel.open || content.childElementCount) return;
    content.append(blank(ui.loading));
    const history = await load(run.id);
    content.replaceChildren(history ? trainingHistory(history, locale) : blank(ui.unavailable));
  });
  return panel;
}

function trainingHistory(history, locale) {
  const host = node('div');
  const stages = [...new Set(history.points.map(item => item.stage))];
  if (!stages.length) return blank(copy(locale).noMetric);
  for (const stage of stages) {
    const rows = history.points.filter(item => item.stage === stage).sort((a, b) => a.epoch - b.epoch);
    const keys = [...new Set(rows.flatMap(item => Object.keys(item.values).filter(key => key !== 'lr')))];
    if (!keys.length) continue;
    const plot = node('canvas');
    plot.width = 640;
    plot.height = 180;
    plot.setAttribute('role', 'img');
    const note = node('p', null, 'metadata');
    const draw = key => {
      const series = rows.filter(item => Number.isFinite(item.values[key]));
      if (!series.length) return;
      const min = Math.min(...series.map(item => item.values[key]));
      const max = Math.max(...series.map(item => item.values[key]));
      const first = series[0].epoch;
      const last = series.at(-1).epoch;
      const ox = 18, oy = 162;
      const context = plot.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, plot.width, plot.height);
      context.strokeStyle = '#aebed0';
      context.beginPath();
      context.moveTo(ox, 8); context.lineTo(ox, oy); context.lineTo(630, oy);
      context.stroke();
      context.strokeStyle = '#6ce4e8'; context.lineWidth = 2;
      context.beginPath();
      series.forEach((item, i) => {
        const x = ox + (item.epoch - first) / (last - first || 1) * 606;
        const y = oy - 5 - (item.values[key] - min) / (max - min || 1) * 145;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
      note.textContent = `${key} · ${words(locale, 'Épocas', 'Epochs')} ${first}–${last} · ${number(min, locale)}–${number(max, locale)} · ${copy(locale).unit} ${copy(locale).notInformed}`;
      plot.setAttribute('aria-label', note.textContent);
    };
    host.append(node('h4', stage), select(copy(locale).metrics, keys[0], keys.map(key => [key, key]), draw), plot, note);
    draw(keys[0]);
  }
  return host;
}

export function runConfiguration(run, locale) {
  const ui = copy(locale);
  const body = node('div');
  body.append(definitions([
    [ui.dataset, run.dataset], [ui.seed, run.seed], [ui.split, run.splitVersion ?? run.splitId],
    [ui.architecture, run.architecture], [ui.inputs, run.features], [ui.targets, run.targets],
    [words(locale, 'Épocas registradas por etapa', 'Logged epochs per stage'), run.executedEpochs], ['Hardware', run.trainingHardware],
  ], locale), budgetFacts(run.trainingBudget, locale));
  return body;
}

function makeChart(rows, labelFor, locale) {
  const ui = copy(locale);
  const area = node('ul', null, 'measure-chart');
  area.setAttribute('aria-label', ui.plot);
  const scale = Math.max(...rows.map(metric => Math.abs(metric.value))) || 1;
  const low = Math.min(0, ...rows.map(metric => metric.value / scale));
  const high = Math.max(0, ...rows.map(metric => metric.value / scale));
  const max = high === low ? 1 : high - low;
  const zero = -low / max * 100;
  for (const metric of rows) {
    const item = node('li');
    const track = node('div', null, 'measure-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = node('span', null, 'measure-bar');
    const normalized = metric.value / scale;
    fill.style.insetInlineStart = `${normalized >= 0 ? zero : (normalized - low) / max * 100}%`;
    fill.style.inlineSize = `${Math.abs(normalized) / max * 100}%`;
    track.append(fill);
    item.append(node('span', labelFor(metric)), track, node('span', `${number(metric.value, locale)} ${metric.unit}`));
    area.append(item);
  }
  return area;
}

export function comparisonMeasurements(pair, data, locale, { chartsOnly = false, limit = Infinity } = {}) {
  const ui = copy(locale);
  const runs = index(data.experiments);
  const metrics = index(data.metrics);
  const body = node('div', null, 'comparison-conditions');
  for (const condition of pair.conditions) {
    if (body.childElementCount >= limit) break;
    const measured = measureComparison(pair, condition, metrics, runs);
    if (chartsOnly && (!measured || measured.descriptive)) continue;
    const pane = node('section', null, 'condition');
    const caption = `${label(condition.metric, locale)} · ${label(condition.scope, locale)}`;
    pane.append(node('h4', caption), badge(measured ? condition.status : 'blocked', locale));
    const individual = condition.metricIds.map(key => metrics.get(key)).filter(metric => metric
      && pair.experimentIds.includes(metric.experimentId) && metric.name === condition.metric
      && metric.evaluationSet === condition.scope);
    if (!measured && !individual.length) continue;
    const labelFor = metric => runName(runs.get(metric.experimentId), locale);
    if (measured && !measured.descriptive) pane.append(makeChart(measured.records, labelFor, locale));
    if (!chartsOnly) {
      const rows = (measured?.records ?? individual).map(metric => [
        runs.has(metric.experimentId) ? anchor(labelFor(metric), fragment('run', metric.experimentId)) : ui.notInformed,
        number(metric.value, locale), valueOf(metric.unit, locale),
        valueOf(metric.referenceType, locale), valueOf(metric.calculationMethod, locale),
        fraction(metric.validityMask?.validFraction, locale),
      ]);
      pane.append(table([ui.model, ui.value, ui.unit, ui.reference, ui.operator, ui.coverage], rows, caption));
    }
    body.append(pane);
  }
  return body;
}

export function renderComparator(region, data, state, locale, context) {
  const ui = copy(locale);
  const runs = index(data.experiments);
  if (!data.comparisons.length) {
    region.replaceChildren(blank(ui.emptyComparison));
    return;
  }
  const pair = state.pairId ? data.comparisons.find(item => item.id === state.pairId) : data.comparisons[0];
  const groups = new Map(context.groups.flatMap(group => group.comparisonIds.map(id => [id, group])));
  const pairs = data.comparisons.map(item => {
    const group = groups.get(item.id);
    return [item.id, [group && titleOf(group.title, locale), pairName(item, runs, locale)].filter(Boolean).join(' · ')];
  });
  const chooser = select(ui.comparisonPick, pair?.id, [['', ui.comparisonPick], ...pairs], key => {
    location.hash = key ? fragment('pair', key) : '#comparison';
  });
  if (!pair) {
    region.replaceChildren(chooser, blank(ui.notInformed));
    return;
  }
  const article = node('article', null, 'detail-card');
  article.id = `pair-${pair.id}`;
  article.tabIndex = -1;
  const group = context.groups.find(item => item.comparisonIds.includes(pair.id));
  article.append(anchor(group ? words(locale, 'Voltar à investigação', 'Back to investigation') : ui.explore,
    group ? fragment('group', group.id) : '#/resultados'),
  node('h3', pairName(pair, runs, locale)));
  const reasons = [...new Set([...(pair.limitations ?? []), ...pair.conditions.flatMap(condition => condition.reasons)])];
  const metricIndex = index(data.metrics);
  const hasInvalidProtocol = pair.conditions.some(condition => condition.status !== 'blocked'
    && !measureComparison(pair, condition, metricIndex, runs));
  const status = pair.status === 'blocked' || hasInvalidProtocol ? ui.comparisonBlocked
    : pair.status === 'descriptive_only' ? ui.comparisonWarning
      : words(locale, 'Condições quantitativas verificadas para este protocolo.', 'Quantitative conditions verified for this protocol.');
  article.append(badge(hasInvalidProtocol ? 'blocked' : pair.status, locale));
  const eligibility = node('div', null, 'eligibility-summary');
  eligibility.append(node('p', status));
  if (reasons.length) eligibility.append(audit(words(locale, `Ver condições e limitações (${reasons.length})`,
    `View conditions and limitations (${reasons.length})`), limitations(reasons, locale)));
  article.append(eligibility);
  const measurements = comparisonMeasurements(pair, data, locale);
  article.append(measurements.childElementCount ? measurements : blank(ui.noComparableMetric));

  const summaries = node('div', null, 'research-grid');
  for (const key of pair.experimentIds) {
    const run = runs.get(key);
    if (!run) continue;
    const block = node('div', null, 'research-card');
    const heading = node('h4');
    heading.append(anchor(runName(run, locale), fragment('run', run.id)));
    block.append(heading, runTimestamp(run, locale), audit(ui.configuration, runConfiguration(run, locale)));
    summaries.append(block);
  }
  article.append(node('h4', ui.experiments), summaries);
  const figures = data.figures.filter(image => image.comparisonId === pair.id);
  article.append(linked(ui.figures, figures.map(image => image.id), index(figures), 'figure',
    image => titleOf(image.caption, locale), locale));
  const provenance = node('div');
  provenance.append(definitions([
    [words(locale, 'ID da comparação', 'Comparison ID'), pair.id],
    [ui.sources, [pair.manifestSource, ...(pair.sourceRefs ?? [])].filter(Boolean).map(ref => `${ref.id} · ${ref.sha256}`)],
  ], locale));
  for (const url of pair.sources ?? []) provenance.append(outside(new URL(url).hostname, url));
  article.append(audit(ui.source, provenance));
  region.replaceChildren(chooser, article);
}
