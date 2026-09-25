# 압착 형상에 맞는 표면 반사

출발 구현은 `238c0c7bbae74ca8557c27e281c155220b7ea229`다. 회수물 외피를 접고 프레스 실린더를 늘리면서 vertex 위치만 바뀌고 표면 normal/tangent는 원래 자세를 유지하던 문제를 수정했다. 압착된 모양과 빛을 받는 방향이 어긋나는 원인이었다.

## 변경

- 금속·보호 외피에는 기존 위치 변형의 미분을 구해 normal을 역전치 변환하고 tangent도 변형한다. 기존 PBR normal map의 미세 표면 표현은 유지한다.
- 프레스 실린더에는 현재 이동량과 높이에 따른 축 방향 기울기를 적용한다. 상단 고정과 하단 강체 이동의 기존 위치 식은 유지한다.
- 렌즈 유리, 카세트 창과 내부 축은 평행 이동하는 강체 표면이므로 원래 표면 방향을 유지한다. 코드에서 게임 판정·압력·손상 값을 새로 계산하지 않는다.
- 모델·텍스처·카메라·조명 설정·공개 API는 변경하지 않았다. 외부 에셋이나 생성 이미지를 새로 추가한 작업이 아니다.

## 실제 GPU 수치 검증

[comparison.json](comparison.json)의 `variants[].numeric`에 WebGL2 transform feedback 결과를 보존했다. 생산용 `deformSpecimen`/`animateRam`이 설치한 실제 GLSL을 실행한다. 실제 GLB의 위치·normal에서 표면 접선 두 방향으로 작은 간격을 이동시킨 점들을 같은 GPU 위치 셰이더로 변형하고, 그 결과의 유한 차분으로 독립적인 표면 방향을 계산해 수정 normal/tangent와 비교한다. JavaScript에 수정 공식을 복제해 자기 자신과 비교한 검사가 아니다.

27가지 부품·압축·손상·램 이동 조합, 총 4,189개 표면 표본을 사용했다. 변경 전 11개 조합이 각도 오차 1° 기준을 실패했고 최대 normal 오차는72.9944°였다. 변경 후 27개 조합 모두 통과했고 최대 normal 오차0.06490°, tangent 오차0.06625° 미만이었다. 정확한 최대 오차와 표본 수는 JSON에 있다. sign 경계와 0/.3/.7/1 높이의 미분 불연속 부근은 제외했으며, 모든 정점이나 물리적으로 정확한 소성 변형을 인증한 것은 아니다.

## 실제 화면과 한계

390×844 desktop Chromium에서 이전/현재 9쌍의 실제 게임 렌더 fixture를 촬영했다. 모든 GLB 로드·소스 전후 해시·브라우저 오류·Three 중복 인스턴스 경고를 확인한다. 정지 자세의 draw27 / 모든 패스 triangles193,194는 그대로다. normal 계산에 GPU 연산이 추가됐으므로 이 카운터만으로 FPS나 전력 사용이 같다고 말하지 않는다. 실제 iPhone 재측정은 아직 하지 않았다.

| 상태 | 이전 | 현재 |
|---|---|---|
| 금속 압착 | [실행 화면](before/03-compressing-salvage-core.png) | [실행 화면](after/03-compressing-salvage-core.png) |
| 카세트 압착 | [실행 화면](before/07-compressing-salvage-cassette.png) | [실행 화면](after/07-compressing-salvage-cassette.png) |
| 보관 | [실행 화면](before/09-stored-salvage-cassette.png) | [실행 화면](after/09-stored-salvage-cassette.png) |

첫 비교 실행은 두 checkout의 `node_modules`를 symlink로 공유해 Vite 캐시가 겹쳤고, `Multiple instances of Three.js` 경고와 의도하지 않은 전체 금속 밝기 변화가 관측됐다. 그 실행은 검증 근거에서 제외했다. 각 checkout에 별도로 `npm ci`를 실행하고 서버를 다시 시작해 재촬영했으며, 재현 검사에는 중복 Three 경고를 실패 조건으로 추가했다. 현재 JSON/PNG는 분리한 환경의 결과다.

전체 아트 목표의 합격은 아직 아니다. [기존 아트 판정](../art-review.md)의 구도·미세 재질·작은 화면 가독성·압착 설득력, [연결 검사](../performance-study/integration/README.md)의 HUD 가림과 보관 외형 복원 계약, 실제 iPhone 성능·초기 GPU 실패 원인은 남아 있다.

## 재현

각 checkout에 독립적인 의존성 설치를 사용한다. 기준 구현을4176, 수정본을4177에서 실행하고, 기준 checkout에도 이 폴더의 `index.html`과 `probe.ts`를 동일하게 복사한다. 공유 계약이나 기준 구현 소스는 바꾸지 않는다.

```sh
node node_modules/typescript/bin/tsc --project docs/handoffs/B/normal-study/tsconfig.json --noEmit
node docs/handoffs/B/normal-study/capture.mjs <baseline-checkout>
```

첫 명령은 수치 검증 페이지의 strict TypeScript 검사이고, 두 번째는 실제 GPU 수치 검사와 전후 화면 촬영이다. `npm run check`의 69테스트와 별도로 실행한다.

이번 수정 후 고정23파일, strict TypeScript, 19모듈 경계, 13파일69테스트, build, B 소유권 검사 모두 통과했다. JS는689.84kB로 Vite500kB 권고 경고는 남는다. A/C를 합친 직전83테스트·GPU재시도 기록은 d9db1df 구현의 이력이며 이번 표면 반사 수정 후의 통합 재검사로 바꿔 말하지 않는다.
