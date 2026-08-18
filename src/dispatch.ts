import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { readConfig, redactSecrets, resolveToken } from './config.js';
import { CliError } from './errors.js';
import { assertSafeLocalFile } from './file-access.js';
import type {
  ApiCommand,
  CommandManifest,
  CommandParameter,
} from './manifest.js';
import { renderOutput, type OutputFormat } from './output.js';
import { AsanaClient, type RequestSpec } from './transport.js';
import { defaultWorkspaceCachePath } from './workspaces.js';

interface GeneratedOptions {
  token?: string;
  config: string;
  output: OutputFormat;
  dryRun?: boolean;
  guardWorkspace?: string;
  workspace?: string;
  allowOutsideCwd?: boolean;
  allowUnlistedWebhookTarget?: boolean;
  [key: string]: unknown;
}

function optionKey(parameter: CommandParameter): string {
  return (parameter.flag ?? `--${parameter.name}`)
    .slice(2)
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function scalar(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value);
}

function fieldValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function jsonBody(options: Record<string, unknown>): unknown {
  if (typeof options.bodyJson === 'string') {
    return JSON.parse(options.bodyJson) as unknown;
  }
  const fields = options.field;
  if (fields === undefined) return undefined;
  const data: Record<string, unknown> = {};
  for (const field of Array.isArray(fields) ? fields : [fields]) {
    const text = String(field);
    const separator = text.indexOf('=');
    if (separator < 1) throw new CliError('USAGE', `invalid --field: ${text}`);
    data[text.slice(0, separator)] = fieldValue(text.slice(separator + 1));
  }
  return { data };
}

export function buildRequest(
  entry: ApiCommand,
  positional: unknown[],
  options: Record<string, unknown>,
): RequestSpec {
  let path = entry.path;
  const pathParameters = entry.parameters.filter(
    (parameter) => parameter.in === 'path',
  );
  pathParameters.forEach((parameter, index) => {
    path = path.replace(
      `{${parameter.name}}`,
      encodeURIComponent(scalar(positional[index])),
    );
  });

  const query = new URLSearchParams();
  for (const parameter of entry.parameters.filter(
    (item) => item.in === 'query',
  )) {
    const value = options[optionKey(parameter)];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(parameter.name, scalar(item));
    } else {
      query.set(parameter.name, scalar(value));
    }
  }
  const queryText = query.toString();
  if (queryText) path += `?${queryText}`;

  const body = jsonBody(options);
  const bodyWorkspace =
    body && typeof body === 'object'
      ? ((body as { data?: { workspace?: unknown }; workspace?: unknown }).data
          ?.workspace ?? (body as { workspace?: unknown }).workspace)
      : undefined;
  const workspacePathIndex = pathParameters.findIndex(
    (parameter) => parameter.name === 'workspace_gid',
  );
  const workspaceGids = [
    options.guardWorkspace,
    options.workspace,
    options.workspaceGid,
    options.workspace_gid,
    bodyWorkspace,
    ...(workspacePathIndex >= 0 ? [positional[workspacePathIndex]] : []),
  ]
    .filter((value) => value !== undefined)
    .map(scalar)
    .filter((gid, index, gids) => gids.indexOf(gid) === index);
  const pathWithoutQuery = path.split('?')[0] ?? path;
  const resourceSegments = pathWithoutQuery.split('/').filter(Boolean);
  const workspaceLookupPath =
    resourceSegments.length >= 2 && resourceSegments[0] !== 'workspaces'
      ? `/${resourceSegments[0]}/${resourceSegments[1]}`
      : undefined;

  return {
    method: entry.method,
    path,
    ...(workspaceGids.length > 0
      ? { workspaceGid: workspaceGids[0], workspaceGids }
      : {}),
    ...(workspaceLookupPath ? { workspaceLookupPath } : {}),
    ...(body !== undefined ? { body } : {}),
  };
}

async function executeGenerated(
  entry: ApiCommand,
  positional: unknown[],
  command: Command,
): Promise<void> {
  const options = command.optsWithGlobals() as GeneratedOptions;
  const config = await readConfig(options.config);
  const token = resolveToken({
    env: process.env,
    configToken: config.token,
    flagToken: options.token,
  });
  if (!token) throw new CliError('AUTH', 'no Personal Access Token configured');

  if (options.bodyJson === '-') {
    options.bodyJson = await readStdin();
  } else if (
    typeof options.bodyJson === 'string' &&
    options.bodyJson.startsWith('@')
  ) {
    const bodyPath = options.bodyJson.slice(1);
    await assertSafeLocalFile(bodyPath, {
      protectedPaths: [options.config, defaultWorkspaceCachePath()],
      allowOutsideCwd: options.allowOutsideCwd,
    });
    options.bodyJson = await readFile(bodyPath, 'utf8');
  }
  const workspaces = (config.workspaces ?? []).map((workspace) => ({
    gid: workspace.gid,
    readOnly: workspace.readOnly,
  }));
  let request: RequestSpec;
  try {
    request = buildRequest(entry, positional, options);
  } catch (error) {
    if (
      entry.method === 'POST' &&
      entry.path === '/batch' &&
      workspaces.some((workspace) => workspace.readOnly)
    ) {
      throw new CliError(
        'READONLY_UNRESOLVED',
        'batch body could not be parsed while read-only protection is active',
      );
    }
    throw error;
  }
  const client = new AsanaClient({
    token,
    workspaces,
    webhookTargetAllowlist: config.webhookTargetAllowlist,
    allowUnlistedWebhookTarget: options.allowUnlistedWebhookTarget,
  });
  if (options.dryRun) {
    client.assertAllowed(request);
    const rendered = JSON.stringify({
      method: request.method,
      url: `https://app.asana.com/api/1.0${request.path}`,
      headers: {
        Authorization: 'Bearer ***',
        ...(request.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(request.body !== undefined ? { body: request.body } : {}),
    });
    process.stdout.write(
      `${redactSecrets(rendered, [
        process.env.ASANA_PAT ?? '',
        config.token ?? '',
        options.token ?? '',
      ])}\n`,
    );
    return;
  }
  const response = (await client.request(request)) as {
    data: unknown;
    next_page?: unknown;
  };
  process.stdout.write(
    `${renderOutput({ data: response.data, next_page: response.next_page ?? null }, options.output)}\n`,
  );
}

function registerOperation(resource: Command, entry: ApiCommand): void {
  let operation = resource
    .command(entry.operation)
    .description(entry.summary ?? `${entry.method} ${entry.path}`);
  const pathParameters = entry.parameters.filter(
    (parameter) => parameter.in === 'path',
  );
  for (const parameter of entry.parameters) {
    if (parameter.in === 'path') {
      operation = operation.argument(`<${parameter.name}>`);
    } else if (parameter.flag) {
      const suffix = parameter.required
        ? ` <${parameter.name}>`
        : ` [${parameter.name}]`;
      const flags = `${parameter.flag}${
        parameter.repeatable ? ` <${parameter.name}...>` : suffix
      }`;
      operation =
        parameter.required && parameter.in !== 'body'
          ? operation.requiredOption(flags)
          : operation.option(flags);
    }
  }
  operation.action(async (...args: unknown[]) => {
    const command = args.at(-1) as Command;
    await executeGenerated(
      entry,
      args.slice(0, pathParameters.length),
      command,
    );
  });
}

export function registerGeneratedCommands(
  program: Command,
  manifest: CommandManifest,
): void {
  const resources = new Map<string, Command>();
  for (const entry of manifest.commands) {
    let resource = resources.get(entry.resource);
    if (!resource) {
      resource = program
        .command(entry.resource)
        .description(`${entry.resource} API commands`);
      resources.set(entry.resource, resource);
    }
    registerOperation(resource, entry);
  }
}
