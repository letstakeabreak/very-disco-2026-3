/** Player settings kept on this device. */
export type TextSpeed = 'normal' | 'fast' | 'instant';

export interface Settings {
  /** Background bed volume, 0–100. */
  readonly music: number;
  /** Effect volume, 0–100. */
  readonly effects: number;
  readonly textSpeed: TextSpeed;
  /** Screen shake on breaks and hull jolts. */
  readonly shake: boolean;
}

export const DEFAULT_SETTINGS: Settings = { music: 70, effects: 80, textSpeed: 'normal', shake: true };

const SPEEDS: readonly TextSpeed[] = ['normal', 'fast', 'instant'];
const volume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : fallback;

/**
 * Settings from stored JSON, falling back field by field on anything unreadable. The old mute
 * switch (before the settings menu) maps to both volumes at zero.
 */
export function parseSettings(stored: string | null, legacyMuted = false): Settings {
  const base = legacyMuted ? { ...DEFAULT_SETTINGS, music: 0, effects: 0 } : DEFAULT_SETTINGS;
  let raw: Record<string, unknown> = {};
  try { const value: unknown = stored ? JSON.parse(stored) : {}; if (value && typeof value === 'object') raw = value as Record<string, unknown>; } catch { /* use defaults */ }
  return {
    music: volume(raw['music'], base.music),
    effects: volume(raw['effects'], base.effects),
    textSpeed: SPEEDS.includes(raw['textSpeed'] as TextSpeed) ? raw['textSpeed'] as TextSpeed : base.textSpeed,
    shake: typeof raw['shake'] === 'boolean' ? raw['shake'] : base.shake,
  };
}

/** Milliseconds per typed character for a base speed; 0 shows the whole line at once. */
export function typingDelay(base: number, speed: TextSpeed): number {
  return speed === 'instant' ? 0 : speed === 'fast' ? base / 2 : base;
}
