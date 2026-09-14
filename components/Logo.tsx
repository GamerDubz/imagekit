interface LogoProps {
  size?: number
  className?: string
  monochrome?: boolean
}

/**
 * Original aperture-blade mark: five overlapping rounded blades arranged in
 * rotational symmetry around a shared center, evoking a lens iris without
 * copying a literal camera-aperture icon. Pure geometry (paths only), so it
 * stays crisp from 16px favicons up to 512px hero use.
 */
export function Logo({ size = 32, className, monochrome = false }: LogoProps) {
  const blades = Array.from({ length: 5 }, (_, i) => i * 72)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ImageKit"
    >
      <circle cx="24" cy="24" r="23" fill={monochrome ? 'currentColor' : 'var(--color-surface)'} fillOpacity={monochrome ? 0 : 1} stroke={monochrome ? 'currentColor' : 'var(--color-border)'} strokeWidth="1" />
      <g transform="translate(24,24)">
        {blades.map((angle, i) => (
          <path
            key={angle}
            d="M0 -2.5 C 6 -3.5, 14 -8, 17.5 -16 C 19.5 -11, 19.5 -4, 15.5 1.5 C 10.5 0.5, 4 -0.5, 0 -2.5 Z"
            fill={monochrome ? 'currentColor' : i % 2 === 0 ? 'var(--color-ink)' : 'var(--color-accent)'}
            fillOpacity={monochrome ? 0.92 - i * 0.06 : 1}
            transform={`rotate(${angle})`}
          />
        ))}
        <circle r="4" fill={monochrome ? 'var(--color-surface, #fff)' : 'var(--color-bg)'} />
      </g>
    </svg>
  )
}
