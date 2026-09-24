# B 작업 인계 — DEEP PRESS 렌더링

담당: `letstakeabreak` · 브랜치: `role/b-render` · 기반: `bootstrap-v2` (`c739b527449b2527e46b567bfffbd4a7122f571c`).

최신 보완은 ImageGen 케이스 홈·앞면의 깊이 가림과18mm 안착이다. [36개 배치·GPU 픽셀 증거](layout-study/foreground-report.json), 최신 브라우저·아트 캡처의 소스 SHA로 현재 구현을 식별한다. 직전 전경 이미지·배치 구현은 `68a68ec65a8d72f55bae0ed953febe22c86b0efe`이고, 램 진입 motion report는 `7007b48ff6faa3f1803082e15dd897c2c7b808e2`의 별도 이력이다. 상태는 **검증 가능한 B 구현 / 아트 미달 항목 및 실기기 미검증이 남은 Draft**다.

## 연결 방법

외부에서 404가 보이면 [공개 접근 확인과 정확한 브랜치 주소](repository-access.md)를 먼저 확인한다. B 문서는 아직 `main`이 아니라 `role/b-render`에 있다.

공개 API는 그대로다. C는 자신이 만든 canvas로 `createRenderer({canvas,onFatal})`를 호출하고, 크기 변경 시 `resize`, 매 프레임 immutable `GameSnapshot`과 ms 단위 delta를 `render`에 전달한다. 종료 시 `dispose`한다. B는 DOM·입력·이벤트 큐·점수·부피 규칙을 소유하지 않는다.

- 개발 확인: `npm ci`, `npm run dev` 후 `/docs/handoffs/B/preview.html`.
- 이 페이지는 **RENDER STUDY**다. 8개 상태와 회수품을 직접 설정하는 시각 검증 하네스이며 완성 게임·사용자 테스트가 아니다. 앱/코어 구현을 대체하지 않는다.
- 최종 앱은 `src/render/index.ts`만 import한다. 하네스나 내부 렌더 모듈을 import하지 않는다.
- 모델은 registry의 상대 경로를 `import.meta.env.BASE_URL`과 결합한다. Vite가 `public/assets`를 배포 파일에 복사해야 한다. 원본 master·검사 PNG·하네스는 초기 게임 다운로드 대상이 아니다.
- 4개 모델·배경·계기판 이미지 로딩이 완료되면 canvas의 `data-render-state`가 `ready`가 된다. 이 data 속성은 B 검증용 관찰 값이며 새로운 공개 계약이나 C의 필수 의존성이 아니다. 앱의 로딩 화면 계약 확장이 필요하면 A의 공유 변경 절차로 제안한다.
- WebGL 생성 실패는 `webgl-unavailable`, 모델/렌더/context-loss 실패는 `render-failed`로 한 번 전달한다. C가 오류 안내와 renderer 재생성을 처리한다. 누락 모델을 다른 물체로 대체하지 않는다.

## 상태 해석

`currentSpecimen`은 프레스, 남은 ID는 왼쪽 트레이, 저장된 ID는 오른쪽 케이스에 배치한다. 현재 물건을 남은 목록에서 제외한 순서로 트레이를 채운다. `inspectionYawRad`는 물건의 검사 회전이다. 압착/정착에서는 `pressure01`, 그 밖에는 확정된 `compression01`를 읽는다. 손상 표현은 `1-integrity01`만 읽으며 게임 판정을 계산하지 않는다.

일시정지 snapshot은 즉시 반영한다. 코어가 미확정 압력을 취소했다면 이전 시각 압력을 계속 보여 주지 않는다. 같은 정지 snapshot에는 시간이 흘러도 추가 변형이 없다. 첫 프레임과 재시작은 이전 회차의 시각 압축 상태를 이어받지 않는다. 정상 압착 진입은 접촉 전 형태를 유지하며 램이 0.7m/s로 접근하고, 접촉 후 남은 프레임 시간부터 형태를 보간한다. 기본 3종의 첫 접촉은 16ms 관측 간격에서 144–176ms였다. 이는 시각 지연이며 코어의 압력·정착 시간·판정은 그대로다.

저장된 물건의 압축·손상 수치는 v1 snapshot에 없다. 관찰했던 현재 물건의 마지막 외형만 B 내부에 보존한다. 저장 상태부터 시작하는 fixture/새 renderer에는 압축 0.55, 손상 0의 **시각적 대체값**을 사용한다. 이것은 저장 점수나 실제 보관 상태를 복구한 값이 아니다. 저장 상태의 완전한 복원이 필요하면 A가 계약을 확장해야 한다.

v1의 네 asset ID에 각 한 개의 장면 물체를 대응시킨다. `assetId:null` DEV probe는 표시하지 않는다. asset ID가 있는 entity는 해당 물체의 위치·XYZ 회전·scale을 덮어쓴다. 현재 물건의 접촉 높이는 적용된 transform을 프레스 로컬 공간으로 변환해 계산한다. 같은 asset ID 여러 인스턴스를 요구하는 게임 기능은 현재 PRD 범위 밖이며 공유 계약 결정 없이 추가하지 않는다.

## 그래픽 구성과 한계

- ImageGen으로 만든 고정 작업실 배경 + Meshy 7에서 생성한 실제 3D 프레스/회수품 4종의 **2.5D 장면**이다. 방 전체를 이동 가능한 3D 환경으로 구현한 것이 아니다.
- 배경의 2:3 구도를 유지하며 화면 주변은 배경의 조명색을 따른 어두운 여백으로 채운다. 모바일/가로 화면에서 물체 비율을 늘려 맞추지 않는다.
- PBR 재질, 따뜻한 작업등/약한 청백색 보조광, 좁은 환경 반사, 접촉 그림자를 사용한다. [재질 실험](material-study/README.md) 이후 [환경 반사 비교](reflection-study/README.md)의 balanced 설정(실제 Standard 벽 반사색 ×.35, 왼쪽/전방의 따뜻한 카드)을 채택했다. 카세트 앰버 투명화 실험은 내부 형상을 복원하지 못해 채택하지 않았다. [실제 원본 단면 조사](cassette-structure-study/README.md)에서도 중앙 코어 형상이 없음을 확인했다.
- 카메라를 작업 영역에 가깝게 옮기고 장비 하부를 `Y=.22m` 작업대 아래로 매립한 구도로 표시한다. 이는 GLB를 바꾸지 않는 clipping이며 그림자 패스에도 같은 평면을 적용한다. 기본 선택 물건은 모델 scale 1.1, 트레이 물건은 원래 X폭 최대 .19m로 맞춘다. snapshot entity transform이 있으면 이 기본 배치를 덮어쓴다.
- 케이스는 배경의 실제 홈을 측정한 중심·앞뒤 방향으로 물건을 눕히고 변형된 중심을 맞춘다. [배치·깊이 측정](layout-study/README.md)을 따라 보이지 않는72삼각형 depth 형상을 만들고 보관물을18mm 내렸다. 홈·앞면 뒤의 조각을 가리지만 보이는 케이스는 원본 이미지다. 움직일 수 있는 가시3D케이스·물리 수납을 구현한 것은 아니다. ImageGen의 전경 케이스 편집본을 사용해 세 홈을 모두 이미지 안으로 옮겼고 보관 scale을 .52에서 .7로 키웠다. [편집 원본·프롬프트·해시](../../../assets/source/environment/case-layout-provenance.json)에 채택하지 않은 안도 보존했다.
- 프레스는 `press-frame`/`press-ram`으로 분리했다. 플랜지는 움직이고 실린더 상단은 붙어 있는 상태를 유지한다. 검사/대기에서는 90mm 후퇴해 공간을 열고 압착·정착은 접근 뒤 접촉 상면을 따른다. [후퇴·진입 조사](retraction-study/README.md)는 404개 상단 정점의 고정 및 생성 자산의 하우징 교차 한계를 기록한다. [접촉 조사](contact-study/README.md)에서 과거 높이 측정 오류를 확인해 실제 상면 raycast로 수정했다. 선택 물건 base Y는 .3782m이며 `ram.ts`와 재생성 파이프라인의 값을 교차 검사한다. 받침의 ShadowMaterial에 그림자 수신이 꺼져 있던 누락도 수정했다. [GPU 원인 분리](shadow-study/README.md)는 한 설정만 바꾼 실제 전후 비교다.
- 금속/복합재는 보호 부분이 접히는 authored shader 변형, 렌즈는 분리된 유리 면의 강체 이동과 보호 프레임 변형이다. 유리 손상은 균열·거칠기·투과 감소와 심한 손상에서 빠진 조각으로 읽는다. 손상은 오직 snapshot의 확정 무결성을 따른다. 이 표현은 물성/파괴 시뮬레이션이 아니다.
- 계기판은 ImageGen으로 별도 생성한 바늘 없는 눈금판을 기존 금속 테두리 뒤에 장착했다. 원본의 고정 바늘은 가려지며 기능 바늘은 `snapshot.pressure01`에 따라 왼쪽(0) → 위(0.5) → 오른쪽(1)으로 움직인다. 일시정지·첫 프레임도 즉시 동기화한다. 숫자 HUD는 여전히 C의 책임이다. [원본/프롬프트/변환 기록](../../../assets/source/gauge/provenance.json), [실측 좌표](gauge-calibration.json).
- 오디오 없음. Meshy 인증·키 공유 없음. 외부 모델/음원/재질 팩 없음.

## 검증 및 머지

`npm run check`, `npm run ownership -- --role B`, `node docs/handoffs/B/check-preview.mjs`, `node docs/handoffs/B/browser-check.mjs`를 사용한다. 브라우저 검사 중 파일을 수정하면 시작/종료 해시가 달라져 통과 증거로 쓰지 않는다.

[renderer 검증 범위](evidence/renderer-validation.md), [5개 목표별 시각 판정](art-review.md), [모델 최적화](asset-pipeline.md), 최종 GPU/기기 기록을 함께 확인한다. 목표별 실행 캡처가 존재하는 것과 목표 품질을 충족한 것은 다르다. 이번 보완에서 작업 영역 크기·받침 접촉·램 진입·보관물 잘림을 개선했다. 목표와 다른 카메라/케이스 구도, 작은 화면의 손상 식별과 원본의 재질 세부에는 미달 항목이 남아 있다. 320×568과 130px B 패널 사이 여유는 가림 전 geometry bounds 기준 최소5.60px로 좁다. C는 실제 HUD/safe-area로 확인하고 필요하면 canvas 표시 영역을 조작부 위로 확보해야 한다. 새 계약은 요구하지 않는다. `generated-unverified`는 실제 iPhone 품질·성능 검사가 끝나기 전까지 유지한다. 데스크톱 Chromium의 프레임 수치, fixture 화면, 정적 해시 검사는 실제 iPhone Safari의 3분 플레이 합격을 대신하지 않는다.

A는 `integration/v1` 후보에 이 브랜치의 고정 commit을 다른 역할과 함께 반영하고, 전체 게임의 압착→정착→보관→실패/정산→재시작을 검증한다. B 브랜치는 공유 타입·앱/코어·의존성·main을 수정하지 않는다. 시각 하네스만 작동하는 상태를 게임 완성으로 기록하지 않는다.

## 현재 배포 산출물 크기

B 반영 후 `npm run build` 산출물은 **10,238,002 bytes**(압축 전 파일 합계)다. 이 중 모델 8,956,848 bytes, 현재 배경 WebP 223,350 bytes(과거 독립 조사용 285,686 bytes 파일도 dist에 보존), 계기판 WebP 90,242 bytes이며 JS는 674,291 bytes(gzip 약173.78kB)다. 20MB 초기 예산 이내다. Vite는 JS 단일 chunk 500kB 초과 경고를 남기지만 빌드는 성공했다. 공유 설정/의존성 변경은 하지 않았다. A/C 최종 통합 후 다시 측정해야 한다.

[macOS Safari 관찰](evidence/safari-desktop.md)은 이전 게이지 보완 revision의 기록이며 현재 램/반사 변경 뒤 Safari를 재검사한 결과가 아니다. [데스크톱 3분 측정](evidence/desktop-soak.json)도 실제 iPhone 검증과 구분한다.

남은 [실제 iPhone 검증 절차](device-acceptance.md)는 준비 문서이며 측정 결과가 아니다.

## A가 통합할 때 갱신할 공동 상태

bootstrap 시점에 동결된 공통 문서에는 런타임 placeholder 상태가 남아 있다. 이 브랜치의 최신 상태는 `src/render/assets.ts`와 위 B 증거다. A는 통합 시 공유 변경 절차로 팀 상태/컨텍스트를 갱신하고 B의 실제 iPhone 검증 미완료 및 게임 루프 미검증을 함께 남긴다. B는 자기 브랜치에서 공통 문서를 임의로 바꾸지 않았다.
