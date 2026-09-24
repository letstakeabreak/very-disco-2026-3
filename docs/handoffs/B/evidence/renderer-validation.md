# B renderer 검증 기록

## 2026-09-25 — 케이스 깊이 가림과 안착 (현재)

원본 ImageGen plate와 네 Meshy GLB는 그대로 두고 폼 입구·아래쪽 벽을 가리는72삼각형 depth-only 형상을 추가했다. 보관물은18mm 내려 놓는다. 픽셀 기반 폼 경계는 같은 카메라의 작업대 평면에 역투영하며160mm 아래쪽 깊이는 아트 설정이다. 가시3D케이스나 물리 수납 모델이 아니다.

[36개 배치](../layout-study/foreground-report.json)의 실제 GPU 비교에서 같은 보관 높이의 depth 켜기/끄기/빈 케이스를 비교했다. 앞면 지정 영역 누출10,446→0픽셀, 케이스 밖 변화0, 각 홈의 가시 물건 최소514픽셀이다. RGB차이>3/255 기준이며 CPUbounds 판정과 구분한다. 가림 전 정점을 포함한 수평 여유 최소13.84px, B130px패널 여유 최소5.60px. C HUD/safe-area·실제iPhone은 미검증이다.

- npm run check: 고정23파일, strictTS,16모듈 경계,10파일57테스트, build 통과. 새 테스트는 실제 Three raycast로 폼/세 열린 홈을 구분하고 depth 자원 해제를 확인한다.
- 공개 renderer 캡처11장 및 browser-check의3화면/8상태/9물건조합 통과. 대표 장면 visibleTriangles81,096 (가시 flag가 켜진 depth-only72포함), 여러 패스 합계239,192, draw29.
- preview·art-viewer·foreground study strictTS 통과. 아트 갤러리5목표/35판정/16이미지/3모드/390·320 확인. 아트 미달 판정은 유지한다.
- dist10,238,002bytes, JS674,291bytes/gzip173.78kB. Vite500kB경고가 남는다.
- 최신 index.ts SHA256: e591083e8d27ed08296aed4a4bb98e2fa260999e2d438eabf19686a1d619277e
- case-depth.ts SHA256: 51b79a57c7e203051cf6fdf7dcf87c9b77499c4cbfbd67b58af18e49351d6835

[최신 데스크톱 측정](desktop-soak.json): 2026-09-25 01:10 KST 시작, HMR 없는 정적 B 하네스에서 180.013초, 10,802 rAF 표본, 평균60.0069 FPS / P95 16.7ms / max16.8ms / 오류0. AppleM5/Chromium153, CSS390×844/DPR2/버퍼780×1688. 이전 GPU 검사 브라우저를 닫은 뒤 별도로 실행했고14개 source/asset SHA는 전후 일치했다. 실제iPhone·입력 지연·통제된 시스템 부하 시험은 아니다. 이전 케이스 측정은 [별도 이력](desktop-soak-20260924T154438.json)에 보존했다. 아래 전경 케이스·램 보완 부분은 당시 이력이다.

## 2026-09-25 전경 보관함과 화면 잘림 보완

ImageGen으로 작업실 케이스를 전경으로 옮겼다. v2/v3는 프레스와 겹쳐 기각하고 v4를 runtime WebP로 인코딩했다. 원본·각 프롬프트·연쇄 입력과 출력 SHA는 `assets/source/environment/case-layout-provenance.json`에 있다. 현재 배경223,350bytes/1024×1536. 기존 workshop.webp는 이전 연구 뷰어를 위해 보존하므로 dist 총량은10,225,516bytes이며 실제 renderer는 v4 하나만 로드한다. 네 GLB/PBR 및 shared23파일은 변하지 않았다.

공개 renderer의 6개 보관 순서×압축0/.55/1×두 화면=36조합을 검사했다. 실제 GLB 정점의 authored deformation을 CPU에서도 투영해 물건 수평 겹침0·화면 밖 잘림0을 확인했다. 최종 scale .7에서 최소 수평 간격13.87px, B의130px 패널까지10.88px. .9 후보는 자동 경계 검사는 통과했지만 실제 canonical 캡처에서 앞 테두리 돌출이 과해 채택하지 않았다. [기각 기록](../layout-study/foreground-report-scale09.json)과 [최종 기록](../layout-study/foreground-report.json)을 구분한다. 케이스 벽의 실제 깊이·가림은 구현하지 않았으며 완전한 3D 안착을 검증한 것은 아니다.

최종 `npm run check`: frozen23·TS·모듈 경계·56개 테스트·build 통과. 새 홈 측정으로 기존 중심 정렬 회귀를 갱신하고 세 번째 홈의 전체 좌표도 이미지 내부인지 확인했다. 새 case viewer strict typecheck, preview/art typecheck도 통과했다. 5개 목표 대응11장 및 정적 갤러리5목표/35판정/16이미지/3보기 검사 통과. 직접 관찰한 결과와 미달 이유는 `art-review.md`에 기록한다.

새 배경/scale의 일반 브라우저 검사는320×568,390×844,1440×900과8상태·9물건/상태 조합이다. 오류0, 검사 전후 source SHA 동일. C의 HUD/safe-area나 실제 장치 검증은 아니다. 등록된 실제 iPhone3종은 이번 턴 재조회에서도 모두 unavailable이어서 실기기 검사를 실행하지 못했다. 기기 사용자 이름과 식별자는 저장하지 않는다.

최종 3분 측정 시작 `2026-09-24T15:44:38.106Z`: **PASS**. 180.013초,10,799 rAF 표본,평균59.9901FPS/P95 16.8ms/max33.5ms/오류0. 390×844 CSS,DPR2,buffer780×1688,Apple M5/Chromium153. 다른 QA 브라우저를 닫은 뒤 HMR 없는 정적 하네스로 실행했다. 일반 시스템 부하까지 통제한 시험은 아니며 실제 iPhone 증거가 아니다. [전체 측정](desktop-soak.json)의 시작/끝 production 소스·자산 SHA를 현재 파일과 대조했다. 이전 램 진입 측정은 별도 JSON으로 보존했다.

## 이전 구현의 검증 이력

아래 날짜별 기록은 당시 revision의 증거이며 최신 결과로 합쳐 해석하지 않는다.

2026-09-24, 계약 1.0.0, `role/b-render`. 출발 `bootstrap-v2`의 annotated tag object는 `ba2f00e700c04402cfa6574c4db9cf5ab0d7c2a0`, 실제 공통 출발 commit (`bootstrap-v2^{commit}`)은 `c739b527449b2527e46b567bfffbd4a7122f571c`다. B 소유 범위에서 구현·테스트·하네스를 작성했고 A core, C app, 공유 고정 파일은 수정하지 않았다. 기여 대상은 integration/v1의 Draft PR #1이다.

## 테스트가 확인하는 범위

```sh
npx vitest run tests/render
npm run typecheck
node docs/handoffs/B/check-preview.mjs
npm run ownership -- --role B --base bootstrap-v2
node docs/handoffs/B/browser-check.mjs
```

- `fixtures.test.ts`: 공유 frozen fixture 8개 소비, 압력/확정 압축/무결성 구분, paused resume 상태, 보관 순서, 폐기 숨김, 선택 후 트레이 빈칸 제거, frame delta 유효성.
- `resources.test.ts`: 실제 Three.js geometry/material/texture의 공유 참조를 한 번씩 해제하고 공유 ImageBitmap을 한 번만 닫는다.
- `ram.test.ts`: 실제 GLB 정점 높이 순서와 고정 상단/강체 하부, 후퇴량의 양의 미분 한계, 색상·그림자 uniform 공유를 검사한다. 프레임과의 무충돌 증거는 아니다.
- `lifecycle.test.ts`: WebGL/파일 IO만 대체한다. 실제 scene graph·재질·변형 코드로 GPU 초기화 실패, GLB 실패, dispose 뒤 늦게 도착한 GLB/texture 해제, 반복 dispose, 8개 fixture 불변성, DPR 제한, pause 취소 시 확정 형태 즉시 복원, 첫 paused settling 프레임, 재시작 시 이전 보관 형태 제거, context loss와 draw 실패를 검사한다. 프레스 위치·회전·scale을 바꿔도 접촉 거리가 프레스 공간에서 유지되고, specimen entity를 3cm 올리면 ram travel이 3cm 줄어드는 회귀를 포함한다.
- `assets.test.ts`: registry의 generated-unverified 상태와 미완료 verification을 유지한다. 원본/프롬프트 경로, Meshy 7 task ID, 실제 GLB 2 헤더·길이·SHA·self-contained 리소스, 준비 보고서의 triangle/파일 크기, 런타임 texture 최대 2K를 대조한다. 이 검사는 생성 서비스 사실·시각 완성도·기기 적합성을 새로 인증하지 않는다.

GPU 품질은 CPU 테스트로 승인하지 않는다. 부피·점수·손상 계산은 A의 책임이며 위 테스트에서 게임 공식을 복제하지 않는다.

구도·접촉 보완 후 renderer 테스트 **39개 통과**, 전체 테스트 **50개 통과**. 계기판 로딩 대기, 실패 1회 통지, 늦게 도착한 텍스처 및 정상 텍스처의 해제, 바늘 geometry의 실제 방향, 첫 일시정지·정지 유지·취소 복원 검증 5개를 추가했다. 이번에는 저장 이력 유지, 실제 배경 홈 안의 중심 배치와 entity 우선 적용/복원, Three.js 실제 그림자 재질 경로의 clipping 전달·해제 검사를 추가했다. ShadowMaterial 수신 설정을 검사해 받침의 false 누락을 먼저 재현하고 true 수정 후 통과했다. 공통 typecheck·하네스 독립 typecheck·B 소유권·diff 공백 검사 통과. generated-unverified registry 네 항목과 최종 런타임/준비 보고서 해시를 대조했다.

## 실제 브라우저 증거

[runtime-browser-check.json](runtime-browser-check.json)의 `passed`와 `failure`가 자동 검증의 기준이다. 캡처가 있어도 중도 실패한 실행일 수 있다. 검사 중 파일이 바뀌면 전체 결과를 실패로 기록한다. report의 시작/끝 SHA 목록으로 실제 검사한 렌더러와 GLB를 식별한다.

브라우저 하네스는 실제 WebGL과 GLB 4개를 사용하고, 390×844 및 1440×900, 네이티브 select/range 이벤트, 8개 phase, 세 회수품의 검사/압축/파손 9개 조합을 실행한다. 상단 50px, 하단 130px, 가로 overflow 없음, 오류 없음, immutable snapshot을 검사한다. 파일명 `runtime-phase-*.png`, `runtime-salvage-*.png`는 실제 하네스 캡처이며 완성 게임 플레이 장면이 아니다.

`visibleTriangles`는 visible flag가 켜진 mesh의 triangle 합계이며 작업대 clipping에 가려진 삼각형도 포함한다. `triangles`는 그림자·투과 등 모든 렌더 패스를 합친 Three.js 카운터이며 둘을 같은 예산과 비교하지 않는다. `drawCalls`는 해당 프레임 렌더 패스들의 호출 수다. FPS/P95는 viewport별로 안정화 후 약 120개 rAF 프레임을 모은 desktop Chromium 표본이며 GPU 작업 시간이나 실제 iPhone 성능이 아니다.

## 최종 자동·시각 결과

최종 실행 시작 **2026-09-24 23:35:15 KST** (`2026-09-24T14:35:15.453Z`). 가까운 카메라·작업대 매립 clipping·케이스 홈 정렬·실제 상면 anchor·받침 그림자 수신·검사 램 90mm 후퇴·balanced 환경 반사 보정을 포함했다. `passed: true`, GLB 4개 ready, 실제 select와 네 range의 키보드 이벤트 통과, 두 viewport 배치 통과, 8개 phase와 9개 specimen 조합 통과, probe/browser 오류 0. 렌더러·GLB·배경·계기판 파일의 검사 시작/끝 SHA가 동일하다. 검사 전용 Chromium 세션은 종료했다.

| viewport | DPR | 표본 | FPS | P95 | visibleTriangles | triangles 전체 패스 | draw calls |
|---|---:|---:|---:|---:|---:|---:|---:|
| 390×844 | 1 | 120 frames / 119 intervals | 60.001 | 16.7ms | 81,024 | 239,048 | 27 |
| 1440×900 | 1 | 120 frames / 119 intervals | 60.004 | 16.7ms | 81,024 | 239,048 | 27 |

위 수치는 약 2초의 **desktop Chromium, DPR 1** 표본이다. 모든 패스 239,048과 고유 visible triangles 81,024를 구분한다. 이 기록은 실기기 3분 성능 조건을 대체하지 않는다.

실제 캡처를 열어 확인한 사항:

- [390×844](runtime-390x844.png)와 [1440×900](runtime-1440x900.png)에서 금속·광학 렌즈·카세트·작업대가 로드된다. 넓은 화면 외곽에는 트레이/케이스 복제 없이 어두운 배경이 보인다.
- [complete](runtime-phase-complete.png): 세 보관물이 배경 홈의 앞뒤 방향으로 놓인다. 마지막 홈과 물건 일부는 오른쪽 경계에 잘리므로 세 물건 전체가 화면 안에 들어온다고 판정하지 않는다. 케이스의 깊이·가림 geometry는 없다.
- [정상 렌즈](runtime-salvage-lens-inspecting.png)와 [파손 렌즈](runtime-salvage-lens-failed.png): 균열·하우징 어두워짐에 더해 심한 손상에서 조각이 빠진 실루엣을 표시한다. 이전의 온전한 원판처럼 보이던 문제는 줄었지만 디스크 자체가 작고 전체 모바일 상태 가독성에는 미달 항목이 남아 있다.
- 압력계는 바늘 없는 ImageGen 원본과 실제 기능 바늘을 사용한다. 0/50/100%의 왼쪽/위/오른쪽, pause 즉시 반영, 기존 바늘 가림을 확인했다. 계기판은 24 triangles를 더하며 총 draw calls 27은 예산 80 이내다.
- [idle](runtime-phase-idle.png): 세 번째 slot을 왼쪽 트레이 앞쪽으로 옮긴 최종 캡처에서 코어·렌즈·카세트가 모두 선명하게 보인다. 초기의 프레스 뒤 가림은 수정됐다. inspecting의 두 대기 물건도 트레이 순서 압축으로 잘 보인다.
- paused, compressing, settling, stored를 포함한 8장에는 검은 화면·누락 모델·UI의 작업대 가림이 관찰되지 않았다. 이미지 비교는 실제 입력이나 게임 판정 검증과 다르다.

초기 중도 실패 뒤 최종 파일로 전체 재실행하여 위 결과를 얻었다. 최초 개발용 placeholder 기록은 별도 `preview-browser-check.json`에 보존되어 있다.

[5개 목표 비교](../art-review.md)에는 원본과 같은 출력 크기의 실제 WebGL 캡처 및 390/320px 캡처 총 11장, 7항목별 판정이 있다. 이번 보완에서 물건 크기·받침 접촉·홈 방향은 개선됐지만 목표와의 구도·오른쪽 홈 일부 잘림·작은 화면 상태 가독성 등에는 **미달**이 남는다. 캡처 수집 및 자동 검사의 PASS를 아트 전체 합격으로 확대하지 않는다.

실제 iPhone Safari, 3분 성능, touch/cancel 전체 입력, A/C와 연결된 게임 루프, 대회 제출 경로는 이 독립 렌더 작업에서 검증하지 않았다.

## 데스크톱 3분 연속 측정

이전 구도/접촉 그림자 보완 revision에서 개발 서버로 시도한 두 측정은 [61초 뒤 제어 명령 실패](desktop-soak-interrupted-20260924T140256.json), [122초 뒤 측정 상태 소실](desktop-soak-interrupted-20260924T140634.json)로 실패했다. 두 번째 오류는 `window.__soak`가 undefined라는 실제 응답까지 보존했다. 두 실행의 마지막 표본에는 렌더러 오류가 없었지만 3분 완료가 아니므로 통과로 사용하지 않는다. 문서 뷰어 수정 때 개발 서버의 full reload가 전파된 것으로 추정하며 해당 원인을 직접 계측해 확정한 것은 아니다.

재측정은 HMR 없는 별도 production 하네스 빌드와 로컬 정적 서버에서 실행한다. [정적 빌드 manifest](static-preview-build.json)에 각 입력·출력 파일의 SHA를 남겼다. 이는 공개 B renderer를 사용하는 fixture 하네스이며 최종 A/C 앱이 아니다. `base: '/'`는 이 로컬 QA 주소 전용이므로 itch.io의 상대 경로 배포 검증으로 해석하지 않는다. 명령은 `node docs/handoffs/B/soak-check.mjs http://127.0.0.1:4174`다.

재현 시 먼저 `node docs/handoffs/B/build-static-preview.mjs`로 빌드하고 `npx vite preview --outDir /tmp/deep-press-b-static-preview --host 127.0.0.1 --port 4174 --strictPort`로 정적 서버를 연다. 이번 측정 전 빌드는 해당 파일을 실제 실행해 생성했다. 3분 측정 중에는 해당 출력 디렉터리를 재빌드하지 않는다. 기본 측정 주소도 개발 서버 대신 4174로 고정했다.

`soak-check.mjs` 이전 실행 시작 `2026-09-24T14:35:14.297Z`: **PASS**, 정적 production 하네스에서 180.007초, 10,801 rAF 표본, 평균 60.003 FPS, P95 16.7ms, max 16.8ms, 오류 0. 390×844 CSS pixels / DPR2 / framebuffer780×1688. HeadlessChrome153 / ANGLE Metal Apple M5. 검사·압착·파손·보관·완료·정지 fixture를 30초 간격으로 바꿨다. 시작/끝 renderer·GLB·배경·계기판 SHA 동일. 이 값은 **데스크톱 rAF 간격**이며 실제 iPhone13 Safari 또는 GPU 실행시간/터치지연 보증이 아니다. [이전 전체 기록](desktop-soak-20260924T143514.json).

root의 전체 `npm run check`: 10개 파일 **54 tests** 통과, frozen23파일일치, TS/모듈경계/build통과. B ownership과diff검사통과. [Mac Safari 별도 UI 관찰](safari-desktop.md)은 이전 게이지 revision에서 일반 프로필의 원인 미확정 Script error, 별도 임시 창의 정상 조작·빈 콘솔을 모두 기록했다. 현재 램/반사 보완 뒤 Safari를 재검사한 결과는 아니다. 23:35 KST의 Xcode 실제 기기 목록에는 모든 iPhone이 offline으로 표시되어 실기기 검증을 실행하지 못했다.

이전 성공한 3분 측정은 `desktop-soak-20260924T141112.json`에 보존했다. 이번 3분 측정 초반에는 별도 데스크톱 브라우저 검사가 병행되어 완전히 격리된 부하 측정이 아니다. 그래도 전체 관측 10,801프레임의 최대 간격은 16.8ms였으며 이 수치를 실제 iPhone 성능으로 확대하지 않는다.

램 검사 위치와 취소/재시작 동기화 회귀 테스트는 기존 target=0 구현에서 실패하고 수정 후 통과했다. [램 geometry 조사](../retraction-study/README.md)는 90mm 후퇴에서 상단 고정과 교차 한계를, [환경 반사 비교](../reflection-study/README.md)는 선택한 조명을 기록한다. 위 2026-09-24 revision의 즉시 접촉 이동은 아래 진입 애니메이션으로 대체했다.

## 2026-09-25 접촉 진입 보완

프레스는 물건에 닿기 전 0.7m/s로 이동하고, 접근 중 기존 형태를 보존한다. 남은 프레임 시간만 압축에 사용해 공중 변형을 막는다. 첫 snapshot과 pause 취소는 즉시 authoritative 형태를 반영한다. lifecycle 회귀에서 기존 구현의 즉각 이동/공중 압축 기대값 3개가 실패한 뒤 수정 후 통과했다. 10/30/60/120Hz 분할에서 같은 300ms 후 위치·압축을 대조하고 0ms, 짧은 release/settling, 취소 후 재진입을 확인했다.

`npm run check`는 frozen23·TS·15개 파일 모듈 경계·**10개 파일 56개 테스트**·build 통과. 마지막 테스트의 30Hz 비교 추가 뒤 해당 21개 lifecycle 테스트를 재실행해 통과했다. 하네스/새 motion viewer의 strict typecheck 및 B 소유권·diff 공백 검사도 통과했다. 현재 dist 10,002,161 bytes / JS667,948 bytes(gzip171.70kB), 기존 chunk500kB 경고 유지.

[실제 production renderer의 motion report](../retraction-study/motion-report.json)는 세 물건 각각 31 프레임, 390×844/DPR1, immutable fixture와 실제 GLB를 사용한다. 기존 shader uniform을 관찰하고 GLB의 모든 정점에 수직 shader 변형을 적용해 상하 간격을 측정했다. 16ms 단위 첫 접촉은 카세트176ms / 코어·렌즈144ms, 접근 중 압축0, 최소 간격0m, 오류0. 6개 카세트 GPU 캡처 중 0/96/320ms를 직접 대조했다. 하우징 교차·콘셉트 미달은 남아 있고, 이 수직 간격 측정은 임의 transform의 완전한 3D 충돌 인증이 아니다.

최신 `runtime-browser-check.json`은 새 production 소스를 정적으로 빌드한 뒤 재실행했다. 두 화면 크기·8상태·9물건/상태 조합·select/range 이벤트·4개 GLB 로드·immutable snapshot·오류0 확인, 검사 시작/끝 소스 SHA 일치. 5개 아트 목표의 이전 정적 비교와 다른 study report는 당시 revision의 기록으로 유지한다. 그 파일들의 renderer SHA가 최신이라는 주장은 하지 않는다.

램 진입 보완의 3분 정적 측정(`2026-09-24T15:10:20.791Z`, 09-25 KST)은 **PASS**: 180.016초 / 10,800 rAF 표본 / 평균59.9947FPS / P95 16.7ms / max50ms / 오류0. 390×844 CSS/DPR2/780×1688 buffer, Apple M5의 Chromium153이다. 앞선 브라우저 검사 세션을 닫은 뒤 실행했고 다른 QA 브라우저 검사를 병행하지 않았다. 일반 데스크톱의 백그라운드 부하까지 통제한 시험은 아니다. 시작/끝 13개 production 소스·자산 해시가 같고 현재 파일과도 대조했다. [해당 revision 기록](desktop-soak-20260924T151020.json)은 데스크톱 fixture 성능이며 실기기 합격으로 확대하지 않는다. 이전 결과는 별도 JSON으로 보존했다. 최신 complete/렌즈 압착 캡처도 육안 확인했으며 오른쪽 보관함 일부 잘림 등 기존 아트 한계는 남는다.
