import {
  GameState,
  GameAssets,
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

// Shared input state - use a plain object to avoid TypeScript issues
export const keys: Record<string, boolean> = {};
// Track which keys were just pressed this frame (for single-fire actions)
const justPressed: Record<string, boolean> = {};

export function setupInputListeners(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (!keys[code]) {
      justPressed[code] = true;
    }
    keys[code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter'].includes(code)) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
    justPressed[e.code] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

/** Call at the end of each frame to clear justPressed flags */
export function clearJustPressed() {
  for (const k in justPressed) {
    justPressed[k] = false;
  }
}

/** Returns true only on the frame the key was first pressed down */
export function wasJustPressed(code: string): boolean {
  return !!justPressed[code];
}

function aabbCollision(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function updateGame(state: GameState) {
  if (state.phase !== 'playing') return;
  if (!state.player.isAlive) return;

  const { player } = state;
  const dt = 1; // Fixed timestep for stability

  // === Player Input ===
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
    if (player.animTimer > 6) {
      player.animFrame = (player.animFrame + 1) % 4;
      player.animTimer = 0;
    }
  } else {
    player.animFrame = 0;
    player.animTimer = 0;
  }

  // Jump (only on fresh press via justPressed)
  if (wasJustPressed('ArrowUp') || wasJustPressed('KeyW') || wasJustPressed('Space')) {
    if (player.jumpsLeft > 0) {
      player.vy = JUMP_FORCE;
      player.jumpsLeft--;
      spawnParticles(state, player.x + player.width / 2, player.y + player.height, COLORS.neonGreen, 6, 2);
    }
  }

  // === Physics ===
  player.vy += GRAVITY;
  if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

  // Move player
  player.x += player.vx;
  player.y += player.vy;

  // Keep player in bounds horizontally
  if (player.x < 0) player.x = 0;
  if (player.x > LEVEL_WIDTH - player.width) player.x = LEVEL_WIDTH - player.width;

  // Invincibility timer
  if (player.invincible > 0) player.invincible -= 1;

  // === Update Platforms ===
  for (const plat of state.platforms) {
    if (plat.y < -500) continue;
    if (plat.type === 'moving' && plat.originX !== undefined && plat.moveRange !== undefined && plat.moveSpeed !== undefined && plat.moveDir !== undefined) {
      plat.x += plat.moveDir * plat.moveSpeed;
      if (plat.x > plat.originX + plat.moveRange || plat.x < plat.originX - plat.moveRange) {
        plat.moveDir *= -1;
      }
    }
    if (plat.type === 'fragile' && plat.fragileTimer !== undefined) {
      if (player.onGround && aabbCollision(player.x, player.y, player.width, player.height, plat.x, plat.y, plat.width, plat.height)) {
        plat.fragileTimer -= 1;
      }
      if (plat.fragileTimer <= 0) {
        spawnParticles(state, plat.x + plat.width / 2, plat.y + plat.height / 2, COLORS.neonPink, 15, 4);
        plat.y = -1000;
      }
    }
  }

  // === Platform Collisions (top-only, one-way) ===
  player.onGround = false;
  for (const plat of state.platforms) {
    if (plat.y < -500) continue;

    const playerBottom = player.y + player.height;
    const playerRight = player.x + player.width;

    // Check horizontal overlap first
    if (playerRight <= plat.x || player.x >= plat.x + plat.width) continue;

    // Check if player is falling and would land on this platform
    if (player.vy >= 0 && playerBottom >= plat.y && playerBottom <= plat.y + plat.height + Math.abs(player.vy) + 4) {
      // Land on top
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
      if (plat.type === 'moving' && plat.moveSpeed !== undefined && plat.moveDir !== undefined) {
        player.x += plat.moveDir * plat.moveSpeed;
      }
    }
  }

  // === Coin Collection ===
  for (const coin of state.coins) {
    if (coin.collected) continue;

    const cy = coin.y + Math.sin(Date.now() / 500 + coin.bobOffset) * 4;
    const dx = (player.x + player.width / 2) - coin.x;
    const dy = (player.y + player.height / 2) - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < coin.radius + 20) {
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

    enemy.x += enemy.vx;
    enemy.animTimer += 1;
    if (enemy.animTimer > 10) {
      enemy.animFrame = (enemy.animFrame + 1) % 2;
      enemy.animTimer = 0;
    }

    if (enemy.type === 'flyer') {
      enemy.y += Math.sin(Date.now() / 400) * 0.5;
    }

    if (enemy.x < enemy.originX || enemy.x > enemy.originX + enemy.moveRange) {
      enemy.vx *= -1;
    }

    // Collision with player
    if (player.invincible <= 0 && aabbCollision(player.x, player.y, player.width, player.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
      if (player.vy > 0 && player.y + player.height < enemy.y + enemy.height / 2 + 8) {
        // Stomp
        enemy.isAlive = false;
        player.vy = JUMP_FORCE * 0.65;
        state.score += 50;
        spawnParticles(state, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, COLORS.neonPink, 12, 4);
      } else {
        // Take damage
        player.isAlive = false;
        state.phase = 'gameover';
        spawnParticles(state, player.x + player.width / 2, player.y + player.height / 2, COLORS.neonPink, 20, 6);
      }
    }
  }

  // === Particles ===
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= 1;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  // === Camera (smooth follow) ===
  const targetCameraX = player.x - CANVAS_WIDTH / 3;
  state.camera.x += (targetCameraX - state.camera.x) * 0.08;
  state.camera.x = Math.max(0, Math.min(LEVEL_WIDTH - CANVAS_WIDTH, state.camera.x));

  state.backgroundOffset = state.camera.x * 0.3;
  state.distance = Math.floor(player.x / 10);

  // === Fall death ===
  if (player.y > CANVAS_HEIGHT + 150) {
    player.isAlive = false;
    state.phase = 'gameover';
  }
}

// ===================== DRAWING =====================

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, time: number, assets?: GameAssets) {
  const { camera, player, platforms, coins, enemies, particles } = state;

  // Clear + Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, COLORS.bgGradient1);
  bgGrad.addColorStop(1, COLORS.bgGradient2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Stars (parallax)
  for (const star of state.stars) {
    const sx = star.x - camera.x * star.speed;
    const wrappedX = ((sx % (CANVAS_WIDTH + 100)) + CANVAS_WIDTH + 100) % (CANVAS_WIDTH + 100);
    const alpha = star.brightness * (0.7 + 0.3 * Math.sin(time / 1000 + star.x));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(wrappedX, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cityscape
  drawCityscape(ctx, state);

  // Camera transform for world objects
  ctx.save();
  ctx.translate(-camera.x, 0);

  // === Floating Ritual Logo Arts ===
  if (assets?.ritualLogoImg && assets.ritualLogoImg.complete) {
    for (const art of state.floatingArts) {
      const sx = art.x;
      if (sx < camera.x - 100 || sx > camera.x + CANVAS_WIDTH + 100) continue;
      const bobY = art.y + Math.sin(time / 1500 + art.bobOffset) * 10;
      ctx.save();
      ctx.globalAlpha = art.alpha;
      ctx.translate(sx, bobY);
      ctx.rotate(time * art.rotationSpeed);
      ctx.drawImage(assets.ritualLogoImg, -art.size / 2, -art.size / 2, art.size, art.size);
      ctx.restore();
    }
  }

  // === Platforms ===
  for (const plat of platforms) {
    if (plat.y < -500) continue;
    if (plat.x + plat.width < camera.x - 50 || plat.x > camera.x + CANVAS_WIDTH + 50) continue;

    ctx.shadowColor = plat.glowColor || COLORS.platformBorder;
    ctx.shadowBlur = 8;
    ctx.fillStyle = plat.color || COLORS.platform;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    ctx.strokeStyle = plat.glowColor || COLORS.platformBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

    // Top highlight
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plat.x, plat.y);
    ctx.lineTo(plat.x + plat.width, plat.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fragile warning flash
    if (plat.type === 'fragile' && plat.fragileTimer !== undefined && plat.fragileTimer < 40) {
      const alpha = plat.fragileTimer < 20 ? 0.3 + 0.7 * Math.abs(Math.sin(time / 80)) : 0.3;
      ctx.fillStyle = `rgba(255, 51, 102, ${alpha})`;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    }
  }

  // === Coins ===
  for (const coin of coins) {
    if (coin.collected) continue;

    const cy = coin.y + Math.sin(time / 500 + coin.bobOffset) * 4;
    const color = coin.type === 'legendary' ? COLORS.legendaryCoin : coin.type === 'rare' ? COLORS.rareCoin : COLORS.coin;

    ctx.shadowColor = color;
    ctx.shadowBlur = coin.type === 'legendary' ? 15 : 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(coin.x, cy, coin.radius, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(coin.x - coin.radius * 0.2, cy - coin.radius * 0.2, coin.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Legendary sparkle
    if (coin.type === 'legendary') {
      ctx.strokeStyle = COLORS.legendaryCoin;
      ctx.lineWidth = 1;
      for (let s = 0; s < 4; s++) {
        const angle = time / 200 + (s * Math.PI) / 2;
        const len = coin.radius + 5 + Math.sin(time / 150 + s) * 3;
        ctx.beginPath();
        ctx.moveTo(coin.x + Math.cos(angle) * coin.radius, cy + Math.sin(angle) * coin.radius);
        ctx.lineTo(coin.x + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  }

  // === Enemies ===
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    ctx.shadowColor = COLORS.enemyGlow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.enemy;

    if (enemy.type === 'flyer') {
      ctx.beginPath();
      ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
      ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
      ctx.lineTo(enemy.x, enemy.y + enemy.height);
      ctx.closePath();
      ctx.fill();

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
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      ctx.fillStyle = '#ffffff';
      const eyeOff = enemy.vx > 0 ? 4 : -1;
      ctx.fillRect(enemy.x + enemy.width / 2 + eyeOff - 2, enemy.y + 6, 3, 3);
      ctx.fillRect(enemy.x + enemy.width / 2 + eyeOff + 4, enemy.y + 6, 3, 3);
    }
    ctx.shadowBlur = 0;
  }

  // === Player ===
  if (player.isAlive) {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;

    // Trail
    if (Math.abs(player.vx) > 1 || !player.onGround) {
      ctx.fillStyle = COLORS.playerTrail;
      ctx.beginPath();
      ctx.roundRect(px - 2, py + 4, pw, ph - 4, 4);
      ctx.fill();
    }

    if (assets?.characterImg && assets.characterImg.complete) {
      // Character image sprite
      ctx.save();
      ctx.shadowColor = COLORS.playerGlow;
      ctx.shadowBlur = 12;

      if (player.facing === 'left') {
        ctx.translate(px + pw / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(assets.characterImg, -pw / 2 - 2, py - 2, pw + 4, ph + 4);
      } else {
        ctx.drawImage(assets.characterImg, px - 2, py - 2, pw + 4, ph + 4);
      }

      // Lightning aura
      const pulseAlpha = 0.12 + 0.08 * Math.sin(time / 300);
      ctx.strokeStyle = `rgba(0, 255, 170, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px - 4, py - 4, pw + 8, ph + 8, 8);
      ctx.stroke();
      ctx.restore();
    } else {
      // Fallback geometric player
      ctx.shadowColor = COLORS.playerGlow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 5);
      ctx.fill();

      const faceDir = player.facing === 'right' ? 1 : -1;
      ctx.fillStyle = '#0a0a2e';
      ctx.beginPath();
      ctx.arc(px + pw / 2 + faceDir * 4, py + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px + pw / 2 + faceDir * 5, py + 9, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Legs animation
    ctx.fillStyle = COLORS.player;
    if (player.onGround && Math.abs(player.vx) > 0.5) {
      const legOff = Math.sin(time / 80) * 4;
      ctx.fillRect(px + 7, py + ph, 4, 4 + legOff);
      ctx.fillRect(px + pw - 11, py + ph, 4, 4 - legOff);
    } else {
      ctx.fillRect(px + 7, py + ph, 4, 3);
      ctx.fillRect(px + pw - 11, py + ph, 4, 3);
    }

    // Jetpack flame
    if (!player.onGround) {
      ctx.fillStyle = COLORS.neonBlue;
      ctx.fillRect(px + pw / 2 - 4, py + ph + 2, 8, 3);
      const flameLen = 5 + Math.random() * 5;
      ctx.fillStyle = COLORS.neonYellow;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2 - 3, py + ph + 5);
      ctx.lineTo(px + pw / 2 + 3, py + ph + 5);
      ctx.lineTo(px + pw / 2, py + ph + 5 + flameLen);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // === Particles ===
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

  ctx.fillStyle = 'rgba(15, 15, 45, 0.8)';
  const bw = [40, 30, 50, 35, 45, 25, 55, 30, 40, 60];
  for (let i = 0; i < bw.length; i++) {
    const bx = i * 90 - (offset % 90);
    const bh = 80 + bw[i] + Math.sin(i * 2.5) * 30;
    ctx.fillRect(bx, CANVAS_HEIGHT - bh, bw[i], bh);

    ctx.fillStyle = 'rgba(0, 255, 170, 0.15)';
    for (let wy = CANVAS_HEIGHT - bh + 10; wy < CANVAS_HEIGHT - 20; wy += 15) {
      for (let wx = bx + 5; wx < bx + bw[i] - 5; wx += 10) {
        if (Math.sin(wx * 7 + wy * 3 + i) > 0) {
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    ctx.fillStyle = 'rgba(15, 15, 45, 0.8)';
  }

  ctx.strokeStyle = 'rgba(0, 255, 170, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT - 30);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 30);
  ctx.stroke();
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

// === HUD ===
export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, walletAddress: string | null, balance: string) {
  ctx.fillStyle = COLORS.hud;
  ctx.strokeStyle = COLORS.hudBorder;
  ctx.lineWidth = 1;

  // Score panel (top-left)
  roundRect(ctx, 10, 10, 190, 75, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.neonYellow;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('SCORE', 22, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(state.score.toString().padStart(8, '0'), 22, 54);

  ctx.fillStyle = COLORS.neonBlue;
  ctx.font = '11px monospace';
  ctx.fillText(`${state.distance}m`, 130, 30);

  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(138, 50, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px monospace';
  const collectedCoins = state.coins.filter(c => c.collected).length;
  ctx.fillText('x' + collectedCoins, 148, 54);

  // Wallet panel (top-right)
  if (walletAddress) {
    const wpw = 250;
    const wx = CANVAS_WIDTH - wpw - 10;
    roundRect(ctx, wx, 10, wpw, 65, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = '11px monospace';
    ctx.fillText('RITUAL TESTNET', wx + 14, 30);

    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.fillText(walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4), wx + 14, 46);

    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${balance} ETH`, wx + 14, 62);

    ctx.fillStyle = COLORS.neonGreen;
    ctx.beginPath();
    ctx.arc(wx + wpw - 18, 28, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Jump indicators
  if (state.player.isAlive) {
    const jumpY = CANVAS_HEIGHT - 30;
    for (let i = 0; i < state.player.maxJumps; i++) {
      ctx.fillStyle = i < state.player.jumpsLeft ? COLORS.neonGreen : 'rgba(0, 255, 170, 0.2)';
      ctx.beginPath();
      ctx.arc(22 + i * 20, jumpY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.bg;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'J' : 'J2', 22 + i * 20, jumpY + 3);
      ctx.textAlign = 'left';
    }
  }

  // Controls hint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A/D: Move  |  W/Space: Jump  |  Double Jump!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 8);
  ctx.textAlign = 'left';
}

// === START SCREEN ===
export function drawStartScreen(ctx: CanvasRenderingContext2D, time: number, walletAddress: string | null, assets?: GameAssets) {
  ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign = 'center';

  // Character art (left)
  if (assets?.characterImg && assets.characterImg.complete) {
    ctx.save();
    const cx = CANVAS_WIDTH / 2 - 180, cy = 195, cw = 130, ch = 170;
    ctx.shadowColor = COLORS.neonGreen;
    ctx.shadowBlur = 25;
    ctx.fillStyle = 'rgba(0, 255, 170, 0.05)';
    ctx.beginPath();
    ctx.arc(cx + cw / 2, cy + ch / 2, cw / 2 + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const pulse = 0.92 + 0.08 * Math.sin(time / 600);
    ctx.save();
    ctx.translate(cx + cw / 2, cy + ch / 2);
    ctx.scale(pulse, pulse);
    ctx.drawImage(assets.characterImg, -cw / 2, -ch / 2, cw, ch);
    ctx.strokeStyle = `rgba(0, 255, 170, ${0.3 + 0.2 * Math.sin(time / 400)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonGreen;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-cw / 2 - 3, -ch / 2 - 3, cw + 6, ch + 6, 10);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // Ritual logo art (right)
  if (assets?.ritualLogoImg && assets.ritualLogoImg.complete) {
    ctx.save();
    const lx = CANVAS_WIDTH / 2 + 50, ly = 195, ls = 120;
    ctx.globalAlpha = 0.7 + 0.15 * Math.sin(time / 800);
    const lp = 1 + 0.04 * Math.sin(time / 500);
    ctx.translate(lx + ls / 2, ly + ls / 2);
    ctx.rotate(time * 0.0005);
    ctx.scale(lp, lp);
    ctx.drawImage(assets.ritualLogoImg, -ls / 2, -ls / 2, ls, ls);
    ctx.strokeStyle = `rgba(0, 255, 170, ${0.2 + 0.15 * Math.sin(time / 400)})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonGreen;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, ls / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Title
  ctx.shadowColor = COLORS.neonGreen;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.neonGreen;
  ctx.font = 'bold 40px monospace';
  ctx.fillText('RITUAL RUNNER', CANVAS_WIDTH / 2, 70);
  ctx.shadowBlur = 0;

  ctx.fillStyle = COLORS.neonPink;
  ctx.font = '14px monospace';
  ctx.fillText('Blockchain Platform Game on Ritual Testnet', CANVAS_WIDTH / 2, 95);

  ctx.strokeStyle = COLORS.neonGreen;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH / 2 - 160, 108);
  ctx.lineTo(CANVAS_WIDTH / 2 + 160, 108);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '11px monospace';
  ctx.fillText('Custom character & Ritual blockchain art integrated!', CANVAS_WIDTH / 2, 130);

  // Instructions
  const instructions = [
    'A / D  or  Arrow Keys  \u2192  Move',
    'W / Space  \u2192  Jump  (Double Jump!)',
    'Collect coins & stomp enemies from above',
    'Reach the end to submit score on-chain',
  ];
  ctx.font = '12px monospace';
  instructions.forEach((text, i) => {
    ctx.fillStyle = i === 3 ? COLORS.neonYellow : 'rgba(255,255,255,0.65)';
    ctx.fillText(text, CANVAS_WIDTH / 2, 400 + i * 22);
  });

  if (!walletAddress) {
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = '11px monospace';
    ctx.fillText('Connect MetaMask Wallet to submit scores on-chain', CANVAS_WIDTH / 2, 495);
  } else {
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = '11px monospace';
    ctx.fillText('Wallet Connected \u2713', CANVAS_WIDTH / 2, 495);
  }

  // Start button
  const pulse = 0.92 + 0.08 * Math.sin(time / 400);
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COLORS.neonGreen;
  ctx.font = 'bold 17px monospace';
  ctx.shadowColor = COLORS.neonGreen;
  ctx.shadowBlur = 15;
  ctx.fillText('Press ENTER or SPACE to Start', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.textAlign = 'left';
}

// === GAME OVER SCREEN ===
export function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, time: number, walletAddress: string | null) {
  ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign = 'center';

  ctx.shadowColor = COLORS.neonPink;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.neonPink;
  ctx.font = 'bold 38px monospace';
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 100);
  ctx.shadowBlur = 0;

  ctx.fillStyle = COLORS.neonYellow;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('FINAL SCORE', CANVAS_WIDTH / 2, 160);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 32px monospace';
  ctx.fillText(state.score.toString(), CANVAS_WIDTH / 2, 200);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '13px monospace';
  ctx.fillText(`Distance: ${state.distance}m`, CANVAS_WIDTH / 2, 240);
  ctx.fillText(`Coins: ${state.coins.filter(c => c.collected).length}`, CANVAS_WIDTH / 2, 265);

  // On-chain status
  if (walletAddress && !state.onChainScoreSubmitted && !state.pendingSubmission) {
    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = '13px monospace';
    ctx.fillText('Press S to submit score on-chain!', CANVAS_WIDTH / 2, 330);
  } else if (state.pendingSubmission) {
    ctx.fillStyle = COLORS.neonBlue;
    ctx.font = '13px monospace';
    const dots = '.'.repeat(Math.floor(time / 400) % 4);
    ctx.fillText(`Submitting to Ritual Testnet${dots}`, CANVAS_WIDTH / 2, 330);
  } else if (state.onChainScoreSubmitted) {
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = '13px monospace';
    ctx.shadowColor = COLORS.neonGreen;
    ctx.shadowBlur = 10;
    ctx.fillText('Score Submitted On-Chain!', CANVAS_WIDTH / 2, 330);
    ctx.shadowBlur = 0;
    if (state.lastBlockHash) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '9px monospace';
      ctx.fillText('Tx: ' + state.lastBlockHash.slice(0, 22) + '...', CANVAS_WIDTH / 2, 350);
    }
  }

  // Restart
  const pulse = 0.92 + 0.08 * Math.sin(time / 400);
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, 420);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('Press ENTER to Restart', 0, 0);
  ctx.restore();

  ctx.textAlign = 'left';
}
