"""Mux native 1080p Blender frames with the manually synthesized soundtrack."""
from pathlib import Path
import json
import subprocess
import sys

root=Path(__file__).resolve().parent.parent
build=root/'.work'/'opening90'
sys.path.insert(0,str(root/'.work'/'teaser-deps'))
import imageio_ffmpeg

frames=build/'frames'
missing=[i for i in range(1,2161) if not (frames/f'frame_{i:04d}.png').is_file() or (frames/f'frame_{i:04d}.png').stat().st_size<100]
if missing:raise SystemExit(f'{len(missing)} missing frames, first {missing[0]}')
out=root/'exports'/'opening-90s.mp4'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
    '-framerate','24','-start_number','1','-i',str(frames/'frame_%04d.png'),
    '-i',str(build/'sound.wav'),'-vf','fade=t=in:st=0:d=0.8,fade=t=out:st=89.3:d=0.7',
    '-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','192k','-t','90','-movflags','+faststart',str(out)],check=True)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-v','error','-i',str(out),'-f','null','-'],check=True)
count,seconds=imageio_ffmpeg.count_frames_and_secs(str(out))
reader=imageio_ffmpeg.read_frames(str(out))
metadata=next(reader);reader.close()
assert count==2160,(count,seconds)
assert abs(seconds-90)<.05,seconds
assert tuple(metadata['size'])==(1920,1080),metadata
assert abs(metadata['fps']-24)<.01,metadata
(build/'verification.json').write_text(json.dumps({'frames':count,'seconds':seconds,'metadata':metadata},ensure_ascii=False,indent=2),encoding='utf-8')
print(out)
