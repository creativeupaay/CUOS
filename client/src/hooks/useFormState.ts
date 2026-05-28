import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';

export interface UseFormStateOptions<T> {
    initialValues: T;
    onSubmit: (values: T) => Promise<void>;
    validate?: (values: T) => Partial<Record<keyof T, string>>;
}

export interface UseFormStateReturn<T> {
    values: T;
    errors: Partial<Record<keyof T, string>>;
    isSubmitting: boolean;
    /** Update a single field */
    setField: <K extends keyof T>(key: K, value: T[K]) => void;
    /** Reset form to initial values */
    reset: (overrides?: Partial<T>) => void;
    /** Load values for editing (fills form with existing data) */
    loadForEdit: (data: Partial<T>) => void;
    /** Trigger form submission */
    submit: () => Promise<void>;
}

/**
 * Generic form state manager with optional validation and async submission.
 *
 * Usage:
 *   const form = useFormState({
 *     initialValues: { description: '', amount: 0 },
 *     onSubmit: async (values) => { await createExpense(values).unwrap(); },
 *   });
 */
export function useFormState<T extends Record<string, unknown>>({
    initialValues,
    onSubmit,
    validate,
}: UseFormStateOptions<T>): UseFormStateReturn<T> {
    const [values, setValues] = useState<T>(initialValues);
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const reset = useCallback(
        (overrides?: Partial<T>) => {
            setValues({ ...initialValues, ...overrides });
            setErrors({});
        },
        [initialValues],
    );

    const loadForEdit = useCallback(
        (data: Partial<T>) => {
            setValues({ ...initialValues, ...data });
            setErrors({});
        },
        [initialValues],
    );

    const submit = useCallback(async () => {
        if (validate) {
            const validationErrors = validate(values);
            if (Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors);
                return;
            }
        }
        setIsSubmitting(true);
        try {
            await onSubmit(values);
        } catch (err) {
            logger.error('[useFormState] Submission failed:', err);
        } finally {
            setIsSubmitting(false);
        }
    }, [values, validate, onSubmit]);

    return { values, errors, isSubmitting, setField, reset, loadForEdit, submit };
}
