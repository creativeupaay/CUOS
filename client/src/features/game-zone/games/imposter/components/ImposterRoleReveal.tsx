import { useState } from 'react';
import { useAppSelector } from '../../../../../app/hooks';
import { useGetMyRoleQuery, useConfirmRoleMutation } from '../../../api/gameZoneApi';

interface ImposterRoleRevealProps {
  sessionId: string;
}

export default function ImposterRoleReveal({ sessionId }: ImposterRoleRevealProps) {
  const user = useAppSelector((s) => s.auth.user);
  const gameState = useAppSelector((s) => s.imposter.gameState);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { data: roleData } = useGetMyRoleQuery(sessionId);
  const [confirmRole] = useConfirmRoleMutation();

  const round = gameState?.currentRound;
  const confirmedCount = round?.confirmedCount || 0;
  const totalCount = round?.totalActiveCount || 0;
  const myPlayer = gameState?.players.find((p: any) => p.userId === user?._id);
  const hasConfirmed = myPlayer?.hasConfirmedRole || false;

  const role = roleData?.data?.role;
  const secretWord = roleData?.data?.secretWord;
  const isImposter = role === 'imposter';

  async function handleConfirm() {
    if (hasConfirmed || confirming) return;
    setConfirming(true);
    try {
      await confirmRole(sessionId).unwrap();
      const socket = (window as any).__gameSocket;
      if (socket) {
        socket.emit('game:confirm_role', { sessionId });
      }
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div
        className="p-4 rounded-xl text-center"
        style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {confirmedCount} / {totalCount} players confirmed their role
        </p>
        <div className="w-full rounded-full h-1.5 mt-2" style={{ background: 'var(--color-border-default)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%`, background: '#7C3AED' }}
          />
        </div>
      </div>

      {/* Role card */}
      {!role ? (
        <div className="h-56 rounded-2xl animate-pulse" style={{ background: 'var(--color-bg-subtle)' }} />
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: isImposter
              ? 'linear-gradient(135deg, rgba(220,38,38,0.12), rgba(220,38,38,0.04))'
              : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))',
            border: isImposter ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(16,185,129,0.2)',
          }}
        >
          <div className="p-8 text-center space-y-4">
            {!revealed ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl"
                  style={{ background: isImposter ? 'rgba(220,38,38,0.12)' : 'rgba(16,185,129,0.12)' }}>
                  ?
                </div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                  Your Role is Hidden
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Tap "Reveal" to see your role. Make sure no one else can see your screen!
                </p>
                <button
                  onClick={() => setRevealed(true)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#7C3AED' }}
                >
                  Reveal Role 👁️
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl mb-2">{isImposter ? '🎭' : '🔍'}</div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>You are</p>
                  <h2
                    className="text-4xl font-black"
                    style={{
                      color: isImposter ? '#DC2626' : '#059669',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {isImposter ? 'THE IMPOSTER' : 'NORMAL PLAYER'}
                  </h2>
                </div>

                {!isImposter && secretWord && (
                  <div
                    className="mt-4 px-8 py-5 rounded-2xl"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#059669' }}>
                      Secret Word
                    </p>
                    <p className="text-3xl font-black" style={{ color: '#059669', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.05em' }}>
                      {secretWord}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'rgba(5,150,105,0.7)' }}>
                      Give one-word clues related to this word. Don't say it directly!
                    </p>
                  </div>
                )}

                {isImposter && (
                  <div
                    className="mt-4 px-8 py-5 rounded-2xl"
                    style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#DC2626' }}>
                      Your Mission
                    </p>
                    <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                      Blend in. You do NOT know the secret word. Give convincing clues without being caught!
                    </p>
                  </div>
                )}

                {!hasConfirmed && (
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="mt-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: isImposter ? '#DC2626' : '#059669' }}
                  >
                    {confirming ? 'Confirming...' : "I've Seen It ✓"}
                  </button>
                )}

                {hasConfirmed && (
                  <div
                    className="flex items-center justify-center gap-2 text-sm font-semibold"
                    style={{ color: '#059669' }}
                  >
                    ✓ Confirmed — waiting for others...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
