"""Model and animate the printer opening in Blender. No external visual assets."""
from pathlib import Path
import math
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
BUILD=ROOT/".work"
BUILD.mkdir(exist_ok=True)
FPS=24
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):bpy.data.materials.remove(material)
scene=bpy.context.scene
scene.render.engine="CYCLES"
prefs=bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type="OPTIX";prefs.get_devices()
for device in prefs.devices:device.use=device.type=="OPTIX"
scene.cycles.device="GPU"
scene.cycles.samples=24
scene.cycles.adaptive_threshold=.10
scene.cycles.use_denoising=True
scene.cycles.denoiser="OPTIX"
scene.cycles.max_bounces=5
scene.cycles.diffuse_bounces=3
scene.cycles.glossy_bounces=3
scene.render.use_persistent_data=True
scene.render.resolution_x=1920
scene.render.resolution_y=1080
scene.render.resolution_percentage=75
scene.render.fps=FPS
scene.frame_start=1
scene.frame_end=FPS*60
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGB"
scene.render.image_settings.compression=15
scene.render.use_motion_blur=True
scene.render.motion_blur_shutter=.35
scene.world.color=(.045,.055,.07)
scene.view_settings.view_transform="AgX"
scene.view_settings.look="AgX - Medium High Contrast"
scene.view_settings.exposure=.4


def material(name,color,roughness=.4,metallic=0,grain=False):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    bsdf=nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*color,1)
    bsdf.inputs["Roughness"].default_value=roughness
    bsdf.inputs["Metallic"].default_value=metallic
    if grain:
        noise=nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value=180
        noise.inputs["Detail"].default_value=2
        bump=nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value=.13
        bump.inputs["Distance"].default_value=.012
        mat.node_tree.links.new(noise.outputs["Fac"],bump.inputs["Height"])
        mat.node_tree.links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
    return mat


plastic=material("Graphite plastic",(.075,.092,.080),.34,grain=True)
trim=material("Soft sage enclosure",(.20,.235,.195),.39,grain=True)
seam=material("Deep recess",(.010,.016,.013),.62)
rubber=material("Rubber rollers",(.025,.032,.028),.75,grain=True)
chrome=material("Brushed steel",(.42,.46,.43),.23,.85)
bronze=material("Inkjet nozzle brass",(.34,.23,.09),.26,.72)
paper_plain=material("Unprinted sheet",(.86,.85,.77),.88,grain=True)
skin=material("Warm skin",(.48,.29,.19),.48)
skin.node_tree.nodes.get("Principled BSDF").inputs["Subsurface Weight"].default_value=.12
nail=material("Fingernails",(.56,.38,.27),.30)
sleeve=material("Knitted sleeve",(.040,.065,.058),.82,grain=True)
liquid=material("Liquid black ink",(.002,.005,.003),.16)
liquid.node_tree.nodes.get("Principled BSDF").inputs["Coat Weight"].default_value=.22


def attach(obj,mat,parent=None):
    obj.data.materials.append(mat)
    if parent:obj.parent=parent
    return obj


def cube(name,loc,size,mat,bevel=.04,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    attach(obj,mat,parent)
    if bevel:
        mod=obj.modifiers.new("Rounded manufactured edges","BEVEL")
        mod.width=bevel;mod.segments=4
        obj.modifiers.new("Weighted corner normals","WEIGHTED_NORMAL")
    return obj


def sphere(name,loc,size,mat,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc)
    obj=bpy.context.object
    obj.name=name;obj.scale=size
    for face in obj.data.polygons:face.use_smooth=True
    attach(obj,mat,parent)
    return obj


def cylinder(name,a,b,r,mat,parent=None,vertices=40):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object;obj.name=name
    obj.rotation_euler=(b-a).to_track_quat("Z","Y").to_euler()
    for face in obj.data.polygons:face.use_smooth=True
    attach(obj,mat,parent)
    mod=obj.modifiers.new("Edge glint","BEVEL");mod.width=min(.016,r*.15);mod.segments=3
    obj.modifiers.new("Weighted cylinder normals","WEIGHTED_NORMAL")
    return obj


def key(obj,prop,t,value):
    setattr(obj,prop,value)
    obj.keyframe_insert(data_path=prop,frame=round(t*FPS)+1)


def empty(name):
    obj=bpy.data.objects.new(name,None)
    scene.collection.objects.link(obj)
    return obj


def area(name,loc,target,power,color,size,shape="DISK",size_y=None):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=power;data.color=color;data.shape=shape;data.size=size
    if size_y is not None:data.size_y=size_y
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    return obj


# The set.
wood=material("Fine walnut veneer",(.25,.15,.075),.46)
nodes=wood.node_tree.nodes;links=wood.node_tree.links
tex=nodes.new("ShaderNodeTexNoise");tex.inputs["Scale"].default_value=3;tex.inputs["Detail"].default_value=3
coord=nodes.new("ShaderNodeTexCoord")
mapping=nodes.new("ShaderNodeVectorMath");mapping.operation="MULTIPLY";mapping.inputs[1].default_value=(2,70,6)
links.new(coord.outputs["Generated"],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs["Vector"])
ramp=nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color=(.08,.045,.022,1);ramp.color_ramp.elements[1].color=(.30,.19,.10,1)
links.new(tex.outputs["Fac"],ramp.inputs[0]);links.new(ramp.outputs[0],nodes.get("Principled BSDF").inputs["Base Color"])
cube("Desk",(0,0,-.14),(14,9,.28),wood,.09)
wall=material("Muted studio wall",(.105,.14,.13),.92)
cube("Back wall",(0,4.15,3.5),(20,.20,8),wall,.01)

# The shell is modeled around an actual open front paper path.
cube("Lower body",(0,0,.24),(5.25,3.0,.40),trim,.15)
cube("Left enclosure",(-2.49,0,1.07),(.30,3.0,1.55),trim,.12)
cube("Right enclosure",(2.49,0,1.07),(.30,3.0,1.55),trim,.12)
cube("Back enclosure",(0,1.39,1.05),(4.9,.23,1.50),plastic,.08)
cube("Upper front fascia",(0,-1.42,1.47),(4.97,.30,.68),plastic,.13)
cube("Output lower edge",(0,-1.42,.43),(4.85,.23,.18),plastic,.045)
cube("Left slot frame",(-2.15,-1.42,.88),(.66,.28,.73),plastic,.07)
cube("Right slot frame",(2.15,-1.42,.88),(.66,.28,.73),plastic,.07)
cube("Top lid",(0,-.40,1.88),(5.02,1.92,.20),plastic,.09)
cube("Lid seam",(0,-.40,1.984),(4.38,1.42,.012),seam,.025)
cube("Lid inset",(0,-.42,1.995),(4.32,1.36,.018),plastic,.035)
for x in [-2.03,2.03]:cube("Feed shoulder",(x,1.02,1.89),(1.0,.8,.18),plastic,.06)
cube("Internal floor",(0,0,.46),(3.3,2.65,.10),seam,.03)
tray=cube("Rear upright paper support",(0,1.28,2.72),(2.65,.10,1.58),plastic,.10)
tray.rotation_euler[0]=math.radians(-8)
for x in [-.88,0,.88]:cube("Tray raised guide",(x,1.18,2.72),(.025,.05,1.36),trim,.01)
for x in [-1.18,1.18]:cube("Feed width guide",(x,1.04,2.01),(.14,.37,.28),trim,.04)
cube("Output tray",(0,-1.98,.20),(3.65,1.16,.10),plastic,.07)
for x in [-1.1,-.55,0,.55,1.1]:cube("Output tray rib",(x,-1.97,.261),(.022,.91,.018),trim,.007)
for x in [-2.1,2.1]:
    for y in [-1.08,1.08]:cube("Rubber desk foot",(x,y,.025),(.47,.44,.08),rubber,.04)

for y in [-.70,.86]:
    roller=empty("Roller assembly")
    roller.location=(0,y,.71)
    cylinder("Roller spindle",(-1.85,0,0),(1.85,0,0),.075,chrome,roller)
    for x in [-1.12,-.38,.38,1.12]:
        cylinder("Rubber feed wheel",(x-.13,0,0),(x+.13,0,0),.18,rubber,roller)
        for i in range(8):
            a=i*math.tau/8
            cylinder("Roller grip rib",(x-.13,math.sin(a)*.179,math.cos(a)*.179),
                     (x+.13,math.sin(a)*.179,math.cos(a)*.179),.008,plastic,roller,12)
    key(roller,"rotation_euler",15,(0,0,0))
    key(roller,"rotation_euler",28,(31,0,0))

cylinder("Carriage guide rail",(-2.16,.45,1.37),(2.16,.45,1.37),.045,chrome)
cube("Carriage belt",(0,.67,1.48),(4.4,.025,.065),rubber,.009)
carriage=empty("Ink carriage")
cube("Ink carriage housing",(0,.44,1.17),(.67,.65,.53),seam,.07,carriage)
cube("Ink carriage top",(0,.44,1.47),(.77,.72,.07),trim,.035,carriage)
cube("Nozzle block",(0,.44,.88),(.42,.36,.08),bronze,.016,carriage)
for i in range(7):cube("Carriage cooling fin",(-.26+i*.085,.086,1.17),(.018,.025,.31),plastic,.006,carriage)
for t,x in [(0,1.65),(15,1.65),(16,-1.65),(17,1.65),(18,-1.65),(19,1.65),
            (20.3,-.58),(20.7,-.52),(21,-.6),(21.3,-.51),(21.6,-.61),
            (22.3,-.5),(23,-.61),(24,1.65),(25,-1.65),(26,1.65),(27,-1.65),
            (28,1.65),(29,-1.65),(30,1.65),(32,-1.65),(34,1.65),(36,-1.65),
            (38,1.65),(40,-1.65),(42,1.65),(44,-1.65),(46,1.65),(60,1.65)]:
    key(carriage,"location",t,(x,0,0))

# A plain button and its small status light.
cylinder("Start button",(2.04,-.88,1.98),(2.04,-.88,2.018),.105,trim)
status=material("Status light",(.14,.40,.10),.3)
bsdf=status.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Emission Color"].default_value=(.18,.60,.08,1)
for t,value in [(0,0),(13.3,1.6),(20.6,1.6),(20.8,.1),(21,2),(21.3,.1),(21.6,2),(22,.1),(23,2),(60,1)]:
    bsdf.inputs["Emission Strength"].default_value=value
    bsdf.inputs["Emission Strength"].keyframe_insert(data_path="default_value",frame=round(t*FPS)+1)
sphere("Status diode",(2.04,-.88,2.028),(.027,.027,.008),status)

# Handmade anatomical hand rigs, with rounded joints and nails.
def make_hand(name,press=False):
    root=empty(name)
    sphere("Palm",(.38,.01,0),(.37,.24,.105),skin,root)
    sphere("Thumb pad",(.38,.17,-.02),(.17,.16,.09),skin,root)
    cylinder("Wrist",(.62,0,0),(.94,.02,-.015),.14,skin,root)
    cylinder("Sleeve",(.83,.02,-.015),(2.8,.1,-.08),.205,sleeve,root)
    cylinder("Cuff",(.79,.02,-.015),(.96,.03,-.018),.215,sleeve,root)
    for i in range(4):
        yy=-.18+i*.12
        if i==0:
            joints=[(.21,yy,.015),(-.08,yy,.09),(-.29,yy,-.015 if not press else -.22)]
        else:
            joints=[(.22+i*.025,yy,.005),(.03+i*.035,yy,-.10),(.10+i*.035,yy,-.20)]
        for a,b in zip(joints,joints[1:]):
            cylinder("Finger phalanx",a,b,.062 if i else .069,skin,root)
            sphere("Finger joint",b,(.066,.067,.066),skin,root)
        end=Vector(joints[-1])
        sphere("Nail",end+Vector([-.007,0,.053]),(.040,.039,.009),nail,root)
    thumb=[(.44,.21,-.04),(.11,.17,-.10),(-.27,-.02,-.055)]
    for a,b in zip(thumb,thumb[1:]):
        cylinder("Thumb phalanx",a,b,.08,skin,root)
        sphere("Thumb joint",b,(.082,.08,.07),skin,root)
    sphere("Thumb nail",Vector(thumb[-1])+Vector([-.015,0,.055]),(.045,.04,.01),nail,root)
    return root


loading_hand=make_hand("Loading hand")
for t,loc in [(0,(6,1.0,6.5)),(3,(5.5,1.0,6.4)),(4.4,(1.36,1.0,5.50)),
              (8.4,(1.36,1.0,4.30)),(9,(1.36,1.0,4.30)),(11,(5.7,1.0,5.4)),(60,(6,1,6.5))]:
    key(loading_hand,"location",t,loc)
loading_hand.rotation_euler=(math.radians(8),math.radians(-8),math.radians(4))
press_hand=make_hand("Pressing hand",True)
for t,loc in [(0,(6,-1.0,5)),(11,(6,-1.0,5)),(12.7,(2.33,-.70,2.35)),
              (13.3,(2.33,-.70,2.23)),(13.6,(2.33,-.70,2.31)),(15,(6,-1,4.5)),(60,(6,-1,5))]:
    key(press_hand,"location",t,loc)

mesh=bpy.data.meshes.new("Blank paper mesh")
mesh.from_pydata([(-1.04,0,0),(1.04,0,0),(1.04,.14,2.95),(-1.04,.14,2.95)],[],[(0,1,2,3)])
mesh.update()
loading_sheet=bpy.data.objects.new("Loaded blank paper",mesh);scene.collection.objects.link(loading_sheet)
attach(loading_sheet,paper_plain)
solid=loading_sheet.modifiers.new("Paper thickness","SOLIDIFY");solid.thickness=.006
for t,z in [(0,7),(3,6.5),(4.4,2.7),(8.4,1.50),(15,1.50),(21,-2.0),(60,-2.0)]:
    key(loading_sheet,"location",t,(0,1.22,z))

# Paper and marks are shaded together so the printing has real shadows.
paper=material("Printed paper",(.86,.85,.77),.91,grain=True)
nodes=paper.node_tree.nodes;links=paper.node_tree.links
bsdf=nodes.get("Principled BSDF")
coord=nodes.new("ShaderNodeTexCoord")
separate=nodes.new("ShaderNodeSeparateXYZ")
links.new(coord.outputs["UV"],separate.inputs[0])
invert=nodes.new("ShaderNodeMath");invert.operation="SUBTRACT";invert.inputs[0].default_value=1
links.new(separate.outputs["Y"],invert.inputs[1])
last_color=None
for filename,timing in [
    ("paper-normal.png",[(0,0),(16,0),(26,.48),(35,.78),(42,1)]),
    ("paper-error.png",[(0,0),(28,0),(32,.34),(39,.74),(46,1)]),
    ("paper-smear.png",[(0,0),(37,0),(43,.7),(49,1)])]:
    image=bpy.data.images.load(str(BUILD/filename));image.pack()
    tex=nodes.new("ShaderNodeTexImage");tex.image=image
    links.new(coord.outputs["UV"],tex.inputs["Vector"])
    scan=nodes.new("ShaderNodeValue");scan.label=filename
    for t,value in timing:
        scan.outputs[0].default_value=value
        scan.outputs[0].keyframe_insert(data_path="default_value",frame=round(t*FPS)+1)
    reveal=nodes.new("ShaderNodeMath");reveal.operation="LESS_THAN"
    links.new(invert.outputs[0],reveal.inputs[0]);links.new(scan.outputs[0],reveal.inputs[1])
    mask=nodes.new("ShaderNodeMath");mask.operation="MULTIPLY"
    links.new(reveal.outputs[0],mask.inputs[0]);links.new(tex.outputs["Alpha"],mask.inputs[1])
    mix_node=nodes.new("ShaderNodeMixRGB")
    links.new(mask.outputs[0],mix_node.inputs[0])
    if last_color:links.new(last_color,mix_node.inputs[1])
    else:mix_node.inputs[1].default_value=(.86,.85,.77,1)
    links.new(tex.outputs["Color"],mix_node.inputs[2])
    last_color=mix_node.outputs[0]
links.new(last_color,bsdf.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1,location=(0,-.10,.56))
stream=bpy.context.object;stream.name="Internal paper sheet";stream.scale=(2.15,3.35,1)
attach(stream,paper)
solid=stream.modifiers.new("Sheet thickness","SOLIDIFY");solid.thickness=.005
for t,y in [(0,1.8),(15,1.8),(19,.9),(23,-.10),(60,-.10)]:
    key(stream,"location",t,(0,y,.56))

# Last shot contains only ink gathering on paper. The creature never appears.
metaball=bpy.data.metaballs.new("Gathering ink")
metaball.resolution=.010;metaball.render_resolution=.0035;metaball.threshold=.60
ink_obj=bpy.data.objects.new("Gathering ink",metaball);scene.collection.objects.link(ink_obj)
metaball.materials.append(liquid)
for x,y,t,r in [(-.18,-1.04,51.1,.085),(.15,-1.10,52.8,.060),(-.11,-.85,54.3,.052),
                (.24,-.84,55.5,.072),(.00,-1.18,57.2,.045)]:
    y-=.23
    element=metaball.elements.new()
    element.type="ELLIPSOID";element.size_x=1; element.size_y=1;element.size_z=.65
    for moment,radius,co in [(0,.0001,(x,y,1.4)),(t,.0001,(x,y,1.4)),
                              (t+.15,r,(x,y,1.2)),(t+.64,r,(x,y,.56)),
                              (t+.74,r*1.13,(x,y,.548)),(t+.94,r,(x,y,.56)),
                              (57.7,r,(x,y,.56)),(60,r,(x*.62,y*.62-1.25*.38,.56))]:
        element.radius=radius;element.co=co
        element.keyframe_insert(data_path="radius",frame=round(moment*FPS)+1)
        element.keyframe_insert(data_path="co",frame=round(moment*FPS)+1)

# Warm practical desk lamp, cool rim, and a discreet internal fill.
cylinder("Lamp foot",(-3.8,.65,.02),(-3.8,.65,.10),.48,plastic)
cylinder("Lamp lower arm",(-3.8,.65,.10),(-3.9,.65,2.2),.042,chrome)
cylinder("Lamp upper arm",(-3.9,.65,2.2),(-3.0,.65,4.1),.042,chrome)
bpy.ops.mesh.primitive_cone_add(vertices=64,radius1=.55,radius2=.22,depth=.5,location=(-3.0,.65,3.88))
shade=bpy.context.object;shade.name="Lamp shade";attach(shade,plastic)
mod=shade.modifiers.new("Shade edge bevel","BEVEL");mod.width=.03;mod.segments=3
emission=material("Lamp warm diffuser",(.9,.62,.23),.3)
em=emission.node_tree.nodes.get("Principled BSDF")
em.inputs["Emission Color"].default_value=(1,.63,.24,1);em.inputs["Emission Strength"].default_value=3
cylinder("Lamp luminous diffuser",(-3,.65,3.625),(-3,.65,3.635),.48,emission)
area("Desk lamp",(-3,.65,3.59),(0,0,.7),430,(1,.70,.40),1.5)
area("Large soft key",(-3,-4,6.8),(0,0,1.5),800,(1,.84,.65),5)
area("Cool window rim",(4.8,2.6,5.4),(0,0,1.5),1100,(.58,.73,1),4)
area("Camera-side fill",(1,-6,3.5),(0,0,1.3),150,(.78,.85,1),3)
area("Internal service light",(0,.86,1.72),(0,-.3,.55),95,(1,.88,.67),1.8,shape="RECTANGLE",size_y=.5)
area("Paper path fill",(1.4,-1.0,1.60),(0,-.8,.55),35,(.78,.86,1),1.0)

# A continuous camera flight with animated focus.
focus=empty("Camera focus")
camera_data=bpy.data.cameras.new("Cinematic camera")
camera=bpy.data.objects.new("Cinematic camera",camera_data);scene.collection.objects.link(camera)
scene.camera=camera
camera_data.clip_start=.025;camera_data.clip_end=100
camera_data.dof.use_dof=True;camera_data.dof.focus_object=focus
camera_data.dof.aperture_fstop=5.6
track=camera.constraints.new("TRACK_TO");track.track_axis="TRACK_NEGATIVE_Z";track.up_axis="UP_Y";track.target=focus
shots=[
    (0,(6.1,-9.6,5.8),(0,0,2.1),42),
    (4,(5.7,-9.0,5.7),(0,.4,2.6),43),
    (9,(5.2,-8.5,5.4),(0,.3,2.45),46),
    (14,(4.8,-8.0,4.5),(.15,-.25,1.80),48),
    (18,(3.9,-7.5,3.8),(0,-.3,1.1),48),
    (23,(.25,-2.40,1.01),(0,.5,.95),29),
    (26,(0,-1.27,1.02),(0,.30,.62),31),
    (29,(.10,-.20,1.52),(0,.15,.565),36),
    (34,(.10,-.07,1.62),(-.10,.21,.565),48),
    (42,(.05,-.56,1.55),(0,-.30,.565),52),
    (49,(.04,-1.15,1.56),(0,-1.25,.57),38),
    (60,(.015,-1.12,1.50),(0,-1.25,.585),40)]
for t,loc,target,lens in shots:
    key(camera,"location",t,loc);key(focus,"location",t,target)
    camera_data.lens=lens;camera_data.keyframe_insert(data_path="lens",frame=round(t*FPS)+1)
for obj in [camera,focus,loading_hand,loading_sheet,press_hand]:
    if obj.animation_data and obj.animation_data.action:
        for layer in obj.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:point.handle_left_type="AUTO_CLAMPED";point.handle_right_type="AUTO_CLAMPED"

scene.frame_set(1)
scene.render.filepath=str(BUILD/"blender-frames"/"frame_")
(BUILD/"blender-frames").mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"exports"/"opening-scene.blend"))
if "--benchmark" in sys.argv:
    scene.frame_set(1440)
    scene.render.filepath=str(BUILD/"blender-final-preview.png")
    bpy.ops.render.render(write_still=True)
elif "--cycles-test" in sys.argv:
    scene.render.engine="CYCLES"
    prefs=bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type="OPTIX";prefs.get_devices()
    for device in prefs.devices:device.use=device.type=="OPTIX"
    scene.cycles.device="GPU"
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.cycles.denoiser="OPTIX"
    scene.render.resolution_percentage=50
    scene.frame_set(194)
    scene.render.filepath=str(BUILD/"cycles-test.png")
    bpy.ops.render.render(write_still=True)
elif "--preview" in sys.argv:
    scene.render.resolution_percentage=50
    for frame in [816,1008,1344]:
        scene.frame_set(frame)
        scene.render.filepath=str(BUILD/f"blender-preview-{frame:04d}.png")
        bpy.ops.render.render(write_still=True)
elif "--render" in sys.argv:
    scene.render.filepath=str(BUILD/"blender-frames"/"frame_")
    bpy.ops.render.render(animation=True)
