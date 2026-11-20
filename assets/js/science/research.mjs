import { figurePath, index } from './contracts.mjs';
import { copy, label, translated } from './copy.mjs';
import {
  anchor, badge, blank, definitions, filters, fragment, linked, node, number, options, outside,
  titleOf, when,
} from './dom.mjs';

import { pairName, phaseOf, runName, words } from './presentation.mjs';
import { runTimestamp } from './analytics.mjs';
import { audit } from './measurements.mjs';

function bodyAppendRuns(card, related, title) {
  const disclosure = node('details', null, 'timeline-runs');
  disclosure.append(node('summary', title), related);
  card.append(disclosure);
}

export function renderTimeline(region, data, context, state, locale) {
  const ui = copy(locale);
  if (!data.timeline.length) {
    region.replaceChildren(blank(ui.emptyTimeline));
    return;
  }
  const groups = index(context.groups);
  const runs = index(data.experiments);
  const pairs = index(data.comparisons);
  const list = node('div', null, 'timeline-stack');
  const dimensions = [
    { key: 'phase', title: ui.phase, values: options(data.timeline, event => [event.phaseId], value => phaseOf(context, value, locale)) },
    { key: 'category', title: ui.category, values: options(data.timeline, event => [event.category], value => label(value, locale)) },
    { key: 'evidence', title: ui.evidence, values: options(data.timeline, event => [event.evidenceStatus], value => label(value, locale)) },
  ];
  function drawEvent(event) {
    const group = groups.get(event.curationGroupId) ?? context.groups.find(item => item.eventIds.includes(event.id));
    const card = node('article', null, 'timeline-event milestone-card');
    card.id = `event-${event.id}`;
    card.tabIndex = -1;
    const meta = node('div', null, 'event-meta');
    meta.append(event.date ? when(event.date, locale) : node('span', titleOf(event.period, locale)),
      badge(event.category, locale), badge(event.evidenceStatus, locale));
    const heading = node('h4', titleOf(event.title, locale));
    const question = group?.question ?? event.hypothesis;
    const compareIds = (event.comparisonIds?.length ? event.comparisonIds : group?.comparisonIds ?? []).filter(key => pairs.has(key));
    card.append(meta, heading);
    if (question) card.append(node('p', titleOf(question, locale), 'research-question'));
    card.append(node('p', titleOf(event.observation ?? event.summary, locale)));
    const stats = words(locale, `Investigações ${Number(Boolean(group))} · Comparações ${compareIds.length}`,
      `Investigations ${Number(Boolean(group))} · Comparisons ${compareIds.length}`);
    card.append(node('p', stats, 'metadata'));
    const action = group ? anchor(ui.explore, fragment('group', group.id))
      : anchor(words(locale, 'Consultar marco', 'View milestone'), fragment('event', event.id));
    action.className = 'action';
    if (state.eventId !== event.id || group) card.append(action);
    if (state.eventId === event.id) {
      const related = node('ul', null, 'entries milestone-runs');
      for (const key of event.experimentIds ?? []) if (runs.has(key)) {
        const run = runs.get(key);
        const item = node('li');
        item.append(anchor(runName(run, locale), fragment('run', run.id)), runTimestamp(run, locale));
        related.append(item);
      }
      if (related.childElementCount) bodyAppendRuns(card, related, ui.experiments);
      card.append(definitions([
        [ui.objective, titleOf(event.summary, locale)],
        [ui.conclusion, translated(event.conclusion, locale)], [ui.nextStep, translated(event.nextStep, locale)],
      ].filter(([, value]) => value != null), locale));
      const extra = definitions([[ui.sources, (event.sourceRefs ?? []).map(ref => `${ref.id} · ${ref.sha256}`)]], locale);
      for (const url of event.sources ?? []) extra.append(outside(new URL(url).hostname, url));
      if (event.sourceRefs?.length || event.sources?.length) card.append(audit(ui.source, extra));
      if (!group) card.append(linked(ui.comparison, compareIds, pairs, 'pair', pair => pairName(pair, runs, locale), locale));
    }
    return card;
  }
  function redraw() {
    const selected = data.timeline.filter(event => event.id === state.eventId ||
      (!state.timeline.phase || state.timeline.phase === event.phaseId)
      && (!state.timeline.category || state.timeline.category === event.category)
      && (!state.timeline.evidence || state.timeline.evidence === event.evidenceStatus));
    const phaseIds = new Set([...context.phases.map(phase => phase.id), ...selected.map(event => event.phaseId)]);
    list.replaceChildren();
    for (const phase of phaseIds) {
      const members = selected.filter(event => event.phaseId === phase)
        .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id));
      if (!members.length) continue;
      const block = node('section', null, 'timeline-phase');
      block.append(node('h3', phaseOf(context, phase, locale)));
      for (const event of members.filter(item => item.date)) block.append(drawEvent(event));
      const undated = members.filter(item => !item.date);
      if (undated.length) block.append(node('p', ui.undated, 'metadata'), ...undated.map(drawEvent));
      list.append(block);
    }
    if (!selected.length) list.append(blank(ui.noMatch));
  }
  region.replaceChildren(filters(dimensions, state.timeline, redraw, locale), list);
  redraw();
}

export function renderGallery(region, data, current, locale, context) {
  const ui = copy(locale);
  if (!data.figures.length) {
    region.replaceChildren(blank(ui.emptyFigures));
    return;
  }
  const cards = node('div');
  const runs = index(data.experiments);
  const pairs = index(data.comparisons);
  const owners = image => image.experimentId ? [runs.get(image.experimentId)].filter(Boolean)
    : (pairs.get(image.comparisonId)?.experimentIds ?? []).map(id => runs.get(id)).filter(Boolean);
  const grouping = image => context.groups.find(group => group.experimentIds.includes(image.experimentId)
    || group.comparisonIds.includes(image.comparisonId));
  const dimensions = [
    ['field', ui.category, image => [image.category ?? image.field]],
    ['model', ui.model, image => owners(image).map(run => run.model ?? run.modelFamily)],
    ['scope', ui.scope, image => [image.evaluationSet]],
    ['case', ui.case, image => owners(image).map(run => run.caseId)],
  ].map(([key, title, get]) => ({ key, title, get, values: options(data.figures, get, value => label(value, locale)) }));
  const redraw = () => {
    const visible = data.figures.filter(image => image.id === current.figureId ||
      dimensions.every(({ key, get }) => !current.gallery[key] || get(image).includes(current.gallery[key])));
    cards.replaceChildren();
    const groups = new Map();
    for (const image of visible) {
      const group = grouping(image);
      const key = group?.id ?? 'other';
      if (!groups.has(key)) groups.set(key, { group, images: [] });
      groups.get(key).images.push(image);
    }
    for (const { group, images } of groups.values()) {
      const heading = node('h3');
      heading.append(group ? anchor(titleOf(group.title, locale), fragment('group', group.id))
        : words(locale, 'Outras figuras', 'Other figures'));
      const pairIds = [...new Set(images.map(image => image.comparisonId ?? null))];
      cards.append(heading);
      for (const pairId of pairIds) {
        const pair = pairs.get(pairId);
        if (pair) cards.append(node('h4', pairName(pair, runs, locale)));
        const grid = node('div', null, 'research-grid gallery-grid');
        grid.append(...images.filter(image => (image.comparisonId ?? null) === pairId)
          .map(image => figureCard(image, locale, runs, pairs)));
        cards.append(grid);
      }
    }
    if (!visible.length) cards.append(blank(ui.noMatch));
  };
  region.replaceChildren(filters(dimensions, current.gallery, redraw, locale), cards);
  redraw();
}

function figureContext(image, locale) {
  const ui = copy(locale);
  return definitions([
    [ui.category, image.category ?? image.field], [ui.scope, image.evaluationSet], [ui.unit, image.unit],
    [ui.reference, image.referenceType], [ui.operator, image.operator],
    [words(locale, 'Escala espacial', 'Spatial scale'), image.spatialScale],
    [words(locale, 'Escala de cores', 'Color scale'), image.colorScale],
  ], locale);
}

export function figureCard(image, locale, runs, pairs, { anchorId = true, compact = false } = {}) {
  const ui = copy(locale);
  const figure = node('figure', null, 'research-card scientific-figure');
  if (anchorId) figure.id = `figure-${image.id}`;
  figure.tabIndex = -1;
  const caption = titleOf(image.caption, locale);
  const alt = titleOf(image.alt, locale);
  const button = node('button', null, 'figure-trigger');
  button.type = 'button';
  const path = figurePath(image.path) ? `./${image.path}` : null;
  const run = runs.get(image.experimentId);
  const pair = pairs.get(image.comparisonId);
  const owner = () => run ? anchor(runName(run, locale), fragment('run', run.id))
    : pair ? anchor(pairName(pair, runs, locale), fragment('pair', pair.id)) : node('span');
  if (path) {
    const thumb = Object.assign(node('img'), { alt, loading: 'lazy', decoding: 'async' });
    thumb.addEventListener('error', () => { button.replaceChildren(blank(ui.figureOpenError)); button.disabled = true; });
    thumb.src = path;
    button.append(thumb);
    button.setAttribute('aria-label', `${ui.expand} · ${caption}`);
    button.addEventListener('click', () => enlarge(path, caption, alt, button, locale, image, owner));
    figure.append(button);
  }
  const text = node('figcaption');
  text.append(node('p', caption));
  if (run && !compact) text.append(runTimestamp(run, locale));
  if (!compact) text.append(figureContext(image, locale), owner(),
    audit(ui.source, definitions([[ui.source, [image.source.id, image.source.sha256]]], locale)));
  figure.append(text);
  return figure;
}

function enlarge(path, caption, alt, trigger, locale, image, owner) {
  const ui = copy(locale);
  const dialog = node('dialog', null, 'figure-dialog');
  const close = node('button', ui.close);
  const zoom = node('button', words(locale, 'Zoom 2×', 'Zoom 2×'));
  const controls = node('div', null, 'dialog-controls');
  controls.append(close, zoom);
  close.addEventListener('click', () => dialog.close());
  dialog.setAttribute('aria-label', caption);
  const viewport = node('div', null, 'figure-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', caption);
  const full = Object.assign(node('img'), { alt, src: path });
  zoom.setAttribute('aria-pressed', 'false');
  zoom.addEventListener('click', () => {
    zoom.setAttribute('aria-pressed', String(viewport.classList.toggle('zoomed')));
  });
  viewport.append(full);
  const link = owner();
  link.addEventListener('click', () => dialog.close());
  dialog.append(controls, viewport, node('p', caption), figureContext(image, locale), link);
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); }, { once: true });
  dialog.showModal();
  close.focus();
}

export function renderLiterature(region, data, context, locale) {
  const ui = copy(locale);
  if (!data.literature.length && !context.manuscript) {
    region.replaceChildren(blank(ui.emptyLiterature));
    return;
  }
  const list = node('ul', null, 'entries bibliography-list');
  const controls = node('label', ui.bibliographySearch, 'bibliography-search');
  const input = Object.assign(node('input'), { type: 'search' });
  controls.append(input);
  const status = node('p', null, 'metadata');
  status.setAttribute('role', 'status');
  const runs = index(data.experiments);
  const hypotheses = index(context.hypotheses);
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale);

  function draw() {
    const query = normalize(input.value.trim());
    const records = data.literature.filter(item => normalize([
      titleOf(item.title, locale), ...(item.authors ?? []), item.year, item.venue, item.doi,
    ].filter(Boolean).join(' ')).includes(query));
    list.replaceChildren();
    for (const item of records) {
      const row = node('li');
      const title = node('cite', null, 'bibliography-title');
      title.append(item.url ? outside(titleOf(item.title, locale), item.url) : titleOf(item.title, locale));
      const publication = [item.authors?.join(' · '), item.year, item.venue].filter(Boolean).join(' — ');
      const kind = {
        preprint: 'Preprint',
        article: words(locale, 'Artigo', 'Journal article'),
        book: words(locale, 'Livro', 'Book'),
        manual: words(locale, 'Manual', 'Manual'),
      }[item.kind];
      const identifier = [kind, item.doi && `DOI ${item.doi}`, item.isbn && `ISBN ${item.isbn}`].filter(Boolean).join(' · ');
      row.append(title);
      if (publication) row.append(node('p', publication, 'detail'));
      if (identifier) row.append(node('p', identifier, 'metadata'));
      if (item.summary) row.append(node('p', titleOf(item.summary, locale), 'detail'));
      row.append(linked(ui.experiments, item.experimentIds, runs, 'run', runName, locale),
        linked(ui.hypothesis, item.hypothesisIds, hypotheses, 'hypothesis',
          (record, language) => titleOf(record.title, language), locale));
      list.append(row);
    }
    status.textContent = records.length ? words(locale, `${records.length} referências`, `${records.length} references`) : ui.noMatch;
  }
  region.replaceChildren();
  if (context.manuscript) region.append(node('p', context.manuscript.title),
    node('p', titleOf(context.manuscript.status, locale), 'metadata'));
  if (data.literature.length) {
    region.append(controls, status, list);
    input.addEventListener('input', draw);
    draw();
  }
}

export function renderDashboard(region, context, priorities, locale) {
  const ui = copy(locale);
  const active = context.hypotheses.filter(hypothesis => hypothesis.active);
  const hypotheses = node('details', null, 'overview-hypotheses');
  hypotheses.append(node('summary', ui.activeHypotheses));
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
  if (location.hash.startsWith('#hypothesis-') || location.hash.startsWith('#/hipoteses/')) hypotheses.open = true;


  const changes = node('div', null, 'dashboard-grid');
  const recent = node('section', null, 'dashboard-panel');
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
  const next = node('section', null, 'dashboard-panel');
  next.append(node('h2', ui.priorities));
  const actions = node('ul', null, 'overview-list');
  for (const item of priorities.filter(entry => entry.status !== 'done').sort((a,b) => a.order - b.order).slice(0,3)) {
    actions.append(node('li', translated(locale === 'en' ? item.en?.title ?? item.title : item.title, locale)));
  }
  next.append(actions.childElementCount ? actions : blank(ui.noMatch), anchor(ui.priorities, '#priorities'));
  changes.append(recent, next);
  const featured = node('section', null, 'dashboard-panel');
  featured.append(node('h2', ui.featured));
  if (context.groups.length) {
    const groups = node('ul', null, 'featured-list');
    for (const group of context.groups.slice(0, 3)) {
      const item = node('li');
      item.append(anchor(titleOf(group.title, locale), fragment('group', group.id)));
      groups.append(item);
    }
    featured.append(groups);
  } else featured.append(blank(ui.emptyExperiments));
  region.replaceChildren(featured, changes, hypotheses);
}
