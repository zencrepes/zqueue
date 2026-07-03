import processIssuePayload from './processIssue';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-issues';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-issues', () => ({
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
    dataIndices: { githubIssues: 'gh_issues' },
  },
});

const buildPayload = (action: string) => ({
  action,
  issue: { node_id: 'node-1' },
});

const remoteNode = {
  id: 'issue-id',
  repository: {
    id: 'repo-id',
    name: 'zqueue',
    owner: { login: 'zencrepes' },
  },
};

describe('processIssuePayload', () => {
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
    await processIssuePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'node-1',
      index: 'gh_issues',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('deletes the node from Elasticsearch on a transferred action', async () => {
    await processIssuePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('transferred'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'node-1',
      index: 'gh_issues',
    });
  });

  it('fetches the node and pushes it to Elasticsearch on other actions', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_issues');
    const userConfig = buildUserConfig();

    await processIssuePayload(
      ghClientService,
      esClient,
      userConfig,
      logger,
      buildPayload('opened'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['node-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith(
      [remoteNode],
      'zqueue',
      userConfig,
      'repo-id',
    );
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_issues',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_issues',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_issues_zencrepes_zqueue');

    await processIssuePayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('opened'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_issues',
      expect.any(Function),
    );
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processIssuePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('opened'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
