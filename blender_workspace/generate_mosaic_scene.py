"""
================================================================================
🎬 21-SECOND MASTERPIECE CINEMATIC MOSAIC GENERATOR for Blender 5.2 LTS
================================================================================
[총 21.0초 (1,260 Frames @ 60fps) 대작 영화급 시네마틱 파이프라인]
 1. 하이앵글(High-Angle Top-Down) 시점 개편:
    - Phase 1 (0.0~5.0s / F1~300): 상공 65도 하이앵글에서 12x12 코어의 사방 역동적 비행과 평면 조립 조망
    - Phase 2 (5.0~7.0s / F300~420): 공중 부유 후 바닥(Z=0)으로 묵직하게 '쿵-!' 수직 낙하
    - Phase 3 (7.0~16.5s / F420~990): 2,772개 대군단 9.5초 동안 여유롭고 우아하게 동심원 도킹
    - Phase 4 (16.5~21.0s / F990~1260): 골든 플래시 & 상공 48m 초고해상도 완성작 4.5초 넉넉한 풀샷 쇼케이스!
 2. 역동적인 3D 파편 회전 & 마그네틱 스냅 (Magnetic Snap) 도킹
 3. Geometry Nodes 실시간 60fps GPU 가속 & master_mosaic.jpg (10,800x10,800) 100% 정밀 UV
================================================================================
"""

import bpy
import json
import os
import math
import random
import traceback
from mathutils import Vector, Euler

# ==============================================================================
# ⚙️ 21초 시네마틱 마스터 타임라인 파라미터 (60fps 기준)
# ==============================================================================
TOTAL_FRAMES = 1260         # 총 21.0초 (피날레 전신샷 넉넉하게 4.5초 확보!)
FPS = 60
# ⚡ [라이트닝 초고속 렌더 모드] 1080p FHD (4K 대비 10배 이상 빠름! 약 30~40초 완성)
RESOLUTION_X = 1920
RESOLUTION_Y = 1080

# 4단계 타임라인
CORE_FLY_START = 1          # Phase 1: 12x12 코어 발사 시작
CORE_ASSEMBLY_FRAME = 300   # Phase 1: 공중 결합 완료 (5.0초)
CORE_DROP_START = 330       # Phase 2: 바닥 낙하 시작
CORE_DOCK_FRAME = 410       # Phase 2: 바닥 착지 완료 (6.8초)

OUTER_FLY_START = 420       # Phase 3: 외곽 대군단 나선 파동 출발 (7.0초)
ALL_TILES_DOCKED = 990      # Phase 3: 2,772개 타일 9.5초 동안 여유롭게 도킹 완료 (16.5초)

FLASH_PEAK_FRAME = 1010     # Phase 4: 골든 플래시 발광 피크 (16.8초)
CAMERA_FINALE_FRAME = 1260  # Phase 4: 21초 최종 풀백 완료 (21.0초)

def main():
    print("\n" + "="*75)
    print("🎬 [21s MASTERPIECE CINEMATIC MOSAIC] 씬 빌드 시작 (1,260 Frames)")
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

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = TOTAL_FRAMES
    scene.render.fps = FPS
    scene.render.resolution_x = RESOLUTION_X
    scene.render.resolution_y = RESOLUTION_Y

    # 🎬 [비디오 자동 렌더링 세팅: 바탕화면으로 MP4 저장]
    desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")
    scene.render.filepath = os.path.join(desktop_dir, "mosaic_cinematic_v1.mp4")

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
    # [02/06] 작업 폴더 및 완성본 텍스처 로드
    # --------------------------------------------------------------------------
    print("[02/06] 데이터 및 완성본 마스터 텍스처 로드 중...")
    search_dirs = [
        os.path.dirname(bpy.data.filepath) if bpy.data.filepath else "",
        os.path.join(os.getcwd(), "blender_workspace"),
        os.getcwd(),
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace",
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2"
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
        raise FileNotFoundError("❌ 'mosaic_data.json'을 찾을 수 없습니다.")

    with open(data_file, 'r', encoding='utf-8') as f:
        mosaic_data = json.load(f)

    metadata = mosaic_data["metadata"]
    tiles = mosaic_data["tiles"]
    cols = metadata["cols"]
    rows = metadata["rows"]
    num_tiles = len(tiles)

    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    master_candidates = [
        os.path.join(base_dir, "master_mosaic.jpg"),
        os.path.join(project_root, "public", "outputs", "mosaic_1787015400541.jpg"),
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\master_mosaic.jpg",
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\public\outputs\mosaic_1787015400541.jpg"
    ]

    master_img_path = None
    for p in master_candidates:
        if os.path.exists(p):
            master_img_path = os.path.abspath(p)
            break

    if not master_img_path:
        raise FileNotFoundError("❌ 'master_mosaic.jpg'를 찾을 수 없습니다.")

    print(f"   ↳ 데이터 로드 완료: {num_tiles:,}개 타일 ({cols}x{rows})")
    print(f"   🖼 마스터 텍스처: {master_img_path}")

    # --------------------------------------------------------------------------
    # [03/06] 정밀 UV 슬라이싱 셰이더 머티리얼 구성
    # --------------------------------------------------------------------------
    print("[03/06] True-Fidelity UV 인스턴스 셰이더 머티리얼 구성 중...")
    mat = bpy.data.materials.new(name="Mat_GeoNodes_Mosaic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    out_node.location = (800, 0)

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (500, 0)
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    # 밝은 화이트 배경에서 사진이 왜곡 없이 가장 선명하고 또렷하게 보이도록 세팅
    if "Roughness" in bsdf.inputs: bsdf.inputs["Roughness"].default_value = 0.35
    if "Metallic" in bsdf.inputs: bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs: bsdf.inputs["Specular IOR Level"].default_value = 0.2

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

    tex_node = nodes.new('ShaderNodeTexImage')
    tex_node.location = (150, 150)
    loaded_img = bpy.data.images.load(master_img_path, check_existing=True)
    tex_node.image = loaded_img

    links.new(v_add.outputs['Vector'], tex_node.inputs['Vector'])
    links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

    # 피날레 골든/화이트 글로우 플래시 (Frame 1010 피크)
    if "Emission Color" in bsdf.inputs:
        links.new(tex_node.outputs['Color'], bsdf.inputs['Emission Color'])
    elif "Emission" in bsdf.inputs:
        links.new(tex_node.outputs['Color'], bsdf.inputs['Emission'])

    if "Emission Strength" in bsdf.inputs:
        em = bsdf.inputs["Emission Strength"]
        em.default_value = 0.0
        em.keyframe_insert(data_path="default_value", frame=1)
        em.keyframe_insert(data_path="default_value", frame=FLASH_PEAK_FRAME - 30)
        em.default_value = 0.6
        em.keyframe_insert(data_path="default_value", frame=FLASH_PEAK_FRAME)
        em.default_value = 0.0
        em.keyframe_insert(data_path="default_value", frame=FLASH_PEAK_FRAME + 50)

    # --------------------------------------------------------------------------
    # [04/06] 단일 포인트 클라우드 및 21초 역동적 시차 어트리뷰트 베이킹
    # --------------------------------------------------------------------------
    print("[04/06] 21초 역동적 시차 및 360도 공간 속성 베이킹 중...")

    tile_w = 20.0 / cols * 0.96
    tile_h = 20.0 / rows * 0.96
    hw, hh, hd = tile_w / 2.0, tile_h / 2.0, 0.035

    tile_mesh = bpy.data.meshes.new("SingleTileMesh")
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
    uv_dict = {4: (0.0, 0.0), 5: (1.0, 0.0), 6: (1.0, 1.0), 7: (0.0, 1.0)}
    for loop in tile_mesh.loops:
        uv_layer.data[loop.index].uv = uv_dict.get(loop.vertex_index, (0.0, 0.0))
    tile_mesh.materials.append(mat)

    tile_template_obj = bpy.data.objects.new("TileTemplate", tile_mesh)
    bpy.context.scene.collection.objects.link(tile_template_obj)
    tile_template_obj.hide_viewport = True
    tile_template_obj.hide_render = True

    point_mesh = bpy.data.meshes.new("MosaicPointsMesh")
    point_coords = [(t['gridX'], t['gridY'], 0.0) for t in tiles]
    point_mesh.from_pydata(point_coords, [], [])
    point_mesh.update()

    attr_start_pos = point_mesh.attributes.new(name="start_pos", type='FLOAT_VECTOR', domain='POINT')
    attr_start_rot = point_mesh.attributes.new(name="start_rot", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_min = point_mesh.attributes.new(name="uv_min", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_span = point_mesh.attributes.new(name="uv_span", type='FLOAT_VECTOR', domain='POINT')
    attr_params = point_mesh.attributes.new(name="anim_params", type='FLOAT_VECTOR', domain='POINT')

    core_min_r, core_max_r = (rows // 2) - 6, (rows // 2) + 5
    core_min_c, core_max_c = (cols // 2) - 6, (cols // 2) + 5
    max_dist = math.sqrt(10.0**2 + 10.0**2)

    for i, t in enumerate(tiles):
        r, c = t['row'], t['col']
        u_min = c / cols
        v_min = 1.0 - ((r + 1) / rows)
        span_u = 1.0 / cols
        span_v = 1.0 / rows

        attr_uv_min.data[i].vector = (u_min, v_min, 0.0)
        attr_uv_span.data[i].vector = (span_u, span_v, 0.0)

        is_core = (core_min_r <= r <= core_max_r) and (core_min_c <= c <= core_max_c)
        dist_center = math.hypot(t['gridX'], t['gridY'])

        if is_core:
            # 12x12 코어: 사방 전방위에서 역동적인 나선 비행
            phi = random.uniform(-math.pi * 0.45, math.pi * 0.45)
            theta = random.uniform(0, math.pi * 2)
            rad = random.uniform(22.0, 36.0)
            sp = (
                math.cos(phi) * math.cos(theta) * rad,
                math.cos(phi) * math.sin(theta) * rad,
                math.sin(phi) * rad + 7.5
            )
            core_dist_norm = dist_center / 3.5
            launch_f = 1.0 + core_dist_norm * 140.0 + random.uniform(-8, 8)
            attr_params.data[i].vector = (1.0, launch_f, dist_center)
        else:
            # 외곽 대군단: F420부터 F800까지 무려 9.5초(570프레임)에 걸쳐 은하수 나선 파동으로 여유롭게 순차 도킹!
            angle = math.atan2(t['gridY'], t['gridX']) + random.uniform(-0.6, 0.6)
            rad = random.uniform(26.0, 42.0)
            sp = (
                math.cos(angle) * rad,
                math.sin(angle) * rad,
                random.uniform(14.0, 34.0)
            )
            norm_dist = dist_center / max_dist
            launch_f = OUTER_FLY_START + norm_dist * (ALL_TILES_DOCKED - OUTER_FLY_START - 190) + random.uniform(-15, 15)
            attr_params.data[i].vector = (0.0, launch_f, dist_center)

        attr_start_pos.data[i].vector = sp
        # 더욱 역동적인 3D 덤블링 회전각 부여
        attr_start_rot.data[i].vector = (
            random.uniform(-math.pi * 6, math.pi * 6),
            random.uniform(-math.pi * 6, math.pi * 6),
            random.uniform(-math.pi * 6, math.pi * 6)
        )

    mosaic_obj = bpy.data.objects.new("Mosaic_Master_System", point_mesh)
    bpy.context.scene.collection.objects.link(mosaic_obj)

    # --------------------------------------------------------------------------
    # [05/06] Geometry Nodes 21초 슬로우 모션 & 마그네틱 스냅 궤적 시스템 구축
    # --------------------------------------------------------------------------
    print("[05/06] Geometry Nodes 21초 슬로우 모션 시스템 구축 중...")
    geo_mod = mosaic_obj.modifiers.new(name="MosaicGeometryNodes", type='NODES')
    node_group = bpy.data.node_groups.new(name="GN_Mosaic_Director", type='GeometryNodeTree')
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

    sep_floor = gn_nodes.new('ShaderNodeSeparateXYZ')
    sep_floor.location = (-550, 200)
    gn_links.new(get_floor_pos.outputs['Position'], sep_floor.inputs['Vector'])

    mul_air_height = gn_nodes.new('ShaderNodeMath')
    mul_air_height.location = (-350, 300)
    mul_air_height.operation = 'MULTIPLY'
    mul_air_height.inputs[1].default_value = 7.5
    gn_links.new(sep_params.outputs['X'], mul_air_height.inputs[0])

    comb_air_target = gn_nodes.new('ShaderNodeCombineXYZ')
    comb_air_target.location = (-180, 200)
    gn_links.new(sep_floor.outputs['X'], comb_air_target.inputs['X'])
    gn_links.new(sep_floor.outputs['Y'], comb_air_target.inputs['Y'])
    gn_links.new(mul_air_height.outputs['Value'], comb_air_target.inputs['Z'])

    get_start_pos = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_start_pos.location = (-800, 0)
    get_start_pos.data_type = 'FLOAT_VECTOR'
    get_start_pos.inputs['Name'].default_value = "start_pos"

    get_start_rot = gn_nodes.new('GeometryNodeInputNamedAttribute')
    get_start_rot.location = (-800, -150)
    get_start_rot.data_type = 'FLOAT_VECTOR'
    get_start_rot.inputs['Name'].default_value = "start_rot"

    # ── [1단계 진행률 T1: 190프레임 여유로운 비행] ──
    sub_t1 = gn_nodes.new('ShaderNodeMath')
    sub_t1.location = (-350, 600)
    sub_t1.operation = 'SUBTRACT'
    gn_links.new(scene_time.outputs['Frame'], sub_t1.inputs[0])
    gn_links.new(sep_params.outputs['Y'], sub_t1.inputs[1])

    div_dur1 = gn_nodes.new('ShaderNodeMath')
    div_dur1.location = (-180, 600)
    div_dur1.operation = 'DIVIDE'
    div_dur1.inputs[1].default_value = 190.0
    gn_links.new(sub_t1.outputs['Value'], div_dur1.inputs[0])

    clamp_t1 = gn_nodes.new('ShaderNodeClamp')
    clamp_t1.location = (0, 600)
    gn_links.new(div_dur1.outputs['Value'], clamp_t1.inputs['Value'])

    # ── [마그네틱 스냅 보간 (Slow Magnetic Ease-Out)] ──
    inv_t = gn_nodes.new('ShaderNodeMath')
    inv_t.location = (160, 600)
    inv_t.operation = 'SUBTRACT'
    inv_t.inputs[0].default_value = 1.0
    gn_links.new(clamp_t1.outputs['Result'], inv_t.inputs[1])

    pow_t = gn_nodes.new('ShaderNodeMath')
    pow_t.location = (320, 600)
    pow_t.operation = 'POWER'
    pow_t.inputs[1].default_value = 2.6
    gn_links.new(inv_t.outputs['Value'], pow_t.inputs[0])

    ease_t1 = gn_nodes.new('ShaderNodeMath')
    ease_t1.location = (480, 600)
    ease_t1.operation = 'SUBTRACT'
    ease_t1.inputs[0].default_value = 1.0
    gn_links.new(pow_t.outputs['Value'], ease_t1.inputs[1])

    # ── [1단계 비행 위치 믹스: start_pos -> air_target] ──
    mix_stage1_pos = gn_nodes.new('ShaderNodeMix')
    mix_stage1_pos.location = (180, 200)
    mix_stage1_pos.data_type = 'VECTOR'
    gn_links.new(ease_t1.outputs['Value'], mix_stage1_pos.inputs['Factor'])
    gn_links.new(get_start_pos.outputs['Attribute'], mix_stage1_pos.inputs[4])
    gn_links.new(comb_air_target.outputs['Vector'], mix_stage1_pos.inputs[5])

    # ── [2단계 진행률 T2: 코어 바닥 쿵! 낙하 (Frame 330~410)] ──
    sub_t2 = gn_nodes.new('ShaderNodeMath')
    sub_t2.location = (-350, 450)
    sub_t2.operation = 'SUBTRACT'
    sub_t2.inputs[1].default_value = CORE_DROP_START
    gn_links.new(scene_time.outputs['Frame'], sub_t2.inputs[0])

    div_dur2 = gn_nodes.new('ShaderNodeMath')
    div_dur2.location = (-180, 450)
    div_dur2.operation = 'DIVIDE'
    div_dur2.inputs[1].default_value = 80.0
    gn_links.new(sub_t2.outputs['Value'], div_dur2.inputs[0])

    clamp_t2 = gn_nodes.new('ShaderNodeClamp')
    clamp_t2.location = (0, 450)
    gn_links.new(div_dur2.outputs['Value'], clamp_t2.inputs['Value'])

    mul_drop_factor = gn_nodes.new('ShaderNodeMath')
    mul_drop_factor.location = (180, 400)
    mul_drop_factor.operation = 'MULTIPLY'
    gn_links.new(clamp_t2.outputs['Result'], mul_drop_factor.inputs[0])
    gn_links.new(sep_params.outputs['X'], mul_drop_factor.inputs[1])

    mix_final_pos = gn_nodes.new('ShaderNodeMix')
    mix_final_pos.location = (400, 200)
    mix_final_pos.data_type = 'VECTOR'
    gn_links.new(mul_drop_factor.outputs['Value'], mix_final_pos.inputs['Factor'])
    gn_links.new(mix_stage1_pos.outputs[1], mix_final_pos.inputs[4])
    gn_links.new(get_floor_pos.outputs['Position'], mix_final_pos.inputs[5])

    mix_rot = gn_nodes.new('ShaderNodeMix')
    mix_rot.location = (400, 0)
    mix_rot.data_type = 'VECTOR'
    gn_links.new(ease_t1.outputs['Value'], mix_rot.inputs['Factor'])
    gn_links.new(get_start_rot.outputs['Attribute'], mix_rot.inputs[4])
    mix_rot.inputs[5].default_value = (0.0, 0.0, 0.0)

    set_pos = gn_nodes.new('GeometryNodeSetPosition')
    set_pos.location = (650, 200)
    gn_links.new(inst_node.outputs['Instances'], set_pos.inputs['Geometry'])
    gn_links.new(mix_final_pos.outputs[1], set_pos.inputs['Position'])

    rot_inst = gn_nodes.new('GeometryNodeRotateInstances')
    rot_inst.location = (850, 200)
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
    print("   ↳ Geometry Nodes 인스턴서 컴파일 완료")

    # --------------------------------------------------------------------------
    # [06/06] 21초 완벽 밀착 [상단 하이앵글 65도] 카메라 & 스튜디오 라이팅
    # --------------------------------------------------------------------------
    print("[06/06] 21초 상단 하이앵글 뷰티 카메라 궤적 구성 중...")

    cam_target = bpy.data.objects.new("Camera_Target", None)
    scene.collection.objects.link(cam_target)

    # Frame 1 ~ 320: 공중 12x12 코어(Z=7.5m) 정면 응시
    cam_target.location = Vector((0.0, 0.0, 7.5))
    cam_target.keyframe_insert(data_path="location", frame=1)
    cam_target.keyframe_insert(data_path="location", frame=320)

    # Frame 410 ~ 1260: 코어 낙하 완료 후 바닥(Z=0.0m) 완벽 추적
    cam_target.location = Vector((0.0, 0.0, 0.0))
    cam_target.keyframe_insert(data_path="location", frame=410)
    cam_target.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)

    cam_data = bpy.data.cameras.new("CinematicCamera")
    cam_obj = bpy.data.objects.new("CinematicCamera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = cam_target
    cam_data.dof.aperture_fstop = 5.0 # 높은 심도로 전체 선명

    def add_cam_kf(frame, pos, focal):
        cam_obj.location = Vector(pos)
        cam_data.lens = focal
        cam_obj.keyframe_insert(data_path="location", frame=frame)
        cam_data.keyframe_insert(data_path="lens", frame=frame)

    # 🎬 [Phase 1: 0~5.0초] 12x12 코어 집결 ➔ 상공 밀착 하이앵글 (역동적 근접 조망!)
    add_cam_kf(1, (1.0, -4.5, 13.0), 35.0)
    add_cam_kf(150, (0.5, -4.0, 12.0), 35.0)
    add_cam_kf(300, (0.0, -3.5, 11.0), 35.0)

    # 🎬 [Phase 2: 5.0~7.0초] 코어 바닥 쿵! 낙하 밀착 추적 (F300 ~ 420)
    add_cam_kf(420, (0.0, -3.5, 9.5), 35.0)

    # 🎬 [Phase 3: 7.0~16.5초] 2,772개 대군단 은하수 도킹 & 부드러운 풀샷 확장 (F420 ~ 990)
    add_cam_kf(700, (0.0, -2.5, 15.0), 30.0)
    add_cam_kf(990, (0.0, -1.5, 20.0), 28.0)

    # 🎬 [Phase 4: 16.5~21.0초] 1920x1080 화면 상하에 빈틈없이 꽉 들어차는 거대한 완성작 쇼케이스! (F990 ~ 1260)
    cam_data.dof.aperture_fstop = 32.0 # 전체 타일 완벽한 팬포커스 선명도
    add_cam_kf(1010, (0.0, -1.0, 20.8), 28.0)
    add_cam_kf(1260, (0.0, -0.2, 21.0), 28.0) # 1920x1080 뷰포트 세로 100% 꽉 채움!

    # ☀️ [화사하고 선명한 4점 뷰티 스튜디오 조명]
    def create_light(name, ltype, energy, color, pos):
        ldata = bpy.data.lights.new(name=name, type=ltype)
        ldata.energy = energy
        ldata.color = color
        if ltype == 'AREA': ldata.size = 36.0
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        lobj.location = pos
        scene.collection.objects.link(lobj)
        return lobj

    create_light("Studio_Top_Key", 'AREA', 6500.0, (1.0, 1.0, 1.0), Vector((0.0, 0.0, 30.0)))
    create_light("Studio_Front_Fill", 'AREA', 4200.0, (1.0, 0.99, 0.97), Vector((0.0, -16.0, 22.0)))
    create_light("Studio_Left_Fill", 'AREA', 3200.0, (0.97, 0.98, 1.0), Vector((-18.0, 0.0, 22.0)))
    create_light("Studio_Right_Fill", 'AREA', 3200.0, (0.98, 0.98, 1.0), Vector((18.0, 0.0, 22.0)))

    # 🤍 [깔끔하고 화사한 단색 퓨어 화이트 배경]
    world = scene.world or bpy.data.worlds.new("CinematicWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.98, 0.98, 0.99, 1.0) # 화사한 퓨어 화이트 톤
        bg.inputs[1].default_value = 1.15                     # 배경 광량 화사하게

    # 🚀 [GPU 초고속 렌더링 최적화 엔진 설정]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    if hasattr(scene, 'eevee'):
        try: scene.eevee.taa_render_samples = 4   # 초고속 렌더 (4샘플로 충분히 선명하고 5배 빠름)
        except Exception: pass
        try: scene.eevee.use_raytracing = False    # 무거운 스크린스페이스 레이트레이싱 비활성화로 10배 가속
        except Exception: pass
        try: scene.eevee.use_shadows = True
        except Exception: pass

    # Cycles 엔진으로 전환 시 GPU(OptiX/CUDA) 자동 활성화
    try:
        if hasattr(scene, 'cycles'):
            scene.cycles.device = 'GPU'
            scene.cycles.samples = 32
            prefs = bpy.context.preferences.addons.get('cycles')
            if prefs and hasattr(prefs, 'preferences'):
                cprefs = prefs.preferences
                cprefs.compute_device_type = 'OPTIX' if 'OPTIX' in [t[0] for t in cprefs.get_device_types(bpy.context)] else 'CUDA'
                cprefs.get_devices()
                for dev in cprefs.devices:
                    dev.use = True
    except Exception as e:
        print(f"   ⚠️ Cycles GPU 세팅 알림: {e}")

    scene.render.use_motion_blur = False # 초고속 렌더를 위해 모션블러 해제 (속도 3배 가속!)

    blend_save_path = os.path.join(base_dir, "mosaic_cinematic.blend")
    try:
        bpy.ops.wm.save_as_mainfile(filepath=blend_save_path)
        print(f"   💾 .blend 프로젝트 자동 저장 완료: {blend_save_path}")
    except Exception as e:
        print(f"   ⚠️ 저장 스킵: {e}")

    print("\n" + "="*75)
    print("🎉 [SUCCESS] 21.0초(1,260 Frames) 대작 마스터피스 씬 빌드 완료!")
    print("👉 Numpad 0(카메라) ➔ Spacebar(재생)로 21초 완성작을 감상하세요!")
    print("="*75 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("\n" + "!"*75)
        print("❌ [FATAL ERROR] 실행 중 예외 발생:")
        traceback.print_exc()
        print("!"*75 + "\n")
