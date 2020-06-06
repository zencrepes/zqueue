import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import fetchNode from './fetchNode/index';
import storePayload from './storePayload/index';
import storeRawPayload from './storeRawPayload/index';

import { ConfigService } from '../config.service';
import { GhClientService } from '../ghClient.service';
import { EsClientService } from '../esClient.service';

@Processor('github')
export class GithubProcessor {
  private readonly logger = new Logger(GithubProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ghClientService: GhClientService,
    private readonly esClientService: EsClientService,
  ) {}

  @Process('fetchRemoteNode')
  handlFetchNode(job: Job) {
    const ghClient = this.ghClientService.getGhClient();
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(
      'fetchRemoteNode - Processing en event of type: ' + job.data.eventType,
    );
    fetchNode(
      this.ghClientService,
      esClient,
      userConfig,
      this.logger,
      job.data.payload,
      job.data.eventType,
    );
  }

  @Process('storeNodePayload')
  pushNodeToEs(job: Job) {
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(
      'storeNodePayload - Processing en event of type: ' + job.data.eventType,
    );

    storePayload(
      esClient,
      userConfig,
      this.logger,
      job.data.payload,
      job.data.eventType,
    );
  }

  @Process('storeRaw')
  pushRawToEs(job: Job) {
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(
      'storeRaw - Processing en event of type: ' + job.data.eventType,
    );

    storeRawPayload(
      esClient,
      userConfig,
      this.logger,
      job.data.payload,
      job.data.eventType,
    );
  }
}
