import type { StandardApplicationFieldId, ApplicationFieldType } from '@/features/hiring';

export const MANDATORY_FIELDS = [
    { key: 'name', label: 'Full Name', description: 'Always required in every job form.' },
    { key: 'email', label: 'Email', description: 'Primary communication channel for the candidate.' },
    { key: 'phone', label: 'Phone Number', description: 'Required for direct recruiter follow-up.' },
    { key: 'location', label: 'Current Location', description: 'Always collected for every application.' },
    { key: 'yearsOfExperience', label: 'Years of Experience', description: 'Numeric experience field shown on all jobs.' },
    { key: 'resume', label: 'Resume', description: 'Kept required so recruiter review flow stays intact.' },
] as const;

export const OPTIONAL_STANDARD_FIELDS: Array<{
    key: StandardApplicationFieldId;
    label: string;
    description: string;
}> = [
    { key: 'portfolio', label: 'Portfolio URL', description: 'Great for design, marketing, and product roles.' },
    { key: 'github', label: 'GitHub URL', description: 'Useful for engineering and technical hiring.' },
    { key: 'linkedin', label: 'LinkedIn URL', description: 'Quick professional profile reference.' },
    { key: 'experience', label: 'Relevant Experience', description: 'Long-form written experience summary.' },
    { key: 'coverLetter', label: 'Cover Letter', description: 'Lets candidates explain why they are a fit.' },
    { key: 'figmaUrl', label: 'Figma URL', description: 'Useful for design and collaborative case studies.' },
];

export const DEFAULT_STANDARD_FIELD_SETTINGS: Record<
    StandardApplicationFieldId,
    { label: string; placeholder?: string; helpText?: string }
> = {
    portfolio: { label: 'Portfolio URL', placeholder: 'https://your-portfolio.com' },
    github: { label: 'GitHub URL', placeholder: 'https://github.com/username' },
    linkedin: { label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/username' },
    experience: { label: 'Relevant Experience', placeholder: 'Briefly highlight your most relevant work' },
    coverLetter: { label: 'Cover Letter', placeholder: 'Tell us why you are a fit for this role' },
    figmaUrl: { label: 'Figma URL', placeholder: 'https://figma.com/file/...' },
};

export const DEFAULT_SELECTED_STANDARD_FIELDS: StandardApplicationFieldId[] = [
    'portfolio',
    'linkedin',
    'experience',
    'coverLetter',
];

export const CUSTOM_FIELD_TYPES: Array<{ value: ApplicationFieldType; label: string }> = [
    { value: 'text', label: 'Text' },
    { value: 'url', label: 'URL' },
    { value: 'number', label: 'Number' },
    { value: 'note', label: 'Note' },
    { value: 'date', label: 'Date' },
    { value: 'attachment', label: 'Attachment' },
];

export const FIELD_TYPE_OPTIONS = CUSTOM_FIELD_TYPES; // alias to match original if needed
