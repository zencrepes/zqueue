import { Controller, Get, Inject } from '@nestjs/common';

import { ConfigService } from './config/config.service.js';

@Controller()
export class AppController {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Get()
  getStatus() {
    return {
      name: 'zqueue',
      version: this.configService.get('APP_VERSION'),
      status: 'ok',
    };
  }
}
