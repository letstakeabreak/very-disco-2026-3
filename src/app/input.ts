import type { GameCommand, GamePhase, GameSnapshot } from '../contracts';

type PointerInput = Readonly<{ pointerId: number; clientX: number; surfaceWidth: number }>;

type InputControllerOptions = Readonly<{
  getSnapshot: () => GameSnapshot;
  dispatch: (command: GameCommand) => void;
  onInspectionMoved: () => void;
}>;

/** Owns the single active touch/mouse gesture and ignores every competing pointer. */
export function createInputController({ getSnapshot, dispatch, onInspectionMoved }: InputControllerOptions) {
  let activePointerId: number | null = null;
  let gesture: 'inspect' | 'press' | null = null;
  let originX = 0;
  let originYawRad = 0;
  let inspectionMoved = false;

  function beginInspect({ pointerId, clientX }: PointerInput): boolean {
    const snapshot = getSnapshot();
    if (activePointerId !== null || snapshot.phase !== 'inspecting' || snapshot.currentSpecimen === null) return false;
    activePointerId = pointerId;
    gesture = 'inspect';
    originX = clientX;
    originYawRad = snapshot.inspectionYawRad;
    inspectionMoved = false;
    return true;
  }

  function moveInspect({ pointerId, clientX, surfaceWidth }: PointerInput): boolean {
    if (activePointerId !== pointerId || gesture !== 'inspect') return false;
    const deltaX = clientX - originX;
    if (!inspectionMoved && Math.abs(deltaX) < 2) return false;
    inspectionMoved = true;
    dispatch({ type: 'inspect', yawRad: originYawRad + (deltaX / Math.max(1, surfaceWidth)) * Math.PI * 2 });
    onInspectionMoved();
    return true;
  }

  function endInspect(pointerId: number): boolean {
    if (activePointerId !== pointerId || gesture !== 'inspect') return false;
    activePointerId = null;
    gesture = null;
    return true;
  }

  function beginPress(pointerId: number): boolean {
    if (activePointerId !== null || getSnapshot().phase !== 'inspecting') return false;
    activePointerId = pointerId;
    gesture = 'press';
    try {
      dispatch({ type: 'press-start' });
    } catch (error) {
      activePointerId = null;
      gesture = null;
      throw error;
    }
    if (getSnapshot().phase !== 'compressing') {
      activePointerId = null;
      gesture = null;
      return false;
    }
    return true;
  }

  function endPress(pointerId: number): boolean {
    if (activePointerId !== pointerId || gesture !== 'press') return false;
    activePointerId = null;
    gesture = null;
    if (getSnapshot().phase !== 'compressing') return true;
    dispatch({ type: 'press-release' });
    return true;
  }

  /** Cancel capture safely: the game pauses, so a stale pointer-up cannot release the press. */
  function cancel(pointerId?: number): boolean {
    if (activePointerId === null || (pointerId !== undefined && activePointerId !== pointerId)) return false;
    // A hold the core already ended (automatic settling at full pressure) has no
    // uncommitted stroke left; pausing would only cover its result.
    const endedPress = gesture === 'press' && getSnapshot().phase !== 'compressing';
    activePointerId = null;
    gesture = null;
    if (!endedPress && isGameplayPhase(getSnapshot().phase)) dispatch({ type: 'pause' });
    return true;
  }

  function clear(): void {
    activePointerId = null;
    gesture = null;
  }

  return { beginInspect, moveInspect, endInspect, beginPress, endPress, cancel, clear };
}

export function isGameplayPhase(phase: GamePhase): boolean {
  return phase !== 'idle' && phase !== 'paused' && phase !== 'complete';
}
