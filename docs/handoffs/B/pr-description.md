기존 wireframe probe를 ImageGen 작업실과 Meshy 7 PBR 모델 4종을 사용하는 DEEP PRESS 렌더러로 교체합니다. 검사 회전·압착·램 접촉·손상·게이지·트레이/보관을 immutable snapshot으로 구동합니다. 공개 API, bootstrap-v2/PRD 1.0.1/계약 1.0.0과 A/C 모듈·의존성은 유지합니다.

카세트에 새 ImageGen → Meshy 7 내부 축과 실제 투명 패스를 추가했습니다. 렌즈의 투명도 설정이 카세트를 덮어쓰던 오류를 재현해 수정했고, 확정 무결성에 따른 균열·열린 파손 구멍을 표현합니다. 유리와 내부 축은 프레임과 분리해 강체 이동합니다. 기존 표면을 절단하는 시각 효과로, 물리 파괴·점수·부피 판정을 구현한 것은 아닙니다. 배경과 보이는 케이스는 2.5D이며 접촉 그림자·폼/앞 테두리의 깊이 가림을 사용합니다.

실제 iPhone에서 비용을 확인한 뒤 화면 DPR 2를 유지하면서 유리 투과용 중간 영상만 CSS 해상도로 조정했습니다. 같은 기기의 3분 렌더 fixture에서 평균 32.18→40.05fps, P95 36→29ms를 관측했습니다. 한 실행의 P95 기준은 충족했으나 60fps 목표는 미달입니다.

- 전체 검사: 고정 23파일, strict TypeScript, 17모듈 경계, 11파일 59테스트, build, B 소유권 검사 통과.
- 모델 4종 10,885,424bytes / 89,998삼각형. 실제 좌표·index·PBR·2K 상한 검사 통과. 대표 visible 105,096삼각형 / draw 33. dist 12,169,653bytes이며 JS 677,366bytes의 Vite 500kB 경고는 남습니다.
- Chromium: 3화면·8상태·9물건/상태 조합, 아트 11장, 카세트 손상 비교 현재 21장 재검사. 로드·오류·전후 소스 해시 검사 통과. 아트 전체 합격이라는 뜻은 아닙니다.
- 실제 iPhone 16 Pro Max / iOS 27.2 / Safari 27.2: 조정 후 180.005초 / 7,210 rAF 간격 / 평균 40.0544fps / P95 29ms / 최대 60ms / 측정 중 렌더 오류·hidden 전환 0회. CSS 440×796, buffer 880×1592. 전체 프레임, 빌드/측정 전후 해시와 실제 기기 전후 14장을 보존했습니다.
- 조정 후 첫 페이지 로드에서 GPU context-loss 1회가 발생했습니다. 다음 실행에서 3분 측정을 완료했지만 시작 실패의 원인은 미확정입니다. 오류 기록과 기기 화면도 함께 보존했습니다.

[인계와 연결 방법](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md) · [실기기 전체 결과](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/device-acceptance.md) · [파손 및 광학 회귀](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/damage-study/README.md) · [아트 판정](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/art-review.md)

Draft를 유지합니다. 60fps, 초기 GPU 실패 원인, 콘셉트와의 구도·재질·작은 화면 가독성, 실제 회전·touch/cancel·복귀·A/C 통합 게임은 미달 또는 미검증입니다. iPhone 13급 시험은 수행하지 않았습니다. 에셋 4종은 generated-unverified이며 저장 물건의 형태 이력이 없는 snapshot 제약도 인계에 남겼습니다. integration/v1 대상이고 main 머지·배포·대회 제출은 포함하지 않습니다.
