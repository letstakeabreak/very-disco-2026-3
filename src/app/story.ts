import type { GameSnapshot } from '../contracts';

export type StoryPose = 'yunseo-concerned' | 'yunseo-relieved' | 'dohyeon-explaining' | 'dohyeon-resolved';
/** sea: the flooded porthole, room: the workshop. */
export type StoryScene = 'sea' | 'room';

/** One visual-novel line. A null speaker is narration and shows no sprite. */
export interface StoryLine {
  readonly speaker: '윤서' | '도현' | null;
  readonly pose: StoryPose | null;
  readonly scene: StoryScene;
  readonly text: string;
}

const narration = (text: string): StoryLine => ({ speaker: null, pose: null, scene: 'sea', text });
const yunseo = (pose: 'yunseo-concerned' | 'yunseo-relieved', text: string): StoryLine => ({ speaker: '윤서', pose, scene: 'room', text });
const dohyeon = (pose: 'dohyeon-explaining' | 'dohyeon-resolved', text: string): StoryLine => ({ speaker: '도현', pose, scene: 'room', text });

export const INTRO_STORY: readonly StoryLine[] = [
  narration('깊은 바다 밑, 연구소가 물에 잠겼다.'),
  narration('남은 건 작업실 하나와, 건져 온 부품 세 개.'),
  yunseo('yunseo-concerned', '들려요? 윤서예요. 수면 위 지원선이에요.'),
  yunseo('yunseo-concerned', '전원 코어, 관측 렌즈, 그리고 연구 기록 카세트. 하나도 두고 오고 싶지 않아요.'),
  dohyeon('dohyeon-explaining', '문제는 케이스예요. 회수 캡슐에 실을 수 있는 건 1리터짜리 하나뿐이에요.'),
  dohyeon('dohyeon-explaining', '그대로는 안 들어가요. 그래서 이 프레스로 눌러야 해요.'),
  dohyeon('dohyeon-explaining', '겉은 줄이고, 안은 지키고. 너무 세게 누르면 속까지 부서져요.'),
  yunseo('yunseo-concerned', '부탁해요. 가져올 수 있는 만큼만이라도.'),
  dohyeon('dohyeon-resolved', '좋아요. 작업대로 가죠.'),
];

/** The ending acknowledges only actual stored objects and their committed integrity. */
export function endingStory(snapshot: GameSnapshot): readonly StoryLine[] {
  const cassette = snapshot.storedSpecimens.find(item => item.id === 'salvage-cassette');
  if (cassette) return cassette.integrity01 < 1 ? [
    yunseo('yunseo-relieved', '카세트, 담아 왔군요.'),
    yunseo('yunseo-relieved', '조금 상했지만, 남은 기록부터 읽어 볼게요.'),
    dohyeon('dohyeon-resolved', '케이스는 수면으로 올려 보낼게요. 수고했어요.'),
  ] : [
    yunseo('yunseo-relieved', '기록이 무사해요.'),
    yunseo('yunseo-relieved', '연구소는 가라앉아도, 우리가 본 건 남았어요. 고마워요.'),
    dohyeon('dohyeon-resolved', '케이스는 수면으로 올려 보낼게요. 수고했어요.'),
  ];
  if (snapshot.storedSpecimens.length > 0) return [
    dohyeon('dohyeon-resolved', '담은 부품은 제가 수면으로 올릴게요.'),
    yunseo('yunseo-concerned', '기록은 못 가져왔지만, 이걸로 다시 시작해 봐요.'),
  ];
  return [
    yunseo('yunseo-concerned', '케이스가 비어 있네요.'),
    dohyeon('dohyeon-explaining', '괜찮아요. 조금씩 눌렀다 떼면 돼요. 다시 해 봐요.'),
  ];
}
