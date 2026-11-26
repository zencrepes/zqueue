import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { ConfigService } from '../config/config.service.js';
import { recordDocuments } from '../search/recordDocuments.js';
import { SearchClientService } from '../search/searchClient.service.js';
import { parseIndexDefinition } from '../shared/parseIndexDefinition.js';
import runnerUsageMapping from './esMapping.js';
import runnerUsageSettings from './esSettings.js';
import type { RunnerUsagePayload } from './runnerUsage.types.js';
import { transformRunnerUsage } from './transformRunnerUsage.js';

const runnerUsageDefinition = parseIndexDefinition(
  runnerUsageMapping,
  runnerUsageSettings,
);

@Processor('runners')
export class RunnerUsageStoreProcessor extends WorkerHost {
  private readonly logger = new Logger(RunnerUsageStoreProcessor.name);
  private readonly ensuredIndices = new Set<string>();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SearchClientService)
    private readonly searchClientService: SearchClientService,
  ) {
    super();
  }

  // BullMQ retries a failed job silently; this makes each failure visible.
  @OnWorkerEvent('failed')
  onFailed(job: Job<RunnerUsagePayload> | undefined, error: Error): void {
    this.logger.error(
      `Runner usage job ${job?.id ?? 'unknown'} failed ` +
        `(attempt ${job?.attemptsMade ?? '?'}): ${error.message}`,
    );
  }

  async process(job: Job<RunnerUsagePayload>): Promise<void> {
    const client = this.searchClientService.getClient();
    const indices =
      this.configService.getUserConfig().elasticsearch.dataIndices;

    this.logger.log(
      `Processing a runner usage report for: ${job.data.runnerName}`,
    );
    await recordDocuments(
      client,
      indices.runnerUsage,
      runnerUsageDefinition,
      [transformRunnerUsage(job.data)],
      this.ensuredIndices,
      this.logger,
    );
  }
}
