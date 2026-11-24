// An explicit exclude wins over an explicit include, which wins over the
// wildcard entries. An event matched by no rule is processed.
export const shouldProcessEvent = (
  githubEvent: string,
  includeGithubEvents: string[],
  excludeGithubEvents: string[],
): boolean => {
  if (excludeGithubEvents.includes(githubEvent)) {
    return false;
  }
  if (includeGithubEvents.includes(githubEvent)) {
    return true;
  }
  if (includeGithubEvents.includes('*')) {
    return true;
  }
  if (excludeGithubEvents.includes('*')) {
    return false;
  }
  return true;
};
