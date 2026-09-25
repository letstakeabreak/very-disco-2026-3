# 금속 반사·앰버 재질 독립 실험

검증 캡처 시각: `2026-09-24T13:49:44.950Z`. 이 폴더는 해당 시점의 **독립 실험 기록**이며 이후 production 화면을 대표하지 않는다. production 코드와 GLB는 수정하지 않았다. ImageGen/Meshy 추가 호출 없음. 기존 생성 모델을 그대로 불러와 실제 Three.js/WebGL 화면 6장을 비교했다. 물리 시뮬레이션·모바일 성능·최종 포토리얼 품질 완료를 뜻하지 않는다.

## 결론

- **최종 추천 A: 조명/반사 대비와 프레스 roughness factor 0.72로 적용 범위를 한정.** 청록색 기운이 줄고 하단 금속 모서리의 밝고 어두운 대비가 나아졌다. 모델이나 draw call을 늘리지 않지만 원본 ImageGen의 선명한 강철 표면까지 복원하지는 못한다. 전체 게임 조명에 이식할 때 카세트·렌즈와 배경까지 다시 확인해야 한다.
- **B: 카세트 앰버 부분의 비금속·clearcoat 보정은 실험용으로 남긴다.** 금속 금색 느낌이 약해지는 대신 불투명 플라스틱/흐린 호박색 표면에 가까워졌다. transmission 0.45를 더해도 참조의 내부 부품과 투명한 유리관이 재현되지 않았다. 비용까지 늘어 이번 실험만으로 production 채택을 권하지 않는다. 실제 게임에서는 기존 deformation의 `onBeforeCompile`과도 합성해야 하므로 이 독립 실험 shader를 그대로 덮어쓰면 안 된다.
- 문제를 MR 리베이크 손실이나 색 공간 오류로 설명할 근거가 없다. 카세트 앰버는 **Meshy 원본부터 금속성이 높고 OPAQUE**였다. 조명만으로 참조와 같은 투명 구조가 생기지는 않는다.

## 원본과 실제 PBR 데이터

참조: [03 ImageGen](../../../art/concepts/03-salvage-cassette-reference.png), [04 ImageGen](../../../art/concepts/04-press-chamber-reference.png).

03은 밝은 앰버 유리를 통해 내부 선형 부품이 읽힌다. 현재 GLB는 흰 보호대·검은 프레임은 읽히지만 중심부가 금색 불투명 원통처럼 보인다. 04는 검은 강철에 강한 좁은 반사광이 있다. 기존 뷰어는 넓은 상판·받침의 회색 톤이 평평하고 금속 모서리 반사가 약하다.

MR 중앙값, `source → runtime`:

| 자산 | roughness G | metalness B |
|---|---:|---:|
| press-chamber | 0.369 → 0.373 | 0.690 → 0.694 |
| salvage-cassette | 0.471 → 0.471 | 0.235 → 0.251 |
| salvage-core | 0.498 → 0.498 | 0.157 → 0.169 |
| salvage-lens | 0.455 → 0.455 | 0.008 → 0.035 |

카세트 앰버 색상 표본 영역에서 roughness 중앙값은 0.216 → 0.216, metalness는 **0.722 → 0.702**다. 전체 표면 표본의 약 11.55% → 11.83%가 이 색상 조건에 해당한다. 색상 조건은 `R > 1.28G`, `G > 1.3B`, `R > 0.30`으로, 의미 기반 파트 분류가 아니며 녹/황동 일부가 포함될 수 있다.

모든 원본/런타임 GLB는 검사한 material 슬롯에서 OPAQUE, transmission 확장 없음. 원본 material factor는 baseColor=[1,1,1,1], roughness=1, metalness=1이다. 런타임은 factor를 생략해 glTF 기본값 1을 사용한다. 즉 표의 차이를 factor 차이로 볼 수 없다. 렌즈는 이후 production renderer에서 유리 재질로 교체하므로 이 표는 **GLB 내장 재질 비교**이며 최종 렌즈 화면 재질을 뜻하지 않는다.

브라우저에서 실제 로드된 값도 base color `colorSpace='srgb'`, MR `colorSpace=''`(NoColorSpace), roughness=1, metalness=1이었다. color map을 sRGB → linear로 읽고 MR G/B를 선형 데이터로 읽는 경로가 유지된다. output=sRGB, tone mapping=ACES, exposure=0.95를 모든 비교에서 고정했다. MR에 sRGB를 덮어씌우는 수정은 하지 않았다.

원시 통계·정규화 전 히스토그램·이미지 크기·SHA-256: [pbr-analysis.json](pbr-analysis.json). [analyze.py](analyze.py)는 primitive마다 삼각형 면적에 비례한 50,000개 barycentric 표본을 고정 seed 426으로 추출하고, UV로 실제 텍스처를 샘플링한다. 검은 atlas 빈칸을 전체 표면으로 세지 않는다. 히스토그램 값은 면적 가중치여서 자산 사이에는 각 `histogramWeightTotal`로 나눠야 한다. source/runtime 절대 크기가 달라 원시 bin 합을 서로 직접 비교하면 안 된다.

## A — 프레스의 반사 대비

동일 카메라·모델·배경·노출에서 다음을 묶어 시험했다. 이는 최적값 탐색이나 개별 변수 인과분해가 아니라 작고 재현 가능한 후보 조합이다.

- 프레스 roughness factor 1 → 0.72. 텍스처 중앙값 0.373 기준 약 0.268이 된다. metalness와 base color는 유지.
- material envMapIntensity 0.75 → 1.35, scene environmentIntensity 0.75 → 1.
- Ambient 0.35 → 0.12, key 3.2 → 2.6, rim 2.3 → 1.2, fill 0.8 → 0.3. 청록 rim을 약한 청백색으로 바꿈.
- 실제 Three r186에서 바뀐 것은 기존 RoomEnvironment 발광 패널의 색·폭(45%)과 PMREM blur sigma 0.06 → 0.02다. 코드의 비발광 벽 색 변경 분기는 적용되지 않았다. 이 버전의 벽은 MeshStandardMaterial인데 실험 hook은 MeshLambertMaterial만 처리하기 때문이다. 조명용 환경이며 모델 내부나 가짜 부품을 추가한 것이 아니다.

[기존 프레스](captures/press-baseline.png) / [A 프레스](captures/press-reflection.png)

관찰: 받침·볼트·실린더 경계가 더 중립적인 강철색으로 읽힌다. 넓은 상판은 여전히 균일한 회색에 가깝다. 거칠기를 더 낮추면 마모된 검은 강철이 과하게 광택 있는 금속으로 보이거나 기존 노멀/텍스처 잡티가 강조될 수 있다. A를 카세트에 같은 조명으로 적용한 [대조 화면](captures/cassette-reflection.png)에서는 중심부의 금색 불투명성 자체는 해결되지 않았다.

## B — 앰버만 비금속 처리

카세트는 하나의 mesh/material에 중심부와 보호 프레임이 함께 들어 있다. 기존 baseColor의 앰버 색상 조건과 기존 local X 중심 범위의 부드러운 마스크를 결합했다. 동일 생성 geometry·PBR texture를 유지하고 shader에서 선택 영역만 metalness→0, roughness→0.12, clearcoat=1/roughness=0.08, IOR=1.48로 시험했다. 나머지 프레임은 기존 재질값을 유지한다. 이 마스크는 수작업 의미 라벨이 아니므로 최종 아트 분할을 대신하지 않는다.

[기존 카세트](captures/cassette-baseline.png) / [B 불투명 clearcoat](captures/cassette-amber-opaque.png) / [B transmission 0.45](captures/cassette-amber.png)

관찰: clearcoat만 적용해도 금속 반사 색은 줄지만 중앙면은 밝고 평평한 호박색으로 남는다. transmission 0.45 / thickness 0.018은 화면에 약한 흐림을 더할 뿐, ImageGen의 유리관 내부 디테일을 드러내지 못했다. 유리와 내부 부품이 별도 opaque draw로 구성되어 있지 않은 현 재질/구조에서 whole-material transmission을 켜는 방식은 불필요한 추가 pass를 발생시킨다. 새 내부 primitive를 만들어 참조처럼 보이게 속이는 대체는 하지 않았다.

투명 구조를 충실히 회복하려면 기존 생성 mesh에 실제로 존재하는 표면을 의미에 맞게 분리하고 내부 구조가 표현되어 있는지 확인하는 추가 아트 작업이 필요하다. 이번 결과로 원본 모델에 없는 내부 구조를 있다고 단정하지 않는다.

## 실제 검증 범위

- 데스크톱 Chromium, 실제 WebGL. 1000×1000, 각 자산의 동일 카메라 방향·bounds fit, 같은 ACES/exposure/background.
- 6장 모두 ready, browser page errors / console errors 없음. [capture-report.json](capture-report.json)에 화면·원본 코드/GLB 해시, 실제 material 값과 메모리 통계 기록. 캡처 전후 해시 일치.
- 프레스 baseline/A: 각각 9 renderer calls / 86,022 renderer triangles / 8 GPU textures.
- 카세트 baseline/A/B 불투명: 각각 3 calls / 30,002 triangles / 7 textures.
- 카세트 B transmission: 4 calls / 45,002 triangles / 8 textures. 같은 GLB지만 추가 렌더 패스로 통계가 증가한다. 이 수치는 렌더러가 실제 보고한 pass 포함 값이며 GLB 원본 삼각형 개수나 iPhone FPS가 아니다.
- 독립 문서 뷰어 TypeScript 검사 통과. production 코드, 모델 geometry, GLB, 공유파일 수정 없음. 게임 상태·판정·physics 미검증. iPhone Safari 실기기 성능 미검증.

재현: 실행 중인 Vite에서 `/docs/handoffs/B/material-study/capture.html?asset=press&variant=reflection` 또는 `?asset=cassette&variant=amber-opaque`. baseline/reflection/amber/amber-opaque를 쿼리로 선택할 수 있다. 캡처 스크립트는 `node docs/handoffs/B/material-study/capture.mjs`이며 자신의 agent-browser 세션을 열고 닫는다.
