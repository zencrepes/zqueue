import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubProcessor } from './github.processor';
import { GithubStorePayloadProcessor } from './githubStorePayload.processor';
import { GithubStoreRawPayloadProcessor } from './githubStoreRawPayload.processor';

import { ConfigModule } from '../config.module';
import { EsClientModule } from '../esClient.module';
import { GhClientModule } from '../ghClient.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'github',
        limiter: { max: 1, duration: 1000 }, // Limiting to one query processed by second
      },
      {
        name: 'storepayload',
      },
      {
        name: 'storerawpayload',
      },
    ),
    ConfigModule.register(),
    EsClientModule,
    GhClientModule,
  ],
  controllers: [GithubController],
  providers: [
    GithubProcessor,
    GithubStorePayloadProcessor,
    GithubStoreRawPayloadProcessor,
  ],
})
export class GithubModule {}
