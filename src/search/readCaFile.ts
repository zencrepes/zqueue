import fs from 'node:fs';

export const readCaFile = (sslCa: string): Buffer | undefined =>
  sslCa === undefined || sslCa === '' ? undefined : fs.readFileSync(sslCa);
