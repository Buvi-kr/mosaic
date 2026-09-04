# 🎬 Blender Workspace - 3D 모자이크 시네마틱 파이프라인 (Blender 5.2 LTS)

웹 모자이크 데이터를 기반으로 Blender 5.2 LTS에서 영화급 3D 시네마틱 애니메이션을 생성 및 렌더링하기 위한 통합 워크스페이스입니다.

---

## 🌟 공통 핵심 파이프라인 & 퀄리티 UP

* **🌌 12K 초고해상도 모자이크 아틀라스 (`mosaic_atlas.jpg`)**:
  * 수천 장(4,416~5,280개)의 고해상도 타일(128×128px)과 마스터 사진을 12,288px 크기로 정밀 합성하여 극초근접 줌인 시에도 칼같은 텍스처 퀄리티를 보장합니다.
* **🧊 입체 6개 면 완벽 UV 매핑**:
  * 3D 도미노 타일의 앞면(Top), 뒷면(Bottom), 4개 옆면(Rim) 전체에 정밀 UV 루프를 할당하여 회전/비행 중에도 텍스처 깨짐이나 왜곡이 전혀 없습니다.
* **🌈 True-Color sRGB 색상 매니지먼트 (`Standard` View Transform)**:
  * AgX/Filmic 뷰 트랜스폼의 색상 왜곡(원색 탈색, 어두워짐)을 방지하고 `Emission 1.0`을 통해 100% 원본 색감을 생생하게 구현합니다.
* **🔤 3D 시네마틱 한글 타이포그래피 (Frame 800 등장)**:
  * 모자이크 조립이 완성되는 Frame 800에 부드럽게 솟아올라 Frame 825에 안착하는 3D 타이틀입니다.
  * 사진별 배경 특성에 맞춘 맞춤형 컬러(24K 골드 / 선셋 골드 / 옐로우 / 순백색)와 **2D 균일 검은색 외곽선(Stroke Outline)**을 적용하여 어떤 배경에서도 완벽한 가독성을 제공합니다.

---

## 🎨 5개 씬별 테마 & 3D 타이틀 레지스트리

각 사진 폴더의 `.py` 파일은 외부 의존성 없이 **단독 실행 가능한 Full Python 스크립트**로 구성되어 있으며, 상위 `generate_mosaic_scene.py`를 통해서도 일괄/개별 제어가 가능합니다.

| 씬 폴더 | 모자이크 사진 테마 | 3D 타이틀 자막 | 타이틀 셰이더 & 스타일 | 3D 비행 궤적 & 카메라 동선 | 단독 실행 스크립트 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1번사진** | **포천 아트밸리 천주호 (야간)** | **`천주호 (야간)`** | 24K 리얼 앰버 골드 (`#FFAE19`) | **🌌 Cosmic Spiral Galaxy**<br>피보나치 황금 나선 궤적 & 360° 오비탈 선회 상승 | [`scenes/1번사진/1번사진.py`](scenes/1번사진/1번사진.py) |
| **2번사진** | **조각공원 (일몰)** | **`조각공원 (일몰)`** | 노을빛 선셋 골드 (`#FFB31F`) | **🌪️ Seamless 360° Harmonic Orbit**<br>은하수 폭포 & 360° 일체화 나선 상승 ➔ 정방향 탑뷰 안착 | [`scenes/2번사진/2번사진.py`](scenes/2번사진/2번사진.py) |
| **3번사진** | **천주호 (겨울)** | **`천주호 (겨울)`** | 쨍한 옐로우 골드 (`#FFE014`) + 딥 블랙 테두리 | **☄️ Zero-Spin Linear Breakthrough**<br>수천 장 앞면을 뚫고 솟구쳐 F550 즉시 바닥 턴 & 공허 0% 관람 | [`scenes/3번사진/3번사진.py`](scenes/3번사진/3번사진.py) |
| **4번사진** | **매표소 앞 (가을)** | **`매표소 앞 (가을)`** | 샴페인 순백색 (`#FFFFFF`) + 딥 블랙 테두리 | **🎴 Kinetic Domino Cascade**<br>75° 기립 전경 ➔ 가로/세로 대각선 대확산 & 2D 격자 스냅 | [`scenes/4번사진/4번사진.py`](scenes/4번사진/4번사진.py) |
| **5번사진** | **천문과학관** | **`과학관`** | 샴페인 순백색 (`#FFFFFF`) + 딥 블랙 테두리 | **🎢 Compact Framed Spiral**<br>2.6회전 나선 선로 1인칭 질주 ➔ 중앙 상공 룩다운 다이브 완성 | [`scenes/5번사진/5번사진.py`](scenes/5번사진/5번사진.py) |

---

## 📁 디렉토리 구조

```text
blender_workspace/
├── mosaic_cinematic.blend         🎬 [통합 마스터 3D 프로젝트] 5개 씬 전체 포함
├── generate_mosaic_scene.py       ⚙️ [통합 마스터 빌더] 5개 씬 선택/일괄 빌드 엔진
├── render_video.bat               🎥 [1클릭 MP4 렌더러] 개별/전체 영상 렌더링 배치
├── README.md                      📘 [통합 파이프라인 매뉴얼]
├── export_mosaic_data.js          🛠️ [새 모자이크 이미지 ➔ 씬 자동 추출기]
│
└── scenes/                        📂 [개별 모자이크 씬 보관소]
    ├── 1번사진/                   - 96x55 (5,280 타일) | 12K Atlas (22.5MB) | 천주호 (야간)
    │   ├── 1번사진.py             - 🌟 1번 전용 독립 풀 파이썬 스크립트
    │   ├── 1번사진.blend          - 1번 전용 3D 블렌더 파일
    │   ├── mosaic_atlas.jpg       - 12K 합성 아틀라스
    │   ├── master_mosaic.jpg      - 마스터 원본 사진
    │   └── mosaic_data.json       - 타일 좌표 메타데이터
    │
    ├── 2번사진/                   - 96x46 (4,416 타일) | 12K Atlas (21.9MB) | 조각공원 (일몰)
    ├── 3번사진/                   - 96x53 (5,088 타일) | 12K Atlas (30.2MB) | 천주호 (겨울)
    ├── 4번사진/                   - 96x46 (4,416 타일) | 12K Atlas (25.2MB) | 매표소 앞 (가을)
    └── 5번사진/                   - 96x46 (4,416 타일) | 12K Atlas (21.7MB) | 과학관
```

---

## 🚀 사용 및 렌더링 방법

### 1. 1클릭 자동 비디오 렌더링 (가장 편리함 ⭐)
* **`blender_workspace/render_video.bat`** 파일을 더블 클릭합니다.
* **`1`~`5`**: 해당 단일 씬 MP4 영상 렌더링 (18~21초)
* **`A`**: **1번 ➔ 2번 ➔ 3번 ➔ 4번 ➔ 5번이 물 흐르듯 순서대로 이어지는 1개의 102초 풀버전 마스터 영상(`cinematic_전체_통합_영상_0001-6120.mp4`)**으로 통합 렌더링!
* 모든 영상은 `blender_workspace/renders/` 폴더에 자동 저장됩니다.

### 2. Blender GUI에서 씬 감상 & 수동 렌더링
1. **`blender_workspace/mosaic_cinematic.blend`** 열기
2. 상단 우측 `Scene` 드롭다운에서 원하는 씬 선택 (1번사진 ~ 5번사진)
3. `Numpad 0` (카메라 뷰) ➔ `Spacebar` (실시간 재생)
4. `Ctrl + F12` (MP4 비디오 렌더링)

### 3. 마스터 스크립트로 씬 재생성/빌드
```powershell
cd blender_workspace

# 특정 씬만 빌드 (예: 3번사진)
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python generate_mosaic_scene.py -- --scene 3번사진

# 5개 씬 전체 빌드 & mosaic_cinematic.blend 통합 생성
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python generate_mosaic_scene.py -- --all
```
