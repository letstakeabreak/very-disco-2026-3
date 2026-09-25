import { describe, expect, it } from 'vitest';
import { Color, Matrix4, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { createDebris } from '../../src/render/debris';

const BED = { x: 0.02, y: 0.378, z: -0.09 };
function chips(debris: ReturnType<typeof createDebris>): Vector3[] {
  const matrix = new Matrix4();
  return Array.from({ length: debris.mesh.count }, (_, index) => {
    debris.mesh.getMatrixAt(index, matrix);
    return new Vector3().setFromMatrixPosition(matrix);
  });
}

describe('press debris driven only by snapshot damage', () => {
  it('shows nothing for an intact or absent specimen and the full spill on failure', () => {
    const debris = createDebris(BED);
    debris.update('salvage-cassette', 0, 0.12);
    expect(debris.mesh.visible).toBe(false); expect(debris.mesh.count).toBe(0);
    debris.update('salvage-cassette', 1, 0.12);
    expect(debris.mesh.visible).toBe(true); expect(debris.mesh.count).toBe(24);
    debris.update(null, 1, 0.12);
    expect(debris.mesh.visible).toBe(false); expect(debris.mesh.count).toBe(0);
    for (const damage of [NaN, -1]) { debris.update('salvage-core', damage, 0.12); expect(debris.mesh.count).toBe(0); }
  });

  it('reveals more chips as damage grows and keeps a fixed pile for the same damage', () => {
    const debris = createDebris(BED);
    let previous = 0;
    for (const damage of [0.05, 0.2, 0.4, 0.6, 0.8, 1]) {
      debris.update('salvage-lens', damage, 0.1);
      expect(debris.mesh.count).toBeGreaterThanOrEqual(previous);
      previous = debris.mesh.count;
    }
    debris.update('salvage-lens', 0.5, 0.1); const first = chips(debris);
    const again = createDebris(BED); again.update('salvage-lens', 0.5, 0.1);
    expect(chips(again)).toEqual(first);
  });

  it('rests chips on the bed around the footprint, mostly toward the camera', () => {
    const debris = createDebris(BED);
    debris.update('salvage-core', 1, 0.1);
    const points = chips(debris);
    for (const point of points) {
      expect(point.y).toBeGreaterThan(BED.y); expect(point.y).toBeLessThan(BED.y + 0.03);
      const radius = Math.hypot(point.x - BED.x, point.z - BED.z);
      expect(radius).toBeGreaterThan(0.075); expect(radius).toBeLessThan(0.23);
    }
    expect(points.filter((point) => point.z > BED.z).length).toBeGreaterThan(points.length * 0.8);
  });

  it('uses each salvage material palette', () => {
    const debris = createDebris(BED);
    const first = new Color();
    debris.update('salvage-cassette', 1, 0.1); debris.mesh.getColorAt(0, first);
    const ceramic = first.clone();
    debris.update('salvage-lens', 1, 0.1); debris.mesh.getColorAt(0, first);
    expect(first.equals(ceramic)).toBe(false);
    expect((debris.mesh.material as MeshStandardMaterial).metalness).toBe(0);
    debris.update('salvage-core', 1, 0.1);
    expect((debris.mesh.material as MeshStandardMaterial).metalness).toBeGreaterThan(0.5);
  });
});
