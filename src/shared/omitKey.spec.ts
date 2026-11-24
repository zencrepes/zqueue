import { omitKey } from './omitKey.js';

describe('omitKey', () => {
  it('removes the named key', () => {
    expect(omitKey({ a: 1, b: 2 }, 'b')).toEqual({ a: 1 });
  });

  it('returns an equal object when the key is absent', () => {
    expect(omitKey({ a: 1 }, 'missing')).toEqual({ a: 1 });
  });

  it('does not mutate the source', () => {
    const source = { a: 1, b: 2 };
    omitKey(source, 'b');
    expect(source).toEqual({ a: 1, b: 2 });
  });
});
