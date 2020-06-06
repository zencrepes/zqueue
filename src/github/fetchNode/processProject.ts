import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-projects';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateProject = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  nodeId,
  org,
  repo,
) => {
  logger.debug('About to fetch data for Node ID: ' + nodeId);
  const queryParams = { nodesArray: [nodeId] };
  const nodesData = await ghClientService.fetchNodesById(
    fetchNodesById,
    queryParams,
  );

  if (nodesData.length > 0) {
    const currentNode = nodesData[0];
    let projectsIndex = userConfig.elasticsearch.dataIndices.githubProjects;
    let nodes: any = [];
    if (repo === null) {
      logger.log('[' + currentNode.id + '] - Processing an Org-level project');
      const orgObj = {
        id: org.node_id,
        login: org.login,
        url: 'https://github.com/' + org.login,
      };
      nodes = ingestNodes(
        nodesData,
        'zqueue',
        'organization',
        null,
        orgObj,
        null,
      );
      if (userConfig.elasticsearch.oneIndexPerSource === true) {
        projectsIndex = (
          userConfig.elasticsearch.dataIndices.githubProjects + 'abcd'
        ).toLocaleLowerCase();
      }
    } else {
      logger.log('[' + currentNode.id + '] - Processing a Repo-level project');
      const sourceName = repo.owner.login + '/' + repo.name;

      const repoObj = {
        id: repo.node_id,
        name: repo.name,
        url: 'https://github.com/' + repo.owner.login + '/' + repo.name,
        owner: {
          id: repo.owner.node_id,
          login: repo.owner.login,
          url: 'https://github.com/' + repo.owner.login,
        },
      };

      nodes = ingestNodes(
        nodesData,
        'zindexer',
        'repository',
        repoObj.id,
        repoObj.owner,
        repoObj,
      );

      projectsIndex = getEsIndex(
        userConfig.elasticsearch.dataIndices.githubProjects,
        userConfig.elasticsearch.oneIndexPerSource,
        sourceName,
      );
    }

    logger.log(
      '[' + currentNode.id + '] - Submitting data to index: ' + projectsIndex,
    );

    await checkEsIndex(
      esClient,
      projectsIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, projectsIndex, nodes, console.log);
    logger.log('[' + currentNode.id + '] - Node submitted to Elasticsearch');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubProjects,
        console.log,
      );
    }
  }
};

const processProjectPayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted') {
    logger.log('Deleting project: ' + payload.project.node_id);
    try {
      await esClient.delete({
        id: payload.project.node_id,
        index: userConfig.elasticsearch.dataIndices.githubProjects,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log(
        'Index: ' + userConfig.elasticsearch.dataIndices.githubProjects,
      );
      logger.debug(payload);
    }
  } else {
    logger.log('Fetching data for project: ' + payload.project.node_id);
    const org =
      payload.organization !== undefined ? payload.organization : null;
    const repo = payload.repository !== undefined ? payload.repository : null;
    await updateProject(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.project.node_id,
      org,
      repo,
    );
  }
};

export default processProjectPayload;
