import React from 'react'
import { SceneContainer } from '../components/SceneContainer'
import { SceneLabel } from '../components/SceneLabel'
import { SceneHeadline } from '../components/SceneHeadline'
import { SupportText } from '../components/SupportText'

interface ProblemSceneProps {
  label?: string
  headline: string
  supportText?: string
  backgroundUrl?: string
  problemPoints?: string[]
}

export const ProblemScene: React.FC<ProblemSceneProps> = ({
  label = 'VẤN ĐỀ HAY GẶP',
  headline,
  supportText,
  backgroundUrl,
  problemPoints = ['Dễ ẩm mốc', 'Khó lấy thìa', 'Bừa bộn gian bếp'],
}) => {
  return (
    <SceneContainer backgroundUrl={backgroundUrl} backgroundDim={0.7} backgroundBlur={2}>
      {/* Top Header Block */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
          marginTop: 20,
        }}
      >
        <SceneLabel text={label} color="rose" />
        <SceneHeadline text={headline} />
        {supportText && <SupportText text={supportText} />}
      </div>

      {/* Middle Context Visual: Clean problem focus (No product hero yet) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '24px 36px',
          borderRadius: 28,
          background: 'rgba(9, 9, 11, 0.65)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1 }}>⚠️</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {problemPoints.map((point, idx) => (
            <span
              key={idx}
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#fda4af',
                padding: '6px 14px',
                borderRadius: 9999,
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
              }}
            >
              • {point}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom breathing space */}
      <div style={{ height: 40 }} />
    </SceneContainer>
  )
}
