import sys
import os
import json
import asyncio
import re
import edge_tts

def normalize_vietnamese_numbers(text: str) -> str:
    """
    Expands common digits, percentages, prices, and fractions into full Vietnamese words.
    Prevents Microsoft TTS phoneme/number parsing errors.
    """
    if not text:
        return ""
    # 1. Percentages: 100% -> một trăm phần trăm
    text = re.sub(r'(\d+)\s*%', lambda m: f"{m.group(1)} phần trăm", text)
    # 2. Fractions: 10/10 -> mười trên mười
    text = re.sub(r'(\d+)/(\d+)', lambda m: f"{m.group(1)} trên {m.group(2)}", text)
    # 3. Currency / prices: 99k, 199k, 50k
    text = re.sub(r'(\d+)\s*[kK]\b', lambda m: f"{m.group(1)} nghìn", text)

    # 4. Convert numbers 0-100
    units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
    teens = {10: 'mười', 11: 'mười một', 12: 'mười hai', 13: 'mười ba', 14: 'mười bốn', 15: 'mười lăm', 16: 'mười sáu', 17: 'mười bảy', 18: 'mười tám', 19: 'mười chín'}
    tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi']

    def num_to_word(n):
        if n == 0: return 'không'
        if 1 <= n <= 9: return units[n]
        if 10 <= n <= 19: return teens[n]
        if 20 <= n <= 99:
            d = n // 10
            u = n % 10
            if u == 0: return tens[d]
            if u == 1: return f"{tens[d]} mốt"
            if u == 5: return f"{tens[d]} lăm"
            return f"{tens[d]} {units[u]}"
        if n == 100: return 'một trăm'
        return str(n)

    text = re.sub(r'\b([0-9]{1,2}|100)\b', lambda m: num_to_word(int(m.group(1))), text)
    return text

def sanitize_text_for_tts(raw: str) -> str:
    """
    Sanitizes text to ensure 100% compatibility with Microsoft Edge Neural TTS SSML engine.
    Removes quotes, XML entities, unprintable chars, resolves numbers, and handles phoneme edge cases.
    """
    if not raw:
        return ""

    t = raw.strip()
    # 1. Expand numbers to Vietnamese words
    t = normalize_vietnamese_numbers(t)
    # 2. Remove markdown formatting (*, _, ~, #)
    t = re.sub(r'[\*_~`#]+', '', t)
    # 3. Remove single, double, typographic quotes and brackets
    t = re.sub(r'[\'\"«»“”‘’\[\]\(\)\{\}]', '', t)
    # 4. Remove XML dangerous characters
    t = re.sub(r'[<>&]', '', t)
    # 5. Remove emojis
    t = re.sub(r'[\U00010000-\U0010ffff]', '', t)
    # 6. Fix known Azure/Edge TTS Vietnamese phoneme collisions
    t = re.sub(r'vị\s+thông\s+minh', 'vị rất thông minh', t, flags=re.IGNORECASE)
    # 7. Normalize whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    # 8. Ensure valid sentence ending punctuation
    if t and t[-1] not in '.!?':
        t += '.'
    return t

import subprocess

import unicodedata

async def synthesize_one(clean_text: str, voice: str, out_path: str, rate: str):
    """
    Synthesizes speech with 100% STRICT VOICE LOCK - NEVER switches to a different voice!
    Uses isolated CLI subprocess execution with fresh TCP/SSL handshake and progressive backoff.
    """
    last_err = None
    # Ensure NFC unicode composition
    norm_text = unicodedata.normalize('NFC', clean_text)

    for attempt in range(4):
        try:
            r = rate if attempt == 0 else "+0%"
            if os.path.exists(out_path):
                try:
                    os.unlink(out_path)
                except Exception:
                    pass

            # Subprocess CLI execution guarantees a fresh connection and TLS handshake
            res = subprocess.run(
                [
                    sys.executable,
                    '-m',
                    'edge_tts',
                    '--voice',
                    voice,
                    '--rate',
                    r,
                    '--text',
                    norm_text,
                    '--write-media',
                    out_path,
                ],
                capture_output=True,
                text=True,
                timeout=25,
            )

            if res.returncode == 0 and os.path.exists(out_path):
                if os.path.getsize(out_path) > 300:
                    return True
                else:
                    try:
                        os.unlink(out_path)
                    except Exception:
                        pass

            err_msg = res.stderr.strip() or f"CLI returned code {res.returncode}"
            last_err = RuntimeError(err_msg)
            sys.stderr.write(f"[tts_helper] Attempt {attempt} for voice {voice} throttled: {err_msg}\n")
        except Exception as e:
            last_err = e
            sys.stderr.write(f"[tts_helper] Attempt {attempt} for voice {voice} exception: {e}\n")

        # Progressive backoff to clear Microsoft rate limit window
        wait_time = 3.5 if attempt == 0 else (4.5 if attempt == 1 else 6.0)
        await asyncio.sleep(wait_time)

    raise last_err

async def run_batch(manifest_path: str):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    voice = manifest['voice']
    rate = manifest.get('rate', '+10%')
    segments = manifest['segments']

    for idx, seg in enumerate(segments):
        raw_text = seg['text']
        out_path = seg['outputPath']
        clean_text = sanitize_text_for_tts(raw_text)

        if not clean_text:
            clean_text = "Sản phẩm tuyệt vời."

        await synthesize_one(clean_text, voice, out_path, rate)
        # Pacing pause between segments to avoid connection throttle
        if idx < len(segments) - 1:
            await asyncio.sleep(2.5)

async def run_single(raw_text: str, voice: str, output_path: str, rate: str):
    clean_text = sanitize_text_for_tts(raw_text)
    if not clean_text:
        clean_text = "Xin chào."
    await synthesize_one(clean_text, voice, output_path, rate)

async def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage:\n  tts_helper.py --batch <manifest.json>\n  tts_helper.py <text> <voice> <output_path> [rate]\n")
        sys.exit(1)

    if sys.argv[1] == '--batch':
        if len(sys.argv) < 3:
            sys.stderr.write("Missing manifest path for batch mode\n")
            sys.exit(1)
        await run_batch(sys.argv[2])
    else:
        if len(sys.argv) < 4:
            sys.stderr.write("Usage: tts_helper.py <text> <voice> <output_path> [rate]\n")
            sys.exit(1)
        raw_text = sys.argv[1].strip()
        voice = sys.argv[2].strip()
        output_path = sys.argv[3].strip()
        rate = sys.argv[4].strip() if len(sys.argv) > 4 else "+10%"
        await run_single(raw_text, voice, output_path, rate)

if __name__ == '__main__':
    asyncio.run(main())
