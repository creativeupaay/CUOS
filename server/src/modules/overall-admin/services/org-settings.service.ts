import { OrgSettings, IOrgSettings } from '../models/OrgSettings.model';
import { AuditLog } from '../models/AuditLog.model';
import AppError from '../../../utils/appError';

/**
 * Get organization settings (or create default)
 */
export const getSettings = async (): Promise<IOrgSettings> => {
    let settings = await OrgSettings.findOne();

    if (!settings) {
        settings = await OrgSettings.create({});
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
    let settings = await OrgSettings.findOne();

    if (!settings) {
        settings = await OrgSettings.create(data);
    } else {
        Object.assign(settings, data);
        await settings.save();
    }

    await AuditLog.create({
        userId: adminId,
        action: 'settings_updated',
        resource: 'settings',
        details: data,
    });

    return settings;
};
