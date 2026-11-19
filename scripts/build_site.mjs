import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  approvedFigures, collections, date, external, id, validateCollection, validateContext, validateReferences,
} from '../assets/js/science/contracts.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const editorialFiles = ['project', 'roadmap', 'priorities', 'updates', 'resources', 'publications', 'scientific-context'];
const importerFiles = ['experiments', 'comparisons', 'metrics', 'timeline'];
const marker = 'pinn-research-hub-static-v0.3\n';
const encode = value => JSON.stringify(value, null, 2) + '\n';
const hash = contents => createHash('sha256').update(contents).digest('hex');

async function exists(path) {
  try { return await lstat(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readWithin(base, name) {
  let path = base;
  for (const part of ['', ...name.split('/')]) {
    path = join(path, part);
    if ((await exists(path))?.isSymbolicLink()) throw new Error(`Symbolic link in input: ${name}`);
  }
  if (!(await exists(path))?.isFile()) throw new Error(`Missing input: ${name}`);
  return readFile(path);
}

function inspect(value, key = '') {
  if (Array.isArray(value)) {
    value.forEach(item => inspect(item, key));
  } else if (value && typeof value === 'object') {
    if (value.visibility != null && value.visibility !== 'public') throw new Error('Private record in public package');
    if (value.configurationPath != null) throw new Error('Internal configuration path');
    Object.entries(value).forEach(([name, item]) => inspect(item, name));
  } else if (typeof value === 'string') {
    let decoded = value;
    for (let pass = 0; pass < 2; pass++) {
      try { decoded = decodeURIComponent(decoded); } catch { break; }
    }
    if (['url', 'repositoryUrl', 'sources'].includes(key)) {
      const address = external(decoded);
      if (!address) throw new Error('Invalid public URL');
      const parsed = new URL(address);
      if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(parsed.hostname)
        || /\.(local|localhost|internal)$/.test(parsed.hostname)
        || [...parsed.searchParams.keys()].some(name => /(?:token|key|signature|password|credential)/i.test(name))) {
        throw new Error('Private URL in public package');
      }
    }
    if (/file:|(?:^|[\s(`"'])\/(?:home|tmp|mnt|var|app|srv|users)\/|(?:^|\W)(?:\.\.\/|\.experiment-import\/|lab_experimentos[\\/])|[A-Za-z]:\\/i.test(decoded)) {
      throw new Error('Internal path in public package');
    }
  }
}

async function managedFile(release, entries, name) {
  const contents = await readWithin(release, name);
  if (!Object.hasOwn(entries, name) || hash(contents) !== entries[name]) {
    throw new Error(`Unapproved or modified artifact: ${name}`);
  }
  return contents;
}

export function dashboard(data, context, project) {
  const groups = context.groups.map(group => {
    const events = data.timeline.filter(event => event.curationGroupId === group.id);
    return { ...group, eventIds: events.map(event => event.id),
      comparisonIds: [...new Set(events.flatMap(event => event.comparisonIds ?? []))],
      experimentIds: [...new Set(events.flatMap(event => event.experimentIds ?? []))] };
  }).filter(group => group.eventIds.length);
  const baseline = data.comparisons.find(pair => pair.id === context.baselineComparisonId);
  const run = baseline && data.experiments.find(experiment => experiment.id === baseline.experimentIds[0]);
  const recent = data.timeline.filter(event => date(event.date))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 3)
    .map(({ id, date, title, evidenceStatus, phaseId }) => ({ id, date, title, evidenceStatus, phaseId }));
  return {
    phases: context.phases, hypotheses: context.hypotheses, decisions: context.decisions, groups,
    currentPhaseId: project.currentPhaseId ?? null,
    experimentalDate: [
      ...data.experiments.filter(run => run.evidenceStatus !== 'planned').map(run => run.date),
      ...data.timeline.filter(event => ['experiment', 'validation'].includes(event.category) &&
        event.evidenceStatus !== 'planned' && event.experimentIds?.length).map(event => event.date),
    ].filter(date).sort().at(-1) ?? null,
    recent,
    baseline: run ? { comparisonId: baseline.id, experimentIds: baseline.experimentIds, evidenceStatus: baseline.evidenceStatus, caseId: run.caseId,
      reynolds: run.reynolds, turbulenceModel: run.turbulenceModel,
      models: baseline.experimentIds.map(key => {
        const member = data.experiments.find(item => item.id === key);
        return member.model ?? member.modelFamily ?? member.id;
      }) } : null,
  };
}

export async function collectSite({ source = root, release = null, approvals = null } = {}) {
  return collect({ source, release, approvals, localReview: false });
}

export async function collectLocalReview({ source = root, staging = join(source, '.experiment-import/featured') } = {}) {
  const approvals = JSON.parse(await readWithin(staging, 'reports/managed.json'));
  return collect({ source, release: staging, approvals, localReview: true });
}

async function collect({ source, release, approvals, localReview }) {
  const html = await readWithin(source, 'index.html');
  const files = new Map([['index.html', localReview ? String(html).replace('<html ', '<html data-local-review ') : html]]);
  if (!localReview) files.set('.nojekyll', '');
  const assets = [
    'assets/css/style.css', 'assets/js/app.js', 'assets/js/data.js', 'assets/js/render.js',
    ...['contracts', 'copy', 'dom', 'portal', 'research', 'results'].map(name => `assets/js/science/${name}.mjs`),
  ];
  for (const name of assets) files.set(name, await readWithin(source, name));

  const data = {};
  for (const name of editorialFiles) {
    const path = `data/${name}.json`;
    const contents = await readWithin(source, path);
    data[name] = JSON.parse(contents);
    inspect(data[name]);
    if (name !== 'scientific-context') files.set(path, contents);
  }
  for (const name of editorialFiles.filter(name => !['project', 'scientific-context'].includes(name))) {
    if (!Array.isArray(data[name]) || !data[name].every(record => record && id(record.id))
      || new Set(data[name].map(record => record.id)).size !== data[name].length) throw new Error(`Invalid editorial IDs: ${name}`);
  }
  const context = validateContext(data['scientific-context']);
  if (release && (!approvals || Array.isArray(approvals) || typeof approvals !== 'object')) {
    throw new Error('An importer ownership index is required for approved data');
  }
  for (const name of collections) {
    const path = `data/${name}.json`;
    let records = [];
    if (release && importerFiles.includes(name)) {
      records = JSON.parse(await managedFile(release, approvals, path));
    } else if (release && Object.hasOwn(approvals, path)) {
      records = JSON.parse(await managedFile(release, approvals, path));
    } else if (name === 'literature' && await exists(join(source, path))) {
      records = JSON.parse(await readWithin(source, path));
    }
    if (!localReview || name === 'literature') inspect(records);
    data[name] = validateCollection(name, records, { localReview });
  }
  data.figures = validateCollection('figures',
    approvedFigures(data.experiments, data.comparisons, data.figures, { localReview }), { localReview });
  validateReferences(data, context);
  for (const image of data.figures) {
    files.set(image.path, await managedFile(release, approvals, image.path));
  }
  for (const name of collections) files.set(`data/${name}.json`, encode(data[name]));
  files.set('data/overview.json', encode(dashboard(data, context, data.project)));
  return files;
}

async function writeSite(output, files) {
  const previous = await exists(output);
  if (previous) {
    if (previous.isSymbolicLink() || !previous.isDirectory()
      || String(await readWithin(output, '.pinn-distribution')) !== marker) {
      throw new Error('Output is not a distribution owned by this script');
    }
  }
  const temp = await mkdtemp(join(dirname(output), '.pinn-build-'));
  try {
    for (const [name, content] of [...files, ['.pinn-distribution', marker]]) {
      const path = join(temp, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    if (previous) {
      const backupParent = await mkdtemp(join(dirname(output), '.pinn-backup-'));
      const backup = join(backupParent, basename(output));
      try {
        await rename(output, backup);
        try { await rename(temp, output); } catch (error) {
          await rename(backup, output);
          throw error;
        }
        await rm(backup, { recursive: true });
      } finally {
        if (!await exists(backup)) await rm(backupParent, { recursive: true });
      }
    } else {
      await rename(temp, output);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function main() {
  const options = process.argv.slice(2);
  if (options.some(option => option !== '--approved')) throw new Error('Usage: node scripts/build_site.mjs [--approved]');
  const approved = options.includes('--approved');
  const approvals = approved ? JSON.parse(await readWithin(root, '.experiment-import/public-audit/managed.json')) : null;
  const files = await collectSite({ release: approved ? join(root, 'public') : null, approvals });
  await writeSite(resolve(root, 'dist'), files);
  process.stdout.write(`dist/ · ${files.size} files · ${approved ? 'approved scientific data' : 'editorial site'}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
