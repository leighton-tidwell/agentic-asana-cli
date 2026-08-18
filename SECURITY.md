# Security Policy

## Reporting

Do not open a public issue for a suspected credential leak, read-only bypass, injection flaw, or dependency compromise. Use GitHub's private vulnerability reporting for this repository.

## PAT safety

- Prefer `ASANA_PAT`; command-line token flags can appear in process listings and shell history.
- Never include PATs in issues, logs, fixtures, snapshots, or commits.
- Config files containing a token must be readable only by their owner.
- The CLI must send the bearer token only to `https://app.asana.com`.

If a PAT is exposed, revoke it in Asana immediately, replace it, and purge the credential from git history before publishing another release.

## Supported versions

Only the latest release receives security updates.
