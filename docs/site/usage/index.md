---
title: Usage
description: How to install, authenticate, and run everyday asn commands.
---

# Usage

`asn` is a JSON-first Asana CLI built for coding agents: every command speaks JSON by
default, workspaces are discovered from a Personal Access Token, and mutations to
workspaces you've marked read-only are rejected before they're sent.

## Install

```bash
npm install -g https://github.com/leighton-tidwell/agentic-asana-cli/releases/latest/download/agentic-asana-asn.tgz
```

Node.js 20 or newer is required. To pin a specific release, replace `latest` with
`download/vX.Y.Z` (see the [GitHub releases page](https://github.com/leighton-tidwell/agentic-asana-cli/releases)
for available versions).

## Authenticate

Create a Personal Access Token (PAT) in Asana (My Settings → Apps → Manage Developer Apps),
then export it:

```bash
export ASANA_PAT='your-personal-access-token'
```

`ASANA_PAT` is the recommended way to supply the token: command-line flags can leak into shell
history and process listings. Token resolution follows this precedence: environment variable
(`ASANA_PAT`) > config file token > `--token` flag.

Alternatively, store the token in the config file once:

```bash
asn auth login --token 'your-personal-access-token'
```

This writes the token to `~/.config/asn/config.json` (or the path given by `--config`) with
`0600` permissions. `asn auth login` never echoes the token back to stdout/stderr.

## Discover your workspaces

```bash
asn workspace list --refresh
```

```json
{
  "data": [
    { "gid": "1234567890123456", "name": "Acme Co", "is_organization": true }
  ],
  "next_page": null
}
```

`asn workspace list` auto-discovers every workspace visible to the PAT and caches the result on
disk; pass `--refresh` to bypass the cache. See [Configuration](/configuration/) to pin specific
workspace gids or mark any of them read-only.

## Discover commands instead of guessing flags

`asn` exposes 249 commands generated directly from the pinned Asana OpenAPI spec, plus a
handful of built-in commands (auth, workspace discovery, streaming attachments). Rather than
memorizing flags, ask the CLI:

```bash
asn schema > asana-command-catalog.json
```

This emits a full machine-readable catalog: every resource, operation, path/query/body
parameter, and request-body schema. It's the fastest way for an agent (or a human) to look up
exactly which flags an operation accepts. The human-readable version of the same catalog lives
on the [Commands](/commands/) page.

`asn --help` and `asn <resource> --help` also work as usual for interactive exploration.

## Everyday examples

List tasks for a project with a specific field selection:

```bash
asn tasks get-tasks-for-project 1234567890123456 \
  --opt-fields name assignee.name completed
```

```json
{
  "data": [
    {
      "gid": "1234567890123457",
      "name": "Write launch checklist",
      "assignee": { "name": "Jordan" },
      "completed": false
    }
  ],
  "next_page": null
}
```

Preview a mutation without sending it, using `--dry-run` and the read-only guard:

```bash
asn --dry-run --guard-workspace 1234567890123456 tasks create-task \
  --field workspace=1234567890123456 --field name='Agent-created task'
```

```json
{
  "method": "POST",
  "url": "https://app.asana.com/api/1.0/tasks",
  "headers": {
    "Authorization": "Bearer ***",
    "Content-Type": "application/json"
  },
  "body": {
    "data": { "workspace": "1234567890123456", "name": "Agent-created task" }
  }
}
```

Upload and list attachments on a task:

```bash
asn attachments create --parent 1234567890123456 --file ./report.pdf
asn attachments get-attachments-for-object --parent 1234567890123456
```

## Command anatomy

Generated commands follow one consistent shape:

```
asn <resource> <operation> [path-args...] [--options]
```

- `<resource>` groups commands by Asana API area (`tasks`, `projects`, `workspaces`, ...).
- `<operation>` is the kebab-case operation id from the OpenAPI spec (e.g. `get-task`,
  `create-task`, `add-followers-for-task`).
- Path arguments are positional and required, in the order they appear in the URL, e.g.
  `asn tasks get-task <task_gid>`.
- Options map 1:1 to the spec's query and body parameters; run `asn <resource> <operation>
--help` to see them for any single command.

## Field values and request bodies

For mutating commands, build the request body with repeatable `--field key=value` pairs or a
complete JSON document via `--body-json`:

```bash
# repeatable --field: builds {"data": {"name": "...", "projects": [...]}}
asn tasks update-task 1234567890123456 --field name='Renamed task'

# --field with a comma-separated value becomes an array
asn tasks update-task 1234567890123456 --field projects=1212534488934172,1212534488934173

# full body from a file
asn tasks create-task --body-json @new-task.json

# full body from stdin
echo '{"data":{"name":"From stdin"}}' | asn tasks create-task --body-json -
```

`--field` values are JSON-parsed with one deliberate exception: an all-digit value (an Asana
GID) always stays a string, because Asana rejects numeric GIDs. Use `--body-json` whenever you
need a value `--field`'s coercion rules don't fit.

## Output formats

Successful output is JSON by default (one object per invocation: `{"data": ..., "next_page":
...}`). Switch formats with `--output`:

```bash
asn workspace list --output table
asn workspace list --output jsonl
```

- `json` (default) — the full envelope as a single JSON object.
- `jsonl` — one JSON line per row in `data` (useful for piping into `jq`, agents, or log
  processors).
- `table` — a plain aligned text table, for interactive terminal use.

## Errors and exit codes

Errors are always JSON on stderr, with a stable exit code per failure class:

| Exit code | Meaning                                  |
| --------- | ---------------------------------------- |
| `1`       | Internal error                           |
| `2`       | Usage error (bad flags/arguments)        |
| `3`       | Authentication error (no PAT configured) |
| `4`       | Read-only workspace / forbidden          |
| `5`       | Not found                                |
| `6`       | Rate-limited                             |
| `7`       | Asana server error                       |
| `8`       | Network error                            |
| `9`       | Request conflict                         |

```bash
asn tasks get-task does-not-exist; echo "exit: $?"
```

```json
{"error":{"code":"NOT_FOUND","message":"..."}}
exit: 5
```

## Next steps

- [Commands](/commands/) — the full generated command reference.
- [Configuration](/configuration/) — config file format, environment variables, and read-only
  workspace guards.
- [Upgrading](/upgrading/) — the `asn upgrade` command and the startup update notice.
