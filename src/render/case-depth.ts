import { DoubleSide, ExtrudeGeometry, Mesh, MeshBasicMaterial, Path, Shape } from 'three';
import type { Vector3 } from 'three';

// Invisible depth geometry registered to the ImageGen plate, not a visible case model.
// Pixel coordinates refer to workshop-v4.webp (1024 × 1536), clockwise from rear-left.
const FOAM = [[443, 1065], [920, 1065], [962, 1212], [406, 1212]] as const;
const APERTURES = [
  [[492, 1076], [597, 1077], [582, 1197], [465, 1197]],
  [[638, 1076], [750, 1077], [756, 1198], [630, 1198]],
  [[790, 1077], [902, 1078], [928, 1199], [800, 1199]],
] as const;

export function createCaseDepth(onTable: (u: number, v: number) => Vector3): Mesh<ExtrudeGeometry, MeshBasicMaterial> {
  const outline = new Shape();
  const trace = (path: Path, polygon: readonly (readonly [number, number])[]): void => {
    polygon.forEach(([x, y], index) => {
      const point = onTable(x / 1024, y / 1536);
      if (index === 0) path.moveTo(point.x, point.z);
      else path.lineTo(point.x, point.z);
    });
    path.closePath();
  };
  trace(outline, FOAM);
  for (const aperture of APERTURES) {
    const hole = new Path(); trace(hole, aperture); outline.holes.push(hole);
  }
  // The below-mouth walls stop hidden ends reappearing through the case fascia.
  const depth = new Mesh(new ExtrudeGeometry(outline, { depth: 0.16, steps: 1, bevelEnabled: false }),
    new MeshBasicMaterial({ colorWrite: false, side: DoubleSide }));
  depth.name = 'case-foam-depth';
  depth.rotation.x = Math.PI / 2;
  depth.position.y = onTable(0.5, 0.75).y;
  depth.renderOrder = -1;
  return depth;
}
