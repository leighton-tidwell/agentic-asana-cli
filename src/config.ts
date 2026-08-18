import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { CliError } from './errors.js';

export interface Config {
  token?: string;
  workspaces?: Array<{ gid: string; name?: string; readOnly: boolean }>;
  webhookTargetAllowlist?: string[];
}

export interface TokenSources {
  env?: Record<string, string | undefined>;
  configToken?: string;
  flagToken?: string;
}

/** Resolve a PAT using the task-defined precedence: env > config > flag. */
export function resolveToken({
  env = process.env,
  configToken,
  flagToken,
}: TokenSources): string | undefined {
  return env.ASANA_PAT || configToken || flagToken;
}

export function redactSecrets(value: unknown, secrets: string[]): string {
  let rendered = value instanceof Error ? value.message : String(value);
  for (const secret of secrets.filter(Boolean)) {
    rendered = rendered.split(secret).join('***');
  }
  return rendered;
}

export function defaultConfigPath(env = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'asn', 'config.json');
}

function invalidConfig(message: string): never {
  throw new CliError('USAGE', `config ${message}`);
}

function validateConfig(value: unknown): Config {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidConfig('must be an object');
  }
  const config = value as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (
      key !== 'token' &&
      key !== 'workspaces' &&
      key !== 'webhookTargetAllowlist'
    ) {
      return invalidConfig(`property ${key} is not allowed`);
    }
  }
  if (
    config.token !== undefined &&
    (typeof config.token !== 'string' || config.token.length === 0)
  ) {
    return invalidConfig('token must be a non-empty string');
  }
  if (
    config.webhookTargetAllowlist !== undefined &&
    (!Array.isArray(config.webhookTargetAllowlist) ||
      config.webhookTargetAllowlist.some((value) => typeof value !== 'string'))
  ) {
    return invalidConfig('webhookTargetAllowlist must be an array of strings');
  }
  if (config.workspaces === undefined) return config as Config;
  if (!Array.isArray(config.workspaces)) {
    return invalidConfig('workspaces must be an array');
  }
  config.workspaces.forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      invalidConfig(`workspaces[${index}] must be an object`);
    }
    const workspace = value as Record<string, unknown>;
    for (const key of Object.keys(workspace)) {
      if (key !== 'gid' && key !== 'name' && key !== 'readOnly') {
        invalidConfig(`workspaces[${index}].${key} is not allowed`);
      }
    }
    if (typeof workspace.gid !== 'string' || !/^[0-9]+$/.test(workspace.gid)) {
      invalidConfig(`workspaces[${index}].gid must contain only digits`);
    }
    if (workspace.name !== undefined && typeof workspace.name !== 'string') {
      invalidConfig(`workspaces[${index}].name must be a string`);
    }
    if (!Object.hasOwn(workspace, 'readOnly')) {
      invalidConfig(`workspaces[${index}].readOnly is required`);
    }
    if (typeof workspace.readOnly !== 'boolean') {
      invalidConfig(`workspaces[${index}].readOnly must be a boolean`);
    }
  });
  return config as unknown as Config;
}

export async function readConfig(path: string): Promise<Config> {
  try {
    return validateConfig(JSON.parse(await readFile(path, 'utf8')) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function writePrivateFile(
  path: string,
  contents: string,
): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await stat(directory)).mode & 0o002) {
    throw new Error(
      `refusing to write private data to insecure directory: ${directory}`,
    );
  }
  await writeFile(path, contents, { mode: 0o600 });
  await chmod(path, 0o600);
  if ((await stat(path)).mode & 0o077) {
    throw new Error(`private file permissions are insecure: ${path}`);
  }
}

export async function storeToken(path: string, token: string): Promise<void> {
  const config = await readConfig(path);
  await writePrivateFile(path, JSON.stringify({ ...config, token }, null, 2));
}
