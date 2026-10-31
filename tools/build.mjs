// Scans projects/*/ and writes projects.json for the launcher.
// Each project folder needs an index.html and a project.json (see CLAUDE.md).
// Usage: node tools/build.mjs
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = join(root, 'projects');

function listFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    if (name.startsWith('.')) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const toUrl = full => './' + relative(root, full).split(sep).join('/');
const hash = createHash('sha256');
const projects = [];
let problems = 0;

for (const id of existsSync(projectsDir) ? readdirSync(projectsDir).sort() : []) {
  const dir = join(projectsDir, id);
  if (!statSync(dir).isDirectory() || id.startsWith('.') || id.startsWith('_')) continue;

  if (!/^[a-z0-9-]+$/.test(id)) {
    console.error(`✗ ${id}: folder name must be lowercase letters, digits and dashes`);
    problems++; continue;
  }
  if (!existsSync(join(dir, 'index.html'))) {
    console.error(`✗ ${id}: missing index.html`);
    problems++; continue;
  }

  let meta = {};
  const metaPath = join(dir, 'project.json');
  if (existsSync(metaPath)) {
    try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
    catch (e) { console.error(`✗ ${id}: project.json is not valid JSON (${e.message})`); problems++; continue; }
  } else {
    console.warn(`! ${id}: no project.json, using defaults`);
  }

  const files = listFiles(dir);
  for (const f of files) hash.update(toUrl(f)).update(readFileSync(f));

  const iconImage = files.find(f => /[\\/]icon\.(png|jpg|jpeg|webp|svg)$/i.test(f) && dirname(f) === dir);

  projects.push({
    id,
    name: meta.name || id,
    description: meta.description || '',
    icon: meta.icon || '🎮',
    color: meta.color || '#7c6cff',
    ...(iconImage ? { iconImage: toUrl(iconImage) } : {}),
    added: meta.added || '',
    entry: `./projects/${id}/index.html`,
    files: files.map(toUrl),
  });
}

// Newest first, then alphabetical by id.
projects.sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.id.localeCompare(b.id));

const out = { version: hash.digest('hex').slice(0, 16), projects };
writeFileSync(join(root, 'projects.json'), JSON.stringify(out, null, 2) + '\n');

console.log(`projects.json: ${projects.length} project(s), version ${out.version}`);
for (const p of projects) {
  const n = typeof p.name === 'object' ? (p.name.en || p.name.de) : p.name;
  console.log(`  ${p.icon} ${p.id} – ${n} (${p.files.length} files)`);
}
if (problems) { console.error(`${problems} problem(s) found.`); process.exit(1); }
