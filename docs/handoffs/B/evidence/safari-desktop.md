# macOS Safari 관찰

2026-09-24 KST. Safari 27.0 (22625.1.29.11.27). 설치 앱의 Info.plist로 버전을 읽었고, Computer Use로 실제 Safari에 별도 로컬 탭을 열었다. 검사 후 해당 탭만 닫았다.

- 페이지: `/docs/handoffs/B/preview.html`, 로컬 Vite 개발 서버.
- 실제 WebGL 작업대/4종 모델/유리 면이 화면에 나타나는 것을 UI 스크린샷으로 관찰했다.
- native phase 메뉴에서 `Compressing`을 선택했을 때 40% fixture가 반영됐다. 압력/회전 slider를 실제 클릭했을 때 77% / 101°로 변경됐고 프레스와 물건이 바뀌었다.
- 안정화 후 화면에 표시된 **rolling 600 rAF** 값: 60 FPS, P95 17–18ms, DPR 1. 전체 화면 약 1920×990px에 브라우저 chrome가 포함된 창이었다. 이것은 브라우저 표기 관찰이며 별도 전체 기간 raw 샘플이나 GPU profiler 측정이 아니다.
- 개발 중 HMR 뒤 한 번 `window: Script error.`가 나타났다. 출처는 특정하지 못했다. 전체 새로고침 후 사라졌고 위 조작 검사 동안 재현되지 않았다. 이를 Safari 전체 오류 없음 또는 production 안정성 증거로 확대하지 않는다.
- 네이티브 UI 관찰은 현재 작업의 Computer Use 기록에 남으며 이 문서에 별도 Safari PNG 파일은 저장하지 않았다. Chromium PNG를 Safari 캡처라고 제시하지 않는다.

이 검사는 실제 iPhone Safari, 모바일 열/메모리, 터치 취소/복귀, A/C 게임 루프, 3분 실제 플레이를 검증하지 않았다.

## 계기판·파손 보완 후 재검사 (22:21–22:25 KST)

HMR 없는 정적 production 빌드도 별도로 만들었다. 같은 B preview 입력을 Vite 8.3.0으로 `/tmp/deep-press-b-static-preview`에 빌드하고 로컬 4174 포트에서 제공했다. nested preview 경로 점검용 `base: '/'`를 사용했으며 공통 설정 파일은 수정하지 않았다. 이것은 최종 itch.io 패키지 경로 검사가 아니다. 최종 bundle은 `preview-DxQ9AKd7.js`였다.

기존 Safari 일반 프로필에서는 dev와 static 양쪽에 `window: Script error.`가 나타났다. 콘솔은 `SyntaxError: Unexpected token '{'. Expected ')' to end a compound expression.`를 보여 주었지만 소스 위치가 없었다. 따라서 이전의 HMR 관련 추정을 원인 확정으로 읽으면 안 된다. 같은 static 빌드의 임시 Private Browsing 창에서는 해당 오류가 재현되지 않았다. 프로필·확장 환경 차이와 관련될 수 있지만 특정 확장이 원인이라고 확정하지 않았다. 브라우저 설정·확장 권한은 바꾸지 않았다.

실제 Safari 메뉴로 Failed/Optical lens를 선택해 빠진 유리 조각과 압력 100%의 오른쪽 바늘을 확인했다. 이후 최종 그림자 설정으로 새로고침하고 Compressing 40% → 실제 slider 클릭 50%를 확인했다. 바늘이 위를 향했고, 안정화된 rolling 600 rAF는 60 FPS / P95 17–18ms / DPR1이었다. 최종 임시 창의 Console은 오류·경고 없이 비어 있었다. 초기 로드의 긴 프레임을 포함한 전체 3분 통계는 수집하지 않았다.

콘솔에서 발견한 Three r186의 `PCFSoftShadowMap` 제거 경고는 설치 소스의 PCF 자동 치환을 확인하고 `PCFShadowMap`을 직접 지정해 없앴다. 실제 그림자 방식은 같으며 최종 코드로 Chromium 캡처·소스 해시도 다시 수집했다. 임시 Safari 창과 이전 검증 탭은 종료했고, 사용자의 기존 두 탭은 유지했다.
