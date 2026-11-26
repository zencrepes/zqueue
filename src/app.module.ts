import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { ConfigModule } from './config/config.module.js';
import { ConfigService } from './config/config.service.js';
import { GithubModule } from './github/github.module.js';
import { PerfsModule } from './perfs/perfs.module.js';
import { RunnersModule } from './runners/runners.module.js';
import { parseRedisUrl } from './shared/parseRedisUrl.js';
import { SearchClientModule } from './search/searchClient.module.js';
import { TestingModule } from './testing/testing.module.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          ...parseRedisUrl(configService.getUserConfig().redis.host),
          // Required by BullMQ workers: a blocked command must not be
          // interrupted by the ioredis retry logic.
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      }),
    }),
    ConfigModule,
    SearchClientModule,
    GithubModule,
    TestingModule,
    PerfsModule,
    RunnersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
