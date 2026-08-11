import { useState } from 'react';
import { Play, Copy, Check, Users, ShieldAlert, Crown, UserCheck } from 'lucide-react';
import type { QuizPublicState } from '../types/quiz.types';
import QuizPreparationStatusPanel from './QuizPreparationStatus';
import QuizRoundOverview from './QuizRoundOverview';

interface QuizLobbyProps {
  state: QuizPublicState;
  myUserId: string | null;
  onSetReady: (isReady: boolean) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export default function QuizLobby({
  state,
  myUserId,
  onSetReady,
  onStartGame,
  onLeave,
}: QuizLobbyProps) {
  const [copied, setCopied] = useState(false);

  const myPlayer = state.players.find((p) => p.userId === myUserId);
  const isHost = myPlayer?.isHost || false;
  const isSpectator = myPlayer?.isSpectator || false;
  const isReady = myPlayer?.isReady || false;

  const activePlayers = state.players.filter((p) => !p.isSpectator);
  const spectators = state.players.filter((p) => p.isSpectator);

  const canStart =
    isHost &&
    activePlayers.length >= state.config.minPlayers &&
    activePlayers.every((p) => p.isReady) &&
    state.preparationStatus.isComplete;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/games/quiz/${state.sessionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto w-full p-3 sm:p-5 overflow-y-auto">
      {/* Top Banner - Game Overview */}
      <div className="animate-fade-slide-up shrink-0" style={{ animationDelay: '0.1s' }}>
        <QuizRoundOverview config={state.config} />
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-start">
        
        {/* Left Column (7 cols) - Preparation Status & Controls */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Preparation Status */}
          <div className="animate-fade-slide-up" style={{ animationDelay: '0.2s' }}>
            <QuizPreparationStatusPanel status={state.preparationStatus} isHost={isHost} />
          </div>

          {/* Action Control Panel */}
          <div className="game-glass-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3 animate-fade-slide-up shadow-2xl border border-white/10" style={{ animationDelay: '0.3s' }}>
            {!isSpectator && !isHost && (
              <button
                className={`btn-game flex-1 w-full py-3.5 px-6 text-base font-black tracking-wider uppercase ${
                  isReady 
                    ? 'btn-game-outline border-cyan-400/50 text-cyan-300' 
                    : 'btn-game-primary animate-pulse-glow'
                }`}
                onClick={() => onSetReady(!isReady)}
              >
                {isReady ? 'Cancel Ready' : '✓ READY UP'}
              </button>
            )}

            {isHost && (
              <button
                className={`btn-game flex-1 w-full py-3.5 px-6 text-base font-black tracking-wider uppercase flex items-center justify-center gap-2 ${
                  !canStart 
                    ? 'bg-slate-700/60 text-slate-400 cursor-not-allowed border border-white/10 shadow-none' 
                    : 'btn-game-success animate-pulse-glow'
                }`}
                disabled={!canStart}
                onClick={onStartGame}
              >
                <Play size={20} fill="currentColor" />
                START GAME
              </button>
            )}

            <button
              className="btn-game btn-game-outline w-full sm:w-auto py-3.5 px-5 text-sm font-bold flex items-center justify-center gap-2 border-white/15 hover:border-cyan-400/40"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="text-emerald-400" size={18} /> : <Copy className="text-cyan-400" size={18} />}
              <span>{copied ? 'Copied!' : 'Invite Link'}</span>
            </button>

            <button 
              className="btn-game btn-game-danger w-full sm:w-auto py-3.5 px-5 text-sm font-bold shrink-0"
              onClick={onLeave}
            >
              Leave
            </button>
          </div>

          {/* Host Requirements / Warnings Box */}
          {isHost && !canStart && (
            <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-200 flex items-start gap-3.5 shadow-inner animate-fade-slide-up" style={{ animationDelay: '0.4s' }}>
              <ShieldAlert size={22} className="mt-0.5 shrink-0 text-rose-400" />
              <div className="space-y-2 flex-1">
                <p className="font-black tracking-wider uppercase text-rose-400 text-xs">Requirements to Start Game:</p>
                <div className="flex flex-wrap gap-2">
                  {activePlayers.length < state.config.minPlayers && (
                    <span className="px-3 py-1.5 rounded-lg bg-rose-900/60 border border-rose-500/40 font-bold text-white flex items-center gap-1.5 text-xs shadow-sm">
                      Need at least {state.config.minPlayers} players ({activePlayers.length}/{state.config.minPlayers})
                    </span>
                  )}
                  {!activePlayers.every((p) => p.isReady) && (
                    <span className="px-3 py-1.5 rounded-lg bg-rose-900/60 border border-rose-500/40 font-bold text-white flex items-center gap-1.5 text-xs shadow-sm">
                      Waiting for all players to click READY
                    </span>
                  )}
                  {!state.preparationStatus.isComplete && (
                    <span className="px-3 py-1.5 rounded-lg bg-rose-900/60 border border-rose-500/40 font-bold text-white flex items-center gap-1.5 text-xs shadow-sm">
                      Questions are still generating
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols) - Players Arena Roster */}
        <div className="lg:col-span-5 flex flex-col game-glass-panel rounded-2xl overflow-hidden animate-fade-slide-up shadow-2xl border border-white/10 min-h-[380px]" style={{ animationDelay: '0.5s' }}>
          
          {/* Roster Header */}
          <div className="p-4 border-b border-white/10 bg-black/50 flex justify-between items-center shrink-0">
            <h3 className="font-black text-white text-base flex items-center gap-2.5 tracking-wide">
              <div className="p-1.5 bg-gradient-to-br from-purple-500/30 to-cyan-500/30 rounded-xl border border-white/15">
                <Users size={18} className="text-cyan-400" />
              </div>
              Players Arena
            </h3>
            <span className="text-xs font-black bg-white/10 text-white px-3 py-1 rounded-full border border-white/20 shadow-inner">
              {activePlayers.length} / {state.config.maxPlayers}
            </span>
          </div>

          {/* Players List - Clean Card Items */}
          <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar bg-black/25 space-y-3">
            {activePlayers.map((player) => {
              const isMe = player.userId === myUserId;
              
              return (
                <div
                  key={player.userId}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-purple-900/30 to-purple-950/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : 'bg-black/30 border-white/10 hover:bg-white/5'
                  }`}
                >
                  {/* Left: Avatar & Text */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                    {/* Stylized Gradient Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 border shadow-md ${
                      player.isReady 
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-emerald-300/40 shadow-emerald-500/20' 
                        : 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-white/20'
                    }`}>
                      {player.userName.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Name & Role Badges Stacked */}
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="font-extrabold text-white text-sm tracking-wide truncate max-w-[140px] sm:max-w-[170px]">
                        {player.userName}
                      </span>

                      {/* Badges Row Below Username */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {isMe && (
                          <span className="bg-purple-600/40 text-purple-200 border border-purple-400/40 font-black text-[9px] uppercase px-2 py-0.5 rounded-md tracking-wider shrink-0 shadow-sm">
                            YOU
                          </span>
                        )}
                        {player.isHost && (
                          <span className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md shrink-0">
                            <Crown size={10} className="fill-slate-950 text-slate-950" /> HOST
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Ready Status Badge */}
                  <div className="shrink-0">
                    {player.isReady ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-400/40 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                        <UserCheck size={14} /> READY
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spectators Footer */}
          {spectators.length > 0 && (
            <div className="border-t border-white/10 bg-black/50 shrink-0">
              <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-black/30">
                Spectators ({spectators.length})
              </div>
              <div className="p-2.5 max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                {spectators.map((spec) => (
                  <div key={spec.userId} className="text-xs px-2.5 py-1.5 text-slate-300 font-bold tracking-wide flex items-center gap-2 hover:bg-white/5 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_4px_#22d3ee]" />
                    <span className="truncate">{spec.userName}</span>
                    {spec.userId === myUserId && <span className="text-cyan-400 text-[10px]">(You)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
