# Releasing and rollback

## Release

1. Confirm CI is green on `main` and `CHANGELOG.md` describes the version.
2. Set the same semantic version in `package.json`, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`.
3. Create and push an annotated `vX.Y.Z` tag from the reviewed main commit.
4. The release workflow reruns all checks, builds `agentic-asana-asn.tgz`, and enforces version consistency in three places before publishing — tag vs `package.json`, packed-artifact `package.json` vs tag, and the installed `asn --version` vs tag. Any divergence fails the release before anything is published.
5. The workflow publishes two assets to the GitHub release: `agentic-asana-asn.tgz` (the install artifact the `upgrade` command downloads) and `SHA256SUMS` (its SHA-256 checksum manifest), plus a build-provenance attestation. A post-release probe then queries `releases/latest` (the same endpoint the CLI's update check uses), re-downloads both assets from the deterministic release URL, verifies the checksum round-trip, installs the tarball, and asserts the installed `--version` equals the tag. The release job fails if the new version is not visible and downloadable by users.
6. Install the release artifact in a clean environment and probe `asn --version`, `asn --help`, and a PAT-only workspace read before announcing it.

## Rollback

GitHub release artifacts are immutable inputs to users, so do not replace an existing tag or asset.

How the `latest` pointer works here: GitHub's `releases/latest` endpoint — which the CLI's update check and `asn upgrade` query — resolves to the most recent non-prerelease, non-draft release by semver-ish recency. Marking a release as a prerelease removes it from `latest` resolution, which is the supported way to un-point users from a bad build.

1. Mark the affected GitHub release as a prerelease (release page → Edit → "Set as a pre-release") and add a warning naming the last known-good version. From this point, `releases/latest` resolves to the prior good release, so `asn upgrade` and the startup drift notice stop pulling users onto the broken build. Do not delete the release or its assets: anyone who already installed it keeps a working artifact with a verifiable checksum, and deletion breaks pinned-URL installs.
2. Publish a new patch release that reverts the faulty commit, or direct users to install the prior immutable artifact URL (`https://github.com/leighton-tidwell/agentic-asana-cli/releases/download/v<good>/agentic-asana-asn.tgz`).
3. If an npm publication channel is added later, run `npm deprecate <package>@<bad-version> "use <good-version>"`. Use `npm unpublish` only within npm's policy window and only for a credential or legal emergency.
4. Never force-move or reuse a release tag. If a tag itself is wrong and no artifact was consumed, delete the release/tag and create a new version number rather than retagging silently.
5. Reinstall the selected good artifact and repeat the operational probes before closing the incident: `releases/latest` returns the good tag, the asset URL downloads, `SHA256SUMS` verifies, and the installed `asn --version` reports the good version.
