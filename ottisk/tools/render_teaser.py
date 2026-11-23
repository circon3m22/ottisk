from pathlib import Path
import json
import math
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BUILD = Path(__file__).resolve().parent.parent / ".work"
BUILD.mkdir(exist_ok=True)
sys.path.insert(0, str(BUILD / "teaser-deps"))
import imageio_ffmpeg

OUTPUT = BUILD.parent / "exports"
OUTPUT.mkdir(exist_ok=True)
VIDEO = OUTPUT / "ottisk-teaser-7s.mp4"
FPS, DURATION = 30, 7
W, H = 960, 540
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
X /= W
Y /= H
rng = np.random.default_rng(771)
grain = rng.normal(0, 1, (H, W)).astype(np.float32)
fibres = rng.normal(0, 1, (H, W)).astype(np.float32)
fibres = sum(np.roll(fibres, shift, axis=1) for shift in range(7)) / 7
vignette = np.clip(((X-.48)**2 + (Y-.45)**2)*.43, 0, .25)
paper = np.array([235, 231, 217], dtype=np.float32)
dark = np.array([12, 17, 14], dtype=np.float32)
font = ImageFont.truetype("C:/Windows/Fonts/georgiai.ttf", 150)
studio_font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 23)


def smooth(a, b, t):
    u = np.clip((t-a)/(b-a), 0, 1)
    return u*u*(3-2*u)


def frame(t):
    # Only a magnified fragment of the creature enters the shot.
    # The ink boundary reaches beyond three edges of the image.
    drift = .025*t
    edge = .645 + .065*np.sin((Y+drift)*3.1-.9) + .024*np.sin((Y+drift)*8.8+1.4)
    arrival = smooth(1.55, 2.95, t)
    swell = .022*np.exp(-((Y-.57)/.14)**2)*math.sin(arrival*math.pi)
    edge -= swell + .013*smooth(.4, 3.6, t)
    body = smooth(-.0014, .0014, X-edge)

    droplet_x = .415 + .265*arrival
    droplet_y = .575 + .01*math.sin(t*2)*arrival
    stretch = 1 + .95*math.sin(arrival*math.pi)
    radius = .011*(1-.26*arrival)
    distance = np.sqrt(((X-droplet_x)/stretch)**2 + ((Y-droplet_y)*H/W*stretch)**2)
    bead = 1-smooth(radius-.001, radius+.001, distance)
    ink = 1-(1-body)*(1-bead)
    shade = 1-vignette
    base = paper[None,None,:]*shade[:,:,None]
    base += (grain*1.15+fibres*1.7)[:,:,None]
    tint = dark[None,None,:] + (.8*grain + 1.3*np.sin(Y*1.6+X))[:,:,None]
    pixels = base*(1-ink[:,:,None]) + tint*ink[:,:,None]

    # Light catches the meniscus, without revealing a complete outline.
    meniscus = np.exp(-((X-edge-.003)/.0025)**2)*3.2
    pixels += meniscus[:,:,None]*np.array([.65, 1, .75])
    glint = np.exp(-(((X-(droplet_x-.003))/(radius*.28))**2+
                     ((Y-(droplet_y-.004))/(radius*.15))**2))
    pixels += glint[:,:,None]*35*(1-arrival)

    # A single round eye opens briefly in the cropped black field.
    eye_open = smooth(3.02, 3.17, t)*(1-smooth(3.39, 3.47, t))
    if eye_open > 0:
        eye_x = float(edge[int(.47*H), 0])+.083
        eye_y = .47
        eye = np.sqrt(((X-eye_x)/.009)**2+
                      ((Y-eye_y)/(max(.0001, .016*eye_open)))**2)
        mask = (1-smooth(.87, 1.06, eye))*eye_open
        pixels = pixels*(1-mask[:,:,None])+np.array([246,245,228])*mask[:,:,None]

    exposure = smooth(0, .42, t)*(1-smooth(3.60, 3.74, t))
    pixels = pixels*exposure + dark[None,None,:]*(1-exposure)
    image = Image.fromarray(np.uint8(np.clip(pixels, 0, 255))).resize((1920,1080), Image.Resampling.LANCZOS)

    title_alpha = smooth(4.13, 4.72, t)*(1-smooth(6.67, 7, t))
    if title_alpha > 0:
        lettering = Image.new("RGBA", image.size)
        draw = ImageDraw.Draw(lettering)
        draw.text((952, 497), "Оттиск", font=font, anchor="mm", fill=(237,233,218,round(255*title_alpha)))
        draw.text((960, 643), "BLUE", font=studio_font, anchor="mm", fill=(190,192,176,round(220*title_alpha)))
        image = Image.alpha_composite(image.convert("RGBA"), lettering).convert("RGB")
    return image


def soundtrack():
    rate = 48000
    time = np.arange(rate*DURATION, dtype=np.float64)/rate
    noise = rng.normal(0, 1, time.size)
    soft_noise = np.convolve(noise, np.ones(110)/110, mode="same")
    envelope = smooth(.2, 1.5, time)*(1-smooth(3.3, 3.74, time))
    bed = .018*np.sin(2*np.pi*51*time) + .009*np.sin(2*np.pi*76.5*time)
    bed += .12*soft_noise*(.7+.3*np.sin(2*np.pi*.6*time))
    sound = bed*envelope

    def liquid(start, duration, first, last, volume):
        u = time-start
        local = np.clip(u/duration, 0, 1)
        pitch = first+(last-first)*local
        phase = 2*np.pi*(first*u+(last-first)*u*u/(2*duration))
        env = np.sin(np.pi*local)**2
        env *= (u>=0)&(u<duration)
        return volume*env*(np.sin(phase)+.19*np.sin(phase*2.17))

    sound += liquid(1.6, .85, 119, 69, .055)
    sound += liquid(2.79, .21, 390, 175, .085)
    sound += liquid(3.09, .19, 104, 78, .035)
    sound += liquid(4.2, 1.45, 77, 66, .048)
    sound *= 1-smooth(6.6, 7, time)
    stereo = np.stack((sound, sound*.98+np.roll(soft_noise, 130)*.009*envelope), axis=1)
    stereo = np.clip(stereo, -.7, .7)
    path = BUILD / "teaser-sound.wav"
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes((stereo*32767).astype("<i2").tobytes())
    return path


def main():
    audio = soundtrack()
    encoder = imageio_ffmpeg.get_ffmpeg_exe()
    args = [encoder, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080", "-r", str(FPS), "-i", "-",
            "-i", str(audio), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
            "-t", str(DURATION), "-movflags", "+faststart", "-metadata", "title=Оттиск — тизер", str(VIDEO)]
    with (BUILD / "encoder.log").open("w", encoding="utf8") as log:
        process = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        for i in range(FPS*DURATION):
            image = frame(i/FPS)
            process.stdin.write(image.tobytes())
            if i%60 == 0:
                print(f"Rendered {i}/{FPS*DURATION}", flush=True)
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError("Video encoding failed. See encoder.log")
    times = [.7, 1.7, 2.6, 3.23, 3.8, 5.6]
    sheet = Image.new("RGB", (1440, 600))
    for i,t in enumerate(times):
        preview = frame(t).resize((480,270), Image.Resampling.LANCZOS)
        sheet.paste(preview, ((i%3)*480, (i//3)*300))
        ImageDraw.Draw(sheet).text(((i%3)*480+12,(i//3)*300+276),f"{t:.2f} s",fill="white")
    sheet.save(BUILD / "teaser-review.jpg")
    print(json.dumps({"file":str(VIDEO),"frames":FPS*DURATION,"duration":DURATION,"bytes":VIDEO.stat().st_size}),flush=True)


if __name__ == "__main__":
    main()
