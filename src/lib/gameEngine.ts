import {
  GameState,
  Player,
  Platform,
  Coin,
  Enemy,
  Particle,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRAVITY,
  PLAYER_SPEED,
  JUMP_FORCE,
  MAX_FALL_SPEED,
  LEVEL_WIDTH,
  COLORS,
  spawnParticles,
} from './gameTypes';

// Input tracking
const keys: Record<string, boolean> = {};

export function setupInputListeners(canvas: HTMLCanvasElement) {
  const onKeyDown = (e: KeyboardEvent) => {
    keys[e.code] = true;
    // Prevent page scrolling for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

function aabbCollision(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function updateGame(state: GameState, deltaTime: number) {
  if (!state.isPlaying || state.isGameOver || state.isPaused) return;

  const { player } = state;
  const dt = Math.min(deltaTime, 2); // Cap delta to prevent physics explosions

  // === Player Input ===
  if (player.isAlive) {
    let moveX = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) moveX -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) moveX += 1;

    player.vx = moveX * PLAYER_SPEED;
    if (moveX !== 0) {
      player.facing = moveX > 0 ? 'right' : 'left';
    }

    // Animation
    if (Math.abs(player.vx) > 0.5) {
      player.animTimer += dt;
      if (player.animTimer > 8) {
        player.animFrame = (player.animFrame + 1) % 4;
        player.animTimer = 0;
      }
    } else {
      player.animFrame = 0;
      player.animTimer = 0;
    }

    // Jump
    if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.jumpsLeft > 0) {
      if (!keys._jumpPressed) {
        player.vy = JUMP_FORCE;
        player.jumpsLeft--;
        keys._jumpPressed = true;
        spawnParticles(state, player.x + player.width / 2, player.y + player.height, COLORS.neonGreen, 5, 2);
      }
    }
    if (!keys['ArrowUp'] && !keys['KeyW'] && !keys['Space']) {
      keys._jumpPressed = false;
    }
  }

  // === Physics ===
  // Gravity
  player.vy += GRAVITY * dt;
  if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

  // Move player
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Invincibility timer
  if (player.invincible > 0) player.invincible -= dt;

  // === Update Platforms ===
  for (const plat of state.platforms) {
    if (plat.type === 'moving' && plat.originX !== undefined && plat.moveRange !== undefined && plat.moveSpeed !== undefined) {
      plat.x += plat.moveDir * plat.moveSpeed * dt;
      if (plat.x > plat.originX + plat.moveRange || plat.x < plat.originX - plat.moveRange) {
        plat.moveDir *= -1;
      }
    }

    // Fragile timer
    if (plat.type === 'fragile' && plat.fragileTimer !== undefined) {
      if (player.onGround && aabbCollision(player.x, player.y, player.width, player.height, plat.x, plat.y, plat.width, plat.height)) {
        plat.fragileTimer -= dt;
      }
      if (plat.fragileTimer <= 0) {
        spawnParticles(state, plat.x + plat.width / 2, plat.y + plat.height / 2, COLORS.neonPink, 15, 4);
        plat.y = -1000; // Move off screen
      }
    }
  }

  // === Platform Collisions ===
  player.onGround = false;
  for (const plat of state.platforms) {
    if (plat.y < -500) continue; // Skip destroyed platforms

    if (
      aabbCollision(player.x, player.y, player.width, player.height, plat.x, plat.y, plat.width, plat.height)
    ) {
      // Check if landing on top
      const prevBottom = player.y + player.height - player.vy * dt;
      if (prevBottom <= plat.y + 4 && player.vy >= 0) {
        player.y = plat.y - player.height;
        player.onGround = true;
        player.jumpsLeft = player.maxJumps;

        if (plat.type === 'bounce' && plat.bounceForce) {
          player.vy = plat.bounceForce;
          player.jumpsLeft = player.maxJumps;
          spawnParticles(state, player.x + player.width / 2, plat.y, COLORS.neonGreen, 8, 3);
        } else {
          player.vy = 0;
        }

        // Moving platform carries player
        if (plat.type === 'moving' && plat.moveSpeed !== undefined) {
          player.x += plat.moveDir * plat.moveSpeed * dt;
        }
      }
      // Side collision
      else if (player.vy > 0 || prevBottom > plat.y + 10) {
        // Don't push player through platform from sides
      }
    }
  }

  // === Coin Collection ===
  for (const coin of state.coins) {
    if (coin.collected) continue;

    const cx = coin.x;
    const cy = coin.y + Math.sin(Date.now() / 500 + coin.bobOffset) * 4;
    const dx = (player.x + player.width / 2) - cx;
    const dy = (player.y + player.height / 2) - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < coin.radius + 18) {
      coin.collected = true;
      state.score += coin.value;

      const particleColor =
        coin.type === 'legendary' ? COLORS.legendaryCoin : coin.type === 'rare' ? COLORS.rareCoin : COLORS.coin;
      spawnParticles(state, coin.x, coin.y, particleColor, coin.type === 'legendary' ? 15 : 8, 4);
    }
  }

  // === Enemy Update ===
  for (const enemy of state.enemies) {
    if (!enemy.isAlive) continue;

    enemy.x += enemy.vx * dt;
    enemy.animTimer += dt;
    if (enemy.animTimer > 10) {
      enemy.animFrame = (enemy.animFrame + 1) % 2;
      enemy.animTimer = 0;
    }

    if (enemy.type === 'flyer') {
      enemy.y += Math.sin(Date.now() / 400) * 0.5 * dt;
    }

    // Bounce at move range
    if (enemy.x < enemy.originX || enemy.x > enemy.originX + enemy.moveRange) {
      enemy.vx *= -1;
    }

    // Collision with player
    if (player.isAlive && player.invincible <= 0 && aabbCollision(player.x, player.y, player.width, player.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
      // Check if stomping (player above enemy and falling)
      if (player.vy > 0 && player.y + player.height < enemy.y + enemy.height / 2 + 10) {
        enemy.isAlive = false;
        player.vy = JUMP_FORCE * 0.7;
        state.score += 50;
        spawnParticles(state, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, COLORS.neonPink, 12, 4);
      } else {
        // Take damage
        player.isAlive = false;
        state.isGameOver = true;
        spawnParticles(state, player.x + player.width / 2, player.y + player.height / 2, COLORS.neonPink, 20, 6);
      }
    }
  }

  // === Particles ===
  updateParticles(state.particles, dt);

  // === Camera ===
  const targetCameraX = player.x - CANVAS_WIDTH / 3;
  state.camera.x += (targetCameraX - state.camera.x) * 0.08 * dt;
  state.camera.x = Math.max(0, Math.min(LEVEL_WIDTH - CANVAS_WIDTH, state.camera.x));

  // Background parallax
  state.backgroundOffset = state.camera.x * 0.3;

  // === Distance tracking ===
  state.distance = Math.floor(player.x / 10);

  // === Fall death ===
  if (player.y > CANVAS_HEIGHT + 100) {
    player.isAlive = false;
    state.isGameOver = true;
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.05 * dt; // slight gravity on particles
    p.life -= dt;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// === Drawing ===

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const { camera, player, platforms, coins, enemies, particles } = state;

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, COLORS.bgGradient1);
  bgGrad.addColorStop(1, COLORS.bgGradient2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Stars
  for (const star of state.stars) {
    const sx = star.x - camera.x * star.speed;
    const wrappedX = ((sx % (CANVAS_WIDTH + 100)) + CANVAS_WIDTH + 100) % (CANVAS_WIDTH + 100);
    const alpha = star.brightness * (0.7 + 0.3 * Math.sin(time / 1000 + star.x));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(wrappedX, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant mountains/city silhouette
  drawCityscape(ctx, state);

  ctx.save();
  ctx.translate(-camera.x, 0);

  // === Draw Platforms ===
  for (const plat of platforms) {
    if (plat.y < -500) continue;
    if (plat.x + plat.width < camera.x - 50 || plat.x > camera.x + CANVAS_WIDTH + 50) continue;

    // Glow
    ctx.shadowColor = plat.glowColor || COLORS.platformBorder;
    ctx.shadowBlur = 8;

    // Platform body
    ctx.fillStyle = plat.color || COLORS.platform;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    // Platform border
    ctx.strokeStyle = plat.glowColor || COLORS.platformBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

    // Top highlight
    ctx.strokeStyle = plat.glowColor || COLORS.platformBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plat.x, plat.y);
    ctx.lineTo(plat.x + plat.width, plat.y);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Fragile platform warning
    if (plat.type === 'fragile' && plat.fragileTimer !== undefined && plat.fragileTimer < 60) {
      const alpha = plat.fragileTimer < 30 ? 0.3 + 0.7 * Math.abs(Math.sin(time / 100)) : 0.3;
      ctx.fillStyle = `rgba(255, 51, 102, ${alpha})`;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    }
  }

  // === Draw Coins ===
  for (const coin of coins) {
    if (coin.collected) continue;

    const cy = coin.y + Math.sin(time / 500 + coin.bobOffset) * 4;
    const color =
      coin.type === 'legendary' ? COLORS.legendaryCoin : coin.type === 'rare' ? COLORS.rareCoin : COLORS.coin;
    const glow =
      coin.type === 'legendary' ? COLORS.legendaryCoinGlow : coin.type === 'rare' ? COLORS.rareCoinGlow : COLORS.coinGlow;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = coin.type === 'legendary' ? 15 : 10;

    // Coin circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(coin.x, cy, coin.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(coin.x - coin.radius * 0.2, cy - coin.radius * 0.2, coin.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Legendary sparkle
    if (coin.type === 'legendary') {
      const sparkleAngle = time / 200;
      ctx.strokeStyle = COLORS.legendaryCoin;
      ctx.lineWidth = 1;
      for (let s = 0; s < 4; s++) {
        const angle = sparkleAngle + (s * Math.PI) / 2;
        const len = coin.radius + 5 + Math.sin(time / 150 + s) * 3;
        ctx.beginPath();
        ctx.moveTo(coin.x + Math.cos(angle) * coin.radius, cy + Math.sin(angle) * coin.radius);
        ctx.lineTo(coin.x + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;
  }

  // === Draw Enemies ===
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;

    ctx.shadowColor = COLORS.enemyGlow;
    ctx.shadowBlur = 10;

    // Body
    ctx.fillStyle = COLORS.enemy;
    if (enemy.type === 'flyer') {
      // Triangle for flyer
      ctx.beginPath();
      ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
      ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
      ctx.lineTo(enemy.x, enemy.y + enemy.height);
      ctx.closePath();
      ctx.fill();

      // Wings
      const wingOffset = Math.sin(time / 150) * 3;
      ctx.strokeStyle = COLORS.neonPink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y + enemy.height * 0.4);
      ctx.lineTo(enemy.x - 8, enemy.y + wingOffset);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(enemy.x + enemy.width, enemy.y + enemy.height * 0.4);
      ctx.lineTo(enemy.x + enemy.width + 8, enemy.y + wingOffset);
      ctx.stroke();
    } else {
      // Rectangle for walker
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      // Eyes
      ctx.fillStyle = '#ffffff';
      const eyeOffset = enemy.vx > 0 ? 5 : -2;
      ctx.fillRect(enemy.x + enemy.width / 2 + eyeOffset - 2, enemy.y + 6, 3, 3);
      ctx.fillRect(enemy.x + enemy.width / 2 + eyeOffset + 4, enemy.y + 6, 3, 3);
    }

    ctx.shadowBlur = 0;
  }

  // === Draw Player ===
  if (player.isAlive) {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;

    // Trail effect when moving
    if (Math.abs(player.vx) > 1 || !player.onGround) {
      ctx.fillStyle = COLORS.playerTrail;
      ctx.beginPath();
      ctx.roundRect(px - 3, py + 5, pw, ph - 5, 4);
      ctx.fill();
    }

    // Glow
    ctx.shadowColor = COLORS.playerGlow;
    ctx.shadowBlur = 12;

    // Player body
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 5);
    ctx.fill();

    // Face details
    const faceDir = player.facing === 'right' ? 1 : -1;
    // Eye
    ctx.fillStyle = '#0a0a2e';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + faceDir * 4, py + 10, 3, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + faceDir * 5, py + 9, 1, 0, Math.PI * 2);
    ctx.fill();

    // Legs animation
    if (player.onGround && Math.abs(player.vx) > 0.5) {
      const legOffset = Math.sin(time / 100) * 4;
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(px + 6, py + ph, 4, 4 + legOffset);
      ctx.fillRect(px + pw - 10, py + ph, 4, 4 - legOffset);
    } else {
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(px + 6, py + ph, 4, 4);
      ctx.fillRect(px + pw - 10, py + ph, 4, 4);
    }

    // Jetpack when in air
    if (!player.onGround) {
      ctx.fillStyle = COLORS.neonBlue;
      ctx.fillRect(px + pw / 2 - 4, py + ph + 2, 8, 4);
      // Flame
      const flameLen = 6 + Math.random() * 6;
      ctx.fillStyle = COLORS.neonYellow;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2 - 3, py + ph + 6);
      ctx.lineTo(px + pw / 2 + 3, py + ph + 6);
      ctx.lineTo(px + pw / 2, py + ph + 6 + flameLen);
      ctx.closePath();
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  // === Draw Particles ===
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawCityscape(ctx: CanvasRenderingContext2D, state: GameState) {
  const offset = state.camera.x * 0.15;

  // Distant buildings
  ctx.fillStyle = 'rgba(15, 15, 45, 0.8)';
  const buildingWidths = [40, 30, 50, 35, 45, 25, 55, 30, 40, 60];
  for (let i = 0; i < buildingWidths.length; i++) {
    const bx = i * 90 - (offset % 90);
    const bh = 80 + buildingWidths[i] + Math.sin(i * 2.5) * 30;
    ctx.fillRect(bx, CANVAS_HEIGHT - bh, buildingWidths[i], bh);

    // Windows
    ctx.fillStyle = 'rgba(0, 255, 170, 0.15)';
    for (let wy = CANVAS_HEIGHT - bh + 10; wy < CANVAS_HEIGHT - 20; wy += 15) {
      for (let wx = bx + 5; wx < bx + buildingWidths[i] - 5; wx += 10) {
        if (Math.random() > 0.3) {
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    ctx.fillStyle = 'rgba(15, 15, 45, 0.8)';
  }

  // Neon horizon line
  ctx.strokeStyle = 'rgba(0, 255, 170, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT - 30);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 30);
  ctx.stroke();
}

// Draw HUD overlay
export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, walletAddress: string | null, balance: string) {
  // Score panel
  ctx.fillStyle = COLORS.hud;
  ctx.strokeStyle = COLORS.hudBorder;
  ctx.lineWidth = 1;

  // Top-left panel
  roundRect(ctx, 10, 10, 200, 80, 8);
  ctx.fill();
  ctx.stroke();

  // Score
  ctx.fillStyle = COLORS.neonYellow;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('SCORE', 22, 32);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(state.score.toString().padStart(8, '0'), 22, 58);

  // Distance
  ctx.fillStyle = COLORS.neonBlue;
  ctx.font = '12px monospace';
  ctx.fillText(`${state.distance}m`, 140, 32);

  // Coins icon
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(150, 55, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('x' + state.coins.filter(c => c.collected).length, 160, 60);

  // Top-right panel - Wallet
  if (walletAddress) {
    const walletPanelWidth = 260;
    const wx = CANVAS_WIDTH - walletPanelWidth - 10;

    ctx.fillStyle = COLORS.hud;
    ctx.strokeStyle = COLORS.hudBorder;
    roundRect(ctx, wx, 10, walletPanelWidth, 70, 8);
    ctx.fill();
    ctx.stroke();

    // Wallet icon
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = '12px monospace';
    ctx.fillText('RITUAL TESTNET', wx + 14, 32);

    ctx.fillStyle = COLORS.text;
    ctx.font = '11px monospace';
    const shortAddr = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
    ctx.fillText(shortAddr, wx + 14, 50);

    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${balance} ETH`, wx + 14, 68);

    // Network indicator
    ctx.fillStyle = COLORS.neonGreen;
    ctx.beginPath();
    ctx.arc(wx + walletPanelWidth - 20, 30, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bottom - Jump indicator
  if (state.player.isAlive) {
    const jumpY = CANVAS_HEIGHT - 35;
    for (let i = 0; i < state.player.maxJumps; i++) {
      ctx.fillStyle = i < state.player.jumpsLeft ? COLORS.neonGreen : 'rgba(0, 255, 170, 0.2)';
      ctx.beginPath();
      ctx.arc(25 + i * 22, jumpY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.bg;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i + 1 === 1 ? 'J' : 'J2', 25 + i * 22, jumpY + 4);
      ctx.textAlign = 'left';
    }
  }

  // Controls hint at bottom center
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A/D or Arrows: Move  |  W/Space: Jump  |  Double Jump Available', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
  ctx.textAlign = 'left';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draw start screen overlay
export function drawStartScreen(ctx: CanvasRenderingContext2D, time: number, walletAddress: string | null) {
  ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Title
  ctx.textAlign = 'center';

  // Glow title
  ctx.shadowColor = COLORS.neonGreen;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.neonGreen;
  ctx.font = 'bold 48px monospace';
  ctx.fillText('RITUAL RUNNER', CANVAS_WIDTH / 2, 160);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = COLORS.neonPink;
  ctx.font = '16px monospace';
  ctx.fillText('Blockchain Platform Game on Ritual Testnet', CANVAS_WIDTH / 2, 195);

  // Chain decoration line
  ctx.strokeStyle = COLORS.neonGreen;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH / 2 - 150, 210);
  ctx.lineTo(CANVAS_WIDTH / 2 + 150, 210);
  ctx.stroke();
  ctx.setLineDash([]);

  // Instructions
  ctx.fillStyle = COLORS.text;
  ctx.font = '14px monospace';
  const instructions = [
    'A / D  or  Arrow Keys  →  Move',
    'W / Space  →  Jump  (Double Jump!)',
    'Collect coins & defeat enemies',
    'Reach the end to submit score on-chain',
  ];

  instructions.forEach((text, i) => {
    ctx.fillStyle = i === 3 ? COLORS.neonYellow : 'rgba(255,255,255,0.7)';
    ctx.fillText(text, CANVAS_WIDTH / 2, 260 + i * 28);
  });

  // Wallet status
  if (!walletAddress) {
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = '13px monospace';
    ctx.fillText('Connect MetaMask Wallet to submit scores on-chain', CANVAS_WIDTH / 2, 400);
  } else {
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = '13px monospace';
    ctx.fillText('Wallet Connected ✓', CANVAS_WIDTH / 2, 395);
  }

  // Start button
  const pulse = 0.9 + 0.1 * Math.sin(time / 400);
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, 450);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = COLORS.neonGreen;
  ctx.font = 'bold 20px monospace';
  ctx.shadowColor = COLORS.neonGreen;
  ctx.shadowBlur = 15;
  ctx.fillText('Press ENTER or SPACE to Start', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.textAlign = 'left';
}

// Draw game over screen
export function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, time: number, walletAddress: string | null) {
  ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign = 'center';

  ctx.shadowColor = COLORS.neonPink;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.neonPink;
  ctx.font = 'bold 42px monospace';
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 140);
  ctx.shadowBlur = 0;

  // Score display
  ctx.fillStyle = COLORS.neonYellow;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('FINAL SCORE', CANVAS_WIDTH / 2, 200);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 36px monospace';
  ctx.fillText(state.score.toString(), CANVAS_WIDTH / 2, 245);

  // Stats
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '14px monospace';
  ctx.fillText(`Distance: ${state.distance}m`, CANVAS_WIDTH / 2, 290);
  ctx.fillText(`Coins: ${state.coins.filter(c => c.collected).length}`, CANVAS_WIDTH / 2, 315);

  // Chain submission status
  if (walletAddress && !state.onChainScoreSubmitted && !state.pendingSubmission) {
    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = '14px monospace';
    ctx.fillText('Press S to submit score on-chain!', CANVAS_WIDTH / 2, 370);
  } else if (state.pendingSubmission) {
    ctx.fillStyle = COLORS.neonBlue;
    ctx.font = '14px monospace';
    ctx.fillText('Submitting to Ritual Testnet...', CANVAS_WIDTH / 2, 370);
  } else if (state.onChainScoreSubmitted) {
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = '14px monospace';
    ctx.shadowColor = COLORS.neonGreen;
    ctx.shadowBlur = 10;
    ctx.fillText('Score Submitted On-Chain!', CANVAS_WIDTH / 2, 370);
    ctx.shadowBlur = 0;
    if (state.lastBlockHash) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px monospace';
      ctx.fillText('Tx: ' + state.lastBlockHash.slice(0, 20) + '...', CANVAS_WIDTH / 2, 390);
    }
  }

  // Restart
  const pulse = 0.9 + 0.1 * Math.sin(time / 400);
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, 440);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Press ENTER to Restart', 0, 0);
  ctx.restore();

  ctx.textAlign = 'left';
}
