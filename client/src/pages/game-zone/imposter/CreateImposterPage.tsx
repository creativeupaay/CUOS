import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Settings2, Users, Clock, Zap, Shield } from 'lucide-react';
import { useCreateGameSessionMutation } from '../../../features/game-zone/api/gameZoneApi';
import { useAppSelector } from '../../../app/hooks';
import type { CreateSessionInput } from '../../../features/game-zone/types/gameZone.types';
import { WORD_PACKS_NAMES } from '../../../features/game-zone/games/imposter/constants/imposterConstants';

const DEFAULT_CONFIG: CreateSessionInput = {
  sessionType: 'casual',
  numImposters: 2,
  wordPack: 'general',
  maxPlayers: 10,
  minPlayers: 4,
  discussionTimeSec: 90,
  votingTimeSec: 30,
  maxRounds: 0,
};

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : `${value}${unit || ''}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
        <span className="text-sm font-bold tabular-nums" style={{ color: '#7C3AED' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-purple-600 h-1.5 rounded-full cursor-pointer"
        style={{ accentColor: '#7C3AED' }}
      />
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>{formatValue ? formatValue(min) : `${min}${unit || ''}`}</span>
        <span>{formatValue ? formatValue(max) : `${max}${unit || ''}`}</span>
      </div>
    </div>
  );
}

function formatSecs(s: number) {
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60 > 0 ? s % 60 + 's' : ''}`.trim() : `${s}s`;
}

export default function CreateImposterPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [createSession, { isLoading }] = useCreateGameSessionMutation();
  const [config, setConfig] = useState<CreateSessionInput>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = ['super-admin', 'admin'].includes((user as any)?.role as string);

  function setField<K extends keyof CreateSessionInput>(key: K, value: CreateSessionInput[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    try {
      setError(null);
      const result = await createSession(config).unwrap();
      navigate(`/games/imposter/${result.data.sessionId}/lobby`);
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to create game session. Please try again.');
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/games/imposter" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={14} /> Back
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: 'rgba(124,58,237,0.12)' }}
        >
          🎭
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
            Create Imposter Game
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Configure your session and invite teammates
          </p>
        </div>
      </div>

      {/* Form card */}
      <div
        className="rounded-2xl p-6 space-y-6"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Session type */}
        {isAdmin && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} style={{ color: '#7C3AED' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Session Type</h3>
            </div>
            <div className="flex gap-2">
              {(['casual', 'official'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setField('sessionType', t)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={{
                    background: config.sessionType === t ? '#7C3AED' : 'var(--color-bg-subtle)',
                    color: config.sessionType === t ? '#fff' : 'var(--color-text-muted)',
                    border: config.sessionType === t ? 'none' : '1px solid var(--color-border-default)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Players */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} style={{ color: '#7C3AED' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Players</h3>
          </div>
          <div className="space-y-5">
            <Slider label="Max Players" value={config.maxPlayers} min={4} max={20} onChange={(v) => setField('maxPlayers', v)} />
            <Slider label="Number of Imposters" value={config.numImposters} min={1} max={Math.max(1, config.maxPlayers - 1)} onChange={(v) => setField('numImposters', v)} />
          </div>
        </div>

        {/* Word Pack */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Settings2 size={15} style={{ color: '#7C3AED' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Word Pack</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {WORD_PACKS_NAMES.map((pack) => (
              <button
                key={pack}
                onClick={() => setField('wordPack', pack)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium capitalize transition-all"
                style={{
                  background: config.wordPack === pack ? 'rgba(124,58,237,0.15)' : 'var(--color-bg-subtle)',
                  color: config.wordPack === pack ? '#7C3AED' : 'var(--color-text-muted)',
                  border: config.wordPack === pack ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--color-border-default)',
                }}
              >
                {pack}
              </button>
            ))}
          </div>
        </div>

        {/* Timers */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} style={{ color: '#7C3AED' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Phase Timers</h3>
          </div>
          <div className="space-y-5">
            <Slider
              label="Discussion Time"
              value={config.discussionTimeSec}
              min={30}
              max={300}
              onChange={(v) => setField('discussionTimeSec', v)}
              formatValue={formatSecs}
            />
            <Slider
              label="Voting Time"
              value={config.votingTimeSec}
              min={15}
              max={120}
              onChange={(v) => setField('votingTimeSec', v)}
              formatValue={formatSecs}
            />
          </div>
        </div>

        {/* Rounds */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} style={{ color: '#7C3AED' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Max Rounds</h3>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((r) => (
              <button
                key={r}
                onClick={() => setField('maxRounds', r)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: config.maxRounds === r ? '#7C3AED' : 'var(--color-bg-subtle)',
                  color: config.maxRounds === r ? '#fff' : 'var(--color-text-muted)',
                  border: config.maxRounds === r ? 'none' : '1px solid var(--color-border-default)',
                }}
              >
                {r === 0 ? 'Unlimited' : r}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-3.5 rounded-xl text-base font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
        >
          {isLoading ? 'Creating...' : '🎭 Create Game'}
        </button>
      </div>
    </div>
  );
}
