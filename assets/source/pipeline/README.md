# Meshy master → 모바일 GLB

원본 ImageGen/Meshy 파일은 수정하지 않는다. 모든 생성은 로컬 Blender 5.1.1에서 수행했으며 추가 Meshy 작업·크레딧을 사용하지 않았다. 최종 파일은 `public/assets/models/`의 네 GLB다. 이 폴더의 PNG는 **Blender 오프라인 검사 렌더**이고 게임 또는 iPhone 실행 캡처가 아니다.

## 재현

저장소 루트에서 실행한다.

```sh
python3 assets/source/pipeline/run_pipeline.py
```

Blender 경로는 `--blender /path/to/blender`로 지정한다. 기본값은 `/Applications/Blender.app/Contents/MacOS/Blender`다. `--skip-renders`는 파일 검증까지 실행하고 비교 렌더 생성을 건너뛴다. 실제 시각 확인을 통과했다는 뜻은 아니다.

1. `prepare_mobile.py`: master에서 실제 좌표로 부품 분리, collapse decimate, 최종 치수·base-center 정규화, 좌표 bake. `mobile-models.json`이 모델별 입력·목표·분리 영역이다.
2. `rebake_mobile.py`: glTF가 분리한 동일 좌표를 다시 weld하고 새 shared UV atlas를 만든다. 45° sharp edge와 면적 가중 노멀을 적용하고 master의 base color·metallic/roughness·normal을 새 atlas에 투영한다. **이 단계는 필수다.** decimation 뒤 원래 atlas를 그대로 사용하면 면마다 텍스처가 늘어나 금속 호일 같은 얼룩이 생긴다.
3. `validate_glbs.py`: GLB binary의 실제 accessor·indices·노멀·이미지·node transform·PBR·해시·크기·치수를 검사한다. 외부 URI·추가 decoder 없이 완결된 GLB여야 한다.
4. `verify_visuals.py`: 원본과 최적화 결과를 같은 조명·카메라에서 비교하고 press/lens 부품 선택을 확인한다.

부분 재베이크는 Blender의 `--python rebake_mobile.py -- salvage-lens` 형태로 실행한다. 중간 atlas PNG가 필요하면 마지막에 `--keep-bake-images`를 붙인다. 기본 배포에서는 GLB에 이미 들어 있는 이미지와 중복되는 PNG를 보관하지 않는다. 최초 생성 파일의 해시 기록은 `baked/manifest.json`에 남겼다.

렌즈 master는 Git 파일 크기 제한에 맞춘 lossless gzip chunk로 보존되어 있다. `source_io.py`는 manifest 순서대로 합치고 각 chunk·gzip·복원 GLB의 SHA-256을 확인한 다음 임시 디렉터리에서 읽는다. 원본 경로를 생성하거나 덮어쓰지 않는다.

## 최종 설정과 증거

- Base color와 tangent-space normal: 2048² JPEG. Metallic/roughness: 1024² JPEG, G=roughness/B=metallic. JPEG 품질 88. 원본의 4K color/normal과 2K MR은 master에 보존되어 있다.
- 좌표: glTF +Y up/+Z front, m. node transform은 identity이며 실제 vertex 좌표에 치수가 반영된다. pivot은 전체 모델 base-center다.
- 별도 tangent attribute와 geometry compression은 넣지 않았다. 현재 Three.js의 `normal_fragment_begin`은 tangent가 없으면 `getTangentFrame`으로 표면 미분에서 구한다.
- `mobile-model-report.json`: 원본→런타임 lineage, 설정, 해시, 압착기 anchors.
- `glb-validation.json`: 최종 파일을 다시 읽어 측정한 값.
- `runtime-anchors.json`: renderer용 부품·좌표 요약.
- `inspection/*-source.png`, `inspection/*-runtime.png`: 최종 같은 시점 비교. `press-basecolor-only.png`/`press-geometry-only.png`는 재베이크 전 원인 분리 증거다.
- `lens-probe/`는 별도 진단 실험이며 최종 런타임으로 사용하지 않는다.

새 모델에는 원본 bounds·정면·분리할 표면을 먼저 조사해 profile을 추가한다. 기존 press의 선택 box나 lens의 원형 선택을 다른 모델에 자동 적용하지 않는다. 모델 수가 늘면 예산과 검증 조건도 명시적으로 갱신한다. 전체 파일 검사 통과는 실제 기기 성능·게임 압착 변형·프레스 접촉 또는 유리 광학 품질의 검증을 대신하지 않는다.
