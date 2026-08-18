# Upgrade path audit (`asn`)

Audit of what self-update capability exists in this CLI today, which installation
channels are real, how the CLI learns its own version, and how an installed
instance could detect the channel that installed it.

Audited at commit `9c32326` (branch `wt/t_0d93351a`), package version `0.1.4`.

## Summary

| Question                                       | Answer                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Does an `upgrade` (or `update`) command exist? | **No.** Not in any form.                                                                                                 |
| Is there a version-check / update notifier?    | **No.**                                                                                                                  |
| How does the CLI know its version?             | **Hardcoded string literal**, `src/main.ts:24`.                                                                          |
| Real install channels                          | **One** (npm tarball from GitHub Releases), plus two channels that install skills/plugin content rather than the binary. |
| Can the CLI detect its install channel today?  | **No** — nothing is recorded at install time.                                                                            |

## 1. Entrypoint and command registration

- Entrypoint: `src/main.ts`. Shebang `#!/usr/bin/env node` at `src/main.ts:1`;
  self-execution guard at `src/main.ts:179-184`.
- Binary mapping: `package.json:16-18` maps `asn` → `dist/main.js`.
- Framework: `commander` (`package.json:41`), imported at `src/main.ts:4`.
- The root program is built in `createProgram()` (`src/main.ts:20-130`).

Full list of hand-written commands registered on the root program:

| Command              | Location             |
| -------------------- | -------------------- |
| `asn` (root action)  | `src/main.ts:42-48`  |
| `asn schema`         | `src/main.ts:50-55`  |
| `asn auth`           | `src/main.ts:57`     |
| `asn auth login`     | `src/main.ts:58-68`  |
| `asn workspace`      | `src/main.ts:70-72`  |
| `asn workspace list` | `src/main.ts:73-125` |

Plus two bulk registrations:

- `registerGeneratedCommands(program, loadManifest())` — `src/main.ts:127`,
  defined at `src/dispatch.ts:277`. Registers the 249 API commands from
  `gen/manifest.json`.
- `registerAttachmentCommands(program)` — `src/main.ts:128`, defined at
  `src/attachments.ts:346`.

**There is no `upgrade`, `update`, `self-update`, or `version check` command.**
The only version-related surface is commander's built-in `--version` flag
(`src/main.ts:24`).

### Name-collision check for a future `upgrade` command

The 249 generated commands are namespaced `asn <resource> <operation>`, and the
resource list derived from `gen/manifest.json` contains no `upgrade`, `update`,
`version`, or `self*` entry. A new top-level `asn upgrade` would not collide
with any generated command.

## 2. Keyword search results

Searching the tree (excluding `node_modules` and `package-lock.json`) for
`self-update`, `selfupdate`, `upgrade`, `update-notifier`, `notifier`,
`npm install -g`, `npx`, `brew`, `homebrew`, `docker`, `pipx`, and `curl | sh`
returned only these hits, none of which are upgrade machinery:

- `README.md:14` — the install command (documentation).
- `README.md:83-84` — `npx skills add ...` (skills channel, documentation).
- `docs/site/usage/index.md:15` — the same install command (documentation).
- `CHANGELOG.md:17` — the prose "Users on v0.1.2 should upgrade immediately"
  (release note, no code).
- `tests/unit/transport.test.ts:417` — the word "upgrade" used in an unrelated
  test title about manifest resolution.

No `update-notifier`, `latest-version`, or comparable dependency appears in
`package.json:40-54`.

## 3. Install channel matrix

| Channel                                                      | Published today?                                                              | Proof (file:line)                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Releases npm tarball (`npm install -g <release-url>`) | **Yes — this is the only way to install the binary.**                         | `README.md:13-15`, `docs/site/usage/index.md:14-16`; artifact built and attached by `.github/workflows/release.yml:30-49` (`npm pack` → renamed `agentic-asana-asn.tgz` → `softprops/action-gh-release`). Releases v0.1.1–v0.1.4 exist on `leighton-tidwell/agentic-asana-cli`.                                                                       |
| npm registry (`npm i -g @agentic-asana/asn`)                 | **No.**                                                                       | Package name declared at `package.json:2`, but the release workflow never runs `npm publish` (`.github/workflows/release.yml:12-49` — no publish step, no `NODE_AUTH_TOKEN`). `RELEASING.md:17` states publication is hypothetical: "If an npm publication channel is added later…". A live registry probe for `@agentic-asana/asn` returns HTTP 404. |
| Claude Code plugin marketplace                               | **Yes**, but it installs skills + the `/asana` command, not the `asn` binary. | `README.md:69-78`; manifests `.claude-plugin/plugin.json:1-13` and `.claude-plugin/marketplace.json:1-23`; validated by `scripts/validate-packaging.mjs:6-21` via `npm run test:packaging` (`package.json:34`). Slash command source: `commands/asana.md`.                                                                                            |
| Agent Skills (`npx skills add`)                              | **Yes**, but it installs `skills/*/SKILL.md` only, not the binary.            | `README.md:80-86`; skill sources `skills/asana-cli/SKILL.md`, `skills/asana-reporting/SKILL.md`, `skills/asana-task-workflows/SKILL.md`; validated by `scripts/validate-packaging.mjs:22-40`.                                                                                                                                                         |
| Homebrew                                                     | **No.**                                                                       | No formula, tap, or `brew` reference anywhere in the tree; the repository root contains no `Formula/` directory and no `.rb` file (`git ls-files` shows none).                                                                                                                                                                                        |
| `curl \| sh` install script                                  | **No.**                                                                       | No install script exists; `scripts/` contains only `generate-commands-doc.mjs`, `sync-spec.ts`, and `validate-packaging.mjs`.                                                                                                                                                                                                                         |
| Standalone binary (pkg/SEA/nexe)                             | **No.**                                                                       | The release workflow produces only the npm tarball (`.github/workflows/release.yml:30-37`); no bundler dependency exists in `package.json:43-53`.                                                                                                                                                                                                     |
| Docker                                                       | **No.**                                                                       | No `Dockerfile`, `docker-compose.yml`, or container publish step anywhere in `git ls-files`.                                                                                                                                                                                                                                                          |
| pipx / PyPI                                                  | **Not applicable.**                                                           | Node/TypeScript project (`package.json:15,23-25`).                                                                                                                                                                                                                                                                                                    |

Net: for the CLI binary there is exactly **one** live channel — the global npm
install of a tarball URL from GitHub Releases. Every other published channel
delivers agent content (skills / plugin), not `asn` itself.

Corollary for an `asn upgrade` design: because the tarball is not a registry
package, `npm install -g @agentic-asana/asn@latest` cannot work. The upgrade
must re-run the documented URL form (`.../releases/latest/download/agentic-asana-asn.tgz`),
and "what is the latest version?" must be answered from the GitHub Releases API
(`/repos/leighton-tidwell/agentic-asana-cli/releases/latest`), not from the npm
registry.

## 4. Version-detection mechanism

The version is a **hardcoded string literal**:

- `src/main.ts:24` — `.version('0.1.4')`.

It is _not_ read from `package.json` at runtime, _not_ derived from
`git describe`, and _not_ injected at build time (`package.json:27` is a plain
`tsc -p tsconfig.json`).

The same literal is duplicated across five tracked files, kept in sync only by
process and tests:

| File:line                                                                                                    | Purpose                     |
| ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `package.json:3`                                                                                             | npm package version         |
| `src/main.ts:24`                                                                                             | what `asn --version` prints |
| `.claude-plugin/plugin.json:3`                                                                               | plugin version              |
| `.claude-plugin/marketplace.json:15`                                                                         | marketplace entry version   |
| `skills/asana-cli/SKILL.md:9`, `skills/asana-reporting/SKILL.md:9`, `skills/asana-task-workflows/SKILL.md:9` | skill frontmatter           |

Enforcement of the sync:

- `.claude-plugin/*` versions must match each other — `scripts/validate-packaging.mjs:16-21`.
- `asn --version` output is asserted against the literal `0.1.4` in
  `tests/unit/cli.test.ts:241-245`.
- The release tag must equal `package.json` version — `.github/workflows/release.yml:27-29`.
- The installed binary's `--version` must equal `package.json` version —
  `.github/workflows/release.yml:32-35` and `.github/workflows/ci.yml:33-38`.

Note the gap: **nothing asserts `src/main.ts:24` equals `package.json:3` directly.**
The CI probes catch it only because they compare installed `--version` against
`package.json`; that check happens to cover it, but the assertion in
`tests/unit/cli.test.ts:245` is against a second hardcoded literal, so a bump
that misses `src/main.ts` fails CI loudly rather than silently — acceptable, but
brittle. Reading `package.json` (or generating a `version.ts`) would remove the
duplication and is a prerequisite for an upgrade command that must compare its
own version to a remote one.

## 5. How an installed instance could detect its install channel

Nothing is written at install time today: there is no postinstall hook
(`package.json:26-39` has no `postinstall`), no marker file, and no channel
constant. Detection therefore has to be inferred from the runtime install path.

Available runtime signals:

- `import.meta.url` / `fileURLToPath` — already imported in `src/main.ts:2-3`
  and used for the self-execution guard at `src/main.ts:179-182`. Also used to
  locate `gen/manifest.json` relative to the module at `src/manifest.ts:40`,
  which is the established pattern in this codebase for path-relative resolution.
- `process.argv[1]` and `realpathSync` — `src/main.ts:2,180-181`.
- The shipped file set is `dist` + `gen` (`package.json:19-22`), so a global npm
  install lands under `<prefix>/lib/node_modules/@agentic-asana/asn/dist/main.js`.

Recommended detection strategy, in priority order:

1. **Explicit override first.** Honour an env var such as `ASN_INSTALL_CHANNEL`
   so packagers and CI can state the truth instead of being guessed at. Cheapest,
   most reliable, and needed for testing the other branches.
2. **Marker file written at package time.** Emit a small
   `dist/install-channel.json` (or reuse the `gen/` directory, already in
   `files`) during the release build. Resolve it with the same
   `new URL('../gen/...', import.meta.url)` pattern used at `src/manifest.ts:40`.
   For this repo, the release workflow would stamp `github-release-tarball` at
   `.github/workflows/release.yml:30-31`, and a local `npm run build` would leave
   it absent → `source`.
3. **Path heuristics as a fallback.** Resolve `realpathSync(fileURLToPath(import.meta.url))`
   and match, in order:
   - contains `/Cellar/` or `/homebrew/` → `homebrew`
   - contains `/node_modules/` and matches `lib/node_modules` → `npm-global`
   - contains `/_npx/` → `npx` (ephemeral; upgrade is a no-op)
   - inside the repo worktree (a sibling `package.json` with `"name": "@agentic-asana/asn"` **and** a `src/` directory present) → `source`
   - otherwise → `unknown`
4. **Never guess silently.** When detection lands on `unknown`, an upgrade
   command should print the documented install command from `README.md:14`
   rather than executing a package manager it cannot verify.

Given the channel matrix in §3, branches 3a (homebrew) and 3c (npx) are
currently dead code for this repo; the only live branches are `npm-global` and
`source`. Implementing the marker file (step 2) is the highest-value change
because it makes the answer authoritative instead of heuristic, and it is a
one-line addition to a release workflow that already normalizes the artifact.

## Conclusion

**No upgrade command exists.** There is no self-update code, no version-check
code, and no update-notifier dependency anywhere in the repository. Any upgrade
feature is greenfield, must target the GitHub Releases tarball channel (the only
live binary channel), must source "latest" from the GitHub Releases API rather
than the npm registry, and should first de-duplicate the hardcoded version
literal at `src/main.ts:24`.
