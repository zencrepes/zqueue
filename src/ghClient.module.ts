import { Module } from '@nestjs/common';
import { GhClientService } from './ghClient.service';
import { ConfigModule } from './config.module';

@Module({
  imports: [ConfigModule.register()],
  providers: [GhClientService],
  exports: [GhClientService],
})
export class GhClientModule {}
