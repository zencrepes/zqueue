import type { BulkDocument, SearchClient } from './searchClient.types.js';
import { bulkIndexDocuments } from './bulkIndexDocuments.js';

const buildDocuments = (count: number): BulkDocument[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `doc-${index}`,
    body: { index },
  }));

describe('bulkIndexDocuments', () => {
  it('sends documents in chunks and aggregates the results', async () => {
    const bulkIndex = vi
      .fn()
      .mockImplementation(async (_index: string, chunk: BulkDocument[]) => ({
        indexed: chunk.length,
        errors: [],
      }));
    const client = { bulkIndex } as unknown as SearchClient;

    const result = await bulkIndexDocuments(
      client,
      'idx',
      buildDocuments(250),
      100,
    );
    expect(bulkIndex).toHaveBeenCalledTimes(3);
    expect(bulkIndex.mock.calls.map((call) => call[1].length)).toEqual([
      100, 100, 50,
    ]);
    expect(result).toEqual({ indexed: 250, errors: [] });
  });

  it('aggregates errors across chunks', async () => {
    const bulkIndex = vi
      .fn()
      .mockResolvedValueOnce({
        indexed: 0,
        errors: [{ id: 'doc-0', status: 400, reason: 'nope' }],
      })
      .mockResolvedValueOnce({ indexed: 1, errors: [] });
    const client = { bulkIndex } as unknown as SearchClient;

    const result = await bulkIndexDocuments(client, 'idx', buildDocuments(2), 1);
    expect(result).toEqual({
      indexed: 1,
      errors: [{ id: 'doc-0', status: 400, reason: 'nope' }],
    });
  });

  it('does nothing for an empty document list', async () => {
    const bulkIndex = vi.fn();
    const client = { bulkIndex } as unknown as SearchClient;
    expect(await bulkIndexDocuments(client, 'idx', [])).toEqual({
      indexed: 0,
      errors: [],
    });
    expect(bulkIndex).not.toHaveBeenCalled();
  });
});
