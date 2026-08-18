# Security audit remediation summary

This document records the findings addressed for v0.1.2. It intentionally omits proof-of-concept payloads and credentials. The original audit was performed against v0.1.1 (`8fcb4f7`); the independent release re-audit approved v0.1.2 commit `e8e37ed`.

## Status

All Critical, High, and Medium findings from the v0.1.1 audit are fixed in v0.1.2. The independent re-audit found no remaining release-blocking findings and verified the full 249-operation API surface, package installation, dependency audit, and repository secret scan.

## Findings

### SEC-1 — Read-only workspace ownership verification

Status: Fixed

Resource-addressed and collection-create mutations now derive ownership from authoritative Asana resources rather than trusting caller-supplied workspace assertions. Batch actions, attachments, webhooks, body workspace fields, polymorphic container references, and project-parent creation paths fail closed when ownership cannot be resolved.

### SEC-2 — Local-file access and credential redaction

Status: Fixed

Active configuration/cache files and sensitive paths are denied. Ordinary reads outside the current working directory require explicit opt-in, protected attachment uploads are rejected before a request, and known PAT sources are redacted from errors and dry-run output.

### SEC-3 — Attachment download hardening

Status: Fixed

Downloads require HTTPS public targets, validate every redirect, enforce destination confinement, reject unsafe symlink or existing-file replacement by default, and apply a bounded download size with partial-file cleanup.

### SEC-4 — Batch and webhook guard coverage

Status: Fixed

Batch subrequests are checked recursively under the same read-only policy. Webhook resources require verified ownership, and target origins require an operator allowlist or explicit opt-in.

### SEC-5 — Configuration and diagnostics hardening

Status: Fixed

Configuration and cache files are forced to private permissions, runtime configuration validation fails closed, PAT redaction covers all supported token sources, and the unused verbose flag was removed.

## Verification

The release re-audit reported:

- 96/96 tests passing
- 249/249 generated API operations covered
- lint, formatting, build, and packaging checks passing
- zero dependency vulnerabilities from `npm audit`
- no repository secrets found by Gitleaks
- no remaining Critical, High, or Medium findings

One Low availability hardening opportunity remains: a cyclic parent chain returned by a malicious API responder can stall ownership resolution, but the path fails closed with zero mutating calls and is not attacker-reachable through valid Asana data.

Security reports should follow [SECURITY.md](SECURITY.md).
