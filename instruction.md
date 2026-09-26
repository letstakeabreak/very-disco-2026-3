# DEEP PRESS — 세 명이 함께 만드는 방법

문서 버전 1.1. 제품의 최종 기준은 [prd.md](prd.md)다. 이 문서는 각자 같은 출발점에서 자기 모듈을 완성하고, 세 결과를 한 번의 최종 통합으로 연결하는 작업 방식이다.

## 만들 게임과 실행 기준

DEEP PRESS는 사실적인 유압 프레스 작업대에서 회수물을 검사하고 압축해 제한된 운반 케이스에 담는 게임이다. 압력으로 부피를 줄이면서 손상 위험과 확보할 점수를 판단하고, 계속 작업하거나 정산한다. 행동·수치·시점·콘텐츠·완료 기준의 원전은 [prd.md](prd.md)다.

사용자는 PRD 작성과 실행 준비를 위임했다. 각자 시작할 때 PRD의 `executionReady: true`와 버전을 읽고 bootstrap 및 계약이 그 기준과 일치하는지 확인한다. 일치하면 별도의 PRD 승인 질문 없이 바로 역할 Goal과 구현을 진행한다. 파일이 없거나 서로 맞지 않으면 그 불일치를 정확히 보고하고 가능한 독립 기반 점검을 계속한다. 임의의 다른 콘셉트로 빈칸을 채우지 않는다.

시각 품질 목표는 강한 사실적 표현이다. 최종 시각 원본은 ImageGen으로 만들며, 3D가 필요한 경우 Meshy 7 flagship으로 재구성하고 4K PBR 원본 텍스처를 확보한 뒤 런타임에 맞게 최적화한다. 실제 화면의 형상·재질·조명·움직임까지 콘셉트와 맞아야 한다. 실행 화면이 따라오지 못하면 아트 완료로 보지 않는다. 오디오는 PRD 1.2.0부터 C가 Web Audio로 합성한 효과음과 배경음만 쓴다. 음원 파일과 음성은 추가하지 않는다.

## 같은 문서를 읽고 출발한다

1. [AGENTS.md](AGENTS.md)에서 역할과 변경 범위를 확인한다.
2. [prd.md](prd.md)에서 게임·콘텐츠·시각 목표와 합격 기준을 읽는다.
3. [docs/contracts.md](docs/contracts.md)와 [docs/asset-contract.md](docs/asset-contract.md)에서 모듈·에셋 계약을 읽는다.
4. [goal.md](goal.md)의 공통 시작 요청 또는 자기 계정 전용 요청을 현재 Codex 작업에 보낸다.

clone은 파일을 가져오는 동작이다. Codex를 실행하거나 Goal을 자동 생성하지 않는다. `AGENTS.md`는 Codex 세션에서 읽히는 프로젝트 지침이고, `goal.md`는 사용자가 Goal을 시작하도록 작성한 요청 문서다. 로컬 설정이나 존재하지 않는 자동 실행 설정을 만들 필요가 없다. [OpenAI AGENTS.md 문서](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Goals 안내](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex)

## 역할과 소유권

| 역할 / GitHub 계정 | 자기 모듈 | 독립적으로 완성할 결과 |
|---|---|---|
| A / `sy-Lee-01` | `src/core/**`, `src/content/**`, `tests/core/**`, `docs/handoffs/A/**` | 프레임률과 화면 표현에 독립적인 PRD의 게임 규칙, 콘텐츠, 결과/재시작과 결정적 테스트 |
| B / `letstakeabreak` | `src/render/**`, `public/assets/**`, `assets/source/**`, `tests/render/**`, `docs/handoffs/B/**` | 계약 상태로 구동되는 Three.js 렌더러, ImageGen→Meshy 최종 에셋, 조명·재질·애니메이션, 콘셉트와 실행 화면의 대응 |
| C / `magic3ightball` | `src/app/**`, `src/main.ts`, `tests/app/**`, `docs/handoffs/C/**` | 앱 수명 주기, 포인터 입력, HUD·튜토리얼·결과/재시작, iPhone 브라우저 흐름 |

셋 모두 독립 개발자다. A가 코어만 제공할 때 B/C도 정해진 fixture로 구현·테스트할 수 있고, B의 최종 모델을 기다리는 동안 A/C는 mock으로 자기 기능을 검증할 수 있어야 한다. C의 CSS와 기타 스타일은 `src/app/**` 아래 둔다. B의 시각 파일을 수정할 필요가 생기면 파일을 대신 고치지 말고 B의 계약에 맞는 요청을 한다.

역할은 현재 사용자의 명시적 요청으로 먼저 정한다. 요청에 없으면 인증된 GitHub 현재 계정을 확인해 위 표와 매칭한다. Git author·원격 소유자·폴더 이름으로 추정하지 않는다. 확인할 수 없을 때만 사용자에게 역할을 묻는다.

## bootstrap과 독립 개발

이번 역할 변경은 사용자의 명시적 지시다. **A=sy-Lee-01, B=letstakeabreak, C=magic3ightball**이며 Meshy 구독은 B만 보유한다. API/소유 경로/역할 브랜치는 그대로 두고 A/B의 담당 계정을 교체했다. Meshy 생성·텍스처 작업은 B가 수행하고 A/C는 기존 결과·fixture로 진행한다. A/C에게 Meshy 구매나 계정·키 공유를 요구하지 않는다.

새 출발점은 **bootstrap-v2 / PRD1.0.1 / 계약1.0.0**이다. 이전 bootstrap-v1 태그는 이력으로 보존하며 새 개발에는 사용하지 않는다. 이미 시작한 작업은 먼저 commit 또는 안전하게 보존하고 변경된 기준을 반영한다. 이전 담당 파일의 변경을 새 역할 브랜치에 섞지 말고 해당 소유자에게 commit SHA로 인계한다. 기존 브랜치를 강제로 초기화하거나 타인의 기록을 다시 쓰지 않는다. 이전 계정 배정의 시작 요청은 아래 최신 goal.md 요청으로 대체한다.

bootstrap은 세 사람에게 전달하기 전에 끝나 있어야 한다. A/B/C는 **같은 Git commit과 같은 잠금 파일**에서 시작한다. 공통 출발점은 실제로 생성된 `bootstrap-v2` 태그이며, 계약 해시와 태그 기준은 `docs/bootstrap.json`에 기록한다. 전체 SHA는 `git rev-parse bootstrap-v2^{commit}`으로 해석해 각자 handoff에 남긴다. commit 자체 안에 자기 SHA를 넣지 않는다. 각자는 그 commit에서 A=`role/a-core`, B=`role/b-render`, C=`role/c-app` 브랜치를 만든다. 체크아웃한 SHA가 다르면 구현을 시작하기 전에 맞춘다. 이미 작업한 내용은 삭제하지 않는다.

각 역할 handoff의 첫 기록에 다음을 남긴다.

- 역할, 실제 확인된 계정 또는 사용자의 역할 지정.
- 공통 출발 ref와 전체 SHA, 자기 브랜치, 계약 버전.
- Node/npm 버전과 `npm ci`·baseline 검사 결과.
- 자기 완료 조건과 외부 입력이 필요한 항목.

먼저 원격 태그를 가져와 `git rev-parse bootstrap-v2^{commit}`을 기록하고 그 태그에서 자기 브랜치를 만든다. 기존 브랜치/변경이 있으면 강제로 초기화하지 않는다. `npm run bootstrap:check`가 공유 파일의 SHA-256을 대조한다. 이 검사는 `npm run check`에 포함된다. 계약을 정식 변경하면 A가 영향과 이전 방법을 기록하고 manifest·새 기준 ref를 함께 갱신해 세 역할에 전달한다. 해시만 다시 만들어 실패를 숨기지 않는다. 기여 PR 대상 `integration/v1`은 bootstrap에서 시작한 공통 후보 브랜치다.

기술 스택은 strict TypeScript, Three.js, Vite다. 기반의 정확한 버전은 저장소 `package.json`과 잠금 파일이 기준이다. 최신 버전으로 자동 갱신하지 않는다. `npm ci`가 실패하면 원인부터 확인하고 B/C가 잠금 파일을 새로 만들지 않는다.

### 경계를 넘지 않고 연결하는 방법

공개 진입점은 아래 표를 따른다. 계약 버전은 `src/contracts/index.ts`의 `CONTRACT_VERSION`이 기준이며, 타입과 인자·이벤트의 전체 정의는 계약 문서와 코드에서 읽는다. bootstrap 이후 진입점과 공유 타입을 임의로 변경하지 않는다.

| 경계 | 공개 진입점 / 계약 |
|---|---|
| A → 앱 | `src/core/index.ts`의 `getGameConfig()`, `createGame(config)`와 `dispatch`, `step`, `snapshot`, `drainEvents`, `dispose` |
| B → 앱 | `src/render/index.ts`의 `createRenderer({ canvas, onFatal })`와 `resize`, `render`, `dispose` |
| 공통 상태·이벤트 | `src/contracts/index.ts` |
| 독립 개발용 예제 | `src/contracts/fixtures.ts`의 `SNAPSHOT_FIXTURES`, `DEFAULT_GAME_CONFIG` |
| 상태 검사 | `src/contracts/validate.ts`의 `assertSnapshot` |

DEEP PRESS의 계약 단위는 부피 L, 렌더 위치 m, 회전 rad, 시간 ms다. 앱은 포인터의 원시 입력을 소유하며, 코어에는 계약 명령을 전달한다. 압력·부피·무결성·점수 및 검사/압축/보관/정산 상태의 정확한 필드는 계약을 읽어 사용한다.

### 공통 코딩 convention

- UTF-8, LF, space 2칸, 파일 끝 newline. TypeScript는 single quote·semicolon, 함수/변수 camelCase, 타입 PascalCase, 상수 UPPER_SNAKE_CASE, 파일/asset ID kebab-case. 기존 공개 export 이름은 그대로 사용한다.
- 상대 import, `.ts` 확장자 생략, type-only import에는 `import type`. DOM ID와 CSS class는 C 내부에서만 의미가 있다. 전역 window 속성이나 모듈 사이 숨은 singleton으로 상태를 공유하지 않는다.
- 부재 값은 계약의 null, 비동기·GPU 객체는 경계 밖에 둔다. public API는 타입대로 유지하고 새 옵션·인자·이벤트를 임의 추가하지 않는다. 타임스탬프 저장은 ISO8601 UTC, 사용자 일정은 KST로 명시한다.
- 함수는 명시된 dispose 수명 주기와 소유권을 따른다. 이벤트의 유일한 소비자는 C, 점수/부피의 유일한 계산자는 A, GPU/시각 보간의 소유자는 B다. 에셋은 relative URL과 정확한 대소문자를 사용한다.
- 기능/버그/검증 commit은 각각 feat:/fix:/test:로 시작하고 변경 목적을 한 문장으로 쓴다. PR에 기준 SHA·계약 버전·자기 소유 경로·검사·미검증을 기록한다. 실제 검증 없이 ready/release/verified로 표시하지 않는다.

각 모듈은 남의 내부 경로를 직접 import하지 않는다. A는 DOM·Three.js에 규칙을 묶지 않고, B는 결과나 점수를 재판정하지 않으며, C는 앱 안에 별도의 코어 규칙을 만들지 않는다. 이미지·GLB의 이름, 로딩 기준, 원본 기록은 에셋 계약을 따른다.

`src/contracts/**`, 공통 fixture, package/lock, 설정, 검증 스크립트, 공통 문서는 bootstrap 뒤 고정한다. 변경이 필요하면 자기 handoff에 다음 네 가지를 적고 A에 전달한다: 깨지는 실제 사례, 필요한 최소 변경, 새 계약 버전과 호환성, A/B/C가 해야 할 수정. A가 세 역할에 변경을 공유한 뒤 공통 변경을 반영한다. 전달되지 않은 계약 변경을 다른 사람이 알아서 추적할 것이라고 기대하지 않는다.

### 시작과 끝에 실행할 검사

```sh
npm ci
npm run check
```

필요한 실패를 좁힐 때는 실제 정의된 `npm run typecheck`, `npm run test`, `npm run build`, `npm run lint`, `npm run contracts:check`를 사용한다. `check`의 정확한 포함 범위는 `package.json`에서 확인한다. 소유권은 아래 형태로 검사하되 역할과 출발 ref를 실제 값으로 채운다.

```sh
npm run ownership -- --role A --base bootstrap-v2
```

위 예시는 A다. B/C는 자기 역할로 실행한다. `bootstrap-v2`은 공통 출발 태그가 실제로 생성되고 검증되었을 때 사용한다. 아직 생성되지 않았다면 임의 SHA로 대체하지 말고 기록된 실제 공통 ref를 확인한다. 검사 실패를 숨기려고 설정·테스트를 약화하지 않는다.

공통 smoke fixture는 모듈이 같은 상태 구조를 이해하는지 확인한다. 각 역할의 핵심 행동 테스트와 실제 연결 뒤의 흐름 검증도 필요하다. 코드 검사가 전부 통과해도 시각 품질·iPhone 실기기가 확인된 것은 아니다.

## 최종 아트와 실행 화면

B는 PRD의 DEEP PRESS 콘셉트에 따라 ImageGen 콘셉트/원본 → Meshy 7 flagship 재구성 → 4K PBR 원본 텍스처 → 런타임 최적화 → 실제 렌더 확인 순서로 작업한다. 생성 도구의 실제 모델·설정과 결과를 확인하고 원본, 변환 결과, 사용 위치를 추적 가능하게 남긴다. 절차·예산·포맷은 에셋 계약이 우선한다.

에셋 서비스 접근이나 생성 완료를 기다리는 동안 geometry mock과 fixture로 로딩·배치·애니메이션·오류 경로를 개발할 수 있다. 이것은 병렬 개발을 위한 중간 상태다. 최종 아트 조건을 지우거나 낮춰 완료 처리하지 않는다. ImageGen 콘셉트를 게임 화면으로 가장하거나, 구현하지 않은 효과를 홍보용 실행 캡처에 합성하지 않는다.

콘셉트 비교는 같은 장면·시점에서 실루엣, 상대 크기, 색상, 재질, 조명, 화면 구성을 확인한다. 보고에 콘셉트 이미지와 실제 실행 캡처를 구분해 나란히 남긴다. 작은 화면에서도 플레이어·목표·상호작용 가능 대상과 결과를 식별할 수 있어야 한다. 보기 좋은 정지 장면만으로 입력 중·핵심 행동 중·실패/성공·재시작 상태가 검증되었다고 하지 않는다.

오디오는 PRD 1.2.0의 합성 효과음과 배경음이다. 무음 상태에서도 중요한 상태와 결과를 읽을 수 있도록 시각 피드백을 설계한다. ImageGen이 음원을 만들 수 있다고 가정하거나, 음원 파일을 추가하지 않는다.

## handoff와 한 번의 최종 통합

각자 `docs/handoffs/A/`, `B/`, `C/`에 결과를 남긴다. 최소한 최종 commit SHA, 계약 버전, 변경 경로, 동작 설명, baseline/final 검사 결과, 실제 캡처/영상 경로, 미검증 항목, 남은 문제, 다른 모듈과의 연결 요구가 있어야 한다. 완성되지 않은 요구는 지우지 않고 그대로 표시한다.

각 역할은 자기 브랜치를 push하고 기여 PR을 만든다. B/C는 `main`에 push하거나 PR을 직접 merge하지 않는다. PR의 기준 브랜치는 `integration/v1` 통합 후보 브랜치로 맞춘다. 원격 쓰기가 불가능하면 로컬 commit과 handoff까지 완성하고 실제 권한 문제를 알린다.

A는 세 기여의 최종 SHA를 고정하고 다음 순서로 통합한다.

1. 공통 출발 commit에서 별도의 통합 후보를 만든다.
2. 원래 A → B → C 브랜치의 고정된 commit을 순서대로 후보에 반영한다. 각 역할 브랜치의 기록을 보존한다.
3. 충돌과 연결 오류를 해당 담당자와 수정한다. 수정된 SHA를 기록하고 영향을 받는 검사와 전체 검사를 다시 실행한다.
4. 최종 후보에서 `npm run check`, 소유권/계약 변경 감사, 브라우저 전체 흐름, PRD의 실제 iPhone·시각 품질 조건을 확인한다. 임시 에셋이 남아 있으면 release 완료로 보고하지 않는다.
5. 세 역할 결과와 검증 증거를 포함한 **최종 통합 PR 하나**를 검토 가능한 상태로 만든다. 통과한 후보를 `main`에 한 번 반영한다.

“한 번의 merge”는 검증한 최종 후보를 `main`에 반영하는 절차다. 세 브랜치를 아무 확인 없이 `main`에 연속 merge한다는 뜻이 아니다. 소유권 분리로 충돌을 줄일 수는 있지만 통합 오류가 절대로 없다고 보장할 수는 없다. 최종 배포와 itch.io 제출은 별도의 사용자 지시에 따른다.

## 이 대회에서 가져온 설계 근거

대회 정보 스냅샷은 2026-09-24 기준이다. 제출 직전에 [공식 안내](https://itch.io/jam/very-disco-game-jam-2026-3)를 다시 읽는다. 공개 기준은 Strong Core Loop, Good Cohesion, Distinctly Apple이며 iPhone 실행이 필요하다. 세 명은 공개 팀 규모 3–6명에 들어가지만 참가 자격·심사 방식 등의 미확정 사항은 별도 확인 대상이다.

[이전 회차 결과](https://itch.io/jam/very-disco-game-jam-2026-2/results)와 [상세 조사](docs/research/agent-findings/competition-history.md)는 단순한 중심 행동, 명료한 첫 경험, 표현의 일관성과 조작 안정성을 지지한다. [The Soda Sniper 심사평](https://itch.io/jam/very-disco-game-jam-2026-2/rate/4731557)은 Apple 기기를 사용해도 조작과 목표가 약하면 경험이 약해질 수 있음을 보여준다. 이는 연구자의 적용 해석이며 우승 확률이나 공식 가중치가 아니다.

현재 [tight fit 제출 설명](https://itch.io/jam/very-disco-game-jam-2026-3/rate/5037728)은 이미 경기장 압축을 중심 행동으로 삼는다. DEEP PRESS의 압축 조작과 작업·위험 판단의 차이는 실제 플레이로 검증한다. 사실적인 그래픽이 다음 해의 흥행을 보장한다는 예측은 근거로 사용하지 않는다. 우승은 목표지만 외부 심사 결과를 구현 완료 조건이나 보장으로 삼지 않는다.
