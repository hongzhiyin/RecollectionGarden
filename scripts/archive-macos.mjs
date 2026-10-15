import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export async function archiveMacApp(bundle, destination, version) {
  const stage = await mkdtemp(join(tmpdir(), 'rg-dmg-stage-'));
  const image = resolve(destination, `RecollectionGarden-${version}-macos-arm64.dmg`);
  try {
    await mkdir(destination, { recursive: true });
    execFileSync('/usr/bin/ditto', [bundle, join(stage, '流光忆庭.app')], { stdio: 'inherit' });
    execFileSync('/usr/bin/hdiutil', ['create', '-volname', '流光忆庭', '-srcfolder', stage,
      '-fs', 'HFS+', '-format', 'UDZO', '-ov', image], { stdio: 'inherit' });
    execFileSync('/usr/bin/hdiutil', ['verify', image], { stdio: 'inherit' });
    const bytes = await readFile(image);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(image + '.sha256', sha256 + '  ' + image.split('/').pop() + '\n');
    return { image, bytes: bytes.length, sha256 };
  } finally { await rm(stage, { recursive: true, force: true }); }
}
