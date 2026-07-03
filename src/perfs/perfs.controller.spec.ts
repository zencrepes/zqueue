import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { PerfsController } from './perfs.controller';
import { ConfigService } from '../config.service';

const SECRET = 'test-perfs-secret';

const sign = (payload, secret: string = SECRET) => {
  const hmac = crypto.createHmac('sha1', secret);
  return 'sha1=' + hmac.update(JSON.stringify(payload)).digest('hex');
};

describe('PerfsController', () => {
  let controller: PerfsController;
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
    controller = new PerfsController(storePayloadQueue as any, configService);
  });

  it('rejects a payload with an invalid signature', async () => {
    const payload = { name: 'my-perf-run' } as any;

    const result = await controller.processWebhook(payload, {} as any, {
      'x-hub-signature': sign(payload, 'wrong-secret'),
    } as any);

    expect(result).toEqual({ success: false });
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
  });

  it('rejects a payload without a signature header', async () => {
    const payload = { name: 'my-perf-run' } as any;

    const result = await controller.processWebhook(
      payload,
      {} as any,
      {} as any,
    );

    expect(result).toEqual({ success: false });
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
  });

  it('queues a correctly signed payload', async () => {
    const payload = { name: 'my-perf-run' } as any;

    const result = await controller.processWebhook(payload, {} as any, {
      'x-hub-signature': sign(payload),
    } as any);

    expect(result).toEqual({ success: true });
    expect(storePayloadQueue.add).toHaveBeenCalledWith('perfsstore', payload);
  });
});
