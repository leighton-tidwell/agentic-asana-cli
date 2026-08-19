---
name: asana-cli
description: Drive Asana safely through the agent-first asn CLI.
license: MIT
compatibility: Requires Node.js 20+, asn, and an Asana PAT.
allowed-tools: Bash(asn:*)
metadata:
  author: leighton-tidwell
  version: '0.1.5'
---

# Asana CLI

Use `asn` for machine-readable Asana operations. Do not guess endpoint names or flags; the generated schema is the source of truth.

## Authentication

Require `ASANA_PAT` in the process environment. Never put a PAT in a command argument, transcript, committed file, fixture, or error report. If only a PAT is available, run `asn workspace list --refresh` to discover accessible workspaces.

## Procedure

1. Run `asn schema` or `asn schema <resource> <operation>` and read the JSON definition.
2. Resolve the target workspace before a mutation. Treat `readOnly: true` as an operator safety boundary and never attempt to bypass it.
3. Build the narrowest request. Use `--opt-fields` for only the fields needed and `--all` only when all pages are necessary.
4. Use the command's dry-run mode before a consequential mutation. Confirm the redacted request targets `https://app.asana.com`.
5. Execute once and parse stdout as JSON. Parse failure envelopes from stderr and branch on the documented exit code; do not retry mutations blindly.
6. Re-read the affected object to verify the intended state.

## Attachments

Use `asn attachments create --parent <gid> --file <path>` for uploads. Use the attachment list/download commands discovered from `asn schema`; byte-compare a downloaded file when integrity matters. Do not inline local file contents into JSON.

## Safety

Read-only blocks exit with code 4 before the mutation is sent. Missing workspace resolution is a reason to stop and identify the workspace, not a reason to weaken configuration. Never send the PAT to an attachment download URL.
