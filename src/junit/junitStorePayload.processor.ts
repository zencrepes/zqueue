import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { esMapping, esSettings } from '@bit/zencrepes.zindexer.junit-states';
import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

import { ConfigService } from '../config.service';
import { EsClientService } from '../esClient.service';

@Processor('junitstorepayload')
export class JunitStorePayloadProcessor {
  private readonly logger = new Logger(JunitStorePayloadProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly esClientService: EsClientService,
  ) {}

  @Process('junitstore')
  pushNodeToEs(job: Job) {
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(`Received a JUnit State event for: ${job.data.name}, version: ${job.data.version}`);

    // Check if the index exists, create it if it does not    
    checkEsIndex(esClient, userConfig.elasticsearch.dataIndices.junitStates, esMapping, esSettings, console.log);

    // Push single document to Elasticsearch
    pushEsNodes(esClient, userConfig.elasticsearch.dataIndices.junitStates, [job.data], console.log);
  }
}
