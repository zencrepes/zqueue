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
import { buildEventDocument } from './buildEventDocument.js';
import { eventIndexName } from './eventIndexName.js';
import { shouldProcessEvent } from './shouldProcessEvent.js';

@Controller('github')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    @InjectQueue('github') private readonly githubQueue: Queue,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  async processWebhook(
    @Body() payload: Record<string, unknown>,
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const webhookConfig = this.configService.getUserConfig().github.webhook;

    const validSignature = verifyWebhookSignature(
      request.rawBody ?? Buffer.from(''),
      webhookConfig.secret,
      {
        sha256: headers['x-hub-signature-256'],
        sha1: headers['x-hub-signature'],
      },
    );
    if (!validSignature) {
      this.logger.warn(
        'Rejected a GitHub webhook delivery: missing or invalid signature, ' +
          'please check the secrets on both ends',
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = headers['x-github-event'] ?? 'unknown';
    const action = typeof payload.action === 'string' ? payload.action : '';
    this.logger.log(
      `Received a GitHub event of type: ${event}` +
        (action === '' ? '' : ` - action: ${action}`),
    );

    if (
      !shouldProcessEvent(
        event,
        webhookConfig.includeGithubEvents,
        webhookConfig.excludeGithubEvents,
      )
    ) {
      this.logger.log(
        `Event type (${event}) is excluded from recording by configuration`,
      );
      return { success: true, queued: false };
    }

    const document = buildEventDocument(event, payload, headers, new Date());
    await this.githubQueue.add('record', {
      index: eventIndexName(webhookConfig.esIndexPrefix, event),
      document,
    });
    return { success: true, queued: true };
  }
}
