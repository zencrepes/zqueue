import type { SearchClient } from './searchClient.types.js';
import { ensureIndex } from './ensureIndex.js';

const definition = { mappings: {}, settings: {} };

const buildClient = (exists: boolean) => {
  const indexExists = vi.fn().mockResolvedValue(exists);
  const createIndex = vi.fn().mockResolvedValue(undefined);
  const client = { indexExists, createIndex } as unknown as SearchClient;
  return { client, indexExists, createIndex };
};

describe('ensureIndex', () => {
  it('creates a missing index and reports it created one', async () => {
    const { client, createIndex } = buildClient(false);
    const ensured = new Set<string>();
    expect(await ensureIndex(client, 'idx', definition, ensured)).toBe(true);
    expect(createIndex).toHaveBeenCalledWith('idx', definition);
    expect(ensured.has('idx')).toBe(true);
  });

  it('does not create an existing index', async () => {
    const { client, createIndex } = buildClient(true);
    const ensured = new Set<string>();
    expect(await ensureIndex(client, 'idx', definition, ensured)).toBe(false);
    expect(createIndex).not.toHaveBeenCalled();
    expect(ensured.has('idx')).toBe(true);
  });

  it('skips the existence check once ensured', async () => {
    const { client, indexExists } = buildClient(true);
    const ensured = new Set<string>(['idx']);
    expect(await ensureIndex(client, 'idx', definition, ensured)).toBe(false);
    expect(indexExists).not.toHaveBeenCalled();
  });
});
