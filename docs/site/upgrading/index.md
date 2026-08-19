---
title: Upgrading
description: Self-updating asn with `asn upgrade`, and the startup update notice.
---

# Upgrading

## `asn upgrade`

If you installed with `npm install -g <release-tarball-url>` (see [Install](/usage/#install)),
`asn` can upgrade itself in place:

```bash
asn upgrade
```

`asn update` is an alias for the same command.

```
Usage: asn upgrade|update [options]

Upgrade this CLI to the latest published version

Options:
  --check           report versions without changing anything
  --target <x.y.z>  pin a specific target version
  --yes             install without an interactive confirmation
  -h, --help        display help for command
```

- `--check` — report the current and latest versions without changing anything.
- `--target <x.y.z>` — pin a specific version instead of the latest release.
- `--yes` — install without an interactive confirmation; without it, `asn upgrade` reports the
  available version and exits without installing.

Running `asn upgrade` (or `--check`) with no newer release available reports that you're
already at the latest version and exits `0` without changing anything.

## Installed from a source checkout?

`asn upgrade` detects a source checkout and refuses to self-update it — instead it prints the
command that actually updates a source install:

```bash
git pull && npm install
```

This is also what it prints for any other install channel it can't manage automatically (for
example, an install channel is overridden but unrecognized).

## Startup update notice

`asn` checks for a newer release at startup and, when one exists, prints a single line to
stderr:

```
asn: a newer version is available (0.1.4 -> 0.1.5). Run `asn upgrade` to update.
```

- The check is cached and re-run at most once every 24 hours.
- It never blocks or fails a command — any error during the check is silently swallowed.
- It's skipped entirely when you're already running `asn upgrade` or `asn update`.

### Opting out

- `--no-update-check` — disable the check for a single invocation.
- `ASN_NO_UPDATE_CHECK=1` — disable the check for every invocation in the environment.
- The check is also automatically suppressed in CI (`CI=true`) and whenever stderr isn't a TTY
  (non-interactive/piped output), so scripted and automated use is never affected.

## Next steps

- [Usage](/usage/) — everyday commands and output formats.
- [Configuration](/configuration/) — config file format, environment variables, and read-only
  workspace guards.
