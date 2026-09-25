import { DoubleSide, ExtrudeGeometry, Mesh, MeshBasicMaterial, Path, ShadowMaterial, Shape, ShapeGeometry } from 'three';
import type { Vector3 } from 'three';

// Invisible depth geometry registered to the ImageGen plate, not a visible case model.
// Pixel coordinates refer to workshop-v4.webp (1024 × 1536), clockwise from rear-left.
const FOAM = [[443, 1065], [920, 1065], [962, 1212], [406, 1212]] as const;
const APERTURES = [
  [[492, 1076], [597, 1077], [582, 1197], [465, 1197]],
  [[638, 1076], [750, 1077], [756, 1198], [630, 1198]],
  [[790, 1077], [902, 1078], [928, 1199], [800, 1199]],
] as const;

/** Leave the case footprint to its own mouth/wall shadow receivers. A flat
 * worktop receiver through the holes would put a shadow above the stored item. */
export function createWorktopShadowGeometry(onTable: (u: number, v: number) => Vector3): ShapeGeometry {
  const outline = new Shape();
  outline.moveTo(-2.5, -2.5); outline.lineTo(2.5, -2.5);
  outline.lineTo(2.5, 2.5); outline.lineTo(-2.5, 2.5); outline.closePath();
  const hole = new Path();
  FOAM.forEach(([x, y], index) => {
    const point = onTable(x / 1024, y / 1536);
    if (index === 0) hole.moveTo(point.x, -point.z);
    else hole.lineTo(point.x, -point.z);
  });
  hole.closePath(); outline.holes.push(hole);
  return new ShapeGeometry(outline);
}

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
  // Keep opaque depth before the props, then blend only real shadow coverage
  // over the ImageGen foam/walls. No generated case pixels are replaced.
  const contact = new Mesh(depth.geometry, new ShadowMaterial({ opacity: 0.52, depthWrite: false, side: DoubleSide, forceSinglePass: true }));
  contact.name = 'case-contact-shadow';
  contact.receiveShadow = true;
  depth.add(contact);
  return depth;
}
