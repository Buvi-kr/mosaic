"""
================================================================================
🎬 [3번사진] ZERO-VOID INSTANT PEAK TURN & SMOOTH TOP-VIEW DOCKING (Blender 5.2 LTS)
================================================================================
- 완벽한 타이밍 & 시네마틱:
    1. 🪶 [F1~80]: Frame 1 시작부터 화면 상단에 첫 조각이 100% 선명하게 보임 ➔ 카메라도 서서히 미세 상승하며 첫 조각 바닥 착지 안착
    2. 🌤️ [F80~360]: 고개를 들면서 카메라도 바닥에서 Z=1.1m -> 3.5m로 천천히 솟아오르며 하늘에 빽빽한 조각들을 맞이함!
    3. ☄️ [F360~550]: 상공에 빽빽하게 머무는 수천 장의 사진 앞면들을 뚫고 상공(Z=18.5m)으로 솟구침!
    4. 🧘 [F550~820 (공허 0% 완벽 박멸! F550 뚫자마자 즉시 바닥 턴)]: 뚫고 올라온 F550 순간부터 지체 없이 곧바로 바닥 정중앙(0,0,0)으로 고개를 턴하여, 바닥에서 수천 장의 조각들이 착착 맞춰지는 장관을 바로 관람!
    5. ⭐ [F820~980 (정방향 탑뷰 조립) & F980~1260 (완성 피날레)]: Frame 980에 마지막 조각이 착! 안착하며 1920x1080 반듯한 네모 완성작 피날레!
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

# ==============================================================================
# ⚙️ 씬 마스터 타임라인 파라미터 (60fps 기준 / 21.0초 = 1,260 Frames)
# ==============================================================================
TOTAL_FRAMES = 1260
FPS = 60
RESOLUTION_X = 1920
RESOLUTION_Y = 1080
SCENE_NAME = "3번사진"

ALL_DOCKED_FRAME = 980
FINALE_END_FRAME = 1260

def main():
    print("\n" + "="*75)
    print(f"🎬 [{SCENE_NAME}] Zero-Void Instant Peak Turn 씬 빌드 시작 (1,260 Frames)")
    print("="*75)

    # --------------------------------------------------------------------------
    # [01/06] 씬 초기화 & 메모리 클린업
    # --------------------------------------------------------------------------
    print("[01/06] 씬 & 메모리 안전 초기화 중...")
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
        if hasattr(scene.render.ffmpeg, 'constant_rate_factor'):
            try: scene.render.ffmpeg.constant_rate_factor = 'HIGH'
            except Exception: pass
        if hasattr(scene.render.ffmpeg, 'ffmpeg_preset'):
            try: scene.render.ffmpeg.ffmpeg_preset = 'REALTIME' if 'REALTIME' in [e.identifier for e in bpy.types.FFmpegSettings.bl_rna.properties['ffmpeg_preset'].enum_items] else 'FAST'
            except Exception: pass
    except Exception as e:
        print(f"   ⚠️ FFmpeg 세팅 알림: {e}")

    # --------------------------------------------------------------------------
    # [02/06] 데이터 및 마스터 텍스처 로드
    # --------------------------------------------------------------------------
    print("[02/06] 3번사진 전용 데이터 & 텍스처 로드 중...")
    
    current_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else ""
    search_dirs = [
        current_dir,
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\scenes\3번사진",
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

    print(f"   🎬 씬: [{SCENE_NAME}] | 타일: {num_tiles:,}개 ({cols}x{rows})")
    print(f"   🖼 마스터 텍스처: {master_img_path}")
    print(f"   🌌 아틀라스 텍스처: {atlas_img_path if atlas_img_path else '없음 (마스터 단독)'}")

    # --------------------------------------------------------------------------
    # [03/06] 초선명 True-Color 자체 발광(Emission 1.0) UV 셰이더 머티리얼 구성
    # --------------------------------------------------------------------------
    print("[03/06] True-Color 자체 발광 셰이더 머티리얼 구성 중...")
    mat = bpy.data.materials.new(name=f"Mat_Mosaic_{SCENE_NAME}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    out_node.location = (800, 0)

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (500, 0)
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])

    if "Roughness" in bsdf.inputs: bsdf.inputs["Roughness"].default_value = 1.0
    if "Metallic" in bsdf.inputs: bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs: bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if "Specular" in bsdf.inputs: bsdf.inputs["Specular"].default_value = 0.0

    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-600, 200)

    attr_min = nodes.new('ShaderNodeAttribute')
    attr_min.location = (-600, -50)
    attr_min.attribute_type = 'INSTANCER'
    attr_min.attribute_name = "inst_uv_min"

    attr_span = nodes.new('ShaderNodeAttribute')
    attr_span.location = (-600, 50)
    attr_span.attribute_type = 'INSTANCER'
    attr_span.attribute_name = "inst_uv_span"

    v_mul = nodes.new('ShaderNodeVectorMath')
    v_mul.location = (-300, 150)
    v_mul.operation = 'MULTIPLY'
    links.new(tex_coord.outputs['UV'], v_mul.inputs[0])
    links.new(attr_span.outputs['Vector'], v_mul.inputs[1])

    v_add = nodes.new('ShaderNodeVectorMath')
    v_add.location = (-100, 150)
    v_add.operation = 'ADD'
    links.new(v_mul.outputs['Vector'], v_add.inputs[0])
    links.new(attr_min.outputs['Vector'], v_add.inputs[1])

    # 🌌 12K 초고화질 합성 텍스처 아틀라스 (개별 우주 사진 128px + 마스터 원본 Multiply & Over 완벽 합성본)
    active_tex_path = atlas_img_path if atlas_img_path else master_img_path

    tex_node = nodes.new('ShaderNodeTexImage')
    tex_node.location = (150, 150)
    loaded_img = bpy.data.images.load(active_tex_path, check_existing=False)
    loaded_img.name = f"Texture_{SCENE_NAME}"
    tex_node.image = loaded_img
    tex_node.interpolation = 'Cubic'

    links.new(v_add.outputs['Vector'], tex_node.inputs['Vector'])
    links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

    if "Emission Color" in bsdf.inputs:
        links.new(tex_node.outputs['Color'], bsdf.inputs['Emission Color'])
    elif "Emission" in bsdf.inputs:
        links.new(tex_node.outputs['Color'], bsdf.inputs['Emission'])

    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 1.0

    # --------------------------------------------------------------------------
    # [04/06] 🌟 초밀집 수직 기둥 배치 & 조각 앞면 180도 반전 베이킹
    # --------------------------------------------------------------------------
    print("[04/06] 초밀집 수직 원통 기둥 & 조각 앞면 180도 반전 궤적 베이킹 중...")

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
        (3, 2, 1, 0), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)
    ]
    tile_mesh.from_pydata(t_verts, [], t_faces)
    tile_mesh.update()

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
    tile_mesh.materials.append(mat)

    tile_template_obj = bpy.data.objects.new(f"TileTemplate_{SCENE_NAME}", tile_mesh)
    bpy.context.scene.collection.objects.link(tile_template_obj)
    tile_template_obj.hide_viewport = True
    tile_template_obj.hide_render = True

    point_mesh = bpy.data.meshes.new(f"MosaicPoints_{SCENE_NAME}")
    point_coords = [(t['gridX'], t['gridY'], 0.0) for t in tiles]
    point_mesh.from_pydata(point_coords, [], [])
    point_mesh.update()

    attr_start_pos = point_mesh.attributes.new(name="start_pos", type='FLOAT_VECTOR', domain='POINT')
    attr_start_rot = point_mesh.attributes.new(name="start_rot", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_min = point_mesh.attributes.new(name="uv_min", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_span = point_mesh.attributes.new(name="uv_span", type='FLOAT_VECTOR', domain='POINT')
    attr_params = point_mesh.attributes.new(name="anim_params", type='FLOAT_VECTOR', domain='POINT')

    hero_index = 0
    min_center_d = 999.0
    for idx, t in enumerate(tiles):
        d = math.hypot(t['gridX'], t['gridY'])
        if d < min_center_d:
            min_center_d = d
            hero_index = idx

    hero_target_x = tiles[hero_index]['gridX']
    hero_target_y = tiles[hero_index]['gridY']
    
    # 🎯 첫 조각(Hero Tile) 출발 좌표: Frame 1 뷰포트 상단 1/4 지점!
    hero_start_x = 0.0
    hero_start_y = -0.15
    hero_start_z = 0.55

    max_dist = 0.0
    for t in tiles:
        d = math.hypot(t['gridX'] - hero_target_x, t['gridY'] - hero_target_y)
        if d > max_dist: max_dist = d
    if max_dist < 1.0: max_dist = 10.0

    random.seed(42)

    for i, t in enumerate(tiles):
        r, c = t['row'], t['col']
        u_min = c / cols
        v_min = 1.0 - ((r + 1) / rows)
        span_u = 1.0 / cols
        span_v = 1.0 / rows

        attr_uv_min.data[i].vector = (u_min, v_min, 0.0)
        attr_uv_span.data[i].vector = (span_u, span_v, 0.0)

        gx, gy = t['gridX'], t['gridY']
        dist_from_hero = math.hypot(gx - hero_target_x, gy - hero_target_y)
        norm_dist = dist_from_hero / max_dist

        if i == hero_index:
            # 🎯 첫 조각: Frame 1에 화면 상단에 똬악! 보임 ➔ F80에 바닥에 착! 안착
            sp_x = hero_start_x
            sp_y = hero_start_y
            sp_z = hero_start_z
            dock_start_f = 1.0
            dock_dur = 80.0
            attr_start_rot.data[i].vector = (math.radians(25.0), 0.0, 0.0)
            attr_params.data[i].vector = (1.0, 1.0, 80.0)
        else:
            # 🌟 [초밀집 수직 원통 기둥 배치]:
            radius_rand = math.sqrt(random.uniform(0.01, 1.0)) * 1.85
            angle_rand = random.uniform(0.0, 2.0 * math.pi)
            
            sp_x = math.cos(angle_rand) * radius_rand
            sp_y = math.sin(angle_rand) * radius_rand
            sp_z = 2.0 + norm_dist * 21.5 + random.uniform(-0.5, 0.8)

            # 🚀 [상공 조각 체류 시간 연장: F100~500에 걸쳐 순차적 출발 & F980 완성 싱크로]:
            # 높은 곳에 있는 조각들이 F500 이후에도 공중에 머물러 카메라가 뚫고 올라갈 때 화면을 꽉 채움!
            dock_start_f = 80.0 + (norm_dist ** 1.2) * 440.0 + random.uniform(-6, 6)
            dock_start_f = max(80.0, dock_start_f)
            dock_dur = max(200.0, 980.0 - dock_start_f)

            # 🌟 [조각 앞면 180도 반전!]:
            pitch_flip = math.pi + math.radians(random.uniform(-25.0, 25.0))
            yaw_angle = angle_rand + random.uniform(-0.4, 0.4)
            attr_start_rot.data[i].vector = (
                pitch_flip,
                math.radians(random.uniform(-20.0, 20.0)),
                yaw_angle
            )
            attr_params.data[i].vector = (0.0, dock_start_f, dock_dur)

        attr_start_pos.data[i].vector = (sp_x, sp_y, sp_z)

    mosaic_obj = bpy.data.objects.new(f"Mosaic_{SCENE_NAME}", point_mesh)
    bpy.context.scene.collection.objects.link(mosaic_obj)

    # --------------------------------------------------------------------------
    # [05/06] Geometry Nodes: 매끄러운 C1 연속 도킹 시스템
    # --------------------------------------------------------------------------
    print("[05/06] Geometry Nodes 매끄러운 도킹 시스템 컴파일 중...")
    geo_mod = mosaic_obj.modifiers.new(name="MosaicGeometryNodes", type='NODES')
    node_group = bpy.data.node_groups.new(name=f"GN_Mosaic_{SCENE_NAME}", type='GeometryNodeTree')
    geo_mod.node_group = node_group

    gn_nodes = node_group.nodes
    gn_links = node_group.links
    gn_nodes.clear()

    node_group.interface.new_socket(name="Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    node_group.interface.new_socket(name="Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')

    input_node = gn_nodes.new('NodeGroupInput')
    input_node.location = (-1600, 0)
    output_node = gn_nodes.new('NodeGroupOutput')
    output_node.location = (2000, 0)

    obj_info = gn_nodes.new('GeometryNodeObjectInfo')
    obj_info.location = (-1400, -300)
    obj_info.inputs['Object'].default_value = tile_template_obj
    obj_info.transform_space = 'RELATIVE'

    inst_node = gn_nodes.new('GeometryNodeInstanceOnPoints')
    inst_node.location = (-1000, 0)
    gn_links.new(input_node.outputs['Geometry'], inst_node.inputs['Points'])
    gn_links.new(obj_info.outputs['Geometry'], inst_node.inputs['Instance'])

    scene_time = gn_nodes.new('GeometryNodeInputSceneTime')
    scene_time.location = (-1600, 400)

    get_floor_pos = gn_nodes.new('GeometryNodeInputPosition')
    get_floor_pos.location = (-1400, 200)

    get_params = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_params.location = (-1400, 600)
    get_params.data_type = 'FLOAT_VECTOR'
    get_params.inputs['Name'].default_value = "anim_params"

    sep_params = gn_nodes.new('ShaderNodeSeparateXYZ')
    sep_params.location = (-1150, 600)
    gn_links.new(get_params.outputs['Attribute'], sep_params.inputs['Vector'])

    get_start_pos = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_start_pos.location = (-1400, 0)
    get_start_pos.data_type = 'FLOAT_VECTOR'
    get_start_pos.inputs['Name'].default_value = "start_pos"

    get_start_rot = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_start_rot.location = (-1400, -150)
    get_start_rot.data_type = 'FLOAT_VECTOR'
    get_start_rot.inputs['Name'].default_value = "start_rot"

    # T_dock 진행률 계산
    sub_dock = gn_nodes.new('ShaderNodeMath')
    sub_dock.location = (-900, 500)
    sub_dock.operation = 'SUBTRACT'
    gn_links.new(scene_time.outputs['Frame'], sub_dock.inputs[0])
    gn_links.new(sep_params.outputs['Y'], sub_dock.inputs[1])

    div_dock = gn_nodes.new('ShaderNodeMath')
    div_dock.location = (-720, 500)
    div_dock.operation = 'DIVIDE'
    gn_links.new(sub_dock.outputs['Value'], div_dock.inputs[0])
    gn_links.new(sep_params.outputs['Z'], div_dock.inputs[1])

    clamp_dock = gn_nodes.new('ShaderNodeClamp')
    clamp_dock.location = (-540, 500)
    gn_links.new(div_dock.outputs['Value'], clamp_dock.inputs['Value'])

    dock_pow = gn_nodes.new('ShaderNodeMath')
    dock_pow.location = (-350, 500)
    dock_pow.operation = 'POWER'
    dock_pow.inputs[1].default_value = 1.75
    gn_links.new(clamp_dock.outputs['Result'], dock_pow.inputs[0])

    mix_pos = gn_nodes.new('ShaderNodeMix')
    mix_pos.location = (200, 400)
    mix_pos.data_type = 'VECTOR'
    gn_links.new(dock_pow.outputs['Value'], mix_pos.inputs['Factor'])
    gn_links.new(get_start_pos.outputs['Attribute'], mix_pos.inputs[4])
    gn_links.new(get_floor_pos.outputs['Position'], mix_pos.inputs[5])

    # 회전 믹스: 공중 180도 반전 회전 -> 바닥 수평(0,0,0)
    mix_rot = gn_nodes.new('ShaderNodeMix')
    mix_rot.location = (200, 150)
    mix_rot.data_type = 'VECTOR'
    gn_links.new(dock_pow.outputs['Value'], mix_rot.inputs['Factor'])
    gn_links.new(get_start_rot.outputs['Attribute'], mix_rot.inputs[4])
    mix_rot.inputs[5].default_value = (0.0, 0.0, 0.0)

    set_pos = gn_nodes.new('GeometryNodeSetPosition')
    set_pos.location = (500, 400)
    gn_links.new(inst_node.outputs['Instances'], set_pos.inputs['Geometry'])
    gn_links.new(mix_pos.outputs[1], set_pos.inputs['Position'])

    rot_inst = gn_nodes.new('GeometryNodeRotateInstances')
    rot_inst.location = (700, 400)
    gn_links.new(set_pos.outputs['Geometry'], rot_inst.inputs['Instances'])
    gn_links.new(mix_rot.outputs[1], rot_inst.inputs['Rotation'])

    get_uv_min = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_uv_min.location = (700, 150)
    get_uv_min.data_type = 'FLOAT_VECTOR'
    get_uv_min.inputs['Name'].default_value = "uv_min"

    get_uv_span = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_uv_span.location = (700, 0)
    get_uv_span.data_type = 'FLOAT_VECTOR'
    get_uv_span.inputs['Name'].default_value = "uv_span"

    store_min = gn_nodes.new('GeometryNodeStoreNamedAttribute')
    store_min.location = (1000, 300)
    store_min.data_type = 'FLOAT_VECTOR'
    store_min.domain = 'INSTANCE'
    store_min.inputs['Name'].default_value = "inst_uv_min"
    gn_links.new(rot_inst.outputs['Instances'], store_min.inputs['Geometry'])
    gn_links.new(get_uv_min.outputs['Attribute'], store_min.inputs['Value'])

    store_span = gn_nodes.new('GeometryNodeStoreNamedAttribute')
    store_span.location = (1250, 300)
    store_span.data_type = 'FLOAT_VECTOR'
    store_span.domain = 'INSTANCE'
    store_span.inputs['Name'].default_value = "inst_uv_span"
    gn_links.new(store_min.outputs['Geometry'], store_span.inputs['Geometry'])
    gn_links.new(get_uv_span.outputs['Attribute'], store_span.inputs['Value'])

    gn_links.new(store_span.outputs['Geometry'], output_node.inputs['Geometry'])

    # --------------------------------------------------------------------------
    # [06/06] 🎬 마스터피스 카메라워크: F550 즉시 바닥 턴 (공허 0% 박멸!)
    # --------------------------------------------------------------------------
    print("[06/06] F550 즉시 바닥 턴 & 공허 0% 카메라 궤적 구성 중...")

    cam_target = bpy.data.objects.new(f"Camera_Target_{SCENE_NAME}", None)
    scene.collection.objects.link(cam_target)

    cam_data = bpy.data.cameras.new(f"CinematicCamera_{SCENE_NAME}")
    cam_data.lens = 32.0 # 🌟 렌즈 32mm 단일 고정 (Dolly-Zoom 왜곡 0%)
    cam_obj = bpy.data.objects.new(f"CinematicCamera_{SCENE_NAME}", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = cam_target
    cam_data.dof.aperture_fstop = 3.8

    fit_h_z = (total_h / 2.0) * (32.0 / 12.0) * 1.02
    fit_w_z = (total_w / 2.0) * (32.0 / 18.0) * 1.02
    final_cam_z = max(fit_h_z, fit_w_z, 18.5)

    # 🌊 [전 구간 완벽한 $C^1$ 연속 시네마틱 궤적 계산]:
    for f in range(1, TOTAL_FRAMES + 1, 10):
        if f <= 80:
            # 🪶 [1구간: F1~80 첫 조각 하강 & 카메라 Z=0.8m -> 1.1m 미세 상승]
            t = (f - 1.0) / 79.0
            ease = t * t * (3.0 - 2.0 * t)
            
            c_x = 0.0
            c_y = -1.2
            c_z = 0.8 + ease * 0.3
            t_x, t_y, t_z = 0.0, 0.0, 0.0

        elif f <= 360:
            # 🌤️ [2구간: F80~360 카메라가 Z=1.1m -> 3.5m로 상승하며 고개를 들어올림!]:
            t = (f - 80.0) / (360.0 - 80.0)
            ease = t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

            c_x = 0.0
            c_y = -1.2 * (1.0 - ease)
            c_z = 1.1 + ease * 2.4

            t_x = 0.0
            t_y = ease * 3.5
            t_z = ease * 24.0

        elif f <= 550:
            # ☄️ [3구간: F360~550 (190프레임 = 3.2초) 수천 장의 사진 앞면들을 뚫고 상공(Z=18.5m)으로 솟구침!]:
            t = (f - 360.0) / (550.0 - 360.0)
            ease_z = t * t * (3.0 - 2.0 * t)

            c_x = 0.0
            c_y = -ease_z * 5.0
            c_z = 3.5 + ease_z * (final_cam_z - 3.5)

            # 시선: 조각들을 뚫으며 올려다봄
            t_x = 0.0
            t_y = 3.5
            t_z = 24.0

        elif f <= 820:
            # 🧘 [4구간: F550~820 (무려 270프레임 = 4.5초!) F550 뚫자마자 곧바로 바닥으로 턴! 🌟 공허 0% 완전 박멸!]:
            # F600~800에 허공을 보는 시간을 0초로 완전히 없애고, 뚫고 올라온 바로 그 순간부터 바닥 정중앙(0,0,0)으로 부드럽게 시선 하향!
            t = (f - 550.0) / (820.0 - 550.0) # 0.0 ~ 1.0
            ease = t * t * (3.0 - 2.0 * t)

            c_x = 0.0
            c_y = -5.0 * (1.0 - ease) - 0.001
            c_z = final_cam_z

            # 🌟 타겟: F550부터 지체 없이 즉시 바닥 (0, 0, 0)으로 스르륵- 하향!
            # 고개가 내려가는 동안 바닥에서 수천 장의 조각들이 착착 모여드는 장관을 100% 끊김 없이 관람!
            t_x = 0.0
            t_y = 3.5 * (1.0 - ease)
            t_z = 24.0 * (1.0 - ease)

        else:
            # ⭐ [5구간: F820~1260 완벽한 정방향 탑뷰 상태에서 F980 마지막 조각 착! 안착 피날레]:
            t_x, t_y, t_z = 0.0, 0.0, 0.0
            c_x, c_y, c_z = 0.0, -0.001, final_cam_z

        cam_target.location = Vector((t_x, t_y, t_z))
        cam_target.keyframe_insert(data_path="location", frame=f)

        cam_obj.location = Vector((c_x, c_y, c_z))
        cam_obj.keyframe_insert(data_path="location", frame=f)

    # 마지막 프레임 정확한 탑뷰 고정
    cam_target.location = Vector((0.0, 0.0, 0.0))
    cam_target.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)
    cam_obj.location = Vector((0.0, -0.001, final_cam_z))
    cam_obj.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)

    try:
        if cam_obj.animation_data and cam_obj.animation_data.action:
            action = cam_obj.animation_data.action
            curves = getattr(action, 'fcurves', getattr(action, 'curves', []))
            for fcurve in curves:
                if hasattr(fcurve, 'keyframe_points'):
                    for kfp in fcurve.keyframe_points:
                        kfp.interpolation = 'BEZIER'
                        kfp.easing = 'AUTO'
    except Exception:
        pass

    try:
        if cam_target.animation_data and cam_target.animation_data.action:
            action = cam_target.animation_data.action
            curves = getattr(action, 'fcurves', getattr(action, 'curves', []))
            for fcurve in curves:
                if hasattr(fcurve, 'keyframe_points'):
                    for kfp in fcurve.keyframe_points:
                        kfp.interpolation = 'BEZIER'
                        kfp.easing = 'AUTO'
    except Exception:
        pass

    # DoF: 피날레에 전체 팬포커스 (f/32.0)
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=1)
    cam_data.dof.aperture_fstop = 32.0
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=980)

    # ☀️ 조명 세팅 (초선명 4방향 스튜디오 필 라이트)
    def create_light(name, ltype, energy, color, pos):
        ldata = bpy.data.lights.new(name=name, type=ltype)
        ldata.energy = energy
        ldata.color = color
        if ltype == 'AREA': ldata.size = 38.0
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        lobj.location = pos
        scene.collection.objects.link(lobj)
        return lobj

    create_light("Fill_Front", 'AREA', 2000.0, (1.0, 0.99, 0.98), Vector((0.0, -22.0, 15.0)))
    create_light("Fill_Back", 'AREA', 2000.0, (0.98, 0.99, 1.0), Vector((0.0, 22.0, 15.0)))
    create_light("Fill_Left", 'AREA', 1800.0, (0.99, 0.98, 1.0), Vector((-22.0, 0.0, 15.0)))
    create_light("Fill_Right", 'AREA', 1800.0, (0.98, 0.99, 1.0), Vector((22.0, 0.0, 15.0)))

    # 🖤 차콜 스튜디오 월드 배경
    world = scene.world or bpy.data.worlds.new(f"World_{SCENE_NAME}")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.045, 0.048, 0.055, 1.0)
        bg.inputs[1].default_value = 1.0

    # --------------------------------------------------------------------------
    # [07/07] 3D 시네마틱 한글 타이틀 자막 ("천주호 (겨울)")
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

    # 1. 전면 메인 텍스트 머티리얼 (🌟 선명하고 쨍한 비비드 옐로우 골드)
    mat_front = bpy.data.materials.new(name=f"Mat_Title_Front_{SCENE_NAME}")
    mat_front.use_nodes = True
    f_nodes = mat_front.node_tree.nodes
    f_links = mat_front.node_tree.links
    f_nodes.clear()

    f_out = f_nodes.new('ShaderNodeOutputMaterial')
    f_bsdf = f_nodes.new('ShaderNodeBsdfPrincipled')
    f_bsdf.inputs['Base Color'].default_value = (1.0, 0.88, 0.08, 1.0) # 🌟 쨍하고 선명한 옐로우 골드 (#FFE014)
    f_bsdf.inputs['Roughness'].default_value = 0.15
    if 'Metallic' in f_bsdf.inputs: f_bsdf.inputs['Metallic'].default_value = 0.35
    if 'Emission Color' in f_bsdf.inputs:
        f_bsdf.inputs['Emission Color'].default_value = (1.0, 0.82, 0.05, 1.0)
    elif 'Emission' in f_bsdf.inputs:
        f_bsdf.inputs['Emission'].default_value = (1.0, 0.82, 0.05, 1.0)
    if 'Emission Strength' in f_bsdf.inputs:
        f_bsdf.inputs['Emission Strength'].default_value = 0.65 # 화이트 탈색 없는 선명한 노란빛
    f_links.new(f_bsdf.outputs['BSDF'], f_out.inputs['Surface'])

    # 2. 외곽선(스트로크) 머티리얼 (완전한 딥 블랙 테두리)
    mat_border = bpy.data.materials.new(name=f"Mat_Title_Border_{SCENE_NAME}")
    mat_border.use_nodes = True
    b_nodes = mat_border.node_tree.nodes
    b_links = mat_border.node_tree.links
    b_nodes.clear()
    b_out = b_nodes.new('ShaderNodeOutputMaterial')
    b_emit = b_nodes.new('ShaderNodeEmission')
    b_emit.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0) # 칠흑 같은 리얼 블랙
    b_emit.inputs['Strength'].default_value = 1.0
    b_links.new(b_emit.outputs['Emission'], b_out.inputs['Surface'])

    # 🌟 [전면 텍스트] - 본래 글자
    front_data = bpy.data.curves.new(name="Title_Front_Data", type='FONT')
    front_data.body = "천주호 (겨울)"
    if custom_font:
        front_data.font = custom_font
    front_data.size = 0.95
    front_data.extrude = 0.035
    front_data.bevel_depth = 0.001
    front_data.space_character = 1.08
    front_data.align_x = 'CENTER'
    front_data.align_y = 'CENTER'
    front_data.materials.append(mat_front)

    front_obj = bpy.data.objects.new("Title_Front", front_data)
    scene.collection.objects.link(front_obj)

    # 🌟 [후면 외곽선 텍스트] - curve offset으로 만든 완벽한 균일 검은색 테두리 (Stroke)
    border_data = bpy.data.curves.new(name="Title_Border_Data", type='FONT')
    border_data.body = "천주호 (겨울)"
    if custom_font:
        border_data.font = custom_font
    border_data.size = 0.95
    border_data.offset = 0.016       # 🌟 균일하게 외곽으로 16mm 확장하여 완벽한 검은 테두리 생성!
    border_data.extrude = 0.02
    border_data.bevel_depth = 0.004
    border_data.bevel_resolution = 2
    border_data.space_character = 1.08
    border_data.align_x = 'CENTER'
    border_data.align_y = 'CENTER'
    border_data.materials.append(mat_border)

    border_obj = bpy.data.objects.new("Title_Border", border_data)
    scene.collection.objects.link(border_obj)

    # 📍 타이틀 원래 하단 위치 (1·2번 씬과 완벽한 통일성!)
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

    # 프로젝트 저장
    scene_blend_path = os.path.join(base_dir, f"{SCENE_NAME}.blend")
    try:
        bpy.ops.wm.save_as_mainfile(filepath=scene_blend_path)
        print(f"   💾 전용 프로젝트 저장 완료: {scene_blend_path}")
    except Exception as e:
        print(f"   ⚠️ 저장 스킵: {e}")

    print("\n" + "="*75)
    print(f"🎉 [{SCENE_NAME}] Zero-Void Instant Peak Turn 씬 빌드 완료!")
    print("👉 Numpad 0(카메라) ➔ Spacebar(재생)로 1920x1080 꽉 찬 화면 감상!")
    print("="*75 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("\n" + "!"*75)
        print("❌ [FATAL ERROR] 실행 중 예외 발생:")
        traceback.print_exc()
        print("!"*75 + "\n")
