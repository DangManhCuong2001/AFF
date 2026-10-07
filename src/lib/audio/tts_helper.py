import sys
import os
import asyncio
import re
import edge_tts

def sanitize_text_for_tts(raw: str) -> str:
    """
    Sanitizes text to ensure 100% compatibility with Microsoft Edge Neural TTS SSML engine.
    Removes quotes, XML entities, unprintable chars, and resolves known phoneme collisions.
    """
    if not raw:
        return ""
    
    t = raw.strip()
    # 1. Remove markdown formatting (*, _, ~)
    t = re.sub(r'[\*_~`#]+', '', t)
    # 2. Remove single, double, typographic quotes and brackets
    t = re.sub(r'[\'\"«»“”‘’]', '', t)
    # 3. Remove XML dangerous characters
    t = re.sub(r'[<>&]', '', t)
    # 4. Remove emojis
    t = re.sub(r'[\U00010000-\U0010ffff]', '', t)
    # 5. Fix known Azure/Edge TTS Vietnamese phoneme collision for 'vị thông minh'
    t = re.sub(r'vị\s+thông\s+minh', 'vị rất thông minh', t, flags=re.IGNORECASE)
    # 6. Normalize whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    # 7. Ensure valid sentence ending punctuation
    if t and t[-1] not in '.!?':
        t += '.'
    return t

async def main():
    if len(sys.argv) < 4:
        sys.stderr.write("Usage: tts_helper.py <text> <voice> <output_path> [rate]\n")
        sys.exit(1)

    raw_text = sys.argv[1].strip()
    voice = sys.argv[2].strip()
    output_path = sys.argv[3].strip()
    rate = sys.argv[4].strip() if len(sys.argv) > 4 else "+10%"

    clean_text = sanitize_text_for_tts(raw_text)
    if not clean_text:
        sys.stderr.write("Error: empty text after sanitization\n")
        sys.exit(1)

    sibling_voice = "vi-VN-NamMinhNeural" if "HoaiMy" in voice else "vi-VN-HoaiMyNeural"

    # Multi-tier fallback strategy maintaining studio-quality Neural TTS
    strategies = [
        (voice, rate),
        (voice, "+0%"),
        (voice, "+6%"),
        (sibling_voice, "+0%"),
    ]

    last_error = None
    for attempt_idx, (v, r) in enumerate(strategies):
        try:
            comm = edge_tts.Communicate(clean_text, v, rate=r)
            await comm.save(output_path)
            if os.path.exists(output_path) and os.path.getsize(output_path) > 300:
                # Successfully synthesized audio
                return
        except Exception as e:
            last_error = e
            await asyncio.sleep(0.4)

    if last_error:
        sys.stderr.write(f"TTS synthesis error after all tiers: {last_error}\n")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
