---
description: Discover and run an Asana operation with the asn CLI
argument-hint: <goal or operation>
allowed-tools: Bash(asn:*)
---

Use the `asn` CLI to accomplish: $ARGUMENTS

First run `asn schema` (or a narrowed schema query) to discover the exact command and arguments. Prefer `ASANA_PAT` for authentication, request only necessary fields, and preserve JSON output. Before any mutation, identify the target workspace and honor configured read-only protection. For attachments, use the dedicated attachment commands rather than encoding file bytes in JSON. Never print or persist a PAT.
