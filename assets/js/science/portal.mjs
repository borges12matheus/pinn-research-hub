import { collections, id, index, validateCollection, validateOverview } from './contracts.mjs';
import { copy } from './copy.mjs';
import { blank, linked, node, runTitle, titleOf } from './dom.mjs';
import { renderCatalog, renderComparator } from './results.mjs';
import { renderDashboard, renderGallery, renderLiterature, renderTimeline } from './research.mjs';

const regions = ['timeline', 'experiments', 'comparison', 'figures', 'literature'];
const emptyContext = { phases: [], hypotheses: [], decisions: [], groups: [], recent: [], baseline: null };
const routePatterns = [['run', 'experiments'], ['pair', 'comparison'], ['event', 'timeline'], ['figure', 'figures'], ['hypothesis', 'overview']];

export function routeFor(hash) {
  let key;
  try { key = decodeURIComponent(hash.replace(/^#/, '')); } catch { return { section: 'overview', key: 'overview' }; }
  const match = routePatterns.find(([prefix]) => key.startsWith(`${prefix}-`) && id(key.slice(prefix.length + 1)));
  return match ? { section: match[1], key, type: match[0], record: key.slice(match[0].length + 1) }
    : { section: key || 'overview', key: key || 'overview' };
}

async function json(name) {
  const response = await fetch(`./data/${name}.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function createSciencePortal(editorial) {
  const localReview = document.documentElement.hasAttribute('data-local-review') && location.hostname === '127.0.0.1';
  const data = Object.fromEntries(collections.map(name => [name, []]));
  const requests = new Map();
  const errors = new Set();
  const loaded = new Set();
  const state = { catalog: {}, timeline: {}, gallery: {}, openEvents: new Set() };
  let context = emptyContext;
  let locale = 'pt-BR';
  let routeVersion = 0;
  const requestContext = json('overview').then(validateOverview).then(result => { context = result; }, () => { errors.add('overview'); });
  const get = name => {
    if (!requests.has(name)) requests.set(name, json(name).then(result => validateCollection(name, result, { localReview }))
      .then(result => { data[name] = result; }, () => { errors.add(name); }));
    return requests.get(name);
  };

  const required = (section, detail) => ({
    timeline: ['timeline', 'experiments', 'comparisons'],
    experiments: detail ? ['experiments', 'metrics', 'comparisons', 'figures'] : ['experiments'],
    comparison: ['comparisons', 'experiments', 'metrics', 'figures'],
    figures: ['figures'],
    literature: ['literature', 'experiments'],
  })[section] ?? [];
  const primary = section => section === 'comparison' ? 'comparisons' : section;

  function render(section) {
    const region = document.querySelector(`[data-science-region="${section}"]`);
    const ui = copy(locale);
    if (errors.has(primary(section))) {
      const problem = blank(ui.unavailable);
      problem.setAttribute('role', 'status');
      region.replaceChildren(problem);
      return;
    }
    if (section === 'timeline') renderTimeline(region, data, context, state, locale);
    if (section === 'experiments') renderCatalog(region, data, context, state, locale);
    if (section === 'comparison') renderComparator(region, data, state, locale);
    if (section === 'figures') renderGallery(region, data, state, locale);
    if (section === 'literature') renderLiterature(region, data, context, locale);
    if (required(section, state.runId).some(name => errors.has(name))) {
      const problem = blank(ui.partialData);
      problem.setAttribute('role', 'status');
      region.prepend(problem);
    }
  }

  function renderEditorialLinks() {
    document.querySelectorAll('[data-editorial-links]').forEach(region => {
      const collection = region.dataset.editorialLinks;
      const record = editorial[collection]?.find(item => item.id === region.dataset.record);
      if (!record) return;
      const ui = copy(locale);
      region.replaceChildren(
        linked(ui.hypothesis, record.hypothesisIds, index(context.hypotheses), 'hypothesis', (item, language) => titleOf(item.title, language), locale),
        linked(ui.experiments, record.experimentIds, index(data.experiments), 'run', runTitle, locale),
        linked(ui.comparison, record.comparisonIds, index(data.comparisons), 'pair', item => item.id, locale),
        linked(ui.timeline, record.eventIds, index(data.timeline), 'event', (item, language) => titleOf(item.title, language), locale),
      );
    });
  }

  function drawOverview() {
    const target = document.getElementById('scientific-dashboard');
    renderDashboard(target, context, editorial.project, editorial.priorities, locale, async () => {
      await get('metrics');
      return errors.has('metrics') ? null : data.metrics;
    });
    if (errors.has('overview')) target.prepend(blank(copy(locale).partialData));
    if (localReview) target.prepend(node('p', copy(locale).localReview, 'notice'));
  }

  async function show(section, detail) {
    const needs = required(section, detail);
    await Promise.all([requestContext, ...needs.map(get)]);
    loaded.add(section);
    render(section);
    renderEditorialLinks();
  }

  async function route(hash) {
    const version = ++routeVersion;
    const destination = routeFor(hash);
    const typeKeys = { run: 'runId', pair: 'pairId', event: 'eventId', figure: 'figureId' };
    if (destination.type && typeKeys[destination.type]) {
      state[typeKeys[destination.type]] = destination.record;
    } else if (destination.section === 'experiments') {
      state.runId = null;
    } else if (destination.section === 'timeline') {
      state.eventId = null;
    } else if (destination.section === 'figures') {
      state.figureId = null;
    }

    if (regions.includes(destination.section)) await show(destination.section, destination.type === 'run');
    if (destination.type === 'hypothesis') { await requestContext; drawOverview(); }
    if (destination.section === 'roadmap' || destination.section === 'priorities' || destination.section === 'resources') {
      const records = [...editorial.roadmap, ...editorial.priorities, ...editorial.publications];
      const dependencies = [['experimentIds', 'experiments'], ['comparisonIds', 'comparisons'], ['eventIds', 'timeline']];
      await Promise.all(dependencies.filter(([field]) => records.some(record => record[field]?.length)).map(([, name]) => get(name)));
      renderEditorialLinks();
    }
    if (version === routeVersion && destination.type) {
      const element = document.getElementById(destination.key);
      if (element) {
        element.scrollIntoView({ block: 'start' });
        element.focus({ preventScroll: true });
      } else if (regions.includes(destination.section)) {
        const region = document.querySelector(`[data-science-region="${destination.section}"]`);
        region.prepend(blank(copy(locale).notInformed));
        document.getElementById(destination.section).scrollIntoView({ block: 'start' });
      }
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

  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver(entries => {
      for (const entry of entries.filter(item => item.isIntersecting)) {
        const section = entry.target.dataset.scienceRegion;
        watch.unobserve(entry.target);
        if (!loaded.has(section)) void show(section, section === 'experiments' && state.runId);
      }
    });
    document.querySelectorAll('[data-science-region]').forEach(region => watch.observe(region));
  } else {
    for (const section of regions) void show(section, false);
  }
  void requestContext.then(() => { drawOverview(); renderEditorialLinks(); });
  setLocale(locale);
  return { setLocale, route };
}
