from pathlib import Path
import json
import math
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw

BUILD = Path(__file__).resolve().parent.parent / ".work"
BUILD.mkdir(exist_ok=True)
sys.path.insert(0, str(BUILD / "teaser-deps"))
import imageio_ffmpeg

OUTPUT = BUILD.parent / "exports"
OUTPUT.mkdir(exist_ok=True)
VIDEO = OUTPUT / "teaser-15s.mp4"
FPS, DURATION = 30, 15
W, H = 960, 540
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
X /= W
Y /= H
RATIO = H/W
RNG = np.random.default_rng(1827)
GRAIN = RNG.normal(0, 1, (H, W)).astype(np.float32)
FIBRES = sum(np.roll(GRAIN, k, axis=1) for k in range(9))/9
PAPER = np.array([231, 229, 215], dtype=np.float32)
INK = np.array([9, 16, 13], dtype=np.float32)
BLACK = np.array([6, 10, 8], dtype=np.float32)


def smooth(a, b, t):
    u = np.clip((t-a)/(b-a), 0, 1)
    return u*u*(3-2*u)


def paper(t, zoom=1):
    light = .99-.17*((X-.48)**2+(Y-.39)**2)
    diagonal = X*.5+Y*.55-.21-.025*math.sin(t*.28)
    light -= .16*(1-smooth(-.16, .13, diagonal))
    light += .025*np.sin(X*3.7+Y*2.5+t*.14)
    pixels = PAPER[None,None,:]*light[:,:,None]
    pixels += (GRAIN*.9+FIBRES*1.8*zoom)[:,:,None]
    return pixels


def layer(pixels, mask, color):
    return pixels*(1-mask[:,:,None])+np.asarray(color)*mask[:,:,None]


def bead(pixels, x, y, r, stretch=1, heading=0, elevation=0, strength=1):
    cx, sy = math.cos(heading), math.sin(heading)
    u, v = X-x, (Y-y)*RATIO
    a = (u*cx+v*sy)/stretch
    b = (-u*sy+v*cx)*stretch
    dist = np.sqrt(a*a+b*b)
    shadow = np.exp(-(((X-x-.006)/(r*1.12+elevation*.7))**2+
                       ((Y-y-.013)/(r/RATIO*.65+elevation*.5))**2)*1.6)*.28
    pixels = pixels*(1-shadow[:,:,None])
    surface = 1-smooth(r-.0009, r+.0009, dist)
    rim = np.exp(-((dist/r-.86)/.07)**2)*3
    highlight = np.exp(-(((a+r*.3)/(r*.26))**2+((b+r*.35)/(r*.13))**2))*48
    color = INK[None,None,:] + (rim+highlight)[:,:,None]*np.array([.7, 1, .8])
    return pixels*(1-surface[:,:,None]*strength)+color*surface[:,:,None]*strength


def ink_edge(pixels, edge, shadow=1):
    mask = smooth(-.0011, .0011, X-edge)
    shade = np.exp(-((X-edge+.014)/.016)**2)*.15*shadow
    pixels *= 1-shade[:,:,None]
    rim = np.exp(-((X-edge-.003)/.002)**2)*5
    color = INK[None,None,:]+(rim+GRAIN*.35)[:,:,None]
    return pixels*(1-mask[:,:,None])+color*mask[:,:,None]


def scene_one(t):
    pixels = paper(t, 1.2)
    # A tiny falling drop. Its shadow moves before it does.
    drop = smooth(.3, 1.05, t)
    bounce = math.sin(np.clip((t-1.05)/.72, 0, 1)*math.pi)*math.exp(-max(0,t-1.05)*2)
    height = .15*(1-drop)+.019*bounce
    squash = 1+.24*math.sin(np.clip((t-1.02)/.65,0,1)*2*math.pi)*math.exp(-max(0,t-1.02)*3)
    x = .478+.008*smooth(1.9, 3.4, t)
    y = .53-height
    # The floor shadow detaches, becoming a crawling liquid thread.
    creep = smooth(1.6, 3.25, t)
    thread_y = .54+.025*np.sin((X-.48)*28)
    ribbon = np.exp(-((Y-thread_y)/.009)**2)*smooth(.46,.48,X)*(1-smooth(.48+.18*creep,.5+.18*creep,X))
    pixels = layer(pixels, ribbon*.72*creep, INK)
    pixels = bead(pixels, x, y, .020, max(.7,squash), elevation=height)
    # Sparse fibres around the subject stay still when the ink wakes.
    return pixels


def scene_two(t):
    pixels = paper(t+3.4)
    # Cropped contour lines tie the film to the relief of the game.
    distance = np.sqrt(((X+.08)/1.18)**2+((Y+.23)*RATIO)**2)
    rings = np.exp(-((np.mod(distance*125,1)-.5)/.035)**2)
    rings *= 1-smooth(.42,.55,distance)
    pixels -= rings[:,:,None]*12
    retreat = smooth(.85, 2.8, t)
    x = .48-.19*retreat
    y = .56-.022*math.sin(retreat*math.pi)
    tip = .69-.29*smooth(.1,2.15,t)
    edge = .88+.025*np.sin(Y*6+t*.4)
    edge -= (.88-tip)*np.exp(-((Y-.57)/(.025+.02*smooth(.7,2.5,t)))**2)
    pixels = ink_edge(pixels, edge)
    speed = math.sin(retreat*math.pi)
    for offset in [.041,.068]:
        pixels = bead(pixels,x+offset,y+.012,.0038*(1-speed*.2),1+speed*.4,strength=retreat)
    pixels = bead(pixels,x,y,.012,1+speed*.8,heading=-.12)
    return pixels


def scene_three(t):
    pixels = paper(t+7)
    recoil = smooth(.15, 1.35, t)
    attack = smooth(1.12, 2.62, t)
    edge = .70+.04*np.sin(Y*8+t*.5)+.022*np.sin(Y*17-t*.7)
    edge -= .28*attack*np.exp(-((Y-.54)/(.13+.17*attack))**2)
    edge -= .7*smooth(2.6,3.2,t)
    pixels = ink_edge(pixels,edge)
    x = .43-.16*recoil+.26*smooth(1.8,2.65,t)
    stretch = 1+.65*math.sin(attack*math.pi)
    pixels = bead(pixels,x,.54,.027*(1-.35*attack),stretch)
    return pixels


def scene_four(t):
    pixels = paper(t+10.2)
    # A close lateral pass, always too close to resolve a complete body.
    travel = smooth(0,2.55,t)
    edge = .94-1.18*travel+.075*np.sin(Y*6.5+t*.8)+.025*np.sin(Y*14+t*1.9)
    edge -= .08*np.exp(-((Y-.63)/.18)**2)*math.sin(travel*math.pi)
    pixels = ink_edge(pixels,edge)
    for i in range(4):
        x = .62-.13*i-.68*smooth(.12+i*.11,2.18+i*.1,t)
        y = .65+.055*math.sin(i*2.3)
        pixels = bead(pixels,x,y,.005+i*.001,1.8,heading=.1)
    return pixels


def frame(t):
    if t<3.4:
        pixels=scene_one(t)
        fade=smooth(0,.24,t)
        pixels=pixels*fade+BLACK[None,None,:]*(1-fade)
    elif t<7:
        pixels=scene_two(t-3.4)
    elif t<10.2:
        pixels=scene_three(t-7)
    elif t<13.15:
        pixels=scene_four(t-10.2)
        fade=1-smooth(12.6,13.15,t)
        pixels=pixels*fade+BLACK[None,None,:]*(1-fade)
    else:
        pixels=np.broadcast_to(BLACK,(H,W,3)).copy()
        # One brief look is the only animal cue in the film.
        opening=smooth(13.80,13.94,t)*(1-smooth(14.31,14.39,t))
        for i in range(2):
            x=.48+i*.036
            eye=np.sqrt(((X-x)/.007)**2+((Y-.49)/max(.0001,.0124*opening))**2)
            mask=(1-smooth(.86,1.04,eye))*opening
            pixels=layer(pixels,mask,np.array([235,237,214]))
        pixels*=1-smooth(14.68,15,t)
    return Image.fromarray(np.uint8(np.clip(pixels,0,255))).resize((1920,1080),Image.Resampling.LANCZOS)


def soundtrack():
    rate=48000
    time=np.arange(rate*DURATION,dtype=np.float64)/rate
    noise=RNG.normal(0,1,time.size)
    low=np.convolve(noise,np.ones(95)/95,mode="same")
    mid=np.convolve(noise,np.ones(13)/13,mode="same")
    air=smooth(.1,1,time)*(1-smooth(12.7,13.15,time))
    sound=(.012*np.sin(2*np.pi*47*time)+.018*low)*air
    pan=np.zeros(time.size)

    def liquid(start,length,first,last,gain,position=0):
        nonlocal sound,pan
        u=np.clip(time-start,0,length)
        phase=2*np.pi*(first*u+(last-first)*u*u/(2*length))
        env=np.sin(np.pi*u/length)**2*((time>=start)&(time<start+length))
        pulse=gain*env*(np.sin(phase)+.14*np.sin(phase*2.13))
        sound+=pulse
        pan+=pulse*position

    def swish(start,length,gain,position=0):
        nonlocal sound,pan
        u=np.clip((time-start)/length,0,1)
        env=np.sin(np.pi*u)**2
        pulse=gain*env*(low*1.5+mid*.24)
        sound+=pulse
        pan+=pulse*position

    liquid(1.015,.17,520,180,.14,-.18)
    liquid(1.22,.12,270,100,.048,-.18)
    swish(1.7,1.5,.22,.2)
    swish(3.52,1.8,.3,.4)
    for start,pitch in [(4.55,300),(4.9,370),(5.25,420)]:
        liquid(start,.10,pitch,pitch*.48,.046,-.25)
    swish(5.5,1.2,.45,.25)
    liquid(7.12,.4,106,55,.08,.3)
    swish(7.4,1.6,.27,.1)
    liquid(8.88,.30,440,125,.16,-.2)
    swish(9.1,1.2,.52,-.25)
    swish(10.25,2.5,.65,.4)
    liquid(12.24,.60,75,42,.11)
    liquid(13.84,.13,200,100,.045)
    sound*=1-smooth(14.4,14.8,time)
    left=sound-pan*.32
    right=sound+pan*.32+np.roll(low,160)*.009*air
    stereo=np.stack((left,right),axis=1)
    stereo*=.48/max(.001,float(np.max(np.abs(stereo))))
    audio=BUILD/"teaser15-sound.wav"
    with wave.open(str(audio),"wb") as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate)
        wav.writeframes((stereo*32767).astype("<i2").tobytes())
    return audio


def review():
    times=[.6,1.2,2.8,4,5.8,7.6,9.3,10.8,12,13.2,14.1,14.7]
    sheet=Image.new("RGB",(1600,996))
    for i,t in enumerate(times):
        preview=frame(t).resize((400,225),Image.Resampling.LANCZOS)
        x,y=(i%4)*400,(i//4)*332
        sheet.paste(preview,(x,y))
        ImageDraw.Draw(sheet).text((x+10,y+232),f"{t:.2f} s",fill="white")
    sheet.save(BUILD/"teaser15-review.jpg")


def main():
    if "--review" in sys.argv:
        review();return
    audio=soundtrack()
    encoder=imageio_ffmpeg.get_ffmpeg_exe()
    args=[encoder,"-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24",
          "-s","1920x1080","-r",str(FPS),"-i","-","-i",str(audio),"-c:v","libx264",
          "-preset","fast","-crf","18","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",
          "-t",str(DURATION),"-movflags","+faststart",str(VIDEO)]
    with (BUILD/"encoder15.log").open("w",encoding="utf8") as log:
        process=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=log,
                                 creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
        for i in range(FPS*DURATION):
            process.stdin.write(frame(i/FPS).tobytes())
            if i%90==0:print(f"Rendered {i}/{FPS*DURATION}",flush=True)
        process.stdin.close()
        if process.wait()!=0:raise RuntimeError("Video encoding failed")
    print(json.dumps({"file":str(VIDEO),"frames":FPS*DURATION,"seconds":DURATION,"bytes":VIDEO.stat().st_size}),flush=True)


if __name__=="__main__":
    main()
