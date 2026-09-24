# 외부 접근과 404 확인

2026-09-24 확인. 저장소는 이미 **PUBLIC** 상태였다. 이번 조사에서 공개 범위를 변경하지 않았다. 외부 웹 조회와 로그인/쿠키/토큰 없는 HTTP, 인증 설정을 비운 Git의 새 filtered clone 및 B 브랜치 fetch가 성공했다. 상세 시각·HTTP 상태·읽은 commit은 [자동 기록](evidence/public-access-check.json)에 있다. 다른 사람의 브라우저/Codex 세션 자체를 검사한 결과는 아니다.

사용자의 후속 요청에 따라 [문서 접근 PR #2](https://github.com/letstakeabreak/very-disco-2026-3/pull/2)를 main에 반영했다. 저장소 첫 화면의 **팀 작업 문서 → 최신 작업 문서 목록**으로 들어가면 각 문서의 실제 브랜치/원문을 바로 연다. main 문서 commit은 `717e323452a095cc96c54ba17f2a83f8875988e5`이며 README와 목록 두 파일만 변경했다. B 게임 코드는 이 문서 변경에 포함되지 않았다.

## 검증한 진입점

| 목적 | 주소 |
|---|---|
| 전체 작업 문서 | [main의 공용 목록](https://github.com/letstakeabreak/very-disco-2026-3/blob/main/docs/work-documents.md) |
| 저장소·공통 출발점 | [저장소](https://github.com/letstakeabreak/very-disco-2026-3) |
| 공통 작업 지침 | [main/instruction.md](https://github.com/letstakeabreak/very-disco-2026-3/blob/main/instruction.md) |
| Goal 시작 요청 | [main/goal.md 원문](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/main/goal.md) |
| 아직 통합 전인 B 결과 | [role/b-render의 B handoff](https://github.com/letstakeabreak/very-disco-2026-3/blob/role/b-render/docs/handoffs/B/README.md) |
| AI에서 읽기 쉬운 B 원문 | [B handoff raw](https://raw.githubusercontent.com/letstakeabreak/very-disco-2026-3/role/b-render/docs/handoffs/B/README.md) |
| B 기여 검토 | [Draft PR #1](https://github.com/letstakeabreak/very-disco-2026-3/pull/1) |

clone 주소는 `https://github.com/letstakeabreak/very-disco-2026-3.git`이다. 저장소 루트 HTML, API 메타데이터, 지침/Goal, B 문서와 PR은 익명 요청에서 200이었다. `main/docs/handoffs/B/README.md`는 아직 main에 파일이 없어서 404이며 권한을 확대해도 생기지 않는다. B 결과를 볼 때 표의 **role/b-render 주소**를 사용한다. C의 개발 출발점은 기존 bootstrap-v2/role/c-app 절차를 유지한다. B 브랜치를 C 작업 브랜치로 바꾸라는 뜻이 아니다.

## 팀원 쓰기 권한

관리자 API 확인 시 `sy-Lee-01`, `magic3ightball`의 write 초대는 존재하고 만료되지 않았으나 수락 대기 중이었다. 공개 조회 성공이 push 권한 확보를 뜻하지 않는다. 해당 사용자는 자기 GitHub 계정으로 [저장소 초대](https://github.com/letstakeabreak/very-disco-2026-3/invitations)를 수락해야 collaborator 권한이 적용된다. 이 로그인 전용 링크의 수락 완료를 소유자가 대신 실행하지 않았다. [GitHub 초대 안내](https://docs.github.com/en/enterprise-cloud%40latest/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)

## 같은 문제가 다시 보일 때

1. 실패한 **전체 URL과 시각**, 브라우저인지 Codex clone/fetch인지 기록한다. 정확한 주소 없이 캐시·토큰·초대가 원인이라고 확정하지 않는다.
2. 위 저장소 루트와 raw 문서를 로그인 없는 브라우저에서도 비교한다. 루트 성공/특정 파일 404면 해당 branch/path가 실제 있는지 확인한다.
3. Git 작업은 위 clone URL로 조회한다. 기존 원격이 다르거나 인증 계정이 다른지 읽어서 확인하고 사용자의 인증을 무단 변경하지 않는다. [GitHub clone 오류 안내](https://docs.github.com/en/repositories/creating-and-managing-repositories/troubleshooting-cloning-errors)
4. Codex 연결만 실패하면 해당 계정/연결의 실제 오류와 저장소 접근 대상을 확인한다. 이번 성공 결과로 상대 Codex까지 복구됐다고 판단하지 않는다.

재검사: `node docs/handoffs/B/check-public-access.mjs`. 익명 API/문서 요청, 임시 filtered clone, 공통 지침 읽기, B fetch/문서 읽기를 실행하고 임시 폴더를 정리한다. 전체 에셋 checkout·push·상대 계정 세션은 검사하지 않는다. 새 공용 목록의 HTML/raw 200도 검사한다. 문서 목록은 role/b-render의 정확한 주소를 제공해 없는 main 파일을 추측해 여는 일을 예방한다.

현재 magic3ightball의 Codex/브라우저에서 404가 발생했다는 사용자 보고는 있으나 **실패 URL을 아직 받지 못해 해당 현상의 원인은 미확정**이다. 새로운 공개 설정 변경이나 초대 재발송을 성공으로 보고하지 않는다.

## 반영 후 확인

[공개 링크 결과](evidence/work-document-links-live.json): main에 반영된 실제 목록에서 주소를 다시 추출해 저장소 첫 화면·목록 HTML/raw·연결 대상 총 41개를 익명 GET으로 확인했고 모두 200이었다. 17개 B Markdown의 상대 파일 링크 74개도 로컬 실제 파일과 대조해 누락이 없었다. 로그인하지 않은 Chromium에서 README의 목록 링크를 누르고 B 인계 문서를 다시 눌러 정상 도착했으며 [화면](evidence/public-document-navigation.png)을 보존했다.

반영 직후 한 독립 재검사에서 AGENTS.md가 503을 응답한 기록은 `public-access-transient-503.json`에 보존했다. 이후 같은 검사 전체가 성공해 `public-access-check.json`에 기록됐다. 이 일시 응답을 404 수정이나 권한 문제로 해석하지 않는다.
