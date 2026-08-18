import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { CliError } from './errors.js';

export interface LocalFilePolicy {
  protectedPaths?: string[];
  allowOutsideCwd?: boolean;
  cwd?: string;
  home?: string;
}

function contains(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

export async function assertSafeLocalFile(
  path: string,
  policy: LocalFilePolicy = {},
): Promise<void> {
  const candidate = await realpath(resolve(path));
  for (const protectedPath of policy.protectedPaths ?? []) {
    try {
      if (candidate === (await realpath(resolve(protectedPath)))) {
        throw new CliError('USAGE', 'refusing to read a protected local file');
      }
    } catch (error) {
      if (error instanceof CliError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  const cwd = await realpath(resolve(policy.cwd ?? process.cwd()));
  const outsideCwd = !contains(cwd, candidate);
  const home = await realpath(resolve(policy.home ?? homedir()));
  const inSensitiveHomeDirectory = ['.ssh', '.aws', '.config'].some(
    (directory) => contains(join(home, directory), candidate),
  );
  const mode = (await stat(candidate)).mode & 0o777;
  if (
    inSensitiveHomeDirectory ||
    basename(candidate).startsWith('.env') ||
    (outsideCwd && mode === 0o600)
  ) {
    throw new CliError('USAGE', 'refusing to read a sensitive local file');
  }
  if (outsideCwd && !policy.allowOutsideCwd) {
    throw new CliError(
      'USAGE',
      'refusing to read outside the working directory without --allow-outside-cwd',
    );
  }
}
