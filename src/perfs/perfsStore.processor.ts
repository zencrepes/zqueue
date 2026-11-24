import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { ConfigService } from '../config/config.service.js';
import { recordDocuments } from '../search/recordDocuments.js';
import { SearchClientService } from '../search/searchClient.service.js';
import { parseIndexDefinition } from '../shared/parseIndexDefinition.js';
import perfsMapping from './esMapping.js';
import perfsSettings from './esSettings.js';
import type { PerfsPayload } from './perfsPayload.types.js';
import { transformPerf } from './transformPerf.js';

const perfsDefinition = parseIndexDefinition(perfsMapping, perfsSettings);

@Processor('perfs')
export class PerfsStoreProcessor extends WorkerHost {
  private readonly logger = new Logger(PerfsStoreProcessor.name);
  private readonly ensuredIndices = new Set<string>();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SearchClientService)
    private readonly searchClientService: SearchClientService,
  ) {
    super();
  }

  async process(job: Job<PerfsPayload>): Promise<void> {
    const client = this.searchClientService.getClient();
    const indices =
      this.configService.getUserConfig().elasticsearch.dataIndices;

    this.logger.log(
      `Processing a Perf event for: ${job.data.name} - Pushing Perf`,
    );
    await recordDocuments(
      client,
      indices.testingPerfs,
      perfsDefinition,
      [transformPerf(job.data)],
      this.ensuredIndices,
      this.logger,
    );
  }
}
