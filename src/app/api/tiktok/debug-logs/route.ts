import { NextResponse } from 'next/server'
import { getRecentDebugLogs, clearDebugLogs } from '@/lib/tiktok/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logs = getRecentDebugLogs()
  return NextResponse.json({ logs })
}

export async function DELETE() {
  clearDebugLogs()
  return NextResponse.json({ success: true })
}
