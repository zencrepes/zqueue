import type { RunnerUsagePayload } from './runnerUsage.types.js';

export type RunnerUsageValidation =
  { ok: true; value: RunnerUsagePayload } | { ok: false; reason: string };

type Obj = Record<string, unknown>;

interface Range {
  min?: number;
  max?: number;
  minExclusive?: boolean;
}

class InvalidField extends Error {}

const invalid = (path: string, problem: string): never => {
  throw new InvalidField(`${path}: ${problem}`);
};

const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const objectAt = (parent: Obj, key: string, path: string): Obj => {
  const value = parent[key];
  return isObject(value)
    ? value
    : invalid(`${path}${key}`, 'expected an object');
};

const stringAt = (parent: Obj, key: string, path: string): string => {
  const value = parent[key];
  return typeof value === 'string' && value !== ''
    ? value
    : invalid(`${path}${key}`, 'expected a non-empty string');
};

const describeRange = ({ min, max, minExclusive }: Range): string => {
  if (min !== undefined && max !== undefined) {
    return minExclusive === true
      ? `greater than ${min} and at most ${max}`
      : `between ${min} and ${max}`;
  }
  return minExclusive === true ? `greater than ${min}` : `${min} or more`;
};

const inRange = (value: number, { min, max, minExclusive }: Range): boolean =>
  (min === undefined || (minExclusive === true ? value > min : value >= min)) &&
  (max === undefined || value <= max);

const numberAt = (
  parent: Obj,
  key: string,
  path: string,
  range: Range,
): number => {
  const value = parent[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid(`${path}${key}`, 'expected a number');
  }
  return inRange(value, range)
    ? value
    : invalid(`${path}${key}`, `expected a number ${describeRange(range)}`);
};

const integerAt = (
  parent: Obj,
  key: string,
  path: string,
  range: Range,
  acceptNumericString = false,
): number => {
  let value = parent[key];
  // Shell scripts post GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT as strings.
  if (acceptNumericString && typeof value === 'string' && /^\d+$/.test(value)) {
    value = Number(value);
  }
  // A safe integer, so a huge digit string never turns into a rounded number.
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    return invalid(`${path}${key}`, 'expected an integer');
  }
  return inRange(value, range)
    ? value
    : invalid(`${path}${key}`, `expected an integer ${describeRange(range)}`);
};

// Date.parse alone accepts "Nov 26 2026" or "2026", which the index then
// rejects. The date must be ISO 8601 with a time and a timezone, and a real
// calendar day (2026-02-31 is not one).
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const isIsoDate = (value: string): boolean => {
  const match = ISO_DATE.exec(value);
  if (match === null || Number.isNaN(Date.parse(value))) {
    return false;
  }
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
};

const dateAt = (parent: Obj, key: string, path: string): string => {
  const value = parent[key];
  return typeof value === 'string' && isIsoDate(value)
    ? value
    : invalid(
        `${path}${key}`,
        'expected an ISO 8601 date with a time and a timezone, ' +
          'for example 2026-11-26T10:00:00.000Z',
      );
};

const REPOSITORY = /^[^/\s]+\/[^/\s]+$/;

const repositoryAt = (parent: Obj, key: string, path: string): string => {
  const value = stringAt(parent, key, path);
  return REPOSITORY.test(value)
    ? value
    : invalid(`${path}${key}`, 'expected owner/name');
};

const booleanAt = (parent: Obj, key: string, path: string): boolean => {
  const value = parent[key];
  return typeof value === 'boolean'
    ? value
    : invalid(`${path}${key}`, 'expected true or false');
};

// The index maps sizes as float, counts as integer (32 bit) and run ids as long.
// A value past these limits would be accepted here, then rejected by the index
// on every retry, so the limits are enforced here and written in the docs.
const MAX_SIZE = 1e12;
const MAX_COUNT = 2147483647;

const PCT: Range = { min: 0, max: 100 };
const NON_NEGATIVE: Range = { min: 0, max: MAX_SIZE };
const POSITIVE: Range = { min: 0, minExclusive: true, max: MAX_SIZE };
const COUNT: Range = { min: 0, max: MAX_COUNT };
const RUN_ID: Range = { min: 1, max: Number.MAX_SAFE_INTEGER };
const RUN_ATTEMPT: Range = { min: 1, max: MAX_COUNT };

const build = (input: Obj): RunnerUsagePayload => {
  if (input.schemaVersion !== 1) {
    invalid('schemaVersion', 'expected 1');
  }
  const instance = objectAt(input, 'instance', '');
  const github = objectAt(input, 'github', '');
  const provisioned = objectAt(input, 'provisioned', '');
  const usage = objectAt(input, 'usage', '');
  const cpu = objectAt(usage, 'cpu', 'usage.');
  const memory = objectAt(usage, 'memory', 'usage.');
  const disk = objectAt(usage, 'disk', 'usage.');
  const sampling = objectAt(input, 'sampling', '');

  const startedAt = dateAt(input, 'startedAt', '');
  const endedAt = dateAt(input, 'endedAt', '');
  if (Date.parse(endedAt) < Date.parse(startedAt)) {
    invalid('endedAt', 'must not be before startedAt');
  }

  // Only the known fields are kept, so an extra field never reaches the index.
  return {
    schemaVersion: 1,
    runnerType: stringAt(input, 'runnerType', ''),
    runnerName: stringAt(input, 'runnerName', ''),
    instance: {
      id: stringAt(instance, 'id', 'instance.'),
      type: stringAt(instance, 'type', 'instance.'),
    },
    github: {
      repository: repositoryAt(github, 'repository', 'github.'),
      runId: integerAt(github, 'runId', 'github.', RUN_ID, true),
      runAttempt: integerAt(github, 'runAttempt', 'github.', RUN_ATTEMPT, true),
      workflow: stringAt(github, 'workflow', 'github.'),
      job: stringAt(github, 'job', 'github.'),
    },
    startedAt,
    endedAt,
    provisioned: {
      vcpu: numberAt(provisioned, 'vcpu', 'provisioned.', POSITIVE),
      memoryMb: numberAt(provisioned, 'memoryMb', 'provisioned.', POSITIVE),
      diskGb: numberAt(provisioned, 'diskGb', 'provisioned.', POSITIVE),
    },
    usage: {
      cpu: {
        meanPct: numberAt(cpu, 'meanPct', 'usage.cpu.', PCT),
        p95Pct: numberAt(cpu, 'p95Pct', 'usage.cpu.', PCT),
        peakPct: numberAt(cpu, 'peakPct', 'usage.cpu.', PCT),
      },
      memory: {
        meanMb: numberAt(memory, 'meanMb', 'usage.memory.', NON_NEGATIVE),
        peakMb: numberAt(memory, 'peakMb', 'usage.memory.', NON_NEGATIVE),
        peakPct: numberAt(memory, 'peakPct', 'usage.memory.', PCT),
      },
      disk: {
        startUsedGb: numberAt(disk, 'startUsedGb', 'usage.disk.', NON_NEGATIVE),
        endUsedGb: numberAt(disk, 'endUsedGb', 'usage.disk.', NON_NEGATIVE),
        peakUsedGb: numberAt(disk, 'peakUsedGb', 'usage.disk.', NON_NEGATIVE),
        peakPct: numberAt(disk, 'peakPct', 'usage.disk.', PCT),
      },
    },
    sampling: {
      intervalSeconds: integerAt(
        sampling,
        'intervalSeconds',
        'sampling.',
        COUNT,
      ),
      samples: integerAt(sampling, 'samples', 'sampling.', COUNT),
      truncated: booleanAt(sampling, 'truncated', 'sampling.'),
    },
  };
};

// Checks a runner usage report against the schema of docs/runner-usage.md and
// returns the first problem found, so the sender can fix it. It never throws.
export const validateRunnerUsage = (input: unknown): RunnerUsageValidation => {
  if (!isObject(input)) {
    return { ok: false, reason: 'body: expected a JSON object' };
  }
  try {
    return { ok: true, value: build(input) };
  } catch (error) {
    if (error instanceof InvalidField) {
      return { ok: false, reason: error.message };
    }
    throw error;
  }
};
