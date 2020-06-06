import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-stargazers';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateStargazer = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  nodeId,
  repo,
  starredAt,
) => {
  const queryParams = { nodesArray: [nodeId] };
  let nodesData = await ghClientService.fetchNodesById(
    fetchNodesById,
    queryParams,
  );

  if (nodesData.length > 0) {
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

    const sourceId = repoObj.id;
    const sourceName = repoObj.owner.login + '/' + repoObj.name;

    nodesData = nodesData.map(n => {
      return {
        ...n,
        repository: repoObj,
        starredAt,
      };
    });

    const nodes = ingestNodes(
      nodesData,
      'zqueue',
      sourceId,
      repoObj,
      'stargazers',
    );

    const stargazersIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubStargazers,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      stargazersIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, stargazersIndex, nodes, console.log);
    logger.log('[' + nodeId + '] stargazer submitted to Elasticsearch ');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubStargazers,
        console.log,
      );
    }
  }
};

const processStargazerPayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  const nodeId =
    'stargazers-' + payload.repository.node_id + payload.sender.node_id;
  if (payload.action === 'deleted') {
    logger.log('Deleting stargazer: ' + nodeId);
    try {
      await esClient.delete({
        id: nodeId,
        index: userConfig.elasticsearch.dataIndices.githubStargazers,
      });
    } catch (e) {
      logger.log(
        '[' + nodeId + '] Error deleting node, it was probably already deleted',
      );
      logger.log('[' + nodeId + '] ID: ' + nodeId);
      logger.log(
        '[' +
          nodeId +
          '] Index: ' +
          userConfig.elasticsearch.dataIndices.githubStargazers,
      );
      logger.debug(payload);
    }
  } else {
    logger.log('[' + nodeId + '] Fetching data for stargazer ');
    await updateStargazer(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.sender.node_id,
      payload.repository,
      payload.starred_at,
    );
  }
};

export default processStargazerPayload;
