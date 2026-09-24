export const ROLE_PREFIXES = Object.freeze({
  A: ['src/core/', 'src/content/', 'tests/core/', 'docs/handoffs/A/'],
  B: ['src/render/', 'public/assets/', 'assets/source/', 'tests/render/', 'docs/handoffs/B/'],
  C: ['src/app/', 'tests/app/', 'docs/handoffs/C/'],
});
const SHARED_PREFIXES = ['src/contracts/', 'tests/contracts/', 'scripts/', '.github/', 'docs/'];
const SHARED_FILES = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.gitignore', '.nvmrc', '.editorconfig', 'AGENTS.md', 'README.md', 'instruction.md', 'goal.md', 'prd.md']);

/** Shared is a separate owner, never an overlapping A/B/C glob. */
export function ownersForPath(path) {
  const roleOwners = Object.entries(ROLE_PREFIXES).filter(([, prefixes]) => prefixes.some((prefix) => path.startsWith(prefix))).map(([role]) => role);
  if (path === 'src/main.ts') roleOwners.push('C');
  if (roleOwners.length) return roleOwners;
  if (SHARED_FILES.has(path) || SHARED_PREFIXES.some((prefix) => path.startsWith(prefix))) return ['shared'];
  return [];
}
export function checkPaths(paths, role, allowShared = false) {
  if (!['A', 'B', 'C'].includes(role)) throw new Error('role must be A, B or C');
  if (allowShared && role !== 'A') throw new Error('Only integration owner A may use --allow-shared after approval');
  return paths.flatMap((path) => {
    const owners = ownersForPath(path);
    if (owners.length !== 1) return [`${path}: expected exactly one owner, got ${owners.join(',') || 'none'}`];
    if (owners[0] === role || (owners[0] === 'shared' && allowShared)) return [];
    return [`${path}: owned by ${owners[0]}, not ${role}`];
  });
}
