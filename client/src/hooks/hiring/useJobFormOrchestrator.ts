import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    useDeleteJobTemplateMutation,
    useGetApplicationFieldLibraryQuery,
    useGetJobByIdQuery,
    useGetJobTemplatesQuery,
    useCreateJobTemplateMutation,
    useGetHiringEmployeesListQuery,
} from '@/features/hiring/hiringApi';
import { useGetOrgSettingsQuery } from '@/features/overall-admin';
import { useJobForm, buildApplicationFormState } from './useJobForm';
import { dedupeDepartments, DEFAULT_DEPARTMENTS } from '@/utils/department';

export function useJobFormOrchestrator() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const {
        form,
        setForm,
        errors,
        serverError,
        setServerError,
        successMsg,
        setSuccessMsg,
        set,
        handleImportTemplate,
        handleSubmit,
        orderedOptionalFields,
        importedCustomFields,
        isSubmitting,
    } = useJobForm();

    const { data: jobData, isLoading: isLoadingJob } = useGetJobByIdQuery(id ?? '', { skip: !isEdit });
    const { data: orgSettingsData } = useGetOrgSettingsQuery();
    const { data: templatesData } = useGetJobTemplatesQuery();
    const { data: fieldLibraryData } = useGetApplicationFieldLibraryQuery();
    const { data: employeesData } = useGetHiringEmployeesListQuery();

    const [createTemplate, { isLoading: isCreatingTemplate }] = useCreateJobTemplateMutation();
    const [deleteTemplate, { isLoading: isDeletingTemplate }] = useDeleteJobTemplateMutation();

    const templates = templatesData?.data?.templates || [];
    const fieldLibrary = fieldLibraryData?.data?.fields || [];
    const employees = employeesData?.data?.employees || [];

    const [showManageTemplates, setShowManageTemplates] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    const configuredDepartments = useMemo(() => {
        const orgDepartments = orgSettingsData?.data?.departments?.length
            ? dedupeDepartments(orgSettingsData.data.departments)
            : DEFAULT_DEPARTMENTS;
        return dedupeDepartments([...orgDepartments, 'Creative']);
    }, [orgSettingsData]);

    const departmentOptions =
        form.department && !configuredDepartments.includes(form.department)
            ? [form.department, ...configuredDepartments]
            : configuredDepartments;

    const selectedCustomFieldKeys = useMemo(
        () => new Set(form.applicationForm.customFields.map((field) => field.key)),
        [form.applicationForm.customFields]
    );

    useEffect(() => {
        if (!isEdit || !jobData?.data.job) return;
        const job = jobData.data.job;
        setForm({
            title: job.title,
            department: job.department,
            locationType: job.locationType || 'In-Office',
            location: job.location,
            description: job.description,
            requirements: job.requirements,
            employmentType: job.employmentType,
            isHiring: job.isHiring,
            assignmentRequired: job.assignmentRequired,
            managers: (job.managers as Array<{ _id: string }>)?.map((m) => m._id) || [],
            applicationForm: buildApplicationFormState(job.applicationForm),
        });
    }, [isEdit, jobData, setForm]);

    const onSubmit = (e: React.FormEvent) => void handleSubmit(e, { isEdit, id, navigate });

    const onImportTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => handleImportTemplate(e, templates);

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return;
        setServerError('');
        try {
            await createTemplate({
                templateName: newTemplateName.trim(),
                title: form.title,
                department: form.department,
                locationType: form.locationType,
                location: form.locationType === 'Remote' ? '' : form.location,
                description: form.description,
                requirements: form.requirements,
                employmentType: form.employmentType,
                applicationForm: form.applicationForm,
            }).unwrap();
            setShowSaveTemplateModal(false);
            setNewTemplateName('');
            setSuccessMsg('Template saved successfully');
            window.setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: unknown) {
            const error = err as { data?: { message?: string } };
            setServerError(error?.data?.message || 'Failed to save template');
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        try {
            await deleteTemplate(templateId).unwrap();
        } catch (err: unknown) {
            const error = err as { data?: { message?: string } };
            setServerError(error?.data?.message || 'Failed to delete template');
        }
    };

    return {
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
    };
}
