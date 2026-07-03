import processStargazerPayload from './processStargazer';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-stargazers';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-stargazers', () => ({
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
    dataIndices: { githubStargazers: 'gh_stargazers' },
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
  starred_at: '2026-07-03T00:00:00Z',
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

describe('processStargazerPayload', () => {
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
    await processStargazerPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'stargazers-repo-iduser-id',
      index: 'gh_stargazers',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('survives a failed deletion (node already gone)', async () => {
    esClient.delete.mockRejectedValue(new Error('document missing'));

    await expect(
      processStargazerPayload(
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
    (getEsIndex as jest.Mock).mockReturnValue('gh_stargazers');

    await processStargazerPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('created'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['user-id'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith(
      [
        {
          ...remoteNode,
          repository: expectedRepoObj,
          starredAt: '2026-07-03T00:00:00Z',
        },
      ],
      'zqueue',
      'repo-id',
      expectedRepoObj,
      'stargazers',
    );
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_stargazers',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_stargazers',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_stargazers_zencrepes_zqueue');

    await processStargazerPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('created'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_stargazers',
      expect.any(Function),
    );
  });

  it('does not push anything when the sender cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processStargazerPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('created'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
