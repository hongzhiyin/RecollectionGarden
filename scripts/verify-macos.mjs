import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { verifyPackagedMcp } from './desktop-mcp-smoke.mjs';

const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const image = resolve('releases', `RecollectionGarden-${version}-macos-arm64.dmg`);
const expected = (await readFile(image + '.sha256', 'utf8')).split(/\s/)[0];
assert.equal(createHash('sha256').update(await readFile(image)).digest('hex'), expected);
const mount = await mkdtemp(join(tmpdir(), 'rg-mounted-'));
const relocation = await mkdtemp(join(tmpdir(), 'rg-relocated-app-'));
const profile = await mkdtemp(join(tmpdir(), 'rg-macos-profile-'));
const report = resolve('test-results/macos-package'); await mkdir(report, { recursive: true });
let mounted = false, child, exited, browser;
const oldProfile = process.env.RG_DESKTOP_DATA_DIR;
try {
  execFileSync('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image], { stdio: 'inherit' });
  mounted = true;
  const app = join(relocation, '流光忆庭.app');
  execFileSync('/usr/bin/ditto', [join(mount, '流光忆庭.app'), app]);
  execFileSync('/usr/bin/hdiutil', ['detach', mount], { stdio: 'inherit' }); mounted = false;
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  const cli = join(app, 'Contents/MacOS/recollection-garden');
  const help = JSON.parse(execFileSync('/usr/bin/env', ['-i', 'PATH=/usr/bin:/bin', cli, 'help'], { encoding: 'utf8', cwd: tmpdir() }));
  assert.equal(help.ok, true); assert.equal(help.data.operations.length, 23);
  process.env.RG_DESKTOP_DATA_DIR = profile;
  child = spawn(cli, ['serve'], { cwd: tmpdir(), env: { ...process.env,
    RG_DESKTOP_UI_PORT: '0', RG_DESKTOP_BRIDGE_PORT: '0', RG_DESKTOP_MANAGED: '1' }, stdio: ['pipe','pipe','pipe'] });
  exited = once(child, 'exit');
  let output = '', errors = '';
  child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { errors += chunk; });
  let url;
  for (let attempt = 0; attempt < 150; attempt++) {
    url = output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    if (url) break;
    assert.equal(child.exitCode, null, errors);
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(url, 'Packaged server readiness timed out: ' + errors);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.route('**/assets/pdf.worker*.mjs', async route => {
    await new Promise(done => setTimeout(done, 1000));
    await route.continue();
  });
  await page.goto(url);
  await page.getByTestId('pdf-input').setInputFiles({ name: 'macos-smoke.pdf', mimeType: 'application/pdf',
    buffer: await readFile('tests/fixtures/text-navigation.pdf') });
  await page.getByRole('button', { name: '阅读 macos-smoke', exact: true }).click();
  await expect(page.locator('.reader-surface canvas')).toHaveCSS('opacity', '1');
  const ink = await page.locator('.reader-surface canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 180 && pixels[i+3]) count++;
    return count;
  });
  assert.ok(ink > 100);
  await expect(page.locator('.textLayer')).toContainText('Selecting original text');
  await page.screenshot({ path: join(report, 'reader.png') });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '连接本地服务', exact: true }).click();
  await expect(page.getByText('外部工具已连接', { exact: true })).toBeVisible();
  await verifyPackagedMcp(cli, 'macos-smoke', join(report, 'mcp.json'));
  await browser.close(); browser = undefined;
  child.stdin.end(); assert.equal((await exited)[0], 0);
  await assert.rejects(fetch(url));
} finally {
  await browser?.close();
  if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
  if (mounted) execFileSync('/usr/bin/hdiutil', ['detach', mount]);
  if (oldProfile === undefined) delete process.env.RG_DESKTOP_DATA_DIR; else process.env.RG_DESKTOP_DATA_DIR = oldProfile;
  for (const folder of [mount, relocation, profile]) await rm(folder, { recursive: true, force: true });
}
console.log('Mac DMG, relocated app signature, bundled CLI, production reader and MCP verified.');
