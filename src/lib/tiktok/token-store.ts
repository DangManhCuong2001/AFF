import fs from 'node:fs/promises'
import path from 'node:path'
import { TikTokTokenData } from './types'

export interface TokenStore<T> {
  get(): Promise<T | null>
  set(data: T): Promise<void>
  clear(): Promise<void>
}

/**
 * File-based token storage for local POC single-user development.
 * Automatically saves to .data/ directory in server workspace.
 * Ready to be swapped with DB (Postgres, Supabase, Redis, etc.) in production.
 */
export class FileTokenStore<T> implements TokenStore<T> {
  private filePath: string
  private memoryCache: T | null = null

  constructor(fileName: string) {
    const baseDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data')
    this.filePath = path.join(baseDir, fileName)
  }

  private async ensureDir() {
    const dir = path.dirname(this.filePath)
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      // ignore if exists
    }
  }

  async get(): Promise<T | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(content) as T
      this.memoryCache = parsed
      return parsed
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'ENOENT') {
        return this.memoryCache
      }
      return this.memoryCache
    }
  }

  async set(data: T): Promise<void> {
    this.memoryCache = data
    try {
      await this.ensureDir()
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[TokenStore] Failed writing token to file, kept in memory cache:', err)
    }
  }

  async clear(): Promise<void> {
    this.memoryCache = null
    try {
      await fs.unlink(this.filePath)
    } catch {
      // file might not exist
    }
  }
}

// Singleton instance for TikTok User Token Store
export const tikTokTokenStore = new FileTokenStore<TikTokTokenData>('tiktok-token.json')
