import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core';
import { createRuntime } from '../../src/app/runtime';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import type { GameRenderer } from '../../src/contracts';

const fakeRenderer = (): GameRenderer => ({ resize: vi.fn(), render: vi.fn(), dispose: vi.fn() });
describe('app consumer integration', () => {
  it('steps at fixed intervals and caps long frame catchup', () => {
    const game = createGame(DEFAULT_GAME_CONFIG); const renderer = fakeRenderer();
    const runtime = createRuntime(game, renderer, vi.fn());
    runtime.dispatch({ type: 'select', specimenId: 'salvage-core' }); runtime.dispatch({ type: 'press-start' }); runtime.frame(10000);
    expect(game.snapshot().tick).toBe(6); expect(game.snapshot().pressure01).toBeCloseTo(0.025);
    expect(renderer.render).toHaveBeenCalledOnce();
  });
  it('uses fixtures without advancing core and tolerates repeated cleanup', () => {
    const game = createGame(DEFAULT_GAME_CONFIG); const renderer = fakeRenderer();
    const runtime = createRuntime(game, renderer, vi.fn());
    for (const fixture of Object.values(SNAPSHOT_FIXTURES)) runtime.frame(50, fixture);
    expect(game.snapshot().tick).toBe(0); expect(renderer.render).toHaveBeenCalledTimes(8);
    runtime.dispose(); runtime.dispose(); runtime.frame(30); expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('keeps paused time stopped and resumes only after an explicit command', () => {
    const game = createGame(DEFAULT_GAME_CONFIG); const renderer = fakeRenderer();
    const runtime = createRuntime(game, renderer, vi.fn());
    runtime.dispatch({ type: 'select', specimenId: 'salvage-core' });
    runtime.dispatch({ type: 'press-start' });
    runtime.frame(33.4);
    const beforePause = game.snapshot();
    runtime.dispatch({ type: 'pause' });
    runtime.frame(100);
    expect(game.snapshot().tick).toBe(beforePause.tick);
    runtime.dispatch({ type: 'resume' });
    runtime.frame(16.7);
    expect(game.snapshot().tick).toBe(beforePause.tick + 1);
    runtime.dispose();
  });
});
