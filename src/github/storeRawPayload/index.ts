import { v4 as uuidv4 } from 'uuid';

import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

import esSettings from './esSettings';
import esMapping from './esMapping';

const storeRawPayload = async (
  esClient,
  userConfig,
  logger,
  payload,
  eventType: string,
) => {
  const indexName =
    userConfig.github.webhook.timelinePayload.esIndexPrefix + eventType;
  await checkEsIndex(esClient, indexName, esMapping, esSettings, console.log);

  const nodeId = uuidv4();
  const preppedPayload = {
    id: nodeId,
    dateReceived: new Date().toString(),
    ...payload,
  };

  await pushEsNodes(esClient, indexName, [preppedPayload], console.log);
};

export default storeRawPayload;
