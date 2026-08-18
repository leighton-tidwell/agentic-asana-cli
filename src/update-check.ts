import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const DEFAULT_TTL_MS = 86_400_000;

export interface UpdateCache {
  checkedAt: number;
  latestVersion: string;
}

export interface UpdateCheckDeps {
  argv: string[];
  env: Record<string, string | undefined>;
  isTTY: boolean;
  cachePath: string;
  now: () => number;
  currentVersion: string;
  cliName: string;
  fetchLatest: () => Promise<string>;
  readCache: (path: string) => Promise<UpdateCache | null>;
  writeCache: (path: string, data: UpdateCache) => Promise<void>;
  write: (text: string) => void;
  ttlMs?: number;
}

export function defaultUpdateCachePath(env = process.env): string {
  const base = env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'asn', 'update-check.json');
}

export async function readUpdateCache(
  path: string,
): Promise<UpdateCache | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as UpdateCache;
  } catch {
    return null;
  }
}

export async function writeUpdateCache(
  path: string,
  data: UpdateCache,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

function isSuppressed(
  argv: string[],
  env: Record<string, string | undefined>,
  isTTY: boolean,
): boolean {
  if (argv.includes('--no-update-check')) return true;
  if (env.ASN_NO_UPDATE_CHECK === '1') return true;
  if (env.CI === 'true') return true;
  if (!isTTY) return true;
  const firstArg = argv.find((value) => !value.startsWith('-'));
  if (firstArg === 'upgrade' || firstArg === 'update') return true;
  if (argv.includes('--version') || argv.includes('--help')) return true;
  return false;
}

/** Prints a stderr notice when a newer version is available, caching the result for 24h. Never throws. */
export async function maybeNotifyUpdate(deps: UpdateCheckDeps): Promise<void> {
  try {
    if (isSuppressed(deps.argv, deps.env, deps.isTTY)) return;

    const now = deps.now();
    const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
    let latestVersion: string;

    const cache = await deps.readCache(deps.cachePath).catch(() => null);
    if (cache && now - cache.checkedAt < ttlMs) {
      latestVersion = cache.latestVersion;
    } else {
      latestVersion = await deps.fetchLatest();
      await deps
        .writeCache(deps.cachePath, { checkedAt: now, latestVersion })
        .catch(() => {});
    }

    if (latestVersion !== deps.currentVersion) {
      deps.write(
        `${deps.cliName}: a newer version is available (${deps.currentVersion} -> ${latestVersion}). Run \`${deps.cliName} upgrade\` to update.\n`,
      );
    }
  } catch {
    // Never let the update check delay or break the invoked command.
  }
}
