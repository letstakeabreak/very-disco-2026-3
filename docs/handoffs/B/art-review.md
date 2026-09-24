# B — 아트 목표 5개와 실제 WebGL 비교

2026-09-25 갱신. ImageGen 원본은 목표 이미지이며 실행 화면이 아니다. [비교 갤러리](art-review/index.html)의 ACTUAL WEBGL은 실제 GLB를 렌더한 브라우저 캡처다. [촬영 기록](art-review/capture-report.json)의 PASS는 로딩·오류·크기·해시 검사이며 아트 합격 판정이 아니다.

최신 촬영 시작은 **2026-09-24T16:45:31.256Z**다. 카세트에 새 내부 축과 투명 재질을 연결하고 canonical5장·390/320폭6장을 다시 촬영했다. 카세트 근접03, 390폭01/02, 320폭05를 직접 열어 확인했다. 모든 화면 ready, 생산용 장면은 GLB4개 로드, 오류0, 촬영 전후 source SHA 일치다.

## 증거의 종류

| 목표 | 실제 실행 경로 | 크기 |
|---|---|---|
| 01 작업대 | production createRenderer, 카세트 inspecting, yaw .45rad | 1024×1536,390×844,320×568 |
| 02 압력 | 같은 renderer, 카세트 pressure .6 / integrity1 | 같은3크기 |
| 03 카세트 | 독립 정적 뷰어, 같은 runtime GLB와 production prepareCassette | 1254×1254 |
| 04 프레스 | 독립 정적 뷰어, 같은 runtime GLB와 production createGauge | 1254×1254 |
| 05 보관 | production createRenderer, complete fixture /저장3개 | 같은3크기 |

01/02/05는 A의 판정을 실행하지 않는 immutable fixture다. 05의 저장 압축/손상 이력은 snapshot에 없으므로 문서화된 cosmetic fallback을 쓴다. 실제 회수 성공·점수 증거가 아니다. 390/320은 DPR1 desktop Chromium viewport이며 실제 iPhone/터치/C HUD·safe-area 검증이 아니다.

03/04는 별도 회색 스튜디오 배경과 전면 왼쪽¾ 카메라를 쓴 실제 Three.js WebGL이다. 게임과 같은 GLB/PBR·balanced 환경·좁은 반사 카드·벽 반사색×.35를 사용한다. 카세트에는 생산용 유리 복원 함수를 적용하며 내부 축도 런타임 파일에서 읽는다. 게임의 압축 셰이더는 적용하지 않는다. 이 근접 화면을 모바일 장면의 합격 증거로 바꾸지 않는다.

## 시각 판정

| 항목 | 01 작업대 | 02 압력 | 03 카세트 | 04 프레스 | 05 보관 |
|---|---|---|---|---|---|
| 실루엣·상대 크기 | 미달 | 미달 | 통과 | 통과 | 미달 |
| 카메라 구도 | 미달 | 미달 | 통과 | 통과 | 미달 |
| 재질 구별 | 통과 | 통과 | 통과 | 통과 | 통과 |
| 환경광·호박색 포인트 | 통과 | 통과 | 미달 | 미달 | 통과 |
| 접촉·그림자 | 통과 | 통과 | 통과 | 통과 | 미달 |
| 변형 설득력 | 미검증 | 미달 | 미검증 | 미검증 | 미검증 |
| 작은 화면 가독성 | 미달 | 미달 | 미검증 | 미검증 | 미달 |

통과는 한정된 육안 조건이다. 재질 통과는 밝은 외피·어두운 금속·호박색 중심부를 구분한다는 뜻이며 원본 미세 표면 재현이나 포토리얼 완성을 뜻하지 않는다. 03/04 카메라 통과도 전면 왼쪽¾ 방향과 전체 구조 확인에 한정한다.

- **새 카세트:** [내부 부품 조사](cassette-insert-study/README.md)의 구리 띠·축이 유리 안에서 보인다. 기존 빈 원통 문제는 개선됐다. 원본과 같은 내부 구조를 복원한 것은 아니며 오른쪽 유리의 어두운 띠·분류 경계, 외피의 베이크 흔적과 미세 재질 차이는 남는다. 원본의 밝은 유리 하이라이트까지 일치했다고 판단하지 않는다.
- **01/02:** 프레임을 먼저 누르고 유리·축을 강체 이동해 고무처럼 함께 줄어드는 현상을 완화했다. 램 접촉 높이도 같은 .12 시각 압축 계수를 따른다. 전체 장비가 보이는 구도는 상단을 자른 목표와 다르다. 압력 화면에서 램이 물체를 많이 가리며 보호판 접힘·파편의 설득력은 부족하다.
- **390/320:** 흰 외피와 호박색 중심부, 램 하강·게이지 변화는 보이지만 내부 축·체결부의 세부는 작다. 01/02는 integrity1이므로 손상 상태 판정 증거가 아니다. 실제 C HUD와 손상 식별은 미검증이다.
- **05:** 세 물건이 각각 홈에 남고 앞 테두리에 가려지는 상태를 확인했다. [별도 보관 GPU 검사](layout-study/foreground-report.json)는 지정 영역의 픽셀 차이와 보수적 CPUbounds를 검사한다. 보이는 케이스는 ImageGen plate로 목표의 측면 배치·세부 접촉 음영과 다르다. 가시3D케이스·물리 수납 증거는 아니다.
- **04:** 프레스의 좁은 금속 반사·따뜻한 가장자리는 보이지만 원본의 미세 마모·깊이·어두운 면 세부와 차이가 남는다. 상부 하우징에는 생성 자산의 교차도 남는다.

목표 전체의 아트 합격은 아직 아니다. 다음 개선은 게임 화면의 작업 영역 비율·작은 화면 손상 식별·유리 경계와 미세 재질·케이스 접촉 음영이다. [램 동작 조사](retraction-study/README.md)는 이전 동작 revision의 증거이며 현재 카세트 변경을 포함한 모든 3D 충돌을 인증하지 않는다. 실제 iPhone에서 조작·식별·장시간 성능을 확인해야 한다.

## 촬영 기준과 예산

촬영 당시 HEAD는 `7551a1b8fe2818b2b2c175691e936428a94c3463`이며 미커밋 변경을 포함한다. 아래 및 JSON의 전체 source SHA가 실제 렌더한 내용이다.

| 파일 | 촬영 전후 동일 SHA256 |
|---|---|
| `src/render/index.ts` | `876a9aff68bcf7739e52815fff279ca92b180e4ad1eb32ce0ecdc0e871f9f895` |
| `src/render/cassette.ts` | `17af3bd0465b8eeeb8b60e49277d559add12d56c9673dddc756f49f4e8fe4a81` |
| `src/render/deformation.ts` | `85dbf6c6b786ceb0ce8c179d4b71bce875806ed246400f322b0e87970429b24b` |
| `public/assets/models/salvage-cassette.glb` | `0290ffbcb3752c267a36c1ced51477e0020e1d6f6314491ea1a89eebdbba410c` |
| `docs/handoffs/B/art-review/inspector.ts` | `1a751268f2b5869546e46663a3d8a9ef26cd2d3e738e59fe517e836fd5d902ab` |

생산용9장: **visibleTriangles105,096 / 모든 패스 triangles281,192 / drawCalls33**. visible 값은 depth-only72삼각형, 유리 패스용 공유 외피15,000삼각형, clipping·fragment discard로 숨는 면도 보수적으로 포함한다. 모든 패스 합계를 visible 예산과 혼동하지 않는다. 원위치 카세트는 파일24,000삼각형·8 draw calls, 프레스는 파일42,998삼각형·9 draw calls다.

`node docs/handoffs/B/art-review/check.mjs`, `capture.mjs`, `gallery-check.mjs` 순서로 재현한다. capture는5개 원본과 runtime·renderer·검사 뷰어의 전후 해시를 고정하고 실제 화면11장을 저장한다. gallery 검사는 정적5목표·35판정·16이미지·보기 전환·좁은 화면 배치에 한정한다. [3분 desktop 측정](evidence/desktop-soak.json)은 별도 fixture workload이며 실제 iPhone 성능을 대신하지 않는다.
