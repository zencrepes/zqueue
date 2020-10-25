import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { esMapping, esSettings, StateNode, getId } from '@bit/zencrepes.zindexer.testing-states';
import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

import { ConfigService } from '../config.service';
import { EsClientService } from '../esClient.service';

@Processor('testingstorepayload')
export class TestingStorePayloadProcessor {
  private readonly logger = new Logger(TestingStorePayloadProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly esClientService: EsClientService,
  ) {}

  @Process('testingstore')
  pushNodeToEs(job: Job) {
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(`Received a JUnit State event for: ${job.data.name}, version: ${job.data.version}`);

    // Check if the index exists, create it if it does not    
    checkEsIndex(esClient, userConfig.elasticsearch.dataIndices.testingStates, esMapping, esSettings, console.log);

    // Transforming the object, objective is just to match to GitHub's to be consistent with the rest of the app
    const state: StateNode = {
      ...job.data,
      full: job.data.name + '_' + job.data.version,
      dependencies: {
        edges: job.data.dependencies.map((d) => {
          return {
            node: {
              ...d,
              full: d.name + '_' + d.version,
              id: getId(d)
            }
          }
        }),
        totalCount: job.data.dependencies.length
      }
    }

    // Push single document to Elasticsearch
    pushEsNodes(esClient, userConfig.elasticsearch.dataIndices.testingStates, [state], console.log);
  }
}
