import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// No GitHub token, cookie, global Git config, credential helper or user session.
const repo = 'letstakeabreak/very-disco-2026-3';
const web = `https://github.com/${repo}`;
const raw = `https://raw.githubusercontent.com/${repo}`;
const report = { checkedAt: new Date().toISOString(), scope: 'Anonymous public read and filtered clone; not another user session or collaborator write proof.', requests: [], passed: false };
const temporary = mkdtempSync(join(tmpdir(), 'deep-press-public-access-'));
const cleanGitEnv = { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '/usr/bin/false', SSH_ASKPASS: '/usr/bin/false' };
const git = (...args) => execFileSync('git', ['-c', 'credential.helper=', '-c', 'http.extraHeader=', ...args], { encoding: 'utf8', timeout: 60000, env: cleanGitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  const endpoints = new Map([
    [`https://api.github.com/repos/${repo}`, 200], [web, 200],
    [`${web}/blob/main/AGENTS.md`, 200], [`${web}/blob/main/instruction.md`, 200],
    [`${raw}/main/goal.md`, 200], [`${web}/pull/1`, 200],
    [`${web}/blob/role/b-render/docs/handoffs/B/README.md`, 200],
    [`${raw}/role/b-render/docs/handoffs/B/README.md`, 200],
    [`${web}/blob/main/docs/work-documents.md`, 200],
    [`${raw}/main/docs/work-documents.md`, 200],
  ]);
  const catalogUrl = `${raw}/main/docs/work-documents.md`;
  const catalogResponse = await fetch(catalogUrl, { headers: { 'User-Agent': 'DEEP-PRESS-public-access-check', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
  if (!catalogResponse.ok) throw new Error(`Cannot read work-document catalog: HTTP ${catalogResponse.status}`);
  const catalog = await catalogResponse.text();
  // Follow the live catalog, so newly published role documents join the check.
  // The invitation is account-specific and is not a public document.
  for (const [, url] of catalog.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)) {
    if ((url.startsWith(`${web}/`) || url.startsWith(`${raw}/`)) && url !== `${web}/invitations`) endpoints.set(url, 200);
  }
  report.catalog = { url: catalogUrl, publicEndpoints: endpoints.size, invitationExcluded: true };
  for (const [url, expected] of endpoints) {
    const response = await fetch(url, { headers: { 'User-Agent': 'DEEP-PRESS-public-access-check', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    report.requests.push({ url, status: response.status, expected, finalUrl: response.url });
    if (response.status !== expected) throw new Error(`Unexpected HTTP ${response.status}: ${url}`);
    if (url.startsWith('https://api.github.com')) {
      const metadata = JSON.parse(body);
      report.repository = { fullName: metadata.full_name, private: metadata.private, visibility: metadata.visibility, defaultBranch: metadata.default_branch };
      if (metadata.private !== false || metadata.visibility !== 'public') throw new Error('Repository is not public');
    }
  }
  const clone = join(temporary, 'repo');
  git('clone', '--depth=1', '--filter=blob:none', '--no-checkout', `${web}.git`, clone);
  const defaultHead = git('-C', clone, 'rev-parse', 'HEAD');
  const agents = git('-C', clone, 'show', 'HEAD:AGENTS.md');
  if (!agents.includes('DEEP PRESS')) throw new Error('Anonymous clone cannot read project instructions');
  git('-C', clone, 'fetch', '--depth=1', '--filter=blob:none', 'origin', 'role/b-render');
  const bHead = git('-C', clone, 'rev-parse', 'FETCH_HEAD');
  const handoff = git('-C', clone, 'show', 'FETCH_HEAD:docs/handoffs/B/README.md');
  if (!handoff.includes('B 작업 인계')) throw new Error('Anonymous fetch cannot read B handoff');
  report.clone = { defaultHead, bHead, filtered: true, checkout: false, readAgents: true, readBHandoff: true };
  report.passed = true;
  console.log(`Anonymous HTTP passed for ${endpoints.size} public endpoints, including every live catalog link. Instruction reads, filtered clone and B branch fetch passed.`);
} catch (error) {
  report.failure = String(error); process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
  writeFileSync(fileURLToPath(new URL('./evidence/public-access-check.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
}
