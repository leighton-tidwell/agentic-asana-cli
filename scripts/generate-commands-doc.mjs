import { readFileSync, writeFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('gen/manifest.json', 'utf8'));

function optionKey(parameter) {
  return (parameter.flag ?? `--${parameter.name}`)
    .slice(2)
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function firstSentence(text) {
  if (!text) return '';
  // Strip simple HTML tags used in the Asana OpenAPI descriptions.
  let stripped = text.replace(/<[^>]+>/g, '').trim();
  // The Asana OpenAPI descriptions link to Asana's own developer docs with
  // paths like /reference/getjob; those don't resolve on this site, so flatten
  // any markdown link down to its link text.
  stripped = stripped.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  return stripped.split(/\n\n/)[0].trim();
}

function exampleInvocation(entry) {
  const pathParams = entry.parameters.filter((p) => p.in === 'path');
  const parts = ['asn', entry.resource, entry.operation];
  for (const p of pathParams) parts.push(`<${p.name}>`);
  const requiredNonPath = entry.parameters.filter(
    (p) => p.in !== 'path' && p.required && p.flag,
  );
  for (const p of requiredNonPath) {
    if (p.name === 'body-json') {
      parts.push(`--field key=value`);
    } else if (p.repeatable) {
      parts.push(`${p.flag} <${p.name}...>`);
    } else {
      parts.push(`${p.flag} <${p.name}>`);
    }
  }
  return parts.join(' ');
}

function paramTable(entry) {
  const rows = entry.parameters.map((p) => {
    const flagOrArg = p.in === 'path' ? `<${p.name}>` : (p.flag ?? '');
    const required = p.required ? 'yes' : 'no';
    const type = p.repeatable ? `${p.type} (repeatable)` : p.type;
    return `| \`${flagOrArg}\` | ${p.in} | ${required} | ${type} | ${(p.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`;
  });
  if (rows.length === 0) return '_No parameters._';
  return [
    '| Flag / argument | Location | Required | Type | Description |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

const resources = [...new Set(manifest.commands.map((c) => c.resource))].sort();

const resourceLinks = resources.map((r) => `- [${r}](#${r})`).join('\n');

const sections = resources.map((resource) => {
  const commands = manifest.commands
    .filter((c) => c.resource === resource)
    .sort((a, b) => a.operation.localeCompare(b.operation));
  const commandDocs = commands
    .map((entry) => {
      const summary = entry.summary ?? `${entry.method} ${entry.path}`;
      const description = firstSentence(entry.description) || summary;
      const mutates = entry.mutates ? '**mutates data**' : 'read-only';
      const paginated = entry.paginated ? ', paginated' : '';
      return [
        `### \`asn ${entry.resource} ${entry.operation}\``,
        '',
        `${entry.method} \`${entry.path}\` — ${mutates}${paginated}`,
        '',
        description,
        '',
        paramTable(entry),
        '',
        '```bash',
        exampleInvocation(entry),
        '```',
      ].join('\n');
    })
    .join('\n\n');
  return [`## ${resource}`, '', commandDocs].join('\n');
});

const builtins = `## Built-in commands

Beyond the ${manifest.commands.length} generated commands below, \`asn\` ships a small set of
hand-written commands for concerns the OpenAPI spec doesn't model: auth, workspace discovery,
schema introspection, and streaming file transfer.

### \`asn schema\`

Emit the full machine-readable command catalog (the same JSON that drives \`asn --json-help\`) —
every resource, operation, parameter, and request-body schema.

\`\`\`bash
asn schema > asana-command-catalog.json
\`\`\`

### \`asn auth login\`

Store a Personal Access Token in the config file at \`--config\` (default
\`~/.config/asn/config.json\`), written with \`0600\` permissions. Requires \`--token\`.

\`\`\`bash
asn auth login --token "$ASANA_PAT"
\`\`\`

### \`asn workspace list\`

List configured or auto-discovered workspaces, with an on-disk cache.

| Flag | Description |
| --- | --- |
| \`--refresh\` | Ignore the workspace cache and re-fetch. |
| \`--limit <count>\` | Maximum workspaces to return. |
| \`--all\` | Fetch every page. |
| \`--opt-fields <fields>\` | Comma-separated optional fields to request. |

\`\`\`bash
asn workspace list --refresh
\`\`\`

### \`asn attachments create\` / \`download\` / \`delete\`

These streaming attachment commands are distinct from the generated
\`attachments create-attachment-for-object\` / \`get-attachment\` / \`delete-attachment\` /
\`get-attachments-for-object\` commands documented under [attachments](#attachments) below: they
stream multipart uploads and downloads directly from disk or stdin instead of taking a JSON
body, so they're the ones to reach for when moving real files.

| Command | Required flags | Notes |
| --- | --- | --- |
| \`asn attachments create\` | \`--parent <gid>\`, \`--file <path\|->\` | Streams a multipart upload; \`--file -\` reads from stdin. Optional \`--name <name>\`. |
| \`asn attachments download <gid>\` | none | Downloads via the attachment's signed URL. Optional \`--out <path>\`, \`--dest-dir <path>\`, \`--force\`, \`--max-bytes <bytes>\` (default 100MB). Refuses to overwrite an existing file without \`--force\`, and refuses symlinked destinations. |
| \`asn attachments delete <gid>\` | none | Deletes an attachment. |

\`\`\`bash
asn attachments create --parent 1234567890123456 --file ./report.pdf
asn attachments download 1234567890123456 --out report.pdf --force
asn attachments delete 1234567890123456
\`\`\`
`;

const body = `---
title: Commands
description: Reference for every asn command, its flags, and arguments, generated from the pinned Asana OpenAPI manifest.
---

# Commands

\`asn\` generates ${manifest.commands.length} invocable commands from the pinned Asana OpenAPI manifest, grouped
into ${resources.length} resources below, plus a handful of built-in commands. Every generated command follows
the shape \`asn <resource> <operation> [path-args] [--options]\`. Run \`asn schema\` at any time to get a
full machine-readable catalog (JSON) of every command, its parameters, and its request/response
shapes — this page is the human-readable rendering of that same catalog.

## Common flags

These global flags (declared on the root \`asn\` program) apply to every command below and are
omitted from the per-command tables:

| Flag | Description |
| --- | --- |
| \`--token <pat>\` | PAT fallback; prefer the \`ASANA_PAT\` environment variable. |
| \`--config <path>\` | Config file path (default: \`~/.config/asn/config.json\`). |
| \`--output <format>\` | \`json\` (default), \`jsonl\`, or \`table\`. |
| \`--dry-run\` | Print the redacted request that would be sent, without sending it. |
| \`--guard-workspace <gid>\` | Workspace gid assertion used only for read-only guard resolution; not sent as an API parameter. |
| \`--allow-outside-cwd\` | Allow reading non-sensitive local files (e.g. \`--body-json @file.json\`) outside the working directory. |
| \`--allow-unlisted-webhook-target\` | Explicitly allow a webhook target URL outside \`webhookTargetAllowlist\`. |

See [Configuration](/configuration/) for how these flags interact with the config file and
environment variables, and [Usage](/usage/) for everyday examples.

## Body input for mutating commands

Every mutating command (\`mutates: true\` below) accepts a JSON request body two ways:

- Repeatable \`--field key=value\` — builds \`{ "data": { key: value, ... } }\`. Values are
  JSON-parsed except an all-digit token, which always stays a string (Asana rejects numeric
  GIDs). A comma-separated value with no other valid JSON interpretation becomes an array of
  individually GID-safe-coerced elements, e.g. \`--field projects=123,456\` sends
  \`"projects": ["123", "456"]\`.
- \`--body-json '<json>'\`, \`--body-json @file.json\`, or \`--body-json -\` (stdin) — supply the
  complete body verbatim for structured or precise values \`--field\` cannot express.

${builtins}
## Resources

${resourceLinks}

${sections.join('\n\n')}
`;

writeFileSync('docs/site/commands/index.md', body);
console.log('wrote', body.length, 'bytes');
