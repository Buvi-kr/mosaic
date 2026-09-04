"""
================================================================================
🎬 [5번사진] COMPACT FRAMED SPIRAL & PERFECT CENTRAL TOP-VIEW (Blender 5.2 LTS)
================================================================================
- 화면 안에 100% 쏙 들어오는 컴팩트 나선 도로 & 정중앙 상공 전경 룩다운:
    1. 🌀 [16:9 프레임 맞춤형 컴팩트 2.6회전 나선 도로 (Compact Framed Spiral)]:
       - 화면 밖으로 삐져나가지 않도록 최대 반경을 8.8m로 컴팩트하게 제한!
       - 2.6바퀴로 촘촘하고 아름답게 감아올려, 정중앙 상공에서 보았을 때 모든 나선 코일과 바닥 레일이 화면 안에 100% 완벽히 포착!
    2. 🚀 [3.3초 쾌속 코너링 상승 질주 (F340~540 / 속도감 극대화)]:
       - 2.6바퀴의 촘촘한 코너를 다이내믹하게 질주하여 꼭대기 도달!
    3. 🚁 [정중앙 상공(Z=22m) 크레인 상승 & 완벽한 100% 전경 조망 (F540~780)]:
       - 타일에 전혀 가리지 않고, 나선 도로 전체와 바닥 S자가 16:9 프레임 중앙에 그림처럼 펼쳐지는 압도적 장관!
    4. 🎆 [F780 펑! 🎆 폭죽 버스트 ➔ 순차 다이브 100% 완성 (Frame 980)]:
       - 전경 감상 후 나선 도로가 "펑! 🎆" 터지며 바닥으로 촤자자작 빨려 들어가 Frame 980에 100% 완성!
    5. ⭐ [1920x1080 완성작 피날레 (F980~1260 / 4.7초)]: 완벽한 2D 모자이크 피날레!
================================================================================
"""

import bpy
import json
import os
import shutil
import math
import random
import traceback
from mathutils import Vector, Euler

TOTAL_FRAMES = 1260
FPS = 60
RESOLUTION_X = 1920
RESOLUTION_Y = 1080
SCENE_NAME = "5번사진"

ALL_DOCKED_FRAME = 980
FINALE_END_FRAME = 1260

def main():
    print("\n" + "="*75)
    print(f"🎬 [{SCENE_NAME}] Compact Framed Spiral & Central Top-View 빌드 시작")
    print("="*75)

    # --------------------------------------------------------------------------
    # [01/06] 씬 초기화 & 메모리 클린업
    # --------------------------------------------------------------------------
    print("[01/06] 씬 초기화 중...")
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        try: bpy.ops.object.mode_set(mode='OBJECT')
        except Exception: pass

    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        if col.name != "Collection": bpy.data.collections.remove(col)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)
    for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
    for block in list(bpy.data.images): bpy.data.images.remove(block)
    for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)
    for block in list(bpy.data.lights): bpy.data.lights.remove(block)
    for block in list(bpy.data.node_groups): bpy.data.node_groups.remove(block)
    for block in list(bpy.data.worlds): bpy.data.worlds.remove(block)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = TOTAL_FRAMES
    scene.render.fps = FPS
    scene.render.resolution_x = RESOLUTION_X
    scene.render.resolution_y = RESOLUTION_Y

    # 🌌 첨부 사진과 100% 동일한 고밀도 심우주 별빛(Dense Deep Space Starfield) 절차적 월드 셰이더
    world = bpy.data.worlds.new(name=f"World_Cosmic_{SCENE_NAME}")
    world.use_nodes = True
    w_nodes = world.node_tree.nodes
    w_links = world.node_tree.links
    w_nodes.clear()

    w_out = w_nodes.new('ShaderNodeOutputWorld')
    w_bg = w_nodes.new('ShaderNodeBackground')
    w_tc = w_nodes.new('ShaderNodeTexCoord')

    # Layer 1: 초고밀도 미세 별무리 (수천 개의 핀포인트 스타)
    v1 = w_nodes.new('ShaderNodeTexVoronoi')
    v1.inputs['Scale'].default_value = 400.0
    cr1 = w_nodes.new('ShaderNodeValToRGB')
    cr1.color_ramp.elements[0].position = 0.0
    cr1.color_ramp.elements[0].color = (2.2, 2.2, 2.2, 1.0)
    cr1.color_ramp.elements[1].position = 0.08
    cr1.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
    w_links.new(w_tc.outputs['Generated'], v1.inputs['Vector'])
    w_links.new(v1.outputs['Distance'], cr1.inputs['Fac'])

    # Layer 2: 선명하게 반짝이는 중형 별빛
    v2 = w_nodes.new('ShaderNodeTexVoronoi')
    v2.inputs['Scale'].default_value = 160.0
    cr2 = w_nodes.new('ShaderNodeValToRGB')
    cr2.color_ramp.elements[0].position = 0.0
    cr2.color_ramp.elements[0].color = (3.5, 3.5, 3.8, 1.0)
    cr2.color_ramp.elements[1].position = 0.055
    cr2.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
    w_links.new(w_tc.outputs['Generated'], v2.inputs['Vector'])
    w_links.new(v2.outputs['Distance'], cr2.inputs['Fac'])

    # Layer 3: 시인성을 높여주는 대형 발광 포인트 스타
    v3 = w_nodes.new('ShaderNodeTexVoronoi')
    v3.inputs['Scale'].default_value = 55.0
    cr3 = w_nodes.new('ShaderNodeValToRGB')
    cr3.color_ramp.elements[0].position = 0.0
    cr3.color_ramp.elements[0].color = (6.0, 5.8, 5.0, 1.0)
    cr3.color_ramp.elements[1].position = 0.04
    cr3.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
    w_links.new(w_tc.outputs['Generated'], v3.inputs['Vector'])
    w_links.new(v3.outputs['Distance'], cr3.inputs['Fac'])

    # 3개 별빛 레이어 가산 합성 (Add Mix)
    m1 = w_nodes.new('ShaderNodeMix')
    m1.data_type = 'RGBA'
    m1.blend_type = 'ADD'
    m1.inputs['Factor'].default_value = 1.0
    w_links.new(cr1.outputs['Color'], m1.inputs[6])
    w_links.new(cr2.outputs['Color'], m1.inputs[7])

    m2 = w_nodes.new('ShaderNodeMix')
    m2.data_type = 'RGBA'
    m2.blend_type = 'ADD'
    m2.inputs['Factor'].default_value = 1.0
    w_links.new(m1.outputs[2], m2.inputs[6])
    w_links.new(cr3.outputs['Color'], m2.inputs[7])

    w_links.new(m2.outputs[2], w_bg.inputs['Color'])
    w_bg.inputs['Strength'].default_value = 1.0
    w_links.new(w_bg.outputs['Background'], w_out.inputs['Surface'])
    scene.world = world

    desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")
    scene.render.filepath = os.path.join(desktop_dir, f"cinematic_{SCENE_NAME}.mp4")

    try:
        if hasattr(scene.render.image_settings, 'media_type'):
            scene.render.image_settings.media_type = 'VIDEO'
        scene.render.image_settings.file_format = 'FFMPEG'
        scene.render.ffmpeg.format = 'MPEG4'
        scene.render.ffmpeg.codec = 'H264'
    except Exception: pass

    # --------------------------------------------------------------------------
    # [02/06] 데이터 및 마스터 텍스처 로드
    # --------------------------------------------------------------------------
    print("[02/06] 데이터 & 텍스처 로드 중...")
    current_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else ""
    search_dirs = [
        current_dir,
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\scenes\5번사진",
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace"
    ]
    base_dir = ""
    data_file = None
    for d in search_dirs:
        if not d: continue
        candidate = os.path.join(d, "mosaic_data.json")
        if os.path.exists(candidate):
            data_file = candidate
            base_dir = d
            break

    if not data_file:
        raise FileNotFoundError(f"❌ '{SCENE_NAME}' 폴더에서 'mosaic_data.json'을 찾을 수 없습니다.")

    with open(data_file, 'r', encoding='utf-8') as f:
        mosaic_data = json.load(f)

    metadata = mosaic_data["metadata"]
    tiles = mosaic_data["tiles"]
    cols = metadata["cols"]
    rows = metadata["rows"]
    num_tiles = len(tiles)

    master_candidates = [
        os.path.join(base_dir, "master_mosaic.jpg"),
        os.path.join(base_dir, "..", "..", "master_mosaic.jpg"),
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\master_mosaic.jpg"
    ]
    master_img_path = None
    for p in master_candidates:
        if os.path.exists(p):
            master_img_path = os.path.abspath(p)
            break

    if not master_img_path:
        raise FileNotFoundError("❌ 'master_mosaic.jpg'를 찾을 수 없습니다.")

    atlas_candidates = [
        os.path.join(base_dir, "mosaic_atlas.jpg"),
        os.path.join(base_dir, "..", "..", "mosaic_atlas.jpg"),
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\mosaic_atlas.jpg"
    ]
    atlas_img_path = None
    for p in atlas_candidates:
        if os.path.exists(p):
            atlas_img_path = os.path.abspath(p)
            break

    print(f"   🎬 씬: [{SCENE_NAME}] | 타일: {len(tiles):,}개 ({cols}x{rows})")
    print(f"   🖼 마스터 텍스처: {master_img_path}")
    print(f"   🌌 아틀라스 텍스처: {atlas_img_path if atlas_img_path else '없음 (마스터 단독)'}")

    # --------------------------------------------------------------------------
    # [03/06] True-Color 2-Sided 머티리얼 구성
    # --------------------------------------------------------------------------
    print("[03/06] 2-Sided 머티리얼 구성 중...")
    mat_front = bpy.data.materials.new(name=f"Mat_Front_{SCENE_NAME}")
    mat_front.use_nodes = True
    nodes_f = mat_front.node_tree.nodes
    links_f = mat_front.node_tree.links
    nodes_f.clear()

    out_node_f = nodes_f.new('ShaderNodeOutputMaterial')
    out_node_f.location = (800, 0)
    bsdf_f = nodes_f.new('ShaderNodeBsdfPrincipled')
    bsdf_f.location = (500, 0)
    links_f.new(bsdf_f.outputs['BSDF'], out_node_f.inputs['Surface'])
    if "Roughness" in bsdf_f.inputs: bsdf_f.inputs["Roughness"].default_value = 1.0

    tex_coord = nodes_f.new('ShaderNodeTexCoord')
    tex_coord.location = (-600, 200)

    attr_min = nodes_f.new('ShaderNodeAttribute')
    attr_min.location = (-600, -50)
    attr_min.attribute_type = 'INSTANCER'
    attr_min.attribute_name = "inst_uv_min"

    attr_span = nodes_f.new('ShaderNodeAttribute')
    attr_span.location = (-600, 50)
    attr_span.attribute_type = 'INSTANCER'
    attr_span.attribute_name = "inst_uv_span"

    v_mul = nodes_f.new('ShaderNodeVectorMath')
    v_mul.location = (-300, 150)
    v_mul.operation = 'MULTIPLY'
    links_f.new(tex_coord.outputs['UV'], v_mul.inputs[0])
    links_f.new(attr_span.outputs['Vector'], v_mul.inputs[1])

    v_add = nodes_f.new('ShaderNodeVectorMath')
    v_add.location = (-100, 150)
    v_add.operation = 'ADD'
    links_f.new(v_mul.outputs['Vector'], v_add.inputs[0])
    links_f.new(attr_min.outputs['Vector'], v_add.inputs[1])

    # 🌌 12K 초고화질 합성 텍스처 아틀라스 (개별 우주 사진 128px + 마스터 원본 Multiply & Over 완벽 합성본)
    active_tex_path = atlas_img_path if atlas_img_path else master_img_path

    tex_node = nodes_f.new('ShaderNodeTexImage')
    tex_node.location = (150, 150)
    loaded_img = bpy.data.images.load(active_tex_path, check_existing=False)
    loaded_img.name = f"Texture_{SCENE_NAME}"
    tex_node.image = loaded_img
    tex_node.interpolation = 'Cubic'

    links_f.new(v_add.outputs['Vector'], tex_node.inputs['Vector'])
    links_f.new(tex_node.outputs['Color'], bsdf_f.inputs['Base Color'])
    if "Emission Color" in bsdf_f.inputs:
        links_f.new(tex_node.outputs['Color'], bsdf_f.inputs['Emission Color'])
    elif "Emission" in bsdf_f.inputs:
        links_f.new(tex_node.outputs['Color'], bsdf_f.inputs['Emission'])
    if "Emission Strength" in bsdf_f.inputs:
        bsdf_f.inputs["Emission Strength"].default_value = 1.0

    mat_back = bpy.data.materials.new(name=f"Mat_Back_{SCENE_NAME}")
    mat_back.use_nodes = True
    nodes_b = mat_back.node_tree.nodes
    links_b = mat_back.node_tree.links
    nodes_b.clear()

    out_node_b = nodes_b.new('ShaderNodeOutputMaterial')
    out_node_b.location = (400, 0)
    bsdf_b = nodes_b.new('ShaderNodeBsdfPrincipled')
    bsdf_b.location = (100, 0)
    links_b.new(bsdf_b.outputs['BSDF'], out_node_b.inputs['Surface'])
    bsdf_b.inputs['Base Color'].default_value = (0.04, 0.045, 0.06, 1.0)
    if "Roughness" in bsdf_b.inputs: bsdf_b.inputs["Roughness"].default_value = 0.35
    if "Metallic" in bsdf_b.inputs: bsdf_b.inputs["Metallic"].default_value = 0.3

    # 3D 타일 메시
    total_w = 20.0
    total_h = 20.0 * (rows / cols)
    tile_unit = (total_w / cols) * 0.995
    hw, hh, hd = tile_unit / 2.0, tile_unit / 2.0, 0.025

    tile_mesh = bpy.data.meshes.new(f"TileMesh_{SCENE_NAME}")
    t_verts = [
        (-hw, -hh, -hd), (hw, -hh, -hd), (hw, hh, -hd), (-hw, hh, -hd),
        (-hw, -hh,  hd), (hw, -hh,  hd), (hw, hh,  hd), (-hw, hh,  hd)
    ]
    t_faces = [
        (3, 2, 1, 0),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7)
    ]
    tile_mesh.from_pydata(t_verts, [], t_faces)
    tile_mesh.update()

    tile_mesh.materials.append(mat_front)
    tile_mesh.materials.append(mat_back)

    for poly in tile_mesh.polygons:
        if poly.index == 1: poly.material_index = 0
        else: poly.material_index = 1

    uv_layer = tile_mesh.uv_layers.new(name="UVMap")
    # 앞면(Top: 4,5,6,7), 뒷면(Bottom: 3,2,1,0), 옆면 모두 정상적인 UV 언랩 할당
    for poly in tile_mesh.polygons:
        if poly.index == 1: # 윗면(Top face)
            uvs = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
        elif poly.index == 0: # 아랫면(Bottom face)
            uvs = [(0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)]
        else: # 옆면 테두리 (Rim)
            uvs = [(0.0, 0.0), (1.0, 0.0), (1.0, 0.02), (0.0, 0.02)]
        for loop_idx, uv in zip(poly.loop_indices, uvs):
            uv_layer.data[loop_idx].uv = uv

    tile_template_obj = bpy.data.objects.new(f"TileTemplate_{SCENE_NAME}", tile_mesh)
    bpy.context.scene.collection.objects.link(tile_template_obj)
    tile_template_obj.hide_viewport = True
    tile_template_obj.hide_render = True

    # --------------------------------------------------------------------------
    # [04/06] 🌀 16:9 프레임 맞춤형 컴팩트 2.6회전 나선 도로 계산
    # --------------------------------------------------------------------------
    print("[04/06] 컴팩트 2.6회전 나선 도로 궤적 계산 중...")

    point_mesh = bpy.data.meshes.new(f"MosaicPoints_{SCENE_NAME}")
    point_coords = [(t['gridX'], t['gridY'], 0.0) for t in tiles]
    point_mesh.from_pydata(point_coords, [], [])
    point_mesh.update()

    attr_init_pos = point_mesh.attributes.new(name="init_pos", type='FLOAT_VECTOR', domain='POINT')
    attr_init_rot = point_mesh.attributes.new(name="init_rot", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_min = point_mesh.attributes.new(name="uv_min", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_span = point_mesh.attributes.new(name="uv_span", type='FLOAT_VECTOR', domain='POINT')
    attr_params = point_mesh.attributes.new(name="anim_params", type='FLOAT_VECTOR', domain='POINT')

    # 🌟 [1. 컴팩트 S자 슬라럼 트랙 (F1 ~ F340 / 5.7초)]:
    num_s_pts = 160
    s_curve_waypoints = []
    s_curve_dists = [0.0]
    total_s_len = 0.0
    s_start_x = -total_w / 2.0
    s_end_x = 4.5 # 교차점

    for k in range(num_s_pts):
        t = k / (num_s_pts - 1)
        sx = s_start_x + t * (s_end_x - s_start_x)
        sy = 1.1 * math.sin(t * math.pi * 4.0)
        pt = (sx, sy, 0.0)
        s_curve_waypoints.append(pt)
        if k > 0:
            p_prev = s_curve_waypoints[k-1]
            seg_len = math.sqrt((sx-p_prev[0])**2 + (sy-p_prev[1])**2)
            total_s_len += seg_len
            s_curve_dists.append(total_s_len)

    s_rail_tile_indices = []
    tile_s_ratio = {}

    for i, t in enumerate(tiles):
        gx, gy = t['gridX'], t['gridY']
        min_d = 9999.0
        best_ratio = 0.0
        for k in range(num_s_pts):
            pt = s_curve_waypoints[k]
            d = math.sqrt((gx - pt[0])**2 + (gy - pt[1])**2)
            if d < min_d:
                min_d = d
                best_ratio = s_curve_dists[k] / total_s_len

        if min_d <= 0.65 and gx <= s_end_x + 0.3:
            s_rail_tile_indices.append(i)
            tile_s_ratio[i] = best_ratio

    # 🌟 [2. 🎯 화면 안에 100% 쏙 들어오는 컴팩트 2.6회전 나선 도로]:
    # 최대 반경을 8.8m로 제한하여 16:9 프레임 안에 완벽히 맞춤!
    fit_h_z = (total_h / 2.0) * (32.0 / 12.0) * 1.02
    fit_w_z = (total_w / 2.0) * (32.0 / 18.0) * 1.02
    final_cam_z = max(fit_h_z, fit_w_z, 22.0)

    spiral_start_rad = 4.5  # S자 끝 교차점
    spiral_end_rad = 8.8    # 🎯 화면 안에 100% 쏙 들어오는 컴팩트 최대 반경!
    spiral_total_turns = 2.6 # 🎯 2.6바퀴로 더 촘촘하고 아름답게 꼼!

    LANES = 6
    s_rail_set = set(s_rail_tile_indices)
    non_rail_indices = [i for i in range(num_tiles) if i not in s_rail_set]
    num_non_rail = len(non_rail_indices)
    STEPS = int(math.ceil(num_non_rail / LANES))

    num_spiral_cam_pts = 220
    spiral_cam_waypoints = []
    spiral_cam_dists = [0.0]
    total_sp_cam_len = 0.0

    for s in range(num_spiral_cam_pts):
        st = s / (num_spiral_cam_pts - 1)
        angle = st * math.pi * 2.0 * spiral_total_turns
        rad = spiral_start_rad + (st ** 1.05) * (spiral_end_rad - spiral_start_rad)
        cz = 0.0 + (st ** 0.88) * (final_cam_z - 3.5)
        cx = math.cos(angle) * rad
        cy = math.sin(angle) * rad
        
        spiral_cam_waypoints.append((cx, cy, cz))
        if s > 0:
            p_prev = spiral_cam_waypoints[s-1]
            seg_len = math.sqrt((cx-p_prev[0])**2 + (cy-p_prev[1])**2 + (cz-p_prev[2])**2)
            total_sp_cam_len += seg_len
            spiral_cam_dists.append(total_sp_cam_len)

    random.seed(999)

    for i, t in enumerate(tiles):
        r, c = t['row'], t['col']
        u_min = c / cols
        v_min = 1.0 - ((r + 1) / rows)
        span_u = 1.0 / cols
        span_v = 1.0 / rows

        attr_uv_min.data[i].vector = (u_min, v_min, 0.0)
        attr_uv_span.data[i].vector = (span_u, span_v, 0.0)

        target_x = t['gridX']
        target_y = t['gridY']
        target_z = 0.0

        if i in s_rail_set:
            # 🌟 [1. S자 선로 타일]:
            ratio = tile_s_ratio[i]
            camera_arrive_frame = 1.0 + ratio * 330.0 # F1 ~ F340

            drop_dur = 10.0
            drop_start = max(1.0, camera_arrive_frame - 26.0)

            init_x = target_x
            init_y = target_y
            init_z = 3.5
            rot_x, rot_y, rot_z = 0.0, 0.0, 0.0

        else:
            # 🌟 [2. 컴팩트 2.6바퀴 나선 도로 타일]:
            seq_idx = non_rail_indices.index(i)
            step_k = seq_idx // LANES
            lane_k = seq_idx % LANES

            st = step_k / max(1, STEPS - 1)
            angle = st * math.pi * 2.0 * spiral_total_turns
            rad = spiral_start_rad + (st ** 1.05) * (spiral_end_rad - spiral_start_rad)

            lane_offset = (lane_k - (LANES - 1) / 2.0) * (tile_unit * 1.002)

            normal_x = math.cos(angle)
            normal_y = math.sin(angle)

            init_x = math.cos(angle) * rad + normal_x * lane_offset
            init_y = math.sin(angle) * rad + normal_y * lane_offset
            init_z = 0.0 + (st ** 0.88) * (final_cam_z - 3.5)

            rot_z = angle + math.pi / 2.0
            rot_x = 0.0
            rot_y = 0.0

            # F540 꼭대기 ➔ F540~780 정중앙 상공 룩다운 ➔ F780 펑! 🎆 폭죽 버스트 ➔ Frame 980 완성!
            dist_from_center = math.sqrt((c - cols/2)**2 + (r - rows/2)**2) / (cols/2)
            drop_start = 780.0 + dist_from_center * 160.0 + random.uniform(-3, 3)
            drop_dur = 24.0

        attr_init_pos.data[i].vector = (init_x, init_y, init_z)
        attr_init_rot.data[i].vector = (rot_x, rot_y, rot_z)
        attr_params.data[i].vector = (0.0, drop_start, drop_dur)

    mosaic_obj = bpy.data.objects.new(f"Mosaic_{SCENE_NAME}", point_mesh)
    bpy.context.scene.collection.objects.link(mosaic_obj)

    # --------------------------------------------------------------------------
    # [05/06] Geometry Nodes 시스템 (Point Set Position)
    # --------------------------------------------------------------------------
    print("[05/06] Geometry Nodes 시스템 컴파일 중...")
    geo_mod = mosaic_obj.modifiers.new(name="MosaicGeometryNodes", type='NODES')
    node_group = bpy.data.node_groups.new(name=f"GN_Mosaic_{SCENE_NAME}", type='GeometryNodeTree')
    geo_mod.node_group = node_group

    gn_nodes = node_group.nodes
    gn_links = node_group.links
    gn_nodes.clear()

    node_group.interface.new_socket(name="Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    node_group.interface.new_socket(name="Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')

    input_node = gn_nodes.new('NodeGroupInput')
    input_node.location = (-1200, 0)
    output_node = gn_nodes.new('NodeGroupOutput')
    output_node.location = (1600, 0)

    obj_info = gn_nodes.new('GeometryNodeObjectInfo')
    obj_info.location = (-600, -300)
    obj_info.inputs['Object'].default_value = tile_template_obj
    obj_info.transform_space = 'RELATIVE'

    scene_time = gn_nodes.new('GeometryNodeInputSceneTime')
    scene_time.location = (-1200, 400)

    get_floor_pos = gn_nodes.new('GeometryNodeInputPosition')
    get_floor_pos.location = (-1000, 100)

    get_params = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_params.location = (-1000, 600)
    get_params.data_type = 'FLOAT_VECTOR'
    get_params.inputs['Name'].default_value = "anim_params"

    sep_params = gn_nodes.new('ShaderNodeSeparateXYZ')
    sep_params.location = (-750, 600)
    gn_links.new(get_params.outputs['Attribute'], sep_params.inputs['Vector'])

    get_init_pos = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_init_pos.location = (-1000, 300)
    get_init_pos.data_type = 'FLOAT_VECTOR'
    get_init_pos.inputs['Name'].default_value = "init_pos"

    get_init_rot = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_init_rot.location = (-1000, -100)
    get_init_rot.data_type = 'FLOAT_VECTOR'
    get_init_rot.inputs['Name'].default_value = "init_rot"

    sub_dom = gn_nodes.new('ShaderNodeMath')
    sub_dom.location = (-550, 500)
    sub_dom.operation = 'SUBTRACT'
    gn_links.new(scene_time.outputs['Frame'], sub_dom.inputs[0])
    gn_links.new(sep_params.outputs['Y'], sub_dom.inputs[1])

    div_dom = gn_nodes.new('ShaderNodeMath')
    div_dom.location = (-380, 500)
    div_dom.operation = 'DIVIDE'
    gn_links.new(sub_dom.outputs['Value'], div_dom.inputs[0])
    gn_links.new(sep_params.outputs['Z'], div_dom.inputs[1])

    clamp_dom = gn_nodes.new('ShaderNodeClamp')
    clamp_dom.location = (-200, 500)
    gn_links.new(div_dom.outputs['Value'], clamp_dom.inputs['Value'])

    mix_pos = gn_nodes.new('ShaderNodeMix')
    mix_pos.location = (0, 300)
    mix_pos.data_type = 'VECTOR'
    gn_links.new(clamp_dom.outputs['Result'], mix_pos.inputs['Factor'])
    gn_links.new(get_init_pos.outputs['Attribute'], mix_pos.inputs[4])
    gn_links.new(get_floor_pos.outputs['Position'], mix_pos.inputs[5])

    mix_rot = gn_nodes.new('ShaderNodeMix')
    mix_rot.location = (0, 100)
    mix_rot.data_type = 'VECTOR'
    gn_links.new(clamp_dom.outputs['Result'], mix_rot.inputs['Factor'])
    gn_links.new(get_init_rot.outputs['Attribute'], mix_rot.inputs[4])
    mix_rot.inputs[5].default_value = (0.0, 0.0, 0.0)

    set_pos = gn_nodes.new('GeometryNodeSetPosition')
    set_pos.location = (250, 0)
    gn_links.new(input_node.outputs['Geometry'], set_pos.inputs['Geometry'])
    gn_links.new(mix_pos.outputs[1], set_pos.inputs['Position'])

    inst_node = gn_nodes.new('GeometryNodeInstanceOnPoints')
    inst_node.location = (500, 0)
    gn_links.new(set_pos.outputs['Geometry'], inst_node.inputs['Points'])
    gn_links.new(obj_info.outputs['Geometry'], inst_node.inputs['Instance'])

    rot_inst = gn_nodes.new('GeometryNodeRotateInstances')
    rot_inst.location = (750, 0)
    gn_links.new(inst_node.outputs['Instances'], rot_inst.inputs['Instances'])
    gn_links.new(mix_rot.outputs[1], rot_inst.inputs['Rotation'])

    get_uv_min = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_uv_min.location = (750, -200)
    get_uv_min.data_type = 'FLOAT_VECTOR'
    get_uv_min.inputs['Name'].default_value = "uv_min"

    get_uv_span = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_uv_span.location = (750, -350)
    get_uv_span.data_type = 'FLOAT_VECTOR'
    get_uv_span.inputs['Name'].default_value = "uv_span"

    store_min = gn_nodes.new('GeometryNodeStoreNamedAttribute')
    store_min.location = (1050, 0)
    store_min.data_type = 'FLOAT_VECTOR'
    store_min.domain = 'INSTANCE'
    store_min.inputs['Name'].default_value = "inst_uv_min"
    gn_links.new(rot_inst.outputs['Instances'], store_min.inputs['Geometry'])
    gn_links.new(get_uv_min.outputs['Attribute'], store_min.inputs['Value'])

    store_span = gn_nodes.new('GeometryNodeStoreNamedAttribute')
    store_span.location = (1300, 0)
    store_span.data_type = 'FLOAT_VECTOR'
    store_span.domain = 'INSTANCE'
    store_span.inputs['Name'].default_value = "inst_uv_span"
    gn_links.new(store_min.outputs['Geometry'], store_span.inputs['Geometry'])
    gn_links.new(get_uv_span.outputs['Attribute'], store_span.inputs['Value'])

    gn_links.new(store_span.outputs['Geometry'], output_node.inputs['Geometry'])

    # --------------------------------------------------------------------------
    # [06/06] 🎬 18mm 초광각 카메라 & 정중앙 크레인 상승 룩다운 궤적
    # --------------------------------------------------------------------------
    print("[06/06] 컴팩트 전경 룩다운 카메라 구성 중...")

    cam_target = bpy.data.objects.new(f"Camera_Target_{SCENE_NAME}", None)
    scene.collection.objects.link(cam_target)

    cam_data = bpy.data.cameras.new(f"CinematicCamera_{SCENE_NAME}")
    cam_data.lens = 18.0
    cam_obj = bpy.data.objects.new(f"CinematicCamera_{SCENE_NAME}", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    def get_pos_at_dist(waypoints, dists, total_len, ratio):
        target_d = ratio * total_len
        for k in range(len(dists)-1):
            if dists[k] <= target_d <= dists[k+1]:
                seg_d = dists[k+1] - dists[k]
                frac = (target_d - dists[k]) / seg_d if seg_d > 0.0001 else 0.0
                p0 = waypoints[k]
                p1 = waypoints[k+1]
                return (
                    p0[0] + frac * (p1[0] - p0[0]),
                    p0[1] + frac * (p1[1] - p0[1]),
                    p0[2] + frac * (p1[2] - p0[2])
                )
        return waypoints[-1]

    last_spiral_pos = spiral_cam_waypoints[-1]
    sp_top_x = last_spiral_pos[0]
    sp_top_y = last_spiral_pos[1]
    sp_top_z = last_spiral_pos[2] + 0.35

    for f in range(1, TOTAL_FRAMES + 1, 5):
        if f <= 340:
            # 🏎️ [Phase 1: F1~340 (5.7초) 18mm 초광각 S자 슬라럼 초고속 질주!]
            ratio = (f - 1.0) / 339.0
            cur_pos = get_pos_at_dist(s_curve_waypoints, s_curve_dists, total_s_len, ratio)
            
            fwd_ratio = min(1.0, ratio + 0.04)
            fwd_pos = get_pos_at_dist(s_curve_waypoints, s_curve_dists, total_s_len, fwd_ratio)

            c_x, c_y, c_z = cur_pos[0], cur_pos[1], 0.35
            
            if f >= 300:
                blend_t = (f - 300.0) / (340.0 - 300.0)
                sp_fwd = get_pos_at_dist(spiral_cam_waypoints, spiral_cam_dists, total_sp_cam_len, 0.03)
                t_x = (1.0 - blend_t) * fwd_pos[0] + blend_t * sp_fwd[0]
                t_y = (1.0 - blend_t) * fwd_pos[1] + blend_t * sp_fwd[1]
                t_z = (1.0 - blend_t) * 0.15 + blend_t * (sp_fwd[2] + 0.50)
            else:
                t_x, t_y, t_z = fwd_pos[0], fwd_pos[1], 0.15

        elif f <= 540:
            # 🌀 [Phase 2: F340~540 (3.3초) 컴팩트 2.6바퀴 쾌속 나선 상승 질주!]
            raw_t = (f - 340.0) / (540.0 - 340.0)
            st = raw_t * (2.0 - raw_t)
            
            cur_sp = get_pos_at_dist(spiral_cam_waypoints, spiral_cam_dists, total_sp_cam_len, st)
            fwd_st = min(1.0, st + 0.035 * (1.0 - raw_t))
            fwd_sp = get_pos_at_dist(spiral_cam_waypoints, spiral_cam_dists, total_sp_cam_len, fwd_st)

            c_x, c_y, c_z = cur_sp[0], cur_sp[1], cur_sp[2] + 0.35
            t_x, t_y, t_z = fwd_sp[0], fwd_sp[1], fwd_sp[2] + 0.55

        elif f <= 640:
            # 🚁 [Phase 3: F540~640 (1.6초) 아래를 내려다보며 사진 정중앙 상공(Z=22m)으로 크레인 상승!]
            t = (f - 540.0) / (640.0 - 540.0)
            ease = t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

            c_x = (1.0 - ease) * sp_top_x + ease * 0.0
            c_y = (1.0 - ease) * sp_top_y + ease * (-0.001)
            c_z = (1.0 - ease) * sp_top_z + ease * final_cam_z

            last_fwd = spiral_cam_waypoints[-1]
            t_x = (1.0 - ease) * (last_fwd[0] + 0.5) + ease * 0.0
            t_y = (1.0 - ease) * (last_fwd[1] + 0.5) + ease * 0.0
            t_z = (1.0 - ease) * (last_fwd[2] + 0.55) + ease * 0.0

        elif f <= 780:
            # 📸 [Phase 4: F640~780 (2.3초간!) 16:9 프레임 안에 100% 쏙 들어온 나선 전경 조망!]
            c_x = 0.0
            c_y = -0.001
            c_z = final_cam_z

            t_x = 0.0
            t_y = 0.0
            t_z = 0.0

        elif f <= 980:
            # 💥 [Phase 5: F780~980 펑! 🎆 폭죽 버스트 ➔ 순차 다이브 100% 완성]
            c_x = 0.0
            c_y = -0.001
            c_z = final_cam_z

            t_x = 0.0
            t_y = 0.0
            t_z = 0.0

        else:
            # ⭐ [Phase 6: F980~1260 (4.7초) 완성작 1920x1080 피날레]
            c_x = 0.0
            c_y = -0.001
            c_z = final_cam_z

            t_x = 0.0
            t_y = 0.0
            t_z = 0.0

        cam_target.location = Vector((t_x, t_y, t_z))
        cam_target.keyframe_insert(data_path="location", frame=f)

        cam_obj.location = Vector((c_x, c_y, c_z))
        cam_obj.keyframe_insert(data_path="location", frame=f)

    cam_data.lens = 18.0
    cam_data.keyframe_insert(data_path="lens", frame=1)
    cam_data.lens = 18.0
    cam_data.keyframe_insert(data_path="lens", frame=540)
    cam_data.lens = 22.0
    cam_data.keyframe_insert(data_path="lens", frame=640)
    cam_data.lens = 32.0
    cam_data.keyframe_insert(data_path="lens", frame=780)

    # 별빛 시스템
    random.seed(999)
    star_mesh = bpy.data.meshes.new(f"StarsMesh_{SCENE_NAME}")
    star_coords = [
        (random.uniform(-40, 40), random.uniform(-25, 25), random.uniform(-5.0, 20.0))
        for _ in range(350)
    ]
    star_mesh.from_pydata(star_coords, [], [])
    star_mesh.update()

    stars_obj = bpy.data.objects.new(f"CosmicStars_{SCENE_NAME}", star_mesh)
    scene.collection.objects.link(stars_obj)

    mat_star = bpy.data.materials.new(name=f"Mat_Stars_{SCENE_NAME}")
    mat_star.use_nodes = True
    s_nodes = mat_star.node_tree.nodes
    s_links = mat_star.node_tree.links
    s_nodes.clear()
    s_out = s_nodes.new('ShaderNodeOutputMaterial')
    s_emit = s_nodes.new('ShaderNodeEmission')
    s_emit.inputs['Color'].default_value = (1.5, 1.7, 2.2, 1.0)
    s_emit.inputs['Strength'].default_value = 3.0
    s_links.new(s_emit.outputs['Emission'], s_out.inputs['Surface'])

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(0,0,-50))
    star_template = bpy.context.active_object
    star_template.name = f"StarTemplate_{SCENE_NAME}"
    star_template.data.materials.append(mat_star)
    star_template.hide_viewport = True
    star_template.hide_render = True

    star_mod = stars_obj.modifiers.new(name="StarInstances", type='NODES')
    star_gn = bpy.data.node_groups.new(name=f"GN_Stars_{SCENE_NAME}", type='GeometryNodeTree')
    star_mod.node_group = star_gn
    star_gn.interface.new_socket(name="Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    star_gn.interface.new_socket(name="Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    
    sg_in = star_gn.nodes.new('NodeGroupInput')
    sg_out = star_gn.nodes.new('NodeGroupOutput')
    sg_obj = star_gn.nodes.new('GeometryNodeObjectInfo')
    sg_obj.inputs['Object'].default_value = star_template
    sg_obj.transform_space = 'RELATIVE'
    sg_inst = star_gn.nodes.new('GeometryNodeInstanceOnPoints')
    star_gn.links.new(sg_in.outputs['Geometry'], sg_inst.inputs['Points'])
    star_gn.links.new(sg_obj.outputs['Geometry'], sg_inst.inputs['Instance'])
    star_gn.links.new(sg_inst.outputs['Instances'], sg_out.inputs['Geometry'])

    # 조명
    def create_light(name, energy, color, pos):
        ldata = bpy.data.lights.new(name=name, type='AREA')
        ldata.energy = energy
        ldata.color = color
        ldata.size = 25.0
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        lobj.location = pos
        scene.collection.objects.link(lobj)
        return lobj

    create_light("Fill_Front", 1800.0, (0.95, 0.96, 1.0), Vector((0.0, -15.0, 10.0)))
    create_light("Fill_Back", 1200.0, (0.90, 0.92, 1.0), Vector((0.0, 15.0, 10.0)))

    # --------------------------------------------------------------------------
    # [07/07] 3D 시네마틱 한글 타이틀 자막 ("과학관")
    # --------------------------------------------------------------------------
    print("[07/07] 3D 시네마틱 한글 타이틀 자막 구성 중...")

    font_path = r"C:\Windows\Fonts\malgunbd.ttf"
    custom_font = None
    if os.path.exists(font_path):
        try:
            custom_font = bpy.data.fonts.load(font_path)
            print("   🔤 맑은 고딕 볼드 폰트 로드 완료")
        except Exception as e:
            print(f"   ⚠️ 폰트 로드 알림: {e}")

    # 1. 전면 메인 텍스트 머티리얼 (눈부신 샴페인 화이트/골드)
    mat_title_front = bpy.data.materials.new(name=f"Mat_Title_Front_{SCENE_NAME}")
    mat_title_front.use_nodes = True
    f_nodes = mat_title_front.node_tree.nodes
    f_links = mat_title_front.node_tree.links
    f_nodes.clear()

    f_out = f_nodes.new('ShaderNodeOutputMaterial')
    f_bsdf = f_nodes.new('ShaderNodeBsdfPrincipled')
    f_bsdf.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0) # 🌟 눈부신 순백색 (#FFFFFF)
    f_bsdf.inputs['Roughness'].default_value = 0.1
    if 'Metallic' in f_bsdf.inputs: f_bsdf.inputs['Metallic'].default_value = 0.15
    if 'Emission Color' in f_bsdf.inputs:
        f_bsdf.inputs['Emission Color'].default_value = (1.0, 0.98, 0.95, 1.0)
    elif 'Emission' in f_bsdf.inputs:
        f_bsdf.inputs['Emission'].default_value = (1.0, 0.98, 0.95, 1.0)
    if 'Emission Strength' in f_bsdf.inputs:
        f_bsdf.inputs['Emission Strength'].default_value = 0.95
    f_links.new(f_bsdf.outputs['BSDF'], f_out.inputs['Surface'])

    # 2. 외곽선(스트로크) 머티리얼 (완전한 딥 블랙 테두리)
    mat_title_border = bpy.data.materials.new(name=f"Mat_Title_Border_{SCENE_NAME}")
    mat_title_border.use_nodes = True
    b_nodes = mat_title_border.node_tree.nodes
    b_links = mat_title_border.node_tree.links
    b_nodes.clear()
    b_out = b_nodes.new('ShaderNodeOutputMaterial')
    b_emit = b_nodes.new('ShaderNodeEmission')
    b_emit.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0) # 칠흑 같은 리얼 블랙
    b_emit.inputs['Strength'].default_value = 1.0
    b_links.new(b_emit.outputs['Emission'], b_out.inputs['Surface'])

    # 🌟 [전면 텍스트] - 본래 글자
    front_data = bpy.data.curves.new(name="Title_Front_Data", type='FONT')
    front_data.body = "과학관"
    if custom_font:
        front_data.font = custom_font
    front_data.size = 1.05
    front_data.extrude = 0.035
    front_data.bevel_depth = 0.001
    front_data.space_character = 1.08
    front_data.align_x = 'CENTER'
    front_data.align_y = 'CENTER'
    front_data.materials.append(mat_title_front)

    front_obj = bpy.data.objects.new("Title_Front", front_data)
    scene.collection.objects.link(front_obj)

    # 🌟 [후면 외곽선 텍스트] - curve offset으로 만든 완벽한 균일 검은색 테두리 (Stroke)
    border_data = bpy.data.curves.new(name="Title_Border_Data", type='FONT')
    border_data.body = "과학관"
    if custom_font:
        border_data.font = custom_font
    border_data.size = 1.05
    border_data.offset = 0.016       # 🌟 균일하게 외곽으로 16mm 확장하여 완벽한 검은 테두리 생성!
    border_data.extrude = 0.02
    border_data.bevel_depth = 0.004
    border_data.bevel_resolution = 2
    border_data.space_character = 1.08
    border_data.align_x = 'CENTER'
    border_data.align_y = 'CENTER'
    border_data.materials.append(mat_title_border)

    border_obj = bpy.data.objects.new("Title_Border", border_data)
    scene.collection.objects.link(border_obj)

    # 📍 타이틀 원래 하단 위치
    title_pos_y = - (total_h / 2.0) + 1.05
    front_z = 0.28
    border_z = 0.22

    # 🎬 [애니메이션: Frame 800에서 바로 등장!]
    front_obj.location = Vector((0.0, title_pos_y, -0.3))
    front_obj.scale = Vector((0.001, 0.001, 0.001))
    front_obj.keyframe_insert(data_path="location", frame=790)
    front_obj.keyframe_insert(data_path="scale", frame=790)

    border_obj.location = Vector((0.0, title_pos_y, -0.3))
    border_obj.scale = Vector((0.001, 0.001, 0.001))
    border_obj.keyframe_insert(data_path="location", frame=790)
    border_obj.keyframe_insert(data_path="scale", frame=790)

    front_obj.location = Vector((0.0, title_pos_y, 0.0))
    front_obj.scale = Vector((0.3, 0.3, 0.3))
    front_obj.keyframe_insert(data_path="location", frame=800)
    front_obj.keyframe_insert(data_path="scale", frame=800)

    border_obj.location = Vector((0.0, title_pos_y, 0.0))
    border_obj.scale = Vector((0.3, 0.3, 0.3))
    border_obj.keyframe_insert(data_path="location", frame=800)
    border_obj.keyframe_insert(data_path="scale", frame=800)

    front_obj.location = Vector((0.0, title_pos_y, front_z))
    front_obj.scale = Vector((1.0, 1.0, 1.0))
    front_obj.keyframe_insert(data_path="location", frame=825)
    front_obj.keyframe_insert(data_path="scale", frame=825)

    border_obj.location = Vector((0.0, title_pos_y, border_z))
    border_obj.scale = Vector((1.0, 1.0, 1.0))
    border_obj.keyframe_insert(data_path="location", frame=825)
    border_obj.keyframe_insert(data_path="scale", frame=825)

    front_obj.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)
    front_obj.keyframe_insert(data_path="scale", frame=TOTAL_FRAMES)
    border_obj.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)
    border_obj.keyframe_insert(data_path="scale", frame=TOTAL_FRAMES)

    # 렌더 엔진 및 GPU 설정
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    if hasattr(scene, 'eevee'):
        try: scene.eevee.taa_render_samples = 32
        except Exception: pass
        try: scene.eevee.use_raytracing = False
        except Exception: pass
        try: scene.eevee.use_shadows = True
        except Exception: pass

    # 🌈 True-Color sRGB 색상 매니지먼트 (AgX/Filmic 어두워짐 방지)
    if hasattr(scene, 'view_settings'):
        try: scene.view_settings.view_transform = 'Standard'
        except Exception: pass
        try: scene.view_settings.look = 'None'
        except Exception: pass

    # 🎬 초고화질 MP4 H.264 비디오 렌더 설정
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.use_motion_blur = False

    scene_blend_path = os.path.join(base_dir, f"{SCENE_NAME}.blend")
    try:
        bpy.ops.wm.save_as_mainfile(filepath=scene_blend_path)
        print(f"   💾 저장 완료: {scene_blend_path}")
    except Exception as e:
        print(f"   ⚠️ 저장 스킵: {e}")

    print("\n" + "="*75)
    print(f"🎉 [{SCENE_NAME}] Compact Framed Spiral & Central Top-View 빌드 완료!")
    print("="*75 + "\n")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        traceback.print_exc()
