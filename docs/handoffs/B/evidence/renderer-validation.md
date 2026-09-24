# B renderer 검증 기록

2026-09-24, 계약 1.0.0, `role/b-render`. 출발 `bootstrap-v2`의 annotated tag object는 `ba2f00e700c04402cfa6574c4db9cf5ab0d7c2a0`, 실제 공통 출발 commit (`bootstrap-v2^{commit}`)은 `c739b527449b2527e46b567bfffbd4a7122f571c`다. 테스트·하네스 담당은 production renderer, A core, C app, 공유 고정 파일을 수정하지 않았다. commit/push 없음.

## 테스트가 확인하는 범위

```sh
npx vitest run tests/render
npm run typecheck
node docs/handoffs/B/check-preview.mjs
npm run ownership -- --role B --base bootstrap-v2
node docs/handoffs/B/browser-check.mjs
```

- `fixtures.test.ts`: 공유 frozen fixture 8개 소비, 압력/확정 압축/무결성 구분, paused resume 상태, 보관 순서, 폐기 숨김, 선택 후 트레이 빈칸 제거, frame delta 유효성.
- `resources.test.ts`: 실제 Three.js geometry/material/texture의 공유 참조를 한 번씩 해제하고 공유 ImageBitmap을 한 번만 닫는다.
- `lifecycle.test.ts`: WebGL/파일 IO만 대체한다. 실제 scene graph·재질·변형 코드로 GPU 초기화 실패, GLB 실패, dispose 뒤 늦게 도착한 GLB/texture 해제, 반복 dispose, 8개 fixture 불변성, DPR 제한, pause 취소 시 확정 형태 즉시 복원, 첫 paused settling 프레임, 재시작 시 이전 보관 형태 제거, context loss와 draw 실패를 검사한다. 프레스 위치·회전·scale을 바꿔도 접촉 거리가 프레스 공간에서 유지되고, specimen entity를 3cm 올리면 ram travel이 3cm 줄어드는 회귀를 포함한다.
- `assets.test.ts`: registry의 generated-unverified 상태와 미완료 verification을 유지한다. 원본/프롬프트 경로, Meshy 7 task ID, 실제 GLB 2 헤더·길이·SHA·self-contained 리소스, 준비 보고서의 triangle/파일 크기, 런타임 texture 최대 2K를 대조한다. 이 검사는 생성 서비스 사실·시각 완성도·기기 적합성을 새로 인증하지 않는다.

GPU 품질은 CPU 테스트로 승인하지 않는다. 부피·점수·손상 계산은 A의 책임이며 위 테스트에서 게임 공식을 복제하지 않는다.

최종 bake와 외곽 배경 수정 후 renderer 테스트 **31개 통과**, 공통 typecheck·하네스 독립 typecheck·B 소유권·diff 공백 검사 통과. generated-unverified registry 네 항목과 최종 런타임/준비 보고서 해시를 대조했다.

## 실제 브라우저 증거

[runtime-browser-check.json](runtime-browser-check.json)의 `passed`와 `failure`가 자동 검증의 기준이다. 캡처가 있어도 중도 실패한 실행일 수 있다. 검사 중 파일이 바뀌면 전체 결과를 실패로 기록한다. report의 시작/끝 SHA 목록으로 실제 검사한 렌더러와 GLB를 식별한다.

브라우저 하네스는 실제 WebGL과 GLB 4개를 사용하고, 390×844 및 1440×900, 네이티브 select/range 이벤트, 8개 phase, 세 회수품의 검사/압축/파손 9개 조합을 실행한다. 상단 50px, 하단 130px, 가로 overflow 없음, 오류 없음, immutable snapshot을 검사한다. 파일명 `runtime-phase-*.png`, `runtime-salvage-*.png`는 실제 하네스 캡처이며 완성 게임 플레이 장면이 아니다.

`visibleTriangles`는 보이는 mesh의 고유 triangle 총합이다. `triangles`는 그림자·투과 등 모든 렌더 패스를 합친 Three.js 카운터이며 둘을 같은 예산과 비교하지 않는다. `drawCalls`는 해당 프레임 렌더 패스들의 호출 수다. FPS/P95는 viewport별로 안정화 후 약 120개 rAF 프레임을 모은 desktop Chromium 표본이며 GPU 작업 시간이나 실제 iPhone 성능이 아니다.

## 최종 자동·시각 결과

최종 실행 시작 **2026-09-24 21:51:31 KST** (`2026-09-24T12:51:31.966Z`). idle의 세 번째 트레이 위치 수정까지 포함했다. `passed: true`, GLB 4개 ready, 실제 select와 네 range의 키보드 이벤트 통과, 두 viewport 배치 통과, 8개 phase와 9개 specimen 조합 통과, probe/browser 오류 0. 렌더러·GLB·배경 파일의 검사 시작/끝 SHA가 동일하다. 검사 전용 Chromium 세션은 종료했다.

| viewport | DPR | 표본 | FPS | P95 | visibleTriangles | triangles 전체 패스 | draw calls |
|---|---:|---:|---:|---:|---:|---:|---:|
| 390×844 | 1 | 120 frames / 119 intervals | 60.001 | 16.7ms | 81,000 | 239,000 | 19 |
| 1440×900 | 1 | 120 frames / 119 intervals | 60.004 | 16.8ms | 81,000 | 239,000 | 19 |

위 수치는 약 2초의 **desktop Chromium, DPR 1** 표본이다. 모든 패스 239,000과 고유 visible triangles 81,000을 구분한다. 이 기록은 실기기 3분 성능 조건을 대체하지 않는다.

실제 캡처를 열어 확인한 사항:

- [390×844](runtime-390x844.png)와 [1440×900](runtime-1440x900.png)에서 금속·광학 렌즈·카세트·작업대가 로드된다. 넓은 화면 외곽에는 트레이/케이스 복제 없이 어두운 배경이 보인다.
- [complete](runtime-phase-complete.png): 세 보관물이 390px 화면 안에 들어온다. 초기의 오른쪽 잘림은 수정됐다.
- [정상 렌즈](runtime-salvage-lens-inspecting.png)와 [파손 렌즈](runtime-salvage-lens-failed.png): 원판 균열과 밝은 점선, 하우징 어두워짐이 보인다. 다만 디스크 자체가 작아 정상/파손을 즉시 구분하는 가독성은 제한적이다. 선명한 파손 전달을 완성했다고 단정하지 않는다.
- [idle](runtime-phase-idle.png): 세 번째 slot을 왼쪽 트레이 앞쪽으로 옮긴 최종 캡처에서 코어·렌즈·카세트가 모두 선명하게 보인다. 초기의 프레스 뒤 가림은 수정됐다. inspecting의 두 대기 물건도 트레이 순서 압축으로 잘 보인다.
- paused, compressing, settling, stored를 포함한 8장에는 검은 화면·누락 모델·UI의 작업대 가림이 관찰되지 않았다. 이미지 비교는 실제 입력이나 게임 판정 검증과 다르다.

초기 중도 실패 뒤 최종 파일로 전체 재실행하여 위 결과를 얻었다. 최초 개발용 placeholder 기록은 별도 `preview-browser-check.json`에 보존되어 있다.

실제 iPhone Safari, 3분 성능, touch/cancel 전체 입력, A/C와 연결된 게임 루프, 대회 제출 경로는 이 독립 렌더 작업에서 검증하지 않았다.

## 데스크톱 3분 연속 측정

`soak-check.mjs` 최종 실행: **PASS**, 180.005초, 10,801 rAF 표본, 평균 60.004 FPS, P95 16.7ms, max 16.8ms, 오류 0. 390×844 CSS pixels / DPR2 / framebuffer780×1688. HeadlessChrome153 / ANGLE Metal Apple M5. 검사·압착·파손·보관·완료·정지 fixture를 30초 간격으로 바꿨다. 시작/끝 renderer·GLB·배경 SHA 동일. 이 값은 **데스크톱 rAF 간격**이며 실제 iPhone13 Safari 또는 GPU 실행시간/터치지연 보증이 아니다. [전체 기록](desktop-soak.json).

root의 전체 `npm run check`: 9개 파일 **42 tests** 통과, frozen23파일일치, TS/모듈경계/build통과. B ownership과diff검사통과. [Mac Safari 별도 UI 관찰](safari-desktop.md)은 새 로드 후 입력/화면 확인이며 HMR중일시적Script error도기록했다.
