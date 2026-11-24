"""Render the saved 90-second Blender scene; safely resume numbered PNGs.

blender -b --python ottisk/tools/render_opening90.py -- --start 1 --end 2160
Optional: --preview 42 --percentage 65 --samples 32.
"""
from pathlib import Path
import argparse
from collections import defaultdict
import sys
import bpy

args=argparse.ArgumentParser()
args.add_argument('--start',type=int,default=1)
args.add_argument('--end',type=int,default=2160)
args.add_argument('--preview',type=float)
args.add_argument('--percentage',type=int,default=100)
args.add_argument('--samples',type=int,default=16)
args.add_argument('--overwrite',action='store_true')
args.add_argument('--frames',help='Comma-separated frame numbers to recalculate.')
opt=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
root=Path(__file__).resolve().parent.parent
build=root/'.work'/'opening90'
bpy.ops.wm.open_mainfile(filepath=str(root/'exports'/'opening-90s.blend'))
s=bpy.context.scene
if 'Coalescing ink surface' in bpy.data.metaballs:
    bpy.data.metaballs['Coalescing ink surface'].render_resolution=.003
# Bake the bevel/normal modifiers and batch stationary parts per moving assembly
# and material. The saved, editable .blend is never changed by this optimization.
groups=defaultdict(list)
for o in list(s.objects):
    if o.type!='MESH' or o.animation_data or o.data.shape_keys or o.hide_render:continue
    if len(o.data.materials)!=1:continue
    groups[(o.parent,o.data.materials[0])].append(o)
groups=[g for g in groups.values() if len(g)>1]
bpy.ops.object.select_all(action='DESELECT')
for group in groups:
    for o in group:o.select_set(True)
if groups:
    bpy.context.view_layer.objects.active=groups[0][0]
    bpy.ops.object.convert(target='MESH')
    for group in groups:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        bpy.ops.object.join()
        bpy.context.object.name+=' [render batch]'
print(f'Render batches ready: {len(s.objects)} objects; editable source preserved.',flush=True)
p=bpy.context.preferences.addons['cycles'].preferences
p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.cycles.samples=opt.samples
s.cycles.max_bounces=4;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2
s.cycles.caustics_reflective=False;s.cycles.caustics_refractive=False
s.render.resolution_percentage=opt.percentage
s.render.use_persistent_data=True
if opt.frames:
    for frame in sorted(set(int(v) for v in opt.frames.split(','))):
        s.frame_set(frame)
        s.render.filepath=str(build/'frames'/f'frame_{frame:04d}.png')
        bpy.ops.render.render(write_still=True)
elif opt.preview is not None:
    s.frame_set(round(opt.preview*24)+1)
    s.render.filepath=str(build/f'check-{opt.preview:04.1f}.png')
    bpy.ops.render.render(write_still=True)
else:
    s.frame_start=opt.start;s.frame_end=opt.end
    folder=build/'frames'
    folder.mkdir(exist_ok=True)
    s.render.filepath=str(folder/'frame_')
    s.render.use_overwrite=opt.overwrite;s.render.use_placeholder=True
    bpy.ops.render.render(animation=True)
