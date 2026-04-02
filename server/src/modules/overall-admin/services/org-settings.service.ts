import { OrgSettings, IOrgSettings } from '../models/OrgSettings.model';
import { AuditLog } from '../models/AuditLog.model';
import { dedupeDepartments, DEFAULT_DEPARTMENTS } from '../../../utils/department.util';

/**
 * Get organization settings (or create default)
 */
export const getSettings = async (): Promise<IOrgSettings> => {
    let settings = await OrgSettings.findOne();

    if (!settings) {
        settings = await OrgSettings.create({});
    } else {
        const normalizedDepartments = dedupeDepartments([
            ...settings.departments,
            ...DEFAULT_DEPARTMENTS.filter((department) => department === 'Creative'),
        ]);
        if (JSON.stringify(normalizedDepartments) !== JSON.stringify(settings.departments)) {
            settings.departments = normalizedDepartments;
            await settings.save();
        }
    }

    return settings;
};

/**
 * Update organization settings
 */
export const updateSettings = async (
    data: Partial<IOrgSettings>,
    adminId: string
): Promise<IOrgSettings> => {
    const normalizedData = { ...data };
    if (normalizedData.departments) {
        normalizedData.departments = dedupeDepartments(normalizedData.departments);
    }

    let settings = await OrgSettings.findOne();

    if (!settings) {
        settings = await OrgSettings.create(normalizedData);
    } else {
        Object.assign(settings, normalizedData);
        await settings.save();
    }

    await AuditLog.create({
        userId: adminId,
        action: 'settings_updated',
        resource: 'settings',
        details: normalizedData,
    });

    return settings;
};
