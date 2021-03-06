import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import fetchNode from './fetchNode/index';

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
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(
      'fetchRemoteNode - Processing sn event of type: ' + job.data.eventType,
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
}
