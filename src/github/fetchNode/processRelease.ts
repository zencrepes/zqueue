import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-releases';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateRelease = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  nodeId,
  repo,
) => {
  const queryParams = { nodesArray: [nodeId] };
  const nodesData = await ghClientService.fetchNodesById(
    fetchNodesById,
    queryParams,
  );

  if (nodesData.length > 0) {
    const currentNode = nodesData[0];
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

    const nodes = ingestNodes(nodesData, 'zqueue', sourceId, repoObj);

    const releasesIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubReleases,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      releasesIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, releasesIndex, nodes, console.log);
    logger.log('Node: ' + nodeId + ' submitted to Elasticsearch');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubReleases,
        console.log,
      );
    }
  }
};

const processReleasePayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted') {
    logger.log('Deleting release: ' + payload.release.node_id);
    try {
      await esClient.delete({
        id: payload.release.node_id,
        index: userConfig.elasticsearch.dataIndices.githubReleases,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log(
        'Index: ' + userConfig.elasticsearch.dataIndices.githubReleases,
      );
      logger.debug(payload);
    }
  } else {
    logger.log('Fetching data for release: ' + payload.release.node_id);
    await updateRelease(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.release.node_id,
      payload.repository,
    );
  }
};

export default processReleasePayload;
