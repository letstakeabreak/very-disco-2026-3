# 팀 작업 문서

이 페이지에서 각 역할의 **실제 공개된 브랜치** 문서를 연다. 아래 링크는 `main`을 자동으로 붙이지 않으므로 기본 브랜치에서 열어도 같은 문서로 연결된다. 웹 화면을 읽기 어려운 AI 도구에는 각 항목의 **원문** 링크를 사용한다.

## 바로 열기

- [공통 작업 지침](https://github.com/letstakeabreak/very-disco-2026-3/blob/main/instruction.md)
- [Goal 시작 요청](https://github.com/letstakeabreak/very-disco-2026-3/blob/main/goal.md)
- [PRD](https://github.com/letstakeabreak/very-disco-2026-3/blob/main/prd.md)
- [B 최신 인계 문서](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md)
- [B Draft PR #1](https://github.com/letstakeabreak/very-disco-2026-3/pull/1)

## 역할별 공개 상태

| 역할 | 담당 | 작업 문서 |
|---|---|---|
| A · 코어/콘텐츠/통합 | sy-Lee-01 | 2026-09-24 확인 시 원격 역할 브랜치와 인계 문서 미게시. 시작은 위 공통 Goal 문서를 따른다. |
| B · 렌더/에셋/그래픽 | letstakeabreak | 아래 `role/b-render` 문서 목록. 구현·검증·미완료 조건을 함께 읽는다. |
| C · 앱/입력/HUD | magic3ightball | 2026-09-24 확인 시 원격 역할 브랜치와 인계 문서 미게시. 시작은 위 공통 Goal 문서를 따른다. |

A/C 문서가 아직 게시되지 않은 상태에서 없는 경로로 연결하지 않는다. 각 담당자가 브랜치/문서를 push하면 실제 존재하는 주소로 이 목록을 갱신한다. 공통 개발 출발점은 `bootstrap-v2`이며 이 문서 목록이 역할별 출발 절차를 변경하지 않는다.

## B 작업 문서 전체

아래 17개 Markdown 문서는 `role/b-render`의 최신 내용으로 연결된다. 실제 게임 완료, 실기기 검증 완료를 의미하지 않는다. 해당 시점의 구현 SHA와 증거 범위는 인계 문서를 따른다.

| 문서 | AI용 원문 |
|---|---|
| [B 작업 인계 — DEEP PRESS 렌더링](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/README.md) |
| [B — 아트 목표 5개와 실제 WebGL 비교](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/art-review.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/art-review.md) |
| [B — 모바일 모델 파이프라인 인계](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/asset-pipeline.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/asset-pipeline.md) |
| [B renderer 검증 기록](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/evidence/renderer-validation.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/evidence/renderer-validation.md) |
| [남은 실제 iPhone 검증](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/device-acceptance.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/device-acceptance.md) |
| [외부 접근과 404 확인](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/repository-access.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/repository-access.md) |
| [압력계 덮개와 동작 바늘 배치 조사](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/calibration.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/calibration.md) |
| [카세트 내부 형상 조사](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/cassette-structure-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/cassette-structure-study/README.md) |
| [실제 받침면·램·카세트 접촉 조사](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/contact-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/contact-study/README.md) |
| [B 렌더 미리보기 도구 — 초기 검증](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/evidence/preview-harness.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/evidence/preview-harness.md) |
| [macOS Safari 관찰](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/evidence/safari-desktop.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/evidence/safari-desktop.md) |
| [케이스 홈 배치 측정과 독립 실험](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/layout-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/layout-study/README.md) |
| [금속 반사·앰버 재질 독립 실험](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/material-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/material-study/README.md) |
| [B PR 설명](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/pr-description.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/pr-description.md) |
| [금속 환경 반사 비교](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/reflection-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/reflection-study/README.md) |
| [램 검사 위치 보완](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/retraction-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/retraction-study/README.md) |
| [받침 접촉 그림자 진단](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/shadow-study/README.md) | [원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/shadow-study/README.md) |

## 팀원 접근

조회는 공개 주소를 이용한다. 코드 push에는 collaborator 권한이 필요하다. 아직 초대를 수락하지 않았다면 본인 GitHub 계정으로 [저장소 초대 페이지](https://github.com/letstakeabreak/very-disco-2026-3/invitations)를 연다. 이 로그인 전용 초대 URL은 공개 문서 링크와 별개다.

2026-09-24 사용자 요청에 따라 작업 문서 접근 경로를 기본 README에 추가했다. 공통 계약/API/게임 소스/패키지는 변경하지 않았다. B 기여의 게임 통합은 별도 `integration/v1` 검증 절차를 따른다.
