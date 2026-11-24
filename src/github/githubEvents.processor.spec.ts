import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { SearchClientService } from '../search/searchClient.service.js';
import type { SearchClient } from '../search/searchClient.types.js';
import type { GithubEventJob } from './githubEvent.types.js';
import { GithubEventsProcessor } from './githubEvents.processor.js';

const buildProcessor = (bulkResult: {
  indexed: number;
  errors: Array<{ id: string; status: number; reason: string }>;
}) => {
  const indexExists = vi.fn().mockResolvedValue(false);
  const createIndex = vi.fn().mockResolvedValue(undefined);
  const bulkIndex = vi.fn().mockResolvedValue(bulkResult);
  const client = {
    indexExists,
    createIndex,
    bulkIndex,
  } as unknown as SearchClient;
  const service = { getClient: () => client } as unknown as SearchClientService;
  return {
    processor: new GithubEventsProcessor(service),
    indexExists,
    createIndex,
    bulkIndex,
  };
};

const job = {
  data: {
    index: 'gh_events_issues',
    document: { id: 'guid-1', body: { event: 'issues' } },
  },
} as Job<GithubEventJob>;

describe('GithubEventsProcessor', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('creates the index and records the event', async () => {
    const { processor, createIndex, bulkIndex } = buildProcessor({
      indexed: 1,
      errors: [],
    });
    await processor.process(job);
    expect(createIndex).toHaveBeenCalledWith(
      'gh_events_issues',
      expect.objectContaining({ mappings: expect.anything() }),
    );
    expect(bulkIndex).toHaveBeenCalledWith('gh_events_issues', [
      job.data.document,
    ]);
  });

  it('memoizes the index check across jobs', async () => {
    const { processor, indexExists } = buildProcessor({
      indexed: 1,
      errors: [],
    });
    await processor.process(job);
    await processor.process(job);
    expect(indexExists).toHaveBeenCalledTimes(1);
  });

  it('throws when the bulk request reports an error, so BullMQ retries', async () => {
    const { processor } = buildProcessor({
      indexed: 0,
      errors: [{ id: 'guid-1', status: 400, reason: 'mapping conflict' }],
    });
    await expect(processor.process(job)).rejects.toThrow(
      'Bulk indexing into gh_events_issues failed',
    );
  });

  it('logs a job failure reported by the worker', () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { processor } = buildProcessor({ indexed: 1, errors: [] });
    processor.onFailed(job, new Error('security_exception'));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('security_exception'),
    );
  });
});
