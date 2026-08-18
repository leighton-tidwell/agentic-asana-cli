#!/usr/bin/env node
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
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
import { listWorkspaces } from './workspaces.js';

export function createProgram(): Command {
  const program = new Command()
    .name('asn')
    .description('Agent-first Asana CLI')
    .version('0.1.0')
    .option('--token <pat>', 'PAT fallback (prefer ASANA_PAT)')
    .option('--config <path>', 'config file path', defaultConfigPath())
    .option('--output <format>', 'json, jsonl, or table', 'json')
    .option('--dry-run', 'print the redacted request without sending')
    .option('--opt-fields <fields>', 'comma-separated optional fields')
    .option('--verbose', 'write redacted request diagnostics to stderr');

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
    .action(
      async (commandOptions: {
        refresh?: boolean;
        limit?: number;
        all?: boolean;
      }) => {
        const options = program.opts<{
          token?: string;
          config: string;
          output: OutputFormat;
          dryRun?: boolean;
          optFields?: string;
        }>();
        const config = await readConfig(options.config);
        const token = resolveToken({
          env: process.env,
          configToken: config.token,
          flagToken: options.token,
        });
        if (!token)
          throw new CliError('AUTH', 'no Personal Access Token configured');
        const query = options.optFields
          ? `?opt_fields=${encodeURIComponent(options.optFields)}`
          : '';
        if (options.dryRun) {
          process.stdout.write(
            `${JSON.stringify({ method: 'GET', url: `https://app.asana.com/api/1.0/workspaces${query}`, headers: { Authorization: 'Bearer ***' } })}\n`,
          );
          return;
        }
        const configured = (config.workspaces ?? []).map((item) => ({
          ...item,
          readOnly: item.readOnly ?? false,
        }));
        const client = new AsanaClient({ token, workspaces: configured });
        const cacheBase =
          process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
        const data = await listWorkspaces({
          configured,
          cachePath: join(cacheBase, 'asn', 'workspaces.json'),
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
    const tokenIndex = argv.indexOf('--token');
    const secrets = [
      process.env.ASANA_PAT ?? '',
      tokenIndex >= 0 ? (argv[tokenIndex + 1] ?? '') : '',
    ];
    const rendered = redactSecrets(
      JSON.stringify(errorEnvelope(cliError)),
      secrets,
    );
    process.stderr.write(`${rendered}\n`);
    return cliError.exitCode;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await run();
}
