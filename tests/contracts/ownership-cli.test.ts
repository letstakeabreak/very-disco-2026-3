import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRepos: string[] = [];
const script = resolve('scripts/check-ownership.mjs');
afterEach(() => { for (const repo of temporaryRepos.splice(0)) rmSync(repo, { recursive: true, force: true }); });
function fixtureRepo(): string {
  const repo = mkdtempSync(`${tmpdir()}/deep-press-ownership-`); temporaryRepos.push(repo);
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: repo, stdio: 'pipe' }); };
  mkdirSync(`${repo}/src/core`, { recursive: true });
  writeFileSync(`${repo}/src/core/original.ts`, 'export {};\n');
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Contract Test', '-c', 'user.email=contract-test@example.invalid', 'commit', '-qm', 'fixture');
  git('tag', 'bootstrap-v2');
  return repo;
}
describe('ownership CLI against isolated Git fixtures', () => {
  it('includes staged, unstaged and untracked changes from the shared base', () => {
    const repo = fixtureRepo();
    writeFileSync(`${repo}/src/core/original.ts`, 'export const changed = 1;\n');
    const run = (): string => execFileSync(process.execPath, [script, '--role', 'A'], { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
    expect(run()).toContain('1 changed paths');
    mkdirSync(`${repo}/src/app`, { recursive: true });
    writeFileSync(`${repo}/src/app/foreign.ts`, 'export {};\n');
    expect(run).toThrow();
  });
  it('checks both old and new paths of a cross-role rename', () => {
    const repo = fixtureRepo(); mkdirSync(`${repo}/src/render`, { recursive: true });
    execFileSync('git', ['mv', 'src/core/original.ts', 'src/render/moved.ts'], { cwd: repo });
    expect(() => execFileSync(process.execPath, [script, '--role', 'B'], { cwd: repo, stdio: 'pipe' })).toThrow();
  });
});
