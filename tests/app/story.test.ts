import { describe, expect, it } from 'vitest';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { INTRO_STORY, endingStory, reactionLine, toleranceLine, tutorialLine } from '../../src/app/story';

const text = (lines: readonly { text: string }[]) => lines.map(line => line.text).join(' ');

describe('recovery story follows committed cargo', () => {
  it('opens on narration and hands off to the workbench', () => {
    expect(INTRO_STORY[0]).toMatchObject({ speaker: null, pose: null, scene: 'sea' });
    expect(INTRO_STORY.at(-1)).toMatchObject({ speaker: '도현', scene: 'room' });
    for (const line of INTRO_STORY) expect(line.speaker === null).toBe(line.pose === null);
  });

  it('does not claim the selected or discarded cassette was recovered', () => {
    const empty = { ...SNAPSHOT_FIXTURES.complete, storedSpecimens: [], storedSpecimenIds: [] };
    expect(text(endingStory(empty))).toContain('비어 있네요');
    expect(endingStory(empty)[0]!.pose).toBe('yunseo-concerned');
    expect(text(endingStory(SNAPSHOT_FIXTURES.complete))).toContain('기록은 못 건졌지만');
  });

  it('acknowledges a stored cassette but does not call damaged records intact', () => {
    const cassette = { ...SNAPSHOT_FIXTURES.complete.storedSpecimens[0]!, id: 'salvage-cassette' as const, integrity01: 1 };
    const recovered = { ...SNAPSHOT_FIXTURES.complete, storedSpecimens: [cassette], storedSpecimenIds: ['salvage-cassette'] as const };
    expect(text(endingStory(recovered))).toContain('기록이 멀쩡해요');
    const damaged = text(endingStory({ ...recovered, storedSpecimens: [{ ...cassette, integrity01: .6 }] }));
    expect(damaged).toContain('조금 망가졌지만');
    expect(damaged).not.toContain('멀쩡해요');
  });
});

describe('the characters keep talking during the round', () => {
  it('names why each lot matters when it goes into the press', () => {
    const { inspecting } = SNAPSHOT_FIXTURES;
    expect(reactionLine({ type: 'specimen-selected', tick: 1, specimenId: 'salvage-cassette' }, inspecting)).toEqual({ speaker: '윤서', text: expect.stringContaining('기록') });
    expect(reactionLine({ type: 'press-released', tick: 1, pressure01: .3 }, inspecting)).toBeNull();
  });

  it('reacts to banking, breaking and overflow from the committed state', () => {
    const { stored, failed } = SNAPSHOT_FIXTURES;
    const room = (stored.capacity - stored.volumeUsed).toFixed(2);
    expect(reactionLine({ type: 'stored', tick: 1, specimenId: 'salvage-lens', scoreDelta: 1 }, stored)!.text).toContain(`${room}리터`);
    expect(reactionLine({ type: 'failed', tick: 1, reason: 'capacity-exceeded' }, failed)!.speaker).toBe('도현');
    const brokenCassette = { ...failed, currentSpecimen: { ...failed.currentSpecimen!, id: 'salvage-cassette' as const } };
    expect(reactionLine({ type: 'failed', tick: 1, reason: 'specimen-broken' }, brokenCassette)!.text).toContain('기록');
  });

  it('keeps the tutorial and tolerance advice in 도현\'s voice', () => {
    expect(tutorialLine(0).text).toContain('좌우로 끌어서');
    expect(tutorialLine(99)).toEqual(tutorialLine(2));
    expect(toleranceLine('fragile')).toEqual({ speaker: '도현', text: '약해 보여요. 살살 눌러요.' });
  });
});
