import { InjectQueue } from '@nestjs/bullmq';
import {
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
import type { PerfsPayload } from './perfsPayload.types.js';

@Controller('perfs')
export class PerfsController {
  private readonly logger = new Logger(PerfsController.name);

  constructor(
    @InjectQueue('perfs') private readonly perfsQueue: Queue,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  async processWebhook(
    @Body() payload: PerfsPayload,
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const secret = this.configService.getUserConfig().testing.webhook.secret;

    // The same signature mechanism as GitHub webhooks.
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
        'Rejected a perfs webhook delivery: missing or invalid signature, ' +
          'please check the secrets on both ends',
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Received a Perf event for: ${payload.name}`);
    await this.perfsQueue.add('store', payload);
    return { success: true };
  }
}
