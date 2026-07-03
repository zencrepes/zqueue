import { getId, getCaseId } from './utils';

const UUID_V5_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('testing cases utils', () => {
  describe('getId', () => {
    it('generates a uuid v5', () => {
      const id = getId({ name: 'my-app', version: '1.0.0' });
      expect(id).toMatch(UUID_V5_REGEXP);
    });

    it('is deterministic for the same dependency', () => {
      const a = getId({ name: 'my-app', version: '1.0.0' });
      const b = getId({ name: 'my-app', version: '1.0.0' });
      expect(a).toEqual(b);
    });

    it('changes when the version changes', () => {
      const a = getId({ name: 'my-app', version: '1.0.0' });
      const b = getId({ name: 'my-app', version: '2.0.0' });
      expect(a).not.toEqual(b);
    });

    it('ignores case and non-alphanumerical characters', () => {
      const a = getId({ name: 'My-App', version: '1.0.0' });
      const b = getId({ name: 'myapp', version: '100' });
      expect(a).toEqual(b);
    });
  });

  describe('getCaseId', () => {
    const testCase = {
      id: 'case-1',
      createdAt: '2026-01-01T00:00:00Z',
    } as any;

    it('generates a uuid v5', () => {
      expect(getCaseId(testCase)).toMatch(UUID_V5_REGEXP);
    });

    it('is deterministic for the same case', () => {
      expect(getCaseId(testCase)).toEqual(getCaseId({ ...testCase }));
    });

    it('changes when the creation date changes', () => {
      const other = { ...testCase, createdAt: '2026-01-02T00:00:00Z' };
      expect(getCaseId(testCase)).not.toEqual(getCaseId(other));
    });
  });
});
