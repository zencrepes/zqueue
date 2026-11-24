import { getRunId } from '../runs/getRunId.js';
import type { TestingPayload } from '../testingPayload.types.js';
import { getCaseId } from './getCaseId.js';
import { transformCases } from './transformCases.js';

const payload: TestingPayload = {
  id: 'component-1',
  name: 'my-module',
  version: '1.2.3',
  createdAt: '2026-11-24T10:00:00.000Z',
  url: 'https://ci.example.com/run/1',
  runTotal: 1,
  runSuccess: 1,
  runFailure: 0,
  dependencies: [],
  cases: [
    {
      id: 'case-1',
      name: 'login works',
      suite: 'auth',
      createdAt: '2026-11-24T10:00:00.000Z',
      caseTotal: 4,
      caseSuccess: 3,
      caseFailure: 1,
    },
  ],
};

describe('transformCases', () => {
  it('links each case to its run and project', () => {
    const [document] = transformCases(payload);
    expect(document.id).toBe(getCaseId(payload.cases![0]));
    expect(document.body).toMatchObject({
      id: document.id,
      full: 'auth - login works',
      runId: getRunId(payload),
      url: 'https://ci.example.com/run/1',
      project: 'my-module',
      caseSuccessRate: 75,
      caseFailureRate: 25,
    });
  });

  it('returns an empty list when the payload has no cases', () => {
    expect(transformCases({ ...payload, cases: undefined })).toEqual([]);
  });
});
