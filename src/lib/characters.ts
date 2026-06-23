import { GameState } from './gameTypes';

// ---------------------------------------------------------------------------
// Ability System
// ---------------------------------------------------------------------------

export interface CharacterAbility {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const ABILITY_DOUBLE_JUMP_PLUS: CharacterAbility = {
  id: 'double_jump_plus',
  name: 'Triple Leap',
  description: 'Jump up to 3 times mid-air',
  icon: '🚀',
  color: '#00e5ff',
};

export const ABILITY_SPEED_BOOST: CharacterAbility = {
  id: 'speed_boost',
  name: 'Overclock',
  description: '1.5× movement speed',
  icon: '⚡',
  color: '#ffdd00',
};

export const ABILITY_SHIELD: CharacterAbility = {
  id: 'shield',
  name: 'Energy Shield',
  description: 'Survive one lethal hit',
  icon: '🛡️',
  color: '#4dc9f6',
};

export const ABILITY_COIN_MAGNET: CharacterAbility = {
  id: 'coin_magnet',
  name: 'Coin Magnet',
  description: 'Auto-collect coins within 80 px',
  icon: '🧲',
  color: '#f67019',
};

export const ABILITY_LOW_GRAVITY: CharacterAbility = {
  id: 'low_gravity',
  name: 'Moonwalk',
  description: 'Floatier jumps with low gravity',
  icon: '🌙',
  color: '#b44aff',
};

export const ABILITY_SUPER_BOUNCE: CharacterAbility = {
  id: 'super_bounce',
  name: 'Spring Loaded',
  description: '1.5× force from bounce pads',
  icon: '🔵',
  color: '#00ff66',
};

export const ABILITY_TINY_HITBOX: CharacterAbility = {
  id: 'tiny_hitbox',
  name: 'Phase Shift',
  description: '20% smaller hitbox for tighter dodges',
  icon: '👻',
  color: '#cc99ff',
};

export const ABILITY_SCORE_MULTIPLIER: CharacterAbility = {
  id: 'score_multiplier',
  name: 'Jackpot',
  description: '1.5× score from all sources',
  icon: '💰',
  color: '#ffd700',
};

export const ALL_ABILITIES: CharacterAbility[] = [
  ABILITY_DOUBLE_JUMP_PLUS,
  ABILITY_SPEED_BOOST,
  ABILITY_SHIELD,
  ABILITY_COIN_MAGNET,
  ABILITY_LOW_GRAVITY,
  ABILITY_SUPER_BOUNCE,
  ABILITY_TINY_HITBOX,
  ABILITY_SCORE_MULTIPLIER,
];

// ---------------------------------------------------------------------------
// Character & Rarity
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'rare' | 'legendary';

export interface GameCharacter {
  id: number;
  name: string;
  imageSrc: string;
  ability: CharacterAbility;
  rarity: Rarity;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#00ffaa',
  rare: '#ff6ec7',
  legendary: '#ffd700',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  legendary: 'Legendary',
};

// ---------------------------------------------------------------------------
// Full Character Roster
// ---------------------------------------------------------------------------

export const ALL_CHARACTERS: GameCharacter[] = [
  {
    id: 1,
    name: 'NeonBlade',
    imageSrc: '/characters/char1.jpg',
    ability: ABILITY_DOUBLE_JUMP_PLUS,
    rarity: 'common',
  },
  {
    id: 2,
    name: 'CryptoFox',
    imageSrc: '/characters/char2.jpg',
    ability: ABILITY_SPEED_BOOST,
    rarity: 'rare',
  },
  {
    id: 3,
    name: 'VoidWalker',
    imageSrc: '/characters/char3.jpg',
    ability: ABILITY_SHIELD,
    rarity: 'legendary',
  },
  {
    id: 4,
    name: 'PixelStorm',
    imageSrc: '/characters/char4.jpg',
    ability: ABILITY_COIN_MAGNET,
    rarity: 'common',
  },
  {
    id: 5,
    name: 'ChainBreaker',
    imageSrc: '/characters/char5.jpg',
    ability: ABILITY_LOW_GRAVITY,
    rarity: 'rare',
  },
  {
    id: 6,
    name: 'GhostNode',
    imageSrc: '/characters/char6.jpg',
    ability: ABILITY_SUPER_BOUNCE,
    rarity: 'common',
  },
  {
    id: 7,
    name: 'ByteWolf',
    imageSrc: '/characters/char7.jpg',
    ability: ABILITY_TINY_HITBOX,
    rarity: 'rare',
  },
  {
    id: 8,
    name: 'StarForge',
    imageSrc: '/characters/char8.jpg',
    ability: ABILITY_SCORE_MULTIPLIER,
    rarity: 'legendary',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a shuffled selection of `count` random characters from the roster.
 * If `count` exceeds the roster size the full (shuffled) roster is returned.
 */
export function getRandomCharacters(count: number): GameCharacter[] {
  const shuffled = [...ALL_CHARACTERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Mutates `state` to apply the immediate, state-level effects of a character's
 * ability.  Abilities whose effects are handled entirely inside the game engine
 * (speed, gravity, coin magnet, bounce force, score multiplier) are no-ops here.
 *
 * NOTE for Shield: this module cannot add `shieldActive` to the `Player`
 * interface defined in gameTypes.ts.  The game engine should check for the
 * ability id `'shield'` on the selected character and manage the shield flag
 * itself.
 */
export function applyAbilityToState(
  state: GameState,
  character: GameCharacter,
): void {
  const { player } = state;

  switch (character.ability.id) {
    // ── Abilities applied here ────────────────────────────────────────────
    case 'double_jump_plus':
      player.maxJumps = 3;
      player.jumpsLeft = 3;
      break;

    case 'tiny_hitbox':
      player.width = 26;
      player.height = 32;
      break;

    // ── Shield: handled by the game engine ─────────────────────────────────
    // The engine should inspect `character.ability.id === 'shield'` and set
    // its own `shieldActive` flag on the player to absorb one lethal hit.
    case 'shield':
      // No direct state mutation possible without extending Player.
      // Intentional no-op — see comment above.
      break;

    // ── Abilities handled entirely in the game engine ─────────────────────
    case 'speed_boost':       // engine: PLAYER_SPEED * 1.5
    case 'coin_magnet':       // engine: auto-collect within 80 px
    case 'low_gravity':       // engine: gravity = 0.35 instead of 0.55
    case 'super_bounce':      // engine: bounceForce * 1.5
    case 'score_multiplier':  // engine: score * 1.5 on every gain
      // No initial state mutation needed.
      break;

    default:
      break;
  }
}
