import { summarizeBulkResponse } from './summarizeBulkResponse.js';

describe('summarizeBulkResponse', () => {
  it('counts successful items', () => {
    expect(
      summarizeBulkResponse({
        errors: false,
        items: [
          { index: { _id: 'a', status: 201 } },
          { index: { _id: 'b', status: 200 } },
        ],
      }),
    ).toEqual({ indexed: 2, errors: [] });
  });

  it('extracts failed items with their reason', () => {
    expect(
      summarizeBulkResponse({
        errors: true,
        items: [
          { index: { _id: 'a', status: 201 } },
          {
            index: {
              _id: 'b',
              status: 400,
              error: { type: 'mapper_parsing_exception', reason: 'bad field' },
            },
          },
        ],
      }),
    ).toEqual({
      indexed: 1,
      errors: [{ id: 'b', status: 400, reason: 'bad field' }],
    });
  });

  it('falls back to the error type when no reason is given', () => {
    expect(
      summarizeBulkResponse({
        errors: true,
        items: [
          { index: { _id: 'a', status: 429, error: { type: 'too_many' } } },
        ],
      }).errors[0].reason,
    ).toBe('too_many');
  });

  it('tolerates an empty response', () => {
    expect(summarizeBulkResponse({})).toEqual({ indexed: 0, errors: [] });
  });
});
