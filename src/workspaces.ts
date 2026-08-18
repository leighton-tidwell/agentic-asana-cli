import { readFile } from 'node:fs/promises';
import { writePrivateFile } from './config.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Workspace {
  gid: string;
  name?: string;
  readOnly: boolean;
}

interface WorkspaceClient {
  paginate<T>(
    path: string,
    options: { all: boolean },
  ): Promise<{ data: T[]; next_page: unknown }>;
}

interface ListOptions {
  configured: Workspace[];
  cachePath: string;
  client: WorkspaceClient;
  now?: () => number;
  ttlMs?: number;
  refresh?: boolean;
}

interface CacheFile {
  cachedAt: number;
  data: Workspace[];
}

export function defaultWorkspaceCachePath(env = process.env): string {
  const base = env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'asn', 'workspaces.json');
}

export async function listWorkspaces(
  options: ListOptions,
): Promise<Workspace[]> {
  if (options.configured.length > 0) return options.configured;
  const now = (options.now ?? Date.now)();
  if (!options.refresh) {
    try {
      const cache = JSON.parse(
        await readFile(options.cachePath, 'utf8'),
      ) as CacheFile;
      if (now - cache.cachedAt < (options.ttlMs ?? 86_400_000))
        return cache.data;
    } catch {
      // A missing or invalid cache is equivalent to a cache miss.
    }
  }

  const response = await options.client.paginate<{
    gid: string;
    name?: string;
  }>('/workspaces', { all: true });
  const data = response.data.map((workspace) => ({
    ...workspace,
    readOnly: false,
  }));
  await writePrivateFile(
    options.cachePath,
    JSON.stringify({ cachedAt: now, data }),
  );
  return data;
}
