---
name: asana-reporting
description: Build read-only Asana reports with the asn CLI.
license: MIT
compatibility: Requires Node.js 20+, asn, and an Asana PAT.
allowed-tools: Bash(asn:*)
metadata:
  author: leighton-tidwell
  version: '0.1.3'
---

# Asana Reporting

Use this skill for projects, portfolios, goals, users, teams, search, and status reporting without changing Asana.

## Procedure

1. Run `asn schema` for the relevant list/search/get operations.
2. Select only required fields with `--opt-fields`; include stable GIDs alongside human names.
3. Use `--all` only when report completeness requires every page. Otherwise set a bounded limit.
4. Keep the operation read-only. Reject any generated plan containing POST, PUT, PATCH, or DELETE.
5. Parse JSON output, retain pagination/truncation metadata, and distinguish permission errors from empty datasets.
6. Include workspace scope and retrieval time in the report so readers can judge coverage.

## Safety

Never create webhooks, status updates, or temporary tasks to gather a report. Do not expose PATs, private attachment URLs, or fields unrelated to the reporting request.
