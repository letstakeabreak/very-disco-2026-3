import { FIXED_STEP_MS, type Game, type GameCommand, type GameEvent, type GameRenderer, type GameSnapshot } from '../contracts';

/** Fixed-step app coordinator; testable without a DOM or GPU. */
export function createRuntime(game: Game, renderer: GameRenderer, onEvents: (events: readonly GameEvent[]) => void) {
  let accumulator = 0;
  let disposed = false;
  return {
    replaceRenderer(nextRenderer: GameRenderer): void {
      if (disposed) { nextRenderer.dispose(); return; }
      const previousRenderer = renderer;
      renderer = nextRenderer;
      accumulator = 0;
      previousRenderer.dispose();
    },
    dispatch(command: GameCommand): void { if (disposed) return; game.dispatch(command); if (command.type === 'pause' || command.type === 'resume' || command.type === 'restart' || command.type === 'start') accumulator = 0; onEvents(game.drainEvents()); },
    frame(dtMs: number, fixture?: GameSnapshot): void {
      if (disposed) return;
      if (!Number.isFinite(dtMs) || dtMs < 0) throw new RangeError('Frame delta must be finite and nonnegative');
      if (fixture) { accumulator = 0; renderer.render(fixture, 0); return; }
      accumulator += Math.min(dtMs, 100);
      while (accumulator + 1e-9 >= FIXED_STEP_MS) { game.step(FIXED_STEP_MS); accumulator -= FIXED_STEP_MS; }
      onEvents(game.drainEvents());
      renderer.render(game.snapshot(), Math.min(dtMs, 100));
    },
    dispose(): void { if (disposed) return; disposed = true; game.dispose(); renderer.dispose(); },
  };
}
