/**
 * MapBounds defines the rectangular area of the world that players can walk in.
 *
 * Adjust WALKABLE_BOUNDS to match the actual floor area inside LesesalBirdView.png.
 * Coordinates are in world-space pixels (same coordinate system as entity positions).
 *
 * A visual debug overlay can be enabled in Scene.ts to see the bounding box.
 */

export interface MapBounds {
  /** Left edge of the walkable area (world X) */
  minX: number;
  /** Top edge of the walkable area (world Y) */
  minY: number;
  /** Right edge of the walkable area (world X) */
  maxX: number;
  /** Bottom edge of the walkable area (world Y) */
  maxY: number;
}

/**
 * The walkable floor area within the study hall image.
 * Tweak these four values to tighten/loosen the boundary.
 *
 * Default: a 30px inset from each edge of the image, so players
 * can't walk over the walls.  Adjust to taste once you see the map.
 */
export const WALKABLE_BOUNDS: MapBounds = {
  minX: 30,
  minY: 30,
  maxX: 2500, // will be clamped to worldWidth  if smaller
  maxY: 1080,  // will be clamped to worldHeight if smaller
};

/**
 * Return a bounds object that fills the entire world (no restriction).
 * Useful for testing without a real map image.
 */
export function fullWorldBounds(worldW: number, worldH: number): MapBounds {
  return { minX: 0, minY: 0, maxX: worldW, maxY: worldH };
}
