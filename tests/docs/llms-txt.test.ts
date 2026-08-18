import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const siteRoot = resolve(root, 'docs/site');
const distDir = resolve(siteRoot, '.vitepress/dist');

/** Recursively collect markdown source pages under docs/site (excluding dotfiles/public). */
function collectMarkdownPages(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'public' || entry === 'node_modules')
      continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectMarkdownPages(full, base));
    } else if (entry.endsWith('.md')) {
      out.push(full.slice(base.length + 1));
    }
  }
  return out;
}

test('docs build emits per-page llms.txt variants and a root llms.txt router with resolvable links', () => {
  // Build the docs site fresh so the assertions reflect the current markdown source,
  // never a stale/hand-maintained artifact.
  execFileSync('npm', ['run', 'docs:build'], { cwd: root, stdio: 'pipe' });

  assert.ok(
    existsSync(distDir),
    'docs build output directory should exist after docs:build',
  );

  const rootLlmsPath = resolve(distDir, 'llms.txt');
  assert.ok(
    existsSync(rootLlmsPath),
    'root llms.txt must exist in the build output',
  );
  const rootLlms = readFileSync(rootLlmsPath, 'utf8');

  // Root llms.txt must follow the llms.txt convention: an H1 site name and a linked index.
  assert.match(
    rootLlms,
    /^#\s+.+/m,
    'root llms.txt should start with an H1 site name',
  );

  const mdPages = collectMarkdownPages(siteRoot);
  assert.ok(
    mdPages.length > 0,
    'expected at least one markdown source page under docs/site',
  );

  for (const relPath of mdPages) {
    // e.g. "index.md" -> "" (site root), "usage/index.md" -> "usage"
    const pageSlug =
      relPath === 'index.md'
        ? ''
        : relPath.replace(/\/?index\.md$/, '').replace(/\.md$/, '');

    // Every page must have a corresponding LLM-readable plain-text variant in the build output.
    const llmsVariantPath = resolve(
      distDir,
      pageSlug ? `${pageSlug}.md` : 'index.md',
    );
    assert.ok(
      existsSync(llmsVariantPath),
      `expected LLM-readable variant for page "${relPath}" at ${llmsVariantPath}`,
    );

    // The root llms.txt router must link to it.
    const linkTarget = pageSlug ? `/${pageSlug}.md` : '/index.md';
    assert.ok(
      rootLlms.includes(linkTarget),
      `root llms.txt should link to ${linkTarget} for page "${relPath}"`,
    );
  }
});
