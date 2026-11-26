import { getFlavour } from './getFlavour.js';

describe('getFlavour', () => {
  it.each([
    ['default_i-097488b4382d33a10', 'default'],
    ['small_i-0abc', 'small'],
    ['jahia8sn_i-07b61c9d36097ae95', 'jahia8sn'],
  ])('reads the flavour of %s', (runnerName, flavour) => {
    expect(getFlavour(runnerName)).toBe(flavour);
  });

  it('has no flavour on the bare instance id of the previous stack', () => {
    expect(getFlavour('i-0df218c11cb2565d0')).toBeNull();
  });

  it('has no flavour on a GitHub-hosted runner', () => {
    expect(getFlavour('GitHub Actions 1000870980')).toBeNull();
  });

  it('has no flavour when the instance id is not hexadecimal', () => {
    expect(getFlavour('default_i-xyz')).toBeNull();
  });
});
