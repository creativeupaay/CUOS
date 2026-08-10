import type { KeyStatus } from '../types/wordle.types';

interface WordleKeyProps {
  label: string;
  status?: KeyStatus;
  onClick: (key: string) => void;
  isWide?: boolean;
}

const STATUS_BG: Record<KeyStatus | 'unused', string> = {
  correct:  '#059669',
  present:  '#D97706',
  absent:   '#4B5563',
  unused:   'var(--color-bg-subtle, #e2e8f0)',
};

const STATUS_TEXT: Record<KeyStatus | 'unused', string> = {
  correct:  '#fff',
  present:  '#fff',
  absent:   '#fff',
  unused:   'var(--color-text-primary)',
};

export default function WordleKey({ label, status = 'unused', onClick, isWide = false }: WordleKeyProps) {
  const bg = STATUS_BG[status];
  const color = STATUS_TEXT[status];

  return (
    <button
      onClick={() => onClick(label)}
      style={{
        minWidth: isWide ? 64 : 40,
        height: 58,
        borderRadius: 6,
        background: bg,
        color,
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 700,
        fontSize: isWide ? 12 : 15,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.25s, transform 0.1s',
        flexShrink: 0,
        userSelect: 'none',
        letterSpacing: isWide ? 0.5 : 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.93)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      aria-label={label}
    >
      {label === '⌫' ? '⌫' : label}
    </button>
  );
}
