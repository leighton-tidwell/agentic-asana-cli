import { Readable } from 'node:stream';
import { CliError } from './errors.js';
import { enforceReadOnly, type WorkspacePolicy } from './guard.js';

export interface ClientOptions {
  token: string;
  workspaces?: WorkspacePolicy[];
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  maxWaitMs?: number;
  timeoutMs?: number;
  resolveWorkspace?: (resourceGid: string) => Promise<string | undefined>;
  webhookTargetAllowlist?: string[];
  allowUnlistedWebhookTarget?: boolean;
}

export interface RequestSpec {
  method: string;
  path: string;
  workspaceGid?: string;
  workspaceGids?: string[];
  workspaceLookupPath?: string;
  workspaceLookupPaths?: string[];
  headers?: Record<string, string>;
  body?: unknown;
}

interface Page<T> {
  data: T[];
  next_page: { offset: string } | null;
}

function isWebhookCreate(spec: RequestSpec): boolean {
  return (
    spec.method.toUpperCase() === 'POST' &&
    spec.path.split('?')[0] === '/webhooks'
  );
}

function collectionWorkspaceLookupPaths(
  spec: RequestSpec,
): string[] | undefined {
  const segments = spec.path.split('?')[0]?.split('/').filter(Boolean) ?? [];
  if (
    spec.method.toUpperCase() !== 'POST' ||
    segments.length !== 1 ||
    ['batch', 'webhooks', 'workspaces'].includes(segments[0] ?? '')
  ) {
    return undefined;
  }
  const data = (spec.body as { data?: Record<string, unknown> } | undefined)
    ?.data;
  if (!data || typeof data !== 'object') return [];
  const paths: string[] = [];
  for (const [field, collection] of [
    ['project', 'projects'],
    ['team', 'teams'],
    ['portfolio', 'portfolios'],
    ['parent', 'tasks'],
    ['resource', 'tasks'],
    ['goal', 'goals'],
    ['task', 'tasks'],
  ] as const) {
    const gid = data[field];
    if (typeof gid === 'string' || typeof gid === 'number') {
      paths.push(`/${collection}/${encodeURIComponent(String(gid))}`);
    }
  }
  if (Array.isArray(data.projects)) {
    for (const gid of data.projects) {
      if (typeof gid === 'string' || typeof gid === 'number') {
        paths.push(`/projects/${encodeURIComponent(String(gid))}`);
      }
    }
  }
  const bodyWorkspace = data.workspace;
  return paths.length > 0 || bodyWorkspace === undefined
    ? paths.filter((path, index) => paths.indexOf(path) === index)
    : undefined;
}

export class AsanaClient {
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly workspaces: WorkspacePolicy[];
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly workspaceCache = new Map<
    string,
    Promise<string | undefined>
  >();

  constructor(private readonly options: ClientOptions) {
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.workspaces = options.workspaces ?? [];
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  private workspaceLookupPaths(spec: RequestSpec): string[] | undefined {
    if (spec.workspaceLookupPath) return [spec.workspaceLookupPath];
    return spec.workspaceLookupPaths ?? collectionWorkspaceLookupPaths(spec);
  }

  private requiresWorkspaceResolution(spec: RequestSpec): boolean {
    return Boolean(
      this.workspaceLookupPaths(spec) &&
      this.workspaces.some((workspace) => workspace.readOnly) &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(spec.method.toUpperCase()),
    );
  }

  private assertedWorkspaces(spec: RequestSpec): string[] {
    return spec.workspaceGids ?? (spec.workspaceGid ? [spec.workspaceGid] : []);
  }

  assertAllowed(spec: RequestSpec): void {
    if (this.requiresWorkspaceResolution(spec)) {
      const asserted = this.assertedWorkspaces(spec);
      if (asserted.length > 0) {
        enforceReadOnly(spec.method, asserted, this.workspaces);
      }
      enforceReadOnly(spec.method, undefined, this.workspaces);
    }
    const webhook = isWebhookCreate(spec);
    enforceReadOnly(
      spec.method,
      webhook ? undefined : (spec.workspaceGids ?? spec.workspaceGid),
      this.workspaces,
      {
        path: spec.path,
        body: spec.body,
      },
    );
  }

  async request(spec: RequestSpec): Promise<unknown> {
    let guardedSpec = spec;
    let workspaceResolved = false;
    if (this.requiresWorkspaceResolution(spec)) {
      const asserted = this.assertedWorkspaces(spec);
      if (asserted.length > 0) {
        enforceReadOnly(spec.method, asserted, this.workspaces);
      }
      const lookupPaths = this.workspaceLookupPaths(spec) ?? [];
      const resolved = await Promise.all(
        lookupPaths.map((path) => this.resolveWorkspace(path)),
      );
      guardedSpec = {
        ...spec,
        workspaceGids: resolved.every(
          (workspaceGid): workspaceGid is string => workspaceGid !== undefined,
        )
          ? resolved
          : [],
        workspaceLookupPath: undefined,
        workspaceLookupPaths: undefined,
      };
      workspaceResolved = true;
    }
    const webhook = isWebhookCreate(spec);
    if (webhook && this.workspaces.some((workspace) => workspace.readOnly)) {
      const resource = (
        spec.body as { data?: { resource?: unknown } } | undefined
      )?.data?.resource;
      const workspaceGid =
        resource !== undefined && this.options.resolveWorkspace
          ? await this.options.resolveWorkspace(String(resource))
          : this.workspaces.some(
                (workspace) => workspace.gid === String(resource),
              )
            ? String(resource)
            : undefined;
      enforceReadOnly(spec.method, workspaceGid, this.workspaces, {
        path: spec.path,
        body: spec.body,
      });
      const target = (spec.body as { data?: { target?: unknown } } | undefined)
        ?.data?.target;
      let targetOrigin: string | undefined;
      try {
        targetOrigin =
          typeof target === 'string' ? new URL(target).origin : undefined;
      } catch {
        targetOrigin = undefined;
      }
      const allowedOrigins = (
        this.options.webhookTargetAllowlist ?? []
      ).flatMap((allowed) => {
        try {
          return [new URL(allowed).origin];
        } catch {
          return [];
        }
      });
      if (
        !this.options.allowUnlistedWebhookTarget &&
        (!targetOrigin || !allowedOrigins.includes(targetOrigin))
      ) {
        throw new CliError(
          'READONLY_BLOCKED',
          'webhook target origin is not allowlisted; use --allow-unlisted-webhook-target for explicit operator opt-in',
        );
      }
    } else if (workspaceResolved) {
      enforceReadOnly(
        guardedSpec.method,
        guardedSpec.workspaceGids,
        this.workspaces,
        { path: guardedSpec.path, body: guardedSpec.body },
      );
    } else {
      this.assertAllowed(guardedSpec);
    }
    const streaming = spec.body instanceof Readable;
    const init: RequestInit & { duplex?: 'half' } = {
      method: spec.method,
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        ...(spec.body !== undefined &&
        !streaming &&
        !(spec.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...spec.headers,
      },
      ...(spec.body !== undefined
        ? {
            body:
              streaming ||
              spec.body instanceof FormData ||
              typeof spec.body === 'string'
                ? (spec.body as BodyInit)
                : JSON.stringify(spec.body),
          }
        : {}),
      ...(streaming ? { duplex: 'half' as const } : {}),
    };
    const response = await this.fetchWithRetry(
      `https://app.asana.com/api/1.0${spec.path}`,
      init,
    );
    return response.json();
  }

  private resolveWorkspace(path: string): Promise<string | undefined> {
    const cached = this.workspaceCache.get(path);
    if (cached) return cached;
    const optFields = path.startsWith('/attachments/')
      ? 'parent.gid,parent.resource_type'
      : 'workspace.gid,parent.gid,parent.resource_type';
    const resolution = this.fetchWithRetry(
      `https://app.asana.com/api/1.0${path}?opt_fields=${optFields}`,
      {
        headers: { Authorization: ['Bearer', this.options.token].join(' ') },
      },
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: {
            workspace?: string | { gid?: string };
            parent?: {
              gid?: string;
              resource_type?: string;
              workspace?: string | { gid?: string };
            };
          };
        };
        const workspace =
          payload.data?.workspace ?? payload.data?.parent?.workspace;
        if (typeof workspace === 'string') return workspace;
        if (workspace?.gid) return workspace.gid;
        const parent = payload.data?.parent;
        if (parent?.gid && parent.resource_type) {
          const collection = `${parent.resource_type.replace(/y$/, 'ie')}s`;
          return this.resolveWorkspace(
            `/${collection}/${encodeURIComponent(parent.gid)}`,
          );
        }
        return undefined;
      })
      .catch(() => undefined);
    this.workspaceCache.set(path, resolution);
    return resolution;
  }

  async paginate<T>(
    path: string,
    options: { all?: boolean; limit?: number } = {},
  ): Promise<Page<T>> {
    const data: T[] = [];
    let offset: string | undefined;
    let resumePage: Page<T>['next_page'] = null;

    do {
      const url = new URL(`https://app.asana.com/api/1.0${path}`);
      if (offset) url.searchParams.set('offset', offset);
      const response = await this.fetchWithRetry(url, {
        headers: { Authorization: `Bearer ${this.options.token}` },
      });
      const page = (await response.json()) as Page<T>;
      const previousCursor = offset ? { offset } : page.next_page;
      data.push(...page.data);
      resumePage = page.next_page;
      if (options.limit !== undefined && data.length >= options.limit) {
        return {
          data: data.slice(0, options.limit),
          next_page: previousCursor,
        };
      }
      offset = options.all ? page.next_page?.offset : undefined;
    } while (offset);

    return { data, next_page: resumePage };
  }

  private async fetchWithRetry(
    input: string | URL,
    init: RequestInit,
  ): Promise<Response> {
    const maxAttempts = this.options.maxAttempts ?? 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchFn(input, {
          ...init,
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
        });
      } catch (error) {
        throw new CliError('NETWORK', 'request failed or timed out', {
          cause: error instanceof Error ? error.name : 'unknown',
        });
      }
      if (response.status === 429) {
        if (attempt === maxAttempts) {
          throw new CliError(
            'RATE_LIMITED',
            'rate limit retry budget exhausted',
          );
        }
        const retryAfter = response.headers.get('retry-after');
        const parsedSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
        const exponentialMs = 1000 * 2 ** (attempt - 1);
        const requestedMs = Number.isFinite(parsedSeconds)
          ? parsedSeconds * 1000
          : exponentialMs;
        await this.sleep(
          Math.min(requestedMs, this.options.maxWaitMs ?? 60_000),
        );
        continue;
      }
      if (!response.ok) {
        const details = await response
          .clone()
          .json()
          .catch(() => null);
        const code =
          response.status === 401
            ? 'AUTH'
            : response.status === 403
              ? 'FORBIDDEN'
              : response.status === 404
                ? 'NOT_FOUND'
                : response.status >= 500
                  ? 'SERVER'
                  : 'CONFLICT';
        throw new CliError(
          code,
          `Asana API returned HTTP ${response.status}`,
          details,
        );
      }
      return response;
    }
    throw new CliError('INTERNAL', 'unreachable retry state');
  }
}
