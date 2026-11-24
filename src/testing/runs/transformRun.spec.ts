import type { TestingPayload } from '../testingPayload.types.js';
import { getRunId } from './getRunId.js';
import { transformRun } from './transformRun.js';

const payload: TestingPayload = {
  id: 'component-1',
  name: 'my-module',
  version: '1.2.3',
  createdAt: '2026-11-24T10:00:00.000Z',
  url: 'https://ci.example.com/run/1',
  runTotal: 3,
  runSuccess: 2,
  runFailure: 1,
  dependencies: [],
  cases: [
    {
      id: 'case-1',
      name: 'case',
      suite: 'suite',
      createdAt: '2026-11-24T10:00:00.000Z',
      caseTotal: 1,
      caseSuccess: 1,
      caseFailure: 0,
    },
  ],
};

describe('transformRun', () => {
  it('derives a unique id from the payload id and creation date', () => {
    const document = transformRun(payload);
    expect(document.id).toBe(getRunId(payload));
    expect(document.body.id).toBe(document.id);
    expect(document.id).not.toBe(payload.id);
  });

  it('computes success and failure rates', () => {
    const { body } = transformRun(payload);
    expect(body.runSuccessRate).toBe(67);
    expect(body.runFailureRate).toBe(33);
  });

  it('survives a run with zero totals', () => {
    const { body } = transformRun({ ...payload, runTotal: 0, runSuccess: 0 });
    expect(body.runSuccessRate).toBe(0);
  });

  it('drops the cases from the run document', () => {
    expect(transformRun(payload).body.cases).toBeUndefined();
  });
});
