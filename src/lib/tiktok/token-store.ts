import fs from 'node:fs/promises'
import path from 'node:path'
import { TikTokTokenData } from './types'

export interface TokenStore<T> {
  get(): Promise<T | null>
  set(data: T): Promise<void>
  clear(): Promise<void>
}

/**
 * File-based token storage for local / tmp persistence.
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
      // ignore
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
      // ignore
    }
  }
}

/**
 * Hybrid token store for Serverless (Vercel) & local development.
 * Combines httpOnly session cookie with file/memory storage so all serverless instances
 * share the active authorized token seamlessly.
 */
export class HybridTokenStore implements TokenStore<TikTokTokenData> {
  private fileStore = new FileTokenStore<TikTokTokenData>('tiktok-token.json')

  async get(): Promise<TikTokTokenData | null> {
    // 1. Try reading from httpOnly request cookie
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const raw = cookieStore.get('tiktok_token_session')?.value
      if (raw) {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8')
        const parsed = JSON.parse(decoded) as TikTokTokenData
        if (parsed?.accessToken) {
          // Sync with file/memory
          void this.fileStore.set(parsed)
          return parsed
        }
      }
    } catch {
      // Fallback if called outside Next.js request context
    }

    // 2. Fallback to file/memory storage
    return this.fileStore.get()
  }

  async set(data: TikTokTokenData): Promise<void> {
    // Save to file & memory
    await this.fileStore.set(data)

    // Save to httpOnly cookie if inside request context
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const base64 = Buffer.from(JSON.stringify(data)).toString('base64')
      cookieStore.set('tiktok_token_session', base64, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 3600, // 30 days
      })
    } catch {
      // Ignore if outside request context
    }
  }

  async clear(): Promise<void> {
    await this.fileStore.clear()

    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      cookieStore.delete('tiktok_token_session')
    } catch {
      // Ignore
    }
  }
}

// Singleton instance for TikTok User Token Store
export const tikTokTokenStore = new HybridTokenStore()
