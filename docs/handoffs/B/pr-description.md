기존 wireframe probe를 DEEP PRESS의 실제 프레스·회수품 렌더러로 교체합니다. ImageGen 작업실 배경과 Meshy7 PBR 모델4종을 사용하며, 검사 회전·압착·손상·램 접촉·게이지·트레이/보관을 immutable snapshot으로 구동합니다. `createRenderer` 공개 API, bootstrap-v2/PRD1.0.1/계약1.0.0, A/C 모듈과 의존성은 유지합니다.

카세트 원본은 속이 빈 불투명 외피였습니다. 새 ImageGen → Meshy7 내부 축을9,000삼각형으로 최적화해 기존 GLB에 합쳤습니다. 외피 geometry/텍스처 바이트는 보존하고, 불투명 외피와 유리 패스를 분리해 안쪽 구리 띠와 반대편 외피가 보이도록 했습니다. 프레임 압축 중 유리·내부 축은 강체 이동하며 같은 시각 압축 계수를 램 높이에 적용합니다. 광학 마스크가 손상 색상에 의해 사라지지 않도록 셰이더 합성 순서도 검증합니다. 실제 부피·점수·무결성 판정은 계산하지 않습니다.

이 PR에는 작업대 접촉 그림자, 램의 접촉 전 접근, ImageGen 전경 케이스, 폼 입구·앞면의 depth 가림, 로딩 실패/context loss/dispose 처리도 포함됩니다. 배경과 보이는 케이스는2.5D이며 이동 가능한 전체3D환경·물리 수납 모델은 아닙니다.

- 전체 검사:고정23파일·strictTS·17모듈 경계·58테스트·build 통과. 공유 geometry/텍스처1회 해제와 광학/변형 합성 회귀 포함.
- GLB4종10,885,424bytes/89,998삼각형, 실제 파일 좌표·normal·index·self-contained PBR·2K상한 검사 통과. dist12,168,095bytes. JS675,808bytes에 대한 Vite500kB경고는 남습니다.
- 실제 Chromium:3화면·8상태·9물건/상태 조합·오류0·전후해시 일치. 아트11장도 같은 source/asset을 고정해 촬영했습니다. 대표 visible105,096삼각형/33 draw calls이며 fragment discard·clipping으로 숨는 면도 보수적으로 포함합니다.
- 보관36조합의 실제 GPU readPixels:앞 테두리 누출12,088→0픽셀, 케이스 밖 변화0, 홈 가시 픽셀 최소624. CPUbounds의 최소 수평 여유13.84px,320폭에서 B130px패널까지5.60px. 실제 C HUD/safe-area·물리 수납은 미검증입니다.
- HMR 없는 desktop 하네스3분:180.012초/10,802 rAF/평균60.0072FPS/P95 16.7ms/max16.8ms/오류0. AppleM5/Chromium153/390×844/DPR2이며15개 source/asset SHA가 전후 일치합니다. 실제 iPhone·통제된 시스템부하·통합 게임 플레이 증거는 아닙니다.

[인계와 연결 방법](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md) · [새 내부 부품과 생성 기록](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/cassette-insert-study/README.md) · [검증 범위](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/evidence/renderer-validation.md) · [아트 판정](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/art-review.md)

Draft를 유지합니다. 실제 iPhone Safari3분 플레이·터치/복귀·A/C 통합 게임은 미검증이며 에셋4종은 generated-unverified입니다. 작업 영역 구도, 작은 화면의 손상 식별, 유리 경계·미세 재질, 케이스 세부 접촉 음영과 생성 프레스의 상부 교차가 남습니다. 저장 물건의 압축/손상 이력이 없는 snapshot 제약도 인계에 기록했습니다. 자동 검사 통과를 완성 아트로 표시하지 않습니다. integration/v1 대상이며 main 머지·배포·대회 제출은 하지 않습니다.
