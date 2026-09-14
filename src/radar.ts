import type { RadarStats } from './weapons'
import { RADAR_AXES } from './weapons'

const MAX_SCORE = 5
const RINGS = 5
const TWO_PI = Math.PI * 2

/**
 * Pentagon radar (spider) chart. Each axis is scored 1-5 and plotted at
 * (score / 5) of the outer radius, so a 4/5 vertex sits at exactly 80%.
 */
export class RadarChart {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private current: number[]
  private target: number[]
  private color = '#4ade80'
  private animating = false
  private size = 260

  constructor(canvas: HTMLCanvasElement, size = 260) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable for radar chart')
    this.ctx = ctx
    this.size = size
    this.current = RADAR_AXES.map(() => 0)
    this.target = RADAR_AXES.map(() => 0)
    this.resize()
    this.draw()
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(this.size * dpr)
    this.canvas.height = Math.floor(this.size * dpr)
    this.canvas.style.width = `${this.size}px`
    this.canvas.style.height = `${this.size}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  setStats(stats: RadarStats, color: string) {
    this.target = RADAR_AXES.map((axis) => clamp(stats[axis.key], 0, MAX_SCORE))
    this.color = color
    if (!this.animating) {
      this.animating = true
      requestAnimationFrame(this.step)
    }
  }

  private step = () => {
    let moving = false
    for (let i = 0; i < this.current.length; i++) {
      const diff = this.target[i] - this.current[i]
      if (Math.abs(diff) < 0.005) {
        this.current[i] = this.target[i]
      } else {
        this.current[i] += diff * 0.18
        moving = true
      }
    }
    this.draw()
    if (moving) {
      requestAnimationFrame(this.step)
    } else {
      this.animating = false
    }
  }

  private vertex(index: number, radius: number) {
    const angle = -Math.PI / 2 + (index * TWO_PI) / RADAR_AXES.length
    return {
      x: this.size / 2 + Math.cos(angle) * radius,
      y: this.size / 2 + Math.sin(angle) * radius,
    }
  }

  private get outerRadius() {
    return this.size / 2 - 56
  }

  private draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.size, this.size)

    // Concentric pentagon rings.
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = (this.outerRadius * ring) / RINGS
      ctx.beginPath()
      RADAR_AXES.forEach((_, i) => {
        const p = this.vertex(i, r)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.strokeStyle = ring === RINGS ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)'
      ctx.lineWidth = ring === RINGS ? 2 : 1
      ctx.stroke()
    }

    // Spokes.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    RADAR_AXES.forEach((_, i) => {
      const p = this.vertex(i, this.outerRadius)
      ctx.beginPath()
      ctx.moveTo(this.size / 2, this.size / 2)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    })

    // Stat polygon.
    ctx.beginPath()
    this.current.forEach((value, i) => {
      const p = this.vertex(i, (this.outerRadius * value) / MAX_SCORE)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.closePath()
    ctx.fillStyle = withAlpha(this.color, 0.32)
    ctx.fill()
    ctx.strokeStyle = this.color
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = this.color
    this.current.forEach((value, i) => {
      const p = this.vertex(i, (this.outerRadius * value) / MAX_SCORE)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.5, 0, TWO_PI)
      ctx.fill()
    })

    // Axis labels with the rounded score.
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    RADAR_AXES.forEach((axis, i) => {
      const p = this.vertex(i, this.outerRadius + 22)
      const dx = p.x - this.size / 2
      ctx.textAlign = Math.abs(dx) < 8 ? 'center' : dx > 0 ? 'right' : 'left'
      if (Math.abs(dx) >= 8) p.x = dx > 0 ? this.size - 2 : 2
      ctx.fillStyle = 'rgba(226,232,240,0.9)'
      ctx.fillText(axis.label, p.x, p.y - 6)
      ctx.fillStyle = 'rgba(148,163,184,0.9)'
      ctx.fillText(`${Math.round(this.target[i])}/${MAX_SCORE}`, p.x, p.y + 7)
    })
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
