import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { GithubController } from './github.controller';
import { ConfigService } from '../config.service';
import { WebhookPayload } from './webhookPayload.type';

const SECRET = 'test-webhook-secret';

const sign = (payload: WebhookPayload, secret: string = SECRET) => {
  const hmac = crypto.createHmac('sha1', secret);
  return 'sha1=' + hmac.update(JSON.stringify(payload)).digest('hex');
};

const buildUserConfig = (webhookOverrides = {}) => ({
  github: {
    webhook: {
      secret: SECRET,
      events: [
        { githubEvent: 'issues', zencrepesEntity: 'issues' },
        { githubEvent: 'label', zencrepesEntity: 'labels' },
      ],
      fetchNode: { includeGithubEvents: ['*'], excludeGithubEvents: [] },
      nodePayload: { includeGithubEvents: ['*'], excludeGithubEvents: [] },
      timelinePayload: { includeGithubEvents: ['*'], excludeGithubEvents: [] },
      ...webhookOverrides,
    },
  },
});

describe('GithubController', () => {
  let controller: GithubController;
  let githubQueue: { add: jest.Mock };
  let storePayloadQueue: { add: jest.Mock };
  let storeRawPayloadQueue: { add: jest.Mock };
  let userConfig;

  const callWebhook = (payload: WebhookPayload, headers = {}) => {
    return controller.processWebhook(payload, {} as any, headers as any);
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    githubQueue = { add: jest.fn() };
    storePayloadQueue = { add: jest.fn() };
    storeRawPayloadQueue = { add: jest.fn() };
    userConfig = buildUserConfig();
    const configService = {
      getUserConfig: () => userConfig,
    } as ConfigService;
    controller = new GithubController(
      githubQueue as any,
      storePayloadQueue as any,
      storeRawPayloadQueue as any,
      configService,
    );
  });

  it('ignores requests with an invalid signature', async () => {
    const payload = { action: 'opened', issue: { node_id: 'abc' } };

    await callWebhook(payload, {
      'x-github-event': 'issues',
      'x-hub-signature': sign(payload, 'wrong-secret'),
    });

    expect(githubQueue.add).not.toHaveBeenCalled();
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
    expect(storeRawPayloadQueue.add).not.toHaveBeenCalled();
  });

  it('ignores requests without a signature header', async () => {
    const payload = { action: 'opened', issue: { node_id: 'abc' } };

    await callWebhook(payload, { 'x-github-event': 'issues' });

    expect(githubQueue.add).not.toHaveBeenCalled();
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
    expect(storeRawPayloadQueue.add).not.toHaveBeenCalled();
  });

  it('does nothing on a ping event', async () => {
    const payload = { action: 'ping' } as WebhookPayload;

    await callWebhook(payload, {
      'x-github-event': 'ping',
      'x-hub-signature': sign(payload),
    });

    expect(githubQueue.add).not.toHaveBeenCalled();
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
    expect(storeRawPayloadQueue.add).not.toHaveBeenCalled();
  });

  it('queues a known event on all three queues with its zencrepes entity', async () => {
    const payload = { action: 'opened', issue: { node_id: 'abc' } };

    await callWebhook(payload, {
      'x-github-event': 'issues',
      'x-hub-signature': sign(payload),
    });

    expect(githubQueue.add).toHaveBeenCalledWith('fetchRemoteNode', {
      payload,
      eventType: 'issues',
    });
    expect(storePayloadQueue.add).toHaveBeenCalledWith('store', {
      payload,
      eventType: 'issues',
    });
    expect(storeRawPayloadQueue.add).toHaveBeenCalledWith('store', {
      payload,
      eventType: 'issues',
    });
  });

  it('maps the github event to its configured zencrepes entity', async () => {
    const payload = { action: 'created', label: { node_id: 'lbl' } };

    await callWebhook(payload, {
      'x-github-event': 'label',
      'x-hub-signature': sign(payload),
    });

    expect(githubQueue.add).toHaveBeenCalledWith('fetchRemoteNode', {
      payload,
      eventType: 'labels',
    });
  });

  it('does not queue a node fetch for events absent from the events mapping', async () => {
    const payload = { action: 'completed' } as WebhookPayload;

    await callWebhook(payload, {
      'x-github-event': 'workflow_run',
      'x-hub-signature': sign(payload),
    });

    expect(githubQueue.add).not.toHaveBeenCalled();
    // Payload storage does not depend on the events mapping
    expect(storePayloadQueue.add).toHaveBeenCalledWith('store', {
      payload,
      eventType: 'workflow_run',
    });
    expect(storeRawPayloadQueue.add).toHaveBeenCalledWith('store', {
      payload,
      eventType: 'workflow_run',
    });
  });

  it('skips queues whose configuration excludes the event', async () => {
    userConfig = buildUserConfig({
      fetchNode: {
        includeGithubEvents: ['*'],
        excludeGithubEvents: ['issues'],
      },
      nodePayload: {
        includeGithubEvents: ['*'],
        excludeGithubEvents: ['issues'],
      },
      timelinePayload: { includeGithubEvents: ['*'], excludeGithubEvents: [] },
    });
    const payload = { action: 'opened', issue: { node_id: 'abc' } };

    await callWebhook(payload, {
      'x-github-event': 'issues',
      'x-hub-signature': sign(payload),
    });

    expect(githubQueue.add).not.toHaveBeenCalled();
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
    expect(storeRawPayloadQueue.add).toHaveBeenCalled();
  });

  it('processes an explicitly included event even when everything else is excluded', async () => {
    userConfig = buildUserConfig({
      fetchNode: {
        includeGithubEvents: ['issues'],
        excludeGithubEvents: ['*'],
      },
      nodePayload: { includeGithubEvents: [], excludeGithubEvents: ['*'] },
      timelinePayload: { includeGithubEvents: [], excludeGithubEvents: ['*'] },
    });
    const payload = { action: 'opened', issue: { node_id: 'abc' } };

    await callWebhook(payload, {
      'x-github-event': 'issues',
      'x-hub-signature': sign(payload),
    });

    expect(githubQueue.add).toHaveBeenCalled();
    expect(storePayloadQueue.add).not.toHaveBeenCalled();
    expect(storeRawPayloadQueue.add).not.toHaveBeenCalled();
  });
});
