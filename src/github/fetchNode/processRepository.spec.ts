import processRepositoryPayload from './processRepository';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-repos';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-repos', () => ({
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
    dataIndices: { githubRepos: 'gh_repos' },
  },
});

const buildPayload = (action: string) => ({
  action,
  repository: { node_id: 'repo-1' },
});

const remoteNode = {
  id: 'repo-id',
  name: 'zqueue',
  owner: { login: 'zencrepes' },
};

describe('processRepositoryPayload', () => {
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
    await processRepositoryPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'repo-1',
      index: 'gh_repos',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('fetches the node and pushes it to Elasticsearch on other actions', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_repos');

    await processRepositoryPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('edited'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['repo-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith([remoteNode], 'zqueue');
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_repos',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_repos',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_repos_zencrepes_zqueue');

    await processRepositoryPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('edited'),
    );

    // The source reads dataIndices.GithubRepos (capital G), which is not
    // defined in the configuration, so the alias name is undefined.
    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      undefined,
      expect.any(Function),
    );
  });

  it('still attempts the alias when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processRepositoryPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('edited'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
    expect(aliasEsIndex).toHaveBeenCalled();
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processRepositoryPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('edited'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });
});
