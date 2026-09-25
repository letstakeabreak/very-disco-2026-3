장면이 멈춰 있을 때 같은 그림자를 매 프레임 다시 계산하던 비용을 줄입니다. 프레스·회수물의 transform/가시성, 램 이동량, 압축·손상 셰이더 값을 추적해 실제 변경 시 그림자를 갱신합니다. 화면은 계속 렌더하며 해상도·재질·모델·공개 API는 유지합니다.

- 기준: PR #1이 머지된 `integration/v1`의 `fa622b70566cdacc37cc419552b20ae62b8d61ed`. B 소유 파일만 수정. PRD 1.0.1 / 계약 1.0.0.
- 회귀 테스트 2개를 기존 코드에서 실패시킨 뒤 수정 후 통과. 전체 69테스트, 고정 23파일, 타입·19모듈 경계·build·소유권 검사 통과.
- 실제 Chromium WebGL의 9개 안정된 자세에서 전후 PNG가 SHA-256까지 동일. draw calls 33→27, 모든 패스 triangles 281,192→193,194. FPS 향상률이나 움직이는 모든 프레임의 비용 감소를 뜻하지 않습니다.
- A `0c7634b` / B `d9db1df` / C `f42f919`를 별도 로컬 후보로 연결해 83테스트, 압착·보관·실패·정산·재시작과 강제 GPU 오류 후 재시도를 확인했습니다. 점수 360 / 남은 용량 0.40L가 복구 후 유지됐습니다. A/C 원격 PR은 이 PR에 포함하지 않습니다.

[전후 화면·수치·소스 해시](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/performance-study/README.md) · [연결·GPU 재시도 캡처 10장](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render-performance/docs/handoffs/B/performance-study/integration/README.md)

실제 iPhone 재측정은 연결 불가로 수행하지 않았습니다. 이전 60fps 미달·자연 발생 초기 GPU 실패의 원인은 아직 해결됐다고 볼 수 없습니다. 보관물의 정확한 외형 복원에는 공유 계약의 저장 상태가 필요하고, 작은 화면 HUD 가림 및 기존 아트 미달도 남습니다. JS 500kB 권고 경고 유지. main·배포·대회 제출은 포함하지 않습니다.
