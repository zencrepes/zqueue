import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { validRunnerUsage } from '../../test/fixtures/runnerUsage.js';
import type { ConfigService } from '../config/config.service.js';
import type { SearchClientService } from '../search/searchClient.service.js';
import type { SearchClient } from '../search/searchClient.types.js';
import type { RunnerUsagePayload } from './runnerUsage.types.js';
import { RunnerUsageStoreProcessor } from './runnerUsageStore.processor.js';

const configService = {
  getUserConfig: () => ({
    elasticsearch: { dataIndices: { runnerUsage: 'runner_usage_' } },
  }),
} as unknown as ConfigService;

describe('RunnerUsageStoreProcessor', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('records the transformed document in the runner usage index', async () => {
    const bulkIndex = vi.fn().mockResolvedValue({ indexed: 1, errors: [] });
    const client = {
      indexExists: vi.fn().mockResolvedValue(true),
      createIndex: vi.fn(),
      bulkIndex,
    } as unknown as SearchClient;
    const searchClientService = {
      getClient: () => client,
    } as unknown as SearchClientService;

    const processor = new RunnerUsageStoreProcessor(
      configService,
      searchClientService,
    );
    await processor.process({
      data: validRunnerUsage,
    } as Job<RunnerUsagePayload>);

    expect(bulkIndex).toHaveBeenCalledTimes(1);
    expect(bulkIndex.mock.calls[0][0]).toBe('runner_usage_');
    const [document] = bulkIndex.mock.calls[0][1];
    expect(document.body.runnerName).toBe(validRunnerUsage.runnerName);
    expect(document.body.flavour).toBe('default');
    expect(document.id).toBe(document.body.id);
  });

  it('creates the index once, with its mapping, when it does not exist', async () => {
    const createIndex = vi.fn();
    const client = {
      indexExists: vi.fn().mockResolvedValue(false),
      createIndex,
      bulkIndex: vi.fn().mockResolvedValue({ indexed: 1, errors: [] }),
    } as unknown as SearchClient;
    const processor = new RunnerUsageStoreProcessor(configService, {
      getClient: () => client,
    } as unknown as SearchClientService);

    await processor.process({
      data: validRunnerUsage,
    } as Job<RunnerUsagePayload>);
    await processor.process({
      data: validRunnerUsage,
    } as Job<RunnerUsagePayload>);

    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(createIndex.mock.calls[0][0]).toBe('runner_usage_');
  });

  it('throws when the search engine rejects the document, so BullMQ retries', async () => {
    const client = {
      indexExists: vi.fn().mockResolvedValue(true),
      createIndex: vi.fn(),
      bulkIndex: vi.fn().mockResolvedValue({
        indexed: 0,
        errors: [{ id: 'x', status: 400, reason: 'mapper_parsing_exception' }],
      }),
    } as unknown as SearchClient;
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const processor = new RunnerUsageStoreProcessor(configService, {
      getClient: () => client,
    } as unknown as SearchClientService);

    await expect(
      processor.process({ data: validRunnerUsage } as Job<RunnerUsagePayload>),
    ).rejects.toThrow('runner_usage_');
  });

  it('logs a job failure reported by the worker', () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const processor = new RunnerUsageStoreProcessor(configService, {
      getClient: () => ({}),
    } as unknown as SearchClientService);

    processor.onFailed(undefined, new Error('bulk rejected'));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bulk rejected'),
    );
  });
});
