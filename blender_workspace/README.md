# 🎬 Blender Workspace - 모자이크 3D 시네마틱 파이프라인 & 개별 씬 관리

본 디렉토리는 웹 모자이크 데이터를 기반으로 Blender 5.2 LTS에서 영화급 3D 시네마틱 애니메이션을 생성 및 렌더링하기 위한 전용 워크스페이스입니다.

---

## 📁 개별 씬(Scene) 관리 구조

각 모자이크 사진마다 `scenes/<모자이크명>/` 전용 폴더가 자동으로 생성되어 **독립적으로 관리 및 보관**됩니다!

```plaintext
blender_workspace/
├── scenes/                                    # 📂 개별 모자이크 씬 보관소
│   ├── mosaic_1787128738607/                  # 256x161 (41,216개 타일) 전용 씬
│   │   ├── master_mosaic.jpg                  # 원본 완성본 사진
│   │   ├── mosaic_data.json                   # 41,216개 타일 매핑 데이터
│   │   ├── mosaic_1787128738607.blend         # 저장된 블렌더 프로젝트
│   │   └── README.md                          # 씬 정보 요약
│   ├── mosaic_1787128633378/                  # 96x60 (5,760개 타일) 전용 씬
│   │   ├── master_mosaic.jpg
│   │   ├── mosaic_data.json
│   │   └── README.md
│   └── mosaic_1787128479002/                  # 54x34 (1,836개 타일) 전용 씬
│       ├── master_mosaic.jpg
│       ├── mosaic_data.json
│       └── README.md
│
├── master_mosaic.jpg                          # [현재 활성 씬] 완성본 사진
├── mosaic_data.json                           # [현재 활성 씬] 타일 데이터
├── mosaic_cinematic.blend                     # [현재 활성 씬] 블렌더 프로젝트
├── generate_mosaic_scene.py                   # 18초 360도 시네마틱 빌드 스크립트
├── export_mosaic_data.js                      # 씬 자동 생성 & 추출 스크립트
└── README.md                                  # 워크스페이스 매뉴얼
```

---

## 🛠️ 사용 및 전환 방법

### 1. 특정 사진을 블렌더 씬으로 추출/전환할 때
```bash
# 원하는 output 사진 경로를 인자로 넘기면 scenes/ 에 전용 폴더가 자동 생성되고 활성화됩니다.
node export_mosaic_data.js "../public/outputs/mosaic_1787128738607.jpg"
```
*(인자 없이 `node export_mosaic_data.js`를 실행하면 가장 최근에 생성된 모자이크가 자동으로 선택됩니다.)*

### 2. Blender에서 시네마틱 생성
1. Blender 실행 ➔ `generate_mosaic_scene.py` 열기
2. **▶ Run Script** 클릭
3. `Numpad 0` ➔ `Spacebar`로 18초 360도 시네마틱 감상!
4. 비디오 렌더링 시 바탕화면에 `cinematic_<씬이름>.mp4`로 자동 저장됩니다.
