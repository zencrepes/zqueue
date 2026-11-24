import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';

const bootstrap = async () => {
  // rawBody keeps the bytes GitHub signed, for signature verification.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', {
    limit: '50mb',
    extended: false,
    parameterLimit: 50000,
  });
  await app.listen(process.env.PORT ?? 3003);
};

await bootstrap();
