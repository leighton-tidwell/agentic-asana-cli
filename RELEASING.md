# Releasing and rollback

## Release

1. Confirm CI is green on `main` and `CHANGELOG.md` describes the version.
2. Set the same semantic version in `package.json`, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`.
3. Create and push an annotated `vX.Y.Z` tag from the reviewed main commit.
4. The release workflow reruns all checks, builds `agentic-asana-asn.tgz`, creates a GitHub release, and records a build-provenance attestation.
5. Install the release artifact in a clean environment and probe `asn --version`, `asn --help`, and a PAT-only workspace read before announcing it.

## Rollback

GitHub release artifacts are immutable inputs to users, so do not replace an existing tag or asset.

1. Mark the affected GitHub release as a prerelease and add a warning naming the last known-good version.
2. Publish a new patch release that reverts the faulty commit, or direct users to install the prior immutable artifact URL.
3. If an npm publication channel is added later, run `npm deprecate <package>@<bad-version> "use <good-version>"`. Use `npm unpublish` only within npm's policy window and only for a credential or legal emergency.
4. Never force-move or reuse a release tag. If a tag itself is wrong and no artifact was consumed, delete the release/tag and create a new version number rather than retagging silently.
5. Reinstall the selected good artifact and repeat the operational probes before closing the incident.
