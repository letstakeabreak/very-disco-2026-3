# 그림자 재사용 — 화면을 유지한 렌더링 비용 감소

2026-09-25. PR #1은 `integration/v1`의 `fa622b70566cdacc37cc419552b20ae62b8d61ed`로 머지됐다. 이 후속 변경은 그 통합 커밋에서 출발하며 B 소유 파일만 수정한다.

## 구현

프레스와 회수물이 멈춰 있어도 기존 렌더러는 1024² 그림자를 매 프레임 다시 그렸다. 고정 조명의 자동 갱신을 끄고 프레스·회수물의 위치/회전/크기/가시성, 램 이동량, 압축·손상 셰이더 값을 비교해 바뀐 프레임에 갱신한다. 셰이더 변형도 추적하므로 압착 중 그림자가 이전 모양으로 남지 않는다. 점수·tick만 바뀌거나 화면 크기만 바뀌면 기존 광원 공간의 그림자를 재사용한다.

화면은 매 프레임 렌더한다. DPR·그림자 해상도·재질·모델·조명·공개 API를 변경하지 않았다. 갱신 판단에 사용하는 숫자는 GPU에 전달하는 float 정밀도로 비교한다. 광원, stage 부모와 모델 내부 transform은 이 렌더러에서 고정돼 있으며 그림자를 드리우지 않는 계기판 바늘은 갱신 조건에서 제외한다.

## 검증

- 새 회귀 테스트 2개를 기존 구현에서 먼저 실패시킨 뒤 수정 후 통과시켰다. 정지 상태 재사용, 회전·손상·압축·보관·가시성·명시적 entity transform, 램 진입과 보간, resize를 확인한다.
- 전체 검사: 고정 23파일, TypeScript, 19모듈 경계, 13파일 **69테스트**, build, B 소유권 검사 통과. JS chunk 500kB 경고는 남는다.
- [실제 WebGL 전후 기록](comparison.json): desktop Chromium, CSS 390×844 / canvas 390×844. 대기, 3종 검사, 금속/카세트 압착, 렌즈/카세트 파손, 3개 보관의 **9쌍 PNG가 SHA-256까지 동일**하다. 모델 4개 로드, 오류 0, 각 촬영의 소스 전후 해시 일치다.
- 이 9개 **안정된 자세**에서 draw calls **33 → 27**(18.2% 감소), 모든 패스 triangles **281,192 → 193,194**(31.3% 감소). visible triangles는 105,096으로 같다. 움직임으로 그림자를 갱신하는 프레임의 비용은 이 수치와 다르다.
- 이 수치는 GPU 작업량이지 FPS 향상률이 아니다. 실제 iPhone을 연결할 수 없어 이번 변경의 기기 성능·발열·안정성은 재측정하지 않았다. 이전 40.05fps 측정을 현재 구현의 실측으로 사용하지 않는다.

| 상태 | 변경 전 | 변경 후 |
|---|---|---|
| 카세트 검사 | [실행 캡처](before/06-inspecting-salvage-cassette.png) | [실행 캡처](after/06-inspecting-salvage-cassette.png) |
| 카세트 파손 | [실행 캡처](before/08-failed-salvage-cassette.png) | [실행 캡처](after/08-failed-salvage-cassette.png) |
| 보관 | [실행 캡처](before/09-stored-salvage-cassette.png) | [실행 캡처](after/09-stored-salvage-cassette.png) |

전후 18장 모두 생성 이미지가 아닌 실제 WebGL canvas 출력이다. 동일한 카메라/상태의 시각 보존 검사이며 콘셉트 대비 아트 합격이나 실제 게임 판정 증거는 아니다. [기존 아트 미달 항목](../art-review.md)과 [실기기 결과/남은 항목](../device-acceptance.md)은 별도로 남는다.

## 재현

기준 커밋의 별도 checkout을 4176, 변경본을 4177에서 실행한 뒤 저장소 루트에서 `node docs/handoffs/B/performance-study/capture.mjs <baseline-checkout>`를 실행한다. 다른 포트는 그 뒤 baseline URL, candidate URL 순으로 전달한다. 촬영 중 소스를 수정하지 않는다. 정확한 입력 소스·에셋 해시는 비교 JSON에 기록했다.
