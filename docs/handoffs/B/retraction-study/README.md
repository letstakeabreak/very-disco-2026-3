# 램 검사 위치 보완

검사·대기·보관에서는 램을 원본 위치보다 90mm 위로 후퇴시킨다. 공개 renderer가 `RAM_RETRACTED_TRAVEL=-0.09`를 사용하며, 압착/정착/실패는 기존의 변형된 물건 상면 접촉식을 유지한다. 상단 연결을 고정하고 하단 플랜지를 강체 이동시키는 기존 smoothstep 변형이다. GLB와 접촉 기준점은 변경하지 않았다.

`geometry-report.json`은 실제 shipping GLB의 CPU 변형 조사다. 색상·그림자 셰이더와 같은 소수 8자리 경계를 적용했다. 전이 구간 길이 187.902mm에서 y 변환의 최소 미분은 `1-1.5a/L`이며 a=90mm일 때 0.28154로 양수다. 404개 상부 정점의 이동은 0이고, 1,272개 하부 정점은 90mm 이동한다. 이는 높이 뒤집힘이 없다는 증거이며 프레임과의 무충돌 증거가 아니다.

원본부터 램/프레임의 proper triangle 교차가 63쌍 있고 후퇴 90mm에서는 188쌍이다. 새 교차 위치는 Y=.78049–.82452m의 상부 하우징/분리 경계에 모여 있다. 이 자산의 기계 구조를 무교차로 승인하지 않는다. 정면·사선에서 열린 연결이나 하단 플랜지의 작업물 관통은 관찰되지 않았지만 모든 시점/연속 경로의 충돌 검사도 아니다.

`capture-report.json`과 `captures/`는 실제 GLB의 rest/retracted/contact를 정면·사선·390px 독립 검사 카메라에서 촬영한 9장이다. 카세트 scale1.1, yaw.45, 원상태 기준 bounds 간격은 25.1→115.1mm로 증가한다. contact에서는 compression .6의 bounds 접촉을 표시한다. 390px 독립 검사 카메라는 장비를 일부 자르므로 제품 모바일 구도의 증거로 쓰지 않는다. 제품 구도는 `../art-review/captures/01-*`를 본다.

`tests/render/ram.test.ts`는 실제 GLB 정점 높이 순서·고정 상단·강체 하부·색상/그림자 uniform 공유를 검사한다. lifecycle 회귀 테스트는 기존 비접촉 target=0 코드에서 실패했고, 검사/압착/복귀/취소/재시작 연결 수정 후 통과했다. 접촉 진입은 기존대로 즉시 상면을 따르며 후퇴만 65ms 지수 보간을 사용한다. 새로 늘어난 이동 거리의 진입 애니메이션은 추가 개선 대상이다.

재현: Blender 5.1.1에서 `--background --python docs/handoffs/B/retraction-study/measure.py`; 개발 서버를 연 뒤 `node docs/handoffs/B/retraction-study/capture.mjs`. 독립 뷰어의 조명은 촬영 당시 설정으로 보존하며 이후 production 반사 보정과 구분한다. 실제 iPhone·A/C 게임 흐름 검증은 없다.
