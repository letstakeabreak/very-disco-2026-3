# 카세트 내부 형상 조사

결론: 현재 Meshy master와 shipping GLB의 중앙 창에는 분리 가능한 내부 코어 형상이 없다. 투과 재질만 적용해 콘셉트의 내부 구조를 복원할 수 없다. 최적화 과정에서 내부 형상이 소실됐다는 증거도 없다.

`analysis.json`은 원본 1,158,358 triangles와 runtime 15,000 triangles를 폭 280mm, base Y=0으로 정규화해 비교한다. 두 파일 모두 1µm 위치 기준 UV seam 용접 후 연결 성분은 하나이며 경계/비다양체 edge는 0이다. 색상 기반 amber 선택은 재질 구역의 휴리스틱이며 실제 부품 경계를 보증하지 않는다.

각 파일의 중앙 창 영역을 통과한 81개 Z ray는 60개에서 앞·뒤 외면 두 번, 21개에서 여섯 번 교차한다. 실제 삼각형/평면 단면(`sections.svg`, source/runtime-sections.json)에서 추가 교차가 아래쪽 외부 프레임을 지나는 것임을 확인했다. 내부 box X±35mm, Y57–93mm, Z±37mm에는 AABB가 겹치는 triangle 자체가 0개다. 해당 box의 내부 표면 부재를 증명하며 모든 공간이나 실제 재료 체적의 속성을 주장하는 것은 아니다.

`captures/structure-cut.png`는 원본/런타임의 실제 면을 clipping한 WebGL이며 내부를 채우는 cap이나 새 geometry를 만들지 않았다. 청록은 원래 표면의 뒷면이다. `sections.png`는 실제 삼각형 교차선으로 그린 측정 도표다. 둘 다 생성 콘셉트나 게임 실행 캡처가 아니다. 원본/런타임 해시는 `capture-report.json`에서 촬영 전후 동일함을 확인했다.

후속 제작에는 내부 코어/외피가 드러난 ImageGen 제작용 원본과 Meshy 7 재구성이 필요하다. 새 유료 작업은 이 조사에서 실행하지 않았다. 기존 opaque amber를 투명 유리 완성으로 표시하지 않는다.

재현: numpy/Pillow가 설치된 Python으로 `analyze.py`, `sections.py`를 순서대로 실행한 뒤 개발 서버에서 `node docs/handoffs/B/cassette-structure-study/capture.mjs`. 뷰어는 개발 전용 master URL을 읽으며 63MB master를 제품 배포에 추가하지 않는다. GPU 정적 관찰이지 iPhone 성능/게임플레이 증거가 아니다.
