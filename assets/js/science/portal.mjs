import { catalogFilters } from './catalog-data.mjs';
import { renderAnalytics } from './analytics.mjs';
import { collections, id, index, validateCollection, validateOverview } from './contracts.mjs';
import { copy } from './copy.mjs';
import { anchor, blank, fragment, linked, node, titleOf, valueOf } from './dom.mjs';
import { pairName, phaseOf, runName, words } from './presentation.mjs';
import { renderInvestigations, renderInvestigation } from './investigation.mjs';
import { comparisonMeasurements, renderCatalog, renderComparator, renderReevaluations } from './results.mjs';
import { figureCard, renderDashboard, renderGallery, renderLiterature, renderTimeline } from './research.mjs';

const regions = ['timeline', 'results', 'investigation', 'experiments', 'comparison', 'figures', 'literature', 'reevaluations'];
const emptyContext = { phases: [], hypotheses: [], decisions: [], groups: [], recent: [], baseline: null };
const routePatterns = [
  ['run', 'experiments', 'execucoes'], ['pair', 'comparison', 'comparacoes'], ['event', 'timeline', 'evolucao'],
  ['group', 'investigation', 'resultados'], ['figure', 'figures', 'figuras'], ['hypothesis', 'overview', 'hipoteses'],
];
const entryRoutes = new Map([['/evolucao', 'timeline'], ['/resultados', 'results'], ['/figuras', 'figures'], ['/execucoes', 'experiments'], ['/reavaliacoes', 'reevaluations'], ['/bibliografia-semanal', 'weekly-literature']]);

export function routeFor(hash) {
  let key;
  try { key = decodeURIComponent(hash.split('?')[0].replace(/^#/, '')); } catch { return { section: 'overview', key: 'overview' }; }
  for (const [type, section, path] of routePatterns) {
    const prefix = key.startsWith('/') ? `/${path}/` : `${type}-`;
    if (!key.startsWith(prefix)) continue;
    const record = key.slice(prefix.length);
    if (id(record)) return { section, key: `${type}-${record}`, type, record };
  }
  const section = entryRoutes.get(key) ?? (id(key) ? key : 'overview');
  return { section, key: section };
}

async function json(name) {
  const response = await fetch(`./data/${name}.json`, { cache: 'no-cache' });
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  return response.json();
}

export function createSciencePortal(editorial) {
  const localReview = document.documentElement.hasAttribute('data-local-review') && location.hostname === '127.0.0.1';
  const data = Object.fromEntries(collections.map(name => [name, []]));
  const requests = new Map();
  const errors = new Map();
  const loaded = new Set();
  const state = { catalog: {}, timeline: {}, gallery: {}, investigations: {} };
  let context = emptyContext;
  let locale = 'pt-BR';
  let routeVersion = 0;
  const requestContext = json('overview').then(validateOverview).then(result => { context = result; }, error => { errors.set('overview', error.status); });
  const get = name => {
    if (!requests.has(name)) requests.set(name, json(name).then(result => validateCollection(name, result, { localReview }))
      .then(result => { data[name] = result; }, error => { errors.set(name, error.status); }));
    return requests.get(name);
  };

  const required = (section, detail) => ({
    timeline: ['timeline', 'experiments', 'comparisons'],
    results: ['timeline', 'experiments', 'comparisons'],
    investigation: ['timeline', 'experiments', 'comparisons', 'metrics', 'figures', 'evaluations'],
    experiments: detail ? ['experiments', 'metrics', 'comparisons', 'figures', 'evaluations'] : ['experiments'],
    reevaluations: ['evaluations', 'experiments', 'metrics'],
    comparison: ['comparisons', 'experiments', 'metrics', 'figures'],
    figures: ['figures', 'experiments', 'comparisons'],
    literature: ['literature', 'experiments'],
  })[section] ?? [];
  const primary = section => section === 'comparison' ? 'comparisons' : section;

  function failure(message, names) {
    const files = names.filter(name => errors.has(name)).map(name => {
      const status = errors.get(name);
      return `${name}.json${status ? ` (HTTP ${status})` : ''}`;
    });
    const problem = blank(`${message} ${files.join(', ')}`);
    problem.setAttribute('role', 'status');
    return problem;
  }

  function render(section) {
    const region = document.querySelector(`[data-science-region="${section}"]`);
    const ui = copy(locale);
    if (errors.has(primary(section))) {
      region.replaceChildren(failure(ui.unavailable, [primary(section)]));
      return;
    }
    if (section === 'timeline') renderTimeline(region, data, context, state, locale);
    if (section === 'results') renderInvestigations(region, data, context, state.investigations, locale);
    if (section === 'investigation') renderInvestigation(region, data, context, state.groupId, locale);
    if (section === 'experiments') renderCatalog(region, data, context, state, locale, async runId => {
      await get('training');
      return data.training.find(item => item.experimentId === runId);
    });
    if (section === 'reevaluations') renderReevaluations(region, data, locale);
    if (section === 'comparison') renderComparator(region, data, state, locale, context);
    if (section === 'figures') renderGallery(region, data, state, locale, context);
    if (section === 'literature') renderLiterature(region, data, context, locale);
    const dependencies = required(section, state.runId);
    if (dependencies.some(name => errors.has(name))) region.prepend(failure(ui.partialData, dependencies));
  }

  function renderEditorialLinks() {
    document.querySelectorAll('[data-editorial-links]').forEach(region => {
      const collection = region.dataset.editorialLinks;
      const record = editorial[collection]?.find(item => item.id === region.dataset.record);
      if (!record) return;
      const ui = copy(locale);
      region.replaceChildren(
        linked(ui.hypothesis, record.hypothesisIds, index(context.hypotheses), 'hypothesis', (item, language) => titleOf(item.title, language), locale),
        linked(ui.experiments, record.experimentIds, index(data.experiments), 'run', runName, locale),
        linked(ui.comparison, record.comparisonIds, index(data.comparisons), 'pair', item => pairName(item, index(data.experiments), locale), locale),
        linked(ui.timeline, record.eventIds, index(data.timeline), 'event', (item, language) => titleOf(item.title, language), locale),
      );
    });
  }

  async function drawOverviewVisual() {
    const cue = context.visual;
    const target = document.getElementById('overview-visual');
    if (!cue) return;
    const figure = cue.type === 'figure';
    await Promise.all(['experiments', 'comparisons', figure ? 'figures' : 'metrics'].map(get));
    const title = words(locale, 'Resultado em destaque', 'Featured result');
    const runs = index(data.experiments);
    const pairs = index(data.comparisons);
    const record = (figure ? index(data.figures) : pairs).get(cue.id);
    if (!record) return;
    const body = figure ? figureCard(record, locale, runs, pairs, { anchorId: false, compact: true })
      : comparisonMeasurements(record, data, locale, { chartsOnly: true, limit: 1 });
    if (!body.childElementCount) return;
    const owner = context.groups.find(group => group.comparisonIds.includes(record.comparisonId ?? cue.id)
      || group.experimentIds.includes(record.experimentId));
    const link = anchor(copy(locale).explore, owner ? fragment('group', owner.id) : fragment(figure ? 'figure' : 'pair', cue.id));
    const description = node('div', null, 'featured-reading');
    description.append(node('h2', title));
    if (figure) {
      description.append(node('p', [valueOf(record.evaluationSet, locale), valueOf(record.unit, locale),
        valueOf(record.operator, locale)].join(' · '), 'metadata'));
      if (owner?.readingNote) description.append(node('p', titleOf(owner.readingNote, locale)));
    }
    description.append(link);
    target.replaceChildren(description, body);
    target.className = 'panel overview-visual';
    target.hidden = false;
  }

  function drawOverview() {
    const target = document.getElementById('scientific-dashboard');
    const feature = document.getElementById('overview-visual');
    renderDashboard(target, context, editorial.priorities, locale);
    const analytics = errors.has('experiments') ? failure(copy(locale).unavailable, ['experiments'])
      : data.experiments.length || requests.has('experiments') ? renderAnalytics(data.experiments, context,
        catalogFilters(location.hash), localReview, locale) : blank(copy(locale).loading);
    target.prepend(analytics, feature);
    if (errors.has('overview')) target.prepend(failure(copy(locale).partialData, ['overview']));
    const phase = context.currentPhaseId ?? editorial.project?.currentPhase;
    document.getElementById('current-phase').textContent = phaseOf(context, phase, locale);
    const review = document.getElementById('review-badge');
    review.hidden = !localReview;
    review.textContent = localReview ? words(locale, 'Revisão local', 'Local review') : '';
    review.title = localReview ? copy(locale).localReview : '';
    if (!document.getElementById('overview').hidden) void drawOverviewVisual();
  }

  async function show(section, detail, version) {
    const needs = required(section, detail);
    await Promise.all([requestContext, ...needs.map(get)]);
    if (version !== routeVersion) return;
    loaded.add(section);
    render(section);
    renderEditorialLinks();
  }

  async function route(hash) {
    const version = ++routeVersion;
    const destination = routeFor(hash);
    state.catalog = catalogFilters(hash);
    const typeKeys = { run: 'runId', pair: 'pairId', event: 'eventId', figure: 'figureId', group: 'groupId' };
    for (const [type, key] of Object.entries(typeKeys)) state[key] = destination.type === type ? destination.record : null;

    const activity = ['updates', 'priorities'].includes(destination.section);
    const resource = ['literature', 'publications'].includes(destination.section);
    const roadmap = destination.section.startsWith('roadmap');
    const main = document.getElementById('main-content');
    const view = resource ? 'resources' : roadmap ? 'roadmap'
      : [...regions, 'overview', 'resources', 'weekly-literature'].includes(destination.section) ? destination.section : 'overview';
    for (const child of main.children) {
      child.hidden = child.classList.contains('activity-grid') ? !(activity || roadmap) : activity || child.id !== view;
    }
    if (regions.includes(destination.section)) {
      const region = document.querySelector(`[data-science-region="${destination.section}"]`);
      if (region) region.replaceChildren(node('p', copy(locale).loading, 'science-placeholder'));
      await show(destination.section, destination.type === 'run', version);
    }
    if (view === 'overview') {
      await Promise.all([requestContext, get('experiments')]);
      if (version === routeVersion) drawOverview();
    }
    if (roadmap || activity || view === 'resources') {
      const records = [...editorial.roadmap, ...editorial.priorities, ...editorial.publications];
      const dependencies = [['experimentIds', 'experiments'], ['comparisonIds', 'comparisons'], ['eventIds', 'timeline']];
      await Promise.all(dependencies.filter(([field]) => records.some(record => record[field]?.length)).map(([, name]) => get(name)));
      if (view === 'resources' && destination.section !== 'literature') await show('literature', false, version);
      renderEditorialLinks();
    }
    if (version !== routeVersion || !hash || destination.section === 'main-content') return;
    const container = document.getElementById(view);
    const target = [...main.querySelectorAll(`#${CSS.escape(destination.key)}`)].find(element => !element.closest('[hidden]'))
      ?? container;
    if (target && !target.closest('[hidden]')) {
      target.tabIndex = -1;
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    }
  }

  function setLocale(value) {
    locale = value;
    document.querySelectorAll('[data-science]').forEach(element => { element.textContent = copy(locale)[element.dataset.science]; });
    for (const section of regions) {
      if (loaded.has(section)) render(section);
      else {
        const loading = node('p', copy(locale).loading, 'science-placeholder');
        loading.setAttribute('role', 'status');
        document.querySelector(`[data-science-region="${section}"]`).replaceChildren(loading);
      }
    }
    drawOverview();
    renderEditorialLinks();
  }

  setLocale(locale);
  return { setLocale, route };
}
