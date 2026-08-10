import WordleKey from './WordleKey';
import type { KeyStatus } from '../types/wordle.types';
import { KEYBOARD_LAYOUT } from '../constants/wordleConstants';

interface WordleKeyboardProps {
  keyStatuses: Record<string, KeyStatus>;
  onKey: (key: string) => void;
  disabled?: boolean;
}

export default function WordleKeyboard({ keyStatuses, onKey, disabled = false }: WordleKeyboardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        transition: 'opacity 0.2s',
      }}
    >
      {KEYBOARD_LAYOUT.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{ display: 'flex', gap: 6, justifyContent: 'center' }}
        >
          {row.map((key) => (
            <WordleKey
              key={key}
              label={key}
              status={keyStatuses[key] || 'unused'}
              onClick={onKey}
              isWide={key === 'ENTER' || key === '⌫'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
