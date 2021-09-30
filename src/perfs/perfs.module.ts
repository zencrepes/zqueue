import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PerfsController } from './perfs.controller';
import { PerfsStorePayloadProcessor } from './perfsStorePayload.processor';

import { ConfigModule } from '../config.module';
import { ConfigService } from '../config.service';
import { EsClientModule } from '../esClient.module';

@Module({
  imports: [
    BullModule.registerQueueAsync(
      {
        name: 'perfsstorepayload',
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
  controllers: [PerfsController],
  providers: [
    PerfsStorePayloadProcessor,
  ],
})
export class PerfsModule {}
