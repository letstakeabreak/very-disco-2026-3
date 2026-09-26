import { describe, expect, it } from 'vitest';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { CASE_CLOSING_LINE, INTRO_STORY, endingStory, reactionLine, toleranceLine, tutorialLine, tutorialStage } from '../../src/app/story';
import type { LotOutcome } from '../../src/app/presentation';
import { authoredGameConfig } from '../../src/core';

const text = (lines: readonly { text: string }[]) => lines.map(line => line.text).join(' ');

describe('recovery story follows committed cargo', () => {
  it('opens on narration and hands off to the workbench', () => {
    expect(INTRO_STORY[0]).toMatchObject({ speaker: null, pose: null, scene: 'sea' });
    expect(INTRO_STORY.at(-1)).toMatchObject({ speaker: '도현', scene: 'room' });
    expect(INTRO_STORY.length).toBeLessThanOrEqual(6);
    for (const line of INTRO_STORY) expect(line.speaker === null).toBe(line.pose === null);
  });

  const ending = (core: LotOutcome, lens: LotOutcome, cassette: LotOutcome) => endingStory({ 'salvage-core': core, 'salvage-lens': lens, 'salvage-cassette': cassette });

  it('says the records broke when the player crushed them, and never smiles after a loss', () => {
    const lines = ending('stored', 'stored', 'broken');
    expect(text(lines)).toContain('기록이 결국 부서졌네요');
    expect(text(lines)).not.toContain('두고 왔');
    expect(lines.map((line) => line.pose)).not.toContain('dohyeon-resolved');
    expect(lines.find((line) => line.text.includes('부서졌네요'))!.mood).toBe('sad');
  });

  it('acknowledges a stored cassette but does not call damaged records intact', () => {
    expect(text(ending('stored', 'left', 'stored'))).toContain('기록이 멀쩡해요');
    const damaged = text(ending('stored', 'left', 'damaged'));
    expect(damaged).toContain('조금 망가졌지만');
    expect(damaged).not.toContain('멀쩡해요');
  });

  it('names each lot that came home and saves the smile for all three', () => {
    const all = ending('stored', 'damaged', 'stored');
    expect(text(all)).toContain('장비를 다시 켤 수 있어요');
    expect(text(all)).toContain('다시 바다를 볼 수 있겠어요');
    expect(all.at(-1)!.pose).toBe('dohyeon-resolved');
    expect(text(ending('broken', 'left', 'stored'))).toContain('예비 전원');
    const empty = ending('left', 'broken', 'left');
    expect(text(empty)).toContain('비어 있네요');
    expect(empty[0]!.pose).toBe('yunseo-concerned');
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

  it('reads the tutorial stage from the round and names the tolerance before pressing', () => {
    const { idle, inspecting } = SNAPSHOT_FIXTURES;
    const revealed = { ...inspecting, currentSpecimen: { ...inspecting.currentSpecimen!, tolerance: 'sturdy' as const } };
    const pressed = { ...revealed, currentSpecimen: { ...revealed.currentSpecimen, compression01: 0.4 } };
    expect(tutorialStage(idle)).toBe('plan');
    expect(tutorialStage(inspecting)).toBe('rotate');
    expect(tutorialStage(revealed)).toBe('press');
    expect(tutorialStage(pressed)).toBe('store');
    expect(tutorialLine('plan', null).text).toContain('골라');
    expect(tutorialLine('rotate', null).text).toContain('좌우로 끌어서');
    expect(tutorialLine('press', 'sturdy').text).toBe('튼튼하네요. 압축하기를 누르다 삐걱대면 떼요.');
    expect(toleranceLine('fragile')).toEqual({ speaker: '도현', text: '약해 보여요. 살살 눌러요.' });
  });

  it('names a lot that can no longer fit instead of asking for it, and closes the case when nothing fits', () => {
    const config = authoredGameConfig();
    const { stored } = SNAPSHOT_FIXTURES;
    const event = { type: 'stored', tick: 1, specimenId: 'salvage-core', scoreDelta: 360 } as const;
    const tight = { ...stored, volumeUsed: 0.9, remainingSpecimenIds: ['salvage-lens', 'salvage-cassette'] as const };
    expect(reactionLine(event, tight, config)).toEqual(CASE_CLOSING_LINE);
    const oneLeft = { ...stored, volumeUsed: 0.8, remainingSpecimenIds: ['salvage-lens', 'salvage-cassette'] as const };
    expect(reactionLine(event, oneLeft, config)).toEqual({ speaker: '도현', text: '광학 렌즈는 이제 어떻게 눌러도 안 들어가요.' });
    expect(reactionLine(event, { ...stored, volumeUsed: 0.4 }, config)!.text).toContain('남았어요');
  });
});
