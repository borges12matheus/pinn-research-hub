import { figurePath, index } from './contracts.mjs';
import { copy, label, translated } from './copy.mjs';
import {
  anchor, badge, blank, definitions, filters, fragment, linked, node, number, options, outside, runTitle,
  titleOf, valueOf, when,
} from './dom.mjs';

const phaseOf = (context, id, locale) => translated(context.phases.find(phase => phase.id === id)?.title, locale)
  ?? valueOf(id, locale);

export function renderTimeline(region, data, context, state, locale) {
  const ui = copy(locale);
  if (!data.timeline.length) {
    region.replaceChildren(blank(ui.emptyTimeline));
    return;
  }
  const list = node('div', null, 'timeline-stack');
  const runs = index(data.experiments);
  const pairs = index(data.comparisons);
  const dimensions = [
    { key: 'phase', title: ui.phase, values: options(data.timeline, event => [event.phaseId], value => phaseOf(context, value, locale)) },
    { key: 'category', title: ui.category, values: options(data.timeline, event => [event.category], value => label(value, locale)) },
    { key: 'evidence', title: ui.evidence, values: options(data.timeline, event => [event.evidenceStatus], value => label(value, locale)) },
  ];
  const redraw = () => {
    const visible = data.timeline.filter(event => event.id === state.eventId ||
      (!state.timeline.phase || state.timeline.phase === event.phaseId)
      && (!state.timeline.category || state.timeline.category === event.category)
      && (!state.timeline.evidence || state.timeline.evidence === event.evidenceStatus));
    const dated = visible.filter(event => event.date)
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const undated = visible.filter(event => !event.date).sort((a, b) => a.id.localeCompare(b.id));
    list.replaceChildren(...dated.map(drawEvent));
    if (undated.length) list.append(node('h3', ui.undated), ...undated.map(drawEvent));
    if (!visible.length) list.append(blank(ui.noMatch));
  };
  function drawEvent(event) {
    const details = node('details', null, 'timeline-event');
    details.id = `event-${event.id}`;
    details.tabIndex = -1;
    details.open = state.eventId === event.id || state.openEvents.has(event.id);
    details.addEventListener('toggle', () => {
      if (details.open) state.openEvents.add(event.id);
      else state.openEvents.delete(event.id);
    });
    const summary = node('summary');
    const title = node('span', titleOf(event.title, locale), 'event-title');
    const meta = node('span', null, 'event-meta');
    meta.append(event.period ? node('span', titleOf(event.period, locale)) : when(event.date, locale),
      node('span', phaseOf(context, event.phaseId, locale)), badge(event.category, locale), badge(event.evidenceStatus, locale));
    summary.append(title, meta);
    details.append(summary);
    const body = node('div', null, 'event-body');
    body.append(node('p', titleOf(event.summary, locale)));
    const decisionText = event.decisionIds?.map(key => titleOf(context.decisions.find(item => item.id === key)?.title ?? key, locale)) ?? [];
    const narrative = [
      [ui.hypothesis, translated(event.hypothesis, locale)], [ui.observation, translated(event.observation, locale)],
      [ui.conclusion, translated(event.conclusion, locale)], [ui.nextStep, translated(event.nextStep, locale)],
      [ui.decisions, decisionText.length ? decisionText : null],
    ].filter(([, value]) => value != null);
    if (narrative.length) body.append(definitions(narrative, locale));
    body.append(linked(ui.hypothesis, event.hypothesisIds, index(context.hypotheses), 'hypothesis',
      (value, language) => titleOf(value.title, language), locale));
    body.append(linked(ui.experiments, event.experimentIds, runs, 'run', runTitle, locale),
      linked(ui.comparison, event.comparisonIds, pairs, 'pair', pair => pair.id, locale));
    if (event.sources?.length || event.sourceRefs?.length) {
      const references = node('div', null, 'reference-list');
      references.append(node('span', ui.sources, 'metadata'));
      for (const url of event.sources ?? []) references.append(outside(new URL(url).hostname, url));
      for (const ref of event.sourceRefs ?? []) references.append(node('span', ref.id, 'metadata'));
      body.append(references);
    }
    details.append(body);
    return details;
  }
  region.replaceChildren(filters(dimensions, state.timeline, redraw, locale), list);
  redraw();
}

export function renderGallery(region, data, current, locale) {
  const ui = copy(locale);
  if (!data.figures.length) {
    region.replaceChildren(blank(ui.emptyFigures));
    return;
  }
  const cards = node('div', null, 'research-grid gallery-grid');
  const redraw = () => {
    const visible = data.figures.filter(image => !current.gallery.field || (image.category ?? image.field) === current.gallery.field
      || image.id === current.figureId);
    cards.replaceChildren(...visible.map(image => figureCard(image, locale)));
    if (!visible.length) cards.append(blank(ui.noMatch));
  };
  const dimensions = [{ key: 'field', title: ui.category,
    values: options(data.figures, image => [image.category ?? image.field], value => label(value, locale)) }];
  region.replaceChildren(filters(dimensions, current.gallery, redraw, locale), cards);
  redraw();
}

function figureCard(image, locale) {
  const ui = copy(locale);
  const figure = node('figure', null, 'research-card scientific-figure');
  figure.id = `figure-${image.id}`;
  figure.tabIndex = -1;
  const caption = titleOf(image.caption, locale);
  const alt = titleOf(image.alt, locale);
  const button = node('button', null, 'figure-trigger');
  button.type = 'button';
  const path = figurePath(image.path) ? `./${image.path}` : null;
  if (path) {
    const thumb = Object.assign(node('img'), { alt, loading: 'lazy', decoding: 'async' });
    thumb.addEventListener('error', () => { button.replaceChildren(blank(ui.figureOpenError)); button.disabled = true; });
    thumb.src = path;
    button.append(thumb);
    button.setAttribute('aria-label', `${ui.expand} · ${caption}`);
    button.addEventListener('click', () => enlarge(path, titleOf(image.caption, locale), alt, button, locale));
    figure.append(button);
  }
  const text = node('figcaption');
  text.append(node('p', caption), definitions([
    [ui.category, image.category ?? image.field], [ui.scope, image.evaluationSet], [ui.unit, image.unit],
    [ui.reference, image.referenceType], [ui.operator, image.operator], [ui.source, image.source.id],
  ], locale));
  const owner = image.experimentId ?? image.comparisonId;
  text.append(anchor(owner, fragment(image.experimentId ? 'run' : 'pair', owner)));
  figure.append(text);
  return figure;
}

function enlarge(path, caption, alt, trigger, locale) {
  const ui = copy(locale);
  const dialog = node('dialog', null, 'figure-dialog');
  const close = node('button', ui.close);
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  dialog.setAttribute('aria-label', caption);
  const full = Object.assign(node('img'), { alt, src: path });
  dialog.append(close, full, node('p', caption));
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); }, { once: true });
  dialog.showModal();
  close.focus();
}

export function renderLiterature(region, data, context, locale) {
  const ui = copy(locale);
  if (!data.literature.length) {
    region.replaceChildren(blank(ui.emptyLiterature));
    return;
  }
  const list = node('ul', null, 'entries');
  for (const item of data.literature) {
    const li = node('li');
    li.append(outside(titleOf(item.title, locale), item.url));
    if (item.summary) li.append(node('p', titleOf(item.summary, locale), 'detail'));
    li.append(linked(ui.experiments, item.experimentIds, index(data.experiments), 'run', runTitle, locale),
      linked(ui.hypothesis, item.hypothesisIds, index(context.hypotheses), 'hypothesis',
        (record, language) => titleOf(record.title, language), locale));
    list.append(li);
  }
  region.replaceChildren(list);
}

export function renderDashboard(region, context, project, priorities, locale, loadBaseline) {
  const ui = copy(locale);
  const statistics = node('div', null, 'science-stats');
  const active = context.hypotheses.filter(hypothesis => hypothesis.active);
  for (const [key, value] of [
    [ui.phase, phaseOf(context, context.currentPhaseId ?? project?.currentPhase, locale)],
    [ui.activeHypotheses, number(active.length, locale)], [ui.groups, number(context.groups.length, locale)],
    [ui.experimentUpdated, when(context.experimentalDate, locale)],
  ]) {
    const item = node('article', null, 'science-stat');
    const entry = node('p');
    entry.append(value);
    item.append(node('h2', key), entry);
    statistics.append(item);
  }
  const panels = node('div', null, 'dashboard-grid');
  const baseline = node('article', null, 'panel dashboard-panel');
  baseline.append(node('h2', ui.currentResearch));
  if (context.baseline) {
    const run = context.baseline;
    baseline.append(badge(run.evidenceStatus, locale), definitions([
      [ui.case, run.caseId], [ui.reynolds, run.reynolds], [ui.turbulence, run.turbulenceModel], [ui.model, run.models],
    ], locale), anchor(ui.comparison, fragment('pair', run.comparisonId)));
    const details = node('details', null, 'baseline-details');
    const body = node('div');
    details.append(node('summary', ui.baselineMetrics), body);
    details.addEventListener('toggle', async () => {
      if (!details.open || body.childElementCount) return;
      body.replaceChildren(blank(ui.loading));
      const measurements = await loadBaseline();
      if (!measurements) { body.replaceChildren(blank(ui.unavailable)); return; }
      const selectedNames = new Set(['rmse_uv_corrected', 'rmse_p_corrected', 'divergence_corrected_rmse', 'divergence_error_rmse']);
      const records = measurements.filter(metric => run.experimentIds.includes(metric.experimentId) && selectedNames.has(metric.name));
      body.replaceChildren(...run.experimentIds.map((key, position) => {
        const block = node('div', null, 'baseline-measurements');
        block.append(anchor(run.models[position], fragment('run', key)));
        const fields = records.filter(metric => metric.experimentId === key).map(metric => [
          `${label(metric.name, locale)} · ${valueOf(metric.evaluationSet, locale)}`,
          `${number(metric.value, locale)} · ${metric.unit ?? ui.notInformed}`,
        ]);
        block.append(fields.length ? definitions(fields, locale) : blank(ui.noMetric));
        return block;
      }));
    });
    baseline.append(details);
  } else baseline.append(blank(ui.baselineMissing), anchor(ui.explore, '#experiments'));
  const hypotheses = node('section', null, 'panel dashboard-panel');
  hypotheses.append(node('h2', ui.activeHypotheses));
  const questions = node('ul', null, 'question-list');
  for (const hypothesis of active) {
    const item = node('li', titleOf(hypothesis.title, locale));
    item.id = `hypothesis-${hypothesis.id}`;
    item.tabIndex = -1;
    questions.append(item);
  }
  for (const hypothesis of context.hypotheses.filter(item => !item.active)) {
    const item = node('li', titleOf(hypothesis.title, locale));
    item.id = `hypothesis-${hypothesis.id}`;
    item.tabIndex = -1;
    item.className = 'secondary-hypothesis';
    questions.append(item);
  }
  hypotheses.append(questions);
  panels.append(baseline, hypotheses);

  const changes = node('div', null, 'dashboard-grid');
  const recent = node('section', null, 'panel dashboard-panel');
  recent.append(node('h2', ui.recent));
  if (context.recent?.length) {
    const entries = node('ul', null, 'overview-list');
    for (const event of context.recent) {
      const item = node('li');
      item.append(when(event.date, locale), anchor(titleOf(event.title, locale), fragment('event', event.id)));
      entries.append(item);
    }
    recent.append(entries);
  } else recent.append(blank(ui.emptyTimeline), anchor(ui.timelineLink, '#timeline'));
  const next = node('section', null, 'panel dashboard-panel');
  next.append(node('h2', ui.priorities));
  const actions = node('ul', null, 'overview-list');
  for (const item of priorities.filter(entry => entry.status !== 'done').sort((a,b) => a.order - b.order).slice(0,3)) {
    actions.append(node('li', translated(locale === 'en' ? item.en?.title ?? item.title : item.title, locale)));
  }
  next.append(actions.childElementCount ? actions : blank(ui.noMatch), anchor(ui.priorities, '#priorities'));
  changes.append(recent, next);
  const featured = node('section', null, 'panel dashboard-panel');
  featured.append(node('h2', ui.featured));
  if (context.groups.length) {
    const groups = node('ul', null, 'featured-list');
    for (const group of context.groups.slice(0, 3)) {
      const item = node('li');
      item.append(anchor(titleOf(group.title, locale), fragment('event', group.eventIds[0])));
      groups.append(item);
    }
    featured.append(groups);
  } else featured.append(blank(ui.emptyExperiments));
  region.replaceChildren(statistics, panels, featured, changes);
}
