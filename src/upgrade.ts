import { realpathSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { CliError } from './errors.js';

export type InstallChannel = 'npm-global' | 'source' | 'unknown';

export interface DetectChannelOptions {
  env: Record<string, string | undefined>;
  realPath: string;
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

const REPO_PACKAGE_NAME = '@agentic-asana/asn';

export function detectInstallChannel(
  options: DetectChannelOptions,
): InstallChannel {
  const override = options.env.ASN_INSTALL_CHANNEL;
  if (override === 'npm-global' || override === 'source') return override;
  if (override) return 'unknown';

  if (/\/node_modules\/@agentic-asana\/asn\//.test(options.realPath)) {
    return 'npm-global';
  }

  const fileExists = options.fileExists;
  const readFile = options.readFile;
  if (fileExists && readFile) {
    const srcIndex = options.realPath.indexOf('/src/');
    if (srcIndex >= 0) {
      const repoRoot = options.realPath.slice(0, srcIndex);
      const packageJsonPath = `${repoRoot}/package.json`;
      const srcDirPath = `${repoRoot}/src`;
      if (fileExists(packageJsonPath) && fileExists(srcDirPath)) {
        try {
          const parsed = JSON.parse(readFile(packageJsonPath)) as {
            name?: string;
          };
          if (parsed.name === REPO_PACKAGE_NAME) return 'source';
        } catch {
          // fall through to unknown
        }
      }
    }
  }

  return 'unknown';
}

export interface LatestRelease {
  version: string;
}

const RELEASES_LATEST_URL =
  'https://api.github.com/repos/leighton-tidwell/agentic-asana-cli/releases/latest';

export async function fetchLatestRelease(
  fetchFn: typeof globalThis.fetch,
): Promise<LatestRelease> {
  let response: Response;
  try {
    response = await fetchFn(RELEASES_LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch (error) {
    throw new CliError('NETWORK', 'could not reach the release registry', {
      cause: error instanceof Error ? error.name : 'unknown',
    });
  }
  if (!response.ok) {
    throw new CliError(
      'SERVER',
      `release registry returned HTTP ${response.status}`,
    );
  }
  const payload = (await response.json()) as { tag_name?: string };
  if (!payload.tag_name) {
    throw new CliError(
      'NOT_FOUND',
      'the release registry has no published versions',
    );
  }
  return { version: payload.tag_name.replace(/^v/, '') };
}

export interface UpgradeFlags {
  check?: boolean;
  version?: string;
  yes?: boolean;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface UpgradeContext {
  env: Record<string, string | undefined>;
  currentVersion: string;
  realPath: string;
  fetchLatest: () => Promise<LatestRelease>;
  runner: (command: string, args: string[]) => Promise<RunResult>;
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

export interface UpgradeOutcome {
  exitCode: number;
  mutated: boolean;
  message: string;
}

const CHANNEL_GUIDANCE: Record<Exclude<InstallChannel, 'npm-global'>, string> = {
  source:
    'this is a source checkout; run `git pull` and `npm install` to update',
  unknown:
    'install channel could not be determined; reinstall with `npm install -g <release-tarball-url>` from the latest GitHub release',
};

export async function runUpgrade(
  flags: UpgradeFlags,
  context: UpgradeContext,
): Promise<UpgradeOutcome> {
  const latest = await context.fetchLatest();
  const targetVersion = flags.version ?? latest.version;

  if (!flags.version && targetVersion === context.currentVersion) {
    return {
      exitCode: 0,
      mutated: false,
      message: `already at the latest version (${context.currentVersion})`,
    };
  }

  if (flags.check) {
    return {
      exitCode: 0,
      mutated: false,
      message: `current version: ${context.currentVersion}; latest version: ${latest.version}`,
    };
  }

  const channel = detectInstallChannel({
    env: context.env,
    realPath: context.realPath,
    fileExists: context.fileExists,
    readFile: context.readFile,
  });

  if (channel !== 'npm-global') {
    throw new CliError(
      'USAGE',
      `cannot self-update on this install channel (${channel}): ${CHANNEL_GUIDANCE[channel]}`,
    );
  }

  if (!flags.yes) {
    return {
      exitCode: 0,
      mutated: false,
      message: `upgrade available: ${context.currentVersion} -> ${targetVersion}; re-run with --yes to install`,
    };
  }

  const tarballUrl = `https://github.com/leighton-tidwell/agentic-asana-cli/releases/download/v${targetVersion}/agentic-asana-asn.tgz`;
  const result = await context.runner('npm', [
    'install',
    '-g',
    tarballUrl,
  ]);

  if (result.code !== 0) {
    if (/EACCES|permission denied/i.test(result.stderr)) {
      throw new CliError(
        'FORBIDDEN',
        'permission denied writing to the install directory; re-run with sudo, or install for your user with `npm config set prefix ~/.npm-global`',
      );
    }
    throw new CliError(
      'INTERNAL',
      `upgrade command failed: ${result.stderr || result.stdout}`,
    );
  }

  return {
    exitCode: 0,
    mutated: true,
    message: `upgraded ${context.currentVersion} -> ${targetVersion}`,
  };
}

export function realExecutablePath(argv1: string | undefined): string {
  if (!argv1) return '';
  try {
    return realpathSync(argv1);
  } catch {
    return argv1;
  }
}

export async function readFileText(path: string): Promise<string> {
  return readFileAsync(path, 'utf8');
}
