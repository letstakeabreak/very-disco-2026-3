# 케이스 홈 배치 측정과 독립 실험

## 최신 production 배치 — 전경 케이스

2026-09-25의 production은 ImageGen 편집본 `workshop-v4.webp`를 사용한다. [source·세 편집 프롬프트·판정·해시](../../../../assets/source/environment/case-layout-provenance.json)에 원본과 채택하지 않은 v2/v3도 보존했다. v2는 중앙 프레스와 겹쳤고 v3도 홈이 너무 높았다. v4는 케이스를 전경으로 옮기고 왼쪽 트레이·작업등·창문을 유지했다. 카메라나 GLB/PBR은 변경하지 않았다. 케이스 자체는 여전히 2D 배경이다.

[전경 홈 측정](foreground-case-measurements.json)은 실제 1024×1536 이미지에서 세 홈의 네 모서리를 읽은 값이다. 모두 이미지 안에 있으며 잘린 모서리를 외삽하지 않았다. 기존과 같은 camera/작업대 평면으로 중심·앞뒤 방향을 구하고, 저장 물건 scale을 .52에서 .7로 키웠다. 의미 있는 차이를 보여 주는 실제 3D 모델은 그대로다.

[foreground-report.json](foreground-report.json)은 공개 production renderer로 **6가지 순서 × 3가지 압축(0/.55/1) × 2화면(320×568,390×844) = 36개 배치**를 검사했다. 이 값들은 순수 시각 fixture이며 코어가 실제 보관 가능한 게임 결과라고 주장하지 않는다. actual GLB 정점에 production shader의 위치 변형을 CPU로 적용해 화면 범위를 측정하고, GPU 캡처 6장을 남겼다. 물건끼리 수평 간격 최소13.87px, B 연구용 130px 하단 패널까지 최소10.88px, 화면 밖 잘림0·오류0였다. 이는 2D 투영 검사이며 실물 케이스 깊이·벽·가림을 인증하지 않는다.

확대 scale .9 후보는 자동 화면 경계 검사는 통과했지만 큰 GPU 이미지에서 앞 테두리 위 돌출이 과해 채택하지 않았다. [후보 캡처](foreground-scale09-rejected.png)와 [자동 측정·육안 기각 사유](foreground-report-scale09.json), 해당 renderer 소스 사본을 보존했다. 최종 .7은 다시 36개 조합을 검사했다. 자동 PASS를 아트 승인으로 사용하지 않은 사례다.

320px / 압축.55 / 카세트→렌즈→코어 순서에서 각각 약25×53px,33×40px,28×52px로 보인다. [320px 무압축](foreground-captures/320-compression-0.png), [390px .55](foreground-captures/390-compression-0.55.png), [320px 최대 변형](foreground-captures/320-compression-1.png)을 직접 대조해 세 종류와 전체 외형이 화면 안에 있음을 확인했다. 미세 손상 식별·상용 수준 아트 완성은 별도 미완료다.

**C 통합 주의:** 320×568에서 130px overlay 여유가 10.88px로 좁다. 이 수치에는 실제 safe-area가 없다. 더 높은 HUD를 같은 전체 화면 canvas 위에 덮으면 보관물이 가려질 수 있다. C는 실제 HUD/safe-area로 확인하고, 필요하면 기존 `resize({width,height,dpr})`에 전달하는 canvas의 표시 영역을 조작부 위로 확보한다. 새 API나 공유 계약은 요구하지 않는다. 이 연구 화면을 C 앱 또는 실제 iPhone 합격으로 사용하지 않는다.

재현: 개발 서버에서 [foreground.html](foreground.html), 자동 검사 `node docs/handoffs/B/layout-study/foreground-check.mjs`. `foreground.ts`는 루트 strict TypeScript 옵션으로 별도 검사했다. 아래는 이전 케이스 배치의 이력이며 현재 production 위치로 읽지 않는다.

## 이전 배치의 측정 이력

실제 `workshop.webp`의 세 홈을 측정하고 동일한 런타임 GLB를 별도 Three.js 뷰어에 올렸다. **홈 방향과 중심 정렬은 기존 배치보다 개선됐다. 이 자료는 적용 권고이며 production 렌더러나 게임플레이 완료 증거가 아니다.**

기존 코드는 세 물건을 `(.862,.551)`, `(.912,.563)`, `(.962,.575)`에 두고 모두 yaw `-.32`, scale `.43`을 사용한다. 기준점은 홈 앞부분에 있고, 물건의 긴 +X축이 홈의 앞뒤 방향과 거의 직각이다. 높이를 가진 모델의 바닥만 그 점에 맞춰 물건이 홈 앞에 가로로 놓이고 빈 홈이 뒤에 남았다.

측정은 원본 1024×1536 이미지의 좌상단을 원점으로 한다. 경계값은 눈으로 확인한 사각형 근사이며 오차 약 3px다. 둥근 모서리와 홈 깊이를 복원한 CAD 좌표가 아니다. 정확한 네 모서리와 UV는 [measurements.json](measurements.json)에 있다.

| 홈 | 중심 UV | 뒤쪽 중심 UV | 앞쪽 중심 UV | 새 카메라에서 yaw(rad) |
|---|---|---|---|---|
| 왼쪽 | (.866211, .536133) | (.881348, .511393) | (.851074, .560872) | -1.850176 |
| 가운데 | (.923096, .544922) | (.937500, .519857) | (.908691, .569987) | -1.863858 |
| 오른쪽 | (.979980, .553711) | (.993164, .528320) | (.966797, .579102) | -1.873109 |

카메라 `(0,1.37,2.7)`, lookAt `(0,.4,0)`, FOV 34°, aspect 2:3, onTable 평면 `Y=.22`로 실험했다. 카메라가 바뀌어도 위 UV는 이미지의 홈을 가리킨다. 실제 yaw와 위치는 현재 카메라와 평면으로 다시 구한다.

1. `axis = normalize(onTable(frontUV) - onTable(rearUV))`로 홈의 앞뒤 축을 구한다.
2. `yaw = atan2(-axis.z, axis.x)`, `quaternion = qYawY(yaw) * qX(-π/2)`로 모델 +X 긴 축을 홈에 맞추고 +Z 전면이 위를 향하게 눕힌다.
3. `position = onTable(centerUV) - quaternion * (0, renderedHeight/2, 0) * scale`로 **변형된 모델 중심**을 홈 중심에 맞춘다. 원래 바닥 중심을 그대로 쓰면 회전 후 치우친다.
4. 실험한 scale `.48 / .52 / .54` 중 `.52`를 보수적인 시작값으로 남겼다. `.54`는 더 많이 채우지만 렌즈 외피가 홈 가장자리에 가까웠다. 카메라 변경·저장 순서·실제 압축 이력마다 투영 경계가 달라지므로 `.52`를 보편적인 물리 규격으로 쓰지 않는다.

물건의 압축은 모든 실험에서 진단용 `.55`다. 현재 production의 보관 cosmetic fallback과 일치시키기 위한 값이며 게임 판정이나 회수 이력을 생성하지 않는다. 다른 압축/손상 값의 메시는 실제 저장 시점 상태로 다시 확인해야 한다. 렌즈는 원판을 위로 눕혀 비스듬히 보이므로 원판 식별성이 별도 검토 항목으로 남는다.

| 증거 | 의미 |
|---|---|
| [aligned-new-camera.png](aligned-new-camera.png) | 새 카메라·평면, scale .52, 방향/중심 보정 후 실제 WebGL |
| [measured-apertures.png](measured-apertures.png) | 같은 결과 위에 원본 홈 측정 사각형을 초록색으로 투영 |
| [old-placement-new-camera.png](old-placement-new-camera.png) | 같은 새 카메라에서 기존 UV/yaw/scale .43 재현. 새 배치와 직접 비교용 |

[index.html](index.html)은 Vite에서 `/docs/handoffs/B/layout-study/index.html`로 연다. `window.__layoutStudy.set({mode:'old'|'aligned',scale:.52,faceUp:true,outlines:true})`로 비교할 수 있다. `window.__layoutStudy.report`는 실제 적용 위치·쿼터니언을 반환한다. 렌더러의 production 모듈을 대체하지 않는다. 배경은 실제 generated texture, 물건은 실제 shipping GLB/PBR와 기존 변형 셰이더를 사용한다. 프레스는 배치 검토를 가리지 않도록 이 뷰어에서 로드하지 않았다.

`npx tsc -p docs/handoffs/B/layout-study/tsconfig.json --noEmit`과 `git diff --check`를 통과했고 캡처 시 브라우저 오류는 없었다. 이 뷰어에는 케이스의 실제 깊이·벽·그림자·가림 geometry가 없으므로 안착한 듯한 투영 정렬까지만 검증했다. 콘셉트 05는 홈 자체가 더 크고 회수물 형상도 다르다. 현재 배경의 오른쪽 홈은 이미지 밖으로 일부 잘려 있고 해당 뒤 오른쪽 모서리는 인접 경계에서 외삽했다. 방향 수정으로 이 구성 차이가 해결됐다고 판정하지 않는다.
