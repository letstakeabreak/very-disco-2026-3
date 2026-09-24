# 케이스 홈 배치 측정과 독립 실험

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
