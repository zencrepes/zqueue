import { chunkArray } from './chunkArray.js';

describe('chunkArray', () => {
  it('splits an array into chunks of the requested size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when the array is smaller', () => {
    expect(chunkArray([1], 100)).toEqual([[1]]);
  });

  it('returns no chunk for an empty array', () => {
    expect(chunkArray([], 10)).toEqual([]);
  });
});
