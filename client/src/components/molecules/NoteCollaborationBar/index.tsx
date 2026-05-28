import { CollaborationStatus, PresenceAvatars } from '@/features/collaboration';
import type { UserPresence } from '@/features/collaboration';

interface NoteCollaborationBarProps {
    isConnected: boolean;
    isSyncing: boolean;
    visibleActiveUsers: UserPresence[];
}

export function NoteCollaborationBar({ isConnected, isSyncing, visibleActiveUsers }: NoteCollaborationBarProps) {
    return (
        <div className="flex items-center gap-2">
            <CollaborationStatus isConnected={isConnected} isSyncing={isSyncing} />
            <PresenceAvatars users={visibleActiveUsers} maxDisplay={4} />
        </div>
    );
}
