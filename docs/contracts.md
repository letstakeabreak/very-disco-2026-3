# DEEP PRESS 모듈 계약 v1.1.0

이 문서는 공통 bootstrap 계약이다. `src/contracts/index.ts`가 타입 원본이며 `prd.md`가 제품 규칙 원본이다. 둘이 충돌하면 임의로 한쪽을 구현하지 말고 통합 담당 A에게 알린다. 현재 코드는 **통합 scaffold**다. 압력 입력·선택·시간·pause·snapshot 전달은 구현되어 있지만 압축 결과, 손상 판정, settling 종료, 보관, 폐기, 정산, 최종 화면은 역할 작업으로 남아 있다. fixture는 해당 결과를 흉내 내는 소비자 개발 자료다.

## 환경과 설치

2026-09-24 npm 공식 registry 조회 및 로컬 설치로 확인한 고정 환경:

| 항목 | 정확한 버전 |
|---|---|
| Node / npm | 26.8.2 / 11.19.1 |
| Three.js / @types/three | 0.186.0 / 0.186.0 |
| Vite | 8.3.0 |
| TypeScript | 6.0.3 |
| Vitest | 5.0.1 |
| @types/node | 26.6.2 |

Node 26.8.2는 이 bootstrap 검증 환경이지 LTS라는 뜻이 아니다. `.nvmrc`를 적용한 뒤 `npm ci`를 쓴다. TypeScript 7.0.2의 npm 모듈은 이 저장소가 사용하는 compiler AST API를 제공하지 않아 6.0.3을 고정했다. 임의 업그레이드하지 않는다. [Vite 환경 요건](https://vite.dev/guide/), [Three.js 설치](https://threejs.org/manual/pages/installation.html), [Vitest 5 요건](https://vitest.dev/guide/migration/).

`npm run check`는 `bootstrap:check → typecheck → lint → test → build`를 수행한다. `npm run contracts:check`는 공유 계약 검사만 실행한다. `lint`는 TypeScript AST로 import·역할 경계·core의 브라우저 전역/비결정적 난수를 검사하며, 종합적인 스타일 검사라는 뜻은 아니다. `npm run dev`와 `npm run preview`는 LAN에서 접근 가능하게 시작되며 신뢰하는 개발 네트워크에서 사용한다.

## 단일 소유권과 import

| 소유자 | 수정 경로 | 공개 진입점 |
|---|---|---|
| A / sy-Lee-01 | `src/core/**`, `src/content/**`, `tests/core/**`, `docs/handoffs/A/**` | `src/core/index.ts` |
| B / letstakeabreak | `src/render/**`, `public/assets/**`, `assets/source/**`, `tests/render/**`, `docs/handoffs/B/**` | `src/render/index.ts` |
| C / magic3ightball | `src/app/**`, `src/main.ts`, `tests/app/**`, `docs/handoffs/C/**` | `src/app/index.ts` |
| 공유 / 통합 담당 A | `src/contracts/**`, `tests/contracts/**`, `scripts/**`, `.github/**`, 공통 docs 및 루트 설정·패키지·잠금 파일 | 승인된 계약 변경으로만 수정 |

A의 core/content는 서로 import 가능하며 외부 패키지, DOM, 시간 API, `Math.random`을 사용하지 않는다. B는 자기 모듈·contracts·Three.js만 import한다. C는 자기 모듈·contracts와 **공개 core/render 진입점**만 import한다. core/render는 app을 모른다. 상대 import만 사용하고 별도 alias를 만들지 않는다. 테스트는 소비 계약 검증을 위해 공개 진입점을 조합할 수 있다.

소유권 검사: `npm run ownership -- --role A --base bootstrap-v2`처럼 실제 역할 하나를 지정한다. base 기본값은 `bootstrap-v2`이다. base부터 현재 작업 트리까지의 변경과 untracked 파일을 검사하고 rename의 옛 경로·새 경로 모두 포함한다. 알려지지 않은 경로, 다른 소유자, shared 변경은 실패한다. **A도 기본적으로 shared 변경이 차단된다.** 승인·버전·영향·이전 방법을 기록하고 세 역할에 공유한 변경에만 `--allow-shared`를 사용할 수 있다. 이 플래그가 승인 자체를 생성하지 않는다.

## 단위, 시간, 데이터

- 렌더 세계: meter, +Y 위, XZ 바닥, +Z 앞. Euler rotation은 radian, `XYZ` 순서. scale은 배율이며 모두 양수.
- 용량: `capacity`, `volumeUsed`, `initialVolume`, `minimumVolume`, `currentVolume` 모두 **liter**다. 화면에서 L로 표시하며 세계 좌표 m와 섞지 않는다.
- `step(dtMs)`와 renderer `render(snapshot, dtMs)`는 millisecond. app은 `FIXED_STEP_MS = 1000/60`으로 core를 호출한다. core는 0–100ms만 허용하고 0은 no-op. app은 긴 프레임을 100ms까지만 따라잡으며 숨겨진 시간 전체를 시뮬레이션하지 않는다.
- 같은 uint32 seed, config, 명령 순서, step 순서는 같은 snapshot/event 결과를 내야 한다. 나중에 무작위가 필요하면 A가 seed에서 생성하는 순수 난수 함수를 쓴다. 현재 stub는 난수를 쓰지 않는다.
- snapshot과 event는 deep readonly, JSON 직렬화 가능, 유한한 숫자만 포함한다. `Date`, `Map`, Three.js 객체, 함수, `undefined`, NaN/Infinity는 경계를 넘지 않는다. core는 입력 config를 복사하며, 반환 snapshot을 소비자가 수정할 수 없게 한다.
- renderer는 snapshot을 수정하거나 판정·점수를 계산하지 않는다. 렌더 중 보간은 자체 시각 상태에만 저장한다.

## 정확한 공개 exports

```ts
// src/core/index.ts
createGame(config: GameConfig): Game
getGameConfig(): GameConfig // src/content의 authored config를 공개 진입점으로 전달

// Game
dispatch(command: GameCommand): void
step(dtMs: number): void
snapshot(): GameSnapshot
drainEvents(): readonly GameEvent[]
dispose(): void

// src/render/index.ts
createRenderer({ canvas, onFatal }: RendererOptions): GameRenderer

// GameRenderer
resize({ width, height, dpr }: RendererSize): void
render(snapshot: GameSnapshot, dtMs: number): void
dispose(): void

// src/app/index.ts
mountApp(root: HTMLElement): () => void
```

`resize`의 width/height는 CSS pixel, dpr은 device pixel ratio이며 B가 기본 2로 제한한다. canvas는 C가 만들고 전달하며 B가 소유 DOM을 추가하지 않는다. WebGL 초기화 또는 렌더 실패는 `onFatal({code,message})`로 전달한다. GPU 실패 시 C는 설명 가능한 오류 화면을 만든다. `dispose`는 반복 호출 가능하며 리스너·프레임·GPU 자원을 해제한다. core는 dispose 뒤 다른 메서드 호출 시 오류를 낸다. renderer는 dispose 뒤 호출을 무시한다.

`drainEvents`는 발생 순서대로 이벤트를 **한 번만** 반환한다. C만 소비하고 UI/효과에 전달한다. B는 이벤트 큐를 직접 소비하지 않는다. phase-changed에 from/to/tick, 나머지 이벤트에 typed payload가 있다. 오디오 생성·로드·재생·컨트롤은 없다.

## 상태와 명령

| 명령 | 의미 / 구현 예정 전이 |
|---|---|
| `start`, `restart` | 같은 seed로 새 3개 lot를 초기화하고 idle |
| `select {specimenId}` | idle/stored 또는 inspecting의 압축 전 상태에서 남은 lot를 선택하여 inspecting. 압축 후 교체/같은 ID로 초기화 금지 |
| `inspect {yawRad}` | 절대 Y축 회전. C가 drag를 radian으로 변환. 규칙에 영향 없음 |
| `press-start` | inspecting에서 compressing으로 전환. 이전 적용 압력부터 추가 압축 |
| `press-release` | compressing에서 settling, 300ms 후 inspecting 또는 failed. p=1이면 자동 settling 후 failed |
| `store` | inspecting에서 압축 완료 specimen을 케이스에 bank. 성공 시 stored, currentSpecimen=null |
| `discard` | 현재 lot를 제거하고 다음 선택을 위한 idle; 처리할 lot가 없으면 complete |
| `cash-out` | 저장된 score를 정산하고 complete |
| `pause` | 타이머 정지. 압축 중 미확정 stroke 취소, pressure01를 마지막 compression01로 복원, resumePhase=inspecting. settling은 남은 시간 보존 |
| `resume` | 저장된 resumePhase로 복귀. 숨겨진 시간 보충 없음 |

잘못된 phase의 유효 명령은 no-op. 비유한 숫자·잘못된 config는 즉시 오류다. paused에서 start/restart/resume 이외 명령은 무시한다. C는 pointer capture/cancel/lost capture/visibility를 처리하며 숨겨진 뒤 stale release가 다시 압축을 실행하지 않게 한다.

`pressure01`는 현재 프레스 압력이다. `currentSpecimen.compression01`는 적용한 압축 결과의 압력이며 0보다 크면 압축 완료를 나타낸다. 추가 압축은 이전 확정 결과보다 작아지지 않는다. settling 후 inspecting으로 돌아오므로 **stored를 “보관 전” 뜻으로 쓰지 않는다.** pause 중엔 결과를 새로 commit하지 않으며 압축 중 미확정 압력만 취소한다. paused snapshot에 resumePhase가 있고 나머지 phase에서는 null이다. remainingSpecimenIds는 아직 bank/discard하지 않은 lot이며 현재 lot도 포함한다. storedSpecimenIds와 중복되지 않는다. currentSpecimen은 idle/stored/complete에서 null일 수 있다. 초과 용량 store는 failed/capacity-exceeded, 기존 bank는 유지한다. 마지막 물건 처리 후 complete. 상세 예외와 허용 phase는 PRD 상태 전이 절이 원전이다.

## 공유 초기 수치 — PRD와 함께 변경

| lot | material | initialVolume L | minimumVolume L | baseValue | safePressure01 | tolerance |
|---|---|---:|---:|---:|---:|---|
| salvage-lens | glass | 0.58 | 0.30 | 450 | 0.38 | fragile |
| salvage-core | metal | 0.90 | 0.27 | 260 | 0.80 | sturdy |
| salvage-cassette | composite | 0.72 | 0.24 | 340 | 0.62 | normal |

케이스 1.00L, 압력 증가 0.25/s, settling 300ms, 저장당 collectionBonus 100. 예정 공식은 `volume = initialVolume - (initialVolume - minimumVolume) * p`; `integrity = p <= safe ? 1 : max(0, 1 - ((p-safe)/(1-safe))**2)`; `value = round(baseValue * integrity)`; 저장 score는 retained value + 100. p=1에서 integrity/value 0, failed. **위 공식은 config·fixture·구현 지침이며 현재 stub가 계산한다고 주장하지 않는다.** A는 실제 outcome 테스트를 추가해야 한다.

## fixture와 완료 경계

`src/contracts/fixtures.ts`의 `DEFAULT_GAME_CONFIG`, `SNAPSHOT_FIXTURES`는 세 역할이 동일하게 사용한다. 8개 phase 전부 제공한다. B의 fixture 테스트는 Three.js renderer를 CPU mock으로 바꾸므로 GPU 품질 검증이 아니다. app의 DEV 화면은 진입·fixture 선택·압력 stub를 확인하는 용도다. 파손/저장/완료 fixture가 보인다고 게임 규칙이 구현된 것은 아니다.

현재 검사: 유한 JSON/시간/정규값/참조/중복 ID, deep freeze, deterministic replay, pause 입력, event drain, module imports, role ownership rules, app fixed step, renderer fixture 소비와 cleanup. 추가 필요한 증거는 실제 게임 루프, GPU 화면, 실제 iPhone Safari, 최종 GLB 로드·성능, 제출 경로다. Vite의 safari16.4 target은 번들 변환 설정일 뿐 실기기 호환 보증이 아니다.

## v1.1.0 변경 (2026-09-25, M1)

- **사유:** 검사가 정보를 주지 않고, 누르는 동안 위험과 공간을 읽을 단서가 없었다. 또 보관물의 확정 외형을 새 renderer가 복원할 수 없었다.
- **추가된 것**
  - `Tolerance`와 `SpecimenDefinition.tolerance`
  - `SpecimenState.tolerance: Tolerance | null` (검사로 공개)
  - `GameSnapshot.storedSpecimens`, `stress01`, `previewVolume`
  - 정확한 규칙은 PRD "v1.1 판단 단서"를 따른다.
- **호환:** 기존 필드는 그대로다. `CONTRACT_VERSION`이 1.1.0이 되므로, `assertSnapshot`은 1.0.0 snapshot과 새 필드가 빠진 snapshot을 거부한다.
- **이전 방법:** 이 변경과 함께 한 번에 옮긴다.
  - fixture 8개와 저작 콘텐츠에 `tolerance`, `storedSpecimens`, `stress01`, `previewVolume` 추가
  - `SpecimenState`를 직접 만드는 소비자 테스트에 `tolerance: null` 추가 (B `tests/render/lifecycle.test.ts` 2곳)
  - B는 보관 외형을 `storedSpecimens`에서 읽는다.
  - C는 힌트, 예상 부피, 긴장도를 표시만 한다. B/C는 안전 압력이나 공식을 복제하지 않는다.

## 공유 변경 절차

bootstrap tag는 `bootstrap-v2`, 역할 브랜치는 `role/a-core`, `role/b-render`, `role/c-app`이다. A가 공유 변경 사유·버전·영향·마이그레이션을 기록하고 B/C에게 같은 계약을 전달한 뒤 수정한다. 계약 변경 시 타입, fixture, validator, consumer tests, 이 문서를 함께 갱신한다. 출발 ref와 계약 해시는 `docs/bootstrap.json`을 따른다. 전체 출발 SHA는 `git rev-parse bootstrap-v2^{commit}`으로 기록한다. 이 문서는 태그나 커밋이 이미 존재한다고 단정하지 않는다.
