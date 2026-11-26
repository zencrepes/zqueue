import { getRunnerUsageId } from './getRunnerUsageId.js';

const node = {
  runnerName: 'default_i-0123456789abcdef0',
  runId: 1234567890,
  runAttempt: 1,
  job: 'integration-tests',
};

describe('getRunnerUsageId', () => {
  it('gives the same id to the same report', () => {
    expect(getRunnerUsageId(node)).toBe(getRunnerUsageId({ ...node }));
  });

  it('gives a uuid', () => {
    expect(getRunnerUsageId(node)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('changes with the run attempt', () => {
    expect(getRunnerUsageId({ ...node, runAttempt: 2 })).not.toBe(
      getRunnerUsageId(node),
    );
  });

  it('changes with the run id and the runner name', () => {
    expect(getRunnerUsageId({ ...node, runId: 1234567891 })).not.toBe(
      getRunnerUsageId(node),
    );
    expect(
      getRunnerUsageId({ ...node, runnerName: 'small_i-0123456789abcdef0' }),
    ).not.toBe(getRunnerUsageId(node));
  });

  it('changes with the job, so a reused runner cannot overwrite another job', () => {
    expect(getRunnerUsageId({ ...node, job: 'unit-tests' })).not.toBe(
      getRunnerUsageId(node),
    );
  });

  it('keeps the run id and the attempt apart', () => {
    // Joined without a separator, 1 and 23 would read the same as 12 and 3.
    expect(getRunnerUsageId({ ...node, runId: 1, runAttempt: 23 })).not.toBe(
      getRunnerUsageId({ ...node, runId: 12, runAttempt: 3 }),
    );
  });

  it('does not ignore punctuation or case in the runner name and the job', () => {
    expect(getRunnerUsageId({ ...node, runnerName: 'default_i-abc' })).not.toBe(
      getRunnerUsageId({ ...node, runnerName: 'default-i_abc' }),
    );
    expect(getRunnerUsageId({ ...node, runnerName: 'Ab' })).not.toBe(
      getRunnerUsageId({ ...node, runnerName: 'aB' }),
    );
    expect(getRunnerUsageId({ ...node, job: 'a-b' })).not.toBe(
      getRunnerUsageId({ ...node, job: 'a_b' }),
    );
  });
});
