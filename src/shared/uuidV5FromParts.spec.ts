import { v5 as uuidv5 } from 'uuid';

import { UUID_NAMESPACE, uuidV5FromParts } from './uuidV5FromParts.js';

describe('uuidV5FromParts', () => {
  it('matches the historical id computation (cleaned, lowercased, joined)', () => {
    // v1 computed uuidv5(prep(name) + prep(version), NAMESPACE).
    expect(uuidV5FromParts('My-Component', '2.0.1')).toBe(
      uuidv5('mycomponent201', UUID_NAMESPACE),
    );
  });

  it('is stable for equivalent spellings', () => {
    expect(uuidV5FromParts('foo bar', '1.0')).toBe(
      uuidV5FromParts('Foo-Bar', '10'),
    );
  });

  it('differs for different inputs', () => {
    expect(uuidV5FromParts('foo', '1')).not.toBe(uuidV5FromParts('foo', '2'));
  });

  it('accepts empty parts', () => {
    expect(uuidV5FromParts('name', '', '')).toBe(
      uuidv5('name', UUID_NAMESPACE),
    );
  });
});
