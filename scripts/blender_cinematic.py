# Forwarder to blender_workspace/generate_mosaic_scene.py
import os

workspace_script = r"c:\Users\Buvi\Desktop\project\mosaic_ver2\blender_workspace\generate_mosaic_scene.py"
if os.path.exists(workspace_script):
    with open(workspace_script, 'r', encoding='utf-8') as f:
        code = f.read()
    exec(compile(code, workspace_script, 'exec'))
else:
    print(f"❌ '{workspace_script}' 파일을 찾을 수 없습니다.")
