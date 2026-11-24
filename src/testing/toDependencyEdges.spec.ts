import { v5 as uuidv5 } from 'uuid';

import { UUID_NAMESPACE } from '../shared/uuidV5FromParts.js';
import { toDependencyEdges } from './toDependencyEdges.js';

describe('toDependencyEdges', () => {
  it('wraps dependencies in the edges/node shape with derived fields', () => {
    expect(
      toDependencyEdges([{ name: 'GraphQL-Core', version: '2.7.0' }]),
    ).toEqual({
      edges: [
        {
          node: {
            name: 'GraphQL-Core',
            version: '2.7.0',
            full: 'GraphQL-Core_2.7.0',
            // Same computation as zqueue v1: uuidv5(prep(name)+prep(version)).
            id: uuidv5('graphqlcore270', UUID_NAMESPACE),
          },
        },
      ],
      totalCount: 1,
    });
  });

  it('handles an empty list', () => {
    expect(toDependencyEdges([])).toEqual({ edges: [], totalCount: 0 });
  });
});
