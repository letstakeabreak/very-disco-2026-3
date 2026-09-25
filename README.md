# DEEP PRESS

심해 회수품을 압착해 1L 케이스에 담는 iPhone 게임. 더 작게 만들수록 많이 회수할 수 있지만 내부 코어의 가치가 떨어진다. 이 저장소는 3인 독립 개발의 PRD·계약·연구·아트 원본과, 그 위에서 A 코어·B 렌더·C 앱을 통합한 **v1 게임**이다. 확인한 범위와 남은 조건은 [검증 현황](docs/validation.md)에 있다.

## 팀 작업 문서

[각 역할의 최신 작업 문서 목록](https://github.com/letstakeabreak/very-disco-2026-3/blob/main/docs/work-documents.md)에서 실제 공개된 브랜치의 문서를 엽니다. [B 렌더링·그래픽 인계](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md)는 `role/b-render`에 있습니다. AI용 원문 링크도 문서 목록에 함께 있습니다.

## 각자 시작하기

저장소를 clone하고 Codex에서 연 뒤 [goal.md](goal.md)의 공통 요청 또는 자기 계정 요청을 한 번 보낸다. Codex는 [AGENTS.md](AGENTS.md) → [instruction.md](instruction.md) → [prd.md](prd.md)와 계약을 읽고, 인증 계정 또는 명시한 역할을 찾아 지속 Goal을 설정한다. clone 자체가 Goal을 만들지는 않는다.

| 계정 | 역할 | 브랜치 |
|---|---|---|
| sy-Lee-01 | A 코어·콘텐츠·통합 | role/a-core |
| letstakeabreak | B 렌더링·ImageGen/Meshy 에셋 | role/b-render |
| magic3ightball | C 앱·터치 입력·HUD | role/c-app |

공통 출발 태그는 `bootstrap-v2`, 기여 PR의 대상은 `integration/v1`이다. 세 결과를 통합 후보에서 검증한 뒤 최종 PR 하나를 main에 반영한다. 파일 소유권·API·단위·이벤트·검증 절차를 계약으로 고정했다. 오류가 절대 없다는 보장은 하지 않는다.

```sh
npm ci
npm run check
npm run dev
```

`.nvmrc`의 Node와 package.json의 정확한 버전을 사용한다. [모듈 계약](docs/contracts.md) · [에셋 계약](docs/asset-contract.md) · [bootstrap 기준](docs/bootstrap.json).

## 공유 자료

- [실행 지침 instruction.md](instruction.md), [Goal 원샷 요청 goal.md](goal.md), [제품 PRD](prd.md)
- [새 콘셉트 아트 5장](docs/art/README.md) — 실제 게임 캡처가 아닌 구현 목표
- [대회 핵심 컨텍스트](docs/research/TEAM_AI_CONTEXT.md), [2027 전망 조사](docs/research/trends-2027.md)
- [현재 4작·역대 25작 조사](docs/research/agent-findings/competition-history.md), [전체 AI 업로드 합본](docs/research/AI_UPLOAD_ALL_IN_ONE.md)
- [검증 현황](docs/validation.md), [팀 상태](docs/research/TEAM_STATE.md)
- [협업 Drive](https://drive.google.com/drive/folders/1xtekUGeYoumuf2wn8YIGpkEAt1_bvjEr)

공식 주제 COMPACT, iPhone 플레이 필수, 공개 심사 기준 Strong Core Loop / Good Cohesion / Distinctly Apple. 마감은 **2026-09-26 01:59:59 KST**다. 심사위원 TBA, AI 정책·참가 소속 자격·웹 전달 인정 방식은 미확인이다. [공식 안내](https://itch.io/jam/very-disco-game-jam-2026-3)를 제출 직전 다시 확인한다. 오디오는 이번 범위에서 제외한다.
