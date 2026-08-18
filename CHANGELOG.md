# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [Unreleased]

## [0.1.2] - 2026-08-18

### Fixed

- Prevented global CLI options from shadowing generated API flags.
- Hardened read-only workspace ownership checks for resource mutations, batch requests, webhooks, and attachments.
- Restricted local-file reads, redacted PATs, hardened attachment downloads, and enforced private config/cache permissions with fail-closed validation.

## [0.1.1] - 2026-08-18

### Fixed

- Release artifact installation now uses an explicit local package path.

## [0.1.0] - 2026-08-18

### Added

- Agent-first TypeScript CLI foundation with PAT auth, workspace discovery, read-only guards, stable JSON output, and retry-aware transport.
- Claude Code marketplace/plugin packaging and portable Agent Skills.
- CI, secret scanning, scheduled OpenAPI drift checks, and attested release artifacts.
