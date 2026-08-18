---
title: Configuration
description: Config file format, environment variables, and read-only workspace guards.
---

# Configuration

`asn` reads a small JSON config file plus environment variables. There is no required
configuration beyond a Personal Access Token — everything else (workspace list, read-only
guards, webhook target allowlist) is optional and additive.

## Config file location

Default path: `~/.config/asn/config.json` (or `$XDG_CONFIG_HOME/asn/config.json` when
`XDG_CONFIG_HOME` is set). Override per-invocation with `--config <path>`.

```bash
asn --config ./project-config.json workspace list
```

`asn auth login` creates the file (and its parent directory) if it doesn't exist, with `0700`
directory permissions and `0600` file permissions, and refuses to write into a
group/world-writable directory.

## Config file format

```json
{
  "token": "your-personal-access-token",
  "workspaces": [
    {
      "gid": "1234567890123456",
      "name": "client-production",
      "readOnly": true
    }
  ],
  "webhookTargetAllowlist": ["https://example.com/asana-webhook"]
}
```

The schema is also published as JSON Schema at
[`config.schema.json`](https://github.com/leighton-tidwell/agentic-asana-cli/blob/main/config.schema.json)
in the repo root, so editors can validate the file as you type. All three top-level keys are
optional; unknown keys are rejected.

| Key                      | Type       | Description                                                                                                             |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `token`                  | `string`   | PAT, used if `ASANA_PAT` is not set. Lower precedence than the environment variable, higher precedence than `--token`.  |
| `workspaces`             | `array`    | Workspace entries (see below). Optional — omit it and `asn workspace list` discovers workspaces from the PAT.           |
| `webhookTargetAllowlist` | `string[]` | Allowed target URLs for `asn webhooks create-webhook`; see [Webhook target allowlist](#webhook-target-allowlist) below. |

### `workspaces[]` entries

| Key        | Type                   | Required | Description                                                                                    |
| ---------- | ---------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `gid`      | `string` (digits only) | yes      | The workspace's Asana gid.                                                                     |
| `name`     | `string`               | no       | A human-readable label; not sent to Asana.                                                     |
| `readOnly` | `boolean`              | yes      | When `true`, mutating requests resolved against this workspace are rejected before being sent. |

An invalid config file (wrong types, unknown properties, a non-digit `gid`, or a missing
`readOnly`) causes every command to fail immediately with a `USAGE` error (exit code `2`)
describing exactly which field is invalid — `asn` never silently ignores a malformed config.

## Environment variables

| Variable          | Description                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ASANA_PAT`       | Personal Access Token. Highest-precedence token source; recommended over `--token` because command-line flags can leak into shell history and process listings. |
| `XDG_CONFIG_HOME` | Overrides the base directory used to compute the default config path (`$XDG_CONFIG_HOME/asn/config.json`) when `--config` is not given.                         |

### Token resolution order

1. `ASANA_PAT` environment variable
2. `token` field in the config file
3. `--token <pat>` command-line flag

If none is set, every command that talks to Asana fails with an `AUTH` error (exit code `3`).

## Read-only workspace protection

Mark a workspace `readOnly: true` in the config file and `asn` refuses any mutating request
(`POST`/`PUT`/`PATCH`/`DELETE`) resolved against it, before the request is ever sent:

```json
{
  "workspaces": [
    { "gid": "1234567890123456", "name": "client-production", "readOnly": true }
  ]
}
```

```bash
asn tasks create-task --field workspace=1234567890123456 --field name='Should be blocked'
```

```json
{
  "error": {
    "code": "READONLY_BLOCKED",
    "message": "workspace 1234567890123456 is read-only; POST blocked before send"
  }
}
```

`asn` resolves the _owning_ workspace for resource-addressed mutations (e.g. updating a task by
gid) by looking the resource up in Asana first, and caches that resolution for the run. When a
resource doesn't directly expose a workspace, the resolver also follows that resource's declared
container link — a section's `project`, a story's `task`, a team's `organization`, and similar —
recursing up to a bounded number of hops until a workspace is found. For one-segment collection-create
endpoints (creating a task, project, etc.), every referenced container — scalar, object-shaped
(`{"gid": "..."}`), or string/array of gids — is resolved before the request is sent, including
polymorphic `parent`/`target` fields, which are checked against each of their plausible Asana
container types. Any reference that can't be resolved fails closed with `READONLY_UNRESOLVED`
(exit `4`) rather than allowing the request through.

A body `workspace` field is confirmed against Asana before it can authorize a create. The
global `--guard-workspace <gid>` flag and an unverified body `workspace` value are both treated
as **caller assertions only** — additional fail-closed checks, never proof of ownership on
their own.

Workspace entries are optional. With no `workspaces` configured, `asn workspace list` discovers
every workspace visible to the PAT, and no read-only protection is applied (there's nothing
configured as read-only).

## Webhook target allowlist

`webhookTargetAllowlist` restricts which target URLs `asn webhooks create-webhook` (and the
`--allow-unlisted-webhook-target` escape hatch) will accept, independent of whether any
workspace is configured read-only — this check runs unconditionally on every webhook create.

```json
{ "webhookTargetAllowlist": ["https://example.com/asana-webhook"] }
```

```bash
# rejected: not in the allowlist
asn webhooks create-webhook --field resource=1234567890123456 --field target=https://evil.example/hook

# explicit opt-in for a one-off target outside the allowlist
asn --allow-unlisted-webhook-target webhooks create-webhook \
  --field resource=1234567890123456 --field target=https://evil.example/hook
```

## Local file access guard

Commands that read a local file path (`--body-json @file.json`, `asn attachments create --file <path>`) refuse to read:

- The active config file or the workspace cache file, even if you happen to point a `@file.json`
  reference at them.
- Any file inside `~/.ssh`, `~/.aws`, or `~/.config`.
- Any file whose name starts with `.env`.
- A file outside the current working directory, unless `--allow-outside-cwd` is passed — and
  even then, a `0600`-permission file outside the working directory is refused outright, since
  that permission pattern usually marks a secret.

```bash
asn tasks create-task --body-json @../shared/new-task.json --allow-outside-cwd
```

## Command-line flags recap

These global flags interact directly with the configuration described above (full list on the
[Commands](/commands/#common-flags) page):

| Flag                              | Interacts with                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `--config <path>`                 | Overrides the config file path.                                                                |
| `--token <pat>`                   | Lowest-precedence token source, below `ASANA_PAT` and the config file.                         |
| `--guard-workspace <gid>`         | Caller-supplied workspace assertion for the read-only guard; verified, never trusted outright. |
| `--allow-outside-cwd`             | Opts into reading local files outside the working directory (see above).                       |
| `--allow-unlisted-webhook-target` | Opts a single webhook create out of `webhookTargetAllowlist`.                                  |

## Next steps

- [Usage](/usage/) — everyday commands and output formats.
- [Commands](/commands/) — the full generated command reference.
