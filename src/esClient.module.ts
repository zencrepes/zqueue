import { Module, Global } from '@nestjs/common';
import { EsClientService } from './esClient.service';
import { ConfigModule } from './config.module';

@Module({
  imports: [ConfigModule.register(), EsClientModule],
  providers: [EsClientService],
  exports: [EsClientService],
})
export class EsClientModule {}
