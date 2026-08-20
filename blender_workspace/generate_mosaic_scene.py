"""
================================================================================
🎬 18-SECOND HERO-CHASE & EXPONENTIAL 360° MOSAIC GENERATOR for Blender 5.2 LTS
================================================================================
[18.0초 (1,080 Frames @ 60fps) 사용자 맞춤형 파이프라인]
 1. 🌟 Hero Tile 추적 오프닝 (Hero Chase Close-Up):
    - Frame 1 시작 시 공중에서 날아오는 '첫 번째 대표 조각(Hero Tile)' 바로 옆(거리 1.2m)에 초밀착
    - 개별 사진 속 얼굴과 디테일이 화면 1920x1080에 거대하게 꽉 찬 상태로 중앙으로 비행 ➔ 바닥에 착지!
 2. ⚡ 점진적 가속 조립 (Exponential Center-Out Acceleration):
    - 시작(0~5초)은 느리고 여유롭게 1장, 3장, 10장이 내 주위에서 날아와 중앙부터 착착 결합
    - 뒤로 갈수록 경쾌하게 가속이 붙으며 2,916개 전체 모자이크가 물결치듯 웅장하게 도킹
 3. 🎥 360° 선회 & 풀백 ➔ 1920x1080 꽉 찬 완성 샷 (총 18.0초):
    - 가속 조립에 맞춰 총 길이를 18.0초(1,080 프레임)로 슬림화
    - 피날레 3.0초(F900~1080) 동안 최상공 수직 탑뷰에서 1920x1080 화면을 100% 꽉 채운 완성작 감상!
 4. 💎 초선명 True-Color 사진 자체 발광 (Emission 0.45) & 다크 스튜디오 배경
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
# ⚙️ 18초 시네마틱 마스터 타임라인 파라미터 (60fps 기준)
# ==============================================================================
TOTAL_FRAMES = 1080         # 총 18.0초 (1,080 Frames @ 60fps)
FPS = 60
RESOLUTION_X = 1920
RESOLUTION_Y = 1080

# 점진적 가속 타임라인
FLY_START_FRAME = 1         # Frame 1: Hero Tile 공중 추적 발사
ALL_DOCKED_FRAME = 880      # Frame 880 (14.6초): 가속 도킹 완료
FLASH_PEAK_FRAME = 905      # Frame 905 (15.1초): 피날레 샴페인 골드 글로우 피크
FINALE_END_FRAME = 1080     # Frame 1080 (18.0초): 1920x1080 완성작 쇼케이스 완료

def main():
    print("\n" + "="*75)
    print("🎬 [18s HERO-CHASE & EXPONENTIAL 360° MOSAIC] 씬 빌드 시작 (1,080 Frames)")
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

    # 🎬 비디오 자동 렌더링 세팅 (바탕화면 MP4)
    desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")
    scene.render.filepath = os.path.join(desktop_dir, "mosaic_cinematic_18s.mp4")

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
    scene_name = metadata.get("sceneName", "mosaic_latest")
    tiles = mosaic_data["tiles"]
    cols = metadata["cols"]
    rows = metadata["rows"]
    num_tiles = len(tiles)

    # 🎬 비디오 자동 렌더링 파일명에 고유 씬 이름 적용
    desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")
    scene.render.filepath = os.path.join(desktop_dir, f"cinematic_{scene_name}.mp4")

    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    master_candidates = [
        os.path.join(base_dir, "master_mosaic.jpg"),
        os.path.join(base_dir, "scenes", scene_name, "master_mosaic.jpg"),
        os.path.join(project_root, "public", "outputs", f"{scene_name}.jpg"),
        r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\master_mosaic.jpg"
    ]

    master_img_path = None
    for p in master_candidates:
        if os.path.exists(p):
            master_img_path = os.path.abspath(p)
            break

    if not master_img_path:
        raise FileNotFoundError("❌ 'master_mosaic.jpg'를 찾을 수 없습니다.")

    print(f"   🎬 씬 이름: [{scene_name}]")
    print(f"   ↳ 데이터 로드 완료: {num_tiles:,}개 타일 ({cols}x{rows})")
    print(f"   🖼 마스터 텍스처: {master_img_path}")

    # --------------------------------------------------------------------------
    # [03/06] 초선명(True-Color Self-Illuminated) UV 인스턴스 셰이더 머티리얼 구성
    # --------------------------------------------------------------------------
    print("[03/06] 초선명 True-Color 자체 발광 셰이더 머티리얼 구성 중...")
    mat = bpy.data.materials.new(name="Mat_GeoNodes_Mosaic_18s")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new('ShaderNodeOutputMaterial')
    out_node.location = (800, 0)

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (500, 0)
    links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])

    if "Roughness" in bsdf.inputs: bsdf.inputs["Roughness"].default_value = 0.25
    if "Metallic" in bsdf.inputs: bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs: bsdf.inputs["Specular IOR Level"].default_value = 0.3

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

    # ✨ [사진 자체 발광(Emission: 0.45)으로 어두운 곳 없이 항상 쨍하고 선명한 화질]
    if "Emission Color" in bsdf.inputs:
        links.new(tex_node.outputs['Color'], bsdf.inputs['Emission Color'])
    elif "Emission" in bsdf.inputs:
        links.new(tex_node.outputs['Color'], bsdf.inputs['Emission'])

    if "Emission Strength" in bsdf.inputs:
        em = bsdf.inputs["Emission Strength"]
        em.default_value = 0.45
        em.keyframe_insert(data_path="default_value", frame=1)
        em.keyframe_insert(data_path="default_value", frame=FLASH_PEAK_FRAME - 30)
        em.default_value = 1.15
        em.keyframe_insert(data_path="default_value", frame=FLASH_PEAK_FRAME)
        em.default_value = 0.45
        em.keyframe_insert(data_path="default_value", frame=FLASH_PEAK_FRAME + 40)

    # --------------------------------------------------------------------------
    # [04/06] Hero Tile 지정 & 점진적 가속 궤적 속성 베이킹
    # --------------------------------------------------------------------------
    print("[04/06] Hero Tile 지정 및 점진적 가속 3D 궤적 속성 베이킹 중...")

    # 종횡비에 따른 타일 크기 계산 (개별 타일은 정사각형 유지)
    total_w = 20.0
    total_h = 20.0 * (rows / cols)
    tile_unit = (total_w / cols) * 0.990
    tile_w = tile_unit
    tile_h = tile_unit
    hw, hh, hd = tile_w / 2.0, tile_h / 2.0, 0.035

    tile_mesh = bpy.data.meshes.new("SingleTileMesh_18s")
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

    tile_template_obj = bpy.data.objects.new("TileTemplate_18s", tile_mesh)
    bpy.context.scene.collection.objects.link(tile_template_obj)
    tile_template_obj.hide_viewport = True
    tile_template_obj.hide_render = True

    point_mesh = bpy.data.meshes.new("MosaicPointsMesh_18s")
    point_coords = [(t['gridX'], t['gridY'], 0.0) for t in tiles]
    point_mesh.from_pydata(point_coords, [], [])
    point_mesh.update()

    attr_start_pos = point_mesh.attributes.new(name="start_pos", type='FLOAT_VECTOR', domain='POINT')
    attr_start_rot = point_mesh.attributes.new(name="start_rot", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_min = point_mesh.attributes.new(name="uv_min", type='FLOAT_VECTOR', domain='POINT')
    attr_uv_span = point_mesh.attributes.new(name="uv_span", type='FLOAT_VECTOR', domain='POINT')
    attr_params = point_mesh.attributes.new(name="anim_params", type='FLOAT_VECTOR', domain='POINT')

    max_dist = math.sqrt(10.0**2 + 10.0**2)

    # 🌟 [오프닝 추적용 Hero Tile 선정]: 중앙 코어 바로 옆 타일 (0, 0 근처)
    hero_index = 0
    min_center_d = 999.0
    for idx, t in enumerate(tiles):
        d = math.hypot(t['gridX'], t['gridY'])
        if d < min_center_d:
            min_center_d = d
            hero_index = idx

    hero_start_pos = (2.2, -3.5, 4.8) # 카메라가 초밀착해서 따라붙을 출발 위치

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
        norm_dist = dist_center / max_dist  # 0.0 (중앙) ~ 1.0 (최외곽)

        if i == hero_index:
            # 🌟 Hero Tile: 카메라가 바로 옆에서 따라붙으며 중앙으로 멋지게 비행
            sp_x, sp_y, sp_z = hero_start_pos
            launch_f = 1.0
            flight_duration = 140.0 # 2.3초 동안 중앙으로 비행
        else:
            # 사방 3D 공간에서 쏟아져 들어오는 조각들
            phi = random.uniform(-math.pi * 0.38, math.pi * 0.38)
            theta = math.atan2(gy, gx) + random.uniform(-0.8, 0.8)
            rad = random.uniform(18.0, 34.0) + norm_dist * 8.0
            sp_x = math.cos(phi) * math.cos(theta) * rad
            sp_y = math.cos(phi) * math.sin(theta) * rad
            sp_z = math.sin(phi) * rad + random.uniform(5.0, 15.0)

            # 🚀 [점진적 가속 곡선 (Exponential Flow)]:
            # 시작(중앙)은 1장, 3장, 10장이 여유롭게 도킹 ➔ 외곽으로 갈수록 빠르게 연속 결합
            accel_curve = (norm_dist ** 0.72) # 지수 가속 곡선
            launch_f = 12.0 + accel_curve * 680.0 + random.uniform(-12, 12)
            launch_f = max(1.0, min(launch_f, ALL_DOCKED_FRAME - 140))
            flight_duration = 160.0 - norm_dist * 40.0 # 외곽으로 갈수록 도킹 속도도 경쾌하게 가속!

        attr_start_pos.data[i].vector = (sp_x, sp_y, sp_z)

        # anim_params: (flight_duration, launch_frame, dist_center)
        attr_params.data[i].vector = (flight_duration, launch_f, dist_center)

        # 3D 덤블링 회전각
        attr_start_rot.data[i].vector = (
            random.uniform(-math.pi * 5, math.pi * 5),
            random.uniform(-math.pi * 5, math.pi * 5),
            random.uniform(-math.pi * 5, math.pi * 5)
        )

    mosaic_obj = bpy.data.objects.new("Mosaic_Master_System_18s", point_mesh)
    bpy.context.scene.collection.objects.link(mosaic_obj)

    # --------------------------------------------------------------------------
    # [05/06] Geometry Nodes 가속 마그네틱 결합 & 스무스 어셈블리 시스템
    # --------------------------------------------------------------------------
    print("[05/06] Geometry Nodes 가속 결합 시스템 구축 중...")
    geo_mod = mosaic_obj.modifiers.new(name="MosaicGeometryNodes", type='NODES')
    node_group = bpy.data.node_groups.new(name="GN_Mosaic_18sDirector", type='GeometryNodeTree')
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

    # ── [진행률 T: 타일별 flight_duration 적용] ──
    sub_t = gn_nodes.new('ShaderNodeMath')
    sub_t.location = (-350, 600)
    sub_t.operation = 'SUBTRACT'
    gn_links.new(scene_time.outputs['Frame'], sub_t.inputs[0])
    gn_links.new(sep_params.outputs['Y'], sub_t.inputs[1]) # launch_frame

    div_dur = gn_nodes.new('ShaderNodeMath')
    div_dur.location = (-180, 600)
    div_dur.operation = 'DIVIDE'
    gn_links.new(sub_t.outputs['Value'], div_dur.inputs[0])
    gn_links.new(sep_params.outputs['X'], div_dur.inputs[1]) # flight_duration

    clamp_t = gn_nodes.new('ShaderNodeClamp')
    clamp_t.location = (0, 600)
    gn_links.new(div_dur.outputs['Value'], clamp_t.inputs['Value'])

    # 마그네틱 스냅 감속 (Ease-Out)
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
    print("   ↳ Geometry Nodes 인스턴서 컴파일 완료")

    # --------------------------------------------------------------------------
    # [06/06] Hero 추적 오프닝 ➔ 360° 가속 선회 ➔ 18초 완성 풀샷 카메라
    # --------------------------------------------------------------------------
    print("[06/06] 18초 Hero 추적 & 가속 선회 풀프레임 카메라 궤적 구성 중...")

    cam_target = bpy.data.objects.new("Camera_Target_18s", None)
    scene.collection.objects.link(cam_target)

    # 🌟 카메라 타겟: 초반에는 공중에서 날아오는 Hero Tile(Z=3.0)을 응시 ➔ 점진적으로 중앙(0,0,0) 정렬
    cam_target.location = Vector((1.0, -1.5, 2.5))
    cam_target.keyframe_insert(data_path="location", frame=1)
    cam_target.location = Vector((0.0, 0.0, 0.0))
    cam_target.keyframe_insert(data_path="location", frame=140)
    cam_target.keyframe_insert(data_path="location", frame=TOTAL_FRAMES)

    cam_data = bpy.data.cameras.new("CinematicCamera_18s")
    cam_obj = bpy.data.objects.new("CinematicCamera_18s", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = cam_target
    cam_data.dof.aperture_fstop = 4.8

    def add_cam_kf(frame, pos, focal):
        cam_obj.location = Vector(pos)
        cam_data.lens = focal
        cam_obj.keyframe_insert(data_path="location", frame=frame)
        cam_data.keyframe_insert(data_path="lens", frame=frame)

    # 화면 1920x1080(16:9) 세로/가로 꽉 채우기 위한 동적 피날레 높이 계산 (f=28mm)
    fit_h_z = (total_h / 2.0) * (28.0 / 12.0) * 1.02
    fit_w_z = (total_w / 2.0) * (28.0 / 18.0) * 1.02
    final_cam_z = max(fit_h_z, fit_w_z, 16.0)

    # 🎬 [18초 맞춤형 카메라 궤적]
    camera_keyframes_18s = [
        # Frame, Radius, Height(Z), Angle(deg), Focal
        (1,     1.6,   3.2,   -35.0,  45.0), # 시작: Hero Tile 바로 옆 초근접 (사진 1장이 화면 가득!)
        (140,   3.2,   1.8,    10.0,  35.0), # 2.3초: Hero Tile 중앙 착지 밀착
        (300,   5.5,   3.8,    60.0,  35.0), # 5.0초: 1장, 3장, 10장 천천히 뭉침
        (550,   9.5,   7.0,   140.0,  32.0), # 9.1초: 가속이 붙으며 중간 영역 완성
        (750,  14.5,  12.0,   260.0,  28.0), # 12.5초: 외곽까지 웅장하게 가속 완성
        (880,   4.0,  final_cam_z * 0.88, 340.0, 28.0), # 14.6초: 전체 도킹 완료 ➔ 상공 직하강
        (950,   0.2,  final_cam_z * 0.99, 360.0, 28.0), # 15.8초: 360° 완주 후 수직 탑뷰 안착
        (1080,  0.0,  final_cam_z,        360.0, 28.0), # 18.0초: 1920x1080 화면 100% 꽉 찬 피날레 쇼케이스!
    ]

    for f, rad, h, deg, focal in camera_keyframes_18s:
        rad_angle = math.radians(deg)
        x = math.sin(rad_angle) * rad
        y = -math.cos(rad_angle) * rad
        add_cam_kf(f, (x, y, h), focal)

    # 피날레 전체 팬포커스 (f/32.0)
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=1)
    cam_data.dof.aperture_fstop = 32.0
    cam_data.keyframe_insert(data_path="dof.aperture_fstop", frame=880)

    # ☀️ [360° 무사각 스튜디오 조명 리그 + 카메라 동행 조명]
    def create_light(name, ltype, energy, color, pos, parent=None):
        ldata = bpy.data.lights.new(name=name, type=ltype)
        ldata.energy = energy
        ldata.color = color
        if ltype == 'AREA': ldata.size = 38.0
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        lobj.location = pos
        scene.collection.objects.link(lobj)
        if parent:
            lobj.parent = parent
        return lobj

    create_light("Studio_Top_MegaKey", 'AREA', 8500.0, (1.0, 1.0, 1.0), Vector((0.0, 0.0, 32.0)))
    create_light("Studio_Front_Fill", 'AREA', 4500.0, (1.0, 0.99, 0.98), Vector((0.0, -18.0, 18.0)))
    create_light("Studio_Back_Fill", 'AREA', 4500.0, (0.98, 0.99, 1.0), Vector((0.0, 18.0, 18.0)))
    create_light("Studio_Left_Fill", 'AREA', 4200.0, (0.99, 0.98, 1.0), Vector((-18.0, 0.0, 18.0)))
    create_light("Studio_Right_Fill", 'AREA', 4200.0, (0.98, 0.99, 1.0), Vector((18.0, 0.0, 18.0)))

    # 카메라 동행 조명: 카메라 초근접 시 화사함 극대화
    create_light("Cam_Follow_BeautyLight", 'POINT', 2500.0, (1.0, 0.99, 0.98), Vector((0.0, 0.0, 0.5)), parent=cam_obj)

    # 🖤 [프리미엄 차콜 스튜디오 월드 배경]
    world = scene.world or bpy.data.worlds.new("CinematicWorld_18s")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.045, 0.048, 0.055, 1.0)
        bg.inputs[1].default_value = 1.0

    # 🚀 [하드웨어 자동 감지: GPU 가속 & CPU 스마트 폴백]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    if hasattr(scene, 'eevee'):
        try: scene.eevee.taa_render_samples = 4
        except Exception: pass
        try: scene.eevee.use_raytracing = False
        except Exception: pass
        try: scene.eevee.use_shadows = True
        except Exception: pass

    # GPU(OptiX, CUDA, Metal, HIP, OneAPI) 자동 스캔 및 CPU 폴백
    gpu_found = False
    detected_devices = []
    try:
        prefs = bpy.context.preferences.addons.get('cycles')
        if prefs and hasattr(prefs, 'preferences'):
            cprefs = prefs.preferences
            device_types = [t[0] for t in cprefs.get_device_types(bpy.context)]
            
            # 우선순위: OPTIX > CUDA > METAL > HIP > ONEAPI
            selected_type = None
            for dev_type in ['OPTIX', 'CUDA', 'METAL', 'HIP', 'ONEAPI']:
                if dev_type in device_types:
                    selected_type = dev_type
                    break
            
            if selected_type:
                cprefs.compute_device_type = selected_type
                cprefs.get_devices()
                for dev in cprefs.devices:
                    if dev.type == selected_type:
                        dev.use = True
                        gpu_found = True
                        detected_devices.append(f"{dev.name} ({selected_type})")
                    else:
                        dev.use = False
            
            if gpu_found:
                if hasattr(scene, 'cycles'):
                    scene.cycles.device = 'GPU'
                    scene.cycles.samples = 32
                print(f"   🟢 [GPU 가속 활성화] {', '.join(detected_devices)}")
            else:
                if hasattr(scene, 'cycles'):
                    scene.cycles.device = 'CPU'
                    scene.cycles.samples = 16
                print("   🟡 [하드웨어 감지] 외장 GPU 미감지 -> CPU 멀티스레드 모드로 안전하게 자동 폴백")
    except Exception as e:
        print(f"   ⚠️ 하드웨어 감지 안내: {e}")

    scene.render.use_motion_blur = False

    blend_save_path = os.path.join(base_dir, "mosaic_cinematic.blend")
    scene_blend_path = os.path.join(base_dir, "scenes", scene_name, f"{scene_name}.blend")
    try:
        bpy.ops.wm.save_as_mainfile(filepath=blend_save_path)
        print(f"   💾 .blend 프로젝트 자동 저장 완료: {blend_save_path}")
        if os.path.exists(os.path.dirname(scene_blend_path)):
            bpy.ops.wm.save_as_mainfile(filepath=scene_blend_path)
            print(f"   📁 전용 씬 백업 저장 완료: {scene_blend_path}")
    except Exception as e:
        print(f"   ⚠️ 저장 스킵: {e}")

    print("\n" + "="*75)
    print("🎉 [SUCCESS] 18초 Hero 추적 & 가속 360° 마스터피스 씬 빌드 완료!")
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
