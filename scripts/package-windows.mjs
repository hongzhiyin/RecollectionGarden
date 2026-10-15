import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stageDesktopPayload } from './desktop-payload.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const arch = process.argv[2] ?? 'x64';
if (!['x64', 'arm64'].includes(arch)) throw new Error('Windows architecture must be x64 or arm64.');
const source = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const version = source.version, nodeVersion = '22.22.2';
const checksums = { x64: '7c93e9d92bf68c07182b471aa187e35ee6cd08ef0f24ab060dfff605fcc1c57c',
  arm64: '380d375cf650c5a7f2ef3ce29ac6ea9a1c9d2ec8ea8e8391e1a34fd543886ab3' };
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
const output = resolve(root, 'releases', `RecollectionGarden-${version}-windows-${arch}`);
await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
for (const project of ['desktop/windows/RecollectionGarden.csproj', 'desktop/windows/cli/RecollectionGarden.Cli.csproj'])
  run('dotnet', ['publish', project, '-c', 'Release', '-r', 'win-' + arch, '--self-contained', 'true',
    '-p:Version=' + version, '-p:DebugType=None', '-p:DebugSymbols=false', '-o', output]);
const resources = resolve(output, 'Resources');
await stageDesktopPayload(resolve(resources, 'app'));
const cache = resolve(root, '.runtime/windows-node'); await mkdir(cache, { recursive: true });
const name = `node-v${nodeVersion}-win-${arch}`, archive = resolve(cache, name + '.zip');
let bytes;
try { bytes = await readFile(archive); } catch {
  const response = await fetch(`https://nodejs.org/dist/v${nodeVersion}/${name}.zip`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Node download failed: ' + response.status);
  bytes = Buffer.from(await response.arrayBuffer()); await writeFile(archive, bytes);
}
if (createHash('sha256').update(bytes).digest('hex') !== checksums[arch]) throw new Error('Node checksum mismatch.');
run('tar', ['-xf', archive, '-C', cache]);
await mkdir(resolve(resources, 'runtime'), { recursive: true });
await cp(resolve(cache, name, 'node.exe'), resolve(resources, 'runtime/node.exe'));
await cp(resolve(cache, name, 'LICENSE'), resolve(resources, 'runtime/Node-LICENSE'));
await cp(resolve(root, 'docs/windows-preview.md'), resolve(output, '使用说明.md'));
await writeFile(resolve(resources, 'app/skills/recollection-garden-reading/references/local-install.md'),
  '# Windows distribution\n\nUse recollection-garden.exe beside RecollectionGarden.exe. For stdio MCP use the full CLI executable path with args ["mcp"]. Both use bundled Node and %LOCALAPPDATA%/RecollectionGarden/Desktop. Start the desktop app and connect its desired window. The UI uses port 4321, bridge 4322.\n');
await writeFile(resolve(output, 'release.json'), JSON.stringify({ product: 'RecollectionGarden', version,
  platform: 'win32', arch, node: nodeVersion, personalDataIncluded: false }, null, 2));
const zip = output + '.zip'; await rm(zip, { force: true });
if (process.platform === 'win32') run('powershell.exe', ['-NoProfile', '-File', 'scripts/archive-windows.ps1', output, zip]);
else run('ditto', ['-c', '-k', '--keepParent', output, zip]);
const digest = createHash('sha256').update(await readFile(zip)).digest('hex');
await writeFile(zip + '.sha256', digest + '  ' + zip.split(/[\\/]/).pop() + '\n');
console.log(JSON.stringify({ output, zip, sha256: digest }));
