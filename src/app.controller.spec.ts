import type { ConfigService } from './config/config.service.js';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('reports the app name, version and status', () => {
    const configService = {
      get: (key: string) => (key === 'APP_VERSION' ? '2.0.0' : ''),
    } as unknown as ConfigService;
    expect(new AppController(configService).getStatus()).toEqual({
      name: 'zqueue',
      version: '2.0.0',
      status: 'ok',
    });
  });
});
