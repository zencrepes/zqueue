import { createHmac } from 'node:crypto';

import { Logger, UnauthorizedException } from '@nestjs/common';
import type { Queue } from 'bullmq';

import type { ConfigService } from '../config/config.service.js';
import { PerfsController } from './perfs.controller.js';
import type { PerfsPayload } from './perfsPayload.types.js';

const SECRET = 'perfs-webhook-test-secret';

const sign256 = (body: string) =>
  'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

const payload = { name: 'nightly-perf', runs: [] } as unknown as PerfsPayload;

const buildController = () => {
  const queue = { add: vi.fn() };
  const configService = {
    getUserConfig: () => ({ testing: { webhook: { secret: SECRET } } }),
  } as unknown as ConfigService;
  return {
    controller: new PerfsController(queue as unknown as Queue, configService),
    queue,
  };
};

describe('PerfsController', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('queues a correctly signed payload', async () => {
    const { controller, queue } = buildController();
    const result = await controller.processWebhook(
      payload,
      { rawBody: Buffer.from(JSON.stringify(payload)) } as never,
      { 'x-hub-signature-256': sign256(JSON.stringify(payload)) },
    );
    expect(result).toEqual({ success: true });
    expect(queue.add).toHaveBeenCalledWith('store', payload);
  });

  it('rejects an invalid signature with 401', async () => {
    const { controller, queue } = buildController();
    await expect(
      controller.processWebhook(
        payload,
        { rawBody: Buffer.from(JSON.stringify(payload)) } as never,
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
