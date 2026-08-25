import type { CharacterId } from './characters'

/**
 * Draws a character's body art centred on the current origin. Callers set the
 * translation; `angle` only orients the small facing details (helmet, wrench).
 */
export function drawCharacterSkin(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  r: number,
  angle: number,
  hurt: boolean
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.clip()

  switch (id) {
    case 'nature-lover':
      natureLover(ctx, r)
      break
    case 'army-retiree':
      armyRetiree(ctx, r)
      break
    case 'medic':
      medic(ctx, r)
      break
    case 'engineer':
      engineer(ctx, r)
      break
  }

  if (hurt) {
    ctx.fillStyle = 'rgba(255,80,80,0.55)'
    ctx.fillRect(-r, -r, r * 2, r * 2)
  }
  ctx.restore()

  // Facing accessories sit outside the clip so they can overhang the body.
  ctx.save()
  ctx.rotate(angle)
  if (id === 'army-retiree') helmet(ctx, r)
  if (id === 'engineer') wrench(ctx, r)
  ctx.restore()

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(8,15,10,0.9)'
  ctx.lineWidth = 2.5
  ctx.stroke()
}

function natureLover(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#3f7d3a'
  ctx.fillRect(-r, -r, r * 2, r * 2)
  const blotches: [number, number, number, string][] = [
    [-0.45, -0.35, 0.42, '#2c5c2a'],
    [0.4, -0.15, 0.36, '#6b4a24'],
    [-0.15, 0.45, 0.4, '#2c5c2a'],
    [0.35, 0.5, 0.3, '#8a6a33'],
  ]
  for (const [bx, by, br, color] of blotches) {
    ctx.beginPath()
    ctx.ellipse(bx * r, by * r, br * r, br * r * 0.8, bx, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
  // Leaf sprigs
  ctx.strokeStyle = '#9fd67a'
  ctx.lineWidth = 1.6
  for (const a of [-0.9, 0.1, 1.4]) {
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(-r * 0.5, 0)
    ctx.lineTo(r * 0.5, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(r * 0.15, -r * 0.18, r * 0.26, r * 0.12, -0.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(159,214,122,0.85)'
    ctx.fill()
    ctx.restore()
  }
}

function armyRetiree(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#5d6b34'
  ctx.fillRect(-r, -r, r * 2, r * 2)
  const stripes: [number, string][] = [
    [-0.7, '#c8b072'],
    [-0.25, '#3f4a22'],
    [0.2, '#c8b072'],
    [0.62, '#3f4a22'],
  ]
  ctx.save()
  ctx.rotate(-0.5)
  for (const [offset, color] of stripes) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, offset * r, r * 1.6, r * 0.19, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function helmet(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.72, Math.PI * 1.15, Math.PI * 1.85)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fillStyle = '#2f3a1c'
  ctx.fill()
  ctx.strokeStyle = '#141a0c'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function medic(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#f5f7fb'
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.fillStyle = 'rgba(148,163,184,0.35)'
  ctx.fillRect(-r, r * 0.55, r * 2, r * 0.45)
  ctx.fillStyle = '#dc2626'
  const arm = r * 0.72
  const thick = r * 0.26
  ctx.fillRect(-thick / 2, -arm, thick, arm * 2)
  ctx.fillRect(-arm, -thick / 2, arm * 2, thick)
}

function engineer(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#facc15'
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.fillStyle = '#3f3f46'
  ctx.fillRect(-r, -r * 0.62, r * 2, r * 0.2)
  ctx.fillRect(-r, r * 0.42, r * 2, r * 0.2)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(-r * 0.24, -r, r * 0.2, r * 2)
  ctx.fillRect(r * 0.06, -r, r * 0.2, r * 2)
}

function wrench(ctx: CanvasRenderingContext2D, r: number) {
  ctx.save()
  ctx.rotate(-Math.PI / 2)
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = r * 0.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.15)
  ctx.lineTo(0, r * 0.95)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -r * 0.25, r * 0.3, Math.PI * 0.25, Math.PI * 1.75)
  ctx.stroke()
  ctx.restore()
}
