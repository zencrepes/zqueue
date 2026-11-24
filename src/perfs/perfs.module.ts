import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { SearchClientModule } from '../search/searchClient.module.js';
import { PerfsController } from './perfs.controller.js';
import { PerfsStoreProcessor } from './perfsStore.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'perfs' }),
    ConfigModule,
    SearchClientModule,
  ],
  controllers: [PerfsController],
  providers: [PerfsStoreProcessor],
})
export class PerfsModule {}
