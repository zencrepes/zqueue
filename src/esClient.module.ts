import { Module } from '@nestjs/common';
import { EsClientService } from './esClient.service';
import { ConfigModule } from './config.module';

@Module({
  imports: [ConfigModule.register()],
  providers: [EsClientService],
  exports: [EsClientService],
})
export class EsClientModule {}
