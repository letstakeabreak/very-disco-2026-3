# 실제 기기 렌더러 검증 도구

이 도구는 B의 공개 `createRenderer`와 기존 render-study를 사용하는 로컬 QA 하네스다. A의 게임 판정·C의 터치 입력을 실행하지 않는다. 웹 페이지의 iPhone user-agent만으로 실기기라고 판정하지 않으며, 연결된 실제 기기의 Xcode 정보와 직접 화면 캡처를 함께 확인한다.

## 실행

저장소 루트에서 다음을 순서대로 실행한다. 공유 설정·의존성은 바꾸지 않는다.

```sh
node node_modules/typescript/bin/tsc --project docs/handoffs/B/device-qa/tsconfig.json --noEmit
node docs/handoffs/B/device-qa/build.mjs
node docs/handoffs/B/device-qa/server.mjs
```

빌드는 `/tmp/deep-press-b-device-qa`에 생성된다. 서버는 4175 포트에서 이 정적 출력만 제공한다. 검사 중 재빌드하지 않는다. Mac과 같은 Wi-Fi의 LAN 주소, 또는 페어링된 USB 기기의 CoreDevice 터널에서 Mac 쪽 IPv6 주소를 사용할 수 있다. 후자는 `devicectl device info details`의 기기 터널 주소와 Mac의 `ifconfig`를 대조해 확인하며 주소를 추측하지 않는다. IPv6는 URL에서 대괄호로 감싼다. 출력된 `run` 값을 붙인 `docs/handoffs/B/preview.html`을 실제 Safari에서 연다.

`devicectl device process launch --payload-url`로 Safari에 URL을 전달하고, `devicectl device capture screenshot`으로 기기 화면 자체를 촬영할 수 있다. 연결 식별자·UDID·기기 이름·세션 ID는 로컬 실행에만 사용하고 인계 파일에 기록하지 않는다. 기본 앱을 종료하거나 사용자 설정을 변경할 필요는 없다.

## 상태 제어와 측정

Mac의 `http://127.0.0.1:4175/qa/command`에 JSON POST를 보낸다. 이 제어 요청은 loopback에서만 허용한다.

- 상태: `{"action":"setState","controls":{"phase":"inspecting","specimenId":"salvage-cassette","pressure01":0.55,"integrity01":0,"yawDeg":26,"storedCount":0}}`
- 3분 측정: `{"action":"soak"}`
- 확인: `GET /qa/status`. `ready`, `lastCommand`, `controls`를 확인한 뒤 촬영한다. 측정 중에는 상태 변경 명령을 추가하지 않는다.

기기 화면이 표시되고 모델 로딩이 끝난 뒤 측정을 시작한다. 20초씩 코어 검사/압착/파손, 렌즈 검사/파손, 카세트 검사/압착/파손, 보관 3칸을 표시한다. 회전과 압력·손상 값은 QA fixture가 직접 바꾸며 게임 공식이나 입력 검증이 아니다. 압력·손상 셰이더와 모델 회전을 포함하는 연속 렌더 부하다.

3분 전체 rAF 간격을 보존하고 전체·구간별 FPS/P95/max를 계산한다. 화면 아래의 최근 600프레임 값과 구분한다. 계측 중 요청은 10초마다 결과 수집에만 사용한다. 기기 화면 캡처·회전은 계측이 끝난 뒤 수행해 별도 작업의 부하를 섞지 않는다. hidden 전환·렌더 오류·P95 초과가 있으면 `passed`가 false가 된다. 이 필드는 사람의 시각 판정·전체 게임·iPhone 13급 합격을 뜻하지 않는다.

원시 결과와 빌드 해시는 `/tmp/deep-press-b-device-results`에 저장된다. 결과를 인계할 때 기기 모델/실제 OS, Safari 버전, 날짜, 출발 commit와 미커밋 소스 해시, 전체 프레임, 촬영 조건, 검사 전후 해시 일치를 함께 남긴다. UA의 동결된 iOS 문자열을 실제 OS 버전으로 사용하지 않는다. Xcode의 확인된 버전을 사용한다.

실제 결과는 [기기 검증 기록](../device-acceptance.md)을 따른다. 전체 게임 입력·앱 복귀·사용자 인지 테스트와 PRD의 아트 판정은 별도다.
