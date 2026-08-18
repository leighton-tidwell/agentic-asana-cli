import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Command } from 'commander';
import { readConfig, resolveToken } from './config.js';
import { CliError } from './errors.js';
import { renderOutput, type OutputFormat } from './output.js';
import { AsanaClient, type RequestSpec } from './transport.js';

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
    ...(options.workspaceGid ? { workspaceGid: options.workspaceGid } : {}),
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Readable.from(encode()),
  });
}

export interface DownloadAttachmentOptions {
  client: AttachmentClient;
  gid: string;
  out: string;
  fetch?: typeof globalThis.fetch;
}

export async function downloadAttachment(
  options: DownloadAttachmentOptions,
): Promise<{ gid: string; name: string; path: string; bytes: number }> {
  const metadata = (await options.client.request({
    method: 'GET',
    path: `/attachments/${encodeURIComponent(options.gid)}`,
  })) as {
    data: { gid: string; name: string; download_url?: string };
  };
  if (!metadata.data.download_url) {
    throw new Error(`attachment ${options.gid} has no download_url`);
  }
  const response = await (options.fetch ?? globalThis.fetch)(
    metadata.data.download_url,
    { redirect: 'follow' },
  );
  if (!response.ok || !response.body) {
    throw new Error(`attachment download returned HTTP ${response.status}`);
  }

  await mkdir(dirname(options.out), { recursive: true });
  let bytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
    counter,
    createWriteStream(options.out),
  );
  return {
    gid: metadata.data.gid,
    name: metadata.data.name,
    path: options.out,
    bytes,
  };
}

interface AttachmentCliOptions {
  token?: string;
  config: string;
  output: OutputFormat;
  workspace?: string;
  dryRun?: boolean;
}

async function attachmentClient(command: Command): Promise<{
  client: AsanaClient;
  options: AttachmentCliOptions;
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
    client: new AsanaClient({
      token,
      workspaces: (config.workspaces ?? []).map((workspace) => ({
        gid: workspace.gid,
        readOnly: workspace.readOnly ?? false,
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
        const { client, options } = await attachmentClient(command);
        if (options.dryRun) {
          client.assertAllowed({
            method: 'POST',
            path: '/attachments',
            workspaceGid: options.workspace,
          });
          process.stdout.write(
            `${JSON.stringify({
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
            })}\n`,
          );
          return;
        }
        writeResult(
          await uploadAttachment({
            client,
            parent: local.parent,
            file: local.file,
            name: local.name,
            workspaceGid: options.workspace,
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
    .action(async (gid: string, local: { out?: string }, command: Command) => {
      const { client, options } = await attachmentClient(command);
      writeResult(
        await downloadAttachment({
          client,
          gid,
          out: local.out ?? `${gid}.download`,
        }),
        options.output,
      );
    });

  attachments
    .command('delete')
    .description('Delete an attachment')
    .argument('<gid>')
    .action(async (gid: string, _local: unknown, command: Command) => {
      const { client, options } = await attachmentClient(command);
      const request = {
        method: 'DELETE',
        path: `/attachments/${encodeURIComponent(gid)}`,
        workspaceGid: options.workspace,
      };
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
