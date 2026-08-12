import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  appendLetter,
  removeLetter,
  setSubmitting,
  triggerShake,
  clearShake,
  setError,
} from '../store/wordleSlice';
import { WORDLE_WORD_LENGTH } from '../constants/wordleConstants';

/**
 * useWordleKeyboard — handles both physical and virtual keyboard input for Wordle.
 *
 * Validates input before dispatching (5 letters only, alpha only).
 * Submitting is delegated to the onSubmit callback (which calls the API).
 */
export function useWordleKeyboard(
  onSubmit: (guess: string) => Promise<void>,
  isDisabled: boolean
) {
  const dispatch = useAppDispatch();
  const currentInput = useAppSelector((s) => s.wordle.currentInput);
  const isSubmitting = useAppSelector((s) => s.wordle.isSubmitting);

  const handleKey = useCallback(
    (key: string) => {
      if (isDisabled || isSubmitting) return;

      const upper = key.toUpperCase();

      if (upper === 'ENTER') {
        if (currentInput.length < WORDLE_WORD_LENGTH) {
          dispatch(triggerShake());
          dispatch(setError('Not enough letters'));
          setTimeout(() => {
            dispatch(clearShake());
            dispatch(setError(null));
          }, 800);
          return;
        }
        dispatch(setSubmitting(true));
        onSubmit(currentInput).finally(() => {
          dispatch(setSubmitting(false));
        });
        return;
      }

      if (upper === '⌫' || upper === 'BACKSPACE') {
        dispatch(removeLetter());
        return;
      }

      if (/^[A-Z]$/.test(upper)) {
        dispatch(appendLetter(upper));
      }
    },
    [currentInput, isDisabled, isSubmitting, onSubmit, dispatch]
  );

  // Physical keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      handleKey(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  return { handleKey, currentInput };
}
