import { getDependencyId } from './getDependencyId.js';
import type { TestingPayloadDependency } from './testingPayload.types.js';

// Dependencies are stored in the GraphQL-connection shape used across
// ZenCrepes datasets ({ edges: [{ node }], totalCount }).
export const toDependencyEdges = (
  dependencies: TestingPayloadDependency[],
) => ({
  edges: dependencies.map((dependency) => ({
    node: {
      ...dependency,
      full: `${dependency.name}_${dependency.version}`,
      id: getDependencyId(dependency),
    },
  })),
  totalCount: dependencies.length,
});
