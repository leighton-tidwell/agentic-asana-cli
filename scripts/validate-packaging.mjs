import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const plugin = JSON.parse(await read('.claude-plugin/plugin.json'));
const marketplace = JSON.parse(await read('.claude-plugin/marketplace.json'));
if (
  !/^[a-z0-9-]+$/.test(plugin.name) ||
  !plugin.version ||
  !plugin.description ||
  !plugin.author
) {
  throw new Error('plugin.json is missing required/recommended metadata');
}
const entry = marketplace.plugins?.find((item) => item.name === plugin.name);
if (!entry || entry.source !== './' || entry.version !== plugin.version) {
  throw new Error(
    'marketplace entry must point to ./ and match plugin name/version',
  );
}
const skillDirs = await readdir(new URL('skills/', root), {
  withFileTypes: true,
});
let count = 0;
for (const dir of skillDirs.filter((item) => item.isDirectory())) {
  const text = await read(join('skills', dir.name, 'SKILL.md'));
  if (!text.startsWith('---\n'))
    throw new Error(`${dir.name}: frontmatter must start at byte 0`);
  const end = text.indexOf('\n---\n', 4);
  if (end < 0 || !text.slice(end + 5).trim())
    throw new Error(`${dir.name}: invalid or empty SKILL.md`);
  const frontmatter = text.slice(4, end);
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (name !== dir.name || !description)
    throw new Error(`${dir.name}: name/description invalid`);
  count += 1;
}
if (count < 1) throw new Error('no skills found');
console.log(
  `Packaging valid: ${plugin.name}@${plugin.version}, ${count} skills`,
);
