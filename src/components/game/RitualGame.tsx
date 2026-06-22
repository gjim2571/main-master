'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import {
  GameState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  createInitialGameState,
  generateLevel,
} from '@/lib/gameTypes';
import {
  setupInputListeners,
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
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const gamePhaseRef = useRef<'start' | 'playing' | 'gameover'>('start');
  const cleanupRef = useRef<(() => void) | null>(null);
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'gameover'>('start');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayDistance, setDisplayDistance] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);
  const [highScores, setHighScores] = useState<Array<{ score: number; address: string; time: string }>>([]);
  const [showRules, setShowRules] = useState(false);

  const { wallet, connect, disconnect, switchToRitual } = useWallet();

  // Load high scores from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ritual-game-scores');
      if (saved) {
        setHighScores(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveScore = useCallback(
    (score: number, distance: number, coins: number) => {
      const entry = {
        score,
        address: wallet.address || 'anonymous',
        time: new Date().toLocaleString(),
      };
      const newScores = [...highScores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
      setHighScores(newScores);
      try {
        localStorage.setItem('ritual-game-scores', JSON.stringify(newScores));
      } catch {
        // ignore
      }
    },
    [highScores, wallet.address]
  );

  // Simulate on-chain score submission
  const submitScoreOnChain = useCallback(async () => {
    const state = gameStateRef.current;
    if (!wallet.isConnected || state.onChainScoreSubmitted || state.pendingSubmission) return;

    state.pendingSubmission = true;

    // Simulate blockchain transaction
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate fake tx hash
    const hash = '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    state.lastBlockHash = hash;
    state.onChainScoreSubmitted = true;
    state.pendingSubmission = false;
  }, [wallet.isConnected]);

  // Game loop
  const startGameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup input
    cleanupRef.current = setupInputListeners(canvas);

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 16.67, 3);
      lastTimeRef.current = timestamp;

      const state = gameStateRef.current;

      // Update
      if (gamePhaseRef.current === 'playing') {
        updateGame(state, deltaTime);

        // Update display values periodically
        setDisplayScore(state.score);
        setDisplayDistance(state.distance);
        setDisplayCoins(state.coins.filter(c => c.collected).length);

        // Check game over
        if (state.isGameOver) {
          gamePhaseRef.current = 'gameover';
          setGamePhase('gameover');
          saveScore(state.score, state.distance, state.coins.filter(c => c.collected).length);
        }
      }

      // Draw
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (gamePhaseRef.current === 'start') {
        // Draw a preview of the level behind the start screen
        drawGame(ctx, state, timestamp);
        drawStartScreen(ctx, timestamp, wallet.address);
      } else if (gamePhaseRef.current === 'playing') {
        drawGame(ctx, state, timestamp);
        drawHUD(ctx, state, wallet.address, wallet.balance);
      } else if (gamePhaseRef.current === 'gameover') {
        drawGame(ctx, state, timestamp);
        drawGameOver(ctx, state, timestamp, wallet.address);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [wallet.address, saveScore]);

  // Initialize game
  useEffect(() => {
    const state = gameStateRef.current;
    generateLevel(state);
    startGameLoop();

    // Key handlers for start/restart/submit
    const handleKeyForUI = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        if (gamePhaseRef.current === 'start' || gamePhaseRef.current === 'gameover') {
          const state = gameStateRef.current;
          Object.assign(state, createInitialGameState());
          generateLevel(state);
          gamePhaseRef.current = 'playing';
          setGamePhase('playing');
          setDisplayScore(0);
          setDisplayDistance(0);
          setDisplayCoins(0);
          lastTimeRef.current = 0;
        }
      }
      if (e.code === 'KeyS' && gamePhaseRef.current === 'gameover') {
        submitScoreOnChain();
      }
    };

    window.addEventListener('keydown', handleKeyForUI);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cleanupRef.current?.();
      window.removeEventListener('keydown', handleKeyForUI);
    };
  }, [startGameLoop, submitScoreOnChain]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#0a0a1a] to-[#1a0a2e] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00ffaa] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#ff3366] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00ffaa] to-[#00e5ff] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#0a0a1a]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#00ffaa] font-mono tracking-wider">RITUAL RUNNER</h1>
            <p className="text-xs text-[#00ffaa]/50 font-mono">Blockchain Platform Game</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wallet.isConnected ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[#00ffaa] border-[#00ffaa]/30 bg-[#00ffaa]/10 font-mono text-xs cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-[#00ffaa] mr-1.5 animate-pulse" />
                {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
              </Badge>
              <Badge variant="outline" className="text-[#ffd700] border-[#ffd700]/30 bg-[#ffd700]/10 font-mono text-xs">
                {wallet.balance} ETH
              </Badge>
              {!wallet.isCorrectNetwork && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#ff3366] text-[#ff3366] hover:bg-[#ff3366]/10 font-mono text-xs"
                  onClick={switchToRitual}
                >
                  Switch Network
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-white/50 hover:text-white font-mono text-xs"
                onClick={disconnect}
              >
                <Unplug className="w-3 h-3 mr-1" />
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-[#00ffaa] text-[#0a0a1a] hover:bg-[#00ffaa]/90 font-mono font-bold text-xs"
              onClick={connect}
            >
              <Wallet className="w-3 h-3 mr-1.5" />
              Connect Wallet
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 py-3 flex flex-col lg:flex-row gap-4">
        {/* Game Canvas Area */}
        <div className="flex-1 flex flex-col items-center">
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
              <Button
                size="sm"
                variant="ghost"
                className="text-white/30 hover:text-white/60 font-mono text-xs"
                onClick={() => setShowRules(!showRules)}
              >
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
              className="block w-full max-w-[800px] h-auto"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Controls overlay */}
            {showRules && gamePhase === 'playing' && (
              <div className="absolute bottom-3 left-3 bg-[#0a0a30]/90 border border-[#00ffaa]/20 rounded-lg px-4 py-3 font-mono text-xs text-white/70">
                <div className="space-y-1">
                  <div><span className="text-[#00ffaa]">A/D</span> or <span className="text-[#00ffaa]">←/→</span> : Move</div>
                  <div><span className="text-[#00ffaa]">W/Space</span> : Jump (Double!)</div>
                  <div>Stomp enemies from above!</div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile controls */}
          <div className="w-full flex justify-center mt-3 lg:hidden">
            <div className="flex items-center gap-3">
              <button
                onTouchStart={() => { (window as Record<string, unknown>).__mobileLeft = true; }}
                onTouchEnd={() => { (window as Record<string, unknown>).__mobileLeft = false; }}
                className="w-14 h-14 rounded-xl bg-white/10 border border-[#00ffaa]/20 flex items-center justify-center text-[#00ffaa] font-mono text-xl active:bg-[#00ffaa]/20"
              >
                ←
              </button>
              <button
                onTouchStart={() => { (window as Record<string, unknown>).__mobileJump = true; }}
                onTouchEnd={() => { (window as Record<string, unknown>).__mobileJump = false; }}
                className="w-14 h-14 rounded-xl bg-white/10 border border-[#00ffaa]/20 flex items-center justify-center text-[#00ffaa] font-mono text-sm font-bold active:bg-[#00ffaa]/20"
              >
                JUMP
              </button>
              <button
                onTouchStart={() => { (window as Record<string, unknown>).__mobileRight = true; }}
                onTouchEnd={() => { (window as Record<string, unknown>).__mobileRight = false; }}
                className="w-14 h-14 rounded-xl bg-white/10 border border-[#00ffaa]/20 flex items-center justify-center text-[#00ffaa] font-mono text-xl active:bg-[#00ffaa]/20"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Leaderboard & Info */}
        <div className="w-full lg:w-72 flex flex-col gap-3">
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
                <div className="flex justify-between">
                  <span className="text-white/40">Chain ID</span>
                  <span className="text-white/70">1117</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Currency</span>
                  <span className="text-[#ffd700]">ETH</span>
                </div>
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
                      <div
                        key={i}
                        className={`flex items-center justify-between py-1.5 px-2 rounded ${
                          i === 0
                            ? 'bg-[#ffd700]/10 border border-[#ffd700]/20'
                            : i === 1
                            ? 'bg-white/5 border border-white/10'
                            : i === 2
                            ? 'bg-[#ff6ec7]/5 border border-[#ff6ec7]/10'
                            : 'bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-xs font-bold w-5 text-center ${
                              i === 0 ? 'text-[#ffd700]' : i === 1 ? 'text-white/60' : i === 2 ? 'text-[#ff6ec7]' : 'text-white/30'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="font-mono text-xs text-white/60">
                            {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                          </span>
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
                {gameStateRef.current.onChainScoreSubmitted ? (
                  <div className="text-center">
                    <Badge className="bg-[#00ffaa]/20 text-[#00ffaa] border-[#00ffaa]/30 font-mono text-xs">
                      Score On-Chain
                    </Badge>
                    {gameStateRef.current.lastBlockHash && (
                      <p className="text-white/30 font-mono text-[10px] mt-2 truncate">
                        Tx: {gameStateRef.current.lastBlockHash}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    className="w-full bg-[#ffd700] text-[#0a0a1a] hover:bg-[#ffd700]/90 font-mono font-bold text-xs"
                    onClick={submitScoreOnChain}
                    disabled={gameStateRef.current.pendingSubmission}
                  >
                    <Zap className="w-3 h-3 mr-1.5" />
                    {gameStateRef.current.pendingSubmission ? 'Submitting...' : 'Submit Score On-Chain'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick restart */}
          {gamePhase === 'gameover' && (
            <Button
              variant="outline"
              className="w-full border-[#00ffaa]/20 text-[#00ffaa] hover:bg-[#00ffaa]/10 font-mono text-xs"
              onClick={() => {
                const state = gameStateRef.current;
                Object.assign(state, createInitialGameState());
                generateLevel(state);
                gamePhaseRef.current = 'playing';
                setGamePhase('playing');
                setDisplayScore(0);
                setDisplayDistance(0);
                setDisplayCoins(0);
                lastTimeRef.current = 0;
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              Play Again
            </Button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-center text-white/20 font-mono text-xs">
        Built on Ritual Testnet · Powered by MetaMask
      </footer>
    </div>
  );
}
