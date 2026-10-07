import sys
import asyncio
import edge_tts

async def main():
    if len(sys.argv) < 4:
        sys.stderr.write("Usage: tts_helper.py <text> <voice> <output_path> [rate]\n")
        sys.exit(1)

    text = sys.argv[1].strip()
    voice = sys.argv[2].strip()
    output_path = sys.argv[3].strip()
    rate = sys.argv[4].strip() if len(sys.argv) > 4 else "+12%"

    if not text:
        sys.stderr.write("Error: empty text\n")
        sys.exit(1)

    for attempt in range(3):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(output_path)
            return
        except Exception as e:
            if attempt == 2:
                raise e
            await asyncio.sleep(0.6)

if __name__ == '__main__':
    asyncio.run(main())
