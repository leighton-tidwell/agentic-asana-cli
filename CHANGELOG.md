# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [Unreleased]

## [0.1.2] - 2026-08-18

### Fixed

- Fixed VER-1 option shadowing: all nine hard-broken commands are invocable again, and roughly 203 commands no longer silently drop generated API options.
- Closed [SEC-1](SECURITY-AUDIT.md#sec-1--read-only-workspace-ownership-verification) by deriving mutation ownership from authoritative Asana resources and failing closed across collection creates, resource mutations, attachments, and polymorphic parent paths.
- Closed [SEC-2](SECURITY-AUDIT.md#sec-2--local-file-access-and-credential-redaction) by restricting sensitive and outside-CWD file reads and redacting all known PAT sources.
- Closed [SEC-3](SECURITY-AUDIT.md#sec-3--attachment-download-hardening) with destination confinement, redirect and public-target validation, safe replacement semantics, and bounded downloads.
- Closed [SEC-4](SECURITY-AUDIT.md#sec-4--batch-and-webhook-guard-coverage) with recursive batch enforcement, webhook ownership resolution, and target-origin allowlisting.
- Closed [SEC-5](SECURITY-AUDIT.md#sec-5--configuration-and-diagnostics-hardening) with private config/cache permissions, fail-closed runtime validation, complete token redaction, and removal of the unused verbose flag.

### Added

- Added a self-contained [origin story](docs/story.html) describing the church multi-workspace problem, the spec-coded agent team, and the lessons learned for agentic development training.
- Added a public security audit remediation summary with independent re-audit evidence.

## [0.1.1] - 2026-08-18

### Fixed

- Release artifact installation now uses an explicit local package path.

## [0.1.0] - 2026-08-18

### Added

- Agent-first TypeScript CLI foundation with PAT auth, workspace discovery, read-only guards, stable JSON output, and retry-aware transport.
- Claude Code marketplace/plugin packaging and portable Agent Skills.
- CI, secret scanning, scheduled OpenAPI drift checks, and attested release artifacts.
