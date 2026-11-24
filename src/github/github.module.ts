import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { SearchClientModule } from '../search/searchClient.module.js';
import { GithubController } from './github.controller.js';
import { GithubEventsProcessor } from './githubEvents.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'github' }),
    ConfigModule,
    SearchClientModule,
  ],
  controllers: [GithubController],
  providers: [GithubEventsProcessor],
})
export class GithubModule {}
