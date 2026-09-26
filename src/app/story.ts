import type { GameEvent, GameSnapshot, SalvageId, Tolerance } from '../contracts';
import { remainingCapacity } from './presentation';

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
  narration('깊은 바닷속 연구소가 물에 잠겼다.'),
  narration('남은 건 작업실 하나와 건져 낸 부품 세 개뿐이다.'),
  yunseo('yunseo-concerned', '들려요? 저 윤서예요. 지금 지원선에서 연결했어요.'),
  yunseo('yunseo-concerned', '건진 게 코어랑 렌즈랑 기록 카세트 맞죠? 셋 다 가져올 수 있으면 좋겠어요.'),
  dohyeon('dohyeon-explaining', '문제는 케이스예요. 캡슐에 실을 수 있는 게 1리터짜리 하나뿐이거든요.'),
  dohyeon('dohyeon-explaining', '그냥은 안 들어가요. 이 프레스로 눌러서 부피를 줄여야 해요.'),
  dohyeon('dohyeon-explaining', '겉만 줄이는 거예요. 너무 세게 누르면 속까지 망가져요.'),
  yunseo('yunseo-concerned', '부탁할게요. 가져올 수 있는 만큼만이라도요.'),
  dohyeon('dohyeon-resolved', '그럼 작업대로 가요.'),
];

/** The ending acknowledges only actual stored objects and their committed integrity. */
export function endingStory(snapshot: GameSnapshot): readonly StoryLine[] {
  const cassette = snapshot.storedSpecimens.find(item => item.id === 'salvage-cassette');
  if (cassette) return cassette.integrity01 < 1 ? [
    yunseo('yunseo-relieved', '카세트 챙겨 왔네요!'),
    yunseo('yunseo-relieved', '조금 망가졌지만 남은 기록부터 읽어 볼게요.'),
    dohyeon('dohyeon-resolved', '케이스는 제가 올려 보낼게요. 수고 많았어요.'),
  ] : [
    yunseo('yunseo-relieved', '기록이 멀쩡해요!'),
    yunseo('yunseo-relieved', '연구소는 잠겼어도 우리가 본 건 남았네요. 고마워요.'),
    dohyeon('dohyeon-resolved', '케이스는 제가 올려 보낼게요. 수고 많았어요.'),
  ];
  if (snapshot.storedSpecimens.length > 0) return [
    dohyeon('dohyeon-resolved', '담은 부품은 제가 올려 보낼게요.'),
    yunseo('yunseo-concerned', '기록은 못 건졌지만 이걸로 다시 시작해 봐요.'),
  ];
  return [
    yunseo('yunseo-concerned', '케이스가 비어 있네요.'),
    dohyeon('dohyeon-explaining', '처음엔 다 그래요. 조금씩 눌렀다 떼면서 다시 해 봐요.'),
  ];
}

/** One in-round voice line: the same two characters keep talking at the workbench. */
export interface CommsLine {
  readonly speaker: '윤서' | '도현';
  readonly text: string;
}

const TUTORIAL: readonly CommsLine[] = [
  { speaker: '도현', text: '좌우로 끌어서 한번 돌려 봐요. 얼마나 버틸지 보일 거예요.' },
  { speaker: '도현', text: '버튼을 꾹 누르고 있다가 원하는 만큼 줄면 손을 떼요.' },
  { speaker: '도현', text: '크기랑 가치를 보고 괜찮으면 담아요.' },
];

/** Why each lot matters, said when it goes into the press. */
const LOT_LINES: Readonly<Record<SalvageId, CommsLine>> = {
  'salvage-core': { speaker: '윤서', text: '전원 코어예요. 이게 있어야 장비를 다시 켤 수 있어요.' },
  'salvage-lens': { speaker: '윤서', text: '관측 렌즈네요. 이걸로 바닷속을 들여다봤어요.' },
  'salvage-cassette': { speaker: '윤서', text: '연구 기록이 든 카세트예요. 이건 꼭 좀 챙겨 주세요.' },
};

const TOLERANCE_LINES: Readonly<Record<Tolerance, CommsLine>> = {
  fragile: { speaker: '도현', text: '약해 보여요. 살살 눌러요.' },
  normal: { speaker: '도현', text: '적당히 버티겠네요. 천천히 눌러 봐요.' },
  sturdy: { speaker: '도현', text: '튼튼하네요. 세게 눌러도 괜찮아요.' },
};

export const STRAIN_LINE: CommsLine = { speaker: '도현', text: '삐걱거려요! 손 떼요!' };

export function tutorialLine(step: number): CommsLine {
  return TUTORIAL[Math.min(TUTORIAL.length - 1, Math.max(0, step))]!;
}

export function toleranceLine(tolerance: Tolerance): CommsLine {
  return TOLERANCE_LINES[tolerance];
}

/** The characters' reaction to a round event, from the state after it; null keeps the current line. */
export function reactionLine(event: GameEvent, snapshot: GameSnapshot): CommsLine | null {
  if (event.type === 'specimen-selected') return LOT_LINES[event.specimenId];
  if (event.type === 'stored') return event.specimenId === 'salvage-cassette'
    ? { speaker: '윤서', text: '기록 담았네요. 정말 고마워요.' }
    : { speaker: '도현', text: `담았어요. 이제 ${remainingCapacity(snapshot).toFixed(2)}리터 남았어요.` };
  if (event.type === 'discarded') return event.specimenId === 'salvage-cassette'
    ? { speaker: '윤서', text: '기록은 결국 두고 가네요.' }
    : { speaker: '도현', text: '이건 여기 두고 가요.' };
  if (event.type === 'failed') {
    if (event.reason === 'capacity-exceeded') return { speaker: '도현', text: '이대로는 케이스에 안 들어가요.' };
    return snapshot.currentSpecimen?.id === 'salvage-cassette'
      ? { speaker: '윤서', text: '기록이 부서져 버렸어요.' }
      : { speaker: '윤서', text: '부서져 버렸네요.' };
  }
  return null;
}
