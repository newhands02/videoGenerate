"""Document parsing module: splits text into segments using LLM."""
import os
import json
import re
from openai import OpenAI

# DeepSeek-compatible API (uses OpenAI SDK base_url)
LLM_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
LLM_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")


def parse_document(text: str) -> list[dict]:
    """
    Send raw text to LLM for intelligent segmentation.
    Returns a list of segments, each with:
    - index: segment number
    - text: the segment's narration text
    - keywords: extracted keywords for the segment
    - image_description: visual description for AI image generation
    """
    # Truncate very long text to avoid token limits
    text_sample = text[:6000] if len(text) > 6000 else text

    prompt = f"""你是一个短视频脚本分段专家。请将以下文稿智能分段，每段适合作为短视频的一个画面。

要求：
1. 将文稿分为5-12个段落，每段20-50字
2. 为每段提取3-5个关键词
3. 为每段生成一句画面描述（用于AI图片生成），画面描述应为英文，风格统一为"cinematic, realistic, 4K"

输出严格的JSON数组格式，不要包含任何其他文字：
[
  {{
    "index": 0,
    "text": "段落文本内容",
    "keywords": ["关键词1", "关键词2"],
    "image_description": "English visual description for AI image generation, cinematic style"
  }}
]

文稿内容：
{text_sample}"""

    client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "system", "content": "You are a video script segmentation expert. Always output valid JSON arrays only."}, {"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4096,
        )
        content = response.choices[0].message.content
        return _extract_json(content)
    except Exception as e:
        # Fallback: simple rule-based segmentation
        return _rule_based_segment(text)


def _extract_json(raw: str) -> list[dict]:
    """Extract JSON array from LLM response."""
    # Try direct parse
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    # Try to find JSON array in markdown code blocks
    match = re.search(r'\[[\s\S]*\]', raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def _rule_based_segment(text: str, max_segments: int = 10) -> list[dict]:
    """Fallback: split by sentences when LLM fails."""
    sentences = re.split(r'(?<=[。！？.!?])\s*', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    # Merge short sentences and split long ones
    segments = []
    buffer = ""
    for s in sentences:
        if len(buffer) + len(s) < 60:
            buffer += s
        else:
            if buffer:
                segments.append(buffer)
            buffer = s
    if buffer:
        segments.append(buffer)

    # Limit to max_segments
    if len(segments) > max_segments:
        chunk_size = len(segments) / max_segments
        merged = []
        for i in range(max_segments):
            start = int(i * chunk_size)
            end = int((i + 1) * chunk_size)
            merged.append("".join(segments[start:end]))
        segments = merged

    result = []
    for i, seg in enumerate(segments):
        result.append({
            "index": i,
            "text": seg,
            "keywords": [],
            "image_description": f"cinematic scene, 4K, professional lighting, related to '{seg[:30]}'",
        })
    return result
