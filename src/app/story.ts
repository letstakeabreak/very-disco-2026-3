import type { GameSnapshot, SalvageId } from '../contracts';

export interface StoryBeat {
  readonly speaker: string;
  readonly role: string;
  readonly portrait: string;
  readonly title: string;
  readonly text: string;
  readonly manifest?: boolean;
}

export const SPECIMEN_PURPOSE: Readonly<Record<SalvageId, string>> = {
  'salvage-core': '장비에 다시 전원을 넣을 에너지 코어',
  'salvage-lens': '바닷속을 관찰하던 장치의 광학 렌즈',
  'salvage-cassette': '연구소의 관측 기록이 담긴 데이터 카세트',
};

export const INTRO_STORY: readonly StoryBeat[] = [
  {
    speaker: '윤서', role: '연구원', portrait: 'yunseo-concerned', title: '물속에 남은 연구소',
    text: '연구소가 침수됐어요. 도현이 잠긴 실험실에서 세 부품을 건져 이 작업실로 가져왔어요. 전원 장치, 관측 장치, 그리고 우리가 남긴 기록. 그냥 두고 갈 수는 없어요.',
  },
  {
    speaker: '도현', role: '회수 기사', portrait: 'dohyeon-explaining', title: '가져갈 수 있는 건 1L',
    text: '큰 운반함은 침수됐어요. 수면으로 올릴 회수 캡슐에는 이 1L 케이스만 들어가요. 세 부품은 그대로 모두 담을 수 없어요. 안에 남은 가치를 골라 가져가야 해요.', manifest: true,
  },
  {
    speaker: '도현', role: '회수 기사', portrait: 'dohyeon-explaining', title: '겉을 줄여, 안을 지켜요',
    text: '이 프레스로 바깥 하우징과 완충틀을 줄일 수 있어요. 너무 누르면 안쪽도 망가지죠. 먼저 돌려 살펴보고, 조금씩 눌렀다 떼세요. 크기와 가치를 확인한 뒤 케이스에 담으면 돼요.',
  },
];

/** The ending acknowledges only actual stored objects and their committed integrity. */
export function endingStory(snapshot: GameSnapshot): StoryBeat {
  const cassette = snapshot.storedSpecimens.find(item => item.id === 'salvage-cassette');
  if (cassette) return {
    speaker: '윤서', role: '연구원', portrait: 'yunseo-relieved',
    title: cassette.integrity01 < 1 ? '남아 있는 기록부터' : '기록은 가라앉지 않아요',
    text: cassette.integrity01 < 1
      ? '데이터 카세트를 담았군요. 손상은 있지만, 남아 있는 기록부터 읽어 볼게요. 작은 케이스 안에 우리가 이어 갈 일이 남았어요. 이제 수면으로 보내 주세요.'
      : '데이터 카세트를 지켜 줬군요. 연구소는 물속에 남아도, 우리가 본 것들은 사라지지 않겠어요. 이제 이 케이스를 수면으로 보내 주세요. 고마워요.',
  };
  if (snapshot.storedSpecimens.length > 0) return {
    speaker: '도현', role: '회수 기사', portrait: 'dohyeon-resolved', title: '다시 시작할 부품들',
    text: '담아 둔 부품은 제가 수면으로 올릴게요. 연구 기록까지 가져오진 못했지만, 이 부품으로 다시 시작할 수 있겠죠. 무엇을 남길지 끝까지 골라 줘서 고마워요.',
  };
  return {
    speaker: '윤서', role: '연구원', portrait: 'yunseo-concerned', title: '아직, 빈 케이스',
    text: '이번에는 가져올 물건을 담지 못했네요. 다음 작업에서는 조금씩 눌렀다 떼어 봐요. 작아지는 것보다 중요한 건 안에 남는 가치예요. 다시 해 볼 수 있어요.',
  };
}
