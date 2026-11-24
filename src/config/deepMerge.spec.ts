import { deepMerge } from './deepMerge.js';

describe('deepMerge', () => {
  it('returns the defaults when the override is undefined or null', () => {
    expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(deepMerge({ a: 1 }, null)).toEqual({ a: 1 });
  });

  it('fills missing nested keys with defaults', () => {
    const defaults = { a: { b: 1, c: 2 }, d: 3 };
    expect(deepMerge(defaults, { a: { b: 10 } })).toEqual({
      a: { b: 10, c: 2 },
      d: 3,
    });
  });

  it('lets user scalars and arrays replace defaults entirely', () => {
    const defaults = { list: ['*'], flag: true };
    expect(deepMerge(defaults, { list: ['push'], flag: false })).toEqual({
      list: ['push'],
      flag: false,
    });
  });

  it('keeps keys unknown to the defaults', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('keeps the default when the user sets a nested key to null', () => {
    expect(deepMerge({ a: { b: 1 } }, { a: { b: null } })).toEqual({
      a: { b: 1 },
    });
  });

  it('does not mutate the defaults', () => {
    const defaults = { a: { b: 1 } };
    deepMerge(defaults, { a: { b: 2 } });
    expect(defaults).toEqual({ a: { b: 1 } });
  });
});
