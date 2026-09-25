# B 렌더 미리보기 도구 — 초기 검증

확인: 2026-09-24. 역할 B / `role/b-render`. `bootstrap-v2`의 annotated tag object는 `ba2f00e700c04402cfa6574c4db9cf5ab0d7c2a0`이며, 실제 공통 출발 commit (`bootstrap-v2^{commit}`)과 작업 시작 HEAD는 `c739b527449b2527e46b567bfffbd4a7122f571c`다. 계약 1.0.0. 이 작업에서는 commit/push하지 않았다.

## 여는 방법

개발 서버가 켜진 상태에서 [렌더 미리보기](http://localhost:5173/docs/handoffs/B/preview.html)를 연다. 이 페이지는 공개 `createRenderer`와 공유 fixture만 사용하며 A의 코어·C의 앱을 실행하지 않는다. 상단 50px/하단 130px에 제어판이 있고 safe-area는 추가로 반영한다. 가운데 canvas는 화면 전체 크기다.

- phase: 8개 계약 상태. 선택 시 해당 fixture의 압력·무결성·보관 수를 적용한다.
- specimen: 금속 코어 / 광학 렌즈 / 데이터 카세트.
- pressure/integrity/yaw/stored: 렌더 비교를 위한 직접 값 편집. yaw 표시 °는 전달 시 rad로 변환된다.
- 압력 슬라이더는 게임의 부피·손상·점수 공식을 계산하지 않는다. 조합 중 실제 게임에서 도달하지 않는 상태가 있을 수 있다. 이는 의도적인 시각 QA 도구이며 플레이 검증이 아니다.

`window.__renderProbe`는 **이 하네스에서만** 제공한다. 렌더러 공개 API에는 추가하지 않았다.

```js
window.__renderProbe.snapshot
window.__renderProbe.controls
window.__renderProbe.errors
window.__renderProbe.metrics
window.__renderProbe.setState({
  phase: 'compressing', specimenId: 'salvage-lens',
  pressure01: 0.6, integrity01: 0.8, yawDeg: 35, storedCount: 1,
})
window.__renderProbe.resetMetrics()
```

metrics는 최근 최대 600개 **실제 rAF 간격**의 FPS/P95/max와 전체 frame 수, viewport/DPR, canvas.dataset 사본을 반환한다. GPU 시간이나 실제 iPhone 성능으로 읽으면 안 된다. 새 장면에서 안정된 측정이 필요하면 resetMetrics 후 관찰 시간을 확보한다. 자동 초기 검사의 수치는 시작·리사이즈 지연을 포함한다.

## 재현 명령

```sh
node docs/handoffs/B/check-preview.mjs
node docs/handoffs/B/browser-check.mjs
```

첫 명령은 별도 preview-tsconfig로 하네스와 import한 공개 렌더러/계약을 검사한다. 공유 tsconfig의 include를 바꾸지 않았다. 둘째 명령은 별도 headless Chromium 세션과 고정 `agent-browser@0.38.1`을 사용한다. 기본 서버 주소는 127.0.0.1:5173이며 첫 인자로 다른 개발 서버 주소를 줄 수 있다. 자기 세션만 닫는다.

이후 실제 렌더러용으로 확장한 browser-check는 `renderState=ready`, GLB 4개 로드, 실제 select/range 이벤트, 두 화면 크기, 8개 phase와 세 물건의 검사/압축/실패 조합을 확인한다. `runtime-browser-check.json`과 `runtime-*.png`에 결과를 저장한다. 시작/종료 시 렌더러·런타임 에셋 해시가 바뀌면 실패 처리하므로 파일 수정이 멈춘 상태에서 실행한다. 각 화면의 120 rAF 프레임 표본은 desktop Chromium 관찰치이며 실기기 성능 통과 기준이 아니다.

## 초기 결과와 한계

- baseline 공통 typecheck/bootstrap 검사 통과. 하네스 작성 후 독립 typecheck·공통 typecheck·B 소유권·diff 공백 검사 통과.
- desktop Chromium에서 390×844와 1440×900을 열어 가로 overflow 없음, 상단 50px/하단 130px 확인.
- 8개 phase를 immutable snapshot으로 렌더했으며 probe 오류·브라우저 오류 없음.
- 당시 실행 렌더러는 **개발용 wireframe placeholder**였다. 캡처는 최종 3D 에셋·재질·콘셉트 달성 증거가 아니다.
- 실제 iPhone, touch gesture, 실제 게임 규칙, 3분 성능, 최종 에셋 로딩은 이 하네스 작업에서 검증하지 않았다. root의 렌더러 변경과 에셋 도착 후 재검증해야 한다.

기계 판독 결과: [preview-browser-check.json](preview-browser-check.json). 실제 브라우저 캡처: [390×844](preview-browser-check-390x844.png), [1440×900](preview-browser-check-1440x900.png).

위 초기 기록은 보존했다. 실제 렌더러 후속 결과는 [runtime-browser-check.json](runtime-browser-check.json)을 따르며 `passed`와 `failure`를 함께 확인한다. 캡처 파일 존재만으로 성공한 실행이라고 판단하지 않는다.
