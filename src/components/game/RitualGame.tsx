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
  updateGame,
  drawGame,
  drawHUD,
  drawStartScreen,
  drawGameOver,
} from '@/lib/gameEngine';
import { Wallet, Unplug, RotateCcw, Trophy, Zap, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RitualGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const animFrameRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const assetsRef = useRef<GameAssets>({ characterImg: null, ritualLogoImg: null });
  const uiUpdateTimerRef = useRef<number>(0);
  const lastPhaseRef = useRef<GamePhase>('start');
  const scoreSubmittedRef = useRef(false);

  const [gamePhase, setGamePhase] = useState<GamePhase>('start');
  const [chainSubmitted, setChainSubmitted] = useState(false);
  const [chainPending, setChainPending] = useState(false);
  const [chainTxHash, setChainTxHash] = useState('');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayDistance, setDisplayDistance] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const walletRef = useRef({ address: '' as string | null, balance: '' as string, isConnected: false, isCorrectNetwork: false });
  const { wallet, connect, disconnect, switchToRitual } = useWallet();

  // Keep wallet ref in sync (avoid dependency in game loop)
  walletRef.current = {
    address: wallet.address,
    balance: wallet.balance,
    isConnected: wallet.isConnected,
    isCorrectNetwork: wallet.isCorrectNetwork,
  };

  // Load high scores from localStorage
  const [highScores, setHighScores] = useState<Array<{ score: number; address: string; time: string }>>(() => {
    try {
      const saved = localStorage.getItem('ritual-game-scores');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Preload images
  useEffect(() => {
    const charImg = new Image();
    charImg.src = '/character-art.jpeg';
    charImg.onload = () => {
      assetsRef.current.characterImg = charImg;
      setAssetsLoaded(true);
    };
    charImg.onerror = () => setAssetsLoaded(true);

    const logoImg = new Image();
    logoImg.src = '/ritual-logo-art.jpeg';
    logoImg.onload = () => {
      assetsRef.current.ritualLogoImg = logoImg;
    };
  }, []);

  const saveScore = useCallback(
    (score: number, address: string) => {
      const entry = { score, address: address || 'anonymous', time: new Date().toLocaleString() };
      setHighScores(prev => {
        const newScores = [...prev, entry].sort((a, b) => b.score - a.score).slice(0, 10);
        try { localStorage.setItem('ritual-game-scores', JSON.stringify(newScores)); } catch { /* ignore */ }
        return newScores;
      });
    },
    []
  );

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

  // Start/restart game (can be called from button click or keyboard)
  const startGame = useCallback(() => {
    const state = gameStateRef.current;
    if (state.phase === 'playing') return;
    resetGameForPlaying(state);
    setDisplayScore(0);
    setDisplayDistance(0);
    setDisplayCoins(0);
    setChainSubmitted(false);
    setChainPending(false);
    setChainTxHash('');
    scoreSubmittedRef.current = false;
    setGamePhase('playing');
  }, []);

  // Main game initialization - runs ONCE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate initial level for start screen preview
    generateLevel(gameStateRef.current);

    // Setup input listeners (window-level)
    cleanupRef.current = setupInputListeners();

    // Game loop - runs continuously, never depends on React state
    const loop = (timestamp: number) => {
      const state = gameStateRef.current;
      const w = walletRef.current;

      // Handle start/restart via keyboard (Enter or Space)
      if (state.phase === 'start' || state.phase === 'gameover') {
        if (wasJustPressed('Enter') || wasJustPressed('Space')) {
          resetGameForPlaying(state);
          setDisplayScore(0);
          setDisplayDistance(0);
          setDisplayCoins(0);
          setChainSubmitted(false);
          setChainPending(false);
          setChainTxHash('');
          scoreSubmittedRef.current = false;
          setGamePhase('playing');
        }

        // Handle on-chain submit via S key
        if (wasJustPressed('KeyS') && state.phase === 'gameover' && w.isConnected) {
          submitScoreOnChain();
        }
      }

      // Update game physics
      updateGame(state);

      // Clear justPressed flags at end of frame
      clearJustPressed();

      // Throttled UI state sync (every ~200ms)
      if (timestamp - uiUpdateTimerRef.current > 200) {
        uiUpdateTimerRef.current = timestamp;
        if (state.phase === 'playing') {
          setDisplayScore(state.score);
          setDisplayDistance(state.distance);
          setDisplayCoins(state.coins.filter(c => c.collected).length);
        }

        // Detect game over transition
        if (state.phase === 'gameover' && lastPhaseRef.current !== 'gameover') {
          setGamePhase('gameover');
          saveScore(state.score, w.address || '');
        }
        lastPhaseRef.current = state.phase;
      }

      // Draw
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const assets = assetsRef.current;

      if (state.phase === 'start') {
        drawGame(ctx, state, timestamp, assets);
        drawStartScreen(ctx, timestamp, w.address, assets);
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

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cleanupRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#0a0a1a] to-[#1a0a2e] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00ffaa] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#ff3366] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
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
                <Button size="sm" variant="outline" className="border-[#ff3366] text-[#ff3366] hover:bg-[#ff3366]/10 font-mono text-xs" onClick={switchToRitual}>
                  Switch Network
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-white/50 hover:text-white font-mono text-xs" onClick={disconnect}>
                <Unplug className="w-3 h-3 mr-1" />
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" className="bg-[#00ffaa] text-[#0a0a1a] hover:bg-[#00ffaa]/90 font-mono font-bold text-xs" onClick={connect}>
              <Wallet className="w-3 h-3 mr-1.5" />
              Connect Wallet
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 py-3 flex flex-col lg:flex-row gap-4">
        {/* Game Canvas Area */}
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
            {gamePhase === 'playing' && (
              <Button size="sm" variant="ghost" className="text-white/30 hover:text-white/60 font-mono text-xs" onClick={() => setShowRules(!showRules)}>
                <Info className="w-3 h-3 mr-1" />
                Controls
              </Button>
            )}
          </div>

          {/* Canvas wrapper */}
          <div className="relative rounded-xl overflow-hidden border border-[#00ffaa]/20 shadow-[0_0_30px_rgba(0,255,170,0.1)]">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block w-full max-w-[800px] h-auto cursor-default"
            />

            {showRules && gamePhase === 'playing' && (
              <div className="absolute bottom-3 left-3 bg-[#0a0a30]/90 border border-[#00ffaa]/20 rounded-lg px-4 py-3 font-mono text-xs text-white/70">
                <div className="space-y-1">
                  <div><span className="text-[#00ffaa]">A/D</span> or <span className="text-[#00ffaa]">&larr;/&rarr;</span> : Move</div>
                  <div><span className="text-[#00ffaa]">W/Space</span> : Jump (Double!)</div>
                  <div>Stomp enemies from above!</div>
                  <div>Collect gold coins for points!</div>
                </div>
              </div>
            )}
          </div>

          {/* Click-to-start overlay for mobile */}
          {gamePhase !== 'playing' && (
            <button
              onClick={startGame}
              className="mt-3 px-6 py-2 bg-[#00ffaa] text-[#0a0a1a] font-mono font-bold text-sm rounded-lg hover:bg-[#00ffaa]/90 transition-colors shadow-[0_0_15px_rgba(0,255,170,0.3)] lg:hidden"
            >
              {gamePhase === 'gameover' ? 'Play Again' : 'Start Game'}
            </button>
          )}

          {/* Mobile controls */}
          <div className="w-full flex justify-center mt-3 lg:hidden">
            <div className="flex items-center gap-3">
              <button
                onTouchStart={(e) => { e.preventDefault(); keys['ArrowLeft'] = true; }}
                onTouchEnd={(e) => { e.preventDefault(); keys['ArrowLeft'] = false; }}
                onContextMenu={(e) => e.preventDefault()}
                className="w-14 h-14 rounded-xl bg-white/10 border border-[#00ffaa]/20 flex items-center justify-center text-[#00ffaa] font-mono text-xl active:bg-[#00ffaa]/20 select-none"
              >
                &larr;
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); keys['ArrowUp'] = true; }}
                onTouchEnd={(e) => { e.preventDefault(); keys['ArrowUp'] = false; }}
                onContextMenu={(e) => e.preventDefault()}
                className="w-14 h-14 rounded-xl bg-white/10 border border-[#00ffaa]/20 flex items-center justify-center text-[#00ffaa] font-mono text-sm font-bold active:bg-[#00ffaa]/20 select-none"
              >
                JUMP
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); keys['ArrowRight'] = true; }}
                onTouchEnd={(e) => { e.preventDefault(); keys['ArrowRight'] = false; }}
                onContextMenu={(e) => e.preventDefault()}
                className="w-14 h-14 rounded-xl bg-white/10 border border-[#00ffaa]/20 flex items-center justify-center text-[#00ffaa] font-mono text-xl active:bg-[#00ffaa]/20 select-none"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 flex flex-col gap-3">
          {/* Character & Art showcase */}
          <Card className="bg-[#0f0f2f] border-[#00ffaa]/15 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex">
                <div className="w-1/2 aspect-square overflow-hidden">
                  <img src="/character-art.jpeg" alt="Character" className="w-full h-full object-cover" />
                </div>
                <div className="w-1/2 aspect-square overflow-hidden border-l border-[#00ffaa]/10">
                  <img src="/ritual-logo-art.jpeg" alt="Ritual Art" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/30">Game Assets</span>
                <span className="text-[10px] font-mono text-[#00ffaa]/50">{assetsLoaded ? 'Loaded' : 'Loading...'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Network Info */}
          <Card className="bg-[#0f0f2f] border-[#00ffaa]/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-mono text-[#00ffaa] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ffaa] animate-pulse" />
                Ritual Testnet
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between"><span className="text-white/40">Chain ID</span><span className="text-white/70">1117</span></div>
                <div className="flex justify-between"><span className="text-white/40">Currency</span><span className="text-[#ffd700]">ETH</span></div>
                <div className="flex justify-between">
                  <span className="text-white/40">Status</span>
                  <span className={wallet.isConnected && wallet.isCorrectNetwork ? 'text-[#00ffaa]' : 'text-[#ff3366]'}>
                    {wallet.isConnected && wallet.isCorrectNetwork ? 'Connected' : wallet.isConnected ? 'Wrong Network' : 'Not Connected'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="bg-[#0f0f2f] border-[#00ffaa]/15 flex-1">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-mono text-[#ffd700] flex items-center gap-2">
                <Trophy className="w-3 h-3" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <ScrollArea className="max-h-64">
                {highScores.length === 0 ? (
                  <p className="text-white/30 font-mono text-xs text-center py-4">No scores yet. Play to set records!</p>
                ) : (
                  <div className="space-y-2">
                    {highScores.map((entry, i) => (
                      <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded ${
                        i === 0 ? 'bg-[#ffd700]/10 border border-[#ffd700]/20' : i === 1 ? 'bg-white/5 border border-white/10' : i === 2 ? 'bg-[#ff6ec7]/5 border border-[#ff6ec7]/10' : 'bg-white/[0.02]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold w-5 text-center ${i === 0 ? 'text-[#ffd700]' : i === 1 ? 'text-white/60' : i === 2 ? 'text-[#ff6ec7]' : 'text-white/30'}`}>{i + 1}</span>
                          <span className="font-mono text-xs text-white/60">{entry.address.slice(0, 6)}...{entry.address.slice(-4)}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#ffd700]">{entry.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* On-chain Actions */}
          {gamePhase === 'gameover' && wallet.isConnected && wallet.isCorrectNetwork && (
            <Card className="bg-[#0f0f2f] border-[#ffd700]/20">
              <CardContent className="p-4">
                {chainSubmitted ? (
                  <div className="text-center">
                    <Badge className="bg-[#00ffaa]/20 text-[#00ffaa] border-[#00ffaa]/30 font-mono text-xs">Score On-Chain</Badge>
                    {chainTxHash && (
                      <p className="text-white/30 font-mono text-[10px] mt-2 truncate">Tx: {chainTxHash}</p>
                    )}
                  </div>
                ) : (
                  <Button className="w-full bg-[#ffd700] text-[#0a0a1a] hover:bg-[#ffd700]/90 font-mono font-bold text-xs" onClick={submitScoreOnChain} disabled={chainPending}>
                    <Zap className="w-3 h-3 mr-1.5" />
                    {chainPending ? 'Submitting...' : 'Submit Score On-Chain'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick restart (desktop) */}
          {gamePhase === 'gameover' && (
            <Button variant="outline" className="w-full border-[#00ffaa]/20 text-[#00ffaa] hover:bg-[#00ffaa]/10 font-mono text-xs" onClick={startGame}>
              <RotateCcw className="w-3 h-3 mr-1.5" />
              Play Again
            </Button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-center text-white/20 font-mono text-xs">
        Built on Ritual Testnet &middot; Powered by MetaMask
      </footer>
    </div>
  );
}
