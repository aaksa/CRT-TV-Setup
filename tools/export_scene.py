"""Export the evidence-room Blender scene to a web-ready GLB.

Run headless on a COPY of the working .blend (never the original):
  Blender -b scene_copy.blend --python tools/export_scene.py -- public/models/room.glb

What it does
  * keeps only the props that appear in the composition, with readable names
  * bakes the rigged TV remote to static geometry and splits every button
    into its own object (RBTN_<LABEL>) so the site can raycast / press them
  * decimates the 2M-triangle AI-generated corkboard
  * downsizes oversized textures, then writes a Draco-compressed GLB (WebP)
"""
import sys
import bpy
import bmesh
from mathutils import Matrix, Vector

OUT = sys.argv[sys.argv.index("--") + 1]

PROPS = {
    "vedro_low.003": "TV_Screen",
    "vedro_low.008": "TV_Body",
    "vedro_low.017": "VCR",
    "vedro_low.005": "Crate_TV",
    "vedro_low.006": "Crate_Radio",
    "vedro_low.010": "Radio",
    "vedro_low.011": "Knife",
    "vedro_low.012": "Bucket",
    "vedro_low.015": "Crate_Paper",
    "vedro_low.016": "Hammer",
    "wooden corkboard 3d model": "EvidenceBoard",
}
REMOTE = {"Cube.002", "Armature.002", "TV_Remote_Root"}

# Armature bone -> printed button label (worked out from the bone layout
# against the texture atlas; +Y in armature space is the power end).
BUTTONS = {
    "Bone.024": "POWER", "Bone.025": "INPUT",
    "Bone.023": "MODE", "Bone.022": "CC", "Bone.021": "SLEEP", "Bone.020": "FUNC",
    "Bone.017": "1", "Bone.018": "2", "Bone.019": "3",
    "Bone.016": "4", "Bone.013": "5", "Bone.012": "6",
    "Bone.015": "7", "Bone.014": "8", "Bone.011": "9",
    "Bone.009": "PREV", "Bone.008": "0", "Bone.010": "DOT",
    "Bone.005": "VOL", "Bone.004": "CH", "Bone.007": "SAP", "Bone.006": "MUTE",
    "Bone.001": "BACK", "Bone.002": "MENU", "Bone.003": "INFO",
    "Bone.030": "UP", "Bone.029": "LEFT", "Bone.026": "OK",
    "Bone.027": "RIGHT", "Bone.028": "DOWN",
}

scene = bpy.context.scene
scene.frame_set(1)

# ---------------------------------------------------------------- cleanup
for ob in list(bpy.data.objects):
    if ob.name not in PROPS and ob.name not in REMOTE:
        bpy.data.objects.remove(ob, do_unlink=True)

# ---------------------------------------------------------------- remote
rm = bpy.data.objects["Cube.002"]
arm = bpy.data.objects["Armature.002"]
root = bpy.data.objects["TV_Remote_Root"]

dg = bpy.context.evaluated_depsgraph_get()
baked = bpy.data.meshes.new_from_object(
    rm.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
mw = rm.matrix_world.copy()
group_names = {g.index: g.name for g in rm.vertex_groups}

# keep only the UV set the atlas was painted on
for name in ("UVMap", "Diffuse"):
    if name in baked.uv_layers:
        baked.uv_layers.remove(baked.uv_layers[name])
baked.uv_layers["Overall"].name = "UVMap"

# web-friendly remote material: diffuse / roughness / normal only
D = "/Users/aaksanurirwan/Ngonten/Website/CRT/simple-tv-remote/source/Simple TV Remote/"


def load(fn, noncolor, size):
    im = bpy.data.images.load(D + fn, check_existing=False)
    im.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    if max(im.size) > size:
        im.scale(size, size)
    return im


mat = bpy.data.materials.new("Remote")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
t_d = nt.nodes.new("ShaderNodeTexImage"); t_d.image = load("Diffuse.jpg", False, 2048)
t_r = nt.nodes.new("ShaderNodeTexImage"); t_r.image = load("Roughness.jpg", True, 1024)
t_n = nt.nodes.new("ShaderNodeTexImage"); t_n.image = load("NormalMap.jpg", True, 2048)
nm = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(t_d.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(t_r.outputs["Color"], bsdf.inputs["Roughness"])
nt.links.new(t_n.outputs["Color"], nm.inputs["Color"])
nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
bsdf.inputs["Metallic"].default_value = 0.0

bm_src = bmesh.new()
bm_src.from_mesh(baked)
dl = bm_src.verts.layers.deform.active


def dominant(v):
    d = v[dl]
    return max(d.items(), key=lambda kv: kv[1])[0] if d else -1


vdom = [dominant(v) for v in bm_src.verts]
face_group = []
for f in bm_src.faces:
    gs = [vdom[v.index] for v in f.verts]
    face_group.append(max(set(gs), key=gs.count))
bm_src.free()

remote_root = bpy.data.objects.new("Remote", None)
scene.collection.objects.link(remote_root)
remote_root.matrix_world = mw

for gid in sorted(set(face_group)):
    bone = group_names.get(gid, "Bone")
    label = BUTTONS.get(bone)
    name = f"RBTN_{label}" if label else "Remote_Body"
    bm = bmesh.new()
    bm.from_mesh(baked)
    bm.faces.ensure_lookup_table()
    kill = [f for f, g in zip(bm.faces, face_group) if g != gid]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    if bm.verts.layers.deform.active:
        bm.verts.layers.deform.remove(bm.verts.layers.deform.active)
    centre = Vector()
    if label:
        centre = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        for v in bm.verts:
            v.co -= centre
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = remote_root
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.matrix_basis = Matrix.Translation(centre)
    print("remote part", name, len(me.polygons))

for ob in (rm, arm, root):
    bpy.data.objects.remove(ob, do_unlink=True)

# ---------------------------------------------------------------- props
for old, new in PROPS.items():
    ob = bpy.data.objects[old]
    ob.name = new

board = bpy.data.objects["EvidenceBoard"]
dec = board.modifiers.new("web_decimate", "DECIMATE")
dec.ratio = 0.04
dec.use_collapse_triangulate = True

# shrink any texture larger than 2K
for im in bpy.data.images:
    if im.users and im.size[0] > 2048:
        im.scale(2048, 2048)

# ---------------------------------------------------------------- export
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_animations=False,
    export_skins=False,
    export_lights=False,
    export_cameras=False,
    export_extras=False,
    export_image_format="WEBP",
    export_image_quality=86,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,
    export_draco_texcoord_quantization=14,
)
print("EXPORTED", OUT)
