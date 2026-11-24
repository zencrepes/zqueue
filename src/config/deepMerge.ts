const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) !== null;

// Fills missing keys of a user-provided object with defaults, recursively.
// Arrays and scalars provided by the user replace the default entirely.
export const deepMerge = <T>(defaults: T, overrides: unknown): T => {
  if (overrides === undefined || overrides === null) {
    return defaults;
  }
  if (!isPlainObject(defaults) || !isPlainObject(overrides)) {
    return overrides as T;
  }
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] =
      key in defaults ? deepMerge(defaults[key as keyof T], value) : value;
  }
  return merged as T;
};
