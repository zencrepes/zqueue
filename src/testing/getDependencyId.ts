import { uuidV5FromParts } from '../shared/uuidV5FromParts.js';

export const getDependencyId = (dependency: {
  name: string;
  version: string;
}): string => uuidV5FromParts(dependency.name, dependency.version);
