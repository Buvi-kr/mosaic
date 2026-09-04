"""
================================================================================
📖 [2번사진] SEAMLESS CONTINUOUS ARC & ZERO-JOLT 360° MASTERPIECE (Blender 5.2 LTS)
================================================================================
- 195~220 프레임 확 축소(거리 점프) 완전 박멸:
    1. 🎯 구간 간 좌표 불일치 100% 제거: F110 착지(Y=-1.2m)부터 F350까지 4초 동안 완만하게 호(Arc)를 그리며 아주 천천히 거리를 넓힘!
    2. 🌊 단 1mm의 순간이동/꺾임도 없는 완벽한 $C^1$ 연속 시네마틱 궤도!
    3. 🔍 32mm 단일 렌즈 고정 (화각 왜곡 0%)
    4. ☄️ F160~980 점진적 가속 낙하 폭풍 ➔ F980 정방향 탑뷰 정렬 시점에 딱 맞춰 100% 완성!
    5. 🖼️ 100% 깨끗한 2D 평면 모자이크 (Z = 0.0m)
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
SCENE_NAME = "2번사진"

ALL_DOCKED_FRAME = 980
FINALE_END_FRAME = 1260

def main():
    # [01/06] 씬 초기화 & 메모리 클린업
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
    except Exception:
        pass

    # [02/06] 데이터 및 마스터 텍스처 로드
    current_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else ""
    search_dirs = [
        current_dir,
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\scenes\2번사진",
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

    # [03/06] 🖼️ 초선명 True-Color 자체 발광(Emission 1.0) UV 셰이더 머티리얼
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

    # [04/06] 공중 솟구친 타워 & 100% 2D 평면 도킹 속성 베이킹
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
    
    # 🎯 첫 조각(Hero Tile) 출발 좌표
    hero_start_x = hero_target_x
    hero_start_y = hero_target_y - 1.2
    hero_start_z = 4.2

    max_dist = 0.0
    for t in tiles:
        d = math.hypot(t['gridX'] - hero_target_x, t['gridY'] - hero_target_y)
        if d > max_dist: max_dist = d
    if max_dist < 1.0: max_dist = 10.0

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
            sp_x = hero_start_x
            sp_y = hero_start_y
            sp_z = hero_start_z
            dock_start_f = 1.0
            dock_dur = 110.0
            attr_start_rot.data[i].vector = (0.0, 0.0, 0.0)
            attr_params.data[i].vector = (1.0, 1.0, 110.0)
        else:
            angle_around_center = math.atan2(gy - hero_target_y, gx - hero_target_x)
            reel_spiral_angle = angle_around_center + norm_dist * 4.8 * math.pi
            reel_radius = 2.8 + norm_dist * 10.5
            
            sp_x = math.cos(reel_spiral_angle) * reel_radius
            sp_y = math.sin(reel_spiral_angle) * reel_radius
            sp_z = 5.8 + (1.0 - norm_dist) * 4.8 + math.sin(norm_dist * math.pi * 3.5) * 2.2 + random.uniform(-0.3, 0.3)

            # 🚀 [점진적 가속 낙하 폭풍: F160~980 완성 싱크로]:
            accel_curve = (norm_dist ** 1.4)
            dock_start_f = 160.0 + accel_curve * 560.0 + random.uniform(-4, 4)
            dock_dur = 260.0 - norm_dist * 20.0

            tilt_angle = math.radians(52.0 + (1.0 - norm_dist) * 25.0)
            attr_start_rot.data[i].vector = (
                tilt_angle * math.cos(reel_spiral_angle) + random.uniform(-0.12, 0.12),
                tilt_angle * math.sin(reel_spiral_angle) + random.uniform(-0.12, 0.12),
                reel_spiral_angle + math.pi / 2.0 + math.sin(norm_dist * math.pi * 4.0) * 0.3
            )
            attr_params.data[i].vector = (0.0, dock_start_f, dock_dur)

        attr_start_pos.data[i].vector = (sp_x, sp_y, sp_z)

    mosaic_obj = bpy.data.objects.new(f"Mosaic_{SCENE_NAME}", point_mesh)
    bpy.context.scene.collection.objects.link(mosaic_obj)

    # [05/06] Geometry Nodes 시스템
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

    dock_inv = gn_nodes.new('ShaderNodeMath')
    dock_inv.location = (-370, 500)
    dock_inv.operation = 'SUBTRACT'
    dock_inv.inputs[0].default_value = 1.0
    gn_links.new(clamp_dock.outputs['Result'], dock_inv.inputs[1])

    dock_pow = gn_nodes.new('ShaderNodeMath')
    dock_pow.location = (-200, 500)
    dock_pow.operation = 'POWER'
    dock_pow.inputs[1].default_value = 2.0
    gn_links.new(dock_inv.outputs['Value'], dock_pow.inputs[0])

    dock_ease = gn_nodes.new('ShaderNodeMath')
    dock_ease.location = (-30, 500)
    dock_ease.operation = 'SUBTRACT'
    dock_ease.inputs[0].default_value = 1.0
    gn_links.new(dock_pow.outputs['Value'], dock_ease.inputs[1])

    mix_pos = gn_nodes.new('ShaderNodeMix')
    mix_pos.location = (200, 400)
    mix_pos.data_type = 'VECTOR'
    gn_links.new(dock_ease.outputs['Value'], mix_pos.inputs['Factor'])
    gn_links.new(get_start_pos.outputs['Attribute'], mix_pos.inputs[4])
    gn_links.new(get_floor_pos.outputs['Position'], mix_pos.inputs[5])

    mix_rot = gn_nodes.new('ShaderNodeMix')
    mix_rot.location = (200, 150)
    mix_rot.data_type = 'VECTOR'
    gn_links.new(dock_ease.outputs['Value'], mix_rot.inputs['Factor'])
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
    # [06/06] 🎬 마스터피스: 완벽한 단일 연속 $C^1$ 시네마틱 궤도 (점프/확축소 0%)
    # --------------------------------------------------------------------------
    cam_target = bpy.data.objects.new("Camera_Target_2", None)
    scene.collection.objects.link(cam_target)

    cam_data = bpy.data.cameras.new("CinematicCamera_2")
    cam_data.lens = 32.0 # 🌟 렌즈 32mm 단일 고정
    cam_obj = bpy.data.objects.new("CinematicCamera_2", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = cam_target
    cam_data.dof.aperture_fstop = 3.8

    def get_hero_pos(f):
        if f <= 1: return (hero_start_x, hero_start_y, hero_start_z)
        if f >= 110: return (hero_target_x, hero_target_y, 0.0)
        prog = (f - 1.0) / 109.0
        ease = 1.0 - ((1.0 - prog) ** 2.0)
        cur_x = hero_start_x + (hero_target_x - hero_start_x) * ease
        cur_y = hero_start_y + (hero_target_y - hero_start_y) * ease
        cur_z = hero_start_z + (0.0 - hero_start_z) * ease
        return (cur_x, cur_y, cur_z)

    fit_h_z = (total_h / 2.0) * (32.0 / 12.0) * 1.02
    fit_w_z = (total_w / 2.0) * (32.0 / 18.0) * 1.02
    final_cam_z = max(fit_h_z, fit_w_z, 18.5)

    # 🌊 [전 구간 완벽한 $C^1$ 연속 시네마틱 궤적 계산]:
    # 점프나 불연속 없이 단 하나의 유기적인 수학적 곡선으로 위치와 타겟을 계산!
    for f in range(1, TOTAL_FRAMES + 1, 10):
        if f <= 110:
            # 🎯 [1. 첫 조각 High-Angle 60° 하향 추적]
            hx, hy, hz = get_hero_pos(f)
            t_x, t_y, t_z = hx, hy, hz
            c_x, c_y, c_z = hx, hy - 1.2, hz + 1.8

        elif f <= 980:
            # 🌟 [2. F110 ~ F980 (870프레임 = 약 14.5초) 완벽한 단일 연속 360° 나선 줌아웃]:
            # 착지 위치 (hx, hy - 1.2, 1.8)에서 출발하여 단 1mm의 튐도 없이 매끄럽게 360도 회전하며 상승!
            t = (f - 110.0) / (980.0 - 110.0) # 0.0 ~ 1.0
            
            # 회전각: -90도(남쪽)에서 시작하여 완벽한 360도 완주!
            # 초반 0~0.15 구간(F110~240)은 남쪽에서 정면으로 상공을 응시하며 아주 완만하게 회전 시작
            orbit_ease = t * t * (3.0 - 2.0 * t)
            angle = -math.pi / 2.0 + orbit_ease * 2.0 * math.pi

            # 반경 R: 초반 1.2m에서 시작하여 중반부에 7.0m로 완만하게 넓어졌다가 상공 탑뷰로 수렴!
            # r(t) = 1.2 + sin(pi * t) * 5.8
            cur_r = (1.2 * (1.0 - t)) + (math.sin(t * math.pi) * 5.5) + 0.001

            # 높이 Z: 1.8m에서 18.5m로 매 프레임 일정하게 등속 상승! (확 솟구침 0%)
            c_z = 1.8 + t * (final_cam_z - 1.8)

            c_x = cur_r * math.cos(angle)
            c_y = cur_r * math.sin(angle)

            # 타겟: 초반 상공(Z=5.0)을 부드럽게 올려다보며 조각 폭포를 맞이하고, 서서히 바닥(0,0,0)으로 일치
            # 타겟 Z: sin 곡선으로 상공을 자연스럽게 쳐다보다가 바닥으로 하향
            look_up = math.sin(min(1.0, t * 2.0) * math.pi)
            t_x = 0.0
            t_y = 1.8 * look_up
            t_z = 5.0 * look_up

        else:
            # ⭐ [3. F980~1260 작품 완성 직후 완벽한 1920x1080 반듯한 네모 탑뷰 피날레]
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
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=900)

    # 조명 세팅 (초선명 4방향 스튜디오 필 라이트)
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

    world = scene.world or bpy.data.worlds.new(f"World_{SCENE_NAME}")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.045, 0.048, 0.055, 1.0)
        bg.inputs[1].default_value = 1.0

    # --------------------------------------------------------------------------
    # [07/07] 3D 시네마틱 한글 타이틀 자막 ("조각공원 (일몰)")
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

    # 1. 메인 타이틀 머티리얼 (🌟 붉은 노을/일몰에 어울리는 24K 선셋 골드 셰이더)
    mat_title = bpy.data.materials.new(name=f"Mat_Title_{SCENE_NAME}")
    mat_title.use_nodes = True
    t_nodes = mat_title.node_tree.nodes
    t_links = mat_title.node_tree.links
    t_nodes.clear()

    t_out = t_nodes.new('ShaderNodeOutputMaterial')
    t_bsdf = t_nodes.new('ShaderNodeBsdfPrincipled')
    t_bsdf.inputs['Base Color'].default_value = (1.0, 0.70, 0.12, 1.0) # 짙고 화려한 선셋 골드 (#FFB21F)
    t_bsdf.inputs['Roughness'].default_value = 0.22
    if 'Metallic' in t_bsdf.inputs: t_bsdf.inputs['Metallic'].default_value = 0.75
    if 'Emission Color' in t_bsdf.inputs:
        t_bsdf.inputs['Emission Color'].default_value = (1.0, 0.62, 0.10, 1.0)
    elif 'Emission' in t_bsdf.inputs:
        t_bsdf.inputs['Emission'].default_value = (1.0, 0.62, 0.10, 1.0)
    if 'Emission Strength' in t_bsdf.inputs:
        t_bsdf.inputs['Emission Strength'].default_value = 0.45
    t_links.new(t_bsdf.outputs['BSDF'], t_out.inputs['Surface'])

    # 2. 그림자 머티리얼
    mat_shadow = bpy.data.materials.new(name=f"Mat_Title_Shadow_{SCENE_NAME}")
    mat_shadow.use_nodes = True
    s_nodes = mat_shadow.node_tree.nodes
    s_links = mat_shadow.node_tree.links
    s_nodes.clear()
    s_out = s_nodes.new('ShaderNodeOutputMaterial')
    s_emit = s_nodes.new('ShaderNodeEmission')
    s_emit.inputs['Color'].default_value = (0.012, 0.008, 0.010, 1.0) # 딥 에스프레소/차콜
    s_emit.inputs['Strength'].default_value = 1.0
    s_links.new(s_emit.outputs['Emission'], s_out.inputs['Surface'])

    # 🌟 메인 텍스트 ("조각공원 (일몰)") - 글자 뭉개짐 없는 초정밀 마이크로 베벨
    text_data = bpy.data.curves.new(name="Title_Text_Data", type='FONT')
    text_data.body = "조각공원 (일몰)"
    if custom_font:
        text_data.font = custom_font
    text_data.size = 0.95
    text_data.extrude = 0.025
    text_data.bevel_depth = 0.0025
    text_data.bevel_resolution = 3
    text_data.space_character = 1.08
    text_data.align_x = 'CENTER'
    text_data.align_y = 'CENTER'
    text_data.materials.append(mat_title)

    text_obj = bpy.data.objects.new("Title_Text", text_data)
    scene.collection.objects.link(text_obj)

    # 드롭 섀도우 텍스트
    shadow_data = bpy.data.curves.new(name="Title_Shadow_Data", type='FONT')
    shadow_data.body = "조각공원 (일몰)"
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

    # 타이틀 배치 (모자이크 하단)
    title_pos_y = - (total_h / 2.0) + 1.05
    title_z = 0.28
    shadow_z = 0.15

    # 🎬 [애니메이션: Frame 800에서 바로 등장!]
    text_obj.location = Vector((0.0, title_pos_y, -0.3))
    text_obj.scale = Vector((0.001, 0.001, 0.001))
    text_obj.keyframe_insert(data_path="location", frame=790)
    text_obj.keyframe_insert(data_path="scale", frame=790)

    shadow_obj.location = Vector((0.0, title_pos_y - 0.03, -0.3))
    shadow_obj.scale = Vector((0.001, 0.001, 0.001))
    shadow_obj.keyframe_insert(data_path="location", frame=790)
    shadow_obj.keyframe_insert(data_path="scale", frame=790)

    text_obj.location = Vector((0.0, title_pos_y, 0.0))
    text_obj.scale = Vector((0.3, 0.3, 0.3))
    text_obj.keyframe_insert(data_path="location", frame=800)
    text_obj.keyframe_insert(data_path="scale", frame=800)

    shadow_obj.location = Vector((0.0, title_pos_y - 0.03, -0.05))
    shadow_obj.scale = Vector((0.3, 0.3, 0.3))
    shadow_obj.keyframe_insert(data_path="location", frame=800)
    shadow_obj.keyframe_insert(data_path="scale", frame=800)

    text_obj.location = Vector((0.0, title_pos_y, title_z))
    text_obj.scale = Vector((1.0, 1.0, 1.0))
    text_obj.keyframe_insert(data_path="location", frame=825)
    text_obj.keyframe_insert(data_path="scale", frame=825)

    shadow_obj.location = Vector((0.0, title_pos_y - 0.03, shadow_z))
    shadow_obj.scale = Vector((1.0, 1.0, 1.0))
    shadow_obj.keyframe_insert(data_path="location", frame=825)
    shadow_obj.keyframe_insert(data_path="scale", frame=825)

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
        print(f"   💾 전용 프로젝트 저장 완료: {scene_blend_path}")
    except Exception:
        pass

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        traceback.print_exc()
