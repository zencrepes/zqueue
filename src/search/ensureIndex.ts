import type {
  IndexDefinition,
  SearchClient,
} from './searchClient.types.js';

// Creates the index when it does not exist yet. The ensured set memoizes
// positive checks per process, so one exists() round-trip happens per index.
// Returns true when the index was created by this call.
export const ensureIndex = async (
  client: SearchClient,
  index: string,
  definition: IndexDefinition,
  ensured: Set<string>,
): Promise<boolean> => {
  if (ensured.has(index)) {
    return false;
  }
  const exists = await client.indexExists(index);
  if (!exists) {
    await client.createIndex(index, definition);
  }
  ensured.add(index);
  return !exists;
};
