import { Module, Global } from '@nestjs/common';
import { GhClientService } from './ghClient.service';
import { ConfigModule } from './config.module';

@Module({
  imports: [ConfigModule.register(), GhClientModule],
  providers: [GhClientService],
  exports: [GhClientService],
})
export class GhClientModule {}
