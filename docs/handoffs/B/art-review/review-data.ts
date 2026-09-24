export const criteria = ['실루엣·상대 크기','카메라 구도','재질 구별','환경광·호박색 포인트','접촉·그림자','변형 설득력','작은 화면 가독성'] as const;
export type Verdict = '통과' | '미달' | '미검증';
export type TargetReview = { id: string; title: string; concept: string; size: string; mode: string; summary: string;
  verdicts: readonly [Verdict,Verdict,Verdict,Verdict,Verdict,Verdict,Verdict]; notes: readonly string[]; mobile: boolean };
export const reviews: readonly TargetReview[] = [
  {id:'01',title:'작업대 / 검사 전',concept:'01-workbench.png',size:'1024 × 1536',mode:'공개 createRenderer + 카세트 inspecting fixture',summary:'부분 대응. 작업대의 재질과 색 구분은 보이지만, 전체 장비를 담는 구도 때문에 선택 물건이 목표보다 작다.',mobile:true,
    verdicts:['미달','미달','통과','통과','미달','미검증','미달'],notes:[
      '목표는 상단을 자른 작업 영역 근접 구도다. 실제는 큰 하단 박스와 장비 전체를 담아 물건의 상대 크기가 줄었다. 같은 2:3 출력은 구도 일치의 증거가 아니다.',
      '밝은 세라믹·어두운 금속·호박색 중심부는 구별된다. 이 통과는 재질 구별에 한정하며 목표의 미세한 표면·투명 깊이까지 재현했다는 뜻은 아니다.',
      '받침과 물건 사이의 접촉 위치가 목표처럼 명료하지 않다. 이는 시각 판정이며 물리적 부유 또는 충돌을 계산해 입증한 결과가 아니다.',
      '390/320px에서 물건 자체는 보이지만 손상·접힘 같은 세부 상태를 읽기 어렵다. 이 정상 정지 화면으로 변형을 검증하지 않는다.'
    ]},
  {id:'02',title:'압력 적용 / 60%',concept:'02-pressure-state.png',size:'1024 × 1536',mode:'공개 createRenderer + 카세트 compressing fixture',summary:'부분 대응. 램 하강·물건 높이 감소·게이지 변화는 보인다. 목표의 재질별 접힘과 상태 가독성에는 미달한다.',mobile:true,
    verdicts:['미달','미달','통과','통과','통과','미달','미달'],notes:[
      '01과 비교하면 램이 물건 위로 내려오고 압력 바늘이 달라진다. 접촉 통과는 이 정지 화면의 시각적 접촉과 그림자에 한정한다.',
      '큰 장비와 작은 카세트의 비율은 그대로다. 내려온 램이 물건 상당 부분을 가려 작은 화면에서 결과를 알아보기 더 어렵다.',
      '높이 압축은 구분되지만 목표의 꺾인 외피·미세 파손을 읽을 만큼 설득력 있게 보이지 않는다. 압축 전후 존재만으로 변형 완성 판정을 내리지 않는다.',
      'pressure 0.6 / integrity 1은 진단용 snapshot이다. A의 계산 결과가 아니며, 무결성 100%인 이 캡처는 렌즈 파손 셰이더를 검증하지 않는다.'
    ]},
  {id:'03',title:'카세트 / 독립 에셋',concept:'03-salvage-cassette-reference.png',size:'1254 × 1254',mode:'별도 Three.js 에셋 뷰어 · 동일 runtime GLB/PBR',summary:'부분 대응. 전면 왼쪽 ¾ 방향과 주요 부품 구조는 대응한다. 목표의 호박색 투명 깊이와 세밀한 표면 품질은 남아 있다.',mobile:false,
    verdicts:['통과','통과','통과','미달','통과','미검증','미검증'],notes:[
      '카메라 통과는 방향·전체 실루엣·여백을 확인한 한정 판정이다. 원본과 픽셀 단위로 같은 투영이나 크기를 맞춘 것은 아니다.',
      '밝은 외피·검은 띠·중앙 원통은 구별된다. 실제 원통은 목표보다 불투명한 금색에 가깝고 표면 굴곡과 베이크 흔적이 더 드러난다.',
      '임베디드 geometry/color/MR/normal은 교체하지 않았다. 별도 검사 조명과 바닥 그림자를 사용하므로 게임 장면 자체의 조명 합격 증거는 아니다.',
      '정적 근접 캡처다. 변형·회전 조작·모바일 플레이 가독성을 검사하지 않았다.'
    ]},
  {id:'04',title:'프레스 / 독립 에셋',concept:'04-press-chamber-reference.png',size:'1254 × 1254',mode:'별도 Three.js 에셋 뷰어 · 동일 runtime GLB/PBR',summary:'부분 대응. 전체 기계와 빈 작업 공간의 구조는 대응한다. 목표의 따뜻한 금속 반사와 세부 표면 품질 차이는 남는다.',mobile:false,
    verdicts:['통과','통과','통과','미달','통과','미검증','미검증'],notes:[
      '전면 왼쪽 ¾에서 전체 실루엣·두 기둥·게이지·램·작업 받침을 확인했다. 별도 카메라의 한정된 에셋 검토이며 게임 구도가 개선됐다는 뜻은 아니다.',
      '금속과 어두운 패널은 구별되고 바닥 접촉 그림자도 보인다. 원본보다 회색 위주이고 반사와 마모 세부가 단순하다.',
      'GLB 원위치에 production createGauge와 pressure-dial.webp를 적용하고 압력 0으로 고정했다. 원래 GLB의 고정 바늘만 보여 주는 결과가 아니다.',
      '04 단독으로 램 애니메이션·게이지 범위·작은 화면 가독성을 검증하지 않는다. 01/02의 공개 렌더러 비교에서 압력 변화는 별도로 확인한다.'
    ]},
  {id:'05',title:'회수 성공 / 3개 보관',concept:'05-success-state.png',size:'1024 × 1536',mode:'공개 createRenderer + complete fixture',summary:'부분 대응. 빈 작업 영역과 케이스 속 물건 3개는 보인다. 물건의 상대 크기·슬롯 배치·모바일 식별은 목표에 미달한다.',mobile:true,
    verdicts:['미달','미달','통과','통과','미달','미검증','미달'],notes:[
      '완료 상태의 빈 받침·비워진 트레이·보관물 3개는 화면 안에 있다. A/C 명령 흐름을 거쳐 성공한 결과가 아니라 complete fixture다.',
      '목표는 물건이 슬롯 방향에 맞춰 크고 단정하게 들어 있다. 실제는 작은 물건이 케이스 앞쪽에 가로로 놓이며 빈 홈이 뒤에 남아 슬롯 적합성이 약하다.',
      '390/320px에서도 세 물건은 사라지지 않지만 각 물건의 종류·압축·손상 상태를 안정적으로 읽기 어렵다.',
      '공유 snapshot에는 저장된 물건의 압축/손상 수치가 없어 새 렌더러는 문서화된 cosmetic fallback을 사용한다. 보관된 외형으로 실제 회수 품질이나 변형 이력을 검증하지 않는다.'
    ]},
];
