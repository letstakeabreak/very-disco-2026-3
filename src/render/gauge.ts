import { CircleGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Shape, ShapeGeometry } from 'three';
import type { Texture } from 'three';

/** Press-local meters measured against the runtime bezel; the image has no baked needle. */
export function createGauge(texture: Texture): { root: Group; setPressure(pressure01: number): void } {
  const root = new Group();
  root.name = 'pressure-gauge';
  const dial = new Mesh(new PlaneGeometry(0.250, 0.115), new MeshBasicMaterial({ map: texture, toneMapped: false }));
  dial.name = 'pressure-dial';
  dial.position.set(0.015, 0.9635, 0.014);
  root.add(dial);

  const needle = new Group();
  needle.name = 'pressure-needle';
  // Image pivot is (0.5, 0.93) measured from its upper-left corner.
  needle.position.set(0.015, 0.91405, 0.0146);
  const shape = new Shape();
  shape.moveTo(-0.002, 0); shape.lineTo(0.002, 0);
  shape.lineTo(0.001, 0.071); shape.lineTo(0, 0.080);
  shape.lineTo(-0.001, 0.071); shape.closePath();
  const ink = new MeshBasicMaterial({ color: '#11191a', toneMapped: false });
  const pointer = new Mesh(new ShapeGeometry(shape), ink);
  pointer.name = 'pressure-needle-pointer';
  needle.add(pointer);
  // A pale center remains readable over the dial's dark inner arc; the dark outline reads over amber.
  const center = new Shape();
  center.moveTo(-0.00075, 0); center.lineTo(0.00075, 0);
  center.lineTo(0.00045, 0.069); center.lineTo(0, 0.076);
  center.lineTo(-0.00045, 0.069); center.closePath();
  const stripe = new Mesh(new ShapeGeometry(center), new MeshBasicMaterial({ color: '#eddfac', toneMapped: false }));
  stripe.name = 'pressure-needle-center'; stripe.position.z = 0.0001;
  needle.add(stripe);
  const hub = new Mesh(new CircleGeometry(0.004, 16), ink);
  hub.name = 'pressure-needle-hub'; hub.position.z = 0.0002;
  needle.add(hub); root.add(needle);

  function setPressure(pressure01: number): void {
    needle.rotation.z = (80 - 160 * Math.min(1, Math.max(0, pressure01))) * Math.PI / 180;
  }
  setPressure(0);
  return { root, setPressure };
}
