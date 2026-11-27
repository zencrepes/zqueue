// On the v7.11.0 runner stack the runner name is <flavour>_<EC2 instance id>,
// for example default_i-097488b4382d33a10. The previous stack used the bare
// instance id, and GitHub-hosted runners are named "GitHub Actions <id>": both
// have no flavour.
const FLAVOUR_PATTERN = /^(.+)_i-[0-9a-f]+$/;

export const getFlavour = (runnerName: string): string | null =>
  FLAVOUR_PATTERN.exec(runnerName)?.[1] ?? null;
