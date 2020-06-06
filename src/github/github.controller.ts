import { InjectQueue } from '@nestjs/bull';
import { Logger, Controller, Post, Body, Req, Headers } from '@nestjs/common';
import { Request } from 'express';
import { Queue } from 'bull';
import * as crypto from 'crypto';

import { WebhookPayload } from './webhookPayload.type';
import { ConfigService } from '../config.service';

//https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428
const verifySignature = (
  githubSignature: string,
  confSecret: string,
  payload: string,
) => {
  // const crypto = require('crypto');
  const hmac = crypto.createHmac('sha1', confSecret);
  const digest = Buffer.from(
    'sha1=' + hmac.update(payload).digest('hex'),
    'utf8',
  );
  const checksum = Buffer.from(githubSignature, 'utf8');
  if (
    checksum.length !== digest.length ||
    !crypto.timingSafeEqual(digest, checksum)
  ) {
    return false;
  } else {
    return true;
  }
};

const shouldProcessEvent = (
  githubEvent: string,
  includeGithubEvents: string[],
  excludeGithubEvents: string[],
) => {
  if (excludeGithubEvents.includes(githubEvent)) {
    return false;
  }
  if (includeGithubEvents.includes(githubEvent)) {
    return true;
  }
  if (includeGithubEvents.includes('*')) {
    return true;
  }
  if (excludeGithubEvents.includes('*')) {
    return false;
  }
  return true;
};

@Controller('github')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    @InjectQueue('github') private readonly githubQueue: Queue,
    @InjectQueue('storepayload') private readonly storePayload: Queue,
    @InjectQueue('storerawpayload') private readonly storeRawpayload: Queue,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  async processWebhook(
    @Body() payload: WebhookPayload,
    @Req() request: Request,
    @Headers() headers: Headers,
  ) {
    const userConfig = this.configService.getUserConfig();
    const eventType =
      headers['x-github-event'] !== undefined
        ? headers['x-github-event']
        : 'noheader';

    const signature =
      headers['x-hub-signature'] !== undefined
        ? headers['x-hub-signature']
        : 'noheader';

    if (
      verifySignature(
        signature,
        userConfig.github.webhook.secret,
        JSON.stringify(payload),
      ) !== true
    ) {
      this.logger.warn(
        'Received an incorrect x-hub-signature from GitHub, please check the secrets on both ends',
      );
      return;
    }

    const githubEvent = userConfig.github.webhook.events.find(
      e => e.githubEvent === eventType,
    );
    const zcEntity =
      githubEvent !== undefined ? githubEvent.zencrepesEntity : eventType;

    this.logger.log(
      'Received a GitHub event of type: ' +
        eventType +
        ' - ZenCrepes entity: ' +
        zcEntity +
        ' - Action: ' +
        payload.action,
    );

    if (eventType === 'ping') {
      this.logger.log('Received a ping from GitHub, doing nothing');
      return;
    }

    if (
      shouldProcessEvent(
        eventType,
        userConfig.github.webhook.fetchNode.includeGithubEvents,
        userConfig.github.webhook.fetchNode.excludeGithubEvents,
      ) === true
    ) {
      if (githubEvent !== undefined) {
        await this.githubQueue.add('fetchRemoteNode', {
          payload: payload,
          eventType: zcEntity,
        });
      } else {
        this.logger.log(
          'Received an event type (' +
            eventType +
            ') not known by fetchNode configuration, cannot fetch its node content',
        );
      }
    } else {
      this.logger.log(
        'Received an event type (' +
          eventType +
          ') excluded from processing by fetchNode configuration',
      );
    }

    if (
      shouldProcessEvent(
        eventType,
        userConfig.github.webhook.nodePayload.includeGithubEvents,
        userConfig.github.webhook.nodePayload.excludeGithubEvents,
      ) === true
    ) {
      await this.storePayload.add('store', {
        payload: payload,
        eventType: zcEntity,
      });
    } else {
      this.logger.log(
        'Received an event type (' +
          eventType +
          ') excluded from processing by nodePayload configuration',
      );
    }

    if (
      shouldProcessEvent(
        eventType,
        userConfig.github.webhook.timelinePayload.includeGithubEvents,
        userConfig.github.webhook.timelinePayload.excludeGithubEvents,
      ) === true
    ) {
      await this.storeRawpayload.add('store', {
        payload: payload,
        eventType: zcEntity,
      });
    } else {
      this.logger.log(
        'Received an event type (' +
          eventType +
          ') excluded from processing by timelinePayload configuration',
      );
    }
  }
}
