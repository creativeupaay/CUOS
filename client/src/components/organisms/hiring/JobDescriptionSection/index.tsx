import React, { type CSSProperties, type KeyboardEvent } from 'react';
import { FormField } from '@/components/molecules/FormField';
import type { FormState } from '@/hooks/hiring/useJobForm';

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

const PAGE_SECTION_TOGGLES = [
    { key: 'showAboutRole', label: 'About the Role' },
    { key: 'showRequirements', label: 'Requirements & Qualifications' },
    { key: 'showWhatYouGet', label: 'What you get' },
] as const;

type PageSectionKey = (typeof PAGE_SECTION_TOGGLES)[number]['key'];

export interface JobDescriptionSectionProps {
    form: Pick<
        FormState,
        'description' | 'requirements' | 'applicationForm'
    >;
    errors: Partial<Record<keyof FormState, string>>;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
}

export const JobDescriptionSection: React.FC<JobDescriptionSectionProps> = ({
    form,
    errors,
    setForm,
}) => {
    const handleBoldShortcut = (
        e: KeyboardEvent<HTMLTextAreaElement>,
        applyValue: (nextValue: string) => void
    ) => {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
        e.preventDefault();

        const textarea = e.currentTarget;
        const currentValue = textarea.value;
        const start = textarea.selectionStart ?? currentValue.length;
        const end = textarea.selectionEnd ?? currentValue.length;
        const selectedText = currentValue.slice(start, end);
        const wrappedText = selectedText ? `**${selectedText}**` : '****';
        const nextValue = `${currentValue.slice(0, start)}${wrappedText}${currentValue.slice(end)}`;

        applyValue(nextValue);

        window.requestAnimationFrame(() => {
            const nextStart = start + 2;
            const nextEnd = selectedText ? end + 2 : start + 2;
            textarea.focus();
            textarea.setSelectionRange(nextStart, nextEnd);
        });
    };

    const handlePageSectionToggle = (key: PageSectionKey, checked: boolean) => {
        setForm((prev) => ({
            ...prev,
            applicationForm: {
                ...prev.applicationForm,
                pageSections: {
                    ...prev.applicationForm.pageSections,
                    [key]: checked,
                },
            },
        }));
    };

    return (
        <div
            className="rounded-xl border p-6"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
            }}
        >
            <h2
                className="mb-5 text-sm font-semibold"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                Role Details
            </h2>

            <div className="flex flex-col gap-5">
                <FormField label="Job Description" required error={errors.description}>
                    <textarea
                        value={form.description}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        onKeyDown={(e) =>
                            handleBoldShortcut(e, (nextValue) =>
                                setForm((prev) => ({ ...prev, description: nextValue }))
                            )
                        }
                        rows={5}
                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                        style={inputStyle}
                    />
                </FormField>

                <FormField label="Requirements" required error={errors.requirements}>
                    <textarea
                        value={form.requirements}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, requirements: e.target.value }))
                        }
                        onKeyDown={(e) =>
                            handleBoldShortcut(e, (nextValue) =>
                                setForm((prev) => ({ ...prev, requirements: nextValue }))
                            )
                        }
                        rows={4}
                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                        style={inputStyle}
                    />
                </FormField>

                <FormField label="What you get">
                    <textarea
                        value={form.applicationForm.pageSections.whatYouGet}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                applicationForm: {
                                    ...prev.applicationForm,
                                    pageSections: {
                                        ...prev.applicationForm.pageSections,
                                        whatYouGet: e.target.value,
                                    },
                                },
                            }))
                        }
                        onKeyDown={(e) =>
                            handleBoldShortcut(e, (nextValue) =>
                                setForm((prev) => ({
                                    ...prev,
                                    applicationForm: {
                                        ...prev.applicationForm,
                                        pageSections: {
                                            ...prev.applicationForm.pageSections,
                                            whatYouGet: nextValue,
                                        },
                                    },
                                }))
                            )
                        }
                        rows={5}
                        placeholder="Role specific perks, growth, benefits, and learning opportunities"
                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                        style={inputStyle}
                    />
                </FormField>

                <div
                    className="rounded-2xl border p-4"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Job Details Page Sections
                    </p>
                    <p
                        className="mt-1 text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        About the Company is managed centrally in Org Settings. Use toggles to
                        control visibility of role sections.
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {PAGE_SECTION_TOGGLES.map((section) => (
                            <label
                                key={section.key}
                                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <input
                                    type="checkbox"
                                    checked={Boolean(
                                        form.applicationForm.pageSections[section.key as keyof typeof form.applicationForm.pageSections]
                                    )}
                                    onChange={(e) =>
                                        handlePageSectionToggle(section.key, e.target.checked)
                                    }
                                />
                                <span style={{ color: 'var(--color-text-primary)' }}>
                                    {section.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
