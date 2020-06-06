import { InjectQueue } from '@nestjs/bull';
import { Logger, Controller, Post, Body, Req, Headers } from '@nestjs/common';
import { Request } from 'express';
import { Queue } from 'bull';

import * as CryptoJS from 'crypto-js';

import { WebhookPayload } from './webhookPayload.type';
import { ConfigService } from '../config.service';

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

    console.log(signature);
    console.log(userConfig.github.webhook.secret);
    // var hash = hmacSHA512(userConfig.github.webhook.secret, payload);

    // const { signer } = require('x-hub-signature');
    // const sign = signer({
    //   algorithm: 'sha1',
    //   secret: 'abcd',
    // });
    // const signaturef = sign(payload);
    // console.log(signaturef);

    // const webhookMiddleware = require('x-hub-signature').middleware;
    // const hash = webhookMiddleware({
    //   algorithm: 'sha1',
    //   secret: userConfig.github.webhook.secret,
    //   require: true,
    //   getRawBody: req => req.body,
    // });
    // console.log('sha1=' + hash);

    //https://github.com/compwright/x-hub-signature

    var hashb = CryptoJS.HmacSHA1(
      request,
      userConfig.github.webhook.secret,
      // userConfig.github.webhook.secret,
    ).toString(CryptoJS.enc.Hex);
    console.log('sha1=' + hashb);

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
      userConfig.github.webhook.fetchNode.githubEvents.includes('*') ||
      userConfig.github.webhook.fetchNode.githubEvents.includes(eventType)
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
    }

    if (
      userConfig.github.webhook.nodePayload.githubEvents.includes('*') ||
      userConfig.github.webhook.nodePayload.githubEvents.includes(eventType)
    ) {
      await this.storePayload.add('store', {
        payload: payload,
        eventType: zcEntity,
      });
    }

    if (
      userConfig.github.webhook.timelinePayload.githubEvents.includes('*') ||
      userConfig.github.webhook.timelinePayload.githubEvents.includes(eventType)
    ) {
      await this.storeRawpayload.add('store', {
        payload: payload,
        eventType: zcEntity,
      });
    }
  }
}
