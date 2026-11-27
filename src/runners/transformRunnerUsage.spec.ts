import { validRunnerUsage } from '../../test/fixtures/runnerUsage.js';
import { getRunnerUsageId } from './getRunnerUsageId.js';
import { transformRunnerUsage } from './transformRunnerUsage.js';

const receivedAt = new Date('2026-11-26T10:13:00.000Z');

describe('transformRunnerUsage', () => {
  it('keeps the report and adds the id, the flavour and the date', () => {
    const document = transformRunnerUsage(validRunnerUsage, receivedAt);
    expect(document.id).toBe(
      getRunnerUsageId({
        runnerName: validRunnerUsage.runnerName,
        runId: validRunnerUsage.github.runId,
        runAttempt: validRunnerUsage.github.runAttempt,
        job: validRunnerUsage.github.job,
      }),
    );
    expect(document.body).toEqual({
      ...validRunnerUsage,
      id: document.id,
      flavour: 'default',
      receivedAt: '2026-11-26T10:13:00.000Z',
    });
  });

  it('gives the same id on a second call', () => {
    expect(transformRunnerUsage(validRunnerUsage, receivedAt).id).toBe(
      transformRunnerUsage(validRunnerUsage, new Date()).id,
    );
  });

  it('gives another id to another attempt', () => {
    const retried = {
      ...validRunnerUsage,
      github: { ...validRunnerUsage.github, runAttempt: 2 },
    };
    expect(transformRunnerUsage(retried, receivedAt).id).not.toBe(
      transformRunnerUsage(validRunnerUsage, receivedAt).id,
    );
  });

  it('gives another id to another job of the same run on the same runner', () => {
    const otherJob = {
      ...validRunnerUsage,
      github: { ...validRunnerUsage.github, job: 'another-job' },
    };
    expect(transformRunnerUsage(otherJob, receivedAt).id).not.toBe(
      transformRunnerUsage(validRunnerUsage, receivedAt).id,
    );
  });

  it('has a null flavour for the bare instance id of the previous stack', () => {
    const document = transformRunnerUsage(
      { ...validRunnerUsage, runnerName: 'i-0df218c11cb2565d0' },
      receivedAt,
    );
    expect(document.body.flavour).toBeNull();
  });

  it('stamps the current date when none is given', () => {
    const before = Date.now();
    const document = transformRunnerUsage(validRunnerUsage);
    const stamped = Date.parse(document.body.receivedAt as string);
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });
});
