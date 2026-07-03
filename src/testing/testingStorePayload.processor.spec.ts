import { Logger } from '@nestjs/common';

import { TestingStorePayloadProcessor } from './testingStorePayload.processor';
import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.testing-states', () => ({
  esMapping: { mappings: {} },
  esSettings: { settings: {} },
  getId: jest.fn((d) => `dep-id-${d.name}`),
}));

jest.mock('@bit/zencrepes.zindexer.testing-runs', () => ({
  esMapping: { mappings: {} },
  esSettings: { settings: {} },
  getRunId: jest.fn(() => 'run-id-1'),
}));

jest.mock('@bit/zencrepes.zindexer.es-utils', () => ({
  checkEsIndex: jest.fn(),
  pushEsNodes: jest.fn(),
}));

const userConfig = {
  elasticsearch: {
    dataIndices: {
      testingStates: 'testing_states',
      testingRuns: 'testing_runs',
      testingCases: 'testing_cases',
    },
  },
};

const buildJobData = (overrides = {}) => ({
  name: 'my-component',
  version: '1.0.0',
  url: 'https://ci.example.com/run/1',
  runSuccess: 3,
  runFailure: 1,
  runTotal: 4,
  dependencies: [{ name: 'dep-a', version: '2.0.0' }],
  ...overrides,
});

describe('TestingStorePayloadProcessor', () => {
  let processor: TestingStorePayloadProcessor;
  const esClient = {};
  const configService = { getUserConfig: () => userConfig };
  const esClientService = { getEsClient: () => esClient };

  const pushedNodesForIndex = (index: string) => {
    const call = (pushEsNodes as jest.Mock).mock.calls.find(
      (c) => c[1] === index,
    );
    return call !== undefined ? call[2] : undefined;
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TestingStorePayloadProcessor(
      configService as any,
      esClientService as any,
    );
  });

  it('pushes a state and a run document, but no cases when absent', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    expect(checkEsIndex).toHaveBeenCalledTimes(2);
    expect(pushEsNodes).toHaveBeenCalledTimes(2);
    expect(pushedNodesForIndex('testing_states')).toBeDefined();
    expect(pushedNodesForIndex('testing_runs')).toBeDefined();
    expect(pushedNodesForIndex('testing_cases')).toBeUndefined();
  });

  it('transforms the state with a full name and graphql-like dependencies', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    const state = pushedNodesForIndex('testing_states')[0];
    expect(state.full).toEqual('my-component_1.0.0');
    expect(state.dependencies).toEqual({
      edges: [
        {
          node: {
            name: 'dep-a',
            version: '2.0.0',
            full: 'dep-a_2.0.0',
            id: 'dep-id-dep-a',
          },
        },
      ],
      totalCount: 1,
    });
  });

  it('computes success and failure rates on the run document', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    const run = pushedNodesForIndex('testing_runs')[0];
    expect(run.id).toEqual('run-id-1');
    expect(run.runSuccessRate).toEqual(75);
    expect(run.runFailureRate).toEqual(25);
  });

  it('strips the cases from state and run documents', async () => {
    const jobData = buildJobData({
      cases: [
        {
          id: 'case-1',
          createdAt: '2026-01-01T00:00:00Z',
          suite: 'login',
          name: 'accepts valid credentials',
          caseSuccess: 1,
          caseFailure: 1,
          caseTotal: 2,
        },
      ],
    });

    await processor.pushNodeToEs({ data: jobData } as any);

    expect(pushedNodesForIndex('testing_states')[0].cases).toBeUndefined();
    expect(pushedNodesForIndex('testing_runs')[0].cases).toBeUndefined();
  });

  it('pushes enriched case documents when cases are present', async () => {
    const jobData = buildJobData({
      cases: [
        {
          id: 'case-1',
          createdAt: '2026-01-01T00:00:00Z',
          suite: 'login',
          name: 'accepts valid credentials',
          caseSuccess: 1,
          caseFailure: 1,
          caseTotal: 2,
        },
      ],
    });

    await processor.pushNodeToEs({ data: jobData } as any);

    const cases = pushedNodesForIndex('testing_cases');
    expect(cases).toHaveLength(1);
    expect(cases[0]).toEqual(
      expect.objectContaining({
        full: 'login - accepts valid credentials',
        runId: 'run-id-1',
        url: 'https://ci.example.com/run/1',
        project: 'my-component',
        caseSuccessRate: 50,
        caseFailureRate: 50,
      }),
    );
    // The case id is derived from the case content (uuid v5)
    expect(cases[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
