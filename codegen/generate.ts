#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI YAML is validated dynamically. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

type JsonObject = Record<string, any>;

export interface ManifestParameter {
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  name: string;
  flag?: string;
  required: boolean;
  type: string;
  description?: string;
  enum?: unknown[];
  repeatable?: boolean;
}

export interface ManifestCommand {
  command: [string, string];
  operationId: string;
  resource: string;
  operation: string;
  method: string;
  mutates: boolean;
  path: string;
  summary?: string;
  description?: string;
  parameters: ManifestParameter[];
  requestBody?: {
    required: boolean;
    contentTypes: string[];
    schemas: Record<string, unknown>;
  };
  paginated: boolean;
  docsUrl?: string;
}

export interface CommandManifest {
  schemaVersion: 1;
  openapi: string;
  title?: string;
  version?: string;
  operations: number;
  commands: ManifestCommand[];
}

function kebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function resolveRef(root: JsonObject, value: any): any {
  if (!value?.$ref || typeof value.$ref !== 'string') return value;
  if (!value.$ref.startsWith('#/')) {
    throw new Error(`unsupported external reference: ${value.$ref}`);
  }
  return value.$ref
    .slice(2)
    .split('/')
    .map((part: string) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((current: any, part: string) => current?.[part], root);
}

function schemaType(schema: JsonObject | undefined): string {
  if (!schema) return 'string';
  if (schema.type) return String(schema.type);
  if (schema.enum) return 'string';
  if (schema.oneOf || schema.anyOf) return 'union';
  return 'object';
}

function parameterFrom(root: JsonObject, input: any): ManifestParameter {
  const parameter = resolveRef(root, input);
  if (!parameter?.name || !parameter?.in) {
    throw new Error('OpenAPI parameter is missing name or location');
  }
  const schema = resolveRef(root, parameter.schema);
  const location = parameter.in as ManifestParameter['in'];
  return {
    in: location,
    name: String(parameter.name),
    ...(location !== 'path'
      ? { flag: `--${kebab(String(parameter.name))}` }
      : {}),
    required: location === 'path' || parameter.required === true,
    type: schemaType(schema),
    ...(Array.isArray(schema?.enum) ? { enum: schema.enum } : {}),
    ...(schema?.type === 'array' ? { repeatable: true } : {}),
  };
}

function sortParameters(
  path: string,
  parameters: ManifestParameter[],
): ManifestParameter[] {
  const positions = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  return [...parameters].sort((left, right) => {
    if (left.in === 'path' && right.in === 'path') {
      return positions.indexOf(left.name) - positions.indexOf(right.name);
    }
    if (left.in === 'path') return -1;
    if (right.in === 'path') return 1;
    return left.name.localeCompare(right.name);
  });
}

export function generateManifest(specText: string): CommandManifest {
  const document = parse(specText) as JsonObject;
  if (!document?.paths || typeof document.paths !== 'object') {
    throw new Error('OpenAPI document has no paths object');
  }

  const commands: ManifestCommand[] = [];
  for (const [path, pathItemInput] of Object.entries(
    document.paths as JsonObject,
  )) {
    const pathItem = resolveRef(document, pathItemInput);
    const sharedParameters = Array.isArray(pathItem?.parameters)
      ? pathItem.parameters
      : [];
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      if (!operation.operationId) {
        throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
      }
      const operationId = String(operation.operationId);
      const resource = kebab(String(operation.tags?.[0] ?? 'other'));
      const operationName = kebab(operationId);
      const rawParameters = [
        ...sharedParameters,
        ...(operation.parameters ?? []),
      ];
      const deduplicated = new Map<string, ManifestParameter>();
      for (const rawParameter of rawParameters) {
        const parameter = parameterFrom(document, rawParameter);
        deduplicated.set(`${parameter.in}:${parameter.name}`, parameter);
      }

      let requestBody: ManifestCommand['requestBody'];
      if (operation.requestBody) {
        const body = resolveRef(document, operation.requestBody);
        const content = body?.content ?? {};
        requestBody = {
          required: body?.required === true,
          contentTypes: Object.keys(content).sort(),
          schemas: Object.fromEntries(
            Object.entries(content).map(
              ([contentType, media]: [string, any]) => [
                contentType,
                media?.schema ?? {},
              ],
            ),
          ),
        };
        deduplicated.set('body:field', {
          in: 'body',
          name: 'field',
          flag: '--field',
          required: false,
          type: 'key=value',
          repeatable: true,
          description: 'Set one request body field; may be repeated',
        });
        deduplicated.set('body:body-json', {
          in: 'body',
          name: 'body-json',
          flag: '--body-json',
          required: body?.required === true,
          type: 'json|@file|-',
          description:
            'Complete JSON request body, inline, from @file, or stdin',
        });
      }

      const parameters = sortParameters(path, [...deduplicated.values()]);
      commands.push({
        command: [resource, operationName],
        operationId,
        resource,
        operation: operationName,
        method: method.toUpperCase(),
        mutates: !['get', 'head', 'options'].includes(method),
        path,
        ...(operation.summary ? { summary: String(operation.summary) } : {}),
        ...(operation.description
          ? { description: String(operation.description) }
          : {}),
        parameters,
        ...(requestBody ? { requestBody } : {}),
        paginated: parameters.some(
          (parameter) =>
            parameter.in === 'query' && parameter.name === 'offset',
        ),
        ...(operation.externalDocs?.url
          ? { docsUrl: String(operation.externalDocs.url) }
          : {}),
      });
    }
  }

  commands.sort((left, right) =>
    left.command.join(' ').localeCompare(right.command.join(' ')),
  );
  const operationIds = new Set<string>();
  const commandNames = new Set<string>();
  for (const command of commands) {
    if (operationIds.has(command.operationId)) {
      throw new Error(`duplicate operationId: ${command.operationId}`);
    }
    operationIds.add(command.operationId);
    const commandName = command.command.join(' ');
    if (commandNames.has(commandName))
      throw new Error(`duplicate command: ${commandName}`);
    commandNames.add(commandName);
  }

  return {
    schemaVersion: 1,
    openapi: String(document.openapi ?? ''),
    ...(document.info?.title ? { title: String(document.info.title) } : {}),
    ...(document.info?.version
      ? { version: String(document.info.version) }
      : {}),
    operations: commands.length,
    commands,
  };
}

export async function generateFile(
  input: string,
  output: string,
): Promise<CommandManifest> {
  const manifest = generateManifest(await readFile(input, 'utf8'));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && thisFile === resolve(process.argv[1])) {
  const root = resolve(dirname(thisFile), '..');
  const manifest = await generateFile(
    resolve(root, process.argv[2] ?? 'spec/asana_oas.yaml'),
    resolve(root, process.argv[3] ?? 'gen/manifest.json'),
  );
  process.stdout.write(
    `Generated ${manifest.operations} Asana API commands.\n`,
  );
}
