import { createHmac } from 'node:crypto';

import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';

import { validRunnerUsage } from '../../test/fixtures/runnerUsage.js';
import type { ConfigService } from '../config/config.service.js';
import { RunnersController } from './runners.controller.js';

// A made-up secret for these tests only.
const SECRET = 'runners-controller-test-secret';

const sign256 = (body: string, secret = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

const buildController = (secret = SECRET) => {
  const queue = { add: vi.fn() };
  const configService = {
    getUserConfig: () => ({ runners: { webhook: { secret } } }),
  } as unknown as ConfigService;
  return {
    controller: new RunnersController(queue as unknown as Queue, configService),
    queue,
  };
};

const rawBodyOf = (payload: unknown) =>
  ({ rawBody: Buffer.from(JSON.stringify(payload)) }) as never;

describe('RunnersController', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('queues a correctly signed valid report', async () => {
    const { controller, queue } = buildController();
    const result = await controller.processWebhook(
      validRunnerUsage,
      rawBodyOf(validRunnerUsage),
      { 'x-hub-signature-256': sign256(JSON.stringify(validRunnerUsage)) },
    );
    expect(result).toEqual({ success: true });
    expect(queue.add).toHaveBeenCalledWith('store', validRunnerUsage);
  });

  it('queues the validated report, with a numeric string converted', async () => {
    const { controller, queue } = buildController();
    const sent = {
      ...validRunnerUsage,
      github: { ...validRunnerUsage.github, runId: '1234567890' },
    };
    await controller.processWebhook(sent, rawBodyOf(sent), {
      'x-hub-signature-256': sign256(JSON.stringify(sent)),
    });
    expect(queue.add).toHaveBeenCalledWith('store', validRunnerUsage);
  });

  it('accepts the legacy sha1 signature header, as the other endpoints do', async () => {
    const { controller, queue } = buildController();
    const sha1 =
      'sha1=' +
      createHmac('sha1', SECRET)
        .update(JSON.stringify(validRunnerUsage))
        .digest('hex');
    await controller.processWebhook(
      validRunnerUsage,
      rawBodyOf(validRunnerUsage),
      { 'x-hub-signature': sha1 },
    );
    expect(queue.add).toHaveBeenCalledWith('store', validRunnerUsage);
  });

  it('rejects a missing signature with 401', async () => {
    const { controller, queue } = buildController();
    await expect(
      controller.processWebhook(
        validRunnerUsage,
        rawBodyOf(validRunnerUsage),
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a signature made with another secret with 401', async () => {
    const { controller, queue } = buildController();
    await expect(
      controller.processWebhook(validRunnerUsage, rawBodyOf(validRunnerUsage), {
        'x-hub-signature-256': sign256(
          JSON.stringify(validRunnerUsage),
          'another-secret',
        ),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a signed report that breaks the schema with 400', async () => {
    const { controller, queue } = buildController();
    const broken = {
      ...validRunnerUsage,
      usage: {
        ...validRunnerUsage.usage,
        cpu: { ...validRunnerUsage.usage.cpu, p95Pct: 140 },
      },
    };
    await expect(
      controller.processWebhook(broken, rawBodyOf(broken), {
        'x-hub-signature-256': sign256(JSON.stringify(broken)),
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.processWebhook(broken, rawBodyOf(broken), {
        'x-hub-signature-256': sign256(JSON.stringify(broken)),
      }),
    ).rejects.toThrow('usage.cpu.p95Pct');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('answers 401, not 400, to an unsigned report that breaks the schema', async () => {
    const { controller } = buildController();
    await expect(
      controller.processWebhook(
        { nothing: true },
        rawBodyOf({ nothing: true }),
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects every report while the secret is empty', async () => {
    const { controller, queue } = buildController('');
    await expect(
      controller.processWebhook(validRunnerUsage, rawBodyOf(validRunnerUsage), {
        'x-hub-signature-256': sign256(JSON.stringify(validRunnerUsage), ''),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a request that has no raw body with 401', async () => {
    const { controller, queue } = buildController();
    await expect(
      controller.processWebhook(validRunnerUsage, {} as never, {
        'x-hub-signature-256': sign256(JSON.stringify(validRunnerUsage)),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
