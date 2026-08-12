import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../app/hooks';
import { useGetGameSessionQuery } from '../../../features/game-zone/api/gameZoneApi';
import { resetImposterGame } from '../../../features/game-zone/games/imposter/store/imposterSlice';
import { Trophy, Crown, Skull, Home } from 'lucide-react';
import type { ScoreEntry } from '../../../features/game-zone/types/gameZone.types';

export default function ImposterResultPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  
  // We rely mostly on Redux state for the final payload, but fallback to refetching the session if refreshed
  const imposterState = useAppSelector((s) => s.imposter);
  const { data } = useGetGameSessionQuery(gameId!, { skip: !gameId || !!imposterState.winningSide });

  useEffect(() => {
    // If we loaded fresh and the session says it's not game over, redirect
    if (data?.data && data.data.phase !== 'GAME_OVER') {
      navigate(`/games/imposter/${gameId}/play`, { replace: true });
    }
  }, [data, gameId, navigate]);

  // Clean up store when unmounting
  useEffect(() => {
    return () => {
      // Small delay so it doesn't flicker while animating out
      setTimeout(() => dispatch(resetImposterGame()), 1000);
    };
  }, [dispatch]);

  const winningSide = imposterState.winningSide || data?.data?.winningSide;
  const imposterNames = imposterState.imposterNames.length > 0
    ? imposterState.imposterNames
    : data?.data?.imposterNames || [];
  const secretWord = imposterState.secretWord || data?.data?.secretWord || '???';
  
  const scores: ScoreEntry[] = imposterState.finalScores.length > 0 
    ? imposterState.finalScores 
    : data?.data?.finalScores || [];

  const isTeamWin = winningSide === 'team';

  if (!winningSide) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Banner */}
      <div
        className="p-10 rounded-2xl text-center relative overflow-hidden"
        style={{
          background: isTeamWin
            ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
            : 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
          border: isTeamWin
            ? '1px solid rgba(16,185,129,0.3)'
            : '1px solid rgba(220,38,38,0.3)',
        }}
      >
        <div className="relative z-10">
          <div className="text-7xl mb-4">{isTeamWin ? '🎉' : '💀'}</div>
          <h1
            className="text-4xl font-black mb-2 uppercase tracking-widest"
            style={{
              color: isTeamWin ? '#059669' : '#DC2626',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {isTeamWin ? 'Team Wins!' : 'Imposters Win!'}
          </h1>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {isTeamWin
              ? 'The normal players successfully eliminated the imposters.'
              : 'The imposters survived and took over the game.'}
          </p>
        </div>
      </div>

      {/* Game Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="p-5 rounded-xl flex flex-col items-center text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Secret Word
          </p>
          <p className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            {secretWord}
          </p>
        </div>
        <div
          className="p-5 rounded-xl flex flex-col items-center text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
            The Imposters
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {imposterNames.map((name) => (
              <span
                key={name}
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}
              >
                {name}
              </span>
            ))}
            {imposterNames.length === 0 && <span className="text-sm">Unknown</span>}
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      {scores.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            <Trophy size={18} style={{ color: '#F59E0B' }} /> Final Scores
          </h3>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}>
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_100px] gap-4 px-5 py-3 text-xs font-bold" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
              <span>Player</span>
              <span className="text-center">Status</span>
              <span className="text-right">Points</span>
            </div>
            
            {/* Rows */}
            {[...scores].sort((a, b) => b.points - a.points).map((score, idx) => {
              const isMe = score.userId === user?._id;
              return (
                <div
                  key={score.userId}
                  className="grid grid-cols-[1fr_80px_100px] gap-4 items-center px-5 py-4 transition-colors"
                  style={{
                    borderTop: idx > 0 ? '1px solid var(--color-border-default)' : 'none',
                    background: isMe ? 'rgba(124,58,237,0.05)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: score.won ? '#10B981' : '#DC2626' }}>
                      {score.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {score.userName}
                        </span>
                        {isMe && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: '#7C3AED', color: '#fff' }}>You</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    {score.won ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#10B981' }}>
                        <Crown size={12} /> Won
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#DC2626' }}>
                        <Skull size={12} /> Lost
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      +{score.points}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 flex gap-4">
        <Link
          to="/games"
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
        >
          <Home size={18} /> Back to Games
        </Link>
        <Link
          to="/leaderboard"
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all hover:opacity-90"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
        >
          <Trophy size={18} /> View Leaderboard
        </Link>
      </div>
    </div>
  );
}
