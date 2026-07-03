import processWatcherPayload from './processWatcher';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-watchers';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-watchers', () => ({
  fetchNodesById: 'FETCH_NODES_QUERY',
  ingestNodes: jest.fn(),
  esMapping: { mappings: {} },
  esSettings: { settings: {} },
}));

jest.mock('@bit/zencrepes.zindexer.es-utils', () => ({
  getEsIndex: jest.fn(),
  checkEsIndex: jest.fn(),
  pushEsNodes: jest.fn(),
  aliasEsIndex: jest.fn(),
}));

const buildUserConfig = (oneIndexPerSource = false) => ({
  elasticsearch: {
    oneIndexPerSource,
    dataIndices: { githubWatchers: 'gh_watchers' },
  },
});

const buildPayload = (action: string) => ({
  action,
  repository: {
    node_id: 'repo-id',
    name: 'zqueue',
    owner: { node_id: 'owner-id', login: 'zencrepes' },
  },
  sender: { node_id: 'user-id' },
});

const expectedRepoObj = {
  id: 'repo-id',
  name: 'zqueue',
  url: 'https://github.com/zencrepes/zqueue',
  owner: {
    id: 'owner-id',
    login: 'zencrepes',
    url: 'https://github.com/zencrepes',
  },
};

const remoteNode = { id: 'user-id', login: 'octocat' };

describe('processWatcherPayload', () => {
  let ghClientService: { fetchNodesById: jest.Mock };
  let esClient: { delete: jest.Mock };
  let logger: { log: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    ghClientService = { fetchNodesById: jest.fn().mockResolvedValue([]) };
    esClient = { delete: jest.fn().mockResolvedValue({}) };
    logger = { log: jest.fn(), debug: jest.fn() };
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('deletes the node from Elasticsearch on a deleted action', async () => {
    await processWatcherPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'watchers-repo-iduser-id',
      index: 'gh_watchers',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('survives a failed deletion (node already gone)', async () => {
    esClient.delete.mockRejectedValue(new Error('document missing'));

    await expect(
      processWatcherPayload(
        ghClientService,
        esClient,
        buildUserConfig(),
        logger,
        buildPayload('deleted'),
      ),
    ).resolves.toBeUndefined();
  });

  it('fetches the sender, decorates it and pushes it to Elasticsearch', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_watchers');

    await processWatcherPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('started'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['user-id'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'user-id',
          login: 'octocat',
          repository: expectedRepoObj,
          watchedAt: expect.any(String),
        }),
      ],
      'zqueue',
      'repo-id',
      expectedRepoObj,
      'watchers',
    );
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_watchers',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_watchers',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_watchers_zencrepes_zqueue');

    await processWatcherPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('started'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_watchers',
      expect.any(Function),
    );
  });

  it('does not push anything when the sender cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processWatcherPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('started'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
