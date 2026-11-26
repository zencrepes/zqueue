import { validRunnerUsage } from '../../test/fixtures/runnerUsage.js';
import { validateRunnerUsage } from './validateRunnerUsage.js';

// A copy of the valid report with one value replaced, found by a dotted path.
const withValue = (path: string, value: unknown): unknown => {
  const copy = structuredClone(validRunnerUsage) as Record<string, unknown>;
  const keys = path.split('.');
  let node = copy;
  for (const key of keys.slice(0, -1)) {
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
  return copy;
};

const reasonOf = (input: unknown): string => {
  const result = validateRunnerUsage(input);
  return result.ok ? '' : result.reason;
};

describe('validateRunnerUsage', () => {
  it('accepts a full valid report', () => {
    const result = validateRunnerUsage(validRunnerUsage);
    expect(result).toEqual({ ok: true, value: validRunnerUsage });
  });

  it('drops a field that is not in the schema', () => {
    const result = validateRunnerUsage({ ...validRunnerUsage, extra: 'x' });
    expect(result.ok).toBe(true);
    expect(result.ok && 'extra' in result.value).toBe(false);
  });

  it('rejects another schemaVersion', () => {
    expect(reasonOf(withValue('schemaVersion', 2))).toContain('schemaVersion');
  });

  it.each([
    ['runnerName', undefined],
    ['runnerName', ''],
    ['runnerType', 5],
    ['instance.id', ''],
    ['github.repository', undefined],
    ['github.workflow', ''],
  ])('rejects %s = %j', (path, value) => {
    expect(reasonOf(withValue(path, value))).toContain(path);
  });

  it('converts numeric strings of runId and runAttempt', () => {
    const result = validateRunnerUsage(withValue('github.runId', '1234567890'));
    expect(result.ok && result.value.github.runId).toBe(1234567890);
    const attempt = validateRunnerUsage(withValue('github.runAttempt', '2'));
    expect(attempt.ok && attempt.value.github.runAttempt).toBe(2);
  });

  it.each([
    'abc',
    '12.5',
    '',
    -1,
    1.5,
    0,
    '0',
    // Past Number.MAX_SAFE_INTEGER: it would be rounded, then rejected by the index.
    '99999999999999999999',
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects runId %j', (value) => {
    expect(reasonOf(withValue('github.runId', value))).toContain(
      'github.runId',
    );
  });

  it.each([
    ['usage.cpu.p95Pct', 101],
    ['usage.cpu.meanPct', -1],
    ['usage.cpu.peakPct', Number.NaN],
    ['usage.memory.peakPct', Infinity],
    ['usage.disk.peakPct', '50'],
  ])('rejects %s = %j', (path, value) => {
    expect(reasonOf(withValue(path, value))).toContain(path);
  });

  it('accepts the bounds of a percentage', () => {
    expect(validateRunnerUsage(withValue('usage.cpu.p95Pct', 0)).ok).toBe(true);
    expect(validateRunnerUsage(withValue('usage.cpu.p95Pct', 100)).ok).toBe(
      true,
    );
  });

  it('rejects a run attempt of 0', () => {
    expect(reasonOf(withValue('github.runAttempt', 0))).toContain(
      'github.runAttempt',
    );
  });

  // Date.parse accepts every one of these, the index does not.
  it.each([
    '2026',
    'Nov 26 2026',
    '12/31/2026',
    '1',
    '2026-11-26',
    '2026-11-26 10:00',
    '2026-11-26T10:00:00',
    '2026-11-26T10:00',
    '2026-02-31T10:00:00Z',
    '2026-13-01T10:00:00Z',
    '2026-11-26T24:00:00Z',
    '2026-11-26T10:60:00Z',
  ])('rejects the date %j', (value) => {
    expect(reasonOf(withValue('startedAt', value))).toContain('startedAt');
    expect(reasonOf(withValue('endedAt', value))).toContain('endedAt');
  });

  it.each([
    '2026-11-26T10:00:00Z',
    '2026-11-26T10:00:00.5Z',
    '2026-11-26T10:00:00.123456789Z',
    '2026-11-26T10:00:00+02:00',
    '2028-02-29T10:00:00Z',
  ])('accepts the date %j', (value) => {
    const input = withValue('startedAt', '2020-01-01T00:00:00Z');
    (input as typeof validRunnerUsage).endedAt = value;
    expect(validateRunnerUsage(input).ok).toBe(true);
  });

  it.each([
    ['github.runAttempt', 3_000_000_000],
    ['sampling.samples', 3_000_000_000],
    ['sampling.intervalSeconds', 3_000_000_000],
    ['provisioned.memoryMb', 1e300],
    ['provisioned.vcpu', 1e300],
    ['usage.memory.peakMb', 1e300],
    ['usage.disk.endUsedGb', 1e300],
  ])('rejects %s = %j, which the index could not store', (path, value) => {
    expect(reasonOf(withValue(path, value))).toContain(path);
  });

  it('accepts the largest value the index can store', () => {
    expect(
      validateRunnerUsage(withValue('sampling.samples', 2147483647)).ok,
    ).toBe(true);
    expect(validateRunnerUsage(withValue('usage.memory.peakMb', 1e12)).ok).toBe(
      true,
    );
  });

  it.each(['foo', 'foo/', '/bar', 'a/b/c', 'foo bar/baz', ' '])(
    'rejects the repository %j',
    (value) => {
      expect(reasonOf(withValue('github.repository', value))).toContain(
        'github.repository',
      );
    },
  );

  it('accepts a repository with dots, dashes and underscores', () => {
    expect(
      validateRunnerUsage(withValue('github.repository', 'My-Org/my_repo.js'))
        .ok,
    ).toBe(true);
  });

  it('rejects a negative size', () => {
    expect(reasonOf(withValue('usage.memory.peakMb', -5))).toContain(
      'usage.memory.peakMb',
    );
  });

  it.each(['provisioned.vcpu', 'provisioned.memoryMb', 'provisioned.diskGb'])(
    'rejects a zero %s',
    (path) => {
      expect(reasonOf(withValue(path, 0))).toContain(path);
    },
  );

  it('rejects an end date before the start date', () => {
    expect(
      reasonOf(withValue('endedAt', '2026-11-26T09:00:00.000Z')),
    ).toContain('endedAt');
  });

  it('rejects a date that is not a date', () => {
    expect(reasonOf(withValue('startedAt', 'yesterday'))).toContain(
      'startedAt',
    );
  });

  it('accepts a report with no sample, marked truncated', () => {
    const input = withValue('sampling.samples', 0) as typeof validRunnerUsage;
    input.sampling.truncated = true;
    expect(validateRunnerUsage(input).ok).toBe(true);
  });

  it('rejects a missing group', () => {
    expect(reasonOf(withValue('usage.cpu', undefined))).toContain('usage.cpu');
    expect(reasonOf(withValue('sampling', 'none'))).toContain('sampling');
  });

  it('rejects a truncated flag that is not a boolean', () => {
    expect(reasonOf(withValue('sampling.truncated', 'no'))).toContain(
      'sampling.truncated',
    );
  });

  it.each([null, [], 'text', 42, undefined])(
    'rejects %j without throwing',
    (input) => {
      expect(validateRunnerUsage(input)).toEqual({
        ok: false,
        reason: 'body: expected a JSON object',
      });
    },
  );
});
