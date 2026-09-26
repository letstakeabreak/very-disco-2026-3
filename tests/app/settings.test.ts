import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, typingDelay } from '../../src/app/settings';

describe('settings menu values', () => {
  it('reads stored settings and falls back field by field', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"music":35,"effects":120,"textSpeed":"fast","shake":false}')).toEqual({ music: 35, effects: 100, textSpeed: 'fast', shake: false });
    expect(parseSettings('{"music":"loud","textSpeed":"warp"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps an old mute choice as both volumes at zero', () => {
    expect(parseSettings(null, true)).toMatchObject({ music: 0, effects: 0 });
    expect(parseSettings('{"music":40}', true)).toMatchObject({ music: 40, effects: 0 });
  });

  it('scales typing speed and shows lines at once when set to instant', () => {
    expect(typingDelay(38, 'normal')).toBe(38);
    expect(typingDelay(38, 'fast')).toBe(19);
    expect(typingDelay(38, 'instant')).toBe(0);
  });
});
