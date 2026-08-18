import { CliError } from './errors.js';

export interface WorkspacePolicy {
  gid: string;
  readOnly: boolean;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BATCH_METHODS = new Set(['GET', ...MUTATING_METHODS]);

export function enforceReadOnly(
  method: string,
  workspaceGids: string | string[] | undefined,
  workspaces: WorkspacePolicy[],
  request?: { path: string; body?: unknown },
): void {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return;
  const readonly = workspaces.filter((workspace) => workspace.readOnly);
  if (readonly.length === 0) return;
  if (request?.path.split('?')[0] === '/batch') {
    const actions = (
      request.body as {
        data?: {
          actions?: Array<{
            method?: string;
            relative_path?: string;
            data?: {
              workspace?: unknown;
              resource?: unknown;
              actions?: unknown;
            };
          }>;
        };
      }
    )?.data?.actions;
    if (!Array.isArray(actions)) {
      throw new CliError(
        'READONLY_UNRESOLVED',
        'batch actions could not be resolved while read-only protection is active',
      );
    }
    for (const action of actions) {
      if (
        !action ||
        typeof action.method !== 'string' ||
        !BATCH_METHODS.has(action.method.toUpperCase()) ||
        typeof action.relative_path !== 'string' ||
        !action.relative_path.startsWith('/') ||
        (action.data !== undefined &&
          (typeof action.data !== 'object' || action.data === null))
      ) {
        throw new CliError(
          'READONLY_UNRESOLVED',
          'batch action could not be resolved while read-only protection is active',
        );
      }
      const actionPath = action.relative_path.split('?')[0];
      const actionWorkspace =
        actionPath === '/webhooks'
          ? workspaces.find(
              (workspace) => workspace.gid === String(action.data?.resource),
            )?.gid
          : action.data?.workspace === undefined
            ? undefined
            : String(action.data.workspace);
      enforceReadOnly(action.method, actionWorkspace, workspaces, {
        path: action.relative_path,
        body: { data: action.data },
      });
    }
    return;
  }
  const targets = workspaceGids
    ? Array.isArray(workspaceGids)
      ? workspaceGids
      : [workspaceGids]
    : [];
  if (targets.length === 0) {
    throw new CliError(
      'READONLY_UNRESOLVED',
      'target workspace could not be resolved while read-only protection is active',
    );
  }
  const blocked = targets.find((gid) =>
    readonly.some((workspace) => workspace.gid === gid),
  );
  if (blocked) {
    throw new CliError(
      'READONLY_BLOCKED',
      `workspace ${blocked} is read-only; ${method.toUpperCase()} blocked before send`,
    );
  }
}
