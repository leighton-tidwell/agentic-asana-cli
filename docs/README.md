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

## Layout

```
docs/
  story.html        # standalone origin-story page (unchanged, linked from README)
  README.md         # this file
  site/              # VitePress source root
    .vitepress/
      config.mts     # site config: nav, sidebar, sitemap, SEO head tags
    index.md         # landing page
    usage/index.md         # usage guide (stub)
    commands/index.md      # commands reference (stub)
    configuration/index.md # configuration reference (stub)
    public/           # static assets (logo, favicon)
```

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
