import { InjectQueue } from '@nestjs/bull';
import { Logger, Controller, Post, Body, Req, Headers } from '@nestjs/common';
import { Request } from 'express';
import { Queue } from 'bull';
import * as crypto from 'crypto';

import { StateNode } from '@bit/zencrepes.zindexer.junit-states';
import { ConfigService } from '../config.service';

//https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428
const verifySignature = (
  payloadSignature: string,
  confSecret: string,
  payload: string,
) => {
  // const crypto = require('crypto');
  const hmac = crypto.createHmac('sha1', confSecret);
  const digest = Buffer.from(
    'sha1=' + hmac.update(payload).digest('hex'),
    'utf8',
  );
  const checksum = Buffer.from(payloadSignature, 'utf8');
  if (
    checksum.length !== digest.length ||
    !crypto.timingSafeEqual(digest, checksum)
  ) {
    return false;
  } else {
    return true;
  }
};

@Controller('junit')
export class JunitController {
  private readonly logger = new Logger(JunitController.name);

  constructor(
    @InjectQueue('junitstorepayload') private readonly storePayload: Queue,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  async processWebhook(
    @Body() payload: StateNode,
    @Req() request: Request,
    @Headers() headers: Headers,
  ) {
    const userConfig = this.configService.getUserConfig();

    const signature =
      headers['x-hub-signature'] !== undefined
        ? headers['x-hub-signature']
        : 'noheader';

    // Using the same security mechanism than for GitHub webhooks
    if (
      verifySignature(
        signature,
        userConfig.junit.webhook.secret,
        JSON.stringify(payload),
      ) !== true
    ) {
      this.logger.warn(
        'Received an incorrect x-hub-signature from your source, please check the secrets on both ends',
      );
      return {success: false}
    }

    this.logger.log(`Received a JUnit State event for: ${payload.name}, version: ${payload.version}`);

    await this.storePayload.add('junitstore', payload);
    
    return {success: true}
  }
}
