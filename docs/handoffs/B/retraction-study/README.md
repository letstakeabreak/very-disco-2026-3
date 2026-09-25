# 램 검사 위치 보완

검사·대기·보관에서는 램을 원본 위치보다 90mm 위로 후퇴시킨다. 공개 renderer가 `RAM_RETRACTED_TRAVEL=-0.09`를 사용하며, 압착/정착/실패는 기존의 변형된 물건 상면 접촉식을 유지한다. 상단 연결을 고정하고 하단 플랜지를 강체 이동시키는 기존 smoothstep 변형이다. GLB와 접촉 기준점은 변경하지 않았다.

`geometry-report.json`은 실제 shipping GLB의 CPU 변형 조사다. 색상·그림자 셰이더와 같은 소수 8자리 경계를 적용했다. 전이 구간 길이 187.902mm에서 y 변환의 최소 미분은 `1-1.5a/L`이며 a=90mm일 때 0.28154로 양수다. 404개 상부 정점의 이동은 0이고, 1,272개 하부 정점은 90mm 이동한다. 이는 높이 뒤집힘이 없다는 증거이며 프레임과의 무충돌 증거가 아니다.

원본부터 램/프레임의 proper triangle 교차가 63쌍 있고 후퇴 90mm에서는 188쌍이다. 새 교차 위치는 Y=.78049–.82452m의 상부 하우징/분리 경계에 모여 있다. 이 자산의 기계 구조를 무교차로 승인하지 않는다. 정면·사선에서 열린 연결이나 하단 플랜지의 작업물 관통은 관찰되지 않았지만 모든 시점/연속 경로의 충돌 검사도 아니다.

`capture-report.json`과 `captures/`는 실제 GLB의 rest/retracted/contact를 정면·사선·390px 독립 검사 카메라에서 촬영한 9장이다. 카세트 scale1.1, yaw.45, 원상태 기준 bounds 간격은 25.1→115.1mm로 증가한다. contact에서는 compression .6의 bounds 접촉을 표시한다. 390px 독립 검사 카메라는 장비를 일부 자르므로 제품 모바일 구도의 증거로 쓰지 않는다. 제품 구도는 `../art-review/captures/01-*`를 본다.

`tests/render/ram.test.ts`는 실제 GLB 정점 높이 순서·고정 상단·강체 하부·색상/그림자 uniform 공유를 검사한다. lifecycle 회귀 테스트는 기존 비접촉 target=0 코드에서 실패했고, 검사/압착/복귀/취소/재시작 연결 수정 후 통과했다. 이 조사의 최초 revision `2c85981`에서는 접촉 진입이 즉시 이동이었다. 아래 2026-09-25 보완이 이 동작을 대체한다. 후퇴는 기존의 65ms 지수 보간을 유지한다.

## 2026-09-25 실제 렌더러의 접촉 진입

공개 `createRenderer`가 램을 프레스 로컬 공간에서 0.7m/s로 접근시킨다. 물건은 접촉 전 현재 모양을 유지하고, 접촉에 필요한 시간을 뺀 해당 프레임의 나머지 시간만 압축 보간에 쓴다. 접촉 이후 램은 변형된 상면을 그대로 따른다. 이는 시각 연출이며 코어의 압력·정착 시간·판정은 바꾸지 않는다. 첫 snapshot·재시작·일시정지는 authoritative 상태를 즉시 표시한다. 짧은 입력 해제 뒤 settling 동안에도 접근을 이어가고, pause 취소는 확정 형태와 검사 위치를 복원한다.

[motion-report.json](motion-report.json)은 **실제 production renderer**로 3종×31 프레임을 실행한 기록이다. GPU가 쓰는 uniform을 읽고 실제 GLB 정점 전체의 수직 셰이더 변형을 CPU에서도 계산해 간격을 대조했다. 390×844 / DPR1 / 데스크톱 Chromium에서 16ms씩 진행한 첫 접촉은 카세트 176ms, 코어·렌즈 144ms였다. 접촉 전 압축 0, 최소 수직 정점 간격 0m, 브라우저 오류 0. 이는 이 fixture와 기본 transform의 상하 간격 검사이며 모든 형상·임의 transform·하우징의 3D 충돌 보증이 아니다.

카세트의 실제 WebGL 캡처: [0ms](captures/motion-0ms.png), [48ms](captures/motion-48ms.png), [96ms](captures/motion-96ms.png), [144ms](captures/motion-144ms.png), [192ms](captures/motion-192ms.png), [320ms](captures/motion-320ms.png). 0/96/320ms를 육안 대조해 접촉 전 같은 형태와 낮아지는 램, 접촉 후 압착을 확인했다. 시각 목표의 작은 회수품·상부 가림 등 기존 미달은 해소됐다고 판단하지 않는다. 이것은 실제 시간 재생 영상이나 A/C 게임 루프 검증이 아닌, 시간을 수동 진행한 렌더 fixture다.

`lifecycle.test.ts`는 0ms 정지, 공중 압축 방지, 접촉 유지, 30/60/120Hz에 해당하는 프레임 분할, 짧은 해제/settling과 취소 후 재시작을 검사한다. 기존 즉시 접촉 구현에서 관련 기대값 3개가 실패한 뒤 수정 후 통과했다. 공개 계약이나 GLB·원본·유료 생성은 변경하지 않았다.

재현: 개발 서버에서 [motion.html](motion.html)을 열거나 `node docs/handoffs/B/retraction-study/motion-check.mjs` 실행. `motion.ts`도 루트의 strict TypeScript 옵션으로 별도 검사했다. 소스·모델과 캡처 SHA는 report에 보존한다.

재현: Blender 5.1.1에서 `--background --python docs/handoffs/B/retraction-study/measure.py`; 개발 서버를 연 뒤 `node docs/handoffs/B/retraction-study/capture.mjs`. 독립 뷰어의 조명은 촬영 당시 설정으로 보존하며 이후 production 반사 보정과 구분한다. 실제 iPhone·A/C 게임 흐름 검증은 없다.
