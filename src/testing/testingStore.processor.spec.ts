import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { ConfigService } from '../config/config.service.js';
import type { SearchClientService } from '../search/searchClient.service.js';
import type { SearchClient } from '../search/searchClient.types.js';
import { TestingStoreProcessor } from './testingStore.processor.js';
import type { TestingPayload } from './testingPayload.types.js';

const payload: TestingPayload = {
  id: 'component-1',
  name: 'my-module',
  version: '1.0.0',
  createdAt: '2026-11-24T10:00:00.000Z',
  url: 'https://ci.example.com',
  runTotal: 2,
  runSuccess: 1,
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

const buildProcessor = () => {
  const bulkIndex = vi.fn().mockResolvedValue({ indexed: 1, errors: [] });
  const client = {
    indexExists: vi.fn().mockResolvedValue(true),
    createIndex: vi.fn(),
    bulkIndex,
  } as unknown as SearchClient;
  const configService = {
    getUserConfig: () => ({
      elasticsearch: {
        dataIndices: {
          testingStates: 't_states_',
          testingRuns: 't_runs_',
          testingCases: 't_cases_',
          testingPerfs: 't_perfs_',
          runnerUsage: 'runner_usage_',
        },
      },
    }),
  } as unknown as ConfigService;
  const searchClientService = {
    getClient: () => client,
  } as unknown as SearchClientService;
  return {
    processor: new TestingStoreProcessor(configService, searchClientService),
    bulkIndex,
  };
};

describe('TestingStoreProcessor', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('records the state, the run and the cases', async () => {
    const { processor, bulkIndex } = buildProcessor();
    await processor.process({ data: payload } as Job<TestingPayload>);
    const indices = bulkIndex.mock.calls.map((call) => call[0]);
    expect(indices).toEqual(['t_states_', 't_runs_', 't_cases_']);
    // The state keeps the payload id; the run gets a derived unique id.
    expect(bulkIndex.mock.calls[0][1][0].id).toBe('component-1');
    expect(bulkIndex.mock.calls[1][1][0].id).not.toBe('component-1');
  });

  it('skips the cases index when the payload has none', async () => {
    const { processor, bulkIndex } = buildProcessor();
    await processor.process({
      data: { ...payload, cases: [] },
    } as Job<TestingPayload>);
    expect(bulkIndex.mock.calls.map((call) => call[0])).toEqual([
      't_states_',
      't_runs_',
    ]);
  });

  it('logs a job failure reported by the worker', () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { processor } = buildProcessor();
    processor.onFailed(undefined, new Error('cluster unreachable'));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('cluster unreachable'),
    );
  });
});
