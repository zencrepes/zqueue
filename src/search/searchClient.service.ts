import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import { ConfigService } from '../config/config.service.js';
import { createSearchClient } from './createSearchClient.js';
import type { SearchClient } from './searchClient.types.js';

@Injectable()
export class SearchClientService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchClientService.name);
  private readonly client: SearchClient;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.client = createSearchClient(
      configService.getUserConfig().elasticsearch,
    );
    this.logger.log(this.client.description);
  }

  getClient(): SearchClient {
    return this.client;
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      const { status } = await this.client.checkHealth();
      if (status === 'red') {
        this.logger.warn('The search cluster is in a red state');
      } else {
        this.logger.log(`Search cluster reachable, status: ${status}`);
      }
    } catch (error) {
      this.logger.warn(
        'Could not reach the search cluster at startup: ' +
          (error as Error).message,
      );
    }
  }
}
