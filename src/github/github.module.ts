import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubProcessor } from './github.processor';
import { GithubStorePayloadProcessor } from './githubStorePayload.processor';
import { GithubStoreRawPayloadProcessor } from './githubStoreRawPayload.processor';

import { ConfigModule } from '../config.module';
import { ConfigService } from '../config.service';
import { EsClientModule } from '../esClient.module';
import { GhClientModule } from '../ghClient.module';

@Module({
  imports: [
    // BullModule.registerQueue(
    //   {
    //     name: 'github',
    //     limiter: { max: 1, duration: 1000 }, // Limiting to one query processed by second
    //   },
    //   {
    //     name: 'storepayload',
    //   },
    //   {
    //     name: 'storerawpayload',
    //   },
    // ),
    BullModule.registerQueueAsync(
      {
        name: 'github',
        imports: [ConfigModule.register()],
        inject: [ConfigService],
        useFactory: async (
          configService: ConfigService,
        ): Promise<BullModuleOptions> => {
          const userConfig = configService.getUserConfig();
          return {
            redis: userConfig.redis.host,
            limiter: {
              max: userConfig.github.fetch.maxParallel,
              duration: userConfig.github.fetch.delayBetweenCalls,
            }, // Limiting to one query processed by second
          };
        },
      },
      {
        name: 'storepayload',
        imports: [ConfigModule.register()],
        inject: [ConfigService],
        useFactory: async (
          configService: ConfigService,
        ): Promise<BullModuleOptions> => {
          const userConfig = configService.getUserConfig();
          return {
            redis: userConfig.redis.host,
          };
        },
      },
      {
        name: 'storerawpayload',
        imports: [ConfigModule.register()],
        inject: [ConfigService],
        useFactory: async (
          configService: ConfigService,
        ): Promise<BullModuleOptions> => {
          const userConfig = configService.getUserConfig();
          return {
            redis: userConfig.redis.host,
          };
        },
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
