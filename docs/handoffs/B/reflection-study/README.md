# 금속 환경 반사 비교

실제 `createRenderer`에서 환경 맵만 바꾼 네 가지 390×844 DPR1 WebGL 비교다. source/runtime GLB/PBR, 카메라, 직접 조명, 압착 규칙을 바꾸지 않는다. 생성 이미지 편집이나 캡처 후처리는 없다.

- baseline: 기존 흰 RoomEnvironment 벽, 왼쪽 반사만 따뜻한 설정.
- dark-walls: MeshStandardMaterial 벽/박스의 반사색 ×.15, 왼쪽 카드 #ffd092.
- warm-card: dark-walls에 전방 +Z 카드도 #ffd092.
- balanced: 벽/박스 ×.35, 왼쪽 및 전방 카드 #ffe2ba. 나머지는 #edf3ff, 카드 폭 ×.45.

**balanced를 채택했다.** 흰 벽에서 오는 넓은 회색 반사가 줄고 게이지 테두리·기둥·기계 가장자리에 작업등 색이 보인다. .15 설정의 검은 영역 손실과 강한 황금색도 완화한다. 원본 콘셉트의 미세 마모/거칠기까지 재현한 결과는 아니므로 아트 전체 합격으로 올리지 않는다. near-black 금속의 세부와 작은 화면 가독성은 계속 검토해야 한다.

기존 코드는 MeshLambertMaterial 분기 안에만 벽 dimming을 두었지만 Three r186 RoomEnvironment 벽은 MeshStandardMaterial이라 실행되지 않았다. production과 별도 에셋 inspector에 실제 벽 재질 분기를 적용했다. GPU runtime mesh/texture 수·draw call 추가는 없으며 PMREM 생성 설정만 달라진다.

`production-before-reflection.ts.txt`는 최초 비교 때의 production 소스 보존본이다. `capture-report.json`은 각 실행의 실제 파일 SHA와 ready/오류 결과를 기록한다. 비교 harness는 baseline도 명시적인 이전 환경 설정으로 만들어, production 보정 뒤 재실행해도 네 후보의 의미를 유지한다. 현재 제품 화면은 `../art-review/capture-report.json`의 새 캡처로 확인한다.

재현: 개발 서버에서 `node docs/handoffs/B/reflection-study/capture.mjs`. 이는 정적 데스크톱 비교이며 iPhone 성능·게임플레이 검증이 아니다.
