import { Logger } from '@nestjs/common';

import { PerfsStorePayloadProcessor } from './perfsStorePayload.processor';
import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.testing-perfs', () => ({
  esMapping: { mappings: {} },
  esSettings: { settings: {} },
  getId: jest.fn((node) => `perf-id-${node.name}`),
}));

jest.mock('@bit/zencrepes.zindexer.es-utils', () => ({
  checkEsIndex: jest.fn(),
  pushEsNodes: jest.fn(),
}));

const userConfig = {
  elasticsearch: {
    dataIndices: { testingPerfs: 'testing_perfs' },
  },
};

const buildJobData = (overrides = {}) => ({
  name: 'load-test',
  resources: [{ name: 'small-vm', size: '2cpu' }],
  runs: [
    {
      name: 'run-1',
      statistics: {
        stat1: { transaction: 'login', mean: 12 },
        stat2: { transaction: 'checkout', mean: 40 },
      },
    },
    {
      name: 'run-2',
      statistics: {
        stat1: { transaction: 'login', mean: 14 },
      },
    },
  ],
  ...overrides,
});

describe('PerfsStorePayloadProcessor', () => {
  let processor: PerfsStorePayloadProcessor;
  const esClient = {};
  const configService = { getUserConfig: () => userConfig };
  const esClientService = { getEsClient: () => esClient };

  const pushedState = () => (pushEsNodes as jest.Mock).mock.calls[0][2][0];

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new PerfsStorePayloadProcessor(
      configService as any,
      esClientService as any,
    );
  });

  it('pushes a single transformed document to the perfs index', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    expect(checkEsIndex).toHaveBeenCalledWith(
      esClient,
      'testing_perfs',
      expect.anything(),
      expect.anything(),
      expect.any(Function),
    );
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'testing_perfs',
      [expect.objectContaining({ id: 'perf-id-load-test' })],
      expect.any(Function),
    );
  });

  it('collects unique transaction names across all runs', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    expect(pushedState().transactions).toEqual({
      edges: [{ node: { name: 'login' } }, { node: { name: 'checkout' } }],
      totalCount: 2,
    });
  });

  it('transforms resources with a name_size identifier', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    expect(pushedState().resources).toEqual({
      edges: [
        {
          node: expect.objectContaining({
            name: 'small-vm',
            size: '2cpu',
            name_size: 'small-vm_2cpu',
          }),
        },
      ],
      totalCount: 1,
    });
  });

  it('defaults to an empty description and tags when absent', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    expect(pushedState().description).toEqual('');
    expect(pushedState().tags).toEqual({ edges: [], totalCount: 0 });
  });

  it('maps tags when provided', async () => {
    const jobData = buildJobData({
      description: 'nightly perf run',
      tags: [{ name: 'nightly' }, { name: 'baseline' }],
    });

    await processor.pushNodeToEs({ data: jobData } as any);

    expect(pushedState().description).toEqual('nightly perf run');
    expect(pushedState().tags).toEqual({
      edges: [{ node: { name: 'nightly' } }, { node: { name: 'baseline' } }],
      totalCount: 2,
    });
  });

  it('flattens run statistics into an array', async () => {
    await processor.pushNodeToEs({ data: buildJobData() } as any);

    const runs = pushedState().runs;
    expect(runs.totalCount).toEqual(2);
    expect(runs.edges[0].node.statistics).toEqual([
      { transaction: 'login', mean: 12 },
      { transaction: 'checkout', mean: 40 },
    ]);
  });
});
