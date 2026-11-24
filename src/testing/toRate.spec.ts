import { toRate } from './toRate.js';

describe('toRate', () => {
  it('computes a rounded percentage', () => {
    expect(toRate(1, 3)).toBe(33);
    expect(toRate(2, 3)).toBe(67);
    expect(toRate(3, 3)).toBe(100);
  });

  it('returns 0 when the total is 0', () => {
    expect(toRate(0, 0)).toBe(0);
  });
});
