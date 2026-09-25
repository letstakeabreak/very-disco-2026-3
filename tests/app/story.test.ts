import { describe, expect, it } from 'vitest';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { endingStory } from '../../src/app/story';

describe('recovery story follows committed cargo', () => {
  it('does not claim the selected or discarded cassette was recovered', () => {
    const empty = { ...SNAPSHOT_FIXTURES.complete, storedSpecimens: [], storedSpecimenIds: [] };
    expect(endingStory(empty).title).toBe('아직, 빈 케이스');
    expect(endingStory(empty).portrait).toBe('yunseo-concerned');
    expect(endingStory(SNAPSHOT_FIXTURES.complete).text).toContain('연구 기록까지 가져오진 못했지만');
  });

  it('acknowledges a stored cassette but does not call damaged records intact', () => {
    const cassette = { ...SNAPSHOT_FIXTURES.complete.storedSpecimens[0]!, id: 'salvage-cassette' as const, integrity01: 1 };
    const recovered = { ...SNAPSHOT_FIXTURES.complete, storedSpecimens: [cassette], storedSpecimenIds: ['salvage-cassette'] as const };
    expect(endingStory(recovered).title).toBe('기록은 가라앉지 않아요');
    expect(endingStory({ ...recovered, storedSpecimens: [{ ...cassette, integrity01: .6 }] }).text).toContain('손상은 있지만');
  });
});
