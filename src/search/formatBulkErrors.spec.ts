import { formatBulkErrors } from './formatBulkErrors.js';

describe('formatBulkErrors', () => {
  it('formats each error with id, reason and status', () => {
    expect(
      formatBulkErrors([
        { id: 'a', status: 400, reason: 'bad field' },
        { id: 'b', status: 429, reason: 'too many requests' },
      ]),
    ).toBe('a: bad field (400), b: too many requests (429)');
  });
});
