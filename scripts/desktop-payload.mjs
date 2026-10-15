import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function stageDesktopPayload(destination, { offline = false } = {}) {
  const deps = resolve(root, '.runtime/desktop-deps');
  await mkdir(deps, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) await cp(resolve(root, file), resolve(deps, file));
  const npm = process.env.npm_execpath ?? resolve(dirname(process.execPath),
    process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : '../lib/node_modules/npm/bin/npm-cli.js');
  execFileSync(process.execPath,
    [npm, 'ci', ...(offline ? ['--offline'] : []), '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', deps],
    { cwd: root, stdio: 'inherit' });
  await mkdir(destination, { recursive: true });
  for (const folder of ['dist', 'bridge', 'bin', 'desktop/runtime', 'skills/recollection-garden-reading'])
    await cp(resolve(root, folder), resolve(destination, folder), { recursive: true });
  for (const file of ['src/external/protocol.ts', 'src/citations/schema.ts', 'src/notes/protocol.ts', 'src/notes/discoveryProtocol.ts']) {
    await mkdir(dirname(resolve(destination, file)), { recursive: true });
    await cp(resolve(root, file), resolve(destination, file));
  }
  const frontend = new Set(['pdfjs-dist', 'react', 'react-dom', 'scheduler', 'dexie', '@napi-rs']);
  for (const name of await readdir(resolve(deps, 'node_modules'))) {
    if (name === '.bin' || name === '.package-lock.json') continue;
    if (frontend.has(name)) {
      if (name.startsWith('@')) continue;
      for (const file of await readdir(resolve(deps, 'node_modules', name))) if (/^(license|licence|notice)/i.test(file)) {
        const licenses = resolve(destination, '../licenses', name);
        await mkdir(licenses, { recursive: true });
        await cp(resolve(deps, 'node_modules', name, file), resolve(licenses, file), { recursive: true });
      }
    } else await cp(resolve(deps, 'node_modules', name), resolve(destination, 'node_modules', name),
      { recursive: true, verbatimSymlinks: true });
  }
  const source = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  await writeFile(resolve(destination, 'package.json'), JSON.stringify({ name: source.name, version: source.version,
    type: 'module', private: true, engines: source.engines, dependencies: Object.fromEntries(
      ['@modelcontextprotocol/sdk', 'ws', 'zod'].map(name => [name, source.dependencies[name]])) }, null, 2));
}
