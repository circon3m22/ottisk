from pathlib import Path
import json
import math
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BUILD = Path(__file__).resolve().parent.parent / ".work"
BUILD.mkdir(exist_ok=True)
sys.path.insert(0, str(BUILD / "teaser-deps"))
import imageio_ffmpeg

OUTPUT = BUILD.parent / "exports"
VIDEO = OUTPUT / "teaser-10s.mp4"
FPS, SECONDS = 30, 10
W, H = 960, 540
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
X = (X-W/2)/H
Y = (Y-H/2)/H
RNG = np.random.default_rng(20261124)
GRAIN = RNG.normal(0, .65, (H, W)).astype(np.float32)
PAPER = np.array([234, 232, 220], dtype=np.float32)


def ease(a, b, t):
    u = np.clip((t-a)/(b-a), 0, 1)
    return u*u*(3-2*u)


RADII = np.array([.105, .086, .063, .071, .049, .040], dtype=np.float32)
MASS = RADII*RADII
WAKE = np.array([0, 1.2, 3.0, 1.8, .7, 0],dtype=np.float32)
INITIAL = np.array([[-.24, .04], [.17, -.12], [.34, .10],
                    [-.02, .23], [-.10, -.23], [-.42, -.08]], dtype=np.float32)
INITIAL -= (INITIAL*MASS[:,None]).sum(axis=0)/MASS.sum()
AREA = float(math.pi*MASS.sum())
STATES = []
MERGES = []


def simulate():
    position = INITIAL.copy()
    velocity = np.zeros_like(position)
    groups = list(range(len(RADII)))
    dt = 1/120
    for i in range(841):
        t = i*dt
        STATES.append((position.copy(), velocity.copy()))
        # Viscous damping and increasing capillary attraction gather the
        # lobes. Retained velocity produces a small overshoot at coalescence.
        stiffness = .025 + 1.45*ease(WAKE+.3, WAKE+1.7, t)
        acceleration = -stiffness[:,None]*position - 1.95*velocity
        for a in range(len(RADII)):
            for b in range(a+1,len(RADII)):
                delta = position[b]-position[a]
                distance = float(np.linalg.norm(delta))
                contact = float(RADII[a]+RADII[b])
                if distance < contact*1.22 and groups[a] != groups[b]:
                    old, new = groups[b], groups[a]
                    groups = [new if g==old else g for g in groups]
                    MERGES.append((t, float((position[a,0]+position[b,0])/2)))
                if distance > .00001:
                    proximity = max(0, 1-distance/(contact+.10))
                    force = delta*3.2*proximity
                    share = MASS[b]/(MASS[a]+MASS[b])
                    acceleration[a] += force*share
                    acceleration[b] -= force*(1-share)
        velocity += acceleration*dt
        position += velocity*dt


simulate()


def state(t):
    index = min(len(STATES)-1, max(0, round(t*120)))
    return STATES[index]


def field(t, zoom=1):
    position, velocity = state(t)
    xx, yy = X/zoom, Y/zoom
    density = np.zeros((H,W), dtype=np.float32)
    gx, gy = np.zeros_like(density), np.zeros_like(density)
    for p,v,r in zip(position, velocity, RADII):
        speed = float(np.linalg.norm(v))
        angle = math.atan2(float(v[1]),float(v[0]))
        c, s = math.cos(angle), math.sin(angle)
        stretch = 1+min(.34,speed*1.4)
        dx,dy = xx-p[0], yy-p[1]
        along = (dx*c+dy*s)/stretch
        across = (-dx*s+dy*c)*stretch
        kernel = np.exp(-2*(along*along+across*across)/(r*r))
        density += kernel
        gx += kernel*(-4/(r*r))*(along*c/stretch-across*s*stretch)
        gy += kernel*(-4/(r*r))*(along*s/stretch+across*c*stretch)
    return density,gx,gy


def threshold(density):
    # Keep the visible area constant as separate surfaces develop necks.
    count = min(density.size-1,round(AREA*H*H))
    return max(.000001,float(np.partition(density.ravel(),density.size-count)[density.size-count]))


FINAL_THRESHOLD = threshold(field(6.4)[0])


def frame(t):
    if t < 7.3:
        zoom = math.exp(math.log(9)*float(ease(6.25,7.25,t)))
        density,gx,gy = field(min(t,6.4),zoom)
        level = threshold(density) if t<6.25 else FINAL_THRESHOLD
        alpha = ease(level*.98,level*1.02,density)
        light = 1-.10*((X+.1)**2+(Y+.1)**2)
        base = PAPER[None,None,:]*light[:,:,None]+GRAIN[:,:,None]
        # A soft contact shadow follows the actual merged contour.
        shadow = Image.fromarray(np.uint8(alpha*90)).filter(ImageFilter.GaussianBlur(3.4))
        shadow = np.asarray(shadow,dtype=np.float32)/255
        shadow = np.roll(shadow,4,axis=0)
        base *= (1-shadow[:,:,None])

        interior = np.maximum(np.log(np.maximum(density,.00000001)/level),.0001)
        factor = .009/(np.maximum(density,.000001)*np.sqrt(interior))
        nx,ny = -gx*factor,-gy*factor
        normal = np.sqrt(nx*nx+ny*ny+1)
        nx,ny,nz = nx/normal,ny/normal,1/normal
        # One broad softbox reflection across a black liquid surface.
        half_vector = np.array([-.22,-.32,.921],dtype=np.float32)
        spec = np.maximum(0,nx*half_vector[0]+ny*half_vector[1]+nz*half_vector[2])
        shine = spec**42*40 + spec**115*18
        ink = np.array([5,9,7],dtype=np.float32)[None,None,:]+shine[:,:,None]*np.array([.85,1,.9])
        pixels = base*(1-alpha[:,:,None])+ink*alpha[:,:,None]
        fade = float(ease(6.93,7.30,t))
        pixels *= 1-fade
    else:
        pixels = np.zeros((H,W,3),dtype=np.float32)
    if t>=7.6:
        for start,x in [(7.65,-.042),(8.28,.042)]:
            opening = float(ease(start,start+.19,t))
            if opening<=0:
                continue
            # The eye opens into a circle; the second follows after a pause.
            radius=.026
            distance=np.sqrt(((X-x)/radius)**2+((Y+.012)/(radius*max(.02,opening)))**2)
            mask=(1-ease(.96,1.04,distance))*opening
            pixels=pixels*(1-mask[:,:,None])+np.array([250,250,243])*mask[:,:,None]
    image=Image.fromarray(np.uint8(np.clip(pixels,0,255)))
    return image.resize((1920,1080),Image.Resampling.LANCZOS)


def audio():
    rate=48000
    time=np.arange(SECONDS*rate,dtype=np.float64)/rate
    noise=RNG.normal(0,1,time.size)
    soft=np.convolve(noise,np.ones(70)/70,mode="same")
    sound=soft*.035*ease(.3,1.2,time)*(1-ease(5.9,6.5,time))
    stereo_offset=np.zeros_like(sound)

    def plop(start,pitch,volume,pan=0,duration=.22):
        nonlocal sound,stereo_offset
        u=np.clip(time-start,0,duration)
        phase=2*np.pi*(pitch*u-.27*pitch*u*u/duration)
        env=np.sin(math.pi*u/duration)**2*((time>=start)&(time<start+duration))
        pulse=volume*env*(np.sin(phase)+.12*np.sin(phase*2.1))
        sound+=pulse
        stereo_offset+=pulse*pan*.3

    for i,(t,x) in enumerate(MERGES):
        plop(t,.8*(320-i*27),.10+i*.008,float(np.clip(x*2,-1,1)))
    sound+=.07*soft*np.sin(math.pi*ease(1,6.3,time))**2
    plop(6.5,95,.06,duration=.55)
    plop(7.65,365,.035,-.2,duration=.09)
    plop(8.28,410,.035,.2,duration=.09)
    sound*=1-ease(8.9,9.5,time)
    stereo=np.stack((sound-stereo_offset,sound+stereo_offset),axis=1)
    peak=float(np.max(np.abs(stereo)))
    stereo*=.38/max(.001,peak)
    path=BUILD/"teaser10-sound.wav"
    with wave.open(str(path),"wb") as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate)
        wav.writeframes((stereo*32767).astype("<i2").tobytes())
    return path


def review():
    times=[.2,1.3,2.1,3,4,5.2,6.3,6.8,7.4,7.98,8.65,9.8]
    sheet=Image.new("RGB",(1600,756))
    for i,t in enumerate(times):
        x,y=(i%4)*400,(i//4)*252
        sheet.paste(frame(t).resize((400,225),Image.Resampling.LANCZOS),(x,y))
        ImageDraw.Draw(sheet).text((x+8,y+231),f"{t:.2f} s",fill="white")
    sheet.save(BUILD/"teaser10-review.jpg")
    print(json.dumps({"merges":MERGES,"final_threshold":FINAL_THRESHOLD}),flush=True)


def main():
    if "--review" in sys.argv:
        review();return
    OUTPUT.mkdir(exist_ok=True)
    encoder=imageio_ffmpeg.get_ffmpeg_exe()
    args=[encoder,"-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24",
          "-s","1920x1080","-r",str(FPS),"-i","-","-i",str(audio()),"-c:v","libx264",
          "-preset","fast","-crf","18","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",
          "-t",str(SECONDS),"-movflags","+faststart",str(VIDEO)]
    with (BUILD/"encoder10.log").open("w",encoding="utf8") as log:
        process=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=log,
                                 creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
        for i in range(FPS*SECONDS):
            process.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f"Rendered {i}/{FPS*SECONDS}",flush=True)
        process.stdin.close()
        if process.wait()!=0:raise RuntimeError("Encoding failed")
    print(json.dumps({"file":str(VIDEO),"frames":FPS*SECONDS,"seconds":SECONDS,"bytes":VIDEO.stat().st_size}),flush=True)


if __name__=="__main__":
    main()
