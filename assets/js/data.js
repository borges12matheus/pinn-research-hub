const isText = value => typeof value === 'string' && value.trim().length > 0;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = (record, fields) => fields.every(field => isText(record[field]));

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
    return false;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const schemas = {
  project: record => hasText(record, ['id', 'name', 'researchTitle', 'summary', 'currentPhase', 'repositoryUrl'])
    && isDate(record.lastUpdated) && typeof record.isDemoData === 'boolean',
  roadmap: record => hasText(record, ['id', 'title', 'description'])
    && Number.isFinite(record.order)
    && ['planned', 'in_progress', 'completed', 'blocked'].includes(record.status)
    && (record.targetDate == null || isDate(record.targetDate)),
  updates: record => hasText(record, ['id', 'title', 'summary', 'category']) && isDate(record.date),
  priorities: record => hasText(record, ['id', 'title'])
    && Number.isFinite(record.order)
    && ['open', 'in_progress', 'done'].includes(record.status)
    && (record.roadmapId == null || isText(record.roadmapId)),
  resources: record => hasText(record, ['id', 'title', 'description', 'url', 'type']),
  publications: record => hasText(record, ['id', 'title', 'status'])
    && (record.url == null || isText(record.url)),
};

async function loadFile(name, schema) {
  const response = await fetch(`./data/${name}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const validRecord = record => isRecord(record) && schema(record);
  const valid = name === 'project'
    ? validRecord(data)
    : Array.isArray(data)
      && data.every(validRecord)
      && new Set(data.map(record => record.id)).size === data.length;

  if (!valid) throw new Error(`Estrutura inválida em ${name}.json`);
  return data;
}

export async function loadData() {
  const files = Object.entries(schemas);
  const results = await Promise.allSettled(files.map(([name, schema]) => loadFile(name, schema)));
  const data = {};
  const errors = new Set();

  results.forEach((result, index) => {
    const [name] = files[index];
    if (result.status === 'fulfilled') {
      data[name] = result.value;
    } else {
      errors.add(name);
      data[name] = name === 'project' ? null : [];
    }
  });

  return { data, errors };
}

export function getExternalUrl(value) {
  if (!isText(value)) return null;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
