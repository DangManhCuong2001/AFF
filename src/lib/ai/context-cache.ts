import {mkdir, readFile, readdir, rename, stat, unlink, writeFile} from 'node:fs/promises'
import path from 'node:path'

const cacheDirectory = () => path.join(process.cwd(), '.data', 'context-images')
const validKey = (key: string) => /^[a-f0-9]{64}$/.test(key)
const validImage = (image: Buffer) => image.length > 4 && image.length < 450_000 && image[0] === 0xff && image[1] === 0xd8 && image.at(-2) === 0xff && image.at(-1) === 0xd9

/** Only successfully generated images enter this private, bounded local cache. */
export async function readCachedContext(key: string, directory = cacheDirectory()): Promise<Buffer | undefined> {
  if (!validKey(key)) return undefined
  try {
    const image = await readFile(path.join(directory, `${key}.jpg`))
    return validImage(image) ? image : undefined
  } catch {return undefined}
}

export async function writeCachedContext(key: string, image: Buffer, directory = cacheDirectory()): Promise<void> {
  if (!validKey(key) || !validImage(image)) return
  try {
    await mkdir(directory, {recursive: true})
    const temporary = path.join(directory, `${key}-${process.pid}.tmp`)
    await writeFile(temporary, image, {mode: 0o600})
    await rename(temporary, path.join(directory, `${key}.jpg`))
    const files = (await readdir(directory)).filter(name => /^[a-f0-9]{64}\.jpg$/.test(name))
    if (files.length <= 32) return
    const entries = await Promise.all(files.map(async name => ({name, time: (await stat(path.join(directory, name))).mtimeMs})))
    entries.sort((a, b) => a.time - b.time)
    await Promise.allSettled(entries.slice(0, entries.length - 32).map(entry => unlink(path.join(directory, entry.name))))
  } catch {
    // Read-only hosting still uses the existing memory cache and normal flow.
  }
}
