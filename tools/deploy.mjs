// Builds projects.json, commits everything and pushes to GitHub (→ GitHub Pages).
// Usage: npm run deploy -- "Add snake game"
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = cmd => execSync(cmd, { cwd: root, stdio: 'inherit' });
const read = cmd => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();

const message = process.argv.slice(2).join(' ').trim() || 'Update apps';

run('node tools/build.mjs');
run('git add -A');

if (!read('git status --porcelain')) {
  console.log('Nothing changed, nothing to deploy.');
  process.exit(0);
}

execSync('git commit -F -', { cwd: root, input: message, stdio: ['pipe', 'inherit', 'inherit'] });
run('git push');

try {
  const url = read('gh api repos/{owner}/{repo}/pages --jq .html_url');
  console.log(`\n✓ Deployed. Live in ~1 minute at: ${url}`);
} catch {
  console.log('\n✓ Pushed. GitHub Pages will update in ~1 minute.');
}
