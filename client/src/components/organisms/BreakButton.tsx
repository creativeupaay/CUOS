import { useState, useRef, useEffect } from 'react';
import { Coffee, Utensils, HelpCircle, X, ChevronRight, Loader2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBroadcastBreakMutation } from '@/features/notification/api/notificationApi';
import { useBreak, type BreakType } from '@/hooks/useBreakTimer';
import { useTimer, formatElapsed } from '@/hooks/useTaskTimer';

interface BreakOption {
    type: BreakType;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    border: string;
}

const BREAK_OPTIONS: BreakOption[] = [
    {
        type: 'lunch',
        label: 'Lunch Break',
        description: 'Stepping out for lunch',
        icon: <Utensils size={16} />,
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
    },
    {
        type: 'tea',
        label: 'Tea Break',
        description: 'Quick tea / coffee break',
        icon: <Coffee size={16} />,
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
    },
    {
        type: 'other',
        label: 'Other',
        description: 'Type a reason — team gets notified',
        icon: <HelpCircle size={16} />,
        color: '#DC2626',
        bg: '#FFF1F2',
        border: '#FECDD3',
    },
];

export default function BreakButton() {
    const {
        isOnBreak,
        currentBreakElapsed,
        totalBreakElapsed,
        startBreak,
        endBreak,
    } = useBreak();
    const { timer, isRunning, startTimer, resumeTimer } = useTimer();

    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'pick' | 'reason'>('pick');
    const [reason, setReason] = useState('');
    const [isEnding, setIsEnding] = useState(false);
    const [broadcastBreak, { isLoading: isBroadcasting }] = useBroadcastBreakMutation();
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close panel on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus input when "Other" step appears
    useEffect(() => {
        if (step === 'reason') {
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [step]);

    const handleClose = () => {
        setOpen(false);
        setStep('pick');
        setReason('');
    };

    const handleOption = async (option: BreakOption) => {
        if (option.type === 'other') {
            setStep('reason');
            return;
        }

        try {
            if (!isRunning) {
                if (!timer) startTimer();
                else resumeTimer();
            }
            await startBreak(option.type);
            await broadcastBreak({ breakType: option.type }).unwrap();
            toast.success(`${option.label} started! Enjoy your break ☕`, {
                style: { background: option.bg, color: option.color, border: `1px solid ${option.border}` },
            });
        } catch {
            toast.success(`${option.label} started! Enjoy your break ☕`);
        }
        handleClose();
    };

    const handleOtherSubmit = async () => {
        if (!reason.trim()) {
            toast.error('Please enter a reason for your break.');
            return;
        }
        try {
            if (!isRunning) {
                if (!timer) startTimer();
                else resumeTimer();
            }
            const cleanReason = reason.trim();
            await startBreak('other', cleanReason);
            await broadcastBreak({ breakType: 'other', reason: cleanReason }).unwrap();
            toast.success('Break notified — your team has been informed 🛑', {
                style: { background: '#FFF1F2', color: '#DC2626', border: '1px solid #FECDD3' },
            });
        } catch {
            toast.success('Break started!');
        }
        handleClose();
    };

    const handleEndBreak = async () => {
        setIsEnding(true);
        try {
            await endBreak();
            toast.success('Welcome back! Break ended 🎉', {
                style: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' },
            });
            handleClose();
        } catch {
            toast.error('Failed to end break. Please try again.');
        } finally {
            setIsEnding(false);
        }
    };

    return (
        <div className="relative shrink-0" ref={panelRef}>
            {/* Trigger button — direct on/off toggle styled to match the timer pill */}
            <button
                id="break-button-trigger"
                onClick={() => {
                    if (isOnBreak) {
                        // Click while on break immediately turns break off
                        handleEndBreak();
                        return;
                    }
                    // Click while not on break opens options to start
                    setOpen((p) => !p);
                    setStep('pick');
                    setReason('');
                }}
                disabled={isEnding}
                title={isOnBreak ? 'You are on break — click to resume work' : 'Take a break'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: isOnBreak ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                    background: isOnBreak ? '#FFFBEB' : open ? '#F1F5F9' : '#FFFFFF',
                    color: isOnBreak ? '#92400E' : '#334155',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontFamily: 'Outfit, sans-serif',
                    cursor: isEnding ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isOnBreak
                        ? '0 1px 2px rgba(217, 119, 6, 0.08)'
                        : '0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
                onMouseEnter={(e) => {
                    if (isOnBreak) {
                        (e.currentTarget as HTMLButtonElement).style.background = '#FEF3C7';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#FBBF24';
                    } else if (!open) {
                        (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1';
                    }
                }}
                onMouseLeave={(e) => {
                    if (isOnBreak) {
                        (e.currentTarget as HTMLButtonElement).style.background = '#FFFBEB';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#FCD34D';
                    } else if (!open) {
                        (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
                    }
                }}
            >
                {isEnding ? (
                    <>
                        <Loader2 size={13} className="animate-spin text-amber-600" />
                        <span className="text-xs font-medium">Ending…</span>
                    </>
                ) : isOnBreak ? (
                    <>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-xs font-medium">On Break</span>
                        <span className="font-mono text-xs font-semibold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full">
                            {formatElapsed(currentBreakElapsed)}
                        </span>
                    </>
                ) : (
                    <>
                        <Coffee size={14} className="text-slate-500" />
                        <span>Break</span>
                    </>
                )}
            </button>

            {/* Dropdown panel only shown when NOT on break to select break type */}
            {open && !isOnBreak && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '272px',
                        background: 'white',
                        borderRadius: '14px',
                        border: '1px solid #E5E7EB',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                        zIndex: 9999,
                        overflow: 'hidden',
                        animation: 'breakPopIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px 10px',
                            borderBottom: '1px solid #F3F4F6',
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: '#111827',
                                    fontFamily: 'Outfit, sans-serif',
                                }}
                            >
                                {step === 'pick' ? '☕ Taking a break?' : "📝 What's up?"}
                            </div>
                            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
                                {step === 'pick'
                                    ? 'Select the type of break'
                                    : "Let the team know why you're away"}
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px',
                                color: '#9CA3AF',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Step: Pick break type */}
                    {step === 'pick' && (
                        <div style={{ padding: '8px' }}>
                            {BREAK_OPTIONS.map((opt) => (
                                <button
                                    key={opt.type}
                                    onClick={() => handleOption(opt)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        transition: 'background 0.12s',
                                        textAlign: 'left',
                                        marginBottom: '2px',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = opt.bg)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {/* Icon badge */}
                                    <div
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            borderRadius: '9px',
                                            background: opt.bg,
                                            border: `1.5px solid ${opt.border}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: opt.color,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {opt.icon}
                                    </div>
                                    {/* Labels */}
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                color: '#111827',
                                                fontFamily: 'Outfit, sans-serif',
                                            }}
                                        >
                                            {opt.label}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
                                            {opt.description}
                                        </div>
                                    </div>
                                    <ChevronRight size={14} style={{ color: '#D1D5DB', flexShrink: 0 }} />
                                </button>
                            ))}

                            {totalBreakElapsed > 0 && (
                                <div
                                    style={{
                                        marginTop: '6px',
                                        padding: '6px 12px',
                                        borderTop: '1px solid #F3F4F6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '11px',
                                        color: '#6B7280',
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} style={{ color: '#9CA3AF' }} /> Break today
                                    </span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                        {formatElapsed(totalBreakElapsed)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step: Other reason */}
                    {step === 'reason' && (
                        <div style={{ padding: '12px 14px 14px' }}>
                            {/* Back */}
                            <button
                                onClick={() => setStep('pick')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#6B7280',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    padding: '0',
                                    marginBottom: '10px',
                                }}
                            >
                                ← Back
                            </button>

                            <div
                                style={{
                                    background: '#FFF1F2',
                                    border: '1px solid #FECDD3',
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    marginBottom: '10px',
                                    fontSize: '11px',
                                    color: '#DC2626',
                                    fontWeight: 500,
                                }}
                            >
                                🔔 A notification will be sent to <strong>all team members</strong> with your reason.
                            </div>

                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#374151',
                                    marginBottom: '6px',
                                }}
                            >
                                Reason for break
                            </label>
                            <input
                                ref={inputRef}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleOtherSubmit();
                                }}
                                placeholder="e.g. Doctor's appointment, urgent errand…"
                                maxLength={120}
                                style={{
                                    width: '100%',
                                    padding: '9px 11px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #E5E7EB',
                                    fontSize: '13px',
                                    fontFamily: 'Outfit, sans-serif',
                                    color: '#111827',
                                    outline: 'none',
                                    transition: 'border-color 0.15s',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = '#DC2626')}
                                onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                            />
                            <div style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'right', marginTop: '4px' }}>
                                {reason.length}/120
                            </div>

                            <button
                                onClick={handleOtherSubmit}
                                disabled={isBroadcasting || !reason.trim()}
                                style={{
                                    marginTop: '10px',
                                    width: '100%',
                                    padding: '9px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    background: reason.trim() ? '#DC2626' : '#F3F4F6',
                                    color: reason.trim() ? 'white' : '#9CA3AF',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    fontFamily: 'Outfit, sans-serif',
                                    cursor: reason.trim() && !isBroadcasting ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                }}
                            >
                                {isBroadcasting ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" /> Sending…
                                    </>
                                ) : (
                                    '🔔 Notify Team & Start Break'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Keyframe animation */}
            <style>{`
                @keyframes breakPopIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)  scale(1);    }
                }
            `}</style>
        </div>
    );
}
