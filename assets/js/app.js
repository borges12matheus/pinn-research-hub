import { loadData } from './data.js';
import { renderPage, setUpdatesExpanded } from './render.js';

function syncNavigation() {
  const hash = window.location.hash || '#overview';
  document.querySelectorAll('#navigation a').forEach(link => {
    if (link.hash === hash) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

syncNavigation();
window.addEventListener('hashchange', syncNavigation);

const result = await loadData();
let locale = 'pt-BR';
let updatesExpanded = false;

renderPage(result, locale, updatesExpanded);

document.getElementById('language').addEventListener('click', () => {
  locale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  renderPage(result, locale, updatesExpanded);
});

document.getElementById('updates-toggle').addEventListener('click', () => {
  updatesExpanded = !updatesExpanded;
  setUpdatesExpanded(updatesExpanded);
});
