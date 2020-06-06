import processLabelPayload from './processLabel';
import processIssuePayload from './processIssue';
import processPullrequestPayload from './processPullrequest';
import processMilestonePayload from './processMilestone';
import processReleasePayload from './processRelease';
import processProjectPayload from './processProject';
import processRepositoryPayload from './processRepository';

const fetchNode = (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
  eventType: string,
) => {
  switch (eventType) {
    case 'labels':
      processLabelPayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
    case 'issues':
      processIssuePayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
    case 'pullrequests':
      processPullrequestPayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
    case 'milestones':
      processMilestonePayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
    case 'releases':
      processReleasePayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
    case 'projects':
      processProjectPayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
    case 'repos':
      processRepositoryPayload(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      break;
  }
};

export default fetchNode;
