import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const configPath = () => process.env.RG_BRIDGE_CONFIG ?? resolve(projectRoot, '.runtime/bridge.json');
export async function createConfig(port) {
  const token = randomBytes(32).toString('hex');
  const config = { version: 1, port, token };
  await mkdir(dirname(configPath()), { recursive: true, mode: 0o700 });
  await writeFile(configPath(), JSON.stringify(config), { mode: 0o600 });
  await chmod(configPath(), 0o600);
  return config;
}
export async function readConfig() {
  const config = JSON.parse(await readFile(configPath(), 'utf8'));
  if (config.version !== 1 || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535
    || !/^[a-f0-9]{64}$/.test(config.token)) throw new Error('本地服务配置无效，请重新启动服务。');
  return config;
}
