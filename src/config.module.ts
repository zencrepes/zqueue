import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from './config.service';

// @Module({
//   providers: [ConfigService],
//   exports: [ConfigService],
// })
// export class ConfigModule {}

@Module({})
export class ConfigModule {
  static register(): DynamicModule {
    return {
      module: ConfigModule,
      providers: [ConfigService],
      exports: [ConfigService],
    };
  }
}
