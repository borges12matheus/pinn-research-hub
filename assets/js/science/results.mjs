import { index, measureComparison } from './contracts.mjs';
import { copy, label, reason, translated } from './copy.mjs';
import {
  anchor, badge, blank, definitions, filters, fraction, fragment, linked, node, number, options, outside,
  runTitle, select, table, titleOf, valueOf, when,
} from './dom.mjs';

const model = run => run.modelFamily ?? run.model;
const curated = run => run.presentationStatus ?? run.curationStatus;
const metricName = (metric, locale) => titleOf(metric.title ?? label(metric.name, locale), locale);
const modelName = (run, locale) => valueOf(model(run), locale);

function dimension(key, title, records, values, format) {
  return { key, title, values: options(records, values, format) };
}
function matches(value, filter) {
  return !filter || [].concat(value ?? []).some(item => String(item) === filter);
}
function phaseName(phase, context, locale) {
  return translated(context.phases.find(item => item.id === phase)?.title, locale) ?? valueOf(phase, locale);
}

export function renderCatalog(region, data, context, market, locale) {
  const ui = copy(locale);
  const records = data.experiments;
  const state = market.catalog;
  if (!records.length) {
    region.replaceChildren(blank(ui.emptyExperiments));
    return;
  }
  const dimensions = [
    dimension('phase', ui.phase, records, x => [x.phaseId], value => phaseName(value, context, locale)),
    dimension('model', ui.model, records, x => [model(x)]),
    dimension('reynolds', ui.reynolds, records, x => x.reynolds ?? [], value => number(value, locale)),
    dimension('type', ui.type, records, x => [x.type], value => label(value, locale)),
    dimension('evidence', ui.evidence, records, x => [x.evidenceStatus], value => label(value, locale)),
    dimension('curation', ui.curation, records, x => [curated(x)], value => label(value, locale)),
  ];
  const cards = node('div', null, 'research-grid');
  const redraw = () => {
    const visible = records.filter(run => matches(run.phaseId, state.phase) && matches(model(run), state.model)
      && matches(run.reynolds, state.reynolds) && matches(run.type, state.type)
      && matches(run.evidenceStatus, state.evidence) && matches(curated(run), state.curation))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id));
    cards.replaceChildren(...visible.map(run => {
      const card = node('article', null, 'research-card');
      const title = node('h3');
      title.append(anchor(modelName(run, locale), fragment('run', run.id)));
      const badges = node('div', null, 'badges');
      badges.append(badge(run.evidenceStatus, locale));
      if (curated(run)) badges.append(badge(curated(run), locale));
      card.append(title, node('p', runTitle(run), 'record-id'), badges, definitions([
        [ui.date, when(run.date, locale)], [ui.phase, phaseName(run.phaseId, context, locale)],
        [ui.case, run.caseId], [ui.reynolds, run.reynolds], [ui.reference, run.referenceType],
        [ui.seed, run.seed], [ui.split, run.splitVersion ?? run.splitId], [ui.metrics, run.metrics.length],
      ], locale));
      return card;
    }));
    if (!visible.length) cards.append(blank(ui.noMatch));
  };
  const run = records.find(item => item.id === market.runId);
  const parts = [];
  if (run) parts.push(runDetails(run, data, locale));
  parts.push(filters(dimensions, state, redraw, locale), cards);
  region.replaceChildren(...parts);
  redraw();
}

function metricTable(records, locale, caption) {
  const ui = copy(locale);
  if (!records.length) return blank(ui.noMetric);
  return table([ui.metrics, ui.scope, ui.value, ui.unit, ui.reference, ui.operator, ui.points, ui.coverage, ui.definition, ui.source],
    records.map(metric => [
      metricName(metric, locale), valueOf(metric.evaluationSet, locale), number(metric.value, locale), valueOf(metric.unit, locale),
      valueOf(metric.referenceType, locale), [valueOf(metric.calculationMethod, locale),
        metric.operatorParameters && Object.keys(metric.operatorParameters).length ? valueOf(metric.operatorParameters, locale) : null]
        .filter(Boolean).join(' · '),
      number(metric.pointCount, locale), metric.validityMask
        ? `${number(metric.validityMask.validCount, locale)} · ${fraction(metric.validityMask.validFraction, locale)}` : ui.notInformed,
      titleOf(metric.definition, locale), [metric.source.id, metric.source.sha256].join(' · '),
    ]), caption);
}

function budgetFacts(budget, locale) {
  const ui = copy(locale);
  return definitions([
    [ui.ratio, fraction(budget?.supervisedFraction, locale)], [ui.pointsSupervised, budget?.supervisedPoints],
    [ui.physicsPoints, budget?.physicsPoints], [ui.wallTime, budget?.wallTimeSeconds == null ? null : `${number(budget.wallTimeSeconds, locale)} s`],
    [ui.epoch, budget?.supervisedEpochLimit], [ui.physicsEpoch, budget?.physicsEpochLimit],
    [ui.batchSize, budget?.batchSize], [ui.lossWeights, budget?.lossWeights],
  ], locale);
}

function limitations(values, locale) {
  if (!Array.isArray(values) || !values.length) return null;
  const list = node('ul', null, 'limits');
  for (const item of values) if (typeof item === 'string') list.append(node('li', reason(item, locale)));
  return list;
}

function runDetails(run, data, locale) {
  const ui = copy(locale);
  const article = node('article', null, 'detail-card');
  article.id = `run-${run.id}`;
  article.tabIndex = -1;
  article.append(node('h3', runTitle(run)), badge(run.evidenceStatus, locale), definitions([
    [ui.objective, translated(run.objective, locale)], [ui.model, model(run)], [ui.case, run.caseId],
    [ui.dataset, run.dataset], [ui.reference, run.referenceType], [ui.turbulence, run.turbulenceModel], [ui.reynolds, run.reynolds],
    [ui.seed, run.seed], [ui.split, run.splitVersion ?? run.splitId],
    [ui.architecture, run.architecture], [ui.inputs, run.features], [ui.targets, run.targets],
  ], locale), node('h4', ui.training), budgetFacts(run.trainingBudget, locale));
  const measures = data.metrics.filter(record => record.experimentId === run.id);
  const physical = metric => metric.calculationMethod !== 'pointwise_field_error'
    && /(?:divergence|mass|wall|momentum)/.test(metric.name);
  article.append(node('h4', ui.accuracy), metricTable(measures.filter(metric => !physical(metric)), locale, ui.accuracy),
    node('h4', ui.physics), metricTable(measures.filter(physical), locale, ui.physics));
  const pairs = data.comparisons.filter(pair => pair.experimentIds.includes(run.id));
  const notes = [...new Set([...(run.limitations ?? []), ...pairs.flatMap(pair => pair.limitations ?? [])])];
  article.append(node('h4', ui.limitations), limitations(notes, locale) ?? blank(ui.notInformed),
    node('h4', ui.source), definitions([
      [ui.runId, runTitle(run)], [ui.commit, run.commitSha], [ui.datasetHash, run.datasetHash],
      [ui.splitHash, run.splitHash], [ui.configHash, run.configHash],
      [ui.sources, (run.sourceRefs ?? []).map(ref => `${ref.id} · ${ref.sha256}`)],
    ], locale));
  for (const url of run.sources ?? []) article.append(outside(url, url));
  const figures = data.figures.filter(image => image.experimentId === run.id);
  article.append(linked(ui.figures, figures.map(image => image.id), index(figures), 'figure',
    image => titleOf(image.caption, locale), locale));
  article.append(linked(ui.comparison, pairs.map(pair => pair.id), index(pairs), 'pair', pair => pair.id, locale));
  return article;
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

export function renderComparator(region, data, state, locale) {
  const ui = copy(locale);
  const runs = index(data.experiments);
  const metrics = index(data.metrics);
  if (!data.comparisons.length) {
    region.replaceChildren(blank(ui.emptyComparison));
    return;
  }
  const pair = data.comparisons.find(item => item.id === state.pairId) ?? data.comparisons[0];
  const pairs = data.comparisons.map(item => [item.id, `${item.id} · ${item.experimentIds.map(key => runs.get(key) ? modelName(runs.get(key), locale) : key).join(' × ')}`]);
  const chooser = select(ui.comparisonPick, pair.id, pairs, key => { location.hash = fragment('pair', key); });
  const article = node('article', null, 'detail-card');
  article.id = `pair-${pair.id}`;
  article.tabIndex = -1;
  article.append(node('h3', pair.id), badge(pair.status, locale));
  if (pair.status === 'blocked') article.append(node('p', ui.comparisonBlocked, 'method-warning'));
  const summaries = node('div', null, 'research-grid');
  for (const key of pair.experimentIds) {
    const run = runs.get(key);
    if (!run) continue;
    const block = node('div', null, 'research-card');
    const heading = node('h4');
    heading.append(anchor(modelName(run, locale), fragment('run', run.id)));
    block.append(heading, definitions([
      [ui.case, run.caseId], [ui.seed, run.seed], [ui.split, run.splitVersion ?? run.splitId],
      [ui.inputs, run.features], [ui.architecture, run.architecture],
    ], locale), budgetFacts(run.trainingBudget, locale));
    summaries.append(block);
  }
  article.append(node('p', ui.efficiencyNote, 'detail'), summaries);
  for (const condition of pair.conditions) {
    const pane = node('section', null, 'condition');
    const caption = `${label(condition.metric, locale)} · ${label(condition.scope, locale)}`;
    pane.append(node('h4', caption), badge(condition.status, locale));
    const notes = limitations(condition.reasons, locale);
    if (notes) pane.append(notes);
    const chart = measureComparison(pair, condition, metrics, runs);
    if (!chart) {
      pane.append(blank(ui.noComparableMetric));
    } else {
      if (chart.descriptive) pane.append(node('p', ui.comparisonWarning, 'method-warning'));
      const labelFor = metric => modelName(runs.get(metric.experimentId), locale);
      pane.append(makeChart(chart.records, labelFor, locale), table([ui.model, ui.value, ui.unit, ui.reference, ui.operator, ui.coverage, ui.availability],
        chart.records.map(metric => [
          anchor(labelFor(metric), fragment('run', metric.experimentId)), number(metric.value, locale), metric.unit,
          valueOf(metric.referenceType, locale), valueOf(metric.calculationMethod, locale),
          fraction(metric.validityMask?.validFraction, locale),
          chart.winners.has(metric.id) ? (chart.tied ? ui.tie : ui.best) : '—',
        ]), caption));
    }
    article.append(pane);
  }
  if (!pair.conditions.length) article.append(blank(ui.noComparableMetric));
  if (pair.manifestSource) article.append(definitions([[ui.source, `${pair.manifestSource.id} · ${pair.manifestSource.sha256}`]], locale));
  for (const url of pair.sources ?? []) article.append(outside(url, url));
  const figures = data.figures.filter(image => image.comparisonId === pair.id);
  article.append(linked(ui.figures, figures.map(image => image.id), index(figures), 'figure',
    image => titleOf(image.caption, locale), locale));
  region.replaceChildren(chooser, article);
}
