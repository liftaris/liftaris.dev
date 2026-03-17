'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useRive,
  useStateMachineInput,
  Layout,
  Fit,
  Alignment,
  type UseRiveParameters,
} from '@rive-app/react-canvas'

const BACKGROUND = '#121317'

const BLOB_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
]

// ---------------------------------------------------------------------------
// SVG Blob path generator — produces organic, wobbly closed shapes
// ---------------------------------------------------------------------------
function blobPath(
  cx: number,
  cy: number,
  r: number,
  points: number,
  wobble: number,
  seed: number,
): string {
  const seededRandom = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 43758.5453
    return x - Math.floor(x)
  }
  const coords: [number, number][] = []
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points
    const offset = r + (seededRandom(i) - 0.5) * wobble * r
    coords.push([cx + Math.cos(angle) * offset, cy + Math.sin(angle) * offset])
  }
  // Catmull-Rom → cubic bezier approximation for smooth closed curve
  let d = `M ${coords[0][0]} ${coords[0][1]} `
  for (let i = 0; i < coords.length; i++) {
    const p0 = coords[(i - 1 + coords.length) % coords.length]
    const p1 = coords[i]
    const p2 = coords[(i + 1) % coords.length]
    const p3 = coords[(i + 2) % coords.length]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]} `
  }
  return d + 'Z'
}

// ---------------------------------------------------------------------------
// Animated SVG blob component with hover interaction
// ---------------------------------------------------------------------------
function AnimatedBlob({
  color,
  label,
  size,
  index,
  onActivate,
}: {
  color: string
  label: string
  size: number
  index: number
  onActivate: () => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const animRef = useRef<number>(0)
  const pathRef = useRef<SVGPathElement>(null)
  const timeRef = useRef(0)

  useEffect(() => {
    const animate = () => {
      timeRef.current += 0.02
      const t = timeRef.current
      if (pathRef.current) {
        // Morph the blob shape over time
        const wobble = hovered ? 0.6 : 0.35
        const pts = hovered ? 10 : 8
        const r = size / 2 - 10
        const d = blobPath(
          size / 2,
          size / 2,
          r,
          pts,
          wobble,
          index * 17 + Math.sin(t + index) * 3,
        )
        pathRef.current.setAttribute('d', d)
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [hovered, size, index])

  const scale = pressed ? 0.9 : hovered ? 1.08 : 1

  return (
    <div
      style={{
        width: size,
        height: size,
        cursor: 'pointer',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: `scale(${scale})`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setPressed(false)
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => {
        setPressed(false)
        onActivate()
      }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <filter id={`glow-${index}`}>
            <feGaussianBlur stdDeviation={hovered ? 8 : 4} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`grad-${index}`}>
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </radialGradient>
        </defs>
        <path
          ref={pathRef}
          fill={`url(#grad-${index})`}
          filter={`url(#glow-${index})`}
          style={{
            transition: 'opacity 0.3s',
            opacity: hovered ? 1 : 0.8,
          }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={size * 0.1}
          fontFamily="system-ui, sans-serif"
          fontWeight={600}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rive embed — demonstrates state machine interaction
// ---------------------------------------------------------------------------
function RiveDemo() {
  const params: UseRiveParameters = {
    src: 'https://cdn.rive.app/animations/vehicles.riv',
    stateMachines: 'bumpy',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  }

  const { rive, RiveComponent } = useRive(params)
  const bumpInput = useStateMachineInput(rive, 'bumpy', 'bump')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 320,
          height: 200,
          borderRadius: 24,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <RiveComponent
          style={{ width: '100%', height: '100%' }}
          onClick={() => bumpInput?.fire()}
        />
      </div>
      <p
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Rive state machine demo — click to trigger &quot;bump&quot;
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Floating animated background blobs (large, blurred, ambient)
// ---------------------------------------------------------------------------
function BackgroundBlobs() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number

    const blobs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 150 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      color: BLOB_COLORS[i % BLOB_COLORS.length],
      phase: Math.random() * Math.PI * 2,
    }))

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const b of blobs) {
        b.x += b.vx
        b.y += b.vy
        b.phase += 0.005
        // Bounce off edges
        if (b.x < -b.r) b.x = canvas.width + b.r
        if (b.x > canvas.width + b.r) b.x = -b.r
        if (b.y < -b.r) b.y = canvas.height + b.r
        if (b.y > canvas.height + b.r) b.y = -b.r

        const pulsedR = b.r + Math.sin(b.phase) * 20
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, pulsedR)
        grad.addColorStop(0, b.color + '18')
        grad.addColorStop(1, b.color + '00')
        ctx.beginPath()
        ctx.arc(b.x, b.y, pulsedR, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        filter: 'blur(80px)',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Activity log for blob interactions
// ---------------------------------------------------------------------------
function useActivityLog() {
  const [log, setLog] = useState<string[]>([])
  const add = useCallback((msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 8))
  }, [])
  return { log, add }
}

// ---------------------------------------------------------------------------
// Navigation blob labels — what these would be in your real site
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { label: 'Home', color: BLOB_COLORS[0] },
  { label: 'Blog', color: BLOB_COLORS[1] },
  { label: 'About', color: BLOB_COLORS[2] },
  { label: 'Work', color: BLOB_COLORS[3] },
  { label: 'Contact', color: BLOB_COLORS[4] },
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function BlobsRivePage() {
  const { log, add } = useActivityLog()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Override body styles for fullscreen dark background (same as /blob page)
  useEffect(() => {
    const prev = {
      padding: document.body.style.padding,
      margin: document.body.style.margin,
      height: document.body.style.height,
      minHeight: document.body.style.minHeight,
      overflow: document.body.style.overflow,
      background: document.body.style.background,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.padding = '0'
    document.body.style.margin = '0'
    document.body.style.height = '100%'
    document.body.style.minHeight = '100%'
    document.body.style.background = BACKGROUND
    return () => {
      document.body.style.padding = prev.padding
      document.body.style.margin = prev.margin
      document.body.style.height = prev.height
      document.body.style.minHeight = prev.minHeight
      document.body.style.overflow = prev.overflow
      document.body.style.background = prev.background
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: BACKGROUND,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: 'white',
        overflow: 'auto',
      }}
    >
      <BackgroundBlobs />

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 20px',
          gap: 48,
          minHeight: '100vh',
        }}
      >
        {/* Header */}
        <header style={{ textAlign: 'center', maxWidth: 600 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              margin: '0 0 12px',
              background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Rive POC — Blob Navigation
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Rive animations require <code>.riv</code> files from the{' '}
            <a
              href="https://editor.rive.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4ECDC4' }}
            >
              Rive Editor
            </a>
            . Below: SVG blobs show the interaction model you&apos;d build, and
            an embedded Rive demo shows runtime state machine capabilities.
          </p>
        </header>

        {/* --- Section 1: Interactive blob navigation --- */}
        <section style={{ textAlign: 'center', width: '100%', maxWidth: 900 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: '0 0 8px',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            Interactive Blob Navigation
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.4)',
              margin: '0 0 24px',
            }}
          >
            SVG blobs with morphing, hover scale, press squish. With Rive,
            these shapes + transitions would be authored in the editor with
            richer motion.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 24,
            }}
          >
            {NAV_ITEMS.map((item, i) => (
              <AnimatedBlob
                key={item.label}
                color={item.color}
                label={item.label}
                size={140}
                index={i}
                onActivate={() => {
                  setSelectedIndex(i)
                  add(`Navigated to "${item.label}"`)
                }}
              />
            ))}
          </div>

          {/* Selected state indicator */}
          {selectedIndex !== null && (
            <div
              style={{
                marginTop: 20,
                padding: '10px 20px',
                borderRadius: 12,
                background: NAV_ITEMS[selectedIndex].color + '22',
                border: `1px solid ${NAV_ITEMS[selectedIndex].color}44`,
                display: 'inline-block',
                transition: 'all 0.3s ease',
              }}
            >
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                Active: {NAV_ITEMS[selectedIndex].label}
              </span>
            </div>
          )}
        </section>

        {/* --- Section 2: Rive runtime demo --- */}
        <section style={{ textAlign: 'center', width: '100%', maxWidth: 600 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: '0 0 8px',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            Rive Runtime Integration
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.4)',
              margin: '0 0 24px',
            }}
          >
            The vehicles.riv demo from Rive&apos;s CDN, playing a state machine.
            Click the truck to trigger the &quot;bump&quot; input. This is the
            same mechanism you&apos;d use for blob hover/click states.
          </p>
          <RiveDemo />
        </section>

        {/* --- Section 3: What Rive would bring --- */}
        <section style={{ textAlign: 'center', width: '100%', maxWidth: 700 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: '0 0 16px',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            What Rive Brings vs. Code-Only
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              textAlign: 'left',
            }}
          >
            <ComparisonCard
              title="With Rive Editor"
              items={[
                'Designer-authored organic blob shapes',
                'Complex state machines (idle → hover → press → active)',
                'Smooth bone-based deformations',
                'Mesh-based squish and stretch',
                'Blend states for mixing animations',
                'Data binding for dynamic content',
                'Tiny .riv file sizes (~5-50KB)',
              ]}
              accent="#4ECDC4"
            />
            <ComparisonCard
              title="Code-Only (current)"
              items={[
                'Procedural shapes via math',
                'Manual state management in React',
                'Simple scale/morph transitions',
                'No bone/mesh deformation',
                'Physics simulation for organic feel',
                'More control, more code to maintain',
                'No external editor dependency',
              ]}
              accent="#FF6B6B"
            />
          </div>
        </section>

        {/* Activity log */}
        {log.length > 0 && (
          <section
            style={{
              width: '100%',
              maxWidth: 400,
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
                margin: '0 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Activity
            </h3>
            {log.map((msg, i) => (
              <div
                key={`${msg}-${i}`}
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.4)',
                  padding: '4px 0',
                  opacity: 1 - i * 0.1,
                }}
              >
                {msg}
              </div>
            ))}
          </section>
        )}

        {/* Footer note */}
        <footer
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            textAlign: 'center',
            padding: '20px 0 40px',
            maxWidth: 500,
            lineHeight: 1.6,
          }}
        >
          To fully realize Rive blobs: open{' '}
          <a
            href="https://editor.rive.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#4ECDC4' }}
          >
            editor.rive.app
          </a>
          , create blob shapes with state machines for idle/hover/press/active
          states, export as <code>.riv</code>, and drop them into this page.
          The runtime handles playback, interaction, and state transitions.
        </footer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comparison card component
// ---------------------------------------------------------------------------
function ComparisonCard({
  title,
  items,
  accent,
}: {
  title: string
  items: string[]
  accent: string
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent}33`,
      }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: accent,
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <ul
        style={{
          margin: 0,
          padding: '0 0 0 16px',
          listStyle: 'none',
        }}
      >
        {items.map((item) => (
          <li
            key={item}
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
              padding: '3px 0',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: -14,
                color: accent,
              }}
            >
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
