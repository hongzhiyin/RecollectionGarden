import { homedir } from 'node:os';
import { resolve } from 'node:path';

const dataDir = process.env.RG_DESKTOP_DATA_DIR ?? resolve(homedir(), 'Library/Application Support/RecollectionGarden/Desktop');
process.env.RG_BRIDGE_CONFIG ??= resolve(dataDir, 'bridge.json');
const mode = process.argv[2] ?? 'serve';
if (mode === 'serve') {
  try {
    const { startDesktop } = await import('./server.mjs');
    const service = await startDesktop({ uiPort: Number(process.env.RG_DESKTOP_UI_PORT ?? 4321),
      bridgePort: Number(process.env.RG_DESKTOP_BRIDGE_PORT ?? 4322) });
    process.stdout.write('RecollectionGarden desktop ready at http://127.0.0.1:' + service.uiPort + '\n');
    let stopping = false;
    const stop = () => {
      if (stopping) return; stopping = true;
      setTimeout(() => process.exit(1), 3000).unref();
      void service.close().then(() => process.exit(0), () => process.exit(1));
    };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
    if (process.env.RG_DESKTOP_MANAGED === '1') {
      process.stdin.once('end', stop); process.stdin.resume();
    }
  } catch (error) {
    process.stderr.write('Desktop service failed: ' + (error.code ?? error.message) + '\n'); process.exitCode = 1;
  }
} else if (mode === 'mcp') {
  await import('../../bridge/mcp.mjs');
} else {
  await import('../../bin/recollection-garden.mjs');
}
