압착된 회수물과 늘어난 프레스 실린더에서 위치만 바뀌고 표면 방향이 원래 형태에 남던 문제를 수정합니다. 기존 변형에 맞춰 normal/tangent를 변환해 PBR 반사가 형상을 따르게 하고, 평행 이동하는 유리·내부 축의 표면은 유지합니다. 정지 자세에서는 중복 그림자 계산도 생략하며 위치·압축·손상이 바뀌면 다시 갱신합니다. 모델·텍스처·해상도·조명 설정·공개 API는 유지합니다.

- 기준: PR #1이 머지된 integration/v1의 fa622b70566cdacc37cc419552b20ae62b8d61ed. B 소유 파일만 수정. PRD1.0.1 / 계약1.0.0.
- 표면 방향: 실제 GLSL transform feedback과 실제 GLB의 GPU 위치 출력으로 독립적인 유한 차분을 계산했습니다. 27조건 / 4,189표본에서 최대 normal 오차72.9944°→0.06490° 미만, 11실패→전부 통과. 미분 불연속 부근은 검사에서 제외했습니다.
- 최신 화면: 실제 Chromium WebGL 전후9쌍, 모델4개 로드, 오류·중복 Three 경고0, 소스 전후 해시 일치. 초기 캐시 공유로 생긴 잘못된 밝기 비교는 제외하고 독립 설치로 재촬영했습니다.
- 그림자 최적화(d9db1df): 같은 화면을 유지하면서 정지 자세 draw33→27, 모든 패스 triangles281,192→193,194. 최신 normal 수정은 의도적인 반사 변화이므로 두 비교를 구분합니다. draw 수가 같아도 추가 셰이더 연산의 기기 FPS·전력 영향은 아직 재측정하지 않았습니다.
- 최신 전체69테스트, 고정23파일, 타입·19모듈 경계·build·소유권 검사 통과. JS689.84kB로 Vite500kB 권고 경고 유지.
- 직전 A0c7634b / Bd9db1df / Cf42f919 로컬 후보의83테스트 및 압착·보관·실패·정산·재시작·강제 GPU 오류 복구 기록도 보존합니다. 점수360 / 남은 용량0.40L가 복구 후 유지됐습니다. 이 결과는 최신 normal 수정 후의 A/C 통합 재검사는 아닙니다. A/C 원격 PR은 포함하지 않습니다.

[최신 표면 반사 검증](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/normal-study/README.md) · [그림자 비용 비교](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/performance-study/README.md) · [직전 연결·GPU 재시도](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/performance-study/integration/README.md)

Draft 유지: 실제 iPhone 재측정은 연결 불가로 수행하지 않았습니다. 60fps 미달·자연 발생 초기 GPU 실패 원인은 아직 남습니다. 보관물의 정확한 외형 복원에는 공유 계약의 저장 상태가 필요하고, 작은 화면 HUD 가림과 기존 아트 미달도 남습니다. main·배포·대회 제출은 포함하지 않습니다.
