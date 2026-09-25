# 회수팀 대화용 포즈 4종

기존 [남녀 캐릭터 원본](../korean-salvagers-v1/README.md)을 사용자가 이야기·튜토리얼에 채택하도록 요청했다. 연구원 윤서, 회수 기사 도현으로 이름과 역할을 부여하고 OpenAI 내장 ImageGen으로 각각 원본을 참조해 생성했다. 얼굴·머리·작업복·아이보리 보호구·조명 계열을 유지하도록 지시하고 실제 결과를 시각적으로 확인했다.

| 파일 | 자세 / 사용 |
|---|---|
| [yunseo-concerned.png](yunseo-concerned.png) | 칼라 통신기에 손을 댄 걱정스러운 윤서. 첫 교신과 빈 케이스 엔딩. |
| [dohyeon-explaining.png](dohyeon-explaining.png) | 손바닥을 펴서 설명하는 도현. 1L 제한과 프레스 사용 이유. |
| [yunseo-relieved.png](yunseo-relieved.png) | 가슴께에 손을 댄 안도하는 윤서. 카세트 회수. 손상 여부는 실제 상태에 따른 대사로 구분. |
| [dohyeon-resolved.png](dohyeon-resolved.png) | 팔을 모으고 조용히 고개를 끄덕이는 도현. 부품 회수. |

[정확한 요청 프롬프트](prompts.json), [원본·참조·해시·배포 파생본 기록](provenance.json). PNG4개는 내장 도구 출력의 그대로 복사본이다. 모두1024×1536 RGBA, 실제 alpha 범위0–254를 확인했다. 크롭·리터칭·크기 변경 없이 `cwebp -q 88 -m 6`으로 런타임용 WebP만 인코딩했다. 원본 alpha를 유지한다. 런타임4개 합계1,264,810bytes. 생성된 기본 저장소 파일도 지우지 않았다.

게임은 `public/assets/characters/*.webp`를 상대 BASE_URL 아래에서 읽는다. **실제 3D NPC나 렌더러가 실시간 생성한 인물이 아닌, 게임에 적용한 2D 대화 일러스트**다. Meshy 모델·리깅·음성·립싱크를 만들었다고 주장하지 않는다. 자세가 보이는 범위는 화면별 대화창 크롭에 따라 달라진다. 모바일 짧은 화면에서는 읽기와 조작 크기를 유지하도록 더 작은 초상화로 표시한다.

실제 플레이·대화 화면과 검증은 [C 이야기 인계](../../../../docs/handoffs/C/story-onboarding/README.md)에 있다. 이번 사용자 요청은 B 시각 에셋과 C 앱 서사를 함께 변경하는 범위이며, 원래 선택용 캐릭터 원본은 덮어쓰지 않았다.
