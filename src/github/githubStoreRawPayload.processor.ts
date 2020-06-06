import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import storeRawPayload from './storeRawPayload/index';

import { ConfigService } from '../config.service';
import { EsClientService } from '../esClient.service';

@Processor('storerawpayload')
export class GithubStoreRawPayloadProcessor {
  private readonly logger = new Logger(GithubStoreRawPayloadProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly esClientService: EsClientService,
  ) {}

  @Process('store')
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
