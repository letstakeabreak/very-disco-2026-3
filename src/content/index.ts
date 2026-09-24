import { DEFAULT_GAME_CONFIG } from '../contracts/fixtures';
import type { GameConfig } from '../contracts';

/** Role A replaces fixture-backed content with authored, validated level data. */
export function getGameConfig(): GameConfig { return DEFAULT_GAME_CONFIG; }
