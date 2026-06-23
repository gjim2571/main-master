'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import {
  GameState,
  GameAssets,
  GamePhase,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  createInitialGameState,
  generateLevel,
  resetGameForPlaying,
} from '@/lib/gameTypes';
import {
  setupInputListeners,
  keys,
  wasJustPressed,
  clearJustPressed,
  simulateKeyDown,
  simulateKeyUp,
  updateGame,
  drawGame,
  drawHUD,
  drawGameOver,
  drawCharacterSelect,
  setActiveCharacters,
} from '@/lib/gameEngine';
import {
  getRandomCharacters,
  applyAbilityToState,
  RARITY_COLORS,
  GameCharacter,
} from '@/lib/characters';
import { Wallet, Unplug, RotateCcw, Trophy, Zap, Crown, Medal, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ScoreEntry {
  score: number;
  address: string;
  time: string;
  characterName: string;
  characterId: number;
  abilityName: string;
  rarity: string;
}

const CHARACTER_COUNT = 10;

export default function RitualGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const animFrameRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const assetsRef = useRef<GameAssets>({ characterImg: null, ritualLogoImg: null });
  const uiUpdateTimerRef = useRef<number>(0);
  const lastPhaseRef = useRef<GamePhase>('select');
  const charSelectIndexRef = useRef(0);
  const displayCharsRef = useRef<GameCharacter[]>(getRandomCharacters(CHARACTER_COUNT));
  const charImgsRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const lastSelectedCharRef = useRef<GameCharacter | null>(null);

  const [gamePhase, setGamePhase] = useState<GamePhase>('select');
  const [chainSubmitted, setChainSubmitted] = useState(false);
  const [chainPending, setChainPending] = useState(false);
  const [chainTxHash, setChainTxHash] = useState('');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayDistance, setDisplayDistance] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [selectedCharName, setSelectedCharName] = useState('');
  const [selectedCharAbility, setSelectedCharAbility] = useState('');
  const [selectedCharRarity, setSelectedCharRarity] = useState('');

  const walletRef = useRef({ address: '' as string | null, balance: '' as string, isConnected: false, isCorrectNetwork: false });
  const { wallet, connect, disconnect, switchToRitual } = useWallet();
  walletRef.current = { address: wallet.address, balance: wallet.balance, isConnected: wallet.isConnected, isCorrectNetwork: wallet.isCorrectNetwork };

  const [highScores, setHighScores] = useState<ScoreEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ritual-game-scores');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Preload images
  useEffect(() => {
    const charImg = new Image();
    charImg.src = '/character-art.jpeg';
    charImg.onload = () => { assetsRef.current.characterImg = charImg; setAssetsLoaded(true); };
    charImg.onerror = () => setAssetsLoaded(true);

    const logoImg = new Image();
    logoImg.src = '/ritual-logo-art.jpeg';
    logoImg.onload = () => { assetsRef.current.ritualLogoImg = logoImg; };

    // Preload all character images
    const preloadChars = () => {
      displayCharsRef.current.forEach(ch => {
        if (!charImgsRef.current.has(ch.id)) {
          const img = new Image();
          img.src = ch.imageSrc;
          img.onload = () => { charImgsRef.current.set(ch.id, img); };
          charImgsRef.current.set(ch.id, img);
        }
      });
    };
    preloadChars();
  }, []);

  const saveScore = useCallback((score: number, address: string, charName: string, charId: number, abilityName: string, rarity: string) => {
    const entry: ScoreEntry = { score, address: address || 'anonymous', time: new Date().toLocaleString(), characterName: charName, characterId, abilityName, rarity };
    setHighScores(prev => {
      const newScores = [...prev, entry].sort((a, b) => b.score - a.score).slice(0, 50);
      try { localStorage.setItem('ritual-game-scores', JSON.stringify(newScores)); } catch { /* ignore */ }
      return newScores;
    });
  }, []);

  const submitScoreOnChain = useCallback(async () => {
    const w = walletRef.current;
    if (!w.isConnected || chainSubmitted || chainPending) return;
    setChainPending(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const hash = '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    gameStateRef.current.lastBlockHash = hash;
    gameStateRef.current.onChainScoreSubmitted = true;
    gameStateRef.current.pendingSubmission = false;
    setChainTxHash(hash);
    setChainSubmitted(true);
    setChainPending(false);
  }, [chainSubmitted, chainPending]);

  const confirmCharacterAndStart = useCallback(() => {
    const state = gameStateRef.current;
    const chars = displayCharsRef.current;
    const idx = charSelectIndexRef.current;
    const selected = chars[idx];
    if (!selected) return;

    const charImg = charImgsRef.current.get(selected.id) || null;

    resetGameForPlaying(state);
    state.selectedCharacterId = selected.id;
    state.selectedCharacterImg = charImg;
    applyAbilityToState(state, selected);

    setActiveCharacters(chars);
    lastSelectedCharRef.current = selected;

    setSelectedCharName(selected.name);
    setSelectedCharAbility(selected.ability.name);
    setSelectedCharRarity(selected.rarity);
    setDisplayScore(0);
    setDisplayDistance(0);
    setDisplayCoins(0);
    setChainSubmitted(false);
    setChainPending(false);
    setChainTxHash('');
    setGamePhase('playing');
  }, []);

  const startGame = useCallback(() => {
    const state = gameStateRef.current;
    if (state.phase === 'playing') return;
    const newChars = getRandomCharacters(CHARACTER_COUNT);
    displayCharsRef.current = newChars;
    charSelectIndexRef.current = 0;

    // Preload new character images
    newChars.forEach(ch => {
      if (!charImgsRef.current.has(ch.id)) {
        const img = new Image();
        img.src = ch.imageSrc;
        img.onload = () => { charImgsRef.current.set(ch.id, img); };
        charImgsRef.current.set(ch.id, img);
      }
    });

    state.phase = 'select';
    setGamePhase('select');
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    generateLevel(gameStateRef.current);
    cleanupRef.current = setupInputListeners();

    let selectBrowseCooldown = 0;

    const loop = (timestamp: number) => {
      const state = gameStateRef.current;
      const w = walletRef.current;
      const charCount = displayCharsRef.current.length;

      if (state.phase === 'select') {
        if (selectBrowseCooldown > 0) selectBrowseCooldown--;
        if (selectBrowseCooldown === 0) {
          if (wasJustPressed('ArrowLeft') || wasJustPressed('KeyA')) {
            charSelectIndexRef.current = (charSelectIndexRef.current - 1 + charCount) % charCount;
            selectBrowseCooldown = 8;
          }
          if (wasJustPressed('ArrowRight') || wasJustPressed('KeyD')) {
            charSelectIndexRef.current = (charSelectIndexRef.current + 1) % charCount;
            selectBrowseCooldown = 8;
          }
        }
        if (wasJustPressed('Enter') || wasJustPressed('Space')) {
          confirmCharacterAndStart();
        }
      } else if (state.phase === 'gameover') {
        if (wasJustPressed('Enter') || wasJustPressed('Space')) {
          const newChars = getRandomCharacters(CHARACTER_COUNT);
          displayCharsRef.current = newChars;
          charSelectIndexRef.current = 0;
          newChars.forEach(ch => {
            if (!charImgsRef.current.has(ch.id)) {
              const img = new Image();
              img.src = ch.imageSrc;
              img.onload = () => { charImgsRef.current.set(ch.id, img); };
              charImgsRef.current.set(ch.id, img);
            }
          });
          // Reset state but go to select (not playing)
          const { stars, floatingArts, onChainScoreSubmitted, pendingSubmission, lastBlockHash } = state;
          Object.assign(state, createInitialGameState());
          state.stars = stars;
          state.floatingArts = floatingArts;
          state.onChainScoreSubmitted = onChainScoreSubmitted;
          state.pendingSubmission = pendingSubmission;
          state.lastBlockHash = lastBlockHash;
          state.phase = 'select';
          generateLevel(state);
          setActiveCharacters(newChars);
          setGamePhase('select');
        }
        if (wasJustPressed('KeyS') && w.isConnected) {
          submitScoreOnChain();
        }
      }

      updateGame(state);
      clearJustPressed();

      // Throttled UI sync
      if (timestamp - uiUpdateTimerRef.current > 200) {
        uiUpdateTimerRef.current = timestamp;
        if (state.phase === 'playing') {
          setDisplayScore(state.score);
          setDisplayDistance(state.distance);
          setDisplayCoins(state.coins.filter(c => c.collected).length);
        }
        if (state.phase === 'gameover' && lastPhaseRef.current !== 'gameover') {
          setGamePhase('gameover');
          const charId = state.selectedCharacterId;
          const ch = displayCharsRef.current.find(c => c.id === charId);
          saveScore(state.score, w.address || '', ch?.name || 'Unknown', charId, ch?.ability.name || '', ch?.rarity || 'common');
        }
        if (state.phase === 'select' && lastPhaseRef.current !== 'select') {
          setGamePhase('select');
        }
        lastPhaseRef.current = state.phase;
      }

      // Draw
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const assets = assetsRef.current;

      if (state.phase === 'select') {
        drawGame(ctx, state, timestamp, assets);
        drawCharacterSelect(ctx, timestamp, displayCharsRef.current, charImgsRef.current, charSelectIndexRef.current);
 } else if (state.phase === 'playing') {
        drawGame(ctx, state, timestamp, assets);
        drawHUD(ctx, state, w.address, w.balance);
      } else if (state.phase === 'gameover') {
        drawGame(ctx, state, timestamp, assets);
        drawGameOver(ctx, state, timestamp, w.address);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animFrameRef.current); cleanupRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmCharacterAndStart, submitScoreOnChain, saveScore]);

  // Mobile: handle character select with swipe-like buttons
  const mobileSelectLeft = () => {
    if (gameStateRef.current.phase === 'select') {
      const count = displayCharsRef.current.length;
      charSelectIndexRef.current = (charSelectIndexRef.current - 1 + count) % count;
    }
  };
  const mobileSelectRight = () => {
    if (gameStateRef.current.phase === 'select') {
      const count = displayCharsRef.current.length;
      charSelectIndexRef.current = (charSelectIndexRef.current + 1) % count;
    }
  };
  const mobileConfirm = () => {
    if (gameStateRef.current.phase === 'select') {
      confirmCharacterAndStart();
    } else if (gameStateRef.current.phase === 'gameover') {
      startGame();
    }
  };

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-3 h-3 text-[#ffd700]" />;
    if (i === 1) return <Medal className="w-3 h-3 text-[#c0c0c0]" />;
    if (i === 2) return <Medal className="w-3 h-3 text-[#cd7f32]" />;
    return <span className="text-white/30 text-[10px] font-mono w-3 text-center">{i + 1}</span>;
  };

  const getCharImgSrc = (entry: ScoreEntry) => {
    if (entry.characterId > 0) {
      const chars = displayCharsRef.current;
      const ch = chars.find(c => c.id === entry.characterId);
      if (ch) return ch.imageSrc;
    }
    return '/characters/char1.jpg';
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center relative overflow-hidden" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#0a0a1a] to-[#1a0a2e] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00ffaa] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#ff3366] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#00ffaa]/30 shadow-[0_0_10px_rgba(0,255,170,0.2)]">
            <img src="/ritual-logo-art.jpeg" alt="Ritual" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#00ffaa] font-mono tracking-wider">RITUAL RUNNER</h1>
            <p className="text-xs text-[#00ffaa]/50 font-mono">Blockchain Platform Game</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {wallet.isConnected ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[#00ffaa] border-[#00ffaa]/30 bg-[#00ffaa]/10 font-mono text-xs">
                <span className="w-2 h-2 rounded-full bg-[#00ffaa] mr-1.5 animate-pulse" />
                {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
              </Badge>
              <Badge variant="outline" className="text-[#ffd700] border-[#ffd700]/30 bg-[#ffd700]/10 font-mono text-xs">
                {wallet.balance} ETH
              </Badge>
              {!wallet.isCorrectNetwork && (
                <Button size="sm" variant="outline" className="border-[#ff3366] text-[#ff3366] hover:bg-[#ff3366]/10 font-mono text-xs" onClick={switchToRitual}>Switch</Button>
              )}
              <Button size="sm" variant="ghost" className="text-white/50 hover:text-white font-mono text-xs" onClick={disconnect}>
                <Unplug className="w-3 h-3 mr-1" />Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" className="bg-[#00ffaa] text-[#0a0a1a] hover:bg-[#00ffaa]/90 font-mono font-bold text-xs" onClick={connect}>
              <Wallet className="w-3 h-3 mr-1.5" />Connect Wallet
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 py-3 flex flex-col lg:flex-row gap-4">
        <div ref={containerRef} className="flex-1 flex flex-col items-center">
          {/* Stats bar */}
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#ffd700]" />
                <span className="text-[#ffd700] font-mono text-sm font-bold">{displayScore.toLocaleString()}</span>
              </div>
              <div className="text-white/40 font-mono text-xs">
                <span className="text-[#00e5ff]">{displayDistance}m</span> · <span className="text-[#ffd700]">{displayCoins} coins</span>
              </div>
            </div>
            {selectedCharName && gamePhase === 'playing' && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[#00ffaa]/70 border-[#00ffaa]/20 bg-[#00ffaa]/5 font-mono text-[10px]">
                  {selectedCharName}
                </Badge>
                {selectedCharAbility && (
                  <Badge variant="outline" className="text-white/40 border-white/10 bg-white/5 font-mono text-[9px]">
                    {selectedCharAbility}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="relative rounded-xl overflow-hidden border border-[#00ffaa]/20 shadow-[0_0_30px_rgba(0,255,170,0.1)]" style={{ touchAction: 'none' }}>
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block w-full max-w-[800px] h-auto cursor-default" style={{ touchAction: 'none' }} />
          </div>

          {/* Mobile controls */}
          <div className="w-full flex justify-center mt-3 lg:hidden" style={{ touchAction: 'none' }}>
            <div className="flex items-center gap-4">
              <button data-game-control="true" onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('ArrowLeft'); }} onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('ArrowLeft'); }} onTouchCancel={(e) => { e.preventDefault(); simulateKeyUp('ArrowLeft'); }} onContextMenu={(e) => e.preventDefault()} className="w-16 h-16 rounded-xl bg-white/10 border border-[#00ffaa]/30 flex items-center justify-center text-[#00ffaa] font-mono text-2xl active:bg-[#00ffaa]/25 select-none" style={{ touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}>&larr;</button>
              <button data-game-control="true" onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('ArrowUp'); }} onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('ArrowUp'); }} onTouchCancel={(e) => { e.preventDefault(); simulateKeyUp('ArrowUp'); }} onContextMenu={(e) => e.preventDefault()} className="w-16 h-16 rounded-xl bg-[#00ffaa]/15 border border-[#00ffaa]/40 flex items-center justify-center text-[#00ffaa] font-mono text-sm font-bold active:bg-[#00ffaa]/30 select-none" style={{ touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}>JUMP</button>
              <button data-game-control="true" onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('ArrowRight'); }} onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('ArrowRight'); }} onTouchCancel={(e) => { e.preventDefault(); simulateKeyUp('ArrowRight'); }} onContextMenu={(e) => e.preventDefault()} className="w-16 h-16 rounded-xl bg-white/10 border border-[#00ffaa]/30 flex items-center justify-center text-[#00ffaa] font-mono text-2xl active:bg-[#00ffaa]/25 select-none" style={{ touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}>&rarr;</button>
            </div>
          </div>

          {/* Mobile select/confirm for character select screen */}
          {gamePhase === 'select' && (
            <div className="w-full flex justify-center mt-3 lg:hidden gap-3" style={{ touchAction: 'none' }}>
              <button onTouchStart={(e) => { e.preventDefault(); mobileSelectLeft(); }} className="px-5 py-3 rounded-xl bg-white/10 border border-[#00ffaa]/20 text-[#00ffaa] font-mono text-sm select-none active:bg-[#00ffaa]/15" style={{ touchAction: 'none' }}>&larr; Prev</button>
              <button onTouchStart={(e) => { e.preventDefault(); mobileConfirm(); }} className="px-7 py-3 rounded-xl bg-[#00ffaa] text-[#0a0a1a] font-mono font-bold text-sm select-none active:bg-[#00ffaa]/90" style={{ touchAction: 'none' }}>Confirm</button>
              <button onTouchStart={(e) => { e.preventDefault(); mobileSelectRight(); }} className="px-5 py-3 rounded-xl bg-white/10 border border-[#00ffaa]/20 text-[#00ffaa] font-mono text-sm select-none active:bg-[#00ffaa]/15" style={{ touchAction: 'none' }}>Next &rarr;</button>
            </div>
          )}

          {/* Mobile restart (gameover only) */}
          {gamePhase === 'gameover' && (
            <button onClick={startGame} className="mt-3 px-6 py-2 bg-[#00ffaa] text-[#0a0a1a] font-mono font-bold text-sm rounded-lg hover:bg-[#00ffaa]/90 transition-colors shadow-[0_0_15px_rgba(0,255,170,0.3)] lg:hidden">
              {gamePhase === 'gameover' ? 'Play Again' : 'Start Game'}
            </button>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-3">
          {/* Selected Character Info (during playing/gameover) */}
          {(gamePhase === 'playing' || gamePhase === 'gameover') && lastSelectedCharRef.current && (
            <Card className="bg-[#0f0f2f] border-[#00ffaa]/15">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-mono text-[#00ffaa] flex items-center gap-2">
                  <Star className="w-3 h-3" />Active Character
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex items-center gap-3">
                  {lastSelectedCharRef.current && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                      <img src={lastSelectedCharRef.current.imageSrc} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white truncate">{selectedCharName}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono" style={{ borderColor: RARITY_COLORS[selectedCharRarity as keyof typeof RARITY_COLORS] + '60', color: RARITY_COLORS[selectedCharRarity as keyof typeof RARITY_COLORS] }}>
                        {selectedCharRarity?.toUpperCase()}
                      </Badge>
                    </div>
                    {selectedCharAbility && (
                      <div className="font-mono text-[10px] text-white/40 mt-0.5">{selectedCharAbility}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          <Card className="bg-[#0f0f2f] border-[#00ffaa]/15 flex-1">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-mono text-[#ffd700] flex items-center gap-2">
                <Trophy className="w-3 h-3" />Ranking Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <ScrollArea className="max-h-[340px]">
                {highScores.length === 0 ? (
                  <p className="text-white/30 font-mono text-xs text-center py-6">No scores yet! Be the first.</p>
                ) : (
                  <div className="space-y-1.5">
                    {highScores.map((entry, i) => (
                      <div key={`${entry.time}-${i}`} className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${i === 0 ? 'bg-[#ffd700]/10 border border-[#ffd700]/20' : i === 1 ? 'bg-white/5 border border-white/10' : i === 2 ? 'bg-[#ff6ec7]/5 border border-[#ff6ec7]/10' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0 w-4 flex justify-center">{getRankIcon(i)}</div>
                          <img
                            src={getCharImgSrc(entry)}
                            alt=""
                            className="w-6 h-6 rounded flex-shrink-0 object-cover border border-white/10"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="min-w-0">
                            <div className="font-mono text-[10px] text-white/70 truncate font-bold">{entry.characterName}</div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[8px] text-white/25 truncate max-w-[80px]">{entry.address.slice(0, 6)}...{entry.address.slice(-4)}</span>
                              {entry.rarity && (
                                <span className="font-mono text-[7px] px-1 rounded" style={{ color: RARITY_COLORS[entry.rarity as keyof typeof RARITY_COLORS] || '#00ffaa', backgroundColor: (RARITY_COLORS[entry.rarity as keyof typeof RARITY_COLORS] || '#00ffaa') + '15' }}>
                                  {entry.rarity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="font-mono text-xs font-bold text-[#ffd700]">{entry.score.toLocaleString()}</span>
                          {entry.abilityName && (
                            <span className="font-mono text-[8px] text-white/25">{entry.abilityName}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Network Info */}
          <Card className="bg-[#0f0f2f] border-[#00ffaa]/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-mono text-[#00ffaa] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ffaa] animate-pulse" />Ritual Testnet
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between"><span className="text-white/40">Chain ID</span><span className="text-white/70">1117</span></div>
                <div className="flex justify-between"><span className="text-white/40">Status</span><span className={wallet.isConnected && wallet.isCorrectNetwork ? 'text-[#00ffaa]' : 'text-[#ff3366]'}>{wallet.isConnected && wallet.isCorrectNetwork ? 'Connected' : 'Not Connected'}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* On-chain submit */}
          {gamePhase === 'gameover' && wallet.isConnected && wallet.isCorrectNetwork && (
            <Card className="bg-[#0f0f2f] border-[#ffd700]/20">
              <CardContent className="p-4">
                {chainSubmitted ? (
                  <div className="text-center">
                    <Badge className="bg-[#00ffaa]/20 text-[#00ffaa] border-[#00ffaa]/30 font-mono text-xs">Score On-Chain</Badge>
                    {chainTxHash && <p className="text-white/30 font-mono text-[10px] mt-2 truncate">Tx: {chainTxHash}</p>}
                  </div>
                ) : (
                  <Button className="w-full bg-[#ffd700] text-[#0a0a1a] hover:bg-[#ffd700]/90 font-mono font-bold text-xs" onClick={submitScoreOnChain} disabled={chainPending}>
                    <Zap className="w-3 h-3 mr-1.5" />{chainPending ? 'Submitting...' : 'Submit Score On-Chain'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {gamePhase === 'gameover' && (
            <Button variant="outline" className="w-full border-[#00ffaa]/20 text-[#00ffaa] hover:bg-[#00ffaa]/10 font-mono text-xs" onClick={startGame}>
              <RotateCcw className="w-3 h-3 mr-1.5" />Play Again
            </Button>
          )}
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-3 flex items-center justify-center text-white/20 font-mono text-xs">
        Built on Ritual Testnet &middot; Powered by MetaMask &middot; 10 Characters &middot; 8 Unique Abilities
      </footer>
    </div>
  );
}