import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { ConfigService } from '../config/config.service.js';
import { recordDocuments } from '../search/recordDocuments.js';
import { SearchClientService } from '../search/searchClient.service.js';
import { parseIndexDefinition } from '../shared/parseIndexDefinition.js';
import casesMapping from './cases/esMapping.js';
import casesSettings from './cases/esSettings.js';
import { transformCases } from './cases/transformCases.js';
import runsMapping from './runs/esMapping.js';
import runsSettings from './runs/esSettings.js';
import { transformRun } from './runs/transformRun.js';
import statesMapping from './states/esMapping.js';
import statesSettings from './states/esSettings.js';
import { transformState } from './states/transformState.js';
import type { TestingPayload } from './testingPayload.types.js';

const statesDefinition = parseIndexDefinition(statesMapping, statesSettings);
const runsDefinition = parseIndexDefinition(runsMapping, runsSettings);
const casesDefinition = parseIndexDefinition(casesMapping, casesSettings);

@Processor('testing')
export class TestingStoreProcessor extends WorkerHost {
  private readonly logger = new Logger(TestingStoreProcessor.name);
  private readonly ensuredIndices = new Set<string>();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SearchClientService)
    private readonly searchClientService: SearchClientService,
  ) {
    super();
  }

  async process(job: Job<TestingPayload>): Promise<void> {
    const client = this.searchClientService.getClient();
    const indices =
      this.configService.getUserConfig().elasticsearch.dataIndices;
    const payload = job.data;

    this.logger.log(
      `Processing a State event for: ${payload.name}, version: ${payload.version}`,
    );

    await recordDocuments(
      client,
      indices.testingStates,
      statesDefinition,
      [transformState(payload)],
      this.ensuredIndices,
      this.logger,
    );

    await recordDocuments(
      client,
      indices.testingRuns,
      runsDefinition,
      [transformRun(payload)],
      this.ensuredIndices,
      this.logger,
    );

    const cases = transformCases(payload);
    if (cases.length > 0) {
      this.logger.log(
        `Event for: ${payload.name}, version: ${payload.version} - ` +
          `Pushing ${cases.length} Cases`,
      );
      await recordDocuments(
        client,
        indices.testingCases,
        casesDefinition,
        cases,
        this.ensuredIndices,
        this.logger,
      );
    }
  }
}
