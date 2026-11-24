// Percentage of count over total, rounded; 0 when the total is 0 so an empty
// run does not produce NaN rates.
export const toRate = (count: number, total: number): number =>
  total > 0 ? Math.round((count * 100) / total) : 0;
