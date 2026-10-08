import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface SceneLabelProps {
  text: string
  color?: 'amber' | 'rose' | 'emerald' | 'cyan' | 'neutral'
}

export const SceneLabel: React.FC<SceneLabelProps> = ({
  text,
  color = 'amber',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  })

  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [-8, 0])

  const colorStyles = {
    amber: {
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.35)',
      text: '#fbbf24',
      dot: '#f59e0b',
    },
    rose: {
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.35)',
      text: '#fda4af',
      dot: '#f43f5e',
    },
    emerald: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)',
      text: '#6ee7b7',
      dot: '#10b981',
    },
    cyan: {
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.35)',
      text: '#67e8f9',
      dot: '#06b6d4',
    },
    neutral: {
      bg: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.18)',
      text: 'rgba(255, 255, 255, 0.85)',
      dot: '#e4e4e7',
    },
  }[color]

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 9999,
        backgroundColor: colorStyles.bg,
        border: `1px solid ${colorStyles.border}`,
        opacity,
        transform: `translateY(${translateY}px)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: colorStyles.dot,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colorStyles.text,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </div>
  )
}
