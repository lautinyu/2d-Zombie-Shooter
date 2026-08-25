/** Visual style chosen on the intro splash; gameplay is identical for both. */
export type TexturePack = 'classic' | 'enhanced'

export const TEXTURE_PACKS: { id: TexturePack; name: string; blurb: string }[] = [
  {
    id: 'classic',
    name: 'Classic 2D Textures',
    blurb: 'Flat shapes — circles for people, solid colour blocks for buildings.',
  },
  {
    id: 'enhanced',
    name: 'Enhanced 3D Textures',
    blurb: 'Blocky buildings with lit tops and side faces, plus drop shadows under every unit.',
  },
]

/** Roof offset per pixel of distance from the view centre, in the 3D pack. */
export const BUILDING_HEIGHT = 0.06
/** Hard cap on that offset so far blocks stay glued to their footprint. */
export const MAX_BUILDING_LIFT = 26
/** Ground shadow offset for standing units. */
export const UNIT_LIFT = 5
