import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { TestingController } from './testing.controller';
import { ConfigService } from '../config.service';

const SECRET = 'test-states-secret';

const sign = (payload, secret: string = SECRET) => {
  const hmac = crypto.createHmac('sha1', secret);
  return 'sha1=' + hmac.update(JSON.stringify(payload)).digest('hex');
};

describe('TestingController', () => {
  let controller: TestingController;
  let storePayloadQueue: { add: jest.Mock };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storePayloadQueue = { add: jest.fn() };
    const configService = {
      getUserConfig: () => ({
        testing: { webhook: { secret: SECRET } },
      }),
    } as ConfigService;
    controller = new TestingController(storePayloadQueue as any, configService);
  });

  it('rejects a payload with an invalid signature', async () => {
    const payload = { name: 'my-component', version: '1.0.0' } as any;

    const result = await controller.processWebhook(payload, {} as any, {
      'x-hub-signature': sign(payload, 'wrong-secret'),
    } as any);

    expect(result).toEqual({ success: false });
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
  });

  it('rejects a payload without a signature header', async () => {
    const payload = { name: 'my-component', version: '1.0.0' } as any;

    const result = await controller.processWebhook(
      payload,
      {} as any,
      {} as any,
    );

    expect(result).toEqual({ success: false });
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
  });

  it('queues a correctly signed payload', async () => {
    const payload = { name: 'my-component', version: '1.0.0' } as any;

    const result = await controller.processWebhook(payload, {} as any, {
      'x-hub-signature': sign(payload),
    } as any);

    expect(result).toEqual({ success: true });
    expect(storePayloadQueue.add).toHaveBeenCalledWith('testingstore', payload);
  });
});
