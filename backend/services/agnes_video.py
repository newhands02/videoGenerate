"""Agnes AI Video V2.0 service — async task-based video generation API."""
import os
import time
import httpx
from pathlib import Path

API_KEY = os.getenv("AGNES_API_KEY", "")
API_BASE = os.getenv("AGNES_API_BASE", "https://apihub.agnes-ai.com")
MODEL = "agnes-video-v2.0"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs" / "agnes_videos"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

POLLED_SECONDS = {}  # track last poll time per task_id


def _headers():
    return {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def create_video_task(
    prompt: str,
    mode: str = "text2video",
    image: str = None,
    images: list = None,
    negative_prompt: str = None,
    width: int = 1152,
    height: int = 768,
    num_frames: int = 121,
    frame_rate: int = 24,
    seed: int = None,
    extra_body: dict = None,
) -> dict:
    """Create a video generation task via Agnes AI API.

    Args:
        prompt: Text description of the video.
        mode: "text2video", "image2video", "multi_image", or "keyframes".
        image: Single image URL for image2video.
        images: List of image URLs for multi_image/keyframes.
        negative_prompt: What to avoid in the video.
        width/height: Output resolution.
        num_frames: Total frames (must follow 8n+1 rule, <= 441).
        frame_rate: Frames per second (1-60).
        seed: Reproducibility seed.
        extra_body: Additional parameters (e.g. extra_body.mode="keyframes").

    Returns:
        Dict with task_id, video_id, status, etc.
    """
    payload = {"model": MODEL, "prompt": prompt}

    if mode == "image2video" and image:
        payload["image"] = image
    elif mode == "multi_image" and images:
        payload["images"] = images
    elif mode == "keyframes" and images:
        payload["images"] = images
        if extra_body is None:
            extra_body = {}
        extra_body["mode"] = "keyframes"

    if negative_prompt:
        payload["negative_prompt"] = negative_prompt
    payload["width"] = width
    payload["height"] = height
    payload["num_frames"] = num_frames
    payload["frame_rate"] = frame_rate
    if seed is not None:
        payload["seed"] = seed
    if extra_body:
        payload["extra_body"] = extra_body

    url = f"{API_BASE}/v1/videos"
    with httpx.Client(timeout=30) as client:
        resp = client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    # Track poll timer
    task_id = data.get("task_id") or data.get("id", "")
    POLLED_SECONDS[task_id] = 0

    return {
        "task_id": data.get("task_id"),
        "video_id": data.get("video_id"),
        "status": data.get("status", "submitted"),
        "raw": data,
    }


def get_video_result(video_id: str = None, task_id: str = None) -> dict:
    """Poll for video generation result.

    Prefers video_id (recommended). Falls back to task_id for compatibility.
    """
    if video_id:
        url = f"{API_BASE}/agnesapi"
        params = {"video_id": video_id}
    elif task_id:
        url = f"{API_BASE}/v1/videos/{task_id}"
        params = {}
    else:
        return {"error": "Either video_id or task_id is required"}

    with httpx.Client(timeout=30) as client:
        resp = client.get(url, params=params, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    return data


def download_video(video_url: str, filename: str = None) -> str:
    """Download generated video from URL to local outputs directory."""
    import hashlib
    if not filename:
        filename = hashlib.md5(video_url.encode()).hexdigest()[:12] + ".mp4"
    dest = OUTPUT_DIR / filename
    with httpx.Client(timeout=120) as client:
        resp = client.get(video_url, headers={"Authorization": f"Bearer {API_KEY}"})
        resp.raise_for_status()
        dest.write_bytes(resp.content)
    return str(dest)


def get_output_dir() -> str:
    return str(OUTPUT_DIR)


def get_video_presets():
    """Return common video presets based on API recommendations."""
    return [
        {"id": "standard", "label": "标准 (1152×768)", "width": 1152, "height": 768, "num_frames": 121, "frame_rate": 24},
        {"id": "social", "label": "短视频 (1152×768)", "width": 1152, "height": 768, "num_frames": 81, "frame_rate": 24},
        {"id": "long", "label": "长视频 (1152×768)", "width": 1152, "height": 768, "num_frames": 241, "frame_rate": 24},
        {"id": "ultra_long", "label": "超长视频 (1152×768)", "width": 1152, "height": 768, "num_frames": 441, "frame_rate": 24},
        {"id": "portrait", "label": "竖屏 (768×1152)", "width": 768, "height": 1152, "num_frames": 121, "frame_rate": 24},
        {"id": "cinematic", "label": "电影级 (1920×1080)", "width": 1920, "height": 1080, "num_frames": 121, "frame_rate": 24},
    ]
