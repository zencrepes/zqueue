import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from './config.module';
import { GhClientModule } from './ghClient.module';
import { EsClientModule } from './esClient.module';

import { GithubModule } from './github/github.module';
import { TestingModule } from './testing/testing.module';

@Module({
  imports: [
    GithubModule,
    TestingModule,
    ConfigModule.register(),
    GhClientModule,
    EsClientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
