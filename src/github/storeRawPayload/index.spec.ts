import storeRawPayload from './index';

import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.es-utils', () => ({
  checkEsIndex: jest.fn(),
  pushEsNodes: jest.fn(),
}));

const UUID_V4_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const userConfig = {
  github: {
    webhook: {
      timelinePayload: { esIndexPrefix: 'gh_timeline_' },
    },
  },
};

describe('storeRawPayload', () => {
  const esClient = {};
  const logger = { log: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks the index derived from the configured prefix and event type', async () => {
    await storeRawPayload(
      esClient,
      userConfig,
      logger,
      { action: 'x' },
      'issues',
    );

    expect(checkEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_timeline_issues',
      expect.anything(),
      expect.anything(),
      expect.any(Function),
    );
  });

  it('pushes the payload with a generated id and a received date', async () => {
    const payload = { action: 'opened', issue: { node_id: 'node-42' } };

    await storeRawPayload(esClient, userConfig, logger, payload, 'issues');

    const pushedNodes = (pushEsNodes as jest.Mock).mock.calls[0][2];
    expect(pushedNodes).toHaveLength(1);
    expect(pushedNodes[0].id).toMatch(UUID_V4_REGEXP);
    expect(pushedNodes[0].dateReceived).toEqual(expect.any(String));
    expect(pushedNodes[0].action).toEqual('opened');
    expect(pushedNodes[0].issue).toEqual({ node_id: 'node-42' });
  });

  it('generates a different id for every payload', async () => {
    await storeRawPayload(esClient, userConfig, logger, { a: 1 }, 'issues');
    await storeRawPayload(esClient, userConfig, logger, { a: 1 }, 'issues');

    const first = (pushEsNodes as jest.Mock).mock.calls[0][2][0];
    const second = (pushEsNodes as jest.Mock).mock.calls[1][2][0];
    expect(first.id).not.toEqual(second.id);
  });
});
