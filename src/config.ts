import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Config {
  token?: string;
  workspaces?: Array<{ gid: string; name?: string; readOnly: boolean }>;
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

export async function readConfig(path: string): Promise<Config> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function storeToken(path: string, token: string): Promise<void> {
  const config = await readConfig(path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ ...config, token }, null, 2), {
    mode: 0o600,
  });
}
