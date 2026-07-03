import processProjectPayload from './processProject';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-projects';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-projects', () => ({
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
    dataIndices: { githubProjects: 'gh_projects' },
  },
});

const buildOrgPayload = (action: string) => ({
  action,
  project: { node_id: 'project-1' },
  organization: { node_id: 'org-id', login: 'zencrepes' },
});

const buildRepoPayload = (action: string) => ({
  action,
  project: { node_id: 'project-1' },
  repository: {
    node_id: 'repo-id',
    name: 'zqueue',
    owner: { node_id: 'owner-id', login: 'zencrepes' },
  },
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

const remoteNode = { id: 'project-id' };

describe('processProjectPayload', () => {
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
    await processProjectPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildRepoPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'project-1',
      index: 'gh_projects',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('processes a repo-level project and pushes it to Elasticsearch', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_projects');

    await processProjectPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildRepoPayload('created'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['project-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith(
      [remoteNode],
      'zindexer',
      'repository',
      'repo-id',
      expectedRepoObj.owner,
      expectedRepoObj,
    );
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_projects',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_projects',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('processes an org-level project and pushes it to Elasticsearch', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);

    await processProjectPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildOrgPayload('created'),
    );

    expect(ingestNodes).toHaveBeenCalledWith(
      [remoteNode],
      'zqueue',
      'organization',
      null,
      {
        id: 'org-id',
        login: 'zencrepes',
        url: 'https://github.com/zencrepes',
      },
      null,
    );
    expect(getEsIndex).not.toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_projects',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('uses a suffixed index for an org-level project with one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);

    await processProjectPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildOrgPayload('created'),
    );

    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_projectsabcd',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_projects',
      expect.any(Function),
    );
  });

  it('creates an index alias for a repo-level project with one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_projects_zencrepes_zqueue');

    await processProjectPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildRepoPayload('created'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_projects',
      expect.any(Function),
    );
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processProjectPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildRepoPayload('created'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
