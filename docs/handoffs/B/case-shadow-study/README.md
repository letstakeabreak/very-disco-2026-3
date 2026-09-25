# 케이스 접촉 그림자 보완

출발 구현은 `1860ce0eb9933956fcc9b73c914611e184e6d57b`다. 작업대 높이의 평평한 그림자 면이 케이스 홈 안까지 지나가던 문제를 수정했다. 작업대 그림자 면에서 케이스 영역을 비우고, 기존 깊이 가림 형상에 그림자를 받는 면을 추가했다. 보관물 그림자는 측정한 폼 입구와 안쪽 벽에 나타난다.

배경 ImageGen 원본·모델·카메라·보관 배치는 유지했다. 새 면은 그림자만 합성하는 보조 형상이며, 케이스 전체를 가시 3D 모델로 교체한 것은 아니다. 앞면 가림용 형상과 geometry를 공유하고 종료 시 한 번만 해제한다. 양면 그림자를 한 패스로 그려 중복 그리기를 피한다.

## 실제 GPU 검사

[foreground-report.json](foreground-report.json)은 생산용 renderer에서 6가지 보관 순서 × 압축0/.55/1 × 390×844·320×568의 **36개 조건**을 검사한 결과다. 이전 그림자 면과 새 그림자 면을 같은 snapshot·카메라에서 전환하고 WebGL2 `readPixels`로 직접 비교했다. RGB 차이 기준은3/255 초과다.

- 조건별369–1,172픽셀이 달라졌고, 지정한 케이스 영역 밖 변화는 모두0이었다.
- 깊이 가림과 그림자 면을 함께 끈 화면 및 빈 케이스와도 비교했다. 새 상태에서 지정한 케이스 앞면 영역의 차이는0이었다. 홈 내부 차이에는 그림자가 포함되므로 이를 물건의 정확한 면적이라고 해석하지 않는다.
- 실제 GLB 정점의 보수적 화면 범위는 겹침·잘림 없이 유지됐다. 최소 수평 간격13.84px, B 연구용130px 하단 패널까지 최소5.60px였다. 실제 C HUD의 가림을 해결했다는 뜻은 아니다.
- 모델4개 로드, 브라우저 오류·Three 중복 경고0, 소스13개 전후 해시 일치, 전후 PNG12장 해시를 확인했다.
- 정지 자세의 그리기27→28회, 모든 패스 삼각형193,194→193,272, stage의 보수적 visibleTriangles105,096→105,168이다. 움직이는 프레임에는 그림자 갱신 비용이 별도로 든다. 실제 iPhone FPS는 재측정하지 않았다.

| 실제 실행 화면 | 이전 면 | 새 면 |
|---|---|---|
| 390폭·압축.55 | [이전](foreground-captures/390-compression-0.55-before.png) | [현재](foreground-captures/390-compression-0.55.png) |
| 320폭·압축0 | [이전](foreground-captures/320-compression-0-before.png) | [현재](foreground-captures/320-compression-0.png) |
| 320폭·압축1 | [이전](foreground-captures/320-compression-1-before.png) | [현재](foreground-captures/320-compression-1.png) |

육안으로 보관물 아래의 떠 보이던 그림자가 줄고 케이스 안쪽에 붙는 음영을 확인했다. 작은 화면에서 차이는 미세하다. 배경의 고정 음영, 수동 측정한 홈 경계, 사진 기반의 깊이 근사라는 한계가 남는다. 전체 아트 목표·물리 수납·실제 게임플레이·iPhone 검증의 합격을 뜻하지 않는다.

## 재현과 코드 검사

개발 서버를 실행한 뒤 다음 검사를 사용한다.

```sh
node node_modules/typescript/bin/tsc --project docs/handoffs/B/case-shadow-study/tsconfig.json --noEmit
node docs/handoffs/B/case-shadow-study/check.mjs http://127.0.0.1:4177
```

`npm run check`의69테스트·타입·고정23파일·19모듈 경계·build와 B 소유권 검사를 통과했다. 기존 raycast 회귀 검사에 케이스 영역의 작업대 면 제거, 입구/벽 일치, 공유 geometry·그림자 material의 단일 해제를 추가했다. 빌드 합계12,187,776bytes, JS690,279bytes로20MB 초기 예산 이내이며 Vite의500kB chunk 권고 경고는 남는다.

사용자의 현재 iPhone 연결 불가에 따라 실기기 재측정은 하지 않았다. 이전 A/B/C 연결 검사와 실제 iPhone 측정은 각 문서의 고정 revision 기록으로 유지한다.
