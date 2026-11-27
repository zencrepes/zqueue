import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { SearchClientModule } from '../search/searchClient.module.js';
import { RunnersController } from './runners.controller.js';
import { RunnerUsageStoreProcessor } from './runnerUsageStore.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'runners' }),
    ConfigModule,
    SearchClientModule,
  ],
  controllers: [RunnersController],
  providers: [RunnerUsageStoreProcessor],
})
export class RunnersModule {}
