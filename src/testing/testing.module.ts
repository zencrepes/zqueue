import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { SearchClientModule } from '../search/searchClient.module.js';
import { TestingController } from './testing.controller.js';
import { TestingStoreProcessor } from './testingStore.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'testing' }),
    ConfigModule,
    SearchClientModule,
  ],
  controllers: [TestingController],
  providers: [TestingStoreProcessor],
})
export class TestingModule {}
