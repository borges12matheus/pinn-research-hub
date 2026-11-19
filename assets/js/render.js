import { getExternalUrl } from './data.js';

const messages = {
  'pt-BR': {
    skip: 'Pular para conteúdo',
    navigation: 'Navegação principal',
    overview: 'Visão geral',
    roadmap: 'Roadmap',
    updates: 'Atualizações',
    priorities: 'Prioridades',
    resources: 'Recursos',
    publications: 'Publicações',
    phase: 'Fase atual',
    updated: 'Última atualização',
    milestones: 'Marcos concluídos',
    milestoneCaption: total => `de ${total} marcos concluídos`,
    activePriorities: 'Atividades abertas',
    registeredPublications: 'Publicações registradas',
    loading: 'Carregando dados da pesquisa…',
    demo: 'Dados iniciais demonstrativos — revise antes de divulgar.',
    footer: 'Este portal documenta a evolução da pesquisa. A validação dos resultados ocorre nos trabalhos científicos.',
    projectError: 'Não foi possível carregar os dados da pesquisa. Confira data/project.json e sirva a página via HTTP.',
    collectionError: name => `Não foi possível carregar os dados. Confira data/${name}.json.`,
    emptyRoadmap: 'Nenhum marco cadastrado.',
    emptyUpdates: 'Nenhuma atualização registrada.',
    emptyPriorities: 'Nenhuma prioridade aberta no momento.',
    emptyResources: 'Nenhum recurso cadastrado.',
    emptyPublications: 'Nenhuma publicação cadastrada.',
    targetDate: 'Previsão',
    showAll: 'Ver todas',
    showLess: 'Mostrar menos',
    statuses: {
      planned: 'Planejado', in_progress: 'Em andamento', completed: 'Concluído', blocked: 'Bloqueado',
      open: 'Aberta', draft: 'Rascunho', internal_review: 'Em revisão interna', submitted: 'Submetida', accepted: 'Aceita', published: 'Publicada',
    },
  },
  en: {
    skip: 'Skip to content',
    navigation: 'Main navigation',
    overview: 'Overview',
    roadmap: 'Roadmap',
    updates: 'Updates',
    priorities: 'Priorities',
    resources: 'Resources',
    publications: 'Publications',
    phase: 'Current phase',
    updated: 'Last updated',
    milestones: 'Completed milestones',
    milestoneCaption: total => `of ${total} milestones completed`,
    activePriorities: 'Open activities',
    registeredPublications: 'Registered publications',
    loading: 'Loading research data…',
    demo: 'Initial sample data — review before sharing.',
    footer: 'This hub documents the progress of the research. Results are validated in the scientific work.',
    projectError: 'Could not load research data. Check data/project.json and serve the page over HTTP.',
    collectionError: name => `Could not load data. Check data/${name}.json.`,
    emptyRoadmap: 'No milestones listed.',
    emptyUpdates: 'No updates recorded.',
    emptyPriorities: 'There are no open priorities at the moment.',
    emptyResources: 'No resources listed.',
    emptyPublications: 'No publications listed.',
    targetDate: 'Target date',
    showAll: 'Show all',
    showLess: 'Show fewer',
    statuses: {
      planned: 'Planned', in_progress: 'In progress', completed: 'Completed', blocked: 'Blocked',
      open: 'Open', draft: 'Draft', internal_review: 'In internal review', submitted: 'Submitted', accepted: 'Accepted', published: 'Published',
    },
  },
};

const limit = 5;
const byId = id => document.getElementById(id);
const compareIds = (a, b) => a.id < b.id ? -1 : Number(a.id > b.id);
const byOrder = (a, b) => a.order - b.order || compareIds(a, b);
const activePriorities = priorities => priorities.filter(item => item.status === 'open' || item.status === 'in_progress');

export function getCounts({ roadmap, priorities, publications }) {
  return {
    completed: roadmap.filter(item => item.status === 'completed').length,
    milestones: roadmap.length,
    open: activePriorities(priorities).length,
    publications: publications.length,
  };
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function localized(record, field, locale) {
  const translation = locale === 'en' ? record.en?.[field] : undefined;
  return typeof translation === 'string' && translation.trim() ? translation : record[field];
}

function dateElement(date, locale) {
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });
  const node = element('time', formatter.format(new Date(date)));
  node.dateTime = date;
  return node;
}

function statusElement(status, labels) {
  const knownStatus = Object.hasOwn(labels, status);
  const node = element('span', knownStatus ? labels[status] : status, 'status');
  if (knownStatus) node.classList.add(`status-${status}`);
  return node;
}

function externalTitle(title, value) {
  const url = getExternalUrl(value);
  if (!url) return element('span', title);

  const anchor = element('a', title);
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function renderOverview({ data, errors }, locale, copy) {
  const { project } = data;
  const name = project?.name ?? 'PINN Research Hub';
  document.title = name;
  byId('brand-name').textContent = name;
  byId('footer-name').textContent = name;
  byId('research-title').textContent = project ? localized(project, 'researchTitle', locale) : name;
  byId('research-summary').textContent = project ? localized(project, 'summary', locale) : '';
  byId('phase-group').hidden = !project;
  byId('last-updated').hidden = !project;
  byId('demo-notice').hidden = !project?.isDemoData;
  byId('project-error').hidden = !errors.has('project');

  if (project) {
    byId('current-phase').textContent = localized(project, 'currentPhase', locale);
    byId('last-updated').replaceChildren(`${copy.updated} · `, dateElement(project.lastUpdated, locale));
    const year = project.lastUpdated.slice(0, 4);
    byId('footer-year').dateTime = year;
    byId('footer-year').textContent = year;
  } else {
    byId('project-error').textContent = copy.projectError;
  }

  const counts = getCounts(data);
  byId('milestone-count').replaceChildren(
    String(counts.completed), ' ', element('small', copy.milestoneCaption(counts.milestones)),
  );
  byId('priority-count').textContent = counts.open;
  byId('publication-count').textContent = counts.publications;
  byId('stats').hidden = false;
}

function editorialLinks(collection, record) {
  const group = element('div');
  group.dataset.editorialLinks = collection;
  group.dataset.record = record.id;
  return group;
}

function renderCollection(name, records, errors, copy, emptyText, renderItem, listTag = 'ul') {
  const region = byId(`${name}-content`);
  if (errors.has(name)) {
    const warning = element('p', copy.collectionError(name), 'notice error');
    warning.setAttribute('role', 'status');
    region.replaceChildren(warning);
    return;
  }
  if (records.length === 0) {
    region.replaceChildren(element('p', emptyText, 'empty'));
    return;
  }

  const list = element(listTag, undefined, 'entries');
  list.id = `${name}-list`;
  list.setAttribute('role', 'list');
  records.forEach((record, index) => list.append(renderItem(record, index)));
  region.replaceChildren(list);
}

export function setUpdatesExpanded(expanded) {
  const button = byId('updates-toggle');
  const list = byId('updates-list');
  const count = list?.children.length ?? 0;
  button.hidden = count <= limit;
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = messages[document.documentElement.lang][expanded ? 'showLess' : 'showAll'];

  if (list) {
    for (const item of Array.from(list.children).slice(limit)) item.hidden = !expanded;
  }
}

export function renderPage(result, locale, updatesExpanded) {
  const { data, errors } = result;
  const copy = messages[locale];
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-ui]').forEach(node => {
    node.textContent = copy[node.dataset.ui];
  });
  byId('navigation').setAttribute('aria-label', copy.navigation);
  const language = byId('language');
  language.lang = locale === 'en' ? 'pt-BR' : 'en';
  language.textContent = locale === 'en' ? 'PT' : 'EN';
  language.setAttribute('aria-label', locale === 'en' ? 'Mudar para português' : 'Switch to English');
  language.hidden = false;

  renderOverview(result, locale, copy);
  const orderedRoadmap = [...data.roadmap].sort(byOrder);
  const milestones = new Map(orderedRoadmap.map((record, index) => [
    record.id, { anchor: `roadmap-item-${index + 1}`, title: localized(record, 'title', locale) },
  ]));
  renderCollection('roadmap', orderedRoadmap, errors, copy, copy.emptyRoadmap, record => {
    const milestone = milestones.get(record.id);
    const item = element('li');
    item.id = milestone.anchor;
    item.tabIndex = -1;
    const heading = element('div', undefined, 'entry-heading');
    heading.append(element('h3', milestone.title), statusElement(record.status, copy.statuses));
    item.append(heading, element('p', localized(record, 'description', locale), 'detail'));
    if (record.targetDate) {
      const target = element('p', `${copy.targetDate} · `, 'metadata');
      target.append(dateElement(record.targetDate, locale));
      item.append(target);
    }
    item.append(editorialLinks('roadmap', record));
    return item;
  }, 'ol');

  const newestFirst = [...data.updates].sort((a, b) => b.date.localeCompare(a.date) || compareIds(a, b));
  renderCollection('updates', newestFirst, errors, copy, copy.emptyUpdates, record => {
    const item = element('li');
    const metadata = element('div', undefined, 'metadata update-meta');
    metadata.append(dateElement(record.date, locale), element('span', localized(record, 'category', locale), 'category'));
    item.append(metadata, element('h3', localized(record, 'title', locale)),
      element('p', localized(record, 'summary', locale), 'detail'));
    return item;
  }, 'ol');
  setUpdatesExpanded(updatesExpanded);

  const orderedPriorities = activePriorities(data.priorities).sort(byOrder).slice(0, limit);
  renderCollection('priorities', orderedPriorities, errors, copy, copy.emptyPriorities, record => {
    const item = element('li');
    const heading = element('div', undefined, 'entry-heading');
    heading.append(element('h3', localized(record, 'title', locale)), statusElement(record.status, copy.statuses));
    item.append(heading);
    const milestone = milestones.get(record.roadmapId);
    if (milestone) {
      const link = element('a', milestone.title, 'metadata');
      link.href = `#${milestone.anchor}`;
      item.append(link);
    }
    item.append(editorialLinks('priorities', record));
    return item;
  }, 'ol');

  renderCollection('resources', data.resources, errors, copy, copy.emptyResources, record => {
    const item = element('li');
    const heading = element('h3');
    heading.append(externalTitle(localized(record, 'title', locale), record.url));
    item.append(heading, element('p', localized(record, 'description', locale), 'detail'));
    return item;
  });

  renderCollection('publications', data.publications, errors, copy, copy.emptyPublications, record => {
    const item = element('li', undefined, 'entry-heading');
    item.append(externalTitle(localized(record, 'title', locale), record.url), statusElement(record.status, copy.statuses),
      editorialLinks('publications', record));
    return item;
  });

  byId('loading').hidden = true;
}
