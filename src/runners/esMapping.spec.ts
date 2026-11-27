import { parseIndexDefinition } from '../shared/parseIndexDefinition.js';
import { validRunnerUsage } from '../../test/fixtures/runnerUsage.js';
import { transformRunnerUsage } from './transformRunnerUsage.js';
import runnerUsageMapping from './esMapping.js';
import runnerUsageSettings from './esSettings.js';

type Properties = Record<string, { type?: string; properties?: Properties }>;

const definition = parseIndexDefinition(
  runnerUsageMapping,
  runnerUsageSettings,
);
const properties = definition.mappings.properties as Properties;

// The leaf paths of a document, as dotted names.
const leafPaths = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) =>
        leafPaths(child, prefix === '' ? key : `${prefix}.${key}`),
      )
    : [prefix];

const typeAt = (path: string): string | undefined => {
  let node: { type?: string; properties?: Properties } | undefined = {
    properties,
  };
  for (const key of path.split('.')) {
    node = node?.properties?.[key];
  }
  return node?.type;
};

describe('runner usage index definition', () => {
  it('stores the identifiers as keywords and the end date as a date', () => {
    expect(typeAt('runnerName')).toBe('keyword');
    expect(typeAt('github.workflow')).toBe('keyword');
    expect(typeAt('github.job')).toBe('keyword');
    expect(typeAt('flavour')).toBe('keyword');
    expect(typeAt('endedAt')).toBe('date');
  });

  // The validation limits (MAX_SIZE, MAX_COUNT, safe run id) are chosen for
  // these exact types, so a change of type here must change the limits there.
  it.each([
    ['schemaVersion', 'integer'],
    ['github.runId', 'long'],
    ['github.runAttempt', 'integer'],
    ['sampling.intervalSeconds', 'integer'],
    ['sampling.samples', 'integer'],
    ['sampling.truncated', 'boolean'],
    ['startedAt', 'date'],
    ['receivedAt', 'date'],
    ['provisioned.vcpu', 'float'],
    ['provisioned.memoryMb', 'float'],
    ['provisioned.diskGb', 'float'],
    ['usage.cpu.p95Pct', 'float'],
    ['usage.memory.peakMb', 'float'],
    ['usage.disk.peakUsedGb', 'float'],
  ])('maps %s as %s', (path, type) => {
    expect(typeAt(path)).toBe(type);
  });

  it('has one shard and no analyzer', () => {
    expect(definition.settings).toEqual({ number_of_shards: 1 });
  });

  it('maps every field of a stored document', () => {
    const body = transformRunnerUsage(validRunnerUsage).body;
    const unmapped = leafPaths(body).filter(
      (path) => typeAt(path) === undefined,
    );
    expect(unmapped).toEqual([]);
  });
});
