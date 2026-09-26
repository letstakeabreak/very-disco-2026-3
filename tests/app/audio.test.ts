import { describe, expect, it } from 'vitest';
import { createAudio, creakVoice, hydraulicVoice } from '../../src/app/audio';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';

describe('recorded game sound (G11)', () => {
  it('stays silent and safe where Web Audio is missing', () => {
    const audio = createAudio(0.7, 0.8);
    expect(audio.state).toBe('off');
    expect(() => { audio.unlock(); audio.setVolumes(0, 1); audio.update(SNAPSHOT_FIXTURES.compressing); audio.cue('hull'); audio.dispose(); }).not.toThrow();
  });

  it('runs the ram only while pressing, rising with pressure', () => {
    const { compressing, inspecting } = SNAPSHOT_FIXTURES;
    expect(hydraulicVoice(inspecting).gain).toBe(0);
    const low = hydraulicVoice({ ...compressing, pressure01: 0.1 });
    const high = hydraulicVoice({ ...compressing, pressure01: 0.9 });
    expect(high.gain).toBeGreaterThan(low.gain);
    expect(high.rate).toBeGreaterThan(low.rate);
  });

  it('creaks with the core warning cue and only while pressing', () => {
    const { compressing } = SNAPSHOT_FIXTURES;
    expect(creakVoice({ ...compressing, stress01: 0 })).toBe(0);
    expect(creakVoice({ ...compressing, stress01: 0.5 })).toBeGreaterThan(0);
    expect(creakVoice({ ...compressing, phase: 'settling', stress01: 0.5 })).toBe(0);
  });
});
