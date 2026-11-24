"""Draw the print plates and synthesize the 90-second soundtrack by hand.

No photographs, generated images, downloaded textures or sampled recordings.
"""
from pathlib import Path
import math
import random
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / '.work' / 'opening90'
BUILD.mkdir(parents=True, exist_ok=True)
random.seed(2203)


def plates():
    w, h = 2048, 3072
    regular = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(regular)
    fonts = [Path('C:/Windows/Fonts/consola.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf')]
    face = next((p for p in fonts if p.exists()), None)
    def font(size):
        return ImageFont.truetype(str(face), size) if face else ImageFont.load_default(size=size)
    glyphs = '0O1I7XW#%/\\[]{}<>+=:;?*$@&!ЖФЮЯДЛ'
    # These are deliberately ungrammatical printer test marks, never a title.
    for row in range(37):
        y = 95 + row * 77
        for col in range(23):
            if random.random() < .23:
                continue
            x = 80 + col * 83
            c = random.choice(glyphs)
            d.text((x, y), c, font=font(random.choice([31, 38, 44])), fill=(12, 17, 15, 215))
    for y in [75, 1380, 2940]:
        d.line((65, y, 1980, y), fill=(30, 35, 29, 180), width=2)
    regular.save(BUILD / 'print-base.png')
    error = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(error)
    for row in range(83):
        y = 25 + row * 37 + random.randint(-9, 9)
        for col in range(49):
            if random.random() < .25:
                continue
            x = 18 + col * 42 + random.randint(-12, 12)
            c = random.choice(glyphs)
            f = font(random.randint(20, 51))
            if random.random() < .22:
                for off in [-4, 4, 8]:
                    d.text((x+off, y+random.randint(-2, 2)), c, font=f, fill=(25, 36, 31, 65))
            d.text((x, y), c, font=f, fill=(5, 12, 9, random.randint(100, 235)))
    for i in range(230):
        y = random.randrange(h)
        x = random.randrange(w)
        length = random.randint(40, w)
        d.line((x, y, min(w, x+length), y), fill=(9, 17, 12, random.randint(35, 170)), width=random.choice([1, 1, 2, 3, 5]))
    for i in range(18):
        x = random.randint(30, w-30)
        y = random.randint(0, h)
        d.line((x, y, x+random.randint(-8, 8), min(h, y+random.randint(170, 1300))), fill=(12, 22, 16, 65), width=random.randint(1, 5))
    error.save(BUILD / 'print-error.png')
    smear = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(smear)
    for i in range(23):
        x, y = random.randint(0, w), random.randint(0, h)
        for j in range(8):
            rr = random.randint(12, 100)
            xx, yy = x+random.randint(-70,70), y+random.randint(-50,50)
            d.ellipse((xx-rr, yy-rr*.27, xx+rr, yy+rr*.27), fill=(7, 18, 11, random.randint(35, 165)))
    for i in range(12):
        x,y=random.randint(0,w),random.randint(0,h)
        d.polygon([(x,y),(min(w,x+random.randint(200,1100)),y+random.randint(-3,5)),
                   (min(w,x+random.randint(200,900)),y+random.randint(10,40)),(x,y+random.randint(5,25))],
                  fill=(4,12,7,random.randint(90,180)))
    smear = smear.filter(ImageFilter.GaussianBlur(8))
    smear.save(BUILD / 'print-smear.png')


def audio():
    rate = 48000
    n = rate * 90
    t = np.arange(n, dtype=np.float32) / rate
    rng = np.random.default_rng(223)
    noise = rng.normal(0, 1, n).astype(np.float32)
    out = np.zeros((n, 2), np.float32)
    def envelope(a, b, fade=.25):
        return np.clip((t-a)/fade, 0, 1)*np.clip((b-t)/fade, 0, 1)
    def bed(signal, level=1, pan=0):
        out[:,0] += signal*level*math.sqrt((1-pan)/2)
        out[:,1] += signal*level*math.sqrt((1+pan)/2)
    bed((np.sin(t*math.tau*47)+.4*np.sin(t*math.tau*94))*.003)
    bed(noise*.0015)
    motor = (np.sin(t*math.tau*(113+5*np.sin(t*.8)))+.25*np.sin(t*math.tau*227))
    bed(motor*.025*envelope(20.1, 79, 1.5))
    # Paper feed: friction with a gently fluttering envelope.
    bed(noise*.020*envelope(20.5, 27, .8)*(1+.4*np.sin(t*31)))
    bed(noise*.018*envelope(74, 81, .7)*(1+.25*np.sin(t*36)))
    for a,b in [(5,12),(14,15.2)]:
        bed(noise*.012*envelope(a,b,.5))
    # Synchronized carriage passes, high frequencies kept quiet in the mix.
    for start in [23,25.4,28.2,30.8,33,36,39,42,45,48,50.2,52,54,56,58,60,62]:
        env=envelope(start,start+1.5,.28)
        whine=np.sin(math.tau*(610*t+25*np.sin(t*3.2)))
        bed((whine*.016+noise*.007)*env, pan=.45*math.sin(start))
    for k in range(72):
        start=35.5+k*.25
        env=envelope(start,start+.12,.025)
        bed((np.sin(t*math.tau*(1800+k*13))*.008+noise*.005)*env, pan=(k%7-3)/5)
    # Electrical instability grows inside the printer, with mechanical chatter.
    bed((np.sin(t*math.tau*51)+.25*np.sin(t*math.tau*153))*.024*envelope(49,67,2))
    for start in [51,52.15,53.4,54.8,56.2,58.5,61,63.2,64.7]:
        tau=np.maximum(0,t-start)
        bed(noise*.026*np.exp(-tau*24)*(t>=start)*(t<start+.3),pan=-.3)
    for start in [66.7,68.35,70.05,71.65,73.1]:
        tau=np.maximum(0,t-start)
        hit=np.sin(math.tau*(420*tau-130*tau*tau))*np.exp(-tau*16)
        bed(hit*.12*(t>=start)*(t<start+.8),pan=.2*math.sin(start))
        bed(noise*.018*np.exp(-tau*40)*(t>=start)*(t<start+.2))
    # Restrained tension and the final capillary movement.
    tension=(np.sin(t*math.tau*58.27)+.35*np.sin(t*math.tau*87.31))
    bed(tension*.017*envelope(54,88,4))
    bed(noise*.005*(.65+.35*np.sin(t*7))*envelope(81,89.4,2))
    tau=np.maximum(0,t-86.8)
    bed(np.sin(math.tau*(150*tau-40*tau*tau))*.03*np.exp(-tau*3)*(t>=86.8))
    out *= np.minimum(1, t/.9)[:,None]*np.minimum(1,(90-t)/.8)[:,None]
    out = np.tanh(out*1.8)*.85
    with wave.open(str(BUILD/'sound.wav'),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate)
        f.writeframes((out*32767).astype('<i2').tobytes())


if __name__ == '__main__':
    plates()
    audio()
    print(BUILD)
