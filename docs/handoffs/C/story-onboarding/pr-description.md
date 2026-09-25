첫 화면에서 부품을 왜 건졌고 왜 프레스로 눌러야 하는지 알 수 없던 문제를 해결합니다. 침수된 실험실의 세 부품을1L 회수 캡슐에 담아 올린다는 이유를 캐릭터 교신3장면으로 연결하고, 실제 부품 용도를 플레이 HUD에 남깁니다. 마지막 물건 처리/정산 후에는 보관 결과와 손상 여부에 맞는 교신을 거쳐 결과표로 갑니다. 건너뛰기·이전·다시 읽기를 제공하며 재시작은 바로 플레이합니다.

기존 남녀 캐릭터를 참조해 ImageGen 대화 일러스트4종을 만들었습니다. 원본·프롬프트·해시·alpha를 보존하고 배포에는 같은 해상도의 WebP를 사용합니다. 눈누에서 찾은 Cafe24 PRO SLIM 계열의 제작사 원본 Max v2.0으로 DEEP PRESS 영문 워드마크를 만들고, HUD에는 에스코어드림, 서사에는 리디바탕을 사용합니다. 글꼴 원본과 라이선스를 로컬 번들에 포함합니다.

통합된 UI의 반투명 유리/황동 팔레트를 대화창에도 이어 적용합니다.48px 버튼·4px 모서리·그룹 내부8px/그룹 사이16px 규격을 유지하고, 선택 트레이와 종료 행동을 구분합니다. 짧은 세로/가로 화면 배치를 보완했으며, 배포 하위 경로에서 주변 배경 URL이 assets/assets로 중복되던 문제도 고쳤습니다.

- PR #14/15/16/17이 통합된 `integration/v2` (`b0c9da2`) 위의 후속 PR입니다. 공유 계약·코어·렌더러·의존성은 수정하지 않았습니다.
- 이번 사용자의 명시적 캐릭터/스토리 요청은 B 시각 에셋 + C 앱 범위입니다. 기존 원본을 덮어쓰지 않으며 B+C 허용 경로 검사로 구분해 기록했습니다.
- 고정23파일·타입·21모듈 경계·16파일103테스트·build 통과. 실제 Chromium5화면에서 도입3장면·버튼·로고·대화 탐색과 실제 회전/압축/보관/엔딩을 검사했습니다. 캡처와 최종 검사 결과는 아래 인계에 있습니다.
- 빌드 약17.42MB/20MB. 효과는 CSS 합성이며 새 WebGL HUD 셰이더를 추가한 것은 아닙니다. 기존 JS500kB 권고 경고 유지.
- 실제 iPhone·터치·FPS는 미검증입니다. 초기 B v1 기준에서 강제로 GPU context를 잃게 한 뒤 이야기 중 복구하는 검사에서 GLB 재로딩이 간헐적으로 loading에 머물렀습니다. 일반 이야기/플레이 검사와 분리해 진단을 보존하며 복구 안정성 완료로 표현하지 않습니다.

[최신 이야기·로고·실행 화면·검증](https://github.com/letstakeabreak/very-disco-2026-3/blob/feat/salvage-story/docs/handoffs/C/story-onboarding/README.md)

[캐릭터 원본·프롬프트·생성 이력](https://github.com/letstakeabreak/very-disco-2026-3/blob/feat/salvage-story/assets/source/characters/korean-salvagers-story-v1/README.md)

[공통 UI 규격](https://github.com/letstakeabreak/very-disco-2026-3/blob/feat/salvage-story/docs/handoffs/C/design-consistency/README.md)
