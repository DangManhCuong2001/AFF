import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  href?: string
  className?: string
}

export function BrandLogo({
  size = 'md',
  showText = true,
  href = '/',
  className = '',
}: BrandLogoProps) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 48 : 40
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl'
  const subSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  const content = (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0 rounded-xl overflow-hidden shadow-lg shadow-rose-500/20 border border-white/10">
        <Image
          src="/vipee-icon-512.png"
          alt="Vipee Logo"
          width={dim}
          height={dim}
          priority
          className="object-cover"
        />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-black tracking-tight text-white ${textSize} flex items-center gap-1.5`}>
            Vipee
            <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Studio
            </span>
          </span>
          <span className={`text-neutral-400 font-medium ${subSize}`}>
            AI Video for TikTok &amp; Commerce
          </span>
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition">
        {content}
      </Link>
    )
  }

  return content
}
