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
  isPlaying: boolean;
  isGameOver: boolean;
  isPaused: boolean;
  backgroundOffset: number;
  stars: Array<{ x: number; y: number; size: number; brightness: number; speed: number }>;
  // Blockchain state
  onChainScoreSubmitted: boolean;
  pendingSubmission: boolean;
  lastBlockHash: string;
}

export const GRAVITY = 0.6;
export const PLAYER_SPEED = 4.5;
export const JUMP_FORCE = -12;
export const MAX_FALL_SPEED = 15;
export const LEVEL_WIDTH = 8000;

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

export function createInitialGameState(): GameState {
  return {
    player: {
      x: 100,
      y: 300,
      vx: 0,
      vy: 0,
      width: 28,
      height: 36,
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
    isPlaying: false,
    isGameOver: false,
    isPaused: false,
    backgroundOffset: 0,
    stars: createStars(200),
    onChainScoreSubmitted: false,
    pendingSubmission: false,
    lastBlockHash: '',
  };
}

export function generateLevel(state: GameState): void {
  const { platforms, coins, enemies } = state;
  platforms.length = 0;
  coins.length = 0;
  enemies.length = 0;

  // Ground platform at start
  platforms.push({
    x: 0,
    y: CANVAS_HEIGHT - 60,
    width: 300,
    height: 20,
    type: 'normal',
    color: COLORS.platform,
    glowColor: COLORS.platformBorder,
  });

  let lastX = 200;
  let lastY = CANVAS_HEIGHT - 60;

  // Generate procedural level
  for (let i = 0; i < 60; i++) {
    const gap = 80 + Math.random() * 120;
    const width = 60 + Math.random() * 140;
    const yVariation = (Math.random() - 0.5) * 100;
    const x = lastX + gap;
    let y = Math.max(100, Math.min(CANVAS_HEIGHT - 80, lastY + yVariation));

    // Platform types
    const typeRoll = Math.random();
    let type: Platform['type'] = 'normal';
    let platformColor = COLORS.platform;
    let glow = COLORS.platformBorder;

    if (typeRoll < 0.15 && i > 5) {
      type = 'moving';
      platformColor = COLORS.movingPlatform;
      glow = COLORS.neonPurple;
    } else if (typeRoll < 0.25 && i > 3) {
      type = 'fragile';
      platformColor = COLORS.fragilePlatform;
      glow = COLORS.neonPink;
    } else if (typeRoll < 0.33) {
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
      moveRange: type === 'moving' ? 40 + Math.random() * 40 : undefined,
      moveSpeed: type === 'moving' ? 0.8 + Math.random() * 1.2 : undefined,
      originX: x,
      fragileTimer: type === 'fragile' ? 60 : undefined,
      bounceForce: type === 'bounce' ? -16 : undefined,
    });

    // Coins on platform
    if (Math.random() > 0.3) {
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
          x: x + 15 + c * 25,
          y: y - 30 - Math.random() * 20,
          radius: coinType === 'legendary' ? 10 : coinType === 'rare' ? 8 : 6,
          collected: false,
          bobOffset: Math.random() * Math.PI * 2,
          type: coinType,
          value: coinValue,
        });
      }
    }

    // Enemies
    if (Math.random() > 0.7 && i > 3 && width > 80) {
      const enemyType = Math.random() > 0.7 ? 'flyer' : 'walker';
      enemies.push({
        x: x + 20,
        y: enemyType === 'flyer' ? y - 50 : y - 30,
        width: 24,
        height: 24,
        vx: 1 + Math.random(),
        moveRange: width - 30,
        originX: x + 20,
        isAlive: true,
        type: enemyType,
        animFrame: 0,
        animTimer: 0,
      });
    }

    lastX = x;
    lastY = y;
  }

  // End platform
  platforms.push({
    x: lastX + 150,
    y: CANVAS_HEIGHT - 100,
    width: 200,
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
