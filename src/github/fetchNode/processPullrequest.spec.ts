import processPullrequestPayload from './processPullrequest';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-pullrequests';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-pullrequests', () => ({
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
    dataIndices: { githubPullrequests: 'gh_prs' },
  },
});

const buildPayload = (action: string) => ({
  action,
  pull_request: { node_id: 'pr-1' },
});

const remoteNode = {
  id: 'pr-id',
  repository: {
    id: 'repo-id',
    name: 'zqueue',
    owner: { login: 'zencrepes' },
  },
};

describe('processPullrequestPayload', () => {
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
    await processPullrequestPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'pr-1',
      index: 'gh_prs',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('fetches the node and pushes it to Elasticsearch on other actions', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_prs');
    const userConfig = buildUserConfig();

    await processPullrequestPayload(
      ghClientService,
      esClient,
      userConfig,
      logger,
      buildPayload('opened'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['pr-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith(
      [remoteNode],
      'zqueue',
      userConfig,
      'repo-id',
    );
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_prs',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_prs',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_prs_zencrepes_zqueue');

    await processPullrequestPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('opened'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_prs',
      expect.any(Function),
    );
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processPullrequestPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('opened'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
