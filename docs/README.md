# Docs site

The documentation site for the Agentic Asana CLI (`asn`), built from plain markdown.

## Framework choice

We use [VitePress](https://vitepress.dev) (v1.6.x). Rationale:

- **Plain-markdown authoring** — every page is a `.md` file with YAML frontmatter for
  title/description; no MDX or bespoke component syntax required.
- **Minimal config** — a single `.vitepress/config.mts` drives nav, sidebar, theming, and
  SEO; no plugin ecosystem to assemble to get a usable site.
- **Good default design** — the built-in default theme (used here) is clean, responsive,
  has built-in local search, and needs no custom CSS to look presentable.
- **Built-in SEO** — `sitemap.xml` generation and per-page `<meta>`/OpenGraph tags are
  native config options (`sitemap: { hostname }`, `head`, and per-page frontmatter
  `description`), not a separate plugin.
- **Easy static export** — `vitepress build` emits a plain static `dist/` directory that
  deploys unmodified to GitHub Pages or Vercel.

Alternatives considered: Astro Starlight (heavier install, more moving parts for a small
CLI docs set), Docusaurus (React/MDX-first, more config than needed here), MkDocs Material
(would add a Python toolchain to a Node-only repo), Nextra (Next.js-first, heavier runtime
than a static docs site needs).

## LLM-friendly output (llms.txt)

The build uses [`vitepress-plugin-llms`](https://github.com/okineadev/vitepress-plugin-llms),
wired into `docs/site/.vitepress/config.mts`, to automatically generate LLM-readable output
from the same markdown source on every `docs:build` — nothing here is hand-maintained:

- Every page gets a plain-markdown variant at `/<page>.md` in the build output (e.g.
  `usage/index.md` → `/usage.md`), reflecting that page's current content.
- A root `/llms.txt` acts as a progressive-disclosure router: site name, one-line summary,
  then a linked index of every page's `.md` variant with a one-line description pulled from
  each page's frontmatter `description` (or first paragraph).
- A root `/llms-full.txt` bundles every page's content into one file for full-context loads.

`excludeIndexPage: false` is set because `docs/site/index.md` is a real landing page (not an
empty stub), so it gets a variant and a `llms.txt` entry like every other page.

An automated check (`tests/docs/llms-txt.test.ts`, run as part of `npm test`) runs
`docs:build` and asserts: every markdown source page under `docs/site` has a corresponding
`.md` output, and the root `llms.txt` links to all of them.

## Layout

```
docs/
  story.html        # standalone origin-story page (unchanged, linked from README)
  README.md         # this file
  site/              # VitePress source root
    .vitepress/
      config.mts     # site config: nav, sidebar, sitemap, SEO head tags
    index.md         # landing page
    usage/index.md         # usage guide
    commands/index.md      # commands reference (generated from gen/manifest.json)
    configuration/index.md # configuration reference
    public/           # static assets (logo, favicon)
```

The commands page is generated: `scripts/generate-commands-doc.mjs` reads the pinned Asana
OpenAPI command manifest (`gen/manifest.json`, the same source `asn schema` reads from) and
renders every resource/operation/parameter into `docs/site/commands/index.md`. Run it directly
with `npm run docs:generate-commands`, or let `npm run docs:build` run it automatically before
building the site so the page never drifts from the manifest.

## Running locally

From the repo root:

```bash
npm run docs:dev
```

This starts a local dev server (default `http://localhost:5173`) with hot reload.

## Building

```bash
npm run docs:build
```

Output is written to `docs/site/.vitepress/dist/`, including a generated `sitemap.xml`.
Preview the production build locally with:

```bash
npm run docs:preview
```

## Deploying

The build output in `docs/site/.vitepress/dist/` is a plain static site. It can be deployed
as-is to GitHub Pages (serve that directory from a Pages workflow) or to Vercel (set the
build command to `npm run docs:build` and the output directory to
`docs/site/.vitepress/dist`).
