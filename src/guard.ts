import { CliError } from './errors.js';

export interface WorkspacePolicy {
  gid: string;
  readOnly: boolean;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function enforceReadOnly(
  method: string,
  workspaceGid: string | undefined,
  workspaces: WorkspacePolicy[],
): void {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return;
  const readonly = workspaces.filter((workspace) => workspace.readOnly);
  if (readonly.length === 0) return;
  if (!workspaceGid) {
    throw new CliError(
      'READONLY_UNRESOLVED',
      'target workspace could not be resolved while read-only protection is active',
    );
  }
  if (readonly.some((workspace) => workspace.gid === workspaceGid)) {
    throw new CliError(
      'READONLY_BLOCKED',
      `workspace ${workspaceGid} is read-only; ${method.toUpperCase()} blocked before send`,
    );
  }
}
