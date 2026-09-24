# macOS Safari 관찰

2026-09-24 KST. Safari 27.0 (22625.1.29.11.27). 설치 앱의 Info.plist로 버전을 읽었고, Computer Use로 실제 Safari에 별도 로컬 탭을 열었다. 검사 후 해당 탭만 닫았다.

- 페이지: `/docs/handoffs/B/preview.html`, 로컬 Vite 개발 서버.
- 실제 WebGL 작업대/4종 모델/유리 면이 화면에 나타나는 것을 UI 스크린샷으로 관찰했다.
- native phase 메뉴에서 `Compressing`을 선택했을 때 40% fixture가 반영됐다. 압력/회전 slider를 실제 클릭했을 때 77% / 101°로 변경됐고 프레스와 물건이 바뀌었다.
- 안정화 후 화면에 표시된 **rolling 600 rAF** 값: 60 FPS, P95 17–18ms, DPR 1. 전체 화면 약 1920×990px에 브라우저 chrome가 포함된 창이었다. 이것은 브라우저 표기 관찰이며 별도 전체 기간 raw 샘플이나 GPU profiler 측정이 아니다.
- 개발 중 HMR 뒤 한 번 `window: Script error.`가 나타났다. 출처는 특정하지 못했다. 전체 새로고침 후 사라졌고 위 조작 검사 동안 재현되지 않았다. 이를 Safari 전체 오류 없음 또는 production 안정성 증거로 확대하지 않는다.
- 네이티브 UI 관찰은 현재 작업의 Computer Use 기록에 남으며 이 문서에 별도 Safari PNG 파일은 저장하지 않았다. Chromium PNG를 Safari 캡처라고 제시하지 않는다.

이 검사는 실제 iPhone Safari, 모바일 열/메모리, 터치 취소/복귀, A/C 게임 루프, 3분 실제 플레이를 검증하지 않았다.
