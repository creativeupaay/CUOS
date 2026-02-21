import { useState } from 'react';
import { useGetMyAttendanceQuery, useGetEmployeeAttendanceQuery, useCheckInMutation, useCheckOutMutation } from '@/features/hrms/hrmsApi';
import { Clock, Play, Square, Calendar as CalendarIcon } from 'lucide-react';

export default function HrmsAttendancePage() {
    const [view, setView] = useState<'mine' | 'team'>('mine');
    const [notes, setNotes] = useState('');

    // API Hooks
    const { data: myData, isLoading: loadingMine, refetch } = useGetMyAttendanceQuery({});
    // We pass a dummy ID for now unless 'team' view is specific
    const { data: teamData, isLoading: loadingTeam } = useGetEmployeeAttendanceQuery({ id: 'all' }, { skip: view !== 'team' });

    const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();
    const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation();

    const attendanceRecords = view === 'mine' ? (myData?.data?.data || []) : (teamData?.data?.data || []);
    const isLoading = view === 'mine' ? loadingMine : loadingTeam;

    const todayRecord = attendanceRecords.find(r => new Date(r.date).toDateString() === new Date().toDateString());
    const isCheckedIn = todayRecord && !todayRecord.checkOut;

    const handleCheckIn = async () => {
        try {
            await checkIn({ notes }).unwrap();
            setNotes('');
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCheckOut = async () => {
        try {
            await checkOut({ notes }).unwrap();
            setNotes('');
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Attendance
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Track your daily working hours and attendance logs
                    </p>
                </div>

                <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                    {(['mine', 'team'] as const).map((v) => (
                        <button key={v} onClick={() => setView(v)}
                            className="px-4 py-2 text-sm font-medium capitalize cursor-pointer"
                            style={{
                                backgroundColor: view === v ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                color: view === v ? 'white' : 'var(--color-text-primary)',
                            }}>
                            {v === 'mine' ? 'My Attendance' : 'Team Attendance'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Check-In / Check-Out Actions */}
            {view === 'mine' && (
                <div className="rounded-xl border p-6 mb-8 flex flex-col md:flex-row gap-6 items-center justify-between"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <div>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Today's Status</h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            {isCheckedIn ? 'You are currently checked in. Remember to check out!' : 'You have not checked in yet today.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Add notes (optional)"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="px-3 py-2 text-sm rounded-lg border outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />
                        {!isCheckedIn ? (
                            <button
                                onClick={handleCheckIn}
                                disabled={isCheckingIn}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                <Play size={16} />
                                Check In
                            </button>
                        ) : (
                            <button
                                onClick={handleCheckOut}
                                disabled={isCheckingOut}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer"
                                style={{ backgroundColor: '#EF4444' }}
                            >
                                <Square size={16} />
                                Check Out
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Attendance Table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                {isLoading ? (
                    <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading records...</div>
                ) : attendanceRecords.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarIcon size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No attendance records found</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Date', 'Status', 'Check In', 'Check Out', 'Total Hours', 'Notes'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceRecords.map((record) => (
                                <tr key={record._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {new Date(record.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium px-2 py-1 rounded-full capitalize"
                                            style={{
                                                backgroundColor: record.status === 'present' ? 'var(--color-success-soft)' : '#FEF3C7',
                                                color: record.status === 'present' ? 'var(--color-success)' : '#92400E'
                                            }}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                        {record.checkIn ? (
                                            <>
                                                <Clock size={14} />
                                                {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                        {record.checkOut ? (
                                            <>
                                                <Clock size={14} />
                                                {new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                        {record.totalHours} hrs
                                    </td>
                                    <td className="px-4 py-3 text-sm max-w-[200px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                        {record.notes || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
