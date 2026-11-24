import { Logger } from '@nestjs/common';

import type { ConfigService } from '../config/config.service.js';
import { defaultConfig } from '../config/defaultConfig.js';
import { SearchClientService } from './searchClient.service.js';

const buildConfigService = (engine: 'elasticsearch' | 'opensearch') =>
  ({
    getUserConfig: () => ({
      ...defaultConfig,
      elasticsearch: { ...defaultConfig.elasticsearch, engine },
    }),
  }) as unknown as ConfigService;

describe('SearchClientService', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('builds the client for the configured engine', () => {
    expect(
      new SearchClientService(buildConfigService('elasticsearch')).getClient()
        .engine,
    ).toBe('elasticsearch');
    expect(
      new SearchClientService(buildConfigService('opensearch')).getClient()
        .engine,
    ).toBe('opensearch');
  });

  it('survives an unreachable cluster at bootstrap', async () => {
    const service = new SearchClientService(buildConfigService('opensearch'));
    const client = service.getClient();
    vi.spyOn(client, 'checkHealth').mockRejectedValue(
      new Error('connect ECONNREFUSED'),
    );
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('reports the cluster status at bootstrap', async () => {
    const service = new SearchClientService(
      buildConfigService('elasticsearch'),
    );
    const client = service.getClient();
    vi.spyOn(client, 'checkHealth').mockResolvedValue({ status: 'green' });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
