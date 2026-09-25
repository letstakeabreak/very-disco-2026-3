# 검증 현황 — 2026-09-25 (v1 통합)

v1은 bootstrap-v2 / PRD 1.0.1 / 계약 1.0.0 위에서 A 코어, B 렌더, C 앱을 통합한 게임이다. snapshot의 `implementation`은 `game`이다. 통합 경로는 `integration/v1`(PR #1, #3, #5–#11)에서 PR #12와 `main`의 문서 변경을 더한 `release/v1`이다. 각 역할의 세부 증거는 `docs/handoffs/A|B|C/`에 있다.

| 항목 | 실제 결과 | 한계 |
|---|---|---|
| 전체 검사 | Node 26.8.2 / npm 11.19.1에서 `npm run check` 통과: 고정 23파일, strict TypeScript, AST 모듈 경계, 15파일 91테스트, production build | 자동 검사일 뿐이며 실기기·시각 판정을 대신하지 않는다 |
| 게임 흐름 | 헤드리스 Chromium에서 실제 앱을 끝까지 진행: 시작 → 검사 → 누르기 유지 → 300ms 정착 결과 → 보관(압력 0%로 복귀) → 100% 자동 실패 → 폐기 → 마지막 보관 → 완료 → 재시작. 브라우저 오류 0 | 데스크톱 Chromium과 키보드 입력이다. 터치와 iPhone Safari는 아니다 |
| 화면 배치 | 390×844와 375×812에서 HUD가 압력계와 보관 케이스를 가리지 않는다. 1440×900에서는 무대 양옆 패널로 배치된다. 320×568은 문서 넘침 없이 조작부가 모두 보이지만 장면 일부가 겹친다 | viewport 에뮬레이션 결과다 |
| 렌더·에셋 | ImageGen → Meshy 7 → 모바일 GLB 4개. 압착 시 외피가 퍼지고 파손 시 파편이 보인다. 5개 아트 목표의 판정은 B `art-review.md`를 따른다 | registry는 `generated-unverified`이고 일부 아트 목표는 미달이다 |
| 실제 iPhone | 사용자가 직접 확인한다. B는 iPhone 16 Pro Max에서 40.05fps / P95 29ms를 기록했다 | 60fps 목표에는 미달이고, 이후 변경은 재측정하지 않았다 |
| 제출 빌드 | `npm run build` 산출물 12.9MB(20MB 예산 이내). 루트 `index.html`과 상대 경로를 쓴다. ZIP을 하위 경로(`/html/<id>/`)에서 열어 모든 에셋 로드와 플레이를 확인했다 | itch.io 업로드와 대회 제출은 사용자가 한다 |

## 남은 조건

- 보관물의 손상 외형은 renderer를 다시 만들면 복원되지 않는다. 계약 1.1.0(`storedSpecimens`) 제안은 적용하지 않았다.
- B 아트 판정의 미달 항목(카메라·케이스 구도, 작은 화면 손상 식별, 재질 세부)과 60fps 목표가 남아 있다.
- JS 단일 chunk가 697kB로 Vite의 500kB 권고를 넘는다. 빌드는 성공한다.
- 대회 확인 항목은 아직 확인되지 않았다: AI 사용 허용·고지, 참가 자격, 웹 전달 인정 방식, 제출용 이름. 오디오는 범위에서 제외했다.

이전 scaffold 시점의 캡처(`evidence/deep-press-scaffold*.png`)는 계약 개발용 placeholder 기록으로 보존한다.
