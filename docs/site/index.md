---
title: Agentic Asana CLI
description: A JSON-first Asana CLI (asn) designed for coding agents, with multi-workspace discovery and read-only guards.
---

# Agentic Asana CLI

A JSON-first Asana CLI (`asn`) designed for coding agents. It discovers workspaces from a
Personal Access Token (PAT), exposes the Asana REST API as commands, supports attachments,
and blocks mutations to workspaces marked read-only.

## Where to go next

- [Usage](/usage/) — installation, authentication, and everyday commands.
- [Commands](/commands/) — the full command reference.
- [Configuration](/configuration/) — config file, environment variables, and workspace guards.
- [Upgrading](/upgrading/) — the `asn upgrade` command and the startup update notice.

## Quickstart

```bash
export ASANA_PAT='your-personal-access-token'
asn workspace list --refresh
asn schema
```

See the [full README](https://github.com/leighton-tidwell/agentic-asana-cli#readme) for
install instructions and the [origin story](https://github.com/leighton-tidwell/agentic-asana-cli/blob/main/docs/story.html)
behind the project.
