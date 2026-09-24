import { execFileSync } from 'node:child_process';
import { checkPaths } from './ownership-rules.mjs';

const args = process.argv.slice(2);
const role = args[args.indexOf('--role') + 1];
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'bootstrap-v2';
try {
  if (!args.includes('--role') || !['A', 'B', 'C'].includes(role)) throw new Error('Usage: npm run ownership -- --role A|B|C [--base bootstrap-v2] [--allow-shared]');
  const git = (...values) => execFileSync('git', values, { encoding: 'utf8' });
  git('rev-parse', '--verify', `${base}^{commit}`);
  // Two-dot base-to-working-tree includes branch commits, staged and unstaged changes.
  // --no-renames includes old and new paths; untracked additions are included too.
  const paths = [...new Set([...git('diff', '--no-renames', '--name-only', '-z', base, '--').split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean))];
  const errors = checkPaths(paths, role, args.includes('--allow-shared'));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Ownership passed: role ${role}, base ${base}, ${paths.length} changed paths.`);
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
