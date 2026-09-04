"""
================================================================================
🎬 [1번사진] COSMIC SPIRAL GALAXY & 360° ORBITAL DIVE for Blender 5.2 LTS
================================================================================
- 콘셉트: 우주 속 나선 은하(Fibonacci Spiral Galaxy)의 탄생
- Phase 1 (Hero Chase Intro): 대표 사진(Hero Tile) 초밀착 오프닝 (0~2.3초)
- Phase 2~4 (Spiral Vortex): 황금 나선 소용돌이를 그리며 고공에서 회전하며 착지
- Phase 5 (Top-Down Full View): 360° 오비탈 완주 후 1920x1080 화면 100% 풀샷 안착
- 렌더링: True-Color 자체 발광(Emission 1.0) & 차콜 스튜디오 월드
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
# ⚙️ 씬 마스터 타임라인 파라미터 (60fps 기준 / 18.0초)
# ==============================================================================
TOTAL_FRAMES = 1080
FPS = 60
RESOLUTION_X = 1920
RESOLUTION_Y = 1080
SCENE_NAME = "1번사진"

ALL_DOCKED_FRAME = 880      # Frame 880 (14.6초): 가속 도킹 완료
FINALE_END_FRAME = 1080     # Frame 1080 (18.0초): 1920x1080 완성작 쇼케이스 완료

def main():
    print("\n" + "="*75)
    print(f"🎬 [{SCENE_NAME}] Cosmic Spiral Galaxy 씬 빌드 시작 (1,080 Frames)")
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

    # 🎬 비디오 자동 렌더링 세팅 (바탕화면 MP4)
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
    print("[02/06] 1번사진 전용 데이터 & 텍스처 로드 중...")
    
    current_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else ""
    search_dirs = [
        current_dir,
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\scenes\1번사진",
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

    final_color_socket = tex_node.outputs['Color']

    bsdf.location = (500, 0)
    out_node.location = (800, 0)
    links.new(final_color_socket, bsdf.inputs['Base Color'])

    if "Emission Color" in bsdf.inputs:
        links.new(final_color_socket, bsdf.inputs['Emission Color'])
    elif "Emission" in bsdf.inputs:
        links.new(final_color_socket, bsdf.inputs['Emission'])

    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 1.0

    # --------------------------------------------------------------------------
    # [04/06] Cosmic Spiral Galaxy 궤적 & Hero Tile 베이킹
    # --------------------------------------------------------------------------
    print("[04/06] Cosmic Spiral Galaxy 3D 궤적 베이킹 중...")

    total_w = 20.0
    total_h = 20.0 * (rows / cols)
    tile_unit = (total_w / cols) * 0.990
    hw, hh, hd = tile_unit / 2.0, tile_unit / 2.0, 0.035

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

    max_dist = math.hypot(10.0, total_h / 2.0)

    # 🌟 Hero Tile: 중앙 코어 타일
    hero_index = 0
    min_center_d = 999.0
    for idx, t in enumerate(tiles):
        d = math.hypot(t['gridX'], t['gridY'])
        if d < min_center_d:
            min_center_d = d
            hero_index = idx

    hero_start_pos = (2.2, -3.5, 4.8)

    for i, t in enumerate(tiles):
        r, c = t['row'], t['col']
        u_min = c / cols
        v_min = 1.0 - ((r + 1) / rows)
        span_u = 1.0 / cols
        span_v = 1.0 / rows

        attr_uv_min.data[i].vector = (u_min, v_min, 0.0)
        attr_uv_span.data[i].vector = (span_u, span_v, 0.0)

        gx, gy = t['gridX'], t['gridY']
        dist_center = math.hypot(gx, gy)
        norm_dist = dist_center / max_dist

        if i == hero_index:
            sp_x, sp_y, sp_z = hero_start_pos
            launch_f = 1.0
            flight_duration = 140.0
        else:
            # 🌀 [Cosmic Spiral Galaxy 궤적 알고리즘]
            # 황금 나선(Fibonacci Spiral) 각도 + 은하 나선팔(Spiral Arms 3개)
            arm_offset = (i % 3) * (2.0 * math.pi / 3.0)
            spiral_angle = math.atan2(gy, gx) + norm_dist * 4.5 * math.pi + arm_offset + random.uniform(-0.25, 0.25)
            spiral_rad = 14.0 + norm_dist * 22.0 + random.uniform(-2.0, 3.0)
            
            sp_x = math.cos(spiral_angle) * spiral_rad
            sp_y = math.sin(spiral_angle) * spiral_rad
            sp_z = 8.0 + (norm_dist ** 0.8) * 18.0 + random.uniform(-2.0, 4.0)

            # 은하 중심부 ➔ 나선팔 바깥쪽으로 순차 회전 가속 결합
            accel_curve = (norm_dist ** 0.75)
            launch_f = 15.0 + accel_curve * 660.0 + random.uniform(-10, 10)
            launch_f = max(1.0, min(launch_f, ALL_DOCKED_FRAME - 140))
            flight_duration = 160.0 - norm_dist * 40.0

        attr_start_pos.data[i].vector = (sp_x, sp_y, sp_z)
        attr_params.data[i].vector = (flight_duration, launch_f, dist_center)

        # 소용돌이 토네이도 스핀 회전각
        attr_start_rot.data[i].vector = (
            random.uniform(-math.pi * 6, math.pi * 6),
            random.uniform(-math.pi * 6, math.pi * 6),
            spiral_angle if i != hero_index else 0.0
        )

    mosaic_obj = bpy.data.objects.new(f"Mosaic_{SCENE_NAME}", point_mesh)
    bpy.context.scene.collection.objects.link(mosaic_obj)

    # --------------------------------------------------------------------------
    # [05/06] Geometry Nodes 시스템 구축
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
    input_node.location = (-1000, 0)
    output_node = gn_nodes.new('NodeGroupOutput')
    output_node.location = (1400, 0)

    obj_info = gn_nodes.new('GeometryNodeObjectInfo')
    obj_info.location = (-800, -300)
    obj_info.inputs['Object'].default_value = tile_template_obj
    obj_info.transform_space = 'RELATIVE'

    inst_node = gn_nodes.new('GeometryNodeInstanceOnPoints')
    inst_node.location = (-400, 0)
    gn_links.new(input_node.outputs['Geometry'], inst_node.inputs['Points'])
    gn_links.new(obj_info.outputs['Geometry'], inst_node.inputs['Instance'])

    scene_time = gn_nodes.new('GeometryNodeInputSceneTime')
    scene_time.location = (-1000, 400)

    get_floor_pos = gn_nodes.new('GeometryNodeInputPosition')
    get_floor_pos.location = (-800, 200)

    get_params = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_params.location = (-800, 600)
    get_params.data_type = 'FLOAT_VECTOR'
    get_params.inputs['Name'].default_value = "anim_params"

    sep_params = gn_nodes.new('ShaderNodeSeparateXYZ')
    sep_params.location = (-550, 600)
    gn_links.new(get_params.outputs['Attribute'], sep_params.inputs['Vector'])

    get_start_pos = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_start_pos.location = (-800, 0)
    get_start_pos.data_type = 'FLOAT_VECTOR'
    get_start_pos.inputs['Name'].default_value = "start_pos"

    get_start_rot = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_start_rot.location = (-800, -150)
    get_start_rot.data_type = 'FLOAT_VECTOR'
    get_start_rot.inputs['Name'].default_value = "start_rot"

    sub_t = gn_nodes.new('ShaderNodeMath')
    sub_t.location = (-350, 600)
    sub_t.operation = 'SUBTRACT'
    gn_links.new(scene_time.outputs['Frame'], sub_t.inputs[0])
    gn_links.new(sep_params.outputs['Y'], sub_t.inputs[1])

    div_dur = gn_nodes.new('ShaderNodeMath')
    div_dur.location = (-180, 600)
    div_dur.operation = 'DIVIDE'
    gn_links.new(sub_t.outputs['Value'], div_dur.inputs[0])
    gn_links.new(sep_params.outputs['X'], div_dur.inputs[1])

    clamp_t = gn_nodes.new('ShaderNodeClamp')
    clamp_t.location = (0, 600)
    gn_links.new(div_dur.outputs['Value'], clamp_t.inputs['Value'])

    inv_t = gn_nodes.new('ShaderNodeMath')
    inv_t.location = (160, 600)
    inv_t.operation = 'SUBTRACT'
    inv_t.inputs[0].default_value = 1.0
    gn_links.new(clamp_t.outputs['Result'], inv_t.inputs[1])

    pow_t = gn_nodes.new('ShaderNodeMath')
    pow_t.location = (320, 600)
    pow_t.operation = 'POWER'
    pow_t.inputs[1].default_value = 2.6
    gn_links.new(inv_t.outputs['Value'], pow_t.inputs[0])

    ease_t = gn_nodes.new('ShaderNodeMath')
    ease_t.location = (480, 600)
    ease_t.operation = 'SUBTRACT'
    ease_t.inputs[0].default_value = 1.0
    gn_links.new(pow_t.outputs['Value'], ease_t.inputs[1])

    mix_pos = gn_nodes.new('ShaderNodeMix')
    mix_pos.location = (350, 200)
    mix_pos.data_type = 'VECTOR'
    gn_links.new(ease_t.outputs['Value'], mix_pos.inputs['Factor'])
    gn_links.new(get_start_pos.outputs['Attribute'], mix_pos.inputs[4])
    gn_links.new(get_floor_pos.outputs['Position'], mix_pos.inputs[5])

    mix_rot = gn_nodes.new('ShaderNodeMix')
    mix_rot.location = (350, 0)
    mix_rot.data_type = 'VECTOR'
    gn_links.new(ease_t.outputs['Value'], mix_rot.inputs['Factor'])
    gn_links.new(get_start_rot.outputs['Attribute'], mix_rot.inputs[4])
    mix_rot.inputs[5].default_value = (0.0, 0.0, 0.0)

    set_pos = gn_nodes.new('GeometryNodeSetPosition')
    set_pos.location = (600, 200)
    gn_links.new(inst_node.outputs['Instances'], set_pos.inputs['Geometry'])
    gn_links.new(mix_pos.outputs[1], set_pos.inputs['Position'])

    rot_inst = gn_nodes.new('GeometryNodeRotateInstances')
    rot_inst.location = (800, 200)
    gn_links.new(set_pos.outputs['Geometry'], rot_inst.inputs['Instances'])
    gn_links.new(mix_rot.outputs[1], rot_inst.inputs['Rotation'])

    get_uv_min = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_uv_min.location = (600, -200)
    get_uv_min.data_type = 'FLOAT_VECTOR'
    get_uv_min.inputs['Name'].default_value = "uv_min"

    get_uv_span = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_uv_span.location = (600, -350)
    get_uv_span.data_type = 'FLOAT_VECTOR'
    get_uv_span.inputs['Name'].default_value = "uv_span"

    store_min = gn_nodes.new('GeometryNodeStoreNamedAttribute')
    store_min.location = (1000, 100)
    store_min.data_type = 'FLOAT_VECTOR'
    store_min.domain = 'INSTANCE'
    store_min.inputs['Name'].default_value = "inst_uv_min"
    gn_links.new(rot_inst.outputs['Instances'], store_min.inputs['Geometry'])
    gn_links.new(get_uv_min.outputs['Attribute'], store_min.inputs['Value'])

    store_span = gn_nodes.new('GeometryNodeStoreNamedAttribute')
    store_span.location = (1200, 100)
    store_span.data_type = 'FLOAT_VECTOR'
    store_span.domain = 'INSTANCE'
    store_span.inputs['Name'].default_value = "inst_uv_span"
    gn_links.new(store_min.outputs['Geometry'], store_span.inputs['Geometry'])
    gn_links.new(get_uv_span.outputs['Attribute'], store_span.inputs['Value'])

    gn_links.new(store_span.outputs['Geometry'], output_node.inputs['Geometry'])

    # --------------------------------------------------------------------------
    # [06/06] Hero Chase ➔ 360° Orbital Spiral Up ➔ 탑뷰 카메라 구성
    # --------------------------------------------------------------------------
    print("[06/06] 360° Orbital Galaxy 카메라 궤적 구성 중...")

    cam_target = bpy.data.objects.new("Camera_Target_1", None)
    scene.collection.objects.link(cam_target)

    # 🌟 Hero Tile 낙하 위치 계산 헬퍼 (카메라 락온용)
    hero_end_pos = Vector((tiles[hero_index]['gridX'], tiles[hero_index]['gridY'], 0.0))
    hero_start_vec = Vector(hero_start_pos)

    def get_hero_tile_pos(f):
        if f <= 1: return hero_start_vec
        if f >= 140: return hero_end_pos
        t = (f - 1.0) / 139.0
        ease = 1.0 - ((1.0 - t) ** 2.6)
        return hero_start_vec * (1.0 - ease) + hero_end_pos * ease

    # 🌟 Frame 1~140: Hero Tile의 낙하 궤적을 1:1로 정밀 추적하여 화면 중앙에 완벽 고정
    for track_f in [1, 15, 30, 50, 70, 90, 110, 130, 140]:
        cam_target.location = get_hero_tile_pos(track_f)
        cam_target.keyframe_insert(data_path="location", frame=track_f)

    cam_target.location = Vector((0.0, 0.0, 0.0))
    cam_target.keyframe_insert(data_path="location", frame=160)
    cam_target.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)

    cam_data = bpy.data.cameras.new("CinematicCamera_1")
    cam_obj = bpy.data.objects.new("CinematicCamera_1", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = cam_target
    cam_data.dof.aperture_fstop = 11.0

    def add_cam_kf(frame, pos, focal):
        cam_obj.location = Vector(pos)
        cam_data.lens = focal
        cam_obj.keyframe_insert(data_path="location", frame=frame)
        cam_data.keyframe_insert(data_path="lens", frame=frame)

    fit_h_z = (total_h / 2.0) * (28.0 / 12.0) * 1.02
    fit_w_z = (total_w / 2.0) * (28.0 / 18.0) * 1.02
    final_cam_z = max(fit_h_z, fit_w_z, 16.0)

    # 🎬 [1단계: Hero Tile 초근접 밀착 동행 비행 (F1~140)]
    hero_cam_keyframes = [
        (1,   Vector((-0.8, -1.8, 0.8)), 45.0),
        (40,  Vector((-0.4, -2.2, 1.0)), 42.0),
        (80,  Vector(( 0.1, -2.6, 1.3)), 38.0),
        (110, Vector(( 0.4, -2.9, 1.6)), 36.0),
        (140, Vector(( 0.55, -3.15, 1.8)), 35.0),
    ]
    for f, offset, focal in hero_cam_keyframes:
        p = get_hero_tile_pos(f) + offset
        add_cam_kf(f, (p.x, p.y, p.z), focal)

    # 🎬 [2단계: 360° 은하 오비탈 나선 회전 상승 ➔ 수직 탑뷰 피날레 (F140~1080)]
    orbital_keyframes = [
        # Frame, Radius, Height(Z), Angle(deg), Focal
        (300,   5.5,   3.8,    75.0,  35.0), # 은하 중심부 회전 관측
        (550,   9.5,   7.5,   165.0,  32.0), # 나선팔 상승 궤도
        (750,  14.5,  12.0,   270.0,  28.0), # 광활한 은하 전경
        (880,   4.0,  final_cam_z * 0.88, 340.0, 28.0), # 전체 도킹 ➔ 상공 하강
        (950,   0.2,  final_cam_z * 0.99, 360.0, 28.0), # 360° 완주 후 수직 정렬
        (1080,  0.0,  final_cam_z,        360.0, 28.0), # 1920x1080 100% 꽉 찬 풀샷 피날레
    ]

    for f, rad, h, deg, focal in orbital_keyframes:
        rad_angle = math.radians(deg)
        x = math.sin(rad_angle) * rad
        y = -math.cos(rad_angle) * rad
        add_cam_kf(f, (x, y, h), focal)

    cam_data.dof.aperture_fstop = 11.0
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=1)
    cam_data.dof.aperture_fstop = 16.0
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=140)
    cam_data.dof.aperture_fstop = 32.0
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=880)

    # ☀️ 조명 세팅 (은은한 스튜디오 필 라이트)
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
    # [07/07] 3D 시네마틱 한글 타이틀 자막 ("천주호 (야간)")
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

    # 1. 메인 타이틀 머티리얼 (🌟 진하고 화려한 24K 리치 골드 & 앰버 셰이더)
    mat_title = bpy.data.materials.new(name=f"Mat_Title_{SCENE_NAME}")
    mat_title.use_nodes = True
    t_nodes = mat_title.node_tree.nodes
    t_links = mat_title.node_tree.links
    t_nodes.clear()

    t_out = t_nodes.new('ShaderNodeOutputMaterial')
    t_bsdf = t_nodes.new('ShaderNodeBsdfPrincipled')
    t_bsdf.inputs['Base Color'].default_value = (1.0, 0.68, 0.10, 1.0) # 🌟 짙고 선명한 24K 리얼 황금색 (#FFAE19)
    t_bsdf.inputs['Roughness'].default_value = 0.22
    if 'Metallic' in t_bsdf.inputs: t_bsdf.inputs['Metallic'].default_value = 0.75 # 메탈릭 골드 질감
    if 'Emission Color' in t_bsdf.inputs:
        t_bsdf.inputs['Emission Color'].default_value = (1.0, 0.62, 0.08, 1.0) # 채도 높은 앰버 골드 발광
    elif 'Emission' in t_bsdf.inputs:
        t_bsdf.inputs['Emission'].default_value = (1.0, 0.62, 0.08, 1.0)
    if 'Emission Strength' in t_bsdf.inputs:
        t_bsdf.inputs['Emission Strength'].default_value = 0.45 # 발광 과다로 인한 화이트 탈색 방지
    t_links.new(t_bsdf.outputs['BSDF'], t_out.inputs['Surface'])

    # 2. 그림자/외곽선 머티리얼 (배경 보랏빛 호수와 어우러지는 딥 미드나이트 섀도우)
    mat_shadow = bpy.data.materials.new(name=f"Mat_Title_Shadow_{SCENE_NAME}")
    mat_shadow.use_nodes = True
    s_nodes = mat_shadow.node_tree.nodes
    s_links = mat_shadow.node_tree.links
    s_nodes.clear()
    s_out = s_nodes.new('ShaderNodeOutputMaterial')
    s_emit = s_nodes.new('ShaderNodeEmission')
    s_emit.inputs['Color'].default_value = (0.012, 0.008, 0.022, 1.0) # 딥 코스믹 나이트
    s_emit.inputs['Strength'].default_value = 1.0
    s_links.new(s_emit.outputs['Emission'], s_out.inputs['Surface'])

    # 🌟 메인 텍스트 ("천주호 (야간)") - 글자 뭉개짐 없는 초정밀 마이크로 베벨 세팅
    text_data = bpy.data.curves.new(name="Title_Text_Data", type='FONT')
    text_data.body = "천주호 (야간)"
    if custom_font:
        text_data.font = custom_font
    text_data.size = 0.95
    text_data.extrude = 0.025
    text_data.bevel_depth = 0.0025   # 🌟 0.012 -> 0.0025로 대폭 축소하여 자음/모음 틈새 뭉개짐 완전 방지!
    text_data.bevel_resolution = 3
    text_data.space_character = 1.08 # 글자 간격을 적절히 띄워 획 간섭 방지
    text_data.align_x = 'CENTER'
    text_data.align_y = 'CENTER'
    text_data.materials.append(mat_title)

    text_obj = bpy.data.objects.new("Title_Text", text_data)
    scene.collection.objects.link(text_obj)

    # 🌟 드롭 섀도우 텍스트 (글자 바로 뒤에 배치되어 화려한 배경에서도 글자를 또렷하게 살림)
    shadow_data = bpy.data.curves.new(name="Title_Shadow_Data", type='FONT')
    shadow_data.body = "천주호 (야간)"
    if custom_font:
        shadow_data.font = custom_font
    shadow_data.size = 0.97
    shadow_data.extrude = 0.015
    shadow_data.bevel_depth = 0.006
    shadow_data.bevel_resolution = 2
    shadow_data.space_character = 1.08
    shadow_data.align_x = 'CENTER'
    shadow_data.align_y = 'CENTER'
    shadow_data.materials.append(mat_shadow)

    shadow_obj = bpy.data.objects.new("Title_Shadow", shadow_data)
    scene.collection.objects.link(shadow_obj)

    # 타이틀 배치 좌표 (모자이크 하단)
    title_pos_y = - (total_h / 2.0) + 1.05
    title_z = 0.28
    shadow_z = 0.15

    # 🎬 [애니메이션: Frame 800에서 바로 등장!]
    # Frame 790: 준비
    text_obj.location = Vector((0.0, title_pos_y, -0.3))
    text_obj.scale = Vector((0.001, 0.001, 0.001))
    text_obj.keyframe_insert(data_path="location", frame=790)
    text_obj.keyframe_insert(data_path="scale", frame=790)

    shadow_obj.location = Vector((0.0, title_pos_y - 0.03, -0.3))
    shadow_obj.scale = Vector((0.001, 0.001, 0.001))
    shadow_obj.keyframe_insert(data_path="location", frame=790)
    shadow_obj.keyframe_insert(data_path="scale", frame=790)

    # Frame 800: 등장 시작
    text_obj.location = Vector((0.0, title_pos_y, 0.0))
    text_obj.scale = Vector((0.3, 0.3, 0.3))
    text_obj.keyframe_insert(data_path="location", frame=800)
    text_obj.keyframe_insert(data_path="scale", frame=800)

    shadow_obj.location = Vector((0.0, title_pos_y - 0.03, -0.05))
    shadow_obj.scale = Vector((0.3, 0.3, 0.3))
    shadow_obj.keyframe_insert(data_path="location", frame=800)
    shadow_obj.keyframe_insert(data_path="scale", frame=800)

    # Frame 825: 선명하고 웅장하게 안착
    text_obj.location = Vector((0.0, title_pos_y, title_z))
    text_obj.scale = Vector((1.0, 1.0, 1.0))
    text_obj.keyframe_insert(data_path="location", frame=825)
    text_obj.keyframe_insert(data_path="scale", frame=825)

    shadow_obj.location = Vector((0.0, title_pos_y - 0.03, shadow_z))
    shadow_obj.scale = Vector((1.0, 1.0, 1.0))
    shadow_obj.keyframe_insert(data_path="location", frame=825)
    shadow_obj.keyframe_insert(data_path="scale", frame=825)

    # Frame 1080까지 깔끔하게 유지
    text_obj.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)
    text_obj.keyframe_insert(data_path="scale", frame=TOTAL_FRAMES)
    shadow_obj.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)
    shadow_obj.keyframe_insert(data_path="scale", frame=TOTAL_FRAMES)

    # 렌더 엔진 및 GPU 설정
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    if hasattr(scene, 'eevee'):
        try: scene.eevee.taa_render_samples = 32
        except Exception: pass
        try: scene.eevee.use_raytracing = False
        except Exception: pass
        try: scene.eevee.use_shadows = True
        except Exception: pass

    # 🌈 True-Color sRGB 색상 매니지먼트 (AgX/Filmic의 어두워짐 방지)
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
    print(f"🎉 [{SCENE_NAME}] Cosmic Spiral Galaxy 씬 빌드 완료!")
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
