"""Text-to-Speech using Edge TTS."""
import os
import asyncio
import edge_tts

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
VOICE = "zh-CN-XiaoyiNeural"  # Chinese female voice
RATE = "+10%"  # Slightly faster


async def synthesize(text: str, job_id: str, index: int) -> tuple[str, float]:
    """
    Convert text to speech using Edge TTS.
    Returns (audio_path, duration_in_seconds).
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    audio_path = os.path.join(OUTPUT_DIR, f"{job_id}_audio_{index:03d}.mp3")

    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(audio_path)

    # Estimate duration from file size (rough: ~16KB/s for MP3 at 128kbps)
    file_size = os.path.getsize(audio_path)
    duration = file_size / 16000  # rough estimation

    return audio_path, duration
