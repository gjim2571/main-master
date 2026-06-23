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
  description: '1.5x movement speed',
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
  description: '1.5x force from bounce pads',
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
  description: '1.5x score from all sources',
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
// Random Name Generator
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  'Neon', 'Cyber', 'Void', 'Pixel', 'Chain', 'Ghost', 'Byte', 'Star',
  'Nova', 'Flux', 'Zero', 'Neo', 'Arc', 'Blaze', 'Frost', 'Storm',
  'Shadow', 'Lunar', 'Solar', 'Quantum', 'Omega', 'Alpha', 'Hyper', 'Mega',
  'Turbo', 'Phantom', 'Crystal', 'Dark', 'Rogue', 'Zen', 'Echo', 'Pulse',
  'Glitch', 'Holo', 'Prism', 'Orbit', 'Dusk', 'Rift', 'Surge', 'Nexus',
  'Apex', 'Viper', 'Hawk', 'Wolf', 'Drake', 'Rex', 'Fang', 'Claw',
];

const NAME_SUFFIXES = [
  'Blade', 'Fox', 'Walker', 'Storm', 'Breaker', 'Node', 'Wolf', 'Forge',
  'Runner', 'Rider', 'Hunter', 'Knight', 'Mage', 'Master', 'Spark', 'Hacker',
  'Strike', 'Bolt', 'Wave', 'Drift', 'Fury', 'Core', 'Link', 'Bit',
  'Shift', 'Pulse', 'Craft', 'Mesh', 'Grid', 'Warp', 'Dash', 'Rush',
  'Sage', 'Warden', 'Sentinel', 'Cipher', 'Adept', 'Pioneer', 'Legend', 'Titan',
  'Nova', 'Zenith', 'Vortex', 'Blitz', 'Reaper', 'Raven', 'Phoenix', 'Dragon',
];

let nameCounter = 0;

/**
 * Generate a random character name by combining a prefix and suffix.
 * Uses a counter to avoid duplicates within a single session.
 */
export function generateRandomName(): string {
  let name = '';
  let attempts = 0;
  do {
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    name = prefix + suffix;
    attempts++;
  } while (attempts < 20 && _usedNames.has(name.toLowerCase()));
  _usedNames.add(name.toLowerCase());
  nameCounter++;
  // Occasionally add a number suffix for variety
  if (Math.random() < 0.15) {
    name += Math.floor(Math.random() * 99) + 1;
  }
  return name;
}

const _usedNames = new Set<string>();

/** Reset used names (call when generating a new batch) */
export function resetUsedNames(): void {
  _usedNames.clear();
  nameCounter = 0;
}

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
// Character Image Pool (10 characters: 8 from chars folder + 2 original arts)
// ---------------------------------------------------------------------------

const CHARACTER_IMAGE_SOURCES = [
  '/characters/char1.jpg',
  '/characters/char2.jpg',
  '/characters/char3.jpg',
  '/characters/char4.jpg',
  '/characters/char5.jpg',
  '/characters/char6.jpg',
  '/characters/char7.jpg',
  '/characters/char8.jpg',
  '/character-art.jpeg',     // Original anime character image
  '/ritual-logo-art.jpeg',   // Original ritual logo art
];

// ---------------------------------------------------------------------------
// Generate Characters with Random Names & Random Abilities
// ---------------------------------------------------------------------------

/**
 * Generate a roster of characters with randomized names and abilities.
 * Each call produces a fresh set — no two sessions look the same.
 * The two original images always get 'legendary' rarity.
 */
export function generateCharacterRoster(count: number = 10): GameCharacter[] {
  resetUsedNames();

  const characters: GameCharacter[] = [];
  const shuffledAbilities = [...ALL_ABILITIES].sort(() => Math.random() - 0.5);
  const shuffledImages = [...CHARACTER_IMAGE_SOURCES].sort(() => Math.random() - 0.5);

  const actualCount = Math.min(count, shuffledImages.length);

  for (let i = 0; i < actualCount; i++) {
    const imgSrc = shuffledImages[i];
    const isOriginal = imgSrc === '/character-art.jpeg' || imgSrc === '/ritual-logo-art.jpeg';

    // Random rarity with weighted distribution
    let rarity: Rarity;
    if (isOriginal) {
      rarity = 'legendary';
    } else {
      const roll = Math.random();
      rarity = roll < 0.12 ? 'legendary' : roll < 0.35 ? 'rare' : 'common';
    }

    // Assign ability — legendary characters get a random ability, others too
    const ability = shuffledAbilities[i % shuffledAbilities.length];

    characters.push({
      id: i + 1,
      name: generateRandomName(),
      imageSrc: imgSrc,
      ability,
      rarity,
    });
  }

  return characters;
}

// Legacy export for backward compat — not used in new flow
export const ALL_CHARACTERS: GameCharacter[] = generateCharacterRoster(10);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a shuffled selection of `count` characters from a NEWLY GENERATED roster.
 * This ensures fresh random names + abilities every time.
 */
export function getRandomCharacters(count: number): GameCharacter[] {
  const roster = generateCharacterRoster(count);
  return roster.sort(() => Math.random() - 0.5).slice(0, Math.min(count, roster.length));
}

/**
 * Mutates `state` to apply the immediate, state-level effects of a character's
 * ability.
 */
export function applyAbilityToState(
  state: GameState,
  character: GameCharacter,
): void {
  const { player } = state;

  switch (character.ability.id) {
    case 'double_jump_plus':
      player.maxJumps = 3;
      player.jumpsLeft = 3;
      break;

    case 'tiny_hitbox':
      player.width = 26;
      player.height = 32;
      break;

    case 'shield':
      player.shieldActive = true;
      break;

    // Abilities handled entirely in the game engine:
    case 'speed_boost':
    case 'coin_magnet':
    case 'low_gravity':
    case 'super_bounce':
    case 'score_multiplier':
      break;

    default:
      break;
  }
}

/**
 * Get character image source by ID from a character list
 */
export function getCharacterImageSrc(characters: GameCharacter[], charId: number): string {
  const ch = characters.find(c => c.id === charId);
  return ch?.imageSrc || '/characters/char1.jpg';
}