"""Video composition: assemble images, audio, subtitles into final video."""
import os
import subprocess
from logger import JobLogger

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
BGM_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "bgm")

# Chinese font for FFmpeg drawtext — colon must be escaped in filter syntax
FONT_PATH = "msyh.ttc"
# Try to find ffmpeg: use PATH first, then common locations
FFMPEG = "ffmpeg"


def _find_ffmpeg() -> str:
    """Locate ffmpeg binary."""
    # Prefer ffmpeg from PATH
    if shutil_which("ffmpeg"):
        return "ffmpeg"
    # Common Windows locations
    candidates = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    ]
    # Also check the user"s hardcoded path
    hc = r"D:\software\ffmpeg-8.1.1-essentials_build\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe"
    if os.path.exists(hc):
        return hc
    for c in candidates:
        if os.path.exists(c):
            return c
    return "ffmpeg"  # Fallback, assume PATH


def shutil_which(cmd):
    """Simple which-like search."""
    import shutil
    return shutil.which(cmd)


def compose_video(job_id: str, segments: list[dict]) -> str:
    """Compose a video from image+audio segments with FFmpeg."""
    logger = JobLogger(job_id)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, f"{job_id}_output.mp4")

    temp_dir = os.path.join(OUTPUT_DIR, f"{job_id}_temp")
    os.makedirs(temp_dir, exist_ok=True)

    clip_files = []
    ffmpeg_bin = _find_ffmpeg()
    logger.info(f"Using FFmpeg: {ffmpeg_bin}")

    for seg in segments:
        if not seg.get("image_path") or not os.path.exists(seg["image_path"]):
            image_path = _create_fallback_image(temp_dir, seg["index"])
        else:
            image_path = seg["image_path"]

        audio_path = seg.get("audio_path", "")
        duration = max(seg.get("audio_duration", 5.0), 3.0)
        text = seg.get("text", "")
        index = seg["index"]

        clip_path = os.path.join(temp_dir, f"clip_{index:03d}.mp4")
        logger.info(f"合成片段 {index+1}/{len(segments)}")
        _render_clip(ffmpeg_bin, image_path, audio_path, text, duration, clip_path, temp_dir)
        clip_files.append(clip_path)

    # Build concat file list
    concat_list_path = os.path.join(temp_dir, "concat_list.txt")
    with open(concat_list_path, "w", encoding="utf-8") as f:
        for cf in clip_files:
            f.write(f"file '{cf.replace(chr(92), '/')}'\n")

    bgm_path = _get_bgm()
    _concat_clips_with_bgm(ffmpeg_bin, concat_list_path, bgm_path, output_path)

    # Cleanup
    for cf in clip_files:
        try:
            os.remove(cf)
        except OSError:
            pass
    try:
        os.remove(concat_list_path)
        os.rmdir(temp_dir)
    except OSError:
        pass

    return output_path


def _render_clip(ffmpeg_bin: str, image_path: str, audio_path: str, text: str, duration: float, output_path: str, temp_dir: str):
    """Render a single clip: image as video background with audio and subtitles."""
    has_audio = audio_path and os.path.exists(audio_path)

    # Escape text for FFmpeg drawtext: \ → \\ , : → \: , ' → \' , % → \% (printf syntax)
    safe_text = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "\\%")

    filter_parts = [
        "scale=1080:1920:force_original_aspect_ratio=decrease",
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
        f"drawtext=text='{safe_text}':fontsize=36:fontcolor=white:fontfile={FONT_PATH}:box=1:boxcolor=black@0.6:boxborderw=12:x=(w-text_w)/2:y=h-text_h-60:line_spacing=8",
    ]

    filter_str = ",".join(filter_parts)

    if has_audio:
        cmd = [
            ffmpeg_bin, "-y",
            "-loop", "1", "-i", image_path,
            "-i", audio_path,
            "-vf", filter_str,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            "-shortest",
            output_path,
        ]
    else:
        cmd = [
            ffmpeg_bin, "-y",
            "-loop", "1", "-i", image_path,
            "-vf", filter_str,
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            output_path,
        ]

    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        # Decode stderr manually — text=True can fail on Windows with FFmpeg"s gbk output
        err = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
        out = result.stdout.decode("utf-8", errors="replace") if result.stdout else ""
        tail = (err + out)[-800:]
        raise RuntimeError(f"FFmpeg clip render failed: {tail or 'no output captured'}")


def _concat_clips_with_bgm(ffmpeg_bin: str, concat_list_path: str, bgm_path: str | None, output_path: str):
    """Concatenate clips and optionally mix background music."""
    concat_cmd = [
        ffmpeg_bin, "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_list_path,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(concat_cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        import shutil
        with open(concat_list_path, "r") as f:
            first_line = f.readline().strip()
        if first_line.startswith("file "):
            first_clip = first_line[6:].strip("'")
            if os.path.exists(first_clip):
                shutil.copy(first_clip, output_path)


def _create_fallback_image(temp_dir: str, index: int) -> str:
    """Create a simple colored placeholder image."""
    from PIL import Image, ImageDraw, ImageFont
    img_path = os.path.join(temp_dir, f"fallback_{index:03d}.png")
    img = Image.new("RGB", (1080, 1920), color=(20, 20, 40))
    draw = ImageDraw.Draw(img)
    for y in range(1920):
        r = 20 + int(y / 1920 * 30)
        g = 20 + int(y / 1920 * 30)
        b = 40 + int(y / 1920 * 30)
        draw.line([(0, y), (1080, y)], fill=(r, g, b))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 60)
    except OSError:
        font = ImageFont.load_default()
    draw.text((540, 900), f"Segment {index + 1}", fill=(200, 200, 200), font=font, anchor="mm")
    img.save(img_path)
    return img_path


def _get_bgm() -> str | None:
    """Get a random BGM file from the assets directory."""
    if not os.path.isdir(BGM_DIR):
        return None
    bgm_files = [f for f in os.listdir(BGM_DIR) if f.endswith((".mp3", ".wav", ".m4a"))]
    if not bgm_files:
        return None
    return os.path.join(BGM_DIR, bgm_files[0])


