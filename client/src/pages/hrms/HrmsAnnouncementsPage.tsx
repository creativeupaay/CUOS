import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Megaphone, Send, Trash2, Loader2 } from 'lucide-react';
// import { BellRing } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import {
    useCreateAnnouncementMutation,
    useDeleteAnnouncementMutation,
    useGetAnnouncementsQuery,
} from '@/features/hrms/hrmsApi';
import type { Announcement } from '@/features/hrms/types/types';

type AdminTab = 'create' | 'history';

function getRoleName(user: any): string {
    return user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
}

function formatAnnouncementDate(value: string) {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function AnnouncementCard({
    announcement,
    canDelete,
    onDelete,
    isDeleting,
}: {
    announcement: Announcement;
    canDelete: boolean;
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
}) {
    return (
        <div
            className="rounded-2xl border p-5"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
                boxShadow: 'var(--shadow-xs)',
            }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'linear-gradient(135deg,#059669,#0EA5E9)',
                                color: 'white',
                            }}
                        >
                            <Megaphone size={16} />
                        </div>
                        <div className="min-w-0">
                            <p
                                className="text-sm font-semibold truncate"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Company Announcement
                            </p>
                            <p
                                className="text-xs"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                {formatAnnouncementDate(announcement.createdAt)}
                            </p>
                        </div>
                    </div>
                    <p
                        className="text-sm leading-6 whitespace-pre-wrap"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        {announcement.content}
                    </p>
                    <p
                        className="text-xs mt-3"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Published by {announcement.publishedBy?.name || 'Admin'}
                    </p>
                </div>

                {canDelete && onDelete && (
                    <button
                        type="button"
                        onClick={() => onDelete(announcement._id)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            borderColor: '#FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#B91C1C',
                        }}
                    >
                        {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Delete
                    </button>
                )}
            </div>
        </div>
    );
}

export default function HrmsAnnouncementsPage() {
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const roleName = getRoleName(user);
    const isPartner = roleName === 'partner' || !!user?.isPartnerEmployee;
    const isAdminSide = location.pathname.startsWith('/hrms/');
    const isHrAdmin = ['super-admin', 'admin', 'super_admin', 'hr', 'hr-admin', 'hr_admin', 'hr-manager', 'hrmanager', 'human-resources'].includes(roleName);

    const [activeTab, setActiveTab] = useState<AdminTab>('create');
    const [content, setContent] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const { data, isLoading, isFetching } = useGetAnnouncementsQuery(undefined, {
        skip: isPartner,
    });
    const [createAnnouncement, { isLoading: isPublishing }] = useCreateAnnouncementMutation();
    const [deleteAnnouncement, { isLoading: isDeleting }] = useDeleteAnnouncementMutation();

    const announcements = useMemo(
        () => data?.data?.announcements || [],
        [data]
    );

    if (isPartner) return <Navigate to="/dashboard" replace />;

    if (isAdminSide && !isHrAdmin) return <Navigate to="/my-hrms/announcements" replace />;

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = content.trim();
        if (!trimmed) {
            setErrorMessage('Please write the announcement before publishing.');
            return;
        }

        try {
            setErrorMessage('');
            await createAnnouncement({ content: trimmed }).unwrap();
            setContent('');
            setActiveTab('history');
        } catch (error: any) {
            setErrorMessage(error?.data?.message || 'Failed to publish announcement.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteAnnouncement(id).unwrap();
        } catch (error: any) {
            setErrorMessage(error?.data?.message || 'Failed to delete announcement.');
        }
    };

    return (
        <div className="mx-auto page-enter" style={{ maxWidth: '1080px' }}>
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {isAdminSide
                            ? 'Publish company-wide updates and manage announcement history.'
                            : 'Stay updated with the latest company announcements.'}
                    </p>
                </div>

                {/* <div
                    className="hidden sm:flex items-center gap-2 rounded-2xl px-4 py-3 border"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        background: 'linear-gradient(135deg,#ECFDF5,#EFF6FF)',
                    }}
                >
                    <BellRing size={18} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Live Notification Trigger
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Internal users get notified when a new announcement is published.
                        </p>
                    </div>
                </div> */}
            </div>

            {isAdminSide ? (
                <>
                    <div className="flex gap-2 mb-6">
                        {[
                            { key: 'create' as const, label: 'Make an Announcement' },
                            { key: 'history' as const, label: 'Previous Announcements' },
                        ].map((tab) => {
                            const active = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer"
                                    style={
                                        active
                                            ? {
                                                backgroundColor: 'var(--color-primary-soft)',
                                                borderColor: 'var(--color-primary)',
                                                color: 'var(--color-primary-darker)',
                                            }
                                            : {
                                                backgroundColor: 'var(--color-bg-surface)',
                                                borderColor: 'var(--color-border-default)',
                                                color: 'var(--color-text-secondary)',
                                            }
                                    }
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === 'create' ? (
                        <div
                            className="rounded-2xl border p-6"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                                boxShadow: 'var(--shadow-xs)',
                            }}
                        >
                            <form onSubmit={handlePublish}>
                                <label
                                    htmlFor="announcement-content"
                                    className="block text-sm font-semibold mb-2"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    Announcement Content
                                </label>
                                <textarea
                                    id="announcement-content"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Write the announcement you want every internal team member to receive."
                                    rows={8}
                                    className="w-full rounded-2xl border px-4 py-3 text-sm resize-y outline-none transition-colors"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-app)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                                <div className="flex items-center justify-between gap-4 mt-4">
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        This will notify super admin, admins, HR, employees, and internal managers.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={isPublishing}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-transform cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                                        style={{
                                            background: 'linear-gradient(135deg,#059669,#0EA5E9)',
                                            boxShadow: 'var(--shadow-brand)',
                                        }}
                                    >
                                        {isPublishing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                        Publish Announcement
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : null}
                </>
            ) : null}

            {errorMessage ? (
                <div
                    className="rounded-xl px-4 py-3 mt-5 text-sm"
                    style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
                >
                    {errorMessage}
                </div>
            ) : null}

            {(!isAdminSide || activeTab === 'history') && (
                <div className={isAdminSide ? 'mt-6' : ''}>
                    {isLoading || isFetching ? (
                        <div
                            className="rounded-2xl border p-12 flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Loading announcements...
                            </span>
                        </div>
                    ) : announcements.length === 0 ? (
                        <div
                            className="rounded-2xl border p-12 text-center"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <div
                                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                <Megaphone size={26} />
                            </div>
                            <p className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                No announcements yet
                            </p>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                {isAdminSide
                                    ? 'Published announcements will appear here with date and time.'
                                    : 'Announcements from your company will appear here once they are published.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {announcements.map((announcement) => (
                                <AnnouncementCard
                                    key={announcement._id}
                                    announcement={announcement}
                                    canDelete={isAdminSide}
                                    onDelete={handleDelete}
                                    isDeleting={isDeleting}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
