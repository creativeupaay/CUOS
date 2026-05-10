import { type CSSProperties } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';
import {
    JobBasicInfoSection,
    JobDescriptionSection,
    ApplicationFormBuilderSection,
    JobSettingsSection,
    ManageTemplatesModal,
    SaveTemplateModal,
} from '@/components/organisms/hiring';
import { TemplatePickerHeader } from '@/components/molecules/hiring';
import { useJobFormOrchestrator } from '@/hooks/hiring/useJobFormOrchestrator';

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export default function HiringJobFormPage() {
    const {
        isEdit,
        isLoadingJob,
        form,
        setForm,
        errors,
        serverError,
        setServerError,
        successMsg,
        setSuccessMsg,
        set,
        orderedOptionalFields,
        importedCustomFields,
        isSubmitting,
        templates,
        fieldLibrary,
        employees,
        showManageTemplates,
        setShowManageTemplates,
        showSaveTemplateModal,
        setShowSaveTemplateModal,
        newTemplateName,
        setNewTemplateName,
        departmentOptions,
        selectedCustomFieldKeys,
        onSubmit,
        onImportTemplate,
        handleSaveTemplate,
        handleDeleteTemplate,
        isCreatingTemplate,
        isDeletingTemplate,
        navigate,
    } = useJobFormOrchestrator();

    if (isEdit && isLoadingJob) {
        return (
            <div
                className="flex h-[calc(100vh-64px)] items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading job...
                </div>
            </div>
        );
    }

    return (
        <div
            className="mx-auto max-w-[900px] px-8 py-6"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >


            <button
                onClick={() => navigate('/hiring/jobs')}
                className="mb-6 flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
            >
                <ChevronLeft size={16} />
                Back to Jobs
            </button>

            <div className="mb-1 flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
                </h1>

                <TemplatePickerHeader
                    templates={templates}
                    onImport={onImportTemplate}
                    onManage={() => setShowManageTemplates(true)}
                />
            </div>

            <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Configure the job details and control exactly which fields appear in the public application form.
            </p>

            {serverError && (
                <div
                    className="mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
                    style={{
                        backgroundColor: 'var(--color-danger-soft)',
                        color: 'var(--color-danger)',
                        borderColor: 'var(--color-danger)',
                    }}
                >
                    <AlertCircle size={15} />
                    {serverError}
                </div>
            )}

            {successMsg && (
                <div
                    className="mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
                    style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: 'rgb(22, 163, 74)',
                        borderColor: 'rgb(34, 197, 94)',
                    }}
                >
                    <CheckCircle2 size={15} />
                    {successMsg}
                </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
                <JobBasicInfoSection form={form} set={set} errors={errors} departmentOptions={departmentOptions} />
                <JobDescriptionSection form={form} errors={errors} setForm={setForm} />
                <ApplicationFormBuilderSection
                    form={form}
                    setForm={setForm}
                    orderedOptionalFields={orderedOptionalFields}
                    importedCustomFields={importedCustomFields}
                    fieldLibrary={fieldLibrary}
                    selectedCustomFieldKeys={selectedCustomFieldKeys}
                    setServerError={setServerError}
                    setSuccessMsg={setSuccessMsg}
                />
                <JobSettingsSection form={form} set={set} employees={employees} />

                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={() => setShowSaveTemplateModal(true)}
                        className="rounded-lg border px-4 py-2.5 text-sm font-medium"
                        style={{ ...inputStyle, color: 'var(--color-primary)' }}
                    >
                        Save as Template
                    </button>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {isEdit ? 'Update Job' : 'Create Job'}
                    </button>
                </div>
            </form>

            <SaveTemplateModal
                open={showSaveTemplateModal}
                onClose={() => setShowSaveTemplateModal(false)}
                newTemplateName={newTemplateName}
                setNewTemplateName={setNewTemplateName}
                onSaveTemplate={handleSaveTemplate}
                isCreatingTemplate={isCreatingTemplate}
            />

            <ManageTemplatesModal
                open={showManageTemplates}
                onClose={() => setShowManageTemplates(false)}
                templates={templates}
                onDeleteTemplate={handleDeleteTemplate}
                isDeleting={isDeletingTemplate}
            />
        </div>
    );
}
