import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Standard client configuration, without private bridge tokens or any AI-host-specific fields. */
export function mcpClientConfig({ desktopEntry, executable = process.execPath } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let command, args;
  if (desktopEntry) {
    // Bundled runtime is portable on macOS and Windows; no shell wrapper or PATH lookup is needed.
    command = executable; args = [resolve(desktopEntry), 'mcp'];
  } else {
    const cli = resolve(root, 'releases/流光忆庭.app/Contents/MacOS/recollection-garden');
    command = existsSync(cli) ? cli : executable;
    args = existsSync(cli) ? ['mcp'] : [resolve(root, 'bridge/mcp.mjs')];
  }
  return { mcpServers: { 'recollection-garden': { command, args } } };
}
