import { Color, Euler, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { SalvageId } from '../contracts';

const SHARDS = 24;
// The platen hides the specimen top; the bed in front of it stays visible.
const FORWARD = 1.5;
// Chip palette per salvage material: bare steel/copper, glass, ceramic/amber.
const LOOKS: Readonly<Record<SalvageId, { colors: readonly [string, string]; metalness: number; roughness: number }>> = {
  'salvage-core': { colors: ['#b9b3a6', '#b8733d'], metalness: 0.85, roughness: 0.38 },
  'salvage-lens': { colors: ['#cfe9e4', '#8fb9b5'], metalness: 0, roughness: 0.08 },
  'salvage-cassette': { colors: ['#e8e1d0', '#d49a3a'], metalness: 0.05, roughness: 0.55 },
};

type Shard = { threshold: number; angle: number; reach: number; size: number; spin: Quaternion };
export type Debris = { mesh: InstancedMesh; update(id: SalvageId | null, damage: number, footprintRadius: number): void };

/**
 * Authored chips spilled on the press bed, revealed by snapshot damage only.
 * The layout is fixed so the same damage always shows the same pile; it is
 * readable past the platen, which hides most of a crushed specimen.
 */
export function createDebris(bed: Readonly<{ x: number; y: number; z: number }>): Debris {
  let seed = 0x2f6b;
  const next = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 0x100000000; };
  const shards: Shard[] = Array.from({ length: SHARDS }, (_, index) => ({
    // Staggered so light damage shows a few chips and failure shows the full spill.
    threshold: 0.04 + (index / SHARDS) * 0.82,
    // A fan over the open bed in front of the specimen (+Z faces the camera).
    // Stratified angles keep each damage step spread across the fan.
    angle: Math.PI / 2 + (((index * 7) % SHARDS) / (SHARDS - 1) - 0.5) * Math.PI * 1.1 + (next() - 0.5) * 0.15,
    reach: 0.8 + next() * 0.7,
    size: 0.013 + next() * 0.017,
    spin: new Quaternion().setFromEuler(new Euler((next() - 0.5) * 0.7, next() * Math.PI * 2, (next() - 0.5) * 0.7)),
  }));
  const material = new MeshStandardMaterial({ flatShading: true, envMapIntensity: 1.35 });
  const mesh = new InstancedMesh(new IcosahedronGeometry(0.5, 0), material, SHARDS);
  mesh.name = 'press-debris';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.count = 0;
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const color = new Color();
  let shownId: SalvageId | null = null;

  function update(id: SalvageId | null, damage: number, footprintRadius: number): void {
    const amount = id === null || !Number.isFinite(damage) ? 0 : Math.min(1, Math.max(0, damage));
    let count = 0;
    for (const [index, shard] of shards.entries()) {
      const t = Math.min(1, Math.max(0, (amount - shard.threshold) / 0.12));
      const reveal = t * t * (3 - 2 * t);
      if (reveal <= 0) break;
      // Chips slide out from under the specimen as the committed damage eases in.
      const radius = footprintRadius * shard.reach * (0.7 + 0.3 * reveal);
      scale.set(shard.size, shard.size * 0.45, shard.size * 0.8).multiplyScalar(reveal);
      position.set(bed.x + Math.cos(shard.angle) * radius, bed.y + scale.y * 0.5, bed.z + Math.sin(shard.angle) * radius * FORWARD);
      mesh.setMatrixAt(index, matrix.compose(position, shard.spin, scale));
      count = index + 1;
    }
    if (id !== null && id !== shownId) {
      const look = LOOKS[id];
      material.metalness = look.metalness; material.roughness = look.roughness;
      for (let index = 0; index < SHARDS; index += 1) mesh.setColorAt(index, color.set(look.colors[index % 3 === 2 ? 1 : 0]));
      mesh.instanceColor!.needsUpdate = true;
      shownId = id;
    }
    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}
