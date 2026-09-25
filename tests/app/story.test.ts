import { describe, expect, it } from 'vitest';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { INTRO_STORY, endingStory } from '../../src/app/story';

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
    expect(text(endingStory(SNAPSHOT_FIXTURES.complete))).toContain('기록은 못 가져왔지만');
  });

  it('acknowledges a stored cassette but does not call damaged records intact', () => {
    const cassette = { ...SNAPSHOT_FIXTURES.complete.storedSpecimens[0]!, id: 'salvage-cassette' as const, integrity01: 1 };
    const recovered = { ...SNAPSHOT_FIXTURES.complete, storedSpecimens: [cassette], storedSpecimenIds: ['salvage-cassette'] as const };
    expect(text(endingStory(recovered))).toContain('기록이 무사해요');
    const damaged = text(endingStory({ ...recovered, storedSpecimens: [{ ...cassette, integrity01: .6 }] }));
    expect(damaged).toContain('조금 상했지만');
    expect(damaged).not.toContain('무사해요');
  });
});
