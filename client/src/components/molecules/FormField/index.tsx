import React from 'react';
import { Label } from '@/components/atoms/Label';

export interface FormFieldProps {
    label?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    htmlFor?: string;
    className?: string;
    children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    required,
    hint,
    error,
    htmlFor,
    className = '',
    children,
}) => (
    <div className={`flex flex-col ${className}`}>
        {label && (
            <Label htmlFor={htmlFor} required={required} hint={hint}>
                {label}
            </Label>
        )}
        {children}
        {error && (
            <p className="mt-1 text-xs text-red-600" role="alert">
                {error}
            </p>
        )}
    </div>
);
