import { label, translated } from './copy.mjs';
import { fraction, number, titleOf } from './dom.mjs';

export const words = (locale, pt, en) => locale === 'en' ? en : pt;
export const modelOf = run => run.model ?? run.modelFamily;
export const phaseOf = (context, id, locale) => translated(context.phases.find(phase => phase.id === id)?.title, locale)
  ?? words(locale, 'Fase não informada', 'Phase unavailable');

export function caseOf(run, locale) {
  return [
    run.turbulenceModel ? label(run.turbulenceModel, locale) : null,
    run.reynolds?.length ? `Re ${run.reynolds.map(value => number(value, locale)).join(' / ')}` : run.caseId,
  ].filter(Boolean).join(' · ');
}

const distinct = values => [...new Set(values.filter(Boolean))];

function variants(runs, locale) {
  const features = runs.flatMap(run => run.features ?? []);
  const momentWeights = runs
    .filter(run => ['PINN-mom', 'PINN-cont-mom'].includes(modelOf(run)))
    .map(run => run.trainingBudget?.lossWeights?.w_mom).filter(value => value != null);
  return [
    features.includes('du_dx_log') ? words(locale, 'Gradientes de velocidade', 'Velocity gradients') : null,
    features.includes('log_Re_ratio') ? 'log_Re_ratio' : null,
    momentWeights.length ? `w_mom ${distinct(momentWeights.map(String)).join(' / ')}` : null,
  ].filter(Boolean);
}

export function runName(run, locale = 'pt-BR') {
  return [
    modelOf(run) ?? words(locale, 'Execução documentada', 'Documented run'),
    caseOf(run, locale), run.seed != null ? `seed ${run.seed}` : null,
    Number.isFinite(run.trainingBudget?.supervisedFraction) ? fraction(run.trainingBudget.supervisedFraction, locale) : null,
    ...variants([run], locale),
  ].filter(Boolean).join(' · ');
}

export function pairName(pair, runs, locale) {
  const members = pair.experimentIds.map(id => runs.get(id)).filter(Boolean);
  if (!members.length) return words(locale, 'Comparação experimental', 'Experimental comparison');
  const models = members.map(run => {
    const share = run.trainingBudget?.supervisedFraction;
    return [modelOf(run), Number.isFinite(share) ? fraction(share, locale) : null].filter(Boolean).join(' ');
  });
  const cases = distinct(members.map(run => caseOf(run, locale)));
  const seeds = distinct(members.map(run => run.seed == null ? null : `seed ${run.seed}`));
  return [models.filter(Boolean).join(' × '), ...cases, ...seeds, ...variants(members, locale)].filter(Boolean).join(' · ')
    || words(locale, 'Comparação experimental', 'Experimental comparison');
}

export function investigation(group, data, locale) {
  const events = data.timeline.filter(event => group.eventIds.includes(event.id));
  const pairs = data.comparisons.filter(pair => group.comparisonIds.includes(pair.id));
  const runIds = new Set([...group.experimentIds, ...pairs.flatMap(pair => pair.experimentIds)]);
  const runs = data.experiments.filter(run => runIds.has(run.id));
  return {
    group, events, pairs, runs,
    question: titleOf(group.question ?? events[0]?.hypothesis ?? events[0]?.summary ?? group.title, locale),
    figures: data.figures.filter(image => runIds.has(image.experimentId) || group.comparisonIds.includes(image.comparisonId)),
    metrics: data.metrics.filter(metric => runIds.has(metric.experimentId)),
  };
}
