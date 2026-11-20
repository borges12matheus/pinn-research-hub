import { runTimestamp } from './analytics.mjs';
import { index } from './contracts.mjs';
import { copy, label, translated } from './copy.mjs';
import { anchor, badge, blank, definitions, filters, fragment, node, options, outside, titleOf } from './dom.mjs';
import { audit, measurementTable } from './measurements.mjs';
import { investigation, modelOf, pairName, phaseOf, runName, words } from './presentation.mjs';
import { figureCard } from './research.mjs';
import { comparisonMeasurements, limitations, runConfiguration } from './results.mjs';

function section(title, ...content) {
  const block = node('section', null, 'investigation-section');
  block.append(node('h3', title), ...content);
  return block;
}

export function renderInvestigations(region, data, context, state, locale) {
  const ui = copy(locale);
  const navigation = node('div', null, 'reference-list');
  navigation.append(anchor(ui.timeline, '#/evolucao'), anchor(ui.experiments, '#/execucoes'), anchor(ui.comparison, '#comparison'), anchor(ui.figures, '#figures'));
  if (!context.groups.length) {
    region.replaceChildren(navigation, blank(ui.emptyExperiments));
    return;
  }
  const cards = node('div', null, 'investigation-list');
  const items = context.groups.map(group => investigation(group, data, locale));
  const dimensions = [
    ['phase', ui.phase, item => item.events.map(event => event.phaseId), value => phaseOf(context, value, locale)],
    ['model', ui.model, item => item.runs.map(modelOf)],
    ['re', ui.reynolds, item => item.runs.flatMap(run => run.reynolds ?? [])],
    ['case', ui.case, item => item.runs.map(run => run.caseId), value => label(value, locale)],
    ['evidence', ui.evidence, item => item.events.map(event => event.evidenceStatus), value => label(value, locale)],
  ].map(([key, title, get, format]) => ({ key, title, get, values: options(items, get, format) }));
  function draw() {
    const visible = items.filter(item => dimensions.every(({ key, get }) =>
      !state[key] || get(item).some(value => String(value) === state[key])));
    cards.replaceChildren(...visible.map(item => {
      const card = node('article', null, 'investigation-card');
      const title = node('h3');
      title.append(anchor(titleOf(item.group.title, locale), fragment('group', item.group.id)));
      card.append(title, node('p', item.question));
      for (const status of new Set(item.events.map(event => event.evidenceStatus))) card.append(badge(status, locale));
      card.append(node('p', words(locale, `Comparações ${item.pairs.length} · Execuções ${item.runs.length}`,
        `Comparisons ${item.pairs.length} · Runs ${item.runs.length}`), 'metadata'));
      return card;
    }));
    if (!visible.length) cards.append(blank(ui.noMatch));
  }
  region.replaceChildren(navigation, filters(dimensions, state, draw, locale), cards);
  draw();
}

export function renderInvestigation(region, data, context, groupId, locale) {
  const ui = copy(locale);
  const group = context.groups.find(item => item.id === groupId);
  const navigation = node('div', null, 'reference-list');
  navigation.append(anchor(ui.results, '#/resultados'), anchor(ui.timeline, '#/evolucao'));
  if (!group) {
    region.closest('section').removeAttribute('aria-labelledby');
    region.replaceChildren(navigation, blank(words(locale, 'Investigação indisponível nesta coleção.', 'Investigation unavailable in this collection.')));
    return;
  }
  const item = investigation(group, data, locale);
  const runs = index(item.runs);
  const pairs = index(item.pairs);
  const distinct = values => [...new Set(values.filter(value => value != null))];
  const heading = node('header', null, 'investigation-header');
  const name = node('h2', titleOf(group.title, locale));
  name.id = `group-${group.id}`;
  name.tabIndex = -1;
  heading.append(navigation, name, node('p', item.question, 'research-question'), definitions([
    [ui.phase, distinct(item.events.map(event => event.phaseId)).map(phase => phaseOf(context, phase, locale))],
    [ui.case, distinct(item.runs.map(run => run.caseId))], [ui.reynolds, distinct(item.runs.flatMap(run => run.reynolds ?? []))],
    [ui.turbulence, distinct(item.runs.map(run => run.turbulenceModel))], [ui.model, distinct(item.runs.map(modelOf))],
    [ui.reference, distinct(item.runs.map(run => run.referenceType))],
  ], locale));
  for (const status of distinct(item.events.map(event => event.evidenceStatus))) heading.append(badge(status, locale));

  const narrative = node('div', null, 'investigation-narrative');
  for (const event of item.events) {
    narrative.append(definitions([
      [ui.objective, titleOf(event.summary, locale)], [ui.observation, translated(event.observation, locale)],
      [ui.conclusion, translated(event.conclusion, locale)], [ui.nextStep, translated(event.nextStep, locale)],
      [ui.decisions, (event.decisionIds ?? []).map(key => context.decisions.find(decision => decision.id === key))
        .filter(Boolean).map(decision => titleOf(decision.title, locale))],
    ].filter(([, value]) => value != null), locale));
    narrative.append(anchor(words(locale, 'Ver marco na timeline', 'View timeline milestone'), fragment('event', event.id)));
  }
  if (group.readingNote) narrative.prepend(node('p', titleOf(group.readingNote, locale), 'scientific-finding'));
  const comparisons = node('div', null, 'investigation-comparisons');
  let hasCharts = false;
  for (const pair of item.pairs) {
    const link = node('h4');
    link.append(anchor(pairName(pair, runs, locale), fragment('pair', pair.id)));
    const charts = comparisonMeasurements(pair, data, locale, { chartsOnly: true });
    hasCharts ||= Boolean(charts.childElementCount);
    comparisons.append(link, badge(pair.status, locale));
    const protocol = pair.protocol ?? {};
    const fields = [[ui.physics, protocol.physicsScope], [ui.scope, [...new Set(pair.conditions.map(condition => condition.scope))]]]
      .filter(([, value]) => value != null);
    if (fields.length) comparisons.append(definitions(fields, locale));
    comparisons.append(charts);
  }
  if (!hasCharts) comparisons.prepend(blank(words(locale,
    'As condições documentadas não sustentam gráficos quantitativos conjuntos. Consulte as comparações e as medidas individuais.',
    'The documented conditions do not support joint quantitative charts. See the comparisons and individual measurements.')));

  const figures = node('div', null, 'research-grid gallery-grid');
  figures.append(...item.figures.map(image => figureCard(image, locale, runs, pairs, { anchorId: false })));
  if (!item.figures.length) figures.append(blank(ui.emptyFigures));
  else figures.prepend(node('p', words(locale, 'Confira a escala de cores de cada figura antes de comparar campos.',
    'Check each figure’s color scale before comparing fields.'), 'detail gallery-note'));

  const executions = node('ul', null, 'entries');
  const configuration = node('div');
  for (const run of item.runs) {
    const row = node('li');
    row.append(anchor(runName(run, locale), fragment('run', run.id)), runTimestamp(run, locale), definitions([
      [ui.split, run.splitVersion ?? run.splitId], [ui.inputs, run.features],
    ], locale));
    executions.append(row);
    configuration.append(audit(runName(run, locale), runConfiguration(run, locale)));
  }

  const notes = distinct([...item.pairs, ...item.runs].flatMap(record => record.limitations ?? []));
  const provenance = node('div');
  for (const [title, records] of [[ui.timeline, item.events], [ui.comparison, item.pairs], [ui.experiments, item.runs]]) {
    provenance.append(node('h4', title));
    for (const record of records) {
      const refs = [record.manifestSource, ...(record.sourceRefs ?? [])].filter(Boolean);
      provenance.append(definitions([[record.id, refs.map(ref => `${ref.id} · ${ref.sha256}`)]], locale));
      for (const url of record.sources ?? []) provenance.append(outside(new URL(url).hostname, url));
    }
  }
  region.closest('section').setAttribute('aria-labelledby', name.id);
  region.replaceChildren(heading,
    section(words(locale, 'Resumo da investigação', 'Investigation summary'), narrative),
    section(words(locale, 'Gráficos e comparações', 'Charts and comparisons'), comparisons),
    section(ui.metrics, measurementTable(item.metrics, runs, locale, { evaluations: data.evaluations, pairs: item.pairs, matrix: true })),
    section(words(locale, 'Figuras CFD', 'CFD figures'), figures),
    section(ui.experiments, item.runs.length ? executions : blank(ui.emptyExperiments)),
    audit(ui.configuration, configuration),
    section(ui.limitations, limitations(notes, locale) ?? blank(ui.notInformed), audit(ui.source, provenance)));
}
