# Independent re-import check: blender -b --python scripts/verify-formats-blender.py -- FILE.glb FILE.obj FILE.fbx FILE.usdz
# Prints one JSON line per file with world-space bounds (Blender is Z-up; importers convert from +Y up).
import bpy, sys, json, mathutils
def bounds():
    lo=[1e9]*3; hi=[-1e9]*3; tris=0
    for o in bpy.context.scene.objects:
        if o.type!='MESH': continue
        for v in o.data.vertices:
            w=o.matrix_world@v.co
            for i in range(3): lo[i]=min(lo[i],w[i]); hi[i]=max(hi[i],w[i])
        o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
    return lo,hi,tris
for path in sys.argv[sys.argv.index('--')+1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.endswith('.glb'): bpy.ops.import_scene.gltf(filepath=path)
    elif path.endswith('.obj'): bpy.ops.wm.obj_import(filepath=path)
    elif path.endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=path)
    elif path.endswith('.usdz'): bpy.ops.wm.usd_import(filepath=path)
    lo,hi,tris=bounds()
    print('POLYSPOON_RESULT '+json.dumps({'file':path.rsplit('/',1)[-1],'min':[round(x,4) for x in lo],'max':[round(x,4) for x in hi],'triangles':tris}))
