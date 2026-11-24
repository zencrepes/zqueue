import { homedir } from 'node:os';

import { resolveConfigDir } from './resolveConfigDir.js';

describe('resolveConfigDir', () => {
  it('defaults to ~/.config/zindexer/ with the tilde expanded', () => {
    expect(resolveConfigDir({})).toBe(homedir() + '/.config/zindexer/');
  });

  it('uses CONFIG_PATH when set', () => {
    expect(resolveConfigDir({ CONFIG_PATH: '/etc/zqueue/' })).toBe(
      '/etc/zqueue/',
    );
  });

  it('expands a tilde in CONFIG_PATH', () => {
    expect(resolveConfigDir({ CONFIG_PATH: '~/custom/' })).toBe(
      homedir() + '/custom/',
    );
  });
});
