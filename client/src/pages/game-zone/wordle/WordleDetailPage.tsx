import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListWordleSessionsQuery, useCreateWordleSessionMutation } from '@/features/game-zone/api/wordleApi';
import { Users, Play, Clock, Lock, X, Settings } from 'lucide-react';
import type { WordleSessionListItem } from '@/features/game-zone/games/wordle/types/wordle.types';

const ACCENT = '#059669';

function SessionCard({ session, onJoin }: { session: WordleSessionListItem; onJoin: (id: string) => void }) {
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const isLobby = session.status === 'lobby';
  const isFull = activePlayers.length >= session.config.maxPlayers;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 16,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ACCENT}50`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            {session.config.gameName}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            {session.config.totalRounds} rounds · {session.config.roundDurationSec}s per round
          </p>
        </div>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'Outfit, sans-serif',
            background: isLobby ? `${ACCENT}18` : 'rgba(245,158,11,0.15)',
            color: isLobby ? ACCENT : '#F59E0B',
          }}
        >
          {isLobby ? 'Lobby' : 'In Progress'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users size={12} />
          {activePlayers.length}/{session.config.maxPlayers}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} />
          {session.config.roundDurationSec}s/round
        </span>
      </div>

      <button
        onClick={() => onJoin((session._id as any).toString())}
        disabled={!isLobby && isFull}
        style={{
          width: '100%',
          padding: '9px 0',
          borderRadius: 10,
          background: isLobby && !isFull ? `linear-gradient(135deg, ${ACCENT}, #047857)` : 'var(--color-bg-subtle)',
          color: isLobby && !isFull ? '#fff' : 'var(--color-text-muted)',
          border: 'none',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          cursor: isLobby && !isFull ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {!isLobby ? <><Play size={13} /> Spectate</> : isFull ? <><Lock size={13} /> Full</> : <><Play size={13} /> Join</>}
      </button>
    </div>
  );
}

export default function WordleDetailPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useListWordleSessionsQuery(undefined, { pollingInterval: 8000 });
  const [createSession, { isLoading: isCreating }] = useCreateWordleSessionMutation();

  const [showSettings, setShowSettings] = useState(false);
  const [gameConfig, setGameConfig] = useState({
    gameName: 'Wordle Battle',
    totalRounds: 3,
    roundDurationSec: 180,
    maxPlayers: 20,
  });

  const sessions = data?.data || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createSession({
        gameName: gameConfig.gameName || 'Wordle Battle',
        totalRounds: gameConfig.totalRounds || 3,
        roundDurationSec: gameConfig.roundDurationSec || 180,
        wordPack: 'general',
        maxPlayers: gameConfig.maxPlayers || 20,
        minPlayers: 2,
      }).unwrap();
      setShowSettings(false);
      navigate(`/games/wordle/${result.data.sessionId}/lobby`);
    } catch (e: any) {
      alert(e?.data?.message || 'Failed to create session');
    }
  };

  const handleJoin = async (sessionId: string) => {
    navigate(`/games/wordle/${sessionId}/lobby`);
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 4px' }}>
      {/* Hero */}
      <div
        style={{
          borderRadius: 20,
          padding: '28px 28px 24px',
          marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(4,120,87,0.05) 100%)',
          border: '1px solid rgba(5,150,105,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 40 }}>🔤</span>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                  Wordle Battle
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Competitive multiplayer word guessing — same word, everyone races.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['6 Guesses', 'Multiple Rounds', 'Time Bonus', 'Speed + Efficiency'].map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    background: `${ACCENT}18`,
                    color: ACCENT,
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            id="create-wordle-session"
            onClick={() => setShowSettings(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 20px',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, #047857)`,
              color: '#fff',
              border: 'none',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${ACCENT}40`,
              flexShrink: 0,
            }}
          >
            <Settings size={17} />
            Host Game
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: 'var(--color-bg-surface)',
              width: '100%',
              maxWidth: 440,
              borderRadius: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              animation: 'wordlePop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              border: `1px solid ${ACCENT}30`,
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--color-border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
                Host Wordle Game
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                    Game Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={gameConfig.gameName}
                    onChange={(e) => setGameConfig({ ...gameConfig, gameName: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                    Total Rounds
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10}
                    value={gameConfig.totalRounds}
                    onChange={(e) => setGameConfig({ ...gameConfig, totalRounds: parseInt(e.target.value) || 3 })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                    Round Duration (seconds)
                  </label>
                  <input
                    type="number"
                    required
                    min={30}
                    max={600}
                    value={gameConfig.roundDurationSec}
                    onChange={(e) => setGameConfig({ ...gameConfig, roundDurationSec: parseInt(e.target.value) || 180 })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                    Max Players
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    max={50}
                    value={gameConfig.maxPlayers}
                    onChange={(e) => setGameConfig({ ...gameConfig, maxPlayers: parseInt(e.target.value) || 20 })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}
                  />
                </div>
              </div>
              
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #047857)`, color: '#fff', border: 'none', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 14, cursor: isCreating ? 'wait' : 'pointer' }}
                >
                  {isCreating ? 'Creating...' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
          Active Sessions
        </h2>
        {isLoading ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 120, borderRadius: 16, background: 'var(--color-bg-subtle)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              borderRadius: 16,
              border: '1px dashed var(--color-border-default)',
              color: 'var(--color-text-muted)',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔤</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>No active sessions</p>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>Be the first to host a Wordle Battle!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {sessions.map((s) => (
              <SessionCard key={(s._id as any).toString()} session={s} onJoin={handleJoin} />
            ))}
          </div>
        )}
      </div>

      {/* Rules */}
      <div
        style={{
          padding: '20px',
          borderRadius: 16,
          background: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border-default)',
          marginTop: 24,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
          📖 How It Works
        </h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: '22px' }}>
          <li>All players guess the <strong>same 5-letter word</strong> each round</li>
          <li>Each player gets up to <strong>6 guesses</strong> per round</li>
          <li>🟩 Green = correct letter, correct position</li>
          <li>🟨 Yellow = correct letter, wrong position</li>
          <li>⬜ Gray = letter not in the word</li>
          <li>Solve faster and in fewer guesses to earn more points</li>
          <li>The host can configure number of rounds and time per round</li>
        </ul>
      </div>
    </div>
  );
}
