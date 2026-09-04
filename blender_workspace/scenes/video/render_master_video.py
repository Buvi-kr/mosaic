"""
================================================================================
🎬 MASTER VIDEO CONCATENATOR WITH CINEMATIC FADES (Blender 5.2 VSE)
================================================================================
- scenes/video 폴더의 1번, 2번, 3번, 4번, 5번 영상을 우아한 페이드 인/아웃으로 연결
- 1920x1080 @ 60fps 고화질 H.264 마스터 영상 출력
================================================================================
"""

import bpy
import os
import traceback

def main():
    print("\n" + "="*75)
    print("🎬 [MASTER VIDEO] 1~5번 시네마틱 비디오 마스터 병합 & 페이드 인/아웃 시작")
    print("="*75)

    video_dir = r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\scenes\video"
    desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")

    video_files = [
        os.path.join(video_dir, "cinematic_1번사진.mp4"),
        os.path.join(video_dir, "cinematic_2번사진.mp4"),
        os.path.join(video_dir, "cinematic_3번사진.mp4"),
        os.path.join(video_dir, "cinematic_4번사진.mp4"),
        os.path.join(video_dir, "cinematic_5번사진.mp4"),
    ]

    valid_videos = []
    for vf in video_files:
        if os.path.exists(vf):
            valid_videos.append(vf)
            print(f"   ✅ 영상 확인: {os.path.basename(vf)} ({os.path.getsize(vf) / (1024*1024):.1f} MB)")
        else:
            print(f"   ⚠️ 영상 누락: {vf}")

    if not valid_videos:
        raise FileNotFoundError("❌ 병합할 영상 파일을 찾을 수 없습니다.")

    scene = bpy.context.scene

    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.fps = 60

    # VSE (Video Sequence Editor) 생성 및 스트립 정리
    if not scene.sequence_editor:
        scene.sequence_editor_create()
    
    seq_editor = scene.sequence_editor
    for st in list(seq_editor.strips):
        seq_editor.strips.remove(st)

    output_path = os.path.join(video_dir, "cinematic_master_full.mp4")
    desktop_output_path = os.path.join(desktop_dir, "cinematic_master_full.mp4")

    scene.render.filepath = output_path
    if hasattr(scene.render.image_settings, 'media_type'):
        scene.render.image_settings.media_type = 'VIDEO'
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.ffmpeg.audio_codec = 'AAC'

    current_frame = 1
    FADE_FRAMES = 45 # 0.75초 부드러운 페이드
    BLACK_GAP_FRAMES = 15 # 클립 간 0.25초 블랙 갭

    print(f"\n[타임라인 스트립 배치 중... (Fade: {FADE_FRAMES}프레임 / Black Gap: {BLACK_GAP_FRAMES}프레임)]")

    for idx, vpath in enumerate(valid_videos):
        vname = os.path.splitext(os.path.basename(vpath))[0]
        channel = 1 + (idx % 2)

        # 무비 스트립 추가
        strip = seq_editor.strips.new_movie(
            name=vname,
            filepath=vpath,
            channel=channel,
            frame_start=current_frame
        )

        strip_len = strip.frame_final_duration
        strip_start = current_frame
        strip_end = strip_start + strip_len - 1

        print(f"   🎞️ [{idx+1}/{len(valid_videos)}] {vname}: F{strip_start} ~ F{strip_end} ({strip_len} frames / {strip_len/60:.1f}s)")

        # 페이드 인 (Fade In from Black)
        strip.blend_type = 'ALPHA_OVER'
        strip.blend_alpha = 0.0
        strip.keyframe_insert(data_path="blend_alpha", frame=strip_start)
        strip.blend_alpha = 1.0
        strip.keyframe_insert(data_path="blend_alpha", frame=strip_start + FADE_FRAMES)

        # 페이드 아웃 (Fade Out to Black)
        strip.blend_alpha = 1.0
        strip.keyframe_insert(data_path="blend_alpha", frame=strip_end - FADE_FRAMES)
        strip.blend_alpha = 0.0
        strip.keyframe_insert(data_path="blend_alpha", frame=strip_end)

        current_frame = strip_end + 1 + BLACK_GAP_FRAMES

    total_duration_frames = current_frame - BLACK_GAP_FRAMES - 1
    scene.frame_start = 1
    scene.frame_end = total_duration_frames

    print(f"\n📊 총 마스터 타임라인 길이: {total_duration_frames} 프레임 ({total_duration_frames/60:.2f} 초)")
    print(f"🎬 렌더링 시작 (출력: {output_path})...")

    bpy.ops.render.render(animation=True)

    # 바탕화면에도 복사
    try:
        import shutil
        shutil.copy2(output_path, desktop_output_path)
        print(f"   💾 바탕화면 복사 완료: {desktop_output_path}")
    except Exception: pass

    print("\n" + "="*75)
    print("🎉 [MASTER VIDEO] 1~5번 비디오 페이드 마스터 합본 렌더링 완료!")
    print(f"📁 최종 파일: {output_path}")
    print(f"📁 바탕화면: {desktop_output_path}")
    print("="*75 + "\n")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        traceback.print_exc()
