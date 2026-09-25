# 카세트 내부 부품과 투명 깊이

2026-09-25. 기존 원본에는 내부 코어가 없어 재질만 투명하게 해도 속이 비었다. 새 내부 부품을 ImageGen으로 디자인하고 Meshy 7으로 재구성한 뒤, 모바일 GLB와 생산용 렌더러에 연결했다. 원래 숨겨진 구조를 복원했다는 주장이 아니다. 목표와의 완전한 일치·게임 완성·iPhone 합격은 아직 아니다.

## 생성과 보존

- [ImageGen 원본](../../../../assets/source/meshy/salvage-cassette/insert-v1/input.png), [실제 제출 프롬프트](../../../../assets/source/meshy/salvage-cassette/insert-v1/imagegen-request.json), [생성 기록](../../../../assets/source/meshy/salvage-cassette/insert-v1/provenance.json).
- 내장 ImageGen → Meshy CLI 0.4.0 image-to-3d, standard + 명시적 meshy-7, PBR/4k 요청. Task `01a0d437-8bf7-7546-80c3-0cca9fe2975a`, SUCCEEDED, 실제 30크레딧. 이번 보완 중 추가 유료 재생성은 없다.
- 원본 GLB 76,046,332 bytes / 1,620,068삼각형. 원본 color/normal 4096², metallic/roughness 2048². 모든 맵이4K라고 표시하지 않는다. [서비스 미리보기](../../../../assets/source/meshy/salvage-cassette/insert-v1/preview.png)는 게임 화면이 아니다.
- 인증·서명 URL을 포함한 CLI 로컬 메타데이터는 `.meshy-local/`에만 남기고 Git에서 제외한다.

## 실제로 고친 문제

처음 2,400삼각형을 요청한 단순화는 4,938에서 멈췄고, 끝 축을 잃어 전체 길이가 약17% 줄었다. 부품 자체도 유리통보다 너무 작았다. [기각한 측정](evidence/rejected-mobile-report.json), [단독 화면](evidence/before-insert.png), [조립 화면](evidence/before-assembled.png)을 보존했다.

원본 좌표에서 9,000삼각형으로 단순화하고 X길이 .18m·중심Y .074m를 목표로 배치했다. 원본 대비 각 축 extent 비율은 0.98–1.02 범위로 검사한다. 실제 경계·해시·2K color/normal 및1K MR 재베이크는 [모바일 보고서](../../../../assets/source/meshy/salvage-cassette/insert-v1/mobile-report.json)에 있다. [개선한 단독 화면](evidence/refined-insert.png)에서 양끝 축, 구리 띠, 가로 연결대를 확인했다.

완성된 외피 GLB와 내부 GLB의 embedded buffer를 합친다. 외피 geometry/텍스처 바이트를 재인코딩하지 않는다. [조립 보고서](../../../../assets/source/meshy/salvage-cassette/insert-v1/assembly-report.json)의 런타임은 4,037,856 bytes / 24,000삼각형 /2 meshes다. 고정 `salvage-cassette` ID와 로드 경로는 그대로이며 추가 네트워크 의존성이 없다.

`src/render/cassette.ts`는 원본 색상과 측정한 중앙X범위로 유리 면을 분류한다. 불투명 외피와 유리의 광학 패스를 분리해야 안쪽 축과 반대쪽 외피가 함께 보인다. 유리 패스는 같은 geometry buffer를 공유한다. 표면 마스크라 추가15,000삼각형을 처리하며 이 비용을 숨기지 않는다.

카세트는 렌즈처럼 프레임이 먼저 눌리고 유리·내부 축은 강체 이동한다. 같은 시각 압축 계수를 램 접촉 높이에 적용한다. snapshot의 부피·점수·무결성 판정은 바꾸지 않는다. 광학 마스크는 손상으로 어두워지기 전 원본 색상을 읽도록 셰이더 합성 순서를 고정했다. 공유 geometry·텍스처는 한 번만 해제한다.

## 검증 범위

[최신11장](../art-review/capture-report.json)은 실제 생산용 renderer9장과 독립 원위치 에셋2장이다. [카세트 근접](../art-review/captures/03-canonical.png), [390폭 검사](../art-review/captures/01-390.png), [390폭 압력](../art-review/captures/02-390.png), [320폭 보관](../art-review/captures/05-320.png)을 직접 열었다. 새 내부 축과 유리 깊이는 근접 화면에서 보인다. 모바일 장면에서는 작게 보이는 세부와 손상 식별 문제가 남는다. 오른쪽 유리 경계에 원본의 어두운 띠와 색상 분류 흔적도 남아 있다.

9개 생산용 장면은 ready/GLB4/error0, visible geometry105,096삼각형·33 draw calls를 보고했다. shadow/transmission 전체는281,192삼각형이며 visible 예산과 구분한다. 카세트 정적 뷰어는 파일24,000삼각형·8 draw calls다. 카메라·조명·새 셰이더·파일의 촬영 전후 해시는 capture report를 따른다. 실제 iPhone/터치/통합 게임 검증은 남아 있다.

재현: Blender로 `assets/source/meshy/salvage-cassette/insert-v1/prepare.py` 실행 → Python으로 같은 폴더의 `assemble.py` 실행 → `npm run check` → B 아트 캡처. 조립된 파일을 기존 외피 하나의 원본으로 재베이크하지 않도록 파이프라인이 오류를 내게 했다. 외피를 다시 만들 때는 원래 prepare/rebake 후 보존된 housing 입력을 갱신하고 해시를 검토해야 한다.

전용 `index.html`은 보존된 외피와 내부 파생본을 따로 읽는 광학 연구 뷰어다. 실제 게임 증거는 위 생산용 캡처를 사용한다. 이 연구 페이지의 확대나 원본 ImageGen 이미지를 게임 품질 합격 증거로 대체하지 않는다.
