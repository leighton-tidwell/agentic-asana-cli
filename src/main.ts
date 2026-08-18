#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import {
  defaultConfigPath,
  readConfig,
  redactSecrets,
  resolveToken,
  storeToken,
} from './config.js';
import { AsanaClient } from './transport.js';
import { CliError, errorEnvelope } from './errors.js';
import { renderOutput, type OutputFormat } from './output.js';
import { defaultWorkspaceCachePath, listWorkspaces } from './workspaces.js';
import { registerGeneratedCommands } from './dispatch.js';
import { loadManifest } from './manifest.js';
import { registerAttachmentCommands } from './attachments.js';

export function createProgram(): Command {
  const program = new Command()
    .name('asn')
    .description('Agent-first Asana CLI')
    .version('0.1.2')
    .option('--token <pat>', 'PAT fallback (prefer ASANA_PAT)')
    .option('--config <path>', 'config file path', defaultConfigPath())
    .option('--output <format>', 'json, jsonl, or table', 'json')
    .option('--dry-run', 'print the redacted request without sending')
    .option(
      '--guard-workspace <gid>',
      'workspace gid assertion used only for read-only guard resolution',
    )
    .option(
      '--allow-outside-cwd',
      'allow reading non-sensitive files outside the working directory',
    )
    .option(
      '--allow-unlisted-webhook-target',
      'explicitly allow a webhook target outside webhookTargetAllowlist',
    )
    .option('--json-help', 'emit the machine-readable command catalog')
    .action(() => {
      if (program.opts<{ jsonHelp?: boolean }>().jsonHelp) {
        process.stdout.write(`${JSON.stringify(loadManifest())}\n`);
      } else {
        program.outputHelp();
      }
    });

  program
    .command('schema')
    .description('Emit the machine-readable command catalog')
    .action(() => {
      process.stdout.write(`${JSON.stringify(loadManifest())}\n`);
    });

  const auth = program.command('auth').description('Manage authentication');
  auth
    .command('login')
    .description('Store a Personal Access Token')
    .action(async () => {
      const options = program.opts<{ token?: string; config: string }>();
      if (!options.token) throw new CliError('USAGE', '--token is required');
      await storeToken(options.config, options.token);
      process.stdout.write(
        `${JSON.stringify({ data: { stored: true }, next_page: null })}\n`,
      );
    });

  const workspace = program
    .command('workspace')
    .description('Manage workspaces');
  workspace
    .command('list')
    .description('List configured or auto-discovered workspaces')
    .option('--refresh', 'ignore the workspace cache')
    .option('--limit <count>', 'maximum workspaces', (value) => Number(value))
    .option('--all', 'fetch every page')
    .option('--opt-fields <fields>', 'comma-separated optional fields')
    .action(
      async (commandOptions: {
        refresh?: boolean;
        limit?: number;
        all?: boolean;
        optFields?: string;
      }) => {
        const options = program.opts<{
          token?: string;
          config: string;
          output: OutputFormat;
          dryRun?: boolean;
        }>();
        const config = await readConfig(options.config);
        const token = resolveToken({
          env: process.env,
          configToken: config.token,
          flagToken: options.token,
        });
        if (!token)
          throw new CliError('AUTH', 'no Personal Access Token configured');
        const query = commandOptions.optFields
          ? `?opt_fields=${encodeURIComponent(commandOptions.optFields)}`
          : '';
        if (options.dryRun) {
          process.stdout.write(
            `${JSON.stringify({ method: 'GET', url: `https://app.asana.com/api/1.0/workspaces${query}`, headers: { Authorization: 'Bearer ***' } })}\n`,
          );
          return;
        }
        const configured = config.workspaces ?? [];
        const client = new AsanaClient({ token, workspaces: configured });
        const data = await listWorkspaces({
          configured,
          cachePath: defaultWorkspaceCachePath(),
          client,
          refresh: commandOptions.refresh,
        });
        const limited = commandOptions.limit
          ? data.slice(0, commandOptions.limit)
          : data;
        process.stdout.write(
          `${renderOutput({ data: limited, next_page: null }, options.output)}\n`,
        );
      },
    );

  registerGeneratedCommands(program, loadManifest());
  registerAttachmentCommands(program);
  return program;
}

export async function run(argv = process.argv): Promise<number> {
  try {
    await createProgram().parseAsync(argv);
    return 0;
  } catch (error) {
    const cliError =
      error instanceof CliError
        ? error
        : new CliError(
            'INTERNAL',
            error instanceof Error ? error.message : String(error),
          );
    const optionValue = (name: string): string | undefined => {
      const separateIndex = argv.lastIndexOf(name);
      if (separateIndex >= 0) return argv[separateIndex + 1];
      const prefix = `${name}=`;
      for (let index = argv.length - 1; index >= 0; index -= 1) {
        if (argv[index]?.startsWith(prefix))
          return argv[index]?.slice(prefix.length);
      }
      return undefined;
    };
    let configToken: string | undefined;
    try {
      configToken = (
        await readConfig(optionValue('--config') ?? defaultConfigPath())
      ).token;
    } catch {
      // Preserve the original command error when the config cannot be reread.
    }
    const resolvedToken = resolveToken({
      env: process.env,
      configToken,
      flagToken: optionValue('--token'),
    });
    const equalsTokens = argv
      .filter((argument) => argument.startsWith('--token='))
      .map((argument) => argument.slice('--token='.length));
    const rendered = redactSecrets(JSON.stringify(errorEnvelope(cliError)), [
      resolvedToken ?? '',
      ...equalsTokens,
    ]);
    process.stderr.write(`${rendered}\n`);
    return cliError.exitCode;
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await run();
}
