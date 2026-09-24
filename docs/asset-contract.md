# DEEP PRESS 에셋 계약 v1.0.0

담당 B는 `src/render/**`, `public/assets/**`, `assets/source/**`, `tests/render/**`, `docs/handoffs/B/**`를 소유한다. 타입은 `src/contracts/index.ts`, 런타임 registry는 `src/render/assets.ts`다. bootstrap의 **런타임 네 항목은 placeholder**다. ImageGen 콘셉트 5장과 Meshy 7 master 2개는 생성돼 [source 목록](../assets/source/meshy/README.md)에 보존됐다. master는 generated-unverified이며 모바일용 파일·축·피벗·변형이 아직 준비되지 않았으므로 런타임 registry에 등록하지 않았다. 실제 게임 화면·검증된 런타임 GLB와 구분한다.

## 고정 asset ID와 산출물

| ID | 용도 | 런타임 기본 경로 |
|---|---|---|
| press-chamber | 사실적인 유압 프레스 작업대 | `public/assets/models/press-chamber.glb` |
| salvage-core | 금속 회수물 | `public/assets/models/salvage-core.glb` |
| salvage-lens | 유리 렌즈 회수물 | `public/assets/models/salvage-lens.glb` |
| salvage-cassette | 복합재 회수물 | `public/assets/models/salvage-cassette.glb` |

registry의 runtimePath는 `assets/models/...glb`처럼 public을 제외한 상대 경로다. renderer는 `import.meta.env.BASE_URL`과 결합하여 itch.io 하위 경로에서 읽는다. `/assets/...`와 외부 CDN 절대 경로는 사용하지 않는다. GLB는 필요한 재질·텍스처를 포함하고 파일명 대소문자를 정확히 맞춘다.

좌표는 m, +Y up, +Z forward. 피벗은 base-center, 회전은 rad, 각 파일의 실제 heightM·triangle 수를 측정해 registry에 기록한다. config의 liter 용량과 3D mesh 크기는 별개의 값이다. mesh bounds나 scale로 게임 용량·손상·점수를 다시 계산하지 않는다.

## ImageGen → Meshy 7 lineage

1. 승인된 PRD·콘셉트에 맞춘 ImageGen 이미지와 프롬프트를 `assets/source/<id>/`에 저장한다.
2. 사용한 원본 이미지 경로, 생성 시각(ISO 8601), 생성 프롬프트 경로를 registry.imagegen에 기록한다.
3. Meshy의 실제 사용 가능한 모델을 확인하고 **Meshy 7 flagship** 작업을 사용한다. Meshy taskId·생성 시각·modelVersion `meshy-7`을 기록한다. 미지원 또는 접근 불가를 다른 모델로 조용히 바꾸지 않는다.
4. 4K PBR 원본과 원본 모델을 source 폴더에 보존하고 모바일용 GLB를 별도로 만든다. 원본이 실제 4K인지 파일 해상도를 확인한다. 특정 텍스처가 없으면 존재한다고 기재하지 않는다.
5. 런타임에는 필요한 해상도·geometry로 최적화하고 최적화 전후 파일 크기·triangle·texture 해상도를 handoff에 남긴다. 4K source를 그대로 모두 로드하는 계획으로 실기기 성능을 가정하지 않는다.

`sourcePath`는 원본 디렉터리 또는 manifest를 가리킨다. `licenseNote`에는 사용 도구/외부 자료 출처와 필요한 표시를 남긴다. 실제 권리 조건을 확인하지 않고 “상업 이용 자유” 등으로 단정하지 않는다.

## 상태 의미와 검증

| 상태 | 의미 |
|---|---|
| placeholder | 생성·최종 파일 미존재. runtimePath/taskId/verifiedAt은 null |
| generated-unverified | 생성 결과와 lineage가 있지만 scene·기기 적합성 검사 미완료 |
| verified | 파일·축·피벗·재질·기기 로드·시각 비교가 검증되어 reviewer/시각/reportPath가 존재 |

`assertAssetRegistry`는 ID·출처 필수값·상태의 최소 일관성을 검사한다. 이 함수 통과 자체는 실제 파일 존재, GPU 렌더, 생성 작업 사실 또는 iPhone 성능을 보장하지 않는다. B는 별도 검증 보고서로 파일 경로와 해시, GLB 로드, bounds, triangle 수, texture 해상도, 촬영 기기/브라우저, 프레임 성능을 남긴다. 실기기 검사를 못 했으면 verified로 올리지 않고 미검증 원인을 기록한다.

압축 표현은 초기/중간/강한 압축의 2–3개 authored state 또는 morph로 준비한다. 실시간 범용 soft-body 시뮬레이션은 범위가 아니다. 압축·파손 정도는 snapshot의 pressure01/compression01/integrity01에서 읽으며 B가 판정을 새로 만들지 않는다. 별도 변형 GLB가 필요하면 `assets/models/<id>-compressed.glb`처럼 파생 파일을 두고 registry.sourcePath가 가리키는 manifest에 대응표를 기록한다. 새 공개 타입이 필요하면 공유 변경 절차를 따른다.

오디오 에셋·합성음·재생 모듈은 범위에서 제외한다. loader 실패 시 개발 중에는 명시적인 placeholder와 오류 상태를 제공하고, 최종 제출에서는 누락을 성공으로 숨기지 않는다.
