# Needle-free pressure dial

Built-in ImageGen, 2026-09-24. Style reference: `docs/art/concepts/04-press-chamber-reference.png`. The generated face contains no pointer; a functional renderer-owned pointer reads the authoritative snapshot pressure.

```text
Use case: product-mockup
Asset type: production game texture for an inset analog hydraulic pressure gauge.
Input image: style reference ONLY, the generated hydraulic press. Create ONLY its amber needle-free dial face as a flat texture, not the machine.
Composition: a perfectly orthographic front facing rectangular 2:1 image. A large upward semicircle fills the width; its center and imaginary needle pivot are exactly at horizontal midpoint, 94% down the image. Outer arc near the top edge. Tight crop, no perspective, no surrounding machine.
Materials: subtly worn warm amber ivory enamel, fine dark brown evenly spaced radial ticks following a 160 degree upper arc. A darker brown inset small semicircle in lower center, subtle hairline scratches and fine material grain, restrained warm glow.
Critical: entirely needle-free. No needle, no pointer, no central vertical line, no hub, no numbers, no letters, no writing, no text, no logos, no watermark. Opaque image; any tiny area outside the upper semicircle is very dark brown-black so the texture can sit behind the existing metal bezel. Uniform face illumination with no baked directional shadows or bright hotspot. The separate functional needle will be rendered in code.
```
