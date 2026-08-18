---
title: Commands
description: Reference for every asn command, its flags, and arguments, generated from the pinned Asana OpenAPI manifest.
---

# Commands

`asn` generates 249 invocable commands from the pinned Asana OpenAPI manifest, grouped
into 49 resources below, plus a handful of built-in commands. Every generated command follows
the shape `asn <resource> <operation> [path-args] [--options]`. Run `asn schema` at any time to get a
full machine-readable catalog (JSON) of every command, its parameters, and its request/response
shapes — this page is the human-readable rendering of that same catalog.

## Common flags

These global flags (declared on the root `asn` program) apply to every command below and are
omitted from the per-command tables:

| Flag                              | Description                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--token <pat>`                   | PAT fallback; prefer the `ASANA_PAT` environment variable.                                             |
| `--config <path>`                 | Config file path (default: `~/.config/asn/config.json`).                                               |
| `--output <format>`               | `json` (default), `jsonl`, or `table`.                                                                 |
| `--dry-run`                       | Print the redacted request that would be sent, without sending it.                                     |
| `--guard-workspace <gid>`         | Workspace gid assertion used only for read-only guard resolution; not sent as an API parameter.        |
| `--allow-outside-cwd`             | Allow reading non-sensitive local files (e.g. `--body-json @file.json`) outside the working directory. |
| `--allow-unlisted-webhook-target` | Explicitly allow a webhook target URL outside `webhookTargetAllowlist`.                                |

See [Configuration](/configuration/) for how these flags interact with the config file and
environment variables, and [Usage](/usage/) for everyday examples.

## Body input for mutating commands

Every mutating command (`mutates: true` below) accepts a JSON request body two ways:

- Repeatable `--field key=value` — builds `{ "data": { key: value, ... } }`. Values are
  JSON-parsed except an all-digit token, which always stays a string (Asana rejects numeric
  GIDs). A comma-separated value with no other valid JSON interpretation becomes an array of
  individually GID-safe-coerced elements, e.g. `--field projects=123,456` sends
  `"projects": ["123", "456"]`.
- `--body-json '<json>'`, `--body-json @file.json`, or `--body-json -` (stdin) — supply the
  complete body verbatim for structured or precise values `--field` cannot express.

## Built-in commands

Beyond the 249 generated commands below, `asn` ships a small set of
hand-written commands for concerns the OpenAPI spec doesn't model: auth, workspace discovery,
schema introspection, and streaming file transfer.

### `asn schema`

Emit the full machine-readable command catalog (the same JSON that drives `asn --json-help`) —
every resource, operation, parameter, and request-body schema.

```bash
asn schema > asana-command-catalog.json
```

### `asn auth login`

Store a Personal Access Token in the config file at `--config` (default
`~/.config/asn/config.json`), written with `0600` permissions. Requires `--token`.

```bash
asn auth login --token "$ASANA_PAT"
```

### `asn workspace list`

List configured or auto-discovered workspaces, with an on-disk cache.

| Flag                    | Description                                 |
| ----------------------- | ------------------------------------------- |
| `--refresh`             | Ignore the workspace cache and re-fetch.    |
| `--limit <count>`       | Maximum workspaces to return.               |
| `--all`                 | Fetch every page.                           |
| `--opt-fields <fields>` | Comma-separated optional fields to request. |

```bash
asn workspace list --refresh
```

### `asn attachments create` / `download` / `delete`

These streaming attachment commands are distinct from the generated
`attachments create-attachment-for-object` / `get-attachment` / `delete-attachment` /
`get-attachments-for-object` commands documented under [attachments](#attachments) below: they
stream multipart uploads and downloads directly from disk or stdin instead of taking a JSON
body, so they're the ones to reach for when moving real files.

| Command                          | Required flags                  | Notes                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asn attachments create`         | `--parent <gid>`, `--file <path | ->`                                                                                                                                                                                                                                     | Streams a multipart upload; `--file -` reads from stdin. Optional `--name <name>`. |
| `asn attachments download <gid>` | none                            | Downloads via the attachment's signed URL. Optional `--out <path>`, `--dest-dir <path>`, `--force`, `--max-bytes <bytes>` (default 100MB). Refuses to overwrite an existing file without `--force`, and refuses symlinked destinations. |
| `asn attachments delete <gid>`   | none                            | Deletes an attachment.                                                                                                                                                                                                                  |

```bash
asn attachments create --parent 1234567890123456 --file ./report.pdf
asn attachments download 1234567890123456 --out report.pdf --force
asn attachments delete 1234567890123456
```

## Resources

- [access-requests](#access-requests)
- [agents](#agents)
- [ai-studio-usage-api](#ai-studio-usage-api)
- [allocations](#allocations)
- [attachments](#attachments)
- [audit-log-api](#audit-log-api)
- [batch-api](#batch-api)
- [budgets](#budgets)
- [custom-field-settings](#custom-field-settings)
- [custom-fields](#custom-fields)
- [custom-types](#custom-types)
- [events](#events)
- [exports](#exports)
- [goal-relationships](#goal-relationships)
- [goals](#goals)
- [jobs](#jobs)
- [memberships](#memberships)
- [ooo-entries](#ooo-entries)
- [organization-exports](#organization-exports)
- [portfolio-memberships](#portfolio-memberships)
- [portfolios](#portfolios)
- [project-briefs](#project-briefs)
- [project-memberships](#project-memberships)
- [project-portfolio-settings](#project-portfolio-settings)
- [project-statuses](#project-statuses)
- [project-templates](#project-templates)
- [projects](#projects)
- [rates](#rates)
- [reactions](#reactions)
- [roles](#roles)
- [rules](#rules)
- [sections](#sections)
- [status-updates](#status-updates)
- [stories](#stories)
- [tags](#tags)
- [task-templates](#task-templates)
- [tasks](#tasks)
- [team-memberships](#team-memberships)
- [teams](#teams)
- [time-periods](#time-periods)
- [time-tracking-categories](#time-tracking-categories)
- [time-tracking-entries](#time-tracking-entries)
- [timesheet-approval-statuses](#timesheet-approval-statuses)
- [typeahead](#typeahead)
- [user-task-lists](#user-task-lists)
- [users](#users)
- [webhooks](#webhooks)
- [workspace-memberships](#workspace-memberships)
- [workspaces](#workspaces)

## access-requests

### `asn access-requests approve-access-request`

POST `/access_requests/{access_request_gid}/approve` — **mutates data**

Approves an access request for a target object.

| Flag / argument        | Location | Required | Type   | Description |
| ---------------------- | -------- | -------- | ------ | ----------- |
| `<access_request_gid>` | path     | yes      | string |             |

```bash
asn access-requests approve-access-request <access_request_gid>
```

### `asn access-requests create-access-request`

POST `/access_requests` — **mutates data**

Submits a new access request for a private object. Currently supports projects and portfolios.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |

```bash
asn access-requests create-access-request --field key=value
```

### `asn access-requests get-access-requests`

GET `/access_requests` — read-only

Returns the pending access requests for a target object or a target object filtered by user.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--target`      | query    | yes      | string             |             |
| `--user`        | query    | no       | string             |             |

```bash
asn access-requests get-access-requests --target <target>
```

### `asn access-requests reject-access-request`

POST `/access_requests/{access_request_gid}/reject` — **mutates data**

Rejects an access request for a target object.

| Flag / argument        | Location | Required | Type   | Description |
| ---------------------- | -------- | -------- | ------ | ----------- |
| `<access_request_gid>` | path     | yes      | string |             |

```bash
asn access-requests reject-access-request <access_request_gid>
```

## agents

### `asn agents get-agent`

GET `/agents/{agent_gid}` — read-only

Returns the complete record for a single agent (AI Teammate).

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<agent_gid>`   | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn agents get-agent <agent_gid>
```

### `asn agents get-agents-for-workspace`

GET `/workspaces/{workspace_gid}/agents` — read-only, paginated

Returns the compact records of agents (AI Teammates) configured. Use `opt_fields` to request additional fields in the workspace.

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn agents get-agents-for-workspace <workspace_gid>
```

## ai-studio-usage-api

### `asn ai-studio-usage-api get-ai-studio-runs`

GET `/workspaces/{workspace_gid}/ai_studio/runs` — read-only, paginated

Returns one row per AI Studio run (rule execution) for the workspace, in ascending order (oldest first) so that incremental consumers can poll forward. Each row describes what ran, who it is attributed to, the model used, and the credits consumed.

| Flag / argument   | Location | Required | Type    | Description |
| ----------------- | -------- | -------- | ------- | ----------- |
| `<workspace_gid>` | path     | yes      | string  |             |
| `--division-gid`  | query    | no       | string  |             |
| `--end-at`        | query    | no       | string  |             |
| `--limit`         | query    | no       | integer |             |
| `--offset`        | query    | no       | string  |             |
| `--start-at`      | query    | no       | string  |             |

```bash
asn ai-studio-usage-api get-ai-studio-runs <workspace_gid>
```

### `asn ai-studio-usage-api get-ai-studio-seats`

GET `/workspaces/{workspace_gid}/ai_studio/seats` — read-only, paginated

Returns a current snapshot of AI Studio seat allocations for the workspace — who has access, at what license tier, and the state of each seat. This is a point-in-time snapshot; customers build their own history tables on top of periodic pulls.

| Flag / argument   | Location | Required | Type    | Description |
| ----------------- | -------- | -------- | ------- | ----------- |
| `<workspace_gid>` | path     | yes      | string  |             |
| `--division-gid`  | query    | no       | string  |             |
| `--limit`         | query    | no       | integer |             |
| `--offset`        | query    | no       | string  |             |
| `--state`         | query    | no       | string  |             |

```bash
asn ai-studio-usage-api get-ai-studio-seats <workspace_gid>
```

## allocations

### `asn allocations create-allocation`

POST `/allocations` — **mutates data**

Creates a new allocation.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn allocations create-allocation --field key=value
```

### `asn allocations delete-allocation`

DELETE `/allocations/{allocation_gid}` — **mutates data**

A specific, existing allocation can be deleted by making a DELETE request on the URL for that allocation.

| Flag / argument    | Location | Required | Type    | Description |
| ------------------ | -------- | -------- | ------- | ----------- |
| `<allocation_gid>` | path     | yes      | string  |             |
| `--opt-pretty`     | query    | no       | boolean |             |

```bash
asn allocations delete-allocation <allocation_gid>
```

### `asn allocations get-allocation`

GET `/allocations/{allocation_gid}` — read-only

Returns the complete allocation record for a single allocation.

| Flag / argument    | Location | Required | Type               | Description |
| ------------------ | -------- | -------- | ------------------ | ----------- |
| `<allocation_gid>` | path     | yes      | string             |             |
| `--opt-fields`     | query    | no       | array (repeatable) |             |
| `--opt-pretty`     | query    | no       | boolean            |             |

```bash
asn allocations get-allocation <allocation_gid>
```

### `asn allocations get-allocations`

GET `/allocations` — read-only, paginated

Returns a list of allocations filtered to a specific project, user or placeholder.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--assignee`    | query    | no       | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--parent`      | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn allocations get-allocations
```

### `asn allocations update-allocation`

PUT `/allocations/{allocation_gid}` — **mutates data**

An existing allocation can be updated by making a PUT request on the URL for
that allocation. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged.

| Flag / argument    | Location | Required | Type                   | Description                                 |
| ------------------ | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<allocation_gid>` | path     | yes      | string                 |                                             |
| `--body-json`      | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`          | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`     | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`     | query    | no       | boolean                |                                             |

```bash
asn allocations update-allocation <allocation_gid> --field key=value
```

## attachments

### `asn attachments create-attachment-for-object`

POST `/attachments` — **mutates data**

Required scope: attachments:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn attachments create-attachment-for-object
```

### `asn attachments delete-attachment`

DELETE `/attachments/{attachment_gid}` — **mutates data**

Required scope: attachments:delete

| Flag / argument    | Location | Required | Type    | Description |
| ------------------ | -------- | -------- | ------- | ----------- |
| `<attachment_gid>` | path     | yes      | string  |             |
| `--opt-pretty`     | query    | no       | boolean |             |

```bash
asn attachments delete-attachment <attachment_gid>
```

### `asn attachments get-attachment`

GET `/attachments/{attachment_gid}` — read-only

Required scope: attachments:read

| Flag / argument    | Location | Required | Type               | Description |
| ------------------ | -------- | -------- | ------------------ | ----------- |
| `<attachment_gid>` | path     | yes      | string             |             |
| `--opt-fields`     | query    | no       | array (repeatable) |             |
| `--opt-pretty`     | query    | no       | boolean            |             |

```bash
asn attachments get-attachment <attachment_gid>
```

### `asn attachments get-attachments-for-object`

GET `/attachments` — read-only, paginated

Required scope: attachments:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--parent`      | query    | yes      | string             |             |

```bash
asn attachments get-attachments-for-object --parent <parent>
```

## audit-log-api

### `asn audit-log-api get-audit-log-events`

GET `/workspaces/{workspace_gid}/audit_log_events` — read-only, paginated

Retrieve the audit log events that have been captured in your domain.

| Flag / argument   | Location | Required | Type    | Description |
| ----------------- | -------- | -------- | ------- | ----------- |
| `<workspace_gid>` | path     | yes      | string  |             |
| `--actor-gid`     | query    | no       | string  |             |
| `--actor-type`    | query    | no       | string  |             |
| `--end-at`        | query    | no       | string  |             |
| `--event-type`    | query    | no       | string  |             |
| `--limit`         | query    | no       | integer |             |
| `--offset`        | query    | no       | string  |             |
| `--resource-gid`  | query    | no       | string  |             |
| `--start-at`      | query    | no       | string  |             |

```bash
asn audit-log-api get-audit-log-events <workspace_gid>
```

## batch-api

### `asn batch-api create-batch-request`

POST `/batch` — **mutates data**

Make multiple requests in parallel to Asana's API.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn batch-api create-batch-request --field key=value
```

## budgets

### `asn budgets create-budget`

POST `/budgets` — **mutates data**

Creates a new budget.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn budgets create-budget --field key=value
```

### `asn budgets delete-budget`

DELETE `/budgets/{budget_gid}` — **mutates data**

A specific, existing budget can be deleted by making a DELETE request on the URL for that budget.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<budget_gid>`  | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn budgets delete-budget <budget_gid>
```

### `asn budgets get-budget`

GET `/budgets/{budget_gid}` — read-only

Returns the complete budget record for a single budget.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<budget_gid>`  | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn budgets get-budget <budget_gid>
```

### `asn budgets get-budgets`

GET `/budgets` — read-only

Gets all budgets for a given _parent_. This will at most return a list of size 1 for a given _parent_.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `--opt-pretty`  | query    | no       | boolean |             |
| `--parent`      | query    | yes      | string  |             |

```bash
asn budgets get-budgets --parent <parent>
```

### `asn budgets update-budget`

PUT `/budgets/{budget_gid}` — **mutates data**

An existing budget can be updated by making a PUT request on the URL for
that budget. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<budget_gid>`  | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn budgets update-budget <budget_gid> --field key=value
```

## custom-field-settings

### `asn custom-field-settings get-custom-field-settings-for-goal`

GET `/goals/{goal_gid}/custom_field_settings` — read-only, paginated

Required scope: goals:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<goal_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn custom-field-settings get-custom-field-settings-for-goal <goal_gid>
```

### `asn custom-field-settings get-custom-field-settings-for-portfolio`

GET `/portfolios/{portfolio_gid}/custom_field_settings` — read-only, paginated

Required scope: portfolios:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<portfolio_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn custom-field-settings get-custom-field-settings-for-portfolio <portfolio_gid>
```

### `asn custom-field-settings get-custom-field-settings-for-project`

GET `/projects/{project_gid}/custom_field_settings` — read-only, paginated

Required scope: projects:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn custom-field-settings get-custom-field-settings-for-project <project_gid>
```

### `asn custom-field-settings get-custom-field-settings-for-team`

GET `/teams/{team_gid}/custom_field_settings` — read-only

Required scope: teams:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<team_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn custom-field-settings get-custom-field-settings-for-team <team_gid>
```

## custom-fields

### `asn custom-fields create-custom-field`

POST `/custom_fields` — **mutates data**

Required scope: custom_fields:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn custom-fields create-custom-field --field key=value
```

### `asn custom-fields create-enum-option-for-custom-field`

POST `/custom_fields/{custom_field_gid}/enum_options` — **mutates data**

Required scope: custom_fields:write

| Flag / argument      | Location | Required | Type                   | Description                                 |
| -------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<custom_field_gid>` | path     | yes      | string                 |                                             |
| `--body-json`        | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`            | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`       | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`       | query    | no       | boolean                |                                             |

```bash
asn custom-fields create-enum-option-for-custom-field <custom_field_gid>
```

### `asn custom-fields delete-custom-field`

DELETE `/custom_fields/{custom_field_gid}` — **mutates data**

A specific, existing custom field can be deleted by making a DELETE request on the URL for that custom field.
Locked custom fields can only be deleted by the user who locked the field.
Returns an empty data record.

| Flag / argument      | Location | Required | Type    | Description |
| -------------------- | -------- | -------- | ------- | ----------- |
| `<custom_field_gid>` | path     | yes      | string  |             |
| `--opt-pretty`       | query    | no       | boolean |             |

```bash
asn custom-fields delete-custom-field <custom_field_gid>
```

### `asn custom-fields get-custom-field`

GET `/custom_fields/{custom_field_gid}` — read-only

Required scope: custom_fields:read

| Flag / argument      | Location | Required | Type               | Description |
| -------------------- | -------- | -------- | ------------------ | ----------- |
| `<custom_field_gid>` | path     | yes      | string             |             |
| `--opt-fields`       | query    | no       | array (repeatable) |             |
| `--opt-pretty`       | query    | no       | boolean            |             |

```bash
asn custom-fields get-custom-field <custom_field_gid>
```

### `asn custom-fields get-custom-fields-for-workspace`

GET `/workspaces/{workspace_gid}/custom_fields` — read-only, paginated

Required scope: custom_fields:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn custom-fields get-custom-fields-for-workspace <workspace_gid>
```

### `asn custom-fields insert-enum-option-for-custom-field`

POST `/custom_fields/{custom_field_gid}/enum_options/insert` — **mutates data**

Required scope: custom_fields:write

| Flag / argument      | Location | Required | Type                   | Description                                 |
| -------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<custom_field_gid>` | path     | yes      | string                 |                                             |
| `--body-json`        | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`            | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`       | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`       | query    | no       | boolean                |                                             |

```bash
asn custom-fields insert-enum-option-for-custom-field <custom_field_gid>
```

### `asn custom-fields update-custom-field`

PUT `/custom_fields/{custom_field_gid}` — **mutates data**

Required scope: custom_fields:write

| Flag / argument      | Location | Required | Type                   | Description                                 |
| -------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<custom_field_gid>` | path     | yes      | string                 |                                             |
| `--body-json`        | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`            | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`       | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`       | query    | no       | boolean                |                                             |

```bash
asn custom-fields update-custom-field <custom_field_gid>
```

### `asn custom-fields update-enum-option`

PUT `/enum_options/{enum_option_gid}` — **mutates data**

Required scope: custom_fields:write

| Flag / argument     | Location | Required | Type                   | Description                                 |
| ------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<enum_option_gid>` | path     | yes      | string                 |                                             |
| `--body-json`       | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`           | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`      | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`      | query    | no       | boolean                |                                             |

```bash
asn custom-fields update-enum-option <enum_option_gid>
```

## custom-types

### `asn custom-types get-custom-type`

GET `/custom_types/{custom_type_gid}` — read-only

Required scope: custom_types:read

| Flag / argument     | Location | Required | Type               | Description |
| ------------------- | -------- | -------- | ------------------ | ----------- |
| `<custom_type_gid>` | path     | yes      | string             |             |
| `--opt-fields`      | query    | no       | array (repeatable) |             |
| `--opt-pretty`      | query    | no       | boolean            |             |

```bash
asn custom-types get-custom-type <custom_type_gid>
```

### `asn custom-types get-custom-types`

GET `/custom_types` — read-only, paginated

Required scope: custom_types:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--project`     | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn custom-types get-custom-types
```

## events

### `asn events get-events`

GET `/events` — read-only

Returns the full record for all events that have occurred since the sync
token was created.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--resource`    | query    | yes      | string             |             |
| `--sync`        | query    | no       | string             |             |

```bash
asn events get-events --resource <resource>
```

## exports

### `asn exports create-graph-export`

POST `/exports/graph` — **mutates data**

Initiates a graph export job for a given parent object
(goal, team, portfolio, or project). The export will be processed asynchronously.
Once initiated, use the jobs endpoint to monitor progress.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |

```bash
asn exports create-graph-export --field key=value
```

### `asn exports create-resource-export`

POST `/exports/resource` — **mutates data**

Initiates a bulk export of resources for a workspace. The export will be processed asynchronously. Once the export has been requested, its progress can be monitored using the jobs endpoint.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |

```bash
asn exports create-resource-export --field key=value
```

## goal-relationships

### `asn goal-relationships add-supporting-relationship`

POST `/goals/{goal_gid}/addSupportingRelationship` — **mutates data**

Creates a goal relationship by adding a supporting resource to a given goal.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goal-relationships add-supporting-relationship <goal_gid> --field key=value
```

### `asn goal-relationships get-goal-relationship`

GET `/goal_relationships/{goal_relationship_gid}` — read-only

Returns the complete updated goal relationship record for a single goal relationship.

| Flag / argument           | Location | Required | Type               | Description |
| ------------------------- | -------- | -------- | ------------------ | ----------- |
| `<goal_relationship_gid>` | path     | yes      | string             |             |
| `--opt-fields`            | query    | no       | array (repeatable) |             |
| `--opt-pretty`            | query    | no       | boolean            |             |

```bash
asn goal-relationships get-goal-relationship <goal_relationship_gid>
```

### `asn goal-relationships get-goal-relationships`

GET `/goal_relationships` — read-only, paginated

Returns compact goal relationship records.

| Flag / argument      | Location | Required | Type               | Description |
| -------------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`            | query    | no       | integer            |             |
| `--offset`           | query    | no       | string             |             |
| `--opt-fields`       | query    | no       | array (repeatable) |             |
| `--opt-pretty`       | query    | no       | boolean            |             |
| `--resource-subtype` | query    | no       | string             |             |
| `--supported-goal`   | query    | yes      | string             |             |

```bash
asn goal-relationships get-goal-relationships --supported-goal <supported_goal>
```

### `asn goal-relationships remove-supporting-relationship`

POST `/goals/{goal_gid}/removeSupportingRelationship` — **mutates data**

Removes a goal relationship for a given parent goal.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goal-relationships remove-supporting-relationship <goal_gid> --field key=value
```

### `asn goal-relationships update-goal-relationship`

PUT `/goal_relationships/{goal_relationship_gid}` — **mutates data**

An existing goal relationship can be updated by making a PUT request on the URL for
that goal relationship. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged.

| Flag / argument           | Location | Required | Type                   | Description                                 |
| ------------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_relationship_gid>` | path     | yes      | string                 |                                             |
| `--body-json`             | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`                 | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`            | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`            | query    | no       | boolean                |                                             |

```bash
asn goal-relationships update-goal-relationship <goal_relationship_gid> --field key=value
```

## goals

### `asn goals add-custom-field-setting-for-goal`

POST `/goals/{goal_gid}/addCustomFieldSetting` — **mutates data**

Required scope: goals:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals add-custom-field-setting-for-goal <goal_gid> --field key=value
```

### `asn goals add-followers`

POST `/goals/{goal_gid}/addFollowers` — **mutates data**

Adds followers to a goal. Returns the goal the followers were added to.
Each goal can be associated with zero or more followers in the system.
Requests to add/remove followers, if successful, will return the complete updated goal record, described above.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals add-followers <goal_gid> --field key=value
```

### `asn goals create-goal`

POST `/goals` — **mutates data**

Creates a new goal in a workspace or team.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals create-goal --field key=value
```

### `asn goals create-goal-metric`

POST `/goals/{goal_gid}/setMetric` — **mutates data**

Creates and adds a goal metric to a specified goal. Note that this replaces an existing goal metric if one already exists.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals create-goal-metric <goal_gid> --field key=value
```

### `asn goals delete-goal`

DELETE `/goals/{goal_gid}` — **mutates data**

A specific, existing goal can be deleted by making a DELETE request on the URL for that goal.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<goal_gid>`    | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn goals delete-goal <goal_gid>
```

### `asn goals get-goal`

GET `/goals/{goal_gid}` — read-only

Required scope: goals:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<goal_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn goals get-goal <goal_gid>
```

### `asn goals get-goals`

GET `/goals` — read-only, paginated

Required scope: goals:read

| Flag / argument        | Location | Required | Type               | Description |
| ---------------------- | -------- | -------- | ------------------ | ----------- |
| `--is-workspace-level` | query    | no       | boolean            |             |
| `--limit`              | query    | no       | integer            |             |
| `--offset`             | query    | no       | string             |             |
| `--opt-fields`         | query    | no       | array (repeatable) |             |
| `--opt-pretty`         | query    | no       | boolean            |             |
| `--portfolio`          | query    | no       | string             |             |
| `--project`            | query    | no       | string             |             |
| `--task`               | query    | no       | string             |             |
| `--team`               | query    | no       | string             |             |
| `--time-periods`       | query    | no       | array (repeatable) |             |
| `--workspace`          | query    | no       | string             |             |

```bash
asn goals get-goals
```

### `asn goals get-parent-goals-for-goal`

GET `/goals/{goal_gid}/parentGoals` — read-only

Required scope: goals:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<goal_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn goals get-parent-goals-for-goal <goal_gid>
```

### `asn goals remove-custom-field-setting-for-goal`

POST `/goals/{goal_gid}/removeCustomFieldSetting` — **mutates data**

Required scope: goals:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals remove-custom-field-setting-for-goal <goal_gid> --field key=value
```

### `asn goals remove-followers`

POST `/goals/{goal_gid}/removeFollowers` — **mutates data**

Removes followers from a goal. Returns the goal the followers were removed from.
Each goal can be associated with zero or more followers in the system.
Requests to add/remove followers, if successful, will return the complete updated goal record, described above.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals remove-followers <goal_gid> --field key=value
```

### `asn goals update-goal`

PUT `/goals/{goal_gid}` — **mutates data**

An existing goal can be updated by making a PUT request on the URL for
that goal. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals update-goal <goal_gid> --field key=value
```

### `asn goals update-goal-metric`

POST `/goals/{goal_gid}/setMetricCurrentValue` — **mutates data**

Updates a goal's existing metric's `current_number_value` if one exists,
otherwise responds with a 400 status code.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn goals update-goal-metric <goal_gid> --field key=value
```

## jobs

### `asn jobs get-job`

GET `/jobs/{job_gid}` — read-only

Required scope: jobs:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<job_gid>`     | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn jobs get-job <job_gid>
```

## memberships

### `asn memberships create-membership`

POST `/memberships` — **mutates data**

Creates a new membership in a `goal`, `project`, `portfolio`, `custom_type`, or `custom_field`, where members can be Teams or Users.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn memberships create-membership
```

### `asn memberships delete-membership`

DELETE `/memberships/{membership_gid}` — **mutates data**

A specific, existing membership for a `goal`, `project`, `portfolio`, `custom_type`, or `custom_field` can be deleted by making a `DELETE` request
on the URL for that membership.

| Flag / argument    | Location | Required | Type    | Description |
| ------------------ | -------- | -------- | ------- | ----------- |
| `<membership_gid>` | path     | yes      | string  |             |
| `--opt-pretty`     | query    | no       | boolean |             |

```bash
asn memberships delete-membership <membership_gid>
```

### `asn memberships get-membership`

GET `/memberships/{membership_gid}` — read-only

Returns a `project_membership`, `goal_membership`, `portfolio_membership`, `custom_type_membership`, or `custom_field_membership` record for a membership id.

| Flag / argument    | Location | Required | Type    | Description |
| ------------------ | -------- | -------- | ------- | ----------- |
| `<membership_gid>` | path     | yes      | string  |             |
| `--opt-pretty`     | query    | no       | boolean |             |

```bash
asn memberships get-membership <membership_gid>
```

### `asn memberships get-memberships`

GET `/memberships` — read-only, paginated

Returns compact `goal_membership`, `project_membership`, `portfolio_membership`, `custom_type_membership`, or `custom_field_membership` records. The possible types for `parent` in this request are `goal`, `project`, `portfolio`, `custom_type`, or `custom_field`. An additional member (user GID or team GID) can be passed in to filter to a specific membership.

| Flag / argument      | Location | Required | Type               | Description |
| -------------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`            | query    | no       | integer            |             |
| `--member`           | query    | no       | string             |             |
| `--offset`           | query    | no       | string             |             |
| `--opt-fields`       | query    | no       | array (repeatable) |             |
| `--opt-pretty`       | query    | no       | boolean            |             |
| `--parent`           | query    | no       | string             |             |
| `--resource-subtype` | query    | no       | string             |             |

```bash
asn memberships get-memberships
```

### `asn memberships update-membership`

PUT `/memberships/{membership_gid}` — **mutates data**

An existing membership can be updated by making a `PUT` request on the membership. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged. Memberships on `goals`, `projects`, `portfolios`, `custom_types`, and `custom_fields` can be updated.

| Flag / argument    | Location | Required | Type                   | Description                                 |
| ------------------ | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<membership_gid>` | path     | yes      | string                 |                                             |
| `--body-json`      | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`          | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`     | query    | no       | boolean                |                                             |

```bash
asn memberships update-membership <membership_gid> --field key=value
```

## ooo-entries

### `asn ooo-entries create-ooo-entry`

POST `/ooo_entries` — **mutates data**

Required scope: ooo_entries:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn ooo-entries create-ooo-entry --field key=value
```

### `asn ooo-entries delete-ooo-entry`

DELETE `/ooo_entries/{ooo_entry_gid}` — **mutates data**

Required scope: ooo_entries:delete

| Flag / argument   | Location | Required | Type    | Description |
| ----------------- | -------- | -------- | ------- | ----------- |
| `<ooo_entry_gid>` | path     | yes      | string  |             |
| `--opt-pretty`    | query    | no       | boolean |             |

```bash
asn ooo-entries delete-ooo-entry <ooo_entry_gid>
```

### `asn ooo-entries get-ooo-entries`

GET `/ooo_entries` — read-only, paginated

Required scope: ooo_entries:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--end-date`    | query    | no       | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--start-date`  | query    | no       | string             |             |
| `--user`        | query    | yes      | string             |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn ooo-entries get-ooo-entries --user <user> --workspace <workspace>
```

### `asn ooo-entries get-ooo-entry`

GET `/ooo_entries/{ooo_entry_gid}` — read-only

Required scope: ooo_entries:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<ooo_entry_gid>` | path     | yes      | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn ooo-entries get-ooo-entry <ooo_entry_gid>
```

### `asn ooo-entries update-ooo-entry`

PUT `/ooo_entries/{ooo_entry_gid}` — **mutates data**

Required scope: ooo_entries:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<ooo_entry_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn ooo-entries update-ooo-entry <ooo_entry_gid> --field key=value
```

## organization-exports

### `asn organization-exports create-organization-export`

POST `/organization_exports` — **mutates data**

This method creates a request to export an Organization. Asana will complete the export at some point after you create the request.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn organization-exports create-organization-export --field key=value
```

### `asn organization-exports get-organization-export`

GET `/organization_exports/{organization_export_gid}` — read-only

Returns details of a previously-requested Organization export.

| Flag / argument             | Location | Required | Type               | Description |
| --------------------------- | -------- | -------- | ------------------ | ----------- |
| `<organization_export_gid>` | path     | yes      | string             |             |
| `--opt-fields`              | query    | no       | array (repeatable) |             |
| `--opt-pretty`              | query    | no       | boolean            |             |

```bash
asn organization-exports get-organization-export <organization_export_gid>
```

## portfolio-memberships

### `asn portfolio-memberships get-portfolio-membership`

GET `/portfolio_memberships/{portfolio_membership_gid}` — read-only

Returns the complete portfolio record for a single portfolio membership.

| Flag / argument              | Location | Required | Type               | Description |
| ---------------------------- | -------- | -------- | ------------------ | ----------- |
| `<portfolio_membership_gid>` | path     | yes      | string             |             |
| `--opt-fields`               | query    | no       | array (repeatable) |             |
| `--opt-pretty`               | query    | no       | boolean            |             |

```bash
asn portfolio-memberships get-portfolio-membership <portfolio_membership_gid>
```

### `asn portfolio-memberships get-portfolio-memberships`

GET `/portfolio_memberships` — read-only, paginated

Returns a list of portfolio memberships in compact representation. You must specify `portfolio`, `portfolio` and `user`, or `workspace` and `user`.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--portfolio`   | query    | no       | string             |             |
| `--user`        | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn portfolio-memberships get-portfolio-memberships
```

### `asn portfolio-memberships get-portfolio-memberships-for-portfolio`

GET `/portfolios/{portfolio_gid}/portfolio_memberships` — read-only, paginated

Returns the compact portfolio membership records for the portfolio.

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<portfolio_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |
| `--user`          | query    | no       | string             |             |

```bash
asn portfolio-memberships get-portfolio-memberships-for-portfolio <portfolio_gid>
```

## portfolios

### `asn portfolios add-custom-field-setting-for-portfolio`

POST `/portfolios/{portfolio_gid}/addCustomFieldSetting` — **mutates data**

Required scope: portfolios:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios add-custom-field-setting-for-portfolio <portfolio_gid> --field key=value
```

### `asn portfolios add-item-for-portfolio`

POST `/portfolios/{portfolio_gid}/addItem` — **mutates data**

Required scope: portfolios:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios add-item-for-portfolio <portfolio_gid> --field key=value
```

### `asn portfolios add-members-for-portfolio`

POST `/portfolios/{portfolio_gid}/addMembers` — **mutates data**

Adds the specified list of users as members of the portfolio.
Returns the updated portfolio record.

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios add-members-for-portfolio <portfolio_gid> --field key=value
```

### `asn portfolios create-portfolio`

POST `/portfolios` — **mutates data**

Required scope: portfolios:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn portfolios create-portfolio --field key=value
```

### `asn portfolios delete-portfolio`

DELETE `/portfolios/{portfolio_gid}` — **mutates data**

An existing portfolio can be deleted by making a DELETE request on
the URL for that portfolio.

| Flag / argument   | Location | Required | Type    | Description |
| ----------------- | -------- | -------- | ------- | ----------- |
| `<portfolio_gid>` | path     | yes      | string  |             |
| `--opt-pretty`    | query    | no       | boolean |             |

```bash
asn portfolios delete-portfolio <portfolio_gid>
```

### `asn portfolios duplicate-portfolio`

POST `/portfolios/{portfolio_gid}/duplicate` — **mutates data**

Required scope: portfolios:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios duplicate-portfolio <portfolio_gid>
```

### `asn portfolios get-items-for-portfolio`

GET `/portfolios/{portfolio_gid}/items` — read-only, paginated

Required scope: portfolios:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<portfolio_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn portfolios get-items-for-portfolio <portfolio_gid>
```

### `asn portfolios get-portfolio`

GET `/portfolios/{portfolio_gid}` — read-only

Required scope: portfolios:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<portfolio_gid>` | path     | yes      | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn portfolios get-portfolio <portfolio_gid>
```

### `asn portfolios get-portfolios`

GET `/portfolios` — read-only, paginated

Required scope: portfolios:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--custom-type` | query    | no       | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--owner`       | query    | no       | string             |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn portfolios get-portfolios --workspace <workspace>
```

### `asn portfolios remove-custom-field-setting-for-portfolio`

POST `/portfolios/{portfolio_gid}/removeCustomFieldSetting` — **mutates data**

Required scope: portfolios:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios remove-custom-field-setting-for-portfolio <portfolio_gid> --field key=value
```

### `asn portfolios remove-item-for-portfolio`

POST `/portfolios/{portfolio_gid}/removeItem` — **mutates data**

Required scope: portfolios:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios remove-item-for-portfolio <portfolio_gid> --field key=value
```

### `asn portfolios remove-members-for-portfolio`

POST `/portfolios/{portfolio_gid}/removeMembers` — **mutates data**

Removes the specified list of users from members of the portfolio.
Returns the updated portfolio record.

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios remove-members-for-portfolio <portfolio_gid> --field key=value
```

### `asn portfolios update-portfolio`

PUT `/portfolios/{portfolio_gid}` — **mutates data**

Required scope: portfolios:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<portfolio_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn portfolios update-portfolio <portfolio_gid> --field key=value
```

## project-briefs

### `asn project-briefs create-project-brief`

POST `/projects/{project_gid}/project_briefs` — **mutates data**

Creates a new project brief.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn project-briefs create-project-brief <project_gid> --field key=value
```

### `asn project-briefs delete-project-brief`

DELETE `/project_briefs/{project_brief_gid}` — **mutates data**

Deletes a specific, existing project brief.

| Flag / argument       | Location | Required | Type    | Description |
| --------------------- | -------- | -------- | ------- | ----------- |
| `<project_brief_gid>` | path     | yes      | string  |             |
| `--opt-pretty`        | query    | no       | boolean |             |

```bash
asn project-briefs delete-project-brief <project_brief_gid>
```

### `asn project-briefs get-project-brief`

GET `/project_briefs/{project_brief_gid}` — read-only

Get the full record for a project brief.

| Flag / argument       | Location | Required | Type               | Description |
| --------------------- | -------- | -------- | ------------------ | ----------- |
| `<project_brief_gid>` | path     | yes      | string             |             |
| `--opt-fields`        | query    | no       | array (repeatable) |             |
| `--opt-pretty`        | query    | no       | boolean            |             |

```bash
asn project-briefs get-project-brief <project_brief_gid>
```

### `asn project-briefs update-project-brief`

PUT `/project_briefs/{project_brief_gid}` — **mutates data**

An existing project brief can be updated by making a PUT request on the URL for
that project brief. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged.

| Flag / argument       | Location | Required | Type                   | Description                                 |
| --------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_brief_gid>` | path     | yes      | string                 |                                             |
| `--body-json`         | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`             | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`        | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`        | query    | no       | boolean                |                                             |

```bash
asn project-briefs update-project-brief <project_brief_gid> --field key=value
```

## project-memberships

### `asn project-memberships get-project-membership`

GET `/project_memberships/{project_membership_gid}` — read-only

Returns the complete project record for a single project membership.

| Flag / argument            | Location | Required | Type               | Description |
| -------------------------- | -------- | -------- | ------------------ | ----------- |
| `<project_membership_gid>` | path     | yes      | string             |             |
| `--opt-fields`             | query    | no       | array (repeatable) |             |
| `--opt-pretty`             | query    | no       | boolean            |             |

```bash
asn project-memberships get-project-membership <project_membership_gid>
```

### `asn project-memberships get-project-memberships-for-project`

GET `/projects/{project_gid}/project_memberships` — read-only, paginated

Returns the compact project membership records for the project.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--user`        | query    | no       | string             |             |

```bash
asn project-memberships get-project-memberships-for-project <project_gid>
```

## project-portfolio-settings

### `asn project-portfolio-settings get-project-portfolio-setting`

GET `/project_portfolio_settings/{project_portfolio_setting_gid}` — read-only

Required scope: project_portfolio_settings:read

| Flag / argument                   | Location | Required | Type               | Description |
| --------------------------------- | -------- | -------- | ------------------ | ----------- |
| `<project_portfolio_setting_gid>` | path     | yes      | string             |             |
| `--opt-fields`                    | query    | no       | array (repeatable) |             |
| `--opt-pretty`                    | query    | no       | boolean            |             |

```bash
asn project-portfolio-settings get-project-portfolio-setting <project_portfolio_setting_gid>
```

### `asn project-portfolio-settings get-project-portfolio-settings-for-portfolio`

GET `/portfolios/{portfolio_gid}/project_portfolio_settings` — read-only, paginated

Required scope: project_portfolio_settings:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<portfolio_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn project-portfolio-settings get-project-portfolio-settings-for-portfolio <portfolio_gid>
```

### `asn project-portfolio-settings get-project-portfolio-settings-for-project`

GET `/projects/{project_gid}/project_portfolio_settings` — read-only, paginated

Required scope: project_portfolio_settings:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn project-portfolio-settings get-project-portfolio-settings-for-project <project_gid>
```

### `asn project-portfolio-settings update-project-portfolio-setting`

PUT `/project_portfolio_settings/{project_portfolio_setting_gid}` — **mutates data**

Required scope: project_portfolio_settings:write

| Flag / argument                   | Location | Required | Type                   | Description                                 |
| --------------------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_portfolio_setting_gid>` | path     | yes      | string                 |                                             |
| `--body-json`                     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`                         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`                    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`                    | query    | no       | boolean                |                                             |

```bash
asn project-portfolio-settings update-project-portfolio-setting <project_portfolio_setting_gid> --field key=value
```

## project-statuses

### `asn project-statuses create-project-status-for-project`

POST `/projects/{project_gid}/project_statuses` — **mutates data**

_Deprecated: new integrations should prefer the `/status_updates` route._

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn project-statuses create-project-status-for-project <project_gid> --field key=value
```

### `asn project-statuses delete-project-status`

DELETE `/project_statuses/{project_status_gid}` — **mutates data**

_Deprecated: new integrations should prefer the `/status_updates/{status_gid}` route._

| Flag / argument        | Location | Required | Type    | Description |
| ---------------------- | -------- | -------- | ------- | ----------- |
| `<project_status_gid>` | path     | yes      | string  |             |
| `--opt-pretty`         | query    | no       | boolean |             |

```bash
asn project-statuses delete-project-status <project_status_gid>
```

### `asn project-statuses get-project-status`

GET `/project_statuses/{project_status_gid}` — read-only

_Deprecated: new integrations should prefer the `/status_updates/{status_gid}` route._

| Flag / argument        | Location | Required | Type               | Description |
| ---------------------- | -------- | -------- | ------------------ | ----------- |
| `<project_status_gid>` | path     | yes      | string             |             |
| `--opt-fields`         | query    | no       | array (repeatable) |             |
| `--opt-pretty`         | query    | no       | boolean            |             |

```bash
asn project-statuses get-project-status <project_status_gid>
```

### `asn project-statuses get-project-statuses-for-project`

GET `/projects/{project_gid}/project_statuses` — read-only, paginated

_Deprecated: new integrations should prefer the `/status_updates` route._

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn project-statuses get-project-statuses-for-project <project_gid>
```

## project-templates

### `asn project-templates delete-project-template`

DELETE `/project_templates/{project_template_gid}` — **mutates data**

A specific, existing project template can be deleted by making a DELETE request on the URL for that project template.

| Flag / argument          | Location | Required | Type    | Description |
| ------------------------ | -------- | -------- | ------- | ----------- |
| `<project_template_gid>` | path     | yes      | string  |             |
| `--opt-pretty`           | query    | no       | boolean |             |

```bash
asn project-templates delete-project-template <project_template_gid>
```

### `asn project-templates get-project-template`

GET `/project_templates/{project_template_gid}` — read-only

Required scope: project_templates:read

| Flag / argument          | Location | Required | Type               | Description |
| ------------------------ | -------- | -------- | ------------------ | ----------- |
| `<project_template_gid>` | path     | yes      | string             |             |
| `--opt-fields`           | query    | no       | array (repeatable) |             |
| `--opt-pretty`           | query    | no       | boolean            |             |

```bash
asn project-templates get-project-template <project_template_gid>
```

### `asn project-templates get-project-templates`

GET `/project_templates` — read-only, paginated

Required scope: project_templates:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--team`        | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn project-templates get-project-templates
```

### `asn project-templates get-project-templates-for-team`

GET `/teams/{team_gid}/project_templates` — read-only, paginated

Required scope: project_templates:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<team_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn project-templates get-project-templates-for-team <team_gid>
```

### `asn project-templates instantiate-project`

POST `/project_templates/{project_template_gid}/instantiateProject` — **mutates data**

Required scope: projects:write

| Flag / argument          | Location | Required | Type                   | Description                                 |
| ------------------------ | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_template_gid>` | path     | yes      | string                 |                                             |
| `--body-json`            | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`                | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`           | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`           | query    | no       | boolean                |                                             |

```bash
asn project-templates instantiate-project <project_template_gid>
```

## projects

### `asn projects add-custom-field-setting-for-project`

POST `/projects/{project_gid}/addCustomFieldSetting` — **mutates data**

Required scope: projects:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects add-custom-field-setting-for-project <project_gid> --field key=value
```

### `asn projects add-followers-for-project`

POST `/projects/{project_gid}/addFollowers` — **mutates data**

Adds the specified list of users as followers to the project. Followers are a subset of members who have opted in to receive "tasks added" notifications for a project. Therefore, if the users are not already members of the project, they will also become members as a result of this operation.
Returns the updated project record.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects add-followers-for-project <project_gid> --field key=value
```

### `asn projects add-members-for-project`

POST `/projects/{project_gid}/addMembers` — **mutates data**

Adds the specified list of users as members of the project. Note that a user being added as a member may also be added as a _follower_ as a result of this operation. This is because the user's default notification settings (i.e., in the "Notifications" tab of "My Profile Settings") will override this endpoint's default behavior of setting "Tasks added" notifications to `false`.
Returns the updated project record.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects add-members-for-project <project_gid> --field key=value
```

### `asn projects create-project`

POST `/projects` — **mutates data**

Required scope: projects:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects create-project --field key=value
```

### `asn projects create-project-for-team`

POST `/teams/{team_gid}/projects` — **mutates data**

Required scope: projects:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<team_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects create-project-for-team <team_gid> --field key=value
```

### `asn projects create-project-for-workspace`

POST `/workspaces/{workspace_gid}/projects` — **mutates data**

Required scope: projects:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<workspace_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn projects create-project-for-workspace <workspace_gid> --field key=value
```

### `asn projects delete-project`

DELETE `/projects/{project_gid}` — **mutates data**

Required scope: projects:delete

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<project_gid>` | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn projects delete-project <project_gid>
```

### `asn projects duplicate-project`

POST `/projects/{project_gid}/duplicate` — **mutates data**

Required scope: projects:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects duplicate-project <project_gid>
```

### `asn projects get-project`

GET `/projects/{project_gid}` — read-only

Required scope: projects:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn projects get-project <project_gid>
```

### `asn projects get-projects`

GET `/projects` — read-only, paginated

Required scope: projects:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--archived`    | query    | no       | boolean            |             |
| `--custom-type` | query    | no       | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--team`        | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn projects get-projects
```

### `asn projects get-projects-for-task`

GET `/tasks/{task_gid}/projects` — read-only, paginated

Required scope: projects:read

| Flag / argument                | Location | Required | Type               | Description |
| ------------------------------ | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`                   | path     | yes      | string             |             |
| `--include-inherited-projects` | query    | no       | boolean            |             |
| `--limit`                      | query    | no       | integer            |             |
| `--offset`                     | query    | no       | string             |             |
| `--opt-fields`                 | query    | no       | array (repeatable) |             |
| `--opt-pretty`                 | query    | no       | boolean            |             |

```bash
asn projects get-projects-for-task <task_gid>
```

### `asn projects get-projects-for-team`

GET `/teams/{team_gid}/projects` — read-only, paginated

Required scope: projects:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<team_gid>`    | path     | yes      | string             |             |
| `--archived`    | query    | no       | boolean            |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn projects get-projects-for-team <team_gid>
```

### `asn projects get-projects-for-workspace`

GET `/workspaces/{workspace_gid}/projects` — read-only, paginated

Required scope: projects:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--archived`      | query    | no       | boolean            |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn projects get-projects-for-workspace <workspace_gid>
```

### `asn projects get-task-counts-for-project`

GET `/projects/{project_gid}/task_counts` — read-only

Required scope: projects:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn projects get-task-counts-for-project <project_gid>
```

### `asn projects project-save-as-template`

POST `/projects/{project_gid}/saveAsTemplate` — **mutates data**

Creates and returns a job that will asynchronously handle the project template creation.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects project-save-as-template <project_gid> --field key=value
```

### `asn projects remove-custom-field-setting-for-project`

POST `/projects/{project_gid}/removeCustomFieldSetting` — **mutates data**

Required scope: projects:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects remove-custom-field-setting-for-project <project_gid> --field key=value
```

### `asn projects remove-followers-for-project`

POST `/projects/{project_gid}/removeFollowers` — **mutates data**

Removes the specified list of users from following the project, this will not affect project membership status.
Returns the updated project record.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects remove-followers-for-project <project_gid> --field key=value
```

### `asn projects remove-members-for-project`

POST `/projects/{project_gid}/removeMembers` — **mutates data**

Removes the specified list of users from members of the project.
Returns the updated project record.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects remove-members-for-project <project_gid> --field key=value
```

### `asn projects search-projects-for-workspace`

GET `/workspaces/{workspace_gid}/projects/search` — read-only

Required scope: projects:read

| Flag / argument         | Location | Required | Type               | Description |
| ----------------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>`       | path     | yes      | string             |             |
| `--completed`           | query    | no       | boolean            |             |
| `--completed-at-after`  | query    | no       | string             |             |
| `--completed-at-before` | query    | no       | string             |             |
| `--completed-on`        | query    | no       | string             |             |
| `--completed-on-after`  | query    | no       | string             |             |
| `--completed-on-before` | query    | no       | string             |             |
| `--created-at-after`    | query    | no       | string             |             |
| `--created-at-before`   | query    | no       | string             |             |
| `--created-on`          | query    | no       | string             |             |
| `--created-on-after`    | query    | no       | string             |             |
| `--created-on-before`   | query    | no       | string             |             |
| `--due-at-after`        | query    | no       | string             |             |
| `--due-at-before`       | query    | no       | string             |             |
| `--due-on`              | query    | no       | string             |             |
| `--due-on-after`        | query    | no       | string             |             |
| `--due-on-before`       | query    | no       | string             |             |
| `--members-any`         | query    | no       | string             |             |
| `--members-not`         | query    | no       | string             |             |
| `--opt-fields`          | query    | no       | array (repeatable) |             |
| `--opt-pretty`          | query    | no       | boolean            |             |
| `--owner-any`           | query    | no       | string             |             |
| `--portfolios-any`      | query    | no       | string             |             |
| `--sort-ascending`      | query    | no       | boolean            |             |
| `--sort-by`             | query    | no       | string             |             |
| `--start-on`            | query    | no       | string             |             |
| `--start-on-after`      | query    | no       | string             |             |
| `--start-on-before`     | query    | no       | string             |             |
| `--teams-any`           | query    | no       | string             |             |
| `--text`                | query    | no       | string             |             |

```bash
asn projects search-projects-for-workspace <workspace_gid>
```

### `asn projects update-project`

PUT `/projects/{project_gid}` — **mutates data**

Required scope: projects:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn projects update-project <project_gid> --field key=value
```

## rates

### `asn rates create-rate`

POST `/rates` — **mutates data**

Creates a new rate for a `parent` + `resource` combination.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn rates create-rate --field key=value
```

### `asn rates delete-rate`

DELETE `/rates/{rate_gid}` — **mutates data**

Deletes a rate.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<rate_gid>`    | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn rates delete-rate <rate_gid>
```

### `asn rates get-rate`

GET `/rates/{rate_gid}` — read-only

Returns the complete rate record for a single rate.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<rate_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn rates get-rate <rate_gid>
```

### `asn rates get-rates`

GET `/rates` — read-only, paginated

Returns a list of `rate` records. The possible types for `parent` in this request are `project`. An additional `resource` (`user` GID or `placeholder` GID) can be passed in to filter to a specific rate.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--parent`      | query    | no       | string             |             |
| `--resource`    | query    | no       | string             |             |

```bash
asn rates get-rates
```

### `asn rates update-rate`

PUT `/rates/{rate_gid}` — **mutates data**

An existing rate can be updated by making a PUT request on the URL for
that rate. Only the fields provided in the `data` block will be updated;
any unspecified fields will remain unchanged. (note that at this time, the only field that can be updated is the `rate` field.)

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<rate_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn rates update-rate <rate_gid> --field key=value
```

## reactions

### `asn reactions get-reactions-on-object`

GET `/reactions` — read-only, paginated

Returns the reactions with a specified emoji base character on the object.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `--emoji-base`  | query    | yes      | string  |             |
| `--limit`       | query    | no       | integer |             |
| `--offset`      | query    | no       | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |
| `--target`      | query    | yes      | string  |             |

```bash
asn reactions get-reactions-on-object --emoji-base <emoji_base> --target <target>
```

## roles

### `asn roles create-role`

POST `/roles` — **mutates data**

Required scope: roles:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn roles create-role --field key=value
```

### `asn roles delete-role`

DELETE `/roles/{role_gid}` — **mutates data**

Required scope: roles:delete

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<role_gid>`    | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn roles delete-role <role_gid>
```

### `asn roles get-role`

GET `/roles/{role_gid}` — read-only

Required scope: roles:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<role_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn roles get-role <role_gid>
```

### `asn roles get-roles`

GET `/roles` — read-only, paginated

Required scope: roles:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--archived`    | query    | no       | boolean            |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn roles get-roles
```

### `asn roles update-role`

PUT `/roles/{role_gid}` — **mutates data**

Required scope: roles:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<role_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn roles update-role <role_gid> --field key=value
```

## rules

### `asn rules trigger-rule`

POST `/rule_triggers/{rule_trigger_gid}/run` — **mutates data**

Trigger a rule which uses an "incoming web request" trigger.

| Flag / argument      | Location | Required | Type                   | Description                                 |
| -------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<rule_trigger_gid>` | path     | yes      | string                 |                                             |
| `--body-json`        | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`            | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |

```bash
asn rules trigger-rule <rule_trigger_gid> --field key=value
```

## sections

### `asn sections add-task-for-section`

POST `/sections/{section_gid}/addTask` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<section_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn sections add-task-for-section <section_gid>
```

### `asn sections create-section-for-project`

POST `/projects/{project_gid}/sections` — **mutates data**

Creates a new section in a project.
Returns the full record of the newly created section.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn sections create-section-for-project <project_gid>
```

### `asn sections delete-section`

DELETE `/sections/{section_gid}` — **mutates data**

A specific, existing section can be deleted by making a DELETE request on
the URL for that section.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<section_gid>` | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn sections delete-section <section_gid>
```

### `asn sections get-section`

GET `/sections/{section_gid}` — read-only

Returns the complete record for a single section.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<section_gid>` | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn sections get-section <section_gid>
```

### `asn sections get-sections-for-project`

GET `/projects/{project_gid}/sections` — read-only, paginated

Returns the compact records for all sections in the specified project.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>` | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn sections get-sections-for-project <project_gid>
```

### `asn sections insert-section-for-project`

POST `/projects/{project_gid}/sections/insert` — **mutates data**

Move sections relative to each other. One of
`before_section` or `after_section` is required.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<project_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn sections insert-section-for-project <project_gid>
```

### `asn sections update-section`

PUT `/sections/{section_gid}` — **mutates data**

A specific, existing section can be updated by making a PUT request on
the URL for that project. Only the fields provided in the `data` block
will be updated; any unspecified fields will remain unchanged. (note that
at this time, the only field that can be updated is the `name` field.)

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<section_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn sections update-section <section_gid>
```

## status-updates

### `asn status-updates create-status-for-object`

POST `/status_updates` — **mutates data**, paginated

Creates a new status update on an object.
Returns the full record of the newly created status update.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--limit`       | query    | no       | integer                |                                             |
| `--offset`      | query    | no       | string                 |                                             |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn status-updates create-status-for-object --field key=value
```

### `asn status-updates delete-status`

DELETE `/status_updates/{status_update_gid}` — **mutates data**

Deletes a specific, existing status update.

| Flag / argument       | Location | Required | Type    | Description |
| --------------------- | -------- | -------- | ------- | ----------- |
| `<status_update_gid>` | path     | yes      | string  |             |
| `--opt-pretty`        | query    | no       | boolean |             |

```bash
asn status-updates delete-status <status_update_gid>
```

### `asn status-updates get-status`

GET `/status_updates/{status_update_gid}` — read-only

Returns the complete record for a single status update.

| Flag / argument       | Location | Required | Type               | Description |
| --------------------- | -------- | -------- | ------------------ | ----------- |
| `<status_update_gid>` | path     | yes      | string             |             |
| `--opt-fields`        | query    | no       | array (repeatable) |             |
| `--opt-pretty`        | query    | no       | boolean            |             |

```bash
asn status-updates get-status <status_update_gid>
```

### `asn status-updates get-statuses-for-object`

GET `/status_updates` — read-only, paginated

Returns the compact status update records for all updates on the object.

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `--created-since` | query    | no       | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |
| `--parent`        | query    | yes      | string             |             |

```bash
asn status-updates get-statuses-for-object --parent <parent>
```

## stories

### `asn stories create-story-for-goal`

POST `/goals/{goal_gid}/stories` — **mutates data**

Required scope: stories:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<goal_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn stories create-story-for-goal <goal_gid> --field key=value
```

### `asn stories create-story-for-task`

POST `/tasks/{task_gid}/stories` — **mutates data**

Required scope: stories:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn stories create-story-for-task <task_gid> --field key=value
```

### `asn stories delete-story`

DELETE `/stories/{story_gid}` — **mutates data**

Required scope: stories:delete

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<story_gid>`   | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn stories delete-story <story_gid>
```

### `asn stories get-stories-for-goal`

GET `/goals/{goal_gid}/stories` — read-only, paginated

Required scope: stories:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<goal_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn stories get-stories-for-goal <goal_gid>
```

### `asn stories get-stories-for-task`

GET `/tasks/{task_gid}/stories` — read-only, paginated

Required scope: stories:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn stories get-stories-for-task <task_gid>
```

### `asn stories get-story`

GET `/stories/{story_gid}` — read-only

Required scope: stories:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<story_gid>`   | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn stories get-story <story_gid>
```

### `asn stories update-story`

PUT `/stories/{story_gid}` — **mutates data**

Required scope: stories:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<story_gid>`   | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn stories update-story <story_gid> --field key=value
```

## tags

### `asn tags create-tag`

POST `/tags` — **mutates data**

Required scope: tags:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tags create-tag --field key=value
```

### `asn tags create-tag-for-workspace`

POST `/workspaces/{workspace_gid}/tags` — **mutates data**

Required scope: tags:write

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<workspace_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn tags create-tag-for-workspace <workspace_gid> --field key=value
```

### `asn tags delete-tag`

DELETE `/tags/{tag_gid}` — **mutates data**

A specific, existing tag can be deleted by making a DELETE request on
the URL for that tag.

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<tag_gid>`     | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn tags delete-tag <tag_gid>
```

### `asn tags get-tag`

GET `/tags/{tag_gid}` — read-only

Required scope: tags:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<tag_gid>`     | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tags get-tag <tag_gid>
```

### `asn tags get-tags`

GET `/tags` — read-only, paginated

Required scope: tags:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn tags get-tags
```

### `asn tags get-tags-for-task`

GET `/tasks/{task_gid}/tags` — read-only, paginated

Required scope: tags:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tags get-tags-for-task <task_gid>
```

### `asn tags get-tags-for-workspace`

GET `/workspaces/{workspace_gid}/tags` — read-only, paginated

Required scope: tags:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn tags get-tags-for-workspace <workspace_gid>
```

### `asn tags update-tag`

PUT `/tags/{tag_gid}` — **mutates data**

Required scope: tags:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<tag_gid>`     | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tags update-tag <tag_gid> --field key=value
```

## task-templates

### `asn task-templates delete-task-template`

DELETE `/task_templates/{task_template_gid}` — **mutates data**

A specific, existing task template can be deleted by making a DELETE request on the URL for that task template. Returns an empty data record.

| Flag / argument       | Location | Required | Type    | Description |
| --------------------- | -------- | -------- | ------- | ----------- |
| `<task_template_gid>` | path     | yes      | string  |             |
| `--opt-pretty`        | query    | no       | boolean |             |

```bash
asn task-templates delete-task-template <task_template_gid>
```

### `asn task-templates get-task-template`

GET `/task_templates/{task_template_gid}` — read-only

Required scope: task_templates:read

| Flag / argument       | Location | Required | Type               | Description |
| --------------------- | -------- | -------- | ------------------ | ----------- |
| `<task_template_gid>` | path     | yes      | string             |             |
| `--opt-fields`        | query    | no       | array (repeatable) |             |
| `--opt-pretty`        | query    | no       | boolean            |             |

```bash
asn task-templates get-task-template <task_template_gid>
```

### `asn task-templates get-task-templates`

GET `/task_templates` — read-only, paginated

Required scope: task_templates:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--project`     | query    | no       | string             |             |

```bash
asn task-templates get-task-templates
```

### `asn task-templates instantiate-task`

POST `/task_templates/{task_template_gid}/instantiateTask` — **mutates data**

Creates and returns a job that will asynchronously handle the task instantiation.

| Flag / argument       | Location | Required | Type                   | Description                                 |
| --------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_template_gid>` | path     | yes      | string                 |                                             |
| `--body-json`         | body     | no       | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`             | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`        | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`        | query    | no       | boolean                |                                             |

```bash
asn task-templates instantiate-task <task_template_gid>
```

## tasks

### `asn tasks add-dependencies-for-task`

POST `/tasks/{task_gid}/addDependencies` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks add-dependencies-for-task <task_gid> --field key=value
```

### `asn tasks add-dependents-for-task`

POST `/tasks/{task_gid}/addDependents` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks add-dependents-for-task <task_gid> --field key=value
```

### `asn tasks add-followers-for-task`

POST `/tasks/{task_gid}/addFollowers` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks add-followers-for-task <task_gid> --field key=value
```

### `asn tasks add-project-for-task`

POST `/tasks/{task_gid}/addProject` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks add-project-for-task <task_gid> --field key=value
```

### `asn tasks add-tag-for-task`

POST `/tasks/{task_gid}/addTag` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks add-tag-for-task <task_gid> --field key=value
```

### `asn tasks create-subtask-for-task`

POST `/tasks/{task_gid}/subtasks` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks create-subtask-for-task <task_gid> --field key=value
```

### `asn tasks create-task`

POST `/tasks` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks create-task --field key=value
```

### `asn tasks delete-task`

DELETE `/tasks/{task_gid}` — **mutates data**

Required scope: tasks:delete

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<task_gid>`    | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn tasks delete-task <task_gid>
```

### `asn tasks duplicate-task`

POST `/tasks/{task_gid}/duplicate` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks duplicate-task <task_gid> --field key=value
```

### `asn tasks get-dependencies-for-task`

GET `/tasks/{task_gid}/dependencies` — read-only, paginated

Required scope: tasks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tasks get-dependencies-for-task <task_gid>
```

### `asn tasks get-dependents-for-task`

GET `/tasks/{task_gid}/dependents` — read-only, paginated

Required scope: tasks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tasks get-dependents-for-task <task_gid>
```

### `asn tasks get-subtasks-for-task`

GET `/tasks/{task_gid}/subtasks` — read-only, paginated

Required scope: tasks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tasks get-subtasks-for-task <task_gid>
```

### `asn tasks get-task`

GET `/tasks/{task_gid}` — read-only

Required scope: tasks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tasks get-task <task_gid>
```

### `asn tasks get-task-for-custom-id`

GET `/workspaces/{workspace_gid}/tasks/custom_id/{custom_id}` — read-only

Required scope: tasks:read

| Flag / argument   | Location | Required | Type   | Description |
| ----------------- | -------- | -------- | ------ | ----------- |
| `<workspace_gid>` | path     | yes      | string |             |
| `<custom_id>`     | path     | yes      | string |             |

```bash
asn tasks get-task-for-custom-id <workspace_gid> <custom_id>
```

### `asn tasks get-tasks`

GET `/tasks` — read-only, paginated

Required scope: tasks:read

| Flag / argument     | Location | Required | Type               | Description |
| ------------------- | -------- | -------- | ------------------ | ----------- |
| `--assignee`        | query    | no       | string             |             |
| `--completed-since` | query    | no       | string             |             |
| `--custom-type`     | query    | no       | string             |             |
| `--limit`           | query    | no       | integer            |             |
| `--modified-since`  | query    | no       | string             |             |
| `--offset`          | query    | no       | string             |             |
| `--opt-fields`      | query    | no       | array (repeatable) |             |
| `--opt-pretty`      | query    | no       | boolean            |             |
| `--project`         | query    | no       | string             |             |
| `--section`         | query    | no       | string             |             |
| `--workspace`       | query    | no       | string             |             |

```bash
asn tasks get-tasks
```

### `asn tasks get-tasks-for-project`

GET `/projects/{project_gid}/tasks` — read-only, paginated

Required scope: tasks:read

| Flag / argument     | Location | Required | Type               | Description |
| ------------------- | -------- | -------- | ------------------ | ----------- |
| `<project_gid>`     | path     | yes      | string             |             |
| `--completed-since` | query    | no       | string             |             |
| `--limit`           | query    | no       | integer            |             |
| `--offset`          | query    | no       | string             |             |
| `--opt-fields`      | query    | no       | array (repeatable) |             |
| `--opt-pretty`      | query    | no       | boolean            |             |

```bash
asn tasks get-tasks-for-project <project_gid>
```

### `asn tasks get-tasks-for-section`

GET `/sections/{section_gid}/tasks` — read-only, paginated

Required scope: tasks:read

| Flag / argument     | Location | Required | Type               | Description |
| ------------------- | -------- | -------- | ------------------ | ----------- |
| `<section_gid>`     | path     | yes      | string             |             |
| `--completed-since` | query    | no       | string             |             |
| `--limit`           | query    | no       | integer            |             |
| `--offset`          | query    | no       | string             |             |
| `--opt-fields`      | query    | no       | array (repeatable) |             |
| `--opt-pretty`      | query    | no       | boolean            |             |

```bash
asn tasks get-tasks-for-section <section_gid>
```

### `asn tasks get-tasks-for-tag`

GET `/tags/{tag_gid}/tasks` — read-only, paginated

Required scope: tasks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<tag_gid>`     | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn tasks get-tasks-for-tag <tag_gid>
```

### `asn tasks get-tasks-for-user-task-list`

GET `/user_task_lists/{user_task_list_gid}/tasks` — read-only, paginated

Required scope: tasks:read

| Flag / argument        | Location | Required | Type               | Description |
| ---------------------- | -------- | -------- | ------------------ | ----------- |
| `<user_task_list_gid>` | path     | yes      | string             |             |
| `--completed-since`    | query    | no       | string             |             |
| `--limit`              | query    | no       | integer            |             |
| `--offset`             | query    | no       | string             |             |
| `--opt-fields`         | query    | no       | array (repeatable) |             |
| `--opt-pretty`         | query    | no       | boolean            |             |

```bash
asn tasks get-tasks-for-user-task-list <user_task_list_gid>
```

### `asn tasks remove-dependencies-for-task`

POST `/tasks/{task_gid}/removeDependencies` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks remove-dependencies-for-task <task_gid> --field key=value
```

### `asn tasks remove-dependents-for-task`

POST `/tasks/{task_gid}/removeDependents` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks remove-dependents-for-task <task_gid> --field key=value
```

### `asn tasks remove-follower-for-task`

POST `/tasks/{task_gid}/removeFollowers` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks remove-follower-for-task <task_gid> --field key=value
```

### `asn tasks remove-project-for-task`

POST `/tasks/{task_gid}/removeProject` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks remove-project-for-task <task_gid> --field key=value
```

### `asn tasks remove-tag-for-task`

POST `/tasks/{task_gid}/removeTag` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks remove-tag-for-task <task_gid> --field key=value
```

### `asn tasks search-tasks-for-workspace`

GET `/workspaces/{workspace_gid}/tasks/search` — read-only

Required scope: tasks:read

| Flag / argument         | Location | Required | Type               | Description |
| ----------------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>`       | path     | yes      | string             |             |
| `--assigned-by-any`     | query    | no       | string             |             |
| `--assigned-by-not`     | query    | no       | string             |             |
| `--assignee-any`        | query    | no       | string             |             |
| `--assignee-not`        | query    | no       | string             |             |
| `--commented-on-by-not` | query    | no       | string             |             |
| `--completed`           | query    | no       | boolean            |             |
| `--completed-at-after`  | query    | no       | string             |             |
| `--completed-at-before` | query    | no       | string             |             |
| `--completed-on`        | query    | no       | string             |             |
| `--completed-on-after`  | query    | no       | string             |             |
| `--completed-on-before` | query    | no       | string             |             |
| `--created-at-after`    | query    | no       | string             |             |
| `--created-at-before`   | query    | no       | string             |             |
| `--created-by-any`      | query    | no       | string             |             |
| `--created-by-not`      | query    | no       | string             |             |
| `--created-on`          | query    | no       | string             |             |
| `--created-on-after`    | query    | no       | string             |             |
| `--created-on-before`   | query    | no       | string             |             |
| `--due-at-after`        | query    | no       | string             |             |
| `--due-at-before`       | query    | no       | string             |             |
| `--due-on`              | query    | no       | string             |             |
| `--due-on-after`        | query    | no       | string             |             |
| `--due-on-before`       | query    | no       | string             |             |
| `--followers-any`       | query    | no       | string             |             |
| `--followers-not`       | query    | no       | string             |             |
| `--has-attachment`      | query    | no       | boolean            |             |
| `--is-blocked`          | query    | no       | boolean            |             |
| `--is-blocking`         | query    | no       | boolean            |             |
| `--is-subtask`          | query    | no       | boolean            |             |
| `--liked-by-not`        | query    | no       | string             |             |
| `--modified-at-after`   | query    | no       | string             |             |
| `--modified-at-before`  | query    | no       | string             |             |
| `--modified-on`         | query    | no       | string             |             |
| `--modified-on-after`   | query    | no       | string             |             |
| `--modified-on-before`  | query    | no       | string             |             |
| `--opt-fields`          | query    | no       | array (repeatable) |             |
| `--opt-pretty`          | query    | no       | boolean            |             |
| `--portfolios-any`      | query    | no       | string             |             |
| `--projects-all`        | query    | no       | string             |             |
| `--projects-any`        | query    | no       | string             |             |
| `--projects-not`        | query    | no       | string             |             |
| `--resource-subtype`    | query    | no       | string             |             |
| `--sections-all`        | query    | no       | string             |             |
| `--sections-any`        | query    | no       | string             |             |
| `--sections-not`        | query    | no       | string             |             |
| `--sort-ascending`      | query    | no       | boolean            |             |
| `--sort-by`             | query    | no       | string             |             |
| `--start-on`            | query    | no       | string             |             |
| `--start-on-after`      | query    | no       | string             |             |
| `--start-on-before`     | query    | no       | string             |             |
| `--tags-all`            | query    | no       | string             |             |
| `--tags-any`            | query    | no       | string             |             |
| `--tags-not`            | query    | no       | string             |             |
| `--teams-any`           | query    | no       | string             |             |
| `--text`                | query    | no       | string             |             |

```bash
asn tasks search-tasks-for-workspace <workspace_gid>
```

### `asn tasks set-parent-for-task`

POST `/tasks/{task_gid}/setParent` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks set-parent-for-task <task_gid> --field key=value
```

### `asn tasks update-task`

PUT `/tasks/{task_gid}` — **mutates data**

Required scope: tasks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn tasks update-task <task_gid> --field key=value
```

## team-memberships

### `asn team-memberships get-team-membership`

GET `/team_memberships/{team_membership_gid}` — read-only

Required scope: team_memberships:read

| Flag / argument         | Location | Required | Type               | Description |
| ----------------------- | -------- | -------- | ------------------ | ----------- |
| `<team_membership_gid>` | path     | yes      | string             |             |
| `--opt-fields`          | query    | no       | array (repeatable) |             |
| `--opt-pretty`          | query    | no       | boolean            |             |

```bash
asn team-memberships get-team-membership <team_membership_gid>
```

### `asn team-memberships get-team-memberships`

GET `/team_memberships` — read-only, paginated

Required scope: team_memberships:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--team`        | query    | no       | string             |             |
| `--user`        | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn team-memberships get-team-memberships
```

### `asn team-memberships get-team-memberships-for-team`

GET `/teams/{team_gid}/team_memberships` — read-only, paginated

Required scope: team_memberships:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<team_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn team-memberships get-team-memberships-for-team <team_gid>
```

### `asn team-memberships get-team-memberships-for-user`

GET `/users/{user_gid}/team_memberships` — read-only, paginated

Required scope: team_memberships:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<user_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn team-memberships get-team-memberships-for-user <user_gid> --workspace <workspace>
```

## teams

### `asn teams add-user-for-team`

POST `/teams/{team_gid}/addUser` — **mutates data**

The user making this call must be a member of the team in order to add others. The user being added must exist in the same organization as the team.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<team_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn teams add-user-for-team <team_gid> --field key=value
```

### `asn teams create-team`

POST `/teams` — **mutates data**

Creates a team within the current workspace.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn teams create-team --field key=value
```

### `asn teams get-team`

GET `/teams/{team_gid}` — read-only

Required scope: teams:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<team_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn teams get-team <team_gid>
```

### `asn teams get-teams-for-user`

GET `/users/{user_gid}/teams` — read-only, paginated

Required scope: teams:read

| Flag / argument  | Location | Required | Type               | Description |
| ---------------- | -------- | -------- | ------------------ | ----------- |
| `<user_gid>`     | path     | yes      | string             |             |
| `--limit`        | query    | no       | integer            |             |
| `--offset`       | query    | no       | string             |             |
| `--opt-fields`   | query    | no       | array (repeatable) |             |
| `--opt-pretty`   | query    | no       | boolean            |             |
| `--organization` | query    | yes      | string             |             |

```bash
asn teams get-teams-for-user <user_gid> --organization <organization>
```

### `asn teams get-teams-for-workspace`

GET `/workspaces/{workspace_gid}/teams` — read-only, paginated

Required scope: teams:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn teams get-teams-for-workspace <workspace_gid>
```

### `asn teams remove-user-for-team`

POST `/teams/{team_gid}/removeUser` — **mutates data**

The user making this call must be a member of the team in order to remove themselves or others.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<team_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn teams remove-user-for-team <team_gid> --field key=value
```

### `asn teams update-team`

PUT `/teams/{team_gid}` — **mutates data**

Updates a team within the current workspace.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<team_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn teams update-team <team_gid> --field key=value
```

## time-periods

### `asn time-periods get-time-period`

GET `/time_periods/{time_period_gid}` — read-only

Returns the full record for a single time period.

| Flag / argument     | Location | Required | Type               | Description |
| ------------------- | -------- | -------- | ------------------ | ----------- |
| `<time_period_gid>` | path     | yes      | string             |             |
| `--opt-fields`      | query    | no       | array (repeatable) |             |
| `--opt-pretty`      | query    | no       | boolean            |             |

```bash
asn time-periods get-time-period <time_period_gid>
```

### `asn time-periods get-time-periods`

GET `/time_periods` — read-only, paginated

Returns compact time period records.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--end-on`      | query    | no       | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--start-on`    | query    | no       | string             |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn time-periods get-time-periods --workspace <workspace>
```

## time-tracking-categories

### `asn time-tracking-categories create-time-tracking-category`

POST `/time_tracking_categories` — **mutates data**

Required scope: time_tracking_categories:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn time-tracking-categories create-time-tracking-category --field key=value
```

### `asn time-tracking-categories delete-time-tracking-category`

DELETE `/time_tracking_categories/{time_tracking_category_gid}` — **mutates data**

Required scope: time_tracking_categories:delete

| Flag / argument                | Location | Required | Type    | Description |
| ------------------------------ | -------- | -------- | ------- | ----------- |
| `<time_tracking_category_gid>` | path     | yes      | string  |             |
| `--opt-pretty`                 | query    | no       | boolean |             |

```bash
asn time-tracking-categories delete-time-tracking-category <time_tracking_category_gid>
```

### `asn time-tracking-categories get-time-tracking-categories`

GET `/time_tracking_categories` — read-only, paginated

Required scope: time_tracking_categories:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--is-archived` | query    | no       | boolean            |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn time-tracking-categories get-time-tracking-categories --workspace <workspace>
```

### `asn time-tracking-categories get-time-tracking-category`

GET `/time_tracking_categories/{time_tracking_category_gid}` — read-only

Required scope: time_tracking_categories:read

| Flag / argument                | Location | Required | Type               | Description |
| ------------------------------ | -------- | -------- | ------------------ | ----------- |
| `<time_tracking_category_gid>` | path     | yes      | string             |             |
| `--opt-fields`                 | query    | no       | array (repeatable) |             |
| `--opt-pretty`                 | query    | no       | boolean            |             |

```bash
asn time-tracking-categories get-time-tracking-category <time_tracking_category_gid>
```

### `asn time-tracking-categories get-time-tracking-entries-for-time-tracking-category`

GET `/time_tracking_categories/{time_tracking_category_gid}/time_tracking_entries` — read-only, paginated

Required scope: time_tracking_categories:read

| Flag / argument                | Location | Required | Type               | Description |
| ------------------------------ | -------- | -------- | ------------------ | ----------- |
| `<time_tracking_category_gid>` | path     | yes      | string             |             |
| `--end-date`                   | query    | no       | string             |             |
| `--limit`                      | query    | no       | integer            |             |
| `--offset`                     | query    | no       | string             |             |
| `--opt-fields`                 | query    | no       | array (repeatable) |             |
| `--opt-pretty`                 | query    | no       | boolean            |             |
| `--start-date`                 | query    | no       | string             |             |

```bash
asn time-tracking-categories get-time-tracking-entries-for-time-tracking-category <time_tracking_category_gid>
```

### `asn time-tracking-categories update-time-tracking-category`

PUT `/time_tracking_categories/{time_tracking_category_gid}` — **mutates data**

Required scope: time_tracking_categories:write

| Flag / argument                | Location | Required | Type                   | Description                                 |
| ------------------------------ | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<time_tracking_category_gid>` | path     | yes      | string                 |                                             |
| `--body-json`                  | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`                      | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`                 | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`                 | query    | no       | boolean                |                                             |

```bash
asn time-tracking-categories update-time-tracking-category <time_tracking_category_gid> --field key=value
```

## time-tracking-entries

### `asn time-tracking-entries create-time-tracking-entry`

POST `/tasks/{task_gid}/time_tracking_entries` — **mutates data**

Creates a time tracking entry on a given task.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<task_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn time-tracking-entries create-time-tracking-entry <task_gid> --field key=value
```

### `asn time-tracking-entries delete-time-tracking-entry`

DELETE `/time_tracking_entries/{time_tracking_entry_gid}` — **mutates data**

A specific, existing time tracking entry can be deleted by making a `DELETE` request on
the URL for that time tracking entry.

| Flag / argument             | Location | Required | Type    | Description |
| --------------------------- | -------- | -------- | ------- | ----------- |
| `<time_tracking_entry_gid>` | path     | yes      | string  |             |
| `--opt-pretty`              | query    | no       | boolean |             |

```bash
asn time-tracking-entries delete-time-tracking-entry <time_tracking_entry_gid>
```

### `asn time-tracking-entries get-time-tracking-entries`

GET `/time_tracking_entries` — read-only, paginated

Required scope: time_tracking_entries:read

| Flag / argument               | Location | Required | Type               | Description |
| ----------------------------- | -------- | -------- | ------------------ | ----------- |
| `--attributable-to`           | query    | no       | string             |             |
| `--entered-on-end-date`       | query    | no       | string             |             |
| `--entered-on-start-date`     | query    | no       | string             |             |
| `--limit`                     | query    | no       | integer            |             |
| `--offset`                    | query    | no       | string             |             |
| `--opt-fields`                | query    | no       | array (repeatable) |             |
| `--opt-pretty`                | query    | no       | boolean            |             |
| `--portfolio`                 | query    | no       | string             |             |
| `--task`                      | query    | no       | string             |             |
| `--timesheet-approval-status` | query    | no       | string             |             |
| `--user`                      | query    | no       | string             |             |
| `--workspace`                 | query    | no       | string             |             |

```bash
asn time-tracking-entries get-time-tracking-entries
```

### `asn time-tracking-entries get-time-tracking-entries-for-task`

GET `/tasks/{task_gid}/time_tracking_entries` — read-only, paginated

Required scope: time_tracking_entries:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<task_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn time-tracking-entries get-time-tracking-entries-for-task <task_gid>
```

### `asn time-tracking-entries get-time-tracking-entry`

GET `/time_tracking_entries/{time_tracking_entry_gid}` — read-only

Required scope: time_tracking_entries:read

| Flag / argument             | Location | Required | Type               | Description |
| --------------------------- | -------- | -------- | ------------------ | ----------- |
| `<time_tracking_entry_gid>` | path     | yes      | string             |             |
| `--opt-fields`              | query    | no       | array (repeatable) |             |
| `--opt-pretty`              | query    | no       | boolean            |             |

```bash
asn time-tracking-entries get-time-tracking-entry <time_tracking_entry_gid>
```

### `asn time-tracking-entries update-time-tracking-entry`

PUT `/time_tracking_entries/{time_tracking_entry_gid}` — **mutates data**

A specific, existing time tracking entry can be updated by making a `PUT` request on
the URL for that time tracking entry. Only the fields provided in the `data` block
will be updated; any unspecified fields will remain unchanged.

| Flag / argument             | Location | Required | Type                   | Description                                 |
| --------------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<time_tracking_entry_gid>` | path     | yes      | string                 |                                             |
| `--body-json`               | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`                   | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`              | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`              | query    | no       | boolean                |                                             |

```bash
asn time-tracking-entries update-time-tracking-entry <time_tracking_entry_gid> --field key=value
```

## timesheet-approval-statuses

### `asn timesheet-approval-statuses create-timesheet-approval-status`

POST `/timesheet_approval_statuses` — **mutates data**

Required scope: timesheet_approval_statuses:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn timesheet-approval-statuses create-timesheet-approval-status --field key=value
```

### `asn timesheet-approval-statuses get-timesheet-approval-status`

GET `/timesheet_approval_statuses/{timesheet_approval_status_gid}` — read-only

Required scope: timesheet_approval_statuses:read

| Flag / argument                   | Location | Required | Type               | Description |
| --------------------------------- | -------- | -------- | ------------------ | ----------- |
| `<timesheet_approval_status_gid>` | path     | yes      | string             |             |
| `--opt-fields`                    | query    | no       | array (repeatable) |             |
| `--opt-pretty`                    | query    | no       | boolean            |             |

```bash
asn timesheet-approval-statuses get-timesheet-approval-status <timesheet_approval_status_gid>
```

### `asn timesheet-approval-statuses get-timesheet-approval-statuses`

GET `/timesheet_approval_statuses` — read-only, paginated

Required scope: timesheet_approval_statuses:read

| Flag / argument       | Location | Required | Type               | Description |
| --------------------- | -------- | -------- | ------------------ | ----------- |
| `--approval-statuses` | query    | no       | string             |             |
| `--from-date`         | query    | no       | string             |             |
| `--limit`             | query    | no       | integer            |             |
| `--offset`            | query    | no       | string             |             |
| `--opt-fields`        | query    | no       | array (repeatable) |             |
| `--opt-pretty`        | query    | no       | boolean            |             |
| `--to-date`           | query    | no       | string             |             |
| `--user`              | query    | no       | string             |             |
| `--workspace`         | query    | yes      | string             |             |

```bash
asn timesheet-approval-statuses get-timesheet-approval-statuses --workspace <workspace>
```

### `asn timesheet-approval-statuses update-timesheet-approval-status`

PUT `/timesheet_approval_statuses/{timesheet_approval_status_gid}` — **mutates data**

Required scope: timesheet_approval_statuses:write

| Flag / argument                   | Location | Required | Type                   | Description                                 |
| --------------------------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<timesheet_approval_status_gid>` | path     | yes      | string                 |                                             |
| `--body-json`                     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`                         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`                    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`                    | query    | no       | boolean                |                                             |

```bash
asn timesheet-approval-statuses update-timesheet-approval-status <timesheet_approval_status_gid> --field key=value
```

## typeahead

### `asn typeahead typeahead-for-workspace`

GET `/workspaces/{workspace_gid}/typeahead` — read-only

Required scope: workspaces.typeahead:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--count`         | query    | no       | integer            |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |
| `--query`         | query    | no       | string             |             |
| `--resource-type` | query    | yes      | string             |             |
| `--type`          | query    | no       | string             |             |

```bash
asn typeahead typeahead-for-workspace <workspace_gid> --resource-type <resource_type>
```

## user-task-lists

### `asn user-task-lists get-user-task-list`

GET `/user_task_lists/{user_task_list_gid}` — read-only

Required scope: tasks:read

| Flag / argument        | Location | Required | Type               | Description |
| ---------------------- | -------- | -------- | ------------------ | ----------- |
| `<user_task_list_gid>` | path     | yes      | string             |             |
| `--opt-fields`         | query    | no       | array (repeatable) |             |
| `--opt-pretty`         | query    | no       | boolean            |             |

```bash
asn user-task-lists get-user-task-list <user_task_list_gid>
```

### `asn user-task-lists get-user-task-list-for-user`

GET `/users/{user_gid}/user_task_list` — read-only

Required scope: tasks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<user_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn user-task-lists get-user-task-list-for-user <user_gid> --workspace <workspace>
```

## users

### `asn users get-favorites-for-user`

GET `/users/{user_gid}/favorites` — read-only, paginated

Required scope: users:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<user_gid>`      | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |
| `--resource-type` | query    | yes      | string             |             |
| `--workspace`     | query    | yes      | string             |             |

```bash
asn users get-favorites-for-user <user_gid> --resource-type <resource_type> --workspace <workspace>
```

### `asn users get-user`

GET `/users/{user_gid}` — read-only

Required scope: users:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<user_gid>`    | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn users get-user <user_gid>
```

### `asn users get-user-for-workspace`

GET `/workspaces/{workspace_gid}/users/{user_gid}` — read-only

Required scope: users:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `<user_gid>`      | path     | yes      | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn users get-user-for-workspace <workspace_gid> <user_gid>
```

### `asn users get-users`

GET `/users` — read-only, paginated

Required scope: users:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--team`        | query    | no       | string             |             |
| `--workspace`   | query    | no       | string             |             |

```bash
asn users get-users
```

### `asn users get-users-for-team`

GET `/teams/{team_gid}/users` — read-only, paginated

Required scope: users:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<team_gid>`    | path     | yes      | string             |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn users get-users-for-team <team_gid>
```

### `asn users get-users-for-workspace`

GET `/workspaces/{workspace_gid}/users` — read-only, paginated

Required scope: users:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn users get-users-for-workspace <workspace_gid>
```

### `asn users update-user`

PUT `/users/{user_gid}` — **mutates data**

A specific, existing user can be updated by making a PUT request on the
URL for that user. Only the fields provided in the `data` block will be
updated; any unspecified fields will remain unchanged.

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<user_gid>`    | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |
| `--workspace`   | query    | no       | string                 |                                             |

```bash
asn users update-user <user_gid> --field key=value
```

### `asn users update-user-for-workspace`

PUT `/workspaces/{workspace_gid}/users/{user_gid}` — **mutates data**

An existing user can be updated by making a PUT request on the URL for that user in the specified workspace or organization. Only the fields provided in the `data` block will be updated; any unspecified fields will remain unchanged.

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<workspace_gid>` | path     | yes      | string                 |                                             |
| `<user_gid>`      | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn users update-user-for-workspace <workspace_gid> <user_gid> --field key=value
```

## webhooks

### `asn webhooks create-webhook`

POST `/webhooks` — **mutates data**

Required scope: webhooks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn webhooks create-webhook --field key=value
```

### `asn webhooks delete-webhook`

DELETE `/webhooks/{webhook_gid}` — **mutates data**

Required scope: webhooks:delete

| Flag / argument | Location | Required | Type    | Description |
| --------------- | -------- | -------- | ------- | ----------- |
| `<webhook_gid>` | path     | yes      | string  |             |
| `--opt-pretty`  | query    | no       | boolean |             |

```bash
asn webhooks delete-webhook <webhook_gid>
```

### `asn webhooks get-webhook`

GET `/webhooks/{webhook_gid}` — read-only

Required scope: webhooks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<webhook_gid>` | path     | yes      | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn webhooks get-webhook <webhook_gid>
```

### `asn webhooks get-webhooks`

GET `/webhooks` — read-only, paginated

Required scope: webhooks:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |
| `--resource`    | query    | no       | string             |             |
| `--workspace`   | query    | yes      | string             |             |

```bash
asn webhooks get-webhooks --workspace <workspace>
```

### `asn webhooks update-webhook`

PUT `/webhooks/{webhook_gid}` — **mutates data**

Required scope: webhooks:write

| Flag / argument | Location | Required | Type                   | Description                                 |
| --------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<webhook_gid>` | path     | yes      | string                 |                                             |
| `--body-json`   | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`       | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`  | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`  | query    | no       | boolean                |                                             |

```bash
asn webhooks update-webhook <webhook_gid> --field key=value
```

## workspace-memberships

### `asn workspace-memberships get-workspace-membership`

GET `/workspace_memberships/{workspace_membership_gid}` — read-only

Returns the complete workspace record for a single workspace membership.

| Flag / argument              | Location | Required | Type               | Description |
| ---------------------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_membership_gid>` | path     | yes      | string             |             |
| `--opt-fields`               | query    | no       | array (repeatable) |             |
| `--opt-pretty`               | query    | no       | boolean            |             |

```bash
asn workspace-memberships get-workspace-membership <workspace_membership_gid>
```

### `asn workspace-memberships get-workspace-memberships-for-user`

GET `/users/{user_gid}/workspace_memberships` — read-only, paginated

Returns the compact workspace membership records for the user.

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `<user_gid>`    | path     | yes      | string             |             |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn workspace-memberships get-workspace-memberships-for-user <user_gid>
```

### `asn workspace-memberships get-workspace-memberships-for-workspace`

GET `/workspaces/{workspace_gid}/workspace_memberships` — read-only, paginated

Returns the compact workspace membership records for the workspace.

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--limit`         | query    | no       | integer            |             |
| `--offset`        | query    | no       | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |
| `--user`          | query    | no       | string             |             |

```bash
asn workspace-memberships get-workspace-memberships-for-workspace <workspace_gid>
```

## workspaces

### `asn workspaces add-user-for-workspace`

POST `/workspaces/{workspace_gid}/addUser` — **mutates data**

Add a user to a workspace or organization.
The user can be referenced by their globally unique user ID or their email address. Returns the full user record for the invited user.

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<workspace_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn workspaces add-user-for-workspace <workspace_gid> --field key=value
```

### `asn workspaces get-workspace`

GET `/workspaces/{workspace_gid}` — read-only

Required scope: workspaces:read

| Flag / argument   | Location | Required | Type               | Description |
| ----------------- | -------- | -------- | ------------------ | ----------- |
| `<workspace_gid>` | path     | yes      | string             |             |
| `--opt-fields`    | query    | no       | array (repeatable) |             |
| `--opt-pretty`    | query    | no       | boolean            |             |

```bash
asn workspaces get-workspace <workspace_gid>
```

### `asn workspaces get-workspace-events`

GET `/workspaces/{workspace_gid}/events` — read-only

Returns the full record for all events that have occurred since the sync token was created.
The response is a list of events and the schema of each event is as described here.
Asana limits a single sync token to 1000 events. If more than 1000 events exist for a given domain, `has_more: true` will be returned in the response, indicating that there are more events to pull.

| Flag / argument   | Location | Required | Type    | Description |
| ----------------- | -------- | -------- | ------- | ----------- |
| `<workspace_gid>` | path     | yes      | string  |             |
| `--opt-pretty`    | query    | no       | boolean |             |
| `--sync`          | query    | no       | string  |             |

```bash
asn workspaces get-workspace-events <workspace_gid>
```

### `asn workspaces get-workspaces`

GET `/workspaces` — read-only, paginated

Required scope: workspaces:read

| Flag / argument | Location | Required | Type               | Description |
| --------------- | -------- | -------- | ------------------ | ----------- |
| `--limit`       | query    | no       | integer            |             |
| `--offset`      | query    | no       | string             |             |
| `--opt-fields`  | query    | no       | array (repeatable) |             |
| `--opt-pretty`  | query    | no       | boolean            |             |

```bash
asn workspaces get-workspaces
```

### `asn workspaces remove-user-for-workspace`

POST `/workspaces/{workspace_gid}/removeUser` — **mutates data**

Remove a user from a workspace or organization.

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<workspace_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn workspaces remove-user-for-workspace <workspace_gid> --field key=value
```

### `asn workspaces update-workspace`

PUT `/workspaces/{workspace_gid}` — **mutates data**

A specific, existing workspace can be updated by making a PUT request on the URL for that workspace. Only the fields provided in the data block will be updated; any unspecified fields will remain unchanged.
Currently the only field that can be modified for a workspace is its name.
Returns the complete, updated workspace record.

| Flag / argument   | Location | Required | Type                   | Description                                 |
| ----------------- | -------- | -------- | ---------------------- | ------------------------------------------- |
| `<workspace_gid>` | path     | yes      | string                 |                                             |
| `--body-json`     | body     | yes      | json                   | @file                                       | -   | Complete JSON request body, inline, from @file, or stdin |
| `--field`         | body     | no       | key=value (repeatable) | Set one request body field; may be repeated |
| `--opt-fields`    | query    | no       | array (repeatable)     |                                             |
| `--opt-pretty`    | query    | no       | boolean                |                                             |

```bash
asn workspaces update-workspace <workspace_gid> --field key=value
```
