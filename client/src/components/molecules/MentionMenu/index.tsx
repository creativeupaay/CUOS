import type { MentionMenuState, MentionableMember } from '@/types/notes';
import { createPortal } from 'react-dom';

interface MentionMenuProps {
    mentionMenu: MentionMenuState | null;
    filteredMentionMembers: MentionableMember[];
    onSelectMember: (member: MentionableMember) => void;
}

export function MentionMenu({ mentionMenu, filteredMentionMembers, onSelectMember }: MentionMenuProps) {
    if (!mentionMenu) return null;

    return createPortal(
        <div
            className="fixed z-[70] w-72 max-h-56 overflow-auto rounded-xl border bg-white shadow-2xl"
            style={{
                top: mentionMenu.placement === 'bottom' ? mentionMenu.top : undefined,
                bottom: mentionMenu.placement === 'top' ? window.innerHeight - mentionMenu.top + 8 : undefined,
                left: Math.max(12, mentionMenu.left),
                borderColor: 'var(--color-border-default)',
            }}
        >
            {filteredMentionMembers.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    No matching team members
                </div>
            ) : (
                filteredMentionMembers.map((member, index) => (
                    <button
                        key={member.userId}
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelectMember(member);
                        }}
                        className="w-full text-left px-3 py-2 transition-colors"
                        style={{
                            backgroundColor: index === mentionMenu.activeIndex ? 'var(--color-bg-subtle)' : '#fff',
                        }}
                    >
                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {member.displayName}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {[member.email, member.sourceLabel].filter(Boolean).join(' • ')}
                        </div>
                    </button>
                ))
            )}
        </div>,
        document.body
    );
}
