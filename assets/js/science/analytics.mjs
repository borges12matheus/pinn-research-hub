import { byRunTime, catalogURL, countBy, matchesRun, missing, reynoldsGroup, runCuration, runFamily, runsOverTime, runTime } from './catalog-data.mjs';
import { copy, label } from './copy.mjs';
import { anchor, blank, filters, node, number, options, select, titleOf } from './dom.mjs';
import { phaseOf, words } from './presentation.mjs';

export function timeLabel(value, locale, timezone = null) {
  if (!value) return words(locale, 'Data/hora não confirmadas', 'Date and time unconfirmed');
  const [date, clock] = value.split('T');
  const calendar = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(date));
  const offset = clock.match(/(?:Z|[+-]\d\d:\d\d)$/)?.[0];
  const localTime = clock.slice(0, 8);
  const zone = offset ? offset.replace('Z', 'UTC') : timezone ?? words(locale, 'fuso não informado', 'time zone unreported');
  return `${calendar}, ${localTime} · ${zone}`;
}

export function runTimestamp(run, locale) {
  const meta = runTime(run);
  const source = {
    run_metadata: words(locale, 'metadados do treino', 'training metadata'),
    log: words(locale, 'log original', 'original log'),
    manifest: words(locale, 'manifesto', 'manifest'),
    run_name: words(locale, 'nome do run', 'run name'),
  }[meta.executedAtSource];
  const host = node('span', null, 'run-timestamp');
  host.append(meta.executedAt ? Object.assign(node('time', timeLabel(meta.executedAt, locale, meta.timezone)), { dateTime: meta.executedAt })
    : node('span', timeLabel(null, locale)));
  if (source) host.append(node('small', `${meta.executedAtConfidence === 'confirmed'
    ? words(locale, 'Confirmado', 'Confirmed') : words(locale, 'Inferido', 'Inferred')} · ${source}`, 'metadata'));
  return host;
}

export function reynoldsLabel(key, locale) {
  if (key === missing) return copy(locale).notInformed;
  const codes = key.split(',').map(value => number(Number(value), locale));
  return codes.length > 1 ? `${words(locale, 'Multicaso', 'Multi-case')} · ${codes.join(' / ')}` : codes[0];
}

export function filteredRuns(runs, state, context) {
  const group = context.groups.find(item => item.id === state.investigation);
  const members = group ? new Set(group.experimentIds) : undefined;
  return runs.filter(run => matchesRun(run, state, members));
}

export function catalogToolbar(runs, context, state, onChange, locale, detail = false) {
  const ui = copy(locale);
  const caption = node('summary', words(locale, 'Filtros de execução', 'Run filters'));
  const panel = node('details', null, 'catalog-controls');
  panel.open = Object.values(state).some(Boolean) || detail && !matchMedia('(max-width: 42rem)').matches;
  const dims = [
    ['phase', ui.phase, run => [run.phaseId ?? missing], value => phaseOf(context, value, locale)],
    ['family', ui.model, run => [runFamily(run)]],
    ['re', ui.reynolds, run => [reynoldsGroup(run)], value => reynoldsLabel(value, locale)],
    ['turbulence', ui.turbulence, run => [run.turbulenceModel ?? missing]],
    ['curation', ui.curation, run => [runCuration(run)]],
    ['time', words(locale, 'Confiança temporal', 'Time confidence'), run => [runTime(run).executedAtConfidence]],
  ];
  if (detail) dims.push(['seed', ui.seed, run => [run.seed ?? missing]]);
  const dimensions = dims.map(([key, title, get, format]) => ({
    key, title, values: options(runs, get, format ?? (value => value === missing ? ui.notInformed : label(value, locale))),
  }));
  if (detail) dimensions.push(
    { key: 'investigation', title: words(locale, 'Investigação', 'Investigation'), values: context.groups.map(group => [
      group.id, titleOf(group.title, locale),
    ]) },
    { key: 'measures', title: ui.metrics, values: [
      ['with', words(locale, 'Com medições', 'With measurements')], ['without', words(locale, 'Sem medições', 'Without measurements')],
    ] },
  );
  const dates = [['from', words(locale, 'A partir de', 'From')], ['to', words(locale, 'Até', 'Through')]].map(([key, title]) => {
    const field = node('label', title, 'select-field');
    const input = Object.assign(node('input'), { type: 'date', value: state[key] ?? '' });
    input.addEventListener('change', () => { state[key] = input.value; onChange(); });
    field.append(input);
    return field;
  });
  const bar = filters(dimensions, state, onChange, locale, () => {
    for (const field of dates) field.querySelector('input').value = '';
  });
  bar.lastElementChild.before(...dates);
  panel.append(caption, bar);
  return panel;
}

function chart(title, entries, formatter, to, locale) {
  const section = node('section', null, 'activity-chart');
  section.append(node('h3', title));
  if (!entries.length) {
    section.append(blank(words(locale, 'Nenhuma execução neste recorte.', 'No runs in this selection.')));
    return section;
  }
  const maximum = Math.max(...entries.map(([, count]) => count));
  const list = node('ul', null, 'activity-bars');
  for (const [key, count] of entries) {
    const row = node('li');
    const bar = anchor('', to(key));
    const label = formatter(key);
    bar.setAttribute('aria-label', `${label} · ${number(count, locale)}`);
    const track = node('span', null, 'activity-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = node('span', null, 'activity-fill');
    fill.style.width = `${count / maximum * 100}%`;
    track.append(fill);
    bar.append(node('span', label), track, node('strong', number(count, locale)));
    row.append(bar);
    list.append(row);
  }
  section.append(list);
  return section;
}

function periodBounds(key, interval) {
  const first = key.length === 7 ? `${key}-01` : key;
  const last = new Date(first);
  if (interval === 'month') last.setUTCMonth(last.getUTCMonth() + 1, 0);
  if (interval === 'week') last.setUTCDate(last.getUTCDate() + 6);
  return [first, last.toISOString().slice(0, 10)];
}

export function renderAnalytics(runs, context, state, localReview, locale) {
  const ui = copy(locale);
  const panel = node('section', null, 'analytics-panel');
  const charts = node('div', null, 'activity-charts');
  const indicators = node('dl', null, 'analytics-kpis');
  const hint = node('p', null, 'metadata');
  hint.setAttribute('role', 'status');
  const link = anchor(words(locale, 'Consultar execuções', 'Browse runs'), catalogURL(state));
  link.className = 'action';
  let period = 'month';
  const granularity = select(words(locale, 'Agrupar por', 'Group by'), period, [
    ['day', words(locale, 'Dia', 'Day')], ['week', words(locale, 'Semana', 'Week')], ['month', words(locale, 'Mês', 'Month')],
  ], value => { period = value; draw(); });
  const scope = localReview ? words(locale, 'No catálogo importado desta revisão local', 'In the imported catalog for this local review')
    : words(locale, 'No catálogo público aprovado', 'In the approved public catalog');
  function draw(persist = false) {
    if (persist) history.replaceState(null, '', catalogURL(state, '#overview'));
    const catalog = filteredRuns(runs, state, context);
    const accepted = new Set(catalog.map(run => run.id));
    const timestamp = catalog.filter(run => runTime(run).executedAtConfidence === 'confirmed').sort(byRunTime)[0];
    const values = [
      [words(locale, 'Execuções no recorte', 'Runs in selection'), catalog.length,
        words(locale, 'Um registro por treino canônico.', 'One record per canonical training run.')],
      [words(locale, 'Selecionadas para publicação', 'Selected for publication'), catalog.filter(run => run.visibility === 'public').length,
        words(locale, 'Execuções com aprovação pública nesta projeção.', 'Runs with public approval in this projection.')],
      [words(locale, 'Investigações', 'Investigations'), context.groups.filter(group => group.experimentIds.some(id => accepted.has(id))).length,
        words(locale, 'Grupos com pelo menos um run no recorte.', 'Groups with at least one run in the selection.')],
      [words(locale, 'Comparações elegíveis', 'Eligible comparisons'), (context.eligibleGroups ?? []).filter(ids => ids.every(id => accepted.has(id))).length,
        words(locale, 'Pares com ao menos uma condição quantitativa validada.', 'Pairs with at least one validated quantitative condition.')],
      [words(locale, 'Último início confirmado', 'Latest confirmed start'), timestamp ? runTimestamp(timestamp, locale) : ui.notInformed,
        words(locale, 'Horários com offset têm prioridade na ordenação. Horários sem fuso seguem o calendário registrado.', 'Times with an offset sort first. Times without zones use the recorded calendar.')],
    ];
    indicators.replaceChildren(...values.map(([title, value, definition]) => {
      const item = node('div');
      const heading = node('dt', title);
      const info = node('abbr', ' ⓘ');
      info.title = `${definition} ${scope}.`;
      info.tabIndex = 0;
      info.setAttribute('aria-label', info.title);
      heading.append(info);
      const data = node('dd');
      data.append(typeof value === 'number' ? number(value, locale) : value);
      item.append(heading, data);
      return item;
    }));
    hint.textContent = runs.length ? `${scope} · ${catalog.length} / ${runs.length}` : scope;
    if (!runs.length) return;
    link.href = catalogURL(state);
    const by = key => [...countBy(catalog, key)].sort(([a], [b]) => a.localeCompare(b, locale, { numeric: true }));
    const time = runsOverTime(catalog, period);
    const activity = chart(words(locale, 'Atividade experimental', 'Experimental activity'), time.periods, value => value, key => {
      const [from, to] = periodBounds(key, period);
      return catalogURL({ ...state, from: state.from && state.from > from ? state.from : from,
        to: state.to && state.to < to ? state.to : to, measures: state.measures, time: 'confirmed' });
    }, locale);
    activity.append(node('p', words(locale, `Data pendente de confirmação · ${time.pending}`,
      `Date awaiting confirmation · ${time.pending}`), 'metadata'));
    const readable = value => value === missing ? ui.notInformed : label(value, locale);
    charts.replaceChildren(
      chart(words(locale, 'Família de modelo', 'Model family'), by(runFamily), readable, family => catalogURL({ ...state, family }), locale),
      activity,
      chart(ui.reynolds, by(reynoldsGroup), key => reynoldsLabel(key, locale), re => catalogURL({ ...state, re }), locale),
      chart(ui.turbulence, by(run => run.turbulenceModel ?? missing), readable, turbulence => catalogURL({ ...state, turbulence }), locale),
    );
  }
  panel.append(node('h2', words(locale, 'Atividade experimental', 'Experimental activity')), hint, indicators);
  if (runs.length) panel.append(catalogToolbar(runs, context, state, () => draw(true), locale),
    granularity, charts, link);
  else panel.append(blank(ui.emptyExperiments));
  if (runs.length && !(context.eligibleGroups ?? []).length) panel.append(node('p', words(locale,
    'Acurácia e divergência exigem condições compatíveis. Consulte as métricas por execução.',
    'Accuracy and divergence require compatible conditions. See the measurements for each run.'), 'metadata'));
  draw();
  return panel;
}
