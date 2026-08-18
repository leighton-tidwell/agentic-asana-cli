# Agentic Asana CLI (`asn`)

[![CI](https://github.com/leighton-tidwell/agentic-asana-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/leighton-tidwell/agentic-asana-cli/actions/workflows/ci.yml)

A JSON-first Asana CLI designed for coding agents. It discovers workspaces from a Personal Access Token (PAT), exposes the Asana REST API as commands, supports attachments, and blocks mutations to workspaces marked read-only.

## Why this exists

This project began with a practical need: using Asana for church work across multiple workspaces when the existing MCP option could not. Rather than hand-code around the gap, the author wrote the spec and let a team of AI agents plan, implement, audit, verify, and release a CLI with complete API coverage and per-workspace safety; read [the full origin story](docs/story.html).

## Install in one command

```bash
npm install -g https://github.com/leighton-tidwell/agentic-asana-cli/releases/latest/download/agentic-asana-asn.tgz
```

Node.js 20 or newer is required. For a pinned release, replace `latest` with `download/vX.Y.Z`.

## Quickstart: only a PAT

Create a PAT in Asana, export it without putting it in command arguments, then let `asn` discover your workspaces:

```bash
export ASANA_PAT='your-personal-access-token'
asn workspace list --refresh
asn schema
```

`ASANA_PAT` is recommended because command-line tokens can appear in shell history and process listings. Never commit a PAT.

## Read-only workspace protection

Create `~/.config/asn/config.json` (or pass `--config <path>`):

```json
{
  "workspaces": [
    {
      "gid": "1234567890123456",
      "name": "client-production",
      "readOnly": true
    }
  ]
}
```

A mutating request aimed at a read-only workspace is rejected before the mutation is sent. For resource-addressed mutations, `asn` resolves the owning workspace from Asana first and caches that resolution for the run. One-segment collection creates resolve every referenced container before sending, including scalar, object-shaped, and string-or-array references; polymorphic parent and target fields try only their plausible Asana container types, and any unresolved reference fails closed. A body `workspace` value is also confirmed through Asana before it can authorize a create. The global `--guard-workspace <gid>` option and an unverified body `workspace` value remain caller assertions used only for additional fail-closed checks; neither is accepted as proof of ownership. Workspace IDs are optional; with no configured IDs, `asn workspace list` discovers them from the PAT.

## Agentic usage

Discover commands instead of guessing flags:

```bash
asn schema > asana-command-catalog.json
asn tasks get-tasks-for-project 1234567890123456 \
  --opt-fields name assignee.name completed
asn --dry-run --guard-workspace 1234567890123456 tasks create-task \
  --field workspace=1234567890123456 --field name='Agent-created task'
asn attachments create --parent 1234567890123456 --file ./report.pdf
asn attachments get-attachments-for-object --parent 1234567890123456
```

The pinned OpenAPI manifest generates 249 invocable commands named `asn <resource> <kebab-operation-id>`. Generated API parameters keep their spec-derived names and belong after the operation (for example, `asn webhooks get-webhooks --workspace <gid>` and `asn tasks get-task <gid> --opt-fields name`). The distinct program-level `--guard-workspace <gid>` flag is only a read-only guard assertion; it is not sent as an API query parameter. Mutations accept repeatable `--field key=value` inputs or a complete body through `--body-json '<json>'`, `--body-json @file.json`, or `--body-json -` for stdin.

Successful output is JSON by default. Errors are JSON on stderr with stable exit codes: `2` usage, `3` authentication, `4` read-only/forbidden, `5` not found, `6` rate-limited, `7` server, `8` network, and `9` request conflict.

## Claude Code plugin

Inside Claude Code:

```text
/plugin marketplace add leighton-tidwell/agentic-asana-cli
/plugin install asana-cli@agentic-asana
```

The plugin supplies `/asana` and the Asana skills in this repository. Set `ASANA_PAT` in the environment that starts Claude Code.

## Agent Skills

```bash
npx skills add leighton-tidwell/agentic-asana-cli --list
npx skills add leighton-tidwell/agentic-asana-cli \
  --skill asana-cli --agent claude-code -y
```

## Development

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:api-coverage
npm run test:packaging
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## License

MIT
