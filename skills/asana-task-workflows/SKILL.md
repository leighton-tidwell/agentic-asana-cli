---
name: asana-task-workflows
description: Run verified task workflows through the asn CLI.
license: MIT
compatibility: Requires Node.js 20+, asn, and an Asana PAT.
allowed-tools: Bash(asn:*)
metadata:
  author: leighton-tidwell
  version: '0.1.0'
---

# Asana Task Workflows

Use this skill for multi-step task, section, story, tag, subtask, and attachment workflows.

## Procedure

1. Run `asn schema` for every resource involved; command names can change when Asana's OpenAPI specification changes.
2. Read the destination project and workspace. Stop if the workspace is marked read-only.
3. Capture a pre-change snapshot of relevant object GIDs and fields.
4. Create or update one object at a time. Record every created GID immediately for cleanup or rollback.
5. Re-read each object after mutation and verify the expected fields.
6. For bulk or batch operations, inspect every sub-action. A read-only target makes the whole mutation unsafe.
7. On failure, use the recorded GIDs to remove only objects created by this workflow; do not delete pre-existing objects.

## Attachments

Upload using the dedicated attachment command. List attachments after upload, download to a controlled destination when verification is required, byte-compare, then delete test attachments.

## Safety

Prefer reversible changes, preserve pre-existing project state, and use unconditional cleanup for tests. Never retry a timed-out mutation until a read confirms whether it succeeded.
