# 압력계 덮개와 동작 바늘 배치 조사

2026-09-24. **가능하다.** 실제 런타임 프레스에서 기존 바늘 앞·금속 테두리 뒤에 불투명 평면을 넣으면 기존 눈금과 바늘을 함께 가릴 수 있다. 모델과 renderer는 수정하지 않았으며 대체 이미지 생성·동작 바늘 구현도 하지 않았다. 수치의 기준은 [gauge-calibration.json](gauge-calibration.json)이다.

## 실측 결과

입력은 `public/assets/models/press-chamber.glb`, SHA-256 `fae32ad1874c35a03682135303922f33d35a60d9bb8c5648f8921634ec07cc75`, node `press-frame`이다. 좌표는 press root 기준 m, +Y up/+Z front다.

기존 바늘은 텍스처만이 아니라 **앞으로 솟은 geometry**다. 내부 눈금판은 대략 Z=-0.0023, 바늘의 최대 앞면 Z=0.0109191, 주변 금속 테두리는 대략 Z=0.023–0.0262다. 따라서 평면 Z=0.014는 바늘보다 약 3.08mm 앞이고 테두리보다 최소 약 9mm 뒤다.

1.25mm 간격의 정면 ray grid로 읽은 개구부는 X[-0.10125,0.13125], Y[0.910,1.01125], 폭 약 0.2325m·높이 약 0.10125m다. 경계 측정 오차는 grid 한 칸 정도로 본다. 개구부는 정확한 반원이 아니라 가로가 약간 넓은 반타원 형태다. 아래쪽 중심은 (0.015,0.910), bounding-box 중심은 (0.015,0.960625)다.

## 권고 배치

```text
cover = PlaneGeometry(0.250, 0.115)
cover.position = (0.015, 0.9635, 0.014)
cover.rotation = (0, 0, 0)  // 기본 Three.js PlaneGeometry의 법선 +Z
```

덮개는 press root의 자식으로 둔다. 화면 고정 UI나 `press-ram` 자식이 아니다. `depthTest=true`, `depthWrite=true`, `transparent=false`인 완전 불투명 면을 쓴다. 이 크기의 사각 모서리는 실제 금속 테두리 뒤에 가려져 결과적으로 반원 개구부만 보인다. 투명한 눈금 링만 그리면 원래 바늘이 다시 보이므로 내부 바탕까지 덮는 이미지가 필요하다.

진단용 녹색 평면을 위 좌표에 넣어 정면과 사선으로 렌더했다. 두 방향 모두 **기존 바늘·눈금이 완전히 사라지고**, 금속 테두리와 네 나사는 남았다. 색 평면은 위치 검사용이며 최종 아트가 아니다. 평면을 금속 테두리보다 앞으로 빼거나 depth test를 끄면 사각 모서리가 노출될 수 있다.

새 바늘은 다음을 출발점으로 권고한다.

```text
pivot = (0.017, 0.912, 0.0146)
length = 0.080m
maximum width = 0.003m
zero-rotation direction = +Y
rotation.z = (80 - 160 * clamp(snapshot.pressure01, 0, 1)) * π / 180
```

압력 0은 왼쪽, 0.5는 위, 1은 오른쪽이다. 바늘을 덮개보다 0.6mm 앞으로 둔다. 이 바늘의 위치·길이·sweep는 **구현 권고**이며 실제 애니메이션을 시험한 결과는 아니다. core 판정을 복제하지 않고 `snapshot.pressure01`을 읽어야 한다. 압력 해제 뒤 어떤 값을 보여줄지는 기존 snapshot 의미를 그대로 따른다.

새 계기판 이미지는 정면의 평평한 눈금판이며 고정 바늘이 없어야 한다. 덮개 종횡비는 약 2.174:1이다. 바늘 pivot은 이미지의 왼쪽부터 50.8%, 위에서부터 94.78% 지점에 해당한다. 실제 생성 이미지의 눈금 중심이 이 점과 맞는지 비교한 뒤 적용한다. 주변 금속 베젤·네 나사는 기존 모델을 쓰므로 새 이미지에 중복해서 그릴 필요가 없다.

## 확인 범위와 임시 증거

Blender 5.1.1에서 실제 GLB를 읽고 vertex 검사·정면 raycast·원본/진단 평면 렌더를 수행했다. 게임의 실제 WebGL, iPhone, 새 texture, 움직이는 needle은 아직 이 조사에서 검증하지 않았다. 임시 렌더는 다음 디렉터리에 있다. 이 작업의 저장소 쓰기 범위가 두 문서뿐이므로 이미지 파일은 저장소에 추가하지 않았다.

`/var/folders/yr/5q2wwd3n70jb3xrklk47b9j00000gp/T/deep-press-gauge-ccklom9v/`

- `gauge-front.png`, `gauge-oblique.png`: 원래 계기판과 솟은 바늘.
- `gauge-cover-front.png`, `gauge-cover-oblique.png`: 권고 평면으로 기존 바늘과 눈금을 가린 결과.
- `gauge-cover-production-angle.png`: 현재 renderer의 시선 방향을 참고한 오프라인 배치 점검. 실제 게임 캡처가 아니다.

이 임시 파일은 향후 정리될 수 있다. 오래 남는 재현 기준은 입력 GLB 해시와 JSON의 좌표·치수·깊이 설정이다. source/runtime GLB, 코드, registry는 변경하지 않았다.

## 후속 구현

위 내용은 좌표 조사 당시의 기록이다. 이후 `src/render/gauge.ts`와 `index.ts`에 생성 눈금판과 snapshot 기반 바늘을 구현했다. 최종 이미지의 중심에 맞춰 바늘 pivot Y는 0.91405로 보정했다. 현재 상태·검증은 [B 인계](README.md), [브라우저 기록](evidence/renderer-validation.md)을 따른다.
