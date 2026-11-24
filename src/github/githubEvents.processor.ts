import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { bulkIndexDocuments } from '../search/bulkIndexDocuments.js';
import { ensureIndex } from '../search/ensureIndex.js';
import { SearchClientService } from '../search/searchClient.service.js';
import { eventsIndexDefinition } from './eventsIndexDefinition.js';
import type { GithubEventJob } from './githubEvent.types.js';

@Processor('github')
export class GithubEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(GithubEventsProcessor.name);
  private readonly ensuredIndices = new Set<string>();

  constructor(
    @Inject(SearchClientService)
    private readonly searchClientService: SearchClientService,
  ) {
    super();
  }

  // BullMQ retries a failed job silently; this makes each failure visible.
  @OnWorkerEvent('failed')
  onFailed(job: Job<GithubEventJob> | undefined, error: Error): void {
    this.logger.error(
      `Recording job ${job?.id ?? 'unknown'} failed ` +
        `(attempt ${job?.attemptsMade ?? '?'}): ${error.message}`,
    );
  }

  async process(job: Job<GithubEventJob>): Promise<void> {
    const client = this.searchClientService.getClient();
    const { index, document } = job.data;

    const created = await ensureIndex(
      client,
      index,
      eventsIndexDefinition,
      this.ensuredIndices,
    );
    if (created) {
      this.logger.log(`Created index: ${index}`);
    }

    const result = await bulkIndexDocuments(client, index, [document]);
    if (result.errors.length > 0) {
      const reasons = result.errors
        .map((error) => `${error.id}: ${error.reason} (${error.status})`)
        .join(', ');
      this.logger.error(`Failed to record an event into ${index}: ${reasons}`);
      // Throwing hands the job back to BullMQ for a retry.
      throw new Error(`Bulk indexing into ${index} failed: ${reasons}`);
    }
    this.logger.log(
      `Recorded a GitHub event into ${index} (id: ${document.id})`,
    );
  }
}
