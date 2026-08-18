import { constants, createReadStream } from 'node:fs';
import { lstat, mkdir, open, realpath, rm } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Command } from 'commander';
import { readConfig, redactSecrets, resolveToken } from './config.js';
import { CliError } from './errors.js';
import { assertSafeLocalFile } from './file-access.js';
import { renderOutput, type OutputFormat } from './output.js';
import { AsanaClient, type RequestSpec } from './transport.js';
import { defaultWorkspaceCachePath } from './workspaces.js';

interface AttachmentClient {
  request(spec: RequestSpec): Promise<unknown>;
}

export interface UploadAttachmentOptions {
  client: AttachmentClient;
  parent: string;
  file: string;
  name?: string;
  workspaceGid?: string;
  stdin?: Readable;
  protectedPaths?: string[];
  allowOutsideCwd?: boolean;
}

function safeHeaderValue(value: string): string {
  return value.replace(/[\r\n"]/g, '_');
}

function part(boundary: string, name: string, value: string): Buffer {
  return Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
}

export async function uploadAttachment(
  options: UploadAttachmentOptions,
): Promise<unknown> {
  const boundary = `asn-${randomUUID()}`;
  if (options.file !== '-') {
    await assertSafeLocalFile(options.file, {
      protectedPaths: options.protectedPaths,
      allowOutsideCwd: options.allowOutsideCwd,
    });
  }
  const filename = safeHeaderValue(
    options.file === '-' ? (options.name ?? 'stdin') : basename(options.file),
  );
  const source =
    options.file === '-'
      ? (options.stdin ?? process.stdin)
      : createReadStream(options.file);

  async function* encode(): AsyncGenerator<Buffer> {
    yield part(boundary, 'parent', options.parent);
    if (options.name) yield part(boundary, 'name', options.name);
    yield Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    );
    for await (const chunk of source) yield Buffer.from(chunk);
    yield Buffer.from(`\r\n--${boundary}--\r\n`);
  }

  return options.client.request({
    method: 'POST',
    path: '/attachments',
    ...(options.workspaceGid
      ? {
          workspaceGid: options.workspaceGid,
          workspaceGids: [options.workspaceGid],
        }
      : {}),
    workspaceLookupPath: `/tasks/${encodeURIComponent(options.parent)}`,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Readable.from(encode()),
  });
}

export function attachmentDeleteRequest(
  gid: string,
  assertedWorkspace?: string,
): RequestSpec {
  return {
    method: 'DELETE',
    path: `/attachments/${encodeURIComponent(gid)}`,
    ...(assertedWorkspace ? { workspaceGids: [assertedWorkspace] } : {}),
    workspaceLookupPath: `/attachments/${encodeURIComponent(gid)}`,
  };
}

export interface DownloadAttachmentOptions {
  client: AttachmentClient;
  gid: string;
  out: string;
  destDir?: string;
  force?: boolean;
  maxBytes?: number;
  fetch?: typeof globalThis.fetch;
  lookup?: (
    hostname: string,
  ) => Promise<Array<{ address: string; family: number }>>;
}

const nonPublicAddresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  nonPublicAddresses.addSubnet(network, prefix, 'ipv4');
}
nonPublicAddresses.addAddress('::', 'ipv6');
nonPublicAddresses.addAddress('::1', 'ipv6');
nonPublicAddresses.addSubnet('fc00::', 7, 'ipv6');
nonPublicAddresses.addSubnet('fe80::', 10, 'ipv6');

function isNonPublicAddress(address: string): boolean {
  const family = isIP(address);
  return (
    (family === 4 && nonPublicAddresses.check(address, 'ipv4')) ||
    (family === 6 && nonPublicAddresses.check(address, 'ipv6'))
  );
}

async function validateDownloadUrl(
  url: URL,
  lookup: NonNullable<DownloadAttachmentOptions['lookup']>,
): Promise<void> {
  if (url.protocol !== 'https:') {
    throw new Error('attachment download URL must use HTTPS');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname);
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isNonPublicAddress(address))
  ) {
    throw new Error(
      'attachment download URL resolves to a private or reserved address',
    );
  }
}

async function resolveDestination(
  out: string,
  destDir = process.cwd(),
): Promise<string> {
  const requestedRoot = resolve(destDir);
  await mkdir(requestedRoot, { recursive: true });
  const destination = resolve(requestedRoot, out);
  const rootRelative = relative(requestedRoot, destination);
  if (
    rootRelative === '..' ||
    rootRelative.startsWith(`..${sep}`) ||
    isAbsolute(rootRelative)
  ) {
    throw new Error('attachment output is outside destination directory');
  }

  await mkdir(dirname(destination), { recursive: true });
  const root = await realpath(requestedRoot);
  const canonicalParent = await realpath(dirname(destination));
  const canonicalRelative = relative(root, canonicalParent);
  if (
    canonicalRelative === '..' ||
    canonicalRelative.startsWith(`..${sep}`) ||
    isAbsolute(canonicalRelative)
  ) {
    throw new Error('attachment output is outside destination directory');
  }
  return resolve(canonicalParent, basename(destination));
}

export async function downloadAttachment(
  options: DownloadAttachmentOptions,
): Promise<{ gid: string; name: string; path: string; bytes: number }> {
  const destination = await resolveDestination(options.out, options.destDir);
  try {
    const existing = await lstat(destination);
    if (existing.isSymbolicLink()) {
      throw new Error('attachment output must not be a symbolic link');
    }
    if (!options.force) {
      throw new Error(
        'attachment output already exists; use --force to replace it',
      );
    }
  } catch (error) {
    if (!(
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    )) {
      throw error;
    }
  }
  const metadata = (await options.client.request({
    method: 'GET',
    path: `/attachments/${encodeURIComponent(options.gid)}`,
  })) as {
    data: { gid: string; name: string; download_url?: string };
  };
  if (!metadata.data.download_url) {
    throw new Error(`attachment ${options.gid} has no download_url`);
  }
  const lookup =
    options.lookup ?? ((hostname) => dnsLookup(hostname, { all: true }));
  const fetch = options.fetch ?? globalThis.fetch;
  let downloadUrl = new URL(metadata.data.download_url);
  let response: Response | undefined;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await validateDownloadUrl(downloadUrl, lookup);
    response = await fetch(downloadUrl, { redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    if (redirects === 5) {
      throw new Error('attachment download exceeded 5 redirects');
    }
    const location = response.headers.get('location');
    if (!location) {
      throw new Error('attachment download redirect has no location');
    }
    downloadUrl = new URL(location, downloadUrl);
  }
  if (!response?.ok || !response.body) {
    throw new Error(
      `attachment download returned HTTP ${response?.status ?? 'unknown'}`,
    );
  }

  const maxBytes = options.maxBytes ?? 100 * 1024 * 1024;
  let bytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        callback(
          new Error(
            `attachment download exceeds maximum size of ${maxBytes} bytes`,
          ),
        );
        return;
      }
      callback(null, chunk);
    },
  });
  const flags = options.force
    ? constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_TRUNC |
      constants.O_NOFOLLOW
    : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL;
  const output = await open(destination, flags, 0o600);
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import('node:stream/web').ReadableStream,
      ),
      counter,
      output.createWriteStream(),
    );
  } catch (error) {
    await output.close().catch(() => undefined);
    await rm(destination, { force: true });
    throw error;
  }
  return {
    gid: metadata.data.gid,
    name: metadata.data.name,
    path: destination,
    bytes,
  };
}

interface AttachmentCliOptions {
  token?: string;
  config: string;
  output: OutputFormat;
  guardWorkspace?: string;
  dryRun?: boolean;
  allowOutsideCwd?: boolean;
}

async function attachmentClient(command: Command): Promise<{
  client: AsanaClient;
  options: AttachmentCliOptions;
  secrets: string[];
}> {
  const options = command.optsWithGlobals() as AttachmentCliOptions;
  const config = await readConfig(options.config);
  const token = resolveToken({
    env: process.env,
    configToken: config.token,
    flagToken: options.token,
  });
  if (!token) throw new CliError('AUTH', 'no Personal Access Token configured');
  return {
    options,
    secrets: [
      process.env.ASANA_PAT ?? '',
      config.token ?? '',
      options.token ?? '',
    ],
    client: new AsanaClient({
      token,
      workspaces: (config.workspaces ?? []).map((workspace) => ({
        gid: workspace.gid,
        readOnly: workspace.readOnly,
      })),
    }),
  };
}

function writeResult(value: unknown, output: OutputFormat): void {
  const response = value as { data?: unknown; next_page?: unknown };
  process.stdout.write(
    `${renderOutput(
      response && Object.hasOwn(response, 'data')
        ? { data: response.data, next_page: response.next_page ?? null }
        : { data: response, next_page: null },
      output,
    )}\n`,
  );
}

export function registerAttachmentCommands(program: Command): void {
  const attachments =
    program.commands.find((command) => command.name() === 'attachments') ??
    program.command('attachments').description('Attachment commands');

  attachments
    .command('create')
    .description('Stream a multipart attachment upload')
    .requiredOption('--parent <gid>', 'parent task or object gid')
    .requiredOption('--file <path>', 'file path, or - for stdin')
    .option('--name <name>', 'attachment name')
    .action(
      async (
        local: { parent: string; file: string; name?: string },
        command: Command,
      ) => {
        const { client, options, secrets } = await attachmentClient(command);
        if (options.dryRun) {
          client.assertAllowed({
            method: 'POST',
            path: '/attachments',
            ...(options.guardWorkspace
              ? { workspaceGids: [options.guardWorkspace] }
              : {}),
            workspaceLookupPath: `/tasks/${encodeURIComponent(local.parent)}`,
          });
          const rendered = JSON.stringify({
            method: 'POST',
            url: 'https://app.asana.com/api/1.0/attachments',
            headers: {
              Authorization: 'Bearer ***',
              'Content-Type': 'multipart/form-data',
            },
            body: {
              parent: local.parent,
              file: local.file,
              ...(local.name ? { name: local.name } : {}),
            },
          });
          process.stdout.write(`${redactSecrets(rendered, secrets)}\n`);
          return;
        }
        writeResult(
          await uploadAttachment({
            client,
            parent: local.parent,
            file: local.file,
            name: local.name,
            workspaceGid: options.guardWorkspace,
            protectedPaths: [options.config, defaultWorkspaceCachePath()],
            allowOutsideCwd: options.allowOutsideCwd,
          }),
          options.output,
        );
      },
    );

  attachments
    .command('download')
    .description('Stream an attachment from its signed download URL')
    .argument('<gid>')
    .option('--out <path>', 'destination path')
    .option('--dest-dir <path>', 'confine output beneath this directory')
    .option('--force', 'replace an existing regular file')
    .option(
      '--max-bytes <bytes>',
      'maximum download size',
      (value) => {
        const bytes = Number(value);
        if (!Number.isSafeInteger(bytes) || bytes <= 0) {
          throw new CliError('USAGE', '--max-bytes must be a positive integer');
        }
        return bytes;
      },
      100 * 1024 * 1024,
    )
    .action(
      async (
        gid: string,
        local: {
          out?: string;
          destDir?: string;
          force?: boolean;
          maxBytes: number;
        },
        command: Command,
      ) => {
        const { client, options } = await attachmentClient(command);
        writeResult(
          await downloadAttachment({
            client,
            gid,
            out: local.out ?? `${gid}.download`,
            destDir: local.destDir,
            force: local.force,
            maxBytes: local.maxBytes,
          }),
          options.output,
        );
      },
    );

  attachments
    .command('delete')
    .description('Delete an attachment')
    .argument('<gid>')
    .action(async (gid: string, _local: unknown, command: Command) => {
      const { client, options } = await attachmentClient(command);
      const request = attachmentDeleteRequest(gid, options.guardWorkspace);
      if (options.dryRun) {
        client.assertAllowed(request);
        process.stdout.write(
          `${JSON.stringify({ method: 'DELETE', url: `https://app.asana.com/api/1.0${request.path}`, headers: { Authorization: 'Bearer ***' } })}\n`,
        );
        return;
      }
      writeResult(await client.request(request), options.output);
    });
}
