# 압착 연출 — 옆으로 퍼지는 외피와 받침판 파편

2026-09-25. 출발점은 `integration/v1`의 `bbe18c46fc4e019070ae71527db692841ba82192`(PR #8 머지)다. B 소유 파일만 수정했다.

[아트 판정](../art-review.md)의 02 압력은 “램이 물체를 많이 가리고 보호판 접힘·파편의 설득력이 부족하다”로 미달이었다. 휴대폰 폭에서는 눌린 물건이 누름판 링 아래의 얇은 띠로만 보이고, 파손 상태도 거의 읽히지 않았다. 이번 변경은 링에 가려지지 않는 두 곳, 즉 물건의 옆면과 받침판 앞쪽 빈 공간에 압착과 손상을 표시한다.

## 구현

- **옆으로 퍼지는 외피** (`deformation.ts`): 금속 코어는 높이가 줄수록 가운데가 최대 18% 불룩해지는 barrel 형태가 된다. 렌즈·카세트는 위아래 보호 띠만 최대 10% 벌어지며, 가운데 유리·창·내부 축은 기존대로 강체다. 입력은 `pressure01`/확정 `compression01`뿐이다. 이전에 검증한 normal/tangent 식을 여인수 행렬(det(J)·J⁻ᵀ)로 일반화해 새 x·z 배율을 포함했다. 그림자 depth 셰이더도 같은 변형을 사용한다.
- **받침판 파편** (`debris.ts`): 누름판 앞쪽 받침판에 조각 24개를 부채꼴로 흩는다. 손상이 커질수록 더 많은 조각이 바깥으로 밀려난다. 코어는 강철·구리, 렌즈는 유리, 카세트는 세라믹·호박색 조각이다. 입력은 `1-integrity01`뿐이며 손상 약 4% 미만에서는 보이지 않는다. 배치는 고정 seed라서 같은 손상에는 항상 같은 조각 더미가 나온다. InstancedMesh 한 개(20삼각형×24)이고 그림자는 드리우지 않는다. 보관·대기·검사 전 상태에서는 사라진다.
- 둘 다 **시각 해석**이다. 안전 압력이나 손상 시작점을 렌더러가 계산하거나 미리 보여 주지 않으며, 물리·파괴 시뮬레이션이 아니다.

## 검증

- `npm run check` 통과: 고정 23파일, TypeScript, 20모듈 경계, 14파일 **74테스트**, build. `npm run ownership -- --role B --base origin/integration/v1` 통과(29경로).
- 새 테스트 `tests/render/debris.test.ts` 4개(손상 0/부재/NaN에서 숨김, 손상에 따른 단조 증가와 고정 배치, 받침판 위·전방 부채꼴, 재질별 색)와 renderer 수명주기 1개(파손 fixture에서 프레스 파편 24개, 보관·완료·대기·검사에서 숨김).
- [GPU normal 수치 검사](../normal-study/README.md) 페이지를 변경본에서 실행: 실제 GLSL 출력 27조건 / 4,189표본, normal 최대 오차 0.065°, tangent 0.066°로 통과.
- [실제 WebGL 전후 기록](comparison.json): desktop Chromium, 390×844 9쌍 + 1024×1536 2쌍. 11쌍 모두 달라졌고 오류 0, 모델 4개 로드, 촬영 전후 소스 해시 일치. 파편이 보일 때 draw call이 28→30으로 늘어난다. 유리 투과 패스가 불투명 물체를 한 번 더 그리기 때문이다.

| 상태 (390×844) | 변경 전 | 변경 후 |
|---|---|---|
| 코어 압착 70% | [캡처](before/02-390x844-compressing-salvage-core.png) | [캡처](after/02-390x844-compressing-salvage-core.png) |
| 코어 파손 | [캡처](before/04-390x844-failed-salvage-core.png) | [캡처](after/04-390x844-failed-salvage-core.png) |
| 카세트 손상 40% | [캡처](before/06-390x844-inspecting-salvage-cassette.png) | [캡처](after/06-390x844-inspecting-salvage-cassette.png) |
| 카세트 파손 | [캡처](before/07-390x844-failed-salvage-cassette.png) | [캡처](after/07-390x844-failed-salvage-cassette.png) |
| 렌즈 파손 | [캡처](before/09-390x844-failed-salvage-lens.png) | [캡처](after/09-390x844-failed-salvage-lens.png) |
| 카세트 파손 1024×1536 | [캡처](before/11-1024x1536-failed-salvage-cassette.png) | [캡처](after/11-1024x1536-failed-salvage-cassette.png) |

모든 캡처는 생성 이미지가 아닌 실제 canvas 출력이며, 게임 판정을 실행하지 않는 fixture 상태다.

## 한계

- 누름판 링이 눌린 물건 윗면을 가리는 구도 자체는 그대로다. 카메라와 배경 plate를 바꾸지 않았다.
- 카세트·렌즈의 띠 벌어짐은 코어보다 약하다. 파편은 authored 조각이라 튀는 궤적이나 물리 충돌이 없다.
- 보관 케이스 안의 물건에는 파편이 없다. 보관물 손상 복원은 여전히 계약 확장이 필요하다.
- iPhone 확인은 사용자가 직접 한다. 이 기록은 데스크톱 Chromium 결과다.

## 재현

기준 checkout을 4176, 변경본을 4177에서 `npx vite --host 127.0.0.1 --port <port> --strictPort`로 띄운다. 그다음 저장소 루트에서 `node docs/handoffs/B/compression-study/capture.mjs <baseline-checkout>`를 실행한다.
