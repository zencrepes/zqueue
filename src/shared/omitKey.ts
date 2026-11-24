export const omitKey = (
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(source).filter(([entryKey]) => entryKey !== key),
  );
