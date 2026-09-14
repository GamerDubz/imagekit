import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

export default function AppleIcon() {
  const blade = (rotate: number, fill: string) => (
    <div
      key={rotate}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 4,
        height: 4,
        display: 'flex',
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 14,
          height: 62,
          background: fill,
          borderRadius: '50% 50% 40% 40% / 60% 60% 40% 40%',
          top: -60,
          left: -5,
          display: 'flex',
        }}
      />
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f5fb',
        }}
      >
        <div style={{ position: 'relative', width: 130, height: 130, display: 'flex' }}>
          {blade(0, '#2a2630')}
          {blade(72, '#ff5f4d')}
          {blade(144, '#2a2630')}
          {blade(216, '#ff5f4d')}
          {blade(288, '#2a2630')}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 26,
              height: 26,
              background: '#f7f5fb',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
