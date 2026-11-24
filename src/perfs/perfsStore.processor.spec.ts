import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { ConfigService } from '../config/config.service.js';
import type { SearchClientService } from '../search/searchClient.service.js';
import type { SearchClient } from '../search/searchClient.types.js';
import { PerfsStoreProcessor } from './perfsStore.processor.js';
import type { PerfsPayload } from './perfsPayload.types.js';

const payload = {
  name: 'nightly-perf',
  rampUp: 60,
  repository: { name: 'r', url: 'u' },
  startedAt: '2026-11-24T02:00:00.000Z',
  duration: 60,
  platform: { vendor: 'AWS', tenant: 't', region: 'us-east-2' },
  resources: [],
  runs: [],
  url: 'https://ci.example.com',
} as unknown as PerfsPayload;

describe('PerfsStoreProcessor', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('records the transformed perf document', async () => {
    const bulkIndex = vi.fn().mockResolvedValue({ indexed: 1, errors: [] });
    const client = {
      indexExists: vi.fn().mockResolvedValue(true),
      createIndex: vi.fn(),
      bulkIndex,
    } as unknown as SearchClient;
    const configService = {
      getUserConfig: () => ({
        elasticsearch: { dataIndices: { testingPerfs: 't_perfs_' } },
      }),
    } as unknown as ConfigService;
    const searchClientService = {
      getClient: () => client,
    } as unknown as SearchClientService;

    const processor = new PerfsStoreProcessor(
      configService,
      searchClientService,
    );
    await processor.process({ data: payload } as Job<PerfsPayload>);

    expect(bulkIndex).toHaveBeenCalledTimes(1);
    expect(bulkIndex.mock.calls[0][0]).toBe('t_perfs_');
    expect(bulkIndex.mock.calls[0][1][0].body.name).toBe('nightly-perf');
  });
});
