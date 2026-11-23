"""Encode the rendered Blender frames and the hand-built soundtrack."""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
BUILD=ROOT/".work"
sys.path.insert(0,str(BUILD/"teaser-deps"))
import imageio_ffmpeg

frames=BUILD/"blender-frames"
missing=[i for i in range(1,1441) if not (frames/f"frame_{i:04d}.png").is_file()]
if missing:
    raise SystemExit(f"Missing {len(missing)} Blender frames, starting at {missing[0]}")
output=ROOT/"exports"/"opening-60s.mp4"
command=[imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-loglevel","error","-y",
         "-framerate","24","-start_number","1","-i",str(frames/"frame_%04d.png"),
         "-i",str(BUILD/"opening-sound.wav"),
         "-vf","scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=1,fade=t=out:st=59.25:d=0.75",
         "-c:v","libx264","-preset","slow","-crf","18","-pix_fmt","yuv420p",
         "-c:a","aac","-b:a","192k","-t","60","-movflags","+faststart",str(output)]
subprocess.run(command,check=True)
print(output)
