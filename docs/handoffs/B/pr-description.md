기존 wireframe probe를 DEEP PRESS의 실제 3D 프레스·회수품 렌더러로 교체합니다. 고정 작업실은 ImageGen 배경을 사용하는 2.5D 구도이며, 네 모델은 ImageGen → Meshy 7 → 부품 분리·모바일 최적화·원본 PBR 재베이크 과정을 거쳤습니다. `createRenderer` 공개 API와 공유 계약은 그대로입니다.

현재 물건의 검사 회전, 보호 프레임 압착, 접촉하는 램, 렌즈 유리·파손, 트레이/케이스 배치를 immutable snapshot으로 구동합니다. 부피·점수·손상 판정은 구현하지 않습니다. 비동기 로딩 실패·일시정지/재시작·context loss·자원 해제를 처리합니다.

- 4 GLB: 8,956,848 bytes / 80,998 triangles. 배경 및 앱을 포함한 현재 `dist`는 9,884,002 bytes. source 4K color/normal은 보존하고 runtime은 최대2K입니다.
- 고정23파일 hash, TypeScript, 모듈 경계, 42개 테스트, build, B 소유권, diff 검사 통과. JS640kB에 대한 Vite chunk 경고는 남습니다.
- 실제 Chromium WebGL: 2화면 크기, 8상태, 9물건/상태 조합, select/range 입력, 오류0, 검사 전후 파일hash 동일. Mac Safari에서 별도 새 로드와 압력·회전 입력도 관찰했습니다.
- 데스크톱 Apple M5 / Chromium / DPR2: 180초, 10,801 rAF 표본, 평균60.004 FPS / P95 16.7ms / 오류0. 실제 iPhone 측정은 아닙니다.
- [B 연결/제약](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md), [검증 기록](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/evidence/renderer-validation.md), [모델 파이프라인](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/asset-pipeline.md), [3분 데스크톱 측정](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/evidence/desktop-soak.json).

실제 iPhone Safari의 3분 플레이·터치 취소/복귀, A/C와 통합된 게임 루프는 미검증입니다. 네 asset은 `generated-unverified`로 유지합니다. 작은 렌즈 원판의 파손 가독성, 정적인 원본 계기판 디테일, snapshot에 저장 물건의 압축/손상 수치가 없는 점은 인계 문서에 명시했습니다. 이 PR은 integration/v1 대상 draft이며 main 머지·배포·대회 제출은 하지 않습니다.
