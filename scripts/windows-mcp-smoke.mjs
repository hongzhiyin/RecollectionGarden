import { resolve } from 'node:path';
import { verifyPackagedMcp } from './desktop-mcp-smoke.mjs';

await verifyPackagedMcp(resolve(process.argv[2], 'recollection-garden.exe'), 'windows-smoke', process.argv[3]);
