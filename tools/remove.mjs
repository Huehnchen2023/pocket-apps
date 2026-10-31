// Removes an app from the launcher: deletes projects/<id>/, then commits and pushes like deploy.
// Pulls first, because apps may also have been uploaded or removed via the dashboard.
// Usage: npm run remove -- <id>
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = cmd => execSync(cmd, { cwd: root, stdio: 'inherit' });

const id = (process.argv[2] || '').trim();
if (!/^[a-z0-9_-]+$/.test(id)) {
  console.error('Usage: npm run remove -- <id>   (the folder name in projects/)');
  process.exit(1);
}

run('git pull --rebase --autostash');
if (!existsSync(join(root, 'projects', id))) {
  console.error(`✗ projects/${id} does not exist.`);
  process.exit(1);
}
run(`git rm -r -q --ignore-unmatch "projects/${id}"`);
// Untracked leftovers (files that were never committed) would keep the folder alive locally.
run(`git clean -fdq -- "projects/${id}"`);
run(`node tools/deploy.mjs "Remove ${id}"`);
