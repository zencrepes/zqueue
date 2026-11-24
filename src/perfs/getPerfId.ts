import { uuidV5FromParts } from '../shared/uuidV5FromParts.js';

// Derives a stable id from the name, the start date and the platform region.
// Also used for resources and runs, where only the name is set.
export const getPerfId = (node: {
  name: string;
  startedAt?: string;
  platform?: { region: string };
}): string =>
  uuidV5FromParts(node.name, node.startedAt ?? '', node.platform?.region ?? '');
