import fetchNode from './index';

import processLabelPayload from './processLabel';
import processIssuePayload from './processIssue';
import processPullrequestPayload from './processPullrequest';
import processMilestonePayload from './processMilestone';
import processReleasePayload from './processRelease';
import processProjectPayload from './processProject';
import processRepositoryPayload from './processRepository';
import processStargazerPayload from './processStargazer';
import processWatcherPayload from './processWatcher';

jest.mock('./processLabel');
jest.mock('./processIssue');
jest.mock('./processPullrequest');
jest.mock('./processMilestone');
jest.mock('./processRelease');
jest.mock('./processProject');
jest.mock('./processRepository');
jest.mock('./processStargazer');
jest.mock('./processWatcher');

const processors: Array<[string, jest.Mock]> = [
  ['labels', processLabelPayload as jest.Mock],
  ['issues', processIssuePayload as jest.Mock],
  ['pullrequests', processPullrequestPayload as jest.Mock],
  ['milestones', processMilestonePayload as jest.Mock],
  ['releases', processReleasePayload as jest.Mock],
  ['projects', processProjectPayload as jest.Mock],
  ['repos', processRepositoryPayload as jest.Mock],
  ['stargazers', processStargazerPayload as jest.Mock],
  ['watchers', processWatcherPayload as jest.Mock],
];

describe('fetchNode dispatcher', () => {
  const ghClientService = { fetchNodesById: jest.fn() };
  const esClient = {};
  const userConfig = {};
  const logger = { log: jest.fn(), debug: jest.fn() };
  const payload = { action: 'opened' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(processors)(
    'routes a %s event to its processor',
    (eventType, processor) => {
      fetchNode(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
        eventType,
      );

      expect(processor).toHaveBeenCalledWith(
        ghClientService,
        esClient,
        userConfig,
        logger,
        payload,
      );
      for (const [, other] of processors) {
        if (other !== processor) {
          expect(other).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('does nothing for an unknown event type', () => {
    fetchNode(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload,
      'unknown',
    );

    for (const [, processor] of processors) {
      expect(processor).not.toHaveBeenCalled();
    }
  });
});
