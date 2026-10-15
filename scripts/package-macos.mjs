import { cp, mkdir, writeFile, readFile, rm, readdir, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageDesktopPayload } from './desktop-payload.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('This packager targets macOS Apple Silicon.');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const release = resolve(root, 'releases');
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--output requires an app path.');
const bundle = resolve(root, outputIndex >= 0 ? process.argv[outputIndex + 1] : 'releases/流光忆庭.app');
if (!bundle.endsWith('.app')) throw new Error('Output must be an .app bundle.');
const resources = resolve(bundle, 'Contents/Resources');
const app = resolve(resources, 'app');
await rm(bundle, { recursive: true, force: true });
await mkdir(resolve(bundle, 'Contents/MacOS'), { recursive: true });
await mkdir(resolve(resources, 'runtime'), { recursive: true });
await stageDesktopPayload(app, { offline: true });
await cp(process.execPath, resolve(resources, 'runtime/node'));
const nodeHome = dirname(dirname(process.execPath));
await cp(resolve(nodeHome, 'LICENSE'), resolve(resources, 'runtime/Node-LICENSE'));
run('xcrun', ['clang', '-fobjc-arc', '-arch', 'arm64', '-mmacosx-version-min=26.0',
  '-framework', 'AppKit', '-framework', 'WebKit', '-framework', 'UniformTypeIdentifiers',
  'desktop/macos/main.m', 'desktop/macos/RuntimeHost.m', 'desktop/macos/WebDelegate.m', 'desktop/macos/SingleInstance.m', 'desktop/macos/ReaderWorkspace.m', 'desktop/macos/BrowserPane.m',
  '-o', resolve(bundle, 'Contents/MacOS/RecollectionGarden')]);
const iconset = resolve(root, '.runtime/AppIcon.iconset'); await mkdir(iconset, { recursive: true });
run('xcrun', ['clang', '-fobjc-arc', '-framework', 'AppKit', 'desktop/macos/icon.m', '-o', '.runtime/draw-app-icon']);
run(resolve(root, '.runtime/draw-app-icon'), [iconset]);
run('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', resolve(resources, 'AppIcon.icns')]);
const plist = { CFBundleExecutable: 'RecollectionGarden', CFBundleIdentifier: 'com.chihoyo.RecollectionGarden',
  CFBundleName: '流光忆庭', CFBundleDisplayName: '流光忆庭', CFBundlePackageType: 'APPL',
  CFBundleShortVersionString: version, CFBundleVersion: version, CFBundleIconFile: 'AppIcon',
  LSMinimumSystemVersion: '26.0', NSHighResolutionCapable: true,
  RGSingleInstance: true,
  NSAppTransportSecurity: { NSAllowsLocalNetworking: true } };
await writeFile(resolve(root, '.runtime/desktop-plist.json'), JSON.stringify(plist));
run('python3', ['-c', 'import json,plistlib,sys; plistlib.dump(json.load(open(sys.argv[1])),open(sys.argv[2],"wb"))',
  '.runtime/desktop-plist.json', resolve(bundle, 'Contents/Info.plist')]);
await writeFile(resolve(bundle, 'Contents/MacOS/recollection-garden'),
  '#!/bin/sh\nset -eu\nresources_dir="$(CDPATH= cd -- "$(dirname -- "$0")/../Resources" && pwd)"\nexec "$resources_dir/runtime/node" "$resources_dir/app/desktop/runtime/entry.mjs" "$@"\n', { mode: 0o755 });
await writeFile(resolve(app, 'skills/recollection-garden-reading/references/local-install.md'),
  '# Desktop distribution\n\nUse the application bundle CLI at Contents/MacOS/recollection-garden, with the operation as its argument; use the argument mcp for stdio MCP. It launches bundled Node and sets the desktop configuration path automatically. Do not start the development bridge on port 4320.\n\nResolve the bundled CLI from this skill directory: ../../../../MacOS/recollection-garden. The desktop window must be running; its UI uses port 4321 and bridge uses 4322. Desktop data is separate from browser data.\n');
run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', bundle]);
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
const all = [];
async function walk(folder, prefix = '') {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isSymbolicLink() && !(await realpath(resolve(folder, item.name))).startsWith(bundle + '/'))
      throw new Error('External symlink in release: ' + relative);
    if (item.isDirectory()) await walk(resolve(folder, item.name), relative + '/'); else all.push(relative);
  }
}
await walk(bundle);
if (all.some(file => /(^|\/)(\.runtime|bridge\.json|\.env)(\/|$)/.test(file))) throw new Error('Private runtime files entered release.');
if (process.argv.includes('--release')) {
  const { archiveMacApp } = await import('./archive-macos.mjs');
  console.log(JSON.stringify(await archiveMacApp(bundle, release, version)));
}
console.log(JSON.stringify({ bundle, version, files: all.length, personalDataIncluded: false }));
