import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
// @ts-expect-error The provider CLI is a native ESM entry.
import { mcpClientConfig } from '../../bridge/mcp-config.mjs';
describe('portable MCP client configuration', () => {
  it('exports only the standard mcpServers envelope and command arguments', () => {
    const value = mcpClientConfig();
    expect(Object.keys(value)).toEqual(['mcpServers']);
    expect(Object.keys(value.mcpServers['recollection-garden'])).toEqual(['command', 'args']);
    expect(value.mcpServers['recollection-garden'].command).toMatch(/^(\/|[A-Za-z]:)/);
    expect(JSON.stringify(value)).not.toMatch(/token|DreamEdge|Codex/);
  });
  it('uses the bundled executable and entry for a relocated desktop package', () => {
    const desktopEntry = resolve('relocated/app/entry.mjs'), executable = resolve('relocated/runtime/node');
    expect(mcpClientConfig({ desktopEntry, executable }))
      .toEqual({ mcpServers: { 'recollection-garden': { command: executable, args: [desktopEntry, 'mcp'] } } });
  });
});
