import { readFileSync } from 'node:fs';

export interface CommandParameter {
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  name: string;
  flag?: string;
  required: boolean;
  type: string;
  repeatable?: boolean;
  enum?: unknown[];
}

export interface ApiCommand {
  command: [string, string];
  operationId: string;
  resource: string;
  operation: string;
  method: string;
  mutates: boolean;
  path: string;
  summary?: string;
  parameters: CommandParameter[];
  requestBody?: {
    required: boolean;
    contentTypes: string[];
    schemas: Record<string, unknown>;
  };
  paginated: boolean;
}

export interface CommandManifest {
  schemaVersion: number;
  openapi: string;
  operations: number;
  commands: ApiCommand[];
}

export function loadManifest(): CommandManifest {
  return JSON.parse(
    readFileSync(new URL('../gen/manifest.json', import.meta.url), 'utf8'),
  ) as CommandManifest;
}
