import { Logger, Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import * as fs from 'fs';

import { ConfigService } from './config.service';

@Injectable()
export class EsClientService {
  private readonly logger = new Logger(EsClientService.name);
  private readonly esClient: Client;

  constructor(configService: ConfigService) {
    const userConfig = configService.getUserConfig();

    if (
      userConfig.elasticsearch.cloudId !== undefined &&
      userConfig.elasticsearch.cloudId !== null &&
      userConfig.elasticsearch.cloudId !== '' &&
      userConfig.elasticsearch.username !== undefined &&
      userConfig.elasticsearch.username !== null &&
      userConfig.elasticsearch.username !== '' &&
      userConfig.elasticsearch.password !== undefined &&
      userConfig.elasticsearch.password !== null &&
      userConfig.elasticsearch.password !== ''
    ) {
      this.esClient = new Client({
        cloud: {
          id: userConfig.elasticsearch.cloudId,
          username: userConfig.elasticsearch.username,
          password: userConfig.elasticsearch.password,
        },
      });
      this.logger.log(
        'Elasticsearch client initialized with connection to Elastic Cloud ID: ' +
          userConfig.elasticsearch.cloudId.slice(0, 5) +
          '...',
      );
    } else if (
      userConfig.elasticsearch.sslCa !== undefined &&
      userConfig.elasticsearch.sslCa !== null &&
      userConfig.elasticsearch.sslCa !== ''
    ) {
      this.esClient = new Client({
        node: userConfig.elasticsearch.host,
        ssl: {
          ca: fs.readFileSync(userConfig.elasticsearch.sslCa),
        },
      });
      this.logger.log(
        'Elasticsearch client initialized with SSL connection to host: ' +
          userConfig.elasticsearch.host,
      );
    } else {
      this.esClient = new Client({
        node: userConfig.elasticsearch.host,
      });
      this.logger.log(
        'Elasticsearch client initialized with host: ' +
          userConfig.elasticsearch.host,
      );
    }
  }

  getEsClient() {
    return this.esClient;
  }
}
