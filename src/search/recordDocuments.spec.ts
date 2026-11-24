import type { SearchClient } from './searchClient.types.js';
import { recordDocuments } from './recordDocuments.js';

const definition = { mappings: {}, settings: {} };
const logger = { log: vi.fn(), error: vi.fn() };

const buildClient = (bulkResult: {
  indexed: number;
  errors: Array<{ id: string; status: number; reason: string }>;
}) => {
  const indexExists = vi.fn().mockResolvedValue(false);
  const createIndex = vi.fn().mockResolvedValue(undefined);
  const bulkIndex = vi.fn().mockResolvedValue(bulkResult);
  return {
    client: { indexExists, createIndex, bulkIndex } as unknown as SearchClient,
    createIndex,
  };
};

describe('recordDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensures the index and indexes the documents', async () => {
    const { client, createIndex } = buildClient({ indexed: 1, errors: [] });
    const result = await recordDocuments(
      client,
      'idx',
      definition,
      [{ id: 'a', body: {} }],
      new Set(),
      logger,
    );
    expect(createIndex).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Created index: idx');
    expect(result).toEqual({ indexed: 1, errors: [] });
  });

  it('throws when a document fails to index, so the job is retried', async () => {
    const { client } = buildClient({
      indexed: 0,
      errors: [{ id: 'a', status: 400, reason: 'bad' }],
    });
    await expect(
      recordDocuments(
        client,
        'idx',
        definition,
        [{ id: 'a', body: {} }],
        new Set(),
        logger,
      ),
    ).rejects.toThrow('Bulk indexing into idx failed: a: bad (400)');
    expect(logger.error).toHaveBeenCalled();
  });
});
