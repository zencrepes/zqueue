import { createHmac } from 'node:crypto';

import { Logger, UnauthorizedException } from '@nestjs/common';
import type { Queue } from 'bullmq';

import type { ConfigService } from '../config/config.service.js';
import { GithubController } from './github.controller.js';

const SECRET = 'github-webhook-test-secret';

const sign256 = (body: string) =>
  'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

const buildController = (webhookOverrides = {}) => {
  const queue = { add: vi.fn() };
  const configService = {
    getUserConfig: () => ({
      github: {
        webhook: {
          secret: SECRET,
          includeGithubEvents: ['*'],
          excludeGithubEvents: ['push'],
          esIndexPrefix: 'gh_events_',
          ...webhookOverrides,
        },
      },
    }),
  } as unknown as ConfigService;
  const controller = new GithubController(
    queue as unknown as Queue,
    configService,
  );
  return { controller, queue };
};

const callWebhook = (
  controller: GithubController,
  payload: Record<string, unknown>,
  headers: Record<string, string | undefined>,
  rawBody?: Buffer,
) =>
  controller.processWebhook(
    payload,
    // Only rawBody is read from the request.
    { rawBody: rawBody ?? Buffer.from(JSON.stringify(payload)) } as never,
    headers,
  );

describe('GithubController', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('queues a signed event with its target index', async () => {
    const { controller, queue } = buildController();
    const payload = { action: 'opened', issue: { number: 1 } };
    const result = await callWebhook(controller, payload, {
      'x-github-event': 'issues',
      'x-github-delivery': 'guid-1',
      'x-hub-signature-256': sign256(JSON.stringify(payload)),
    });
    expect(result).toEqual({ success: true, queued: true });
    expect(queue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData] = queue.add.mock.calls[0];
    expect(jobName).toBe('record');
    expect(jobData.index).toBe('gh_events_issues');
    expect(jobData.document.id).toBe('guid-1');
    expect(jobData.document.body.payload).toEqual(payload);
  });

  it('rejects an invalid signature with 401', async () => {
    const { controller, queue } = buildController();
    const payload = { action: 'opened' };
    await expect(
      callWebhook(controller, payload, {
        'x-github-event': 'issues',
        'x-hub-signature-256': 'sha256=invalid',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a delivery without any signature', async () => {
    const { controller } = buildController();
    await expect(
      callWebhook(controller, { action: 'x' }, { 'x-github-event': 'issues' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the raw body was tampered with', async () => {
    const { controller } = buildController();
    const payload = { action: 'opened' };
    await expect(
      callWebhook(
        controller,
        payload,
        {
          'x-github-event': 'issues',
          'x-hub-signature-256': sign256(JSON.stringify(payload)),
        },
        Buffer.from('{"action":"tampered"}'),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips an excluded event without queuing', async () => {
    const { controller, queue } = buildController();
    const payload = { ref: 'refs/heads/main' };
    const result = await callWebhook(controller, payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': sign256(JSON.stringify(payload)),
    });
    expect(result).toEqual({ success: true, queued: false });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('records any event type, ping included', async () => {
    const { controller, queue } = buildController();
    const payload = { zen: 'Keep it logically awesome.' };
    const result = await callWebhook(controller, payload, {
      'x-github-event': 'ping',
      'x-hub-signature-256': sign256(JSON.stringify(payload)),
    });
    expect(result).toEqual({ success: true, queued: true });
    expect(queue.add.mock.calls[0][1].index).toBe('gh_events_ping');
  });
});
