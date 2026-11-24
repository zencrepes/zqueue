import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { SearchClientService } from './searchClient.service.js';

@Module({
  imports: [ConfigModule],
  providers: [SearchClientService],
  exports: [SearchClientService],
})
export class SearchClientModule {}
