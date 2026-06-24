"""AI image generation via Pollinations.ai free API."""
import aiohttp
import aiofiles
import os
import hashlib
import urllib.parse

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
POLLINATIONS_URL = "https://image.pollinations.ai/prompt"


async def generate_image(prompt: str, job_id: str, index: int) -> str:
    """
    Generate an image from Pollinations.ai.
    Returns the local file path of the saved image.
    """
    # Encode prompt for URL
    encoded_prompt = urllib.parse.quote(prompt)

    # Pollinations.ai URL format: /prompt/{encoded_prompt}?width=1080&height=1920&seed=42&model=flux
    url = f"{POLLINATIONS_URL}/{encoded_prompt}"
    params = {
        "width": 1080,
        "height": 1920,
        "model": "flux",
        "nologo": "true",
        "seed": hashlib.md5(f"{job_id}{index}".encode()).hexdigest()[:8],
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            if resp.status != 200:
                raise Exception(f"Image generation failed: HTTP {resp.status}")
            data = await resp.read()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    image_path = os.path.join(OUTPUT_DIR, f"{job_id}_img_{index:03d}.png")
    async with aiofiles.open(image_path, "wb") as f:
        await f.write(data)

    return image_path
