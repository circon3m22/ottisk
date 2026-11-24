"""Hand-built 90-second opening. Run with Blender 5.3, optionally -- --preview.

The older 60-second scene is the shell/set source, never overwritten.
All added geometry, anatomical surfaces, printing, lighting and animation are
constructed here. No generated photographs or external visual assets are used.
"""
from pathlib import Path
import math
import random
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
BUILD=ROOT/'.work'/'opening90'
BUILD.mkdir(parents=True,exist_ok=True)
FPS=24
random.seed(419)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'exports'/'opening-scene.blend'))
scene=bpy.context.scene
scene.frame_end=2160
scene.render.fps=FPS
scene.render.resolution_x=1920;scene.render.resolution_y=1080
scene.render.resolution_percentage=100
scene.cycles.samples=40
scene.cycles.adaptive_threshold=.065
scene.cycles.use_denoising=True
scene.cycles.denoiser='OPTIX'
scene.cycles.max_bounces=6
scene.render.use_persistent_data=True
scene.render.use_motion_blur=True
scene.render.motion_blur_shutter=.30
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.compression=12
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU'
scene.view_settings.exposure=.05
scene.world.color=(.025,.035,.05)


def mat(name,color,rough=.4,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    return m


def attach(o,m,parent=None):
    o.data.materials.append(m)
    if parent:o.parent=parent
    return o


def cube(name,loc,size,m,bevel=.01,parent=None):
    x,y,z=[v/2 for v in size]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[],
                     [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.location=loc
    attach(o,m,parent)
    if bevel:
        mod=o.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    return o


def sphere(name,loc,size,m,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return attach(o,m,parent)


def cylinder(name,a,b,r,m,parent=None,vertices=32):
    a,b=Vector(a),Vector(b)
    depth=(b-a).length
    vs=[(r*math.cos(i*math.tau/vertices),r*math.sin(i*math.tau/vertices),z) for z in [-depth/2,depth/2] for i in range(vertices)]
    faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]
    for i in range(vertices):faces.append((i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.location=(a+b)/2
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    attach(o,m,parent)
    for p in o.data.polygons:p.use_smooth=True
    bevel=o.modifiers.new('Edge radius','BEVEL');bevel.width=min(.004,r*.10);bevel.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


def curve(name,points,r,m,parent=None,poly=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D'
    data.resolution_u=12;data.bevel_depth=r;data.bevel_resolution=3
    s=data.splines.new('POLY' if poly else 'BEZIER')
    if poly:
        s.points.add(len(points)-1)
        for p,co in zip(s.points,points):p.co=(*co,1)
    else:
        s.bezier_points.add(len(points)-1)
        for p,co in zip(s.bezier_points,points):
            p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    return attach(o,m,parent)


def empty(name):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);return o


def key(o,prop,t,value):
    setattr(o,prop,value);o.keyframe_insert(data_path=prop,frame=round(t*FPS)+1)


def value_key(socket,t,v):
    socket.default_value=v;socket.keyframe_insert(data_path='default_value',frame=round(t*FPS)+1)


def remove_tree(o):
    for child in list(o.children):remove_tree(child)
    bpy.data.objects.remove(o,do_unlink=True)


def area(name,loc,target,power,color,size,size_y=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color
    d.shape='RECTANGLE' if size_y else 'DISK';d.size=size
    if size_y:d.size_y=size_y
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o


def smooth_anim(o):
    if not o.animation_data or not o.animation_data.action:return
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for c in bag.fcurves:
                    for p in c.keyframe_points:
                        p.handle_left_type='AUTO_CLAMPED';p.handle_right_type='AUTO_CLAMPED'


def linear_anim(o):
    if not o.animation_data or not o.animation_data.action:return
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for c in bag.fcurves:
                    for p in c.keyframe_points:p.interpolation='LINEAR'


plastic=bpy.data.materials['Graphite plastic']
sage=bpy.data.materials['Soft sage enclosure']
rubber=bpy.data.materials['Rubber rollers']
steel=bpy.data.materials['Brushed steel']
brass=bpy.data.materials['Inkjet nozzle brass']
black=bpy.data.materials['Deep recess']
ink=bpy.data.materials['Liquid black ink']
for name in ['Graphite plastic','Soft sage enclosure','Rubber rollers','Unprinted sheet']:
    for node in bpy.data.materials[name].node_tree.nodes:
        if node.type=='BUMP':node.inputs['Distance'].default_value=.0008 if 'sheet' in name else .0012
plastic.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.032,.039,.037,1)
sage.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.105,.13,.115,1)
steel.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.29
ink.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.12
ink.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.20
ink.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value=1.34
ink.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.10
ink.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value=.18
silver=mat('Satin zinc chassis',(.35,.38,.39),.38,.75)
pcb=mat('Dark olive circuit board',(.025,.063,.043),.51)
copper=mat('Copper traces',(.38,.21,.075),.32,.8)
ivory=mat('PBT connectors',(.65,.65,.53),.50)
blue=mat('Blue anodized hardware',(.025,.07,.11),.31,.65)

# Replace the visibly segmented hands, the old ink and the old camera flight.
for name in ['Loading hand','Pressing hand','Gathering ink','Cinematic camera','Camera focus']:
    if name in bpy.data.objects:remove_tree(bpy.data.objects[name])
scene.timeline_markers.clear()

# A carefully lit lived-in room, built entirely from meshes and shaders.
desk=bpy.data.objects['Desk'];desk.dimensions=(17,11,.30);desk.location=(0,-.8,-.15)
wood=bpy.data.materials['Fine walnut veneer']
nodes=wood.node_tree.nodes;links=wood.node_tree.links
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=330
noise.inputs['Roughness'].default_value=.75
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.15;bump.inputs['Distance'].default_value=.0015
links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])
wall=bpy.data.materials['Muted studio wall'];wall.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.13,.145,.15,1)
wallnoise=wall.node_tree.nodes.new('ShaderNodeTexNoise');wallnoise.inputs['Scale'].default_value=95
wallbump=wall.node_tree.nodes.new('ShaderNodeBump');wallbump.inputs['Distance'].default_value=.007;wallbump.inputs['Strength'].default_value=.25
wall.node_tree.links.new(wallnoise.outputs['Fac'],wallbump.inputs['Height']);wall.node_tree.links.new(wallbump.outputs[0],wall.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
cube('Wall skirting',(0,3.99,.44),(20,.07,.16),plastic,.018)
frame=mat('Painted window frame',(.32,.35,.34),.45)
glass=mat('Overcast window',(.47,.60,.72),.25)
gp=glass.node_tree.nodes.get('Principled BSDF');gp.inputs['Emission Color'].default_value=(.48,.65,.85,1);gp.inputs['Emission Strength'].default_value=.5
cube('Window recess',(-5,3.99,4.15),(3.7,.12,4.0),black,.02)
cube('Window luminous pane',(-5,3.88,4.15),(3.48,.04,3.77),glass,.01)
for x in [-6.8,-5,-3.2]:cube('Window vertical mullion',(x,3.81,4.15),(.065,.12,4),frame,.008)
for z in [2.18,4.2,6.12]:cube('Window horizontal mullion',(-5,3.8,z),(3.7,.12,.06),frame,.008)
cube('Window sill',(-5,3.65,2.14),(4.0,.62,.1),frame,.02)
area('Broad window daylight',(-4.8,3.4,4.7),(0,-1,1),600,(.64,.78,1),3,3.5)
ceramic=mat('Unglazed ceramic',(.32,.27,.20),.50)
# Open cup: concentric walls, visible rim and dark coffee rather than a solid cylinder.
bpy.ops.mesh.primitive_torus_add(major_radius=.25,minor_radius=.028,major_segments=64,minor_segments=12,location=(-4.35,-1.22,.68))
cup=bpy.context.object;cup.name='Ceramic cup rim';attach(cup,ceramic)
profile=[(.23,0),(.255,.10),(.25,.64),(.225,.66),(.215,.10),(.18,.05)]
verts=[(-4.35+r*math.cos(i*math.tau/64),-1.22+r*math.sin(i*math.tau/64),z+.03) for r,z in profile for i in range(64)]
faces=[]
for j in range(len(profile)-1):
    for i in range(64):faces.append((j*64+i,j*64+(i+1)%64,(j+1)*64+(i+1)%64,(j+1)*64+i))
mesh=bpy.data.meshes.new('Cup lathed profile');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Handmade ceramic cup',mesh);scene.collection.objects.link(o);attach(o,ceramic)
for p in mesh.polygons:p.use_smooth=True
curve('Cup handle',[(-4.58,-1.22,.56),(-4.83,-1.22,.55),(-4.84,-1.22,.23),(-4.57,-1.22,.21)],.037,ceramic)
coffee=mat('Dark coffee',(.015,.008,.003),.19)
cylinder('Coffee surface',(-4.35,-1.22,.53),(-4.35,-1.22,.535),.22,coffee,vertices=64)
paperwhite=bpy.data.materials['Unprinted sheet']
for i in range(7):
    o=cube('Loose paper stack',(-3.65,1.57,.026+i*.009),(2.0,2.75,.006),paperwhite,.001)
    o.rotation_euler[2]=math.radians(-12+random.uniform(-1.7,1.7))
cloth=mat('Faded linen notebook',(.12,.105,.075),.92)
book=cube('Closed linen notebook',(-4.62,-3.0,.12),(1.27,1.83,.20),cloth,.035);book.rotation_euler[2]=-.15
curve('Notebook elastic',[(-4.18,-3.91,.21),(-4.05,-2.13,.23)],.012,black)
pen=cylinder('Brass pencil',(-4.8,-3.6,.29),(-4.1,-2.6,.29),.032,brass)
cylinder('Pencil graphite',(-4.82,-3.63,.29),(-4.8,-3.6,.29),.015,black)
curve('Printer power cable',[(2.48,1.25,.38),(3.05,1.75,.13),(3.4,2.8,.035),(4.25,3.8,.035),(4.28,4,.45)],.027,rubber)
cube('Cable strain relief',(2.46,1.25,.38),(.22,.13,.12),rubber,.025)
cube('Wall socket',(4.28,4.0,.48),(.35,.08,.48),ivory,.025)
cube('Power plug',(4.28,3.89,.48),(.19,.24,.23),plastic,.035)
for i in range(16):
    x=random.uniform(-6.5,6.5);y=random.uniform(-4.5,2.8)
    curve('Fine desk wear',[(x,y,.004),(x+random.uniform(.04,.18),y+.003,.004)],.0005,black)

# Extend the output tray so the corrupted sheet can physically emerge in full.
cube('Telescopic output tray',(0,-3.1,.17),(2.7,2.55,.085),plastic,.055)
for x in [-1.28,1.28]:cube('Tray side return',(x,-3.05,.225),(.035,2.52,.055),sage,.01)
for x in [-.95,-.48,0,.48,.95]:cube('Tray longitudinal runner',(x,-3.04,.219),(.015,2.30,.018),sage,.005)

# Anatomical continuous hand surface, with opposed thumb and a real wrist taper.
print('BUILD environment complete; sculpting hands',flush=True)
skin=mat('Continuous skin',(.48,.285,.18),.48)
sn=skin.node_tree.nodes;sl=skin.node_tree.links;sp=sn.get('Principled BSDF')
sp.inputs['Subsurface Weight'].default_value=.085
sp.inputs['Subsurface Radius'].default_value=(1,.45,.23)
sp.inputs['Subsurface Scale'].default_value=.009
skinvariation=sn.new('ShaderNodeTexNoise');skinvariation.inputs['Scale'].default_value=18;skinvariation.inputs['Detail'].default_value=3
skinramp=sn.new('ShaderNodeValToRGB')
skinramp.color_ramp.elements[0].color=(.435,.252,.163,1)
skinramp.color_ramp.elements[1].color=(.50,.301,.198,1)
sl.new(skinvariation.outputs['Fac'],skinramp.inputs[0]);sl.new(skinramp.outputs[0],sp.inputs['Base Color'])
pores=sn.new('ShaderNodeTexNoise');pores.inputs['Scale'].default_value=1200;pores.inputs['Detail'].default_value=2
sb=sn.new('ShaderNodeBump');sb.inputs['Strength'].default_value=.12;sb.inputs['Distance'].default_value=.00045
sl.new(pores.outputs['Fac'],sb.inputs['Height']);sl.new(sb.outputs[0],sp.inputs['Normal'])
nail=mat('Natural satin nails',(.53,.36,.27),.32)
sleeve=bpy.data.materials['Knitted sleeve']


def make_hand(name,press=False):
    root=empty(name);parts=[]
    def ell(loc,size):
        o=sphere('Skin volume',loc,size,skin);parts.append(o);return o
    def bone(a,b,ra,rb):
        a,b=Vector(a),Vector(b)
        bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=ra,radius2=rb,depth=(b-a).length,location=(a+b)/2)
        o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();parts.append(o)
    ell((.52,-.015,-.005),(.325,.235,.108))
    ell((.58,.15,-.05),(.19,.145,.10))
    ell((.80,-.012,-.025),(.23,.155,.09))
    bone((.78,0,-.025),(1.24,.01,-.015),.128,.16)
    ell((1.12,.01,-.015),(.23,.15,.10))
    paths=[[(.31,.18,.018),(.10,.205,.085),(-.08,.207,.045),(-.16,.20,-.035)],
           [(.29,.045,.012),(.02,.045,-.032),(-.04,.045,-.23),(.10,.045,-.30)],
           [(.32,-.105,.005),(.075,-.12,-.06),(.04,-.12,-.245),(.17,-.12,-.30)],
           [(.40,-.235,-.01),(.20,-.25,-.06),(.17,-.25,-.21),(.28,-.25,-.26)],
           [(.58,.205,-.035),(.37,.345,-.085),(.08,.31,-.10),(-.10,.285,-.065)]]
    if press:
        paths[0]=[(.31,.18,.02),(.045,.20,.018),(-.23,.20,-.06),(-.42,.20,-.22)]
        paths[1]=[(.29,.045,.012),(.02,.045,-.032),(-.16,.045,-.13),(-.13,.045,-.23)]
        paths[2]=[(.32,-.105,.005),(.10,-.12,-.06),(-.02,-.12,-.16),(.01,-.12,-.25)]
        paths[3]=[(.40,-.235,-.01),(.20,-.25,-.06),(.10,-.25,-.15),(.14,-.25,-.22)]
        paths[4]=[(.65,.205,-.035),(.46,.31,-.08),(.25,.31,-.17),(.20,.23,-.22)]
    radii=[.066,.065,.059,.050,.079]
    for idx,(path,r) in enumerate(zip(paths,radii)):
        # Intermediate samples soften the dorsal silhouette at the knuckles.
        for j,(a,b) in enumerate(zip(path,path[1:])):
            ra=r*(1-j*.10);rb=r*(.94-j*.12)
            bone(a,b,ra,rb);ell(a,(ra,ra*.93,ra*.9));ell(b,(rb,rb*.94,rb*.88))
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join();surface=bpy.context.object;surface.name=name+' unified sculpt'
    print('BUILD joined '+name,flush=True)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    # Bring the mesh into root-local coordinates before the union.
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR',center='MEDIAN')
    rem=surface.modifiers.new('Continuous anatomical union','REMESH');rem.mode='VOXEL';rem.voxel_size=.006
    bpy.ops.object.modifier_apply(modifier=rem.name)
    print('BUILD remeshed '+name,flush=True)
    sm=surface.modifiers.new('Relax skin surface','SMOOTH');sm.factor=.7;sm.iterations=7
    bpy.ops.object.modifier_apply(modifier=sm.name)
    sub=surface.modifiers.new('Skin subdivision','SUBSURF');sub.levels=1;sub.render_levels=1
    surface.data.materials.clear();surface.data.materials.append(skin)
    for p in surface.data.polygons:p.use_smooth=True
    surface.parent=root
    # The thumb and forefinger gently separate at release, without joint seams.
    if not press:
        surface.shape_key_add(name='Relaxed pinch')
        release=surface.shape_key_add(name='Release paper')
        for v in release.data:
            co=v.co
            w=max(0,min(1,(-co.x+.08)/.45))
            if co.y>.235:co.y+=.085*w;co.z-=.035*w
            elif co.y>.12:co.y-=.06*w;co.z+=.05*w
        for t,v in [(0,0),(12,0),(13.1,1),(16,1),(90,1)]:key(release,'value',t,v)
    else:
        surface.shape_key_add(name='Resting finger')
        touch=surface.shape_key_add(name='Index finger pressure')
        for v in touch.data:
            if v.co.y>.12 and v.co.x<.27:
                v.co.z-=.027*max(0,min(1,(.27-v.co.x)/.58))
        for t,v in [(0,0),(18.6,0),(19,1),(19.35,1),(19.8,0),(90,0)]:key(touch,'value',t,v)
    for idx,path in enumerate(paths):
        end=Vector(path[-1]);prev=Vector(path[-2]);direction=(end-prev).normalized()
        normal=(Vector((0,0,1))-direction*direction.z).normalized()
        side=normal.cross(direction).normalized();origin=end-direction*.045
        length=.049 if idx!=4 else .059;width=.033 if idx!=4 else .039
        radius=radii[idx];dist=(end-prev).length
        def nail_point(u,v):
            rr=radius*(.70+.10*(.045-u)/dist)
            # The keratin surface wraps around the finger rather than hovering
            # as a flat oval. Its free edge remains less than a millimetre proud.
            height=math.sqrt(max(.00001,rr*rr-v*v))+.0007
            return origin+direction*u+side*v+normal*height
        nv=[nail_point(0,0)];nf=[];rings=5;sides=32
        for ring in range(1,rings+1):
            for j in range(sides):
                a=j*math.tau/sides;u=math.cos(a)*length*ring/rings;v=math.sin(a)*width*ring/rings
                nv.append(nail_point(u,v))
        for j in range(sides):nf.append((0,1+j,1+(j+1)%sides))
        for ring in range(rings-1):
            a=1+ring*sides;b=a+sides
            for j in range(sides):nf.append((a+j,b+j,b+(j+1)%sides,a+(j+1)%sides))
        nm=bpy.data.meshes.new(name+' curved nail');nm.from_pydata(nv,[],nf);nm.update()
        o=bpy.data.objects.new(name+' nail',nm);scene.collection.objects.link(o);attach(o,nail,root)
        for face in nm.polygons:face.use_smooth=True
        thin=o.modifiers.new('Keratin thickness','SOLIDIFY');thin.thickness=.0007
        if press and idx==0:
            for t,v in [(0,0),(18.6,0),(19,1),(19.35,1),(19.8,0),(90,0)]:key(o,'location',t,(0,0,-.027*v))
        elif not press and idx in [0,4]:
            w=max(0,min(1,(-origin.x+.08)/.45))
            delta=Vector((0,.085*w,-.035*w)) if idx==4 else Vector((0,-.06*w,.05*w))
            for t,v in [(0,0),(12,0),(13.1,1),(16,1),(90,1)]:key(o,'location',t,delta*v)
    cylinder(name+' ribbed cuff',(1.12,.008,-.018),(1.34,.008,-.018),.18,sleeve,root)
    cylinder(name+' clothed forearm',(1.30,.008,-.018),(7,.18,.10),.22,sleeve,root)
    for i in range(11):
        x=1.14+i*.017
        # Cuff ribs are shallow, never skin-colored segmented joints.
        bpy.ops.mesh.primitive_torus_add(major_radius=.178,minor_radius=.003,major_segments=32,minor_segments=6,location=(x,.008,-.018),rotation=(0,math.pi/2,0))
        o=bpy.context.object;o.name='Fine knitted cuff rib';attach(o,sleeve,root)
    for child in root.children:
        f=child.driver_add('hide_render')
        f.driver.expression='frame < 355 or frame > 528' if press else 'frame > 370'
    return root


loading=make_hand('Loading hand v2')
for t,loc in [(0,(1.20,.85,10.21)),(3,(1.20,.85,9.71)),(5.5,(1.20,.85,5.96)),
              (11.7,(1.20,.85,4.51)),(12.4,(1.20,.85,4.51)),(14.8,(5.7,1.1,5.2)),(90,(7,1.1,6))]:
    key(loading,'location',t,loc)
for t,r in [(0,(0,-.03,0)),(5.5,(0,0,0)),(11.7,(0,0,0)),(12.4,(0,0,0)),(14.8,(.06,-.12,-.10))]:key(loading,'rotation_euler',t,r)
pressing=make_hand('Pressing hand v2',True)
for t,loc in [(0,(7,-1.08,5)),(14.8,(6,-1.08,4.2)),(18,(2.46,-1.08,2.38)),
              (19,(2.46,-1.08,2.31)),(19.35,(2.46,-1.08,2.31)),(19.8,(2.46,-1.08,2.37)),(21.5,(6,-1.08,4.2)),(90,(7,-1.08,5))]:
    key(pressing,'location',t,loc)
sheet=bpy.data.objects['Loaded blank paper'];sheet.animation_data_clear()
for t,z in [(0,7.2),(3,6.7),(5.5,2.95),(11.7,1.5),(19.7,1.5),(26,-2),(90,-2)]:key(sheet,'location',t,(0,.98,z))

# Dense mechanical detail: folded chassis, bearing blocks, belts, PCB and nozzle array.
print('BUILD hands complete; mechanical assemblies',flush=True)
carriage=bpy.data.objects['Ink carriage'];carriage.animation_data_clear()
for side in [-1,1]:
    x=side*1.94
    cube('Folded steel side rail',(x,.08,.90),(.055,2.25,.48),silver,.008)
    cube('Chassis top return',(x-side*.075,.08,1.15),(.19,2.25,.035),silver,.006)
    cube('Chassis bottom return',(x-side*.075,.08,.665),(.19,2.25,.035),silver,.006)
    for y in [-.86,-.4,.12,.65,1.04]:
        cylinder('Bearing boss',(x-.075,y,.85),(x+.075,y,.85),.115,black)
        cylinder('Bearing steel race',(x-.08,y,.85),(x+.08,y,.85),.078,steel)
        cylinder('Bearing dark seal',(x-.083,y,.85),(x+.083,y,.85),.046,rubber)
    for y in [-.94,-.37,.37,.98]:
        cylinder('Chassis countersunk screw',(x,.0+y,1.167),(x,y,1.18),.027,steel,vertices=12)
        cube('Screw driver slot',(x,y,1.183),(.033,.006,.003),black,.001)
    for y in [-.94,.92]:
        curve('Grounding conductor',[(x,y,.69),(x-side*.10,y,.75),(x-side*.14,y,1.13)],.007,copper)
for x in [-1.65,1.65]:
    cube('Guide rail end mount',(x,.45,1.37),(.19,.23,.23),silver,.015)
    cylinder('Rail locking collar',(x-.08,.45,1.37),(x+.08,.45,1.37),.07,steel)
for roller in [o for o in bpy.data.objects if o.name.startswith('Roller assembly')]:
    roller.animation_data_clear()
    for t,a in [(0,0),(20,0),(27,24),(34,31),(56,52),(66,59),(74,60),(81,85),(90,85)]:key(roller,'rotation_euler',t,(a,0,0))
    for x in [-1.5,-.77,0,.77,1.5]:
        cylinder('Roller shaft collar',(x-.022,0,0),(x+.022,0,0),.093,steel,roller)
    for x in [-1.12,-.38,.38,1.12]:
        for i in range(13):
            yy=math.cos(i*math.tau/13)*.181;zz=math.sin(i*math.tau/13)*.181
            cube('Molded roller tread',(x,yy,zz),(.22,.006,.006),rubber,.002,roller)

# Spur gears and their real tooth profiles, all rotating about the roller axis.
def gear(name,x,y,z,r,teeth,parent=None):
    root=empty(name);root.location=(x,y,z)
    if parent:root.parent=parent
    cylinder(name+' hub',(-.032,0,0),(.032,0,0),r*.78,ivory,root,48)
    for j in range(teeth):
        a=j*math.tau/teeth
        o=cube(name+' tooth',(0,math.cos(a)*r*.91,math.sin(a)*r*.91),(.064,r*.22,r*.13),ivory,.003,root)
        o.rotation_euler[0]=a
    cylinder(name+' spindle',(-.048,0,0),(.048,0,0),r*.27,steel,root)
    for t,a in [(20,0),(34,12),(66,31),(74,32),(81,45)]:key(root,'rotation_euler',t,(a,0,0))
    return root
for i,(y,z,r) in enumerate([(-.70,.71,.21),(-.30,.83,.20),(.06,.72,.18),(.40,.86,.19),(.80,.71,.20)]):gear('Paper transmission gear',-1.77,y,z,r,24)

# Timing belt runs across the carriage guide; individual teeth catch the macro light.
for z in [1.47,1.61]:
    cube('Carriage timing belt web',(0,.70,z),(4.06,.035,.023),rubber,.003)
    for i in range(135):cube('Timing belt tooth',(-2.0+i*.03,.683,z),(.015,.025,.025),rubber,.001)
for x in [-2.035,2.035]:
    cylinder('Timing belt pulley',(x,.66,1.54),(x,.75,1.54),.085,blue,vertices=48)
    cylinder('Pulley axle',(x,.63,1.54),(x,.79,1.54),.025,steel)
    for j in range(24):
        a=j*math.tau/24
        cylinder('Pulley timing groove',(x+math.sin(a)*.083,.665,1.54+math.cos(a)*.083),(x+math.sin(a)*.083,.747,1.54+math.cos(a)*.083),.006,black,vertices=8)

# Upper star wheels and sprung paper pressure fingers.
for x in [-1.35,-.90,-.45,0,.45,.90,1.35]:
    cube('Paper pressure arm',(x,-.65,1.03),(.075,.47,.055),silver,.009)
    cylinder('Upper star wheel axle',(x-.045,-.78,.84),(x+.045,-.78,.84),.024,steel)
    cylinder('Upper star wheel core',(x-.015,-.78,.84),(x+.015,-.78,.84),.08,steel)
    for j in range(20):
        a=j*math.tau/20
        o=cube('Star wheel point',(x,-.78+math.cos(a)*.087,.84+math.sin(a)*.087),(.018,.028,.012),steel,.002)
        o.rotation_euler[0]=a
    pts=[]
    for j in range(145):
        a=j*math.tau/24
        pts.append((x+(j/144-.5)*.15,-.45+math.cos(a)*.046,1.04+math.sin(a)*.046))
    curve('Pressure torsion spring',pts,.006,steel,poly=True)
    curve('Spring retaining leg',[(x-.075,-.45,1.04),(x-.09,-.37,.99),(x-.09,-.30,.99)],.006,steel)

# Carriage, cartridge channels and the underside nozzle assembly.
for x in [-.26,.26]:
    cube('Carriage folded bracket',(x,.39,1.13),(.035,.43,.46),silver,.008,carriage)
    cylinder('Carriage bearing sleeve',(x-.08,.45,1.37),(x+.08,.45,1.37),.069,black,carriage)
    cylinder('Bronze sleeve lip',(x-.084,.45,1.37),(x-.073,.45,1.37),.073,brass,carriage)
for i,c in enumerate([(.025,.030,.027),(.015,.11,.16),(.25,.025,.075),(.32,.23,.025)]):
    cm=mat('Cartridge channel '+str(i),c,.25)
    x=-.24+i*.16
    cube('Individual cartridge reservoir',(x,.42,1.23),(.135,.46,.31),plastic,.023,carriage)
    cube('Ink cartridge inspection window',(x,.175,1.25),(.068,.008,.16),cm,.013,carriage)
    cube('Cartridge latch',(x,.43,1.465),(.10,.20,.045),black,.008,carriage)
    curve('Capillary feed channel',[(x,.43,1.1),(x,.43,.96),(x,.48,.89)],.012,cm,carriage)
cube('Carriage controller PCB',(0,.077,1.19),(.47,.025,.25),pcb,.006,carriage)
for i in range(8):
    x=-.19+i*.054
    cube('Controller passive component',(x,.057,1.24),(.030,.018,.019),black,.002,carriage)
    cube('Solder termination A',(x-.011,.045,1.24),(.005,.006,.022),steel,.001,carriage)
    cube('Solder termination B',(x+.011,.045,1.24),(.005,.006,.022),steel,.001,carriage)
    curve('Copper PCB trace',[(x,.058,1.16),(x,.058,1.21),(x+.02,.058,1.22)],.0015,copper,carriage,True)
cube('Controller IC',(0,.05,1.12),(.16,.025,.067),black,.004,carriage)
for j in range(12):cube('Controller gold contact',(-.19+j*.035,.058,1.075),(.012,.008,.025),brass,.001,carriage)
cube('Nozzle ceramic gasket',(0,.44,.842),(.44,.38,.014),black,.007,carriage)
cube('Micro-etched nozzle face',(0,.44,.829),(.39,.33,.012),brass,.006,carriage)
for i in range(16):
    for j in range(8):
        x=-.156+i*.0208;y=.35+j*.024
        cylinder('Inkjet microscopic aperture',(x,y,.82285),(x,y,.8230),.0032,black,carriage,16)
for x in [-.18,.18]:
    for y in [.30,.58]:
        cylinder('Nozzle plate screw',(x,y,.818),(x,y,.825),.012,steel,carriage,16)
        cube('Nozzle screw slot',(x,y,.816),(.016,.003,.001),black,.0004,carriage)
for j in range(9):curve('Etched nozzle feed line',[(-.17,.33+j*.026,.821),(-.164,.33+j*.026,.821),(-.14,.35+j*.02,.821)],.0008,copper,carriage,True)

# Main circuit board in the side recess, with discrete connectors and components.
print('BUILD nozzle complete; electronics',flush=True)
cube('Main logic board',(1.64,.12,1.17),(.42,1.22,.035),pcb,.012)
for i in range(24):
    x=1.49+(i%3)*.12;y=-.4+(i//3)*.14
    cube('Board SMD package',(x,y,1.197),(.07,.042,.021),black,.003)
    for off in [-.041,.041]:cube('Board solder pad',(x+off,y,1.196),(.013,.045,.011),steel,.002)
    curve('Board routed trace',[(x-.05,y,1.19),(x-.05,y+.055,1.19),(x+.02,y+.055,1.19)],.002,copper,poly=True)
for y in [-.37,.35]:
    cylinder('Electrolytic capacitor',(1.70,y,1.19),(1.70,y,1.35),.057,blue)
    cylinder('Capacitor top',(1.70,y,1.349),(1.70,y,1.355),.052,steel)
    cube('Capacitor safety vent',(1.70,y,1.357),(.071,.003,.001),black,.0001)
cube('Motor connector',(1.53,.64,1.24),(.15,.13,.10),ivory,.01)
for i in range(4):curve('Motor harness',[(1.49+i*.025,.65,1.27),(1.65+i*.02,.85,1.37),(1.8,.89,1.1)],.008,[rubber,ivory,copper,blue][i])

# Flexible ribbon follows the carriage through a driven bend.
ribbon=curve('Moving flexible printed cable',[(1.65,.90,1.34),(1.05,1.0,1.51),(.35,.95,1.57),(0,.74,1.40)],.012,ivory)
for j,p in enumerate(ribbon.data.splines[0].bezier_points):p.radius=1
for t,x in [(0,1.2),(21,1.2),(25,-1.45),(29,1.45),(33,-.3),(35,0),(54,0),(56,1.35),(58,-1.35),(60,1.35),(62,-1.35),(64,0),(90,0)]:
    for j,p in enumerate(ribbon.data.splines[0].bezier_points):
        p.co.x=[1.65,1.1,(x+1.65)*.5,x][j]
        p.keyframe_insert(data_path='co',frame=round(t*FPS)+1)

# Replace the paper with a flexible subdivided surface and a high-resolution print.
print('BUILD mechanism complete; paper and printing',flush=True)
old=bpy.data.objects['Internal paper sheet'];remove_tree(old)
paper=mat('Fibrous paper with corrupted print',(.84,.83,.76),.88)
nodes=paper.node_tree.nodes;links=paper.node_tree.links;p=nodes.get('Principled BSDF')
texcoord=nodes.new('ShaderNodeTexCoord')
sep=nodes.new('ShaderNodeSeparateXYZ');links.new(texcoord.outputs['UV'],sep.inputs[0])
last=None
for file,times in [('print-base.png',[(0,-.05),(35,-.05),(48,.95),(54,1.1)]),('print-error.png',[(0,-.05),(50,-.05),(55,.32),(60,.74),(65,1.1)]),('print-smear.png',[(0,-.05),(59,-.05),(66,1.1)])]:
    image=bpy.data.images.load(str(BUILD/file));image.pack()
    tx=nodes.new('ShaderNodeTexImage');tx.image=image;links.new(texcoord.outputs['UV'],tx.inputs[0])
    val=nodes.new('ShaderNodeValue');val.label=file
    for t,v in times:value_key(val.outputs[0],t,v)
    sub=nodes.new('ShaderNodeMath');sub.operation='SUBTRACT';links.new(val.outputs[0],sub.inputs[0]);links.new(sep.outputs['Y'],sub.inputs[1])
    mul=nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=100;links.new(sub.outputs[0],mul.inputs[0]);mul.use_clamp=True
    mask=nodes.new('ShaderNodeMath');mask.operation='MULTIPLY';links.new(tx.outputs['Alpha'],mask.inputs[0]);links.new(mul.outputs[0],mask.inputs[1])
    mix=nodes.new('ShaderNodeMixRGB');links.new(mask.outputs[0],mix.inputs[0])
    if last:links.new(last,mix.inputs[1])
    else:mix.inputs[1].default_value=(.84,.83,.76,1)
    links.new(tx.outputs['Color'],mix.inputs[2]);last=mix.outputs[0]
links.new(last,p.inputs['Base Color'])
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1600;noise.inputs['Detail'].default_value=2
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.0006
links.new(noise.outputs['Fac'],bump.inputs[0+2]);links.new(bump.outputs[0],p.inputs['Normal'])


def paper_height(y):
    u=max(0,min(1,(-y-1.25)/1.05));u=u*u*(3-2*u)
    return .56-.32*u


verts=[];faces=[];nx=6;ny=80
for j in range(ny+1):
    for i in range(nx+1):verts.append((-1.075+i*2.15/nx,-1.675+j*3.35/ny,0))
for j in range(ny):
    for i in range(nx):
        a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Subdivided flexible paper');mesh.from_pydata(verts,[],faces);mesh.update()
uv=mesh.uv_layers.new()
for poly in mesh.polygons:
    for li in poly.loop_indices:
        co=mesh.vertices[mesh.loops[li].vertex_index].co
        uv.data[li].uv=((co.x+1.075)/2.15,(co.y+1.675)/3.35)
paperobj=bpy.data.objects.new('Internal paper sheet',mesh);scene.collection.objects.link(paperobj);attach(paperobj,paper)
paperobj.shape_key_add(name='Flat sheet')
feed=[(0,1.8),(20,1.8),(27,.50),(33,-.10),(74,-.10),(76,-.70),(78,-1.8),(81,-3.3),(90,-3.3)]
for idx,(t,y) in enumerate(feed):
    shape=paperobj.shape_key_add(name=f'Paper bend {idx}')
    for v in shape.data:v.co.z=paper_height(v.co.y+y)
    for j,(tt,_) in enumerate(feed):key(shape,'value',tt,1 if j==idx else 0)
    key(paperobj,'location',t,(0,y,0))
sol=paperobj.modifiers.new('Paper edge thickness','SOLIDIFY');sol.thickness=.004

shape_curves={}
for layer in paperobj.data.shape_keys.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:shape_curves[fc.data_path]=fc


def sheet_surface_height(local_y,t):
    """Exact upper mesh height, including Blender's animated shape-key weights."""
    row=max(0,min(ny-1,int((local_y+1.675)*ny/3.35)))
    ya=-1.675+row*3.35/ny
    fraction=(local_y-ya)/(3.35/ny)
    height=0
    for idx,(_,center_y) in enumerate(feed):
        weight=shape_curves[f'key_blocks["Paper bend {idx}"].value'].evaluate(t*FPS+1)
        a=paper_height(ya+center_y);b=paper_height(ya+3.35/ny+center_y)
        height+=weight*(a+(b-a)*fraction)
    return height

# Visible deposited strokes: each is drawn as a real curve with a moving light tip.
strokeink=mat('Freshly deposited ink',(.001,.002,.0015),.48)
glow=mat('Printing focal light',(.55,.78,.85),.24)
gb=glow.node_tree.nodes.get('Principled BSDF');gb.inputs['Emission Color'].default_value=(.42,.77,1,1);gb.inputs['Emission Strength'].default_value=7
beam_mat=mat('Faint printing beam',(.12,.32,.40),.25)
bb=beam_mat.node_tree.nodes.get('Principled BSDF');bb.inputs['Emission Color'].default_value=(.12,.32,.4,1);bb.inputs['Emission Strength'].default_value=.7
# Three fragmentary symbols, their stroke order is also the carriage motion.
glyphs=[[[(-.19,.33),(-.155,.51),(-.12,.33)],[(-.177,.40),(-.133,.40)]],
        [[(-.06,.33),(-.06,.51),(.004,.51),(.015,.47),(-.06,.43)], [(-.025,.43),(.025,.33)]],
        [[(.08,.51),(.15,.51),(.15,.46),(.11,.42),(.11,.385)], [(.11,.347),(.11,.335)]],
        [[(.18,.44),(.04,.56),(.19,.50),(.09,.35)],[(.10,.35),(.20,.34)]]]
tip=sphere('Moving print focal point',(0,0,.565),(.003,.003,.0015),glow)
tiplight=bpy.data.lights.new('Print point illumination','POINT');tiplight.energy=.045;tiplight.color=(.45,.76,1);tiplight.shadow_soft_size=.018
lightobj=bpy.data.objects.new('Print point illumination',tiplight);scene.collection.objects.link(lightobj)
beam=curve('Fine light between nozzle and paper',[(0,0,.82),(0,0,.566)],.00055,beam_mat,poly=True)
key(tip,'scale',0,(0,0,0));key(tip,'scale',35.45,(0,0,0));key(tip,'scale',35.5,(1,1,1))
key(beam.data,'bevel_depth',0,0);key(beam.data,'bevel_depth',35.45,0);key(beam.data,'bevel_depth',35.5,.00055)
tiplight.energy=0;tiplight.keyframe_insert(data_path='energy',frame=1)
time=35.5
carriage_keys=[(0,1.2),(20.1,1.2),(22,1.2),(24,-1.45),(26,1.45),(28,-1.45),(30,1.45),(33,-.19),(35.5,-.19)]
for glyph in glyphs:
    for points in glyph:
        duration=2.1 if len(points)>2 else 1.0
        o=curve('Printed wet glyph stroke',[(x,y+.10,.56045) for x,y in points],.0008,strokeink,paperobj,True)
        o.data.bevel_factor_mapping_end='SPLINE'
        # Local paper y includes its -.10 translation during the macro shot.
        key(o.data,'bevel_factor_end',0,0);key(o.data,'bevel_factor_end',time,0);key(o.data,'bevel_factor_end',time+duration,1)
        lengths=[0]
        for a,b in zip(points,points[1:]):lengths.append(lengths[-1]+(Vector(b)-Vector(a)).length)
        for (x,y),length in zip(points,lengths):
            tm=time+duration*length/lengths[-1]
            key(o.data,'bevel_factor_end',tm,length/lengths[-1])
            key(tip,'location',tm,(x,y,.565))
            key(lightobj,'location',tm,(x,y,.58))
            for idx,z in enumerate([.82,.566]):
                q=beam.data.splines[0].points[idx];q.co=(x,y,z,1);q.keyframe_insert(data_path='co',frame=round(tm*FPS)+1)
            carriage_keys.append((tm,x))
        linear_anim(o.data)
        # Parent translation alone cannot follow a bending sheet. Bake the same
        # height profiles used by the paper's shape keys onto every ink point.
        for feed_frame in range(74*FPS+1,81*FPS+2):
            for point,(x,y) in zip(o.data.splines[0].points,points):
                point.co=(x,y+.10,sheet_surface_height(y+.10,(feed_frame-1)/FPS)+.00045,1)
                point.keyframe_insert(data_path='co',frame=feed_frame)
        # Keep the deposited film on the upper surface after the feed completes.
        for point,(x,y) in zip(o.data.splines[0].points,points):
            point.co=(x,y+.10,.56045,1);point.keyframe_insert(data_path='co',frame=1)
        linear_anim(o.data)
        for tm,v in [(time-.025,0),(time,1),(time+duration,1),(time+duration+.025,0)]:
            key(tip,'scale',tm,(v,v,v));key(beam.data,'bevel_depth',tm,.00055*v)
            tiplight.energy=.045*v;tiplight.keyframe_insert(data_path='energy',frame=round(tm*FPS)+1)
        time+=duration+.35
for t,x in [(51.2,.11),(51.5,.09),(51.8,.13),(52.1,.08),(52.4,.15),(53,.03),(53.4,-.04),(54,.12),(55,1.35),(57,-1.35),(59,1.35),(61,-1.35),(63,.55),(64,0),(90,0)]:carriage_keys.append((t,x))
for t,x in sorted(carriage_keys):key(carriage,'location',t,(x,0,0))
for o in [tip,beam.data,lightobj,tiplight]:linear_anim(o)

# Physical ink: stretched falling drops, impact squash, capillary bridges, one pool.
meta=bpy.data.metaballs.new('Coalescing ink surface');meta.resolution=.007;meta.render_resolution=.0018;meta.threshold=.62
inkobj=bpy.data.objects.new('Coalescing ink surface',meta);scene.collection.objects.link(inkobj);attach(inkobj,ink)
inkobj.parent=paperobj
if hasattr(inkobj.cycles,'use_motion_blur'):inkobj.cycles.use_motion_blur=False
drops=[(-.22,.29,66.7,.125),(.18,.35,68.35,.105),(-.12,.60,70.05,.092),(.23,.62,71.65,.11),(.00,.46,73.1,.09)]


def feed_y(t):
    for (ta,a),(tb,b) in zip(feed,feed[1:]):
        if ta<=t<=tb:
            u=(t-ta)/(tb-ta);u=u*u*(3-2*u)
            return a+(b-a)*u
    return feed[-1][1]


for i,(x,y,hit,r) in enumerate(drops):
    e=meta.elements.new();e.type='ELLIPSOID';e.size_x=1;e.size_y=1;e.size_z=1
    for t,rad,xx,yy,z,sz in [(0,.0001,x,y,.825,1),(hit-.7,.0001,x,y,.825,1),
                            (hit-.36,r*.60,x,y,.78,1.8),(hit-.09,r*.75,x,y,.65,1.35),
                            (hit,r,x,y,.579,.55),(hit+.11,r*1.18,x,y,.571,.30),
                            (hit+.35,r*1.04,x,y,.582,.48),(74,r,x,y,.583,.45)]:
        e.radius=rad;e.co=(xx,yy+.1,z);e.size_z=sz
        for prop in ['radius','co','size_z']:e.keyframe_insert(data_path=prop,frame=round(t*FPS)+1)
    # Follow the fed sheet with a restrained small movement towards the common center.
    for t in [74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90]:
        u=max(0,min(1,(t-81)/7));u=u*u*(3-2*u)
        xx=x*(1-u);local_y=(y+.1)*(1-u)+.55*u
        yy=local_y+feed_y(t)
        e.co=(xx,local_y,paper_height(yy)+.023)
        e.radius=r*(1+.11*math.sin(u*math.pi))
        e.size_x=1+.10*math.sin(u*math.pi);e.size_y=1+.08*math.sin(u*math.pi);e.size_z=.43
        for prop in ['co','radius','size_x','size_y','size_z']:e.keyframe_insert(data_path=prop,frame=round(t*FPS)+1)
    for feed_frame in range(74*FPS+1,81*FPS+2):
        t=(feed_frame-1)/FPS
        e.co=(x,y+.10,sheet_surface_height(y+.10,t)+.023)
        e.keyframe_insert(data_path='co',frame=feed_frame)

# More controlled lighting: soft daylight outside, grazing strips inside the paper path.
for name,energy in [('Large soft key',520),('Cool window rim',650),('Camera-side fill',85),('Desk lamp',300),('Internal service light',42),('Paper path fill',12)]:
    bpy.data.objects[name].data.energy=energy
area('Nozzle grazing softbox',(-.6,-.27,1.28),(0,.43,.63),16,(.85,.92,1),.8,.08)
area('Mechanism amber bounce',(1.6,.6,1.4),(0,.2,.85),14,(1,.68,.33),.6,.16)
area('Output paper skylight',(-1.5,-2.7,3),(0,-2.8,.25),60,(.78,.85,1),2.2)

# Cinematography uses slow dollies and matched cuts, with meaningful focus targets.
def camera(name,start,poses,fstop=5.6):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);scene.collection.objects.link(o)
    focus=empty(name+' focus');d.clip_start=.007;d.clip_end=100;d.dof.use_dof=True;d.dof.focus_object=focus;d.dof.aperture_fstop=fstop
    tr=o.constraints.new('TRACK_TO');tr.track_axis='TRACK_NEGATIVE_Z';tr.up_axis='UP_Y';tr.target=focus
    for t,loc,target,lens in poses:
        key(o,'location',t,loc);key(focus,'location',t,target)
        d.lens=lens;d.keyframe_insert(data_path='lens',frame=round(t*FPS)+1)
    marker=scene.timeline_markers.new(name,frame=round(start*FPS)+1);marker.camera=o
    smooth_anim(o);smooth_anim(focus);smooth_anim(d)
    return o


wide=camera('01 Paper and hand',0,[(0,(7.8,-11.8,7.2),(0,.2,2.45),45),(5,(7.2,-11.3,7.0),(0,.3,2.85),45),(12.8,(6.3,-10.4,6.5),(.1,.35,2.75),47)],7.1)
camera('02 Start button',13,[(13,(.35,-3.5,3.35),(2.04,-.88,2.02),90),(21.8,(.55,-3.25,3.20),(2.04,-.88,2.02),90)],2.8)
camera('03 Into paper path',22,[(22,(.25,-3.4,1.04),(0,.52,.99),36),(25,(.20,-1.72,1.03),(0,.45,.99),36),(29,(.12,-1.12,1.12),(0,.42,1.0),38),(34.8,(.10,-.45,1.18),(0,.43,.97),42)],8)
camera('04 Macro printing',35,[(35,(.19,-.34,.675),(0,.43,.80),58),(38.5,(.16,-.32,.69),(-.04,.43,.79),59),(42,(.24,-.43,.85),(-.02,.43,.66),60),(46,(.20,-.40,.84),(.01,.43,.66),61),(54.9,(.14,-.35,.82),(.035,.43,.65),62)],11)
camera('05 Mechanism failure',55,[(55,(.38,-1.04,1.24),(0,.40,.82),43),(60,(.27,-.96,1.22),(0,.30,.76),44),(65.9,(.18,-.88,1.15),(0,.35,.70),47)],8)
camera('06 Falling ink',66,[(66,(.29,-.53,.92),(0,.45,.66),57),(73.9,(.24,-.45,.88),(0,.46,.64),59)],10)
camera('07 Corrupted sheet emerges',74,[(74,(3.4,-6.5,4.2),(0,-1.6,.55),48),(78,(3.0,-6.8,4.5),(0,-2.1,.43),48),(81.9,(2.6,-7.0,4.7),(0,-2.8,.34),49)],8)
camera('08 Ink becomes one',82,[(82,(.60,-3.75,1.08),(0,-2.77,.27),62),(86,(.46,-3.65,.94),(0,-2.75,.275),65),(90,(.35,-3.58,.87),(0,-2.75,.28),68)],8)
scene.camera=wide

# Status light remains physically on the button and starts only after the press.
bs=bpy.data.materials['Status light'].node_tree.nodes.get('Principled BSDF')
bs.inputs['Emission Strength'].id_data.animation_data_clear()
for t,v in [(0,0),(19,0),(19.25,1),(49,1),(51,.1),(51.3,1),(52,.1),(52.3,1),(54,.1),(55,1),(66,.2),(90,.2)]:value_key(bs.inputs['Emission Strength'],t,v)
for o in [loading,pressing,sheet,carriage,paperobj]:smooth_anim(o)
# Every emissive surface has a matching practical light. Avoid sampling hundreds
# of tiny LED triangles as independent lights while retaining their visible glow.
for m in bpy.data.materials:
    if hasattr(m.cycles,'emission_sampling'):m.cycles.emission_sampling='NONE'
scene.frame_set(1)
frames=BUILD/'frames';frames.mkdir(exist_ok=True)
scene.render.filepath=str(frames/'frame_')
scene['opening_duration_seconds']=90
scene['visual_sources']='Manually built meshes, curves, shader nodes and Pillow print plates; no generated images.'
scene['ending']='Ink droplets merge into one pool. No eyes or titles.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'exports'/'opening-90s.blend'))
print(f'BUILT {len(scene.objects)} objects. Native 1920x1080 / 24fps / 90 seconds.',flush=True)
if '--preview' in sys.argv:
    scene.render.resolution_percentage=65;scene.cycles.samples=32
    for t in [10.5,19.1,29,42,60,70.2,80.5,88.5]:
        scene.frame_set(round(t*FPS)+1);scene.render.filepath=str(BUILD/f'preview-{t:04.1f}.png')
        bpy.ops.render.render(write_still=True)
elif '--render' in sys.argv:
    bpy.ops.render.render(animation=True)
