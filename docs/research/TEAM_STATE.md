# 팀 상태 — 모든 AI에 같은 버전 전달

> **최신 사용자 결정: 이전 COMPACT BLOOM·꽃섬·스프링 콘셉트는 REJECTED(폐기)다.** 이 파일의 해당 콘셉트와 연결된 개발 지시는 더 이상 실행하지 않는다. 현재 개발 기준은 루트 PRD 1.0.0의 **DEEP PRESS**다. 사용자는 귀엽거나 장난감 같은 표현을 거절하고 극도로 사실적인 그래픽을 요구했다. 현재 오디오는 제외한다. 시각 에셋 ImageGen·3D Meshy 7 flagship/high-quality texture 요구는 유지한다. 2027년 게임 흐름 조사는 예측이며 확정된 유행이 아니다.


버전: STATE-004 · 기준 컨텍스트: VD26.3-v2.0 · 갱신일: 2026-09-24 KST

## 사용자 확정 사항

- 대회: Very Disco Game Jam 2026.3. 목표: 우승을 목표로 준비.
- 팀: 사용자 포함 총 3명, **모두 개발자**. GitHub ID: [letstakeabreak](https://github.com/letstakeabreak)(사용자), [sy-Lee-01](https://github.com/sy-Lee-01), [magic3ightball](https://github.com/magic3ightball).
- PRD 작성·기술 선택: 이 작업의 총괄 AI에 위임. 초기의 사용자 직접 작성 예정은 최신 지시로 대체됐다.
- 제작 요구: 화려한 그래픽, 시각 에셋은 ImageGen, 3D 에셋은 Meshy 7 flagship와 high-quality texture. 생성 상태·적용 옵션·성능은 실제 증거로 기록한다.
- 협업 저장소: [very-disco-2026-3](https://github.com/letstakeabreak/very-disco-2026-3). 공유 폴더: [Google Drive](https://drive.google.com/drive/folders/1xtekUGeYoumuf2wn8YIGpkEAt1_bvjEr).
- 승인된 문서 작업: 대회 조사·공유 컨텍스트 이관, PRD, 역할·코딩 convention을 담은 instruction, 한 번의 지시로 담당 개발을 수행할 goal, 공유 자료 정리. 게시·업로드 완료는 별도 결과로 확인한다.

## 현재 개발 기준과 상태

| 항목 | 상태 | 담당 / 근거 |
|---|---|---|
| 컨셉 | DEEP PRESS / PRD 1.0.0 executionReady=true | 총괄 AI에 위임된 새 설계. 이전 콘셉트 실행 금지 |
| 기술 | TypeScript 6.0.3 + Three.js 0.186.0 + Vite 8.3.0 | 고정 설치·기반 검사 통과, 완성 게임 성능 미검증 |
| 역할 | 3인 모두 독립 개발 | 최종 영역·파일 소유권은 [instruction.md](../../instruction.md) |
| 실행 목표 | 루트 goal.md 기준 | [goal.md](../../goal.md). 명세와 구현 결과 구분 |
| 그래픽·에셋 | 사용자 제작 방식 확정 | ImageGen + Meshy 7 flagship/high-quality texture, 실제 생성물은 제작 기록 확인 |
| 팀명 / 제출용 전원 이름 | 미정 | GitHub ID와 제출용 이름 구분 |
| 참가 자격 | 미확인 | 3명 인원 조건과 소속 자격 구분 |
| iPhone 배포 인정 방식 | 미확인 | 웹 개발 선택과 대회 인정은 별도 확인 |
| 실제 배포 URL / 테스트 기기·iOS | 미확인 | 수신자 환경에서 시험 필요 |
| 대회 AI 정책 | 미확인 | 팀의 AI 제작 지시가 대회 허용 근거는 아님 |
| 평가 / 시상 / 시연 방식 | 미확인 | 공식 근거 첨부 |
| 통합 / 최종 제출 책임 | instruction.md 기준 | 개발 역할과 제출 책임은 구분 |
| 저장소 | 로컬 checkout·조사 문서 이관 | 원격 게시 여부는 실제 push/commit 기록 확인 |
| 기반 빌드 / 실제 게임·실기기 | scaffold 빌드·테스트 통과 / 실제 게임·iPhone 미완료 | docs/validation.md에 검사 범위 구분 |
| 잼 참가 신청 / 제출 | 이 조사 이관 작업에서 미실시 | 사용자의 별도 작업 여부는 미확인 |
| Drive 공유 | 사용자 지정 폴더 확인 | 파일 업로드 여부·URL은 실제 업로드 결과 확인 |

기존 v1은 사용자 거절로 폐기됐다. 루트 PRD 1.0.0의 DEEP PRESS를 추가 승인 질문 없이 개발한다.

## 결정 기록

| ID | 시각 KST | 결정 | 이유 / 증거 | 결정 주체 | 대체하는 결정 |
|---|---|---|---|---|---|
| D-000 | 2026-09-24 | 조사 결과로 방향을 정한다 | 사용자 초기 답변 | 사용자 | 없음 |
| D-001 | 2026-09-24 | 3명 모두 개발하고 GitHub 저장소로 협업한다 | 사용자 후속 지시와 GitHub ID | 사용자 | 초기 A/B/C 전담 제안 |
| D-002 | 2026-09-24 | PRD 작성·기술 선택을 총괄 AI에 맡긴다 | 사용자 최신 수정 | 사용자 | PRD 사용자 직접 작성 예정 |
| D-003 | 2026-09-24 | 화려한 그래픽, ImageGen과 Meshy 7 flagship/high-quality texture 사용 | 사용자 후속 지시 | 사용자 | 에셋 제작 방식 미정 |
| D-004 | 2026-09-24 | COMPACT BLOOM + TypeScript/Three.js/Vite 제안 | 이후 D-005로 폐기된 설계 v1 | 총괄 AI | 컨셉·엔진 미정 |
| D-005 | 2026-09-24 | COMPACT BLOOM 거절·새 안 연구 | 사용자 최신 지시. 극사실 그래픽·오디오 제외·2027 흐름 별도 조사 | 사용자 | D-004 콘셉트 |
| D-006 | 2026-09-24 | DEEP PRESS와 PRD/계약 1.0.0을 개발 기준으로 고정 | 2027 조사 + 사용자 위임; 촉각적 작업·가치 보존·실사 한 장면 | 총괄 AI | 폐기 후 새 안 조사 상태 |

## 작업 인계 양식

- 작업 ID / 담당 GitHub ID / 소유 파일:
- 기준 PRD·instruction·goal·컨텍스트·상태 버전:
- 이번에 바꾼 내용:
- 확인 환경(기기·OS·브라우저·빌드):
- 실제 시험과 결과:
- 하지 못한 확인 / 남은 문제:
- 다음 담당자와 필요한 행동:
- 통합 반영 여부 / 빌드·commit 식별자:
- 에셋 생성 모델·옵션·출처·실제 적용 파일:

## 플레이테스트 기록 양식

테스터(익명 식별자), 기기·OS, 진입 경로, 빌드, 첫 행동까지 시간, 첫 실패 원인을 설명할 수 있었는지, 무설명 완료 여부, 자발적 재시도 여부, 관찰한 막힘, 수정할 한 가지를 기록한다. 테스트를 실행하기 전에는 성공으로 채우지 않는다.

## 동기화 규칙

문서 소유권과 통합 절차는 루트 `instruction.md`를 따른다. 갱신할 때 버전·변경 이유를 기록하고 세 팀원/AI에 같은 최신본을 전달한다. 각 AI가 기존 제안과 새 결정의 차이를 확인하게 한다. GitHub 또는 Drive에 파일이 있다는 것만으로 다른 AI의 상태가 갱신됐다고 가정하지 않는다.
