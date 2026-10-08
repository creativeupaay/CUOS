import { useState, useRef, useEffect, useMemo } from 'react';
import {
    Coffee,
    Utensils,
    HelpCircle,
    X,
    ChevronRight,
    Loader2,
    Clock,
    Play,
    Bell,
    ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBroadcastBreakMutation } from '@/features/notification/api/notificationApi';
import { useBreak, type BreakType } from '@/hooks/useBreakTimer';
import { useTimer, formatElapsed } from '@/hooks/useTaskTimer';

interface BreakOption {
    type: BreakType;
    label: string;
    tag: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    iconBg: string;
    hoverBg: string;
    hoverBorder: string;
}

const BREAK_OPTIONS: BreakOption[] = [
    {
        type: 'lunch',
        label: 'Lunch Break',
        tag: '1 hr',
        description: 'Auto-resumes after 1 hour',
        icon: <Utensils size={16} strokeWidth={2.2} />,
        color: '#D97706',
        iconBg: '#FEF3C7',
        hoverBg: '#FFFDF5',
        hoverBorder: '#FDE68A',
    },
    {
        type: 'tea',
        label: 'Tea Break',
        tag: '30–60m',
        description: 'Choose 30, 45, or 60 minutes',
        icon: <Coffee size={16} strokeWidth={2.2} />,
        color: '#7C3AED',
        iconBg: '#EDE9FE',
        hoverBg: '#FAF8FF',
        hoverBorder: '#DDD6FE',
    },
    {
        type: 'other',
        label: 'Custom Break',
        tag: 'Note',
        description: 'Add a reason & notify the team',
        icon: <HelpCircle size={16} strokeWidth={2.2} />,
        color: '#E11D48',
        iconBg: '#FFE4E6',
        hoverBg: '#FFF8F8',
        hoverBorder: '#FECDD3',
    },
];

interface TeaDurationOption {
    minutes: number;
    seconds: number;
    label: string;
    tag: string;
    tagBg: string;
    tagText: string;
}

const TEA_DURATION_OPTIONS: TeaDurationOption[] = [
    {
        minutes: 30,
        seconds: 30 * 60,
        label: '30 Minutes',
        tag: 'Quick',
        tagBg: '#ECFDF5',
        tagText: '#065F46',
    },
    {
        minutes: 45,
        seconds: 45 * 60,
        label: '45 Minutes',
        tag: 'Standard',
        tagBg: '#EDE9FE',
        tagText: '#6D28D9',
    },
    {
        minutes: 60,
        seconds: 60 * 60,
        label: '60 Minutes (1 hr)',
        tag: 'Extended',
        tagBg: '#FEF3C7',
        tagText: '#92400E',
    },
];

const PRESET_REASONS = [
    '🩺 Doctor Visit',
    '⚡ Urgent Errand',
    '📞 Important Call',
    '☕ Quick Rest',
    '👨‍👩‍👧 Personal',
];

interface BreakTheme {
    bg: string;
    bgHover: string;
    border: string;
    borderHover: string;
    text: string;
    iconColor: string;
    dotBg: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
}

const BREAK_THEMES: Record<BreakType, BreakTheme> = {
    tea: {
        bg: '#F5F3FF',
        bgHover: '#EDE9FE',
        border: '#DDD6FE',
        borderHover: '#C4B5FD',
        text: '#5B21B6',
        iconColor: '#7C3AED',
        dotBg: '#7C3AED',
        badgeBg: '#FFFFFF',
        badgeText: '#6D28D9',
        badgeBorder: '#DDD6FE',
    },
    lunch: {
        bg: '#FFFBEB',
        bgHover: '#FEF3C7',
        border: '#FDE68A',
        borderHover: '#FCD34D',
        text: '#92400E',
        iconColor: '#D97706',
        dotBg: '#D97706',
        badgeBg: '#FFFFFF',
        badgeText: '#B45309',
        badgeBorder: '#FDE68A',
    },
    other: {
        bg: '#FFF1F2',
        bgHover: '#FFE4E6',
        border: '#FECDD3',
        borderHover: '#FDA4AF',
        text: '#9F1239',
        iconColor: '#E11D48',
        dotBg: '#E11D48',
        badgeBg: '#FFFFFF',
        badgeText: '#BE123C',
        badgeBorder: '#FECDD3',
    },
};

export default function BreakButton() {
    const {
        isOnBreak,
        breakType,
        currentBreakElapsed,
        totalBreakElapsed,
        maxBreakDuration,
        remainingBreakSeconds,
        startBreak,
        endBreak,
    } = useBreak();
    const { timer, isRunning, startTimer, resumeTimer } = useTimer();

    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'pick' | 'tea' | 'reason'>('pick');
    const [reason, setReason] = useState('');
    const [isEnding, setIsEnding] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [broadcastBreak, { isLoading: isBroadcasting }] = useBroadcastBreakMutation();
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeTheme = BREAK_THEMES[breakType || 'tea'];

    // Close panel on outside click or escape key
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    // Focus input when "Other" reason step appears
    useEffect(() => {
        if (step === 'reason') {
            const t = setTimeout(() => inputRef.current?.focus(), 80);
            return () => clearTimeout(t);
        }
    }, [step]);

    const handleClose = () => {
        setOpen(false);
        setStep('pick');
        setReason('');
    };

    const handleOption = async (option: BreakOption) => {
        if (option.type === 'tea') {
            setStep('tea');
            return;
        }
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
            toast.success(`${option.label} started! Auto-resumes in 1 hour ☕`, {
                icon: '🍽️',
                duration: 4000,
                style: {
                    background: '#FFFBEB',
                    color: '#92400E',
                    border: '1px solid #FDE68A',
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                },
            });
        } catch {
            toast.success(`${option.label} started! Enjoy your break ☕`);
        }
        handleClose();
    };

    const handleTeaDurationSelect = async (minutes: number, seconds: number) => {
        try {
            if (!isRunning) {
                if (!timer) startTimer();
                else resumeTimer();
            }
            await startBreak('tea', undefined, seconds);
            await broadcastBreak({ breakType: 'tea' }).unwrap();
            toast.success(`Tea Break (${minutes} min) started! Auto-resumes when done ☕`, {
                icon: '☕',
                duration: 4000,
                style: {
                    background: '#F5F3FF',
                    color: '#5B21B6',
                    border: '1px solid #DDD6FE',
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                },
            });
        } catch {
            toast.success(`Tea Break (${minutes} min) started! Enjoy your break ☕`);
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
            toast.success('Break started — team has been notified 🛑', {
                icon: '🔔',
                duration: 4000,
                style: {
                    background: '#FFF1F2',
                    color: '#9F1239',
                    border: '1px solid #FECDD3',
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                },
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
            toast.success('Welcome back! Work timer is actively running 🎉', {
                icon: '⚡',
                duration: 3500,
                style: {
                    background: '#F0FDF4',
                    color: '#15803D',
                    border: '1px solid #BBF7D0',
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                },
            });
            handleClose();
        } catch {
            toast.error('Failed to end break. Please try again.');
        } finally {
            setIsEnding(false);
        }
    };

    // Calculate resume time (e.g. "3:45 PM")
    const getEstimatedResumeTime = useMemo(() => {
        return (mins: number) => {
            const date = new Date(Date.now() + mins * 60 * 1000);
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        };
    }, []);

    const breakLabel = breakType === 'lunch'
        ? 'Lunch'
        : breakType === 'tea'
            ? 'Tea'
            : 'Break';

    const limitBadgeText = useMemo(() => {
        if (!maxBreakDuration) return null;
        if (remainingBreakSeconds !== null && remainingBreakSeconds > 0) {
            const minsLeft = Math.ceil(remainingBreakSeconds / 60);
            return `${minsLeft}m left`;
        }
        return maxBreakDuration === 3600 ? '1h max' : `${Math.round(maxBreakDuration / 60)}m max`;
    }, [maxBreakDuration, remainingBreakSeconds]);

    return (
        <div className="relative shrink-0" ref={panelRef}>
            {/* ── Active Break Pill OR Inactive Trigger Button ────────────── */}
            {isOnBreak ? (
                <button
                    id="break-button-active"
                    onClick={handleEndBreak}
                    disabled={isEnding}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    title={`On ${breakLabel} Break (${formatElapsed(currentBreakElapsed)})${
                        limitBadgeText ? ` • ${limitBadgeText}` : ''
                    } • Click to resume work`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '32px',
                        padding: '0 10px 0 9px',
                        gap: '6px',
                        borderRadius: '9999px',
                        border: `1px solid ${isHovered ? activeTheme.borderHover : activeTheme.border}`,
                        background: isHovered ? activeTheme.bgHover : activeTheme.bg,
                        color: activeTheme.text,
                        fontFamily: 'Outfit, Inter, system-ui, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isEnding ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    }}
                >
                    {isEnding ? (
                        <>
                            <Loader2 size={13} className="animate-spin" style={{ color: activeTheme.iconColor }} />
                            <span style={{ fontSize: '12px' }}>Resuming…</span>
                        </>
                    ) : isHovered ? (
                        /* Clean hover cue — clear and non-jarring */
                        <>
                            <Play size={11} fill="currentColor" style={{ color: activeTheme.iconColor }} />
                            <span style={{ fontSize: '12.5px', fontWeight: 700 }}>Resume Work</span>
                            <span style={{ fontSize: '11px', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
                                ({formatElapsed(currentBreakElapsed)})
                            </span>
                        </>
                    ) : (
                        /* Clean resting state */
                        <>
                            {/* Subtle 6px live status dot */}
                            <span
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '9999px',
                                    backgroundColor: activeTheme.dotBg,
                                    flexShrink: 0,
                                }}
                            />

                            {/* Icon */}
                            <span style={{ color: activeTheme.iconColor, display: 'flex' }}>
                                {breakType === 'lunch' ? (
                                    <Utensils size={13} strokeWidth={2.2} />
                                ) : breakType === 'other' ? (
                                    <HelpCircle size={13} strokeWidth={2.2} />
                                ) : (
                                    <Coffee size={13} strokeWidth={2.2} />
                                )}
                            </span>

                            {/* Digits */}
                            <span
                                style={{
                                    fontVariantNumeric: 'tabular-nums',
                                    fontWeight: 700,
                                    letterSpacing: '0.01em',
                                    lineHeight: 1,
                                }}
                            >
                                {formatElapsed(currentBreakElapsed)}
                            </span>

                            {/* Limit pill */}
                            {limitBadgeText && (
                                <span
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '1px 5px',
                                        borderRadius: '9999px',
                                        background: activeTheme.badgeBg,
                                        color: activeTheme.badgeText,
                                        border: `1px solid ${activeTheme.badgeBorder}`,
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {limitBadgeText}
                                </span>
                            )}
                        </>
                    )}
                </button>
            ) : (
                <button
                    id="break-button-trigger"
                    onClick={() => {
                        setOpen((p) => !p);
                        setStep('pick');
                        setReason('');
                    }}
                    title={
                        totalBreakElapsed > 0
                            ? `Take a break • ${formatElapsed(totalBreakElapsed)} logged today`
                            : 'Take a break (Lunch, Tea, Custom)'
                    }
                    aria-label="Take a break"
                    style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '9999px',
                        border: open ? '1px solid #CBD5E1' : '1px solid #E2E8F0',
                        background: open ? '#F8FAFC' : '#FFFFFF',
                        color: open ? '#0F172A' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    }}
                    onMouseEnter={(e) => {
                        if (!open) {
                            e.currentTarget.style.background = '#F8FAFC';
                            e.currentTarget.style.borderColor = '#CBD5E1';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!open) {
                            e.currentTarget.style.background = '#FFFFFF';
                            e.currentTarget.style.borderColor = '#E2E8F0';
                        }
                    }}
                >
                    <Coffee size={14.5} strokeWidth={2.1} />

                    {/* Subtle dot indicator if breaks were logged today */}
                    {totalBreakElapsed > 0 && (
                        <span
                            style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '5px',
                                height: '5px',
                                borderRadius: '9999px',
                                backgroundColor: '#F59E0B',
                            }}
                        />
                    )}
                </button>
            )}

            {/* ── Popover Dropdown Card ───────────────────────────────────── */}
            {open && !isOnBreak && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '320px',
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1px solid #E2E8F0',
                        boxShadow:
                            '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
                        zIndex: 9999,
                        overflow: 'hidden',
                        animation: 'breakPopIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '13px 16px 11px',
                            borderBottom: '1px solid #F1F5F9',
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                    fontFamily: 'Outfit, sans-serif',
                                }}
                            >
                                {step === 'pick'
                                    ? 'Take a Break'
                                    : step === 'tea'
                                        ? 'Tea Break'
                                        : 'Custom Break'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                                {step === 'pick'
                                    ? 'Auto-resumes when time is up'
                                    : step === 'tea'
                                        ? 'Choose your break duration'
                                        : 'Notify team with a reason'}
                            </div>
                        </div>

                        <button
                            onClick={handleClose}
                            aria-label="Close"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                color: '#94A3B8',
                                transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#F1F5F9';
                                e.currentTarget.style.color = '#334155';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#94A3B8';
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* ── STEP 1: PICK ───────────────────────────────────────── */}
                    {step === 'pick' && (
                        <div style={{ padding: '8px 10px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {BREAK_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.type}
                                        onClick={() => handleOption(opt)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '11px',
                                            padding: '9px 11px',
                                            borderRadius: '12px',
                                            border: '1px solid #F1F5F9',
                                            background: '#FFFFFF',
                                            cursor: 'pointer',
                                            transition: 'all 0.14s ease',
                                            textAlign: 'left',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = opt.hoverBg;
                                            e.currentTarget.style.borderColor = opt.hoverBorder;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#FFFFFF';
                                            e.currentTarget.style.borderColor = '#F1F5F9';
                                        }}
                                    >
                                        {/* Icon Container */}
                                        <div
                                            style={{
                                                width: '34px',
                                                height: '34px',
                                                borderRadius: '9px',
                                                background: opt.iconBg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: opt.color,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {opt.icon}
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '13px',
                                                        fontWeight: 700,
                                                        color: '#0F172A',
                                                        fontFamily: 'Outfit, sans-serif',
                                                    }}
                                                >
                                                    {opt.label}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '10.5px',
                                                        fontWeight: 600,
                                                        fontFamily: 'Outfit, sans-serif',
                                                        color: '#64748B',
                                                        background: '#F8FAFC',
                                                        border: '1px solid #E2E8F0',
                                                        padding: '1px 6px',
                                                        borderRadius: '9999px',
                                                    }}
                                                >
                                                    {opt.tag}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: '11px',
                                                    color: '#64748B',
                                                    marginTop: '1.5px',
                                                }}
                                            >
                                                {opt.type === 'lunch'
                                                    ? `1 hr • Back at ~${getEstimatedResumeTime(60)}`
                                                    : opt.description}
                                            </div>
                                        </div>

                                        <ChevronRight
                                            size={14}
                                            style={{ color: '#CBD5E1', flexShrink: 0 }}
                                        />
                                    </button>
                                ))}
                            </div>

                            {/* Clean Stats Footer */}
                            <div
                                style={{
                                    marginTop: '8px',
                                    padding: '7px 8px 3px',
                                    borderTop: '1px solid #F1F5F9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '11px',
                                    color: '#64748B',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} style={{ color: '#94A3B8' }} /> Break today:
                                </span>
                                <span
                                    style={{
                                        fontFamily: 'Outfit, monospace',
                                        fontWeight: 600,
                                        color: totalBreakElapsed > 0 ? '#0F172A' : '#94A3B8',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {totalBreakElapsed > 0 ? formatElapsed(totalBreakElapsed) : '00:00:00'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: TEA DURATION ───────────────────────────────── */}
                    {step === 'tea' && (
                        <div style={{ padding: '10px 10px 12px' }}>
                            <button
                                onClick={() => setStep('pick')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#64748B',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    fontFamily: 'Outfit, sans-serif',
                                    padding: '2px 4px',
                                    marginBottom: '8px',
                                }}
                            >
                                <ArrowLeft size={12} /> Back
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {TEA_DURATION_OPTIONS.map((opt) => {
                                    const resumeTime = getEstimatedResumeTime(opt.minutes);
                                    return (
                                        <button
                                            key={opt.minutes}
                                            onClick={() => handleTeaDurationSelect(opt.minutes, opt.seconds)}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '9px 12px',
                                                borderRadius: '11px',
                                                border: '1px solid #E2E8F0',
                                                background: '#FFFFFF',
                                                cursor: 'pointer',
                                                transition: 'all 0.14s ease',
                                                textAlign: 'left',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#FAF8FF';
                                                e.currentTarget.style.borderColor = '#DDD6FE';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#FFFFFF';
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span
                                                        style={{
                                                            fontSize: '13px',
                                                            fontWeight: 700,
                                                            color: '#0F172A',
                                                            fontFamily: 'Outfit, sans-serif',
                                                        }}
                                                    >
                                                        {opt.label}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            fontWeight: 600,
                                                            fontFamily: 'Outfit, sans-serif',
                                                            color: opt.tagText,
                                                            background: opt.tagBg,
                                                            padding: '1px 5px',
                                                            borderRadius: '9999px',
                                                        }}
                                                    >
                                                        {opt.tag}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                                                    Back at ~{resumeTime}
                                                </div>
                                            </div>

                                            <ChevronRight size={14} style={{ color: '#94A3B8' }} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: CUSTOM REASON ──────────────────────────────── */}
                    {step === 'reason' && (
                        <div style={{ padding: '10px 12px 12px' }}>
                            <button
                                onClick={() => setStep('pick')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#64748B',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    fontFamily: 'Outfit, sans-serif',
                                    padding: '2px 4px',
                                    marginBottom: '8px',
                                }}
                            >
                                <ArrowLeft size={12} /> Back
                            </button>

                            {/* Informational notification note */}
                            <div
                                style={{
                                    background: '#FFF1F2',
                                    border: '1px solid #FECDD3',
                                    borderRadius: '9px',
                                    padding: '7px 10px',
                                    marginBottom: '10px',
                                    fontSize: '11px',
                                    color: '#9F1239',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                <Bell size={13} style={{ color: '#E11D48', flexShrink: 0 }} />
                                <span>Team members will be notified that you are away.</span>
                            </div>

                            {/* Quick Suggestion Pills */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                                {PRESET_REASONS.map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setReason(preset)}
                                        style={{
                                            fontSize: '10.5px',
                                            fontWeight: 600,
                                            fontFamily: 'Outfit, sans-serif',
                                            padding: '2px 7px',
                                            borderRadius: '9999px',
                                            border: '1px solid #E2E8F0',
                                            background: reason === preset ? '#FFE4E6' : '#FFFFFF',
                                            color: reason === preset ? '#BE123C' : '#475569',
                                            borderColor: reason === preset ? '#FDA4AF' : '#E2E8F0',
                                            cursor: 'pointer',
                                            transition: 'all 0.12s',
                                        }}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>

                            <input
                                ref={inputRef}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleOtherSubmit();
                                }}
                                placeholder="Reason (e.g. Doctor appointment)"
                                maxLength={120}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid #CBD5E1',
                                    fontSize: '12.5px',
                                    fontFamily: 'Outfit, sans-serif',
                                    color: '#0F172A',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = '#E11D48')}
                                onBlur={(e) => (e.currentTarget.style.borderColor = '#CBD5E1')}
                            />

                            <button
                                onClick={handleOtherSubmit}
                                disabled={isBroadcasting || !reason.trim()}
                                style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: reason.trim() ? '#E11D48' : '#F1F5F9',
                                    color: reason.trim() ? '#FFFFFF' : '#94A3B8',
                                    fontSize: '12.5px',
                                    fontWeight: 600,
                                    fontFamily: 'Outfit, sans-serif',
                                    cursor: reason.trim() && !isBroadcasting ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {isBroadcasting ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>Notifying…</span>
                                    </>
                                ) : (
                                    'Notify Team & Start Break'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Micro-Animation */}
            <style>{`
                @keyframes breakPopIn {
                    from {
                        opacity: 0;
                        transform: translateY(-4px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}
