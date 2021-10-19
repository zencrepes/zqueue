import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.json({limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: false, parameterLimit: 50000 }))  
  await app.listen(3003);
}
bootstrap();
