import { Types } from 'mongoose';
import {
    ApplicationActivity,
    type ActivityActorType,
    type IApplicationActivity,
} from '../models/ApplicationActivity.model';

interface LogApplicationActivityInput {
    applicationId: string | Types.ObjectId;
    type: string;
    title: string;
    description: string;
    actorType?: ActivityActorType;
    actorId?: string | Types.ObjectId;
    metadata?: Record<string, unknown>;
}

export async function logApplicationActivity(
    input: LogApplicationActivityInput
): Promise<IApplicationActivity> {
    return ApplicationActivity.create({
        applicationId: input.applicationId,
        type: input.type,
        title: input.title,
        description: input.description,
        actorType: input.actorType || 'system',
        actorId: input.actorId,
        metadata: input.metadata,
    });
}

export async function getApplicationActivityTimeline(
    applicationId: string
): Promise<IApplicationActivity[]> {
    return ApplicationActivity.find({ applicationId })
        .sort({ createdAt: -1 })
        .populate('actorId', 'name email');
}
