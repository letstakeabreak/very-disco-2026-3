압착된 회수물·늘어난 실린더의 표면 방향이 변형 전 모습에 남던 문제와, 작업대 그림자가 케이스 홈을 가로지르던 문제를 수정합니다. 표면 반사가 압착 형상을 따르고 보관물 그림자는 케이스 입구·안쪽 벽에 붙습니다. 정지 자세에서는 기존 그림자를 재사용하고 위치·압축·손상이 바뀌면 갱신합니다.

- 기준: PR #1이 머지된 integration/v1의 fa622b70566cdacc37cc419552b20ae62b8d61ed. B 소유 파일만 수정. PRD1.0.1 / 계약1.0.0.
- 표면 방향: 실제 GLSL 및 GLB를 사용한 GPU 유한 차분 비교27조건 / 4,189표본. 최대 normal 오차72.9944°→0.06490° 미만, 11실패→전부 통과. 미분 불연속 부근은 제외. 전후 실제 WebGL9쌍으로 반사 변화를 확인했습니다.
- 케이스 그림자: 보관 순서·압축·화면 크기36조건과 전후 PNG12장. 케이스 밖 픽셀 변화0, 앞면 누출0, geometry 범위의 겹침·잘림0. raycast로 케이스 내부의 작업대 면 제거·입구/벽 일치와 공유 리소스 단일 해제를 확인했습니다.
- 비용: 이전 그림자 재사용(d9db1df)은 화면을 유지하면서 정지 자세 draw33→27 / 모든 패스 triangles281,192→193,194. 최신 케이스 그림자 면 추가 후 draw28 / triangles193,272입니다. 실제 iPhone FPS·전력 영향은 재측정하지 않았습니다.
- 최신 전체69테스트, 고정23파일, 타입·19모듈 경계·build·B 소유권 검사 통과. 빌드12,187,776bytes, JS690.28kB. Vite500kB chunk 권고 경고 유지.
- 직전 A0c7634b / Bd9db1df / Cf42f919 로컬 후보의83테스트 및 압착·보관·실패·정산·재시작·강제 GPU 오류 복구 기록도 보존합니다. 이 결과는 최신 표면/케이스 수정 후의 A/C 통합 재검사가 아니며 A/C 원격 PR은 포함하지 않습니다.

[케이스 그림자 검증](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/case-shadow-study/README.md) · [표면 반사 검증](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/normal-study/README.md) · [그림자 비용 비교](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/performance-study/README.md) · [직전 연결·GPU 재시도](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/performance-study/integration/README.md)

남은 검증: 현재 사용자의 iPhone 연결 불가로 실기기 재측정은 수행하지 않았습니다. 이전60fps 미달·자연 발생 초기 GPU 실패 원인, 보관 외형 복원 계약, 작은 화면 HUD 가림과 기존 아트 미달은 남습니다. 사용자의 지시에 따라 integration/v1에 반영하는 변경이며, 전체 아트·실기기 최종 합격이나 main·배포·대회 제출을 뜻하지 않습니다.
