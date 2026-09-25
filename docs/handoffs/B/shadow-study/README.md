# 받침 접촉 그림자 진단

검증 시각: `2026-09-24T13:58:18.147Z`. **수정 전 production 소스와 독립 QA hook으로 만든 역사적 비교**다. 이후 root가 production에 `bedShadow.receiveShadow = true`를 반영했다. 이 폴더의 두 장을 최신 production 검증으로 재분류하지 않는다.

## 확인된 원인과 최소 수정

작업대의 큰 ShadowMaterial 평면은 `receiveShadow=true`였지만, 프레스 받침의 작은 `bedShadow` 평면은 기본값 **false**였다. 실제 공개 `createRenderer`로 만든 Scene에서도 false를 확인했다. 권고한 수정은 받침 생성 시 `bedShadow.receiveShadow = true` 한 줄이다. root가 적용했으며 이 진단 에이전트는 production 파일을 수정하지 않았다.

Three r186의 `ShaderLib/shadow.glsl.js`는 alpha를 `opacity * (1.0 - getShadowMask())`로 계산한다. `ShaderChunk/shadowmask_pars_fragment.glsl.js`에서 receiveShadow가 false이면 방향광 shadow factor는 1이다. 따라서 이 평면의 opacity 0.4를 올려도 shadow alpha가 0으로 남는다. 실제 key 그림자 생성 실패나 normalBias 값을 먼저 의심할 문제가 아니었다.

## GPU 비교 결과

[수정 전 — 실제 renderer](captures/contact-baseline.png) / [receiveShadow만 true — QA hook](captures/contact-receive.png)

- 두 화면 모두 공개 `createRenderer`, 같은 inspecting fixture, cassette yaw 0.45, 같은 camera `(0, 1.37, 2.7)`, 1024×1536 캔버스다.
- 두 번째 화면에서 문서 뷰어의 `Mesh.prototype.onBeforeRender` hook이 실제 Scene의 받침 평면을 찾아 receiveShadow만 true로 바꾼다. 카메라·조명·geometry·material opacity·bias·그림자 해상도는 변경하지 않았다. 공개 production API를 확장하거나 테스트 노출을 추가하지 않았다.
- key shadow map은 양쪽 모두 1024² RGBA/UnsignedByte이며 readback에서 **105,867개 non-white texel**, R 최솟값 111/최댓값 255였다. 동일한 그림자 텍스처가 존재하므로 그림자 생성 경로가 비어 있지 않다.
- 평면 world Y는 0.3798680458068848, opacity 0.4, depthTest=true, depthWrite=false였다. normalBias=0.0015, bias=-0.00005도 동일했다.
- true 화면에서 카세트 바닥 접촉선과 뒤쪽으로 짧게 드리운 그림자가 분명해졌다. 이번 고정 뷰에서는 받침 평면의 사각 외곽선이나 넓은 검정 패치가 새로 드러나지 않았다. 다른 specimen/회전/압축 상태 전체의 경계 검증은 이 실험에서 수행하지 않았다.
- 두 화면의 renderer 통계는 27 calls / 239,048 pass 포함 triangles / 81,024 visible triangles로 같았다. 이 값은 GPU 성능 측정이나 iPhone FPS가 아니다. 진단 hook의 Scene 탐색/readback 비용도 production 성능에 포함시켜 주장하지 않는다.

## 증거·재현 경계

수정 전 `src/render/index.ts` SHA-256: `a11ec53c568d93db04f51a38a5c1c0e83b198f2f881f9c9e02a0019b6029e874`.

[capture-report.json](capture-report.json)은 before/after source hash 일치, 실제 Scene 속성, shadow readback 요약, PNG SHA-256, browser 오류 0을 담고 있다. source/GLB/capture.ts 해시가 두 장 사이에 같았다. 별도 뷰어 TypeScript 검사를 통과했다. 캡처 세션 `deep-press-shadow-agent`는 종료했다.

`capture.ts`는 캡처 당시의 진단 코드로 보존한다. baseline은 실행 시점 production 값을 변경하지 않으므로, root 수정 이후 다시 실행하면 baseline도 receiveShadow=true가 된다. **원인 비교를 재현하려면 보고서의 수정 전 소스 상태가 필요**하다. [production-before-fix.ts.txt](production-before-fix.ts.txt)에 그 원본을 보존했다. 현재 production 소스에서 root가 추가한 `  bedShadow.receiveShadow = true;` 한 줄만 제거한 바이트열의 SHA-256이 캡처 당시 기록과 정확히 일치함을 확인한 뒤 저장했다. 따라서 추정 재작성본이 아니라 **정확한 해시 대조로 복원한 수정 전 원본**이다. 이 파일은 문서용 보관본이며 production에 덮어쓰지 않았다. 새 실행을 이 PNG들의 수정 전 검증으로 오인하지 않는다.

production 파일·GLB 변경 없음. 추가 유료 생성 없음. 실기기 iPhone 검증 및 GPU 프레임 시간 측정 미실시.
