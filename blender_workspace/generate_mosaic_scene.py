"""
================================================================================
🎬 MASTER CINEMATIC MOSAIC GENERATOR for Blender 5.2 LTS
================================================================================
[통합 마스터 3D 시네마틱 빌더]
- 5개 씬 (1번~5번)의 고유한 3D 비행 궤적 & 커스텀 타이틀 완벽 통합
- 12K 초고해상도 모자이크 아틀라스 (mosaic_atlas.jpg) 자동 연동
- 입체 6개 면 정밀 UV 언랩 및 True-Color sRGB (Standard 뷰 트랜스폼)
- 프레임 800 등장 3D 한글 타이포그래피 (스트로크 외곽선 & 커스텀 셰이더)

[지원 씬 목록]
 1. 1번사진: 천주호 (야간)   | 🌌 Cosmic Spiral Galaxy (24K 리얼 앰버 골드)
 2. 2번사진: 조각공원 (일몰) | 🌪️ Seamless 360° Harmonic Orbit (선셋 골드)
 3. 3번사진: 천주호 (겨울)   | ☄️ Zero-Spin Linear Breakthrough (비비드 옐로우 + 블랙 스트로크)
 4. 4번사진: 매표소 앞 (가을) | 🎴 Kinetic Domino Cascade (샴페인 순백색 + 블랙 스트로크)
 5. 5번사진: 과학관         | 🎢 Compact Framed Spiral (샴페인 순백색 + 블랙 스트로크)
================================================================================
"""

import bpy
import json
import os
import sys
import math
import random
import traceback
from mathutils import Vector, Euler

# ==============================================================================
# ⚙️ 씬 메타데이터 & 타이포그래피 레지스트리
# ==============================================================================
SCENE_CONFIGS = {
    "1번사진": {
        "title": "천주호 (야간)",
        "front_color": (1.0, 0.68, 0.10, 1.0),      # 24K 리얼 앰버 골드
        "front_roughness": 0.22,
        "front_metallic": 0.75,
        "front_emission": (1.0, 0.62, 0.08, 1.0),
        "front_emission_strength": 0.45,
        "use_stroke": False,
        "font_size": 0.95,
        "extrude": 0.025,
        "bevel_depth": 0.0025,
        "theme_name": "🌌 Cosmic Spiral Galaxy"
    },
    "2번사진": {
        "title": "조각공원 (일몰)",
        "front_color": (1.0, 0.70, 0.12, 1.0),      # 노을빛 선셋 골드
        "front_roughness": 0.2,
        "front_metallic": 0.75,
        "front_emission": (1.0, 0.65, 0.10, 1.0),
        "front_emission_strength": 0.5,
        "use_stroke": False,
        "font_size": 0.95,
        "extrude": 0.03,
        "bevel_depth": 0.002,
        "theme_name": "🌪️ Seamless 360° Harmonic Orbit"
    },
    "3번사진": {
        "title": "천주호 (겨울)",
        "front_color": (1.0, 0.88, 0.08, 1.0),      # 쨍한 비비드 옐로우 골드
        "front_roughness": 0.15,
        "front_metallic": 0.35,
        "front_emission": (1.0, 0.82, 0.05, 1.0),
        "front_emission_strength": 0.65,
        "use_stroke": True,
        "font_size": 0.95,
        "extrude": 0.035,
        "bevel_depth": 0.001,
        "theme_name": "☄️ Zero-Spin Linear Breakthrough"
    },
    "4번사진": {
        "title": "매표소 앞 (가을)",
        "front_color": (1.0, 1.0, 1.0, 1.0),        # 샴페인 순백색
        "front_roughness": 0.1,
        "front_metallic": 0.15,
        "front_emission": (1.0, 0.98, 0.95, 1.0),
        "front_emission_strength": 0.95,
        "use_stroke": True,
        "font_size": 0.95,
        "extrude": 0.035,
        "bevel_depth": 0.001,
        "theme_name": "🎴 Kinetic Domino Cascade"
    },
    "5번사진": {
        "title": "과학관",
        "front_color": (1.0, 1.0, 1.0, 1.0),        # 샴페인 순백색
        "front_roughness": 0.1,
        "front_metallic": 0.15,
        "front_emission": (1.0, 0.98, 0.95, 1.0),
        "front_emission_strength": 0.95,
        "use_stroke": True,
        "font_size": 1.05,
        "extrude": 0.035,
        "bevel_depth": 0.001,
        "theme_name": "🎢 Compact Framed Spiral"
    }
}

TOTAL_FRAMES = 1260
FPS = 60
RESOLUTION_X = 1920
RESOLUTION_Y = 1080

def build_scene(scene_dir):
    """지정된 씬 디렉토리의 mosaic_data.json과 스크립트를 기반으로 완전한 3D 씬을 빌드합니다."""
    scene_name = os.path.basename(os.path.abspath(scene_dir))
    config = SCENE_CONFIGS.get(scene_name, SCENE_CONFIGS["1번사진"])

    print("\n" + "="*80)
    print(f"🎬 [{scene_name}] {config['theme_name']} 씬 빌드 시작 (1,260 Frames)")
    print(f"📌 타이틀: {config['title']}")
    print("="*80)

    # 씬 전용 .py 스크립트 실행
    scene_script = os.path.join(scene_dir, f"{scene_name}.py")
    if os.path.exists(scene_script):
        print(f"🚀 전용 빌더 실행: {scene_script}")
        with open(scene_script, 'r', encoding='utf-8') as f:
            code = f.read()
        exec(code, {'__file__': scene_script, '__name__': '__main__'})
    else:
        print(f"❌ '{scene_script}' 스크립트를 찾을 수 없습니다.")

def build_all():
    """scenes 폴더의 모든 씬을 순차적으로 빌드합니다."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    scenes_root = os.path.join(base_dir, "scenes")
    if not os.path.exists(scenes_root):
        print("❌ 'scenes' 디렉토리가 존재하지 않습니다.")
        return

    for s_name in sorted(os.listdir(scenes_root)):
        s_path = os.path.join(scenes_root, s_name)
        if os.path.isdir(s_path) and s_name in SCENE_CONFIGS:
            try:
                build_scene(s_path)
            except Exception as e:
                print(f"⚠️ [{s_name}] 빌드 중 오류 발생: {e}")
                traceback.print_exc()

    # 🌟 5개 씬 전체를 'mosaic_cinematic.blend' 마스터 프로젝트 파일 하나로 통합 패키징!
    master_blend_path = os.path.join(base_dir, "mosaic_cinematic.blend")
    print("\n" + "="*80)
    print("📦 [마스터 프로젝트 통합] 5개 씬 전체를 'mosaic_cinematic.blend' 하나로 결합 중...")
    print("="*80)

    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        imported_scenes = []
        for s_name in sorted(SCENE_CONFIGS.keys()):
            s_blend = os.path.join(scenes_root, s_name, f"{s_name}.blend")
            if os.path.exists(s_blend):
                with bpy.data.libraries.load(s_blend) as (data_from, data_to):
                    data_to.scenes = data_from.scenes
                if data_to.scenes:
                    imp_scene = data_to.scenes[0]
                    imp_scene.name = s_name
                    imported_scenes.append(imp_scene)
                    print(f"   ➕ 통합 추가: [{s_name}]")

        # 🌟 1번~5번이 순서대로 이어지는 102초 풀버전 마스터 무비 시퀀서 씬 생성
        master_movie_scene = bpy.data.scenes.new("전체_통합_영상")
        master_movie_scene.render.resolution_x = 1920
        master_movie_scene.render.resolution_y = 1080
        master_movie_scene.render.fps = 60
        if hasattr(master_movie_scene.render.image_settings, 'media_type'):
            master_movie_scene.render.image_settings.media_type = 'VIDEO'
        master_movie_scene.render.image_settings.file_format = 'FFMPEG'
        master_movie_scene.render.ffmpeg.format = 'MPEG4'
        master_movie_scene.render.ffmpeg.codec = 'H264'
        master_movie_scene.render.ffmpeg.constant_rate_factor = 'HIGH'
        master_movie_scene.render.ffmpeg.ffmpeg_preset = 'GOOD'

        master_movie_scene.sequence_editor_create()
        seq = master_movie_scene.sequence_editor

        c_frame = 1
        for s_name in ['1번사진', '2번사진', '3번사진', '4번사진', '5번사진']:
            if s_name in bpy.data.scenes:
                sc_obj = bpy.data.scenes[s_name]
                seq.strips.new_scene(name=f'Strip_{s_name}', scene=sc_obj, channel=1, frame_start=c_frame)
                c_frame += (sc_obj.frame_end - sc_obj.frame_start + 1)

        master_movie_scene.frame_start = 1
        master_movie_scene.frame_end = c_frame - 1
        print(f"   🎬 [전체_통합_영상] 풀버전 시퀀스 씬 생성 완료: 총 {master_movie_scene.frame_end} 프레임 ({(master_movie_scene.frame_end/60.0):.1f}초)")

        if 'Scene' in bpy.data.scenes:
            bpy.data.scenes.remove(bpy.data.scenes['Scene'])

        bpy.context.window.scene = master_movie_scene
        try:
            bpy.ops.workspace.append_activate(idname='Video Editing')
        except Exception:
            pass

        bpy.ops.wm.save_as_mainfile(filepath=master_blend_path)
        print(f"\n🎉 [통합 완료] 최종 마스터 프로젝트 생성 완료: {master_blend_path}")
        print(f"👉 포함된 씬 목록: {[s.name for s in bpy.data.scenes]}")
    except Exception as e:
        print(f"⚠️ 마스터 파일 통합 중 알림: {e}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    scenes_root = os.path.join(base_dir, "scenes")

    target_scene = None
    args = sys.argv
    if "--all" in args:
        build_all()
        return

    for i, a in enumerate(args):
        if a == "--scene" and i + 1 < len(args):
            target_scene = args[i + 1]
            break

    if target_scene:
        s_path = os.path.join(scenes_root, target_scene)
        if os.path.exists(s_path):
            build_scene(s_path)
            return
        else:
            print(f"❌ '{target_scene}' 폴더를 찾을 수 없습니다.")
            return

    default_scene = os.path.join(scenes_root, "1번사진")
    if os.path.exists(default_scene):
        build_scene(default_scene)
    else:
        print("💡 사용법:")
        print("   blender.exe -b --python generate_mosaic_scene.py -- --scene 1번사진")
        print("   blender.exe -b --python generate_mosaic_scene.py -- --all")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        traceback.print_exc()
