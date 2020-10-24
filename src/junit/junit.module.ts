import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { JunitController } from './junit.controller';
import { JunitStorePayloadProcessor } from './junitStorePayload.processor';

import { ConfigModule } from '../config.module';
import { ConfigService } from '../config.service';
import { EsClientModule } from '../esClient.module';

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
        name: 'junitstorepayload',
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
  ],
  controllers: [JunitController],
  providers: [
    JunitStorePayloadProcessor,
  ],
})
export class JunitModule {}
