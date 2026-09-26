import type { GameConfig, SalvageId, SpecimenDefinition } from '../contracts';
import { assertConfig, deepFreeze } from '../contracts/validate';

type Band = readonly [number, number];

/** PRD v1.2 base lot; each day varies it inside these bands. Tolerance stays tied to the material. */
const BASE_SPECIMENS: readonly (SpecimenDefinition & { readonly safeBand: Band })[] = [
  { id: 'salvage-core', material: 'metal', initialVolume: 0.82, minimumVolume: 0.2, baseValue: 260, safePressure01: 0.8, tolerance: 'sturdy', safeBand: [0.72, 0.86] },
  { id: 'salvage-lens', material: 'glass', initialVolume: 0.52, minimumVolume: 0.24, baseValue: 450, safePressure01: 0.38, tolerance: 'fragile', safeBand: [0.3, 0.45] },
  { id: 'salvage-cassette', material: 'composite', initialVolume: 0.64, minimumVolume: 0.18, baseValue: 340, safePressure01: 0.62, tolerance: 'normal', safeBand: [0.55, 0.7] },
];

const BASE_CONFIG = {
  capacity: 1,
  pressRatePerSecond: 0.25,
  settleDurationMs: 300,
  collectionBonus: 100,
  initialEntities: [{
    id: 'press-chamber', assetId: 'press-chamber',
    position: { x: 0, y: 0, z: 0 }, rotationRad: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  }],
} as const;

/** Committed result of pressing a lot to `pressure01` (PRD v1 formulas). The core commits with this. */
export function lotOutcome(definition: SpecimenDefinition, pressure01: number): { currentVolume: number; integrity01: number; value: number } {
  const currentVolume = definition.initialVolume - (definition.initialVolume - definition.minimumVolume) * pressure01;
  const damage = pressure01 <= definition.safePressure01
    ? 0
    : Math.min(1, ((pressure01 - definition.safePressure01) / (1 - definition.safePressure01)) ** 2);
  const integrity01 = 1 - damage;
  return { currentVolume, integrity01, value: Math.round(definition.baseValue * integrity01) };
}

export interface Plan {
  readonly score: number;
  /** Compression per stored lot; lots left out are absent. */
  readonly compressions: Readonly<Partial<Record<SalvageId, number>>>;
}

/**
 * The day's best score: every combination of lots and of compressions on a 0.01 grid (plus each
 * lot's exact safe pressure) that fits the case. `ids` limits the lots that may be stored.
 */
export function bestPlan(config: GameConfig, ids: readonly SalvageId[] = config.specimens.map((item) => item.id)): Plan {
  const options = config.specimens.filter((item) => ids.includes(item.id)).map((definition) => {
    const pressures = new Set([definition.safePressure01, ...Array.from({ length: 99 }, (_, index) => (index + 1) / 100)]);
    const candidates = [...pressures].map((pressure01) => ({ pressure01, ...lotOutcome(definition, pressure01) }))
      .filter((candidate) => candidate.value > 0)
      .sort((a, b) => a.currentVolume - b.currentVolume);
    // Keep only choices where a bigger volume buys more value.
    const frontier: typeof candidates = [];
    for (const candidate of candidates) if (!frontier.length || candidate.value > frontier.at(-1)!.value) frontier.push(candidate);
    return { id: definition.id, frontier };
  });
  let best: Plan = { score: 0, compressions: {} };
  const visit = (index: number, volume: number, score: number, chosen: Partial<Record<SalvageId, number>>): void => {
    if (index === options.length) {
      if (score > best.score) best = { score, compressions: { ...chosen } };
      return;
    }
    const { id, frontier } = options[index]!;
    visit(index + 1, volume, score, chosen);
    for (const candidate of frontier) {
      if (volume + candidate.currentVolume > config.capacity + 1e-9) break;
      visit(index + 1, volume + candidate.currentVolume, score + candidate.value + config.collectionBonus, { ...chosen, [id]: candidate.pressure01 });
    }
  };
  visit(0, 0, 0, {});
  return best;
}

/** PRD v1.2 day rules: no dead end, storing all three pays, and the best run presses every lot. */
export function qualifiesAsDay(config: GameConfig): boolean {
  const safeVolume = (item: SpecimenDefinition) => lotOutcome(item, item.safePressure01).currentVolume;
  const noDeadEnd = config.specimens.every((last) => config.specimens
    .filter((item) => item !== last)
    .reduce((sum, item) => sum + safeVolume(item), last.minimumVolume) <= config.capacity + 1e-9);
  if (!noDeadEnd) return false;
  const all = bestPlan(config);
  const ids = config.specimens.map((item) => item.id);
  const bestPair = Math.max(...ids.map((left) => bestPlan(config, ids.filter((id) => id !== left)).score));
  const compressions = Object.values(all.compressions);
  return compressions.length === 3 && all.score - bestPair >= 60 && compressions.every((pressure) => pressure! >= 0.35);
}

/** Small deterministic PRNG (mulberry32) so a seed always yields the same day. */
function random32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

function build(seed: number, specimens: readonly SpecimenDefinition[]): GameConfig {
  const config: GameConfig = { ...structuredClone(BASE_CONFIG), seed, specimens: specimens.map(({ id, material, initialVolume, minimumVolume, baseValue, safePressure01, tolerance }) => ({ id, material, initialVolume, minimumVolume, baseValue, safePressure01, tolerance })) };
  assertConfig(config);
  return deepFreeze(config);
}

/** The PRD base lot without daily variation. Rule tests use it for exact numbers. */
export function authoredGameConfig(seed = 260903): GameConfig {
  return build(seed, BASE_SPECIMENS);
}

/**
 * A day's salvage (PRD v1.2 "오늘의 회수"): the base lot varied by the day seed (KST YYYYMMDD, which
 * the app derives from its clock), redrawn until the day qualifies. Without a seed, the authored base lot.
 */
export function getGameConfig(seed?: number): GameConfig {
  if (seed === undefined) return authoredGameConfig();
  const next = random32(seed);
  const between = (low: number, high: number) => low + (high - low) * next();
  for (let attempt = 0; attempt < 40; attempt++) {
    const config = build(seed, BASE_SPECIMENS.map((base) => ({
      ...base,
      initialVolume: round(base.initialVolume * between(0.93, 1.07), 3),
      minimumVolume: round(base.minimumVolume * between(0.92, 1.08), 3),
      baseValue: Math.round(base.baseValue * between(0.88, 1.12) / 10) * 10,
      safePressure01: round(Math.min(base.safeBand[1], Math.max(base.safeBand[0], base.safePressure01 + between(-0.05, 0.05))), 2),
    })));
    if (qualifiesAsDay(config)) return config;
  }
  return authoredGameConfig(seed);
}
