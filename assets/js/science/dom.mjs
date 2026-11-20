import { date, external } from './contracts.mjs';
import { copy, label, translated } from './copy.mjs';

export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export const anchor = (text, href) => Object.assign(node('a', text), { href });
export function outside(text, url) {
  const safe = external(url);
  return safe ? Object.assign(anchor(text, safe), { target: '_blank', rel: 'noopener noreferrer' }) : node('span', text);
}
export const blank = message => node('p', message, 'empty science-empty');
export const badge = (status, locale) => node('span', label(status, locale), `badge badge-${status}`);
export function when(value, locale) {
  if (!date(value)) return node('span', copy(locale).notInformed);
  return Object.assign(node('time', new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeZone: 'UTC',
  }).format(new Date(value))), { dateTime: value });
}
export const number = (value, locale) => Number.isFinite(value) ? new Intl.NumberFormat(locale, {
  maximumSignificantDigits: 6,
}).format(value) : copy(locale).notInformed;
export const fraction = (value, locale) => Number.isFinite(value) ? new Intl.NumberFormat(locale, {
  style: 'percent', maximumFractionDigits: 2,
}).format(value) : copy(locale).notInformed;
export const valueOf = (value, locale) => value == null || value === '' ? copy(locale).notInformed
  : Array.isArray(value) ? value.length ? value.map(item => valueOf(item, locale)).join(', ') : copy(locale).notInformed
    : typeof value === 'number' ? number(value, locale)
      : typeof value === 'object' ? Object.entries(value).filter(([, item]) => item != null)
        .map(([key, item]) => `${key} ${valueOf(item, locale)}`).join(' · ') || copy(locale).notInformed
        : label(value, locale);
export const titleOf = (value, locale) => translated(value, locale) ?? copy(locale).notInformed;
export const runTitle = run => run.runId ?? run.id;
const paths = { group: 'resultados', event: 'evolucao', pair: 'comparacoes', run: 'execucoes' };
export const fragment = (type, key) => paths[type]
  ? `#/${paths[type]}/${encodeURIComponent(key)}` : `#${type}-${encodeURIComponent(key)}`;

export function definitions(fields, locale) {
  const dl = node('dl', null, 'facts');
  for (const [title, value] of fields) {
    const item = node('div');
    const description = node('dd');
    description.append(value instanceof Node ? value : valueOf(value, locale));
    item.append(node('dt', title), description);
    dl.append(item);
  }
  return dl;
}

export function linked(title, keys, source, type, render, locale) {
  const group = node('div', null, 'reference-list');
  const items = (keys ?? []).filter(key => source.has(key));
  if (!items.length) return group;
  group.append(node('span', title, 'metadata'));
  for (const key of items) group.append(anchor(render(source.get(key), locale), fragment(type, key)));
  return group;
}

export function select(label, selected, options, onChange) {
  const wrapper = node('label', label, 'select-field');
  const input = node('select');
  for (const [value, title] of options) input.append(Object.assign(node('option', title), { value }));
  if (options.some(([value]) => value === selected)) input.value = selected;
  input.addEventListener('change', () => onChange(input.value));
  wrapper.append(input);
  return wrapper;
}

export function filters(dimensions, state, onChange, locale, resetExtra) {
  const bar = node('div', null, 'filter-bar');
  for (const { key, title, values } of dimensions) {
    const options = [['', copy(locale).all], ...values];
    const field = select(title, state[key], options, value => {
      state[key] = value;
      onChange();
    });
    field.querySelector('select').dataset.filter = key;
    bar.append(field);
  }
  const clear = node('button', copy(locale).clear);
  clear.type = 'button';
  clear.addEventListener('click', () => {
    for (const key of Object.keys(state)) delete state[key];
    bar.querySelectorAll('select[data-filter]').forEach(input => { input.value = ''; });
    resetExtra?.();
    onChange();
  });
  bar.append(clear);
  return bar;
}
export function options(records, values, format = value => value) {
  return [...new Set(records.flatMap(record => values(record)).filter(value => value != null))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map(value => [String(value), format(value)]);
}

export function table(headers, rows, caption) {
  const wrap = node('div', null, 'table-scroll');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', caption);
  const data = node('table');
  const head = data.createTHead().insertRow();
  for (const title of headers) head.append(Object.assign(node('th', title), { scope: 'col' }));
  const body = data.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const content of row) tr.insertCell().append(content);
  }
  wrap.append(data);
  return wrap;
}
