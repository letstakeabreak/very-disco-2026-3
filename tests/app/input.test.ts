import { describe, expect, it, vi } from 'vitest';
import type { GameCommand, GameSnapshot } from '../../src/contracts';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { createInputController } from '../../src/app/input';

function harness(initial: GameSnapshot = SNAPSHOT_FIXTURES.inspecting) {
  let snapshot: GameSnapshot = initial;
  const commands: GameCommand[] = [];
  const onInspectionMoved = vi.fn();
  const controller = createInputController({
    getSnapshot: () => snapshot,
    dispatch(command) {
      commands.push(command);
      if (command.type === 'press-start') snapshot = { ...snapshot, phase: 'compressing' };
      if (command.type === 'press-release') snapshot = { ...snapshot, phase: 'settling' };
      if (command.type === 'pause') snapshot = { ...snapshot, phase: 'paused', resumePhase: 'inspecting' };
    },
    onInspectionMoved,
  });
  return { controller, commands, onInspectionMoved, getSnapshot: () => snapshot, setSnapshot: (next: GameSnapshot) => { snapshot = next; } };
}

describe('single-pointer input lifecycle', () => {
  it('releases exactly once and ignores a second pointer', () => {
    const { controller, commands } = harness();
    expect(controller.beginPress(11)).toBe(true);
    expect(controller.beginPress(12)).toBe(false);
    expect(controller.endPress(12)).toBe(false);
    expect(controller.endPress(11)).toBe(true);
    expect(controller.endPress(11)).toBe(false);
    expect(commands).toEqual([{ type: 'press-start' }, { type: 'press-release' }]);
  });

  it('pauses a cancelled gesture and rejects its stale pointer-up', () => {
    const { controller, commands, getSnapshot } = harness();
    expect(controller.beginPress(21)).toBe(true);
    expect(controller.cancel(21)).toBe(true);
    expect(getSnapshot().phase).toBe('paused');
    expect(controller.endPress(21)).toBe(false);
    expect(commands).toEqual([{ type: 'press-start' }, { type: 'pause' }]);
  });

  it('does not pause a hold the core already ended by settling at full pressure', () => {
    const { controller, commands, getSnapshot, setSnapshot } = harness();
    expect(controller.beginPress(51)).toBe(true);
    setSnapshot({ ...getSnapshot(), phase: 'settling' });
    expect(controller.cancel(51)).toBe(true);
    expect(controller.endPress(51)).toBe(false);
    expect(commands).toEqual([{ type: 'press-start' }]);
  });

  it('rotates by horizontal drag in radians and prevents overlapping gestures', () => {
    const { controller, commands, onInspectionMoved } = harness();
    expect(controller.beginInspect({ pointerId: 31, clientX: 100, surfaceWidth: 400 })).toBe(true);
    expect(controller.beginPress(32)).toBe(false);
    expect(controller.moveInspect({ pointerId: 32, clientX: 180, surfaceWidth: 400 })).toBe(false);
    expect(controller.moveInspect({ pointerId: 31, clientX: 200, surfaceWidth: 400 })).toBe(true);
    expect(commands).toEqual([{ type: 'inspect', yawRad: Math.PI / 2 }]);
    expect(onInspectionMoved).toHaveBeenCalledOnce();
    expect(controller.endInspect(31)).toBe(true);
  });

  it('cancels inspection capture without retaining a pointer', () => {
    const { controller, commands } = harness();
    expect(controller.beginInspect({ pointerId: 41, clientX: 0, surfaceWidth: 320 })).toBe(true);
    expect(controller.cancel(41)).toBe(true);
    expect(controller.moveInspect({ pointerId: 41, clientX: 20, surfaceWidth: 320 })).toBe(false);
    expect(commands).toEqual([{ type: 'pause' }]);
  });
});
