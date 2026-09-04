"""
================================================================================
🎬 3D MOSAIC CINEMATIC VIDEO RENDERER (Blender 5.2 LTS)
================================================================================
"""
import os
import sys
import subprocess

# Windows 콘솔 UTF-8 안전 출력 설정
try:
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BLENDER_EXE = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(BASE_DIR, "mosaic_cinematic.blend")
SCENES_DIR = os.path.join(BASE_DIR, "scenes")
OUT_DIR = os.path.join(BASE_DIR, "renders")

SCENES = {
    "1": ("1번사진", "천주호 (야간)   | 🌌 Cosmic Spiral Galaxy"),
    "2": ("2번사진", "조각공원 (일몰) | 🌪️ Seamless 360° Harmonic Orbit"),
    "3": ("3번사진", "천주호 (겨울)   | ☄️ Zero-Spin Linear Breakthrough"),
    "4": ("4번사진", "매표소 앞 (가을) | 🎴 Kinetic Domino Cascade"),
    "5": ("5번사진", "과학관         | 🎢 Compact Framed Spiral"),
}

def render_scene(scene_name):
    if not os.path.exists(OUT_DIR):
        os.makedirs(OUT_DIR, exist_ok=True)
    out_pattern = os.path.join(OUT_DIR, f"cinematic_{scene_name}_####")
    
    # 씬 전용 blend 파일 확인 우선 (독립적이고 안정적)
    scene_blend = os.path.join(SCENES_DIR, scene_name, f"{scene_name}.blend")
    target_blend = scene_blend if os.path.exists(scene_blend) else BLEND_PATH

    print("\n" + "="*75)
    print(f"[*] [{scene_name}] MP4 비디오 렌더링 시작...")
    print(f"[*] 프로젝트: {target_blend}")
    print(f"[*] 출력 위치: {out_pattern}.mp4")
    print("="*75)

    cmd = [
        BLENDER_EXE,
        "-b", target_blend,
        "-o", out_pattern,
        "-a"
    ]
    
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print(f"\n❌ [ERROR] [{scene_name}] 렌더링 실패 (코드: {res.returncode})")
        return False
    print(f"\n🎉 [SUCCESS] [{scene_name}] 렌더링 완료!")
    return True

def render_batch_all():
    print("\n" + "="*75)
    print("🚀 [BATCH RENDER] 1번~5번 전체 씬 순차 일괄 렌더링 시작 (총 5편)")
    print("="*75)
    success_count = 0
    for k in ["1", "2", "3", "4", "5"]:
        s_name, desc = SCENES[k]
        print(f"\n▶ [{k}/5] {s_name} ({desc}) 렌더링 진행 중...")
        if render_scene(s_name):
            success_count += 1
        else:
            print(f"⚠️ [{s_name}] 렌더링 중 오류가 발생했으나 다음 씬으로 계속 진행합니다.")
    print("\n" + "="*75)
    print(f"🏁 [BATCH FINISHED] 총 5개 씬 중 {success_count}개 렌더링 완료!")
    print(f"📁 출력 폴더: {OUT_DIR}")
    print("="*75 + "\n")

def render_master_movie():
    if not os.path.exists(OUT_DIR):
        os.makedirs(OUT_DIR, exist_ok=True)
    out_pattern = os.path.join(OUT_DIR, "cinematic_마스터_풀버전_####")
    print("\n" + "="*75)
    print("🌟 [MASTER MOVIE] 1번~5번 1편으로 이어진 102초 풀버전 마스터 무비 렌더링...")
    print(f"[*] 프로젝트: {BLEND_PATH} (씬: 전체_통합_영상)")
    print(f"[*] 출력 위치: {out_pattern}.mp4")
    print("="*75)

    cmd = [
        BLENDER_EXE,
        "-b", BLEND_PATH,
        "-S", "전체_통합_영상",
        "-o", out_pattern,
        "-a"
    ]
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print(f"\n❌ [ERROR] 마스터 풀버전 렌더링 실패 (코드: {res.returncode})")
        return False
    print(f"\n🎉 [SUCCESS] 102초 마스터 풀버전 렌더링 완료!")
    return True

def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1].upper()
        if arg in ["ALL", "--ALL", "-A", "B", "BATCH"]:
            render_batch_all()
            return
        elif arg in ["M", "MASTER"]:
            render_master_movie()
            return
        elif arg in SCENES:
            render_scene(SCENES[arg][0])
            return
        else:
            for k, (s_name, desc) in SCENES.items():
                if arg in s_name or arg in desc:
                    render_scene(s_name)
                    return

    print("="*75)
    print("🎬 [Blender 5.2] 3D 모자이크 시네마틱 비디오 렌더러")
    print("="*75)
    for k in sorted(SCENES.keys()):
        s_name, desc = SCENES[k]
        print(f"  [{k}] {s_name} - {desc}")
    print("  " + "-"*71)
    print("  [B] 🚀 [추천] 1번~5번 전체 씬 순차 일괄 렌더링 (5개 MP4 비디오 자동 생성)")
    print("  [M] 🌟 1번~5번 시네마틱 페이드 마스터 합본 풀버전 영상 생성")
    print("="*75)

    try:
        choice = input("선택 (1/2/3/4/5/B/M): ").strip().upper()
        if choice in ["B", "ALL", "BATCH"]:
            render_batch_all()
        elif choice in ["M", "MASTER", "A"]:
            render_master_movie()
        elif choice in SCENES:
            render_scene(SCENES[choice][0])
        else:
            print("[ERROR] 올바른 선택이 아닙니다.")
    except Exception as e:
        print(f"[ERROR] {e}")

    try:
        input("\n엔터 키를 누르면 종료됩니다...")
    except Exception:
        pass

if __name__ == "__main__":
    main()
