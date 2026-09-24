# B — 모바일 모델 파이프라인 인계

2026-09-24. 출발 `bootstrap-v2` / `c739b527449b2527e46b567bfffbd4a7122f571c`, 작업 브랜치 `role/b-render`, 계약 v1.0.0. 이 하위 작업은 commit/push를 하지 않았다. 런타임 모델 네 개와 `assets/source/pipeline/**`, 이 문서만 담당했다. 생성 원본·renderer·registry·공통 계약은 수정하지 않았다.

## 최종 파일

모든 치수는 실제 GLB accessor에서 읽은 m이며 순서는 X 폭 / Y 높이 / Z 깊이다. 네 파일은 독립 PBR GLB다. 기본 재질과 필요한 JPEG 이미지를 내장하며 외부 URL·Draco/Meshopt decoder가 없다.

| 파일 | 삼각형 | bytes | 치수 m |
|---|---:|---:|---|
| `public/assets/models/press-chamber.glb` | 42,998 | 2,872,664 | 0.792009 × **1.100000** × 0.773259 |
| `public/assets/models/salvage-cassette.glb` | 15,000 | 2,109,280 | **0.280000** × 0.134282 × 0.138477 |
| `public/assets/models/salvage-core.glb` | 11,500 | 1,901,316 | 0.222250 × **0.150000** × 0.144906 |
| `public/assets/models/salvage-lens.glb` | 11,500 | 2,073,588 | 0.173794 × **0.150000** × 0.125348 |
| 합계 | **80,998** | **8,956,848** | |

최초 두 모델 합계는 4,981,944 bytes로 8MB 예산 안에 있다. 네 모델도 90k triangle / 14MB 목표 안에 있다. 이 수는 모델 자체의 삼각형 합계이며 shadow pass를 포함한 GPU 실행 횟수·draw count가 아니다.

모두 +Y up/+Z front, 전체 모델 base-center, identity node transform이다. 정규화가 vertex 좌표에 직접 들어 있으므로 `position.y`를 사용하는 변형에 연결할 수 있다. Base color/normal 2048², MR 1024², JPEG 품질 88이다. 원본 4K color/normal과 2K MR은 master에 보존했다.

## 프레스 부품과 접촉 좌표

`press-frame` 36,499 triangles, `press-ram` 6,499 triangles. 두 node는 **같은 PBR material을 공유**하며 origin=(0,0,0)이다. 독립적인 재질 변경/폐기가 필요하면 renderer에서 clone·reference count를 관리해야 한다.

좌표는 프레스 asset root 기준이다. 현재 접촉 좌표는 [runtime-anchors.json](../../../assets/source/pipeline/runtime-anchors.json), 최종 GLB의 상면 raycast 증거는 [anchor-recalculation.json](../../../assets/source/pipeline/anchor-recalculation.json)에 있다. [mobile-model-report.json](../../../assets/source/pipeline/mobile-model-report.json)은 베이크 당시의 과거 기록이며 그 안의 옛 상면 값은 현재 렌더러 기준으로 쓰지 않는다.

| anchor | 값 m |
|---|---:|
| 램 중심 아래 ray가 만난 상면 `workbedTopY` | 0.3763680458 |
| 누름판 밑면 초기 `platenRestBottomY` | 0.5510312915 |
| 램 중심 X / Z | 0.0214740932 / -0.0936739240 |
| 상단 고정 연결 높이 | 0.8248949380 |
| 하단 플랜지 위쪽 높이 | 0.6369931734 |
| 바닥 여유 | 0.0018319542 |
| 선택 물건 base Y | 0.3782 |
| 최대 하향 이동 | 0.1728312915 |

선택 물건 base는 `(0.0214740932, 0.3782, -0.0936739240)`다. base에서 쉬는 램 밑면까지는 약 0.172831m이며 core/lens의 원래 높이 0.15m에 기본 장면 scale 1.1을 적용한 0.165m가 들어간다. 실제 눌림 접촉은 base와 변형된 bounds를 프레스 로컬 공간으로 옮겨 램 밑면에 맞춘다. 게임의 L 용량 판정과는 무관한 시각 배치 값이다.

기존 vertex 선택 box가 실제 상면의 대부분을 제외해 낮은 높이를 반환한 문제를 수정했다. 준비 단계와 최종 검사 모두 실제 면에 수직 ray를 쏜다. 이번 재계산은 모델을 베이크·내보내기 하지 않았고 GLB 네 개의 해시를 보존했다. [접촉 조사](contact-study/README.md)는 카세트의 yaw 표본을 검토한 결과이며 모든 회수물·연속 변형의 물리 접촉을 인증하지 않는다.

램을 통째로 translate하면 상단 실린더가 프레임에서 떨어져 보인다. `press-parts-debug-translation-limit.png`에서 이 한계를 확인했다. 상단 연결은 고정하고, 하단 플랜지는 같은 거리만큼 이동시키며, 두 높이 사이의 실린더만 연장하는 방식은 `press-parts-debug-upper-fixed-limit.png`에서 오프라인 확인했다. 실제 shader·물건별 접촉은 renderer 담당의 실행 검증 대상이다.

## 렌즈

원본의 중앙 앞쪽 곡면을 기하 선택으로 `lens-glass` 2,000 triangles와 `lens-housing` 9,500 triangles로 분리했다. 새 유리 geometry를 발명하거나 원본 실루엣을 교체하지 않았다. `lens-parts-debug.png`에서 파란 곡면 선택을 확인할 수 있다. 두 node는 기본 PBR material을 공유한다.

`lens-glass` bounds는 X[-0.0382873, 0.0417254], Y[0.0345053, 0.1154455], Z[0.0435442, 0.0542087]m다. 중앙은 대략 (0.0017191, 0.0749754, 0.0488765)m다. 유리 압착은 일반 Y 축 축소에 함께 넣지 않고 이 영역을 rigid하게 다뤄야 한다.

Meshy 원본은 OPAQUE이며 투과·굴절이 없다. 이 파일도 원본 PBR를 보존하므로 렌더러가 **lens-glass에만** 적절한 glass material을 적용해야 한다. 오프라인 렌더의 불투명 원판을 완성된 유리 표현으로 제시하지 않는다. 12k 이하로 줄인 하우징의 아주 작은 홈과 곡률은 원본보다 단순해졌으며 원본과 완전히 동일하다고 주장하지 않는다.

## 품질 수정과 재현

단순 decimation+원래 UV 유지 결과에는 금속 호일 같은 삼각형 무늬가 생겼다. 조명 없는 baseColor 렌더에도 무늬가 남았고, 단색 geometry에서는 사라져 atlas 보간 손상을 확인했다. glTF 재수입 때 corner normal/UV 때문에 갈라진 동일 좌표도 다시 weld했다. 이후 새 shared UV atlas, 45° sharp edge와 면적 가중 노멀, master의 **색·MR·normal 세 채널 재베이크**로 수정했다. 최종 네 모델의 원본/결과 비교 렌더를 실제로 열어 확인했다. 생성 PNG를 게임 캡처로 사용하지 않았다.

재현 명령과 스크립트 역할은 [pipeline README](../../../assets/source/pipeline/README.md)에 있다. `prepare_mobile.py`만 실행한 중간 결과를 최종 파일로 배포하지 않는다. 재베이크 normal map에는 저폴리 표면 보정도 포함되므로 normalScale을 임의로 낮추면 geometry의 각진 음영이 다시 드러날 수 있다.

## 검증과 남은 경계

- `validate_glbs.py` 통과: 네 파일의 실제 bytes/SHA-256, triangle, finite position, unit normal, index 범위, 실측 치수, base-center, identity transform, PBR 세 채널, 2K 이하 이미지, self-contained 여부.
- Blender 5.1.1 재수입·Cycles 비교 렌더·프레스 부품/상하 이동·렌즈 곡면 선택 확인. 원본 SHA 보존 및 렌즈 chunk→gzip→raw SHA 검증을 실행했다.
- Python 파이프라인 전체 문법 검사, `git diff --check`, `npm run ownership -- --role B --base bootstrap-v2` 통과. 코드의 전체 `check`와 브라우저 검증은 통합 담당이 별도로 수행한다.
- 원본/런타임 해시·상세 설정은 [검증 JSON](../../../assets/source/pipeline/glb-validation.json)과 [lineage JSON](../../../assets/source/pipeline/mobile-model-report.json)에 있다. 원본의 유료 생성 설정/권리 조건은 해당 Meshy provenance가 기준이다. 이 변환 단계에서 추가 유료 호출은 없었다.
- 실제 게임 로드, shader 변형, 유리 굴절, iPhone Safari 성능·입력·전체 루프는 이 하위 작업의 검증이 아니다. 오프라인 준비가 끝났다는 뜻이며 registry의 device `verified` 승격 근거로 단독 사용하지 않는다.
- 런타임 네 파일을 동결한 뒤 최종 브라우저 QA 담당에게 인계했다. renderer 및 앱 검증 결과는 별도 handoff를 따른다.
