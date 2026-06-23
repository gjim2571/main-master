// Game constants
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  jumpsLeft: number;
  maxJumps: number;
  isAlive: boolean;
  invincible: number;
  facing: 'left' | 'right';
  animFrame: number;
  animTimer: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'normal' | 'moving' | 'fragile' | 'bounce';
  moveDir?: number;
  moveRange?: number;
  moveSpeed?: number;
  originX?: number;
  fragileTimer?: number;
  bounceForce?: number;
  color?: string;
  glowColor?: string;
}

export interface Coin {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  bobOffset: number;
  type: 'normal' | 'rare' | 'legendary';
  value: number;
}

export interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  moveRange: number;
  originX: number;
  isAlive: boolean;
  type: 'walker' | 'flyer';
  animFrame: number;
  animTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingArt {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  bobOffset: number;
  rotationSpeed: number;
}

export interface GameAssets {
  characterImg: HTMLImageElement | null;
  ritualLogoImg: HTMLImageElement | null;
}

export type GamePhase = 'start' | 'playing' | 'gameover';

export interface GameState {
  player: Player;
  platforms: Platform[];
  coins: Coin[];
  enemies: Enemy[];
  particles: Particle[];
  camera: Vector2;
  score: number;
  distance: number;
  level: number;
  phase: GamePhase;
  backgroundOffset: number;
  stars: Array<{ x: number; y: number; size: number; brightness: number; speed: number }>;
  floatingArts: FloatingArt[];
  // Blockchain state
  onChainScoreSubmitted: boolean;
  pendingSubmission: boolean;
  lastBlockHash: string;
}

export const GRAVITY = 0.55;
export const PLAYER_SPEED = 4;
export const JUMP_FORCE = -11;
export const MAX_FALL_SPEED = 12;
export const LEVEL_WIDTH = 6000;

// Color palette - Neon cyberpunk theme
export const COLORS = {
  bg: '#0a0a1a',
  bgGradient1: '#0a0a2e',
  bgGradient2: '#1a0a2e',
  player: '#00ffaa',
  playerGlow: 'rgba(0, 255, 170, 0.3)',
  playerTrail: 'rgba(0, 255, 170, 0.15)',
  platform: '#1e1e3e',
  platformBorder: '#00ffaa',
  movingPlatform: '#2a1e4e',
  fragilePlatform: '#4e1e1e',
  bouncePlatform: '#1e4e2e',
  bounceBorder: '#00ff66',
  coin: '#ffd700',
  coinGlow: 'rgba(255, 215, 0, 0.4)',
  rareCoin: '#ff6ec7',
  rareCoinGlow: 'rgba(255, 110, 199, 0.4)',
  legendaryCoin: '#00e5ff',
  legendaryCoinGlow: 'rgba(0, 229, 255, 0.4)',
  enemy: '#ff3366',
  enemyGlow: 'rgba(255, 51, 102, 0.3)',
  text: '#ffffff',
  textGlow: 'rgba(255, 255, 255, 0.5)',
  hud: 'rgba(10, 10, 30, 0.85)',
  hudBorder: 'rgba(0, 255, 170, 0.3)',
  neonGreen: '#00ffaa',
  neonPink: '#ff3366',
  neonBlue: '#00e5ff',
  neonPurple: '#b44aff',
  neonYellow: '#ffd700',
  star: 'rgba(255, 255, 255, 0.6)',
};

function createStars(count: number) {
  const stars: GameState['stars'] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * LEVEL_WIDTH * 1.5,
      y: Math.random() * CANVAS_HEIGHT * 0.7,
      size: Math.random() * 2 + 0.5,
      brightness: Math.random() * 0.6 + 0.4,
      speed: Math.random() * 0.3 + 0.1,
    });
  }
  return stars;
}

function createFloatingArts(count: number) {
  const arts: FloatingArt[] = [];
  for (let i = 0; i < count; i++) {
    arts.push({
      x: 500 + Math.random() * (LEVEL_WIDTH - 1000),
      y: 50 + Math.random() * (CANVAS_HEIGHT - 200),
      size: 30 + Math.random() * 50,
      alpha: 0.1 + Math.random() * 0.15,
      speed: 0.2 + Math.random() * 0.3,
      bobOffset: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.002,
    });
  }
  return arts;
}

export function createInitialGameState(): GameState {
  return {
    player: {
      x: 120,
      y: 300,
      vx: 0,
      vy: 0,
      width: 32,
      height: 40,
      onGround: false,
      jumpsLeft: 2,
      maxJumps: 2,
      isAlive: true,
      invincible: 0,
      facing: 'right',
      animFrame: 0,
      animTimer: 0,
    },
    platforms: [],
    coins: [],
    enemies: [],
    particles: [],
    camera: { x: 0, y: 0 },
    score: 0,
    distance: 0,
    level: 1,
    phase: 'start',
    backgroundOffset: 0,
    stars: createStars(200),
    floatingArts: createFloatingArts(8),
    onChainScoreSubmitted: false,
    pendingSubmission: false,
    lastBlockHash: '',
  };
}

export function resetGameForPlaying(state: GameState): void {
  const stars = state.stars;
  const floatingArts = state.floatingArts;
  const onChainScoreSubmitted = state.onChainScoreSubmitted;
  const pendingSubmission = state.pendingSubmission;
  const lastBlockHash = state.lastBlockHash;

  Object.assign(state, createInitialGameState());
  state.stars = stars;
  state.floatingArts = floatingArts;
  state.onChainScoreSubmitted = onChainScoreSubmitted;
  state.pendingSubmission = pendingSubmission;
  state.lastBlockHash = lastBlockHash;
  state.phase = 'playing';

  generateLevel(state);
}

export function generateLevel(state: GameState): void {
  const { platforms, coins, enemies } = state;
  platforms.length = 0;
  coins.length = 0;
  enemies.length = 0;

  // Ground platform at start - wide and safe
  platforms.push({
    x: 0,
    y: CANVAS_HEIGHT - 50,
    width: 350,
    height: 20,
    type: 'normal',
    color: COLORS.platform,
    glowColor: COLORS.platformBorder,
  });

  let lastX = 250;
  let lastY = CANVAS_HEIGHT - 50;

  // Generate procedural level
  for (let i = 0; i < 50; i++) {
    const gap = 70 + Math.random() * 100;
    const width = 80 + Math.random() * 130;
    const yVariation = (Math.random() - 0.5) * 80;
    const x = lastX + gap;
    let y = Math.max(120, Math.min(CANVAS_HEIGHT - 80, lastY + yVariation));

    // Platform types
    const typeRoll = Math.random();
    let type: Platform['type'] = 'normal';
    let platformColor = COLORS.platform;
    let glow = COLORS.platformBorder;

    if (typeRoll < 0.12 && i > 5) {
      type = 'moving';
      platformColor = COLORS.movingPlatform;
      glow = COLORS.neonPurple;
    } else if (typeRoll < 0.2 && i > 3) {
      type = 'fragile';
      platformColor = COLORS.fragilePlatform;
      glow = COLORS.neonPink;
    } else if (typeRoll < 0.28) {
      type = 'bounce';
      platformColor = COLORS.bouncePlatform;
      glow = COLORS.bounceBorder;
    }

    platforms.push({
      x,
      y,
      width,
      height: 16,
      type,
      color: platformColor,
      glowColor: glow,
      moveDir: 1,
      moveRange: type === 'moving' ? 40 + Math.random() * 30 : undefined,
      moveSpeed: type === 'moving' ? 0.6 + Math.random() * 0.8 : undefined,
      originX: x,
      fragileTimer: type === 'fragile' ? 80 : undefined,
      bounceForce: type === 'bounce' ? -14 : undefined,
    });

    // Coins on platform
    if (Math.random() > 0.25) {
      const coinCount = Math.floor(Math.random() * 3) + 1;
      for (let c = 0; c < coinCount; c++) {
        const coinRoll = Math.random();
        let coinType: Coin['type'] = 'normal';
        let coinValue = 10;
        if (coinRoll > 0.95) {
          coinType = 'legendary';
          coinValue = 100;
        } else if (coinRoll > 0.85) {
          coinType = 'rare';
          coinValue = 30;
        }

        coins.push({
          x: x + 20 + c * 28,
          y: y - 35 - Math.random() * 15,
          radius: coinType === 'legendary' ? 10 : coinType === 'rare' ? 8 : 6,
          collected: false,
          bobOffset: Math.random() * Math.PI * 2,
          type: coinType,
          value: coinValue,
        });
      }
    }

    // Enemies
    if (Math.random() > 0.75 && i > 4 && width > 90) {
      const enemyType = Math.random() > 0.7 ? 'flyer' : 'walker';
      enemies.push({
        x: x + 25,
        y: enemyType === 'flyer' ? y - 55 : y - 32,
        width: 22,
        height: 22,
        vx: 0.8 + Math.random() * 0.8,
        moveRange: width - 40,
        originX: x + 25,
        isAlive: true,
        type: enemyType,
        animFrame: 0,
        animTimer: 0,
      });
    }

    lastX = x;
    lastY = y;
  }

  // End platform - larger and easy to spot
  platforms.push({
    x: lastX + 120,
    y: CANVAS_HEIGHT - 80,
    width: 250,
    height: 20,
    type: 'normal',
    color: COLORS.platform,
    glowColor: COLORS.neonYellow,
  });
}

// Spawn particles
export function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  spread: number = 3
) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * spread,
      vy: (Math.random() - 0.5) * spread - 1,
      life: 30 + Math.random() * 30,
      maxLife: 60,
      color,
      size: 1 + Math.random() * 3,
    });
  }
}
