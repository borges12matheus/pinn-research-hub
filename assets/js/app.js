import { loadData } from './data.js';
import { renderPage, setUpdatesExpanded } from './render.js';
import { createSciencePortal, routeFor } from './science/portal.mjs';

function syncNavigation() {
  const { section } = routeFor(window.location.hash);
  const active = ['investigation', 'experiments', 'comparison', 'figures', 'reevaluations'].includes(section) ? 'results'
    : section === 'justification' ? 'overview'
      : ['updates', 'priorities'].includes(section) || section.startsWith('roadmap') ? 'roadmap'
      : ['publications', 'literature'].includes(section) ? 'resources' : section;
  document.querySelectorAll('#navigation a').forEach(link => {
    if (routeFor(link.hash).section === active) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('main-content').focus();
});
syncNavigation();

const result = await loadData();
let locale = 'pt-BR';
let updatesExpanded = false;

renderPage(result, locale, updatesExpanded);
const science = createSciencePortal(result.data);
window.addEventListener('hashchange', () => {
  syncNavigation();
  void science.route(window.location.hash);
});
void science.route(window.location.hash);

document.getElementById('language').addEventListener('click', () => {
  locale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  renderPage(result, locale, updatesExpanded);
  science.setLocale(locale);
});

document.getElementById('updates-toggle').addEventListener('click', () => {
  updatesExpanded = !updatesExpanded;
  setUpdatesExpanded(updatesExpanded);
});
