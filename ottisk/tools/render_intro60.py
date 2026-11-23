"""Hand-built 60 second opening. All geometry, textures and audio are procedural."""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
import json
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / ".work"
BUILD.mkdir(exist_ok=True)
sys.path.insert(0, str(BUILD / "teaser-deps"))
import imageio_ffmpeg

W, H, FPS, DURATION = 960, 540, 30, 60
OUTPUT = ROOT / "exports" / "opening-60s.mp4"
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
RNG = np.random.default_rng(716)
YSCREEN = YY/H
XSCREEN = XX/W
FACES = []
PAGE = NORMAL = ERROR = SMEAR = None


def ease(a, b, t):
    u = np.clip((t-a)/(b-a), 0, 1)
    return u*u*(3-2*u)


def mix(a, b, t):
    return np.asarray(a)*(1-t)+np.asarray(b)*t


def polygon(points, color):
    FACES.append((np.asarray(points,dtype=np.float32),color))


def box(center, size, color):
    x,y,z=center
    a,b,c=np.asarray(size)/2
    v=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
       (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
    for indices in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
        polygon([v[i] for i in indices],color)


def tube(start, end, radius, color, sides=8):
    start,end=np.asarray(start),np.asarray(end)
    axis=end-start
    axis=axis/max(.00001,np.linalg.norm(axis))
    u=np.cross(axis,[0,1,0])
    if np.linalg.norm(u)<.01:u=np.cross(axis,[1,0,0])
    u=u/np.linalg.norm(u)
    v=np.cross(axis,u)
    rings=[]
    for origin in [start,end]:
        rings.append([origin+radius*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides)) for i in range(sides)])
    for i in range(sides):
        j=(i+1)%sides
        polygon([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],color)
    polygon(rings[0][::-1],color)
    polygon(rings[1],color)


def ellipsoid(center, radius, color):
    center=np.asarray(center)
    rx,ry,rz=radius
    rings=[]
    for j in range(1,5):
        theta=math.pi*j/5
        rings.append([center+np.array([rx*math.sin(theta)*math.cos(i*math.tau/8),
                                      ry*math.cos(theta),rz*math.sin(theta)*math.sin(i*math.tau/8)])
                      for i in range(8)])
    top,bottom=center+[0,ry,0],center-[0,ry,0]
    for i in range(8):
        k=(i+1)%8
        polygon([top,rings[0][i],rings[0][k]],color)
        polygon([bottom,rings[-1][k],rings[-1][i]],color)
        for j in range(len(rings)-1):
            polygon([rings[j][i],rings[j+1][i],rings[j+1][k],rings[j][k]],color)


def capsule(start,end,radius,color):
    tube(start,end,radius,color,7)
    ellipsoid(end,(radius,radius,radius),color)


def hand(anchor, pressing=False):
    anchor=np.asarray(anchor)
    skin=(171,137,111)
    palm=anchor+[.47,-.13,.05]
    box(palm,(.64,.25,.50),skin)
    ellipsoid(palm,(.39,.17,.28),skin)
    tube(palm+[.18,-.01,.06],palm+[1.1,-.15,.28],.19,(65,75,62),9)
    tube(palm+[1.1,-.15,.28],palm+[2.1,-.11,.5],.24,(57,67,55),9)
    if pressing:
        finger=[anchor+[.35,.01,-.12],anchor+[.10,-.13,-.17],anchor+[0,-.33,-.17]]
    else:
        finger=[anchor+[.32,.02,-.15],anchor+[.09,.15,-.17],anchor+[-.035,.045,-.18]]
    capsule(finger[0],finger[1],.087,skin)
    capsule(finger[1],finger[2],.073,skin)
    capsule(anchor+[.45,-.18,.14],anchor+[.14,-.24,.04],.105,skin)
    capsule(anchor+[.14,-.24,.04],anchor+[-.035,-.10,.015],.085,skin)
    for i in range(3):
        x=.38+i*.13
        a=anchor+[x,-.05,-.20]
        b=anchor+[x-.07,-.24,-.29]
        c=anchor+[x-.16,-.29,-.12]
        capsule(a,b,.075-i*.006,skin)
        capsule(b,c,.067-i*.006,skin)


def printer(t):
    shell=(66,72,62)
    edge=(80,87,73)
    black=(22,28,24)
    # Hollow shell and real front aperture allow the camera to enter.
    box((0,.20,0),(5.6,.28,3.2),shell)
    box((-2.68,1.12,0),(.25,1.85,3.2),shell)
    box((2.68,1.12,0),(.25,1.85,3.2),shell)
    box((0,1.1,1.47),(5.2,1.8,.23),shell)
    box((0,1.64,-1.51),(5.15,.66,.21),edge)
    box((0,.40,-1.51),(5.15,.20,.21),shell)
    box((-2.28,.88,-1.51),(.63,.78,.21),edge)
    box((2.28,.88,-1.51),(.63,.78,.21),edge)
    box((0,2.01,-.42),(5.3,.16,2.02),edge)
    box((-2.04,2.01,1.0),(1.25,.16,.9),shell)
    box((2.04,2.01,1.0),(1.25,.16,.9),shell)
    # Tray, paper guides, ribs and output lip.
    box((0,2.85,1.42),(2.88,1.6,.12),shell)
    for x in [-1.0,0,1.0]:box((x,2.83,1.335),(.035,1.4,.05),edge)
    for x in [-1.31,1.31]:box((x,2.19,1.10),(.16,.32,.36),edge)
    box((0,.23,-2.0),(3.9,.12,1.0),edge)
    for x in [-1.15,-.57,0,.57,1.15]:box((x,.30,-2.0),(.025,.025,.9),shell)
    # Interior feed floor and rotating rollers.
    box((0,.55,.0),(3.0,.08,2.7),(37,43,36))
    tube((-1.8,.77,-.76),(1.8,.77,-.76),.17,black,12)
    angle=t*5 if t>15 else 0
    for x in [-1.12,-.39,.39,1.12]:
        tube((x-.13,.77,-.76),(x+.13,.77,-.76),.195,(64,70,58),12)
        for i in range(3):
            a=angle+i*math.tau/3
            y=.77+.197*math.cos(a)
            z=-.76+.197*math.sin(a)
            tube((x-.13,y,z),(x+.13,y,z),.012,(113,115,94),5)
    # A paper plane below the moving ink carriage.
    if t>15:
        polygon([[-1.22,.61,-1.4],[1.22,.61,-1.4],[1.22,.61,1.3],[-1.22,.61,1.3]],(225,224,205))
        for i in range(min(9,max(0,int((t-16)*.7)))):
            z=-.55+i*.16
            for j in range(7):
                x=-.92+j*.27
                box((x,.615,z),(.15,.008,.027),(97,105,88))
    tube((-2.35,1.42,.62),(2.35,1.42,.62),.045,(155,156,130),10)
    moving=math.sin((t-15)*2.9)*1.55 if t>15 else 1.5
    if 20.7<t<24:moving=-.58+.065*math.sin(t*37)
    box((moving,1.19,.62),(.70,.55,.61),(31,39,33))
    box((moving,1.48,.62),(.79,.08,.66),(81,91,76))
    box((moving,.88,.62),(.45,.08,.43),(141,115,74))
    # The small plain control illuminates when pressed.
    tube((2.16,2.105,-1.02),(2.16,2.13,-1.02),.115,(138,145,114),12)
    if t>13.3:
        glow=(193,122,55) if t>20.7 and int(t*5)%2 else (159,190,115)
        box((2.16,2.144,-1.02),(.075,.02,.04),glow)


def camera(t):
    if t<18:
        q=float(ease(0,18,t))
        return mix([6.0,4.8,-9.0],[3.8,3.8,-7.8],q),np.array([0,1.95,0]),44
    if t<25:
        q=float(ease(18,25,t))
        return mix([3.8,3.8,-7.8],[0,.95,-1.94],q),mix([0,1.95,0],[0,.87,.8],q),44+15*q
    q=float(ease(25,28.5,t))
    return mix([0,.95,-1.94],[0,1.58,-.1],q),mix([0,.87,.8],[0,.60,.22],q),59+8*q


def clip_near(points):
    clipped=[]
    for i,p in enumerate(points):
        q=points[(i+1)%len(points)]
        pin,qin=p[2]>.055,q[2]>.055
        if pin:clipped.append(p)
        if pin!=qin:
            f=(.055-p[2])/(q[2]-p[2])
            clipped.append(p+(q-p)*f)
    return np.asarray(clipped)


def exterior(t):
    global FACES
    FACES=[]
    shade=1-.18*((XSCREEN-.37)**2+(YSCREEN-.4)**2)
    bg=np.array([58,65,54],dtype=np.float32)[None,None,:]*shade[:,:,None]
    bg+=RNG.normal(0,.22,(H,W,1)).astype(np.float32)
    image=Image.fromarray(np.uint8(np.clip(bg,0,255)))
    box((0,-.14,0),(18,.25,12),(148,135,108))
    # Lamp is also handmade geometry.
    tube((-4.4,0,.9),(-4.4,1.6,.9),.07,(54,60,49))
    tube((-4.4,1.6,.9),(-3.8,4.4,.8),.06,(69,75,61))
    tube((-3.8,4.4,.8),(-2.9,4.8,.3),.06,(69,75,61))
    tube((-2.9,4.8,.3),(-2.9,4.5,.3),.48,(70,76,62),12)
    tube((-2.9,4.49,.3),(-2.9,4.48,.3),.41,(245,217,145),12)
    printer(t)
    if 3.0<t<19.9:
        load=float(ease(4.2,8.7,t))
        feed=float(ease(15.1,20,t))
        bottom=3.5-1.31*load-3.1*feed
        top=bottom+3.06
        z=1.22
        # The part below the feed mouth disappears into the printer.
        low=max(2.10,bottom)
        if top>low:
            polygon([[-1.18,low,z],[1.18,low,z],[1.18,top,z+.15],[-1.18,top,z+.15]],(236,234,214))
        if t<11.1:
            exit=float(ease(9.0,11.1,t))
            anchor=np.array([1.18,top-.08,z-.07])+np.array([4.0,1.4,.0])*exit
            if t>3.0:
                anchor+=np.array([2.6,1.6,0])*(1-float(ease(3,4.2,t)))
                hand(anchor)
    if 11.5<t<15:
        reach=float(ease(11.5,12.7,t))*(1-float(ease(13.7,15,t)))
        anchor=mix([5.2,4.0,-.9],[2.16,2.43,-.85],reach)
        hand(anchor,True)
    pos,target,fov=camera(t)
    forward=target-pos;forward/=np.linalg.norm(forward)
    right=np.cross([0,1,0],forward);right/=np.linalg.norm(right)
    up=np.cross(forward,right)
    basis=np.stack([right,up,forward],axis=1)
    light=np.array([-.6,.8,-.7]);light/=np.linalg.norm(light)
    focal=H/(2*math.tan(math.radians(fov)/2))
    faces=[]
    for vertices,color in FACES:
        v=(vertices-pos)@basis
        if np.max(v[:,2])<.055:continue
        clipped=clip_near(v)
        if len(clipped)<3:continue
        pts=np.stack([W/2+clipped[:,0]*focal/clipped[:,2],H/2-clipped[:,1]*focal/clipped[:,2]],axis=1)
        if np.max(pts[:,0])<0 or np.min(pts[:,0])>W or np.max(pts[:,1])<0 or np.min(pts[:,1])>H:continue
        normal=np.cross(vertices[1]-vertices[0],vertices[2]-vertices[0])
        normal/=max(.000001,np.linalg.norm(normal))
        brightness=.37+.63*max(0,float(normal@light))
        interior=float(ease(22,27,t))
        brightness=brightness*(1-interior*.18)+interior*.14
        rgb=np.clip(np.asarray(color)*brightness+[6,5,2],0,255).astype(np.uint8)
        faces.append((float(np.mean(v[:,2])),[tuple(p) for p in pts],tuple(int(x) for x in rgb)))
    draw=ImageDraw.Draw(image)
    for depth,points,color in sorted(faces,key=lambda p:p[0],reverse=True):draw.polygon(points,fill=color)
    if t<1.7:
        image=Image.blend(Image.new("RGB",(W,H),(0,0,0)),image,float(ease(0,1.7,t)))
    return image


def prepare_paper():
    global PAGE,NORMAL,ERROR,SMEAR
    rng=np.random.default_rng(127)
    height,width=2400,1600
    fibres=rng.normal(0,1,(height,width)).astype(np.float32)
    texture=np.clip(np.array([234,232,218])[None,None,:]+fibres[:,:,None]*1.15,0,255).astype(np.uint8)
    PAGE=Image.fromarray(texture)
    NORMAL=Image.new("RGBA",(width,height))
    ERROR=Image.new("RGBA",(width,height))
    SMEAR=Image.new("RGBA",(width,height))
    normal=ImageDraw.Draw(NORMAL)
    error=ImageDraw.Draw(ERROR)
    smear=ImageDraw.Draw(SMEAR)
    fontpath="C:/Windows/Fonts/consola.ttf"
    for row in range(12):
        y=240+row*103
        for col in range(14):
            x=135+col*90
            if row<5:
                normal.rectangle((x,y,x+int(rng.integers(29,66)),y+3),fill=(59,66,53,220))
                normal.rectangle((x,y+13,x+int(rng.integers(21,59)),y+15),fill=(59,66,53,150))
            if row>=3:
                text=str(rng.choice(list("01:;<>#@$%&?{}[]+*=ЖЯФЫЮ")))
                size=int(rng.integers(28,58))
                font=ImageFont.truetype(fontpath,size)
                dx,dy=int(rng.integers(-9,10)),int(rng.integers(-10,12))
                error.text((x+dx+3,y+dy-2),text,font=font,fill=(72,120,116,100))
                error.text((x+dx-3,y+dy+1),text,font=font,fill=(139,69,91,95))
                error.text((x+dx,y+dy),text,font=font,fill=(21,28,21,238))
                if rng.random()<.40:error.text((x+dx+8,y+dy+9),text,font=font,fill=(24,29,22,100))
    for i in range(35):
        x=int(rng.integers(150,1400));y=int(rng.integers(720,1550))
        points=[]
        for j in range(38):
            points.append((x+math.sin(j*.4+i)*float(rng.uniform(1,7)),y+j*float(rng.uniform(1.3,3.6))))
        smear.line(points,fill=(16,25,18,int(rng.integers(45,165))),width=int(rng.integers(2,16)))
    for i in range(16):
        x=int(rng.integers(140,1460));y=int(rng.integers(900,1600));r=int(rng.integers(9,39))
        for j in range(5):
            a=j*math.tau/5+i
            dx,dy=math.cos(a)*r*.4,math.sin(a)*r*.3
            smear.ellipse((x+dx-r*.6,y+dy-r*.5,x+dx+r*.6,y+dy+r*.5),fill=(17,25,18,120))
    SMEAR=SMEAR.filter(ImageFilter.GaussianBlur(1))


def overhead(t):
    if PAGE is None:prepare_paper()
    progress=t-28
    width=1320-220*float(ease(29,51,t))
    height=width*H/W
    cy=490+1250*float(ease(28,53,t))
    cx=800+40*math.sin(progress*.12)*(1-float(ease(50,56,t)))
    region=(round(cx-width/2),round(cy-height/2),round(cx+width/2),round(cy+height/2))
    image=PAGE.crop(region).resize((W,H),Image.Resampling.BILINEAR).convert("RGBA")
    world_y=region[1]+YSCREEN*height
    normal_scan=240+max(0,t-28)*59
    error_scan=550+max(0,t-34)*83
    for source,scan,alpha in [(NORMAL,normal_scan,1),(ERROR,error_scan,float(ease(33.5,35,t))),
                              (SMEAR,error_scan-180,float(ease(39,44,t)))]:
        layer=source.crop(region).resize((W,H),Image.Resampling.BILINEAR)
        channel=np.asarray(layer.getchannel("A"),dtype=np.float32)
        reveal=1-ease(scan-4,scan+4,world_y)
        layer.putalpha(Image.fromarray(np.uint8(channel*reveal*alpha)))
        image=Image.alpha_composite(image,layer)
    draw=ImageDraw.Draw(image)
    # A moving carriage casts a soft shadow, then exits as the camera settles.
    if t<49:
        phase=(t-28)*1.1
        x=(.5+.62*math.sin(phase))*W
        y=(error_scan-region[1])*H/height-76
        if -180<y<H+80:
            shadow=Image.new("RGBA",(W,H))
            sd=ImageDraw.Draw(shadow)
            sd.rounded_rectangle((x-113,y-53,x+119,y+67),radius=15,fill=(21,27,18,105))
            shadow=shadow.filter(ImageFilter.GaussianBlur(9))
            image=Image.alpha_composite(image,shadow)
            draw=ImageDraw.Draw(image)
            draw.rounded_rectangle((x-105,y-75,x+105,y+35),radius=9,fill=(46,58,43))
            draw.rectangle((x-88,y+25,x+88,y+39),fill=(153,127,82))
            draw.line((x-91,y-66,x+91,y-66),fill=(107,120,88),width=3)
            for k in range(7):draw.line((x-65+k*22,y-50,x-65+k*22,y+10),fill=(29,40,28),width=4)
    # The last drops fall onto fresh paper, just before the creature is born.
    drops=[(755,1700,51.1,19),(865,1760,52.8,14),(700,1820,54.3,12),
           (873,1850,55.5,16),(800,1820,57.2,10)]
    for i,(x,y,start,r) in enumerate(drops):
        if t<start:continue
        landing=float(ease(start,start+.65,t))
        gather=float(ease(57.3,61,t))
        x=x+(800-x)*gather*.62
        y=y+(1785-y)*gather*.62
        sx=(x-region[0])*W/width
        sy=(y-region[1])*H/height
        rr=r*W/width
        fall=(1-landing)*100
        wobble=math.sin(max(0,t-start-.65)*17)*math.exp(-max(0,t-start-.65)*3)*.16
        draw.ellipse((sx-rr*1.15,sy-rr*.55,sx+rr*1.15,sy+rr*.55),fill=(50,55,43,40))
        draw.ellipse((sx-rr*(1+wobble),sy-fall-rr/(1+wobble),sx+rr*(1+wobble),sy-fall+rr/(1+wobble)),fill=(10,19,12))
        draw.ellipse((sx-rr*.42,sy-fall-rr*.53,sx-rr*.02,sy-fall-rr*.38),fill=(115,130,100))
    image=image.convert("RGB")
    # Residual mechanical vibration belongs to the printer, not the camera.
    if 35<t<47:
        offset=int(math.sin(t*33)*1.2)
        image=Image.fromarray(np.roll(np.asarray(image),offset,axis=1))
    return image


def frame(index):
    t=index/FPS
    if t<28:image=exterior(t)
    elif t<29:
        image=Image.blend(exterior(t),overhead(t),float(ease(28,29,t)))
    else:image=overhead(t)
    if t>59.45:image=Image.blend(image,Image.new("RGB",(W,H)),float(ease(59.45,60,t)))
    return image.tobytes()


def soundtrack():
    rate=48000
    time=np.arange(rate*DURATION,dtype=np.float64)/rate
    rng=np.random.default_rng(440)
    noise=rng.normal(0,1,time.size)
    soft=np.convolve(noise,np.ones(91)/91,mode="same")
    scratch=np.convolve(noise,np.ones(9)/9,mode="same")
    sound=soft*.025*(1-ease(58.8,60,time))
    stereo=np.zeros_like(sound)

    def rustle(start,length,gain,pan=0):
        nonlocal sound,stereo
        u=np.clip((time-start)/length,0,1)
        env=np.sin(math.pi*u)**2
        event=(soft+scratch*.19)*env*gain
        sound+=event;stereo+=event*pan*.25

    def tone(start,length,pitch,end,gain):
        nonlocal sound
        u=np.clip(time-start,0,length)
        phase=math.tau*(pitch*u+(end-pitch)*u*u/(2*length))
        env=np.sin(math.pi*u/length)**2*((time>=start)&(time<start+length))
        sound+=gain*env*(np.sin(phase)+.18*np.sin(phase*2.1))

    rustle(4.1,4.7,.45,.35);rustle(8.8,1.6,.27,.4)
    tone(13.15,.09,650,190,.10)
    motor=ease(15,15.6,time)*(1-ease(26.5,28.5,time))
    sound+=motor*(.031*np.sin(math.tau*96*time)+.012*np.sin(math.tau*192*time)+soft*.14)
    for start in np.arange(15.4,20.6,1.05):rustle(start,.69,.38,-.3 if int(start)%2 else .3)
    for start in [20.8,21.15,21.5,22.2,23.1]:
        tone(start,.09,260,110,.12)
    rustle(22,7,.32)
    for start in np.arange(28.6,47.5,1.15):
        rustle(start,.72,.32,math.sin(start))
        if start>35:tone(start+.76,.075,235,119,.055)
    rustle(40,7,.22)
    for i,start in enumerate([51.75,53.45,54.95,56.15,57.85]):
        tone(start,.18,380-i*31,165-i*15,.115)
    rustle(57.8,1.5,.14)
    sound*=ease(0,1,time)*(1-ease(59.3,60,time))
    audio=np.stack((sound-stereo,sound+stereo),axis=1)
    audio*=.45/max(.001,float(np.max(np.abs(audio))))
    path=BUILD/"opening-sound.wav"
    with wave.open(str(path),"wb") as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate)
        wav.writeframes((audio*32767).astype("<i2").tobytes())
    return path


def review():
    indices=[round(t*FPS) for t in [2.5,6,8.5,12.8,17,21,24,26.5,29.5,35,41,46,51.9,55,58.6,59.3]]
    sheet=Image.new("RGB",(1600,1000))
    for i,index in enumerate(indices):
        image=Image.frombytes("RGB",(W,H),frame(index)).resize((400,225),Image.Resampling.LANCZOS)
        x,y=i%4*400,i//4*250
        sheet.paste(image,(x,y));ImageDraw.Draw(sheet).text((x+8,y+230),f"{index/FPS:.1f} s",fill="white")
    sheet.save(BUILD/"opening-review.jpg")


def main():
    if "--assets" in sys.argv:
        prepare_paper()
        PAGE.save(BUILD/"paper-base.png")
        NORMAL.save(BUILD/"paper-normal.png")
        ERROR.save(BUILD/"paper-error.png")
        SMEAR.save(BUILD/"paper-smear.png")
        soundtrack()
        print("Hand-drawn print textures and soundtrack prepared",flush=True)
        return
    if "--review" in sys.argv:review();return
    OUTPUT.parent.mkdir(exist_ok=True)
    encoder=imageio_ffmpeg.get_ffmpeg_exe()
    command=[encoder,"-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24",
             "-s",f"{W}x{H}","-r",str(FPS),"-i","-","-i",str(soundtrack()),
             "-vf","scale=1920:1080:flags=lanczos","-c:v","libx264","-threads","2","-preset","fast","-crf","19",
             "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-t",str(DURATION),"-movflags","+faststart",str(OUTPUT)]
    with (BUILD/"opening-encoder.log").open("w",encoding="utf8") as log:
        encoder_process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log,
                                         creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
        with ProcessPoolExecutor(max_workers=4) as pool:
            for start in range(0,FPS*DURATION,16):
                for raw in pool.map(frame,range(start,min(start+16,FPS*DURATION))):
                    encoder_process.stdin.write(raw)
                if start%160==0:print(f"Rendered {start}/{FPS*DURATION}",flush=True)
        encoder_process.stdin.close()
        if encoder_process.wait()!=0:raise RuntimeError("Encoding failed")
    print(json.dumps({"file":str(OUTPUT),"frames":FPS*DURATION,"seconds":DURATION,"bytes":OUTPUT.stat().st_size}),flush=True)


if __name__=="__main__":
    main()
