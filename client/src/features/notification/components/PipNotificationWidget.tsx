import { useState, useEffect } from 'react';
import { Bell, ExternalLink, X, CheckCircle2 } from 'lucide-react';

interface PipNotificationWidgetProps {
    onClose: () => void;
}

export default function PipNotificationWidget({ onClose }: PipNotificationWidgetProps) {
    const [currentNotif, setCurrentNotif] = useState<{
        title: string;
        message: string;
        link?: string;
        time: string;
    } | null>(null);

    useEffect(() => {
        const handleNotif = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.title) {
                setCurrentNotif({
                    title: detail.title,
                    message: detail.message,
                    link: detail.link,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
            }
        };

        window.addEventListener('cuos:new-notification', handleNotif);
        return () => window.removeEventListener('cuos:new-notification', handleNotif);
    }, []);

    const handleOpenLink = () => {
        try {
            window.focus();
        } catch {
            // Ignore window focus error
        }
        if (currentNotif?.link) {
            window.location.href = currentNotif.link;
        }
    };

    return (
        <div
            className="w-full h-full flex flex-col justify-between p-3.5 bg-[#F8FAFC] text-slate-900 select-none box-border border border-slate-200/80 rounded-2xl shadow-xl"
            style={{ height: '100vh', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span
                        className="text-[11px] font-bold tracking-wider text-emerald-600 uppercase flex items-center gap-1"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                        <Bell size={12} className="text-emerald-500" />
                        CUOS NOTIFICATION
                    </span>
                </div>

                <button
                    onClick={onClose}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all"
                    title="Close floating notification widget"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Notification Content Body */}
            <div className="my-auto py-2 flex-1 flex flex-col justify-center">
                {currentNotif ? (
                    <div className="animate-fadeIn">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <h4
                                className="text-sm font-bold text-slate-900 truncate"
                                style={{ fontFamily: 'Outfit, sans-serif' }}
                            >
                                {currentNotif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                {currentNotif.time}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {currentNotif.message}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-2 text-slate-400">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mb-1.5 text-emerald-500">
                            <CheckCircle2 size={18} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            Listening for live notifications...
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                            Real-time alerts will pop up here over VS Code
                        </span>
                    </div>
                )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-200/60 shrink-0">
                {currentNotif && (
                    <button
                        onClick={() => setCurrentNotif(null)}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-slate-200/70 text-slate-700 hover:bg-slate-300 transition-all"
                    >
                        Dismiss
                    </button>
                )}
                <button
                    onClick={handleOpenLink}
                    className="flex items-center gap-1 px-3.5 py-1.5 text-[11px] font-semibold rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm active:scale-95"
                >
                    <span>Open CUOS</span>
                    <ExternalLink size={12} />
                </button>
            </div>
        </div>
    );
}
