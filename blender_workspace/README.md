# 🎬 Blender Workspace - 3D 모자이크 시네마틱 파이프라인

웹 모자이크 데이터를 기반으로 Blender 5.2 LTS에서 영화급 3D 시네마틱 애니메이션을 생성 및 렌더링하기 위한 전용 워크스페이스입니다.

---

## 🌟 공통 핵심 파이프라인 (Phase 1 & Phase 5)
* **Phase 1 [Hero Tile Chase Opening] (Frame 1~140 / 0~2.3초)**:
  * 시작 시 공중에서 날아오는 첫 번째 대표 조각(Hero Tile) 바로 옆(거리 1.2m)에 카메라가 초밀착
  * 사진 속 얼굴과 감성적인 디테일이 1920x1080 화면에 가득 찬 상태로 모자이크 중심부로 비행 ➔ 바닥에 멋지게 안착
* **💎 True-Color 자체 발광 셰이더 (Emission 1.0)**:
  * 핫스팟/조명 편차 없이 수천 장의 사진 전체가 100% 원본 색감으로 선명하게 발광
* **Phase 5 [Full-Frame Showcase Finale] (Frame 900~1080 / 15~18초)**:
  * 1920x1080 화면을 100% 꽉 채우는 완전 직하강 수직 탑뷰(Top-Down Full View) 안착 & 완성작 감상

---

## 🎨 사진별 독창적 시네마틱 테마 & 풀 Python 스크립트

각 사진 폴더의 `.py` 파일은 외부 의존성 없이 **단독 실행 가능한 Full Python 스크립트**로 구성되어 있습니다.

| 사진 | 시네마틱 테마 | 타일 모이는 방식 (Geometry Nodes) | 카메라 구도 & 동선 | 단독 실행 스크립트 |
| :--- | :--- | :--- | :--- | :--- |
| **1번 사진** | **🌌 Cosmic Spiral Galaxy**<br>(나선 은하 볼텍스) | 피보나치 황금 나선(Fibonacci Spiral) 궤적을 그리며 고공에서 회전하며 중심 ➔ 외곽으로 소용돌이치며 안착 | 나선 소용돌이를 쫓아 360° 연속 오비탈(Orbital Spiral Up) 선회 상승 ➔ 수직 탑뷰 | [`scenes/1번사진/1번사진.py`](file:///c:/Users/Buvi/Desktop/project/mosaic_ver2/blender_workspace/scenes/1번사진/1번사진.py) |
| **2번 사진** | **🌪️ Seamless 360° Harmonic Orbit**<br>(부드러운 나선 360° & 정방향 안착) | 상공 60° 하향 첫 조각 비행 ➔ 은하수 폭포 ➔ **F160~980 점진적 가속 낙하와 일체화된 360° 나선 대회전** | High-Angle 60° 락온 ➔ 3초 완만 틸트업 ➔ 14.5초 단일 연속 360° 나선 상승 ➔ **F980 완성 순간 정방향 탑뷰 딱 안착!** | [`scenes/2번사진/2번사진.py`](file:///c:/Users/Buvi/Desktop/project/mosaic_ver2/blender_workspace/scenes/2번사진/2번사진.py) |
| **3번 사진** | **☄️ Meteor Cascade**<br>(유성우 중력 낙하) | 밤하늘에서 50° 사선 빗줄기로 쏟아져 내리는 유성우 낙하 & 탄성 스냅(Elastic Snapping) | 쏟아지는 유성우와 함께 마주보며 급강하(Front Dive Slope) ➔ 3/4 아이소메트릭 틸트 | [`scenes/3번사진/3번사진.py`](file:///c:/Users/Buvi/Desktop/project/mosaic_ver2/blender_workspace/scenes/3번사진/3번사진.py) |
| **4번 사진** | **💥 Radial Shockwave**<br>(방사형 충격파 & 크레인) | 4개 모서리에서 중앙으로 4개 스트림 수축 ➔ 중앙에서 방사형 파동(Radial Shockwave Burst) 도미노 도킹 | 웅장한 영화 오프닝 크레인(Jib/Crane Up & Dolly Back) ➔ 역동적 대각 팬 ➔ 수직 풀샷 | [`scenes/4번사진/4번사진.py`](file:///c:/Users/Buvi/Desktop/project/mosaic_ver2/blender_workspace/scenes/4번사진/4번사진.py) |

---

## 📁 디렉토리 및 씬 구조

```text
blender_workspace/
├── generate_mosaic_scene.py       ⭐ [마스터 빌더] 루트 최신 활성 씬 엔진
├── mosaic_cinematic.blend         (루트 최신 활성 씬 프로젝트)
├── export_mosaic_data.js          (새 모자이크 이미지 ➔ 씬 자동 추출기)
├── README.md                      (통합 매뉴얼)
│
├── scenes/                        📂 [개별 모자이크 씬 보관소]
│   ├── 1번사진/                   - 96x55 (5,280개 타일) | Cosmic Spiral Galaxy
│   │   ├── 1번사진.py             - 🌟 1번 전용 독립 풀 파이썬 스크립트
│   │   ├── 1번사진.blend          - 1번사진 전용 3D 블렌더 파일
│   │   ├── master_mosaic.jpg      - 원본 텍스처
│   │   └── mosaic_data.json       - 타일 좌표 데이터
│   ├── 2번사진/                   - 96x46 (4,416개 타일) | Ocean Wave Matrix
│   │   ├── 2번사진.py             - 🌟 2번 전용 독립 풀 파이썬 스크립트
│   │   └── ...
│   ├── 3번사진/                   - 96x53 (5,088개 타일) | Meteor Cascade
│   │   ├── 3번사진.py             - 🌟 3번 전용 독립 풀 파이썬 스크립트
│   │   └── ...
│   └── 4번사진/                   - 96x46 (4,416개 타일) | Radial Shockwave
│       ├── 4번사진.py             - 🌟 4번 전용 독립 풀 파이썬 스크립트
│       └── ...
│
└── old/                           📦 [이전 버전 아카이브]
```

---

## 🚀 사용 및 렌더링 방법

### 1. Blender에서 원하는 씬 실행 및 감상
1. Blender 실행 ➔ 원하는 씬의 `scenes/O번사진/O번사진.py` 열기
2. **▶ Run Script** 클릭 (단독으로 3D 씬이 즉시 빌드되고 전용 `.blend` 파일이 자동 저장됩니다)
3. `Numpad 0` (카메라 뷰) ➔ `Spacebar` (재생)

### 2. 고화질 MP4 비디오 렌더링
* Blender에서 **`Ctrl + F12`**를 누르면 바탕화면에 **`cinematic_O번사진.mp4`**로 깨끗하게 렌더링됩니다.

### 3. 새 모자이크 사진을 씬으로 추출할 때
```bash
# 원하는 output 사진을 넘기면 scenes/ 에 N번사진 폴더가 자동 생성됩니다.
node export_mosaic_data.js "../public/outputs/mosaic_1787212646452.jpg" 5번사진
```
