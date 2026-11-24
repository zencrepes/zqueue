import type { TestingPayload } from '../testingPayload.types.js';
import { transformState } from './transformState.js';

const payload: TestingPayload = {
  id: 'component-1',
  name: 'my-module',
  version: '1.2.3',
  createdAt: '2026-11-24T10:00:00.000Z',
  url: 'https://ci.example.com/run/1',
  runTotal: 10,
  runSuccess: 9,
  runFailure: 1,
  dependencies: [{ name: 'dep', version: '1.0' }],
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

describe('transformState', () => {
  it('keeps the payload id so the latest state overwrites', () => {
    expect(transformState(payload).id).toBe('component-1');
  });

  it('adds the full name and dependency edges', () => {
    const { body } = transformState(payload);
    expect(body.full).toBe('my-module_1.2.3');
    expect(body.dependencies).toMatchObject({ totalCount: 1 });
  });

  it('drops the cases from the state document', () => {
    expect(transformState(payload).body.cases).toBeUndefined();
  });
});
