import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-watchers';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateWatcher = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  nodeId,
  repo,
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
        watchedAt: new Date().toISOString(),
      };
    });

    const nodes = ingestNodes(
      nodesData,
      'zqueue',
      sourceId,
      repoObj,
      'watchers',
    );

    const watchersIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubWatchers,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      watchersIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, watchersIndex, nodes, console.log);
    logger.log('[' + nodeId + '] watcher submitted to Elasticsearch ');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubWatchers,
        console.log,
      );
    }
  }
};

const processWatcherPayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  const nodeId =
    'watchers-' + payload.repository.node_id + payload.sender.node_id;
  if (payload.action === 'deleted') {
    logger.log('Deleting watcher: ' + nodeId);
    try {
      await esClient.delete({
        id: nodeId,
        index: userConfig.elasticsearch.dataIndices.githubWatchers,
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
          userConfig.elasticsearch.dataIndices.githubWatchers,
      );
      logger.debug(payload);
    }
  } else {
    logger.log('[' + nodeId + '] Fetching data for watcher ');
    await updateWatcher(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.sender.node_id,
      payload.repository,
    );
  }
};

export default processWatcherPayload;
