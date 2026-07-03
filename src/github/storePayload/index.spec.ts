import storePayload from './index';

import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.es-utils', () => ({
  checkEsIndex: jest.fn(),
  pushEsNodes: jest.fn(),
}));

const UUID_V4_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const userConfig = {
  github: {
    webhook: {
      nodePayload: { esIndexPrefix: 'gh_payload_' },
    },
  },
};

describe('storePayload', () => {
  const esClient = {};
  const logger = { log: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks the index derived from the configured prefix and event type', async () => {
    await storePayload(esClient, userConfig, logger, { action: 'x' }, 'issues');

    expect(checkEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_payload_issues',
      expect.anything(),
      expect.anything(),
      expect.any(Function),
    );
  });

  it('uses the entity node_id as document id when present', async () => {
    const payload = { action: 'opened', issue: { node_id: 'node-42' } };

    await storePayload(esClient, userConfig, logger, payload, 'issue');

    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_payload_issue',
      [{ id: 'node-42', ...payload }],
      expect.any(Function),
    );
  });

  it('falls back to a generated uuid when the payload has no node id', async () => {
    const payload = { action: 'completed' };

    await storePayload(esClient, userConfig, logger, payload, 'workflow_run');

    const pushedNodes = (pushEsNodes as jest.Mock).mock.calls[0][2];
    expect(pushedNodes).toHaveLength(1);
    expect(pushedNodes[0].id).toMatch(UUID_V4_REGEXP);
    expect(pushedNodes[0].action).toEqual('completed');
  });
});
