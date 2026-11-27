import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Request } from 'express';

import { ConfigService } from '../config/config.service.js';
import { verifyWebhookSignature } from '../shared/verifyWebhookSignature.js';
import { validateRunnerUsage } from './validateRunnerUsage.js';

@Controller('runners')
export class RunnersController {
  private readonly logger = new Logger(RunnersController.name);

  constructor(
    @InjectQueue('runners') private readonly runnersQueue: Queue,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  async processWebhook(
    @Body() payload: unknown,
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const secret = this.configService.getUserConfig().runners.webhook.secret;

    // The same signature mechanism as GitHub webhooks. An empty secret
    // rejects every report.
    const validSignature = verifyWebhookSignature(
      request.rawBody ?? Buffer.from(''),
      secret,
      {
        sha256: headers['x-hub-signature-256'],
        sha1: headers['x-hub-signature'],
      },
    );
    if (!validSignature) {
      this.logger.warn(
        'Rejected a runner usage report: missing or invalid signature, ' +
          'please check the secrets on both ends',
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Validation comes after the signature, so a caller without the secret
    // learns nothing about the schema.
    const validation = validateRunnerUsage(payload);
    if (!validation.ok) {
      this.logger.warn(`Rejected a runner usage report: ${validation.reason}`);
      throw new BadRequestException(validation.reason);
    }

    this.logger.log(
      `Received a runner usage report for: ${validation.value.runnerName}`,
    );
    await this.runnersQueue.add('store', validation.value);
    return { success: true };
  }
}
