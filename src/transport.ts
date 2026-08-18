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
}

export interface RequestSpec {
  method: string;
  path: string;
  workspaceGid?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface Page<T> {
  data: T[];
  next_page: { offset: string } | null;
}

export class AsanaClient {
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly workspaces: WorkspacePolicy[];
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: ClientOptions) {
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.workspaces = options.workspaces ?? [];
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  assertAllowed(spec: RequestSpec): void {
    enforceReadOnly(spec.method, spec.workspaceGid, this.workspaces);
  }

  async request(spec: RequestSpec): Promise<unknown> {
    this.assertAllowed(spec);
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
